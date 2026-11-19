// Teacher-assisted PIN reset request & confirmation routes (students / interns)

import {
  HttpError,
  bad,
  nowIso,
  randomBytes,
  hashSecret,
  verifySecret,
  normSid,
  clientIp,
  audit
} from '../utils.js';
import { internIdOf } from './interns.js';

const PR_CODE_TTL_MS = 24 * 3600 * 1000;
const PR_PENDING_TTL_MS = 14 * 24 * 3600 * 1000;
const PR_MAX_ATTEMPTS = 5;
const PR_REQ_PER_HOUR_IP = 10;
const PR_CONFIRM_PER_HOUR_IP = 30;
const PR_STAFF_MSG = 'ส่งคำขอถึงครูประจำวิชาแล้ว (หากรหัสนี้มีบัญชีในระบบ) กรุณาติดต่อครูเพื่อรับรหัสยืนยัน แล้วกลับมากรอกรหัสที่หน้านี้เพื่อตั้ง PIN ใหม่ด้วยตนเอง';

function weakPin(pin) {
  return /^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321';
}

async function prThrottle(env, request, scope, max) {
  const ip = clientIp(request);
  const actor = `${scope}:${ip}`;
  const since = new Date(Date.now() - 3600000).toISOString();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE actor = ? AND action = ? AND created_at >= ?').bind(actor, scope, since).first();
  if (Number(row?.n || 0) >= max) throw new HttpError(429, 'rate_limited', 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือแจ้งคุณครู');
  await audit(env, actor, scope);
}

function prSubject(role, id) {
  if (role === 'student') {
    const sid = normSid(id);
    if (!/^\d{4,10}$/.test(sid)) throw bad('รูปแบบรหัสนักเรียนไม่ถูกต้อง', 'bad_id');
    return { role: 'student', subject: sid };
  }
  let iid;
  try {
    iid = internIdOf(id);
  } catch {
    return null;
  }
  return { role: 'intern', subject: iid };
}

async function prAccountExists(env, who) {
  if (who.role === 'student') {
    return !!(await env.DB.prepare("SELECT 1 AS x FROM students WHERE student_id = ? AND status = 'active'").bind(who.subject).first());
  }
  return !!(await env.DB.prepare("SELECT 1 AS x FROM interns WHERE intern_id = ? AND active = 1 AND status = 'approved'").bind(who.subject).first());
}

export async function pinResetRequest(request, env, b) {
  await prThrottle(env, request, 'pr_req', PR_REQ_PER_HOUR_IP);
  const kind = b.role === 'student' ? 'student' : 'staff';
  const who = prSubject(kind === 'student' ? 'student' : 'intern', b.id);
  if (kind === 'student') {
    if (!(await prAccountExists(env, who))) throw new HttpError(404, 'not_found', 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาแจ้งคุณครู');
  } else if (!who || !(await prAccountExists(env, who))) {
    return { mode: 'teacher', message: PR_STAFF_MSG };
  }
  const now = Date.now();
  const open = await env.DB.prepare(
    `SELECT id FROM pin_reset_requests WHERE role = ? AND subject = ?
       AND ((status = 'pending' AND created_ms > ?) OR (status = 'approved' AND expires_ms > ?))`
  ).bind(who.role, who.subject, now - PR_PENDING_TTL_MS, now).first();
  if (!open) {
    await env.DB.prepare("INSERT INTO pin_reset_requests (id, role, subject, status, created_ms) VALUES (?, ?, ?, 'pending', ?)")
      .bind(crypto.randomUUID(), who.role, who.subject, now)
      .run();
  }
  return { mode: 'teacher', existing: !!open, message: PR_STAFF_MSG };
}

export async function listPinResets(env) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.role, r.subject, r.status, r.created_ms, r.expires_ms,
            s.prefix AS s_prefix, s.first_name AS s_first, s.last_name AS s_last, s.class_name AS s_class, i.name AS i_name
       FROM pin_reset_requests r
       LEFT JOIN students s ON r.role = 'student' AND s.student_id = r.subject
       LEFT JOIN interns i ON r.role = 'intern' AND i.intern_id = r.subject
      WHERE (r.status = 'pending' AND r.created_ms > ?) OR (r.status = 'approved' AND r.expires_ms > ?)
      ORDER BY r.created_ms`
  ).bind(now - PR_PENDING_TTL_MS, now).all();
  return {
    requests: results.map((r) => ({
      id: r.id, role: r.role, subjectId: r.subject, status: r.status, createdMs: r.created_ms, expiresMs: r.expires_ms || 0,
      name: r.role === 'student' ? `${r.s_prefix || ''}${r.s_first || ''} ${r.s_last || ''}`.trim() : r.i_name || '',
      className: r.role === 'student' ? r.s_class || '' : ''
    }))
  };
}

export async function decidePinReset(env, auth, id, b) {
  const now = Date.now();
  const r = await env.DB.prepare('SELECT * FROM pin_reset_requests WHERE id = ?').bind(id).first();
  const open = r && ((r.status === 'pending' && r.created_ms > now - PR_PENDING_TTL_MS) || (r.status === 'approved' && r.expires_ms > now));
  if (!open) throw new HttpError(404, 'not_found', 'ไม่พบคำขอนี้ หรือหมดอายุแล้ว');
  if (!b.approve) {
    await env.DB.prepare("UPDATE pin_reset_requests SET status = 'rejected', decided_ms = ?, code_hash = NULL WHERE id = ?").bind(now, id).run();
    await audit(env, auth.sub, 'pin_reset_reject', r.subject);
    return { rejected: true };
  }
  const n = new DataView(randomBytes(4).buffer).getUint32(0) % 1000000;
  const code = String(n).padStart(6, '0');
  const expires = now + PR_CODE_TTL_MS;
  await env.DB.prepare("UPDATE pin_reset_requests SET status = 'approved', code_hash = ?, attempts = 0, decided_ms = ?, expires_ms = ? WHERE id = ?")
    .bind(await hashSecret(env, `${r.role}:${r.subject}:${code}`), now, expires, id)
    .run();
  await audit(env, auth.sub, 'pin_reset_approve', r.subject);
  return { code, subjectId: r.subject, role: r.role, expiresMs: expires };
}

export async function pinResetConfirm(request, env, b) {
  await prThrottle(env, request, 'pr_confirm', PR_CONFIRM_PER_HOUR_IP);
  const bad0 = new HttpError(400, 'invalid_code', 'รหัสยืนยันไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาขอรหัสใหม่');
  const who = prSubject(b.role === 'student' ? 'student' : 'intern', b.id);
  const code = String(b.code ?? '').replace(/\s+/g, '');
  const secret = String(b.secret ?? '');
  if (!/^\d{6}$/.test(code)) throw bad('รหัสยืนยันต้องเป็นตัวเลข 6 หลัก', 'bad_code');
  if (!/^\d{6}$/.test(secret)) throw bad('PIN ต้องเป็นตัวเลข 6 หลัก', 'bad_pin');
  if (weakPin(secret)) throw bad('PIN เดาง่ายเกินไป (ห้ามเลขซ้ำทั้งหมด/เรียงลำดับ)', 'weak_pin');
  if (!who) throw bad0;
  const now = Date.now();
  const { results } = await env.DB.prepare(
    "SELECT * FROM pin_reset_requests WHERE role = ? AND subject = ? AND status = 'approved' AND expires_ms > ?"
  ).bind(who.role, who.subject, now).all();
  let match = null;
  for (const r of results) {
    if (await verifySecret(env, r.code_hash, `${r.role}:${r.subject}:${code}`)) {
      match = r;
      break;
    }
  }
  if (!match) {
    let left = PR_MAX_ATTEMPTS;
    for (const r of results) {
      const a = Number(r.attempts) + 1;
      await env.DB.prepare('UPDATE pin_reset_requests SET attempts = ?, status = ? WHERE id = ?').bind(a, a >= PR_MAX_ATTEMPTS ? 'burned' : 'approved', r.id).run();
      left = Math.min(left, Math.max(0, PR_MAX_ATTEMPTS - a));
    }
    if (!results.length) throw bad0;
    throw new HttpError(400, 'invalid_code', left > 0 ? `รหัสยืนยันไม่ถูกต้อง (เหลืออีก ${left} ครั้ง)` : 'ใส่รหัสผิดหลายครั้ง รหัสนี้ถูกยกเลิกแล้ว กรุณาขอรหัสใหม่');
  }
  const hash = await hashSecret(env, secret);
  const iso = nowIso();
  if (who.role === 'student') {
    const u = await env.DB.prepare(
      "UPDATE students SET pin_hash = ?, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = ?, token_version = token_version + 1, updated_at = ? WHERE student_id = ? AND status = 'active'"
    ).bind(hash, iso, iso, who.subject).run();
    if (u.meta.changes !== 1) throw bad0;
    await env.DB.prepare("DELETE FROM audit_log WHERE action = 'login_fail' AND (actor = ? OR actor LIKE ?)")
      .bind('pin:' + who.subject, 'pin:' + who.subject + '@%')
      .run();
  } else {
    const u = await env.DB.prepare("UPDATE interns SET pin_hash = ?, pin_set_at = ? WHERE intern_id = ? AND active = 1 AND status = 'approved'")
      .bind(hash, iso, who.subject)
      .run();
    if (u.meta.changes !== 1) throw bad0;
    await env.DB.prepare("DELETE FROM audit_log WHERE action = 'login_fail' AND (actor = ? OR actor LIKE ?)")
      .bind('intern:' + who.subject, 'intern:' + who.subject + '@%')
      .run();
  }
  await env.DB.prepare("UPDATE pin_reset_requests SET status = CASE WHEN id = ? THEN 'used' ELSE 'superseded' END, used_ms = ? WHERE role = ? AND subject = ? AND status IN ('approved', 'pending')")
    .bind(match.id, now, who.role, who.subject)
    .run();
  await audit(env, `${who.role === 'student' ? 'pin' : 'intern'}:${who.subject}`, 'pin_reset_done');
  return { role: who.role === 'student' ? 'student' : 'staff', message: 'ตั้ง PIN ใหม่เรียบร้อย กรุณาเข้าสู่ระบบด้วย PIN ใหม่' };
}
