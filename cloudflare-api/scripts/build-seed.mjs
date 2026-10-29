// สร้าง migrations/0002_seed_students.sql จาก app/data/students.js
// รันซ้ำได้ปลอดภัย: ใช้ UPSERT และไม่แตะ pin_hash ของนักเรียนที่ตั้ง PIN แล้ว
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', '..', 'app', 'data', 'students.js'), 'utf8');
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(src + '\n;this.STUDENTS_DATA = STUDENTS_DATA;', ctx);
const data = ctx.STUDENTS_DATA;

const q = (v) => (v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'");
const rows = [];
const seen = new Set();
for (const [className, list] of Object.entries(data)) {
  for (const s of list) {
    const sid = String(s.student_id ?? '').trim();
    if (!sid) throw new Error('นักเรียนไม่มีรหัส: ' + className + ' ' + JSON.stringify(s));
    if (seen.has(sid)) throw new Error('รหัสนักเรียนซ้ำ: ' + sid);
    seen.add(sid);
    rows.push(
      `(${q(sid)}, ${q(s.class || className)}, ${Number(s.no) || 0}, ${q(s.prefix || '')}, ${q(s.first_name || '')}, ${q(s.last_name || '')}, ${q(s.nickname || '')}, '2026-10-29T00:00:00.000Z')`
    );
  }
}

const header = '-- สร้างอัตโนมัติจาก scripts/build-seed.mjs (' + rows.length + ' คน) ห้ามแก้ด้วยมือ\n';
const sql =
  header +
  'INSERT INTO students (student_id, class_name, no, prefix, first_name, last_name, nickname, updated_at) VALUES\n' +
  rows.join(',\n') +
  '\nON CONFLICT (student_id) DO UPDATE SET\n' +
  '  class_name = excluded.class_name,\n' +
  '  no = excluded.no,\n' +
  '  prefix = excluded.prefix,\n' +
  '  first_name = excluded.first_name,\n' +
  '  last_name = excluded.last_name,\n' +
  '  nickname = excluded.nickname,\n' +
  '  updated_at = excluded.updated_at;\n';

writeFileSync(join(here, '..', 'migrations', '0002_seed_students.sql'), sql, 'utf8');
console.log('เขียนแล้ว: ' + rows.length + ' คน, ' + Object.keys(data).length + ' ห้อง');
