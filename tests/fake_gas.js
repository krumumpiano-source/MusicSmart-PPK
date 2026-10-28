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

// Minimal Drive: folders/files in memory; Drive API resumable upload via UrlFetchApp.
function makeDrive() {
  let seq = 0;
  const byId = {};
  const files = [];
  const blob = (bytes, mime, name) => ({ _bytes: signed(unsigned(bytes)), getBytes() { return this._bytes.slice(); }, getContentType: () => mime, getName: () => name,
    getDataAsString() { return unsigned(this._bytes).toString('utf8'); } });
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  function mkFile(name, bytes, mime, parent) {
    const f = { _id: 'file' + (++seq), _name: name, _bytes: bytes, _mime: mime, _parent: parent, _trashed: false, _sharing: 'PRIVATE',
      getId() { return this._id; }, getName() { return this._name; }, getSize() { return this._bytes.length; },
      getUrl() { return 'https://drive.google.com/file/d/' + this._id + '/view'; }, getBlob() { return blob(this._bytes, this._mime, this._name); },
      setTrashed(t) { this._trashed = t; }, setSharing(a) { this._sharing = a; }, getMimeType() { return this._mime; } };
    byId[f._id] = f; files.push(f); return f;
  }
  function mkFolder(name, parent) {
    const fo = { _id: 'folder' + (++seq), _name: name, _parent: parent, _trashed: false,
      getId() { return this._id; }, getName() { return this._name; }, setTrashed(t) { this._trashed = t; },
      getFoldersByName: n => iter(Object.values(byId).filter(x => x._parent === fo && x.getFoldersByName && x._name === n && !x._trashed)),
      createFolder: n => mkFolder(n, fo),
      createFile: b => mkFile(b.getName(), b.getBytes(), b.getContentType(), fo),
      getFiles: () => iter(files.filter(f => f._parent === fo && !f._trashed)) };
    byId[fo._id] = fo; return fo;
  }
  const root = mkFolder('root', null);
  const alive = x => { let p = x; while (p) { if (p._trashed) return false; p = p._parent; } return true; };
  const DriveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' },
    getFoldersByName: n => root.getFoldersByName(n), createFolder: n => root.createFolder(n),
    getFolderById: id => { const f = byId[id]; if (!f || !f.getFoldersByName || !alive(f)) throw new Error('not found'); return f; },
    getFileById: id => { const f = byId[id]; if (!f || f.getFoldersByName) throw new Error('not found'); return f; }
  };
  const sessions = {};
  const drive = { fail: null, puts: 0 };
  const resp = (code, headers, text) => ({ getResponseCode: () => code, getHeaders: () => headers || {}, getContentText: () => text || '' });
  const UrlFetchApp = {
    fetch(url, o) {
      if (drive.fail) { const f = drive.fail; drive.fail = null; return resp(f, {}, ''); }
      if (/uploadType=resumable/.test(url)) {
        const meta = JSON.parse(o.payload);
        const sid = 'https://upload.fake/session/' + (++seq);
        sessions[sid] = { meta, total: Number(o.headers['X-Upload-Content-Length']), parts: [] };
        return resp(200, { Location: sid });
      }
      const s = sessions[url];
      if (!s) return resp(404);
      drive.puts++;
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(o.headers['Content-Range']);
      if (Number(m[1]) !== s.parts.length) return resp(400);
      for (const x of o.payload) s.parts.push(x);
      if (s.parts.length < s.total) return resp(308);
      const parent = byId[s.meta.parents[0]];
      const f = mkFile(s.meta.name, s.parts, s.meta.mimeType, parent);
      return resp(200, {}, JSON.stringify({ id: f._id }));
    }
  };
  const triggers = [];
  const ScriptApp = { getOAuthToken: () => 'fake-oauth', getProjectTriggers: () => triggers.slice(), deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
    newTrigger: h => ({ timeBased: () => ({ everyHours: n => ({ create: () => triggers.push({ getHandlerFunction: () => h, hours: n }) }) }) }) };
  return { DriveApp, UrlFetchApp, ScriptApp, blob, files, root, byId, drive, triggers };
}

function loadGas(initialProps) {
  const D = makeDrive();
  const sheets = {};
  const ss = { getName: () => 'test', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet()) };
  const props = Object.assign({}, initialProps || {});
  const cache = {};
  // นาฬิกาจำลอง (ใช้ทดสอบห้องสอบ): ไม่ตั้งค่า = เวลาจริง (เข้ากันได้กับเทสต์เดิม)
  const clock = { t: null };
  const lockState = { busy: false, acquired: 0, released: 0 };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0 && clock.t !== null) super(clock.t); else super(...a); }
    static now() { return clock.t !== null ? clock.t : Date.now(); }
  }
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock() { if (lockState.busy) return false; lockState.acquired++; return true; }, releaseLock() { lockState.released++; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => signed(crypto.createHash('sha256').update(s, 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', k).update(v, 'utf8').digest()),
      base64EncodeWebSafe: s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => signed(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: (bytes, mime, name) => D.blob(bytes, mime, name),
      base64Decode: s => signed(Buffer.from(s, 'base64')),
      getUuid: () => crypto.randomUUID(),
      formatDate: () => '2026-01-01 00:00:00'
    },
    DriveApp: D.DriveApp, UrlFetchApp: D.UrlFetchApp, ScriptApp: D.ScriptApp,
    Date: FakeDate, JSON, Math, String, Number, Array, Object
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../google_apps_script.js', 'utf8'), ctx);
  const call = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const callRaw = text => JSON.parse(ctx.doPost({ postData: { contents: text } }).text);
  const setNow = ms => { clock.t = ms === null ? null : Number(ms); };
  const advance = ms => { clock.t = (clock.t === null ? Date.now() : clock.t) + Number(ms); };
  return { ctx, sheets, props, cache, call, callRaw, drive: D, setNow, advance, lock: lockState };
}
module.exports = { loadGas };
