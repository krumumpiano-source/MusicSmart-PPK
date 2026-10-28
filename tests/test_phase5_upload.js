// Phase 5: chunked student uploads to the teacher's Drive (private), attach to submissions / practice recordings. Sample data only.
const assert = require('assert');
const { loadGas } = require('./fake_gas');
const gas = loadGas({ SYNC_TOKEN: 'T', UPLOAD_MAX_MB: '5', UPLOAD_DAILY_COUNT: '4' });
const CH = 2 * 1024 * 1024;
let store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.navigator = { userAgent: 'NodeTest', onLine: true };
global.STUDENTS_DATA = require('./fixtures/students.sample.js');
let fetchHook = null;
global.fetch = async (url, opts) => { const body = JSON.parse(opts.body); if (fetchHook) await fetchHook(body); const reply = gas.call(body); return { ok: true, status: 200, json: async () => reply }; };
global.GoogleSheetSync = require('../app/js/google-sheet-sync.js');
global.Store = require('../app/data/store.js');
global.StudentAuth = require('../app/js/student-auth.js').StudentAuth;
Object.assign(global, require('../app/js/student-submit.js'));
const { StudentUpload } = require('../app/js/student-upload.js'); global.StudentUpload = StudentUpload;
const API = 'https://script.google.com/macros/s/AKfycbTEST_sample/exec';

const mp4 = n => { const b = Buffer.alloc(n, 7); b.write('ftypisom', 4, 'latin1'); return b; };
const fileOf = (buf, name, type) => new Blob([buf], { type }) && Object.assign(new Blob([buf], { type }), { name });
const b64 = b => b.toString('base64');

