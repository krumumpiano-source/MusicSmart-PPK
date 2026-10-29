// Phase 6: server-side teacher password + reset, intern self-registration with approval. Sample data only.
const { PIN_A, PIN_B } = require('./lib/test_pins');
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T-sample-token' });
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
let offline = false;
global.fetch = async (url, opts) => { if (offline) throw new TypeError('Failed to fetch'); const reply = gas.call(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => reply }; };
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
global.StudentAuth = require('../app/js/student-auth.js').StudentAuth;
Object.assign(global, require('../app/js/student-submit.js'));
const { TeacherAuth } = require('../app/js/teacher-auth.js');
const I = require('../app/js/intern.js'); global.InternMode = I.InternMode;
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';
global.MUSICSMART_PUBLIC_API_URL = API;
const EMAIL = 'teacher.sample@example.com';
const PW = 'Sample-Pass-2569';
const LEGACY_PW = 'Throwaway-Local-Pw-1'; // รหัสทดสอบชั่วคราว (ไม่ใช่รหัสจริง)

const runScript = (args) => new Promise(res => execFile(process.execPath, [path.join(__dirname, '../tools/set_teacher_password.js'), ...args], { timeout: 20000 }, (err, stdout, stderr) => res({ code: err ? err.code : 0, out: stdout + stderr })));

