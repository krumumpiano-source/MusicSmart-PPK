// ทดสอบ Worker API กับ SQLite จริง (node:sqlite) โดยใช้ schema เดียวกับ D1
// รัน: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';

// อะแดปเตอร์ให้ node:sqlite มี API แบบเดียวกับ D1 (prepare().bind().run()/all()/first())
// นับ query ต่อคำขอ (batch() นับเป็น 1) เพื่อยืนยันว่าไม่เกินเพดาน 50 query ของ D1 แผนฟรี
const D1_FREE_QUERY_LIMIT = 50;

class Stmt {
  constructor(raw, sql, counter) {
    this.raw = raw;
    this.sql = sql;
    this.counter = counter;
    this.params = [];
  }
  bind(...p) {
    this.params = p.map((v) => (v === undefined ? null : v));
    return this;
  }
  async run(inBatch = false) {
    if (!inBatch) this.counter.n++;
    const r = this.raw.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
  async all() {
    this.counter.n++;
    return { results: this.raw.prepare(this.sql).all(...this.params) };
  }
  async first() {
    this.counter.n++;
    return this.raw.prepare(this.sql).get(...this.params) ?? null;
  }
}

function makeDb(raw, counter) {
  return {
    prepare: (sql) => new Stmt(raw, sql, counter),
    async batch(stmts) {
      counter.n++;
      raw.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run(true));
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    }
  };
}

function makeEnv() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0003_legacy_pin.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0004_submission_meta.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0005_teacher_sync.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0006_quiz.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0007_exams.sql', import.meta.url), 'utf8'));
  raw.exec(`INSERT INTO students (student_id, class_name, no, prefix, first_name, last_name, nickname, updated_at) VALUES
    ('90001','ม.1/1',1,'เด็กชาย','ทดสอบหนึ่ง','นามสมมุติ','ทดหนึ่ง','2026-01-01'),
    ('90002','ม.1/1',2,'เด็กหญิง','ทดสอบ','นามสมมุติ','ทด','2026-01-01'),
    ('90003','ม.1/2',1,'เด็กชาย','ทดสอบ2','นามสมมุติ','ทด2','2026-01-01')`);
  const counter = { n: 0 };
  return {
    DB: makeDb(raw, counter),
    _queries: counter,
    SESSION_SECRET: 'test-session-secret-0123456789abcdef',
    PASSWORD_PEPPER: 'test-pepper-0123456789abcdef0123',
    SETUP_TOKEN: 'setup-token-for-tests-xyz',
    _raw: raw
  };
}

