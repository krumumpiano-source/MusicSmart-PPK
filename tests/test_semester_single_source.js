// ภาคเรียน/ปีการศึกษา ต้องมาจาก Store.getSemesterInfo() ที่เดียว ห้าม hardcode ในโค้ดแอป
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let n = 0, bad = [];
function ok(c, m) { n++; if (!c) bad.push(m); }
const RX = /ภาคเรียน(?:ที่)?\s*[12]\b|\b[12]\s*\/\s*25[67]\d|ปีการศึกษา\s*25[67]\d|(?:semester|term)\s*[:=]\s*[12]\b/i;
const files = [];
for (const f of fs.readdirSync(path.join(root, 'app/js'))) if (f.endsWith('.js')) files.push('app/js/' + f);
files.push('app/index.html', 'google_apps_script.js');
// ตัวเลือก dropdown ของภาคเรียน (ให้ครูเลือกเอง) ยกเว้นได้
const ALLOW_LINE = /<option value="[12]"( selected)?>ภาคเรียนที่ [12]<\/option>/;
for (const rel of files) {
  const lines = fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/);
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (/^(\/\/|\*|\/\*|<!--)/.test(t)) return;           // คอมเมนต์
    if (ALLOW_LINE.test(t)) return;
    ok(!RX.test(ln), `${rel}:${i + 1} hardcodes semester/year: ${t.slice(0, 100)}`);
  });
}
// store.js: อนุญาตเฉพาะ OFFICIAL_TIMETABLE_META (ข้อมูลตารางสอนทางการ) และค่าเริ่มต้นใน DEFAULT_SEMESTER
const store = fs.readFileSync(path.join(root, 'app/data/store.js'), 'utf8').split(/\r?\n/);
const hits = store.map((l, i) => [i + 1, l]).filter(([, l]) => RX.test(l) && !/^\s*\/\//.test(l));
ok(hits.length <= 4, `store.js has too many semester literals (${hits.length}): ${hits.map(h => h[0]).join(',')}`);
// ค่าที่แสดงมาจาก getSemesterInfo
global.window = global; global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
const Store = require('../app/data/store.js');
global.Store = Store;
ok(Store && typeof Store.getSemesterInfo === 'function', 'Store.getSemesterInfo exists');
if (Store) {
  const s = Store.getSemesterInfo(new Date('2026-10-28T12:00:00+07:00')); // ปักวันที่ให้ผลคงที่ (ไม่ขึ้นกับนาฬิกาเครื่อง)
  ok(s && String(s.term) === '2' && String(s.year) === '2569', `semester on 2026-10-28 is 2/2569 (got ${s && s.term}/${s && s.year})`);
  ok(s.label.includes('ภาคเรียนที่ 2') && s.label.includes('2569'), 'label derived');
}
// รหัสวิชาห้ามฝังในโค้ดแอป: ต้องมาจาก Store.getSubjectCode() (term-config)
const CODE_RX = /ศ2[12]10\d/;
for (const rel of files.filter(f => f !== 'google_apps_script.js')) {
  fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/).forEach((ln, i) => {
    const t = ln.trim();
    if (/^(\/\/|\*|\/\*|<!--)/.test(t)) return;
    ok(!CODE_RX.test(ln), `${rel}:${i + 1} hardcodes subject code: ${t.slice(0, 100)}`);
  });
}
if (bad.length) { console.error(`semester single source: ${bad.length} FAILED of ${n}`); bad.slice(0, 30).forEach(b => console.error(' - ' + b)); process.exit(1); }
console.log(`semester single source: ${n} assertions passed`);