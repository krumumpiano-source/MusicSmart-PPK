#!/usr/bin/env node
/*
 * สร้าง app/data/wk5_plans.js จากแผนการจัดการเรียนรู้ วก.5 (18 แผน/ระดับชั้น) ใน app/data/academic_docs.js
 * - ไม่แต่งเนื้อหาเพิ่ม: ฟิลด์ใดที่ไม่พบในต้นฉบับจะเป็นค่าว่าง ([] หรือ '')
 * - ใช้: node tools/curriculum/build_wk5_data.js        (เขียนไฟล์)
 *        node tools/curriculum/build_wk5_data.js --check (ตรวจว่าไฟล์เป็นปัจจุบัน)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'app', 'data', 'academic_docs.js');
const OUT = path.join(ROOT, 'app', 'data', 'wk5_plans.js');

function loadDocs() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, 'utf8') + '\n;this.__D = ACADEMIC_DOCS_BY_GRADE;', ctx);
  return ctx.__D;
}

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const stripNum = s => clean(s).replace(/^(\d+(\.\d+)?)\s*[.)]?\s+/, '');

function parsePlan(plan, fmt) {
  const docxFmt = fmt === 'docx';
  const L = (plan.paragraphs || []).map(clean).filter(Boolean);
  const find = (prefix, from = 0) => {
    for (let i = from; i < L.length; i++) if (L[i].startsWith(prefix)) return i;
    return -1;
  };
  const between = (startPrefix, endPrefixes, from = 0) => {
    const s = find(startPrefix, from);
    if (s < 0) return { lines: [], start: -1, end: -1 };
    let e = L.length;
    for (const ep of endPrefixes) {
      const k = find(ep, s + 1);
      if (k >= 0 && k < e) e = k;
    }
    return { lines: L.slice(s + 1, e), start: s, end: e };
  };

  const out = {
    plan_no: Number(plan.period),
    unit_no: null, unit_name: '', topic: '',
    subject_group: '', level: '',
    standards: [], key_concept: '', content: [],
    objectives: { k: [], p: [], a: [] },
    competencies: [], work: [],
    activities: { note: '', intro: null, teach: null, wrap: null },
    media: [],
    assessment: { k: '', p: '', a: '' },
    tools: [],
    rubric: []
  };

  // header
  const g = L.find(t => t.startsWith('กลุ่มสาระการเรียนรู้')) || '';
  let m = g.match(/^กลุ่มสาระการเรียนรู้\s+(.+?)\s+ระดับ(.+?)\s+โรงเรียน/);
  if (m) { out.subject_group = clean(m[1]); out.level = clean(m[2]); }
  const u = L.find(t => /หน่วยการเรียนรู้ที่\s*\d+/.test(t)) || '';
  m = u.match(/หน่วยการเรียนรู้ที่\s*(\d+)\s*เรื่อง\s*(.+)$/);
  if (m) { out.unit_no = Number(m[1]); out.unit_name = clean(m[2]); }
  const t = L.find(x => /^เรื่อง\s/.test(x)) || '';
  m = t.match(/^เรื่อง\s+(.+?)\s+เวลา\s/);
  if (m) out.topic = clean(m[1]);

  // standards
  const std = between('มาตรฐานการเรียนรู้และตัวชี้วัด', ['สาระสำคัญ']).lines.join(' ');
  out.standards = docxFmt
    ? between('มาตรฐานการเรียนรู้และตัวชี้วัด', ['สาระสำคัญ']).lines.map(clean).filter(Boolean)
    : std.split(/\s+(?=ศ\s?\d+\.\d+\s)/).map(clean).filter(Boolean);

  out.key_concept = between('สาระสำคัญ', ['สาระการเรียนรู้']).lines.join(' ');
  const content = between('สาระการเรียนรู้', ['จุดประสงค์การเรียนรู้']).lines.join(' ');
  out.content = content.split(/\s+(?=\d{1,2}\.\s)/).map(stripNum).filter(Boolean);

  // objectives
  const obj = between('จุดประสงค์การเรียนรู้', ['สมรรถนะสำคัญ']).lines;
  let cur = null;
  obj.forEach(line => {
    if (/^1\.\s*ด้านความรู้/.test(line)) cur = 'k';
    else if (/^2\.\s*ด้านทักษะ/.test(line)) cur = 'p';
    else if (/^3\.\s*ด้านคุณลักษณะ/.test(line)) cur = 'a';
    else if (cur) {
      line.split(/(?<!ศ)\s+(?=\d\.\d+\s)/).forEach(x => { const v = stripNum(x); if (v) out.objectives[cur].push(v); });
    }
  });

  const comp = between('สมรรถนะสำคัญ', ['ชิ้นงาน/ภาระงาน']).lines.join(' ');
  out.competencies = comp.split(/\s+(?=\d\.\d+\s)/).map(stripNum).filter(Boolean);

  out.work = between('ชิ้นงาน/ภาระงาน', ['กิจกรรมการเรียนรู้']).lines.map(x => clean(x.replace(/^[-•]\s*/, ''))).filter(Boolean);
  if (docxFmt) {
    // ไฟล์ docx เขียนชิ้นงานหลายข้อในย่อหน้าเดียว: 1) ... 2) ...
    out.work = out.work.join(' ').split(/\s+(?=\d\)\s)/).map(x => clean(x.replace(/^\d\)\s*/, ''))).filter(Boolean);
  }

  // activities
  const actStart = find('กิจกรรมการเรียนรู้');
  if (actStart >= 0) {
    const nm = L[actStart].match(/\((.+)\)\s*$/);
    out.activities.note = nm ? clean(nm[1]) : '';
    const heads = [['intro', 'ขั้นนำเข้า'], ['teach', 'ขั้นสอน'], ['wrap', 'ขั้นสรุป']];
    const endIdx = find('สื่อ / แหล่งเรียนรู้', actStart);
    const pos = heads.map(([k, p]) => [k, find(p, actStart)]).filter(([, i]) => i >= 0 && (endIdx < 0 || i < endIdx)).sort((a, b) => a[1] - b[1]);
    pos.forEach(([k], idx) => {
      const s = pos[idx][1];
      const e = idx + 1 < pos.length ? pos[idx + 1][1] : (endIdx >= 0 ? endIdx : L.length);
      const title = L[s];
      const mm = title.match(/\((\d+)\s*นาที\)/);
      const tag = title.match(/\[(.+)\]\s*$/);
      out.activities[k] = {
        title: clean(title.replace(/\(\d+\s*นาที\)/, '').replace(/\[.+\]\s*$/, '')),
        minutes: mm ? Number(mm[1]) : null,
        tag: tag ? clean(tag[1]) : '',
        items: L.slice(s + 1, e)
      };
    });
  }

  // media
  const med = between('สื่อ / แหล่งเรียนรู้', ['การวัดและประเมินผล']).lines.join(' ');
  out.media = med.split(/\s+(?=\d{1,2}\.\s)/).map(stripNum).filter(Boolean);

  // assessment (K/P/A)
  const asm = between('การวัดและประเมินผล', ['ขั้นตอนและระเบียบวิธี', 'เครื่องมือวัด', 'เกณฑ์การประเมิน']).lines.join(' ');
  asm.split(/\s+(?=\d\.\s*ด้าน)/).forEach(x => {
    const body = clean(x).replace(/^\d\.\s*ด้าน[^:：]*[:：]\s*/, '');
    if (/ด้านความรู้/.test(x.slice(0, 40))) out.assessment.k = body;
    else if (/ด้านทักษะ/.test(x.slice(0, 40))) out.assessment.p = body;
    else if (/ด้านคุณลักษณะ/.test(x.slice(0, 40))) out.assessment.a = body;
  });

  // tools
  out.tools = between('เครื่องมือวัด', ['เกณฑ์การประเมิน']).lines.map(stripNum).filter(Boolean);

  // rubric table (skip header row + total row)
  const tb = (plan.tables && plan.tables[0]) || [];
  tb.slice(1).forEach(r => {
    if (!r || r.length < 6) return;
    if (/^สรุปรวม/.test(clean(r[0]))) return;
    out.rubric.push({
      label: clean(r[0]).replace(/^มิติที่\s*\d+\s*:\s*/, '').replace(docxFmt ? /^\d\.\s*/ : /^$/, ''),
      weight: clean(r[1]),
      levels: { 4: clean(r[2]), 3: clean(r[3]), 2: clean(r[4]), 1: clean(r[5]) }
    });
  });
  return out;
}

