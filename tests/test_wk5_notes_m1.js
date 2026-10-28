/* วก.5 ม.1 — โน้ตคาลิมบ้าที่ระบบร่างต้องตรงกับข้อความ วก.5 (จุดประสงค์ข้อ K) ทุกคาบ, ป้ายร่าง, ลิขสิทธิ์ (Do-Re-Mi),
 * ลวดลายสุ่มคาบ 7 (12 ลวดลาย), และเล่น/ไฮไลต์/เมโทรนอม/บรรทัด/ผังลิ่ม ครบทุกรายการ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } }
global.window = global;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.WK5_PLANS = require(path.join(ROOT, 'app/data/wk5_plans.js'));
const W = global.WK5_PLANS.M1 || global.WK5_PLANS;
const KM = require(path.join(ROOT, 'app/data/kalimba_media.js'));
const KMedia = require(path.join(ROOT, 'app/js/kalimba-media.js'));
const KP = require(path.join(ROOT, 'app/js/kalimba-practice.js'));
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/curriculum/kalimba_media_source.json'), 'utf8'));
const S = SRC.solfege, T = KM.tines, DRAFT = 'ร่างโดยระบบ – ครูตรวจก่อนใช้';
const P = KM.periods.M1;
const th = n => { const L = 'CDEFGAB', o = Number(n.slice(-1)); return ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'][L.indexOf(n[0])] + '\u0E4D'.repeat(Math.max(0, o - 4)); };
const labels = it => it.notes.map(n => n.p.map(th).join('+'));
// ดึงรายการคู่/ลวดลายจากข้อความจุดประสงค์ K ของ วก.5: "(...)" อันแรก คั่นด้วย , และ /
function listFromObjective(period, rx) {
  const k = (W[period].objectives.k || []).join(' ');
  const m = rx.exec(k); return m ? m[1].split(/\s*[,/]\s*/).map(s => s.trim()).filter(Boolean) : null;
}
function expand(pairsStr) { return pairsStr.map(x => x.split('-')).reduce((a, g) => a.concat(g), []); }

// ลำดับโน้ตที่คาดหวัง = รายการกลุ่มจาก วก.5 ขยายด้วยแม่แบบจังหวะที่ประกาศไว้ (คำนวณแยกจากตัวสร้างข้อมูล)
const RT = SRC.rhythmTemplates;
function srcItem(id) { let f = null; Object.keys(SRC.periods).forEach(k => SRC.periods[k].items.forEach(i => { if (i.id === id) f = i; })); return f; }
function expectedRhythm(id, groups) {
  const r = srcItem(id).rhythm, out = [];
  groups.forEach((g, i) => { const t = RT[r.byGroup ? r.byGroup[i] : r.cycle[i % r.cycle.length]]; t.idx.forEach(j => out.push(g[j])); });
  if (r.ending) out.push(r.ending.solfege);
  return out;
}
const grp = a => a.map(x => x.split('-'));
const norm = s => s.replace(/\u02DA|\u00B0/g, '\u0E4D');

