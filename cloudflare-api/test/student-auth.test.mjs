// ทดสอบโหมดคลาวด์ของ StudentAuth (app/js/student-auth.js) กับ Worker จริงในเครื่อง
// รัน: node --test test/student-auth.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import worker from '../src/index.js';

const require = createRequire(import.meta.url);
const CloudApi = require('../../app/js/cloud-api.js');
const { StudentAuth } = require('../../app/js/student-auth.js');

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
  raw.exec(readFileSync(new URL('../migrations/0004_submission_meta.sql', import.meta.url), 'utf8'));
  raw.exec(`INSERT INTO students (student_id, class_name, no, prefix, first_name, last_name, nickname, updated_at) VALUES
    ('90001','ม.1/1',1,'เด็กชาย','ทดสอบหนึ่ง','นามสมมุติ','ทดหนึ่ง','2026-01-01')`);
  return {
    DB: { prepare: (sql) => new Stmt(raw, sql) },
    SESSION_SECRET: 'sa-test-session-secret-0123456789abcd',
    PASSWORD_PEPPER: 'sa-test-pepper-0123456789abcdefghij',
    SETUP_TOKEN: 'sa-setup-token-xyz',
    LEGACY_PIN_PEPPER: LEGACY_PEPPER
  };
}

// อ้างอิงสูตร GAS (hashPin_) แบบอิสระจาก Worker: ใช้ node:crypto ตรงๆ
function gasHashReference(sid, pin, salt, pepper) {
  const value = `${salt}:${sid}:${pin}:${pepper}`;
  let h = '';
  for (let i = 0; i < 100; i++) h = createHash('sha256').update(h + value, 'utf8').digest('hex');
  return h;
}
const LEGACY_PEPPER = 'legacy-pepper-from-apps-script-0123';
const LEGACY_SALT = '6f1c2b9e-1111-4a2b-9c3d-abcdef012345';

// รายชื่อในเครื่องจำลอง (Store) ให้ lookup และเก็บผู้ใช้ปัจจุบัน
function makeStore() {
  const st = { currentUser: null };
  return {
    st,
    isTestStudentId: () => false,
    getStudentById: (id) => (id === '90001'
      ? { student_id: '90001', class: 'ม.1/1', prefix: 'เด็กชาย', first_name: 'ทดสอบหนึ่ง', last_name: 'นามสมมุติ' }
      : null),
    setCurrentUser: (u) => { st.currentUser = u; },
    getStudentAccount: () => null
  };
}

let env;
let store;
const realFetch = globalThis.fetch;

beforeEach(() => {
  env = makeEnv();
  store = makeStore();
  globalThis.Store = store;
  globalThis.CloudApi = CloudApi;
  globalThis.MUSICSMART_USE_CLOUD = true;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.fetch = (url, init) => worker.fetch(new Request(url, init), env);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.Store;
  delete globalThis.CloudApi;
  delete globalThis.MUSICSMART_USE_CLOUD;
  delete globalThis.localStorage;
});

test('isCloudMode เปิดเฉพาะเมื่อ flag เปิด', () => {
  assert.equal(StudentAuth.isCloudMode(), true);
  globalThis.MUSICSMART_USE_CLOUD = false;
  assert.equal(StudentAuth.isCloudMode(), false);
});

test('lookup ในโหมดคลาวด์ ค้นจาก Worker: ชื่อ/ห้อง, สถานะ PIN, และรหัสที่ไม่มี', async () => {
  const before = await StudentAuth.lookup('90001');
  assert.equal(before.success, true);
  assert.equal(before.mode, 'cloud');
  assert.equal(before.studentClass, 'ม.1/1');
  assert.equal(before.displayName, 'ท•••', 'ซ่อนชื่อเหมือนระบบเดิม');
  assert.ok(!before.displayName.includes('นามสมมุติ'), 'ต้องไม่เห็นนามสกุลก่อนล็อกอิน');
  assert.equal(before.hasPin, false, 'ยังไม่เคยตั้ง PIN');

  await StudentAuth.login('90001', '123456');
  const after = await StudentAuth.lookup('90001');
  assert.equal(after.hasPin, true, 'หลังล็อกอินครั้งแรกต้องมี PIN แล้ว');

  const missing = await StudentAuth.lookup('99999');
  assert.equal(missing.success, false);
  assert.equal(missing.code, 'not_found');
});

test('lookup ค้นบ่อยเกินไปจากเครื่องเดียว คืน rate_limited', async () => {
  let last;
  for (let i = 0; i < 61; i++) last = await StudentAuth.lookup('90001');
  assert.equal(last.success, false);
  assert.equal(last.code, 'rate_limited');
});