// แผน วก.5 ของ ม.1 (20 คาบ ตรงกับ lessons.js ทีละคาบ) — ดึงจากไฟล์ docx ด้วย extract_wk5_docx.py
const DOCX_SOURCES = { M1: path.join(__dirname, 'wk5_m1_docx.json') };
// ค่านอก docx (คาบสอบ, เกณฑ์ผ่าน, ผลรวมที่คาดหมายตาม วก.3) — ใช้ตรวจความสอดคล้องและแนบเข้า plan
const OVERRIDES_M1 = path.join(__dirname, 'wk5_m1_overrides.json');

function numWeight(s) { const v = parseFloat(String(s || '').replace(/[^0-9.]/g, '')); return Number.isFinite(v) ? v : 0; }

// น้ำหนัก K/P/A ต่อคาบ อ่านจากตารางเกณฑ์ใน docx (แถว 1-3) — "-" = 0
function weightsOf(plan) {
  const w = { k: 0, p: 0, a: 0 };
  (plan.rubric || []).forEach(r => {
    if (/ด้านความรู้/.test(r.label)) w.k = numWeight(r.weight);
    else if (/ด้านทักษะ/.test(r.label)) w.p = numWeight(r.weight);
    else if (/ด้านคุณลักษณะ/.test(r.label)) w.a = numWeight(r.weight);
  });
  return w;
}