async function call(env, method, path, body, token, headers = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  const req = new Request('https://api.test' + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (env._queries) env._queries.n = 0;
  const res = await worker.fetch(req, env);
  if (env._queries) {
    assert.ok(env._queries.n <= D1_FREE_QUERY_LIMIT, `${method} ${path} ใช้ ${env._queries.n} query (เกิน ${D1_FREE_QUERY_LIMIT})`);
  }
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

const PW = 'correct-horse-battery-staple';

async function setupTeacher(env) {
  const r = await call(env, 'POST', '/api/auth/setup', {
    email: 'Teacher@Example.com',
    name: 'ครูทดสอบ',
    password: PW,
    setupToken: env.SETUP_TOKEN
  });
  assert.equal(r.status, 200);
  const login = await call(env, 'POST', '/api/auth/login', { email: 'teacher@example.com', password: PW });
  assert.equal(login.status, 200);
  return login.body.token;
}

test('health endpoint responds', async () => {
  const env = makeEnv();
  const r = await call(env, 'GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('teacher setup: rejects bad token, weak password; succeeds once', async () => {
  const env = makeEnv();
  let r = await call(env, 'POST', '/api/auth/setup', { email: 't@x.com', password: PW, setupToken: 'wrong' });
  assert.equal(r.status, 403);
  r = await call(env, 'POST', '/api/auth/setup', { email: 't@x.com', password: 'short', setupToken: env.SETUP_TOKEN });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'weak_password');
  await setupTeacher(env);
  r = await call(env, 'POST', '/api/auth/setup', { email: 'other@x.com', password: PW, setupToken: env.SETUP_TOKEN });
  assert.equal(r.status, 409);
});

test('teacher setup removes legacy PBKDF2 row', async () => {
  const env = makeEnv();
  env._raw.exec(`INSERT INTO teachers VALUES ('legacy@x.com','เก่า','pbkdf2-sha256-legacy','pbkdf2-sha256$v1$210000$a$b','2026-01-01')`);
  await setupTeacher(env);
  const rows = env._raw.prepare('SELECT email FROM teachers').all();
  assert.deepEqual(rows.map((x) => x.email), ['teacher@example.com']);
});

test('teacher login: wrong password 401, correct password gives token', async () => {
  const env = makeEnv();
  await setupTeacher(env);
  let r = await call(env, 'POST', '/api/auth/login', { email: 'teacher@example.com', password: 'wrong-password-123' });
  assert.equal(r.status, 401);
  r = await call(env, 'POST', '/api/auth/login', { email: 'teacher@example.com', password: PW });
  assert.equal(r.status, 200);
  assert.equal(r.body.role, 'teacher');
  const me = await call(env, 'GET', '/api/me', undefined, r.body.token);
  assert.equal(me.body.role, 'teacher');
});

test('no token or tampered token is rejected', async () => {
  const env = makeEnv();
  const token = await setupTeacher(env);
  assert.equal((await call(env, 'GET', '/api/students')).status, 401);
  const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A');
  assert.equal((await call(env, 'GET', '/api/students', undefined, tampered)).status, 401);
});

test('student PIN: first login sets PIN, later logins verify it, wrong PIN rejected', async () => {
  const env = makeEnv();
  let r = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  assert.equal(r.status, 200);
  assert.equal(r.body.pin_created, true);
  assert.equal(r.body.student.first_name, 'ทดสอบหนึ่ง');
  r = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  assert.equal(r.status, 200);
  assert.equal(r.body.pin_created, false);
  r = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '000000' });
  assert.equal(r.status, 401);
  r = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: 'abcdef' });
  assert.equal(r.status, 400);
});

test('student PIN: 5 failures lock the account', async () => {
  const env = makeEnv();
  await call(env, 'POST', '/api/auth/student', { student_id: '90002', pin: '111111' });
  for (let i = 0; i < 5; i++) {
    const r = await call(env, 'POST', '/api/auth/student', { student_id: '90002', pin: '222222' });
    assert.equal(r.status, 401);
  }
  const r = await call(env, 'POST', '/api/auth/student', { student_id: '90002', pin: '111111' });
  assert.equal(r.status, 429);
});

test('unknown student id gets generic 401 (no account enumeration)', async () => {
  const env = makeEnv();
  const r = await call(env, 'POST', '/api/auth/student', { student_id: '99999', pin: '123456' });
  assert.equal(r.status, 401);
});

test('role separation: student cannot use teacher endpoints', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  assert.equal((await call(env, 'GET', '/api/students', undefined, s.body.token)).status, 403);
  assert.equal((await call(env, 'GET', '/api/students', undefined, teacher)).status, 200);
});

test('teacher roster excludes PIN hashes and can reset PIN', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const r = await call(env, 'GET', '/api/students?class=' + encodeURIComponent('ม.1/1'), undefined, teacher);
  assert.equal(r.status, 200);
  assert.equal(r.body.students.length, 2);
  assert.equal(r.body.students[0].has_pin, 1);
  assert.equal('pin_hash' in r.body.students[0], false);
  const reset = await call(env, 'POST', '/api/teacher/students/90001/reset-pin', undefined, teacher);
  assert.equal(reset.status, 200);
  const again = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '654321' });
  assert.equal(again.body.pin_created, true);
});

