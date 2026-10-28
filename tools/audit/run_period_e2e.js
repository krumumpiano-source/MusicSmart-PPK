// run_period_e2e.js — รันตรวจครบวงจร 20 คาบ ม.1 แล้วพิมพ์ตาราง Markdown (ใช้นักเรียนตัวอย่าง ไม่แตะข้อมูลจริง)
// ใช้: USE_SAMPLE_DATA=1 node tools/audit/run_period_e2e.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), APP = path.join(ROOT, 'app');
process.env.USE_SAMPLE_DATA = '1';
const mem = {};
global.window = global;
global.localStorage = { getItem: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, clear: () => {}, key: i => Object.keys(mem)[i] || null, get length() { return Object.keys(mem).length; } };
global.STUDENTS_DATA = require(path.join(ROOT, 'tests', 'fixtures', 'students.sample.js'));
global.LESSONS_DATA = require(path.join(APP, 'data', 'lessons.js'));
global.WK5_PLANS = require(path.join(APP, 'data', 'wk5_plans.js'));
const AD = require(path.join(APP, 'data', 'academic_docs.js'));
global.ACADEMIC_DOCS = AD.ACADEMIC_DOCS; global.ACADEMIC_DOCS_BY_GRADE = AD.ACADEMIC_DOCS_BY_GRADE;
global.QUIZZES_DATA = require(path.join(APP, 'data', 'quizzes.js'));
global.KALIMBA_MEDIA = require(path.join(APP, 'data', 'kalimba_media.js'));
const Store = require(path.join(APP, 'data', 'store.js')); global.Store = Store;
const KalimbaMedia = require(path.join(APP, 'js', 'kalimba-media.js'));
const KalimbaDevices = require(path.join(APP, 'js', 'kalimba-devices.js'));
const audit = require('./period_e2e_audit.js');
const appSrc = fs.readFileSync(path.join(APP, 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const classes = Store.getAllClasses('M1'), className = classes[0] && (classes[0].name || classes[0]);
const env = { Store, LESSONS_DATA, WK5_PLANS, KALIMBA_MEDIA, KalimbaMedia, KalimbaDevices, appSrc, className, students: Store.getStudents(className) || [] };
const res = audit.audit(env);
if (process.argv.indexOf("--json") > 0) { console.log(JSON.stringify(res.rows.map(r => ({ p: r.period, miss: r.mediaMissing, noteMiss: r.notesMissingItems })), null, 1)); process.exit(0); }
console.log(audit.toMarkdown(res.rows));
console.log('\nหมายเหตุรายคาบ:');
Object.keys(res.notes || {}).forEach(p => (res.notes[p] || []).forEach(n => console.log('- คาบ ' + p + ': ' + n)));
