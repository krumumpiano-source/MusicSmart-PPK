// หน้าให้คะแนนหน้างาน (วก.5): น้ำหนัก/ระดับต่อคาบ, ไม่มีการให้คะแนนอัตโนมัติจากข้อมูลฝึก, บันทึกหมายเหตุ, ไปคนถัดไป
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const st = {};
global.window = global;
global.localStorage = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
global.Store = require('../app/data/store.js');
const els = {};
global.document = { getElementById: id => els[id] || null, querySelectorAll: () => [] };
const RM = require('../app/js/rubric-matrix.js');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const root = path.join(__dirname, '..');

const grade = 'M1';
const kalimbaPeriods = [2, 3, 4, 5, 6, 7, 8, 9, 10];
for (const p of kalimbaPeriods) {
  const rows = RM.getWk5Rows(p, grade);
  ok(rows && rows.length >= 3, `P${p}: มีแถวเกณฑ์จาก วก.5`);
  const w = Store.getPeriodWeights(grade, p) || { k: 0, p: 0, a: 0, total: 0 };
  const byDim = d => rows.filter(r => r.dim === d).reduce((s, r) => s + r.weight, 0);
  ok(byDim('K') === w.k && byDim('P') === w.p && byDim('A') === w.a, `P${p}: น้ำหนัก K/P/A ในหน้าให้คะแนน = วก.5 (${w.k}/${w.p}/${w.a})`);
  RM.activeGrade = grade; RM.activePeriod = p; RM.activeRows = rows;
  RM.selectedLevels = {}; rows.forEach((r, i) => { RM.selectedLevels[i] = 4; });
  let c = RM.computeScore();
  ok(c.sum === w.total && c.maxRaw === w.total && c.complete, `P${p}: ระดับ 4 ทุกแถว = เต็ม ${w.total}`);
  rows.forEach((r, i) => { RM.selectedLevels[i] = 3; });
  c = RM.computeScore();
  ok(Math.abs(c.sum - w.total * 0.75) < 0.011, `P${p}: ระดับ 3 = 75% ของ ${w.total}`);
  RM.selectedLevels = {};
  c = RM.computeScore();
  ok(w.total === 0 ? c.complete : !c.complete, `P${p}: ยังไม่เลือก → ${w.total === 0 ? 'คาบไม่มีคะแนน' : 'ไม่ครบ ห้ามบันทึก'}`);
  rows.forEach(r => ok([1, 2, 3, 4].every(l => String(r.levels[String(l)] || '').length > 0), `P${p} "${r.label}": มีคำอธิบายครบ 4 ระดับ`));
}

// P7: น้ำหนักอยู่ที่ P ทั้งหมด (4 คะแนน)
ok(Store.getPeriodWeights(grade, 7).p === 4 && Store.getPeriodWeights(grade, 7).k === 0, 'P7 น้ำหนัก P=4');
// คาบที่ไม่มีคะแนน K/P/A (P2, P8) ต้องไม่เขียนคะแนนรวมลงรายชื่อ
let setCalls = 0;
global.App = { setStudentScore: () => { setCalls++; }, renderAssessmentTab: () => {}, getClassStudents: c => Store.getStudents(c), state: {} };
const cls = Store.getAllClasses('M1')[0]; const studs = Store.getStudents(cls);
ok(studs.length >= 2, 'มีนักเรียนตัวอย่างอย่างน้อย 2 คน');
function open(sid, p) {
  RM.activeStudent = Store.getStudentById(sid); RM.activePeriod = p; RM.activeGrade = grade;
  RM.activeRows = RM.getWk5Rows(p, grade); RM.selectedLevels = {}; RM.note = ''; RM.dirty = false;
}
open(studs[0].student_id, 2);
RM.selectedLevels = { 0: 3 }; RM.note = 'ตัวอย่างหมายเหตุ';
RM.saveScore();
ok(setCalls === 0, 'P2 (วก.5 ไม่กำหนดคะแนน): ไม่เรียก setStudentScore');
let rec = Store.getStudentRubric(studs[0].student_id, 2);
ok(rec && rec.noScore === true && rec.note === 'ตัวอย่างหมายเหตุ', 'P2: บันทึกข้อสังเกต+หมายเหตุ แบบ noScore');
// P4 บันทึกพร้อมหมายเหตุ และเรียก setStudentScore ด้วยคะแนนตามน้ำหนัก
open(studs[0].student_id, 4);
RM.selectedLevels = { 0: 4, 1: 3, 2: 2 }; RM.note = 'โน้ตถูก จังหวะเร็วท้ายเพลง';
RM.saveScore();
rec = Store.getStudentRubric(studs[0].student_id, 4);
ok(setCalls === 1 && rec.sum === 3 && rec.note.indexOf('โน้ตถูก') === 0 && rec.source === 'rubric', 'P4: K4/P3/A2 = 1+1.5+0.5 = 3 พร้อมหมายเหตุ');
// ไม่ครบ → ไม่บันทึก
let alerted = 0; global.alert = () => { alerted++; };
open(studs[1].student_id, 4); RM.selectedLevels = { 0: 4 };
RM.saveScore();
ok(alerted === 1 && !Store.getStudentRubric(studs[1].student_id, 4), 'เลือกไม่ครบ → เตือนและไม่บันทึก');
// ไปคนถัดไป
global.confirm = () => true;
let opened = null; RM.openScoringModal = (sid, p) => { opened = [sid, p]; };
open(studs[0].student_id, 4);
ok(RM.goStudent(1) === true && opened[0] === studs[1].student_id && opened[1] === 4, 'ถัดไป → นักเรียนคนที่ 2 คาบเดิม');
open(studs[0].student_id, 4);
ok(RM.goStudent(-1) === false, 'คนแรก: ไม่มีย้อนกลับ');