test('session save uses version check (optimistic concurrency)', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const key = 'ม.1/1|1|2569';
  const path = '/api/sessions/' + encodeURIComponent(key);
  let r = await call(env, 'PUT', path, { class_name: 'ม.1/1', period: 1, data: { plan: 'A' }, base_version: 0 }, teacher);
  assert.equal(r.body.version, 1);
  r = await call(env, 'PUT', path, { class_name: 'ม.1/1', period: 1, data: { plan: 'B' }, base_version: 0 }, teacher);
  assert.equal(r.status, 409);
  r = await call(env, 'PUT', path, { class_name: 'ม.1/1', period: 1, data: { plan: 'B' }, base_version: 1 }, teacher);
  assert.equal(r.body.version, 2);
  r = await call(env, 'PUT', path, { class_name: 'ม.1/1', period: 1, data: { plan: 'C' }, base_version: 1 }, teacher);
  assert.equal(r.status, 409);
  assert.equal(r.body.current_version, 2);
  const list = await call(env, 'GET', '/api/sessions?class=' + encodeURIComponent('ม.1/1'), undefined, teacher);
  assert.deepEqual(list.body.sessions[0].data, { plan: 'B' });
});

test('submissions: only https links; upsert per clip; teacher grades', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const st = s.body.token;
  const base = { assignment_key: 'kalimba-w1', group_no: 2, clip_no: 1 };

  let r = await call(env, 'POST', '/api/submissions', { ...base, video_url: 'http://example.com/a.mp4' }, st);
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'invalid_url');
  r = await call(env, 'POST', '/api/submissions', { ...base, video_url: 'https://user:pw@example.com/a' }, st);
  assert.equal(r.status, 400);
  r = await call(env, 'POST', '/api/submissions', { ...base, video_url: 'https://onedrive.live.com/x' }, st);
  assert.equal(r.status, 200);
  assert.equal(r.body.submission.link_status, 'unchecked');
  r = await call(env, 'POST', '/api/submissions', { ...base, video_url: 'https://1drv.ms/v/y' }, st);
  assert.equal(r.status, 200);

  const list = await call(env, 'GET', '/api/submissions?class=' + encodeURIComponent('ม.1/1'), undefined, teacher);
  assert.equal(list.body.submissions.length, 1);
  const id = list.body.submissions[0].id;
  assert.equal(list.body.submissions[0].video_url, 'https://1drv.ms/v/y');

  r = await call(env, 'PATCH', '/api/submissions/' + id, { score: 150 }, teacher);
  assert.equal(r.status, 400);
  r = await call(env, 'PATCH', '/api/submissions/' + id, { score: 85, feedback: 'ดีมาก' }, teacher);
  assert.equal(r.body.submission.score, 85);

  // นักเรียนส่งลิงก์ใหม่ สถานะลิงก์ถูกรีเซ็ต แต่คะแนนที่ครูให้ไว้ยังอยู่
  await call(env, 'POST', '/api/submissions', { ...base, video_url: 'https://1drv.ms/v/z' }, st);
  const mine = await call(env, 'GET', '/api/submissions/mine', undefined, st);
  assert.equal(mine.body.submissions.length, 1);
  assert.equal(mine.body.submissions[0].score, 85);
  assert.equal(mine.body.submissions[0].link_status, 'unchecked');
});

test('student cannot see another class submissions via teacher endpoint', async () => {
  const env = makeEnv();
  const s = await call(env, 'POST', '/api/auth/student', { student_id: '90003', pin: '123456' });
  const r = await call(env, 'GET', '/api/submissions', undefined, s.body.token);
  assert.equal(r.status, 403);
});

test('link check marks link ok / invalid (fetch mocked)', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const r0 = await call(env, 'POST', '/api/submissions', { assignment_key: 'k', clip_no: 1, video_url: 'https://a.example.com/v' }, s.body.token);
  const id = r0.body.submission.id;
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 200 });
    let r = await call(env, 'POST', `/api/submissions/${id}/check`, undefined, teacher);
    assert.equal(r.body.link_status, 'ok');
    globalThis.fetch = async () => new Response(null, { status: 404 });
    r = await call(env, 'POST', `/api/submissions/${id}/check`, undefined, teacher);
    assert.equal(r.body.link_status, 'invalid');
    assert.equal(r.body.http_status, 404);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('research scores upsert and validate range', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  let r = await call(env, 'PUT', '/api/research', { class_name: 'ม.1/1', student_id: '90001', pre: 40, post: 80 }, teacher);
  assert.equal(r.status, 200);
  r = await call(env, 'PUT', '/api/research', { class_name: 'ม.1/1', student_id: '90001', pre: 40, post: 80, formative: 70 }, teacher);
  const list = await call(env, 'GET', '/api/research?class=' + encodeURIComponent('ม.1/1'), undefined, teacher);
  assert.equal(list.body.research.length, 1);
  assert.equal(list.body.research[0].formative, 70);
  r = await call(env, 'PUT', '/api/research', { class_name: 'ม.1/1', student_id: '90001', pre: 500 }, teacher);
  assert.equal(r.status, 400);
});

