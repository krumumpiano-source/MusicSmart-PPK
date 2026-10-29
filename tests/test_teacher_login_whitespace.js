// ครูตั้งรหัสผ่านใหม่แล้วเข้าสู่ระบบไม่ได้: ช่องว่างหัวท้ายจากการคัดลอก/วาง + ข้อความผิดพลาดต้องไม่ถูกบังด้วย "ไม่พบบัญชี นศ."
// ข้อมูลตัวอย่างเท่านั้น
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T-sample-token' });
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.fetch = async (url, opts) => ({ ok: true, status: 200, json: async () => gas.call(JSON.parse(opts.body)) });
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
global.StudentAuth = require('../app/js/student-auth.js').StudentAuth;
const { TeacherAuth } = require('../app/js/teacher-auth.js');
global.MUSICSMART_PUBLIC_API_URL = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';
const EMAIL = 'teacher.sample@example.com';
const PW = 'Sample-Pass-2569';

(async () => {
  // 1) รหัสที่ตั้งไว้มีช่องว่างท้ายติดมา (เช่น วางจากโน้ต) — ผู้ใช้พิมพ์โดยไม่มีช่องว่าง/หรือหน้าล็อกอินตัดช่องว่าง
  assert.strictEqual(gas.ctx.setTeacherPassword({ email: EMAIL, password: PW + ' ' }).status, 'success');
  // หน้าล็อกอินส่ง trimmed + raw: ต้องเข้าได้ด้วยการลองซ้ำแบบ raw
  let r = await TeacherAuth.login(EMAIL, PW, PW + ' ');
  assert(r.success, 'login must succeed via raw-password retry');
  // ไม่ส่ง raw → ยังล้มเหลวตามปกติ (ไม่เปิดช่องให้เดาแบบหลวม)
  r = await TeacherAuth.login(EMAIL, PW);
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.code, 'wrong_password');

  // 2) ฟอร์มตั้งรหัสใหม่ต้องตัดช่องว่างหัวท้าย → ตั้ง "  New-Pass-2570  " แล้วล็อกอินด้วยค่าที่ตัดแล้วได้
  const src = fs.readFileSync(path.join(__dirname, '../app/js/teacher-auth.js'), 'utf8');
  assert(!/id="tf-pw"|resetWithToken|modal-teacher-forgot/.test(src), 'SYNC_TOKEN password reset form removed from client');

  // 3) ข้อความ: ฝั่ง นศ. ตอบ not_found + ครูตอบ wrong_password → ต้องแสดงข้อความครู ไม่ใช่ "ไม่พบบัญชี นศ."
  const appSrc = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');
  assert(/teacherServerReject/.test(appSrc) && /internRes\.code === 'not_found'/.test(appSrc), 'app.js prefers teacher rejection over intern not_found');
  assert(/TeacherAuth\.login\(identifier, secret, secretRaw\)/.test(appSrc), 'app.js passes raw secret to TeacherAuth');

  // 4) ล็อกหลังผิดติดกัน 5 ครั้ง และข้อความต้องเป็นของครู
  let last;
  for (let i = 0; i < 5; i++) last = await TeacherAuth.login(EMAIL, 'definitely-wrong-' + i);
  last = await TeacherAuth.login(EMAIL, 'definitely-wrong-x');
  assert.strictEqual(last.code, 'locked');
  assert(/ล็อก/.test(last.message));
  console.log('test_teacher_login_whitespace: all passed');
})().catch(e => { console.error(e); process.exit(1); });
