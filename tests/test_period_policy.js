/* PeriodPolicy: คาบไหนนักเรียนเห็น "งานส่ง / สอบ / ไม่มีอะไร" ต้องตรง วก.5 (WK5_PLANS) — สอบเฉพาะคาบสอบ, ไม่มีแบบทดสอบท้ายหน่วย */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
global.window = global;
const wk = fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8');
global.WK5_PLANS = new Function(wk + ';return WK5_PLANS;')();
const T = require(path.join(ROOT, 'app/data/period_policy.js'));
global.PERIOD_POLICY = T;
const PP = require(path.join(ROOT, 'app/js/period-policy.js'));
const W = WK5_PLANS.M1;
const map = PP.map('M1', 20);
check('มี 20 คาบ', map.length === 20 && map.every(Boolean));
// สอบ: เฉพาะคาบที่หัวข้อ วก.5 เป็นการสอบวัดผล
const examPeriods = map.filter(m => m.exam).map(m => m.period);
check('คาบสอบ = 11 (กลางภาค) และ 20 (ปลายภาค) เท่านั้น', JSON.stringify(examPeriods) === '[11,20]' && map[10].exam === 'midterm' && map[19].exam === 'final');
check('คาบ 7 เป็นงานเดี่ยว 4 คะแนน (ไม่ใช่สอบ)', map[6].kind === 'task' && map[6].maxScore === 4 && !map[6].exam);
// ไม่มีงาน ไม่มีสอบ → none (ไม่แสดงกล่องส่งงาน/แบบทดสอบ)
[1, 2].forEach(p => check('คาบ ' + p + ' ไม่มีงานและไม่มีสอบ (kind=none)', map[p - 1].kind === 'none' && !map[p - 1].task && !map[p - 1].practiceQuiz));
// งานที่มีคะแนนต้องตรง score_total
map.forEach(m => {
  const sc = Number(W[m.period].score_total) || 0;
  if (!m.exam) check('คาบ ' + m.period + ': มีงานคิดคะแนน ⇔ score_total>0', !!(m.task && m.task.scored) === (sc > 0), 'score_total=' + sc);
});
// งานไม่คิดคะแนนที่ประกาศไว้ ต้องมีวลีอ้างอิงใน วก.5 คาบนั้น
Object.keys(T.M1.tasks).forEach(p => {
  const ref = T.M1.tasks[p];
  check('คาบ ' + p + ' งานไม่คิดคะแนน: วลี "' + ref.phrase + '" อยู่ใน วก.5', PP.flat(W[p][ref.field]).indexOf(ref.phrase) >= 0);
  check('คาบ ' + p + ' ไม่คิดคะแนนจริง (score_total=0)', !(Number(W[p].score_total) > 0));
  check('คาบ ' + p + ' kind=task และคะแนนไม่นับ', map[p - 1].kind === 'task' && map[p - 1].task.scored === false);
});
Object.keys(T.M1.practiceQuiz).forEach(p => {
  const ref = T.M1.practiceQuiz[p];
  check('คาบ ' + p + ' แบบทบทวน: วลี "' + ref.phrase + '" อยู่ใน วก.5', PP.flat(W[p]).indexOf(ref.phrase) >= 0);
  check('คาบ ' + p + ' แบบทบทวนมีเฉพาะที่ประกาศ', !!map[p - 1].practiceQuiz);
});
check('แบบทบทวนมีเฉพาะคาบ 10 และ 19', JSON.stringify(map.filter(m => m.practiceQuiz).map(m => m.period)) === '[10,19]');
// กล่องส่งงานแสดงเฉพาะ kind=task; แบบทดสอบท้ายหน่วย (10 ข้อ/Test Blueprint) ต้องไม่อยู่ใน UI นักเรียนอีก
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
check('index.html ไม่มีข้อความ "10 ข้อ 10 คะแนน"/"Test Blueprint" ในการ์ดแบบทดสอบ', !/10 ข้อ 10 คะแนน/.test(html) && !/วัดตามพิมพ์เขียว Test Blueprint/.test(html));
check('กล่องส่งงานมี id และถูกซ่อนตามนโยบาย', /id="student-submission-box"/.test(html) && /student-submission-box/.test(app) && /pol\.kind !== 'task'/.test(app));
check('บล็อกอัปโหลดไฟล์ถูกซ่อนตามนโยบาย (fileUpload=false)', /id="student-upload-block"/.test(html) && T.M1.fileUpload === false && !/ส่งเข้า Google Drive ครู/.test(html));
check('ไม่มีรายการคาบฝังในโค้ดสำหรับกล่องส่งงาน (ไม่เขียน period===2 ฯลฯ)', !/studentPeriod\s*===?\s*[0-9]+[^;]*student-submission-box/.test(app));
console.log('test_period_policy: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
