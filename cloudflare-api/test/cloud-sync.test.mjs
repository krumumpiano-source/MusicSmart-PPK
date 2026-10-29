// ทดสอบตรรกะ CloudSync ฝั่งแอป (คาบเรียน/วันกำหนดส่ง) ด้วย globals จำลอง
// รัน: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function makeCtx({ teacher = true, saveImpl, listRows = [], requestImpl } = {}) {
  const store = new Map();
  const calls = { save: [], list: 0, request: [], toasts: [] };
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const Store = {
    getSessionKey: (c, p) => `${c}_P${p}`,
    getAllSessions: () => JSON.parse(store.get('ppk_session_logs') || '{}'),
    save: (k, v) => { store.set(k, JSON.stringify(v)); return true; }
  };
  const CloudApi = {
    Auth: {
      isTeacher: () => teacher,
      isStudent: () => !teacher,
      session: () => ({ role: teacher ? 'teacher' : 'student', student: { student_id: '90001' } })
    },
    Sessions: {
      save: async (key, className, period, data, base) => {
        calls.save.push({ key, className, period, base });
        return saveImpl ? saveImpl(key, base) : { ok: true, version: base + 1 };
      },
      list: async () => { calls.list++; return listRows; }
    },
    request: async (method, path, body) => {
      calls.request.push({ method, path, body });
      return requestImpl ? requestImpl(method, path, body) : { due_dates: [] };
    }
  };
  const ctx = {
    localStorage, Store, CloudApi,
    StudentAuth: { isCloudMode: () => true },
    GoogleSheetSync: { showToast: (m) => calls.toasts.push(m) },
    navigator: { onLine: true },
    console,
    JSON, Set, Number, Object, Array, Date, Promise, Error, String
  };
  vm.createContext(ctx);
  const code = readFileSync(new URL('../../app/js/cloud-sync.js', import.meta.url), 'utf8');
  vm.runInContext(code + '\n;this.CloudSync = CloudSync;', ctx);
  return { ctx, store, calls, CloudSync: ctx.CloudSync };
}

function setSessions(store, obj) {
  store.set('ppk_session_logs', JSON.stringify(obj));
}

test('teacher: unversioned local sessions are pushed with base 0 and versions recorded', async () => {
  const { store, calls, CloudSync } = makeCtx();
  setSessions(store, { 'ม.1/1_P1': { className: 'ม.1/1', period: 1 }, 'ม.1/1_P2': { className: 'ม.1/1', period: 2 } });
  CloudSync._queueUnversioned();
  const r = await CloudSync.flushSessions();
  assert.equal(r.ok, true);
  assert.equal(r.pushed, 2);
  assert.deepEqual(calls.save.map(c => c.base), [0, 0]);
  assert.deepEqual(CloudSync.versions(), { 'ม.1/1_P1': 1, 'ม.1/1_P2': 1 });
  assert.deepEqual(CloudSync.pending(), []);
});

test('pushSession uses stored version as base on next save', async () => {
  const { store, calls, CloudSync } = makeCtx();
  setSessions(store, { 'ม.1/1_P3': { className: 'ม.1/1', period: 3 } });
  await CloudSync.pushSession('ม.1/1', 3);
  await CloudSync.pushSession('ม.1/1', 3);
  assert.deepEqual(calls.save.map(c => c.base), [0, 1]);
  assert.equal(CloudSync.versions()['ม.1/1_P3'], 2);
});

test('conflict: retries with server current version (this device wins)', async () => {
  let first = true;
  const { store, calls, CloudSync } = makeCtx({
    saveImpl: (key, base) => {
      if (first) { first = false; return { conflict: true, current_version: 5 }; }
      return { ok: true, version: base + 1 };
    }
  });
  setSessions(store, { 'ม.1/1_P4': { className: 'ม.1/1', period: 4 } });
  await CloudSync.pushSession('ม.1/1', 4);
  assert.deepEqual(calls.save.map(c => c.base), [0, 5]);
  assert.equal(CloudSync.versions()['ม.1/1_P4'], 6);
  assert.deepEqual(CloudSync.pending(), []);
});

