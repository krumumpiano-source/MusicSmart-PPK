#!/usr/bin/env node
/*
 * ปรับ app/data/academic_docs.js (เฉพาะส่วน ม.1) + คอมเมนต์หัวไฟล์ + สคริปต์ที่อิงชื่อโฟลเดอร์ ศ21101
 *  1) แทนที่ wk5 (แผนเก่า 18 คาบ) ของ ม.1 ด้วยแผน 20 คาบจาก tools/curriculum/wk5_m1_docx.json (ที่สกัดจาก docx ที่แก้แล้ว)
 *  2) เกณฑ์ผ่านเก่า (ร้อยละ 80) -> เกณฑ์ที่ตกลง: รายบุคคล <50% สอนซ่อม, ระดับ 3 = 70-79%, ห้องเรียน >=60% ระดับ 3 ขึ้นไป = สำเร็จ
 *  3) ข้อความ IOC/ผู้ทรงคุณวุฒิที่บอกว่าตรวจแล้ว -> "ยังไม่ดำเนินการ" (ครูกรอกเมื่อมีการตรวจจริง)
 *  4) '40 ข้อ' -> ระบุว่าเป็นคลังแบบทดสอบท้ายหน่วย (ไม่ใช่ข้อสอบกลาง/ปลายภาค)
 * ใช้: node tools/curriculum/patch_academic_docs_m1.js [--dry]   (idempotent; สำรองไฟล์ + เขียน log ใน tools/curriculum/logs/)
 * ไม่แตะส่วน ม.2
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const DRY = process.argv.includes('--dry');
const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const logDir = path.join(__dirname, 'logs'); fs.mkdirSync(logDir, { recursive: true });
const bakDir = path.join(ROOT, 'scratch', 'backup_patch_academic_docs_' + ts);
const log = [];
function rd(rel) { const t = fs.readFileSync(path.join(ROOT, rel), 'utf8'); return { t, crlf: t.includes('\r\n') }; }
function wr(rel, n, crlf) { if (DRY) return; fs.mkdirSync(bakDir, { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(bakDir, rel.replace(/[\\/]/g, '__'))); fs.writeFileSync(path.join(ROOT, rel), crlf ? n.replace(/\n/g, '\r\n') : n); }
function rep(a, rx, to, label) { let c = 0; const out = a.replace(rx, (...m) => { c++; return typeof to === 'function' ? to(...m) : to; }); log.push({ rule: label, count: c }); return out; }

// ---- 1-4: academic_docs.js M1 part
{
  const rel = 'app/data/academic_docs.js'; const { t, crlf } = rd(rel); let n = t.replace(/\r\n/g, '\n');
  const idx = n.indexOf('"grade": "มัธยมศึกษาปีที่ 2"'); if (idx < 0) throw new Error('no M2 marker');
  let a = n.slice(0, idx); const b = n.slice(idx);
  // 1) wk5
  const s = a.indexOf('"wk5": ['); if (s < 0) throw new Error('no wk5');
  let i = a.indexOf('[', s), depth = 0, inStr = false, e = -1;
  for (let k = i; k < a.length; k++) { const ch = a[k]; if (inStr) { if (ch === '\\') k++; else if (ch === '"') inStr = false; } else if (ch === '"') inStr = true; else if (ch === '[') depth++; else if (ch === ']') { depth--; if (depth === 0) { e = k; break; } } }
  const plans = JSON.parse(fs.readFileSync(path.join(__dirname, 'wk5_m1_docx.json'), 'utf8')).plans;
  const oldN = (a.slice(i, e + 1).match(/"period":/g) || []).length;
  const body = JSON.stringify(plans, null, 2).replace(/\n/g, '\n    ');
  a = a.slice(0, i) + body + a.slice(e + 1);
  log.push({ rule: 'wk5 M1 replaced from wk5_m1_docx.json', old_plans: oldN, new_plans: plans.length });
  // 2) criteria
  a = rep(a, /ไม่น้อยกว่าร้อยละ 80 มีคะแนนผ่านเกณฑ์ระดับคุณภาพดีขึ้นไป/g, 'ไม่น้อยกว่าร้อยละ 60 ได้ระดับคุณภาพ 3 ขึ้นไป (เกณฑ์ความสำเร็จระดับห้องเรียน)', 'class criterion');
  a = rep(a, /ร้อยละ 80 ขึ้นไป/g, 'ร้อยละ 70 ขึ้นไป (ระดับคุณภาพ 3 ขึ้นไป)', 'ร้อยละ 80 ขึ้นไป');
  a = rep(a, /ผ่านเกณฑ์ร้อยละ 80 จึงไปต่อ/g, 'ผ่านเกณฑ์ระดับ 3 (ร้อยละ 70 ขึ้นไป) จึงไปต่อ', 'ผ่านเกณฑ์ร้อยละ 80 จึงไปต่อ');
  a = rep(a, /ผ่านเกณฑ์ร้อยละ 80/g, 'ผ่านเกณฑ์ระดับ 3 (ร้อยละ 70 ขึ้นไป)', 'ผ่านเกณฑ์ร้อยละ 80');
  a = rep(a, /≥\s*80\s*%/g, '≥ 70% (ระดับ 3 ขึ้นไป)', '≥80%');
  // 3) IOC
  a = rep(a, /ประเมินโดยผู้เชี่ยวชาญด้านหลักสูตรและการสอนดนตรี\s*3\s*ท่าน หาค่าดัชนี IOC โดยข้อสอบที่ผ่านเกณฑ์ต้องมีค่า IOC ตั้งแต่ 0\.67 ขึ้นไปทุกข้อ/g, 'ประเมินโดยผู้ทรงคุณวุฒิ (ยังไม่ดำเนินการ — ครูกรอกจำนวนและรายชื่อผู้ประเมินเมื่อมีการตรวจจริง) หาค่าดัชนี IOC ตามเกณฑ์ที่ครูกำหนด', 'IOC method 3 experts');
  a = rep(a, /ผ่านการตรวจสอบความเที่ยงตรงเชิงเนื้อหา \(Content Validity\) ด้วยดัชนี IOC \(Index of Item-Objective Congruence >= 0\.67\)/g, 'อยู่ระหว่างรอการตรวจสอบความเที่ยงตรงเชิงเนื้อหา (Content Validity) โดยครู (ยังไม่ดำเนินการ)', 'IOC claim A');
  a = rep(a, /ผ่านการตรวจสอบความเที่ยงตรงเชิงเนื้อหา IOC >= 0\.67 ทุกข้อ/g, 'รอการตรวจสอบความเที่ยงตรงเชิงเนื้อหา (ยังไม่ดำเนินการ)', 'IOC claim B');
  a = rep(a, /\(IOC >= 0\.67 ทุกข้อ\)/g, '(รอตรวจสอบความเที่ยงตรงเชิงเนื้อหา — ยังไม่ดำเนินการ)', 'IOC claim C');
  // 4) 40 ข้อ
  a = rep(a, /จำนวน 40 ข้อ \(4 หน่วยการเรียนรู้\)/g, 'จำนวน 40 ข้อ (4 หน่วยการเรียนรู้ หน่วยละ 10 ข้อ — คลังแบบทดสอบท้ายหน่วยสำหรับฝึก ไม่ใช่ข้อสอบกลางภาค/ปลายภาค ซึ่งมีภาคละ 20 ข้อ)', '40 ข้อ clarify');
  // header comment
  a = rep(a, /\(ศ21101 ดนตรี 1 - 79 ไฟล์\)/g, '(ม.1 ดนตรี 1 — รหัสวิชาคำนวณจาก term-config.js - 79 ไฟล์)', 'header comment');
  wr(rel, a + b, crlf);
}
// ---- header comments in other files
function edit(rel, pairs) { const { t, crlf } = rd(rel); let n = t.replace(/\r\n/g, '\n'); for (const [rx, to, label] of pairs) n = rep(n, rx, to, rel + ': ' + label); wr(rel, n, crlf); }
edit('app/data/lessons.js', [[/\(M\.1 ศ21101 & M\.2 ศ22102\)/, '(M.1 & M.2 — รหัสวิชา/ภาคเรียนคำนวณจาก term-config.js)', 'header']]);
edit('app/data/quizzes.js', [[/วิชา ศ21101 ดนตรี 1 ชั้น ม\.1/, 'วิชาดนตรี 1 ชั้น ม.1 (รหัสวิชาคำนวณจาก term-config.js)', 'header code'], [/คลังข้อสอบ 40 ข้อ/, 'คลังแบบทดสอบท้ายหน่วยสำหรับฝึก 40 ข้อ (หน่วยละ 10 ข้อ — ไม่ใช่ข้อสอบกลางภาค/ปลายภาค)', 'header 40']]);
edit('app/js/feldman-criticism.js', [[/\(ดนตรี 1 ศ21101\)/, '(ดนตรี 1 ม.1 — รหัสวิชาคำนวณจาก term-config.js)', 'header']]);
// ---- scripts: find folder by glob instead of literal code
edit('tools/curriculum/extract_wk5_docx.py', [[/DEFAULT_SRC = os\.path\.join\(ROOT, 'เอกสารแผนการสอน', 'ม\.1 ดนตรี1 ศ21101', 'วก5_แผนรายคาบ_20คาบ'\)/, "def _m1_dir():\n    base = os.path.join(ROOT, 'เอกสารแผนการสอน')\n    c = sorted(glob.glob(os.path.join(base, 'ม.1 ดนตรี1 *')))\n    return c[0] if c else os.path.join(base, 'ม.1 ดนตรี1')  # ไม่ผูกกับรหัสวิชาในชื่อโฟลเดอร์\n\n\nDEFAULT_SRC = os.path.join(_m1_dir(), 'วก5_แผนรายคาบ_20คาบ')", 'glob']]);
edit('tools/curriculum/patch_m1_docx.py', [[/import argparse, datetime, json, os, re, shutil, sys/, 'import argparse, datetime, glob, json, os, re, shutil, sys', 'import glob'], [/DOC_DIR = os\.path\.join\(ROOT, 'เอกสารแผนการสอน', 'ม\.1 ดนตรี1 ศ21101'\)/, "def _m1_dir():\n    base = os.path.join(ROOT, 'เอกสารแผนการสอน')\n    c = sorted(glob.glob(os.path.join(base, 'ม.1 ดนตรี1 *')))\n    return c[0] if c else os.path.join(base, 'ม.1 ดนตรี1')  # ไม่ผูกกับรหัสวิชาในชื่อโฟลเดอร์\n\n\nDOC_DIR = _m1_dir()", 'glob']]);
{
  const rel = 'tools/docgen/generate_submission_docs_m1.py'; const { t, crlf } = rd(rel); let n = t.replace(/\r\n/g, '\n');
  if (n.includes('--legacy-force')) log.push({ rule: 'legacy guard', count: 0, note: 'already present' });
  else {
    const m = /^(import |from )/m.exec(n); if (!m) throw new Error('no import line in docgen');
    n = n.slice(0, m.index) + "import sys as _s\nif '--legacy-force' not in _s.argv:\n    _s.exit('สคริปต์เก่า (ฮาร์ดโค้ด ศ21101 / 2-2569 / LINE) — ห้ามรันซ้ำ: ใช้ tools/curriculum/patch_m1_docx.py แทน (หรือรันด้วย --legacy-force)')\n" + n.slice(m.index);
    log.push({ rule: 'legacy guard', count: 1 }); wr(rel, n, crlf);
  }
}
console.log(JSON.stringify(log, null, 1));
if (!DRY) fs.writeFileSync(path.join(logDir, 'patch_academic_docs_m1_' + ts + '.json'), JSON.stringify({ at: new Date().toISOString(), log }, null, 2));
