#!/usr/bin/env node
/* สร้าง app/data/kalimba_media.js จาก tools/curriculum/kalimba_media_source.json
 *  - แปลงโน้ตไทย (ด ร ม …) → แบบจำลองโน้ต {p:[ชื่อโน้ตสากล], d:จังหวะ, th:ป้ายไทย}
 *  - ตรวจความถูกต้อง (ชื่อโน้ตอยู่ในลิ่มของคาลิมบ้า, ค่าความยาวมีสัญลักษณ์บรรทัด 5 เส้น)
 *  - จัดสถานะสื่อรายคาบ (มีไฟล์จริง / ในแอป / ไฟล์ยังไม่มี / ลิงก์เสีย / ใช้สื่อที่สร้างจากโน้ต)
 *  ใช้:  node tools/curriculum/build_kalimba_media.js           (เขียนไฟล์)
 *        node tools/curriculum/build_kalimba_media.js --check   (ตรวจว่าไฟล์ตรงกับ source; exit 1 ถ้าไม่ตรง)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(__dirname, 'kalimba_media_source.json');
const OUT = path.join(ROOT, 'app', 'data', 'kalimba_media.js');
const PUBLISH = path.join(__dirname, 'kalimba_notes_teacher.json'); // ไฟล์ที่ครูส่งออกจากหน้า "ใส่/แก้โน้ต" (ถ้ามี)
const APP = path.join(ROOT, 'app');
const OCT_MARKS = /[\u0E4D\u02DA\u00B0'`]/g; // ํ ˚ ° ' `

const LETTERS = 'CDEFGAB';
function parsePitch(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(s));
  return m ? { letter: m[1], acc: m[2], oct: parseInt(m[3], 10) } : null;
}
function thaiLabel(name) {
  const p = parsePitch(name); if (!p) return '';
  const th = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'][LETTERS.indexOf(p.letter)];
  return th + '\u0E4D'.repeat(Math.max(0, p.oct - 4));
}
const VALID_DURATIONS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

function solfegeToPitch(token, map) {
  const t = String(token).trim();
  if (map[t]) return map[t];
  const base = t.replace(OCT_MARKS, '');
  const marks = t.length - base.length;
  if (map[base]) {
    const p = parsePitch(map[base]);
    return p.letter + p.acc + (p.oct + marks);
  }
  throw new Error('โน้ตไทยไม่รู้จัก: "' + token + '"');
}

function buildItem(raw, period, src, allItemsById) {
  const defaults = src.defaults;
  const tines = src.tinesLeftToRight;
  const item = {
    id: raw.id, period: Number(period), kind: raw.kind || 'exercise', title: raw.title,
    source: raw.source || '', status: raw.status || (raw.partial ? 'partial' : 'ok'),
    meter: raw.meter || defaults.meter, notes: [], assumptions: [], gaps: (raw.gaps || []).slice()
  };
  if (raw.partial) item.partial = true;
  if (raw.unverified) item.unverified = true;
  if (raw.provenance) item.provenance = raw.provenance;
  if (raw.missing) item.missing = raw.missing;
  if (raw.testPool) item.testPool = raw.testPool;
  const bpm = Object.assign({}, defaults.bpm, raw.bpm || {});
  item.bpm = { start: bpm.start, min: bpm.min, max: bpm.max };
  if (bpm.target) item.bpm.target = bpm.target;
  if (bpm.docRange) item.bpm.docRange = bpm.docRange;
  if (bpm.docRef) item.bpm.docRef = bpm.docRef;
  const hasDocBpm = Boolean(raw.bpm && (raw.bpm.docRange || raw.bpm.docRef));
  if (!hasDocBpm) item.assumptions.push(defaults.assumptions.bpm);
  if (raw.meterAssumed) item.assumptions.push('จังหวะ ' + item.meter + ' ตั้งตามจำนวนโน้ตต่อกลุ่มเพื่อให้อ่านง่าย — วก.5 ไม่ระบุ (ครูยืนยัน)');

  let notes = [];
  if (raw.sameNotesAs) {
    const ref = allItemsById[raw.sameNotesAs];
    if (!ref) throw new Error(raw.id + ': sameNotesAs ไม่พบ ' + raw.sameNotesAs);
    notes = ref.notes.map(n => ({ p: n.p.slice(), d: n.d, th: n.th }));
  } else if (raw.noteList) {
    notes = raw.noteList.map(([name, d]) => ({ p: [name], d, th: thaiLabel(name) }));
  } else if (raw.groups && raw.rhythm) {
    const T = src.rhythmTemplates || {};
    const r = raw.rhythm;
    raw.groups.forEach((g, gi) => {
      const tn = r.byGroup ? r.byGroup[gi] : r.cycle[gi % r.cycle.length];
      const t = T[tn];
      if (!t) throw new Error(raw.id + ': ไม่พบแม่แบบจังหวะ ' + tn);
      t.idx.forEach((ix, k) => {
        const tok = g[ix];
        if (tok === undefined) throw new Error(raw.id + ': แม่แบบ ' + tn + ' ใช้โน้ตลำดับ ' + ix + ' แต่กลุ่มมี ' + g.length + ' ตัว');
        notes.push({ p: [solfegeToPitch(tok, src.solfege)], d: t.d[k], th: String(tok).trim() });
      });
    });
    if (r.ending) notes.push({ p: [solfegeToPitch(r.ending.solfege, src.solfege)], d: r.ending.d, th: String(r.ending.solfege).trim() });
    item.rhythm = { templates: Array.from(new Set(r.byGroup || r.cycle)).map(n => ({ id: n, label: T[n].label })), ending: r.ending ? r.ending.d : null };
    item.assumptions.push(defaults.assumptions.rhythm);
  } else if (raw.groups) {
    raw.groups.forEach(g => g.forEach(tok => {
      const name = solfegeToPitch(tok, src.solfege);
      notes.push({ p: [name], d: defaults.beatsPerNote, th: String(tok).trim() });
    }));
    item.assumptions.push(defaults.assumptions.duration);
    if (raw.groups.some(g => g.length === 2)) item.assumptions.push(defaults.assumptions.group);
  }
  if (item.status === 'missing') notes = [];
  notes.forEach((n, i) => {
    n.p.forEach(pn => {
      if (!parsePitch(pn)) throw new Error(raw.id + ' โน้ต#' + i + ': ชื่อโน้ตไม่ถูกต้อง ' + pn);
      if (tines.indexOf(pn) === -1) throw new Error(raw.id + ' โน้ต#' + i + ': ' + pn + ' ไม่มีบนลิ่มคาลิมบ้า 17 ลิ่ม');
    });
    if (VALID_DURATIONS.indexOf(n.d) === -1) throw new Error(raw.id + ' โน้ต#' + i + ': ความยาว ' + n.d + ' ไม่มีสัญลักษณ์');
  });
  (raw.assumptions || []).forEach(a => item.assumptions.push(a));
  if (raw.draft && notes.length) item.draft = src.draftLabel || 'ร่างโดยระบบ – ครูตรวจก่อนใช้';
  item.notes = notes;
  item.noteCount = notes.length;
  item.beats = notes.reduce((a, n) => a + n.d, 0);
  return item;
}

/* ---------- สถานะสื่อรายคาบ ---------- */
// สิ่งที่ App.openStudentMediaDoc เปิดเป็นเนื้อหาในแอปจริง (ตรงกับ app.js): คู่มือ/หลักสูตร/wk3/เมโทรนอม/smart_practice/kalimba
const IN_APP_ACADEMIC = [/musicsmart_guide/i, /course_syllabus/i, /\/wk3\//i, /metronome/i, /smart_practice/i, /kalimba/i];
const GENERATED_FOR_KALIMBA = [/^academic\/media\/exercise_/i, /^academic\/media\/sheet_/i, /c_major_scale_chart/i];

function fileExists(rel) {
  try { return fs.existsSync(path.join(APP, rel)); } catch (e) { return false; }
}
function classifyMedia(m, hasKalimbaItems) {
  const url = String(m.url || '');
  const ext = (/\.([a-z0-9]+)(?:$|\?)/i.exec(url) || [])[1] || '';
  const out = { title: m.title || '', url, status: 'unknown', note: '' };
  if (/^app_module:|^rubric:/.test(url)) { out.status = 'in_app'; out.note = 'เปิดโมดูล/รูบริกในแอป'; return out; }
  // เส้นทางภายในแอป (ไม่ใช่ไฟล์): ห้องสำรวจวงดนตรี / รูบริก (ครูใช้) / กระดานวิจารณ์ Feldman แทนไฟล์ interactive ที่ไม่มี
  if (/^ensemble\/(thai|folk|western)$/i.test(url)) { out.status = 'in_app'; out.note = 'เปิดห้องสำรวจวงดนตรีในแอป'; return out; }
  if (/^rubric\//i.test(url)) { out.status = 'in_app'; out.note = 'รูบริกประเมินในแอป (ครูใช้ให้คะแนน ปุ่ม 📊 ข้างชื่อนักเรียน)'; out.teacherOnly = true; return out; }
  if (/(^|\/)timbre_feldman\.html$/i.test(url) && !fileExists(url.replace(/^\.\//, '').replace(/^app\//, ''))) { out.status = 'in_app'; out.note = 'ไม่มีไฟล์ timbre_feldman.html — เปิดกระดานวิจารณ์ Feldman ในแอปแทน (ยังไม่มีคลิปเสียงเปรียบเทียบ: ดูช่องสื่อเสียงของคาบ 16)'; return out; }
  if (/^https?:\/\//i.test(url)) { out.status = 'external'; out.note = 'ลิงก์ภายนอก (ต้องมีอินเทอร์เน็ต ไม่ทำงานออฟไลน์)'; return out; }
  if (/^academic\//i.test(url)) {
    if (fileExists(url)) { out.status = 'file'; out.note = 'มีไฟล์จริง'; return out; }
    if (hasKalimbaItems && GENERATED_FOR_KALIMBA.some(r => r.test(url))) { out.status = 'generated'; out.note = 'ใช้สื่อที่สร้างจากข้อมูลโน้ต (ผังลิ่ม + บรรทัด 5 เส้น + เล่นได้) แทนไฟล์ ' + ext.toUpperCase(); return out; }
    if (IN_APP_ACADEMIC.some(r => r.test(url))) { out.status = 'in_app'; out.note = 'เปิดเนื้อหาในแอป'; return out; }
    out.status = 'missing_file'; out.note = 'ยังไม่มีไฟล์ ' + (ext ? ext.toUpperCase() : '') + ' ในโปรเจกต์ (กดแล้วเห็นเฉพาะแผงสรุปหัวข้อ) — ครูต้องส่งไฟล์'; return out;
  }
  if (/^(images|data|js)\//i.test(url) || /^\.\//.test(url) || /^interactive\//i.test(url) || /^app\//i.test(url)) {
    const rel = url.replace(/^\.\//, '').replace(/^app\//, '');
    if (fileExists(rel)) { out.status = 'file'; out.note = 'มีไฟล์จริง'; }
    else { out.status = 'dead_link'; out.note = 'ลิงก์เสีย: ไม่พบไฟล์ ' + rel; }
    return out;
  }
  out.status = 'no_link'; out.note = 'มีชื่อสื่อแต่ไม่มีลิงก์/ไฟล์';
  return out;
}

function loadLessons() {
  global.window = global.window || global;
  const L = require(path.join(APP, 'data', 'lessons.js'));
  const g = L.M1 || (L.LESSONS && L.LESSONS.M1) || (global.LESSONS && global.LESSONS.M1) || L;
  return g;
}

function build(opts) {
  opts = opts || {};
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const gradeKey = src.gradeKey || 'M1';
  const byId = {};
  const periods = {};
  Object.keys(src.periods).sort((a, b) => a - b).forEach(p => {
    periods[p] = src.periods[p].items.map(raw => {
      const it = buildItem(raw, p, src, byId);
      byId[it.id] = it;
      return it;
    });
  });
  // ---- โน้ตที่ครูส่งออกและวางไว้ใน tools/curriculum/kalimba_notes_teacher.json ----
  const rejected = [];
  let pub = opts.publish;
  if (pub === undefined && fs.existsSync(PUBLISH)) pub = fs.readFileSync(PUBLISH, 'utf8');
  if (pub) {
    const KN = require(path.join(APP, 'js', 'kalimba-notes.js'));
    const parsed = KN.parsePublishFile(typeof pub === 'string' ? pub : JSON.stringify(pub), src.tinesLeftToRight);
    parsed.rejected.forEach(r => rejected.push(r));
    parsed.items.forEach(t => {
      const pk = String(t.period);
      const list = periods[pk] || (periods[pk] = []);
      const idx = list.findIndex(x => x.id === t.id);
      const old = idx >= 0 ? list[idx] : {};
      const item = {
        id: t.id, period: Number(t.period), kind: t.kind || old.kind || 'song', title: t.title || old.title, source: 'ครูใส่โน้ตในแอป' + (t.updatedAt ? ' (' + t.updatedAt + ')' : ''),
        status: 'ok', meter: t.meter || old.meter || '4/4', notes: t.notes.map(n => ({ p: n.p.slice(), d: n.d, th: n.p.length ? n.p.map(thaiLabel).join('+') : 'พัก' })),
        assumptions: [], gaps: [], provenance: 'teacher',
        bpm: { start: t.bpm.start, min: (old.bpm && old.bpm.min) || 30, max: (old.bpm && old.bpm.max) || 200 }
      };
      if (t.bpm.target) item.bpm.target = t.bpm.target;
      if (old.testPool) item.testPool = old.testPool;
      if (t.note) item.teacherNote = t.note;
      item.noteCount = item.notes.length; item.beats = item.notes.reduce((a, n) => a + n.d, 0);
      if (idx >= 0) list[idx] = item; else list.push(item);
    });
  }
  let lessons = {};
  try { lessons = loadLessons(); } catch (e) { lessons = {}; }
  const mediaStatus = {};
  for (let p = 1; p <= 20; p++) {
    const l = Array.isArray(lessons) ? lessons.find(x => Number(x.period) === p) : (lessons[p] || lessons[String(p)]);
    const list = (l && l.media) || [];
    mediaStatus[p] = list.filter(m => m && m.title).map(m => classifyMedia(m, !!(periods[p] && periods[p].length)));
  }
  const data = {
    _generated: 'สร้างโดย tools/curriculum/build_kalimba_media.js — ห้ามแก้ไฟล์นี้ด้วยมือ; แก้ที่ kalimba_media_source.json แล้วรันใหม่',
    version: src.version, gradeKey, tines: src.tinesLeftToRight,
    solfege: src.solfege, periods: { [gradeKey]: periods }, mediaStatus: { [gradeKey]: mediaStatus }
  };
  const body = JSON.stringify(data, null, 1);
  const js = '/* GENERATED FILE — do not edit. Source: tools/curriculum/kalimba_media_source.json */\n' +
    '(function (root) {\n  var KALIMBA_MEDIA = ' + body.replace(/\n/g, '\n  ') + ';\n' +
    '  root.KALIMBA_MEDIA = KALIMBA_MEDIA;\n  if (typeof module !== \'undefined\' && module.exports) module.exports = KALIMBA_MEDIA;\n' +
    '})(typeof window !== \'undefined\' ? window : (typeof global !== \'undefined\' ? global : this));\n';
  return { data, js, rejected };
}
function buildWith(publish) { return build({ publish }); }

module.exports = { build, buildWith, classifyMedia, solfegeToPitch, thaiLabel, VALID_DURATIONS };

if (require.main === module) {
  const { js, rejected } = build();
  rejected.forEach(r => console.error('! ข้ามรายการที่ครูส่งออกแต่ไม่ถูกต้อง: ' + r.id + ' — ' + r.errors.join(' / ')));
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cur !== js) { console.error('✗ app/data/kalimba_media.js ไม่ตรงกับ kalimba_media_source.json — รัน: node tools/curriculum/build_kalimba_media.js'); process.exit(1); }
    console.log('✓ kalimba_media.js ตรงกับ source');
  } else {
    fs.writeFileSync(OUT, js, 'utf8');
    console.log('เขียน ' + path.relative(ROOT, OUT) + ' (' + js.length + ' bytes)');
  }
}
