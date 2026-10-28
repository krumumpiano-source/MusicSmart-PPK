#!/usr/bin/env node
/* สร้าง app/data/media_manifest.js จาก tools/curriculum/period_media_source.json + ไฟล์จริงใน app/media/m1/pNN/
 *  - ช่องสื่อ (slot) = สิ่งที่ วก.5 บอกให้ครูเปิดฟัง/เปิดคลิป (ไม่ใส่ไฟล์/แหล่งที่มาให้เอง)
 *  - ครูวางไฟล์ชื่อ <slotId>.<mp3|m4a|ogg|wav|mp4|webm ...> ในโฟลเดอร์คาบ แล้วรันคำสั่งนี้ (หรือ push ให้ deploy รันให้)
 *  - app/media/m1/pNN/meta.json (ไม่บังคับ): { "<slotId>": { "url": "https://…", "credit": "ที่มา/สิทธิ์ใช้งาน", "note": "…" } }
 *  - เขียน README.txt ในโฟลเดอร์คาบที่มีช่อง
 * ใช้: node tools/curriculum/build_period_media.js [--check]   (--check = ตรวจ "นิยามช่อง" ตรงกับ source; ไม่ตรวจรายชื่อไฟล์) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const APP = path.join(ROOT, 'app');
const SRC = path.join(__dirname, 'period_media_source.json');
const OUT = path.join(APP, 'data', 'media_manifest.js');

function readMeta(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch (e) { return {}; } }
function build(appDir) {
  const app = appDir || APP;
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const slots = {}, extras = {}, problems = [];
  const byP = {};
  src.slots.forEach(s => { (byP[s.period] = byP[s.period] || []).push(s); });
  const periods = {};
  for (let p = 1; p <= 20; p++) periods[p] = 1;
  Object.keys(periods).forEach(p => {
    const dir = path.join(app, src.root, 'p' + String(p).padStart(2, '0'));
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => !/^(README|meta|manifest)\./i.test(f) && !/^\./.test(f)) : [];
    const meta = fs.existsSync(dir) ? readMeta(dir) : {};
    const used = {};
    const list = (byP[p] || []).map(s => {
      const allowed = src.exts[s.kind] || [];
      const hit = files.filter(f => { const m = /^(.*)\.([A-Za-z0-9]+)$/.exec(f); return m && m[1].toLowerCase() === s.id.toLowerCase() && allowed.indexOf(m[2].toLowerCase()) !== -1; }).sort();
      const m = meta[s.id] || {};
      const o = Object.assign({}, s, { status: 'missing', file: null, url: null, credit: m.credit || null, note: m.note || null });
      if (hit.length) { o.status = 'file'; o.file = src.root + '/p' + String(p).padStart(2, '0') + '/' + hit[0]; used[hit[0]] = 1; if (hit.length > 1) problems.push('p' + p + ': ' + s.id + ' มีหลายไฟล์ (' + hit.join(', ') + ') ใช้ ' + hit[0]); }
      else if (m.url && /^https:\/\//i.test(m.url)) { o.status = 'link'; o.url = m.url; }
      else if (m.url) problems.push('p' + p + ': ' + s.id + ' url ใน meta.json ต้องขึ้นต้น https://');
      return o;
    });
    if (list.length) slots[p] = list;
    const ex = files.filter(f => !used[f] && /\.([A-Za-z0-9]+)$/.test(f)).map(f => {
      const ext = /\.([A-Za-z0-9]+)$/.exec(f)[1].toLowerCase();
      const kind = src.exts.audio.indexOf(ext) !== -1 ? 'audio' : (src.exts.video.indexOf(ext) !== -1 ? 'video' : null);
      return kind ? { kind, file: src.root + '/p' + String(p).padStart(2, '0') + '/' + f, title: f.replace(/\.[^.]+$/, ''), credit: (meta[f] && meta[f].credit) || null } : null;
    }).filter(Boolean);
    if (ex.length) extras[p] = ex;
  });
  const data = { _generated: 'สร้างโดย tools/curriculum/build_period_media.js — ห้ามแก้ไฟล์นี้ด้วยมือ; วางไฟล์ใน app/media/m1/pNN/ แล้วรันใหม่', version: src.version, gradeKey: src.gradeKey, root: src.root, exts: src.exts, slots, extras };
  const js = '/* GENERATED FILE — do not edit. Source: tools/curriculum/period_media_source.json + app/media/m1/pNN/ */\n(function (root) {\n  var PERIOD_MEDIA = ' + JSON.stringify(data, null, 1).replace(/\n/g, '\n  ') + ';\n  root.PERIOD_MEDIA = PERIOD_MEDIA;\n  if (typeof module !== \'undefined\' && module.exports) module.exports = PERIOD_MEDIA;\n})(typeof window !== \'undefined\' ? window : (typeof global !== \'undefined\' ? global : this));\n';
  return { data, js, problems, src };
}
function readme(src, p, list) {
  const pp = 'p' + String(p).padStart(2, '0');
  if (!list.length) return 'โฟลเดอร์สื่อ คาบ ' + p + ' (ม.1) — สร้างโดย build_period_media.js (ไฟล์นี้ถูกเขียนทับเมื่อ build ใหม่)\r\n\r\n' +
    'วก.5 ไม่ได้ระบุสื่อเสียง/วิดีโอสำหรับคาบนี้ จึงไม่มี "ช่อง" บังคับ\r\n' +
    'ถ้าครูอยากเพิ่มสื่อประกอบ วางไฟล์ในโฟลเดอร์นี้ (app/' + src.root + '/' + pp + '/) ชื่ออะไรก็ได้ นามสกุล: เสียง ' + src.exts.audio.join(' ') + ' · วิดีโอ ' + src.exts.video.join(' ') + '\r\n' +
    'ระบบจะแสดงเป็น "ไฟล์เสริม" ในคาบนี้หลังรัน: node tools/curriculum/build_period_media.js (หรือ push ให้ GitHub Actions รันให้)\r\n' +
    'ใส่ที่มา/สิทธิ์ใช้งาน (credit) ใน meta.json เช่น {"ชื่อไฟล์.mp3": {"credit": "ที่มา"}} — ระบบจะไม่เดาที่มาให้\r\n';
  let t = 'โฟลเดอร์สื่อ คาบ ' + p + ' (ม.1) — สร้างโดย build_period_media.js (ไฟล์นี้ถูกเขียนทับเมื่อ build ใหม่)\r\n\r\n' +
    'วิธีใส่ไฟล์: ตั้งชื่อไฟล์ให้ตรงช่องด้านล่าง แล้ววางในโฟลเดอร์นี้ (app/' + src.root + '/' + pp + '/)\r\n' +
    'นามสกุลที่รับ: เสียง ' + src.exts.audio.join(' ') + ' · วิดีโอ ' + src.exts.video.join(' ') + '\r\n' +
    'ใช้ลิงก์แทนไฟล์: สร้างไฟล์ meta.json เช่น {"' + list[0].id + '": {"url": "https://…", "credit": "ที่มา/สิทธิ์ใช้งาน"}}\r\n' +
    'ใส่ที่มา/สิทธิ์ใช้งาน (credit) ทุกไฟล์ที่ไม่ใช่ของครูเอง — ระบบจะไม่เดาที่มาให้\r\n' +
    'แล้วรัน: node tools/curriculum/build_period_media.js  (หรือ push ให้ GitHub Actions รันให้ตอน deploy)\r\n\r\nช่องที่ วก.5 กำหนด:\r\n';
  list.forEach(s => { t += ' - ' + s.id + '.<นามสกุล>  [' + (s.kind === 'audio' ? 'เสียง' : 'วิดีโอ') + ']  ' + s.label + '  (' + s.docRef + ')' + (s.exam ? '  — ใช้กับข้อสอบ ต้องมีตัวเล่นเสียงในระบบสอบก่อน' : '') + '\r\n'; });
  return t + '\r\nคำแนะนำไฟล์: ขนาดเล็กลงจะโหลดไวบนมือถือ (เสียง mp3/m4a ≤ ~3 MB ต่อไฟล์ เป็นแนวทาง ไม่ใช่เงื่อนไขของระบบ) · ไฟล์ในโฟลเดอร์นี้ไม่ถูกแคชออฟไลน์อัตโนมัติ\r\n';
}
module.exports = { build, readme };
if (require.main === module) {
  const r = build();
  r.problems.forEach(x => console.error('! ' + x));
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    const strip = s => { const m = /var PERIOD_MEDIA = ([\s\S]*?);\n  root\.PERIOD_MEDIA/.exec(s); if (!m) return null; const o = JSON.parse(m[1]); const sl = {}; Object.keys(o.slots).forEach(p => { sl[p] = o.slots[p].map(s => s.id + '|' + s.kind + '|' + s.label + '|' + s.period); }); return JSON.stringify(sl); };
    const a = strip(cur), b = strip(r.js);
    if (a !== b) { console.error('✗ app/data/media_manifest.js ไม่ตรงกับ period_media_source.json — รัน: node tools/curriculum/build_period_media.js'); process.exit(1); }
    console.log('✓ media_manifest.js ตรงกับนิยามช่องสื่อ');
  } else {
    fs.writeFileSync(OUT, r.js, 'utf8');
    const byP = {}; r.src.slots.forEach(s => { (byP[s.period] = byP[s.period] || []).push(s); });
    // โฟลเดอร์ drop-in ครบทุกคาบ (1..periods) — คาบที่ วก.5 ไม่ระบุสื่อก็วางไฟล์เสริมได้ (แสดงเป็น "ไฟล์เสริม")
    for (let p = 1; p <= (r.src.periods || 20); p++) {
      const dir = path.join(APP, r.src.root, 'p' + String(p).padStart(2, '0'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'README.txt'), readme(r.src, p, byP[p] || []), 'utf8');
    }
    const n = Object.keys(r.data.slots).reduce((a, p) => a + r.data.slots[p].length, 0), ok = Object.keys(r.data.slots).reduce((a, p) => a + r.data.slots[p].filter(s => s.status !== 'missing').length, 0);
    console.log('เขียน ' + path.relative(ROOT, OUT) + ' — ช่องสื่อ ' + n + ' ช่อง, มีไฟล์/ลิงก์แล้ว ' + ok + ', ยังขาด ' + (n - ok));
  }
}
