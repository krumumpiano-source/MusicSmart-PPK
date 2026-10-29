// Phase 3: intern accounts, class-scoped token, grade approval queue, post-teaching log, supervision, portfolio. Sample data only.
const { PIN_A, PIN_B } = require('./lib/test_pins');
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T' });
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = Object.assign({}, require('./fixtures/students.sample.js'), {
  'ม.2/9': [{ id: 'ม.2/9_1', student_id: '99901', prefix: 'เด็กหญิง', first_name: 'สมมุติ', last_name: 'ห้องอื่น', number: 1, class: 'ม.2/9' }] });
global.LESSONS_DATA = require('../app/data/lessons.js');
global.fetch = async (url, opts) => { const reply = gas.call(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => reply }; };
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
const SA = require('../app/js/student-auth.js'); global.StudentAuth = SA.StudentAuth; global.RoleGuard = SA.RoleGuard;
Object.assign(global, require('../app/js/student-submit.js'));
Object.assign(global, require('../app/js/teacher-tools.js'));
const { InternMode, MentorPanel, Portfolio } = require('../app/js/intern.js');
global.InternMode = InternMode;
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';
const reset = () => { store = {}; Store._cache.clear(); Store._studentIndex = null; Store._rosterCache = undefined; };

(async () => {
  // mentor (teacher device)
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: 'T', autoSync: false });
  Store.setCurrentUser({ role: 'teacher', name: 'ครูพี่เลี้ยงตัวอย่าง' });
  await StudentAuth.uploadRoster();
  const classes = Object.keys(STUDENTS_DATA);
  assert(classes.length >= 2, 'sample has 2+ classes');
  const [mine, other] = classes;
  assert.strictEqual(gas.call({ action: 'upsert_intern', internId: 'intern01', name: 'นศ.ตัวอย่าง', classes: [mine] }).status, 'error', 'needs token');
  assert((await MentorPanel.saveIntern('intern01', 'นศ.ตัวอย่าง', [mine])).created);
  assert.strictEqual((await MentorPanel.listInterns()).interns[0].hasPin, false);
  const mentorStore = store;

  // intern device: first login sets PIN, then login
  reset(); global.MUSICSMART_PUBLIC_API_URL = API;
  assert.strictEqual((await InternMode.login('intern01', PIN_B)).code, 'needs_pin');
  assert((await InternMode.setPin('intern01', PIN_B)).success);
  assert.strictEqual((await InternMode.login('intern01', '000000')).code, 'wrong_pin');
  assert((await InternMode.login('intern01', PIN_B)).success);
  const u = Store.getCurrentUser(); assert.strictEqual(u.role, 'intern'); assert.deepStrictEqual(u.classes, [mine]);
  let r = await InternMode.sync();
  assert(r.success);
  assert.deepStrictEqual(Object.keys(Store.getRoster()), [mine], 'roster limited to assigned class');
  assert.strictEqual(Store.getStudents(other).length, 0);

  // intern token cannot be used as a student session, nor reach other classes
  assert.strictEqual(gas.call({ action: 'studentSubmit', sessionToken: u.sessionToken, items: [] }).status, 'error');
  const sid = String(Store.getStudents(mine)[0].student_id);
  r = gas.call({ action: 'internProposeGrade', sessionToken: u.sessionToken, items: [{ clientId: 'g_other_000001', className: other, period: 1, studentId: sid, score: 3 }] });
  assert.strictEqual(r.rejected[0].reason, 'class_not_assigned');
  assert.strictEqual(gas.call({ action: 'internPostLog', sessionToken: u.sessionToken, className: other, period: 1, result: 'x' }).code, 'class_not_assigned');
  assert.strictEqual(gas.call({ action: 'internFetch', sessionToken: 'forged.token' }).code, 'bad_session');

  // intern saves a session -> log + grade proposals (through existing GoogleSheetSync hook)
  GoogleSheetSync.syncSessionLog(mine, 2, { scores: { [sid]: 3 }, reflection: { outcomes: 'นักเรียนตัวอย่างอ่านโน้ตได้', problems: 'เวลาไม่พอ', solutions: 'แบ่งกลุ่มฝึก' } });
  await new Promise(res => setTimeout(res, 30)); await InternMode.flush();
  assert.strictEqual(InternMode.pendingCount(), 0);
  // retry is idempotent
  await InternMode.proposeGrades(mine, 2, { [sid]: 3 }, 'คะแนนประจำคาบ (นศ. เสนอ)');
  assert.strictEqual(gas.sheets['รออนุมัติคะแนน_Approvals']._data().length, 2, 'one approval row (deduped)');
  assert.strictEqual(gas.sheets['วก5_บันทึกหลังสอน']._data().length, 2, 'post-teaching log also in existing วก5 sheet');
  // intern device has no teacher token
  assert(!GoogleSheetSync.getConfig().syncToken);

  // mentor approves -> score applied locally
  reset(); store = mentorStore; Store._cache.clear(); Store._rosterCache = undefined; Store._studentIndex = null;
  assert.strictEqual(gas.call({ action: 'fetch_approvals' }).status, 'error', 'approvals need token');
  const pend = (await MentorPanel.pending()).approvals;
  assert.strictEqual(pend.length, 1); assert.strictEqual(pend[0].score, 3);
  await MentorPanel.decide(pend[0].id, true);
  const sess = Store.load('ppk_session_logs', {})[Store.getSessionKey(mine, 2)];
  assert.strictEqual(sess.scores[sid], 3, 'approved score applied to mentor record');
  assert.strictEqual((await MentorPanel.decide(pend[0].id, false).catch(e => ({ error: e.message }))).error !== undefined, true, 'cannot decide twice');
  const logs = (await MentorPanel.logs('intern01')).logs; assert.strictEqual(logs.length, 1); assert.strictEqual(logs[0].problems, 'เวลาไม่พอ');
  const ev = await MentorPanel.evaluate('intern01', mine, 2, { [MentorPanel.EVAL_ITEMS[0]]: 5, [MentorPanel.EVAL_ITEMS[1]]: 4 }, 'เตรียมสื่อดี');
  assert.strictEqual(ev.total, 9);

  // intern sees approval status + evaluation, portfolio builds
  reset(); global.MUSICSMART_PUBLIC_API_URL = API;
  await InternMode.login('intern01', PIN_B); await InternMode.sync();
  assert.strictEqual(InternMode.approvalStatus(mine, 2, sid), 'approved');
  const d = InternMode.data(); assert.strictEqual(d.evaluations[0].comments, 'เตรียมสื่อดี');
  const html = Portfolio.build({ name: 'นศ.ตัวอย่าง', internId: 'intern01', classes: [mine], logs: d.logs, evaluations: d.evaluations });
  ['แผนการจัดการเรียนรู้', 'สื่อการเรียนรู้', 'ผลงานนักเรียน', 'CAR', 'บันทึกหลังสอน', 'ผลการนิเทศ', 'เตรียมสื่อดี', 'window.print()'].forEach(t => assert(html.includes(t), 'portfolio has ' + t));
  assert(!html.includes('ตัวอย่างหนึ่ง ทดสอบระบบ'), 'no student names in portfolio');
  // role guard: intern is not a student; intern-hidden list removes admin bits
  assert.strictEqual(RoleGuard.isStudent(), false);
  const removed = []; RoleGuard.purgeForIntern({ querySelectorAll: s => (['#modal-google-sheet-sync', '#modal-user-management'].includes(s) ? [{ remove: () => removed.push(s) }] : []) });
  assert.deepStrictEqual(removed.sort(), ['#modal-google-sheet-sync', '#modal-user-management']);
  // PIN reset kills intern session
  reset(); store = mentorStore; Store._cache.clear(); await MentorPanel.resetPin('intern01');
  assert.strictEqual(gas.call({ action: 'internFetch', sessionToken: u.sessionToken }).code, 'session_expired');
  console.log('phase 3 (intern / mentor) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
