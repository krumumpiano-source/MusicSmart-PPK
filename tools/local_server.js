#!/usr/bin/env node
/* MusicSmart — เซิร์ฟเวอร์พรีวิวในเครื่อง (ไม่ต้องใช้แพ็กเกจเสริม · ไม่ต้อง deploy · ไม่ติดต่อ Google)
 *
 *   node tools/local_server.js [พอร์ต]        (ค่าเริ่มต้น 8080; ผูกกับ 127.0.0.1 เท่านั้น)
 *
 * - เสิร์ฟโฟลเดอร์ app/ เหมือนเว็บจริง (MIME ถูกต้อง, ไม่แคช)
 * - ใส่ "Apps Script จำลอง" ในหน่วยความจำ (tests/fake_gas.js รันโค้ด google_apps_script.js จริง) ที่ /__local_gas/exec
 *   และสลับ data/public-config.js ให้ชี้มาที่นี่ → ไม่มีการส่งข้อมูลไป Google Apps Script จริงเลย
 * - สลับ data/students.js เป็นรายชื่อตัวอย่าง (students.sample.js) เพื่อไม่ให้รายชื่อจริงโผล่ในพรีวิว
 *   (ไฟล์ students.js จริงไม่ถูกอ่าน/แก้) — ใส่ --real-roster เพื่อเสิร์ฟไฟล์จริงเอง
 * - ข้อมูลจำลองหายเมื่อปิดเซิร์ฟเวอร์ (ข้อมูลที่กรอกในเบราว์เซอร์อยู่ใน localStorage ของ localhost:พอร์ตนี้เท่านั้น)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');
const args = process.argv.slice(2);
const REAL_ROSTER = args.includes('--real-roster');
const PORT = Number(args.filter(a => /^\d+$/.test(a))[0] || process.env.PORT || 8080);
const HOST = '127.0.0.1';
const SYNC_TOKEN = 'LOCAL-PREVIEW-TOKEN';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };

// ---- Apps Script จำลอง (ในหน่วยความจำ) + ข้อมูลสาธิต ----
let gas = null;
function startFakeGas() {
  const { loadGas } = require(path.join(ROOT, 'tests', 'fake_gas.js'));
  gas = loadGas({ SYNC_TOKEN });
  require(path.join(ROOT, 'tools', 'prototype', 'attach_studio.js')).attach(gas, { syncToken: SYNC_TOKEN });   // ต้นแบบเนื้อร้อง/สุ่มกลุ่ม (ไม่ใช่โค้ด deploy จริง)
  const sample = require(path.join(APP, 'data', 'students.sample.js'));
  const students = [];
  Object.keys(sample).forEach(cls => sample[cls].forEach(s => students.push({ student_id: s.student_id, prefix: s.prefix || '', first_name: s.first_name || '',
    last_name: s.last_name || '', nickname: s.nickname || '', class: s.class || cls, no: s.no || '' })));
  gas.call({ action: 'upload_roster', token: SYNC_TOKEN, students, replace: true });
  gas.call({ action: 'studentSetPin', studentId: '90001', pin: '246810' });
  gas.call({ action: 'upsert_intern', token: SYNC_TOKEN, internId: 'intern01', name: 'นศ.ฝึกสอน (สาธิต)', classes: ['ม.1/1'] });
  gas.call({ action: 'internSetPin', internId: 'intern01', pin: '135790' });
}

const BOOT_JS = `/* พรีวิวในเครื่อง: ให้แอปใช้ Apps Script จำลองของเซิร์ฟเวอร์นี้เท่านั้น */
(function () {
  try {
    var local = location.origin + '/__local_gas/exec';
    var k = 'ppk_google_sheet_config', c = {};
    try { c = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { c = {}; }
    c.webAppUrl = local; c.syncToken = ${JSON.stringify(SYNC_TOKEN)}; c.autoSync = false;
    localStorage.setItem(k, JSON.stringify(c));
    localStorage.setItem('ppk_student_api_url', local);
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.textContent = '🧪 พรีวิวในเครื่อง · ข้อมูลจำลอง · ไม่ส่งไป Google';
      b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#7c3aed;color:#fff;font:12px/1.4 sans-serif;padding:3px 9px;border-radius:12px;opacity:.85;pointer-events:none;';
      document.body.appendChild(b);
    });
  } catch (e) {}
})();`;

function send(res, code, type, body, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }, extra || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return send(res, 400, 'text/plain', 'bad request'); }

  if (pathname === '/__local_gas/exec') {
    if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '');
    if (req.method !== 'POST') return send(res, 200, 'application/json', JSON.stringify({ status: 'success', local: true }));
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > 60 * 1024 * 1024) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      let out;
      try { out = gas.callRaw(Buffer.concat(chunks).toString('utf8')); } catch (e) { out = { status: 'error', message: 'local fake gas: ' + (e && e.message) }; }
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify(out));
    });
    return;
  }
  if (pathname === '/__local_boot.js') return send(res, 200, MIME['.js'], BOOT_JS);
  if (pathname === '/data/public-config.js') {
    return send(res, 200, MIME['.js'], "const MUSICSMART_PUBLIC_API_URL = location.origin + '/__local_gas/exec'; // พรีวิวในเครื่อง (ของจริงอยู่ที่ app/data/public-config.js)\n");
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'method not allowed');

  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel === '/data/students.js' && !REAL_ROSTER) rel = '/data/students.sample.js';
  const file = path.normalize(path.join(APP, rel));
  if (file !== APP && !file.startsWith(APP + path.sep)) return send(res, 403, 'text/plain', 'forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'text/plain; charset=utf-8', 'ไม่พบไฟล์: ' + pathname);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if (path.basename(file) === 'index.html') {
      let html = fs.readFileSync(file, 'utf8');
      html = html.replace(/<script/i, '<script src="/__local_boot.js"></script>\n<script');
      return send(res, 200, type, req.method === 'HEAD' ? '' : html);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

startFakeGas();
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'พอร์ต ' + PORT + ' ถูกใช้อยู่ — ลอง: node tools/local_server.js ' + (PORT + 1) : String(e)); process.exit(1); });
server.listen(PORT, HOST, () => {
  console.log('MusicSmart พรีวิวในเครื่อง: http://localhost:' + PORT + '/   (กด Ctrl+C เพื่อหยุด)');
  console.log('  • ไม่ส่งข้อมูลไป Google · Apps Script จำลองอยู่ในหน่วยความจำ · รายชื่อ' + (REAL_ROSTER ? 'จริง (--real-roster)' : 'ตัวอย่างเท่านั้น'));
});
