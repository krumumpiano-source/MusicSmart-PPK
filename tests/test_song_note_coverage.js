/* เพลงที่ 2 ของคาบ 8 และ 10 (Joy to the World ท่อนแรก แทน Do-Re-Mi) ต้องให้นักเรียนฝึกโน้ตครบทุกตัวที่เรียนในม.1
 * (วก.5: ด ร ม ฟ ซ ล ท ดํ = C4 D4 E4 F4 G4 A4 B4 C5) อย่างน้อยตัวละ 1 ครั้ง · 4/4 · ไม่เกิน 16 ห้อง · อยู่ในช่วงลิ่มคาลิมบ้า
 * และครอบคลุมทุกโน้ตที่แบบฝึกคาบ 2–7 ใช้ (ถ้าครูเพิ่มโน้ตนอกสเกลในแบบฝึก เทสต์นี้จะเตือนให้เพิ่มในเพลงด้วย) */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } }
global.window = global;
const KM = require(path.join(ROOT, 'app/data/kalimba_media.js'));
const P = KM.periods.M1, T = KM.tines;
const SCALE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const DRAFT = 'ร่างโดยระบบ – ครูตรวจก่อนใช้';
const song8 = P[8].filter(x => x.kind === 'song' && x.id !== 'p8_ode_to_joy')[0];
const song10 = P[10].filter(x => x.kind === 'song')[0];
const pitches = it => it.notes.reduce((a, n) => a.concat(n.p), []);

check('พบเพลงที่ 2 ของคาบ 8 และคาบ 10', !!song8 && !!song10);
check('ไม่ใช่เพลง Do-Re-Mi (ชื่อ/รหัส) และไม่ใช่ทำนองมีลิขสิทธิ์', !/do[-_ ]?re[-_ ]?mi/i.test(song8.id + song8.title + song10.id + song10.title));
check('เป็นทำนองสาธารณสมบัติ ระบุที่มา (Antioch) และติดป้ายร่างโดยระบบ', song8.provenance === 'public_domain' && song10.provenance === 'public_domain' && /Antioch/.test(song8.source) && song8.draft === DRAFT && song10.draft === DRAFT);
const set8 = new Set(pitches(song8));
SCALE.forEach(n => check('คาบ 8: เพลงมีโน้ต ' + n + ' อย่างน้อย 1 ครั้ง', set8.has(n)));
check('คาบ 8: ไม่มีโน้ตนอกสเกล C4–C5 (ไม่มีตัวแปลงเสียง/นอกช่วง)', [...set8].every(n => SCALE.indexOf(n) >= 0));
check('คาบ 10: ใช้โน้ตเดียวกับคาบ 8 ครบทุกตัว', JSON.stringify(song10.notes) === JSON.stringify(song8.notes) && SCALE.every(n => new Set(pitches(song10)).has(n)));
check('ทุกโน้ตอยู่ในลิ่มคาลิมบ้า 17 ลิ่ม', pitches(song8).every(n => T.indexOf(n) >= 0));
const beats = song8.notes.reduce((s, n) => s + n.d, 0);
check('อัตรา 4/4 และความยาว 8–16 ห้อง ไม่เกิน', song8.meter === '4/4' && beats % 4 === 0 && beats / 4 <= 16 && beats / 4 >= 1, 'beats=' + beats);
check('จังหวะง่าย: ค่าความยาวทุกโน้ตเป็นจำนวนเต็มของจังหวะ (1 หรือ 2)', song8.notes.every(n => n.d === 1 || n.d === 2));
check('1 โน้ต = 1 วรรค: จำนวนโน้ต = 8', song8.notes.length === 8);
const usedByExercises = new Set();
Object.keys(P).forEach(p => { if (Number(p) >= 2 && Number(p) <= 7) P[p].forEach(it => pitches(it).forEach(n => usedByExercises.add(n))); });
check('ทุกโน้ตที่แบบฝึกคาบ 2–7 ใช้ มีอยู่ในเพลงที่ 2', usedByExercises.size > 0 && [...usedByExercises].every(n => set8.has(n)), [...usedByExercises].filter(n => !set8.has(n)).join(','));
console.log('test_song_note_coverage: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
