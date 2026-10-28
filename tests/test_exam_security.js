// ห้องสอบกลางภาค/ปลายภาค: ข้อสอบและเฉลยต้องอยู่เฉพาะบนเซิร์ฟเวอร์ (Apps Script จำลอง) และนักเรียนเห็น/ทำไม่ได้จนกว่าครูเปิดห้องสอบ
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { loadGas } = require('./fake_gas');
const root = path.join(__dirname, '..');
const T = 'teacher-token';
let n = 0;
const ok = (c, m) => { n++; assert(c, m); };
const eq = (a, b, m) => { n++; assert.strictEqual(a, b, m); };

// ---------- ข้อสอบตัวอย่าง (มีข้อความเฉพาะตัว เพื่อตรวจว่าไม่รั่วออกไปไหน) ----------
const MARK = 'ZQX7731';
const bank = Array.from({ length: 6 }, (_, i) => ({
  id: 'T' + (i + 1), question: MARK + '-คำถามที่ ' + (i + 1) + ' ข้อความทดสอบเฉพาะ',
  choices: [0, 1, 2, 3].map(k => ({ text: MARK + '-ตัวเลือก-' + (i + 1) + '-' + k })), correctIndex: i % 4,
  explanation: MARK + '-เหตุผล-' + (i + 1), srcPeriod: 2 + (i % 8), srcObjective: 'k1', difficulty: 'ง่าย', status: 'teacher_reviewed'
}));
const correctText = qid => { const q = bank.find(b => b.id === qid); return q.choices[q.correctIndex].text; };

// ---------- ฝั่งเซิร์ฟเวอร์ ----------
const g = loadGas({ SYNC_TOKEN: T });
const { call } = g;
const MIN = 60000;
const t0 = Date.now(); g.setNow(t0);
const roster = [
  { student_id: '90001', prefix: 'เด็กชาย', first_name: 'ก', last_name: 'ทดสอบ', nickname: 'ก', class: 'ม.1/1', no: 1 },
  { student_id: '90002', prefix: 'เด็กชาย', first_name: 'ข', last_name: 'ทดสอบ', nickname: 'ข', class: 'ม.1/1', no: 2 },
  { student_id: '90004', prefix: 'เด็กชาย', first_name: 'ง', last_name: 'ทดสอบ', nickname: 'ง', class: 'ม.1/1', no: 3 },
  { student_id: '90005', prefix: 'เด็กชาย', first_name: 'จ', last_name: 'ทดสอบ', nickname: 'จ', class: 'ม.1/1', no: 4 },
  { student_id: '90006', prefix: 'เด็กชาย', first_name: 'ฉ', last_name: 'ทดสอบ', nickname: 'ฉ', class: 'ม.1/1', no: 5 },
  { student_id: '90003', prefix: 'เด็กหญิง', first_name: 'ค', last_name: 'ทดสอบ', nickname: 'ค', class: 'ม.1/2', no: 1 },
  { student_id: '90008', prefix: 'เด็กหญิง', first_name: 'ช', last_name: 'ทดสอบ', nickname: 'ช', class: 'ม.1/2', no: 2 }
];
call({ action: 'upload_roster', token: T, students: roster });
const tok = {};
roster.forEach(s => { tok[s.student_id] = call({ action: 'studentSetPin', studentId: s.student_id, pin: '123456' }).sessionToken; ok(tok[s.student_id], 'token ' + s.student_id); });
const st = (sid, action, extra) => call(Object.assign({ action, sessionToken: tok[sid] }, extra || {}));
const has = (obj, s) => JSON.stringify(obj).indexOf(s) >= 0;

// 1) การกระทำของครูต้องมี SYNC_TOKEN (นักเรียนใช้ไม่ได้)
let r = call({ action: 'exam_upload_bank', kind: 'midterm', items: bank });
ok(r.status === 'error', 'upload bank without token refused');
r = call({ action: 'exam_upload_bank', token: tok['90001'], kind: 'midterm', items: bank });
ok(r.status === 'error', 'student session token is not teacher token');
r = call({ action: 'exam_open', sessionToken: tok['90001'], kind: 'midterm', className: 'ม.1/1', closeAt: t0 + 3600000 });
ok(r.status === 'error', 'student cannot open exam');
r = call({ action: 'exam_results', sessionToken: tok['90001'] });
ok(r.status === 'error', 'student cannot read results');

