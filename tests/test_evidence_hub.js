// ศูนย์หลักฐาน คศ.4 — เชื่อมกับสมุดคะแนนรายคาบจริงใน Store; ครูเท่านั้น; ชุดส่งออกไม่มีชื่อ/รหัสจริง
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const st = {};
global.window = global;
global.localStorage = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = { 'ม.1/1': Array.from({ length: 8 }, (_, i) => ({ id: 'ม.1/1_' + (i + 1), student_id: '7' + String(1000 + i * 7), prefix: 'เด็กชาย', first_name: 'ทดสอบชื่อ' + (i + 1), last_name: 'นามสมมติ' + (i + 1), nickname: 'เล่น' + (i + 1), class: 'ม.1/1', no: i + 1 })) };
global.LESSONS_DATA = require('../app/data/lessons.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js');
global.Store = require('../app/data/store.js');
global.EvidenceDefaults = require('../app/data/evidence_config.js');
global.EvidenceCore = require('../app/js/evidence-core.js');
global.document = { getElementById: () => null, querySelectorAll: () => [] };
global.alert = () => {};
const H = require('../app/js/evidence-hub.js');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const CL = 'ม.1/1', grade = Store.gradeKeyOf(CL);
const students = Store.getStudents(CL);
ok(students.length >= 6, 'fixture มีนักเรียน');

// --- สิทธิ์: ต้องเป็นครูเท่านั้น ---
const setRole = r => { if (r) Store.setCurrentUser({ role: r, name: 'x', username: 'x' }); else Store.remove('ppk_auth_current_user'); };
let sunk = []; H.sink = (a, b, c) => sunk.push(a);
['student', 'intern', 'trainee', null].forEach(r => {
  setRole(r);
  ok(H.canUse() === false, `role=${r}: ใช้ไม่ได้`);
  ok(H.open() === false, `role=${r}: เปิดหน้าไม่ได้`);
  ok(H.addItem({ title: 't', pathways: ['outcome'], kind: 'doc', date: '2026-10-28', source: 's' }).ok === false, `role=${r}: เพิ่มหลักฐานไม่ได้`);
  ok(H.collectRows(CL).length === 0 && H.linkKeyCSV(CL) === '' && H.bundle('', CL).files.length === 0, `role=${r}: อ่านคะแนน/ส่งออกไม่ได้`);
  ok(H._emit('x', 'text/plain', 'x') === false && sunk.length === 0, `role=${r}: ดาวน์โหลดไม่ได้`);
});
setRole('teacher');
ok(H.canUse() === true, 'teacher ใช้ได้');

