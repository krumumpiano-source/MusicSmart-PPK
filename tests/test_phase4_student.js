// Phase 4: calendar + due notifications, own progress from server, metronome, recording links, practice quizzes. Sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T' });
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
Object.assign(global, require('../app/js/student-submit.js'));
Object.assign(global, require('../app/js/teacher-tools.js'));
global.ServerQuiz = require('../app/js/server-quiz.js');
const P = require('../app/js/student-practice.js'); Object.assign(global, P);
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';
const H = 3600000;

(async () => {
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: 'T', autoSync: false });
  Store.setCurrentUser({ role: 'teacher', name: 'ครูตัวอย่าง' });
  await StudentAuth.uploadRoster(); await TeacherPull.uploadQuizBank();
  await DueDates.set('ม.1/1', 1, new Date(Date.now() - 48 * H).toISOString(), 'งานคาบ 1');   // overdue
  await DueDates.set('ม.1/1', 2, new Date(Date.now() + 5 * H).toISOString(), 'งานคาบ 2');    // soon
  await DueDates.set('ม.1/1', 3, new Date(Date.now() + 240 * H).toISOString(), 'งานคาบ 3');  // later
  const teacherStore = store;

  // student phone
  store = {}; Store._cache.clear(); Store._studentIndex = null; global.MUSICSMART_PUBLIC_API_URL = API;
  await StudentAuth.setPin('90001', '123456');
  await StudentOutbox.refreshTasks();
  let t = TaskCalendar.tasks();
  assert.deepStrictEqual(t.map(x => [x.period, x.overdue, x.soon]), [[1, true, false], [2, false, true], [3, false, false]]);
  const now = new Date(Date.now() + 7 * H);
  const weeks = TaskCalendar.month(now.getUTCFullYear(), now.getUTCMonth(), t);
  assert(weeks.every(w => w.length === 7));
  assert(weeks.flat().filter(Boolean).some(c => c.tasks.length), 'tasks placed on calendar days');

  // notifications: no Notification API -> in-app fallback; each state notified once
  let r = await DueNotifier.check();
  assert.deepStrictEqual([r.shown, r.via], [2, 'inapp']);
  assert.strictEqual((await DueNotifier.check()).shown, 0, 'no repeat');
  // with permission: uses SW showNotification
  const shown = [];
  global.Notification = function () {}; global.Notification.permission = 'granted';
  global.navigator.serviceWorker = { getRegistration: async () => ({ showNotification: async (title, o) => shown.push(o.tag) }) };
  localStorage.removeItem(DueNotifier.KEY);
  r = await DueNotifier.check();
  assert.strictEqual(r.via, 'notification'); assert.deepStrictEqual(shown.sort(), ['due_ม.1/1_1', 'due_ม.1/1_2']);

  // submit period 2 -> no longer pending in calendar
  Store.saveStudentSubmission('ม.1/1', 2, '90001', { content: 'งานคาบ 2' });
  await new Promise(res => setTimeout(res, 30)); await StudentOutbox.flush();
  assert.strictEqual(TaskCalendar.tasks().find(x => x.period === 2).done, true);

  // recording link: https only, does not count as the period's assignment
  assert.strictEqual(Recording.submit(1, 'javascript:alert(1)').success, false);
  assert.strictEqual(Recording.submit(1, 'http://example.com/a').success, false);
  assert(Recording.submit(1, 'https://drive.google.com/file/d/SAMPLE/view', 'ฝึก 15 นาที').success);
  await new Promise(res => setTimeout(res, 30)); await StudentOutbox.flush();
  const u = Store.getCurrentUser();
  assert.strictEqual(gas.call({ action: 'studentSubmit', sessionToken: u.sessionToken, items: [{ clientId: 'r_90001_bad00001', kind: 'recording', data: { period: 1, url: 'ftp://x' } }] }).rejected[0].reason, 'bad_url');

  // practice quiz (twice) + real quiz
  const unit1 = QUIZZES_DATA.units.find(x => x.unit_no === 1);
  const all = {}; unit1.questions.forEach(q => { all[q.id] = q.correct; });
  const half = {}; unit1.questions.forEach((q, i) => { half[q.id] = i < 5 ? q.correct : 'x'; });
  for (const ans of [half, all]) {
    ServerQuiz.state = { unitNo: 1, practice: true, quiz: await ServerQuiz.load(1), startedAt: Date.now() };
    await ServerQuiz.submit(ans);
  }
  ServerQuiz.state = { unitNo: 1, practice: false, quiz: await ServerQuiz.load(1), startedAt: Date.now() };
  await ServerQuiz.submit(half);

  // feedback from teacher
  gas.call({ action: 'post_notices', token: 'T', items: [{ studentId: '90001', kind: 'feedback', ref: 'ม.1/1_p2', message: 'ดีมาก ฝึกจังหวะต่อ', score: 4 }] });
  gas.call({ action: 'post_notices', token: 'T', items: [{ studentId: '90002', kind: 'feedback', ref: 'ม.1/1_p2', message: 'ของคนอื่น', score: 1 }] });

  const p = await StudentProgress.fetch();
  assert(p.success);
  assert.deepStrictEqual(p.missing, [1], 'period 1 still missing (recording does not count)');
  assert.strictEqual(p.recordings, 1);
  assert.strictEqual(p.quizAverage, 50, 'practice attempts not counted');
  assert.deepStrictEqual([p.practice[0].attempts, p.practice[0].best, p.practice[0].last], [2, 100, 100]);
  assert.strictEqual(p.feedback.length, 1); assert.strictEqual(p.feedback[0].message, 'ดีมาก ฝึกจังหวะต่อ');
  assert(!JSON.stringify(p).includes('ของคนอื่น'), 'only own data');
  assert(StudentProgress.cached().fetchedAt, 'cached for offline');
  assert.strictEqual(gas.call({ action: 'studentProgress', sessionToken: 'forged.x' }).status, 'error');
  // practice quizzes never reach the teacher score sheet
  const qsheet = Object.keys(gas.sheets).find(n => /quiz|แบบทดสอบ/i.test(n) && !/คลัง|Bank/.test(n));
  if (qsheet) assert.strictEqual(gas.sheets[qsheet]._data().length, 2, 'only the counted quiz row');

  // metronome timing
  assert.strictEqual(Metronome.intervalMs(120), 500); assert.strictEqual(Metronome.intervalMs(10), 2000); assert.strictEqual(Metronome.intervalMs(999), 250);

  // teacher pull ignores nothing important: recording shows up as submission note
  delete global.MUSICSMART_PUBLIC_API_URL; delete global.Notification;
  store = teacherStore; Store._cache.clear(); Store._studentIndex = null;
  Store.setCurrentUser({ role: 'teacher', name: 'ครูตัวอย่าง' });
  const pr = await TeacherPull.pull({ silent: true });
  assert(pr.success !== false);
  const rec = JSON.parse(localStorage.getItem('ppk_student_recordings'))['ม.1/1_p1_90001'];
  assert.strictEqual(rec[0].url, 'https://drive.google.com/file/d/SAMPLE/view');
  assert(!Store.getAllSubmissions()['ม.1/1_p1_90001'], 'recording is not the period assignment');
  // sw handles notification clicks and caches the new module
  const sw = require('fs').readFileSync(__dirname + '/../app/sw.js', 'utf8');
  assert(/notificationclick/.test(sw) && /student-practice\.js/.test(sw));
  console.log('phase 4 (student calendar / progress / practice) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
