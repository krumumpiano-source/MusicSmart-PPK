// Student study guide is data-driven: no hardcoded subject/period/score; aids selected by lesson.aids.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const st = {};
global.window = global;
global.localStorage = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
global.navigator = { userAgent: 'NodeTest' };
global.LESSONS_DATA = require('../app/data/lessons.js');
global.Store = require('../app/data/store.js');
const { RoleGuard } = require('../app/js/student-auth.js');
global.RoleGuard = RoleGuard;

const src = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');
const a = src.indexOf('  buildStudentStudyGuideHTML(gradeKey, period, lesson) {');
const b = src.indexOf('  openStudentMediaDoc(');
assert(a > 0 && b > a, 'guide method found');
const methods = src.slice(a, b).trim().replace(/,\s*$/, '');
const guide = new Function(`return ({ escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])), mediaStatusChipHTML: () => '', ${methods} });`)();

// 1) every lesson of every grade renders without throwing
for (const g of Object.keys(LESSONS_DATA)) {
  for (const l of LESSONS_DATA[g]) {
    const s = RoleGuard.sanitizeLesson(Store.getLesson(g, l.period));
    assert(Array.isArray(s.aids), 'aids passed to student');
    assert.strictEqual(typeof guide.buildStudentStudyGuideHTML(g, l.period, s), 'string');
  }
}
// 2) orientation numbers come from data
const sum = Store.getCourseSummary('M1');
assert.strictEqual(sum.periods, LESSONS_DATA.M1.length);
assert(sum.total > 0 && sum.unitRows.length > 0);
const html = guide.buildStudentStudyGuideHTML('M1', 1, RoleGuard.sanitizeLesson(Store.getLesson('M1', 1)));
assert(html.includes(`${sum.total} คะแนนเต็ม`), 'total score from data');
assert(html.includes(`${sum.periods} คาบ`), 'period count from data');
sum.unitRows.forEach(u => assert(html.includes(u.unit_name.replace(/&/g, '&amp;')) || html.includes(u.unit_name), 'unit listed: ' + u.unit_name));
// 3) aids data-driven: a lesson without aids gets no tool block, one with 'feldman' does
const plain = guide.buildStudentStudyGuideHTML('M1', 9, RoleGuard.sanitizeLesson(Store.getLesson('M1', 9)));
assert(!plain.includes('ปฐมนิเทศ'), 'no orientation on plain lesson');
const forced = guide.buildStudentStudyGuideHTML('M1', 9, { ...RoleGuard.sanitizeLesson(Store.getLesson('M1', 9)), aids: ['feldman'] });
assert(forced !== plain, 'aids change rendering');
// 4) no stale hardcoded course facts left in student guide/doc panels
const region = src.slice(a, src.indexOf('  openStudentMediaDoc(') + 6000);
assert(!/ศ21101|ศ22102/.test(region), 'no hardcoded subject code in student guide');
assert(!/isM1|gradeKey === 'M1'/.test(src.slice(a, b)), 'no grade switch in guide');
console.log('student guide data-driven OK');