test('ล็อกอินครั้งแรกด้วย PIN จะตั้ง PIN ให้ และเก็บผู้ใช้ในเครื่อง', async () => {
  const res = await StudentAuth.login('90001', '123456');
  assert.equal(res.success, true, res.message);
  assert.equal(res.mode, 'cloud');
  assert.equal(res.user.role, 'student');
  assert.equal(res.user.studentId, '90001');
  assert.equal(res.user.studentClass, 'ม.1/1');
  assert.equal(res.user.backend, 'cloud');
  assert.ok(res.user.sessionToken, 'ต้องมี token');
  assert.equal(store.st.currentUser.studentId, '90001');
});

test('PIN ผิดคืน wrong_pin และไม่เขียนทับผู้ใช้เดิม', async () => {
  await StudentAuth.login('90001', '123456');
  const before = store.st.currentUser;
  store.st.currentUser = null;
  const res = await StudentAuth.login('90001', '000000');
  assert.equal(res.success, false);
  assert.equal(res.code, 'wrong_pin');
  assert.equal(store.st.currentUser, null);
  assert.ok(before, 'ล็อกอินครั้งแรกต้องสำเร็จ');
});

test('setPin เมื่อมี PIN อยู่แล้วและไม่ตรง คืน pin_exists', async () => {
  await StudentAuth.login('90001', '123456');
  const res = await StudentAuth.setPin('90001', '654321');
  assert.equal(res.success, false);
  assert.equal(res.code, 'pin_exists');
});

test('PIN ผิดหลายครั้งจนถูกล็อก คืน rate_limited', async () => {
  await StudentAuth.login('90001', '123456');
  let last;
  for (let i = 0; i < 6; i++) last = await StudentAuth.login('90001', '000000');
  assert.equal(last.success, false);
  assert.equal(last.code, 'rate_limited');
});

test('PIN ที่ไม่ใช่ตัวเลข 6 หลัก ไม่ส่งไปเซิร์ฟเวอร์', async () => {
  const res = await StudentAuth.login('90001', '12ab');
  assert.equal(res.code, 'bad_pin');
});

test('เครือข่ายล้มเหลวคืน network', async () => {
  globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  const res = await StudentAuth.login('90001', '123456');
  assert.equal(res.success, false);
  assert.equal(res.code, 'network');
});

// ---------- PIN เดิมจาก Google Sheet ----------
async function setLegacyPin(sid, pin) {
  const h = gasHashReference(sid, pin, LEGACY_SALT, LEGACY_PEPPER);
  await env.DB.prepare("UPDATE students SET pin_hash = ?, pin_scheme = 'gas-sha256x100', pin_salt = ? WHERE student_id = ?")
    .bind(h, LEGACY_SALT, sid)
    .run();
}

async function studentRow(sid) {
  return env.DB.prepare('SELECT pin_scheme, pin_salt, pin_hash FROM students WHERE student_id = ?').bind(sid).first();
}

test('PIN เดิมจาก GAS: ใส่ PIN เดิมได้ แล้วอัปเกรดเป็นสูตรใหม่ และล็อกอินครั้งต่อไปได้ตามปกติ', async () => {
  await setLegacyPin('90001', '246810');
  const res = await StudentAuth.login('90001', '246810');
  assert.equal(res.success, true, res.message);
  assert.equal(res.user.studentId, '90001');
  const row = await studentRow('90001');
  assert.equal(row.pin_scheme, null, 'ต้องล้างสูตรเดิมหลังอัปเกรด');
  assert.equal(row.pin_salt, null);
  assert.ok(String(row.pin_hash).startsWith('hmac-sha256-v1$'));
  const again = await StudentAuth.login('90001', '246810');
  assert.equal(again.success, true, 'ล็อกอินครั้งที่สองด้วยสูตรใหม่');
});

test('PIN เดิมจาก GAS: PIN ผิดคืน wrong_pin และไม่อัปเกรดแถว', async () => {
  await setLegacyPin('90001', '246810');
  const res = await StudentAuth.login('90001', '135791');
  assert.equal(res.success, false);
  assert.equal(res.code, 'wrong_pin');
  const row = await studentRow('90001');
  assert.equal(row.pin_scheme, 'gas-sha256x100');
});

test('PIN เดิมจาก GAS: ถ้ายังไม่ได้ตั้ง LEGACY_PIN_PEPPER จะปฏิเสธ (fail closed)', async () => {
  await setLegacyPin('90001', '246810');
  delete env.LEGACY_PIN_PEPPER;
  const res = await StudentAuth.login('90001', '246810');
  assert.equal(res.success, false);
  assert.equal(res.code, 'wrong_pin');
});
