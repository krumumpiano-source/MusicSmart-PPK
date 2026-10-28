/* fix_report_5 — ชั้นโน้ตที่ครูใส่เอง, ตัวพัก, ลวดลายสอบคาบ 7 แบบสุ่ม, บันทึกการฝึก, ตัวแปลงไวยากรณ์มือถือเก่า */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } }
function memStore() { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; }, _s: s }; }

global.window = global;
global.localStorage = memStore();
const KM = require(path.join(ROOT, 'app/data/kalimba_media.js'));
const KMedia = require(path.join(ROOT, 'app/js/kalimba-media.js'));
const KN = require(path.join(ROOT, 'app/js/kalimba-notes.js'));
const KP = require(path.join(ROOT, 'app/js/kalimba-practice.js'));
const KE = require(path.join(ROOT, 'app/js/kalimba-note-editor.js'));
const builder = require(path.join(ROOT, 'tools/curriculum/build_kalimba_media.js'));
const ms = memStore(); KN._useStorage(ms); KP._useStorage(memStore());

// ===== parseScore =====
let r = KN.parseScore('ด ร ม:2 พัก ซ+ม:1.5 | ดํ:0.5 C4:q E4:e.');
check('parseScore: 8 โน้ต/พัก ไม่มีข้อผิดพลาด', r.errors.length === 0 && r.notes.length === 8, JSON.stringify(r.errors));
check('parseScore: ด=C4, ดํ=C5', r.notes[0].p[0] === 'C4' && r.notes[5].p[0] === 'C5');
check('parseScore: ตัวพัก p=[] d=2? (ที่ 4)', r.notes[3].p.length === 0 && r.notes[3].d === 1);
check('parseScore: คอร์ด ซ+ม = G4+E4 d=1.5', r.notes[4].p.join() === 'G4,E4' && r.notes[4].d === 1.5);
check('parseScore: alias q=1, e.=0.75', r.notes[6].d === 1 && r.notes[7].d === 0.75);
check('parseScore: ผิด — C7 ไม่มีบนคาลิมบ้า', KN.parseScore('C7').errors.length === 1);
check('parseScore: ผิด — F#4 ไม่มีบนคาลิมบ้า', KN.parseScore('F#4').errors.length === 1);
check('parseScore: ผิด — ความยาว 1.2', KN.parseScore('ด:1.2').errors.length === 1);
check('parseScore: ผิด — คำที่อ่านไม่ออก', KN.parseScore('hello').errors.length === 1);
check('parseScore: ว่าง = ไม่มีโน้ต ไม่ error', (() => { const x = KN.parseScore('   '); return x.errors.length === 0 && x.notes.length === 0; })());
check('toScore ↔ parseScore วนกลับได้', (() => { const t = KN.toScore(r.notes); const r2 = KN.parseScore(t); return JSON.stringify(r2.notes) === JSON.stringify(r.notes); })());

// ===== validateItem =====
const good = { id: 't_p8_a', period: 8, title: 'ทดสอบ', kind: 'song', meter: '4/4', bpm: { start: 80 }, notes: KN.parseScore('ด ร ม ฟ').notes };
check('validateItem: ถูกต้อง', KN.validateItem(good).ok);
check('validateItem: BPM นอกช่วง', !KN.validateItem(Object.assign({}, good, { bpm: { start: 300 } })).ok);
check('validateItem: คาบนอกช่วง', !KN.validateItem(Object.assign({}, good, { period: 21 })).ok);
check('validateItem: meter ผิด', !KN.validateItem(Object.assign({}, good, { meter: '4-4' })).ok);
check('validateItem: id ผิดรูปแบบ', !KN.validateItem(Object.assign({}, good, { id: 'ก' })).ok);
check('validateItem: ชื่อโน้ตผิด', !KN.validateItem(Object.assign({}, good, { notes: [{ p: ['X9'], d: 1 }] })).ok);
check('validateItem: ห้องสุดท้ายไม่ครบ = เตือน ไม่ใช่ error', (() => { const v = KN.validateItem(Object.assign({}, good, { notes: KN.parseScore('ด ร ม').notes })); return v.ok && v.warnings.length === 1; })());