// 2) คลังข้อสอบไม่ถูกต้องถูกปฏิเสธ
const badBank = JSON.parse(JSON.stringify(bank)); badBank[0].correctIndex = 9;
ok(call({ action: 'exam_upload_bank', token: T, kind: 'midterm', items: badBank }).status === 'error', 'bad correctIndex refused');
ok(call({ action: 'exam_upload_bank', token: T, kind: 'other', items: bank }).status === 'error', 'bad kind refused');
// ยังไม่มีคลัง -> เปิดห้องสอบไม่ได้
eq(call({ action: 'exam_open', token: T, kind: 'midterm', className: 'ม.1/1', openAt: t0, closeAt: t0 + 3600000 }).code, 'no_bank', 'cannot open without bank');
r = call({ action: 'exam_upload_bank', token: T, kind: 'midterm', items: bank });
eq(r.status, 'success', 'bank uploaded'); eq(r.items, 6, 'items stored');

// 3) ยังไม่มีห้องสอบ -> นักเรียนเห็นเป็นกลาง และเริ่มสอบไม่ได้
r = st('90001', 'studentExamStatus'); ok(r.status === 'success' && r.open === false, 'no session -> closed'); ok(!has(r, MARK), 'status leaks nothing');
eq(st('90001', 'studentExamStart').code, 'not_open', 'start before any session blocked');

// 4) ครูเปิดห้องสอบ ม.1/1 เริ่มอีก 10 นาที ปิด 90 นาที ทำได้ 25 นาที 1 ครั้ง
r = call({ action: 'exam_open', token: T, kind: 'midterm', className: 'ม.1/1', openAt: t0 + 10 * MIN, closeAt: t0 + 90 * MIN, durationMin: 25, maxAttempts: 1 });
eq(r.status, 'success', 'session opened'); const sess1 = r.sessionId; ok(sess1, 'session id');
g.setNow(t0 + 5 * MIN);   // ก่อนเวลาเปิด
r = st('90001', 'studentExamStatus'); ok(r.open === false, 'before open window -> closed'); ok(!has(r, '"closeMs"') && !has(r, 'ม.1'), 'no schedule leaked before open');
eq(st('90001', 'studentExamStart').code, 'not_open', 'start before open blocked');

// 5) เวลาเปิดแล้ว: ห้องอื่นยังเข้าไม่ได้
g.setNow(t0 + 10 * MIN + 1000);
r = st('90003', 'studentExamStatus'); ok(r.open === false, 'wrong room sees closed'); ok(!has(r, MARK), 'wrong room no content');
eq(st('90003', 'studentExamStart').code, 'not_open', 'wrong-room student cannot start');
// นักเรียนพยายามส่ง class ในคำขอ -> ไม่ถูกเชื่อ
eq(st('90003', 'studentExamStart', { className: 'ม.1/1', class: 'ม.1/1', sessionId: sess1 }).code, 'not_open', 'payload class/session ignored');
// ไม่มี/ปลอม token
eq(call({ action: 'studentExamStart' }).code, 'bad_session', 'no token'); eq(call({ action: 'studentExamStatus', sessionToken: 'a.b' }).code, 'bad_session', 'forged token');
eq(call({ action: 'studentExamStart', sessionToken: T }).code, 'bad_session', 'teacher token is not a student session');

