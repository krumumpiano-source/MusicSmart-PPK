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
  raw.exec(readFileSync(new URL('../migrations/0008_intern.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0009_lyrics.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0010_pin_reset.sql', import.meta.url), 'utf8'));
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

const INTERN_REG = {
  fullName: 'นายตัวอย่าง ทดสอบ', internId: 'TEST12345', university: 'มหาวิทยาลัยทดสอบ', faculty: 'ครุศาสตร์', major: 'ดนตรีศึกษา',
  phone: '0812345678', email: 'Test@Example.com', term: '1', academicYear: 2569, mentorName: 'ครูพี่เลี้ยง', preferredClasses: ['ม.1/1'], pin: '482913'
};

test('intern: register -> pending blocks login (only after correct PIN) -> approve -> login', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  let r = await call(env, 'POST', '/api/intern/register', { ...INTERN_REG, pin: '111111' });
  assert.equal(r.status, 400);
  r = await call(env, 'POST', '/api/intern/register', { ...INTERN_REG, phone: '123' });
  assert.equal(r.status, 400);
  r = await call(env, 'POST', '/api/intern/register', INTERN_REG);
  assert.equal(r.status, 200);
  assert.equal((await call(env, 'POST', '/api/intern/register', INTERN_REG)).body.error, 'duplicate');
  assert.equal(env._raw.prepare("SELECT email FROM interns WHERE intern_id = 'TEST12345'").get().email, 'test@example.com');
  // PIN ผิด: ไม่บอกสถานะ
  r = await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '000001' });
  assert.equal(r.body.error, 'wrong_pin');
  r = await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'pending');
  assert.equal((await call(env, 'POST', '/api/intern/login', { internId: 'NOPE999', pin: '482913' })).body.error, 'not_found');
  // ครู: ต้องเลือกห้อง
  r = await call(env, 'GET', '/api/interns', undefined, teacher);
  assert.equal(r.body.interns[0].status, 'pending');
  assert.equal(r.body.interns[0].hasPin, true);
  assert.equal(r.body.interns[0].university, 'มหาวิทยาลัยทดสอบ');
  assert.equal((await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: true, classes: [] }, teacher)).body.error, 'no_classes');
  r = await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: true, classes: ['ม.1/1'] }, teacher);
  assert.equal(r.body.state, 'approved');
  r = await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.profile.classes, ['ม.1/1']);
  assert.equal(r.body.role, 'intern');
  // นักเรียน/นศ. เรียกส่วนของครูไม่ได้
  assert.equal((await call(env, 'GET', '/api/interns', undefined, r.body.token)).status, 403);
  assert.equal((await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: true, classes: ['ม.1/1'] }, r.body.token)).status, 403);
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  assert.equal((await call(env, 'GET', '/api/intern/fetch', undefined, s1.body.token)).status, 403);
  assert.equal((await call(env, 'GET', '/api/intern/fetch')).status, 401);
});

