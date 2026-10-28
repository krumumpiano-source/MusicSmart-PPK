// ภาคเรียนและรหัสวิชาเปลี่ยนเองตามวันที่ (จำลองวันที่) — ไม่ฝังในโค้ด; ข้อมูลเก่าคงตราภาคเรียนเดิม
global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, clear() { this._d = {}; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
const Store = require('../app/data/store.js');
global.Store = Store;
let n = 0, bad = [];
function ok(c, m) { n++; if (!c) bad.push(m); }
const D = s => new Date(s + 'T12:00:00+07:00');
function reset() { localStorage.clear(); if (Store._cache && Store._cache.clear) Store._cache.clear(); Store._termAppliedKey = null; }

// 1) ปฏิทินเริ่มต้น: วันที่ -> (ปี, ภาค, รหัสวิชา)
reset();
const cases = [
  ['2026-05-20', '2569', '1', 'ศ21101', 'ศ22101'],
  ['2026-10-16', '2569', '1', 'ศ21101', 'ศ22101'],
  ['2026-10-28', '2569', '2', 'ศ21102', 'ศ22102'],
  ['2027-03-31', '2569', '2', 'ศ21102', 'ศ22102'],
  ['2027-06-01', '2570', '1', 'ศ21101', 'ศ22101'],   // ปฏิทินต่อปีถัดไปอัตโนมัติ (projected)
  ['2027-11-01', '2570', '2', 'ศ21102', 'ศ22102'],
];
for (const [d, y, t, c1, c2] of cases) {
  const i = Store.getSemesterInfo(D(d));
  ok(String(i.year) === y && String(i.term) === t, `${d}: expected ${t}/${y}, got ${i.term}/${i.year}`);
  ok(Store.getSubjectCode('ม.1', D(d)) === c1, `${d}: M1 code ${c1}, got ${Store.getSubjectCode('ม.1', D(d))}`);
  ok(Store.getSubjectCode('M1', D(d)) === c1, `${d}: 'M1' key works`);
  ok(Store.getSubjectCode('ม.2', D(d)) === c2, `${d}: M2 code ${c2}`);
}
ok(Store.getSemesterInfo(D('2027-06-01')).projected === true, 'ปีถัดไปถูกทำเครื่องหมาย projected (ให้ครูตรวจวันเริ่ม/จบ)');
ok(Store.getSemesterInfo(D('2026-10-28')).projected === false, 'ปีปัจจุบันไม่ใช่ projected');

// 2) ครูแก้ปฏิทินได้ -> ระบบตามทันที
reset();
let cfg = Store.getTermConfig();
cfg.terms = cfg.terms.map(t => ({ ...t }));
const t2 = cfg.terms.find(t => String(t.term) === '2' && String(t.year) === '2569');
ok(!!t2, 'พบภาคเรียน 2/2569 ในค่าตั้งต้น');
if (t2) {
  t2.start = '2026-11-02';
  Store.saveTermConfig(cfg);
  ok(String(Store.getSemesterInfo(D('2026-10-28')).term) === '1', 'ครูเลื่อนวันเปิดภาค 2 -> 28 ต.ค. ยังเป็นภาค 1');
  ok(Store.getSubjectCode('ม.1', D('2026-10-28')) === 'ศ21101', 'รหัสวิชาตามภาคที่เลื่อน');
}

// 3) override ของครู: เปิด/ปิด/หมดอายุ
reset();
cfg = Store.getTermConfig();
cfg.override = { enabled: true, year: 2569, term: 1, until: null };
Store.saveTermConfig(cfg);
let i = Store.getSemesterInfo(D('2026-10-28'));
ok(String(i.term) === '1' && i.source === 'override', 'override เปิด -> ภาค 1 ทั้งที่ปฏิทินเป็นภาค 2');
ok(Store.getSubjectCode('ม.1', D('2026-10-28')) === 'ศ21101', 'รหัสวิชาตาม override');
cfg.override.until = '2026-10-20';
Store.saveTermConfig(cfg);
i = Store.getSemesterInfo(D('2026-10-28'));
ok(String(i.term) === '2' && i.source !== 'override', 'override หมดอายุ (until ผ่านแล้ว) -> กลับไปตามปฏิทิน');
cfg.override = { enabled: false, year: 2569, term: 1, until: null };
Store.saveTermConfig(cfg);
ok(String(Store.getSemesterInfo(D('2026-10-28')).term) === '2', 'override ปิด -> ตามปฏิทิน');

// 4) คำนำหน้ารหัสวิชาของชั้น + override รหัสวิชา แก้ได้โดยครู
reset();
cfg = Store.getTermConfig();
cfg.subjectPrefixByGrade = { ...cfg.subjectPrefixByGrade, 'ม.1': 'ศ3110' };
Store.saveTermConfig(cfg);
ok(Store.getSubjectCode('ม.1', D('2026-10-28')) === 'ศ31102', 'เปลี่ยนคำนำหน้าชั้น -> รหัสใหม่ตามภาค');
cfg.subjectCodeOverride = { 'ม.1': 'ศ99999' };
Store.saveTermConfig(cfg);
ok(Store.getSubjectCode('ม.1', D('2026-10-28')) === 'ศ99999', 'override รหัสวิชาของครูมาก่อนเสมอ');
ok(Store.getSubjectCode('ม.2', D('2026-10-28')) === 'ศ22102', 'ชั้นอื่นไม่กระทบ');

// 5) ข้อความหลักสูตร ม.1 ปรับตามภาค/รหัส ทั้งไปและกลับ
reset();
const dump = () => JSON.stringify(LESSONS_DATA.M1) + JSON.stringify(WK5_PLANS.M1);
Store.applyTermToStaticData(D('2027-06-01'));
let txt = dump();
ok(/ศ21101/.test(txt) && !/ศ21102/.test(txt), 'ภาค 1: ข้อความ ม.1 ใช้ ศ21101 ทั้งหมด');
ok(!/ภาคเรียนที่ 2/.test(txt), 'ภาค 1: ไม่มี "ภาคเรียนที่ 2" ค้าง');
Store.applyTermToStaticData(D('2026-10-28'));
txt = dump();
ok(/ศ21102/.test(txt) && !/ศ21101/.test(txt), 'ภาค 2: ข้อความ ม.1 เปลี่ยนเป็น ศ21102 ทั้งหมด');
ok(!/ภาคเรียนที่ 1(?!\d)/.test(txt.replace(/ภาคเรียนที่ 1[0-9]/g, '')), 'ภาค 2: ไม่มี "ภาคเรียนที่ 1" ค้าง');
ok(Store.applyTermToStaticData(D('2026-10-28')) === false, 'เรียกซ้ำ ไม่ทำงานซ้ำ (idempotent)');
// ข้อความไม่มีปีเก่าค้างหลังขึ้นปีใหม่
Store.applyTermToStaticData(D('2027-11-01'));
txt = dump();
ok(!/2569/.test(txt), 'ขึ้นปี 2570: ไม่มี 2569 ค้างในข้อความหลักสูตร ม.1');
ok(/ศ21102/.test(txt), 'ปี 2570 ภาค 2 ใช้ ศ21102');
Store.applyTermToStaticData(D('2026-10-28'));

// 6) ขึ้นเทอมใหม่ -> เก็บข้อมูลเดิม (archive) พร้อมตราภาคเดิม ไม่ลบ
reset();
Store.autoRolloverIfNeeded(D('2026-05-20'));
let meta = Store.getSemesterMeta();
ok(meta.activeId === '2569_1', `เริ่มด้วยภาค 1/2569 (got ${meta.activeId})`);
const r = Store.autoRolloverIfNeeded(D('2026-10-28'));
meta = Store.getSemesterMeta();
ok(r.changed === true && meta.activeId === '2569_2', 'ขึ้นภาค 2 อัตโนมัติเมื่อถึงวัน');
ok(meta.archives && meta.archives['2569_1'] && meta.archives['2569_1'].term === '1', 'ข้อมูลภาค 1 ถูกเก็บใน archive พร้อมตราภาคเดิม');
ok(Store.autoRolloverIfNeeded(D('2026-10-29')).changed === false, 'วันถัดไปไม่ขึ้นภาคซ้ำ');
cfg = Store.getTermConfig(); cfg.autoRollover = false; Store.saveTermConfig(cfg);
ok(Store.autoRolloverIfNeeded(D('2027-11-01')).changed === false, 'ปิด autoRollover -> ไม่ขึ้นเอง');

console.log(`term auto-switch: ${n} checks, ${bad.length} failed`);
bad.forEach(b => console.log('  FAIL: ' + b));
process.exit(bad.length ? 1 : 0);
