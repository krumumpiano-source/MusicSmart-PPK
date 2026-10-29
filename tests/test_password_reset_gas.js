// ลืมรหัสผ่าน/PIN (ฝั่ง Apps Script): รีเซ็ตทางอีเมล + ครูยืนยันออกรหัสให้นักเรียนที่ไม่มีอีเมล
// ใช้ข้อมูลตัวอย่างเท่านั้น (ไม่มีอีเมล/รหัสจริง)
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const T = 'T-sample-token';
const ADMIN = 'krumum.piano@gmail.com';
const STU_EMAIL = 'student.sample@example.com';

const gas = loadGas({ SYNC_TOKEN: T });
const call = b => gas.call(b);
const lastMail = () => gas.mail.sent[gas.mail.sent.length - 1];
const codeOf = m => /\n\s+(\d{6})\n/.exec(m.body)[1];
const wrongCode = c => (c === '000000' ? '111111' : '000000');
const hourLater = () => gas.advance(61 * 60000);

call({ action: 'upload_roster', token: T, students: [
  { student_id: '10001', prefix: 'ด.ช.', first_name: 'ตัวอย่าง', last_name: 'หนึ่ง', class: 'ม.1/1', no: 1 },
  { student_id: '10002', prefix: 'ด.ญ.', first_name: 'ตัวอย่าง', last_name: 'สอง', class: 'ม.1/1', no: 2 }
] });
const login = (id, pin) => call({ action: 'studentLogin', studentId: id, pin });
const setPin = (id, pin) => call({ action: 'studentSetPin', studentId: id, pin });

// ---------- student with e-mail: bind (verified) -> reset by e-mail
let s1 = setPin('10001', '482615');
assert.strictEqual(s1.status, 'success');
assert.strictEqual(call({ action: 'studentEmailStatus', sessionToken: s1.sessionToken }).hasEmail, false);
assert.strictEqual(call({ action: 'studentEmailStart', sessionToken: 'bad.token', email: STU_EMAIL }).status, 'error');
assert.strictEqual(call({ action: 'studentEmailStart', sessionToken: s1.sessionToken, email: 'not-an-email' }).code, 'bad_email');
let r = call({ action: 'studentEmailStart', sessionToken: s1.sessionToken, email: ' ' + STU_EMAIL.toUpperCase() + ' ' });
assert.strictEqual(r.status, 'success');
assert(!JSON.stringify(r).includes('student.sample'), 'full address is not echoed back');
assert.strictEqual(lastMail().to, STU_EMAIL, 'verification mail goes to the typed address (normalised)');
// the e-mail is NOT bound until the code is confirmed
assert.strictEqual(call({ action: 'studentEmailStatus', sessionToken: s1.sessionToken }).hasEmail, false);
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '10001' }).mode, 'teacher', 'unverified address is not used for reset');
let bindCode = codeOf(lastMail());
r = call({ action: 'studentEmailConfirm', sessionToken: s1.sessionToken, code: wrongCode(bindCode) });
assert.strictEqual(r.code, 'invalid_code'); assert.strictEqual(r.attemptsLeft, 4);
assert.strictEqual(call({ action: 'studentEmailConfirm', sessionToken: s1.sessionToken, code: bindCode }).status, 'success');
r = call({ action: 'studentEmailStatus', sessionToken: s1.sessionToken });
assert(r.hasEmail && !r.maskedEmail.includes('student.sample'));
// the password sheet / roster download never expose the address to other roles
assert(!JSON.stringify(call({ action: 'download_roster', token: T })).includes(STU_EMAIL));
assert(!JSON.stringify(call({ action: 'studentLookup', studentId: '10001' })).includes('example.com'));

