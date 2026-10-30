// ทดสอบ LyricStudio ฝั่งแอปในโหมด Cloud: เรียก endpoint ถูกต้อง แปลงผลเป็นรูปแบบเดิม และแสดงข้อความผิดพลาดได้
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../../app/' + p, import.meta.url), 'utf8');

function makeCtx(requestImpl, opts = {}) {
  const calls = [];
  const ctx = {
    Store: { getCurrentUser: () => ({ role: 'student', studentId: '90001' }) },
    StudentAuth: { isCloudMode: () => true },
    StudentOutbox: { currentStudent: () => ({ sessionToken: 't' }), sessionValid: () => opts.sessionValid !== false },
    CloudApi: {
      request: async (method, path, body) => {
        calls.push({ method, path, body });
        return requestImpl(method, path, body);
      }
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console, JSON, Promise, Object, Array, Number, String, Date, Error, RegExp, Math, encodeURIComponent, parseInt
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('data/kalimba_media.js') + ';' + read('js/lyric-core.js') + ';' + read('js/lyric-studio.js'), ctx);
  return { ctx, calls };
}

function makeHost() {
  const handlers = {};
  return { innerHTML: '', addEventListener: (t, f) => { handlers[t] = f; }, contains: () => true, querySelector: () => null, handlers };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
const err = (status, code, message) => Object.assign(new Error(message || code), { status, code });

const GET_OK = {
  songKey: 'ode_to_joy', cellCount: 30, maxLen: 12,
  settings: { mode: 'draft_vote', phase: 'writing', locked: false, selfVote: false },
  group: 3, seat: 1, memberCount: 4, me: { studentId: '90001', label: 'ก' }, myCells: [], myVote: '', canEdit: true, savedCount: 0
};

test('student mount (cloud): GET /api/lyrics/me with song key, renders group and editable cells', async () => {
  const { ctx, calls } = makeCtx(async () => GET_OK);
  const host = makeHost();
  ctx.LyricStudio.mountStudent(host, 9);
  await tick();
  assert.deepEqual([calls[0].method, calls[0].path], ['GET', '/api/lyrics/me?song=ode_to_joy']);
  assert.ok(host.innerHTML.includes('กลุ่ม 3'));
  assert.equal((host.innerHTML.match(/data-cell=/g) || []).length, 30);
});

test('student mount (cloud): 401 shows login hint, network error shows retry text', async () => {
  let e = err(401, 'unauthorized', 'x');
  const { ctx } = makeCtx(async () => { throw e; });
  const host = makeHost();
  ctx.LyricStudio.mountStudent(host, 9);
  await tick();
  assert.ok(host.innerHTML.includes('ต้องเข้าสู่ระบบด้วยรหัสนักเรียน'));
  e = err(0, 'network', 'ออฟไลน์');
  const host2 = makeHost();
  ctx.LyricStudio.mountStudent(host2, 9);
  await tick();
  assert.ok(host2.innerHTML.includes('เชื่อมต่อไม่ได้'));
});

test('student mount (cloud): expired local session never calls the API', async () => {
  const { ctx, calls } = makeCtx(async () => GET_OK, { sessionValid: false });
  const host = makeHost();
  ctx.LyricStudio.mountStudent(host, 9);
  await tick();
  assert.equal(calls.length, 0);
  assert.ok(host.innerHTML.includes('ต้องเข้าสู่ระบบด้วยรหัสนักเรียน'));
});

test('teacher mount (cloud): overview route uses class + song and renders groups', async () => {
  const { ctx, calls } = makeCtx(async () => ({
    songKey: 'ode_to_joy', cellCount: 30,
    settings: { mode: 'draft_vote', phase: 'writing', locked: false, selfVote: false, showTally: 'afterClose', seats: {} },
    groups: [{ group: 1, members: [{ studentId: '1', label: 'ก', no: 1, seat: 1, saved: true }], result: { mode: 'draft_vote', status: 'writing', candidates: [], tally: {}, total: 0 }, voters: [] }]
  }));
  const host = makeHost();
  ctx.LyricStudio.mountTeacher(host, 9, 'ม.1/1');
  await tick();
  assert.equal(calls[0].path, '/api/lyrics/overview?class=' + encodeURIComponent('ม.1/1') + '&song=ode_to_joy');
  assert.ok(host.innerHTML.includes('กลุ่ม 1'));
});
