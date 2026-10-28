// test_period_e2e.js — ตรวจ "ครบวงจร" ทุกคาบ 1-20 ของ ม.1 (เนื้อหา → ภารกิจ → ส่งงาน → ตรวจ → ให้คะแนน → สมุดคะแนน → สื่อ)
// ข้อมูลที่เอกสารไม่มี (เช่น โน้ตเพลง, ไฟล์สื่อ) ไม่ทำให้เทสต์ล้ม — รายงานเป็น "ขาด" โดย tools/audit/period_e2e_audit.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
process.env.USE_SAMPLE_DATA = '1';

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } }

// ---------- โหลดสภาพแวดล้อมเหมือนเทสต์อื่น (window/localStorage จำลอง + นักเรียนตัวอย่าง) ----------
const mem = {};
global.window = global;
global.localStorage = {
  getItem: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
  clear: () => { Object.keys(mem).forEach(k => delete mem[k]); },
  key: i => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
global.document = global.document || undefined;
global.STUDENTS_DATA = require(path.join(ROOT, 'tests', 'fixtures', 'students.sample.js'));
global.LESSONS_DATA = require(path.join(APP, 'data', 'lessons.js'));
global.WK5_PLANS = require(path.join(APP, 'data', 'wk5_plans.js'));
const AD = require(path.join(APP, 'data', 'academic_docs.js'));
global.ACADEMIC_DOCS = AD.ACADEMIC_DOCS; global.ACADEMIC_DOCS_BY_GRADE = AD.ACADEMIC_DOCS_BY_GRADE;
global.QUIZZES_DATA = require(path.join(APP, 'data', 'quizzes.js'));
global.KALIMBA_MEDIA = require(path.join(APP, 'data', 'kalimba_media.js'));
const Store = require(path.join(APP, 'data', 'store.js'));
global.Store = Store;
const KalimbaMedia = require(path.join(APP, 'js', 'kalimba-media.js'));
const KalimbaDevices = require(path.join(APP, 'js', 'kalimba-devices.js'));
const audit = require(path.join(ROOT, 'tools', 'audit', 'period_e2e_audit.js'));

const appSrc = fs.readFileSync(path.join(APP, 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const classes = Store.getAllClasses('M1');
const className = classes[0] && (classes[0].name || classes[0]);
const students = Store.getStudents(className) || [];
const env = { Store, LESSONS_DATA: global.LESSONS_DATA, WK5_PLANS: global.WK5_PLANS, KALIMBA_MEDIA: global.KALIMBA_MEDIA, KalimbaMedia, KalimbaDevices, appSrc, className, students };

check('มีห้อง ม.1 และนักเรียนตัวอย่างอย่างน้อย 3 คน', !!className && students.length >= 3, 'className=' + className + ' n=' + students.length);
if (className && students.length >= 3) {
  const { rows } = audit.audit(env);
  check('ตรวจครบ 20 คาบ', rows.length === 20);
  rows.forEach(r => {
    const P = 'คาบ ' + r.period + ': ';
    check(P + 'มีเนื้อหา+ขั้นตอน', r.lessonContent === true);
    check(P + 'น้ำหนัก K/P/A ตรงคะแนนเต็ม', r.weightsConsistent === true);
    check(P + 'ภารกิจนักเรียนตรงกับ วก.5 ทุกบรรทัด', r.taskMatchesDocs === true, 'work=' + r.wk5Work);
    if (r.kind !== 'สอบ') { check(P + 'ส่งงานได้', r.submitOk === true); check(P + 'เข้าคิวตรวจของครู', r.reviewQueueOk === true); }
    check(P + 'ให้คะแนนตามกติกา (เกินเต็ม/คาบสอบ/ไม่เก็บคะแนน ถูกปฏิเสธ)', r.scoreOk === true);
    if (r.kind !== 'ไม่เก็บคะแนน') check(P + 'คะแนนเข้าสมุดคะแนน K/P/A ตามน้ำหนัก', r.gradebookOk === true);
    check(P + 'สื่อทุกชิ้นถูกจัดสถานะ (ไม่มี unknown)', r.mediaUnknown === 0);
    if (r.kalimbaItems) check(P + 'ช่องหมายเลขเครื่อง: เก็บ/แนบ/แกะ/CSV ได้', r.deviceField === true);
  });
  const kal = rows.filter(r => r.kalimbaItems).map(r => r.period);
  check('คาบที่มีคาลิมบ้าตรงกับข้อมูล (2-10)', kal.join(',') === '2,3,4,5,6,7,8,9,10', kal.join(','));
  check('คาบสอบคือ 11 และ 20', rows.filter(r => r.kind === 'สอบ').map(r => r.period).join(',') === '11,20');

  // รวมคะแนนทั้งภาค
  const t = audit.totals(env);
  check('รวมคะแนนระหว่างภาค = K/P/A ตามน้ำหนักทุกคาบ', t.actual.K === t.expected.K && t.actual.P === t.expected.P && t.actual.A === t.expected.A, JSON.stringify([t.actual.K, t.actual.P, t.actual.A, t.expected.K, t.expected.P, t.expected.A]));
  check('คะแนนเต็มทั้งภาค (ระหว่างภาค + กลางภาค + ปลายภาค) รวม 100', t.expected.total === 100 && t.actual.total === 100, 'total=' + t.expected.total + '/' + t.actual.total);

  // ฝั่งแอป: ไม่มี /3 และ max=3 ที่ฮาร์ดโค้ด
  check('app.js ไม่ฮาร์ดโค้ดคะแนนเต็ม 3 ในช่องให้คะแนน', appSrc.indexOf('min="0" max="3"') === -1 && appSrc.indexOf('คะแนน (0-3):') === -1 && appSrc.indexOf('${tf.score} / 3') === -1);
  check('app.js ใช้ภาระงาน วก.5 สร้างภารกิจนักเรียน', appSrc.indexOf('buildStudentTaskPromptHTML(gradeKey, this.state.studentPeriod, lesson)') !== -1);
  // ออฟไลน์/โหลดสคริปต์
  const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
  const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  ['data/kalimba_media.js', 'js/kalimba-devices.js', 'js/kalimba-media.js', 'ensemble-explorer.js'].forEach(f => check('sw.js แคช ' + f, sw.indexOf(f) !== -1));
  ['data/kalimba_media.js', 'js/kalimba-devices.js', 'js/kalimba-media.js'].forEach(f => check('index.html โหลด ' + f, idx.indexOf(f) !== -1));
  check('ลำดับสคริปต์: ข้อมูลก่อนตัวแสดง', idx.indexOf('data/kalimba_media.js') < idx.indexOf('js/kalimba-media.js'));
}
console.log('test_period_e2e: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
