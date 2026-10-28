// ข้อมูลโปรแกรม ม.1 ต้องตรง วก.3/4/5 (คะแนน K:P:A, ชื่อหน่วย, ชั่วโมง, รูบริก) และไม่มีข้อความที่ไม่ได้ตรวจสอบ/ค้างภาคเรียนเก่า
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, clear() { this._d = {}; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
const AD = require('../app/data/academic_docs.js');
const QUIZ = require('../app/data/quizzes.js');
global.QUIZZES_DATA = QUIZ;
global.ACADEMIC_DOCS_BY_GRADE = AD.ACADEMIC_DOCS_BY_GRADE;
const Store = require('../app/data/store.js');
global.Store = Store;
let n = 0, bad = [];
function ok(c, m) { n++; if (!c) bad.push(m); }
const M = WK5_PLANS.M1, L = LESSONS_DATA.M1;
const LP = p => L.find(x => x && x.period === p);
const NOW = new Date('2026-10-28T12:00:00+07:00');
Store.applyTermToStaticData(NOW);

// --- วก.3: หน่วย/ชั่วโมง/ชื่อหน่วย ---
const UNITS = { 1: ['พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า', [1, 2, 3, 4, 5, 6, 7]], 2: ['บทเพลงและการประพันธ์เนื้อร้องสร้างสรรค์', [8, 9, 10, 11]], 3: ['วงดนตรีไทยและวงดนตรีสากล', [12, 13, 14, 15]], 4: ['การวิเคราะห์วิจารณ์และอิทธิพลของดนตรีต่อสังคม', [16, 17, 18, 19, 20]] };
ok(Object.keys(M).length === 20, 'แผน ม.1 มี 20 คาบ');
for (const u of [1, 2, 3, 4]) {
  const [name, ps] = UNITS[u];
  ok(ps.length === [7, 4, 4, 5][u - 1], `หน่วย ${u} มี ${[7, 4, 4, 5][u - 1]} ชั่วโมง`);
  ps.forEach(p => {
    ok(M[p] && M[p].unit_no === u, `คาบ ${p} อยู่หน่วย ${u}`);
    ok(M[p] && M[p].unit_name === name, `คาบ ${p} ชื่อหน่วยตรง วก.3 (${name})`);
    ok(LP(p) && LP(p).unit_no === u && LP(p).unit_name === name, `lessons คาบ ${p} หน่วยและชื่อหน่วยตรง วก.3`);
  });
}
const qt = (QUIZ.units || []).map(x => x.title);
[1, 2, 3, 4].forEach(u => ok(qt[u - 1] === UNITS[u][0], `quizzes.js หน่วย ${u} ชื่อตรง วก.3 (got ${qt[u - 1]})`));
const appSrc = fs.readFileSync(path.join(root, 'app/js/app.js'), 'utf8');
[2, 3, 4].forEach(u => ok(appSrc.includes(UNITS[u][0]), `app.js fallback ชื่อหน่วย ${u} ตรง วก.3`));

// --- คะแนนต่อคาบ (K/P/A) ---
const SPEC = { 3: [1, 2, 1], 4: [1, 2, 1], 5: [1, 2, 1], 6: [1, 2, 1], 7: [0, 4, 0], 9: [1, 7, 2], 10: [1, 7, 2], 13: [2, 5, 3], 15: [2, 5, 3], 17: [2, 5, 3], 19: [2, 5, 3], 11: [10, 0, 0], 20: [10, 0, 0] };
let sumK = 0, sumP = 0, sumA = 0;
for (let p = 1; p <= 20; p++) {
  const spec = SPEC[p] || [0, 0, 0];
  const w = Store.getPeriodWeights('M1', p);
  ok(w && w.k === spec[0] && w.p === spec[1] && w.a === spec[2], `คาบ ${p} น้ำหนัก K/P/A = ${spec.join('/')} (store: ${w && [w.k, w.p, w.a].join('/')})`);
  const pw = M[p].weights;
  ok(pw && pw.k === spec[0] && pw.p === spec[1] && pw.a === spec[2], `wk5_plans คาบ ${p} น้ำหนักตรงกับ store`);
  ok(M[p].score_total === spec[0] + spec[1] + spec[2], `คาบ ${p} score_total = ${spec[0] + spec[1] + spec[2]}`);
  ok(Array.isArray(M[p].rubric) && M[p].rubric.length === 4, `คาบ ${p} รูบริก 4 แถว (K,P,A,สมรรถนะ)`);
  sumK += spec[0]; sumP += spec[1]; sumA += spec[2];
}
ok(sumK === 34 && sumP === 46 && sumA === 20, `K:P:A รวม 34:46:20 (นับข้อสอบเป็น K) ได้ ${sumK}:${sumP}:${sumA}`);
const UT = { 1: [1, 2, 3, 4, 5, 6, 7], 2: [8, 9, 10], 3: [12, 13, 14, 15], 4: [16, 17, 18, 19] };
for (const u in UT) {
  const s = UT[u].reduce((a, p) => a + (SPEC[p] ? SPEC[p][0] + SPEC[p][1] + SPEC[p][2] : 0), 0);
  ok(s === 20, `หน่วย ${u} รวม 20 คะแนน (ได้ ${s})`);
}
const T = Store.getKPATotals('M1');
ok(T.formative === 80 && T.midterm === 10 && T.final === 10 && T.total === 100, 'ระหว่างภาค 80 + กลางภาค 10 + ปลายภาค 10 = 100');
ok(T.K === 14 && T.P === 46 && T.A === 20, 'K/P/A ระหว่างภาค = 14/46/20 (ไม่รวมข้อสอบ)');
ok(JSON.stringify(Store.getExamPeriods('M1')) === '[11,20]', 'คาบสอบ = 11 และ 20');
ok(Store.levelPoints('M1', 9, 4) === 10 && Store.levelPoints('M1', 9, 2) === 5 && Store.levelPoints('M1', 3, 3) === 3, 'คะแนน = น้ำหนัก × ระดับ/4');
ok(Store.levelPoints('M1', 7, 4) === 4, 'คาบ 7 (สอบปฏิบัติเดี่ยว) เต็ม 4 คะแนน (P4)');

// --- เกณฑ์ข้อสอบ ---
const band = c => Store.examLevel(c, 20);
ok(band(20) === 4 && band(16) === 4 && band(15) === 3 && band(14) === 3 && band(13) === 2 && band(10) === 2 && band(9) === 1 && band(0) === 1, 'เกณฑ์ข้อสอบ 16-20→4, 14-15→3, 10-13→2, <10→1');

// --- ข้อความเฉพาะคาบ ---
ok(/คาบ(ที่)? 2-9/.test(JSON.stringify(M[11])), 'คาบ 11 ระบุขอบเขตสอบ "คาบ 2-9"');
ok(/1\/3/.test(JSON.stringify(M[20])), 'คาบ 20 มีตัวชี้วัด ม.1/3');
ok(/สังเกต/.test(JSON.stringify(M[1])) && M[1].score_total === 0, 'คาบ 1 ปฐมนิเทศ ไม่มีคะแนน (สังเกตเท่านั้น)');

// --- สอบเข้าสมุดคะแนนโดยไม่เลื่อนคาบ ---
localStorage.clear(); if (Store._cache && Store._cache.clear) Store._cache.clear();
const before = JSON.stringify(Store.getClassProgress('ม.1/1'));
const r1 = Store.applyExamResults('ม.1/1', 'midterm', [{ studentId: '90001', points: 8.5, correct: 17, items: 20, level: 4, attemptNo: 1 }, { studentId: '90002', points: 99, correct: 20, items: 20, level: 4, attemptNo: 1 }]);
const r2 = Store.applyExamResults('ม.1/1', 'final', [{ studentId: '90001', points: 6, correct: 12, items: 20, level: 2, attemptNo: 1 }]);
ok(r1.applied === 2 && r1.period === 11, 'ผลกลางภาคเข้าคาบ 11');
ok(r2.applied === 1 && r2.period === 20, 'ผลปลายภาคเข้าคาบ 20');
const s11 = Store.getSession('ม.1/1', 11), s20 = Store.getSession('ม.1/1', 20);
ok(s11 && s11.scores['90001'] === 8.5 && s11.scores['90002'] === 10, 'คะแนนกลางภาคถูกบันทึก และจำกัดไม่เกิน 10');
ok(s20 && s20.scores['90001'] === 6, 'คะแนนปลายภาคถูกบันทึก');
ok(JSON.stringify(Store.getClassProgress('ม.1/1')) === before, 'บันทึกผลสอบไม่เลื่อนคาบของห้อง');

// --- ไม่มีข้อความที่ไม่ได้ตรวจสอบ / LINE / QR ---
const M1docs = JSON.stringify(AD.ACADEMIC_DOCS_BY_GRADE.M1);
const blobs = {
  'lessons M1': JSON.stringify(L), 'wk5_plans M1': JSON.stringify(M), 'quizzes': JSON.stringify(QUIZ), 'academic_docs M1': M1docs,
  'official-forms.js': fs.readFileSync(path.join(root, 'app/js/official-forms.js'), 'utf8'),
  'rubric-matrix.js': fs.readFileSync(path.join(root, 'app/js/rubric-matrix.js'), 'utf8'),
  'app.js': appSrc, 'index.html': fs.readFileSync(path.join(root, 'app/index.html'), 'utf8'),
};
const RX_LINE = /\bLINE\b|(?<![ฟน])ไลน์|\bQR\b|คิวอาร์|line\.me|\bLine OA\b/;
for (const k in blobs) ok(!RX_LINE.test(blobs[k]), `${k}: ไม่มี LINE/QR (${(blobs[k].match(RX_LINE) || [''])[0]})`);
for (const k of ['lessons M1', 'wk5_plans M1', 'academic_docs M1', 'official-forms.js']) {
  ok(!/ผู้ทรงคุณวุฒิ\s*3\s*ท่าน(?!.{0,40}(ยังไม่|รอ))/.test(blobs[k]), `${k}: ไม่อ้างว่าผู้ทรงคุณวุฒิ 3 ท่านตรวจแล้ว`);
  ok(!/ความพร้อมสมบูรณ์\s*100\s*%/.test(blobs[k]), `${k}: ไม่อ้าง "ความพร้อมสมบูรณ์ 100%"`);
  ok(!/ระดับ\s*คศ\.4/.test(blobs[k]), `${k}: ไม่ใช้ป้าย "ระดับ คศ.4" (ใช้ "ระดับคุณภาพ 1-4")`);
}
// --- ไม่มีภาคเรียน/ปี/รหัสวิชาเก่าค้าง (หลังระบบปรับตามวันที่) ---
const code = Store.getSubjectCode('ม.1', NOW), info = Store.getSemesterInfo(NOW);
ok(code === 'ศ21102' && info.id === '2569_2', 'ณ 28 ต.ค. 2569 = ภาค 2 รหัส ศ21102 (คำนวณจากวันที่)');
for (const k of ['lessons M1', 'wk5_plans M1', 'academic_docs M1', 'quizzes']) {
  const codes = (blobs[k].match(/ศ2110\d/g) || []);
  ok(codes.every(c => c === code), `${k}: รหัสวิชาทุกที่ = ${code} (พบ ${[...new Set(codes)].join(',')})`);
  ok(!/ภาคเรียนที่\s*1(?!\d)/.test(blobs[k]), `${k}: ไม่มี "ภาคเรียนที่ 1" ค้าง`);
}
for (const k of ['lessons M1', 'wk5_plans M1']) ok(!/(?:ปีการศึกษา|พ\.ศ\.)\s*(?!2569)25\d\d/.test(blobs[k]), `${k}: ปีการศึกษาตรงปัจจุบัน`);

console.log(`wk5 vs ks4: ${n} checks, ${bad.length} failed`);
bad.slice(0, 40).forEach(b => console.log('  FAIL: ' + b));
process.exit(bad.length ? 1 : 0);
