// Fake Google Apps Script services for running google_apps_script.js in Node (tests only).
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const signed = b => Array.from(b).map(x => (x > 127 ? x - 256 : x));
const unsigned = a => Buffer.from(a.map(x => (x < 0 ? x + 256 : x)));

function makeSheet() {
  let data = [];
  return {
    _data: () => data,
    appendRow: r => data.push(r.slice()),
    getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }),
    getRange: (row, col, nr, nc) => ({
      setValues: vals => { for (let i = 0; i < nr; i++) { data[row - 1 + i] = data[row - 1 + i] || []; for (let j = 0; j < nc; j++) data[row - 1 + i][col - 1 + j] = vals[i][j]; } },
      setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }, setHorizontalAlignment() { return this; }
    }),
    clearContents: () => { data = []; },
    setFrozenRows() {}, setColumnWidth() {}
  };
}

function loadGas(initialProps) {
  const sheets = {};
  const ss = { getName: () => 'test', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet()) };
  const props = Object.assign({}, initialProps || {});
  const cache = {};
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => signed(crypto.createHash('sha256').update(s, 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', k).update(v, 'utf8').digest()),
      base64EncodeWebSafe: s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => signed(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: bytes => ({ getDataAsString: () => unsigned(bytes).toString('utf8') }),
      getUuid: () => crypto.randomUUID(),
      formatDate: () => '2026-01-01 00:00:00'
    },
    Date, JSON, Math, String, Number, Array, Object
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../google_apps_script.js', 'utf8'), ctx);
  const call = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const callRaw = text => JSON.parse(ctx.doPost({ postData: { contents: text } }).text);
  return { ctx, sheets, props, cache, call, callRaw };
}
module.exports = { loadGas };
