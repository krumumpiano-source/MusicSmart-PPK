// Student-teacher intern & mentor supervision routes

import {
  STUDENT_TTL_SEC,
  HttpError,
  bad,
  nowIso,
  nowSec,
  hashSecret,
  verifySecret,
  needsRehash,
  signToken,
  optText,
  isPlainObject,
  parseJson,
  clientIp,
  audit,
  isLocked,
  json,
  runBatch
} from '../utils.js';

const INTERN_REG_PER_HOUR = 20;
const INTERN_PROFILE_FIELDS = ['university', 'faculty', 'major', 'phone', 'email', 'term', 'academic_year', 'preferred_classes', 'mentor_name'];

export function internIdOf(v) {
  const s = String(v ?? '').trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(s)) throw bad('รหัส นศ. ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3-30 ตัว', 'bad_intern_id');
  return s;
}

function internClassList(v) {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
  return [...new Set(arr.map((c) => String(c ?? '').trim().slice(0, 20)).filter(Boolean))].slice(0, 20);
}

function internProfile(r) {
  const o = { internId: r.intern_id, name: r.name, classes: internClassList(r.classes), status: r.status || 'approved' };
  for (const k of INTERN_PROFILE_FIELDS) o[k] = r[k] === null || r[k] === undefined ? '' : String(r[k]);
  return o;
}