test('sync: applies ops, dedupes by op_id, reports conflicts and role errors', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const key = 'ม.1/1|1|2569';
  const ops = [
    { op_id: 'op-1', kind: 'session.put', payload: { session_key: key, class_name: 'ม.1/1', period: 1, data: { a: 1 }, base_version: 0 } },
    { op_id: 'op-2', kind: 'research.put', payload: { class_name: 'ม.1/1', student_id: '90001', pre: 10 } },
    { op_id: 'op-3', kind: 'unknown.kind', payload: {} },
    { kind: 'research.put', payload: {} }
  ];
  let r = await call(env, 'POST', '/api/sync', { ops }, teacher);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map((x) => x.status), ['applied', 'applied', 'error', 'error']);
  assert.equal(r.body.results[2].code, 'unknown_kind');

  // ส่งซ้ำ = duplicate (ไม่เขียนทับ)
  r = await call(env, 'POST', '/api/sync', { ops: [ops[0]] }, teacher);
  assert.equal(r.body.results[0].status, 'duplicate');

  // เวอร์ชันเก่า (base_version เดิม) = conflict ที่ครูต้องตัดสินใจเอง
  const conflict = { op_id: 'op-4', kind: 'session.put', payload: { session_key: key, class_name: 'ม.1/1', period: 1, data: { a: 2 }, base_version: 0 } };
  r = await call(env, 'POST', '/api/sync', { ops: [conflict] }, teacher);
  assert.equal(r.body.results[0].status, 'conflict');
  assert.equal(r.body.results[0].current_version, 1);

  // นักเรียนส่ง session.put ไม่ได้ แต่ส่งงานของตัวเองได้
  r = await call(env, 'POST', '/api/sync', {
    ops: [
      { op_id: 'op-5', kind: 'session.put', payload: { session_key: key, class_name: 'ม.1/1', period: 1, data: {}, base_version: 1 } },
      { op_id: 'op-6', kind: 'submission.put', payload: { assignment_key: 'k2', clip_no: 1, video_url: 'https://x.example.com/v' } }
    ]
  }, s.body.token);
  assert.equal(r.body.results[0].status, 'error');
  assert.equal(r.body.results[0].code, 'forbidden');
  assert.equal(r.body.results[1].status, 'applied');
});

test('CORS: allows github.io and localhost, rejects other origins', async () => {
  const env = makeEnv();
  let r = await call(env, 'GET', '/api/health', undefined, undefined, { Origin: 'https://someone.github.io' });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://someone.github.io');
  r = await call(env, 'GET', '/api/health', undefined, undefined, { Origin: 'https://evil.example.com' });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  r = await call(env, 'GET', '/api/health', undefined, undefined, { Origin: 'http://localhost:8080' });
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:8080');
});

