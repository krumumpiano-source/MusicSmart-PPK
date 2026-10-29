// ทดสอบ Worker API กับ SQLite จริง (node:sqlite) โดยใช้ schema เดียวกับ D1
// รัน: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';

// อะแดปเตอร์ให้ node:sqlite มี API แบบเดียวกับ D1 (prepare().bind().run()/all()/first())
class Stmt {
  constructor(raw, sql) {
    this.raw = raw;
    this.sql = sql;
    this.params = [];
  }
  bind(...p) {
    this.params = p.map((v) => (v === undefined ? null : v));
    return this;
  }
  async run() {
    const r = this.raw.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
  async all() {
    return { results: this.raw.prepare(this.sql).all(...this.params) };
  }
  async first() {
    return this.raw.prepare(this.sql).get(...this.params) ?? null;
  }
}

function makeEnv() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0003_legacy_pin.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0004_submission_meta.sql', import.meta.url), 'utf8'));
  raw.exec(`INSERT INTO students (student_id, class_name, no, prefix, first_name, last_name, nickname, updated_at) VALUES
    ('90001','ม.1/1',1,'เด็กชาย','ทดสอบหนึ่ง','นามสมมุติ','ทดหนึ่ง','2026-01-01'),
    ('90002','ม.1/1',2,'เด็กหญิง','ทดสอบ','นามสมมุติ','ทด','2026-01-01'),
    ('90003','ม.1/2',1,'เด็กชาย','ทดสอบ2','นามสมมุติ','ทด2','2026-01-01')`);
  return {
    DB: { prepare: (sql) => new Stmt(raw, sql) },
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
  const res = await worker.fetch(req, env);
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
