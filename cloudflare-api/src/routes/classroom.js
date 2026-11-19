// Classroom routes: sessions, submissions, CAR research, due dates, notices, rubrics, custom curriculum lessons, sync

import {
  MAX_SESSION_BYTES,
  MAX_SYNC_OPS,
  MAX_SYNC_OPS_PER_CALL,
  MAX_BATCH_ITEMS,
  HttpError,
  bad,
  nowIso,
  reqStr,
  optText,
  optInt,
  validPeriod,
  normSid,
  isPlainObject,
  parseJson,
  validateVideoUrl,
  readJson,
  json,
  existingValues,
  runBatch
} from '../utils.js';
import { requireAuth, requireRole } from './auth.js';

const NOTICE_KINDS = ['reminder', 'feedback'];

// ---------- Sessions (วก.5) ----------

function rowToSession(r) {
  return { ...r, data: parseJson(r.data, {}) };
}

export async function putSession(env, auth, p) {
  const key = reqStr(p.session_key, 'session_key', 200);
  const className = reqStr(p.class_name, 'class_name', 60);
  const period = optInt(p.period);
  if (!isPlainObject(p.data)) throw bad('data ต้องเป็นออบเจ็กต์');
  const dataStr = JSON.stringify(p.data);
  if (dataStr.length > MAX_SESSION_BYTES) throw new HttpError(413, 'too_large', 'ข้อมูลคาบเรียนใหญ่เกินไป');
  const base = Number.isInteger(p.base_version) ? p.base_version : null;
  if (base === null || base < 0) throw bad('ต้องระบุ base_version');
  const now = nowIso();

  if (base === 0) {
    const r = await env.DB.prepare(
      'INSERT OR IGNORE INTO sessions (session_key, class_name, period, data, version, updated_at, updated_by) VALUES (?, ?, ?, ?, 1, ?, ?)'
    )
      .bind(key, className, period, dataStr, now, auth.sub)
      .run();
    if (r.meta.changes === 1) return { ok: true, version: 1 };
  } else {
    const r = await env.DB.prepare(
      'UPDATE sessions SET class_name = ?, period = ?, data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE session_key = ? AND version = ?'
    )
      .bind(className, period, dataStr, now, auth.sub, key, base)
      .run();
    if (r.meta.changes === 1) return { ok: true, version: base + 1 };
  }
  const cur = await env.DB.prepare('SELECT version FROM sessions WHERE session_key = ?').bind(key).first();
  return { conflict: true, current_version: cur ? cur.version : 0 };
}

export async function listSessions(env, url) {
  const cls = url.searchParams.get('class');
  const stmt = cls
    ? env.DB.prepare('SELECT * FROM sessions WHERE class_name = ? ORDER BY session_key').bind(cls)
    : env.DB.prepare('SELECT * FROM sessions ORDER BY session_key');
  const { results } = await stmt.all();
  return json({ sessions: results.map(rowToSession) });
}

// ---------- Submissions ----------

