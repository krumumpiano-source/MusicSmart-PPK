// พรีวิวในเครื่อง: เซิร์ฟเวอร์เสิร์ฟ app/ ถูกต้อง, ไม่ชี้ไป Apps Script จริง, ไม่เปิดรายชื่อจริง, กัน path traversal, login จำลองได้
const { PIN_A, PIN_B } = require('./lib/test_pins');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('FAIL:', m); } }
function req(port, p, opt) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method: (opt && opt.method) || 'GET', headers: (opt && opt.headers) || {} }, rs => {
      const ch = []; rs.on('data', c => ch.push(c)); rs.on('end', () => res({ code: rs.statusCode, type: rs.headers['content-type'] || '', body: Buffer.concat(ch).toString('utf8') }));
    }); r.on('error', rej); if (opt && opt.body) r.write(opt.body); r.end();
  });
}
(async () => {
  const bat = fs.readFileSync(path.join(ROOT, 'START_LOCAL.bat'), 'utf8');
  ok(/tools\\local_server\.js/.test(bat) && /\r\n/.test(bat), 'START_LOCAL.bat เรียก tools\\local_server.js (CRLF)');
  const guide = fs.readFileSync(path.join(ROOT, 'LOCAL_PREVIEW_TH.md'), 'utf8');
  ok(/localhost:8080/.test(guide) && /รหัสเดิมของครู/.test(guide) && /v38/.test(guide), 'คู่มือพรีวิวมี URL / รหัสเดิมของครู / v38');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools', 'local_server.js'), String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /http:\/\/localhost/.test(String(d)) && res()); srv.on('exit', () => rej(new Error('server exited'))); setTimeout(() => rej(new Error('timeout')), 15000); });
  try {
    let r = await req(port, '/');
    ok(r.code === 200 && /text\/html/.test(r.type), 'index.html 200 text/html');
    ok(/<script src="\/__local_boot\.js"><\/script>/.test(r.body), 'index.html ฉีด __local_boot.js');
    r = await req(port, '/sw.js'); ok(r.code === 200 && /javascript/.test(r.type), 'sw.js เป็น javascript');
    r = await req(port, '/manifest.webmanifest'); ok(r.code === 200 || r.code === 404, 'manifest ตอบได้');
    r = await req(port, '/data/public-config.js');
    ok(!/script\.google\.com/.test(r.body) && /__local_gas\/exec/.test(r.body), 'public-config.js ชี้เซิร์ฟเวอร์จำลอง ไม่ใช่ Apps Script จริง');
    r = await req(port, '/data/students.js'); ok(/STUDENTS_IS_SAMPLE\s*=\s*true/.test(r.body), 'students.js ที่เสิร์ฟเป็นรายชื่อตัวอย่าง');
    r = await req(port, '/%2e%2e/tests/fake_gas.js'); ok(r.code === 403 || r.code === 404, 'กัน path traversal');
    r = await req(port, '/..%2f..%2fpackage.json'); ok(r.code === 403 || r.code === 404, 'กัน path traversal (encoded)');
    r = await req(port, '/nope.js'); ok(r.code === 404, '404 สำหรับไฟล์ที่ไม่มี');
    const post = b => req(port, '/__local_gas/exec', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) }).then(x => JSON.parse(x.body));
    let j = await post({ action: 'internLogin', internId: 'intern01', pin: PIN_B }); ok(j.status === 'success' && j.profile && j.profile.internId === 'intern01', 'intern01 เข้าสู่ระบบจำลองได้');
    j = await post({ action: 'studentLogin', studentId: '90001', pin: PIN_A }); ok(j.status === 'success', 'นักเรียน 90001 เข้าสู่ระบบจำลองได้');
    j = await post({ action: 'internLogin', internId: 'intern01', pin: '000000' }); ok(j.status === 'error', 'PIN ผิดถูกปฏิเสธ');
    j = await post({ action: 'teacherLogin', email: 'x@y.z', password: 'x' }); ok(j.status === 'error', 'ไม่มีครูจำลอง (ครูใช้รหัสเดิมผ่านบัญชีในเครื่อง)');
    j = await post({ action: 'upload_roster', token: 'wrong', students: [] }); ok(j.status === 'error', 'token ผิดถูกปฏิเสธ');
    r = await req(port, '/js/app.js'); ok(r.code === 200 && /javascript/.test(r.type), 'app.js เสิร์ฟได้');
  } finally { srv.kill(); }
  console.log(`test_local_server: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
