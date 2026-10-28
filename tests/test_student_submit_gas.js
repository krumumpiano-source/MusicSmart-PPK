// Apps Script: student session token + studentSubmit + teacher fetch. Fake services, sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const { sheets, call, callRaw, props } = loadGas({ SYNC_TOKEN: 'teacher-token' });
const T = 'teacher-token';
// ขนาดสูงสุดอ่านจาก google_apps_script.js (ไม่ hardcode) เพื่อไม่ให้เทสต์ค้างเมื่อปรับค่า
const GAS_MAX_BODY = Number(/var STUDENT_MAX_BODY = (\d+)/.exec(require('fs').readFileSync(require('path').join(__dirname, '../google_apps_script.js'), 'utf8'))[1]);
const roster = [
  { student_id: '90001', prefix: 'เด็กชาย', first_name: 'ตัวอย่างหนึ่ง', last_name: 'ทดสอบระบบ', nickname: 'หนึ่ง', class: 'ม.1/1', no: 1 },
  { student_id: '90002', prefix: 'เด็กหญิง', first_name: 'ตัวอย่างสอง', last_name: 'ทดสอบระบบ', nickname: 'สอง', class: 'ม.1/2', no: 2 }
];
call({ action: 'upload_roster', token: T, students: roster });

// tokens issued on setPin + login
let r = call({ action: 'studentSetPin', studentId: '90001', pin: '123456' });
assert(r.sessionToken && r.sessionExp > Date.now() + 29 * 86400000, 'token issued on first PIN, ~30 days');
r = call({ action: 'studentLogin', studentId: '90001', pin: '123456' });
const tok1 = r.sessionToken; assert(tok1);
const tok2 = call({ action: 'studentSetPin', studentId: '90002', pin: '222222' }).sessionToken;
assert(props.STUDENT_SESSION_SECRET, 'secret auto-created in Script Properties');

const asg = (cid, extra) => ({ clientId: cid, kind: 'assignment', data: Object.assign({ period: 3, content: 'คำตอบตัวอย่าง', url: 'https://example.com/clip' }, extra || {}) });

// no / forged / tampered tokens rejected
assert.strictEqual(call({ action: 'studentSubmit', items: [asg('c_test_0001')] }).code, 'bad_session');
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: 'abc.def', items: [asg('c_test_0001')] }).code, 'bad_session');
const [body, sig] = tok1.split('.');
const forgedBody = Buffer.from(JSON.stringify({ sid: '90002', exp: Date.now() + 1e9, pv: '' })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: forgedBody + '.' + sig, items: [asg('c_test_0001')] }).code, 'bad_session', 'body swap breaks signature');
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: body + '.' + sig.replace(/^./, c => (c === 'a' ? 'b' : 'a')), items: [asg('c_test_0001')] }).code, 'bad_session');
assert.strictEqual(call({ action: 'studentSubmit', token: T, items: [asg('c_test_0001')] }).code, 'bad_session', 'teacher token is not a student session');