export async function putSubmission(env, auth, p) {
  const sid = auth.role === 'student' ? auth.sid : normSid(p.student_id);
  const st = await env.DB.prepare('SELECT student_id, class_name FROM students WHERE student_id = ? AND status = ?')
    .bind(sid, 'active')
    .first();
  if (!st) throw new HttpError(404, 'not_found', 'ไม่พบนักเรียน');
  const assignment = reqStr(p.assignment_key, 'assignment_key', 120);
  const clip = p.clip_no === undefined || p.clip_no === null ? 1 : p.clip_no;
  if (!Number.isInteger(clip) || clip < 1 || clip > 20) throw bad('clip_no ต้องเป็นตัวเลข 1-20');
  const group = optInt(p.group_no);
  const period = optInt(p.period);
  const url = validateVideoUrl(p.video_url);
  const title = optText(p.title, 200);
  const note = optText(p.note, 5000);
  const subType = optText(p.submission_type, 60);
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO submissions (id, student_id, class_name, period, assignment_key, group_no, clip_no, video_url, title, note, submission_type, link_status, submitted_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unchecked', ?, ?)
     ON CONFLICT (student_id, assignment_key, clip_no) DO UPDATE SET
       video_url = excluded.video_url,
       title = excluded.title,
       note = excluded.note,
       submission_type = excluded.submission_type,
       link_status = 'unchecked',
       submitted_at = excluded.submitted_at,
       updated_at = excluded.updated_at`
  )
    .bind(crypto.randomUUID(), st.student_id, st.class_name, period, assignment, group, clip, url, title, note, subType, now, now)
    .run();
  const row = await env.DB.prepare(
    'SELECT * FROM submissions WHERE student_id = ? AND assignment_key = ? AND clip_no = ?'
  )
    .bind(st.student_id, assignment, clip)
    .first();
  return { ok: true, submission: row };
}

export async function listSubmissions(env, url) {
  const cls = url.searchParams.get('class');
  const assignment = url.searchParams.get('assignment');
  let sql = 'SELECT * FROM submissions WHERE 1=1';
  const params = [];
  if (cls) {
    sql += ' AND class_name = ?';
    params.push(cls);
  }
  if (assignment) {
    sql += ' AND assignment_key = ?';
    params.push(assignment);
  }
  sql += ' ORDER BY class_name, student_id, assignment_key, clip_no';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ submissions: results });
}

export async function patchSubmission(env, id, p) {
  const fields = [];
  const vals = [];
  if ('score' in p) {
    if (p.score !== null && (typeof p.score !== 'number' || !Number.isFinite(p.score) || p.score < 0 || p.score > 100)) {
      throw bad('คะแนนต้องอยู่ระหว่าง 0-100');
    }
    fields.push('score = ?');
    vals.push(p.score);
  }
  if ('feedback' in p) {
    fields.push('feedback = ?');
    vals.push(String(p.feedback ?? '').slice(0, 2000));
  }
  if ('link_status' in p) {
    if (!['unchecked', 'ok', 'invalid'].includes(p.link_status)) throw bad('link_status ไม่ถูกต้อง');
    fields.push('link_status = ?');
    vals.push(p.link_status);
  }
  if (!fields.length) throw bad('ไม่มีข้อมูลที่จะแก้ไข');
  fields.push('updated_at = ?');
  vals.push(nowIso());
  vals.push(id);
  const r = await env.DB.prepare(`UPDATE submissions SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  if (r.meta.changes !== 1) throw new HttpError(404, 'not_found', 'ไม่พบรายการส่งงาน');
  return env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
}

export async function checkLink(env, id) {
  const row = await env.DB.prepare('SELECT video_url FROM submissions WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'not_found', 'ไม่พบรายการส่งงาน');
  let startUrl;
  try {
    startUrl = validateVideoUrl(row.video_url);
  } catch {
    await env.DB.prepare("UPDATE submissions SET link_status = 'invalid', updated_at = ? WHERE id = ?")
      .bind(nowIso(), id)
      .run();
    return { link_status: 'invalid', http_status: 0 };
  }
  let httpStatus = 0;
  let ok = false;
  for (const method of ['HEAD', 'GET']) {
    let cur = startUrl;
    let blocked = false;
    for (let hop = 0; hop <= 3; hop++) {
      try {
        const res = await fetch(cur, {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(6000),
          headers:
            method === 'GET'
              ? { Range: 'bytes=0-0', 'User-Agent': 'MusicSmart-LinkCheck/1.0' }
              : { 'User-Agent': 'MusicSmart-LinkCheck/1.0' }
        });
        httpStatus = res.status;
        try {
          await res.body?.cancel();
        } catch {
          // Ignore body cancel errors
        }
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc || hop === 3) {
            httpStatus = 0;
            blocked = true;
            break;
          }
          try {
            cur = validateVideoUrl(new URL(loc, cur).toString());
          } catch {
            httpStatus = 0;
            blocked = true;
            break;
          }
          continue;
        }
        if (res.status >= 200 && res.status < 400) {
          ok = true;
        }
        break;
      } catch {
        httpStatus = 0;
        break;
      }
    }
    if (ok || blocked) break;
  }
  const linkStatus = ok ? 'ok' : 'invalid';
  await env.DB.prepare('UPDATE submissions SET link_status = ?, updated_at = ? WHERE id = ?')
    .bind(linkStatus, nowIso(), id)
    .run();
  return { link_status: linkStatus, http_status: httpStatus };
}

export async function mySubmissions(env, auth) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM submissions WHERE student_id = ? ORDER BY assignment_key, clip_no'
  )
    .bind(auth.sid)
    .all();
  return json({ submissions: results });
}

// ---------- CAR Research Scores ----------