gas.mail.sent.length = 0;
r = call({ action: 'resetRequest', role: 'student', id: '10001' });
assert.strictEqual(r.mode, 'email'); assert(r.maskedEmail && !r.maskedEmail.includes('student.sample'));
assert.strictEqual(gas.mail.sent.length, 1);
assert(!/[A-Za-z0-9]{20,}/.test(gas.mail.sent[0].body.replace(/MusicSmart/g, '')), 'mail has a code only, no secrets');
let code = codeOf(lastMail());
// the code is stored hashed only
const sheetTxt = JSON.stringify(gas.sheets['รีเซ็ตรหัส_PasswordResets']._data());
assert(!sheetTxt.includes('"' + code + '"'), 'plaintext code not stored in sheet');
// validation before consuming attempts
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code, secret: '111111' }).code, 'weak_pin');
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code, secret: '12ab' }).code, 'bad_pin');
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code: 'abc', secret: '730194' }).code, 'bad_code');
// wrong code x4 then right code still works; wrong code x5 burns the code
for (let i = 0; i < 4; i++) assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code: wrongCode(code), secret: '730194' }).code, 'invalid_code');
r = call({ action: 'resetConfirm', role: 'student', id: '10001', code, secret: '730194' });
assert.strictEqual(r.status, 'success');
assert.strictEqual(login('10001', '482615').code, 'wrong_pin', 'old PIN no longer works');
assert.strictEqual(login('10001', '730194').status, 'success', 'new PIN works');
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code, secret: '573920' }).code, 'invalid_code', 'code is single use');
// old session token dies after reset
assert.strictEqual(call({ action: 'studentNotices', sessionToken: s1.sessionToken }).status, 'error', 'old session revoked');

// burn after 5 wrong tries
hourLater();
call({ action: 'resetRequest', role: 'student', id: '10001' });
code = codeOf(lastMail());
let last;
for (let i = 0; i < 5; i++) last = call({ action: 'resetConfirm', role: 'student', id: '10001', code: wrongCode(code), secret: '730194' });
assert.strictEqual(last.attemptsLeft, 0);
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code, secret: '573920' }).code, 'invalid_code', 'right code rejected once burned');

// expiry (15 min) + a new request supersedes the old code
hourLater();
call({ action: 'resetRequest', role: 'student', id: '10001' });
const old = codeOf(lastMail());
hourLater();
call({ action: 'resetRequest', role: 'student', id: '10001' });
const fresh = codeOf(lastMail());
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code: old, secret: '573920' }).code, 'invalid_code', 'superseded code rejected');
gas.advance(16 * 60000);
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code: fresh, secret: '573920' }).code, 'invalid_code', 'expired after 15 minutes');

// request throttle: 3 per hour per account
hourLater();
for (let i = 0; i < 3; i++) assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '10001' }).status, 'success');
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '10001' }).code, 'rate_limited');
// mail failure does not leave a usable code
hourLater(); gas.mail.fail = true;
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '10001' }).code, 'mail_failed');
gas.mail.fail = false;
// unknown / malformed ids
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '99999' }).code, 'not_found');
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: 'abc' }).code, 'bad_id');