// ===== โน้ตตรงข้อความ วก.5 =====
const p4 = listFromObjective(4, /\(([^)]*ด-ร[^)]*)\)/), p5 = listFromObjective(5, /\(([^)]*ด-ม[^)]*)\)/), p6 = listFromObjective(6, /\(([^)]*ด-ฟ[^)]*)\)/), p7 = listFromObjective(7, /\(([^)]*ด-ร-ม[^)]*)\)/);
check('อ่านรายการจาก วก.5 ได้: คาบ 4=14 คู่, 5=12, 6=10, 7=12', p4 && p4.length === 14 && p5 && p5.length === 12 && p6 && p6.length === 10 && p7 && p7.length === 12, [p4, p5, p6, p7].map(x => x && x.length).join(','));
check('P4: โน้ตทุกตัวตรงรายการ 14 คู่ใน วก.5 ตามลำดับ', labels(P[4][0]).join(',') === expectedRhythm('p4_root_do_pairs', grp(p4)).join(','));
check('P5: ขาไป 6 + ขากลับ 6 ตรง วก.5', labels(P[5][0]).join(',') === expectedRhythm('p5_moving_3rds', grp(p5)).join(','));
check('P6: ขาไป 5 + ขากลับ 5 ตรง วก.5', labels(P[6][0]).join(',') === expectedRhythm('p6_moving_4ths', grp(p6)).join(','));
check('P7: 12 ลวดลายตรง วก.5 ทีละลวดลาย (ขึ้น 6 + ลง 6)', P[7].filter(x => x.testPool).every((x, i) => labels(x).join('-') === p7[i]));
check('P7: ชุดฝึกต่อเนื่อง = 12 ลวดลายเรียงตาม วก.5', labels(P[7][12]).join(',') === expectedRhythm('p7_full_series', grp(p7)).join(','));
check('P3: สเกล C Major ขึ้น-ลง C4→C5→C4 (15 โน้ต ครบ 4 ห้อง 4/4)', P[3][0].notes.map(n => n.p[0]).join(',') === 'C4,D4,E4,F4,G4,A4,B4,C5,B4,A4,G4,F4,E4,D4,C4' && P[3][0].beats === 16 && P[3][0].meter === '4/4');
check('P2: สำรวจสเกล C4–C5 8 โน้ต', P[2][0].notes.map(n => n.p[0]).join(',') === 'C4,D4,E4,F4,G4,A4,B4,C5');
check('P3-P7: BPM 70-75 ตาม วก.5 (P3 เริ่ม 60 → 72)', [3, 4, 5, 6, 7].every(p => P[p].every(it => it.bpm.docRange && it.bpm.docRange.indexOf('7') === 0)) && P[3][0].bpm.start === 60 && P[4][0].bpm.start === 70);
check('คาบ 3-7 และเพลงอัตรา 4/4 (ห้องละ 4 จังหวะ ใช้ค่าตัวโน้ต 4/2/1 ตาม วก.5 คาบ 3) และบอกว่าเป็นสมมติฐานของครู', [3, 4, 5, 6, 7].every(p => P[p].every(x => x.meter === '4/4')) && P[8][0].meter === '4/4' && [4, 5, 6, 7].every(p => P[p].every(x => x.assumptions.some(a => /จังหวะ/.test(a)))));
check('วก.5 คาบ 8 บอก Ode to Joy 5 โน้ต ด ร ม ฟ ซ — เพลงใช้เฉพาะ C4–G4', /5 โน้ต: ด ร ม ฟ ซ/.test((W[8].objectives.k || []).join(' ')) && P[8][0].notes.every(n => ['C4', 'D4', 'E4', 'F4', 'G4'].indexOf(n.p[0]) >= 0));
const ode = P[8][0], od = ode.notes;
check('Ode to Joy: 4 วรรคแรก = 8 ห้อง (32 จังหวะ, 30 โน้ต) ขึ้นต้น E E F G G F E D C C D E E. D D', ode.beats === 32 && od.length === 30 && od.slice(0, 15).map(n => n.p[0]).join(',') === 'E4,E4,F4,G4,G4,F4,E4,D4,C4,C4,D4,E4,E4,D4,D4' && od[12].d === 1.5 && od[13].d === 0.5);
check('Ode to Joy: วรรค 2 ห้อง × 4 = ตัวหยุดวรรคที่ห้อง 2,4,6,8 (จบห้อง: ทุก 8 จังหวะ)', (() => { let c = 0, marks = []; od.forEach(n => { c += n.d; if (c % 8 === 0) marks.push(c); }); return marks.join(',') === '8,16,24,32'; })());
check('Ode to Joy: จบวรรค 4 ที่ C4 ยาว 2 จังหวะ; วรรค 2 จบที่ D4 ยาว 2', od[od.length - 1].p[0] === 'C4' && od[od.length - 1].d === 2 && od[14].p[0] === 'D4' && od[14].d === 2);
check('Ode to Joy: โดเมนสาธารณะ ติดป้ายร่างโดยระบบ และอธิบายการตีความ "4 วรรคแรก"', ode.provenance === 'public_domain' && ode.draft === DRAFT && ode.assumptions.some(a => /4 วรรคแรก/.test(a) && /2 ห้อง/.test(a)) && !ode.unverified);
check('คาบ 9 ใช้โน้ตชุดเดียวกับคาบ 8', JSON.stringify(P[9][0].notes) === JSON.stringify(ode.notes));
const dr = P[8][1];
check('เพลงที่ 2 (แทน Do-Re-Mi): Joy to the World ท่อนแรก = สเกลลง ดํ ท ล ซ ฟ ม ร ด (C5→C4) 8 โน้ต · 1 โน้ต/1 วรรค ตาม วก.5', dr.id === 'p8_joy_to_the_world' && labels(dr).join(',') === 'ดํ,ท,ล,ซ,ฟ,ม,ร,ด' && dr.notes.length === 8 && /8 โน้ต/.test((W[8].objectives.k || []).join(' ')) && dr.meter === '4/4' && dr.beats === 16);
check('เพลงที่ 2: ทำนองสาธารณสมบัติ (Antioch/Lowell Mason 1839) ติดป้ายร่างโดยระบบ, บอกว่าเป็นทำนองไม่มีลิขสิทธิ์ และบอกว่า วก.5 (docx) แก้ชื่อเพลงแล้ว ไม่มีคำว่า Do-Re-Mi เหลือ', dr.provenance === 'public_domain' && dr.draft === DRAFT && !dr.unverified && dr.assumptions.some(a => /ลิขสิทธิ์/.test(a)) && !dr.assumptions.some(a => /Do-Re-Mi/.test(a)) && /Antioch/.test(dr.source) && dr.assumptions.some(a => /วก\.5 \(ไฟล์ docx\)/.test(a)));
check('เพลงที่ 2: ใช้โน้ตเรียงลง C5,B4,A4,G4,F4,E4,D4,C4 ตัวละ 2 จังหวะ', JSON.stringify(dr.notes.map(n => n.p[0])) === JSON.stringify(['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4']) && dr.notes.every(n => n.d === 2));
// ครอบคลุมโน้ตทั้งหมดที่ใช้ในชุดฝึกม.1: เพลงที่ 2 ต้องมีครบทุกตัวอย่างน้อย 1 ครั้ง (ด ร ม ฟ ซ ล ท ดํ)
const usedAll = new Set(); Object.keys(P).forEach(p => P[p].filter(it => it.kind !== 'song').forEach(it => it.notes.forEach(n => n.p.forEach(x => usedAll.add(x)))));
const songSet = new Set(dr.notes.map(n => n.p[0]));
check('ความครอบคลุม: โน้ตที่ใช้ในแบบฝึกคาบ 2–7 = สเกล C4–C5 8 ตัว และเพลงที่ 2 (คาบ 8) มีครบทุกตัว', [...usedAll].sort().join(',') === 'A4,B4,C4,C5,D4,E4,F4,G4' && [...usedAll].every(x => songSet.has(x)) && songSet.size === 8);
check('ความครอบคลุม: เพลงที่ 2 ครบทุกโน้ตด้วย (ด ร ม ฟ ซ ล ท ดํ) บนคาลิมบ้า และทุกโน้ตเป็นลิ้นที่มีจริง', ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท', 'ดํ'].every(l => labels(dr).indexOf(l) >= 0) && dr.notes.every(n => n.p.every(x => T.indexOf(x) >= 0)));
check('ชื่อเพลงที่ 2 และรหัสรายการไม่ใช่ Do-Re-Mi แล้ว', !/Do-Re-Mi/.test(dr.title) && !/Do-Re-Mi/.test(P[10][0].title) && !/do_re_mi/i.test(JSON.stringify(Object.keys(P).map(p => P[p].map(x => x.id)))));
check('ทุกรายการมีโน้ต (ไม่มี missing) และมีป้ายร่างโดยระบบ + ที่มา (wk5_text / public_domain / original)', Object.keys(P).every(p => P[p].every(it => it.status !== 'missing' && it.notes.length > 0 && it.draft === DRAFT && ['wk5_text', 'public_domain', 'original'].indexOf(it.provenance) >= 0)));
check('ไม่มีรายการที่ยังค้าง gaps หรือ partial', Object.keys(P).every(p => P[p].every(it => !(it.gaps || []).length && !it.partial && !it.unverified)));
check('ทุกโน้ตอยู่ในช่วงลิ่มคาลิมบ้า 17 ลิ่ม และอยู่ในช่วง C4–C5', Object.keys(P).every(p => P[p].every(it => it.notes.every(n => n.p.every(pn => T.indexOf(pn) >= 0 && ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].indexOf(pn) >= 0)))));
check('ทำนองเพลงที่เหลือไม่ถูกเขียนเกิน วก.5: มีเฉพาะเพลง Ode to Joy และ Joy to the World (ท่อนแรก)', Object.keys(P).every(p => P[p].filter(x => x.kind === 'song').every(x => /Ode to Joy|Joy to the World/.test(x.title))));

