// End-to-end (no network): student phone -> fake Apps Script -> teacher device pull. Sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'teacher-token' });

// one shared localStorage, switched between "phones"
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
let netDown = false; const calls = [];
global.fetch = async (url, opts) => {
  if (netDown) throw new TypeError('Failed to fetch');
  const body = JSON.parse(opts.body); calls.push(body);
  const reply = gas.call(body);
  return { ok: true, status: 200, json: async () => reply };
};
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
const { StudentAuth } = require('../app/js/student-auth.js');
global.StudentAuth = StudentAuth;
const { StudentOutbox, TeacherPull } = require('../app/js/student-submit.js');
global.StudentOutbox = StudentOutbox;
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';

(async () => {
  // --- teacher device: upload sample roster ---
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: 'teacher-token', autoSync: false });
  await StudentAuth.uploadRoster();
  gas.call({ action: 'upload_quiz_bank', token: 'teacher-token', units: [{ unit_no: 2, title: 'หน่วยตัวอย่าง', questions: Array.from({ length: 10 }, (_, i) => ({ id: 'Q2-' + i, question: 'คำถาม ' + i, choices: [{ key: 'ก', text: 'ก' }, { key: 'ค', text: 'ค' }], correct: 'ก' })) }] });
  const teacherStore = store;

  // --- student phone: fresh storage, no roster, no teacher token ---
  store = {}; Store._cache.clear(); Store._studentIndex = null;
  global.MUSICSMART_PUBLIC_API_URL = API;
  let r = await StudentAuth.setPin('90001', '123456');
  assert(r.success && Store.getCurrentUser().sessionToken, 'session token stored on device');
  assert(!StudentOutbox.getItems().length);

  // submit assignment through the normal app path (Store -> GoogleSheetSync -> StudentOutbox)
  Store.saveStudentSubmission('ม.1/1', 3, '90001', { content: 'คำตอบตัวอย่าง', url: 'https://example.com/a', fileBase64: 'data:xxx', fileName: 'x.png' });
  await new Promise(res => setTimeout(res, 20));
  const sentBody = calls.filter(c => c.action === 'studentSubmit').pop();
  assert(sentBody && !sentBody.token, 'student never sends teacher token');
  assert(!JSON.stringify(sentBody).includes('data:xxx'), 'no file payload sent');
  assert.strictEqual(StudentOutbox.statusFor(StudentOutbox.assignmentKey('ม.1/1', 3)).state, 'sent');
  assert.strictEqual(GoogleSheetSync.getOutbox().length, 0, 'teacher outbox unused on student phone');

  // client-scored quiz results are never sent from a student phone
  assert.strictEqual(GoogleSheetSync.syncQuizResult({ unitNo: 2, score: 10, totalQuestions: 10 }), null);
  // offline: queued, failed-will-retry, then sent on retry (idempotent)
  netDown = true;
  StudentOutbox.enqueue('quiz_answers', StudentOutbox.quizKey(2), { unitNo: 2, answers: Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['Q2-' + i, i < 7 ? 'ก' : 'ค'])) });
  await new Promise(res => setTimeout(res, 20));
  const qk = StudentOutbox.quizKey(2);
  assert.strictEqual(StudentOutbox.statusFor(qk).state, 'failed'); assert.strictEqual(StudentOutbox.getItems().length, 1);
  assert(/ลองใหม่/.test(StudentOutbox.statusFor(qk).label));
  netDown = false;
  const cid = StudentOutbox.getItems()[0].clientId;
  await StudentOutbox.flush();
  assert.strictEqual(StudentOutbox.statusFor(qk).state, 'sent'); assert.strictEqual(StudentOutbox.getItems().length, 0);
  // simulate a retry of an already-delivered item (lost reply): duplicate counts as sent
  assert.strictEqual(StudentOutbox.statusFor(qk).result.score, 7, 'score from server');
  StudentOutbox.saveItems([{ clientId: cid, kind: 'quiz_answers', taskKey: qk, data: { unitNo: 2, answers: {} } }]);
  await StudentOutbox.flush();
  assert.strictEqual(StudentOutbox.getItems().length, 0);
  assert.strictEqual(gas.sheets['นักเรียนส่งงาน_Inbox']._data().filter(x => x[2] === cid).length, 1, 'stored once');

  // invalid data -> permanent failure shown
  StudentOutbox.enqueue('assignment', StudentOutbox.assignmentKey('ม.1/1', 4), { period: 4, content: '', url: 'ftp://bad' });
  await new Promise(res => setTimeout(res, 20));
  const bad = StudentOutbox.statusFor(StudentOutbox.assignmentKey('ม.1/1', 4));
  assert.strictEqual(bad.state, 'failed'); assert(/ส่งไม่สำเร็จ/.test(bad.label));

  // session expiry: queue kept, PIN asked again, then delivered
  const u = Store.getCurrentUser(); Store.setCurrentUser(Object.assign({}, u, { sessionExp: Date.now() - 1000 }));
  StudentOutbox.enqueue('assignment', StudentOutbox.assignmentKey('ม.1/1', 5), { period: 5, content: 'งานคาบ 5' });
  await new Promise(res => setTimeout(res, 20));
  assert(StudentOutbox.needsReauth && StudentOutbox.getItems().length === 1, 'kept while waiting for PIN');
  assert(!(await StudentOutbox.reauth('000000')).success);
  assert.strictEqual(StudentOutbox.getItems().length, 1);
  assert((await StudentOutbox.reauth('123456')).success);
  assert.strictEqual(StudentOutbox.getItems().length, 0); assert(!StudentOutbox.needsReauth);
  // forged/garbled token from server side -> reauth requested
  Store.setCurrentUser(Object.assign({}, Store.getCurrentUser(), { sessionToken: 'x.y' }));
  StudentOutbox.enqueue('assignment', StudentOutbox.assignmentKey('ม.1/1', 6), { period: 6, content: 'งานคาบ 6' });
  await new Promise(res => setTimeout(res, 20));
  assert(StudentOutbox.needsReauth);
  await StudentOutbox.reauth('123456');

  // --- teacher device pulls ---
  delete global.MUSICSMART_PUBLIC_API_URL;
  store = teacherStore; Store._cache.clear(); Store._studentIndex = null;
  Store.setCurrentUser({ role: 'teacher', name: 'ครูตัวอย่าง' });
  assert(TeacherPull.isConfigured());
  r = await TeacherPull.pull({ silent: true });
  assert(r.success && r.subs >= 3 && r.quizzes === 1, JSON.stringify(r));
  const subs = Store.getAllSubmissions();
  const s3 = subs['ม.1/1_p3_90001'];
  assert(s3 && s3.content === 'คำตอบตัวอย่าง' && s3.source === 'student_device' && s3.submittedAt, 'appears in existing submission view data');
  assert(subs['ม.1/1_p5_90001'] && subs['ม.1/1_p6_90001']);
  const q = JSON.parse(localStorage.getItem('music_quiz_90001_u2'));
  assert(q.submitted && q.score === 7 && q.maxScore === 10, 'quiz attempt visible to teacher');
  assert.strictEqual(GoogleSheetSync.getOutbox().length, 0, 'pulled data not re-uploaded');
  r = await TeacherPull.pull({ silent: true });
  assert.strictEqual(r.subs + r.quizzes, 0, 'incremental: nothing new');
  // late detection
  assert.strictEqual(TeacherPull.isLate('ม.9/9', 1, new Date().toISOString()), false);
  // teacher pull without token fails
  GoogleSheetSync.saveConfig({ syncToken: 'wrong' });
  localStorage.removeItem(TeacherPull.SINCE_KEY);
  assert.strictEqual((await TeacherPull.pull({ silent: true })).success, false);

  console.log('student submit client (end-to-end) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
