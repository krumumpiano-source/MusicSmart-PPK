/* ทุกแบบฝึก/บทเพลงที่ วก.5 ม.1 (คาบ 2–10) ระบุชื่อไว้ ต้องปรากฏในโปรแกรม:
 *   wk5_plans.js  →  kalimba_media.js (22 ชุดโน้ต)  →  รายการของคาลิมบ้าจำลอง (VirtualKalimba.buildSongList)
 * และต้องไม่มีเพลงเก่านอก วก.5 (หนูมาลี, Twinkle, พรปีใหม่, ล่องแม่ปิง, Ode to Joy ฉบับ Beethoven เดิม) ฝังในโค้ดฝั่งนักเรียน ม.1
 * หมายเหตุ: วก.5 ฉบับเอกสารยังเขียน Do-Re-Mi (คาบ 8/10) — ครูอนุมัติให้ใช้ Joy to the World แทนในโปรแกรม
 *   (ดู docs/PROPOSED_DOC_PATCH_DOREMI.md) จึงตรวจเพลงที่ 2 เป็น Joy to the World โดยตั้งใจ */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } }
global.window = global;
const wkSrc = fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8');
const WK5 = new Function(wkSrc + ';return WK5_PLANS;')().M1;
const KM = require(path.join(ROOT, 'app/data/kalimba_media.js'));
global.KALIMBA_MEDIA = KM;
const VK = require(path.join(ROOT, 'app/js/virtual-kalimba.js'));

const flat = o => typeof o === 'string' ? o : Array.isArray(o) ? o.map(flat).join(' ') : (o && typeof o === 'object') ? Object.keys(o).map(k => flat(o[k])).join(' ') : '';
const wkText = p => flat(WK5[String(p)]);

// [คาบ, วลีที่ วก.5 ใช้เรียกแบบฝึก (ต้องอยู่ในแผนคาบนั้น), วลีเดียวกันในชื่อรายการ, จำนวนรายการขั้นต่ำ]
const EXPECT = [
  [2, 'ทดลองดีดไล่สเกล', 'ดีดไล่สเกล', 1],
  [3, 'สเกล C Major', 'สเกล C Major', 1],
  [4, 'ขั้นคู่เสียงรูทคงที่ตัวโด', 'ขั้นคู่เสียงรูทคงที่ตัวโด', 1],
  [5, 'ขั้นคู่ 3 รูทเคลื่อนที่', 'ขั้นคู่ 3 รูทเคลื่อนที่', 1],
  [6, 'ขั้นคู่ 4 รูทเคลื่อนที่', 'ขั้นคู่ 4 รูทเคลื่อนที่', 1],
  [7, 'โน้ตอนุกรม 3 ตัว', 'โน้ตอนุกรม 3 ตัว', 13],   // 12 ลวดลาย + ชุดฝึกต่อเนื่อง
  [8, 'Ode to Joy', 'Ode to Joy', 1],
  [9, 'Ode to Joy', 'Ode to Joy', 1]
];
const list = VK.buildSongList();
const byPeriod = {}; list.forEach(g => { byPeriod[g.period] = g.items; });

