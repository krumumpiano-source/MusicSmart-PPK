// Apps Script student auth (studentLookup / studentSetPin / studentLogin / upload_roster / reset_student_pin)
// Runs google_apps_script.js in a sandbox with fake Google services. Sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const { sheets, call } = loadGas({ SYNC_TOKEN: 'teacher-token' });

const roster = [
  { student_id: '90001', prefix: 'เด็กชาย', first_name: 'ตัวอย่างหนึ่ง', last_name: 'ทดสอบระบบ', nickname: 'หนึ่ง', class: 'ม.1/1', no: 1 },
  { student_id: '90002', prefix: 'เด็กหญิง', first_name: 'ตัวอย่างสอง', last_name: 'ทดสอบระบบ', nickname: 'สอง', class: 'ม.1/1', no: 2 }
];

// roster upload requires the teacher token
assert.strictEqual(call({ action: 'upload_roster', students: roster }).status, 'error');
let r = call({ action: 'upload_roster', token: 'teacher-token', students: roster });
assert.strictEqual(r.status, 'success'); assert.strictEqual(r.added, 2);

// lookup: no token needed, minimal masked data only
r = call({ action: 'studentLookup', studentId: '90001' });
assert.strictEqual(r.status, 'success'); assert.strictEqual(r.hasPin, false); assert.strictEqual(r.studentClass, 'ม.1/1');
assert(!JSON.stringify(r).includes('ตัวอย่างหนึ่ง'), 'lookup must not reveal full name');
assert(!JSON.stringify(r).includes('90002'), 'lookup must not leak other students');
assert.strictEqual(call({ action: 'studentLookup', studentId: '99999' }).code, 'not_found');

// login before PIN set -> needs_pin
assert.strictEqual(call({ action: 'studentLogin', studentId: '90001', pin: '123456' }).code, 'needs_pin');
assert.strictEqual(call({ action: 'studentSetPin', studentId: '90001', pin: '12' }).code, 'bad_pin');
r = call({ action: 'studentSetPin', studentId: '90001', pin: '123456' });
assert.strictEqual(r.status, 'success'); assert.strictEqual(r.profile.studentClass, 'ม.1/1');
assert.deepStrictEqual(Object.keys(r.profile).sort(), ['name', 'nickname', 'no', 'studentClass', 'studentId']);
// cannot overwrite an existing PIN without teacher reset
assert.strictEqual(call({ action: 'studentSetPin', studentId: '90001', pin: '654321' }).code, 'pin_exists');

// sheet stores only salted hash, never the PIN
const sheetRows = sheets['นักเรียน_Students_Auth']._data();
assert(!JSON.stringify(sheetRows).includes('123456'), 'plain PIN never stored');
assert(/^[0-9a-f]{64}$/.test(sheetRows[1][8]), 'sha-256 hex hash stored');

// login ok / wrong pin / lockout after 5 fails
assert.strictEqual(call({ action: 'studentLogin', studentId: '90001', pin: '123456' }).status, 'success');
for (let i = 0; i < 4; i++) assert.strictEqual(call({ action: 'studentLogin', studentId: '90001', pin: '000000' }).code, 'wrong_pin');
r = call({ action: 'studentLogin', studentId: '90001', pin: '000000' }); assert.strictEqual(r.attemptsLeft, 0);
assert.strictEqual(call({ action: 'studentLogin', studentId: '90001', pin: '123456' }).code, 'locked', 'locked even with right PIN');

// re-upload keeps PINs
call({ action: 'upload_roster', token: 'teacher-token', students: roster });
assert(sheets['นักเรียน_Students_Auth']._data()[1][8], 'PIN hash kept after re-upload');

// teacher reset (token-protected) unlocks and clears PIN
assert.strictEqual(call({ action: 'reset_student_pin', studentId: '90001' }).status, 'error');
assert.strictEqual(call({ action: 'reset_student_pin', token: 'teacher-token', studentId: '90001' }).status, 'success');
assert.strictEqual(call({ action: 'studentLookup', studentId: '90001' }).hasPin, false);
assert.strictEqual(call({ action: 'studentSetPin', studentId: '90001', pin: '111111' }).status, 'success');
assert.strictEqual(call({ action: 'studentLogin', studentId: '90001', pin: '111111' }).status, 'success');

// status list is token-protected
assert.strictEqual(call({ action: 'student_pin_status' }).status, 'error');
assert.strictEqual(call({ action: 'student_pin_status', token: 'teacher-token' }).students.length, 2);

// replace removes students not in the new list
r = call({ action: 'upload_roster', token: 'teacher-token', students: [roster[0]], replace: true });
assert.strictEqual(r.removed, 1); assert.strictEqual(call({ action: 'studentLookup', studentId: '90002' }).code, 'not_found');

console.log('student auth (Apps Script) tests passed');