// ตรวจผลรวมกับ วก.3 (ผิดแล้วหยุด build เพื่อไม่ให้ข้อมูลเพี้ยนเงียบ ๆ)
function validateM1(plans, ov) {
  const errs = [];
  const exams = ov.exams || {};
  Object.keys(ov.unit_periods).forEach(u => {
    const [a, b] = ov.unit_periods[u];
    const sum = { K: 0, P: 0, A: 0 };
    for (let n = a; n <= b; n++) {
      const p = plans[n];
      if (!p) { errs.push('missing period ' + n); continue; }
      if (exams[n]) continue;
      sum.K += p.weights.k; sum.P += p.weights.p; sum.A += p.weights.a;
    }
    const exp = ov.unit_formative_expected[u];
    ['K', 'P', 'A'].forEach(d => { if (sum[d] !== exp[d]) errs.push('unit ' + u + ' ' + d + ' = ' + sum[d] + ' expected ' + exp[d]); });
    const hours = b - a + 1;
    if (hours !== ov.unit_hours[u]) errs.push('unit ' + u + ' hours ' + hours + ' expected ' + ov.unit_hours[u]);
  });
  Object.keys(exams).forEach(n => {
    const w = plans[n].weights;
    if (w.k !== exams[n].points || w.p !== 0 || w.a !== 0) errs.push('exam period ' + n + ' weight != K' + exams[n].points);
  });
  if (errs.length) throw new Error('wk5 M1 consistency check failed: ' + errs.join('; '));
}

function build() {
  const docs = loadDocs();
  const data = {};
  for (const grade of Object.keys(docs)) {
    data[grade] = {};
    if (DOCX_SOURCES[grade] && fs.existsSync(DOCX_SOURCES[grade])) {
      JSON.parse(fs.readFileSync(DOCX_SOURCES[grade], 'utf8')).plans.forEach(p => {
        const parsed = parsePlan(p, 'docx');
        data[grade][parsed.plan_no] = parsed;
      });
      if (grade === 'M1' && fs.existsSync(OVERRIDES_M1)) {
        const ov = JSON.parse(fs.readFileSync(OVERRIDES_M1, 'utf8'));
        Object.keys(data[grade]).forEach(n => {
          const pl = data[grade][n];
          pl.weights = weightsOf(pl);
          pl.score_total = pl.weights.k + pl.weights.p + pl.weights.a;
          if (ov.exams && ov.exams[n]) pl.exam = ov.exams[n];
          if (ov.periods && ov.periods[n]) pl.period_meta = ov.periods[n];
        });
        validateM1(data[grade], ov);
      }
      continue;
    }
    (docs[grade].wk5 || []).forEach(p => {
      const parsed = parsePlan(p);
      data[grade][parsed.plan_no] = parsed;
    });
  }
  const header = [
    '// ==========================================================================',
    '// ข้อมูลแผนการจัดการเรียนรู้ วก.5 แบบมีโครงสร้าง (สร้างอัตโนมัติ — ห้ามแก้ด้วยมือ)',
    '// ม.1: จาก tools/curriculum/wk5_m1_docx.json (สกัดจาก docx วก.5 รายคาบ 20 คาบ ด้วย extract_wk5_docx.py)',
    '// ม.2: จาก app/data/academic_docs.js — สร้างด้วย: node tools/curriculum/build_wk5_data.js',
    '// ฟิลด์ที่ไม่มีในต้นฉบับเว้นว่างไว้ (ไม่แต่งเนื้อหาเพิ่ม); ม.2 คาบที่ 19-20 ไม่มีแผน วก.5',
    '// ==========================================================================',
    ''
  ].join('\n');
  return header + 'const WK5_PLANS = ' + JSON.stringify(data, null, 1) +
    ';\n\nif (typeof module !== \'undefined\' && module.exports) {\n  module.exports = WK5_PLANS;\n}\n';
}

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur.replace(/\r\n/g, '\n') === text) { console.log('wk5_plans.js is up to date'); process.exit(0); }
    console.error('wk5_plans.js is STALE — run: node tools/curriculum/build_wk5_data.js');
    process.exit(1);
  }
  fs.writeFileSync(OUT, text, 'utf8');
  console.log('wrote', path.relative(ROOT, OUT), text.length, 'chars');
}
module.exports = { build, parsePlan, weightsOf };