// 6) ห้องเปิด: นักเรียนในห้องเห็นสถานะ (ไม่มีข้อสอบ) และเริ่มสอบได้
r = st('90001', 'studentExamStatus');
ok(r.open === true && r.canStart === true && r.attemptsLeft === 1 && r.items === 6, 'in-room student sees open exam');
ok(!has(r, MARK), 'status has no question text');
const s1 = st('90001', 'studentExamStart'); eq(s1.status, 'success', 'start ok');
eq(s1.questions.length, 6, '6 questions served');
['correctIndex', 'correct_index', 'explanation', 'srcPeriod', 'answer_key', 'key_json', 'correctKey', 'difficulty'].forEach(k => ok(!has(s1, k), 'start response has no ' + k));
ok(s1.questions.every(q => q.choices.length === 4 && q.choices.every(c => /^[กขคงจ]$/.test(c.key))), 'choices relabeled ก-ง');
ok(s1.deadlineMs <= t0 + 10 * MIN + 1000 + 25 * MIN + 5, 'deadline = start + duration');
// เริ่มซ้ำ = ทำต่อข้อสอบชุดเดิม (ไม่สร้างครั้งใหม่)
const s1b = st('90001', 'studentExamStart'); eq(s1b.attemptId, s1.attemptId, 'resume same attempt');
eq(JSON.stringify(s1b.questions), JSON.stringify(s1.questions), 'resume same order');
// สลับข้อ/ตัวเลือกต่อคน
const s2 = st('90002', 'studentExamStart'); eq(s2.status, 'success', '2nd student start');
const sig = s => JSON.stringify(s.questions.map(q => [q.id, q.choices.map(c => c.text)]));
ok(sig(s1) !== sig(s2), 'order/choices shuffled per student');
const cid = s => s.questions.map(q => q.id).join(','); const cho = s => s.questions.map(q => q.choices.map(c => c.text.slice(-1)).join('')).join(',');
ok(cid(s1) !== cid(s2) || cho(s1) !== cho(s2), 'shuffle differs');

// 7) ตรวจคำตอบที่เซิร์ฟเวอร์: ส่งถูกทั้งหมด (พยายามแอบแก้คะแนนจากฝั่งไคลเอนต์)
const answerAll = (s, wantCorrect) => { const a = {}; s.questions.forEach(q => { const cT = correctText(q.id); const pick = q.choices.find(c => wantCorrect ? c.text === cT : c.text !== cT); a[q.id] = pick.key; }); return a; };
g.setNow(t0 + 12 * MIN);
r = st('90001', 'studentExamSubmit', { attemptId: s1.attemptId, answers: answerAll(s1, true), score: 0, points: 0, correct: 0, level: 1 });
eq(r.status, 'success', 'submit ok'); eq(r.correct, 6, 'all correct graded by server'); eq(r.points, 10, '10 points'); eq(r.level, 4, 'level 4');
['correctIndex', 'explanation', 'answers', 'key'].forEach(k => ok(!has(r, '"' + k + '"'), 'submit response has no ' + k));
// ส่งซ้ำ/แก้คำตอบภายหลัง -> ได้ผลเดิม
r = st('90001', 'studentExamSubmit', { attemptId: s1.attemptId, answers: answerAll(s1, false) });
ok(r.duplicate === true && r.points === 10, 'resubmit returns same result, cannot overwrite');
// นักเรียนอื่นใช้ attemptId ของคนอื่นไม่ได้
eq(st('90002', 'studentExamSubmit', { attemptId: s1.attemptId, answers: {} }).code, 'bad_attempt', 'cannot submit others attempt');
// ตอบผิดทั้งหมด + คีย์ที่ไม่มีในข้อสอบ = ผิด
const wrong = answerAll(s2, false); const firstId = s2.questions[0].id; wrong[firstId] = 'ฮ';
r = st('90002', 'studentExamSubmit', { attemptId: s2.attemptId, answers: wrong });
eq(r.correct, 0, 'wrong answers = 0'); eq(r.points, 0, '0 points'); eq(r.level, 1, 'level 1');
// ตอบถูก 4/6
{
  const s = st('90004', 'studentExamStart'); const a = answerAll(s, true);
  s.questions.slice(0, 2).forEach(q => { a[q.id] = q.choices.find(c => c.text !== correctText(q.id)).key; });
  g.setNow(t0 + 13 * MIN);
  const x = st('90004', 'studentExamSubmit', { attemptId: s.attemptId, answers: a });
  eq(x.correct, 4, '4 of 6 correct'); ok(Math.abs(x.points - 6.67) < 0.011, 'points = correct/items x 10'); eq(x.level, 2, '67% -> level 2');
}

