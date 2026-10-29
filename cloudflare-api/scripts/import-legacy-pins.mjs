// นำเข้าแฮช PIN เดิมจากชีต "นักเรียน_Students_Auth" (Google Sheet) เข้า D1 เพื่อให้นักเรียนใช้ PIN เดิมได้
// วิธีใช้:
//   1) ใน Google Sheet เลือกชีต นักเรียน_Students_Auth แล้ว File > Download > Comma-separated values (.csv)
//   2) เก็บไฟล์ไว้นอกโปรเจกต์ เช่น D:\secret\students_auth.csv
//   3) node scripts/import-legacy-pins.mjs D:\secret\students_auth.csv
//   4) สคริปต์จะสร้างไฟล์ SQL ชั่วคราว (นอกโปรเจกต์) และพิมพ์คำสั่งสำหรับรัน wrangler ให้
// สคริปต์นี้ไม่พิมพ์ค่า salt/pin_hash ออกหน้าจอ และไม่เขียนลงโปรเจกต์
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('ใช้: node scripts/import-legacy-pins.mjs <path-to-students_auth.csv>');
  process.exit(1);
}

// CSV แบบมี/ไม่มีเครื่องหมายคำพูด (รองรับ "" ภายในฟิลด์)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(text);
if (rows.length < 2) { console.error('ไฟล์ว่างหรือไม่มีข้อมูล'); process.exit(1); }

const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) { console.error(`ไม่พบคอลัมน์ ${name} ในไฟล์ CSV`); process.exit(1); }
  return i;
};
const iSid = col('student_id');
const iSalt = col('salt');
const iHash = col('pin_hash');

const SID_RE = /^[A-Za-z0-9._-]{1,20}$/;
const SALT_RE = /^[A-Za-z0-9-]{8,80}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

const stmts = [];
let skippedNoPin = 0;
let skippedBad = 0;
const seen = new Set();
for (const r of rows.slice(1)) {
  const sid = (r[iSid] || '').replace(/\s+/g, '');
  const salt = (r[iSalt] || '').trim();
  const hash = (r[iHash] || '').trim().toLowerCase();
  if (!hash && !salt) { skippedNoPin++; continue; }
  if (!SID_RE.test(sid) || !SALT_RE.test(salt) || !HASH_RE.test(hash) || seen.has(sid)) { skippedBad++; continue; }
  seen.add(sid);
  stmts.push(
    `UPDATE students SET pin_hash = '${hash}', pin_scheme = 'gas-sha256x100', pin_salt = '${salt}', ` +
    `pin_updated_at = datetime('now'), updated_at = datetime('now') WHERE student_id = '${sid}';`
  );
}

const outFile = join(tmpdir(), `musicsmart-legacy-pins-${Date.now()}.sql`);
writeFileSync(outFile, stmts.join('\n') + '\n', 'utf8');

console.log(`พร้อมนำเข้า ${stmts.length} คน`);
console.log(`ข้าม (ยังไม่มี PIN): ${skippedNoPin} คน`);
console.log(`ข้าม (ข้อมูลไม่ถูกรูปแบบ/ซ้ำ): ${skippedBad} คน`);
console.log(`ไฟล์ SQL ชั่วคราว: ${outFile}`);
console.log('');
console.log('รันคำสั่งนี้เพื่อนำเข้า (ในโฟลเดอร์ cloudflare-api):');
console.log(`  npx wrangler d1 execute musicsmart-db --remote --file="${outFile}"`);
console.log('หลังนำเข้าเสร็จ ให้ลบไฟล์ CSV และไฟล์ SQL ชั่วคราวทิ้ง');
