// Google Sheet sync: token, JSON reply parsing, outbox retry (no network)
const assert = require('assert');
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
let reply = { status: 'success', processed: 1 }; let lastBody = null; let netDown = false;
global.fetch = async (url, opts) => {
  assert(!opts.mode, 'must not use no-cors');
  lastBody = JSON.parse(opts.body);
  if (netDown) throw new TypeError('Failed to fetch');
  return { ok: true, status: 200, json: async () => reply };
};
const S = require('../app/js/google-sheet-sync.js');
(async () => {
  assert.strictEqual(S.getConfig().webAppUrl, '', 'no hard-coded URL');
  assert(!/AKfycbzkB7cW/.test(require('fs').readFileSync(__dirname + '/../app/js/google-sheet-sync.js', 'utf8')), 'old URL removed');
  S.saveConfig({ webAppUrl: 'https://example.invalid/exec', syncToken: 'tok123', autoSync: false });
  S.enqueue('quiz_result', { score: 1 });
  reply = { status: 'error', message: 'unauthorized' };
  let r = await S.flushOutbox();
  assert.strictEqual(r.success, false); assert.strictEqual(lastBody.token, 'tok123');
  assert.strictEqual(S.getOutbox().length, 1, 'kept in outbox on server error');
  assert.strictEqual(S.getConfig().syncStatus, 'error');
  netDown = true; r = await S.flushOutbox(); assert.strictEqual(r.success, false);
  assert.strictEqual(S.getOutbox().length, 1, 'kept in outbox on network error');
  netDown = false; reply = { status: 'success', processed: 1 };
  r = await S.flushOutbox(); assert.strictEqual(r.success, true);
  assert.strictEqual(S.getOutbox().length, 0, 'outbox cleared after confirmed success');
  const t = await S.testConnection('https://example.invalid/exec'); assert(t.success);
  // legacy stored config keeps its URL
  store[S.STORAGE_KEYS.CONFIG] = JSON.stringify({ webAppUrl: 'https://legacy/exec' });
  assert.strictEqual(S.getConfig().webAppUrl, 'https://legacy/exec');
  assert(S.APPS_SCRIPT_CODE.includes("getProperty('SYNC_TOKEN')") && !S.APPS_SCRIPT_CODE.includes('spreadsheetUrl'));
  console.log('ALL SYNC TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
