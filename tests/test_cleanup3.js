// fix_report_3: ล้างค่าที่ฮาร์ดโค้ด/เกณฑ์เก่า/IOC ที่อ้างว่าตรวจแล้ว + ปุ่มชดเชยคาบสอบ
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, clear() { this._d = {}; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
const AD = require('../app/data/academic_docs.js');
global.QUIZZES_DATA = require('../app/data/quizzes.js');
global.ACADEMIC_DOCS_BY_GRADE = AD.ACADEMIC_DOCS_BY_GRADE;
const Store = require('../app/data/store.js'); global.Store = Store;
let n = 0; const bad = [];
const ok = (c, m) => { n++; if (!c) bad.push(m); };
const rd = r => fs.readFileSync(path.join(root, r), 'utf8');

// 1) academic_docs M1: wk5 = 20 แผนใหม่, เกณฑ์ผ่านตามที่ตกลง
const M1 = AD.ACADEMIC_DOCS_BY_GRADE.M1;
ok(Array.isArray(M1.wk5) && M1.wk5.length === 20, 'academic_docs M1.wk5 มี 20 คาบ');
ok(M1.wk5.every((d, i) => Number(d.period) === i + 1), 'M1.wk5 คาบ 1..20 ครบเรียงลำดับ');
const flat = JSON.stringify(M1);
ok(!/ไม่น้อยกว่าร้อยละ 80 มีคะแนนผ่านเกณฑ์/.test(flat), 'ไม่มีเกณฑ์ผ่านเก่า "ร้อยละ 80 ... ผ่านเกณฑ์"');
ok(!/ร้อยละ 80 ขึ้นไป/.test(flat) && !/≥\s*80\s*%/.test(flat), 'ไม่มี "ร้อยละ 80 ขึ้นไป"/"≥80%" ในเอกสาร ม.1');
const r80 = flat.match(/.{0,25}ร้อยละ\s*80.{0,12}/g) || [];
ok(r80.every(s => /80\s*-\s*100/.test(s)), 'ร้อยละ 80 ที่เหลือเป็นช่วงระดับ 4 (80-100) เท่านั้น: ' + r80.filter(s => !/80\s*-\s*100/.test(s)).slice(0, 2).join('|'));
ok(/ร้อยละ 60 ได้ระดับคุณภาพ 3 ขึ้นไป/.test(flat), 'มีเกณฑ์ห้องเรียน ≥60% ระดับ 3 ขึ้นไป');
ok(!/IOC\s*(>=|≥)\s*0\.67\s*ทุกข้อ/.test(flat) && !/ผ่านการตรวจสอบความเที่ยงตรงเชิงเนื้อหา/.test(flat), 'ไม่มีข้อความอ้างว่า IOC ผ่านการตรวจแล้ว');
ok(!/ผู้เชี่ยวชาญด้านหลักสูตรและการสอนดนตรี\s*3\s*ท่าน/.test(flat), 'ไม่อ้างผู้เชี่ยวชาญ 3 ท่าน');
ok(!/จำนวน 40 ข้อ \(4 หน่วยการเรียนรู้\)(?! หน่วยละ)/.test(flat), '40 ข้อ ระบุว่าเป็นคลังท้ายหน่วย');

// 2) ไม่ผูกรหัสวิชา ศ21101 ในโค้ด (รหัสมาจาก term-config) / สคริปต์ glob โฟลเดอร์
const codeFiles = fs.readdirSync(path.join(root, 'app/js')).filter(f => f.endsWith('.js')).map(f => 'app/js/' + f).concat(['app/data/store.js', 'app/data/lessons.js', 'app/data/quizzes.js']);
codeFiles.forEach(f => { const m = (rd(f).match(/ศ2110\d/g) || []); ok(m.length === 0 || /lessons\.js$/.test(f) && m.length > 0, `${f} ไม่มีรหัสวิชา ม.1 ฮาร์ดโค้ด (${m.length})`); });
ok(!/ศ21101/.test(rd('app/data/quizzes.js').split('\n').slice(0, 6).join('\n')), 'quizzes.js header ไม่มี ศ21101');
ok(!/ศ21101/.test(rd('app/data/lessons.js').split('\n').slice(0, 6).join('\n')), 'lessons.js header ไม่มี ศ21101');
ok(!/ศ21101/.test(rd('app/js/feldman-criticism.js').split('\n').slice(0, 6).join('\n')), 'feldman header ไม่มี ศ21101');
ok(!/ศ2110\d/.test(rd('tools/curriculum/extract_wk5_docx.py')) && !/'ม\.1 ดนตรี1 ศ2110/.test(rd('tools/curriculum/patch_m1_docx.py')), 'สคริปต์ curriculum ไม่อิงรหัสในชื่อโฟลเดอร์ (glob)');
ok(/--legacy-force/.test(rd('tools/docgen/generate_submission_docs_m1.py')), 'generate_submission_docs_m1.py ถูก guard');

// 3) ปุ่มชดเชย: คาบสอบไม่ถูกให้ระดับ 1-4
const cls = 'ม.1/1';
const grade = Store.gradeKeyOf(cls);
ok(typeof Store.getPendingExamMakeups === 'function', 'มี getPendingExamMakeups');
const sample = Store.getStudents(cls); ok(sample.length > 0, 'มีนักเรียนตัวอย่าง');
const sessions = Store.getAllSessions();
[5, 11, 20].forEach(p => { sessions[Store.getSessionKey(cls, p)] = { attendance: { [sample[0].student_id]: 'absent' }, scores: {} }; });
Store.save('ppk_session_logs', sessions);
const pm = Store.getPendingMakeups(cls), pe = Store.getPendingExamMakeups(cls);
ok(!pm.some(x => x.period === 11 || x.period === 20), 'getPendingMakeups ไม่รวมคาบสอบ 11/20');
ok(pm.some(x => x.period === 5), 'getPendingMakeups ยังรวมคาบ 5 (ปกติ)');
ok(pe.some(x => x.period === 11) && pe.some(x => x.period === 20) && !pe.some(x => x.period === 5), 'getPendingExamMakeups มีเฉพาะ 11/20');
const appSrc = rd('app/js/app.js');
ok(/getPendingExamMakeups/.test(appSrc) && /ไม่ใช้ปุ่มระดับ 1-4/.test(appSrc), 'app.js แสดงหมายเหตุคาบสอบในหน้าสอบซ่อม');

if (bad.length) { console.log('FAIL ' + bad.length + '/' + n); bad.forEach(b => console.log(' - ' + b)); process.exit(1); }
console.log('test_cleanup3: ' + n + ' checks passed');
