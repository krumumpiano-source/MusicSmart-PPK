// ทดสอบโมดูลฝั่งแอป (app/js/cloud-api.js) กับ Worker จริงในเครื่อง
// fetch ของโมดูลจะถูกส่งเข้า worker.fetch โดยตรง (ฐานข้อมูลเป็น SQLite ที่ใช้ schema เดียวกับ D1)
// รัน: node --test test/client.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';

const require = createRequire(import.meta.url);
const CloudApi = require('../../app/js/cloud-api.js');

class Stmt {
  constructor(raw, sql) { this.raw = raw; this.sql = sql; this.params = []; }
  bind(...p) { this.params = p.map((v) => (v === undefined ? null : v)); return this; }
  async run() { const r = this.raw.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes) } }; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.params) }; }
  async first() { return this.raw.prepare(this.sql).get(...this.params) ?? null; }
}

function makeEnv() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  raw.exec(readFileSync(new URL('../migrations/0003_legacy_pin.sql', import.meta.url), 'utf8'));
  raw.exec(`INSERT INTO students (student_id, class_name, no, prefix, first_name, last_name, nickname, updated_at) VALUES
    ('35994','ม.1/1',1,'เด็กชาย','กานต์พงศ์','พร้อมมูล','สกาย','2026-01-01')`);
  return {
    DB: { prepare: (sql) => new Stmt(raw, sql) },
    SESSION_SECRET: 'client-test-session-secret-0123456789',
    PASSWORD_PEPPER: 'client-test-pepper-0123456789abcdef',
    SETUP_TOKEN: 'client-setup-token-xyz'
  };
}

// ทำให้ fetch ของโมดูลไปถึง Worker ในเครื่อง
function wireFetch(env) {
  globalThis.fetch = (url, init) => worker.fetch(new Request(url, init), env);
}

// localStorage จำลองแบบง่าย
function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}

const PW = 'client-test-password-123';
let env;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  env = makeEnv();
  globalThis.localStorage = memoryStorage();
  wireFetch(env);
  // ตั้งค่าครูผ่าน Worker เหมือนขั้นตอน setup-teacher.ps1
  const r = await worker.fetch(new Request('https://api.test/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'krumum.piano@gmail.com', name: 'ครู', password: PW, setupToken: env.SETUP_TOKEN })
  }), env);
  assert.equal(r.status, 200);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.localStorage;
});

test('teacher login stores session and reports role', async () => {
  const sess = await CloudApi.Auth.teacherLogin('krumum.piano@gmail.com', PW);
  assert.equal(sess.role, 'teacher');
  assert.equal(CloudApi.Auth.isTeacher(), true);
  assert.equal(CloudApi.Auth.isStudent(), false);
});

test('wrong teacher password throws CloudApiError 401 and keeps no session', async () => {
  await assert.rejects(
    () => CloudApi.Auth.teacherLogin('krumum.piano@gmail.com', 'wrong-password-999'),
    (e) => e instanceof CloudApi.CloudApiError && e.status === 401
  );
  assert.equal(CloudApi.Auth.session(), null);
});

test('student submits a video link and sees it in mine()', async () => {
  const st = await CloudApi.Auth.studentLogin('35994', '123456');
  assert.equal(st.role, 'student');
  assert.equal(st.pinCreated, true);
  const item = await CloudApi.Submissions.submitVideo({
    assignment_key: 'kalimba-w1',
    group_no: 2,
    clip_no: 1,
    video_url: 'https://onedrive.live.com/clip1'
  });
  assert.equal(item.video_url, 'https://onedrive.live.com/clip1');
  const mine = await CloudApi.Submissions.mine();
  assert.equal(mine.length, 1);
  assert.equal(mine[0].assignment_key, 'kalimba-w1');
});

test('student session cannot call teacher-only listing (403)', async () => {
  await CloudApi.Auth.studentLogin('35994', '123456');
  await assert.rejects(
    () => CloudApi.Submissions.listForClass('ม.1/1'),
    (e) => e.status === 403
  );
});

test('401 from server clears a stale session', async () => {
  await CloudApi.Auth.teacherLogin('krumum.piano@gmail.com', PW);
  // ทำให้โทเค็นเสีย (แก้ไขท้ายโทเค็น) แล้วเรียก API ที่ต้องยืนยันตัวตน
  const sess = CloudApi._readSession();
  CloudApi._saveSession({ token: sess.token.slice(0, -2) + 'xx', role: 'teacher', expires_in: 3600 });
  await assert.rejects(() => CloudApi.Submissions.listForClass('ม.1/1'), (e) => e.status === 401);
  assert.equal(CloudApi._readSession(), null);
});

test('network failure is reported as status 0 (for offline queue)', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(
    () => CloudApi.Auth.teacherLogin('krumum.piano@gmail.com', PW),
    (e) => e instanceof CloudApi.CloudApiError && e.status === 0 && e.code === 'network'
  );
});

test('sync sends queued ops and returns per-op results', async () => {
  await CloudApi.Auth.teacherLogin('krumum.piano@gmail.com', PW);
  const results = await CloudApi.sync([
    { op_id: 'c1-op-1', kind: 'research.put', payload: { class_name: 'ม.1/1', student_id: '35994', pre: 40, post: 70 } },
    { op_id: 'c1-op-1', kind: 'research.put', payload: { class_name: 'ม.1/1', student_id: '35994', pre: 40, post: 70 } }
  ]);
  assert.deepEqual(results.map((r) => r.status), ['applied', 'duplicate']);
});

test('session save with version check via client', async () => {
  await CloudApi.Auth.teacherLogin('krumum.piano@gmail.com', PW);
  const r1 = await CloudApi.Sessions.save('ม.1/1|1', 'ม.1/1', 1, { a: 1 }, 0);
  assert.equal(r1.version, 1);
  await assert.rejects(
    () => CloudApi.Sessions.save('ม.1/1|1', 'ม.1/1', 1, { a: 2 }, 0),
    (e) => e.status === 409 && e.code === 'version_conflict'
  );
});

test('base URL can be overridden in storage (for staging)', () => {
  assert.equal(CloudApi.baseUrl(), 'https://musicsmart-api.krumum-piano.workers.dev');
  globalThis.localStorage.setItem('ppk_cloud_api_base', 'https://staging.example.workers.dev/');
  assert.equal(CloudApi.baseUrl(), 'https://staging.example.workers.dev');
});
