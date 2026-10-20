// test_e2e_suite.js - Comprehensive End-to-End Verification Suite for MusicSmart
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('='.repeat(70));
console.log('  MusicSmart 360° End-to-End (E2E) Verification Suite');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`);
    failed++;
  }
}

// ----------------------------------------------------
// 1. Mock Browser Environment
// ----------------------------------------------------
const storageData = {};
const mockLocalStorage = {
  getItem: (key) => (key in storageData ? storageData[key] : null),
  setItem: (key, val) => { storageData[key] = String(val); },
  removeItem: (key) => { delete storageData[key]; },
  clear: () => { Object.keys(storageData).forEach(k => delete storageData[k]); },
  key: (i) => Object.keys(storageData)[i] || null,
  get length() { return Object.keys(storageData).length; }
};

global.window = global;
global.localStorage = mockLocalStorage;
global.document = {
  getElementById: (id) => ({
    id,
    value: '',
    innerHTML: '',
    innerText: '',
    textContent: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  }),
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    addEventListener: () => {}
  }),
  querySelector: () => null,
  querySelectorAll: () => []
};
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.location = { href: 'http://localhost:8080/index.html', reload: () => {} };

// ----------------------------------------------------
// 2. Load Core Application Modules
// ----------------------------------------------------
console.log('\n[Phase 1] Loading Application Modules...');

const STUDENTS_DATA = require('./app/data/students.js');
global.STUDENTS_DATA = STUDENTS_DATA;
const totalClasses = Object.keys(STUDENTS_DATA).length;
let totalStudentCount = 0;
Object.values(STUDENTS_DATA).forEach(list => totalStudentCount += list.length);
assert(totalClasses === 16 && totalStudentCount === 610, `Loaded roster: ${totalClasses} classrooms with ${totalStudentCount} active students`);

const LESSONS_DATA = require('./app/data/lessons.js');
global.LESSONS_DATA = LESSONS_DATA;
assert(LESSONS_DATA.M1 && LESSONS_DATA.M2, `Loaded curriculum lesson units: M.1 (${LESSONS_DATA.M1.length} units) and M.2 (${LESSONS_DATA.M2.length} units)`);

const { ACADEMIC_DOCS, ACADEMIC_DOCS_BY_GRADE } = require('./app/data/academic_docs.js');
global.ACADEMIC_DOCS = ACADEMIC_DOCS;
global.ACADEMIC_DOCS_BY_GRADE = ACADEMIC_DOCS_BY_GRADE;
assert(ACADEMIC_DOCS_BY_GRADE.M1 && ACADEMIC_DOCS_BY_GRADE.M2, 'Loaded multi-grade academic standards: M.1 (ศ21102) & M.2 (ศ22102)');

const Store = require('./app/data/store.js');
global.Store = Store;
assert(typeof Store === 'object', 'Store module loaded successfully');

// ----------------------------------------------------
// 3. Test Store Architecture, In-Memory Cache & O(1) Index
// ----------------------------------------------------
console.log('\n[Phase 2] Testing Store Architecture, In-Memory Cache & O(1) Index...');

// Test O(1) Student Lookup
const sampleClass = Object.keys(STUDENTS_DATA)[0];
const sampleStudent = STUDENTS_DATA[sampleClass][0];
const foundStudent = Store.getStudentById(sampleStudent.student_id);
assert(foundStudent && foundStudent.first_name === sampleStudent.first_name, `O(1) Student Index found: ${sampleStudent.prefix}${sampleStudent.first_name} ${sampleStudent.last_name} (${sampleStudent.student_id}) in ${sampleClass}`);

const notFoundStudent = Store.getStudentById('99999999');
assert(notFoundStudent === null, 'O(1) Student Index returns null for non-existent student');

// Test Salted Hash for PIN
const pinHash = Store.hashSecret('123456');
assert(typeof pinHash === 'string' && pinHash.startsWith('sha256_'), `Salted PIN hash computed: ${pinHash.slice(0, 18)}...`);

// Test Brute-Force Rate Limiting
const testIp = 'client_192.168.1.100';
let rateLimitStatus = Store.checkRateLimit(testIp);
assert(rateLimitStatus.allowed === true, 'Rate limiter initially allows login (allowed: true)');

for (let i = 0; i < 5; i++) {
  Store.recordLoginAttempt(testIp, false);
}
rateLimitStatus = Store.checkRateLimit(testIp);
assert(rateLimitStatus.allowed === false, 'Rate limiter locked client out after 5 failed attempts (allowed: false)');

Store.recordLoginAttempt(testIp, true);
rateLimitStatus = Store.checkRateLimit(testIp);
assert(rateLimitStatus.allowed === true, 'Successful login resets rate limiter lock');

// Test In-Memory Cache Read-Through
Store.save('cache_benchmark_key', { subject: 'MusicSmart', score: 100 });
const cachedData = Store.load('cache_benchmark_key');
assert(cachedData && cachedData.subject === 'MusicSmart' && cachedData.score === 100, 'Store.load correctly serves from In-Memory Cache');

// Test Dynamic Keys Extended Backup
Store.save('music_quiz_m1_u1', [{ score: 10 }]);
Store.save('music_feldman_m1_1', [{ step: 4 }]);
Store.save('music_rubric_m1_1', [{ score: 4 }]);
Store.save('ppk_practice_log_m1_1', [{ minutes: 45 }]);
Store.save('ppk_car_research_scores_m1_1', [{ pre: 12, post: 19 }]);

const backupJSON = Store.exportBackupJSON();
assert(typeof backupJSON === 'string' && backupJSON.length > 50, 'Store.exportBackupJSON produces valid JSON string');

const parsedBackup = JSON.parse(backupJSON);
assert(
  parsedBackup.extendedAssessments &&
  parsedBackup.extendedAssessments['music_quiz_m1_u1'] &&
  parsedBackup.extendedAssessments['music_feldman_m1_1'] &&
  parsedBackup.extendedAssessments['music_rubric_m1_1'] &&
  parsedBackup.extendedAssessments['ppk_practice_log_m1_1'] &&
  parsedBackup.extendedAssessments['ppk_car_research_scores_m1_1'],
  'Store.exportBackupJSON captures 100% of dynamic multi-grade evaluation keys'
);

// Test Default Role Security (Must default to 'student' when unauthenticated)
Store.logout();
assert(Store.getActiveRole() === 'student', 'Store.getActiveRole() defaults securely to "student" when not logged in');

// Test Student Forced PIN Registration & Authentication
const regResult = Store.registerStudentPin('35994', '654321');
assert(regResult.success === true && regResult.user && regResult.user.studentId === '35994', 'Store.registerStudentPin registers 6-digit PIN and sets user session');

const loginCorrect = Store.verifyStudentLogin('35994', '654321');
assert(loginCorrect.success === true && loginCorrect.user.role === 'student', 'Store.verifyStudentLogin succeeds with correct PIN');

const loginWrong = Store.verifyStudentLogin('35994', '999999');
assert(loginWrong.success === false, 'Store.verifyStudentLogin rejects incorrect PIN');

// Test Timetable Assignment & Mentor Pedagogical Advice
const assignments = Store.getScheduleAssignments();
assert(assignments && typeof assignments === 'object', 'Store.getScheduleAssignments returns assignments map');
assert(assignments['อังคาร-5'] && assignments['อังคาร-5'].assignRole === 'trainee', 'Default assignment for Tuesday period 5 assigned to trainee');
assert(assignments['อังคาร-5'].mentorAdvice && assignments['อังคาร-5'].mentorAdvice.length > 10, 'Assignment contains mentor pedagogical advice');
assert(assignments['อังคาร-5'].teachingMethod && assignments['อังคาร-5'].teachingMethod.includes('T-PACE'), 'Assignment contains teaching method recommendations');

Store.saveScheduleAssignment('พุธ', 3, {
  className: 'ม.1/6',
  teacherId: 'teacher_kouocking',
  teacherName: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู (เอกดนตรี มพ.)',
  assignRole: 'trainee',
  mentorName: 'นายพงศธร โพธิแก้ว',
  mentorAdvice: 'สังเกตการฟังสำเนียงคาลิมบ้าและฝึกนับจังหวะ 1-2-3-4',
  teachingMethod: 'T-PACE ขั้น 2 Practice',
  focusPoints: 'การตรวจ Dead Tines'
});
const savedWed = Store.getScheduleAssignment('พุธ', 3);
assert(savedWed && savedWed.className === 'ม.1/6' && savedWed.mentorAdvice.includes('สำเนียงคาลิมบ้า'), 'Store.saveScheduleAssignment saved trainee assignment with mentor advice');

const traineeSummary = Store.getTraineeTeachingSummary();
assert(traineeSummary && traineeSummary.traineeCount >= 2, 'Store.getTraineeTeachingSummary correctly aggregates trainee slots');

// ----------------------------------------------------
// 4. Test Feldman Criticism Module
// ----------------------------------------------------
console.log('\n[Phase 3] Testing Feldman Criticism Module...');

const FeldmanCriticism = require('./app/js/feldman-criticism.js');
global.FeldmanCriticism = FeldmanCriticism;
assert(typeof FeldmanCriticism === 'object', 'FeldmanCriticism module loaded successfully');

// Test Submission persistence with dynamic classroom
const mockSubmission = {
  submissionType: 'feldman',
  content: '[ใบวิจารณ์ดนตรี Feldman 4 ขั้น: เพลง Canon in C]\n1. บรรยาย: เสียงกังวานใส\n2. วิเคราะห์: บันไดเสียง C เมเจอร์\n3. ตีความ: อบอุ่น สงบ\n4. ประเมินค่า: พัฒนาการดีเยี่ยม',
  songTitle: 'Canon in C - Kalimba',
  step1_desc: 'เสียงกังวานใส',
  step2_analysis: 'บันไดเสียง C เมเจอร์',
  step3_interp: 'อบอุ่น สงบ',
  step4_eval: 'พัฒนาการดีเยี่ยม'
};

const savedSub = Store.saveStudentSubmission(sampleClass, '1', sampleStudent.student_id, mockSubmission);
assert(savedSub !== null && savedSub.studentId === sampleStudent.student_id, 'Store.saveStudentSubmission saved Feldman analysis successfully');

const studentSubs = Store.getStudentSubmissions(sampleStudent.student_id);
assert(studentSubs.length > 0 && studentSubs.some(s => s.submissionType === 'feldman'), `Store.getStudentSubmissions retrieved student submissions for ${sampleStudent.student_id}`);

const escapedFeldman = FeldmanCriticism.escapeHtml('<script>alert("XSS")</script>');
assert(!escapedFeldman.includes('<script>') && escapedFeldman.includes('&lt;script&gt;'), 'FeldmanCriticism.escapeHtml sanitizes potential XSS');

// ----------------------------------------------------
// 5. Test Rubric Matrix Module
// ----------------------------------------------------
console.log('\n[Phase 4] Testing Rubric Matrix Module...');

const RubricMatrix = require('./app/js/rubric-matrix.js');
global.RubricMatrix = RubricMatrix;
assert(typeof RubricMatrix === 'object', 'RubricMatrix module loaded successfully');

// Verify Grade-Aware document loading for M.1 and M.2
const m1Rubric = RubricMatrix.getRubricForPeriod('1', 'ม.1/1');
const m2Rubric = RubricMatrix.getRubricForPeriod('1', 'ม.2/1');
assert(m1Rubric !== null && m2Rubric !== null, 'RubricMatrix.getRubricForPeriod accurately resolves rubrics for both M.1 and M.2');

// Test Saving Rubric Assessment
const rubricRecord = {
  breakdown: { posture: 4, rhythm: 4, tone: 3, technique: 4 },
  sum: 15,
  maxRaw: 16,
  percentage: 93.75,
  scaledScore: 5,
  updatedAt: new Date().toLocaleString('th-TH')
};
Store.saveStudentRubric(sampleStudent.student_id, '1', rubricRecord);
const retrievedRubric = Store.getStudentRubric(sampleStudent.student_id, '1');
assert(retrievedRubric && retrievedRubric.sum === 15, `Student rubric saved and retrieved: sum=${retrievedRubric.sum}/${retrievedRubric.maxRaw} (scaled=${retrievedRubric.scaledScore})`);

const escapedRubric = RubricMatrix.escapeHtml('<b>bold</b>');
assert(!escapedRubric.includes('<b>') && escapedRubric.includes('&lt;b&gt;'), 'RubricMatrix.escapeHtml sanitizes inputs');

// ----------------------------------------------------
// 6. Test CAR Analytics & Statistics Engine
// ----------------------------------------------------
console.log('\n[Phase 5] Testing CAR Analytics & Classroom Action Research Engine...');

const CARAnalytics = require('./app/js/car-analytics.js');
global.CARAnalytics = CARAnalytics;
assert(typeof CARAnalytics === 'object', 'CARAnalytics module loaded successfully');

// Seed research scores for sample classroom
const sampleClassStudents = STUDENTS_DATA[sampleClass];
sampleClassStudents.forEach((st, idx) => {
  Store.saveStudentResearchScore(sampleClass, st.student_id, {
    pre: 5 + (idx % 3),
    post: 8 + (idx % 3),
    formative: 8
  });
});

const stats = CARAnalytics.computeStats(sampleClass);
assert(stats.n === sampleClassStudents.length, `Classroom sample size N=${stats.n} for ${sampleClass}`);
assert(stats.meanPost >= stats.meanPre, `Mean post-test (${stats.meanPost}) >= pre-test (${stats.meanPre}), diff=+${stats.meanDiff}`);
assert(stats.tVal !== undefined && !Number.isNaN(stats.tVal), `Paired t-test t-value computed: t=${stats.tVal}`);
assert(stats.overallGain !== undefined && !Number.isNaN(stats.overallGain), `Hake's Normalized Gain <g> computed: <g>=${stats.overallGain} (${stats.gainLevel})`);
assert(stats.e1 !== undefined && stats.e2 !== undefined, `Process/Product Efficiency computed: E1=${stats.e1}% / E2=${stats.e2}% (Standard: ${stats.eStandard})`);

