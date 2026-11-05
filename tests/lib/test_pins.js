// PIN จำลองสำหรับบัญชีตัวอย่าง/เซิร์ฟเวอร์พรีวิว/เทสต์เท่านั้น
// - สุ่มใหม่ทุกครั้งที่รันโปรเซส ไม่เก็บค่า PIN ตายตัวไว้ใน repo
// - กำหนดเองได้ด้วย MS_TEST_PIN_A / MS_TEST_PIN_B (ต้องเป็นเลข 6 หลัก ไม่ซ้ำกันหมด ไม่ใช่ 123456/654321)
// - เขียนค่ากลับลง process.env เพื่อให้โปรเซสลูก (เช่น tools/local_server.js ที่เทสต์ spawn) ใช้ค่าเดียวกัน
'use strict';
const crypto = require('crypto');

function valid(p) { return /^\d{6}$/.test(p) && !/^(\d)\1{5}$/.test(p) && p !== '123456' && p !== '654321'; }
function gen(avoid) {
  for (;;) {
    const p = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    if (valid(p) && p !== avoid) return p;
  }
}
function pick(name, avoid) {
  const v = process.env[name];
  if (v !== undefined && v !== '') {
    if (!valid(v)) throw new Error(name + ' ต้องเป็น PIN 6 หลักที่ไม่ซ้ำ/ไม่เรียง');
    return v;
  }
  return gen(avoid);
}

const PIN_A = pick('MS_TEST_PIN_A');
let PIN_B = pick('MS_TEST_PIN_B', PIN_A);
if (PIN_B === PIN_A) PIN_B = gen(PIN_A);
process.env.MS_TEST_PIN_A = PIN_A;
process.env.MS_TEST_PIN_B = PIN_B;

module.exports = { PIN_A, PIN_B };