// 8) สอบได้ 1 ครั้ง: ไม่มีสิทธิ์ครั้งที่ 2 จนกว่าครูให้สิทธิ์
r = st('90001', 'studentExamStatus'); ok(r.attemptsLeft === 0 && r.canStart === false, 'no attempts left shown');
eq(st('90001', 'studentExamStart').code, 'no_attempts', 'second attempt blocked');
eq(call({ action: 'exam_grant_retake', token: T, sessionId: sess1, studentId: '90003', extra: 1 }).code, 'not_in_room', 'cannot grant retake to student outside room');
eq(call({ action: 'exam_grant_retake', sessionId: sess1, studentId: '90001', extra: 1 }).status, 'error', 'grant needs teacher token');
eq(call({ action: 'exam_grant_retake', token: T, sessionId: sess1, studentId: '90001', extra: 1 }).status, 'success', 'teacher grants retake');
r = st('90001', 'studentExamStatus'); ok(r.attemptsLeft === 1 && r.canStart === true, 'retake visible');
{ const s = st('90001', 'studentExamStart'); eq(s.status, 'success', 'retake start'); ok(s.attemptId !== s1.attemptId, 'new attempt'); 
  const x = st('90001', 'studentExamSubmit', { attemptId: s.attemptId, answers: answerAll(s, false) }); eq(x.points, 0, 'retake graded separately'); }
eq(st('90001', 'studentExamStart').code, 'no_attempts', 'only one extra attempt');

// 9) ส่งช้าเกินเวลาทำ (+ grace) ถูกปฏิเสธ และนับเป็น 1 สิทธิ์
const lateS = st('90005', 'studentExamStart'); eq(lateS.status, 'success', 'late student start');
g.setNow(t0 + 13 * MIN + 25 * MIN + 16000 + 1000);   // เลย duration + grace 15 วินาที
r = st('90005', 'studentExamSubmit', { attemptId: lateS.attemptId, answers: answerAll(lateS, true) });
eq(r.code, 'late', 'late submit rejected'); ok(r.points === undefined, 'no score for late');
// ผู้ที่ปิดแท็บแล้วกลับมาหลังหมดเวลา: ครั้งนั้นหมดอายุและใช้สิทธิ์ไปแล้ว
eq(st('90005', 'studentExamStart').code, 'no_attempts', 'late attempt consumed the only attempt');
// ผู้ที่เริ่มแล้วทิ้งไว้ (ไม่ส่ง) แล้วกลับมาหลังหมดเวลา
g.setNow(t0 + 40 * MIN);
// ระหว่างห้องเปิดอยู่ ห้ามอัปโหลดคลังข้อสอบใหม่ (เปลี่ยนข้อสอบกลางคัน)
eq(call({ action: 'exam_upload_bank', token: T, kind: 'midterm', items: bank }).code, 'session_open', 'bank upload blocked while session open');

// 10) ผลสอบสำหรับครู: ไม่มีข้อสอบ/เฉลย/ลำดับข้อ
const res = call({ action: 'exam_results', token: T, sessionId: sess1 });
eq(res.status, 'success', 'results ok'); ok(res.attempts.length >= 5, 'attempts listed');
ok(!has(res, MARK), 'results contain no question/choice text'); ['order', 'correctIndex', 'answers', 'key'].forEach(k => ok(!has(res, '"' + k), 'results have no ' + k));
const statuses = res.attempts.reduce((m, a) => { m[a.status] = (m[a.status] || 0) + 1; return m; }, {});
ok(statuses.submitted >= 4 && statuses.late_rejected === 1, 'statuses recorded: ' + JSON.stringify(statuses));
const ses = call({ action: 'exam_sessions', token: T });
ok(ses.sessions.some(s => s.sessionId === sess1 && s.state === 'open' && s.submitted >= 4), 'session listing with counts'); ok(!has(ses, MARK), 'session list no content');