// ===== รวมเข้ากับข้อมูล generated =====
const base = KM.periods.M1[8];
check('ไม่มี override: P8 Joy to the World = ร่างโดยระบบ (สเกลโซลเฟจ 8 โน้ต) ไม่ missing', (function () { const x = KN.mergeItems(base, [], 8).filter(x => x.id === 'p8_joy_to_the_world')[0]; return x.status === 'ok' && x.notes.length === 8 && !!x.draft; })());
check('ไม่มี override: P10 Joy to the World = ร่างโดยระบบ 8 โน้ต', KM.periods.M1[10][0].status === 'ok' && KM.periods.M1[10][0].notes.length === 8 && !!KM.periods.M1[10][0].draft);
check('ข้อความสถานะ "ยังไม่มีโน้ต – รอครูใส่"', KN.EMPTY_MSG === 'ยังไม่มีโน้ต – รอครูใส่' && fs.readFileSync(path.join(ROOT, 'app/js/kalimba-media.js'), 'utf8').indexOf('ยังไม่มีโน้ต – รอครูใส่') > 0);
check('Ode to Joy (generated) = โดเมนสาธารณะ + ร่างโดยระบบ (ครูตรวจก่อนใช้)', base.filter(x => x.id === 'p8_ode_to_joy')[0].provenance === 'public_domain' && base.filter(x => x.id === 'p8_ode_to_joy')[0].draft === 'ร่างโดยระบบ – ครูตรวจก่อนใช้');

KMedia.getItems('M1', 8); // ต้องไม่พัง
check('KalimbaMedia.getItems: ก่อนครูใส่ Joy to the World เป็นร่างโดยระบบ', !!KMedia.getItems('M1', 8).filter(x => x.id === 'p8_joy_to_the_world')[0].draft);
let sv = KN.setItem({ id: 'p8_joy_to_the_world', period: 8, title: 'เพลง Joy to the World', kind: 'song', meter: '4/4', bpm: { start: 72 }, notes: KN.parseScore('ด ร ม ด').notes });
check('setItem: บันทึก override ทับรายการ generated ได้', sv.ok, JSON.stringify(sv.errors));
const m8 = KMedia.getItems('M1', 8).filter(x => x.id === 'p8_joy_to_the_world')[0];
check('หลังครูใส่: status ok, มีโน้ต 4, provenance teacher', m8.status === 'ok' && m8.notes.length === 4 && m8.provenance === 'teacher' && m8.teacherNotes === true && !m8.missing);
check('หลังครูใส่: BPM เริ่ม 72', m8.bpm.start === 72);
check('ไฟล์ generated ไม่ถูกแก้ (KALIMBA_MEDIA ยังเป็นร่าง 8 โน้ต)', KM.periods.M1[8].filter(x => x.id === 'p8_joy_to_the_world')[0].notes.length === 8 && !!KM.periods.M1[8].filter(x => x.id === 'p8_joy_to_the_world')[0].draft);
check('P10 ยังไม่ถูกกระทบ (ยังเป็นร่างโดยระบบ)', !!KMedia.getItems('M1', 10)[0].draft);
KN.setItem({ id: 'p8_ode_to_joy', period: 8, title: 'เพลง Ode to Joy', kind: 'song', meter: '4/4', bpm: { start: 60 }, notes: KM.periods.M1[8][0].notes });
check('ครูยืนยัน Ode to Joy → ไม่ unverified', KMedia.getItems('M1', 8).filter(x => x.id === 'p8_ode_to_joy')[0].unverified === undefined);
KN.setItem({ id: 't_p9_extra', period: 9, title: 'ใหม่ของครู', kind: 'exercise', meter: '2/4', bpm: { start: 60 }, notes: KN.parseScore('ซ ม').notes });
check('เพิ่มรายการใหม่ของครูในคาบ 9', KMedia.getItems('M1', 9).some(x => x.id === 't_p9_extra') && KMedia.hasKalimba('M1', 9));
check('คาบ 12 (ไม่มีรายการ) ยังไม่มีคาลิมบ้า', KMedia.hasKalimba('M1', 12) === false);
check('removeItem: ลบ override แล้วกลับเป็นร่างโดยระบบ', KN.removeItem('p8_joy_to_the_world') && !!KMedia.getItems('M1', 8).filter(x => x.id === 'p8_joy_to_the_world')[0].draft);

