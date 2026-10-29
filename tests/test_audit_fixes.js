// เทสต์ตรวจสอบการแก้ไขบั๊ก 6 ข้อ (Audit Fixes 1–6)
const { PIN_A, PIN_B } = require('./lib/test_pins');
const assert = require('assert');
const { loadGas } = require('./fake_gas');

let memStore = {};
global.window = global;
global.localStorage = {
  getItem: k => (k in memStore ? memStore[k] : null),
  setItem: (k, v) => { memStore[k] = String(v); },
  removeItem: k => { delete memStore[k]; }
};
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
const { ACADEMIC_DOCS, ACADEMIC_DOCS_BY_GRADE } = require('../app/data/academic_docs.js');
global.ACADEMIC_DOCS_BY_GRADE = ACADEMIC_DOCS_BY_GRADE;
global.ACADEMIC_DOCS = ACADEMIC_DOCS;

const Store = require('../app/data/store.js');
global.Store = Store;
const CARAnalytics = require('../app/js/car-analytics.js');
global.CARAnalytics = CARAnalytics;
const RubricMatrix = require('../app/js/rubric-matrix.js');
global.RubricMatrix = RubricMatrix;
const { StudentAuth, RoleGuard } = require('../app/js/student-auth.js');
global.StudentAuth = StudentAuth;
global.RoleGuard = RoleGuard;
const { InternRegistration } = require('../app/js/intern.js');
global.InternRegistration = InternRegistration;
const { StudentOutbox } = require('../app/js/student-submit.js');
global.StudentOutbox = StudentOutbox;

