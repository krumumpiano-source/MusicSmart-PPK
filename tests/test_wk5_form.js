// วก.5: พิมพ์ 4 หน้าตามแบบฟอร์มโรงเรียน + ข้อมูลแผน + เกณฑ์ผ่าน 60% / ระดับ 3 + ไม่เติมผลหลังการสอนอัตโนมัติ
const assert = require('assert');
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
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
const Store = require('../app/data/store.js');
global.Store = Store;
const { RoleGuard } = require('../app/js/student-auth.js');
const OfficialForms = require('../app/js/official-forms.js');
const builder = require('../tools/curriculum/build_wk5_data.js');

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
let n = 0;
const ok = (c, m) => { assert(c, m); n++; };

// ---------- 1. ข้อมูลแผน: ม.1 = 20 แผน (จาก docx ตรงทีละคาบ), ม.2 = 18 แผน; ไม่ stale ----------
for (const g of ['M1', 'M2']) {
  const plans = WK5_PLANS[g];
  const N = g === 'M1' ? 20 : 18;
  ok(Object.keys(plans).length === N, `${g} has ${N} plans`);
  for (let p = 1; p <= N; p++) {
    ok(String(plans[p].topic).trim() === String(LESSONS_DATA[g][p - 1].topic).trim(), `${g}/${p} plan topic = lessons.js topic`);
    const pl = plans[p];
    ok(pl, `${g} plan ${p} exists`);
    ok(pl.topic && pl.unit_no, `${g}/${p} topic+unit`);
    ok(pl.standards.length >= 1, `${g}/${p} standards`);
    ok(pl.key_concept && pl.content.length >= 1, `${g}/${p} key concept + content`);
    ok(pl.objectives.k.length && pl.objectives.p.length && pl.objectives.a.length, `${g}/${p} objectives K/P/A`);
    ok(pl.competencies.length >= 1 && pl.work.length >= 1 && pl.media.length >= 1, `${g}/${p} competencies/work/media`);
    ok(['intro', 'teach', 'wrap'].every(k => pl.activities[k] && pl.activities[k].items.length && pl.activities[k].minutes), `${g}/${p} 3 activity stages with minutes`);
    ok(pl.assessment.k && pl.assessment.p && pl.assessment.a, `${g}/${p} assessment K/P/A`);
    ok(pl.rubric.length >= 3 && pl.rubric.length <= 5, `${g}/${p} rubric rows 3-5`);
  }
  if (g === 'M2') ok(!plans[19] && !plans[20], 'M2 periods 19/20 have no plan (left blank, not invented)');
}
ok(builder.build().replace(/\r\n/g, '\n') === require('fs').readFileSync(path.join(__dirname, '../app/data/wk5_plans.js'), 'utf8').replace(/\r\n/g, '\n'),
  'wk5_plans.js is up to date with academic_docs.js + wk5_m1_docx.json (run tools/curriculum/build_wk5_data.js)');