// correctly signed but expired token rejected
{
  const crypto = require('crypto');
  const pv = sheets['นักเรียน_Students_Auth']._data()[1][11];
  const b = Buffer.from(JSON.stringify({ sid: '90001', exp: Date.now() - 1000, pv: String(pv) })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const sg = crypto.createHmac('sha256', props.STUDENT_SESSION_SECRET).update(b, 'utf8').digest('hex');
  assert.strictEqual(call({ action: 'studentSubmit', sessionToken: b + '.' + sg, items: [asg('c_test_0001')] }).code, 'session_expired');
}

// valid submit; student id in body is ignored
r = call({ action: 'studentSubmit', sessionToken: tok1, studentId: '90002', items: [asg('c_test_0001', { studentId: '90002', className: 'ม.1/2' })] });
assert.deepStrictEqual(r.accepted, ['c_test_0001']);
const inbox = () => sheets['นักเรียนส่งงาน_Inbox']._data();
assert.strictEqual(inbox()[1][3], '90001', 'id from token, not body');
assert.strictEqual(inbox()[1][4], 'ม.1/1', 'class from server roster');
const subRows = sheets['งานนักเรียน_Submissions']._data();
assert.strictEqual(subRows[1][3], '90001'); assert.strictEqual(subRows[1][1], 'ม.1/1', 'also written to existing teacher submission sheet');

// dedupe (retry is idempotent)
r = call({ action: 'studentSubmit', sessionToken: tok1, items: [asg('c_test_0001')] });
assert.deepStrictEqual(r.duplicates, ['c_test_0001']); assert.strictEqual(inbox().length, 2);
// same client id from another student is a different record
r = call({ action: 'studentSubmit', sessionToken: tok2, items: [asg('c_test_0001')] });
assert.deepStrictEqual(r.accepted, ['c_test_0001']);

// quiz: client-scored results are refused; server grades answers from the uploaded bank
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: tok1, items: [{ clientId: 'q_test_0000', kind: 'quiz', data: { unitNo: 2, score: 10, totalQuestions: 10 } }] }).rejected[0].reason, 'bad_kind');
call({ action: 'upload_quiz_bank', token: T, units: [{ unit_no: 2, title: 'หน่วยตัวอย่าง', questions: Array.from({ length: 10 }, (_, i) => ({ id: 'Q2-' + i, question: 'คำถามตัวอย่าง ' + i, choices: [{ key: 'ก', text: 'หนึ่ง' }, { key: 'ข', text: 'สอง' }], correct: i < 8 ? 'ก' : 'ข' })) }] });
const answers = {}; for (let i = 0; i < 10; i++) answers['Q2-' + i] = 'ก';
r = call({ action: 'studentSubmit', sessionToken: tok1, items: [{ clientId: 'q_test_0001', kind: 'quiz_answers', data: { unitNo: 2, answers, timeSpentSeconds: 300, score: 10 } }] });
assert.deepStrictEqual(r.accepted, ['q_test_0001']); assert.strictEqual(r.results.q_test_0001.score, 8, 'server-graded, client score ignored');
assert.strictEqual(sheets['คะแนนแบบทดสอบ_Quiz']._data()[1][3], '90001');

// validation
const bad = (it) => call({ action: 'studentSubmit', sessionToken: tok1, items: [it] }).rejected[0].reason;
assert.strictEqual(bad(asg('c_test_0002', { content: 'x'.repeat(5001) })), 'too_long');
assert.strictEqual(bad(asg('c_test_0003', { url: 'javascript:alert(1)' })), 'bad_url');
assert.strictEqual(bad(asg('c_test_0004', { period: 99 })), 'bad_period');
assert.strictEqual(bad(asg('short')), 'bad_client_id');
assert.strictEqual(bad({ clientId: 'q_test_0002', kind: 'quiz_answers', data: { unitNo: 1, answers: {} } }), 'no_quiz');
assert.strictEqual(bad({ clientId: 'f_test_0002', kind: 'file', data: {} }), 'bad_kind');
assert.strictEqual(callRaw(JSON.stringify({ action: 'studentSubmit', sessionToken: tok1, items: [asg('c_test_0005', { content: 'x'.repeat(GAS_MAX_BODY + 1000) })] })).code, 'too_large');
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: tok1, items: Array.from({ length: 21 }, (_, i) => asg('c_many_' + (1000 + i))) }).code, 'too_many');

// rate limit per student (60/hour)
let accepted = 0, limited = 0;
for (let b = 0; b < 4; b++) {
  r = call({ action: 'studentSubmit', sessionToken: tok1, items: Array.from({ length: 20 }, (_, i) => asg(`c_rl_${b}_${100 + i}`)) });
  accepted += r.accepted.length; limited += r.rejected.filter(x => x.reason === 'rate_limited').length;
}
assert(accepted <= 60 && limited > 0, 'rate limited after 60/hour');
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: tok2, items: [asg('c_other_0001')] }).accepted.length, 1, 'limit is per student');

// teacher fetch requires token; incremental
assert.strictEqual(call({ action: 'fetch_student_submissions' }).status, 'error');
assert.strictEqual(call({ action: 'fetch_student_submissions', token: 'wrong' }).status, 'error');
r = call({ action: 'fetch_student_submissions', token: T, since: 0 });
assert(r.submissions.length >= 4 && r.nextSince > 0);
assert(r.submissions.some(x => x.kind === 'quiz' && x.score === 8));
const r2 = call({ action: 'fetch_student_submissions', token: T, since: r.nextSince });
assert.strictEqual(r2.submissions.length, 0, 'nothing new since last pull');

// PIN reset invalidates old session tokens
call({ action: 'reset_student_pin', token: T, studentId: '90001' });
assert.strictEqual(call({ action: 'studentSubmit', sessionToken: tok1, items: [asg('c_after_reset1')] }).code, 'session_expired');

// existing teacher token sync still works
assert.strictEqual(call({ action: 'batch_sync', token: T, items: [{ type: 'quiz_result', data: { studentId: '90002', score: 1 } }] }).status, 'success');
console.log('student submit (Apps Script) tests passed');
