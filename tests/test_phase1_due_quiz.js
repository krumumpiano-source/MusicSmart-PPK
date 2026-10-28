// Phase 1: due dates (server late flag) + server-graded quizzes (no keys on student device). Sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T' });
const T = 'T';
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.QUIZZES_DATA = require('../app/data/quizzes.js');
global.fetch = async (url, opts) => { const reply = gas.call(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => reply }; };
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
global.StudentAuth = require('../app/js/student-auth.js').StudentAuth;
const mod = require('../app/js/student-submit.js');
Object.assign(global, mod);
global.ServerQuiz = require('../app/js/server-quiz.js');
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';

(async () => {
  // teacher: roster, quiz bank (from the real public bank file), due dates
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: T, autoSync: false });
  await StudentAuth.uploadRoster();
  const up = await TeacherPull.uploadQuizBank();
  assert(up.questions >= 40, 'bank uploaded');
  assert.strictEqual(gas.call({ action: 'upload_quiz_bank', units: [] }).status, 'error', 'bank upload needs token');
  assert.strictEqual(gas.call({ action: 'set_due_date', className: 'ม.1/1', period: 3, dueAt: '2020-01-01T00:00:00Z' }).status, 'error', 'due date needs token');
  await DueDates.set('ม.1/1', 3, '2020-01-01T00:00:00Z', 'งานตัวอย่าง');           // past -> late
  await DueDates.set('ม.1/1', 4, '2099-01-01T00:00:00Z', 'งานตัวอย่าง');           // future -> on time
  assert.strictEqual(gas.call({ action: 'fetch_due_dates', token: T }).dueDates.length, 2);
  await DueDates.set('ม.1/1', 4, '', ''); await DueDates.set('ม.1/1', 4, '2099-01-01T00:00:00Z', '');
  assert.strictEqual(gas.call({ action: 'fetch_due_dates', token: T }).dueDates.length, 2, 'upsert, no duplicates');
  const teacherStore = store;

  // student phone
  store = {}; Store._cache.clear(); Store._studentIndex = null;
  global.MUSICSMART_PUBLIC_API_URL = API;
  await StudentAuth.setPin('90001', '123456');
  const tasks = await StudentOutbox.refreshTasks();
  assert.strictEqual(tasks.dueDates.length, 2, 'student sees own class due dates');
  assert(StudentOutbox.dueFor('ม.1/1', 3));

  // quiz questions arrive without keys / explanations
  const q = await ServerQuiz.load(1);
  assert(q.questions.length === 10);
  const json = JSON.stringify(q);
  assert(!/"correct"|"explanation"|sessionCorrect|isCorrect/.test(json), 'no answer keys on device');
  // answer using the real key for 6 questions -> server scores 6
  const unit1 = QUIZZES_DATA.units.find(u => u.unit_no === 1);
  const answers = {};
  unit1.questions.forEach((qq, i) => { answers[qq.id] = i < 6 ? qq.correct : (qq.correct === 'ก' ? 'ข' : 'ก'); });
  ServerQuiz.state = { unitNo: 1, practice: false, quiz: q, startedAt: Date.now() - 60000 };
  const st = await ServerQuiz.submit(answers);
  assert.strictEqual(st.state, 'sent'); assert.strictEqual(st.result.score, 6); assert.strictEqual(st.result.total, 10);
  assert(/6 \/ 10/.test(ServerQuiz.resultHtml(1, false)));

  // offline quiz load falls back to cache
  const realFetch = global.fetch; global.fetch = async () => { throw new TypeError('offline'); };
  assert((await ServerQuiz.load(1)).fromCache, 'cached questions offline');
  global.fetch = realFetch;

  // assignments: late flag from due date
  Store.saveStudentSubmission('ม.1/1', 3, '90001', { content: 'งานคาบ 3' });
  Store.saveStudentSubmission('ม.1/1', 4, '90001', { content: 'งานคาบ 4' });
  await new Promise(r => setTimeout(r, 30)); await StudentOutbox.flush();
  const inbox = gas.sheets['นักเรียนส่งงาน_Inbox']._data();
  const row3 = inbox.find(r => r[5] === 'assignment' && r[6] === 3), row4 = inbox.find(r => r[5] === 'assignment' && r[6] === 4);
  assert.strictEqual(row3[17], true, 'late after due'); assert.strictEqual(row4[17], false, 'on time');

  // teacher pull: late from server, quiz score recorded
  delete global.MUSICSMART_PUBLIC_API_URL;
  store = teacherStore; Store._cache.clear(); Store._studentIndex = null;
  Store.setCurrentUser({ role: 'teacher', name: 'ครูตัวอย่าง' });
  await TeacherPull.pull({ silent: true });
  const subs = Store.getAllSubmissions();
  assert.strictEqual(subs['ม.1/1_p3_90001'].late, true); assert.strictEqual(subs['ม.1/1_p4_90001'].late, false);
  assert(subs['ม.1/1_p3_90001'].dueAt);
  assert.strictEqual(JSON.parse(localStorage.getItem('music_quiz_90001_u1')).score, 6);
  // fallback: no due date and no session -> not late
  assert.strictEqual(TeacherPull.isLate('ม.1/1', 9, new Date().toISOString(), { due_at: '' }), false);

  // quiz-engine routes students to the server quiz
  const qe = require('fs').readFileSync(__dirname + '/../app/js/quiz-engine.js', 'utf8');
  assert(/ServerQuiz\.shouldUse\(\)\) return ServerQuiz\.open/.test(qe));
  console.log('phase 1 (due dates + server-graded quizzes) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