test('unknown route returns 404 JSON', async () => {
  const env = makeEnv();
  const r = await call(env, 'GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'not_found');
});

test('submissions keep title / note / submission_type and update them on resubmit', async () => {
  const env = makeEnv();
  await setupTeacher(env);
  const s = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const st = s.body.token;
  let r = await call(env, 'POST', '/api/submissions', {
    assignment_key: 'r:ม.1/1_p1_abc', clip_no: 1, period: 1,
    video_url: 'https://example.com/a', title: 'คลิปซ้อม', note: 'ซ้อมท่อนแรก', submission_type: 'คลิปฝึกซ้อม (ลิงก์)'
  }, st);
  assert.equal(r.status, 200);
  assert.equal(r.body.submission.title, 'คลิปซ้อม');
  assert.equal(r.body.submission.note, 'ซ้อมท่อนแรก');
  assert.equal(r.body.submission.submission_type, 'คลิปฝึกซ้อม (ลิงก์)');
  r = await call(env, 'POST', '/api/submissions', { assignment_key: 'r:ม.1/1_p1_abc', clip_no: 1, video_url: 'https://example.com/b' }, st);
  assert.equal(r.body.submission.title, null, 'ค่าที่ไม่ส่งมาจะถูกล้างเป็น null');
  assert.equal(r.body.submission.video_url, 'https://example.com/b');
});

test('due dates: teacher sets per class, students see only their class, empty due_at clears', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const s3 = await call(env, 'POST', '/api/auth/student', { student_id: '90003', pin: '123456' });
  let r = await call(env, 'POST', '/api/due-dates', { class_name: 'ม.1/1', period: 3, due_at: '2026-11-05T10:00:00+07:00', title: 'งานคาบ 3' }, teacher);
  assert.equal(r.status, 200);
  r = await call(env, 'POST', '/api/due-dates', { class_name: 'ม.1/1', period: 41, due_at: '2026-11-05T10:00:00Z' }, teacher);
  assert.equal(r.status, 400);
  r = await call(env, 'GET', '/api/due-dates', undefined, s1.body.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.due_dates.length, 1);
  assert.equal(r.body.due_dates[0].period, 3);
  assert.equal(r.body.due_dates[0].due_at, '2026-11-05T03:00:00.000Z');
  r = await call(env, 'GET', '/api/due-dates', undefined, s3.body.token);
  assert.equal(r.body.due_dates.length, 0);
  r = await call(env, 'POST', '/api/due-dates', { class_name: 'ม.1/1', period: 3, due_at: '' }, teacher);
  assert.equal(r.status, 200);
  r = await call(env, 'GET', '/api/due-dates', undefined, s1.body.token);
  assert.equal(r.body.due_dates.length, 0);
});

test('due dates: students cannot write', async () => {
  const env = makeEnv();
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const r = await call(env, 'POST', '/api/due-dates', { class_name: 'ม.1/1', period: 1, due_at: '2026-11-05T10:00:00Z' }, s1.body.token);
  assert.equal(r.status, 403);
});

test('notices: teacher posts to students, student reads only own, since filter works', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const s2 = await call(env, 'POST', '/api/auth/student', { student_id: '90002', pin: '123456' });
  let r = await call(env, 'POST', '/api/notices', { items: [
    { studentId: '90001', kind: 'reminder', ref: 'ม.1/1_p2', message: 'กรุณาส่งงาน' },
    { studentId: '99999', kind: 'reminder', ref: 'x', message: 'ไม่มีคนนี้' },
    { studentId: '90001', kind: 'feedback', ref: 'ม.1/1_p2', message: 'ดีมาก', score: 2.5, teacher: 'ครูทดสอบ' },
    { studentId: '90001', kind: 'bogus', message: 'x' }
  ] }, teacher);
  assert.equal(r.status, 200);
  assert.equal(r.body.posted, 2);
  assert.equal(r.body.errors.length, 2);
  r = await call(env, 'GET', '/api/notices/mine', undefined, s1.body.token);
  assert.equal(r.body.notices.length, 2);
  assert.equal(r.body.notices[1].score, 2.5);
  assert.equal(typeof r.body.notices[0].createdMs, 'number');
  const since = r.body.notices[1].createdMs;
  r = await call(env, 'GET', '/api/notices/mine?since=' + since, undefined, s1.body.token);
  assert.equal(r.body.notices.length, 0);
  r = await call(env, 'GET', '/api/notices/mine', undefined, s2.body.token);
  assert.equal(r.body.notices.length, 0);
  assert.equal((await call(env, 'POST', '/api/notices', { items: [] }, s1.body.token)).status, 403);
});

test('sync batch: applies due date, archives others, dedupes by id, students blocked', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const items = [
    { id: 'sync_1', type: 'set_due_date', data: { className: 'ม.1/1', period: 4, dueAt: '2026-12-01T09:00:00.000Z', title: 'คาบ 4' } },
    { id: 'sync_2', type: 'session_log', data: { className: 'ม.1/1', period: 4, presentCount: 30 } },
    { type: 'session_log', data: {} }
  ];
  let r = await call(env, 'POST', '/api/sync/batch', { items }, teacher);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map((x) => x.status), ['applied', 'archived', 'error']);
  r = await call(env, 'POST', '/api/sync/batch', { items: [items[0], items[1]] }, teacher);
  assert.deepEqual(r.body.results.map((x) => x.status), ['duplicate', 'duplicate']);
  const row = env._raw.prepare("SELECT type, data FROM sync_archive WHERE item_id = 'sync_2'").get();
  assert.equal(row.type, 'session_log');
  assert.equal(JSON.parse(row.data).presentCount, 30);
  assert.equal((await call(env, 'POST', '/api/sync/batch', { items }, s1.body.token)).status, 403);
});