// ---------- student WITHOUT e-mail: request -> teacher approves -> code given by teacher -> student sets new PIN
let s2 = setPin('10002', '264817');
r = call({ action: 'resetRequest', role: 'student', id: '10002' });
assert.strictEqual(r.mode, 'teacher'); assert.strictEqual(r.existing, false); assert.strictEqual(r.noEmail, true);
const mailsBefore = gas.mail.sent.length;
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '10002' }).existing, true, 'no duplicate request');
assert.strictEqual(gas.mail.sent.length, mailsBefore, 'no e-mail for students without address');
// student can also choose "ask teacher" even when an e-mail exists
hourLater();
assert.strictEqual(call({ action: 'resetRequest', role: 'student', id: '10001', via: 'teacher' }).mode, 'teacher');
// teacher endpoints need the sync token
assert.strictEqual(call({ action: 'list_reset_requests' }).status, 'error');
assert.strictEqual(call({ action: 'decide_reset_request', requestId: 'x', approve: true }).status, 'error');
r = call({ action: 'list_reset_requests', token: T });
assert.strictEqual(r.requests.length, 2);
const req2 = r.requests.find(x => x.subjectId === '10002');
assert.strictEqual(req2.role, 'student'); assert.strictEqual(req2.status, 'pending'); assert.strictEqual(req2.className, 'ม.1/1');
assert(req2.name.includes('สอง'));
assert(!('code' in req2) && !('code_hash' in req2), 'list never exposes codes');
// student cannot reset before the teacher approves
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10002', code: '123456', secret: '730194' }).code, 'invalid_code');
r = call({ action: 'decide_reset_request', token: T, requestId: req2.id, approve: true });
assert.strictEqual(r.status, 'success'); assert.strictEqual(r.state, 'approved'); assert(/^\d{6}$/.test(r.code));
const tcode = r.code;
assert(r.expiresMs - Date.now() > 23 * 3600000);
assert(!JSON.stringify(call({ action: 'list_reset_requests', token: T })).includes(tcode), 'code shown to the teacher only once');
assert(!JSON.stringify(gas.sheets['รีเซ็ตรหัส_PasswordResets']._data()).includes('"' + tcode + '"'), 'teacher code stored hashed');
// teacher can re-issue (new code replaces the old one)
let r2 = call({ action: 'decide_reset_request', token: T, requestId: req2.id, approve: true });
if (r2.code === tcode) r2 = call({ action: 'decide_reset_request', token: T, requestId: req2.id, approve: true });   // 1-in-a-million collision
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10002', code: tcode, secret: '730194' }).code, 'invalid_code', 're-issued code replaces old');
// wrong student id with the right code fails
assert.strictEqual(call({ action: 'resetConfirm', role: 'student', id: '10001', code: r2.code, secret: '730194' }).code, 'invalid_code');
r = call({ action: 'resetConfirm', role: 'student', id: '10002', code: r2.code, secret: '730194' });
assert.strictEqual(r.status, 'success');
assert.strictEqual(login('10002', '264817').code, 'wrong_pin');
assert.strictEqual(login('10002', '730194').status, 'success');
assert.strictEqual(call({ action: 'studentNotices', sessionToken: s2.sessionToken }).status, 'error', 'old session revoked');
assert(!call({ action: 'list_reset_requests', token: T }).requests.some(x => x.subjectId === '10002'), 'finished request leaves the teacher queue');
// teacher rejects a request
hourLater();
call({ action: 'resetRequest', role: 'student', id: '10002' });
const req3 = call({ action: 'list_reset_requests', token: T }).requests.find(x => x.subjectId === '10002');
assert.strictEqual(call({ action: 'decide_reset_request', token: T, requestId: req3.id, approve: false }).state, 'rejected');
assert.strictEqual(call({ action: 'decide_reset_request', token: T, requestId: req3.id, approve: true }).code, 'closed');
assert.strictEqual(call({ action: 'decide_reset_request', token: T, requestId: 'nope', approve: true }).code, 'not_found');
// unapproved request expires after 14 days
hourLater();
call({ action: 'resetRequest', role: 'student', id: '10002' });
gas.advance(15 * 86400000);
assert(!call({ action: 'list_reset_requests', token: T }).requests.some(x => x.subjectId === '10002'), 'stale pending request dropped');