(async () => {
  GoogleSheetSync.saveConfig({ webAppUrl: API, syncToken: 'T', autoSync: false });
  Store.setCurrentUser({ role: 'teacher', name: 'ครูตัวอย่าง' });
  await StudentAuth.uploadRoster();
  const teacherStore = store;
  store = {}; Store._cache.clear(); Store._studentIndex = null; global.MUSICSMART_PUBLIC_API_URL = API;
  await StudentAuth.setPin('90001', '123456');
  const tok = Store.getCurrentUser().sessionToken;
  const other = gas; // same server
  const call = b => gas.call(Object.assign({ sessionToken: tok }, b));

  // ---- server: auth & validation
  assert.strictEqual(gas.call({ action: 'studentUploadStart', sessionToken: 'forged.sig', uploadId: 'abcdefgh1', fileName: 'a.mp4', mimeType: 'video/mp4', size: 10, period: 1 }).code, 'bad_session');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'abcdefgh1', fileName: 'a.exe', mimeType: 'application/x-msdownload', size: 10, period: 1 }).code, 'bad_type');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'abcdefgh1', fileName: 'a.mp4', mimeType: 'image/png', size: 10, period: 1 }).code, 'type_mismatch');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'abcdefgh1', fileName: 'a.mp4', mimeType: 'video/mp4', size: 6 * 1024 * 1024, period: 1 }).code, 'too_large');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'bad id!', fileName: 'a.mp4', mimeType: 'video/mp4', size: 10, period: 1 }).code, 'bad_upload_id');

  // content sniff: .png that is really text -> rejected, staging trashed
  let r = call({ action: 'studentUploadStart', uploadId: 'fakepng01', fileName: 'x.png', mimeType: 'image/png', size: 5, period: 1 });
  assert.strictEqual(r.status, 'success');
  r = call({ action: 'studentUploadChunk', uploadId: 'fakepng01', index: 0, data: b64(Buffer.from('hello')) });
  assert.strictEqual(r.code, 'type_mismatch');
  assert.strictEqual(call({ action: 'studentUploadChunk', uploadId: 'fakepng01', index: 0, data: b64(Buffer.from('hello')) }).code, 'upload_rejected');

  // ---- chunked upload: out of order, duplicate, finish-before-complete, idempotent finish
  const big = mp4(CH * 2 + 1000);
  r = call({ action: 'studentUploadStart', uploadId: 'clip000001', fileName: 'เพลงตัวอย่าง.mp4', mimeType: 'video/mp4', size: big.length, period: 3, purpose: 'assignment' });
  assert.strictEqual(r.upload.totalChunks, 3);
  assert.strictEqual(call({ action: 'studentUploadChunk', uploadId: 'clip000001', index: 2, data: b64(big.subarray(2 * CH)) }).status, 'success');
  assert.strictEqual(call({ action: 'studentUploadChunk', uploadId: 'clip000001', index: 1, data: b64(big.subarray(0, 10)) }).code, 'bad_chunk_size');
  assert.strictEqual(call({ action: 'studentUploadChunk', uploadId: 'clip000001', index: 5, data: b64(big.subarray(0, 10)) }).code, 'bad_index');
  r = call({ action: 'studentUploadFinish', uploadId: 'clip000001' });
  assert.strictEqual(r.code, 'missing_chunks'); assert.deepStrictEqual(r.missing, [0, 1]);
  call({ action: 'studentUploadChunk', uploadId: 'clip000001', index: 0, data: b64(big.subarray(0, CH)) });
  assert.strictEqual(call({ action: 'studentUploadChunk', uploadId: 'clip000001', index: 0, data: b64(big.subarray(0, CH)) }).duplicate, true);
  call({ action: 'studentUploadChunk', uploadId: 'clip000001', index: 1, data: b64(big.subarray(CH, 2 * CH)) });
  // restart with same id resumes (reports received chunks)
  assert.deepStrictEqual(call({ action: 'studentUploadStart', uploadId: 'clip000001', fileName: 'เพลงตัวอย่าง.mp4', mimeType: 'video/mp4', size: big.length, period: 3 }).received, [0, 1, 2]);
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'clip000001', fileName: 'other.mp4', mimeType: 'video/mp4', size: 99, period: 3 }).code, 'upload_id_conflict');
  // Drive hiccup on finish -> error, retry works
  gas.drive.drive.fail = 500;
  assert.strictEqual(call({ action: 'studentUploadFinish', uploadId: 'clip000001' }).code, 'drive_error');
  r = call({ action: 'studentUploadFinish', uploadId: 'clip000001' });
  assert(r.done); const url1 = r.upload.fileUrl;
  const putsAfter = gas.drive.drive.puts;
  r = call({ action: 'studentUploadFinish', uploadId: 'clip000001' });
  assert.strictEqual(r.upload.fileUrl, url1, 'finish is idempotent'); assert.strictEqual(gas.drive.drive.puts, putsAfter, 'no re-upload');
  const f = gas.drive.files.find(x => url1.includes(x._id));
  assert(Buffer.from(f._bytes.map(x => (x < 0 ? x + 256 : x))).equals(big), 'bytes assembled in order');
  assert.strictEqual(f._sharing, 'PRIVATE', 'private by default');
  assert(/^งาน_90001_p3_.*\.mp4$/.test(f._name), 'file named by student id: ' + f._name);
  const path = []; for (let p = f._parent; p && p._name !== 'root'; p = p._parent) path.unshift(p._name);
  assert.deepStrictEqual(path, ['MusicSmart_Student_Uploads', 'ม.1_1', 'คาบ3']);
  const staging = Object.values(gas.drive.byId).find(x => x._name === '90001_clip000001');
  assert(staging._trashed, 'staging cleaned after finish');

  // another student cannot touch this upload id / attach this file
  await StudentAuth.setPin('90002', '654321');
  const tok2 = Store.getCurrentUser().sessionToken;
  assert.strictEqual(gas.call({ action: 'studentUploadFinish', sessionToken: tok2, uploadId: 'clip000001' }).code, 'no_upload');
  r = gas.call({ action: 'studentSubmit', sessionToken: tok2, items: [{ clientId: 'a_90002_steal0001', kind: 'assignment', data: { period: 3, uploadId: 'clip000001' } }] });
  assert.strictEqual(r.rejected[0].reason, 'bad_upload');
  assert((await StudentAuth.login('90001', '123456')).success);
  assert.strictEqual(Store.getCurrentUser().studentId, '90001');

  // quota (4/day): 1 counted so far (rejected fakepng doesn't count) -> 3 more allowed
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'quota00000', fileName: 'q.pdf', mimeType: 'application/pdf', size: 10, period: 1 }).status, 'success');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'quota00001', fileName: 'q.pdf', mimeType: 'application/pdf', size: 10, period: 1 }).status, 'success');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'quota00002', fileName: 'q.pdf', mimeType: 'application/pdf', size: 10, period: 1 }).status, 'success');
  assert.strictEqual(call({ action: 'studentUploadStart', uploadId: 'quota00003', fileName: 'q.pdf', mimeType: 'application/pdf', size: 10, period: 1 }).code, 'quota');

  // expiry cleanup of orphaned staged chunks
  const up = gas.sheets['อัปโหลด_Uploads'];
  const row = up._data().findIndex(x => x[0] === '90001_quota00001');
  up._data()[row][12] = Date.now() - 25 * 3600000;
  assert.strictEqual(gas.ctx.cleanupStaleUploads(), 1);
  assert.strictEqual(up._data()[row][11], 'expired');
  assert.strictEqual(call({ action: 'studentUploadChunk', uploadId: 'quota00001', index: 0, data: b64(Buffer.from('%PDF-1')) }).code, 'upload_expired');
  gas.ctx.installUploadCleanupTrigger(); gas.ctx.installUploadCleanupTrigger();
  assert.strictEqual(gas.drive.triggers.length, 1, 'one cleanup trigger');

  // body limit
  assert.strictEqual(gas.callRaw(JSON.stringify({ action: 'studentUploadChunk', sessionToken: tok, uploadId: 'clip000001', index: 0, data: 'A'.repeat(3200000) })).code, 'too_large');

  // ---- client: pick/check, progress, pause across offline, resume, attach to submission
  gas.props.UPLOAD_DAILY_COUNT = '50';
  assert.strictEqual(StudentUpload.check(fileOf(Buffer.alloc(10), 'a.exe', '')).ok, false);
  assert.strictEqual(StudentUpload.check(fileOf(Buffer.alloc(10), 'a.mp4', 'image/png')).ok, false);
  assert.strictEqual(StudentUpload.check(fileOf(Buffer.alloc(51 * 1024 * 1024), 'a.mp4', 'video/mp4')).ok, false);
  assert(StudentUpload.check(fileOf(Buffer.alloc(16 * 1024 * 1024), 'a.mov', 'video/quicktime')).warn, 'big video note');
  gas.props.UPLOAD_MAX_MB = '50';
  const clip = mp4(CH * 2 + 5);
  let n = 0;
  fetchHook = async b => { if (b.action === 'studentUploadChunk' && ++n === 2) global.navigator.onLine = false; };
  let res = await StudentUpload.add(fileOf(clip, 'งานคาบ4.mp4', 'video/mp4'), { purpose: 'assignment', period: 4, className: 'ม.1/1', content: 'อธิบายผลงาน' });
  let j = await res.done;
  assert.strictEqual(j.status, 'offline', 'paused when offline'); assert.strictEqual(j.sent, 2);
  assert.strictEqual(StudentOutbox.statusFor(StudentOutbox.assignmentKey('ม.1/1', 4)).state, 'pending');
  global.navigator.onLine = true; fetchHook = null;
  await StudentUpload.resumeAll();
  j = StudentUpload.job(res.id);
  assert.strictEqual(j.status, 'done'); assert(j.fileUrl.startsWith('https://drive.google.com/'));
  assert(/รวม 3|3/.test(String(j.total)));
  await new Promise(r2 => setTimeout(r2, 30)); await StudentOutbox.flush();
  assert.strictEqual(StudentOutbox.statusFor(StudentOutbox.assignmentKey('ม.1/1', 4)).state, 'sent');
  // pause/resume by user
  res = await StudentUpload.add(fileOf(mp4(CH + 3), 'ฝึก.mp4', 'video/mp4'), { purpose: 'recording', period: 4, content: 'ฝึก 10 นาที' });
  StudentUpload.pause(res.id);
  j = await res.done; assert.notStrictEqual(j && j.status, 'done');
  await StudentUpload.resume(res.id);
  assert.strictEqual(StudentUpload.job(res.id).status, 'done');
  await new Promise(r2 => setTimeout(r2, 30)); await StudentOutbox.flush();
  // rejected type from server is permanent
  res = await StudentUpload.add(fileOf(Buffer.from('not a pdf at all'), 'x.pdf', 'application/pdf'), { period: 4 });
  j = await res.done; assert.strictEqual(j.status, 'rejected');
  assert(/ไฟล์ไม่ถูกต้อง/.test(StudentUpload.STATUS_TEXT[j.status]));
  // UI html has progress + Thai status
  const html = StudentUpload.html();
  assert(/อัปโหลดสำเร็จ/.test(html) && /100%/.test(html));

  // inbox + submissions sheet carry the Drive link
  const inbox = gas.sheets['นักเรียนส่งงาน_Inbox']._data();
  const a4 = inbox.find(x => x[5] === 'assignment' && x[6] === 4);
  assert(a4[8].startsWith('https://drive.google.com/') && a4[19]);
  const rec = inbox.find(x => x[5] === 'recording');
  assert(rec[8].startsWith('https://drive.google.com/'));
  const subsSheet = gas.sheets['งานนักเรียน_Submissions']._data();
  assert(subsSheet.some(x => String(x[8]).startsWith('https://drive.google.com/')));

  // teacher pull shows attachment + recording list
  delete global.MUSICSMART_PUBLIC_API_URL;
  store = teacherStore; Store._cache.clear(); Store._studentIndex = null;
  Store.setCurrentUser({ role: 'teacher', name: 'ครูตัวอย่าง' });
  const pr = await TeacherPull.pull({ silent: true });
  const sub = Store.getAllSubmissions()['ม.1/1_p4_90001'];
  assert(sub.attachment && sub.url.includes('drive.google.com') && sub.content === 'อธิบายผลงาน');
  const recs = JSON.parse(localStorage.getItem('ppk_student_recordings'))['ม.1/1_p4_90001'];
  assert(recs[0].file && recs[0].url.includes('drive.google.com'));

  // teacher fileBase64 path is private unless enabled
  const pngB64 = Buffer.from('\x89PNG\r\n\x1a\nxx', 'latin1').toString('base64');
  const ssx = gas.ctx.SpreadsheetApp.getActiveSpreadsheet();
  gas.ctx.processSyncItem(ssx, { type: 'submission', data: { className: 'ม.1/1', period: 1, studentId: '90001', fileName: 'a.png', mimeType: 'image/png', fileBase64: pngB64 } });
  const tf = gas.drive.files.filter(x => /^\[ม\.1\/1_90001\] a\.png$/.test(x._name));
  assert(tf.length >= 1, 'teacher upload created');
  assert(tf.every(x => x._sharing === 'PRIVATE'));
  gas.props.DRIVE_SHARE_ANYONE_WITH_LINK = 'true';
  gas.ctx.processSyncItem(gas.ctx.SpreadsheetApp.getActiveSpreadsheet(), { type: 'submission', data: { className: 'ม.1/1', period: 1, studentId: '90001', fileName: 'b.png', mimeType: 'image/png', fileBase64: pngB64 } });
  assert.strictEqual(gas.drive.files.find(x => /b\.png$/.test(x._name))._sharing, 'ANYONE_WITH_LINK');
  console.log('phase 5 (student uploads to Drive) tests passed');
})().catch(e => { console.error(e); process.exit(1); });
