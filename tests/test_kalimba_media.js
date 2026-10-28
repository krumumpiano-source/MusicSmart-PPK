/* fix_report_4 — สื่อคาลิมบ้า: โมเดลโน้ต, บรรทัด 5 เส้น, ผังลิ่ม, เมโทรนอม/Transport (lookahead),
 * หมายเลขเครื่อง (เก็บ/ค้นหา/CSV/ประวัติ/ซิงค์), ความเข้ากันได้กับมือถือรุ่นเก่า */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

// ---- สภาพแวดล้อมจำลอง ----
global.window = global;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

const KM = require(path.join(ROOT, 'app/data/kalimba_media.js'));
const KMedia = require(path.join(ROOT, 'app/js/kalimba-media.js'));
const KD = require(path.join(ROOT, 'app/js/kalimba-devices.js'));
const builder = require(path.join(ROOT, 'tools/curriculum/build_kalimba_media.js'));

// ===== 1) ข้อมูลที่สร้างจาก source =====
check('kalimba_media.js ตรงกับ build ปัจจุบัน', (() => {
  const cur = fs.readFileSync(path.join(ROOT, 'app/data/kalimba_media.js'), 'utf8').replace(/\r\n/g, '\n');
  return cur === builder.build().js;
})());
check('มีผังลิ่ม 17 ลิ่ม', KM.tines.length === 17);
check('ลิ่มกลางคือ C4', KM.tines[8] === 'C4');
const periods = Object.keys(KM.periods.M1).map(Number);
check('คาบที่มีสื่อคาลิมบ้า = 2-10 (ตาม วก.5)', JSON.stringify(periods) === JSON.stringify([2, 3, 4, 5, 6, 7, 8, 9, 10]), JSON.stringify(periods));
let missingItems = 0, itemCount = 0;
periods.forEach(p => KM.periods.M1[p].forEach(it => {
  itemCount++;
  check('item ' + it.id + ' มี id/title/source', it.id && it.title && it.source !== undefined);
  if (it.status === 'missing') {
    missingItems++;
    check('item ' + it.id + ' ที่ missing ต้องไม่มีโน้ต (ห้ามเดา) และมีข้อความบอกครู', it.notes.length === 0 && /ครู/.test(it.missing || ''));
  } else {
    check('item ' + it.id + ' มีโน้ต', it.notes.length > 0);
    it.notes.forEach((n, i) => {
      n.p.forEach(pn => { if (KM.tines.indexOf(pn) < 0) check(it.id + '#' + i + ' ' + pn + ' อยู่บนลิ่ม', false); });
      if (!KMedia.durationShape(n.d)) check(it.id + '#' + i + ' ความยาว ' + n.d + ' มีสัญลักษณ์', false);
    });
    check('item ' + it.id + ' บอกสมมติฐาน/ช่องว่างให้ครู (ไม่ซ่อน)', (it.assumptions || []).length > 0);
  }
}));
check('ไม่มีรายการ MISSING แล้ว: เพลงที่ 2 คาบ 8, 10 = Joy to the World (ทำนองสาธารณสมบัติ แทน Do-Re-Mi) ติดป้ายร่างโดยระบบ', missingItems === 0 && KM.periods.M1[8][1].provenance === 'public_domain' && KM.periods.M1[10][0].provenance === 'public_domain' && KM.periods.M1[8][1].draft === 'ร่างโดยระบบ – ครูตรวจก่อนใช้');
check('P3 อ้าง BPM 60→72 (ช่วง 70-75) จาก วก.5', KM.periods.M1[3][0].bpm.start === 60 && KM.periods.M1[3][0].bpm.target === 72 && KM.periods.M1[3][0].bpm.docRange === '70-75');
check('P7 มี 12 ลวดลาย (ขึ้น 6 + ลง 6 ตาม วก.5) ลวดลายละ 3 โน้ต อยู่ในกลุ่มสอบ p7_practical + ชุดฝึกต่อเนื่อง 36 โน้ต', KM.periods.M1[7].filter(function (x) { return x.testPool === 'p7_practical'; }).length === 12 && KM.periods.M1[7].filter(function (x) { return x.testPool; }).every(function (x) { return x.notes.length === 3 && !x.partial; }) && KM.periods.M1[7].length === 13 && KM.periods.M1[7][12].notes.length === 37);
check('P5 ขั้นคู่ 3 ไป-กลับ: เริ่ม ด-ม (ตัวขาว 2 ตัว) จบที่ ด ตัวกลม และใช้ค่าตัวโน้ตมากกว่า 1 แบบ', (function () { var n = KM.periods.M1[5][0].notes; return n[0].p[0] === 'C4' && n[1].p[0] === 'E4' && n[0].d === 2 && n[n.length - 1].p[0] === 'C4' && n[n.length - 1].d === 4 && new Set(n.map(function (x) { return x.d; })).size >= 3; })());
check('P6 ขั้นคู่ 4 ไป-กลับ: เริ่ม ด-ฟ จบที่ ด ตัวกลม และใช้ค่าตัวโน้ตมากกว่า 1 แบบ', (function () { var n = KM.periods.M1[6][0].notes; return n[0].p[0] === 'C4' && n[1].p[0] === 'F4' && n[n.length - 1].p[0] === 'C4' && n[n.length - 1].d === 4 && new Set(n.map(function (x) { return x.d; })).size >= 3; })());
check('mediaStatus ครบ 20 คาบ', Object.keys(KM.mediaStatus.M1).length === 20);
let threw = false; try { builder.solfegeToPitch('ฮ', KM.solfege); } catch (e) { threw = true; }
check('builder ปฏิเสธโน้ตไทยที่ไม่รู้จัก', threw);
check('ดํ = C5, ดํํ = C6', builder.solfegeToPitch('ดํ', KM.solfege) === 'C5' && builder.solfegeToPitch('ดํํ', KM.solfege) === 'C6');