test('sync batch: research_car items are applied to research scores', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const items = [
    { id: 'rc_1', type: 'research_car', data: { className: 'ม.1/1', studentId: '90001', pre: 40, post: 70, formative: 55, gain: 30 } },
    { id: 'rc_2', type: 'research_car', data: { className: 'ม.1/1', studentId: '90001', pre: 500, post: 70 } }
  ];
  const r = await call(env, 'POST', '/api/sync/batch', { items }, teacher);
  assert.deepEqual(r.body.results.map((x) => x.status), ['applied', 'error']);
  const row = env._raw.prepare("SELECT pre, post, formative FROM research_scores WHERE student_id = '90001'").get();
  assert.equal(row.pre, 40);
  assert.equal(row.post, 70);
  assert.equal(row.formative, 55);
});

test('free-plan query budget: 100-item sync batch and 200 notices stay within 50 queries', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const items = Array.from({ length: 100 }, (_, i) => ({ id: 'load_' + i, type: i % 2 ? 'session_log' : 'set_due_date', data: { className: 'ม.1/1', period: (i % 20) + 1, dueAt: '2026-12-01T00:00:00Z' } }));
  let r = await call(env, 'POST', '/api/sync/batch', { items }, teacher);
  assert.equal(r.status, 200);
  assert.equal(r.body.results.filter((x) => x.status !== 'error').length, 100);
  const notices = Array.from({ length: 200 }, (_, i) => ({ studentId: i % 2 ? '90001' : '90002', kind: 'reminder', ref: 'x', message: 'ส่งงาน ' + i }));
  r = await call(env, 'POST', '/api/notices', { items: notices }, teacher);
  assert.equal(r.status, 200);
  assert.equal(r.body.posted, 200);
  r = await call(env, 'POST', '/api/sync/batch', { items: Array.from({ length: 101 }, (_, i) => ({ id: 'x' + i, type: 't', data: {} })) }, teacher);
  assert.equal(r.status, 400);
});

const QUIZ_UNITS = [
  { unit_no: 1, title: 'หน่วยที่ 1', questions: [
    { id: 'q1', question: 'ข้อ 1', choices: [{ key: 'ก', text: 'หนึ่ง' }, { key: 'ข', text: 'สอง' }], correct: 'ก', explanation: 'เพราะ...' },
    { id: 'q2', question: 'ข้อ 2', choices: [{ key: 'ก', text: 'หนึ่ง' }, { key: 'ข', text: 'สอง' }], correct: 'ข' },
    { id: 'q3', question: 'ไม่มีเฉลย', choices: [] }
  ] },
  { unit_no: 2, title: 'หน่วยที่ 2', questions: [{ id: 'u2q1', question: 'x', choices: [{ key: 'ก', text: 'a' }], correct: 'ก' }] }
];

test('quiz: teacher uploads bank; students get questions without answers', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  assert.equal((await call(env, 'PUT', '/api/quiz/bank', { units: QUIZ_UNITS }, s1.body.token)).status, 403);
  let r = await call(env, 'PUT', '/api/quiz/bank', { units: QUIZ_UNITS }, teacher);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.questions, r.body.units], [3, 2]);
  r = await call(env, 'GET', '/api/quiz/units/1', undefined, s1.body.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.title, 'หน่วยที่ 1');
  assert.deepEqual(r.body.questions.map((q) => q.id), ['q1', 'q2']);
  const text = JSON.stringify(r.body);
  assert.equal(text.includes('correct'), false);
  assert.equal(text.includes('เพราะ'), false);
  assert.equal((await call(env, 'GET', '/api/quiz/units/9', undefined, s1.body.token)).status, 404);
  // อัปโหลดใหม่ = แทนที่ทั้งหมด
  await call(env, 'PUT', '/api/quiz/bank', { units: [QUIZ_UNITS[1]] }, teacher);
  assert.equal((await call(env, 'GET', '/api/quiz/units/1', undefined, s1.body.token)).status, 404);
});