(async () => {
  // ---------- teacher: before configured -> legacy local login still works (no lock-out)
  assert.strictEqual(gas.call({ action: 'teacherAuthStatus' }).configured, false);
  assert.strictEqual(gas.call({ action: 'teacherLogin', email: EMAIL, password: PW }).code, 'not_configured');
  const acc = Store.getTeacherAccount();
  await Store.saveTeacherAccount({ email: acc.email, secret: LEGACY_PW });
  assert(!JSON.stringify(store).includes(LEGACY_PW), 'teacher password is not stored as plaintext');
  let r = await TeacherAuth.login(acc.email, LEGACY_PW);
  assert(r.success && r.notice, 'legacy fallback while server not configured');

  // ---------- set password: token required, weak rejected, no plaintext stored
  assert.strictEqual(gas.call({ action: 'teacher_set_password', email: EMAIL, password: PW }).status, 'error');
  assert.strictEqual(gas.call({ action: 'teacher_set_password', token: 'wrong', email: EMAIL, password: PW }).message, 'unauthorized');
  assert.strictEqual(gas.call({ action: 'teacher_set_password', token: 'T-sample-token', email: EMAIL, password: 'short' }).code, 'weak_password');
  assert.strictEqual(gas.call({ action: 'teacher_set_password', token: 'T-sample-token', email: EMAIL, password: 'password123' }).code, 'weak_password');

  // PC script against a local HTTP wrapper around the fake server (password from file, never echoed)
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(gas.callRaw(b))); }); });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mst-'));
  fs.writeFileSync(path.join(tmp, 'token.txt'), 'T-sample-token\r\n');
  fs.writeFileSync(path.join(tmp, 'pw.txt'), PW + '\n');
  const bad = await runScript(['--url', `http://127.0.0.1:${srv.address().port}/x`, '--token-file', path.join(tmp, 'token.txt'), '--email', EMAIL, '--password-file', path.join(tmp, 'pw.txt')]);
  assert.notStrictEqual(bad.code, 0, 'script refuses non Apps Script URL');
  // run script logic with a mocked fetch by preloading (URL check satisfied)
  const pre = path.join(tmp, 'pre.js');
  fs.writeFileSync(pre, `const real=global.fetch;global.fetch=(u,o)=>real('http://127.0.0.1:${srv.address().port}/exec',o);`);
  const ok = await new Promise(res => execFile(process.execPath, ['-r', pre, path.join(__dirname, '../tools/set_teacher_password.js'), '--url', API, '--token-file', path.join(tmp, 'token.txt'), '--email', EMAIL.toUpperCase(), '--name', 'ครูตัวอย่าง', '--password-file', path.join(tmp, 'pw.txt')], (err, so, se) => res({ code: err ? err.code : 0, out: so + se })));
  assert.strictEqual(ok.code, 0, ok.out);
  assert(/✅/.test(ok.out) && !ok.out.includes(PW) && !ok.out.includes('T-sample-token'), 'script output has no secrets');
  fs.writeFileSync(path.join(tmp, 'token.txt'), 'nope');
  const wrongTok = await new Promise(res => execFile(process.execPath, ['-r', pre, path.join(__dirname, '../tools/set_teacher_password.js'), '--url', API, '--token-file', path.join(tmp, 'token.txt'), '--email', EMAIL, '--password-file', path.join(tmp, 'pw.txt')], (err, so, se) => res({ code: err ? err.code : 0, out: so + se })));
  assert.notStrictEqual(wrongTok.code, 0); assert(/SYNC_TOKEN ไม่ถูกต้อง/.test(wrongTok.out));
  srv.close(); fs.rmSync(tmp, { recursive: true });
  const stored = gas.props.TEACHER_AUTH;
  assert(stored && !stored.includes(PW), 'only hash stored'); assert.strictEqual(JSON.parse(stored).email, EMAIL);
  assert.strictEqual(gas.call({ action: 'teacherAuthStatus' }).configured, true);

  // ---------- server login
  r = gas.call({ action: 'teacherLogin', email: ' Teacher.Sample@Example.com ', password: PW });
  assert.strictEqual(r.status, 'success'); assert.strictEqual(r.syncToken, 'T-sample-token'); assert.strictEqual(r.name, 'ครูตัวอย่าง');
  for (let i = 0; i < 5; i++) assert.strictEqual(gas.call({ action: 'teacherLogin', email: EMAIL, password: 'bad' + i }).code, 'wrong_password');
  assert.strictEqual(gas.call({ action: 'teacherLogin', email: EMAIL, password: PW }).code, 'locked', 'lock after 5 fails');
  const t = JSON.parse(gas.props.TEACHER_AUTH); t.locked_until = 0; gas.props.TEACHER_AUTH = JSON.stringify(t);

  // ---------- client: server login configures device, legacy default disabled afterwards
  store = {}; Store._cache.clear();
  r = await TeacherAuth.login(acc.email, LEGACY_PW);
  assert.strictEqual(r.success, false, 'public default password no longer works once server configured');
  r = await TeacherAuth.login(EMAIL, PW);
  assert(r.success); assert.strictEqual(Store.getCurrentUser().role, 'teacher');
  assert.strictEqual(GoogleSheetSync.getConfig().syncToken, 'T-sample-token'); assert.strictEqual(GoogleSheetSync.getConfig().webAppUrl, API);
  assert(!JSON.stringify(store).includes(PW), 'no plaintext password on device');
  // offline: cached verifier works, wrong password and the legacy default do not
  offline = true;
  assert((await TeacherAuth.login(EMAIL, PW)).offline);
  assert.strictEqual((await TeacherAuth.login(EMAIL, 'wrong-pass')).success, false);
  assert.strictEqual((await TeacherAuth.login(acc.email, LEGACY_PW)).success, false);
  offline = false;
  // forgot-password flow with SYNC_TOKEN
  assert.strictEqual((await TeacherAuth.resetWithToken('nope', EMAIL, 'Another-Pass-1')).success, false);
  assert((await TeacherAuth.resetWithToken('T-sample-token', EMAIL, 'Another-Pass-1')).success);
  assert.strictEqual((await TeacherAuth.login(EMAIL, PW)).success, false);
  assert((await TeacherAuth.login(EMAIL, 'Another-Pass-1')).success);

  // ---------- intern self-registration
  const reg = { action: 'internRegister', fullName: 'นายตัวอย่าง ฝึกสอน', internId: 'S6600001', university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'คณะตัวอย่าง', major: 'ดนตรีศึกษา',
    phone: '081-000-0000', email: 'intern.sample@example.com', term: '2', academicYear: 2569, preferredClasses: ['ม.1/1'], mentorName: 'ครูตัวอย่าง', pin: PIN_A };
  r = gas.call(Object.assign({}, reg, { phone: '12', email: 'x', pin: '111111', fullName: 'ก' }));
  assert.strictEqual(r.code, 'invalid'); assert(r.fields.length >= 4);
  assert.strictEqual(gas.call(reg).status, 'success');
  assert.strictEqual(gas.call(reg).code, 'duplicate');
  assert.strictEqual(gas.call({ action: 'internLogin', internId: 'S6600001', pin: PIN_A }).code, 'pending');
  assert.strictEqual(gas.call({ action: 'internLogin', internId: 'S6600001', pin: '999999' }).code, 'wrong_pin', 'status not revealed without correct PIN');
  assert.strictEqual(gas.call({ action: 'internSetPin', internId: 'S6600001', pin: PIN_B }).code, 'pending');
  // client registration validation + submit
  const bad2 = await I.InternRegistration.submit({ fullName: 'คนเดียว', internId: 'x', pin: '123456', pin2: '123456' });
  assert.strictEqual(bad2.success, false);
  const r2 = await I.InternRegistration.submit({ fullName: 'นางสาวสมมุติ ทดลอง', internId: 'S6600002', university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'คณะตัวอย่าง', major: 'ดนตรีศึกษา',
    phone: '0890000000', email: 'intern2.sample@example.com', term: '2', academicYear: '2569', pin: '975310', pin2: '975310' });
  assert(r2.success, r2.message);
  // personal data only to token-holder
  assert.strictEqual(gas.call({ action: 'list_interns' }).status, 'error');
  const list = gas.call({ action: 'list_interns', token: 'T-sample-token' }).interns;
  const p1 = list.find(x => x.internId === 'S6600001');
  assert.deepStrictEqual([p1.status, p1.phone, p1.university, p1.preferred_classes], ['pending', '0810000000', 'มหาวิทยาลัยตัวอย่าง', 'ม.1/1']);
  // decisions
  assert.strictEqual(gas.call({ action: 'decide_intern', token: 'T-sample-token', internId: 'S6600001', approve: true, classes: [] }).code, 'no_classes');
  assert.strictEqual(gas.call({ action: 'decide_intern', internId: 'S6600001', approve: true, classes: ['ม.1/1'] }).status, 'error', 'needs token');
  assert.strictEqual(gas.call({ action: 'decide_intern', token: 'T-sample-token', internId: 'S6600001', approve: true, classes: ['ม.1/1'] }).state, 'approved');
  gas.call({ action: 'decide_intern', token: 'T-sample-token', internId: 'S6600002', approve: false, reason: 'ข้อมูลไม่ครบ (ตัวอย่าง)' });
  r = gas.call({ action: 'internLogin', internId: 'S6600002', pin: '975310' });
  assert.strictEqual(r.code, 'rejected'); assert(/ข้อมูลไม่ครบ/.test(r.message));
  // approved intern: own profile only
  store = {}; Store._cache.clear(); Store._rosterCache = undefined;
  gas.call({ action: 'upload_roster', token: 'T-sample-token', students: Object.values(STUDENTS_DATA).flat(), replace: true });
  store = {}; Store._cache.clear();
  r = await InternMode.login('S6600001', PIN_A);
  assert(r.success);
  const raw = gas.call({ action: 'internLogin', internId: 'S6600001', pin: PIN_A });
  assert.strictEqual(raw.profile.university, 'มหาวิทยาลัยตัวอย่าง'); assert.strictEqual(raw.profile.phone, '0810000000');
  assert(!JSON.stringify(raw).includes('S6600002') && !JSON.stringify(raw).includes('0890000000'), 'no other interns data');
  assert.deepStrictEqual(Store.getCurrentUser().classes, ['ม.1/1']);
  assert(!JSON.stringify(Store.getCurrentUser()).includes('0810000000'), 'phone not kept on device user record');
  const f = gas.call({ action: 'internFetch', sessionToken: raw.sessionToken });
  assert.strictEqual(f.status, 'success'); assert(!JSON.stringify(f).includes('0890000000'));
  // rejected can re-register; then pending again
  assert.strictEqual(gas.call(Object.assign({}, reg, { internId: 'S6600002', email: 'intern2.sample@example.com', pin: '975311' })).status, 'success');
  assert.strictEqual(gas.call({ action: 'internLogin', internId: 'S6600002', pin: '975311' }).code, 'pending');
  // teacher revokes (reject) -> existing token stops working
  gas.call({ action: 'decide_intern', token: 'T-sample-token', internId: 'S6600001', approve: false, reason: 'ตัวอย่าง' });
  assert.strictEqual(gas.call({ action: 'internFetch', sessionToken: raw.sessionToken }).code, 'session_expired');
  gas.call({ action: 'decide_intern', token: 'T-sample-token', internId: 'S6600001', approve: true, classes: ['ม.1/1'] });
  // teacher reset PIN still works -> intern sets a new PIN
  gas.call({ action: 'reset_intern_pin', token: 'T-sample-token', internId: 'S6600001' });
  assert.strictEqual(gas.call({ action: 'internLogin', internId: 'S6600001', pin: PIN_A }).code, 'needs_pin');
  assert.strictEqual(gas.call({ action: 'internSetPin', internId: 'S6600001', pin: '864209' }).status, 'success');
  // registration rate limit
  let limited = false;
  for (let i = 0; i < 25 && !limited; i++) limited = gas.call(Object.assign({}, reg, { internId: 'S67000' + String(i).padStart(2, '0') })).code === 'rate_limited';
  assert(limited, 'registrations rate-limited per hour');
  // nothing personal in public files
  const pub = fs.readFileSync(path.join(__dirname, '../app/js/teacher-auth.js'), 'utf8');
  assert(!/krumum|\bppk\d{4}/.test(pub));
  console.log('phase 6 (teacher server login + intern registration) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
