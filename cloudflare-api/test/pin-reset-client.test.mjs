// ทดสอบ PasswordReset ฝั่งแอปในโหมด Cloud: เรียก endpoint ถูกต้อง คืนรูปแบบเดิม และไม่พึ่งอีเมล/Apps Script
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function makeCtx(impl) {
  const calls = [];
  const synced = [];
  const ctx = {
    StudentAuth: { isCloudMode: () => true, isServerMode: () => true, _post: async () => { throw new Error('must not call Apps Script'); } },
    CloudApi: { request: async (method, path, body, opts) => { calls.push({ method, path, body, anonymous: !!(opts && opts.anonymous) }); return impl(method, path, body); } },
    Store: { getCurrentUser: () => ({ role: 'teacher' }) },
    document: { addEventListener() {}, getElementById: () => null },
    window: { addEventListener() {} },
    console, JSON, Promise, Object, Array, Number, String, Date, Error, RegExp, Math, encodeURIComponent, setTimeout, setInterval
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../../app/js/password-reset.js', import.meta.url), 'utf8') + '\n;this.PR = PasswordReset;', ctx);
  ctx.PR.syncLocalSecret = (...a) => synced.push(a);
  return { PR: ctx.PR, calls, synced };
}
const err = (status, code, message) => Object.assign(new Error(message || code), { status, code });
const plain = (o) => JSON.parse(JSON.stringify(o));

test('request: student and staff map to Worker roles, anonymous; success shape has mode teacher', async () => {
  const { PR, calls } = makeCtx(async () => ({ mode: 'teacher', message: 'ok' }));
  let r = await PR.requestReset('student', ' 90001 ', 'email');
  assert.deepEqual(plain(calls[0]), { method: 'POST', path: '/api/pin-reset/request', body: { role: 'student', id: '90001' }, anonymous: true });
  assert.deepEqual([r.success, r.mode], [true, 'teacher']);
  await PR.requestReset('staff', 'TEST12345', 'teacher');
  assert.equal(calls[1].body.role, 'staff');
});

test('request/confirm errors keep server code + message; network error gives the offline message', async () => {
  let e = err(404, 'not_found', 'ไม่พบรหัสนักเรียนนี้');
  const { PR } = makeCtx(async () => { throw e; });
  let r = await PR.requestReset('student', '1', 'email');
  assert.deepEqual([r.success, r.code, r.message], [false, 'not_found', 'ไม่พบรหัสนักเรียนนี้']);
  e = err(0, 'network', 'x');
  r = await PR.confirmReset('student', '90001', '123456', '795146');
  assert.deepEqual([r.success, r.code], [false, 'network']);
});

test('confirm: sends cleaned code and syncs local secret only on success', async () => {
  let ok = true;
  const { PR, calls, synced } = makeCtx(async () => { if (!ok) throw err(400, 'invalid_code', 'ผิด'); return { message: 'done' }; });
  let r = await PR.confirmReset('staff', 'TEST12345', '123 456', '795146');
  assert.equal(r.success, true);
  assert.deepEqual(plain(calls[0].body), { role: 'staff', id: 'TEST12345', code: '123456', secret: '795146' });
  assert.equal(synced.length, 1);
  ok = false;
  r = await PR.confirmReset('student', '90001', '123456', '795146');
  assert.equal(r.success, false);
  assert.equal(synced.length, 1);
});

test('teacher queue: list + decide use Worker routes; approve returns code with success status; email binding is disabled', async () => {
  const { PR, calls } = makeCtx(async (m, p) => (m === 'GET' ? { requests: [{ id: 'a', subjectId: '90001' }] } : { code: '123456', subjectId: '90001', expiresMs: 5 }));
  assert.equal((await PR.listRequests()).length, 1);
  assert.deepEqual([calls[0].method, calls[0].path], ['GET', '/api/pin-reset/requests']);
  const d = await PR.decide('a b', true);
  assert.deepEqual([calls[1].method, calls[1].path, d.status, d.code], ['POST', '/api/pin-reset/requests/a%20b/decide', 'success', '123456']);
  const em = await PR.emailStatus();
  assert.deepEqual([em.success, em.code], [false, 'no_email']);
});