export function researchStmt(env, p) {
  const className = reqStr(p.class_name, 'class_name', 60);
  const sid = normSid(p.student_id);
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw bad('คะแนนต้องอยู่ระหว่าง 0-100');
    return n;
  };
  return env.DB.prepare(
    `INSERT INTO research_scores (class_name, student_id, pre, post, formative, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (class_name, student_id) DO UPDATE SET
       pre = excluded.pre, post = excluded.post, formative = excluded.formative, updated_at = excluded.updated_at`
  ).bind(className, sid, num(p.pre), num(p.post), num(p.formative), nowIso());
}

export async function putResearch(env, p) {
  await researchStmt(env, p).run();
  return { ok: true };
}

export async function listResearch(env, url) {
  const cls = url.searchParams.get('class');
  const stmt = cls
    ? env.DB.prepare('SELECT * FROM research_scores WHERE class_name = ?').bind(cls)
    : env.DB.prepare('SELECT * FROM research_scores');
  const { results } = await stmt.all();
  return json({ research: results });
}

// ---------- Rubrics & Custom Curriculum Lessons (structured teacher state) ----------

export function rubricStmt(env, p) {
  const sid = normSid(p.student_id ?? p.studentId);
  const period = validPeriod(p.period);
  const cls = optText(p.class_name ?? p.className, 40) || '';
  const dataObj = isPlainObject(p.data) ? p.data : (isPlainObject(p.rubricData) ? p.rubricData : p);
  const dataStr = JSON.stringify(dataObj);
  if (dataStr.length > 20 * 1024) throw bad('ข้อมูลรูบริกใหญ่เกินไป');
  const rawTime = dataObj.updatedAt || p.updatedAt;
  const parsedMs = rawTime ? Date.parse(rawTime) : NaN;
  const updatedAt = Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : nowIso();
  return env.DB.prepare(
    `INSERT INTO rubrics (student_id, period, class_name, data, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (student_id, period) DO UPDATE SET
       class_name = CASE WHEN excluded.class_name <> '' THEN excluded.class_name ELSE rubrics.class_name END,
       data = excluded.data,
       updated_at = excluded.updated_at`
  ).bind(sid, period, cls, dataStr, updatedAt);
}

export async function listRubrics(env, url) {
  const cls = url.searchParams.get('class');
  const periodParam = url.searchParams.get('period');
  let sql = 'SELECT student_id, period, class_name, data, updated_at FROM rubrics WHERE 1=1';
  const params = [];
  if (cls) {
    sql += ' AND class_name = ?';
    params.push(cls);
  }
  if (periodParam !== null && periodParam !== '') {
    sql += ' AND period = ?';
    params.push(validPeriod(periodParam));
  }
  sql += ' ORDER BY period, student_id';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({
    rubrics: results.map((r) => ({
      student_id: r.student_id,
      period: r.period,
      class_name: r.class_name,
      data: parseJson(r.data, {}),
      updated_at: r.updated_at
    }))
  });
}

export function curriculumLessonStmt(env, p) {
  const grade = reqStr(String(p.grade || ''), 'ระดับชั้น', 10);
  if (!/^[A-Za-z0-9_-]{1,10}$/.test(grade)) throw bad('ระดับชั้นไม่ถูกต้อง');
  const period = validPeriod(p.period);
  const dataObj = isPlainObject(p.data) ? p.data : (isPlainObject(p.lessonData) ? p.lessonData : p);
  const dataStr = JSON.stringify(dataObj);
  if (dataStr.length > 50 * 1024) throw bad('ข้อมูลแผนการสอนใหญ่เกินไป');
  const rawTime = dataObj.updatedAt || p.timestamp;
  const parsedMs = rawTime ? Date.parse(rawTime) : NaN;
  const updatedAt = Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : nowIso();
  return env.DB.prepare(
    `INSERT INTO curriculum_lessons (grade, period, data, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (grade, period) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at`
  ).bind(grade, period, dataStr, updatedAt);
}

export async function listCurriculumLessons(env, url) {
  const grade = url.searchParams.get('grade');
  const stmt = grade
    ? env.DB.prepare('SELECT grade, period, data, updated_at FROM curriculum_lessons WHERE grade = ? ORDER BY period').bind(grade)
    : env.DB.prepare('SELECT grade, period, data, updated_at FROM curriculum_lessons ORDER BY grade, period');
  const { results } = await stmt.all();
  return json({
    lessons: results.map((r) => ({
      grade: r.grade,
      period: r.period,
      data: parseJson(r.data, {}),
      updated_at: r.updated_at
    }))
  });
}

// ---------- Offline sync queue (/api/sync) ----------

