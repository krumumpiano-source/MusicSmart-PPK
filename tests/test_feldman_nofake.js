/* Feldman: ไม่มีสถิติ/ข้อความสำเร็จรูปปลอมฝังในโค้ด · คีย์เวิร์ดมาจากข้อมูล · เริ่มต้นว่าง */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
global.window = global;
global.ENSEMBLE_DATA = require(path.join(ROOT, 'app/data/ensemble_data.js'));
const F = require(path.join(ROOT, 'app/js/feldman-criticism.js'));
const src = fs.readFileSync(path.join(ROOT, 'app/js/feldman-criticism.js'), 'utf8'), idx = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
check('ไม่มีข้อความสำเร็จรูป "พะเยา/85%/65 BPM/คาลิมบ้า 17 คีย์ (36)" ในโมดูล', !/พะเยา|\(85%\)|65 BPM|count: \d+/.test(src));
check('จุดพิกัดและคีย์เวิร์ดที่เลือกเริ่มว่าง', F.selectedCoord === null && F.selectedKeywords.length === 0);
const kw = F.classroomKeywords;
check('รายการคีย์เวิร์ดสร้างจากข้อมูล วก.5 คาบ 16 (ประเภทเครื่อง ความเร็ว ความดัง อารมณ์) และไม่มีตัวเลขสถิติ', kw.length >= 15 && kw.every(k => k.text && k.count === undefined) && kw.some(k => /ความเร็ว/.test(k.text)) && kw.some(k => /ความดัง/.test(k.text)) && kw.some(k => k.text === 'ตี'));
check('autoPopulate ไม่เขียนข้อความแทนนักเรียน (ไม่ตั้ง .value)', !/\.value\s*=\s*`/.test(src.slice(src.indexOf('autoPopulateFromAnalytics'), src.indexOf('closeModal()'))));
check('หน้าจอ Feldman ไม่อ้าง Word Cloud/สถิติรวมห้อง และไม่มีค่า Valence +6 ตัวอย่าง', idx.indexOf('Valence: +6') < 0 && !/Word Cloud ของห้องเรียน/.test(idx));
console.log('test_feldman_nofake: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