// ---------- teacher / admin: reset by e-mail (also works when server password was never set / forgotten)
gas.mail.sent.length = 0;
const generic = call({ action: 'resetRequest', role: 'staff', id: 'nobody@example.com' });
const known = call({ action: 'resetRequest', role: 'staff', id: ' ' + ADMIN.toUpperCase() });
assert.strictEqual(generic.status, 'success'); assert.strictEqual(known.status, 'success');
assert.strictEqual(generic.message, known.message, 'same answer whether or not the account exists');
assert.strictEqual(gas.mail.sent.length, 1, 'only the real admin address gets mail');
assert.strictEqual(lastMail().to, ADMIN);
const adminCode = codeOf(lastMail());
assert.strictEqual(call({ action: 'resetConfirm', role: 'staff', id: ADMIN, code: adminCode, secret: 'short' }).code, 'weak_password');
assert.strictEqual(call({ action: 'resetConfirm', role: 'staff', id: ADMIN, code: wrongCode(adminCode), secret: 'Sample-New-Pass-77' }).code, 'invalid_code');
assert.strictEqual(call({ action: 'resetConfirm', role: 'staff', id: 'nobody@example.com', code: adminCode, secret: 'Sample-New-Pass-77' }).code, 'invalid_code');
r = call({ action: 'resetConfirm', role: 'staff', id: ADMIN, code: adminCode, secret: 'Sample-New-Pass-77' });
assert.strictEqual(r.status, 'success'); assert(!('syncToken' in r), 'reset itself does not log in / leak the sync token');
assert.strictEqual(call({ action: 'teacherLogin', email: ADMIN, password: 'Sample-New-Pass-77' }).status, 'success');
assert.strictEqual(call({ action: 'teacherLogin', email: ADMIN, password: 'Sample-New-Pass-78' }).code, 'wrong_password');
assert(!gas.props.TEACHER_AUTH.includes('Sample-New-Pass-77'), 'only hash stored');
// locked account is unlocked by a successful reset
hourLater();
for (let i = 0; i < 5; i++) call({ action: 'teacherLogin', email: ADMIN, password: 'bad' + i });
assert.strictEqual(call({ action: 'teacherLogin', email: ADMIN, password: 'Sample-New-Pass-77' }).code, 'locked');
call({ action: 'resetRequest', role: 'staff', id: ADMIN });
assert.strictEqual(call({ action: 'resetConfirm', role: 'staff', id: ADMIN, code: codeOf(lastMail()), secret: 'Another-Sample-Pw-9' }).status, 'success');
assert.strictEqual(call({ action: 'teacherLogin', email: ADMIN, password: 'Another-Sample-Pw-9' }).status, 'success');
// extra admin e-mails: Script Property + the stored teacher account + script owner
hourLater(); gas.mail.sent.length = 0;
assert.strictEqual(gas.mail.sent.length, 0);
call({ action: 'resetRequest', role: 'staff', id: 'someone.else@example.com' });
assert.strictEqual(gas.mail.sent.length, 0, 'unknown address gets nothing');
gas.props.ADMIN_EMAILS = 'Second.Admin@example.com, third@example.com';
call({ action: 'resetRequest', role: 'staff', id: 'second.admin@example.com' });
assert.strictEqual(lastMail().to, 'second.admin@example.com');
call({ action: 'resetRequest', role: 'staff', id: gas.mail.owner });
assert.strictEqual(lastMail().to, gas.mail.owner, 'script owner counts as admin');

// ---------- intern: reset by e-mail (registered address) or by teacher when no address
const reg = { action: 'internRegister', fullName: 'นศ ตัวอย่าง', internId: 'S6600077', university: 'มหาวิทยาลัยตัวอย่าง', faculty: 'ครุศาสตร์', major: 'ดนตรี', phone: '0812345678',
  email: 'intern.sample@example.com', term: '1', academicYear: 2569, pin: '864209' };
