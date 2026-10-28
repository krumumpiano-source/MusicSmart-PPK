/* โฟลเดอร์ drop-in สื่อรายคาบครบ p01–p20 + README + ไฟล์เสริมในคาบที่ วก.5 ไม่ระบุสื่อ */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
const B = require(path.join(ROOT, 'tools/curriculum/build_period_media.js'));
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/curriculum/period_media_source.json'), 'utf8'));
check('นิยาม 20 คาบ', src.periods === 20);
for (let p = 1; p <= 20; p++) {
  const d = path.join(ROOT, 'app', src.root, 'p' + String(p).padStart(2, '0'));
  check('มีโฟลเดอร์ + README คาบ ' + p, fs.existsSync(path.join(d, 'README.txt')));
}
const slotPeriods = {}; src.slots.forEach(s => { slotPeriods[s.period] = 1; });
check('README คาบที่ไม่มีช่องบอกว่า วก.5 ไม่ระบุสื่อ และวางไฟล์เสริมได้', fs.readFileSync(path.join(ROOT, 'app', src.root, 'p01/README.txt'), 'utf8').indexOf('ไฟล์เสริม') > 0 && !slotPeriods[1]);
check('README คาบที่มีช่องระบุชื่อไฟล์ที่ต้องวาง', fs.readFileSync(path.join(ROOT, 'app', src.root, 'p12/README.txt'), 'utf8').indexOf('p12_mystery_pipat') > 0);
// ไฟล์เสริมชั่วคราวในคาบ 1 ต้องถูกเก็บเป็น extras (แล้วลบทิ้ง)
const tmp = path.join(ROOT, 'app', src.root, 'p01', '__tmp_test.mp3');
try { fs.writeFileSync(tmp, 'x'); const r = B.build(); check('ไฟล์เสียงที่ครูวางในคาบ 1 กลายเป็นไฟล์เสริม', r.data.extras && r.data.extras['1'] && r.data.extras['1'][0].kind === 'audio' && /p01\/__tmp_test\.mp3$/.test(r.data.extras['1'][0].file)); }
finally { try { fs.unlinkSync(tmp); } catch (e) {} }
check('ลบไฟล์ทดสอบแล้ว (manifest จริงไม่มีไฟล์เสริม)', !fs.existsSync(tmp) && !(B.build().data.extras && B.build().data.extras['1']));
console.log('test_period_folders: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