// ---------- 2. หน้าพิมพ์ ----------
const SECTIONS = [
  'มาตรฐานการเรียนรู้และตัวชี้วัด', 'สาระสำคัญ', 'สาระการเรียนรู้', 'จุดประสงค์การเรียนรู้', 'สมรรถนะสำคัญของผู้เรียน',
  'ชิ้นงาน/ภาระงาน', 'กิจกรรมการเรียนรู้', 'ขั้นนำเข้าสู่บทเรียน', 'ขั้นสอน', 'ขั้นสรุปบทเรียน', 'สื่อ / แหล่งเรียนรู้',
  'การวัดและประเมินผล', 'เครื่องมือวัด', 'เกณฑ์การประเมิน', 'เกณฑ์การตัดสิน', 'เกณฑ์การผ่าน',
  'บันทึกผลหลังการสอน', 'ผลการเรียนรู้ของนักเรียน', 'ปัญหาที่เกิดขึ้นในระหว่างการจัดการเรียนรู้', 'Action plan', 'ครูผู้สอน', 'ความคิดเห็นของฝ่ายบริหาร'
];
function checkForm(html, label) {
  const t = text(html);
  ok((html.match(/class="wk5-page"/g) || []).length === 4, `${label}: exactly 4 pages`);
  ok((html.match(/page-break-after:always/g) || []).length === 3, `${label}: 3 page breaks`);
  let last = -1;
  SECTIONS.forEach(s => { const i = t.indexOf(s, last + 1); ok(i > last, `${label}: section "${s}" in original order`); last = i; });
  ok(t.includes('งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม'), `${label}: header line`);
  const SEM = Store.getSemesterInfo();
  ok(t.includes('ภาคเรียนที่ ' + SEM.term + ' ') && t.includes('ปีการศึกษา ' + SEM.year), `${label}: semester ${SEM.term}/${SEM.year} derived from term-config`);
  ok(!t.includes('แบบฟอร์ม วก.5:'), `${label}: no "แบบฟอร์ม วก.5:" prefix`);
  ok(t.includes('ได้ระดับ 3 ขึ้นไป ร้อยละ 60 ถือว่าประสบผลสำเร็จในการสอน'), `${label}: pass criterion level 3 / 60%`);
  ok(!/ระดับดี \(ร้อยละ 80/.test(t), `${label}: old 80% K threshold gone`);
  ok((t.match(/ความคิดเห็นของฝ่ายบริหาร/g) || []).length === 1, `${label}: ONE admin opinion box`);
  ok(!/ความคิดเห็นและการรับรอง|ผู้อำนวยการโรงเรียน|รองผู้อำนวยการ|หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ/.test(t), `${label}: no 3-tier approval table`);
  ok(!/ไม่มีปัญหาและอุปสรรค|ดำเนินการจัดการเรียนรู้ตามแผนปกติ/.test(t), `${label}: no auto-filled post-teaching text`);
  ok(/ระดับ 4 หมายถึง มีระดับคุณภาพดีเยี่ยม/.test(t) && /ระดับ 1 หมายถึง มีระดับคุณภาพปรับปรุง/.test(t), `${label}: decision criteria`);
  const rows = (html.match(/<td[^>]*>\s*[1-5]\. /g) || []).length;
  ok(rows === 5, `${label}: rubric table has 5 rows (got ${rows})`);
}
const m1 = OfficialForms.buildWK5HTML('ม.1/1', 1);
checkForm(m1, 'M1/1');
const t1 = text(m1);
ok(t1.includes(Store.getLesson('M1', 1).topic), 'M1/1 topic = app lesson topic (stale plan not used)');
ok(Store.getWk5Plan('M1', 1).source === 'plan', 'M1 uses the 20 per-period วก.5 plans (from docx)');
ok(t1.includes(WK5_PLANS.M1[1].standards[0].slice(0, 30)), 'M1 standards from docx plan printed');
const SEM1 = Store.getSemesterInfo();
ok(t1.includes('ภาคเรียนที่ ' + SEM1.term + ' ') && (SEM1.term === '1' || !/ภาคเรียนที่ 1 /.test(t1)), 'M1 header prints the derived semester (not the docx "ภาคเรียนที่ 1")');
ok(t1.includes(Store.getSubjectCode('ม.1')), 'M1 subject code derived (' + Store.getSubjectCode('ม.1') + ')');
ok(t1.includes(Store.getInstructor().name), 'teacher name from settings');

const m2 = OfficialForms.buildWK5HTML('ม.2/1', 3);
checkForm(m2, 'M2/1');
ok(text(m2).includes(Store.getSubjectCode('ม.2')), 'M2 subject code derived (' + Store.getSubjectCode('ม.2') + ')');
ok(text(m2).includes(WK5_PLANS.M2[3].topic), 'M2 topic from plan');
ok(Store.getWk5Plan('M2', 3).source === 'plan' && text(m2).includes(WK5_PLANS.M2[3].standards[0].slice(0, 30)), 'M2 standards from plan printed');
for (let p = 1; p <= 18; p++) ok(Store.getWk5Plan('M2', p).source === 'plan', `M2 plan ${p} used`);
for (const p of [19, 20]) ok(Store.getWk5Plan('M2', p).source === 'lesson', `M2 period ${p} has no plan: derived from lesson only`);
for (let p = 1; p <= Store.getPeriodCount('M1'); p++) ok(Store.getWk5Plan('M1', p).source === 'plan', `M1 period ${p} uses docx plan`);

const m19 = OfficialForms.buildWK5HTML('ม.1/1', 19);
checkForm(m19, 'M1 period 19');
ok(/\.{10}/.test(text(m19)), 'period 19 left as dotted blanks');

// ---------- 3. ผลหลังการสอน: ว่างถ้าครูไม่กรอก / แสดงเมื่อกรอก ----------
Store.saveSession('ม.1/1', 1, { attendance: {}, scores: {} });
const noRefl = text(OfficialForms.buildWK5HTML('ม.1/1', 1));
ok(!/ไม่มีปัญหา|ตามแผนปกติ|ผ่านเกณฑ์ทุกคน/.test(noRefl), 'saved session without reflection stays blank');
Store.saveSession('ม.1/1', 1, { reflection: { outcomes: 'ผลทดสอบ-A', problems: 'ปัญหาทดสอบ-B', solutions: 'แก้ไขทดสอบ-C', adminOpinion: 'ความเห็นทดสอบ-D', adminName: 'ผู้บริหารทดสอบ', teacherDate: '1/1/2570', adminDate: '2/1/2570' } });
const withRefl = text(OfficialForms.buildWK5HTML('ม.1/1', 1));
['ผลทดสอบ-A', 'ปัญหาทดสอบ-B', 'แก้ไขทดสอบ-C', 'ความเห็นทดสอบ-D', 'ผู้บริหารทดสอบ', '1/1/2570', '2/1/2570'].forEach(s => ok(withRefl.includes(s), `reflection field printed: ${s}`));

// ---------- 4. บทเรียนที่แก้เอง override แผน ----------
Store.saveCustomLesson('M2', 2, { wk5: { work: ['ชิ้นงานที่ครูแก้เอง'], objectives: { k: ['จุดประสงค์ K แก้เอง'] } } });
const l2 = Store.getLesson('M2', 2);
ok(l2.wk5.work[0] === 'ชิ้นงานที่ครูแก้เอง' && l2.wk5.objectives.k[0] === 'จุดประสงค์ K แก้เอง', 'custom wk5 overrides plan');
ok(l2.wk5.objectives.p.length === WK5_PLANS.M2[2].objectives.p.length, 'non-overridden objectives kept');
ok(text(OfficialForms.buildWK5HTML('ม.2/1', 2)).includes('ชิ้นงานที่ครูแก้เอง'), 'print uses edited wk5');
Store.resetCustomLesson('M2', 2);
ok(Store.getLesson('M2', 2).wk5.work[0] === WK5_PLANS.M2[2].work[0], 'reset restores plan');

// ---------- 5. ฝั่งนักเรียน: ข้อมูลเดียวกัน แต่ไม่เห็นส่วนของครู ----------
const sl = RoleGuard.sanitizeLesson(Store.getLesson('M2', 1));
ok(sl.wk5 && sl.wk5.objectives.k.length && sl.wk5.work.length && sl.wk5.rubric.length, 'student gets objectives/work/rubric criteria');
ok(!('activities' in sl.wk5) && !('tools' in sl.wk5) && !('standards' in sl.wk5), 'student does not get teacher activity steps / tools');
ok(sl.wk5.rubric.every(r => !('levels' in r)), 'student rubric has no level descriptors');
ok(!('steps' in sl) && !('mentor_tips' in sl), 'still no steps/mentor tips for students');

// ---------- 6. ค่าคงที่เกณฑ์ ----------
const c = Store.getWk5Criteria();
ok(c.passLevel === 3 && c.passPercent === 60, 'criteria constants 3 / 60%');

console.log(`wk5 form: ${n} assertions passed`);