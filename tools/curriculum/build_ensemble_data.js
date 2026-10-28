#!/usr/bin/env node
/* สร้าง app/data/ensemble_data.js จาก tools/curriculum/ensemble_source.json
 *  - ข้อมูลห้องสำรวจวงดนตรี (วก.5 คาบ 12 วงไทย+พื้นบ้าน 4 ภาค · คาบ 14 วงสากล) — ห้ามฮาร์ดโค้ดใน app/js/ensemble-explorer.js
 *  - ตรวจความสมบูรณ์: ครบ 4 ภาค · ทุกที่นั่งอ้างเครื่องดนตรีที่มีจริง · ประเภทเครื่องอยู่ในชุด (ตี เป่า ดีด สี / สาย ลมไม้ ทองเหลือง ลิ่มนิ้ว กระทบ)
 * ใช้: node tools/curriculum/build_ensemble_data.js [--check]   (--check = ตรวจว่าไฟล์ตรงกับ source; exit 1 ถ้าไม่ตรงหรือข้อมูลผิด)
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(__dirname, 'ensemble_source.json');
const OUT = path.join(ROOT, 'app', 'data', 'ensemble_data.js');
const IMGS = path.join(__dirname, 'ensemble_images.json'); // ภาพจริงจาก Wikimedia Commons + สิทธิ์ใช้งานรายภาพ (ถ้าไม่มี = ใช้ภาพประกอบ SVG ในแอป)
const AUDIO = path.join(__dirname, 'ensemble_audio.json'); // เสียงจริงรายเครื่อง (Commons) + สิทธิ์ — เครื่องที่ไม่มีในไฟล์นี้ใช้ "เสียงจำลอง" ที่ติดป้ายชัดเจน
const OK_LICENSE = /^(CC0|Public domain|CC BY( [0-9.]+)?|CC BY-SA [0-9.]+)$/;

function validate(src) {
  const p = [];
  const I = src.instruments || {};
  const sets = src.classSets;
  Object.keys(src.categories).forEach(ck => {
    const cat = src.categories[ck];
    const ens = cat.ensembles || {};
    if (!Object.keys(ens).length) p.push(ck + ': ไม่มีวง');
    Object.keys(ens).forEach(ek => {
      const e = ens[ek], w = ck + '/' + ek;
      ['name', 'era', 'soundChar', 'occasion', 'wk5'].forEach(f => { if (!e[f]) p.push(w + ': ขาด ' + f); });
      if (!(e.seating || []).length) p.push(w + ': ไม่มีที่นั่ง');
      (e.seating || []).forEach((s, i) => {
        if (!I[s.inst]) p.push(w + '[' + i + ']: ไม่พบเครื่อง ' + s.inst);
        if (!(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100)) p.push(w + '[' + i + ']: ตำแหน่งนอกเวที');
        if (!s.role) p.push(w + '[' + i + ']: ขาด role');
      });
      if (ck === 'folk' && src.regions.indexOf(e.region) < 0) p.push(w + ': region ไม่อยู่ในรายการ 4 ภาค');
    });
  });
  const folkRegions = Object.keys(src.categories.folk.ensembles).map(k => src.categories.folk.ensembles[k].region);
  src.regions.forEach(r => { if (folkRegions.indexOf(r) < 0) p.push('ขาดวงพื้นบ้านของ ' + r); });
  const L = src.listening;
  if (!L) p.push('ขาด listening (กิจกรรมฟังคาบ 16)');
  else {
    if (L.period !== 16) p.push('listening.period ต้องเป็น 16');
    ['tempos', 'dynamics'].forEach(k => { if ((L[k] || []).length < 3) p.push('listening.' + k + ' ต้องมีอย่างน้อย 3 ระดับ'); });
    (L.tempos || []).forEach(x => { if (!(x.bpm > 20 && x.bpm < 240)) p.push('listening.tempos ' + x.id + ' bpm ผิดช่วง'); });
    (L.dynamics || []).forEach(x => { if (!(x.gain > 0 && x.gain <= 1)) p.push('listening.dynamics ' + x.id + ' gain ผิดช่วง'); });
    if ((L.feldman || []).length !== 4) p.push('listening.feldman ต้องมี 4 ขั้นตอน');
    if (!(L.moods || []).length || !(L.pattern || []).length) p.push('listening: ขาด moods/pattern');
  }
  Object.keys(I).forEach(id => {
    const x = I[id];
    if (!x.name) p.push(id + ': ขาด name');
    if (!x.en) p.push(id + ': ขาดชื่ออังกฤษ (en)');
    if (!x.how && !(src.howBySynth || {})[x.synth]) p.push(id + ': ขาดวิธีเล่น (how/howBySynth)');
    if (!src.synthPresets[x.synth]) p.push(id + ': synth ไม่รู้จัก ' + x.synth);
  });
  // ประเภทเครื่อง: เครื่องที่อยู่ในวงไทย/พื้นบ้านต้องเป็น 4 ประเภท · วงสากลต้องอยู่ใน 5 ประเภท (ยกเว้นผู้อำนวยเพลง/เสียงร้อง)
  ['thai', 'folk'].forEach(ck => Object.keys(src.categories[ck].ensembles).forEach(ek => src.categories[ck].ensembles[ek].seating.forEach(s => {
    if (sets.thai.indexOf(I[s.inst].cls) < 0) p.push(ck + '/' + ek + ': ' + s.inst + ' ประเภท "' + I[s.inst].cls + '" ไม่ใช่ 4 ประเภท');
  })));
  Object.keys(src.categories.western.ensembles).forEach(ek => src.categories.western.ensembles[ek].seating.forEach(s => {
    if (sets.western.indexOf(I[s.inst].cls) < 0 && ['ผู้อำนวยเพลง', 'เสียงร้อง'].indexOf(I[s.inst].cls) < 0) p.push('western/' + ek + ': ' + s.inst + ' ประเภท "' + I[s.inst].cls + '" ไม่อยู่ใน 5 ประเภท');
  }));
  // ภาพ: ต้องมีไฟล์จริง ขนาดไม่เล็กเกินไป สิทธิ์ใช้งานอยู่ในชุดที่อนุญาต และมีผู้สร้าง/หน้าต้นทางครบ
  Object.keys(src.categories).forEach(ck => Object.keys(src.categories[ck].ensembles).forEach(ek => {
    const im = src.categories[ck].ensembles[ek].image;
    if (!im) return;
    const w = ck + '/' + ek + ' image';
    ['file', 'alt', 'license', 'author', 'page', 'title'].forEach(f => { if (!im[f]) p.push(w + ': ขาด ' + f); });
    if (im.license && !OK_LICENSE.test(im.license)) p.push(w + ': สิทธิ์ใช้งาน "' + im.license + '" ไม่อยู่ในชุดที่อนุญาต (CC0/PD/CC BY/CC BY-SA)');
    const fp = path.join(ROOT, 'app', String(im.file || ''));
    if (!fs.existsSync(fp)) p.push(w + ': ไม่พบไฟล์ ' + im.file);
    else if (fs.statSync(fp).size < 20000) p.push(w + ': ไฟล์เล็กผิดปกติ (<20KB) ' + im.file);
    if (im.period !== src.categories[ck].ensembles[ek].period) p.push(w + ': คาบของภาพไม่ตรงกับคาบของวง');
  }));
  // เสียงจริง: ต้องมีไฟล์ mp3 จริง สิทธิ์อยู่ในชุดที่อนุญาต มีผู้สร้าง/ลิงก์ Commons และบอกว่าแก้ไขอะไร
  Object.keys(I).forEach(id => {
    const a = I[id].audio; if (!a) return;
    const w = id + ' audio';
    ['file', 'label', 'license', 'author', 'page', 'title', 'change'].forEach(f => { if (!a[f]) p.push(w + ': ขาด ' + f); });
    if (a.license && !OK_LICENSE.test(a.license)) p.push(w + ': สิทธิ์ใช้งาน "' + a.license + '" ไม่อยู่ในชุดที่อนุญาต');
    if (a.page && !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(a.page)) p.push(w + ': page ต้องเป็นลิงก์ Commons');
    const fp = path.join(ROOT, 'app', String(a.file || ''));
    if (!fs.existsSync(fp)) p.push(w + ': ไม่พบไฟล์ ' + a.file); else if (fs.statSync(fp).size < 5000) p.push(w + ': ไฟล์เล็กผิดปกติ ' + a.file);
  });
  return p;
}

function build() {
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const imgProblems = [];
  const imgs = fs.existsSync(IMGS) ? JSON.parse(fs.readFileSync(IMGS, 'utf8')) : {};
  Object.keys(src.categories).forEach(ck => Object.keys(src.categories[ck].ensembles).forEach(ek => {
    if (imgs[ek]) src.categories[ck].ensembles[ek].image = imgs[ek]; else delete src.categories[ck].ensembles[ek].image;
  }));
  const auds = fs.existsSync(AUDIO) ? JSON.parse(fs.readFileSync(AUDIO, 'utf8')) : {};
  Object.keys(auds).forEach(id => { if (src.instruments[id]) src.instruments[id].audio = auds[id]; else imgProblems.push('ensemble_audio.json: ไม่พบเครื่อง ' + id); });
  Object.keys(src.categories).forEach(ck => Object.keys(src.categories[ck].ensembles).forEach(ek => {
    const e = src.categories[ck].ensembles[ek];
    if (!e.image && imgs._teacherNotes && imgs._teacherNotes[ek]) e.imageTeacherNote = imgs._teacherNotes[ek];
  }));
  const problems = validate(src).concat(imgProblems);
  const data = Object.assign({ _generated: 'สร้างโดย tools/curriculum/build_ensemble_data.js — ห้ามแก้ไฟล์นี้ด้วยมือ; แก้ที่ ensemble_source.json แล้วรันใหม่' }, src);
  delete data._comment;
  const body = JSON.stringify(data, null, 1).replace(/\n/g, '\n   ');
  const js = '/* GENERATED FILE — do not edit. Source: tools/curriculum/ensemble_source.json */\n(function (root) {\n  var ENSEMBLE_DATA = ' + body + ';\n  root.ENSEMBLE_DATA = ENSEMBLE_DATA;\n  if (typeof module !== \'undefined\' && module.exports) module.exports = ENSEMBLE_DATA;\n})(typeof window !== \'undefined\' ? window : (typeof global !== \'undefined\' ? global : this));\n';
  return { js: js, problems: problems, src: src };
}

// ไฟล์เครดิตภาพ (CC BY / CC BY-SA ต้องระบุผู้สร้าง สิทธิ์ และลิงก์) — สร้างจาก ensemble_images.json
const ATTR = path.join(ROOT, 'app', 'media', 'm1', 'ATTRIBUTION.md');
function attribution(src) {
  const L = ['# เครดิตภาพประกอบ — วงดนตรี (ม.1 คาบ 12 และ 14)', '',
    'สร้างอัตโนมัติจาก tools/curriculum/ensemble_images.json (node tools/curriculum/build_ensemble_data.js) — ห้ามแก้ด้วยมือ',
    'ภาพทั้งหมดมาจาก Wikimedia Commons ตรวจสิทธิ์รายภาพแล้ว (เฉพาะ CC0 / Public domain / CC BY / CC BY-SA) · ย่อขนาดเป็น JPEG ความกว้าง ~800–960px เพื่อใช้บนมือถือ · ไม่ได้ตัดต่อเนื้อหาภาพ',
    'วง "รองเง็ง" ยังไม่มีภาพที่ตรวจสิทธิ์/เนื้อหาแล้ว — นักเรียนไม่เห็นกรอบภาพ ส่วนครูเห็นโน้ต "ครูเตรียมภาพ"', '',
    '| ไฟล์ในแอป | วง | ผู้สร้าง | สิทธิ์ใช้งาน | ไฟล์ต้นฉบับ (Commons) |', '|---|---|---|---|---|'];
  Object.keys(src.categories).forEach(ck => Object.keys(src.categories[ck].ensembles).forEach(ek => {
    const e = src.categories[ck].ensembles[ek], im = e.image;
    if (im) L.push('| ' + im.file.replace(/^media\/m1\//, '') + ' | ' + e.name + ' | ' + im.author + ' | ' + im.license + ' | [' + im.title + '](' + im.page + ') |');
  }));
  const aud = fs.existsSync(AUDIO) ? JSON.parse(fs.readFileSync(AUDIO, 'utf8')) : {};
  L.push('', '## เสียงจริง (เครื่องอื่นทั้งหมดใช้ "เสียงจำลอง" สังเคราะห์ในแอป ไม่ใช่เสียงเครื่องจริง)', '', '| ไฟล์ในแอป | เครื่อง | ผู้สร้าง | สิทธิ์ใช้งาน | ไฟล์ต้นฉบับ (Commons) | การแก้ไข |', '|---|---|---|---|---|---|');
  Object.keys(aud).forEach(id => { const a = aud[id]; L.push('| ' + a.file.replace(/^media\/m1\//, '') + ' (ต้นฉบับ ' + a.original.replace(/^media\/m1\//, '') + ') | ' + (src.instruments[id] ? src.instruments[id].name : id) + ' | ' + a.author + ' | ' + a.license + ' | [' + a.title + '](' + a.page + ') | ' + a.change + ' |'); });
  L.push('', 'ใบอนุญาต CC BY-SA: ผู้นำไปใช้ต่อต้องระบุผู้สร้างและเผยแพร่ต่อด้วยสิทธิ์เดียวกัน', '');
  L.push('', 'หมายเหตุ: ภาพ string_quartet (North Sea String Quartet 01) มีป้ายเตือนสิทธิ์บุคคล (personality rights) ของ Commons — ใช้เพื่อการศึกษาในห้องเรียนเท่านั้น ไม่ใช้โฆษณา; ภาพ string_ensemble และ mahori มาจากหนังสือ "เครื่องมโหรีปี่พาทย์" พ.ศ. 2473/2474 ที่ Commons จัดเป็น Public domain (เป็นภาพถ่ายเก่า ไม่ใช่ภาพปัจจุบัน — ครูโปรดยืนยันว่าตรงกับวงที่สอน)', '');
  return L.join('\n');
}

if (require.main === module) {
  const r = build();
  if (r.problems.length) { console.error('✗ ensemble_source.json มีปัญหา:\n  ' + r.problems.join('\n  ')); process.exit(1); }
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cur !== r.js) { console.error('✗ app/data/ensemble_data.js ไม่ตรงกับ source — รัน node tools/curriculum/build_ensemble_data.js'); process.exit(1); }
    const curA = fs.existsSync(ATTR) ? fs.readFileSync(ATTR, 'utf8').replace(/\r\n/g, '\n') : '';
    if (curA !== attribution(r.src)) { console.error('✗ app/media/m1/ATTRIBUTION.md ไม่ตรงกับ ensemble_images.json — รัน node tools/curriculum/build_ensemble_data.js'); process.exit(1); }
    console.log('✓ ensemble_data.js + ATTRIBUTION.md ตรงกับ source'); process.exit(0);
  }
  fs.writeFileSync(OUT, r.js);
  fs.writeFileSync(ATTR, attribution(r.src));
  console.log('เขียน ' + path.relative(ROOT, OUT) + ' (' + r.js.length + ' bytes)');
}
module.exports = { build, validate, attribution };