// ----------------------------------------------------
// 7. Test Official Forms (ปพ.5 & วก.5)
// ----------------------------------------------------
console.log('\n[Phase 6] Testing Official Forms & Double-Count Prevention...');

const OfficialForms = require('./app/js/official-forms.js');
global.OfficialForms = OfficialForms;
assert(typeof OfficialForms === 'object', 'OfficialForms module loaded successfully');

const ppk5Html = OfficialForms.buildPPK5HTML(sampleClass);
assert(typeof ppk5Html === 'string' && ppk5Html.includes('ปพ.5'), `Generated official ปพ.5 for ${sampleClass}`);
assert(!ppk5Html.includes('NaN'), 'ปพ.5 contains ZERO NaN score values');

const wk5Html = OfficialForms.buildWK5HTML('1');
assert(typeof wk5Html === 'string' && wk5Html.includes('วก.5'), 'Generated official วก.5 post-teaching reflection');
assert(!wk5Html.includes('NaN'), 'วก.5 contains ZERO NaN values');

// ----------------------------------------------------
// 8. Test Live HTTP Server & Index.html DOM Verification
// ----------------------------------------------------
console.log('\n[Phase 7] Testing Live HTTP Server & End-to-End HTML Delivery...');

function verifyHtml(htmlData, cb) {
  assert(htmlData.includes('MusicSmart'), 'Page contains MusicSmart title');
  assert(htmlData.includes('tpace-phase-bar'), 'HTML contains new TPACE Phase Bar (#tpace-phase-bar)');
  assert(htmlData.includes('auth-user-bar'), 'HTML contains User Auth status bar (#auth-user-bar)');
  assert(htmlData.includes('sw.js'), 'HTML registers ServiceWorker (PWA readiness)');
  assert(!htmlData.includes('user-scalable=no'), 'WCAG 2.1 AA Compliance: user-scalable=no removed');
  assert(htmlData.includes('modal-student-pwa-prompt'), 'HTML contains Student PWA Installation Prompt (#modal-student-pwa-prompt)');
  assert(htmlData.includes('auth-student-id-error'), 'HTML contains Student ID Error Container (#auth-student-id-error)');
  assert(htmlData.includes('btn-copy-student-link'), 'HTML contains Teacher Copy Student Link Button (#btn-copy-student-link)');
  assert(htmlData.includes('student-pwa-banner'), 'HTML contains Student Portal PWA Banner (#student-pwa-banner)');
  assert(!htmlData.includes('value="ppk1234"'), 'HTML does NOT leak default teacher password in secret input value');
  assert(htmlData.includes('modal-teaching-assignment'), 'HTML contains Teaching Assignment & Mentoring Guidance Modal (#modal-teaching-assignment)');
  assert(htmlData.includes('assign-mentor-advice'), 'HTML contains Mentor Advice input (#assign-mentor-advice)');
  assert(htmlData.includes('assign-teaching-method'), 'HTML contains Teaching Method input (#assign-teaching-method)');
  assert(htmlData.includes('timetable-mentoring-summary-strip'), 'HTML contains Timetable Mentoring Summary Strip');
  assert(htmlData.includes('cockpit-mentoring-guidance-banner'), 'HTML contains Cockpit Mentoring Guidance Banner');

  console.log('\n' + '='.repeat(70));
  console.log(`  E2E Test Results: \x1b[32m${passed} PASSED\x1b[0m, \x1b[31m${failed} FAILED\x1b[0m`);
  console.log('='.repeat(70) + '\n');

  if (cb) cb();
  process.exit(failed > 0 ? 1 : 0);
}

const server = http.createServer((req, res) => {
  try {
    const filePath = path.join(__dirname, 'app', 'index.html');
    const content = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end(err.message);
  }
});

server.listen(0, () => {
  const port = server.address().port;
  http.get(`http://localhost:${port}/index.html`, (res) => {
    assert(res.statusCode === 200, `HTTP Server responded with status ${res.statusCode} OK`);
    assert(res.headers['content-type'].includes('text/html'), `Content-Type is text/html: ${res.headers['content-type']}`);

    let htmlData = '';
    res.on('data', (chunk) => { htmlData += chunk; });
    res.on('end', () => {
      verifyHtml(htmlData, () => server.close());
    });
  }).on('error', (err) => {
    console.error('HTTP Server request failed:', err.message);
    failed++;
    server.close();
    process.exit(1);
  });
});

