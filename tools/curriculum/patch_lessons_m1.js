#!/usr/bin/env node
// ปรับ app/data/lessons.js (เฉพาะ M1 ศ2110x) ให้ตรง วก.3/4/5 ที่แก้แล้ว: ชื่อหน่วย, น้ำหนัก K/P/A ต่อคาบ, เกณฑ์คะแนน (ระดับ 1-4), ตัดเรื่อง LINE/QR,
// สัดส่วน 80+10+10 และรหัสวิชา/ภาคเรียนให้ตรงปัจจุบัน
// ใช้: node tools/curriculum/patch_lessons_m1.js [--check]   (สำรองไฟล์ก่อนเขียนเสมอ; M2 ไม่ถูกแก้)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const F = path.join(ROOT, 'app/data/lessons.js');
const src = fs.readFileSync(F, 'utf8');
const L = new Function(src + ';return LESSONS_DATA;')();
const W = new Function(fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8') + ';return WK5_PLANS;')().M1;
const OV = JSON.parse(fs.readFileSync(path.join(__dirname, 'wk5_m1_overrides.json'), 'utf8'));
const TC = require(path.join(ROOT, 'app/data/term-config.js'));
const before = JSON.stringify(L.M2);
const log = [];
function setv(obj, key, val, tag) { if (JSON.stringify(obj[key]) !== JSON.stringify(val)) { log.push(`${tag}.${key}: ${String(JSON.stringify(obj[key])).slice(0, 60)} -> ${JSON.stringify(val).slice(0, 60)}`); obj[key] = val; } }

const TEXT_RULES = [
  [/Do-Re-Mi/gi, 'Joy to the World'],  // ครูอนุมัติเปลี่ยนเพลงที่ 2 (คาบ 8/10): ห้ามมีชื่อเดิมเหลือในข้อความที่นักเรียน/ครูเห็น
  [/ เข้าไลน์กลุ่มวิชาดนตรี และ/g, ' และ'],
  [/ระบบดิจิทัล\/ไลน์กลุ่มได้ถูกต้อง/g, 'ระบบดิจิทัลได้ถูกต้อง'],
  [/สแกน QR Code เข้า LINE กลุ่มวิชาดนตรีประจำห้องเรียนเพื่อใช้ติดต่อสื่อสาร, /g, ''],
  [/สแกนเข้ากลุ่ม LINE วิชาดนตรีเพื่อใช้ติดต่อสื่อสาร พร้อมทั้งแนะนำ/g, 'ลงทะเบียนเข้าใช้งานแอป พร้อมทั้งแนะนำ'],
  [/ขั้นนำเข้าไลน์กลุ่มและแนะนำระบบ MusicSmart/g, 'ขั้นแนะนำและลงทะเบียนระบบ MusicSmart'],
  [/1\) นักเรียนสแกน QR Code เข้าร่วม LINE กลุ่มวิชาดนตรีประจำห้องเรียนเพื่อใช้ติดต่อสื่อสาร รับสื่อการเรียนรู้ และแจ้งเตือนสำคัญ 2\) ครูสาธิต/g, '1) ครูสาธิต'],
  [/3\) แนะนำแถบเมนูหลัก/g, '2) แนะนำแถบเมนูหลัก'],
  [/4\) ให้นักเรียนทุกคนทดลอง/g, '3) ให้นักเรียนทุกคนทดลอง'],
  [/นักเรียนทุกคนเข้า LINE กลุ่มและลงทะเบียนแอปได้ครบถ้วน 100%/g, 'นักเรียนลงทะเบียนแอปได้แล้ว (บันทึกผลหลังสอนด้วยตนเอง)'],
  [/\(เก็บระหว่างภาค 80 \+ สอบปลายภาค 20\)/g, '(เก็บระหว่างภาค 80 + สอบกลางภาค 10 + สอบปลายภาค 10)'],
  [/\s*(?:LINE|ไลน์)\s*กลุ่ม[^\s,;)]*/g, ''],
];
function fixStrings(o) {
  if (Array.isArray(o)) o.forEach((v, i) => { if (typeof v === 'string') o[i] = fixText(v); else if (v && typeof v === 'object') fixStrings(v); });
  else if (o && typeof o === 'object') for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string') o[k] = fixText(v); else if (v && typeof v === 'object') fixStrings(v); }
}
function fixText(t) { let r = t; for (const [rx, to] of TEXT_RULES) r = r.replace(rx, to); return r; }
const LV = { 4: 'ดีเยี่ยม', 3: 'ดี', 2: 'พอใช้', 1: 'ปรับปรุง' };
const ex = OV.exams;
L.M1.forEach(l => {
  const p = l.period, w = W[String(p)], tag = `P${p}`;
  if (!w) throw new Error('no wk5 plan for ' + p);
  const before = JSON.stringify(l);
  setv(l, 'unit_name', w.unit_name, tag);
  setv(l, 'topic', w.topic, tag);
  if (OV.aids && OV.aids[String(p)]) setv(l, 'aids', OV.aids[String(p)], tag);
  fixStrings(l);
  const a = l.assessment || (l.assessment = {});
  setv(a, 'max_score', w.score_total, tag + '.assessment');
  setv(a, 'has_score', w.score_total > 0, tag + '.assessment');
  setv(a, 'weights', w.weights, tag + '.assessment');
  const e = ex[String(p)];
  if (e) {
    setv(a, 'type', 'quiz', tag + '.assessment');
    const per = e.points / e.items; // 0.5 คะแนน/ข้อ
    a.rubrics = [4, 3, 2, 1].map(lv => {
      const [mn, mx] = e.bands[String(lv)];
      const rng = (x, y) => (x === y ? `${x}` : `${x}-${y}`);
      const pct = Math.round(mn / e.items * 100) + (mx === mn ? '' : '-' + Math.round(mx / e.items * 100)) + '%';
      return { level: lv, label: `${LV[lv]} (ระดับ ${lv})`, score: rng(+(mn * per).toFixed(2), +(mx * per).toFixed(2)),
        desc: lv === 1 ? `ตอบถูกน้อยกว่า ${mx + 1} ข้อ จาก ${e.items} ข้อ (ต่ำกว่า 50%) — ไม่ผ่านเกณฑ์ ต้องสอบซ่อม (ครูอนุมัติสิทธิ์สอบซ่อมในระบบ)`
          : `ตอบถูก ${rng(mn, mx)} ข้อ จาก ${e.items} ข้อ (${pct})` };
    });
  } else if (a.has_score && Array.isArray(a.rubrics)) {
    a.rubrics = a.rubrics.map((r, i) => {
      const lv = 4 - i; const sc = +(w.score_total * lv / 4).toFixed(2);
      return { level: lv, label: `${LV[lv]} (ระดับ ${lv} = ${sc} คะแนน)`, score: sc, desc: fixText(r.desc || '') };
    });
  }
  if (JSON.stringify(l) !== before) log.push(`${tag}: updated`);
});
TC.applyDeep(null, L.M1, 'ม.1', new Date());
if (JSON.stringify(L.M2) !== before) throw new Error('M2 changed unexpectedly');
const out = src.slice(0, src.indexOf('const LESSONS_DATA')) + 'const LESSONS_DATA = ' + JSON.stringify(L, null, 2) + ';\n\nif (typeof module !== \'undefined\' && module.exports) {\n  module.exports = LESSONS_DATA;\n}\n';
if (process.argv.includes('--check')) { console.log(out === src ? 'lessons.js up to date' : 'lessons.js needs patch'); process.exit(out === src ? 0 : 1); }
const bk = path.join(ROOT, 'scratch', 'lessons_backup_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.js');
fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.writeFileSync(bk, src);
fs.writeFileSync(F, out);
const lp = path.join(__dirname, 'logs', 'patch_lessons_m1_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.txt');
fs.writeFileSync(lp, log.join('\n') + '\n'); console.log('patched; backup', bk, '; log', lp, '; changes', log.length);