// ===== export / import =====
const ex = KN.exportJSON();
check('export: มี format/version/items', (() => { const o = JSON.parse(ex); return o.format === KN.FORMAT && o.version === 1 && o.items.length === 2; })());
ms._s[KN.KEY] = undefined; delete ms._s[KN.KEY];
check('หลังล้าง: ไม่มี override', KN.list().length === 0);
const im = KN.importJSON(ex);
check('import: นำเข้ากลับครบ 2 รายการ', im.added === 2 && im.rejected.length === 0 && KN.list().length === 2, JSON.stringify(im));
check('import: ไม่ใช่ JSON → error', !!KN.importJSON('not json').error);
check('import: รูปแบบผิด → error', !!KN.importJSON('{"format":"other","items":[]}').error);
const bad = KN.importJSON(JSON.stringify({ format: KN.FORMAT, items: [good, { id: 'x', period: 99 }] }));
check('import: ข้ามรายการผิด รับรายการถูก', bad.rejected.length === 1 && (bad.added + bad.updated) === 1);
check('import ซ้ำ = update', KN.importJSON(ex).updated === 2);
ms.setItem(KN.KEY, '{broken'); check('ข้อมูลในเครื่องเสียหาย → ไม่พัง คืนว่าง', KN.list().length === 0);

// ===== editor (ไม่ใช้ DOM) =====
const d = { id: 'ed_1', period: 10, gradeKey: 'M1', title: 'จากหน้าแก้ไข', kind: 'song', meter: '3/4', bpm: '90', target: '', note: 'ทดสอบ', scoreText: 'ด ร ม | ฟ ซ ล' };
check('editor.saveDraft: บันทึกสำเร็จ', KE.saveDraft(d).ok && KN.get('ed_1').notes.length === 6);
check('editor.saveDraft: โน้ตผิดไม่บันทึก', !KE.saveDraft(Object.assign({}, d, { id: 'ed_2', scoreText: 'ด ??' })).ok && !KN.get('ed_2'));
check('editor.saveDraft: ว่างไม่บันทึก', !KE.saveDraft(Object.assign({}, d, { id: 'ed_3', scoreText: '' })).ok);

// ===== ตัวพักในบรรทัด 5 เส้น + เล่น =====
const withRest = KN.parseScore('ด พัก:2 ร พัก:0.5').notes;
const svg = KMedia.renderStaffSVG(withRest, '4/4', 'r');
check('บรรทัด: ตัวพักถูกวาด (data-rest) ครบ 2 ตัว', (svg.svg.match(/data-rest="1"/g) || []).length === 2);
check('บรรทัด: ตัวพักมี id ให้ไฮไลต์', svg.ids[1] && svg.svg.indexOf('id="' + svg.ids[1] + '"') > 0);
const evs = KMedia.buildEvents(withRest);
check('เวลาเริ่ม: ตัวพักกินเวลา (ด 1, พัก 2, ร 1, พัก .5)', evs[2].start === 3 && evs[3].start === 4);

// ===== คาบ 7: ลวดลายสอบสุ่ม =====
const pool = KM.periods.M1[7].filter(x => x.testPool === 'p7_practical').map(x => x.id);
check('คาบ 7 มี 12 ลวดลายในกลุ่มสอบ (ชุดฝึกต่อเนื่องไม่อยู่ในกลุ่ม)', pool.length === 12 && pool.indexOf('p7_full_series') < 0);
const ctx = (sid) => ({ className: 'ม.1/1', studentId: sid, period: 7 });
const a1 = KP.assignPattern(ctx('65001'), pool), a2 = KP.assignPattern(ctx('65001'), pool);
check('assignPattern: คนเดียวกันได้ผลเดิมทุกครั้ง', a1.itemId === a2.itemId && a1.source === 'auto');
const cnt = {}; for (let i = 1; i <= 600; i++) { const a = KP.assignPattern(ctx(String(65000 + i)), pool); cnt[a.itemId] = (cnt[a.itemId] || 0) + 1; }
check('assignPattern: กระจายครบทั้ง 12 ลวดลาย (600 คน)', Object.keys(cnt).length === 12 && Object.keys(cnt).every(k => cnt[k] >= 25), JSON.stringify(cnt));
check('assignPattern: ห้องต่างกัน/คาบต่างกัน ไม่บังคับให้ตรงกัน', typeof KP.assignPattern({ className: 'ม.1/2', studentId: '65001', period: 7 }, pool).index === 'number');
const rows = KP.p7Rows('ม.1/1', [{ id: '65001', name: 'ก' }, { id: '65002', name: 'ข' }], pool, 7);
check('p7Rows/CSV: มีหัวคอลัมน์และ 2 แถว', rows.length === 2 && KP.p7CSV(rows).split('\r\n').length === 3);
KP.setPatternOverride(ctx('65001'), pool[4]);
check('ครูกำหนดเอง (บนเครื่องครู) มีผล', KP.assignPattern(ctx('65001'), pool).itemId === pool[4] && KP.assignPattern(ctx('65001'), pool).source === 'teacher');
KP.clearPatternOverride(ctx('65001')); check('ล้างการกำหนด → กลับอัตโนมัติ', KP.assignPattern(ctx('65001'), pool).source === 'auto');

