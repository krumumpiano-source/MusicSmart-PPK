// ตัวแก้ไขแผน (lesson editor) ช่อง วก.5: เติมค่า -> ไม่แก้ไม่บันทึก -> แก้แล้วบันทึกเฉพาะช่องที่แก้ -> reset คืนค่า
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const st = {};
global.window = global;
global.localStorage = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
global.Store = require('../app/data/store.js');

const els = {};
global.document = { getElementById: id => els[id] || (els[id] = { value: '' }) };
const src = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');
const a = src.indexOf('  _wk5FieldMap(w) {');
const b = src.indexOf('  saveLessonEditorModal() {');
assert(a > 0 && b > a, 'editor helpers found');
const H = new Function(`return ({ ${src.slice(a, b).trim().replace(/,\s*$/, '')} });`)();
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

for (const g of ['M1', 'M2']) {
  for (let p = 1; p <= Store.getPeriodCount(g); p++) {
    Object.keys(els).forEach(k => delete els[k]);
    const lesson = Store.getLesson(g, p);
    H._fillWk5Editor(lesson.wk5 || {});
    ok(JSON.stringify(H._collectWk5Editor(g, p)) === '{}', `${g}/${p}: opening and saving without edits stores no wk5 override`);
  }
}
// M1 p3: filled from the docx plan
Object.keys(els).forEach(k => delete els[k]);
const l = Store.getLesson('M1', 3);
H._fillWk5Editor(l.wk5);
ok(els['editor-wk5-obj-k'].value.split('\n').length === WK5_PLANS.M1[3].objectives.k.length, 'objective K lines filled from plan');
ok(els['editor-wk5-act-teach-min'].value === String(WK5_PLANS.M1[3].activities.teach.minutes), 'teach minutes filled');
// edit two fields
els['editor-wk5-work'].value = 'ชิ้นงานใหม่ A\nชิ้นงานใหม่ B';
els['editor-wk5-act-intro-min'].value = '7';
const out = H._collectWk5Editor('M1', 3);
ok(Object.keys(out).sort().join() === 'activities,work', `only changed fields saved (got ${Object.keys(out)})`);
ok(out.work.length === 2 && out.activities.intro.minutes === 7, 'values collected');
Store.saveCustomLesson('M1', 3, { wk5: out });
const m = Store.getLesson('M1', 3).wk5;
ok(m.work[0] === 'ชิ้นงานใหม่ A' && m.activities.intro.minutes === 7, 'override reflected in getLesson().wk5');
ok(m.activities.teach.minutes === WK5_PLANS.M1[3].activities.teach.minutes && m.standards[0] === WK5_PLANS.M1[3].standards[0], 'untouched fields still follow plan');
Store.resetCustomLesson('M1', 3);
ok(Store.getLesson('M1', 3).wk5.work[0] === WK5_PLANS.M1[3].work[0], 'reset restores plan');
// M2 period 19 (no plan): blank fields stay blank, no override
Object.keys(els).forEach(k => delete els[k]);
H._fillWk5Editor(Store.getLesson('M2', 19).wk5 || {});
ok(els['editor-wk5-standards'].value === '' && els['editor-wk5-key-concept'].value === '', 'M2/19 plan-only fields stay blank');
console.log(`lesson editor wk5: ${n} assertions passed`);