// ===== ครูแก้ไขแล้วแทนที่ร่าง =====
const KN = require(path.join(ROOT, 'app/js/kalimba-notes.js'));
(function () {
  KN.setItem({ id: 'p8_ode_to_joy', period: 8, title: 'Ode to Joy (ครู)', kind: 'song', meter: '4/4', bpm: { start: 70 }, notes: KN.parseScore('ม ม ฟ ซ').notes });
  const m = KMedia.getItems('M1', 8).filter(x => x.id === 'p8_ode_to_joy')[0];
  check('โน้ตที่ครูแก้แทนที่ร่าง: ไม่มีป้ายร่าง provenance=teacher', m.notes.length === 4 && !m.draft && m.provenance === 'teacher');
  KN.removeItem('p8_ode_to_joy');
  check('ลบของครู → กลับเป็นร่างโดยระบบ', !!KMedia.getItems('M1', 8).filter(x => x.id === 'p8_ode_to_joy')[0].draft);
})();

// ===== คาบ 7: สุ่มลวดลาย =====
const pool = P[7].filter(x => x.testPool === 'p7_practical').map(x => x.id);
const cls = c => (sid, per) => ({ className: c, studentId: sid, period: per || 7 });
(function () {
  const a = cls('ม.1/1');
  let same = true, cnt = {}, i;
  for (i = 1; i <= 36; i++) { const x = KP.assignPattern(a('S' + i), pool), y = KP.assignPattern(a('S' + i), pool); if (x.itemId !== y.itemId) same = false; cnt[x.itemId] = (cnt[x.itemId] || 0) + 1; }
  check('P7: นักเรียนคนเดิมได้ลวดลายเดิมเสมอ (ไม่เปลี่ยนตามเวลา/รีเฟรช)', same);
  check('P7: ทุกคนได้ 1 ลวดลายจากกลุ่มสอบ 12 เท่านั้น', Object.keys(cnt).every(k => pool.indexOf(k) >= 0));
  let big = {}; for (i = 1; i <= 1200; i++) { const x = KP.assignPattern(a('X' + i), pool); big[x.itemId] = (big[x.itemId] || 0) + 1; }
  const vals = Object.keys(big).map(k => big[k]);
  check('P7: กระจายสม่ำเสมอทั้ง 12 ลวดลาย (1200 คน แต่ละลวดลาย 60–140)', vals.length === 12 && Math.min.apply(null, vals) >= 60 && Math.max.apply(null, vals) <= 140, JSON.stringify(big));
  const ids = pool.slice(); const x1 = KP.assignPattern(a('S1'), ids), x2 = KP.assignPattern(a('S1'), ids.slice().reverse());
  check('P7: ผลสุ่มผูกกับลำดับรายการ (ห้ามสลับลำดับ pool โดยไม่แจ้ง)', typeof x1.index === 'number' && typeof x2.index === 'number');
  check('P7: ห้อง/รหัสต่างกันได้ผลอิสระ ไม่เปิดเผยจากรหัสนักเรียนตรง ๆ (ลวดลาย ≠ เลขท้ายรหัส)', (() => { let eq = 0; for (let k = 1; k <= 120; k++) { const r = KP.assignPattern(a(String(66000 + k)), pool); if (r.index === (66000 + k) % 12) eq++; } return eq < 30; })());
  KP.setPatternOverride(a('S1'), 'p7_pattern_9');
  const ov = KP.assignPattern(a('S1'), pool);
  check('P7: ครูกำหนดลวดลายเอง (override) ใช้แทนการสุ่ม และเคลียร์แล้วกลับสุ่มเดิม', ov.itemId === 'p7_pattern_9' && ov.source === 'teacher' && (KP.clearPatternOverride(a('S1')), KP.assignPattern(a('S1'), pool).source === 'auto'));
  const rows = KP.p7Rows('ม.1/1', [{ id: 'A1', name: 'ก' }, { id: 'A2', name: 'ข' }], pool, 7);
  check('P7: ตารางครู (รายคน) ให้ลวดลายที่ 1-12 + CSV กันสูตร', rows.length === 2 && rows.every(r => r.patternNo >= 1 && r.patternNo <= 12) && /ลวดลายที่/.test(KP.p7CSV(rows)));
  check('P7: ข้อความนักเรียนไม่ฮาร์ดโค้ดจำนวน "5 ลวดลาย"', !/1 ลวดลายจาก 5 ลวดลาย|1 ใน 5/.test(fs.readFileSync(path.join(ROOT, 'app/js/kalimba-media.js'), 'utf8')));
})();