assert.strictEqual(call(reg).status, 'success');
call({ action: 'decide_intern', token: T, internId: 'S6600077', approve: true, classes: ['ม.1/1'] });
hourLater(); gas.mail.sent.length = 0;
call({ action: 'resetRequest', role: 'staff', id: 'S6600077' });          // by student code
assert.strictEqual(lastMail().to, 'intern.sample@example.com');
const iCode = codeOf(lastMail());
assert.strictEqual(call({ action: 'resetConfirm', role: 'staff', id: 'Intern.Sample@example.com', code: iCode, secret: '555555' }).code, 'weak_pin');
r = call({ action: 'resetConfirm', role: 'staff', id: 'Intern.Sample@example.com', code: iCode, secret: '720194' });   // confirm by e-mail
assert.strictEqual(r.status, 'success'); assert.strictEqual(r.role, 'intern');
assert.strictEqual(call({ action: 'internLogin', internId: 'S6600077', pin: '864209' }).code, 'wrong_pin');
const il = call({ action: 'internLogin', internId: 'S6600077', pin: '720194' });
assert.strictEqual(il.status, 'success'); assert.deepStrictEqual(il.profile.classes, ['ม.1/1']);
// via teacher
hourLater();
r = call({ action: 'resetRequest', role: 'staff', id: 'S6600077', via: 'teacher' });
assert.strictEqual(r.mode, 'teacher');
const ireq = call({ action: 'list_reset_requests', token: T }).requests.find(x => x.subjectId === 'S6600077');
assert.strictEqual(ireq.role, 'intern');
const ic = call({ action: 'decide_reset_request', token: T, requestId: ireq.id, approve: true }).code;
assert.strictEqual(call({ action: 'resetConfirm', role: 'staff', id: 'S6600077', code: ic, secret: '837261' }).status, 'success');
assert.strictEqual(call({ action: 'internLogin', internId: 'S6600077', pin: '837261' }).status, 'success');
// intern without e-mail goes to the teacher automatically
call({ action: 'upsert_intern', token: T, internId: 'S6600088', name: 'นศ ไม่มีอีเมล', classes: ['ม.1/2'] });
gas.mail.sent.length = 0;
assert.strictEqual(call({ action: 'resetRequest', role: 'staff', id: 'S6600088' }).mode, 'teacher');
assert.strictEqual(gas.mail.sent.length, 0);

// ---------- misc safety
// a rejected/unknown intern id or empty id
assert.strictEqual(call({ action: 'resetRequest', role: 'staff', id: '' }).code, 'bad_id');
// reset actions are public but never expose another user's data
assert(!/hash|salt|token/i.test(JSON.stringify(call({ action: 'resetRequest', role: 'student', id: '10002' }))));
// the e-mail column is added to existing student sheets that predate it
const legacy = loadGas({ SYNC_TOKEN: T });
legacy.call({ action: 'upload_roster', token: T, students: [{ student_id: '20001', first_name: 'เดิม', last_name: 'ทดสอบ', class: 'ม.1/1', no: 1 }] });
const sh = legacy.sheets['นักเรียน_Students_Auth']; const d = sh._data();
d[0] = d[0].slice(0, 13); d[1] = d[1].slice(0, 13);   // simulate a sheet created before the email column existed
assert.strictEqual(legacy.call({ action: 'studentLookup', studentId: '20001' }).status, 'success');
assert.strictEqual(sh._data()[0][13], 'email', 'header added lazily');
// an uploaded roster keeps the bound e-mail
const keep = loadGas({ SYNC_TOKEN: T });
keep.call({ action: 'upload_roster', token: T, students: [{ student_id: '30001', first_name: 'เก็บ', last_name: 'อีเมล', class: 'ม.1/1', no: 1 }] });
const ks = keep.call({ action: 'studentSetPin', studentId: '30001', pin: '482615' });
keep.call({ action: 'studentEmailStart', sessionToken: ks.sessionToken, email: STU_EMAIL });
keep.call({ action: 'studentEmailConfirm', sessionToken: ks.sessionToken, code: codeOfMail(keep) });
keep.call({ action: 'upload_roster', token: T, students: [{ student_id: '30001', first_name: 'เก็บ', last_name: 'อีเมล', class: 'ม.1/1', no: 1 }] });
assert.strictEqual(keep.call({ action: 'studentEmailStatus', sessionToken: ks.sessionToken }).hasEmail, true, 'roster re-upload keeps e-mail binding');
function codeOfMail(g) { return codeOf(g.mail.sent[g.mail.sent.length - 1]); }

console.log('password reset (GAS: e-mail + teacher-issued code) tests passed');