// 11) ปิดห้องสอบ -> นักเรียนที่ยังไม่ได้สอบเข้าไม่ได้ (ห้องว่างเปล่า)
eq(call({ action: 'exam_close', token: T, sessionId: sess1 }).status, 'success', 'closed');
ok(st('90006', 'studentExamStatus').open === false, 'after close -> closed'); eq(st('90006', 'studentExamStart').code, 'not_open', 'start after close blocked');
// ปิดแล้วเปลี่ยนคลังได้
eq(call({ action: 'exam_upload_bank', token: T, kind: 'midterm', items: bank }).status, 'success', 'bank upload ok after close');

// 12) ปิดห้องระหว่างที่นักเรียนกำลังทำ -> ส่งหลังปิด (+grace) ไม่รับ
g.setNow(t0 + 50 * MIN);
const o2 = call({ action: 'exam_open', token: T, kind: 'midterm', className: 'ม.1/2', openAt: t0 + 50 * MIN, closeAt: t0 + 80 * MIN, durationMin: 25, maxAttempts: 1 }); eq(o2.status, 'success', 'room 2 opened');
const m = st('90003', 'studentExamStart'); eq(m.status, 'success', 'room 2 student starts');
ok(st('90002', 'studentExamStatus').open === false, 'room 1 student does not see room 2 exam');
call({ action: 'exam_close', token: T, sessionId: o2.sessionId });
g.advance(MIN);
eq(st('90003', 'studentExamSubmit', { attemptId: m.attemptId, answers: answerAll(m, true) }).code, 'late', 'submit after teacher closed room rejected');
eq(st('90008', 'studentExamStart').code, 'not_open', 'closed room blocks others');
// 13) ปิดตามเวลาเอง (ไม่ต้องกดปิด)
const o3 = call({ action: 'exam_open', token: T, kind: 'midterm', className: 'ม.1/2', openAt: t0 + 52 * MIN, closeAt: t0 + 60 * MIN, durationMin: 25, maxAttempts: 2 }); eq(o3.status, 'success', 'session 3');
g.setNow(t0 + 61 * MIN);
ok(st('90008', 'studentExamStatus').open === false, 'time window ended -> closed'); eq(st('90008', 'studentExamStart').code, 'not_open', 'start after window blocked');