export async function internRegister(env, b) {
  const since = new Date(Date.now() - 3600000).toISOString();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE actor = 'intern_reg' AND created_at >= ?").bind(since).first();
  if (Number(n.n) >= INTERN_REG_PER_HOUR) throw new HttpError(429, 'rate_limited', 'มีการลงทะเบียนจำนวนมาก กรุณาลองใหม่ภายหลัง');
  const errs = [];
  const name = String(b.fullName ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 4 || name.length > 80 || !/\s/.test(name)) errs.push('ชื่อ-สกุล');
  const id = String(b.internId ?? '').trim();
  if (!/^[A-Za-z0-9_-]{5,20}$/.test(id)) errs.push('รหัสนักศึกษา (อังกฤษ/ตัวเลข 5–20 ตัว)');
  const text = {};
  for (const [k, label] of [['university', 'มหาวิทยาลัย'], ['faculty', 'คณะ'], ['major', 'สาขา']]) {
    text[k] = String(b[k] ?? '').trim();
    if (text[k].length < 2 || text[k].length > 120) errs.push(label);
  }
  const phone = String(b.phone ?? '').replace(/[\s-]/g, '');
  if (!/^0\d{8,9}$/.test(phone)) errs.push('เบอร์โทร (เช่น 0812345678)');
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) errs.push('อีเมล');
  const term = String(b.term ?? '').trim();
  if (!['1', '2', '3'].includes(term)) errs.push('ภาคเรียน');
  const year = Number(b.academicYear);
  if (!(year >= 2560 && year <= 2600)) errs.push('ปีการศึกษา (พ.ศ.)');
  const pin = String(b.pin ?? '');
  if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') errs.push('PIN 6 หลัก (ห้ามเลขซ้ำ/เรียง)');
  const mentor = String(b.mentorName ?? '').trim();
  if (mentor.length > 80) errs.push('ครูพี่เลี้ยง');
  if (errs.length) throw new HttpError(400, 'invalid', 'กรุณาตรวจสอบ: ' + errs.join(', '));
  const existing = await env.DB.prepare('SELECT status FROM interns WHERE intern_id = ?').bind(id).first();
  if (existing && existing.status !== 'rejected') {
    throw new HttpError(
      409, 'duplicate',
      existing.status === 'pending' ? 'รหัสนักศึกษานี้ลงทะเบียนแล้ว รอครูอนุมัติ' : 'รหัสนักศึกษานี้มีบัญชีแล้ว หากลืม PIN ให้ครูรีเซ็ต'
    );
  }
  const now = nowIso();
  const pinHash = await hashSecret(env, pin);
  const preferred = internClassList(b.preferredClasses).join(',');
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO interns (intern_id, name, classes, pin_hash, pin_set_at, active, status, university, faculty, major, phone, email,
         term, academic_year, preferred_classes, mentor_name, registered_at, decided_at, reject_reason)
       VALUES (?, ?, '', ?, ?, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
       ON CONFLICT (intern_id) DO UPDATE SET
         name = excluded.name, classes = '', pin_hash = excluded.pin_hash, pin_set_at = excluded.pin_set_at, active = 1, status = 'pending',
         university = excluded.university, faculty = excluded.faculty, major = excluded.major, phone = excluded.phone, email = excluded.email,
         term = excluded.term, academic_year = excluded.academic_year, preferred_classes = excluded.preferred_classes,
         mentor_name = excluded.mentor_name, registered_at = excluded.registered_at, decided_at = NULL, reject_reason = NULL`
    ).bind(id, name, pinHash, now, text.university, text.faculty, text.major, phone, email, term, year, preferred, mentor, now),
    env.DB.prepare("INSERT INTO audit_log (actor, action, target, created_at) VALUES ('intern_reg', 'intern_register', ?, ?)").bind(id, now)
  ]);
  return { ok: true, internId: id, message: 'ลงทะเบียนแล้ว รอครูประจำวิชาอนุมัติ' };
}

function internStatusError(status, reason) {
  if (status === 'pending') return new HttpError(403, 'pending', 'ลงทะเบียนแล้ว รอครูประจำวิชาอนุมัติ');
  return new HttpError(403, 'rejected', 'ครูไม่อนุมัติการลงทะเบียน' + (reason ? ': ' + reason : '') + ' (ลงทะเบียนใหม่ได้)');
}

export async function internLogin(request, env, b, setPin) {
  const id = internIdOf(b.internId);
  const pin = String(b.pin ?? '');
  if (!/^\d{6}$/.test(pin)) throw bad('PIN ต้องเป็นตัวเลข 6 หลัก', 'bad_pin');
  const actor = 'intern:' + id + '@' + clientIp(request);
  if (await isLocked(env, actor)) throw new HttpError(429, 'locked', 'ใส่ PIN ผิดหลายครั้ง ล็อก 15 นาที');
  const rec = await env.DB.prepare('SELECT * FROM interns WHERE intern_id = ?').bind(id).first();
  if (!rec || !rec.active) throw new HttpError(404, 'not_found', 'ไม่พบบัญชี นศ. กรุณากด "ลงทะเบียน" ก่อน');
  let pinSetAt = rec.pin_set_at;
  if (setPin) {
    if (rec.status !== 'approved') throw internStatusError(rec.status, rec.reject_reason);
    if (rec.pin_hash) throw new HttpError(409, 'pin_exists', 'ตั้ง PIN แล้ว หากลืมให้ครูพี่เลี้ยงรีเซ็ต');
    pinSetAt = nowIso();
    const r = await env.DB.prepare('UPDATE interns SET pin_hash = ?, pin_set_at = ? WHERE intern_id = ? AND pin_hash IS NULL')
      .bind(await hashSecret(env, pin), pinSetAt, id)
      .run();
    if (r.meta.changes !== 1) throw new HttpError(409, 'retry', 'กรุณาลองใหม่อีกครั้ง');
    await audit(env, actor, 'pin_set');
  } else {
    if (!rec.pin_hash) {
      if (rec.status !== 'approved') throw internStatusError(rec.status, rec.reject_reason);
      throw new HttpError(401, 'needs_pin', 'เข้าใช้ครั้งแรก กรุณาตั้ง PIN');
    }
    if (!(await verifySecret(env, rec.pin_hash, pin))) {
      await audit(env, actor, 'login_fail');
      throw new HttpError(401, 'wrong_pin', 'PIN ไม่ถูกต้อง');
    }
    if (rec.status !== 'approved') throw internStatusError(rec.status, rec.reject_reason);
    if (needsRehash(rec.pin_hash)) {
      const upgraded = await hashSecret(env, pin);
      await env.DB.prepare('UPDATE interns SET pin_hash = ? WHERE intern_id = ?')
        .bind(upgraded, id)
        .run();
    }
  }
  await audit(env, actor, 'login_ok');
  const token = await signToken(env, { sub: 'intern:' + id, role: 'intern', iid: id, pv: pinSetAt, exp: nowSec() + STUDENT_TTL_SEC });
  return { token, role: 'intern', name: rec.name, expires_in: STUDENT_TTL_SEC, profile: internProfile({ ...rec, pin_set_at: pinSetAt }) };
}

export async function internAuth(env, auth) {
  const rec = await env.DB.prepare('SELECT * FROM interns WHERE intern_id = ?').bind(auth.iid || '').first();
  if (!rec || !rec.active || !rec.pin_hash || rec.status !== 'approved' || rec.pin_set_at !== auth.pv) {
    throw new HttpError(401, 'unauthorized', 'ต้องเข้าสู่ระบบใหม่');
  }
  return rec;
}

export async function internFetch(env, rec, url) {
  const classes = internClassList(rec.classes);
  const startedAt = nowIso();
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw && Number.isFinite(Date.parse(sinceRaw)) ? new Date(Date.parse(sinceRaw)).toISOString() : '';
  const out = { classes, roster: [], submissions: [], quizzes: [], dueDates: [], approvals: [], logs: [], evaluations: [], nextSince: startedAt };
  const iid = rec.intern_id;
  if (classes.length) {
    const ph = classes.map(() => '?').join(',');
    const [roster, subs, quizzes, due] = await Promise.all([
      env.DB.prepare(
        `SELECT student_id, prefix, first_name, last_name, nickname, class_name, no FROM students
         WHERE class_name IN (${ph}) AND status = 'active' ORDER BY class_name, no`
      ).bind(...classes).all(),
      env.DB.prepare(
        `SELECT * FROM submissions WHERE class_name IN (${ph}) ${since ? 'AND updated_at > ?' : ''} ORDER BY updated_at`
      ).bind(...classes, ...(since ? [since] : [])).all(),
      env.DB.prepare(
        `SELECT student_id, class_name, unit_no, score, total, percentage, time_spent, created_at FROM quiz_attempts
         WHERE practice = 0 AND class_name IN (${ph}) ORDER BY created_at`
      ).bind(...classes).all(),
      env.DB.prepare(`SELECT * FROM due_dates WHERE class_name IN (${ph})`).bind(...classes).all()
    ]);
    out.roster = roster.results.map((s) => ({ ...s, class: s.class_name }));
    out.submissions = subs.results;
    out.quizzes = quizzes.results;
    out.dueDates = due.results.map((d) => ({ className: d.class_name, period: d.period, dueAt: d.due_at, title: d.title || '' }));
  }
  const [ap, lg, ev] = await Promise.all([
    env.DB.prepare('SELECT * FROM intern_approvals WHERE intern_id = ? ORDER BY created_at').bind(iid).all(),
    env.DB.prepare('SELECT * FROM intern_logs WHERE intern_id = ? ORDER BY created_at').bind(iid).all(),
    env.DB.prepare('SELECT * FROM intern_supervisions WHERE intern_id = ? ORDER BY created_at').bind(iid).all()
  ]);
  out.approvals = ap.results.map(approvalOut);
  out.logs = lg.results.map(logOut);
  out.evaluations = ev.results.map((r) => ({
    className: r.class_name || '', period: r.period, ratings: parseJson(r.ratings, {}), total: r.total, comments: r.comments || '',
    mentor: r.mentor || '', createdMs: Date.parse(r.created_at)
  }));
  return json(out);
}

function approvalOut(r) {
  return {
    id: r.id, createdMs: Date.parse(r.created_at), internId: r.intern_id, internName: r.intern_name || '', className: r.class_name,
    period: r.period, studentId: r.student_id, score: r.score, comment: r.comment || '', status: r.status
  };
}

function logOut(r) {
  return {
    internId: r.intern_id, internName: r.intern_name || '', className: r.class_name, period: r.period, result: r.result || '',
    problems: r.problems || '', solutions: r.solutions || '', createdMs: Date.parse(r.created_at)
  };
}

export async function internProposeGrades(env, rec, b) {
  const items = Array.isArray(b.items) ? b.items : null;
  if (!items) throw bad('items ต้องเป็นรายการ');
  if (items.length > 100) throw new HttpError(400, 'too_many', 'ส่งได้ครั้งละไม่เกิน 100 รายการ');
  const allowed = internClassList(rec.classes);
  const accepted = [];
  const rejected = [];
  const stmts = [];
  const now = nowIso();
  for (const it of items) {
    const x = isPlainObject(it) ? it : {};
    const cid = String(x.clientId ?? '');
    if (!/^[A-Za-z0-9_.:-]{8,80}$/.test(cid)) { rejected.push({ clientId: cid, reason: 'bad_client_id' }); continue; }
    if (!allowed.includes(String(x.className ?? ''))) { rejected.push({ clientId: cid, reason: 'class_not_assigned' }); continue; }
    const score = Number(x.score);
    const period = Number(x.period);
    const sid = String(x.studentId ?? '').trim();
    if (!(Number.isInteger(period) && period >= 1 && period <= 40) || !(score >= 0 && score <= 100) || !/^\d{4,10}$/.test(sid)) {
      rejected.push({ clientId: cid, reason: 'invalid' });
      continue;
    }
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO intern_approvals (id, created_at, intern_id, intern_name, class_name, period, student_id, score, comment, status, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).bind(crypto.randomUUID(), now, rec.intern_id, rec.name, x.className, period, sid, score, optText(x.comment, 1000), cid)
    );
    accepted.push(cid);
  }
  if (stmts.length) await runBatch(env, stmts);
  return { accepted, rejected };
}

export async function internPostLog(env, rec, b) {
  const cls = String(b.className ?? '');
  if (!internClassList(rec.classes).includes(cls)) throw new HttpError(403, 'class_not_assigned', 'ไม่ใช่ห้องที่ได้รับมอบหมาย');
  const period = Number(b.period);
  if (!(Number.isInteger(period) && period >= 1 && period <= 40)) throw bad('คาบไม่ถูกต้อง');
  const cid = optText(b.clientId, 80);
  if (!cid) throw bad('ไม่มี clientId');
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO intern_logs (id, created_at, intern_id, intern_name, class_name, period, result, problems, solutions, client_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), nowIso(), rec.intern_id, rec.name, cls, period, optText(b.result, 3000), optText(b.problems, 3000), optText(b.solutions, 3000), cid)
    .run();
  return { ok: true, duplicate: r.meta.changes === 0 };
}

export async function listInterns(env) {
  const { results } = await env.DB.prepare('SELECT * FROM interns ORDER BY registered_at, intern_id').all();
  return {
    interns: results.map((r) => ({
      ...internProfile(r), hasPin: !!r.pin_hash, active: !!r.active, registeredAt: r.registered_at || '', decidedAt: r.decided_at || '',
      rejectReason: r.reject_reason || ''
    }))
  };
}

export async function upsertIntern(env, id, b) {
  const name = optText(b.name, 80);
  const classes = internClassList(b.classes).join(',');
  const rec = await env.DB.prepare('SELECT status FROM interns WHERE intern_id = ?').bind(id).first();
  if (!rec) {
    if (!name) throw bad('กรุณากรอกชื่อ นศ.');
    await env.DB.prepare(
      "INSERT INTO interns (intern_id, name, classes, pin_hash, pin_set_at, active, status, registered_at) VALUES (?, ?, ?, NULL, NULL, 1, 'approved', ?)"
    )
      .bind(id, name, classes, nowIso())
      .run();
    return { ok: true, created: true, internId: id };
  }
  await env.DB.prepare(
    "UPDATE interns SET name = COALESCE(?, name), classes = ?, active = ?, status = CASE WHEN status = 'rejected' THEN status ELSE 'approved' END WHERE intern_id = ?"
  )
    .bind(name, classes, b.active === false ? 0 : 1, id)
    .run();
  return { ok: true, created: false, internId: id };
}

export async function decideIntern(env, id, b) {
  const rec = await env.DB.prepare('SELECT intern_id FROM interns WHERE intern_id = ?').bind(id).first();
  if (!rec) throw new HttpError(404, 'not_found', 'ไม่พบ นศ.');
  const now = nowIso();
  if (b.approve) {
    const classes = internClassList(b.classes);
    if (!classes.length) throw new HttpError(400, 'no_classes', 'กรุณาเลือกห้องที่มอบหมายอย่างน้อย 1 ห้อง');
    await env.DB.prepare("UPDATE interns SET status = 'approved', classes = ?, active = 1, reject_reason = NULL, decided_at = ? WHERE intern_id = ?")
      .bind(classes.join(','), now, id)
      .run();
    return { ok: true, internId: id, state: 'approved' };
  }
  await env.DB.prepare("UPDATE interns SET status = 'rejected', reject_reason = ?, classes = '', pin_set_at = ?, decided_at = ? WHERE intern_id = ?")
    .bind(optText(b.reason, 300), now, now, id)
    .run();
  return { ok: true, internId: id, state: 'rejected' };
}

export async function resetInternPin(env, id) {
  const r = await env.DB.prepare('UPDATE interns SET pin_hash = NULL, pin_set_at = ? WHERE intern_id = ?').bind(nowIso(), id).run();
  if (r.meta.changes !== 1) throw new HttpError(404, 'not_found', 'ไม่พบ นศ.');
  await env.DB.prepare("DELETE FROM audit_log WHERE action = 'login_fail' AND (actor = ? OR actor LIKE ?)")
    .bind('intern:' + id, 'intern:' + id + '@%')
    .run();
  return { ok: true };
}

export async function listInternApprovals(env, url) {
  const status = url.searchParams.get('status');
  const stmt = status
    ? env.DB.prepare('SELECT * FROM intern_approvals WHERE status = ? ORDER BY created_at').bind(status)
    : env.DB.prepare('SELECT * FROM intern_approvals ORDER BY created_at');
  const { results } = await stmt.all();
  return { approvals: results.map(approvalOut) };
}

export async function decideInternApproval(env, id, b) {
  const a = await env.DB.prepare('SELECT * FROM intern_approvals WHERE id = ?').bind(id).first();
  if (!a) throw new HttpError(404, 'not_found', 'ไม่พบรายการ');
  const status = b.approve ? 'approved' : 'rejected';
  const r = await env.DB.prepare("UPDATE intern_approvals SET status = ?, decided_at = ? WHERE id = ? AND status = 'pending'")
    .bind(status, nowIso(), id)
    .run();
  if (r.meta.changes !== 1) throw new HttpError(409, 'already_decided', 'รายการนี้ตัดสินแล้ว');
  return { ok: true, approval: { ...approvalOut(a), status } };
}

export async function listInternLogs(env, url) {
  const iid = url.searchParams.get('intern_id');
  const stmt = iid
    ? env.DB.prepare('SELECT * FROM intern_logs WHERE intern_id = ? ORDER BY created_at').bind(iid)
    : env.DB.prepare('SELECT * FROM intern_logs ORDER BY created_at');
  const { results } = await stmt.all();
  return { logs: results.map(logOut) };
}

export async function postInternSupervision(env, id, b) {
  const rec = await env.DB.prepare('SELECT intern_id FROM interns WHERE intern_id = ?').bind(id).first();
  if (!rec) throw new HttpError(404, 'not_found', 'ไม่พบ นศ.');
  const ratings = isPlainObject(b.ratings) ? b.ratings : {};
  const clean = {};
  let total = 0;
  for (const k of Object.keys(ratings).slice(0, 20)) {
    const n = Math.max(0, Math.min(5, Number(ratings[k]) || 0));
    clean[k.slice(0, 80)] = n;
    total += n;
  }
  const period = Number(b.period);
  await env.DB.prepare(
    'INSERT INTO intern_supervisions (id, created_at, intern_id, class_name, period, ratings, total, comments, mentor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), nowIso(), id, optText(b.className, 20), Number.isInteger(period) ? period : null, JSON.stringify(clean), total, optText(b.comments, 3000), optText(b.mentor, 80))
    .run();
  return { ok: true, total };
}
