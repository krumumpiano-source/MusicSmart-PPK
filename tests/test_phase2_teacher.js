// Phase 2: reminders, feedback to phone, dashboard/at-risk, ปพ.5 export. Sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T' });
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.fetch = async (url, opts) => { const reply = gas.call(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => reply }; };
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
global.StudentAuth = require('../app/js/student-auth.js').StudentAuth;
Object.assign(global, require('../app/js/student-submit.js'));
const { Analytics, Notices, StudentNotices } = require('../app/js/teacher-tools.js');
global.Analytics = Analytics;
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';

(async () => {
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: 'T', autoSync: false });
  await StudentAuth.uploadRoster();
  const cls = 'ม.1/1';
  const roster = Store.getStudents(cls);
  assert(roster.length >= 2);
  const [s1, s2] = roster;
  // sessions: 5 periods; s2 absent in 3 -> attendance 40%
  const sessions = {};
  for (let p = 1; p <= 5; p++) {
    sessions[Store.getSessionKey(cls, p)] = { attendance: { [s1.student_id]: 'present', [s2.student_id]: p <= 2 ? 'present' : 'absent' }, scores: { [s1.student_id]: 3 }, updatedAt: new Date().toISOString() };
  }
  Store.save('ppk_sessions', sessions);
  Store.getAllSessions = () => sessions;
  const subs = {}; for (let p = 1; p <= 5; p++) subs[`${cls}_p${p}_${s1.student_id}`] = { content: 'งานตัวอย่าง', submittedAt: 'x', late: p === 5 };
  Store.save('ppk_student_submissions', subs);
  localStorage.setItem(`music_quiz_${s2.student_id}_u1`, JSON.stringify({ submitted: true, score: 3, maxScore: 10 }));

  // dashboard stats / at-risk
  const sum = Analytics.classSummary(cls);
  const r1 = sum.rows.find(r => r.studentId === String(s1.student_id)), r2 = sum.rows.find(r => r.studentId === String(s2.student_id));
  assert.strictEqual(r1.attendancePct, 100); assert.strictEqual(r1.scoreSum, 15); assert.strictEqual(r1.late, 1); assert(!r1.atRisk);
  assert.strictEqual(r2.attendancePct, 40); assert.strictEqual(r2.missing, 5); assert.strictEqual(r2.quizPct, 30);
  assert(r2.atRisk && r2.flags.length === 3 && !r2.eligible, 'at-risk flags');

  // ปพ.5 export
  const rows = Analytics.pp5Rows(cls);
  assert(/ปพ.5/.test(rows[0][0])); assert.strictEqual(rows[1][0], 'เลขที่'); assert(rows[1].includes('คาบ20') && rows[1].includes('สิทธิ์สอบ'));
  assert.strictEqual(rows.length, 2 + roster.length);
  assert(rows.find(r => r[1] === String(s2.student_id)).includes('มส'));
  const csv = Analytics.toCSV(rows);
  assert(csv.startsWith('\ufeff') && csv.includes('เลขประจำตัว'));

  // reminders to missing students (token required on server)
  assert.strictEqual(gas.call({ action: 'post_notices', items: [{ studentId: s2.student_id, message: 'x' }] }).status, 'error');
  assert.deepStrictEqual(Analytics.missingFor(cls, 3).map(s => s.student_id), roster.filter(s => s !== s1).map(s => s.student_id));
  let rr = await Notices.remindMissing(cls, 3);
  assert.strictEqual(rr.posted, roster.length - 1);
  await Notices.postFeedback(cls, 2, s1.student_id, 'ดีมาก ฝึกจังหวะเพิ่ม', '3');
  const teacherStore = store;

  // student 2 phone sees only own reminder; student 1 sees feedback on their task
  for (const [sid, pin, expectKind] of [[String(s2.student_id), '222222', 'reminder'], [String(s1.student_id), '111111', 'feedback']]) {
    store = {}; Store._cache.clear(); Store._studentIndex = null;
    global.MUSICSMART_PUBLIC_API_URL = API;
    assert((await StudentAuth.setPin(sid, pin)).success);
    const list = await StudentNotices.fetch();
    assert(list.length >= 1 && list.every(n => n.kind === expectKind), 'only own notices');
    assert.strictEqual(StudentNotices.unseen().length, list.length);
    if (expectKind === 'feedback') {
      const sub = Store.getAllSubmissions()[`${cls}_p2_${sid}`];
      assert.strictEqual(sub.teacherFeedback.feedback, 'ดีมาก ฝึกจังหวะเพิ่ม'); assert.strictEqual(sub.teacherFeedback.score, 3);
    }
    StudentNotices.markSeen(); assert.strictEqual(StudentNotices.unseen().length, 0);
    assert.strictEqual((await StudentNotices.fetch()).length, 0, 'incremental');
  }
  // notices need a valid student session
  assert.strictEqual(gas.call({ action: 'studentNotices', sessionToken: 'bad.token' }).code, 'bad_session');
  store = teacherStore;
  console.log('phase 2 (teacher tools) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