// ไม่มีโค้ดฝึก/สื่อใดให้คะแนนเอง (BPM/จำนวนครั้ง = หลักฐานประกอบเท่านั้น)
for (const f of ['app/js/kalimba-practice.js', 'app/js/kalimba-media.js', 'app/js/student-practice.js', 'app/js/virtual-kalimba.js', 'app/js/media-views.js']) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  ok(!/setStudentScore|saveStudentRubric|recordUniformLevel|setStudentLevel/.test(t), `${f}: ไม่เรียกฟังก์ชันให้คะแนน`);
}
// ข้อความอ้างว่าประมวลผล/ให้คะแนนอัตโนมัติ (ยกเว้นข้อสอบปรนัยออนไลน์)
const banned = [/ระบบประมวลผลคะแนนอัตโนมัติ/, /ประเมินอัตโนมัติ/, /ตัดสินคะแนนอัตโนมัติ/, /AI\s*ให้คะแนน/, /ให้คะแนนจังหวะอัตโนมัติ/];
for (const f of ['app/index.html', ...fs.readdirSync(path.join(root, 'app/js')).filter(x => x.endsWith('.js')).map(x => 'app/js/' + x), 'app/data/wk5_plans.js']) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  banned.forEach(re => ok(!re.test(t), `${f}: ไม่มีข้อความ ${re}`));
}
// ข้อความหน้าให้คะแนนบอกว่าเป็นหลักฐานประกอบ ไม่ใช่คะแนน
const rmSrc = fs.readFileSync(path.join(root, 'app/js/rubric-matrix.js'), 'utf8');
ok(rmSrc.indexOf('หลักฐานประกอบ (ไม่ใช่คะแนน') > 0, 'หน้าให้คะแนนติดป้าย "หลักฐานประกอบ (ไม่ใช่คะแนน)"');
// ปุ่มแตะ ≥ 44px บนมือถือ
const css = fs.readFileSync(path.join(root, 'app/css/styles.css'), 'utf8');
ok(/\.rm-lv \{[^}]*min-height: 52px/.test(css) && /\.rm-nav-btn \{[^}]*min-height: 48px/.test(css) && /\.btn-score-choice \{ min-width: 44px; min-height: 44px; \}/.test(css), 'CSS: ปุ่มระดับ/นำทาง/ปุ่มเร็ว ≥ 44px');

// ข้อเสนอแก้เกณฑ์ (ยังไม่ใช้จริง): ก่อนแก้ตรงกับข้อมูลปัจจุบัน, หลังแก้ไม่มี ms/อัตโนมัติ และมีทั้งโน้ตและจังหวะ
const pj = JSON.parse(fs.readFileSync(path.join(root, 'docs/proposed_patches/APPLIED_wk5_rubric_teacher_observable.json'), 'utf8'));
ok(pj.status === 'APPLIED', 'ข้อเสนอแก้เกณฑ์ติดสถานะ APPLIED (ครูอนุมัติแล้ว)');
ok(fs.existsSync(path.join(root, 'docs/proposed_patches/APPLIED_wk5_rubric_teacher_observable.md')), 'มีตารางก่อน/หลัง (md)');
const pr = pj.rows.filter(r => r.kind === 'rubric');
ok(pr.length === 7, 'ครอบคลุมคาบที่มีเกณฑ์ทักษะฝึกคาลิมบ้า 7 คาบ (3-7, 9, 10)');
for (const r of pr) {
  const cur = WK5_PLANS.M1[r.period].rubric.find(x => /\(P\)/.test(x.label));
  [1, 2, 3, 4].forEach(l => {
    ok(r.after[l] === cur.levels[l], `P${r.period} L${l}: "หลังแก้" = ข้อมูลใน วก.5 ปัจจุบัน (ใช้จริงแล้ว)`);
    ok(r.before[l] !== cur.levels[l], `P${r.period} L${l}: ข้อความเดิมถูกแทนที่แล้ว`);
    ok(!/ms|มิลลิวินาที|อัตโนมัติ/i.test(r.after[l]), `P${r.period} L${l}: ข้อเสนอไม่มี ms/อัตโนมัติ`);
    ok(/ตำแหน่งลิ่ม/.test(r.after[l]) && /จังหวะ|เมโทรนอม/.test(r.after[l]), `P${r.period} L${l}: ประเมินทั้งโน้ต (ตำแหน่งลิ่ม) และจังหวะ`);
  });
}
ok(!/ms|มิลลิวินาที|อัตโนมัติ/i.test(WK5_PLANS.M1[3].rubric.map(x => JSON.stringify(x.levels)).join('')), 'วก.5 คาบ 3 ไม่มี ms/อัตโนมัติ แล้ว');
console.log(`test_scoring_ui: ${n} passed`);