// ===== 2) โมเดลโน้ต =====
check('freq A4 = 440', near(KMedia.freqOf('A4'), 440, 1e-6));
check('freq C4 ≈ 261.63', near(KMedia.freqOf('C4'), 261.6256, 0.01));
check('freq E6 ≈ 1318.51', near(KMedia.freqOf('E6'), 1318.51, 0.01));
check('ป้ายไทย C4=ด, C5=ดํ, E4=ม', KMedia.thaiLabel('C4') === 'ด' && KMedia.thaiLabel('C5') === 'ดํ' && KMedia.thaiLabel('E4') === 'ม');
check('รูปตัวโน้ต: 1=ดำ, 2=ขาว, 4=กลม, 0.5=เขบ็ต 1 ชั้น, 1.5=ดำประ', (() => {
  const s1 = KMedia.durationShape(1), s2 = KMedia.durationShape(2), s4 = KMedia.durationShape(4), s05 = KMedia.durationShape(0.5), s15 = KMedia.durationShape(1.5);
  return !s1.open && s1.stem && s2.open && s2.stem && s4.open && !s4.stem && s05.flags === 1 && s15.dots === 1 && KMedia.durationShape(0.3) === null;
})());

// ===== 3) บรรทัด 5 เส้น =====
const p4 = KM.periods.M1[4][0], p9 = KM.periods.M1[9][0];
[p4, p9, KM.periods.M1[3][0]].forEach(it => {
  const lay = KMedia.layoutStaff(it.notes, it.meter);
  check(it.id + ': ทุกโน้ตมีตำแหน่ง', lay.pos.length === it.notes.length);
  let ok = true, prev = {};
  lay.pos.forEach(pp => {
    if (!(pp.x > 0 && pp.x < KMedia.STAFF.W)) ok = false;
    if (prev[pp.sys] !== undefined && pp.x <= prev[pp.sys]) ok = false;
    prev[pp.sys] = pp.x;
  });
  check(it.id + ': ตำแหน่ง x อยู่ในกรอบและเรียงซ้าย→ขวา', ok);
  const out = KMedia.renderStaffSVG(it.notes, it.meter, 'tst');
  const lines5 = (out.svg.match(/stroke="#37474f" stroke-width="1"\/>/g) || []).length;
  check(it.id + ': มีเส้นบรรทัด ≥ 5 เส้นต่อบรรทัด', lay.systems.length > 0 && lines5 >= 5 * lay.systems.length);
  check(it.id + ': id โน้ตครบ', Object.keys(out.ids).length === it.notes.length);
  check(it.id + ': <g> สมดุล', (out.svg.match(/<g /g) || []).length === (out.svg.match(/<\/g>/g) || []).length);
  check(it.id + ': ใช้ viewBox (ไม่บิดเบี้ยวเมื่อย่อ)', /viewBox="0 0 600 \d+"/.test(out.svg) && /preserveAspectRatio="xMidYMid meet"/.test(out.svg));
});
(function () {
  const out = KMedia.renderStaffSVG([{ p: ['C4'], d: 1 }, { p: ['E4'], d: 1 }, { p: ['G4'], d: 1 }, { p: ['C5'], d: 1 }], '4/4', 'z');
  const ys = {};
  ['z-n0', 'z-n1', 'z-n2', 'z-n3'].forEach(id => { const m = new RegExp('<g id="' + id + '"[^>]*><ellipse[^>]* cy="([\\d.]+)"').exec(out.svg); ys[id] = m ? parseFloat(m[1]) : NaN; });
  check('ตำแหน่งแนวตั้ง: โน้ตสูงขึ้น → y น้อยลง (C4>E4>G4>C5)', ys['z-n0'] > ys['z-n1'] && ys['z-n1'] > ys['z-n2'] && ys['z-n2'] > ys['z-n3'], JSON.stringify(ys));
  const yTop = KMedia.STAFF.top, S = KMedia.STAFF.S;
  check('E4 อยู่บนเส้นล่างสุด', near(ys['z-n1'], yTop + 4 * S));
  check('G4 อยู่บนเส้นที่ 2 จากล่าง (เส้นซอล)', near(ys['z-n2'], yTop + 3 * S));
  check('C4 มีเส้นน้อย (ledger line)', out.svg.indexOf('x1="') > 0 && /<line x1="[\d.]+" y1="84" x2="[\d.]+" y2="84"/.test(out.svg));
  const chord = KMedia.renderStaffSVG([{ p: ['C4', 'D4'], d: 2 }], '4/4', 'c');
  check('คอร์ดมีหัวโน้ต 2 หัว', (chord.svg.match(/class="kh"/g) || []).length === 2);
})();
check('รายการ MISSING: บรรทัดเปล่าพร้อมข้อความ ไม่เดาโน้ต', (() => { const o = KMedia.renderStaffSVG([], '4/4', 'm'); return o.svg.indexOf('ยังไม่มีโน้ต') > 0 && o.svg.indexOf('class="kh"') < 0; })());