// --- ยังไม่มีคะแนน → ไม่มีตัวเลข ---
ok(H.collectRows(CL).length === 0, 'ยังไม่มีสมุดคะแนน → 0 แถว');
let an = H.analyze(CL); ok(!an.points.ok && an.cmp.n === 0, 'วิเคราะห์ไม่ได้ ไม่เดาค่า');
ok(H.board().every(b => b.collected === 0), 'กระดานว่างเมื่อไม่มีหลักฐาน');
ok(/\[ยังไม่มีข้อมูล:/.test(H.dossier(CL)) && !/ค่าเฉลี่ยก่อน/.test(H.dossier(CL)), 'เอกสารนวัตกรรมไม่มีตัวเลขเมื่อไม่มีข้อมูล');

// --- บันทึกระดับจริงผ่าน Store (เหมือนหน้าให้คะแนน) แล้ววิเคราะห์ ---
const put = (s, p, K, P, A) => Store.saveStudentRubric(s.student_id, p, Store.buildRubricRecord(grade, p, { K, P, A }), CL);
const pre = [1, 2, 2, 1, 3, 2], post = [3, 3, 4, 2, 4, 3];
students.slice(0, 6).forEach((s, i) => { put(s, 3, pre[i], pre[i], pre[i]); put(s, 9, post[i], post[i], post[i]); });
const rows = H.collectRows(CL);
ok(rows.length === 12 && rows.every(r => r.period === 3 || r.period === 9), 'อ่านระดับจากสมุดคะแนนรายคาบ 6 คน × 2 คาบ (ได้ ' + rows.length + ')');
ok(rows.filter(r => r.period === 3).every((r, i) => r.K === pre[i] && r.P === pre[i] && r.A === pre[i]), 'ระดับตรงกับที่บันทึก');
an = H.analyze(CL);
ok(an.points.ok && an.points.baseline[0] === 3 && an.points.after[0] === 9 && an.cmp.n === 6, 'ก่อน=คาบ3 หลัง=คาบ9 (อัตโนมัติ) n=6');
ok(an.cmp.dims.K.pctBefore.count === 1 && an.cmp.dims.K.pctAfter.count === 5, '% ถึงระดับ 3: ก่อน 1/6 หลัง 5/6');
ok(an.cmp.dims.K.pctAfter.met === true, '83.3% ≥ เกณฑ์ 60%');
const exp = EvidenceCore.pairedStats(pre, post, 4); ok(Math.abs(an.cmp.dims.K.t - exp.t) < 1e-9, 't ตรงกับที่คำนวณอิสระ');
// นักเรียนลาออก → ไม่นับ
const w = students[5]; Store.withdrawStudent && Store.withdrawStudent(w.student_id, 'test');
if (Store.isStudentWithdrawn(w.student_id)) ok(H.collectRows(CL).length === 10, 'นักเรียนที่ลาออกไม่ถูกนับ');
// เปิดโหมดเลือกคาบเอง
let c = H.getConfig(); c.measure.mode = 'periods'; c.measure.baselinePeriods = [3]; c.measure.afterPeriods = [9]; H.saveConfig(c);
ok(H.analyze(CL).points.mode === 'periods', 'โหมดเลือกคาบเอง');
c.measure.mode = 'auto'; H.saveConfig(c);

// --- เกลือรหัสแทนตัวตน ---
const salt = H.getConfig().pseudoSalt; ok(/^[0-9a-f]{16,}$/i.test(salt) && H.getConfig().pseudoSalt === salt, 'สร้างเกลือครั้งแรกแล้วคงเดิม');

// --- หลักฐาน + กระดาน ---
const r1 = H.addItem({ title: 'วก.5 ม.1 ฉบับ 25 ต.ค.', pathways: ['outcome', 'pa'], kind: 'doc', date: '2026-10-25', source: 'ไฟล์ของครู', link: 'D:/x/wk5.docx' });
ok(r1.ok && /^ev_/.test(r1.item.id) && r1.item.alignment === 'โครงการพัฒนาวิชาการของโรงเรียน', 'เพิ่มหลักฐานได้ + ป้ายสอดคล้อง');
ok(H.addItem({ title: 'x', pathways: [], kind: 'doc', date: '2026-10-25', source: 's' }).ok === false, 'ไม่มีเส้นทาง → ปฏิเสธ');
ok(H.getItems().length === 1, 'เก็บเฉพาะที่ผ่านการตรวจ');
const upd = H.addItem(Object.assign({}, r1.item, { title: 'วก.5 (แก้)' })); ok(upd.ok && upd.updated && H.getItems().length === 1 && H.getItems()[0].title === 'วก.5 (แก้)', 'แก้ไขหลักฐานเดิม ไม่เพิ่มซ้ำ');
let b = H.board(); const out = b.find(x => x.id === 'outcome');
ok(out.checklist.find(x => x.id === 'o_plans').ok, 'o_plans ติ๊กจากหลักฐานที่ครูเพิ่ม');
ok(out.checklist.find(x => x.id === 'o_data').ok && out.checklist.find(x => x.id === 'o_data').items[0].auto === true, 'o_data ติ๊กจากข้อมูลจริงในสมุดคะแนน (รายการอัตโนมัติ)');
ok(out.checklist.find(x => x.id === 'o_report').ok === false && out.checklist.find(x => x.id === 'o_work').ok === false, 'รายงาน/ชิ้นงานยังขาด (ไม่ถูกนับเอง)');
ok(H.autoItems().some(i => i.id === 'auto_score_' + CL), 'มีรายการอัตโนมัติของห้อง');
ok(b.find(x => x.id === 'research').collected === 0 && b.find(x => x.id === 'mentoring').collected === 0, 'เส้นทางที่ไม่มีหลักฐานยังขาด');
ok(H.deleteItem(r1.item.id) === 0, 'ลบหลักฐาน');

// --- แบบสอบถาม ---
Store.save(H.KEYS.resp, [{ answers: { q1: 5, q2: 4, q3: 4, q4: 5, q5: 4, q6: 4, q7: 5, q8: 4, q9: 4 }, comments: ['ดี'] }]);

// --- ชุดส่งออก ---
const bu = H.bundle('', CL); const names = bu.files.map(f => f.name);
['00_evidence_index.md', '01_evidence_list.csv', '10_outcome_per_period.csv', '11_outcome_summary_stats.csv', '12_outcome_pseudonymised.csv', '20_questionnaire_responses.csv', '21_questionnaire_summary.csv', '30_innovation_dossier_draft.md', '40_research_designs.md', '41_consent_draft.md', '42_method_note.md', '99_README.txt'].forEach(f => ok(names.indexOf(f) >= 0, 'ชุดส่งออกมี ' + f));
ok(names.indexOf('linkkey') < 0 && !names.some(x => /link|key/i.test(x)), 'ไม่รวมกุญแจเชื่อมรหัส');
const blob = bu.files.map(f => f.content).join('\n');
students.forEach(s => { ok(blob.indexOf(s.student_id) < 0, 'ชุดส่งออกไม่มีรหัสนักเรียนจริง ' + s.student_id); ok(blob.indexOf(s.first_name) < 0 && blob.indexOf(s.last_name) < 0 && blob.indexOf(s.nickname) < 0, 'ไม่มีชื่อ ' + s.no); });
ok(blob.indexOf(salt) < 0, 'ไม่มีเกลือในชุดส่งออก');
ok(/S[0-9A-F]{8}/.test(bu.files.find(f => /^12_/.test(f.name)).content), 'มีรหัสแทนตัวตน');
ok(/ฉบับร่าง/.test(bu.files.find(f => /^41_/.test(f.name)).content), 'ร่างหนังสือยินยอมระบุว่าเป็นร่าง');
const pbu = H.bundle('mentoring', CL).files.map(f => f.name); ok(!pbu.some(x => /^1[0-2]_|^4/.test(x)), 'ชุดเส้นทาง "ให้คำปรึกษา" ไม่ปนไฟล์วิจัย');
// zip เปิดได้
const zf = path.join(os.tmpdir(), 'ev_hub_test.zip'); fs.writeFileSync(zf, Buffer.from(bu.bytes));
const py = cp.spawnSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(len(z.namelist()))', zf], { encoding: 'utf8' });
if (py.status === 0) ok(Number(py.stdout) === bu.files.length, 'ZIP ครบ ' + bu.files.length + ' ไฟล์'); else console.log('  (ข้าม zip: ไม่มี python3)');
// กุญแจเชื่อม (เฉพาะเครื่องครู) มีรหัสจริง แต่ต้องไม่อยู่ในชุด
const key = H.linkKeyCSV(CL); ok(key.indexOf(students[0].student_id) > 0 && /^\uFEFF?รหัสแทนตัวตน/.test(key.replace(/^"/, '')) || key.indexOf('รหัสแทนตัวตน') >= 0, 'กุญแจเชื่อมมีในเครื่องครู');
// ดาวน์โหลดผ่าน sink
sunk = []; H.state.className = CL; H.downloadBundle('outcome'); ok(sunk.length === 1 && /\.zip$/.test(sunk[0]), 'downloadBundle ส่งไฟล์ zip');
console.log(`test_evidence_hub: ${n} checks OK`);