// ===== บันทึกการฝึก (ข้อมูลประกอบ ไม่ใช่คะแนน) =====
KP.log(ctx('65001'), pool[0], 60); KP.log(ctx('65001'), pool[0], 75); KP.log(ctx('65001'), pool[0], 70);
const lg = KP.get(ctx('65001'), pool[0]);
check('practice log: 3 ครั้ง, BPM สูงสุด 75', lg.plays === 3 && lg.bestBpm === 75 && lg.lastBpm === 70);
check('practice log: ข้อความสรุป', KP.summaryText(ctx('65001'), pool[0]).indexOf('3 ครั้ง') > 0 && KP.summaryText(ctx('x'), 'none').indexOf('ยังไม่ได้ฝึก') >= 0);
check('practice log: ไม่มีรหัสนักเรียน = ไม่บันทึก', KP.log({ className: 'a', period: 7 }, pool[0], 60) === null);
check('practice CSV มีหัว+1 แถว', KP.toCSV({ className: 'ม.1/1' }).split('\r\n').length === 2);
check('practice module ไม่มีฟังก์ชันให้คะแนน (ครูให้เอง)', !/score|คะแนน.*=|setPeriodScore/i.test(fs.readFileSync(path.join(ROOT, 'app/js/kalimba-practice.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//, '')));

// ===== builder: เผยแพร่ไฟล์ที่ครูส่งออก =====
check('builder.build ปัจจุบันตรงไฟล์ generated', fs.readFileSync(path.join(ROOT, 'app/data/kalimba_media.js'), 'utf8').replace(/\r\n/g, '\n') === builder.build().js);
if (builder.buildWith) {
  const pub = builder.buildWith({ items: [{ id: 'p8_joy_to_the_world', period: 8, title: 'เพลง Joy to the World', kind: 'song', meter: '4/4', bpm: { start: 66 }, notes: KN.parseScore('ด ร ม').notes }, { id: 'bad', period: 99 }] });
  check('builder.buildWith: ครูเผยแพร่ → เข้า KALIMBA_MEDIA, รายการผิดถูกรายงาน', pub.data.periods.M1[8].filter(x => x.id === 'p8_joy_to_the_world')[0].notes.length === 3 && pub.rejected.length === 1);
}

// ===== ตัวแปลงมือถือเก่า =====
const polyOk = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'app/js/legacy-polyfills.js'), 'utf8');
  const ctx2 = vm.createContext({});
  vm.runInContext("delete Object.entries; delete Object.values; delete String.prototype.padStart; delete Array.prototype.includes; delete Array.prototype.flat;", ctx2);
  vm.runInContext(src, ctx2);
  return vm.runInContext("JSON.stringify([Object.entries({a:1}), '7'.padStart(3,'0'), [NaN].includes(NaN), [1,[2]].flat()])", ctx2) === '[[["a",1]],"007",true,[1,2]]';
})();
check('legacy-polyfills.js เติม Object.entries/padStart/includes/flat ได้', polyOk);
check('legacy-polyfills.js เป็น ES5 (ไม่มี => ` let const ?.)', !/=>|`|(^|[^\w.$])(let|const)\s|\?\./m.test(fs.readFileSync(path.join(ROOT, 'app/js/legacy-polyfills.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
check('legacy_guard.html แปลได้เป็น ES5 และมีข้อความไทย', (() => { const t = fs.readFileSync(path.join(ROOT, 'tools/build/legacy_guard.html'), 'utf8'); try { new Function(t.replace(/<\/?script>|<!--[\s\S]*?-->/g, '')); } catch (e) { return false; } return t.indexOf('อัปเดต') > 0 && !/=>|`|\blet\b|\bconst\b/.test(t.replace(/<!--[\s\S]*?-->/g, '')); })());
let esb = null; try { esb = require('esbuild'); } catch (e) {}
if (esb) {
  const code = esb.transformSync('const a = {x:{y:1}}; const z = a?.x?.y ?? 5; const f = async (q = 1) => `${q}${z}`; const o = {...a};', { target: ['chrome51', 'firefox60'] }).code;
  check('esbuild chrome51: ?. ?? async ` ... ถูกแปลง', !/\?\.|\?\?|`|\.\.\./.test(code.replace(/\/\/.*$/gm, '')));
} else console.log('  (ข้ามเทสต์ esbuild — ไม่ได้ติดตั้ง; CI ติดตั้งให้ใน deploy.yml)');

console.log('test_kalimba_notes: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