// ===== เล่น/ไฮไลต์/เมโทรนอม/บรรทัด/ผังลิ่มกับทุกรายการ =====
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
let played = 0;
Object.keys(P).forEach(p => P[p].forEach(it => {
  const ctx = fakeCtx(); const ons = [], offs = []; let ended = 0, beatsSeen = 0;
  const bpm = it.bpm.start >= 70 ? it.bpm.start : 70;
  const mt = it.meter.split('/').map(Number);
  const Tr = new KMedia.Transport({ getCtx: () => ctx, bpm: bpm, beatsPerBar: mt[0], countIn: mt[0], click: true, setTimer: () => 1, clearTimer: () => {},
    onBeat: () => { beatsSeen++; }, onNote: (i, w) => { if (w === 'on') ons.push(i); if (w === 'off') offs.push(i); }, onEnd: () => { ended++; } });
  Tr.setEvents(KMedia.buildEvents(it.notes));
  Tr.start(); run(ctx, Tr, (it.beats + mt[0]) * 60 / bpm + 2);
  const okOrder = ons.length === it.notes.length && ons.every((v, i) => v === i);
  const tn = ctx.tones.filter(t => t.type !== 'square'); const okFreq = tn.length >= it.notes.length && it.notes.every((n, i) => Math.abs(tn[i * 2].f - KMedia.freqOf(n.p[0])) < 1e-6);
  check(it.id + ': เล่นครบ ' + it.notes.length + ' โน้ตเรียงลำดับ + onEnd ครั้งเดียว + ไฮไลต์เปิด/ปิดครบ + เมโทรนอมคลิกครบ', okOrder && okFreq && ended === 1 && offs.length === it.notes.length && ctx.clicks.length >= it.beats + mt[0] - 1, 'ons=' + ons.length + ' ended=' + ended + ' clicks=' + ctx.clicks.length);
  const svgT = KMedia.renderTineSVG(T, 'u'), st = KMedia.renderStaffSVG(it.notes, it.meter, 'u');
  check(it.id + ': ผังลิ่มมีลิ่มของทุกโน้ต · บรรทัดมี id ไฮไลต์ครบ · ห้องเพลงตามอัตรา', it.notes.every(n => svgT.indexOf('id="u-t-' + n.p[0] + '"') >= 0) && Object.keys(st.ids).length === it.notes.length);
  played++;
}));
check('ตรวจครบ 22 รายการ', played === 22, String(played));
// ป้ายร่างแสดงในวิดเจ็ต
(function () {
  const el = { innerHTML: '', querySelector: () => null, addEventListener() {} };
  const w = new KMedia.Widget(el, P[8][1], { getCtx: () => fakeCtx(), reduced: true });
  const sd = el.innerHTML;
  check('นักเรียน: วิดเจ็ตไม่แสดงป้าย "ร่างโดยระบบ"/รอครูตรวจ/ข้อสังเกตสำหรับครู (t47u)', sd.indexOf(DRAFT) < 0 && !/ร่างโดยระบบ|รอครูตรวจ|ครูโปรดยืนยัน|ข้อสังเกตสำหรับครู|ℹ/.test(sd));
  w.destroy && w.destroy();
  const el2 = { innerHTML: '', querySelector: () => null, addEventListener() {} };
  const w2 = new KMedia.Widget(el2, P[8][1], { getCtx: () => fakeCtx(), reduced: true, role: 'teacher' });
  check('ครู: ป้ายร่างและหมายเหตุลิขสิทธิ์อยู่ใน <details> "ข้อสังเกตสำหรับครู" (พับ) เท่านั้น', /<details class="km-tnotes"/.test(el2.innerHTML) && el2.innerHTML.indexOf('ข้อสังเกตสำหรับครู') >= 0 && el2.innerHTML.indexOf(DRAFT) >= 0 && el2.innerHTML.indexOf('ลิขสิทธิ์') >= 0 && el2.innerHTML.indexOf(DRAFT) > el2.innerHTML.indexOf('<details class="km-tnotes"'));
  w2.destroy && w2.destroy();
})();

console.log('test_wk5_notes_m1: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
