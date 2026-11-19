// Auth & user account routes (teacher setup/login/logout/password change, student login/lookup/list/reset-pin)

import {
  PW_SCHEME,
  LEGACY_HMAC_SCHEME,
  TEACHER_TTL_SEC,
  STUDENT_TTL_SEC,
  MIN_TEACHER_PASSWORD,
  HttpError,
  bad,
  nowIso,
  nowSec,
  safeEqualStr,
  hashSecret,
  verifySecret,
  needsRehash,
  signToken,
  verifyToken,
  reqStr,
  normSid,
  normEmail,
  readJson,
  clientIp,
  audit,
  isLocked,
  json
} from '../utils.js';

const LEGACY_PIN_SCHEME = 'gas-sha256x100';
const LOOKUP_WINDOW_SEC = 15 * 60;
const LOOKUP_MAX_PER_WINDOW = 60;

export async function requireAuth(request, env, roles) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  const p = m ? await verifyToken(env, m[1]) : null;
  if (!p) throw new HttpError(401, 'unauthorized', 'ต้องเข้าสู่ระบบใหม่');
  if (roles && !roles.includes(p.role)) throw new HttpError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
  if (p.role === 'teacher' && p.tv !== undefined) {
    const email = String(p.sub || '').startsWith('teacher:') ? String(p.sub).slice('teacher:'.length) : '';
    const row = email ? await env.DB.prepare('SELECT token_version FROM teachers WHERE email = ?').bind(email).first() : null;
    if (!row || Number(row.token_version) !== Number(p.tv)) {
      throw new HttpError(401, 'unauthorized', 'ต้องเข้าสู่ระบบใหม่');
    }
  } else if (p.role === 'student' && p.tv !== undefined) {
    const row = p.sid ? await env.DB.prepare('SELECT status, token_version FROM students WHERE student_id = ?').bind(p.sid).first() : null;
    if (!row || row.status !== 'active' || Number(row.token_version) !== Number(p.tv)) {
      throw new HttpError(401, 'unauthorized', 'ต้องเข้าสู่ระบบใหม่');
    }
  }
  return p;
}

