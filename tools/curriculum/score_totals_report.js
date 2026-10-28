// สรุปผลรวมคะแนน 20 คาบ ม.1 (K/P/A) จาก 3 แหล่ง: ตารางเกณฑ์ใน วก.5 (wk5_m1_docx.json) / wk5_plans.js / lessons.js
// เทียบกับ 80+10+10 และสัดส่วน K:P:A  ใช้: node tools/curriculum/score_totals_report.js [--write]
// ไม่คำนวณเองจากตัวเลขที่ไม่มีในเอกสาร — ถ้าสามแหล่งไม่ตรงกันจะแสดง "ไม่ตรง"
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
function load() {
  var W = require(path.join(ROOT, 'app/data/wk5_plans.js')).M1, L = require(path.join(ROOT, 'app/data/lessons.js')).M1;
  var D = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/curriculum/wk5_m1_docx.json'), 'utf8')).plans;
  var rows = [], p;
  function norm(s) { return String(s || '').replace(/[\u200b\u200c\u200d\ufeff]/g, ''); }
  for (p = 1; p <= 20; p++) {
    var plan = W[String(p)], doc = D.filter(function (x) { return x.period === p; })[0], dw = { k: 0, p: 0, a: 0 }, tb = doc && doc.tables[0] || [];
    tb.forEach(function (r) {
      var c0 = norm(r[0]), n = parseFloat(norm(r[1]));
      if (/^1\. ด้านความรู้/.test(c0)) dw.k = isNaN(n) ? 0 : n;
      if (/^2\. ด้านทักษะ/.test(c0)) dw.p = isNaN(n) ? 0 : n;
      if (/^3\. ด้านคุณลักษณะ/.test(c0)) dw.a = isNaN(n) ? 0 : n;
    });
    var ls = null; Object.keys(L).forEach(function (k) { if (L[k] && L[k].period === p) ls = L[k]; });
    rows.push({ period: p, exam: p === 11 || p === 20, doc: dw, plan: plan.weights, planTotal: plan.score_total, lesson: ls && ls.assessment ? ls.assessment.max_score : null, lessonW: ls && ls.assessment ? ls.assessment.weights : null });
  }
  return rows;
}
function summarize(rows) {
  var s = { k: 0, p: 0, a: 0, formative: 0, exam: 0, lesson: 0, mismatch: [] };
  rows.forEach(function (r) {
    var dt = r.doc.k + r.doc.p + r.doc.a;
    if (r.doc.k !== r.plan.k || r.doc.p !== r.plan.p || r.doc.a !== r.plan.a || dt !== r.planTotal || dt !== r.lesson || !r.lessonW || r.lessonW.k !== r.doc.k || r.lessonW.p !== r.doc.p || r.lessonW.a !== r.doc.a) s.mismatch.push(r.period);
    s.k += r.doc.k; s.p += r.doc.p; s.a += r.doc.a;
    if (r.exam) s.exam += dt; else s.formative += dt;
    s.lesson += r.lesson || 0;
  });
  s.total = s.k + s.p + s.a;
  return s;
}
function md(rows, s) {
  var o = ['# ผลรวมคะแนน 20 คาบ ม.1 (ศ21101 ดนตรี 1) — สร้างจากเอกสาร ไม่ใช่ตัวเลขที่เดา', '',
    'แหล่งข้อมูล: ตารางเกณฑ์ในแผน วก.5 รายคาบ (คอลัมน์ "น้ำหนักคะแนน") เทียบกับ `wk5_plans.js` และ `lessons.js` — สร้างด้วย `node tools/curriculum/score_totals_report.js --write`', '',
    '| คาบ | K | P | A | รวม (วก.5) | wk5_plans | lessons | ชนิด | ตรงกัน |', '|---:|---:|---:|---:|---:|---:|---:|:--|:--|'];
  rows.forEach(function (r) {
    var dt = r.doc.k + r.doc.p + r.doc.a, ok = r.doc.k === r.plan.k && r.doc.p === r.plan.p && r.doc.a === r.plan.a && dt === r.planTotal && dt === r.lesson && r.lessonW && r.lessonW.k === r.doc.k && r.lessonW.p === r.doc.p && r.lessonW.a === r.doc.a;
    o.push('| ' + r.period + ' | ' + r.doc.k + ' | ' + r.doc.p + ' | ' + r.doc.a + ' | ' + dt + ' | ' + r.planTotal + ' | ' + r.lesson + ' | ' + (r.exam ? 'สอบ' : (dt ? 'เก็บคะแนน' : 'ไม่เก็บคะแนน')) + ' | ' + (ok ? '✓' : '✗') + ' |');
  });
  o.push('', '| รายการ | ผลจากเอกสาร | เป้าหมาย |', '|:--|---:|---:|');
  o.push('| คะแนนเก็บระหว่างภาค (คาบที่ไม่ใช่สอบ) | ' + s.formative + ' | 80 |');
  o.push('| สอบกลางภาค (คาบ 11) | ' + rows[10].planTotal + ' | 10 |');
  o.push('| สอบปลายภาค (คาบ 20) | ' + rows[19].planTotal + ' | 10 |');
  o.push('| รวมทั้งภาค | ' + s.total + ' | 100 |');
  o.push('| K : P : A | ' + s.k + ' : ' + s.p + ' : ' + s.a + ' | 34 : 46 : 20 (ข้อเสนอเดิม) |', '');
  o.push(s.mismatch.length ? '**คาบที่สามแหล่งไม่ตรงกัน: ' + s.mismatch.join(', ') + '**' : 'สามแหล่ง (วก.5 / wk5_plans / lessons) ตรงกันทุกคาบ');
  o.push('', 'หมายเหตุ: คาบ 18 ไม่เก็บคะแนน (ตามที่ครูตัดสิน) แต่เก็บผลสังเกต/งานที่ส่งเพื่อประเมินรวมในคาบ 19');
  return o.join('\n') + '\n';
}
if (require.main === module) {
  var rows = load(), s = summarize(rows), t = md(rows, s);
  if (process.argv.indexOf('--write') >= 0) fs.writeFileSync(path.join(ROOT, 'docs', 'SCORE_TOTALS_20_PERIODS_TH.md'), t);
  console.log(t);
}
module.exports = { load: load, summarize: summarize, md: md };
