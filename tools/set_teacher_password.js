#!/usr/bin/env node
// ตั้ง/รีเซ็ตรหัสผ่านครู MusicSmart บนเซิร์ฟเวอร์ (Apps Script) — รันบน PC ของครู
// ใช้: node set_teacher_password.js --url <WEB_APP_URL> --token-file <ไฟล์ SYNC_TOKEN> --email <อีเมลครู> [--name "ชื่อครู"] [--password-file <ไฟล์รหัสผ่าน>]
//   ไม่ใส่ --password-file = พิมพ์รหัสผ่านแบบซ่อน (ไม่แสดงบนจอ) และพิมพ์ยืนยันอีกครั้ง
//   ไม่บันทึก/แสดงรหัสผ่านหรือ token ในหน้าจอหรือไฟล์ใด ๆ
// ต้องใช้ Node 18+ (มี fetch ในตัว)
'use strict';
const fs = require('fs');

function args(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (m) { o[m[1]] = argv[i + 1]; i++; }
  }
  return o;
}

function readSecretFile(p) {
  return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r?\n$/, '').replace(/\r$/, '');
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) { reject(new Error('ไม่มีหน้าจอให้พิมพ์รหัสผ่าน — ใช้ --password-file แทน')); return; }
    process.stdout.write(question);
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let buf = '';
    const onData = ch => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(buf); return; }
        if (c === '\u0003') { stdin.setRawMode(false); process.stdout.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') { buf = buf.slice(0, -1); continue; }
        buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const a = args(process.argv);
  if (!a.url || !a['token-file'] || !a.email) {
    console.error('ใช้: node set_teacher_password.js --url <WEB_APP_URL> --token-file <ไฟล์ SYNC_TOKEN> --email <อีเมลครู> [--name "ชื่อ"] [--password-file <ไฟล์>]');
    process.exit(2);
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(a.url)) { console.error('URL ต้องเป็น https://script.google.com/macros/s/.../exec'); process.exit(2); }
  const token = readSecretFile(a['token-file']).trim();
  if (!token) { console.error('ไฟล์ token ว่าง'); process.exit(2); }
  let pw;
  if (a['password-file']) {
    pw = readSecretFile(a['password-file']);
  } else {
    pw = await promptHidden('รหัสผ่านครูใหม่ (อย่างน้อย 8 ตัว, ไม่แสดงบนจอ): ');
    const pw2 = await promptHidden('พิมพ์ยืนยันอีกครั้ง: ');
    if (pw !== pw2) { console.error('❌ รหัสผ่านไม่ตรงกัน'); process.exit(1); }
  }
  if (pw.length < 8) { console.error('❌ รหัสผ่านสั้นเกินไป (อย่างน้อย 8 ตัว)'); process.exit(1); }
  const res = await fetch(a.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
    body: JSON.stringify({ action: 'teacher_set_password', token, email: a.email.trim().toLowerCase(), password: pw, name: a.name || '' }) });
  const text = await res.text();
  let r; try { r = JSON.parse(text); } catch (e) { console.error('❌ เซิร์ฟเวอร์ตอบไม่ใช่ JSON (HTTP ' + res.status + ') — ตรวจว่า Deploy เวอร์ชันใหม่แล้ว และตั้ง Who has access = Anyone'); process.exit(1); }
  if (r.status !== 'success') {
    console.error('❌ ตั้งรหัสไม่สำเร็จ: ' + (r.message === 'unauthorized' ? 'SYNC_TOKEN ไม่ถูกต้อง' : (r.message || 'ไม่ทราบสาเหตุ')));
    if (!r.message || /unknown action/i.test(String(r.message))) console.error('   (Apps Script ยังเป็นเวอร์ชันเก่า: วางโค้ดใหม่แล้ว Deploy > New version)');
    process.exit(1);
  }
  if (!r.email) { console.error('❌ Apps Script ยังเป็นเวอร์ชันเก่า: วางโค้ดใหม่แล้ว Deploy > New version'); process.exit(1); }
  console.log('✅ ตั้งรหัสผ่านครูบนเซิร์ฟเวอร์แล้ว สำหรับ ' + r.email + ' — เข้าสู่ระบบในแอปด้วยอีเมลนี้และรหัสใหม่');
}

main().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
