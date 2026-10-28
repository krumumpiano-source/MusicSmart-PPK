// Student login client (local demo + server mode), role-based lesson sanitizing, teacher-DOM purge, PWA banner logic.
// Sample (fake) roster only.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest' };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
const { StudentAuth, RoleGuard } = require('../app/js/student-auth.js');
const PwaInstall = require('../app/js/pwa-install.js');

(async () => {
  // ---------- local/demo mode (no API URL) ----------
  assert.strictEqual(StudentAuth.isServerMode(), false);
  let r = await StudentAuth.lookup('90001');
  assert(r.success && r.mode === 'local' && r.hasPin === false, 'sample student found, no PIN yet');
  assert(!(await StudentAuth.lookup('12345')).success, 'unknown id rejected');
  assert.strictEqual((await StudentAuth.setPin('90001', '12ab')).code, 'bad_pin');
  r = await StudentAuth.setPin('90001', '246810');
  assert(r.success, 'first login forces PIN then logs in');
  assert.strictEqual(Store.getCurrentUser().role, 'student');
  Store.logout();
  assert((await StudentAuth.lookup('90001')).hasPin, 'PIN now set');
  assert(!(await StudentAuth.login('90001', '000000')).success, 'wrong PIN rejected');
  assert((await StudentAuth.login('90001', '246810')).success, 'ID + PIN login works');
  Store.logout();

  // ---------- server mode (mock Apps Script) ----------
  const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';
  global.MUSICSMART_PUBLIC_API_URL = API;
  assert(StudentAuth.isServerMode());
  const sent = [];
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body); sent.push({ url, body });
    let reply;
    if (body.action === 'studentLookup') reply = body.studentId === '90009' ? { status: 'success', exists: true, hasPin: false, studentClass: 'ม.1/2', maskedName: 'ต•••' } : { status: 'error', code: 'not_found' };
    else if (body.action === 'studentSetPin' || (body.action === 'studentLogin' && body.pin === '135790')) reply = { status: 'success', profile: { studentId: '90009', name: 'เด็กชายตัวอย่างเก้า ทดสอบ', nickname: 'เก้า', studentClass: 'ม.1/2', no: 9 } };
    else if (body.action === 'studentLogin') reply = { status: 'error', code: 'wrong_pin', message: 'PIN ไม่ถูกต้อง' };
    else if (body.action === 'upload_roster') reply = { status: 'success', added: body.students.length, updated: 0, total: body.students.length };
    return { ok: true, json: async () => reply };
  };
  r = await StudentAuth.lookup('90009');
  assert(r.success && r.mode === 'server' && r.displayName === 'ต•••', 'server lookup works for id not in local roster');
  assert(!sent[0].body.token, 'student calls never send the teacher token');
  r = await StudentAuth.setPin('90009', '135790');
  assert(r.success && Store.getCurrentUser().studentClass === 'ม.1/2' && Store.getCurrentUser().source === 'server');
  assert.strictEqual((await StudentAuth.login('90009', '111111')).code, 'wrong_pin');
  assert((await StudentAuth.login('90009', '135790')).success);
  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  assert.strictEqual((await StudentAuth.lookup('90009')).code, 'network', 'offline handled gracefully');

  // teacher upload requires token config
  await assert.rejects(() => StudentAuth.uploadRoster(), /Sync Token/);
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: 'tok', autoSync: false });
  global.fetch = async (url, opts) => { const b = JSON.parse(opts.body); sent.push({ body: b }); return { ok: true, json: async () => ({ status: 'success', added: b.students.length, updated: 0, total: b.students.length }) }; };
  r = await StudentAuth.uploadRoster();
  assert(r.added >= 1 && sent[sent.length - 1].body.token === 'tok');
  assert(StudentAuth.studentLink().includes('role=student') && StudentAuth.studentLink().includes('api='), 'share link carries public API url');
  delete global.MUSICSMART_PUBLIC_API_URL;

  // ---------- role-based lesson view ----------
  let checked = 0;
  for (const grade of ['M1', 'M2']) {
    for (const lesson of LESSONS_DATA[grade]) {
      const s = RoleGuard.sanitizeLesson(lesson);
      const json = JSON.stringify(s);
      assert(!('steps' in s) && !('mentor_tips' in s), 'no teaching steps / mentor tips');
      assert(!s.assessment || !('rubrics' in s.assessment), 'no teacher rubrics');
      if (lesson.mentor_tips) assert(!json.includes(lesson.mentor_tips), 'mentor tip text not present');
      (lesson.steps || []).forEach(st => { if (st.desc && st.desc.length > 20) assert(!json.includes(st.desc), 'step text not present'); });
      assert.strictEqual(s.topic, lesson.topic, 'learning content kept');
      checked++;
    }
  }
  assert(checked >= 40, 'all lessons checked');
  const appSrc = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');
  const guide = appSrc.slice(appSrc.indexOf('buildStudentStudyGuideHTML(gradeKey, period, lesson) {'), appSrc.indexOf('  openEnsemble(cat) {'));
  assert(!/lesson\.steps|mentor_tips|rubrics/.test(guide), 'student study guide never reads teacher-only fields');
  assert(/RoleGuard\.sanitizeLesson\(Store\.getLesson/.test(appSrc), 'student portal uses sanitized lesson');

  // teacher DOM purge (fake document)
  const removed = [];
  const fakeDoc = { querySelectorAll: sel => (['#view-dashboard', '#view-cockpit', '#modal-lesson-editor'].includes(sel) ? [{ remove: () => removed.push(sel) }] : []) };
  RoleGuard.purgeTeacherDom(fakeDoc);
  assert.deepStrictEqual(removed.sort(), ['#modal-lesson-editor', '#view-cockpit', '#view-dashboard']);
  const html = fs.readFileSync(path.join(__dirname, '../app/index.html'), 'utf8');
  RoleGuard.TEACHER_ONLY_SELECTORS.filter(s => s.startsWith('#') && !['#modal-teacher-dashboard', '#modal-mentor-panel'].includes(s)).forEach(sel => assert(html.includes(`id="${sel.slice(1)}"`), `selector exists: ${sel}`));
  ['view-student', 'modal-quiz', 'modal-feldman-criticism', 'modal-virtual-kalimba', 'modal-tuner', 'modal-auth-login'].forEach(id =>
    assert(!RoleGuard.TEACHER_ONLY_SELECTORS.includes('#' + id), `student UI kept: ${id}`));

  // ---------- PWA ----------
  PwaInstall.env = { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', standalone: false };
  assert(PwaInstall.shouldShow(), 'iOS Safari shows instructions');
  PwaInstall.env.standalone = true; assert(!PwaInstall.shouldShow(), 'hidden when installed');
  PwaInstall.env = { ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome', standalone: false };
  assert(!PwaInstall.shouldShow(), 'desktop without prompt: no banner');
  let prompted = false;
  PwaInstall.deferred = { prompt: () => { prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
  assert(PwaInstall.shouldShow(), 'shows when beforeinstallprompt captured');
  assert.strictEqual(await PwaInstall.install(), 'accepted'); assert(prompted);
  PwaInstall.env = { ua: 'Mozilla/5.0 (Linux; Android 14) Mobile Chrome', standalone: false };
  PwaInstall.dismiss(); assert(!PwaInstall.shouldShow(), 'dismiss respected');

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/manifest.json'), 'utf8'));
  assert(manifest.name && manifest.start_url && manifest.display === 'standalone');
  assert(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'));
  manifest.icons.forEach(i => assert(fs.existsSync(path.join(__dirname, '../app', i.src)), 'icon exists ' + i.src));
  const sw = fs.readFileSync(path.join(__dirname, '../app/sw.js'), 'utf8');
  const assets = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(Boolean);
  assets.forEach(a => assert(fs.existsSync(path.join(__dirname, '../app', a)), 'sw asset exists ' + a));
  assert(!assets.some(a => a.includes('students')), 'roster never precached');

  console.log('student portal / role / PWA tests passed');
})().catch(e => { console.error(e); process.exit(1); });
