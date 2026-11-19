// Unit quizzes & server-shuffled midterm/final exam routes

import {
  HttpError,
  bad,
  nowIso,
  reqStr,
  optText,
  optInt,
  normSid,
  isPlainObject,
  parseJson,
  json
} from '../utils.js';

const MAX_PRACTICE_ATTEMPTS = 100;
const EXAM_KINDS = ['midterm', 'final'];
const EXAM_KEYS = ['ก', 'ข', 'ค', 'ง', 'จ'];
const EXAM_GRACE_MS = 15000;
const EXAM_MAX_POINTS = 10;
const EXAM_DEFAULT_MINUTES = 25;

// ---------- Unit Quizzes ----------

export function validUnit(v) {
  const n = optInt(v);
  if (n === null || n < 1 || n > 40) throw bad('หน่วยการเรียนรู้ไม่ถูกต้อง', 'bad_unit');
  return n;
}

export async function putQuizBank(env, b) {
  if (!Array.isArray(b.units)) throw bad('ต้องส่ง units เป็นรายการ');
  const stmts = [env.DB.prepare('DELETE FROM quiz_bank')];
  const units = new Set();
  let questions = 0;
  for (const u of b.units) {
    if (!isPlainObject(u)) continue;
    const unitNo = validUnit(u.unit_no);
    const title = optText(u.title, 200);
    const qs = Array.isArray(u.questions) ? u.questions : [];
    qs.forEach((q, i) => {
      if (!isPlainObject(q)) return;
      const id = optText(q.id, 40);
      const correct = optText(q.correct, 4);
      if (!id || !correct) return;
      const choices = (Array.isArray(q.choices) ? q.choices : [])
        .slice(0, 10)
        .map((c) => ({ key: String(c?.key ?? '').slice(0, 4), text: String(c?.text ?? '').slice(0, 500) }));
      stmts.push(
        env.DB.prepare(
          `INSERT OR REPLACE INTO quiz_bank (unit_no, q_id, ord, title, question, choices, correct, explanation, bloom)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(unitNo, id, i, title, String(q.question ?? '').slice(0, 1000), JSON.stringify(choices), correct, optText(q.explanation, 1000), optText(q.bloom, 40))
      );
      units.add(unitNo);
      questions++;
    });
  }
  if (!questions) throw bad('ไม่มีข้อสอบที่มีเฉลย');
  await env.DB.batch(stmts);
  return { status: 'success', questions, units: units.size };
}

async function quizRows(env, unitNo) {
  const { results } = await env.DB.prepare('SELECT * FROM quiz_bank WHERE unit_no = ? ORDER BY ord').bind(unitNo).all();
  return results;
}

export async function getQuiz(env, unitNo) {
  const rows = await quizRows(env, unitNo);
  if (!rows.length) throw new HttpError(404, 'no_quiz', 'ครูยังไม่ได้อัปโหลดแบบทดสอบหน่วยนี้');
  return json({
    unitNo,
    title: rows[0].title || '',
    questions: rows.map((r) => ({ id: r.q_id, question: r.question, bloom: r.bloom || '', choices: parseJson(r.choices, []) }))
  });
}

export async function submitQuiz(env, auth, unitNo, b) {
  const clientId = reqStr(b.client_id, 'client_id', 100);
  const practice = !!b.practice;
  if (!isPlainObject(b.answers)) throw bad('answers ต้องเป็นออบเจ็กต์');
  const keys = Object.keys(b.answers);
  if (keys.length > 100) throw bad('คำตอบมากเกินไป');
  for (const k of keys) {
    if (k.length > 40 || String(b.answers[k]).length > 4) throw bad('คำตอบไม่ถูกต้อง');
  }
  const sid = auth.sid;
  const prev = await env.DB.prepare('SELECT * FROM quiz_attempts WHERE student_id = ? AND client_id = ?').bind(sid, clientId).first();
  if (prev) {
    return json({ duplicate: true, score: prev.score, total: prev.total, percentage: prev.percentage, practice: !!prev.practice });
  }
  const rows = await quizRows(env, unitNo);
  if (!rows.length) throw new HttpError(404, 'no_quiz', 'ครูยังไม่ได้อัปโหลดแบบทดสอบหน่วยนี้');
  const c = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM quiz_attempts WHERE student_id = ? AND unit_no = ? AND practice = 0) AS used,
       (SELECT COUNT(*) FROM quiz_attempts WHERE student_id = ? AND unit_no = ? AND practice = 1) AS practiced,
       (SELECT COALESCE(SUM(extra), 0) FROM quiz_grants WHERE student_id = ? AND unit_no = ?) AS extra`
  )
    .bind(sid, unitNo, sid, unitNo, sid, unitNo)
    .first();
  if (!practice && Number(c.used) >= 1 + Number(c.extra)) {
    throw new HttpError(409, 'duplicate_quiz', 'ส่งแบบทดสอบหน่วยนี้ไปแล้ว ไม่สามารถส่งซ้ำได้');
  }
  if (practice && Number(c.used) < 1) {
    throw new HttpError(409, 'practice_after_quiz', 'ต้องส่งแบบทดสอบเก็บคะแนนก่อน จึงจะเข้าโหมดฝึกซ้อมได้');
  }
  if (practice && Number(c.practiced) >= MAX_PRACTICE_ATTEMPTS) {
    throw new HttpError(409, 'practice_limit', 'ทำแบบฝึกหน่วยนี้ครบจำนวนครั้งแล้ว');
  }
  let score = 0;
  rows.forEach((r) => {
    if (String(b.answers[r.q_id] ?? '') === r.correct) score++;
  });
  const total = rows.length;
  const percentage = Math.round((score / total) * 100);
  const timeSpent = Math.max(0, Math.min(86400, Math.round(Number(b.time_spent) || 0)));
  await env.DB.prepare(
    `INSERT OR IGNORE INTO quiz_attempts
       (id, student_id, class_name, client_id, unit_no, practice, score, total, percentage, time_spent, answers, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), sid, auth.class_name || null, clientId, unitNo, practice ? 1 : 0, score, total, percentage, timeSpent, JSON.stringify(b.answers), nowIso())
    .run();
  return json({ score, total, percentage, practice, title: rows[0].title || '' });
}

export async function listQuizAttempts(env, url) {
  const cls = url.searchParams.get('class');
  const cols = 'id, student_id, class_name, unit_no, score, total, percentage, time_spent, created_at';
  const stmt = cls
    ? env.DB.prepare(`SELECT ${cols} FROM quiz_attempts WHERE practice = 0 AND class_name = ? ORDER BY created_at`).bind(cls)
    : env.DB.prepare(`SELECT ${cols} FROM quiz_attempts WHERE practice = 0 ORDER BY created_at`);
  const { results } = await stmt.all();
  return json({ attempts: results });
}

export async function grantQuiz(env, b) {
  const sid = normSid(b.student_id);
  const unitNo = validUnit(b.unit_no);
  const extra = optInt(b.extra ?? 1);
  if (extra === null || extra < 1 || extra > 5) throw bad('จำนวนสิทธิ์เพิ่มต้องอยู่ระหว่าง 1-5');
  await env.DB.prepare(
    `INSERT INTO quiz_grants (student_id, unit_no, extra, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (student_id, unit_no) DO UPDATE SET extra = quiz_grants.extra + excluded.extra, updated_at = excluded.updated_at`
  )
    .bind(sid, unitNo, extra, nowIso())
    .run();
  return { ok: true };
}

// ---------- Midterm / Final Exams ----------

function examKind(v) {
  if (!EXAM_KINDS.includes(v)) throw bad('ชนิดข้อสอบไม่ถูกต้อง (midterm/final)', 'bad_kind');
  return v;
}

function toMs(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== '') return n;
  const d = Date.parse(v);
  return Number.isFinite(d) ? d : 0;
}

function shuffle(arr) {
  const a = arr.slice();
  const rnd = new Uint32Array(Math.max(1, a.length));
  crypto.getRandomValues(rnd);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function examLevel(correct, items) {
  const p = items ? correct / items : 0;
  return p >= 0.8 ? 4 : p >= 0.7 ? 3 : p >= 0.5 ? 2 : 1;
}

function examState(s, now) {
  if (s.closed_ms && s.closed_ms <= now) return 'closed';
  if (now < s.open_ms) return 'scheduled';
  if (now < s.close_ms) return 'open';
  return 'ended';
}

function examClose(s) {
  return s.closed_ms ? Math.min(s.close_ms, s.closed_ms) : s.close_ms;
}

async function examBank(env, kind) {
  const { results } = await env.DB.prepare('SELECT q_id, question, choices, correct FROM exam_bank WHERE kind = ? ORDER BY ord').bind(kind).all();
  return results.map((r) => ({ ...r, choices: parseJson(r.choices, []) }));
}

export async function putExamBank(env, b) {
  const kind = examKind(b.kind);
  const items = b.items;
  if (!Array.isArray(items) || !items.length) throw bad('ไม่พบข้อสอบ');
  if (items.length > 60) throw bad('ข้อสอบมากเกิน 60 ข้อ', 'too_many');
  const now = Date.now();
  const open = await env.DB.prepare(
    'SELECT 1 AS x FROM exam_sessions WHERE kind = ? AND (closed_ms IS NULL OR closed_ms = 0) AND close_ms > ? LIMIT 1'
  )
    .bind(kind, now)
    .first();
  if (open) throw new HttpError(409, 'session_open', 'มีห้องสอบที่ยังไม่ปิด กรุณาปิดห้องสอบก่อนเปลี่ยนคลังข้อสอบ');
  const seen = new Set();
  const stmts = [env.DB.prepare('DELETE FROM exam_bank WHERE kind = ?').bind(kind)];
  items.forEach((raw, i) => {
    const q = isPlainObject(raw) ? raw : {};
    const id = optText(q.id, 40);
    const text = optText(q.question, 1000);
    const ch = Array.isArray(q.choices) ? q.choices : [];
    if (!id || !text || seen.has(id)) throw bad(`ข้อที่ ${i + 1} ไม่ครบหรือรหัสซ้ำ`);
    if (ch.length < 3 || ch.length > EXAM_KEYS.length) throw bad(`ข้อที่ ${i + 1} ต้องมี 3-5 ตัวเลือก`);
    const texts = ch.map((c) => String(c && c.text !== undefined ? c.text : c ?? '').trim().slice(0, 500));
    const ci = Number(q.correctIndex);
    if (!(Number.isInteger(ci) && ci >= 0 && ci < texts.length) || texts.some((t) => !t)) {
      throw bad(`ข้อที่ ${i + 1} เฉลย/ตัวเลือกไม่ถูกต้อง`);
    }
    seen.add(id);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO exam_bank (kind, q_id, ord, question, choices, correct, explanation, src_period, src_objective, difficulty, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        kind, id, i, text,
        JSON.stringify(texts.map((t, k) => ({ key: EXAM_KEYS[k], text: t }))),
        EXAM_KEYS[ci], optText(q.explanation, 1000), optText(q.srcPeriod, 20), optText(q.srcObjective, 300), optText(q.difficulty, 20), optText(q.status, 60)
      )
    );
  });
  await env.DB.batch(stmts);
  return { kind, items: items.length };
}

export async function openExam(env, b) {
  const kind = examKind(b.kind);
  const cls = optText(b.className, 60);
  if (!cls) throw bad('ห้อง/ชนิดข้อสอบไม่ถูกต้อง');
  const now = Date.now();
  const openMs = b.openAt ? toMs(b.openAt) : now;
  const closeMs = toMs(b.closeAt);
  if (!openMs || !closeMs || closeMs <= openMs) throw bad('ช่วงเวลาเปิด-ปิดสอบไม่ถูกต้อง');
  if (closeMs <= now) throw bad('เวลาปิดสอบผ่านไปแล้ว');
  const minutes = Math.max(5, Math.min(180, Math.round(Number(b.durationMin) || EXAM_DEFAULT_MINUTES)));
  const attempts = Math.max(1, Math.min(3, Math.round(Number(b.maxAttempts) || 1)));
  const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM exam_bank WHERE kind = ?').bind(kind).first();
  const items = Number(c.n);
  if (!items) throw new HttpError(409, 'no_bank', 'ยังไม่ได้อัปโหลดคลังข้อสอบชนิดนี้');
  const id = 'EX' + now.toString(36) + crypto.randomUUID().slice(0, 4);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE exam_sessions SET closed_ms = ? WHERE kind = ? AND class_name = ? AND (closed_ms IS NULL OR closed_ms = 0) AND close_ms > ?'
    ).bind(now, kind, cls, now),
    env.DB.prepare(
      `INSERT INTO exam_sessions (session_id, kind, class_name, open_ms, close_ms, duration_min, max_attempts, closed_ms, created_ms, max_points, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).bind(id, kind, cls, openMs, closeMs, minutes, attempts, now, EXAM_MAX_POINTS, items)
  ]);
  return { sessionId: id, kind, className: cls, openMs, closeMs, durationMin: minutes, maxAttempts: attempts, items };
}

export async function closeExamSession(env, id) {
  const s = await env.DB.prepare('SELECT closed_ms FROM exam_sessions WHERE session_id = ?').bind(id).first();
  if (!s) throw new HttpError(404, 'not_found', 'ไม่พบห้องสอบ');
  let closedMs = s.closed_ms;
  if (!closedMs) {
    closedMs = Date.now();
    await env.DB.prepare('UPDATE exam_sessions SET closed_ms = ? WHERE session_id = ?').bind(closedMs, id).run();
  }
  return { sessionId: id, closedMs };
}

export async function listExamSessions(env, url) {
  const now = Date.now();
  const cls = url.searchParams.get('class');
  const sql = `SELECT s.*,
      (SELECT COUNT(*) FROM exam_attempts a WHERE a.session_id = s.session_id AND a.status = 'submitted') AS submitted,
      (SELECT COUNT(*) FROM exam_attempts a WHERE a.session_id = s.session_id AND a.status = 'in_progress') AS in_progress
    FROM exam_sessions s ${cls ? 'WHERE s.class_name = ?' : ''} ORDER BY s.created_ms`;
  const stmt = cls ? env.DB.prepare(sql).bind(cls) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({
    serverNow: now,
    sessions: results.map((s) => ({
      sessionId: s.session_id, kind: s.kind, className: s.class_name, openMs: s.open_ms, closeMs: s.close_ms,
      closedMs: s.closed_ms || 0, durationMin: s.duration_min, maxAttempts: s.max_attempts, items: s.items,
      state: examState(s, now), submitted: Number(s.submitted), inProgress: Number(s.in_progress)
    }))
  });
}

export async function examResults(env, url) {
  const where = [];
  const params = [];
  for (const [param, col] of [['kind', 'kind'], ['class', 'class_name'], ['sessionId', 'session_id']]) {
    const v = url.searchParams.get(param);
    if (v) {
      where.push(`${col} = ?`);
      params.push(v);
    }
  }
  const sql = `SELECT * FROM exam_attempts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY started_ms`;
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({
    attempts: results.map((a) => ({
      attemptId: a.attempt_id, sessionId: a.session_id, kind: a.kind, className: a.class_name, studentId: a.student_id,
      name: a.student_name || '', no: a.no, attemptNo: a.attempt_no, startedMs: a.started_ms, submittedMs: a.submitted_ms || 0,
      status: a.status, correct: a.correct, items: a.items, points: a.points, level: a.level, late: !!a.late,
      tabSwitches: Number(a.tab_switches) || 0
    }))
  });
}

export async function grantExam(env, b) {
  const sid = normSid(b.studentId ?? b.student_id);
  const extra = Math.max(1, Math.min(2, Math.round(Number(b.extra) || 1)));
  const id = String(b.sessionId || '').slice(0, 60);
  const st = await env.DB.prepare('SELECT class_name FROM students WHERE student_id = ?').bind(sid).first();
  if (!st) throw new HttpError(404, 'not_found', 'ไม่พบนักเรียน');
  const qm = /^(?:quiz_u|u)?(\d+)$/.exec(id) || (!id && b.unitNo ? [null, String(b.unitNo)] : null);
  if (qm) {
    await grantQuiz(env, { student_id: sid, unit_no: Number(qm[1]), extra });
    return { sessionId: 'quiz_u' + Number(qm[1]), studentId: sid, extra };
  }
  const sess = await env.DB.prepare('SELECT class_name FROM exam_sessions WHERE session_id = ?').bind(id).first();
  if (!sess) throw new HttpError(404, 'not_found', 'ไม่พบห้องสอบ');
  if (sess.class_name !== st.class_name) throw new HttpError(409, 'not_in_room', 'นักเรียนไม่อยู่ในห้องที่สอบ');
  await env.DB.prepare('INSERT INTO exam_grants (session_id, student_id, extra, granted_ms) VALUES (?, ?, ?, ?)')
    .bind(id, sid, extra, Date.now())
    .run();
  return { sessionId: id, studentId: sid, extra };
}

async function examView(env, auth, now) {
  const sess = await env.DB.prepare(
    `SELECT * FROM exam_sessions
     WHERE class_name = ? AND open_ms <= ? AND close_ms > ? AND (closed_ms IS NULL OR closed_ms = 0 OR closed_ms > ?)
     ORDER BY created_ms DESC LIMIT 1`
  )
    .bind(auth.class_name || '', now, now, now)
    .first();
  if (!sess) return { sess: null };
  await env.DB.prepare(
    "UPDATE exam_attempts SET status = 'expired' WHERE session_id = ? AND student_id = ? AND status = 'in_progress' AND deadline_ms + ? < ?"
  )
    .bind(sess.session_id, auth.sid, EXAM_GRACE_MS, now)
    .run();
  const { results: mine } = await env.DB.prepare('SELECT * FROM exam_attempts WHERE session_id = ? AND student_id = ? ORDER BY attempt_no')
    .bind(sess.session_id, auth.sid)
    .all();
  const g = await env.DB.prepare('SELECT COALESCE(SUM(extra), 0) AS extra FROM exam_grants WHERE session_id = ? AND student_id = ?')
    .bind(sess.session_id, auth.sid)
    .first();
  let used = 0;
  let running = null;
  let last = null;
  for (const a of mine) {
    if (a.status === 'in_progress') running = a;
    else used++;
    if (a.status === 'submitted') last = a;
  }
  const allowed = Number(sess.max_attempts) + Number(g.extra);
  return { sess, used, running, last, left: Math.max(0, allowed - used) };
}

export async function examStatus(env, auth) {
  const now = Date.now();
  const v = await examView(env, auth, now);
  if (!v.sess) return json({ open: false });
  const live = !!v.running && v.running.deadline_ms > now;
  const r = {
    open: true, kind: v.sess.kind, closeMs: examClose(v.sess), durationMin: v.sess.duration_min, items: v.sess.items,
    attemptsLeft: v.left, canStart: v.left > 0 || live, inProgress: live, serverNow: now
  };
  if (v.last) r.last = { points: v.last.points, maxPoints: v.sess.max_points, correct: v.last.correct, items: v.last.items };
  return json(r);
}

function examQuestions(bank, order) {
  const byId = new Map(bank.map((q) => [q.q_id, q]));
  const out = [];
  for (const o of order) {
    const q = byId.get(o.id);
    if (!q) continue;
    out.push({ id: q.q_id, question: q.question, choices: o.p.map((idx, k) => ({ key: EXAM_KEYS[k], text: String(q.choices[idx]?.text ?? '') })) });
  }
  return out;
}

export async function examStart(env, auth) {
  const now = Date.now();
  const v = await examView(env, auth, now);
  if (!v.sess) throw new HttpError(409, 'not_open', 'ยังไม่เปิดสอบ');
  const sess = v.sess;
  const bank = await examBank(env, sess.kind);
  if (!bank.length) throw new HttpError(409, 'not_open', 'ยังไม่เปิดสอบ');
  let att = v.running && v.running.deadline_ms > now ? v.running : null;
  let order = att ? parseJson(att.order_json, null) : null;
  if (!att) {
    if (v.left <= 0) throw new HttpError(409, 'no_attempts', 'ใช้สิทธิ์สอบครบแล้ว');
    order = shuffle(bank).map((q) => ({ id: q.q_id, p: shuffle(q.choices.map((_, k) => k)) }));
    const deadline = Math.min(examClose(sess), now + sess.duration_min * 60000);
    const st = await env.DB.prepare('SELECT prefix, first_name, last_name, no FROM students WHERE student_id = ?').bind(auth.sid).first();
    const name = st ? `${st.prefix || ''}${st.first_name || ''} ${st.last_name || ''}`.trim() : '';
    const attemptId = 'AT' + now.toString(36) + crypto.randomUUID().slice(0, 6);
    await env.DB.prepare(
      `INSERT INTO exam_attempts (attempt_id, session_id, kind, class_name, student_id, student_name, no, attempt_no,
         started_ms, deadline_ms, submitted_ms, status, order_json, correct, items, points, level, late)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'in_progress', ?, NULL, ?, NULL, NULL, 0)`
    )
      .bind(attemptId, sess.session_id, sess.kind, sess.class_name, auth.sid, name, st ? st.no : null, v.used + 1, now, deadline, JSON.stringify(order), order.length)
      .run();
    att = { attempt_id: attemptId, deadline_ms: deadline, draft_answers: null, tab_switches: 0 };
  }
  if (!order) throw new HttpError(500, 'error', 'เริ่มสอบไม่สำเร็จ กรุณาแจ้งครู');
  const draftRaw = att.draft_answers ? parseJson(att.draft_answers, {}) : {};
  const draftAnswers = isPlainObject(draftRaw) ? draftRaw : {};
  return json({
    attemptId: att.attempt_id, kind: sess.kind, deadlineMs: att.deadline_ms, serverNow: now,
    items: order.length, maxPoints: sess.max_points, questions: examQuestions(bank, order),
    draftAnswers, tabSwitches: Number(att.tab_switches) || 0
  });
}

export async function examDraft(env, auth, b) {
  const now = Date.now();
  const id = reqStr(b.attemptId, 'attemptId', 60);
  const att = await env.DB.prepare('SELECT * FROM exam_attempts WHERE attempt_id = ? AND student_id = ?').bind(id, auth.sid).first();
  if (!att) throw new HttpError(404, 'bad_attempt', 'ไม่พบการสอบนี้');
  if (att.status !== 'in_progress') throw new HttpError(409, 'closed', 'การสอบครั้งนี้สิ้นสุดแล้ว');
  const sess = await env.DB.prepare('SELECT * FROM exam_sessions WHERE session_id = ?').bind(att.session_id).first();
  let limit = att.deadline_ms;
  if (sess) limit = Math.min(limit, examClose(sess));
  if (now > limit + EXAM_GRACE_MS) throw new HttpError(409, 'late', 'หมดเวลาสอบแล้ว');
  const answers = isPlainObject(b.answers) ? b.answers : {};
  const keys = Object.keys(answers);
  if (keys.length > 100) throw bad('คำตอบมากเกินไป');
  const clean = {};
  for (const k of keys) {
    if (k.length > 40 || String(answers[k] ?? '').length > 4) throw bad('คำตอบไม่ถูกต้อง');
    clean[k] = String(answers[k] ?? '');
  }
  const tabSwitches = Math.max(0, Math.min(999, Math.round(Number(b.tabSwitches) || 0)));
  await env.DB.prepare(
    "UPDATE exam_attempts SET draft_answers = ?, tab_switches = MAX(COALESCE(tab_switches, 0), ?) WHERE attempt_id = ? AND status = 'in_progress'"
  )
    .bind(JSON.stringify(clean), tabSwitches, id)
    .run();
  return json({ ok: true });
}

export async function examSubmit(env, auth, b) {
  const now = Date.now();
  const id = reqStr(b.attemptId, 'attemptId', 60);
  const att = await env.DB.prepare('SELECT * FROM exam_attempts WHERE attempt_id = ? AND student_id = ?').bind(id, auth.sid).first();
  if (!att) throw new HttpError(404, 'bad_attempt', 'ไม่พบการสอบนี้');
  const sess = await env.DB.prepare('SELECT * FROM exam_sessions WHERE session_id = ?').bind(att.session_id).first();
  const maxPts = sess ? sess.max_points : EXAM_MAX_POINTS;
  if (att.status === 'submitted') {
    return json({ submitted: true, correct: att.correct, items: att.items, points: att.points, maxPoints: maxPts, level: att.level, duplicate: true });
  }
  if (att.status !== 'in_progress') throw new HttpError(409, 'closed', 'การสอบครั้งนี้สิ้นสุดแล้ว');
  let limit = att.deadline_ms;
  if (sess) limit = Math.min(limit, examClose(sess));
  if (now > limit + EXAM_GRACE_MS) {
    await env.DB.prepare("UPDATE exam_attempts SET status = 'late_rejected', submitted_ms = ?, late = 1 WHERE attempt_id = ?").bind(now, id).run();
    throw new HttpError(409, 'late', 'หมดเวลาสอบแล้ว ระบบไม่รับคำตอบ');
  }
  const answers = isPlainObject(b.answers) ? b.answers : {};
  if (Object.keys(answers).length > 100) throw bad('คำตอบมากเกินไป');
  const tabSwitches = Math.max(0, Math.min(999, Math.round(Number(b.tabSwitches) || 0)));
  const order = parseJson(att.order_json, []);
  const byId = new Map((await examBank(env, att.kind)).map((q) => [q.q_id, q]));
  let correct = 0;
  for (const o of order) {
    const q = byId.get(o.id);
    if (!q) continue;
    const picked = EXAM_KEYS.indexOf(String(answers[o.id] ?? ''));
    if (picked < 0 || picked >= o.p.length) continue;
    if (String(q.choices[o.p[picked]]?.key) === q.correct) correct++;
  }
  const items = order.length;
  const points = items ? Math.round((correct / items) * maxPts * 100) / 100 : 0;
  const level = examLevel(correct, items);
  await env.DB.prepare(
    `UPDATE exam_attempts SET status = 'submitted', submitted_ms = ?, correct = ?, items = ?, points = ?, level = ?, late = ?, tab_switches = MAX(COALESCE(tab_switches, 0), ?), draft_answers = NULL
     WHERE attempt_id = ? AND status = 'in_progress'`
  )
    .bind(now, correct, items, points, level, now > limit ? 1 : 0, tabSwitches, id)
    .run();
  return json({ submitted: true, correct, items, points, maxPoints: maxPts, level });
}
