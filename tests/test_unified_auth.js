const assert = require('assert');
const fs = require('fs');
const path = require('path');

let store = {};
global.window = global;
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');

const Store = require('../app/data/store.js');
global.Store = Store;

const { StudentAuth, RoleGuard } = require('../app/js/student-auth.js');
global.StudentAuth = StudentAuth;
global.RoleGuard = RoleGuard;

const { InternRegistration, InternMode } = require('../app/js/intern.js');
global.InternRegistration = InternRegistration;
global.InternMode = InternMode;

// Mock DOM elements for App
global.document = {
  getElementById: (id) => {
    return null;
  }
};

(async () => {
  console.log('=== Test Suite: Unified Teacher & Intern Authentication ===');

  // Test 1: HTML Structure Verification
  console.log('1. Checking HTML structure for removed intern tab and unified teacher tab...');
  const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
  assert(!html.includes('id="auth-tab-intern-btn"'), 'auth-tab-intern-btn must be removed from HTML');
  assert(!html.includes('id="auth-pane-intern"'), 'auth-pane-intern must be removed from HTML');
  assert(html.includes('id="auth-tab-teacher-btn"'), 'auth-tab-teacher-btn must exist');
  assert(html.includes('id="auth-pane-teacher"'), 'auth-pane-teacher must exist');
  assert(html.includes('ครูผู้สอน / นศ.ฝึกสอน'), 'Unified tab header label must reflect both teacher and intern');
  assert(html.includes('ลงทะเบียนนักศึกษาฝึกสอนใหม่'), 'Registration button must be present in unified pane');
  console.log('✅ HTML structure verified: only 2 tabs exist, separate intern tab removed.');

  // Test 2: Teacher Admin Login in Store
  console.log('2. Testing primary teacher admin login in Store...');
  const acc = Store.getTeacherAccount();
  const TEST_PW = 'Throwaway-Test-Pw-2569'; // รหัสทดสอบชั่วคราว (ไม่ใช่รหัสจริง)
  await Store.saveTeacherAccount({ email: acc.email, secret: TEST_PW });
  const teacherLoginRes = await Store.verifyTeacherLogin(acc.email, TEST_PW);
  assert.strictEqual(teacherLoginRes.success, true, 'Teacher login must succeed');
  assert.strictEqual(teacherLoginRes.user.role, 'teacher', 'Teacher role must be "teacher"');
  assert.strictEqual(teacherLoginRes.user.roleCategory, 'mentor', 'Role category must be "mentor"');
  assert.strictEqual(teacherLoginRes.user.isAdmin, true, 'Admin flag must be true');
  console.log('✅ Teacher login correctly identified as role="teacher", mentor.');

  // Test 3: Trainee/Intern Login in Store
  console.log('3. Testing student teacher login in Store...');
  const internRegData = {
    fullName: 'น.ส.ดนตรี ฝึกสอน',
    internId: 'INT66001',
    university: 'มหาวิทยาลัยพะเยา',
    faculty: 'คณะศึกษาศาสตร์',
    major: 'ดนตรีศึกษา',
    phone: '0812345678',
    email: 'intern_music@up.ac.th',
    term: '1',
    academicYear: 2569,
    pin: '246810',
    pin2: '246810',
    preferredClasses: 'ม.1/1, ม.1/2'
  };

  const regRes = await InternRegistration.submit(internRegData);
  assert.strictEqual(regRes.success, true, 'Intern registration must succeed locally');
  assert.strictEqual(regRes.status, 'pending', 'Newly registered intern must start in pending state');

  // Verify that the newly registered intern is blocked while pending
  const pendingLoginRes = await Store.verifyTeacherLogin('INT66001', '246810');
  assert.strictEqual(pendingLoginRes.success, false, 'Pending intern must NOT be able to log in before approval');
  assert.strictEqual(pendingLoginRes.code, 'pending', 'Must return pending code');
  assert(pendingLoginRes.message.includes('รอครูอนุมัติ'), 'Must show รอครูอนุมัติ message');

  // Approve intern and assign classes
  const approveRes = Store.approveTeacher('INT66001', ['ม.1/1', 'ม.1/2']);
  assert.strictEqual(approveRes.success, true, 'Teacher approval must succeed');

  // Verify that the approved intern can now log in via Store.verifyTeacherLogin
  const internLoginRes = await Store.verifyTeacherLogin('INT66001', '246810');
  assert.strictEqual(internLoginRes.success, true, 'Approved intern must be able to log in with internId and PIN');
  assert.strictEqual(internLoginRes.user.role, 'intern', 'Intern must be automatically detected as role="intern"');
  assert.strictEqual(internLoginRes.user.roleCategory, 'trainee', 'Role category must be "trainee"');
  assert.strictEqual(internLoginRes.user.isAdmin, false, 'Intern is not admin');
  assert.deepStrictEqual(internLoginRes.user.classes, ['ม.1/1', 'ม.1/2'], 'Assigned classes must match');
  console.log('✅ Intern login blocked while pending and allowed after teacher approval.');

  // Test 4: Intern Login via email
  const internLoginEmailRes = await Store.verifyTeacherLogin('intern_music@up.ac.th', '246810');
  assert.strictEqual(internLoginEmailRes.success, true, 'Intern must also be able to log in with email');
  assert.strictEqual(internLoginEmailRes.user.role, 'intern');
  console.log('✅ Intern login by email works smoothly.');

  // Test 5: Intern Roster Access (strictly scoped to assigned classes)
  console.log('4. Testing intern roster access restriction when classes empty vs assigned...');
  Store.setCurrentUser({ role: 'intern', name: 'Test Intern', classes: [] });
  const emptyRoster = Store.getRoster();
  assert.strictEqual(Object.keys(emptyRoster).length, 0, 'Roster must be empty before classes are assigned');
  Store.setCurrentUser({ role: 'intern', name: 'Test Intern', classes: ['ม.1/1'] });
  const scopedRoster = Store.getRoster();
  assert.deepStrictEqual(Object.keys(scopedRoster), ['ม.1/1'], 'Intern sees only assigned classes');
  console.log('✅ Intern roster access strictly scoped to assigned classes.');

  // Test 6: RoleGuard Selectors clean
  console.log('5. Checking RoleGuard.TEACHER_ONLY_SELECTORS...');
  assert(!RoleGuard.TEACHER_ONLY_SELECTORS.includes('#auth-tab-intern-btn'));
  assert(!RoleGuard.TEACHER_ONLY_SELECTORS.includes('#auth-pane-intern'));
  console.log('✅ RoleGuard selectors are clean of obsolete IDs.');

  console.log('\n🎉 ALL UNIFIED AUTHENTICATION TESTS PASSED PERFECTLY!');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