EXPECT.forEach(e => {
  const p = e[0], items = byPeriod[p] || [];
  check('วก.5 คาบ ' + p + ' ระบุ "' + e[1] + '"', wkText(p).indexOf(e[1]) >= 0);
  check('kalimba_media คาบ ' + p + ' มีรายการ ≥ ' + e[3], (KM.periods.M1[p] || []).length >= e[3]);
  check('รายการคาลิมบ้าจำลอง คาบ ' + p + ' มี "' + e[2] + '"', items.some(i => String(i.title).indexOf(e[2]) >= 0));
  check('รายการคาบ ' + p + ' มีโน้ตครบ (ไม่ว่าง)', items.length > 0 && items.every(i => i.notes && i.notes.length > 0));
});
// คาบ 7: ครบ 12 ลวดลายตาม วก.5 (3 โน้ต × 12)
const p7 = byPeriod[7] || [];
for (let n = 1; n <= 12; n++) check('คาบ 7 มีลวดลายที่ ' + n, p7.some(i => i.id === 'p7_pattern_' + n && i.notes.length === 3));
check('คาบ 7 มีชุดฝึกต่อเนื่อง 12 ลวดลาย', p7.some(i => i.id === 'p7_full_series' && i.notes.length === 37));
// คาบ 8/10: เพลงที่ 2 = Joy to the World (ครูอนุมัติแทน Do-Re-Mi)
check('คาบ 8 มี Joy to the World (เพลงที่ 2)', (byPeriod[8] || []).some(i => /Joy to the World/.test(i.title)));
check('คาบ 10 มี Joy to the World (เก็บคะแนนครั้งที่ 2)', (byPeriod[10] || []).some(i => /Joy to the World/.test(i.title)));
check('วก.5 คาบ 10 (หลังแก้ docx 28 ต.ค. 2569) เรียกเพลงที่ 2 ว่า Joy to the World และไม่เหลือ Do-Re-Mi', /Joy to the World/.test(wkText(10)) && !/Do-Re-Mi/.test(wkText(10)));
for (const pp of [8, 9, 10]) check('วก.5 คาบ ' + pp + ' ไม่มี Do-Re-Mi', !/Do-Re-Mi/i.test(wkText(pp)));
check('ไม่มี Do-Re-Mi เป็นชื่อ/รหัสรายการของโปรแกรม (หมายเหตุอธิบายการเปลี่ยนเพลงมีได้)', !list.some(g => g.items.some(i => /do[-_ ]?re[-_ ]?mi/i.test(i.id + ' ' + i.title))));
// คาบอื่นที่ไม่มีแบบฝึกคาลิมบ้า ต้องไม่โผล่ในรายการ
const allowed = [2, 3, 4, 5, 6, 7, 8, 9, 10];
check('รายการมีเฉพาะคาบ 2–10 ตาม วก.5', list.every(g => allowed.indexOf(g.period) >= 0) && allowed.every(p => byPeriod[p]));
check('จำนวนรายการรวม = 22', list.reduce((s, g) => s + g.items.length, 0) === 22);
// เลือกใน dropdown ได้ทุกรายการ (value = คาบ|id)
check('รหัสรายการไม่ซ้ำกัน', new Set(list.reduce((a, g) => a.concat(g.items.map(i => i.id)), [])).size === 22);

// ไม่มีเพลงเก่าฝังในโค้ด
const OLD = /หนูมาลี|Mary Had|Twinkle|ดาวดวงน้อย|พรปีใหม่|ล่องแม่ปิง|Beethoven/;
const vkSrc = fs.readFileSync(path.join(ROOT, 'app/js/virtual-kalimba.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
check('virtual-kalimba.js ไม่มี PRACTICE_SONGS/เพลงฝังในโค้ด', !/PRACTICE_SONGS/.test(vkSrc) && !OLD.test(vkSrc) && VK.PRACTICE_SONGS === undefined);
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const appjs = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
check('index.html ไม่มีโน้ตเพลง หนูมาลี/Twinkle ฝังอยู่', !/หนูมาลี|Mary Had|Twinkle|ดาวดวงน้อย/.test(html));
check('app.js ไม่มีโน้ตเพลง หนูมาลี/Twinkle ฝังอยู่', !/หนูมาลี|Mary Had|Twinkle|ดาวดวงน้อย|พรปีใหม่/.test(appjs));
check('dropdown ใน index.html เติมจากข้อมูล (ไม่มี <option> ฝัง)', !/id="kalimba-song-select"[^>]*>\s*<option/.test(html) && /kalimba-vk-widget/.test(html));
check('ไม่มีไฟล์ในแอปที่เรียก PRACTICE_SONGS', !fs.readdirSync(path.join(ROOT, 'app/js')).some(f => /PRACTICE_SONGS/.test(fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8'))));
console.log('test_wk5_exercise_coverage: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