test('quiz: server grades, one scored attempt per unit, client_id idempotent, practice unlimited, grants allow retake', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  await call(env, 'PUT', '/api/quiz/bank', { units: QUIZ_UNITS }, teacher);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const t = s1.body.token;
  let r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'q_1', answers: { q1: 'ก', q2: 'ก' }, time_spent: 42 }, t);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.score, r.body.total, r.body.percentage, r.body.practice], [1, 2, 50, false]);
  r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'q_1', answers: { q1: 'ก', q2: 'ข' } }, t);
  assert.equal(r.status, 200);
  assert.equal(r.body.duplicate, true);
  assert.equal(r.body.score, 1);
  r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'q_2', answers: { q1: 'ก', q2: 'ข' } }, t);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'duplicate_quiz');
  r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'p_1', answers: { q1: 'ก', q2: 'ข' }, practice: true }, t);
  assert.equal(r.status, 200);
  assert.equal(r.body.score, 2);
  r = await call(env, 'POST', '/api/quiz/grants', { student_id: '90001', unit_no: 1, extra: 1 }, teacher);
  assert.equal(r.status, 200);
  r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'q_3', answers: { q1: 'ก', q2: 'ข' } }, t);
  assert.equal(r.status, 200);
  assert.equal(r.body.score, 2);
  r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'q_4', answers: { q1: 'ก' } }, t);
  assert.equal(r.status, 409);
  r = await call(env, 'POST', '/api/quiz/units/1/submit', { client_id: 'q_5', answers: { q1: 'toolong' } }, t);
  assert.equal(r.status, 400);
  r = await call(env, 'GET', '/api/quiz/attempts?class=' + encodeURIComponent('ม.1/1'), undefined, teacher);
  assert.equal(r.status, 200);
  assert.equal(r.body.attempts.length, 2);
  assert.equal(r.body.attempts[0].unit_no, 1);
  assert.equal('answers' in r.body.attempts[0], false);
  assert.equal((await call(env, 'GET', '/api/quiz/attempts', undefined, t)).status, 403);
});

const EXAM_BANK = {
  kind: 'midterm',
  items: Array.from({ length: 4 }, (_, i) => ({
    id: 'm' + i, question: 'โจทย์ ' + i, correctIndex: 1, explanation: 'ลับ', srcPeriod: '3', difficulty: 'ง่าย',
    choices: [{ text: 'ผิด ก ' + i }, { text: 'ถูก ' + i }, { text: 'ผิด ข ' + i }]
  }))
};

async function openMidterm(env, teacher, extra = {}) {
  const now = Date.now();
  return call(env, 'POST', '/api/exams/sessions', { kind: 'midterm', className: 'ม.1/1', openAt: now - 1000, closeAt: now + 3600000, durationMin: 25, maxAttempts: 1, ...extra }, teacher);
}