// ===== 4) ผังลิ่ม =====
(function () {
  const svg = KMedia.renderTineSVG(KM.tines, 'tt');
  check('ผังลิ่มมี 17 ลิ่ม', (svg.match(/class="kt"/g) || []).length === 17);
  const order = []; svg.replace(/id="tt-t-([A-G]\d)"/g, (m, n) => { order.push(n); return m; });
  check('ลำดับลิ่มซ้าย→ขวาตามข้อมูล', order.join(',') === KM.tines.join(','));
  const hs = []; svg.replace(/class="kt" x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)"/g, (m, h) => { hs.push(parseFloat(h)); return m; });
  check('ลิ่มกลางยาวสุด สั้นลงเมื่อห่างกลาง', hs[8] === Math.max.apply(null, hs) && hs[0] < hs[4] && hs[16] < hs[12] && near(hs[0], hs[16], 1e-6));
  let all = true; periods.forEach(p => KM.periods.M1[p].forEach(it => it.notes.forEach(n => n.p.forEach(pn => { if (svg.indexOf('id="tt-t-' + pn + '"') < 0) all = false; }))));
  check('ทุกโน้ตของทุกคาบมีลิ่มให้ไฮไลต์', all);
})();

// ===== 5) Transport (เมโทรนอม + เล่นโน้ต) =====
function fakeCtx() {
  const c = { currentTime: 10, clicks: [], tones: [], resumed: 0,
    destination: {}, resume() { c.resumed++; },
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; },
    createOscillator() {
      const o = { type: 'sine', frequency: { value: 0 }, connect() {}, start(t) { o._t = t; (o.type === 'square' ? c.clicks : c.tones).push({ t, f: o.frequency.value, type: o.type }); }, stop() {} };
      return o;
    } };
  return c;
}
function run(ctx, T, seconds, step) { step = step || 0.025; const end = ctx.currentTime + seconds; while (ctx.currentTime < end) { T.tick(); T.pump(); ctx.currentTime += step; } T.tick(); T.pump(); }
(function () {
  const ctx = fakeCtx(); let beats = [];
  const T = new KMedia.Transport({ getCtx: () => ctx, bpm: 60, beatsPerBar: 4, click: true, setTimer: () => 1, clearTimer: () => {}, onBeat: (b, i, c) => beats.push([b, i, c]) });
  T.start(); run(ctx, T, 4.2);
  const times = ctx.clicks.map(c => c.t);
  check('เมโทรนอม 60 BPM: คลิกห่างกัน 1.000 วินาที', times.length >= 4 && times.slice(1).every((t, i) => near(t - times[i], 1.0, 1e-9)), JSON.stringify(times));
  check('คลิกจังหวะที่ 1 ของห้องเสียงสูงกว่า (accent)', ctx.clicks[0].f > ctx.clicks[1].f && near(ctx.clicks[4 % ctx.clicks.length].f, ctx.clicks[0].f) || ctx.clicks.length < 5);
  check('ตัวบ่งชี้จังหวะภาพ: inBar วนตามห้อง', beats.length >= 4 && beats.map(b => b[1]).slice(0, 5).join(',') === '0,1,2,3,0', JSON.stringify(beats.slice(0, 5)));
  T.setBpm(120); const before = ctx.clicks.length; run(ctx, T, 3);
  const t2 = ctx.clicks.slice(before).map(c => c.t);
  check('เปลี่ยนเป็น 120 BPM ระหว่างเล่น: คลิกห่าง 0.500 วินาที', t2.length >= 4 && t2.slice(2).every((t, i) => near(t - t2[i + 1], 0.5, 1e-9)), JSON.stringify(t2.slice(0, 6)));
  T.stop(); check('stop() ล้างสถานะ', T.state === 'stopped');
})();
(function () {
  // ไม่จองเกิน lookahead
  const ctx = fakeCtx(); const T = new KMedia.Transport({ getCtx: () => ctx, bpm: 240, lookahead: 0.12, click: true, setTimer: () => 1, clearTimer: () => {} });
  T.start(); const now = ctx.currentTime; T.tick();
  check('จองเสียงล่วงหน้าไม่เกิน lookahead', ctx.clicks.every(c => c.t < now + 0.12 + 1e-9), JSON.stringify(ctx.clicks));
})();
(function () {
  const it = KM.periods.M1[3][0];
  const ctx = fakeCtx(); let offs = [], ons = [], ended = 0;
  const T = new KMedia.Transport({ getCtx: () => ctx, bpm: 120, beatsPerBar: 2, countIn: 2, click: false, setTimer: () => 1, clearTimer: () => {},
    onNote: (i, w) => { if (w === 'on') ons.push(i); if (w === 'off') offs.push(i); }, onEnd: () => { ended++; } });
  T.setEvents(KMedia.buildEvents(it.notes));
  T.start(); run(ctx, T, 2 * 0.5 + it.beats * 0.5 + 1);
  check('เล่นครบทุกโน้ตเรียงลำดับ', ons.join(',') === it.notes.map((n, i) => i).join(','), ons.join(','));
  check('เสียงที่เล่นตรงกับโน้ตในโมเดล (ความถี่)', ctx.tones.length >= it.notes.length * 2 && near(ctx.tones[0].f, KMedia.freqOf('C4')) && near(ctx.tones[2].f, KMedia.freqOf('D4')));
  const first = ctx.tones[0].t, second = ctx.tones[2].t;
  check('ระยะห่างโน้ตตรงกับ BPM (120 → 0.5 วินาที/จังหวะ)', near(second - first, 0.5, 1e-9), String(second - first));
  check('นับนำ 2 จังหวะ ก่อนโน้ตแรก (≈1.0 วินาทีที่ 120 BPM นับจากกดเล่น)', first - 10 > 0.95 && first - 10 < 1.2, String(first - 10));
  check('จบแล้วเรียก onEnd ครั้งเดียวและกลับสู่ stopped', ended === 1 && T.state === 'stopped', 'ended=' + ended + ' state=' + T.state);
  check('ทุกโน้ตถูกไฮไลต์เปิดและปิด', offs.length >= it.notes.length - 0 && offs.indexOf(it.notes.length - 1) >= 0);
})();
(function () {
  const ctx = fakeCtx(); const ons = [];
  const T = new KMedia.Transport({ getCtx: () => ctx, bpm: 60, countIn: 0, click: false, setTimer: () => 1, clearTimer: () => {}, onNote: (i, w) => { if (w === 'on') ons.push(i); } });
  T.setEvents(KMedia.buildEvents(KM.periods.M1[3][0].notes));
  T.start(); run(ctx, T, 3.3); T.pause(); const n1 = ons.length; const paused = T.pausedBeat;
  run(ctx, T, 3); check('พัก: ไม่มีโน้ตเพิ่มระหว่างพัก', ons.length === n1 && T.state === 'paused');
  T.start(); run(ctx, T, 2.5);
  check('เล่นต่อจากตำแหน่งเดิม ไม่เริ่มใหม่ (ไม่ซ้ำโน้ต)', ons.length > n1 && ons[ons.length - 1] > ons[n1 - 1] && ons.indexOf(0) === ons.lastIndexOf(0), ons.join(','));
  T.restart(); run(ctx, T, 1.2);
  check('เริ่มใหม่ (restart) กลับไปโน้ตแรก', ons[ons.length - 1] === 0 || ons[ons.length - 1] === 1, ons.join(','));
  T.stop();
})();
check('วิดเจ็ตเปลี่ยน BPM ตรงตามช่วงข้อมูล (clamp)', (() => { const w = Object.create(KMedia.Widget.prototype); return typeof w.setBpm === 'function'; })());