async function applyOp(env, auth, op) {
  const payload = isPlainObject(op.payload) ? op.payload : {};
  switch (op.kind) {
    case 'session.put':
      requireRole(auth, 'teacher');
      return putSession(env, auth, payload);
    case 'submission.put':
      return putSubmission(env, auth, payload);
    case 'research.put':
      requireRole(auth, 'teacher');
      return putResearch(env, payload);
    default:
      throw bad('ไม่รู้จักประเภทข้อมูล: ' + String(op.kind), 'unknown_kind');
  }
}

export async function syncOps(request, env) {
  const auth = await requireAuth(request, env, ['teacher', 'student']);
  const b = await readJson(request);
  if (!Array.isArray(b.ops)) throw bad('ต้องส่ง ops เป็นรายการ');
  if (b.ops.length > MAX_SYNC_OPS_PER_CALL) throw bad(`ส่งครั้งละไม่เกิน ${MAX_SYNC_OPS_PER_CALL} รายการ`);

  const results = [];
  for (const op of b.ops) {
    const opId = typeof op?.op_id === 'string' ? op.op_id.slice(0, 100) : '';
    if (!opId) {
      results.push({ op_id: null, status: 'error', message: 'ไม่มี op_id' });
      continue;
    }
    const seen = await env.DB.prepare('SELECT 1 AS x FROM sync_ops WHERE op_id = ?').bind(opId).first();
    if (seen) {
      results.push({ op_id: opId, status: 'duplicate' });
      continue;
    }
    try {
      const r = await applyOp(env, auth, op);
      if (r && r.conflict) {
        results.push({ op_id: opId, status: 'conflict', current_version: r.current_version });
        continue;
      }
      await env.DB.prepare('INSERT OR IGNORE INTO sync_ops (op_id, kind, created_at) VALUES (?, ?, ?)')
        .bind(opId, String(op.kind), nowIso())
        .run();
      results.push({ op_id: opId, status: 'applied' });
    } catch (e) {
      if (e instanceof HttpError) {
        results.push({ op_id: opId, status: 'error', code: e.code, message: e.message });
      } else {
        throw e;
      }
    }
  }
  return json({ results });
}

// ---------- Due dates & Notices ----------

export function dueDateStmt(env, p) {
  const className = reqStr(p.class_name, 'class_name', 60);
  const period = validPeriod(p.period);
  const dueRaw = p.due_at === undefined || p.due_at === null ? '' : String(p.due_at).trim();
  if (!dueRaw) {
    return env.DB.prepare('DELETE FROM due_dates WHERE class_name = ? AND period = ?').bind(className, period);
  }
  const ms = Date.parse(dueRaw);
  if (!Number.isFinite(ms)) throw bad('due_at ไม่ถูกต้อง', 'bad_due');
  return env.DB.prepare(
    `INSERT INTO due_dates (class_name, period, due_at, title, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (class_name, period) DO UPDATE SET
       due_at = excluded.due_at, title = excluded.title, updated_at = excluded.updated_at`
  ).bind(className, period, new Date(ms).toISOString(), optText(p.title, 200), nowIso());
}

export async function setDueDate(env, p) {
  await dueDateStmt(env, p).run();
  return { ok: true };
}

export async function listDueDates(env, auth, url) {
  let rows;
  if (auth.role === 'student') {
    rows = await env.DB.prepare('SELECT * FROM due_dates WHERE class_name = ?').bind(auth.class_name || '').all();
  } else {
    const cls = url.searchParams.get('class');
    rows = cls
      ? await env.DB.prepare('SELECT * FROM due_dates WHERE class_name = ?').bind(cls).all()
      : await env.DB.prepare('SELECT * FROM due_dates').all();
  }
  return json({ due_dates: rows.results });
}