export function requireRole(auth, role) {
  if (auth.role !== role) throw new HttpError(403, 'forbidden', 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
}

export async function authSetup(request, env) {
  const b = await readJson(request);
  if (!env.SETUP_TOKEN || !safeEqualStr(String(b.setupToken ?? ''), env.SETUP_TOKEN)) {
    throw new HttpError(403, 'forbidden', 'รหัสตั้งค่าไม่ถูกต้อง');
  }
  const existing = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM teachers WHERE auth_scheme IN (?, ?)'
  )
    .bind(PW_SCHEME, LEGACY_HMAC_SCHEME)
    .first();
  if ((existing?.n || 0) > 0) throw new HttpError(409, 'already_setup', 'ตั้งค่าบัญชีครูแล้ว');

  const email = normEmail(b.email);
  const name = reqStr(b.name ?? 'ครูผู้สอน', 'ชื่อ', 100);
  const password = String(b.password ?? '');
  if (password.length < MIN_TEACHER_PASSWORD || password.length > 200) {
    throw bad(`รหัสผ่านต้องมีอย่างน้อย ${MIN_TEACHER_PASSWORD} ตัวอักษร`, 'weak_password');
  }
  await env.DB.prepare('DELETE FROM teachers WHERE auth_scheme NOT IN (?, ?)')
    .bind(PW_SCHEME, LEGACY_HMAC_SCHEME)
    .run();
  const hash = await hashSecret(env, password);
  await env.DB.prepare(
    'INSERT INTO teachers (email, name, auth_scheme, auth_hash, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(email, name, PW_SCHEME, hash, nowIso())
    .run();
  await audit(env, 'setup', 'teacher_setup', email);
  return json({ ok: true });
}

export async function authLogin(request, env) {
  const b = await readJson(request);
  const email = normEmail(b.email);
  const password = String(b.password ?? '');
  const actor = 'login:' + email + '@' + clientIp(request);
  if (await isLocked(env, actor)) {
    throw new HttpError(429, 'locked', 'ผิดพลาดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  }
  const row = await env.DB.prepare('SELECT * FROM teachers WHERE email = ? AND auth_scheme IN (?, ?)')
    .bind(email, PW_SCHEME, LEGACY_HMAC_SCHEME)
    .first();
  const ok = row ? await verifySecret(env, row.auth_hash, password) : false;
  if (!ok) {
    await audit(env, actor, 'login_fail');
    throw new HttpError(401, 'invalid_credentials', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  if (needsRehash(row.auth_hash)) {
    const upgraded = await hashSecret(env, password);
    await env.DB.prepare('UPDATE teachers SET auth_scheme = ?, auth_hash = ?, updated_at = ? WHERE email = ?')
      .bind(PW_SCHEME, upgraded, nowIso(), email)
      .run();
  }
  await audit(env, actor, 'login_ok');
  const token = await signToken(env, {
    sub: 'teacher:' + email,
    role: 'teacher',
    tv: Number(row.token_version || 1),
    exp: nowSec() + TEACHER_TTL_SEC
  });
  return json({ token, role: 'teacher', name: row.name, expires_in: TEACHER_TTL_SEC });
}

export async function authLogout(env, auth) {
  const now = nowIso();
  if (auth.role === 'teacher') {
    const email = String(auth.sub || '').startsWith('teacher:') ? String(auth.sub).slice('teacher:'.length) : '';
    if (email) {
      await env.DB.prepare('UPDATE teachers SET token_version = token_version + 1, updated_at = ? WHERE email = ?')
        .bind(now, email)
        .run();
    }
  } else if (auth.role === 'student' && auth.sid) {
    await env.DB.prepare('UPDATE students SET token_version = token_version + 1, updated_at = ? WHERE student_id = ?')
      .bind(now, auth.sid)
      .run();
  }
  await audit(env, auth.sub, 'logout');
  return json({ ok: true });
}

export async function authChangePassword(request, env, auth) {
  const email = String(auth.sub || '').startsWith('teacher:') ? String(auth.sub).slice('teacher:'.length) : '';
  if (!email) throw new HttpError(401, 'unauthorized', 'ต้องเข้าสู่ระบบใหม่');
  const b = await readJson(request);
  const currentPassword = String(b.currentPassword ?? '');
  const newPassword = String(b.newPassword ?? '');
  if (newPassword.length < MIN_TEACHER_PASSWORD || newPassword.length > 200) {
    throw bad(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_TEACHER_PASSWORD} ตัวอักษร`, 'weak_password');
  }
  const row = await env.DB.prepare('SELECT * FROM teachers WHERE email = ? AND auth_scheme IN (?, ?)')
    .bind(email, PW_SCHEME, LEGACY_HMAC_SCHEME)
    .first();
  if (!row || !(await verifySecret(env, row.auth_hash, currentPassword))) {
    throw new HttpError(401, 'invalid_credentials', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
  const newHash = await hashSecret(env, newPassword);
  const now = nowIso();
  const nextTv = Number(row.token_version || 1) + 1;
  await env.DB.prepare('UPDATE teachers SET auth_scheme = ?, auth_hash = ?, token_version = ?, updated_at = ? WHERE email = ?')
    .bind(PW_SCHEME, newHash, nextTv, now, email)
    .run();
  await audit(env, auth.sub, 'password_change');
  const token = await signToken(env, {
    sub: 'teacher:' + email,
    role: 'teacher',
    tv: nextTv,
    exp: nowSec() + TEACHER_TTL_SEC
  });
  return json({ ok: true, token, role: 'teacher', name: row.name, expires_in: TEACHER_TTL_SEC });
}

async function legacyPinHash(env, sid, pin, salt) {
  const value = `${salt}:${sid}:${pin}:${env.LEGACY_PIN_PEPPER}`;
  let h = '';
  for (let i = 0; i < 100; i++) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(h + value));
    h = Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return h;
}

async function verifyStudentPin(env, s, sid, pin) {
  if (s.pin_scheme !== LEGACY_PIN_SCHEME) {
    const ok = await verifySecret(env, s.pin_hash, pin);
    if (ok && needsRehash(s.pin_hash)) {
      const now = nowIso();
      const upgraded = await hashSecret(env, pin);
      await env.DB.prepare(
        'UPDATE students SET pin_hash = ?, pin_updated_at = ?, updated_at = ? WHERE student_id = ? AND pin_scheme IS NULL'
      )
        .bind(upgraded, now, now, sid)
        .run();
    }
    return ok;
  }
  if (!env.LEGACY_PIN_PEPPER || !s.pin_salt) return false;
  const h = await legacyPinHash(env, sid, pin, s.pin_salt);
  if (!safeEqualStr(h, String(s.pin_hash))) return false;
  const now = nowIso();
  const upgraded = await hashSecret(env, pin);
  await env.DB.prepare(
    'UPDATE students SET pin_hash = ?, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = ?, updated_at = ? WHERE student_id = ? AND pin_scheme = ?'
  )
    .bind(upgraded, now, now, sid, LEGACY_PIN_SCHEME)
    .run();
  await audit(env, 'pin:' + sid, 'pin_upgraded');
  return true;
}

function publicStudent(s) {
  return {
    student_id: s.student_id,
    class_name: s.class_name,
    no: s.no,
    prefix: s.prefix,
    first_name: s.first_name,
    last_name: s.last_name,
    nickname: s.nickname
  };
}

export async function studentLogin(request, env) {
  const b = await readJson(request);
  const sid = normSid(b.student_id);
  const pin = String(b.pin ?? '');
  if (!/^\d{6}$/.test(pin)) throw bad('รหัส PIN ต้องเป็นตัวเลข 6 หลัก', 'bad_pin');
  const actor = 'pin:' + sid + '@' + clientIp(request);
  if (await isLocked(env, actor)) {
    throw new HttpError(429, 'locked', 'ผิดพลาดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  }
  const s = await env.DB.prepare('SELECT * FROM students WHERE student_id = ?').bind(sid).first();
  if (!s || s.status !== 'active') {
    await audit(env, actor, 'login_fail');
    throw new HttpError(401, 'invalid_credentials', 'รหัสนักเรียนหรือ PIN ไม่ถูกต้อง');
  }

  let created = false;
  if (!s.pin_hash) {
    const h = await hashSecret(env, pin);
    const now = nowIso();
    const r = await env.DB.prepare(
      'UPDATE students SET pin_hash = ?, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = ?, updated_at = ? WHERE student_id = ? AND pin_hash IS NULL'
    )
      .bind(h, now, now, sid)
      .run();
    if (r.meta.changes !== 1) throw new HttpError(409, 'retry', 'กรุณาลองใหม่อีกครั้ง');
    created = true;
    await audit(env, actor, 'pin_set');
  } else {
    const ok = await verifyStudentPin(env, s, sid, pin);
    if (!ok) {
      await audit(env, actor, 'login_fail');
      throw new HttpError(401, 'invalid_credentials', 'รหัสนักเรียนหรือ PIN ไม่ถูกต้อง');
    }
  }
  await audit(env, actor, 'login_ok');
  const token = await signToken(env, {
    sub: 'student:' + sid,
    role: 'student',
    sid,
    class_name: s.class_name,
    tv: Number(s.token_version || 1),
    exp: nowSec() + STUDENT_TTL_SEC
  });
  return json({
    token,
    role: 'student',
    pin_created: created,
    student: publicStudent(s),
    expires_in: STUDENT_TTL_SEC
  });
}

export async function studentLookup(request, env) {
  const b = await readJson(request);
  const sid = normSid(b.student_id);
  const ip = clientIp(request);
  const actor = 'lookup:' + ip;
  const since = new Date(Date.now() - LOOKUP_WINDOW_SEC * 1000).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_log WHERE actor = ? AND action = 'lookup' AND created_at >= ?"
  )
    .bind(actor, since)
    .first();
  if ((row?.n || 0) >= LOOKUP_MAX_PER_WINDOW) {
    throw new HttpError(429, 'rate_limited', 'ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
  }
  await audit(env, actor, 'lookup');
  const s = await env.DB.prepare('SELECT * FROM students WHERE student_id = ?').bind(sid).first();
  if (!s || s.status !== 'active') throw new HttpError(404, 'not_found', 'ไม่พบเลขประจำตัวนี้ในระบบ');
  const first = String(s.first_name || '');
  return json({
    student: { student_id: s.student_id, class_name: s.class_name, display_name: (first ? first.charAt(0) : '') + '•••' },
    has_pin: !!s.pin_hash,
    locked: await isLocked(env, 'pin:' + sid + '@' + ip)
  });
}

export async function listStudents(env, url) {
  const cls = url.searchParams.get('class');
  const stmt = cls
    ? env.DB.prepare(
        'SELECT student_id, class_name, no, prefix, first_name, last_name, nickname, status, (pin_hash IS NOT NULL) AS has_pin FROM students WHERE class_name = ? ORDER BY no'
      ).bind(cls)
    : env.DB.prepare(
        'SELECT student_id, class_name, no, prefix, first_name, last_name, nickname, status, (pin_hash IS NOT NULL) AS has_pin FROM students ORDER BY class_name, no'
      );
  const { results } = await stmt.all();
  return json({ students: results });
}

export async function resetPin(env, auth, sid) {
  const r = await env.DB.prepare(
    'UPDATE students SET pin_hash = NULL, pin_scheme = NULL, pin_salt = NULL, pin_updated_at = NULL, token_version = token_version + 1, updated_at = ? WHERE student_id = ?'
  )
    .bind(nowIso(), sid)
    .run();
  if (r.meta.changes !== 1) throw new HttpError(404, 'not_found', 'ไม่พบนักเรียน');
  await audit(env, auth.sub, 'pin_reset', sid);
  return json({ ok: true });
}