// ---------- ข้อสอบ/เฉลยต้องไม่อยู่ในไฟล์ที่ deploy (app/) หรือใน cache ของ Service Worker ----------
function walk(dir, out) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p, out); else out.push(p); } return out; }
const appFiles = walk(path.join(root, 'app'), []).filter(f => /\.(js|json|html|css|webmanifest|txt|svg)$/i.test(f));
const appText = appFiles.map(f => ({ f, t: fs.readFileSync(f, 'utf8') }));
// (ก) ข้อความตัวอย่างต้องไม่อยู่ในแอป (ไม่มีไฟล์/สคริปต์ใดฝังข้อสอบ)
appText.forEach(({ f, t }) => ok(t.indexOf(MARK) < 0, 'fixture marker not in ' + path.relative(root, f)));
// (ข) ถ้ามีคลังข้อสอบจริง (ไม่อยู่ใน repo/CI): ทุกโจทย์และเหตุผลต้องไม่ปรากฏใน app/ (ตัวเลือกสั้นๆ อาจตรงกับเนื้อหาบทเรียนที่เปิดเผยอยู่แล้ว จึงไม่นำมาเทียบ)
const privDir = path.join(root, 'tools/exams_private');
const privFiles = fs.existsSync(privDir) ? fs.readdirSync(privDir).filter(f => /bank.*\.json$/.test(f)) : [];
let realChecked = 0;
privFiles.forEach(pf => {
  const b = JSON.parse(fs.readFileSync(path.join(privDir, pf), 'utf8'));
  b.items.forEach(q => {
    [q.question, q.explanation].filter(s => s && s.length >= 14).forEach(s => {
      appText.forEach(({ f, t }) => { if (t.indexOf(s) >= 0) ok(false, 'real exam text leaked into ' + path.relative(root, f) + ': ' + s.slice(0, 30)); });
      realChecked++;
    });
  });
});
ok(realChecked > 0 || privFiles.length === 0, 'real private bank scanned when present');
// (ค) Service Worker ไม่ cache ไฟล์ข้อสอบ และไม่มีไฟล์ข้อสอบใน app/
const sw = fs.readFileSync(path.join(root, 'app/sw.js'), 'utf8');
const assets = (sw.match(/ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1].match(/'[^']+'/g) || [];
ok(assets.length > 10, 'sw asset list parsed');
assets.forEach(a => ok(!/exam.*(bank|private|item|question)|exams_private|bank.*\.json/i.test(a), 'sw does not cache exam data: ' + a));
assets.forEach(a => { const rel = a.replace(/'/g, '').replace(/^\.\//, ''); if (rel && rel !== '.' && rel !== './') ok(fs.existsSync(path.join(root, 'app', rel)) || /\/$/.test(rel), 'sw asset exists: ' + rel); });
ok(assets.some(a => /exam-client\.js/.test(a)), 'exam-client.js (no content) is cached for offline shell');
ok(!appFiles.some(f => /exam.*bank|exams_private/i.test(path.basename(f))), 'no exam bank file under app/');
ok(!/localStorage|sessionStorage|indexedDB|caches\./.test(fs.readFileSync(path.join(root, 'app/js/exam-client.js'), 'utf8').replace(/\/\/.*$/gm, '')), 'exam-client never stores questions (no storage/caches API)');
// (ง) .gitignore กันโฟลเดอร์ข้อสอบจริง และ deploy คัดลอกเฉพาะ app/
ok(/^tools\/exams_private\/?$/m.test(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')), 'tools/exams_private is gitignored');
const wf = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
ok(/cp -r app _site/.test(wf) && !/exams_private/.test(wf), 'deploy publishes app/ only');

// ---------- ตรรกะฝั่งไคลเอนต์ (ไม่มีข้อสอบในไฟล์) ----------
global.window = global; 
const EC = require('../app/js/exam-client.js');
const v = EC.validateBank({ kind: 'midterm', itemsExpected: 6, items: bank }); ok(v.ok && v.stats.total === 6, 'validateBank accepts fixture');
ok(!EC.validateBank({ kind: 'x', items: bank }).ok, 'validateBank rejects bad kind');
ok(!EC.validateBank({ kind: 'final', items: [{ id: 'a', question: 'q', choices: [{ text: 'a' }, { text: 'b' }], correctIndex: 0 }] }).ok, 'validateBank rejects <3 choices');
ok(!EC.validateBank({ kind: 'final', items: bank.concat([bank[0]]) }).ok, 'validateBank rejects duplicate ids');
const best = EC.bestAttempts([
  { studentId: 'a', status: 'submitted', points: 4, submittedMs: 1 }, { studentId: 'a', status: 'submitted', points: 7, submittedMs: 2 },
  { studentId: 'a', status: 'late_rejected', points: null, submittedMs: 3 }, { studentId: 'b', status: 'in_progress', points: null, submittedMs: 0 },
  { studentId: 'c', status: 'submitted', points: 5, submittedMs: 1 }, { studentId: 'c', status: 'submitted', points: 5, submittedMs: 9 }]);
eq(best.a.points, 7, 'best attempt per student'); ok(!best.b, 'in-progress ignored'); eq(best.c.submittedMs, 9, 'tie -> latest');
privFiles.forEach(pf => { const b = JSON.parse(fs.readFileSync(path.join(privDir, pf), 'utf8')); const vv = EC.validateBank(b); ok(vv.ok, pf + ' valid: ' + vv.errors.join(';')); eq(vv.stats.total, 20, pf + ' has 20 items'); ok(b.items.every(q => /draft|รอครู/.test(q.status)), pf + ' items flagged draft'); });

console.log('exam security: ' + n + ' assertions passed');