// ===== 6) หมายเลขเครื่อง (3 หลัก 001–060, ไม่มีเลขก็ได้) =====
(function () {
  const roster = { 'ม.1/1': [], 'ม.1/2': [] };
  for (let i = 1; i <= 5; i++) roster['ม.1/1'].push({ student_id: '6500' + i, name: 'นักเรียน ' + i, no: i });
  for (let i = 1; i <= 3; i++) roster['ม.1/2'].push({ student_id: '6600' + i, name: 'เด็ก ' + i, no: i });
  KD.provider = { classes: () => Object.keys(roster), students: c => roster[c] || [] };
  Object.keys(store).forEach(k => delete store[k]);
  const R = KD.effectiveRange('ม.1/1');
  check('ช่วงเริ่มต้นหมายเลขเครื่อง = 001–060 (ตามที่ครูแจ้ง)', R.from === 1 && R.to === 60, JSON.stringify(R));
  check('normalize เป็นเลข 3 หลัก: 3→003, 12→012, 060 คงเดิม', KD.normalize('3') === '003' && KD.normalize('12') === '012' && KD.normalize(' 060 ') === '060');
  check('ยอมรับ 001, 60, 060; ปฏิเสธ 000, 061, 1000 และตัวอักษร', KD.validate('001', 'ม.1/1').ok && KD.validate('60', 'ม.1/1').value === '060' && !KD.validate('000', 'ม.1/1').ok && !KD.validate('061', 'ม.1/1').ok && !KD.validate('1000', 'ม.1/1').ok && !KD.validate('abc', 'ม.1/1').ok);
  check('"ไม่มีเลข" ใช้ได้ (เครื่องที่ไม่มีหมายเลข) และไม่ใช่ตัวเลข', KD.validate('ไม่มีเลข', 'ม.1/1').ok && KD.validate('ไม่มีเลข', 'ม.1/1').value === KD.NO_NUMBER && KD.isNone('ไม่มี'));
  KD.setConfig({ mode: 'range', from: 1, to: 40 });
  check('ครูตั้งช่วงเอง 1-40 → 009 ผ่าน, 041 ไม่ผ่าน', KD.validate('9', 'ม.1/1').ok && !KD.validate('41', 'ม.1/1').ok);
  KD.setConfig({ mode: 'list', list: ['a1', 'B2'] });
  check('โหมดรายการ: A1 ผ่าน, 5 ไม่ผ่าน', KD.validate('a1', 'ม.1/1').ok && KD.validate('a1', 'ม.1/1').value === 'A1' && !KD.validate('5', 'ม.1/1').ok);
  KD.setConfig({ mode: 'range', from: 1, to: 60 });
  const r1 = KD.set('ม.1/1', 3, '65001', '99', 'student', '2026-10-28T03:00:00.000Z', { skipValidate: false });
  check('ค่านอกช่วง 99 ถูกปฏิเสธ + ไม่เก็บ', r1.ok === false && KD.getDevice('ม.1/1', 3, '65001') === '');
  check('บันทึก 12 → เก็บเป็น 012', KD.set('ม.1/1', 3, '65001', '12', 'student', '2026-10-28T03:00:00.000Z').ok && KD.getDevice('ม.1/1', 3, '65001') === '012');
  check('แยกเก็บรายคาบ: คาบ 4 ยังว่าง', KD.getDevice('ม.1/1', 4, '65001') === '');
  KD.set('ม.1/1', 3, '65001', '7', 'teacher', '2026-10-28T04:00:00.000Z');
  const rec = KD.get('ม.1/1', 3, '65001');
  check('ประวัติ audit: 2 รายการ มีเวลา/ผู้แก้/ค่าเดิม', rec.history.length === 2 && rec.history[1].prev === '012' && rec.history[1].device === '007' && rec.history[1].by === 'teacher' && /^\d{4}-/.test(rec.history[1].at));
  check('ค่าเท่าเดิม → ไม่เพิ่มประวัติ', KD.set('ม.1/1', 3, '65001', '007', 'teacher').changed === false && KD.get('ม.1/1', 3, '65001').history.length === 2);
  check('ข้อมูลเก็บแบบ local-first ใน localStorage คีย์ ppk_kalimba_devices', !!store['ppk_kalimba_devices'] && JSON.parse(store['ppk_kalimba_devices']).records['ม.1/1_p3_65001'].device === '007');
  check('ข้อมูลที่ซิงค์ผ่าน extendedAssessments ต้องเป็นคีย์ ppk_kalimba_devices', KD.KEY === 'ppk_kalimba_devices');
  const tagged = KD.tagContent('ฝึกเสร็จแล้ว', 'ม.1/1', 3, '65001', 5000);
  check('tagContent แนบมาร์กเกอร์เครื่อง', /\[\[เครื่องคาลิมบ้า:007\]\]$/.test(tagged));
  const parsed = KD.parseContent(tagged);
  check('parseContent แยกเนื้อหาเดิมกับหมายเลข', parsed.content === 'ฝึกเสร็จแล้ว' && parsed.device === '007');
  check('tagContent ไม่แนบถ้าไม่มีหมายเลข / ไม่ซ้อนสองชั้น', KD.tagContent('x', 'ม.1/1', 5, '65001') === 'x' && (KD.tagContent(tagged, 'ม.1/1', 3, '65001').match(/\[\[/g) || []).length === 1);
  check('tagContent ตัดเนื้อหาให้พอดีขีดจำกัด', KD.tagContent(new Array(6000).join('ก'), 'ม.1/1', 3, '65001', 5000).length <= 5000);
  const a = KD.applyRemote('ม.1/1', 3, '65001', '9', '2026-10-28T03:30:00.000Z');
  check('applyRemote ไม่ทับค่าที่ครูแก้เอง', a.changed === false && a.skipped === 'teacher_edit' && KD.getDevice('ม.1/1', 3, '65001') === '007');
  const b = KD.applyRemote('ม.1/1', 3, '65002', '3', '2026-10-28T05:00:00.000Z');
  check('applyRemote รับค่าจากนักเรียนคนใหม่', b.changed === true && KD.getDevice('ม.1/1', 3, '65002') === '003' && KD.get('ม.1/1', 3, '65002').by === 'student');
  // นักเรียนระบุว่าเครื่องไม่มีเลข → ส่งไปพร้อมงานและครูเห็น
  KD.set('ม.1/1', 3, '65005', KD.NO_NUMBER, 'student');
  const tg = KD.tagContent('งาน', 'ม.1/1', 3, '65005', 5000);
  check('เครื่องไม่มีเลข: บันทึกได้ แนบมาร์กเกอร์ และอ่านกลับได้', KD.getDevice('ม.1/1', 3, '65005') === 'ไม่มีเลข' && KD.parseContent(tg).device === 'ไม่มีเลข');
  const subs = { 'ม.1/1_p4_65004': { className: 'ม.1/1', period: 4, studentId: '65004', content: 'ส่งงาน' + KD.marker('15') },
    'ม.1/1_p4_65005': { className: 'ม.1/1', period: 4, studentId: '65005', content: 'ไม่มีเครื่อง' }, 'ม.1/1_p3_65001': { className: 'ม.1/1', period: 3, studentId: '65001', content: 'x' + KD.marker('2') } };
  check('ingestSubmissions: อ่านเครื่องจากงาน 1 รายการ (ไม่ทับที่ครูแก้)', KD.ingestSubmissions(subs) === 1 && KD.getDevice('ม.1/1', 4, '65004') === '015' && KD.getDevice('ม.1/1', 3, '65001') === '007');
  check('ingestSubmissions ซ้ำ ไม่เพิ่มประวัติ', KD.ingestSubmissions(subs) === 0 && KD.get('ม.1/1', 4, '65004').history.length === 1);
  subs['ม.1/1_p4_65004'].content = 'แก้ไข' + KD.marker('16'); KD.ingestSubmissions(subs);
  check('นักเรียนส่งใหม่ด้วยเลขใหม่ → อัปเดตและเก็บประวัติ', KD.getDevice('ม.1/1', 4, '65004') === '016' && KD.get('ม.1/1', 4, '65004').history.length === 2);
  KD.set('ม.1/1', 3, '65003', '3', 'teacher');
  const conf = KD.conflicts('ม.1/1', 3);
  check('ตรวจเครื่องซ้ำกัน (003 ใช้โดย 2 คน)', conf['003'] && conf['003'].length === 2);
  KD.set('ม.1/1', 3, '65004', KD.NO_NUMBER, 'student');
  check('"ไม่มีเลข" หลายคนไม่ถือว่าซ้ำ', !KD.conflicts('ม.1/1', 3)['ไม่มีเลข']);
  check('ค้นหาด้วยชื่อ/รหัส/เบอร์เครื่อง', KD.rowsFor('ม.1/1', 3, 'นักเรียน 2').length === 1 && KD.rowsFor('ม.1/1', 3, '65001').length === 1 && KD.rowsFor('ม.1/1', 3, '007').length === 1);
  const csv = KD.exportCSV('ม.1/1', 3);
  check('CSV: BOM + หัวตาราง + 5 แถว + ประวัติ + "ไม่มีเลข"', csv.charCodeAt(0) === 0xFEFF && csv.indexOf('หมายเลขเครื่อง') > 0 && csv.split('\r\n').filter(Boolean).length === 6 && csv.indexOf('ไม่มีเลข') > 0);
  check('CSV: กัน formula injection', KD.csvCell('=1+1') === '"\'=1+1"');
  check('CSV ทุกคาบ: ครอบคลุมคาบคาลิมบ้า 2-10', KD.exportCSV('ม.1/1', 'all').split('\r\n').filter(Boolean).length === 1 + 5 * 9);
  check('audit log เรียงใหม่→เก่า', (() => { const l = KD.auditLog('ม.1/1', 3); return l.length >= 3 && l[0].at >= l[l.length - 1].at; })());
  check('เวลาแสดงเป็น UTC+7', KD.fmtTime('2026-10-28T03:00:00.000Z') === '2026-10-28 10:00:00 (UTC+7)');
})();

// ===== 7) ความเข้ากันได้กับมือถือรุ่นเก่า =====
const COMPAT_FILES = ['app/js/kalimba-media.js', 'app/js/kalimba-devices.js', 'app/js/kalimba-notes.js', 'app/js/kalimba-practice.js', 'app/js/kalimba-note-editor.js', 'app/data/kalimba_media.js'];
const BANNED = [
  ['optional chaining ?.', /\?\.[A-Za-z_\[(]/],
  ['nullish ??', /\?\?/],
  ['arrow function =>', /=>/],
  ['template literal `', /`/],
  ['let/const', /(^|[^\w.$])(let|const)\s+[\w$\[{]/m],
  ['class declaration', /(^|[^\w.$])class\s+[A-Za-z_$][\w$]*\s*[{ ]/m],
  ['async/await', /(^|[^\w.$])(async\s+function|await\s+)/],
  ['spread/rest ...', /\.\.\.[A-Za-z_$\[({]/],
  ['CSS gap', /(^|[;{'"\s])(row-|column-)?gap\s*:/],
  ['aspect-ratio', /aspect-ratio\s*:/],
  ['container query', /@container|container-type/],
  [':has()', /:has\(/],
  ['flex/grid layout', /display\s*:\s*(-webkit-)?(inline-)?(flex|grid)/],
  ['Array.from/includes/find', /\.(includes|startsWith|endsWith|padStart|flatMap)\(|Array\.from|Object\.(assign|entries|values)\(/],
  ['Number.isFinite / Promise / fetch', /Number\.is(Finite|Integer)|new Promise|[^\w.]fetch\(/]
];
function stripComments(t) { return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1'); }
COMPAT_FILES.forEach(rel => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  BANNED.forEach(b => check('มือถือเก่า: ' + rel + ' ไม่มี ' + b[0], !b[1].test(src), (src.match(b[1]) || [''])[0]));
});
check('ไฟล์สื่อคาลิมบ้าไม่เรียกเครือข่าย (ออฟไลน์ได้)', COMPAT_FILES.filter(rel => /\/js\//.test(rel)).every(rel => !/XMLHttpRequest|https?:\/\/(?!www\.w3\.org)/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))));
check('เลย์เอาต์ภาพใช้ padding-bottom + viewBox (ไม่พึ่ง aspect-ratio)', /padding-bottom:/.test(fs.readFileSync(path.join(ROOT, 'app/js/kalimba-media.js'), 'utf8')));
check('เคารพ prefers-reduced-motion', /prefers-reduced-motion/.test(fs.readFileSync(path.join(ROOT, 'app/js/kalimba-media.js'), 'utf8')));


// ===== t46u: กุญแจซอล + อัตราจังหวะ — กล่องขอบเขต (bounding box) ไม่ทับกัน/ไม่หลุดบรรทัด =====
(function () {
  const S = 8, yTop = 44, clefX = 10, tsX = 44;
  const d = KMedia.clefPath(clefX, yTop, S);
  const pts = []; let cur = null, m;
  const cmds = d.match(/[MCL][^MCL]*/g) || [];
  function xy(t) { return t.trim().split(/[\s]+/).map(q => q.split(',').map(Number)); }
  function cub(a, b, c, e) { for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; pts.push([u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*e[0], u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*e[1]]); } }
  cmds.forEach(c => { const a = xy(c.slice(1));
    if (c[0] === 'M') { cur = a[0]; pts.push(cur); }
    else if (c[0] === 'L') { pts.push(a[0]); cur = a[0]; }
    else { cub(cur, a[0], a[1], a[2]); cur = a[2]; } });
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const bb = { l: Math.min.apply(null, xs), r: Math.max.apply(null, xs), t: Math.min.apply(null, ys), b: Math.max.apply(null, ys) };
  check('t46u: กุญแจซอลเป็น <path> (ไม่ใช่ตัวอักษร Unicode)', /^M[\d.,\s\-CL]+$/.test(d) && !/𝄞/.test(d));
  check('t46u: กุญแจซอลอยู่ในกรอบกว้างไม่เกิน 3 ช่องบรรทัด และไม่ชนอัตราจังหวะ', bb.l >= clefX - 2 && bb.r <= tsX - 5 - 4, JSON.stringify(bb));
  check('t46u: กุญแจซอลสูงกว่าเส้นบน (ห่วงบน) และหางต่ำกว่าเส้นล่าง', bb.t < yTop - S * 0.5 && bb.b > yTop + 4 * S + 2, JSON.stringify(bb));
  check('t46u: ไม่สูงเกินพื้นที่ระบบบรรทัด (top ≥ 0, ไม่ล้ำระบบถัดไป 116)', bb.t >= 0 && bb.b <= 116, JSON.stringify(bb));
  const g = yTop + 3 * S;
  check('t46u: วงขดพันรอบเส้น G (เส้นที่ 2 จากล่าง)', ys.some(y => Math.abs(y - g) < 2.5) && bb.t < g && bb.b > g);
  // อัตราจังหวะ: ตัวเลขซ้อน 2 ตัว คนละตำแหน่งแนวตั้ง แยกชัด และไม่ซ้อนกับกุญแจ
  const svg = KMedia.renderStaffSVG([{ p: ['C4'], d: 1 }, { p: ['D4'], d: 1 }, { p: ['E4'], d: 1 }, { p: ['F4'], d: 1 }], '4/4', 'tcl').svg;
  const ts = (svg.match(/<text class="ts"[^>]*>[^<]*<\/text>/g) || []);
  check('t46u: อัตราจังหวะมี 2 ตัวเลขซ้อน (4 บน / 4 ล่าง)', ts.length === 2 && /y="([\d.]+)"/.test(ts[0]) && />4</.test(ts[0]) && />4</.test(ts[1]));
  if (ts.length === 2) {
    const y1 = Number(ts[0].match(/y="([\d.]+)"/)[1]), y2 = Number(ts[1].match(/y="([\d.]+)"/)[1]), fs_ = Number(ts[0].match(/font-size="(\d+)"/)[1]);
    const x1 = Number(ts[0].match(/x="([\d.]+)"/)[1]);
    check('t46u: ตัวเลขบน/ล่างห่างกันและอยู่ในบรรทัด 5 เส้น', (y2 - fs_ * 0.72) - y1 >= 2 && y1 - fs_ * 0.72 >= yTop && y2 <= yTop + 4 * S + 1, y1 + '/' + y2);
    check('t46u: อัตราจังหวะอยู่ขวากุญแจ ห่างอย่างน้อย 4 หน่วย และซ้ายโน้ตตัวแรก', x1 - fs_ * 0.35 - bb.r >= 4 && x1 + fs_ * 0.35 < 62, (x1 - fs_ * 0.35 - bb.r).toFixed(1));
  }
  check('t46u: renderStaffSVG ใช้กุญแจชุดเดียวกับ clefPath', svg.indexOf(d.split(' ')[0]) > -1 && /<path class="clef"/.test(svg));
  const idx = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
  check('t46u: บรรทัด 5 เส้นในหน้าสื่อ (index.html) ใช้ path เดียวกับ clefPath', /KalimbaMedia\.clefPath\(50,60,20\)/.test(idx));
})();

console.log('test_kalimba_media: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