test('intern: fetch scoped to assigned classes, grades queue idempotent + teacher decision, logs, supervision', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  await call(env, 'POST', '/api/intern/register', INTERN_REG);
  await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: true, classes: ['ม.1/1'] }, teacher);
  const t = (await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' })).body.token;
  const s1 = await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '123456' });
  const s3 = await call(env, 'POST', '/api/auth/student', { student_id: '90003', pin: '123456' });
  await call(env, 'POST', '/api/submissions', { assignment_key: 'a:ม.1/1_p3', clip_no: 1, video_url: 'https://example.com/a', period: 3 }, s1.body.token);
  await call(env, 'POST', '/api/submissions', { assignment_key: 'a:ม.1/2_p3', clip_no: 1, video_url: 'https://example.com/b', period: 3 }, s3.body.token);
  await call(env, 'POST', '/api/due-dates', { class_name: 'ม.1/1', period: 3, due_at: '2026-12-01T00:00:00Z' }, teacher);
  await call(env, 'POST', '/api/due-dates', { class_name: 'ม.1/2', period: 3, due_at: '2026-12-02T00:00:00Z' }, teacher);
  let r = await call(env, 'GET', '/api/intern/fetch', undefined, t);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.roster.map((s) => s.student_id), ['90001', '90002']);
  assert.equal(r.body.roster[0].class, 'ม.1/1');
  assert.equal(r.body.submissions.length, 1);
  assert.equal(r.body.submissions[0].student_id, '90001');
  assert.deepEqual(r.body.dueDates.map((d) => d.className), ['ม.1/1']);
  const text = JSON.stringify(r.body);
  assert.equal(text.includes('pin_hash'), false);
  // ดึงเฉพาะที่เปลี่ยนใหม่
  r = await call(env, 'GET', '/api/intern/fetch?since=' + encodeURIComponent(r.body.nextSince), undefined, t);
  assert.equal(r.body.submissions.length, 0);

  // เสนอคะแนน: ห้องที่ไม่ได้รับมอบหมาย/ข้อมูลผิดถูกปฏิเสธ, ส่งซ้ำไม่เกิดรายการซ้ำ
  const items = [
    { clientId: 'g_abc_90001', className: 'ม.1/1', period: 3, studentId: '90001', score: 8, comment: 'ดี' },
    { clientId: 'g_abc_90003', className: 'ม.1/2', period: 3, studentId: '90003', score: 9 },
    { clientId: 'g_bad_90002', className: 'ม.1/1', period: 3, studentId: '90002', score: 101 }
  ];
  r = await call(env, 'POST', '/api/intern/grades', { items }, t);
  assert.deepEqual(r.body.accepted, ['g_abc_90001']);
  assert.deepEqual(r.body.rejected.map((x) => x.reason).sort(), ['class_not_assigned', 'invalid']);
  await call(env, 'POST', '/api/intern/grades', { items: [items[0]] }, t);
  r = await call(env, 'GET', '/api/interns/approvals?status=pending', undefined, teacher);
  assert.equal(r.body.approvals.length, 1);
  assert.deepEqual([r.body.approvals[0].studentId, r.body.approvals[0].score, r.body.approvals[0].internName], ['90001', 8, 'นายตัวอย่าง ทดสอบ']);
  const apId = r.body.approvals[0].id;
  r = await call(env, 'POST', '/api/interns/approvals/' + apId + '/decide', { approve: true }, teacher);
  assert.equal(r.body.approval.status, 'approved');
  assert.equal(r.body.approval.score, 8);
  assert.equal((await call(env, 'POST', '/api/interns/approvals/' + apId + '/decide', { approve: false }, teacher)).status, 409);
  assert.equal((await call(env, 'GET', '/api/interns/approvals?status=pending', undefined, teacher)).body.approvals.length, 0);

  // บันทึกหลังสอน
  const log = { clientId: 'l_abc12345', className: 'ม.1/1', period: 3, result: 'ผลดี', problems: 'เสียงดัง', solutions: 'ใช้สัญญาณ' };
  assert.equal((await call(env, 'POST', '/api/intern/logs', log, t)).body.duplicate, false);
  assert.equal((await call(env, 'POST', '/api/intern/logs', log, t)).body.duplicate, true);
  assert.equal((await call(env, 'POST', '/api/intern/logs', { ...log, clientId: 'l_other123', className: 'ม.1/2' }, t)).status, 403);
  r = await call(env, 'GET', '/api/interns/logs?intern_id=TEST12345', undefined, teacher);
  assert.equal(r.body.logs.length, 1);
  assert.equal(r.body.logs[0].problems, 'เสียงดัง');

  // ผลนิเทศ
  r = await call(env, 'POST', '/api/interns/TEST12345/supervision', { className: 'ม.1/1', period: 3, ratings: { a: 5, b: 4, c: 9 }, comments: 'เยี่ยม', mentor: 'ครู' }, teacher);
  assert.equal(r.body.total, 14);
  r = await call(env, 'GET', '/api/intern/fetch', undefined, t);
  assert.equal(r.body.approvals[0].status, 'approved');
  assert.equal(r.body.logs.length, 1);
  assert.deepEqual([r.body.evaluations[0].total, r.body.evaluations[0].ratings.c], [14, 5]);
  assert.equal((await call(env, 'POST', '/api/interns/NOBODY1/supervision', { ratings: {} }, teacher)).status, 404);
});