test('exams: bank validation, open room, student gets shuffled questions without answers, full score, one attempt, retake grant', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const s3 = await call(env, 'POST', '/api/auth/student', { student_id: '90003', pin: '123456' });
  const t = s1.body.token;
  let r = await call(env, 'PUT', '/api/exams/bank', { kind: 'midterm', items: [{ id: 'x', question: 'q', choices: [{ text: 'a' }, { text: 'b' }], correctIndex: 0 }] }, teacher);
  assert.equal(r.status, 400);
  assert.equal((await openMidterm(env, teacher)).status, 409);
  r = await call(env, 'PUT', '/api/exams/bank', EXAM_BANK, teacher);
  assert.equal(r.status, 200);
  assert.equal(r.body.items, 4);
  assert.equal((await call(env, 'GET', '/api/exams/status', undefined, t)).body.open, false);
  r = await openMidterm(env, teacher);
  assert.equal(r.status, 200);
  const sessionId = r.body.sessionId;
  assert.equal((await call(env, 'PUT', '/api/exams/bank', EXAM_BANK, teacher)).body.error, 'session_open');
  assert.equal((await call(env, 'GET', '/api/exams/status', undefined, s3.body.token)).body.open, false);
  r = await call(env, 'GET', '/api/exams/status', undefined, t);
  assert.deepEqual([r.body.open, r.body.attemptsLeft, r.body.canStart, r.body.items], [true, 1, true, 4]);
  r = await call(env, 'POST', '/api/exams/start', undefined, t);
  assert.equal(r.status, 200);
  const text = JSON.stringify(r.body);
  assert.equal(text.includes('correct'), false);
  assert.equal(text.includes('ลับ'), false);
  assert.equal(r.body.questions.length, 4);
  const attemptId = r.body.attemptId;
  const again = await call(env, 'POST', '/api/exams/start', undefined, t);
  assert.equal(again.body.attemptId, attemptId);
  assert.deepEqual(again.body.questions, r.body.questions);
  const answers = {};
  r.body.questions.forEach((q) => { answers[q.id] = q.choices.find((c) => c.text.startsWith('ถูก')).key; });
  r = await call(env, 'POST', '/api/exams/submit', { attemptId, answers }, t);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.correct, r.body.items, r.body.points, r.body.maxPoints, r.body.level], [4, 4, 10, 10, 4]);
  r = await call(env, 'POST', '/api/exams/submit', { attemptId, answers: {} }, t);
  assert.equal(r.body.duplicate, true);
  assert.equal(r.body.points, 10);
  r = await call(env, 'GET', '/api/exams/status', undefined, t);
  assert.deepEqual([r.body.attemptsLeft, r.body.canStart, r.body.last.points], [0, false, 10]);
  assert.equal((await call(env, 'POST', '/api/exams/start', undefined, t)).body.error, 'no_attempts');
  assert.equal((await call(env, 'POST', '/api/exams/grants', { sessionId, studentId: '90003' }, teacher)).body.error, 'not_in_room');
  assert.equal((await call(env, 'POST', '/api/exams/grants', { sessionId, studentId: '90001', extra: 1 }, teacher)).status, 200);
  r = await call(env, 'POST', '/api/exams/start', undefined, t);
  assert.equal(r.status, 200);
  assert.notEqual(r.body.attemptId, attemptId);
  r = await call(env, 'GET', '/api/exams/sessions', undefined, teacher);
  assert.deepEqual([r.body.sessions[0].state, r.body.sessions[0].submitted, r.body.sessions[0].inProgress], ['open', 1, 1]);
  r = await call(env, 'GET', '/api/exams/results?sessionId=' + sessionId, undefined, teacher);
  const sub = r.body.attempts.find((a) => a.status === 'submitted');
  assert.deepEqual([sub.studentId, sub.points, sub.attemptNo, sub.no], ['90001', 10, 1, 1]);
  assert.equal(sub.name, 'เด็กชายทดสอบหนึ่ง นามสมมุติ');
  assert.equal((await call(env, 'POST', '/api/exams/sessions/' + sessionId + '/close', undefined, teacher)).status, 200);
  assert.equal((await call(env, 'GET', '/api/exams/status', undefined, t)).body.open, false);
  assert.equal((await call(env, 'GET', '/api/exams/sessions', undefined, t)).status, 403);
});

test('exams: late submission is rejected; quiz retake grant via exam grants maps to quiz_grants', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  await call(env, 'PUT', '/api/exams/bank', EXAM_BANK, teacher);
  await openMidterm(env, teacher);
  const st = await call(env, 'POST', '/api/exams/start', undefined, s1.body.token);
  env._raw.prepare('UPDATE exam_attempts SET deadline_ms = ? WHERE attempt_id = ?').run(Date.now() - 60000, st.body.attemptId);
  const r = await call(env, 'POST', '/api/exams/submit', { attemptId: st.body.attemptId, answers: {} }, s1.body.token);
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'late');
  const g = await call(env, 'POST', '/api/exams/grants', { sessionId: 'quiz_u3', studentId: '90001' }, teacher);
  assert.equal(g.status, 200);
  assert.equal(env._raw.prepare("SELECT extra FROM quiz_grants WHERE student_id = '90001' AND unit_no = 3").get().extra, 1);
});
