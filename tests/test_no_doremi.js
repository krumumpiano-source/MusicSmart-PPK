/* t49u — เพลงที่ 2 ของ ม.1 คาบ 8–10 คือ Joy to the World: ห้ามมีชื่อ "Do-Re-Mi" (เพลงมีลิขสิทธิ์) เหลือในข้อมูลที่แอปเสิร์ฟ/ข้อสอบ/ที่มาของข้อมูล
 * (ตัวสะกด "โด-เร-มี" ที่เป็นชื่อโน้ตโซลเฟจ ไม่ใช่ชื่อเพลง — ไม่นับ) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, ok) { if (ok) pass++; else { fail++; console.log('FAIL: ' + n); } }
const FILES = [
  'app/data/wk5_plans.js', 'app/data/lessons.js', 'app/data/kalimba_media.js', 'app/data/media_manifest.js', 'app/data/academic_docs.js',
  'app/data/quizzes.js', 'app/data/ensemble_data.js',
  'app/media/m1/p08/README.txt', 'app/media/m1/p10/README.txt',
  'tools/curriculum/wk5_m1_docx.json', 'tools/curriculum/wk5_m1_overrides.json',
  'tools/curriculum/kalimba_media_source.json', 'tools/curriculum/period_media_source.json',
  'tools/exams_private/m1_midterm_bank.json'
];
FILES.forEach(f => {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) return; // ไฟล์ส่วนตัว/ที่ไม่มีในบางเครื่อง
  // ชื่อไฟล์สื่อภายใน (เช่น sheet_ode_to_joy_doremi.pdf) เป็นรหัสเส้นทางสื่อ ไม่แสดงต่อผู้ใช้ — ไม่นับ
  const t = fs.readFileSync(fp, 'utf8').replace(/[\w\/.-]*doremi[\w.-]*\.pdf/gi, '');
  check(f + ' ไม่มี "Do-Re-Mi"', !/Do[-_ ]?Re[-_ ]?Mi/i.test(t));
});
const W = new Function(fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8') + ';return WK5_PLANS;')().M1;
check('wk5_plans P8 มี Joy to the World', /Joy to the World/.test(JSON.stringify(W['8'])));
check('wk5_plans P10 มี Joy to the World', /Joy to the World/.test(JSON.stringify(W['10'])));
console.log('test_no_doremi: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
