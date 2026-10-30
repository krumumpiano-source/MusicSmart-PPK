// ทดสอบตรรกะฝั่งแอปของ นศ.ฝึกสอน (InternMode/MentorPanel) ในโหมด Cloud ด้วย globals จำลอง
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function makeCtx(requestImpl) {
  const store = new Map();
  const calls = [];
  const saved = [];
  const merged = [];
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  let user = null;
  const ctx = {
    localStorage,
    Store: {
      getCurrentUser: () => user,
      setCurrentUser: (u) => { user = u; },
      clearRoster() {},
      importRoster() {}
    },
    CloudApi: {
      request: async (method, path, body, opts) => {
        calls.push({ method, path, body, anonymous: !!(opts && opts.anonymous) });
        return requestImpl(method, path, body);
      },
      _saveSession: (d) => { saved.push(d); return { token: d.token, expiresAt: 123456 }; }
    },
    StudentAuth: { isCloudMode: () => true },
    TeacherPull: { isConfigured: () => true, merge: (rows) => merged.push(rows), _cloudToRows: (s, q) => ({ mapped: [...(s || []).map((x) => ({ s: x })), ...(q || []).map((x) => ({ q: x }))] }) },
    console, JSON, Set, Number, Object, Array, Date, Promise, Error, String, encodeURIComponent
  };
  vm.createContext(ctx);
  const code = readFileSync(new URL('../../app/js/intern.js', import.meta.url), 'utf8');
  vm.runInContext(code + '\n;this.InternMode = InternMode; this.MentorPanel = MentorPanel;', ctx);
  return { ctx, calls, saved, merged, store, InternMode: ctx.InternMode, MentorPanel: ctx.MentorPanel };
}

const err = (status, code, message) => Object.assign(new Error(message || code), { status, code });

test('login stores a cloud session and returns the legacy response shape; errors keep server codes', async () => {
  const { calls, saved, InternMode } = makeCtx(async (m, p, b) => {
    if (b.pin === '111111') throw err(403, 'pending', 'รออนุมัติ');
    return { token: 'tok', name: 'นศ.', expires_in: 43200, profile: { internId: 'T1', name: 'นศ.', classes: ['ม.1/1'] } };
  });
  let r = await InternMode.login('T1', '482913');
  assert.equal(r.success, true);
  assert.equal(calls[0].path, '/api/intern/login');
  assert.equal(calls[0].anonymous, true);
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0])), { token: 'tok', role: 'intern', name: 'นศ.', expires_in: 43200 });
  assert.equal(r.user.sessionToken, 'tok');
  assert.deepEqual(JSON.parse(JSON.stringify(r.user.classes)), ['ม.1/1']);
  const raw = await InternMode._call('internLogin', { internId: 'T1', pin: '111111' });
  assert.deepEqual([raw.status, raw.code], ['error', 'pending']);
  const sp = await InternMode._call('internSetPin', { internId: 'T1', pin: '482913' });
  assert.equal(sp.status, 'success');
  assert.equal(calls[calls.length - 1].path, '/api/intern/set-pin');
});

test('authed 401 maps to session_expired; network error is thrown so the queue keeps the item', async () => {
  let mode = '401';
  const { InternMode, store } = makeCtx(async () => { throw mode === '401' ? err(401, 'unauthorized') : err(0, 'network'); });
  const r = await InternMode._call('internFetch', { since: 0 });
  assert.deepEqual([r.status, r.code], ['error', 'session_expired']);
  mode = 'net';
  await assert.rejects(() => InternMode._call('internPostLog', { className: 'ม.1/1', period: 1, clientId: 'l_12345678' }));
  // flush: ออฟไลน์ = รายการยังอยู่ในคิว
  InternMode.user = () => ({ role: 'intern', sessionToken: 't' });
  store.set(InternMode.OUTBOX, JSON.stringify([{ kind: 'log', className: 'ม.1/1', period: 1, clientId: 'l_12345678' }]));
  const f = await InternMode.flush();
  assert.equal(f.remaining, 1);
});