test('network failure keeps the session pending and shows a toast', async () => {
  const { store, calls, CloudSync } = makeCtx({
    saveImpl: () => { throw Object.assign(new Error('offline'), { status: 0 }); }
  });
  setSessions(store, { 'ม.1/1_P5': { className: 'ม.1/1', period: 5 } });
  const r = await CloudSync.pushSession('ม.1/1', 5);
  assert.equal(r.ok, false);
  assert.deepEqual(CloudSync.pending(), ['ม.1/1_P5']);
  assert.equal(calls.toasts.length, 1);
  assert.equal(CloudSync.versions()['ม.1/1_P5'], undefined);
});

test('pull: applies newer server sessions, skips keys with unsaved local edits', async () => {
  const listRows = [
    { session_key: 'ม.1/2_P1', version: 3, data: { className: 'ม.1/2', period: 1, note: 'server' } },
    { session_key: 'ม.1/1_P9', version: 1, data: { className: 'ม.1/1', period: 9, note: 'server-pending' } },
    { session_key: 'ม.1/2_P2', version: 1, data: { className: 'ม.1/2', period: 2 } }
  ];
  const { store, CloudSync } = makeCtx({ listRows });
  setSessions(store, { 'ม.1/1_P9': { className: 'ม.1/1', period: 9, note: 'local' } });
  localStorage_setVersions(store, { 'ม.1/2_P2': 1 });
  store.set('ppk_cloud_pending_sessions', JSON.stringify(['ม.1/1_P9']));
  const r = await CloudSync.pullSessions();
  assert.equal(r.applied, 1);
  const all = JSON.parse(store.get('ppk_session_logs'));
  assert.equal(all['ม.1/2_P1'].note, 'server');
  assert.equal(all['ม.1/1_P9'].note, 'local');
  assert.equal(CloudSync.versions()['ม.1/2_P1'], 3);
});

function localStorage_setVersions(store, v) {
  store.set('ppk_cloud_session_versions', JSON.stringify(v));
}

test('pullDueDates maps server rows into the local due-date map', async () => {
  const { store, calls, CloudSync } = makeCtx({
    requestImpl: () => ({ due_dates: [{ class_name: 'ม.1/1', period: 3, due_at: '2026-11-05T03:00:00.000Z', title: 'งาน' }] })
  });
  await CloudSync.pullDueDates();
  assert.equal(calls.request[0].method, 'GET');
  assert.equal(calls.request[0].path, '/api/due-dates');
  const map = JSON.parse(store.get('ppk_due_dates'));
  assert.deepEqual(map['ม.1/1_p3'], { className: 'ม.1/1', period: 3, dueAt: '2026-11-05T03:00:00.000Z', title: 'งาน' });
});

test('pushDueDate sends ISO time, empty dueAt clears', async () => {
  const { calls, CloudSync } = makeCtx();
  await CloudSync.pushDueDate('ม.1/1', '3', '2026-11-05T10:00:00+07:00', 'งาน');
  await CloudSync.pushDueDate('ม.1/1', 3, '', '');
  assert.equal(calls.request[0].body.due_at, '2026-11-05T03:00:00.000Z');
  assert.equal(calls.request[0].body.period, 3);
  assert.equal(calls.request[1].body.due_at, '');
});

test('student session: no session pushes, init only pulls due dates', async () => {
  const { store, calls, CloudSync } = makeCtx({ teacher: false });
  setSessions(store, { 'ม.1/1_P1': { className: 'ม.1/1', period: 1 } });
  const r = await CloudSync.init();
  assert.equal(calls.save.length, 0);
  assert.equal(calls.list, 0);
  assert.equal(calls.request.length, 1);
  assert.equal(r.error, undefined);
});
