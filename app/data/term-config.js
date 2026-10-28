// MusicSmart PPK — ค่ากำหนดปีการศึกษา/ภาคเรียน/รหัสวิชา (แหล่งข้อมูลเดียว)
// ---------------------------------------------------------------------------
// ภาคเรียน ปีการศึกษา และรหัสวิชา "คำนวณจากวันที่ปัจจุบัน" + ค่าที่ครูกำหนดในหน้า "ตั้งค่าภาคเรียน/รหัสวิชา"
// ห้ามพิมพ์เลขภาคเรียน/ปี/รหัสวิชาลงในโค้ดอื่น — เรียกผ่าน Store.getSemesterInfo() / Store.getCurrentSubject()
//
// กติกา
//  1) ภาคเรียนปัจจุบัน = ภาคเรียนล่าสุดที่ "วันเริ่ม" <= วันนี้ (เวลาไทย) — ช่วงปิดเทอมจึงยังเป็นภาคเดิมจนกว่าภาคใหม่จะเริ่ม
//  2) เมื่อวันนี้เลยปฏิทินที่กรอกไว้ ระบบ "ต่อปฏิทิน" ให้อัตโนมัติ โดยเลื่อนปฏิทินปีล่าสุดไปปีละ +1 ปี (ปีการศึกษา +1)
//     (ครูแก้วันเริ่ม/จบภาคเรียนจริงของแต่ละปีได้เสมอ ค่าที่ครูกรอกมีผลก่อนค่าที่ต่อให้)
//  3) รหัสวิชา = คำนำหน้าของชั้น + เลขภาคเรียน เช่น ม.1: ศ2110 + 2 = ศ21102
//  4) ครูตั้ง "override" บังคับภาค/ปีได้ (ระบุวันหมดอายุได้) — ไม่ลบข้อมูลภาคเรียนเก่า (ข้อมูลเก่าคงตราภาคเรียนเดิมใน archive)
//
// ⚠ วันเริ่ม/จบภาคเรียนด้านล่างเป็น "ค่าเริ่มต้นชั่วคราว" ยังไม่ได้ยืนยันกับปฏิทินการศึกษาของโรงเรียน — ครูต้องตรวจ/แก้
// บล็อก JSON ด้านล่างต้องเป็น JSON ล้วน (สคริปต์ Python tools/curriculum/patch_m1_docx.py อ่านบล็อกนี้)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TermConfig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = /*TERM_CONFIG_JSON*/ {
  "schemaVersion": 1,
  "calendarStatus": "ค่าเริ่มต้นชั่วคราว ยังไม่ยืนยันกับปฏิทินการศึกษา — ครูต้องตรวจและแก้ไข",
  "terms": [
    { "year": 2569, "term": 1, "start": "2026-05-18", "end": "2026-10-16" },
    { "year": 2569, "term": 2, "start": "2026-10-19", "end": "2027-03-31" }
  ],
  "projectAheadYears": 12,
  "subjectPrefixByGrade": { "ม.1": "ศ2110", "ม.2": "ศ2210" },
  "subjectCodeOverride": {},
  "override": { "enabled": false, "year": null, "term": null, "until": null },
  "autoRollover": true
  } /*END_TERM_CONFIG_JSON*/;

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const clone = o => JSON.parse(JSON.stringify(o));

  // วันที่ (YYYY-MM-DD) ตามเวลาไทย UTC+7 ของช่วงเวลา now
  function bangkokDay(now) {
    const d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function shiftYears(iso, k) {
    const y = +iso.slice(0, 4) + k, m = iso.slice(5, 7); let dd = iso.slice(8, 10);
    if (m === '02' && dd === '29') { const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; if (!leap) dd = '28'; }
    return `${String(y).padStart(4, '0')}-${m}-${dd}`;
  }

  // รวมค่าที่ครูแก้ (saved) ทับค่าเริ่มต้น แล้วตรวจความถูกต้อง
  function normalize(saved) {
    const cfg = clone(DEFAULTS);
    if (saved && typeof saved === 'object') {
      if (Array.isArray(saved.terms) && saved.terms.length) cfg.terms = saved.terms;
      if (saved.subjectPrefixByGrade && typeof saved.subjectPrefixByGrade === 'object') cfg.subjectPrefixByGrade = { ...cfg.subjectPrefixByGrade, ...saved.subjectPrefixByGrade };
      if (saved.subjectCodeOverride && typeof saved.subjectCodeOverride === 'object') cfg.subjectCodeOverride = { ...saved.subjectCodeOverride };
      if (saved.override && typeof saved.override === 'object') cfg.override = { ...cfg.override, ...saved.override };
      if (typeof saved.autoRollover === 'boolean') cfg.autoRollover = saved.autoRollover;
      if (Number.isFinite(+saved.projectAheadYears)) cfg.projectAheadYears = Math.max(0, Math.min(30, +saved.projectAheadYears));
      if (saved.calendarStatus) cfg.calendarStatus = String(saved.calendarStatus);
    }
    cfg.terms = cfg.terms
      .map(t => ({ year: parseInt(t.year, 10), term: parseInt(t.term, 10), start: String(t.start || ''), end: String(t.end || '') }))
      .filter(t => t.year > 2000 && (t.term === 1 || t.term === 2 || t.term === 3) && ISO.test(t.start))
      .sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    if (!cfg.terms.length) cfg.terms = clone(DEFAULTS.terms);
    return cfg;
  }

  // รายการภาคเรียนทั้งหมด = ที่ครูกรอก + ที่ต่อให้อัตโนมัติ (projected:true)
  function allTerms(cfg) {
    cfg = cfg || normalize();
    const base = cfg.terms.slice();
    const known = new Set(base.map(t => `${t.year}_${t.term}`));
    const lastYear = Math.max(...base.map(t => t.year));
    const lastYearTerms = base.filter(t => t.year === lastYear);
    const out = base.map(t => ({ ...t, projected: false }));
    for (let k = 1; k <= (cfg.projectAheadYears || 0); k++) {
      lastYearTerms.forEach(t => {
        const key = `${t.year + k}_${t.term}`;
        if (known.has(key)) return;
        out.push({ year: t.year + k, term: t.term, start: shiftYears(t.start, k), end: t.end ? shiftYears(t.end, k) : '', projected: true });
      });
    }
    return out.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  }

  // หาภาคเรียน ณ วันที่ now ; saved = ค่าที่ครูแก้ (หรือ undefined)
  function resolve(saved, now) {
    const cfg = normalize(saved);
    const day = bangkokDay(now);
    const ov = cfg.override || {};
    if (ov.enabled && Number.isFinite(+ov.year) && (+ov.term === 1 || +ov.term === 2 || +ov.term === 3) && !(ov.until && ISO.test(ov.until) && day > ov.until)) {
      return { year: +ov.year, term: +ov.term, id: `${+ov.year}_${+ov.term}`, source: 'override', projected: false, inBreak: false, today: day };
    }
    const list = allTerms(cfg);
    let cur = list[0];
    for (const t of list) { if (t.start <= day) cur = t; else break; }
    const inBreak = !!(cur.end && day > cur.end);
    return { year: cur.year, term: cur.term, id: `${cur.year}_${cur.term}`, source: cur.projected ? 'projected' : 'calendar', projected: cur.projected, inBreak, start: cur.start, end: cur.end, today: day };
  }

  // 'ม.1/7' | 'M1' | 'ม.1' -> 'ม.1'
  function gradeKeyOf(x) {
    const m = String(x || '').match(/(?:ม\.|M)\s*(\d+)/);
    return m ? `ม.${m[1]}` : '';
  }

  // รหัสวิชาของชั้น ณ ภาคเรียน term  เช่น ('ม.1', 2) -> ศ21102
  function subjectCode(saved, grade, term) {
    const cfg = normalize(saved);
    const g = gradeKeyOf(grade);
    if (g && cfg.subjectCodeOverride && cfg.subjectCodeOverride[g]) return String(cfg.subjectCodeOverride[g]);
    const prefix = cfg.subjectPrefixByGrade[g];
    return prefix ? `${prefix}${term}` : '';
  }

  // ปรับข้อความคงที่ (เอกสาร/แผนที่สร้างไว้) ให้ตรงภาคเรียนและรหัสวิชาปัจจุบัน — ใช้กับข้อมูลหลักสูตร ม.1 เท่านั้น
  // ตัวปรับข้อความ: รหัสวิชาของชั้น + ภาคเรียน + ปีการศึกษา ให้ตรงปัจจุบัน — ใช้กับข้อมูลหลักสูตรที่สร้างไว้ล่วงหน้า (ม.1)
  const knownPrefixes = {};
  function makeNormalizer(saved, grade, now) {
    const cfg = normalize(saved);
    const r = resolve(saved, now);
    const g = gradeKeyOf(grade);
    const prefix = cfg.subjectPrefixByGrade[g];
    const code = prefix ? subjectCode(saved, grade, r.term) : '';
    // ข้อความที่สร้างไว้ล่วงหน้าใช้คำนำหน้าตั้งต้น (DEFAULTS) หรือคำนำหน้าที่เคยปรับไว้ในรอบนี้ -> รับทุกตัวแล้วแปลงเป็นรหัสปัจจุบัน
    const known = knownPrefixes[g] || (knownPrefixes[g] = new Set());
    if (DEFAULTS.subjectPrefixByGrade && DEFAULTS.subjectPrefixByGrade[g]) known.add(DEFAULTS.subjectPrefixByGrade[g]);
    if (prefix) known.add(prefix);
    const rxCode = prefix ? new RegExp('(?:' + Array.from(known).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\d', 'g') : null;
    const rxTerm = /ภาคเรียนที่\s*[123](?!\d)/g;
    const rxYear = /ปีการศึกษา\s*25\d\d/g;
    return function (t) {
      if (typeof t !== 'string' || !t) return t;
      if (rxCode) t = t.replace(rxCode, code);
      return t.replace(rxTerm, 'ภาคเรียนที่ ' + r.term).replace(rxYear, 'ปีการศึกษา ' + r.year);
    };
  }
  function normalizeText(saved, text, grade, now) { return makeNormalizer(saved, grade, now)(text); }

  // ปรับสตริงทุกตัวในโครงสร้างข้อมูล (แก้ในที่เดิม)
  function applyDeep(saved, obj, grade, now) {
    const fn = makeNormalizer(saved, grade, now);
    (function walk(o) {
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (typeof v === 'string') o[i] = fn(v); else if (v && typeof v === 'object') walk(v); } }
      else if (o && typeof o === 'object') { for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string') o[k] = fn(v); else if (v && typeof v === 'object') walk(v); } }
    })(obj);
    return obj;
  }

  return { DEFAULTS, normalize, allTerms, resolve, subjectCode, gradeKeyOf, normalizeText, applyDeep, bangkokDay };
});