test('flush sends grades/logs to the Worker, drops accepted items, keeps expired-session ones', async () => {
  const sent = [];
  let expire = false;
  const { InternMode, store } = makeCtx(async (m, p, b) => {
    sent.push({ m, p, b });
    if (expire) throw err(401, 'unauthorized');
    return { accepted: [], rejected: [] };
  });
  InternMode.user = () => ({ role: 'intern', sessionToken: 't' });
  store.set(InternMode.OUTBOX, JSON.stringify([
    { kind: 'grades', items: [{ clientId: 'g_12345678', className: 'ม.1/1', period: 2, studentId: '90001', score: 7 }] },
    { kind: 'log', className: 'ม.1/1', period: 2, result: 'ดี', problems: '', solutions: '', clientId: 'l_12345678' }
  ]));
  let f = await InternMode.flush();
  assert.equal(f.remaining, 0);
  assert.deepEqual(sent.map((s) => s.p), ['/api/intern/grades', '/api/intern/logs']);
  assert.equal(sent[1].b.clientId, 'l_12345678');
  expire = true;
  store.set(InternMode.OUTBOX, JSON.stringify([{ kind: 'log', className: 'ม.1/1', period: 3, clientId: 'l_87654321' }]));
  f = await InternMode.flush();
  assert.equal(f.remaining, 1);
});

test('sync: cloud rows are converted before merge; since token is the ISO string from the server', async () => {
  const seen = [];
  const { InternMode, merged, store } = makeCtx(async (m, p) => {
    seen.push(p);
    return {
      roster: [{ student_id: '90001', class: 'ม.1/1' }], submissions: [{ id: 's1' }], quizzes: [{ unit_no: 1 }], dueDates: [],
      approvals: [{ id: 'a1', status: 'approved' }], logs: [], evaluations: [], nextSince: '2026-10-30T01:00:00.000Z'
    };
  });
  InternMode.user = () => ({ role: 'intern', sessionToken: 't' });
  const r = await InternMode.sync();
  assert.equal(r.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(merged[0])), [{ s: { id: 's1' } }, { q: { unit_no: 1 } }]);
  assert.equal(JSON.parse(store.get(InternMode.DATA)).since, '2026-10-30T01:00:00.000Z');
  await InternMode.sync();
  assert.equal(seen[1], '/api/intern/fetch?since=' + encodeURIComponent('2026-10-30T01:00:00.000Z'));
});

test('MentorPanel cloud routes map legacy actions to Worker endpoints', async () => {
  const { MentorPanel, calls } = makeCtx(async () => ({ interns: [], total: 14 }));
  await MentorPanel.listInterns();
  await MentorPanel.pending();
  await MentorPanel.logs('T1');
  await MentorPanel.saveIntern('T1', 'นศ.', ['ม.1/1']);
  await MentorPanel.decideIntern('T1', true, ['ม.1/1']);
  await MentorPanel.resetPin('T1');
  const ev = await MentorPanel._post({ action: 'decide_approval', id: 'ap 1', approve: false });
  await MentorPanel._post({ action: 'post_supervision', internId: 'T1', className: 'ม.1/1', period: 2, ratings: { a: 5 }, comments: 'ดี', mentor: 'ครู' });
  assert.deepEqual(calls.map((c) => c.method + ' ' + c.path), [
    'GET /api/interns',
    'GET /api/interns/approvals?status=pending',
    'GET /api/interns/logs?intern_id=T1',
    'PUT /api/interns/T1',
    'POST /api/interns/T1/decide',
    'POST /api/interns/T1/reset-pin',
    'POST /api/interns/approvals/ap%201/decide',
    'POST /api/interns/T1/supervision'
  ]);
  assert.equal(ev.status, 'success');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[4].body)), { approve: true, classes: ['ม.1/1'], reason: '' });
  await assert.rejects(() => MentorPanel._post({ action: 'nope' }));
});