test('intern: reset PIN / reject revoke existing tokens; first-time set-pin; lockout', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  await call(env, 'POST', '/api/intern/register', INTERN_REG);
  await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: true, classes: ['ม.1/1'] }, teacher);
  const t = (await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' })).body.token;
  assert.equal((await call(env, 'GET', '/api/intern/fetch', undefined, t)).status, 200);
  assert.equal((await call(env, 'POST', '/api/interns/TEST12345/reset-pin', undefined, teacher)).status, 200);
  assert.equal((await call(env, 'GET', '/api/intern/fetch', undefined, t)).status, 401);
  let r = await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' });
  assert.equal(r.body.error, 'needs_pin');
  r = await call(env, 'POST', '/api/intern/set-pin', { internId: 'TEST12345', pin: '795146' });
  assert.equal(r.status, 200);
  assert.equal((await call(env, 'POST', '/api/intern/set-pin', { internId: 'TEST12345', pin: '111222' })).body.error, 'pin_exists');
  assert.equal((await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' })).body.error, 'wrong_pin');
  const t2 = (await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '795146' })).body.token;
  assert.equal((await call(env, 'GET', '/api/intern/fetch', undefined, t2)).status, 200);
  // ไม่อนุมัติ/ปิดบัญชี = โทเค็นเดิมใช้ไม่ได้
  await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: false, reason: 'ข้อมูลไม่ครบ' }, teacher);
  assert.equal((await call(env, 'GET', '/api/intern/fetch', undefined, t2)).status, 401);
  r = await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '795146' });
  assert.equal(r.body.error, 'rejected');
  assert.ok(r.body.message.includes('ข้อมูลไม่ครบ'));
  // ลงทะเบียนใหม่ได้หลังถูกปฏิเสธ
  assert.equal((await call(env, 'POST', '/api/intern/register', INTERN_REG)).status, 200);
  // ล็อก 15 นาทีหลังผิด 5 ครั้ง
  for (let i = 0; i < 5; i++) await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '000002' });
  r = await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' });
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'locked');
  // ครูอัปเสิร์ตบัญชีเอง (ยังไม่มี PIN) และปิดบัญชี
  assert.equal((await call(env, 'PUT', '/api/interns/MANUAL01', { name: 'นศ.มือ', classes: ['ม.1/2'] }, teacher)).body.created, true);
  assert.equal((await call(env, 'PUT', '/api/interns/MANUAL01', { name: 'นศ.มือ2', classes: ['ม.1/1', 'ม.1/2'], active: false }, teacher)).body.created, false);
  const list = (await call(env, 'GET', '/api/interns', undefined, teacher)).body.interns.find((i) => i.internId === 'MANUAL01');
  assert.deepEqual([list.name, list.classes, list.active, list.hasPin], ['นศ.มือ2', ['ม.1/1', 'ม.1/2'], false, false]);
});

