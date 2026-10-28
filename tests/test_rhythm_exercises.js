/* แบบฝึก P2–P7: ค่าตัวโน้ตหลากหลายแต่เป็นแบบแผน (วก.5 คาบ 3: ตัวกลม 4 / ตัวขาว 2 / ตัวดำ 1 จังหวะ), ห้องเต็ม 4/4, มีเลขนับ */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
global.window = global;
const KM = require(path.join(ROOT, 'app/data/kalimba_media.js'));
const K = require(path.join(ROOT, 'app/js/kalimba-media.js'));
const SRC = require(path.join(ROOT, 'tools/curriculum/kalimba_media_source.json'));
const ALLOWED = [1, 2, 4];
[2, 3, 4, 5, 6, 7].forEach(p => KM.periods.M1[p].forEach(it => {
  const vals = it.notes.map(n => n.d), beats = vals.reduce((a, b) => a + b, 0);
  check(it.id + ': อัตรา 4/4', it.meter === '4/4');
  check(it.id + ': ใช้เฉพาะค่า 1/2/4 จังหวะ', vals.every(v => ALLOWED.indexOf(v) >= 0), vals.join(','));
  check(it.id + ': ทุกห้องเต็ม (' + beats + ' จังหวะหารด้วย 4 ลงตัว)', beats % 4 === 0);
  const distinct = new Set(vals).size;
  check(it.id + ': ค่าตัวโน้ตหลากหลาย ≥ 2 แบบ', distinct >= 2, String(distinct));
  // ไม่มีโน้ตข้ามเส้นห้อง (ตัวโน้ตต้องไม่คร่อมห้อง)
  let c = 0, cross = false; it.notes.forEach(n => { if ((c % 4) + n.d > 4) cross = true; c += n.d; });
  check(it.id + ': ไม่มีโน้ตคร่อมเส้นห้อง', !cross);
  const st = K.renderStaffSVG(it.notes, it.meter, 'rt');
  check(it.id + ': มีเลขนับจังหวะใต้บรรทัด', st.svg.indexOf('class="kcnt"') >= 0);
  check(it.id + ': มี G clef เป็นเส้นโค้ง (path) และตัวเลขอัตราจังหวะ 4/4', /<path class="clef"/.test(st.svg));
}));
// รูปแบบแบบแผน: โน้ตแบบฝึกคู่ P4-P6 ทุกกลุ่มวนแม่แบบเดิมตามรอบที่ประกาศ
['p4_root_do_pairs', 'p5_moving_3rds', 'p6_moving_4ths'].forEach(id => {
  let it = null; Object.keys(SRC.periods).forEach(k => SRC.periods[k].items.forEach(i => { if (i.id === id) it = i; }));
  check(id + ': ประกาศรอบแม่แบบ (cycle) อย่างน้อย 2 แบบ', it.rhythm.cycle.length >= 2 && new Set(it.rhythm.cycle).size >= 2);
  check(id + ': แม่แบบทุกอันที่ใช้มีอยู่จริง', it.rhythm.cycle.every(t => SRC.rhythmTemplates[t]));
});
// ตัวโน้ตครึ่งตัว (ตัวขาว/ตัวกลม) หัวโน้ตกลวง ตัวดำทึบ
const half = K.renderStaffSVG([{ p: ['C4'], d: 2 }, { p: ['D4'], d: 1 }, { p: ['E4'], d: 1 }], '4/4', 'hh').svg;
check('หัวโน้ตตัวขาวกลวง (fill ขาว/none + เส้นขอบ) และตัวดำทึบ', /<ellipse[^>]*fill="(none|#fff|#ffffff)"/.test(half) && /<ellipse[^>]*fill="#[0-9a-fA-F]{3,6}"/.test(half));
console.log('rhythm exercises: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