(async () => {
  console.log('=== Test Suite: Audit Fixes (Items 1–6) ===');

  // ---------------------------------------------------------------------------
  // ข้อ 1: ตัวเลขสถิติปลอมใน app/js/car-analytics.js
  // ---------------------------------------------------------------------------
  console.log('1. Testing CARAnalytics no-fake-stats when no data exists...');
  const sampleClass = 'ม.1/1';
  Store.saveResearchScores(sampleClass, {});
  const emptyStats = CARAnalytics.computeStats(sampleClass);
  assert.strictEqual(emptyStats.n, 0, 'Paired N must be 0 when no scores exist');
  assert.strictEqual(emptyStats.hasData, false, 'hasData must be false');
  assert.strictEqual(emptyStats.meanPre, null, 'meanPre must be null');
  assert.strictEqual(emptyStats.sdPre, null, 'sdPre must be null');
  assert.strictEqual(emptyStats.meanPost, null, 'meanPost must be null');
  assert.strictEqual(emptyStats.sdPost, null, 'sdPost must be null');
  assert.strictEqual(emptyStats.meanDiff, null, 'meanDiff must be null');
  assert.strictEqual(emptyStats.tVal, null, 'tVal must be null');
  assert.strictEqual(emptyStats.pVal, null, 'pVal must be null');
  assert.strictEqual(emptyStats.cohensD, null, 'cohensD must be null');
  assert.strictEqual(emptyStats.overallGain, null, 'overallGain must be null');
  assert.strictEqual(emptyStats.e1, null, 'e1 must be null');
  assert.strictEqual(emptyStats.e2, null, 'e2 must be null');
  assert.strictEqual(emptyStats.gainLevel, 'ยังไม่มีข้อมูล', 'gainLevel must be ยังไม่มีข้อมูล');
  emptyStats.students.forEach(st => {
    assert.strictEqual(st.pre, null, 'student pre must be null');
    assert.strictEqual(st.post, null, 'student post must be null');
    assert.strictEqual(st.diff, null, 'student diff must be null');
    assert.strictEqual(st.gain, null, 'student gain must be null');
    assert.strictEqual(st.formative, null, 'student formative must be null');
  });

  // ตรวจสอบการแสดงผล HTML ว่าแสดง "ยังไม่มีข้อมูล" และไม่มี ** หรือ < .001 ปลอม
  const domBox = { innerHTML: '' };
  global.document = {
    getElementById: id => (id === 'car-analytics-display' ? domBox : null),
    querySelectorAll: () => []
  };
  CARAnalytics.activeClass = sampleClass;
  CARAnalytics.renderAnalytics();
  assert(domBox.innerHTML.includes('ยังไม่มีข้อมูล'), 'Rendered analytics must display ยังไม่มีข้อมูล');
  assert(!domBox.innerHTML.includes('&lt; .001'), 'Rendered analytics must NOT hardcode < .001 when no data');
  assert(!domBox.innerHTML.includes('null**'), 'Rendered analytics must NOT show null**');

  const fullReportEmpty = CARAnalytics.buildFullReportHTML(sampleClass);
  assert(fullReportEmpty.includes('ยังไม่มีข้อมูล'), 'Full report must display ยังไม่มีข้อมูล when no data');
  assert(!fullReportEmpty.includes('&lt; .001'), 'Full report must NOT hardcode < .001 when no data');

  // ทดสอบเมื่อมีข้อมูลจริงของนักเรียน 3 คน
  const clsStudents = Store.getStudents(sampleClass);
  Store.saveStudentResearchScore(sampleClass, clsStudents[0].student_id, 4, 8, 8.5);
  Store.saveStudentResearchScore(sampleClass, clsStudents[1].student_id, 5, 9, 9.0);
  Store.saveStudentResearchScore(sampleClass, clsStudents[2].student_id, 3, 8, 8.0);
  const realStats = CARAnalytics.computeStats(sampleClass);
  assert.strictEqual(realStats.n, 3, 'Paired N must equal 3 students with real data');
  assert.strictEqual(realStats.meanPre, 4, 'meanPre must be 4');
  assert.strictEqual(realStats.meanPost, 8.33, 'meanPost must be 8.33');
  assert(realStats.tVal > 0, 'tVal must be computed from real paired data');
  assert(realStats.pVal > 0 && realStats.pVal < 0.05, 'pVal must be computed dynamically');
  assert(realStats.cohensD > 0, 'cohensD must be computed dynamically');
  Store.saveResearchScores(sampleClass, {});
  console.log('PASS Fix 1: CARAnalytics uses only real data and returns null / "ยังไม่มีข้อมูล" when missing.');

  // ---------------------------------------------------------------------------
  // ข้อ 2: นักศึกษาฝึกสอนที่ยังรออนุมัติ และบัญชี kouocking@gmail.com
  // ---------------------------------------------------------------------------
  console.log('2. Testing pending intern & kouocking@gmail.com restrictions...');
  // 2.1 kouocking@gmail.com ต้องตั้งรหัสและเข้าใช้ไม่ได้ก่อนครูอนุมัติ
  const kou = Store.getTeacherByEmail('kouocking@gmail.com');
  assert(kou, 'kouocking@gmail.com must exist in default list');
  assert.strictEqual(Store.isTeacherApproved(kou), false, 'kouocking@gmail.com must NOT be approved by default');

  const kouLoginBefore = await Store.verifyTeacherLogin('kouocking@gmail.com', '');
  assert.strictEqual(kouLoginBefore.success, false, 'kouocking@gmail.com must not bypass approval on login');
  assert.strictEqual(kouLoginBefore.code, 'pending', 'kouocking@gmail.com must return pending code');

  const kouSetupBefore = await Store.completeTeacherFirstTimeSetup(kou.id, { name: 'นศ. ทดสอบ', secret: 'NewPass#2569' });
  assert.strictEqual(kouSetupBefore.success, false, 'completeTeacherFirstTimeSetup must block unapproved kouocking@gmail.com');
  assert.strictEqual(kouSetupBefore.code, 'pending');

  // เมื่อครูอนุมัติแล้วจึงจะตั้งรหัสครั้งแรกได้ และเห็นเฉพาะห้องที่ได้รับมอบหมาย
  Store.approveTeacher('kouocking@gmail.com', ['ม.1/2']);
  const kouLoginAfterApprove = await Store.verifyTeacherLogin('kouocking@gmail.com', '');
  assert.strictEqual(kouLoginAfterApprove.success, true, 'Approved kouocking@gmail.com can proceed to first-time setup');
  assert.strictEqual(kouLoginAfterApprove.needsSetup, true);
  const kouSetupAfter = await Store.completeTeacherFirstTimeSetup(kou.id, { name: 'นศ. ทดสอบ', secret: 'NewPass#2569' });
  assert.strictEqual(kouSetupAfter.success, true, 'Approved kouocking@gmail.com can set password');
  assert.deepStrictEqual(kouSetupAfter.user.classes, ['ม.1/2'], 'Classes must match only teacher-assigned classes');

  // 2.2 ทดสอบนักศึกษาสมัครใหม่ (InternRegistration.submit) -> ต้องเป็น pending เข้าไม่ได้จนกว่าจะอนุมัติ
  const reg = await InternRegistration.submit({
    fullName: 'นายทดสอบ รออนุมัติ',
    internId: 'INT67999',
    university: 'มหาวิทยาลัยพะเยา',
    faculty: 'วิทยาลัยการศึกษา',
    major: 'ดนตรีศึกษา',
    phone: '0891234567',
    email: 'pending_intern@up.ac.th',
    term: '1',
    academicYear: 2569,
    pin: PIN_B,
    pin2: PIN_B,
    preferredClasses: 'ม.1/1'
  });
  assert.strictEqual(reg.success, true);
  assert.strictEqual(reg.status, 'pending');

  const pendingCheck = await Store.verifyTeacherLogin('INT67999', PIN_B);
  assert.strictEqual(pendingCheck.success, false, 'Pending intern cannot log in');
  assert.strictEqual(pendingCheck.code, 'pending');
  assert(pendingCheck.message.includes('รอครูอนุมัติ'));
  console.log('PASS Fix 2: Pending intern & kouocking@gmail.com blocked until teacher approval.');

  // ---------------------------------------------------------------------------
  // ข้อ 3: สิทธิ์รูปโปรไฟล์ใน google_apps_script.js
  // ---------------------------------------------------------------------------
  console.log('3. Testing uploadProfileAvatar_ and fetchProfileAvatars_ auth & scoping...');
  const gas = loadGas({ SYNC_TOKEN: 'TEACHER_SYNC_SECRET_1234567890' });
  gas.call({
    action: 'upload_roster',
    token: 'TEACHER_SYNC_SECRET_1234567890',
    replace: true,
    students: [
      { student_id: '30001', prefix: 'ด.ช.', first_name: 'เอก', last_name: 'ใจดี', class: 'ม.1/1', no: 1 },
      { student_id: '30002', prefix: 'ด.ญ.', first_name: 'โท', last_name: 'ตั้งใจ', class: 'ม.1/2', no: 2 }
    ]
  });
  const s1Pin = gas.call({ action: 'studentSetPin', studentId: '30001', pin: '147258' });
  const s2Pin = gas.call({ action: 'studentSetPin', studentId: '30002', pin: '258369' });
  assert.strictEqual(s1Pin.status, 'success');
  assert.strictEqual(s2Pin.status, 'success');

  // JPEG magic bytes (FF D8 FF E0 ...)
  const validJpegBytes = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]), Buffer.alloc(64, 0x11)]);
  const validJpegB64 = validJpegBytes.toString('base64');
  const validThumb = 'data:image/jpeg;base64,' + validJpegB64;

  // 3.1 ไม่มีโทเคน -> ต้องถูกปฏิเสธทั้ง upload และ fetch
  const unauthUp = gas.call({
    action: 'uploadProfileAvatar',
    targetKey: 'student_30001',
    role: 'student',
    ownerId: '30001',
    mimeType: 'image/jpeg',
    base64Data: validJpegB64,
    thumbDataUrl: validThumb
  });
  assert.strictEqual(unauthUp.status, 'error');
  assert.strictEqual(unauthUp.code, 'unauthorized');

  const unauthFetch = gas.call({ action: 'fetchProfileAvatars' });
  assert.strictEqual(unauthFetch.status, 'error');
  assert.strictEqual(unauthFetch.code, 'unauthorized');

  // 3.2 นักเรียน 30001 พยายามอัปโหลดรูปของนักเรียน 30002 หรือของครู -> ต้องถูกปฏิเสธ
  const crossUp = gas.call({
    action: 'uploadProfileAvatar',
    sessionToken: s1Pin.sessionToken,
    targetKey: 'student_30002',
    role: 'student',
    ownerId: '30002',
    mimeType: 'image/jpeg',
    base64Data: validJpegB64,
    thumbDataUrl: validThumb
  });
  assert.strictEqual(crossUp.status, 'error');
  assert.strictEqual(crossUp.code, 'forbidden');

  const spoofTeacherUp = gas.call({
    action: 'uploadProfileAvatar',
    sessionToken: s1Pin.sessionToken,
    targetKey: 'teacher_admin_primary',
    role: 'teacher',
    ownerId: 'admin_primary',
    mimeType: 'image/jpeg',
    base64Data: validJpegB64,
    thumbDataUrl: validThumb
  });
  assert.strictEqual(spoofTeacherUp.status, 'error');
  assert.strictEqual(spoofTeacherUp.code, 'forbidden');

  // 3.3 ชนิดไฟล์ไม่ถูกต้อง / magic bytes ไม่ตรง / ขนาดเกินกำหนด -> ต้องถูกปฏิเสธ
  const badMimeUp = gas.call({
    action: 'uploadProfileAvatar',
    sessionToken: s1Pin.sessionToken,
    targetKey: 'student_30001',
    role: 'student',
    ownerId: '30001',
    mimeType: 'application/pdf',
    base64Data: validJpegB64
  });
  assert.strictEqual(badMimeUp.status, 'error');
  assert.strictEqual(badMimeUp.code, 'bad_type');

  const badMagicUp = gas.call({
    action: 'uploadProfileAvatar',
    sessionToken: s1Pin.sessionToken,
    targetKey: 'student_30001',
    role: 'student',
    ownerId: '30001',
    mimeType: 'image/png',
    base64Data: validJpegB64
  });
  assert.strictEqual(badMagicUp.status, 'error');
  assert.strictEqual(badMagicUp.code, 'bad_type');

  // 3.4 นักเรียน 30001 และ 30002 อัปโหลดรูปตัวเอง และครูอัปโหลดรูปครูด้วย SYNC_TOKEN
  const okS1 = gas.call({
    action: 'uploadProfileAvatar',
    sessionToken: s1Pin.sessionToken,
    targetKey: 'student_30001',
    role: 'student',
    ownerId: '30001',
    mimeType: 'image/jpeg',
    base64Data: validJpegB64,
    thumbDataUrl: validThumb
  });
  assert.strictEqual(okS1.status, 'success');

  const okS2 = gas.call({
    action: 'uploadProfileAvatar',
    sessionToken: s2Pin.sessionToken,
    targetKey: 'student_30002',
    role: 'student',
    ownerId: '30002',
    mimeType: 'image/jpeg',
    base64Data: validJpegB64,
    thumbDataUrl: validThumb
  });
  assert.strictEqual(okS2.status, 'success');

  const okTeacher = gas.call({
    action: 'uploadProfileAvatar',
    token: 'TEACHER_SYNC_SECRET_1234567890',
    targetKey: 'teacher_admin_primary',
    role: 'teacher',
    ownerId: 'admin_primary',
    mimeType: 'image/jpeg',
    base64Data: validJpegB64,
    thumbDataUrl: validThumb
  });
  assert.strictEqual(okTeacher.status, 'success');

  // 3.5 นักเรียน 30001 ดึงรูป -> ต้องเห็นเฉพาะรูปตัวเองและรูปครู ไม่เห็นรูปของ 30002
  const s1Fetch = gas.call({ action: 'fetchProfileAvatars', sessionToken: s1Pin.sessionToken });
  assert.strictEqual(s1Fetch.status, 'success');
  assert(s1Fetch.avatars['student_30001'], 'Student 1 sees own avatar');
  assert(s1Fetch.avatars['teacher_admin_primary'], 'Student 1 sees teacher avatar');
  assert(!s1Fetch.avatars['student_30002'], 'Student 1 must NOT see Student 2 avatar');

  // ครูดึงรูป -> เห็นครบทั้งหมด
  const tFetch = gas.call({ action: 'fetchProfileAvatars', token: 'TEACHER_SYNC_SECRET_1234567890' });
  assert.strictEqual(tFetch.status, 'success');
  assert(tFetch.avatars['student_30001'] && tFetch.avatars['student_30002'] && tFetch.avatars['teacher_admin_primary']);
  console.log('PASS Fix 3: Avatar upload/fetch enforces token auth, file validation, and visibility scoping.');

  // ---------------------------------------------------------------------------
  // ข้อ 4: tryLock ไม่เช็กผล
  // ---------------------------------------------------------------------------
  console.log('4. Testing LockService.tryLock busy handling...');
  const relBefore = gas.lock.released;
  gas.lock.busy = true;

  const busyPing = gas.call({ action: 'ping', token: 'TEACHER_SYNC_SECRET_1234567890' });
  assert.strictEqual(busyPing.status, 'error');
  assert.strictEqual(busyPing.message, 'ระบบกำลังยุ่ง ลองใหม่อีกครั้ง');
  assert.strictEqual(gas.lock.released, relBefore, 'releaseLock must NOT be called when lock was not acquired');

  const busyUpload = gas.call({
    action: 'studentUploadStart',
    sessionToken: s1Pin.sessionToken,
    uploadId: 'up_busy_test_1',
    fileName: 'test.mp3',
    mimeType: 'audio/mpeg',
    size: 1024,
    period: 1
  });
  assert.strictEqual(busyUpload.status, 'error');
  assert.strictEqual(busyUpload.message, 'ระบบกำลังยุ่ง ลองใหม่อีกครั้ง');
  assert.strictEqual(gas.lock.released, relBefore, 'ulock.releaseLock must NOT be called when ulock was not acquired');

  gas.lock.busy = false;
  const okPing = gas.call({ action: 'ping', token: 'TEACHER_SYNC_SECRET_1234567890' });
  assert.strictEqual(okPing.status, 'success');
  assert.strictEqual(gas.lock.released, relBefore + 1, 'releaseLock must be called when lock is acquired');
  console.log('PASS Fix 4: tryLock return value checked and releaseLock guarded.');

  // ---------------------------------------------------------------------------
  // ข้อ 5: ส่งแบบทดสอบซ้ำ (studentSubmit_ และ uploadFinish_)
  // ---------------------------------------------------------------------------
  console.log('5. Testing duplicate official quiz & exam upload prevention + teacher retake grant...');
  gas.call({
    action: 'upload_quiz_bank',
    token: 'TEACHER_SYNC_SECRET_1234567890',
    units: [{
      unit_no: 1,
      title: 'หน่วยที่ 1',
      questions: [
        { id: 'q1', question: 'โด คือตัวโน้ตใด', choices: [{ key: 'A', text: 'C' }, { key: 'B', text: 'D' }], correct: 'A' },
        { id: 'q2', question: 'เร คือตัวโน้ตใด', choices: [{ key: 'A', text: 'C' }, { key: 'B', text: 'D' }], correct: 'B' }
      ]
    }]
  });

  // ส่งแบบทดสอบทางการครั้งแรก (practice: false) -> สำเร็จ
  const firstQuiz = gas.call({
    action: 'studentSubmit',
    sessionToken: s1Pin.sessionToken,
    items: [{
      clientId: 'quiz_u1_attempt1',
      kind: 'quiz_answers',
      data: { unitNo: 1, practice: false, answers: { q1: 'A', q2: 'B' }, timeSpentSeconds: 30 }
    }]
  });
  assert.strictEqual(firstQuiz.status, 'success');
  assert.deepStrictEqual(firstQuiz.accepted, ['quiz_u1_attempt1']);

  // ส่งแบบทดสอบทางการซ้ำด้วย clientId ใหม่ (practice: false) -> ต้องถูกปฏิเสธด้วย duplicate_quiz
  const secondQuiz = gas.call({
    action: 'studentSubmit',
    sessionToken: s1Pin.sessionToken,
    items: [{
      clientId: 'quiz_u1_attempt2',
      kind: 'quiz_answers',
      data: { unitNo: 1, practice: false, answers: { q1: 'A', q2: 'A' }, timeSpentSeconds: 20 }
    }]
  });
  assert.strictEqual(secondQuiz.status, 'success');
  assert.strictEqual(secondQuiz.accepted.length, 0);
  assert.strictEqual(secondQuiz.rejected.length, 1);
  assert.strictEqual(secondQuiz.rejected[0].reason, 'duplicate_quiz');
  assert(StudentOutbox.reasonText('duplicate_quiz').includes('ส่งแบบทดสอบ'));

  // แบบฝึกทบทวนไม่นับคะแนน (practice: true) ยังทำซ้ำได้ปกติ
  const practiceQuiz = gas.call({
    action: 'studentSubmit',
    sessionToken: s1Pin.sessionToken,
    items: [{
      clientId: 'quiz_u1_practice_1',
      kind: 'quiz_answers',
      data: { unitNo: 1, practice: true, answers: { q1: 'A', q2: 'B' }, timeSpentSeconds: 15 }
    }]
  });
  assert.deepStrictEqual(practiceQuiz.accepted, ['quiz_u1_practice_1']);

  // เมื่อครูอนุญาตให้สอบซ่อม (exam_grant_retake) นักเรียนจะส่งใหม่ได้อีก 1 ครั้ง
  const grantRes = gas.call({
    action: 'exam_grant_retake',
    token: 'TEACHER_SYNC_SECRET_1234567890',
    studentId: '30001',
    unitNo: 1,
    extra: 1
  });
  assert.strictEqual(grantRes.status, 'success');

  const retakeQuiz = gas.call({
    action: 'studentSubmit',
    sessionToken: s1Pin.sessionToken,
    items: [{
      clientId: 'quiz_u1_attempt2_after_grant',
      kind: 'quiz_answers',
      data: { unitNo: 1, practice: false, answers: { q1: 'A', q2: 'B' }, timeSpentSeconds: 25 }
    }]
  });
  assert.deepStrictEqual(retakeQuiz.accepted, ['quiz_u1_attempt2_after_grant']);

  // ทดสอบ uploadFinish_ สำหรับ purpose='quiz' คาบที่ส่งไปแล้ว -> ต้องถูกปฏิเสธด้วย duplicate_quiz
  const pdfBytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(32, 0x20)]);
  const upStart = gas.call({
    action: 'studentUploadStart',
    sessionToken: s1Pin.sessionToken,
    uploadId: 'quiz_file_p1_dup',
    fileName: 'exam.pdf',
    mimeType: 'application/pdf',
    size: pdfBytes.length,
    period: 1,
    purpose: 'quiz'
  });
  assert.strictEqual(upStart.status, 'success');
  const upChunk = gas.call({
    action: 'studentUploadChunk',
    sessionToken: s1Pin.sessionToken,
    uploadId: 'quiz_file_p1_dup',
    index: 0,
    data: pdfBytes.toString('base64')
  });
  assert.strictEqual(upChunk.status, 'success');
  const upFin = gas.call({
    action: 'studentUploadFinish',
    sessionToken: s1Pin.sessionToken,
    uploadId: 'quiz_file_p1_dup'
  });
  assert.strictEqual(upFin.status, 'error');
  assert.strictEqual(upFin.code, 'duplicate_quiz');
  console.log('PASS Fix 5: Duplicate official quiz/exam blocked in studentSubmit_ and uploadFinish_ unless granted retake.');

  // ---------------------------------------------------------------------------
  // ข้อ 6: คำนวณ unitNo ให้ตรงกันทุกจุด (คาบ 1–7 = หน่วย 1)
  // ---------------------------------------------------------------------------
  console.log('6. Testing unified unitNo calculation across Store, App, and RubricMatrix...');
  for (let p = 1; p <= 7; p++) {
    assert.strictEqual(Store.getUnitNoForPeriod('M1', p), 1, `Period ${p} must be Unit 1`);
    assert.strictEqual(Store.getUnitNoForPeriod('ม.1/1', p), 1, `Class ม.1/1 Period ${p} must be Unit 1`);
    const rub = RubricMatrix.getRubricForPeriod(p, 'M1');
    assert(rub && rub.doc_no === 1, `RubricMatrix for Period ${p} must map to Unit 1 (doc_no 1), got ${rub && rub.doc_no}`);
  }
  for (let p = 8; p <= 11; p++) {
    assert.strictEqual(Store.getUnitNoForPeriod('M1', p), 2, `Period ${p} must be Unit 2`);
  }
  for (let p = 12; p <= 15; p++) {
    assert.strictEqual(Store.getUnitNoForPeriod('M1', p), 3, `Period ${p} must be Unit 3`);
  }
  for (let p = 16; p <= 20; p++) {
    assert.strictEqual(Store.getUnitNoForPeriod('M1', p), 4, `Period ${p} must be Unit 4`);
  }
  console.log('PASS Fix 6: unitNo calculation unified for periods 1–20 across Store, App, and RubricMatrix.');

  console.log('\nALL 6 AUDIT FIX TESTS PASSED!');
})().catch(err => {
  console.error('FAILED test_audit_fixes:', err);
  process.exit(1);
});