test('lyrics: group writing, voting rules, teacher controls, one-per-note, access control', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  for (const [id, no, nick] of [['90006', 6, 'หก'], ['90011', 11, 'สิบเอ็ด'], ['90007', 7, 'เจ็ด']]) {
    await env.DB.prepare("INSERT INTO students (student_id, class_name, no, prefix, first_name, last_name, nickname, updated_at) VALUES (?, 'ม.1/1', ?, 'ด.ช.', ?, 'ทดสอบ', ?, '2026-01-01')").bind(id, no, 'ชื่อ' + id, nick).run();
  }
  const tok = {};
  for (const id of ['90001', '90006', '90011', '90007', '90003']) tok[id] = (await call(env, 'POST', '/api/auth/student', { student_id: id, pin: '123456' })).body.token;
  const cells = (tag, n = 30) => Array.from({ length: n }, (_, i) => `${tag}${i + 1}`);
  const get = (id, song = 'ode_to_joy') => call(env, 'GET', `/api/lyrics/me?song=${song}`, undefined, tok[id]);
  const save = (id, c, song = 'ode_to_joy') => call(env, 'PUT', '/api/lyrics/me', { songKey: song, cells: c }, tok[id]);
  const vote = (id, target, song = 'ode_to_joy') => call(env, 'POST', '/api/lyrics/vote', { songKey: song, targetId: target }, tok[id]);
  const set = (patch, song = 'ode_to_joy') => call(env, 'POST', '/api/lyrics/settings', { className: 'ม.1/1', songKey: song, patch }, teacher);

  // สิทธิ์: ไม่มีโทเค็น/ครูเรียกของนักเรียน/นักเรียนเรียกของครู
  assert.equal((await call(env, 'GET', '/api/lyrics/me?song=ode_to_joy')).status, 401);
  assert.equal((await call(env, 'GET', '/api/lyrics/me?song=ode_to_joy', undefined, teacher)).status, 403);
  assert.equal((await call(env, 'GET', '/api/lyrics/overview?class=ม.1/1&song=ode_to_joy', undefined, tok['90001'])).status, 403);
  assert.equal((await set({ phase: 'voting' }, 'nope')).status, 404);
  assert.equal((await get('90001', 'nope')).status, 404);

  // ช่วงแต่ง: เห็นเฉพาะกลุ่มตัวเอง (90001/90006/90011 = กลุ่ม 1)
  let r = await get('90001');
  assert.deepEqual([r.body.group, r.body.memberCount, r.body.canEdit, r.body.settings.phase], [1, 3, true, 'writing']);
  assert.equal(r.body.candidates, undefined);
  assert.equal((await save('90001', cells('ก', 31))).body.error, 'too_many_cells');
  r = await save('90001', cells('ก'));
  assert.equal(r.body.filled, 30);
  await save('90006', cells('ข'));
  await save('90011', cells('ค'));
  await save('90007', cells('ง'));
  assert.equal(JSON.stringify((await get('90001')).body).includes('ข1'), false);
  // เกินความยาวต่อช่องถูกตัด
  r = await save('90001', ['x'.repeat(50)]);
  assert.equal(Array.from(r.body.cells[0]).length, 12);
  await save('90001', cells('ก'));

  // ยังไม่เปิดโหวต → โหวตไม่ได้
  assert.equal((await vote('90001', '90006')).body.error, 'not_voting');
  assert.equal((await set({ phase: 'voting' })).status, 200);
  assert.equal((await save('90001', cells('ก'))).body.error, 'not_writing');
  r = await get('90001');
  assert.equal(r.body.candidates.length, 3);
  assert.equal(r.body.candidates.every((c) => c.votes === undefined), true, 'ไม่เห็นคะแนนระหว่างโหวต');
  assert.equal(JSON.stringify(r.body).includes('voter'), false);
  assert.equal((await vote('90001', '90001')).body.error, 'self_not_allowed');
  assert.equal((await vote('90001', '90007')).body.error, 'bad_target', 'โหวตข้ามกลุ่มไม่ได้');
  assert.equal((await vote('90001', '90006')).status, 200);
  assert.equal((await vote('90001', '90011')).body.myVote, '90011', 'เปลี่ยนใจได้');
  await vote('90006', '90011');
  await vote('90011', '90006');

  // ครูเห็นผู้โหวต; ปิดโหวต → นักเรียนเห็นคะแนน
  r = await call(env, 'GET', '/api/lyrics/overview?class=ม.1/1&song=ode_to_joy', undefined, teacher);
  const g1 = r.body.groups.find((g) => g.group === 1);
  assert.equal(g1.voters.length, 3);
  assert.equal(g1.result.total, 3);
  await set({ phase: 'closed' });
  r = await get('90001');
  assert.equal(r.body.tallyVisible, true);
  assert.deepEqual(r.body.candidates.map((c) => c.votes).sort(), [0, 1, 2]);
  assert.equal(r.body.result.winnerId, '90011');
  assert.equal((await vote('90001', '90006')).body.error, 'not_voting');
  // ครูเลือกเนื้อเอง (ต้องเป็นผู้สมัครในกลุ่มเท่านั้น) แล้วล็อก
  assert.equal((await call(env, 'POST', '/api/lyrics/pick', { className: 'ม.1/1', songKey: 'ode_to_joy', group: 1, studentId: '90007' }, teacher)).status, 409);
  assert.equal((await call(env, 'POST', '/api/lyrics/pick', { className: 'ม.1/1', songKey: 'ode_to_joy', group: 1, studentId: '90006' }, teacher)).status, 200);
  assert.equal((await get('90001')).body.result.winnerId, '90006');
  assert.equal((await set({ locked: true })).body.settings.locked, true);
  assert.equal((await set({ phase: 'writing' })).body.settings.phase, 'closed', 'ล็อกแล้วเฟสต้องปิด');
  assert.equal((await save('90001', cells('ก'))).body.error, 'locked');
  // pick ยังคงอยู่หลังเปลี่ยนการตั้งค่า
  assert.equal((await get('90001')).body.result.winnerId, '90006');

  // โหมด 1 คน 1 โน้ต (Joy to the World: 8 วรรค) เลขที่ 1/6/11 = วรรค 1/2/3
  r = await get('90006', 'joy_to_the_world');
  assert.deepEqual([r.body.settings.mode, r.body.seat, r.body.canEdit], ['one_per_note', 2, true]);
  r = await save('90006', cells('ว', 8), 'joy_to_the_world');
  assert.deepEqual(r.body.cells.map((c) => c !== ''), [false, true, false, false, false, false, false, false], 'เก็บเฉพาะวรรคของตน');
  await save('90001', cells('อ', 8), 'joy_to_the_world');
  r = await get('90011', 'joy_to_the_world');
  assert.deepEqual(r.body.parts.slice(0, 3).map((p) => [p.text, p.mine]), [['อ1', false], ['ว2', false], ['', true]]);
  assert.equal((await vote('90001', '90006', 'joy_to_the_world')).body.error, 'bad_mode');
  // ห้องอื่นไม่ปะปน
  r = await get('90003');
  assert.equal(r.body.memberCount, 1);
  assert.equal(r.body.savedCount, 0);
  r = await call(env, 'GET', '/api/lyrics/overview?class=ม.1/2&song=ode_to_joy', undefined, teacher);
  assert.equal(r.body.groups.length, 1);
  assert.equal(r.body.groups[0].members[0].saved, false);
});
test('pin reset via teacher: request -> approve (code shown once) -> student sets new PIN; wrong codes burn; old PIN dies', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  const login = (pin) => call(env, 'POST', '/api/auth/student', { student_id: '90001', pin });
  assert.equal((await login('482913')).status, 200);
  const req = () => call(env, 'POST', '/api/pin-reset/request', { role: 'student', id: '90001' });
  const confirm = (code, secret, id = '90001') => call(env, 'POST', '/api/pin-reset/confirm', { role: 'student', id, code, secret });
  assert.equal((await call(env, 'POST', '/api/pin-reset/request', { role: 'student', id: '99999' })).status, 404);
  assert.equal((await call(env, 'POST', '/api/pin-reset/request', { role: 'student', id: 'abc' })).status, 400);
  let r = await req();
  assert.equal(r.body.mode, 'teacher');
  assert.equal((await req()).body.existing, true, 'ไม่สร้างคำขอซ้ำ');
  // ครูเท่านั้นที่ดู/ตัดสินได้
  assert.equal((await call(env, 'GET', '/api/pin-reset/requests')).status, 401);
  r = await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher);
  assert.equal(r.body.requests.length, 1);
  const q = r.body.requests[0];
  assert.deepEqual([q.subjectId, q.status, q.role, q.className], ['90001', 'pending', 'student', 'ม.1/1']);
  assert.ok(q.name.includes('ทดสอบหนึ่ง'));
  assert.equal(JSON.stringify(r.body).includes('code'), false);
  // ยังไม่อนุมัติ → ยืนยันไม่ได้ และ PIN เดิมยังใช้ได้
  assert.equal((await confirm('123456', '795146')).body.error, 'invalid_code');
  assert.equal((await login('482913')).status, 200);
  const stu = (await login('482913')).body.token;
  assert.equal((await call(env, 'POST', `/api/pin-reset/requests/${q.id}/decide`, { approve: true }, stu)).status, 403);
  r = await call(env, 'POST', `/api/pin-reset/requests/${q.id}/decide`, { approve: true }, teacher);
  assert.equal(r.status, 200);
  assert.match(r.body.code, /^\d{6}$/);
  const code = r.body.code;
  // รหัสไม่ถูกเก็บเป็นข้อความธรรมดา
  const row = await env.DB.prepare('SELECT code_hash FROM pin_reset_requests WHERE id = ?').bind(q.id).first();
  assert.equal(row.code_hash.includes(code), false);
  // PIN ใหม่ต้องผ่านเกณฑ์ (ไม่เสียจำนวนครั้งที่ลอง)
  assert.equal((await confirm(code, '111111')).body.error, 'weak_pin');
  assert.equal((await confirm(code, '12ab56')).body.error, 'bad_pin');
  // ผิด 4 ครั้งยังเหลือ 1 แล้วใส่ถูกได้
  const wrong = code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 4; i++) assert.equal((await confirm(wrong, '795146')).body.error, 'invalid_code');
  assert.equal((await confirm(wrong, '795146')).body.message.includes('ถูกยกเลิก'), true, 'ผิดครบ 5 ครั้งรหัสถูกยกเลิก');
  assert.equal((await confirm(code, '795146')).body.error, 'invalid_code', 'รหัสที่ถูกยกเลิกใช้ไม่ได้อีก');
  // ออกรหัสใหม่ (ขอใหม่ → อนุมัติใหม่) แล้วตั้งสำเร็จ
  assert.equal((await req()).body.existing, false);
  const q2 = (await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests[0];
  const code2 = (await call(env, 'POST', `/api/pin-reset/requests/${q2.id}/decide`, { approve: true }, teacher)).body.code;
  assert.equal((await confirm(code2, '795146', '90002')).body.error, 'invalid_code', 'รหัสของคนอื่นใช้กับบัญชีอื่นไม่ได้');
  r = await confirm(code2, '795146');
  assert.equal(r.status, 200);
  assert.equal((await confirm(code2, '246801')).body.error, 'invalid_code', 'ใช้ซ้ำไม่ได้');
  assert.equal((await login('482913')).status, 401, 'PIN เก่าใช้ไม่ได้');
  assert.equal((await login('795146')).status, 200);
  assert.equal((await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests.length, 0);
  // ครูปฏิเสธคำขอ
  await req();
  const q3 = (await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests[0];
  assert.equal((await call(env, 'POST', `/api/pin-reset/requests/${q3.id}/decide`, { approve: false }, teacher)).body.rejected, true);
  assert.equal((await call(env, 'POST', `/api/pin-reset/requests/${q3.id}/decide`, { approve: true }, teacher)).status, 404);
});

test('pin reset: locked-out student recovers; intern flow revokes tokens; unknown staff gets generic reply; IP throttle', async () => {
  const env = makeEnv();
  const teacher = await setupTeacher(env);
  await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '482913' });
  for (let i = 0; i < 5; i++) await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '000002' });
  assert.equal((await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '482913' })).status, 429);
  await call(env, 'POST', '/api/pin-reset/request', { role: 'student', id: '90001' });
  let q = (await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests[0];
  let code = (await call(env, 'POST', `/api/pin-reset/requests/${q.id}/decide`, { approve: true }, teacher)).body.code;
  assert.equal((await call(env, 'POST', '/api/pin-reset/confirm', { role: 'student', id: '90001', code, secret: '795146' })).status, 200);
  assert.equal((await call(env, 'POST', '/api/auth/student', { student_id: '90001', pin: '795146' })).status, 200, 'ปลดล็อกหลังรีเซ็ต');

  // นศ.ฝึกสอน
  await call(env, 'POST', '/api/intern/register', INTERN_REG);
  const unknown = await call(env, 'POST', '/api/pin-reset/request', { role: 'staff', id: 'NOBODY99' });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.mode, 'teacher', 'ไม่เปิดเผยว่ามีบัญชีหรือไม่');
  assert.equal((await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests.length, 0);
  await call(env, 'POST', '/api/pin-reset/request', { role: 'staff', id: 'TEST12345' });
  assert.equal((await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests.length, 0, 'ยังไม่อนุมัติบัญชี = ไม่มีคำขอ');
  await call(env, 'POST', '/api/interns/TEST12345/decide', { approve: true, classes: ['ม.1/1'] }, teacher);
  const old = (await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' })).body.token;
  await call(env, 'POST', '/api/pin-reset/request', { role: 'staff', id: 'TEST12345' });
  q = (await call(env, 'GET', '/api/pin-reset/requests', undefined, teacher)).body.requests[0];
  assert.deepEqual([q.role, q.subjectId, q.name], ['intern', 'TEST12345', 'นายตัวอย่าง ทดสอบ']);
  code = (await call(env, 'POST', `/api/pin-reset/requests/${q.id}/decide`, { approve: true }, teacher)).body.code;
  assert.equal((await call(env, 'POST', '/api/pin-reset/confirm', { role: 'staff', id: 'TEST12345', code, secret: '795146' })).status, 200);
  assert.equal((await call(env, 'GET', '/api/intern/fetch', undefined, old)).status, 401, 'โทเค็นเก่าใช้ไม่ได้');
  assert.equal((await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '482913' })).body.error, 'wrong_pin');
  assert.equal((await call(env, 'POST', '/api/intern/login', { internId: 'TEST12345', pin: '795146' })).status, 200);

  // จำกัดการขอต่อ IP
  let last;
  for (let i = 0; i < 12; i++) last = await call(env, 'POST', '/api/pin-reset/request', { role: 'student', id: '90002' }, undefined, { 'CF-Connecting-IP': '9.9.9.9' });
  assert.equal(last.status, 429);
});