export async function postNotices(env, auth, items) {
  if (!Array.isArray(items)) throw bad('items ต้องเป็นรายการ');
  if (items.length > MAX_SYNC_OPS) throw bad(`ส่งครั้งละไม่เกิน ${MAX_SYNC_OPS} รายการ`);
  const errors = [];
  const valid = [];
  for (const it of items) {
    if (!isPlainObject(it)) {
      errors.push('รายการไม่ถูกต้อง');
      continue;
    }
    let sid;
    try {
      sid = normSid(it.studentId ?? it.student_id);
    } catch {
      errors.push('รหัสนักเรียนไม่ถูกต้อง');
      continue;
    }
    const kind = NOTICE_KINDS.includes(it.kind) ? it.kind : null;
    if (!kind) {
      errors.push(`${sid}: kind ไม่ถูกต้อง`);
      continue;
    }
    let score = null;
    if (it.score !== null && it.score !== undefined && it.score !== '') {
      const n = Number(it.score);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        errors.push(`${sid}: คะแนนไม่ถูกต้อง`);
        continue;
      }
      score = n;
    }
    const message = optText(it.message, 2000) || (kind === 'feedback' ? '(ให้คะแนนแล้ว)' : '');
    if (!message) {
      errors.push(`${sid}: ไม่มีข้อความ`);
      continue;
    }
    valid.push({ sid, kind, score, message, ref: optText(it.ref, 120), teacher: optText(it.teacher, 120) || 'คุณครู' });
  }
  const students = await existingValues(env, 'students', 'student_id', valid.map((v) => v.sid));
  const now = nowIso();
  const stmts = [];
  for (const v of valid) {
    const st = students.get(v.sid);
    if (!st) {
      errors.push(`${v.sid}: ไม่พบนักเรียน`);
      continue;
    }
    stmts.push(
      env.DB.prepare(
        `INSERT INTO notices (id, student_id, class_name, ref, kind, message, score, teacher, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), v.sid, st.class_name, v.ref, v.kind, v.message, v.score, v.teacher, now)
    );
  }
  if (stmts.length) await runBatch(env, stmts);
  return { ok: true, posted: stmts.length, errors };
}

export async function myNotices(env, auth, url) {
  let sinceMs = Number(url.searchParams.get('since')) || 0;
  if (!Number.isFinite(sinceMs) || sinceMs < 0) sinceMs = 0;
  const { results } = await env.DB.prepare(
    'SELECT * FROM notices WHERE student_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 100'
  )
    .bind(auth.sid, new Date(sinceMs).toISOString())
    .all();
  const notices = results.reverse().map((r) => ({
    id: r.id,
    kind: r.kind,
    ref: r.ref,
    message: r.message,
    score: r.score,
    teacher: r.teacher,
    createdMs: Date.parse(r.created_at)
  }));
  return json({ notices });
}

// ---------- Teacher batch sync (/api/sync/batch) ----------

export async function syncBatch(request, env, auth) {
  const b = await readJson(request);
  if (!Array.isArray(b.items)) throw bad('ต้องส่ง items เป็นรายการ');
  if (b.items.length > MAX_BATCH_ITEMS) throw bad(`ส่งครั้งละไม่เกิน ${MAX_BATCH_ITEMS} รายการ`);
  const ids = b.items.map((it) => (typeof it?.id === 'string' ? it.id.slice(0, 120) : ''));
  const seen = await existingValues(env, 'sync_archive', 'item_id', ids.filter(Boolean));
  const inBatch = new Set();
  const stmts = [];
  const results = [];
  const now = nowIso();
  b.items.forEach((it, i) => {
    const id = ids[i];
    if (!id) {
      results.push({ id: null, status: 'error', message: 'ไม่มี id' });
      return;
    }
    if (seen.has(id) || inBatch.has(id)) {
      results.push({ id, status: 'duplicate' });
      return;
    }
    const type = String(it.type || '').slice(0, 60);
    const data = isPlainObject(it.data) ? it.data : {};
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 100 * 1024) {
      results.push({ id, status: 'error', message: 'ข้อมูลใหญ่เกินไป' });
      return;
    }
    try {
      let status = 'archived';
      if (type === 'set_due_date') {
        stmts.push(dueDateStmt(env, { class_name: data.className, period: data.period, due_at: data.dueAt, title: data.title }));
        status = 'applied';
      } else if (type === 'research_car') {
        stmts.push(
          researchStmt(env, {
            class_name: data.className,
            student_id: data.studentId,
            pre: data.pre,
            post: data.post,
            formative: data.formative
          })
        );
        status = 'applied';
      } else if (type === 'rubric') {
        stmts.push(rubricStmt(env, data));
        status = 'applied';
      } else if (type === 'curriculum_lesson') {
        stmts.push(curriculumLessonStmt(env, data));
        status = 'applied';
      }
      stmts.push(
        env.DB.prepare(
          'INSERT OR IGNORE INTO sync_archive (item_id, type, data, received_at, received_by) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, type, dataStr, now, auth.sub)
      );
      inBatch.add(id);
      results.push({ id, status });
    } catch (e) {
      if (e instanceof HttpError) results.push({ id, status: 'error', message: e.message });
      else throw e;
    }
  });
  if (stmts.length) await runBatch(env, stmts);
  return json({ results });
}
