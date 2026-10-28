/* kalimba-notes.js — ES5 · ชั้นโน้ตที่ครูใส่เอง (override) ซ้อนบนข้อมูลที่สร้างอัตโนมัติ (kalimba_media.js)
 * - ไม่แก้ไฟล์ generated · เก็บในเครื่องครู (localStorage "ppk_kalimba_notes") + ส่งออก/นำเข้า JSON
 * - ใช้ร่วมกับ tools/curriculum/build_kalimba_media.js (เผยแพร่ให้นักเรียน: วางไฟล์ export ที่ tools/curriculum/kalimba_notes_teacher.json แล้ว build)
 * - รูปแบบโน้ต: { p:["C4"] | [] (= ตัวพัก), d: จังหวะ, th: ป้ายไทย }   ความยาว d ∈ 4,3,2,1.5,1,0.75,0.5,0.25
 * ห้ามเดาโน้ตเอง: ถ้าไม่มี override และไม่มีใน source → รายการสถานะ "ยังไม่มีโน้ต – รอครูใส่" */
(function (root) {
  'use strict';
  var KEY = 'ppk_kalimba_notes';
  var FORMAT = 'musicsmart-kalimba-notes';
  var VALID_D = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
  var LETTERS = 'CDEFGAB';
  var THAI = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท']; // C D E F G A B
  var OCT_MARK = '\u0E4D';
  var EMPTY_MSG = 'ยังไม่มีโน้ต – รอครูใส่';
  var DEFAULT_TINES = ['D6', 'B5', 'G5', 'E5', 'C5', 'A4', 'F4', 'D4', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'E6'];
  var DUR_ALIAS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
  function keysOf(o) { var k = [], x; for (x in o) if (Object.prototype.hasOwnProperty.call(o, x)) k.push(x); return k; }

  /* ---------- ชื่อโน้ต ---------- */
  function parsePitchName(s) {
    var m = /^([A-Ga-g])([#b]?)(\d)$/.exec(String(s || '').replace(/^\s+|\s+$/g, ''));
    if (!m) return null;
    return { letter: m[1].toUpperCase(), acc: m[2], oct: parseInt(m[3], 10) };
  }
  function normPitch(s) { var p = parsePitchName(s); return p ? p.letter + p.acc + p.oct : null; }
  function thaiOf(pitch) {
    var p = parsePitchName(pitch); if (!p) return '';
    var out = THAI[LETTERS.indexOf(p.letter)], i;
    for (i = 4; i < p.oct; i++) out += OCT_MARK;
    return out;
  }
  /** ด ร ม ฟ ซ ล ท (+ ํ ต่ออ็อกเทฟละหนึ่งตัว) → ชื่อโน้ต; ไม่รู้จัก → null */
  function thaiToPitch(tok) {
    var t = String(tok), base = t.replace(/[\u0E4D\u02DA\u00B0']/g, ''), marks = t.length - base.length;
    var i = THAI.indexOf(base);
    if (i < 0 || base.length !== 1) return null;
    return LETTERS.charAt(i) + (4 + marks);
  }
  function tokenPitch(tok) { return thaiToPitch(tok) || normPitch(tok); }

  /* ---------- parse/format ข้อความโน้ต ---------- */
  function parseDur(txt) {
    if (txt === undefined || txt === '') return null;
    var s = String(txt).toLowerCase(), dot = false, v;
    if (/\.$/.test(s) && DUR_ALIAS[s.charAt(0)] !== undefined && s.length === 2) { dot = true; s = s.charAt(0); }
    if (DUR_ALIAS[s] !== undefined) { v = DUR_ALIAS[s]; return dot ? v * 1.5 : v; }
    v = Number(s);
    return isFinite(v) ? v : NaN;
  }
  /**
   * ข้อความ → { notes, errors[] }
   * ตัวอย่าง:  "ด ร ม:2 พัก ซ+ม:1.5 | C4:q E4:e"   (| และ , ถูกมองข้าม)
   */
  function parseScore(text, opts) {
    opts = opts || {};
    var defD = opts.defaultD || 1, tines = opts.tines || DEFAULT_TINES;
    var toks = String(text || '').replace(/[|,;\n\r\t]+/g, ' ').split(/\s+/), notes = [], errors = [], i, tok, parts, dur, pn, base, pitches, j, pp;
    for (i = 0; i < toks.length; i++) {
      tok = toks[i]; if (!tok) continue;
      parts = tok.split(':'); base = parts[0];
      if (parts.length > 2) { errors.push('"' + tok + '": ใส่ ":" ได้ครั้งเดียว'); continue; }
      dur = parts.length === 2 ? parseDur(parts[1]) : defD;
      if (dur === null) dur = defD;
      if (typeof dur !== 'number' || isNaN(dur) || VALID_D.indexOf(dur) === -1) { errors.push('"' + tok + '": ความยาวจังหวะไม่ถูกต้อง (ใช้ได้ ' + VALID_D.join(', ') + ' หรือ w h q e s)'); continue; }
      if (/^(r|z|-|พัก)$/i.test(base)) { notes.push({ p: [], d: dur, th: 'พัก' }); continue; }
      pitches = []; pn = base.split('+');
      for (j = 0; j < pn.length; j++) {
        pp = tokenPitch(pn[j]);
        if (!pp) { errors.push('"' + tok + '": อ่านโน้ต "' + pn[j] + '" ไม่ออก (ใช้ ด ร ม ฟ ซ ล ท, ดํ ฯลฯ หรือ C4 D4 …)'); pitches = null; break; }
        if (tines.indexOf(pp) === -1) { errors.push('"' + tok + '": ' + pp + ' ไม่มีบนคาลิมบ้า 17 ลิ่ม (C4–E6 ตามผัง)'); pitches = null; break; }
        if (pitches.indexOf(pp) !== -1) { errors.push('"' + tok + '": โน้ตซ้ำในคอร์ดเดียวกัน'); pitches = null; break; }
        pitches.push(pp);
      }
      if (pitches) notes.push({ p: pitches, d: dur, th: thaiOf(pitches[0]) });
    }
    return { notes: notes, errors: errors };
  }
  function toScore(notes, defD) {
    defD = defD || 1;
    var out = [], i, n, t, j;
    for (i = 0; i < (notes || []).length; i++) {
      n = notes[i];
      if (!n.p || !n.p.length) t = 'พัก'; else { t = ''; for (j = 0; j < n.p.length; j++) t += (j ? '+' : '') + thaiOf(n.p[j]); }
      if (n.d !== defD) t += ':' + n.d;
      out.push(t);
    }
    return out.join(' ');
  }

  /* ---------- ตรวจรายการ ---------- */
  function validateMeter(m) {
    var x = /^(\d{1,2})\/(\d{1,2})$/.exec(String(m || ''));
    return !!x && parseInt(x[1], 10) >= 1 && [2, 4, 8, 16].indexOf(parseInt(x[2], 10)) !== -1;
  }
  function beatsPerBar(m) { var x = /^(\d+)\/(\d+)$/.exec(String(m || '4/4')); return x ? parseInt(x[1], 10) * 4 / parseInt(x[2], 10) : 4; }
  /**
   * ตรวจ+ทำให้เป็นรูปมาตรฐาน — raw: {id, period, title, kind, meter, bpm:{start}|number, notes, source?, note?}
   * คืน { ok, errors[], warnings[], item }
   */
  function validateItem(raw, tines) {
    tines = tines || DEFAULT_TINES;
    var errors = [], warnings = [], r = raw || {}, it = {}, i, j, n, pn, bpm, start, total = 0, bpb, rem;
    var id = String(r.id || '').replace(/^\s+|\s+$/g, '');
    if (!/^[A-Za-z0-9_\-]{2,60}$/.test(id)) errors.push('รหัสรายการ (id) ต้องเป็นอังกฤษ/ตัวเลข/_/- ยาว 2–60 ตัว');
    var period = Number(r.period);
    if (!(period >= 1 && period <= 20) || Math.floor(period) !== period) errors.push('คาบต้องเป็นจำนวนเต็ม 1–20');
    var title = String(r.title || '').replace(/^\s+|\s+$/g, '');
    if (!title) errors.push('ต้องมีชื่อรายการ');
    var meter = r.meter || '4/4';
    if (!validateMeter(meter)) errors.push('อัตราจังหวะไม่ถูกต้อง (ตัวอย่าง 4/4, 3/4, 2/4, 6/8)');
    bpm = r.bpm; start = (bpm && typeof bpm === 'object') ? Number(bpm.start) : Number(bpm === undefined ? 60 : bpm);
    if (!(start >= 30 && start <= 200)) errors.push('BPM ต้องอยู่ระหว่าง 30–200');
    var notes = isArr(r.notes) ? r.notes : null;
    if (!notes) errors.push('ไม่มีรายการโน้ต (notes)');
    else {
      if (notes.length > 400) errors.push('โน้ตเกิน 400 ตัว');
      var outNotes = [];
      for (i = 0; i < notes.length && i < 400; i++) {
        n = notes[i] || {}; pn = [];
        if (!isArr(n.p)) { errors.push('โน้ต #' + (i + 1) + ': ต้องมีรายการ p (ว่าง = ตัวพัก)'); continue; }
        for (j = 0; j < n.p.length; j++) {
          var np = normPitch(n.p[j]);
          if (!np) errors.push('โน้ต #' + (i + 1) + ': ชื่อโน้ต "' + n.p[j] + '" ไม่ถูกต้อง');
          else if (tines.indexOf(np) === -1) errors.push('โน้ต #' + (i + 1) + ': ' + np + ' ไม่มีบนคาลิมบ้า');
          else pn.push(np);
        }
        if (VALID_D.indexOf(Number(n.d)) === -1) errors.push('โน้ต #' + (i + 1) + ': ความยาว ' + n.d + ' ไม่มีสัญลักษณ์');
        outNotes.push({ p: pn, d: Number(n.d), th: pn.length ? thaiOf(pn[0]) : 'พัก' });
        total += Number(n.d) || 0;
      }
      it.notes = outNotes;
      if (!notes.length) warnings.push('ยังไม่มีโน้ต');
      else if (validateMeter(meter)) {
        bpb = beatsPerBar(meter); rem = Math.round((total % bpb) * 1000) / 1000;
        if (rem > 1e-6 && Math.abs(rem - bpb) > 1e-6) warnings.push('ห้องสุดท้ายไม่ครบ ' + bpb + ' จังหวะ (รวม ' + total + ' จังหวะ) — ถ้าเป็นห้องเปิดเพลง/ท้ายเพลงให้ข้ามได้');
      }
    }
    it.id = id; it.period = period; it.grade = String(r.grade || 'M1'); it.title = title;
    it.kind = r.kind === 'exercise' || r.kind === 'explore' ? r.kind : 'song';
    it.meter = meter;
    it.bpm = { start: start, min: 30, max: 200 };
    if (bpm && typeof bpm === 'object' && Number(bpm.target) >= 30 && Number(bpm.target) <= 200) it.bpm.target = Number(bpm.target);
    it.source = r.source ? String(r.source).slice(0, 300) : 'ครูผู้สอนใส่เอง';
    if (r.note) it.note = String(r.note).slice(0, 500);
    if (r.testPool) it.testPool = String(r.testPool);
    it.updatedAt = r.updatedAt || null;
    return { ok: errors.length === 0, errors: errors, warnings: warnings, item: it };
  }

  /* ---------- รวม override เข้ากับรายการที่สร้างไว้ (pure) ---------- */
  function overlay(base, ov) {
    var o = clone(base);
    o.title = ov.title || o.title; o.kind = ov.kind || o.kind; o.meter = ov.meter || o.meter;
    o.notes = clone(ov.notes); o.noteCount = o.notes.length;
    var b = 0, i; for (i = 0; i < o.notes.length; i++) b += o.notes[i].d; o.beats = b;
    var oldBpm = o.bpm || {};
    o.bpm = { start: ov.bpm.start, min: oldBpm.min || 30, max: oldBpm.max || 200 };
    if (ov.bpm.target) o.bpm.target = ov.bpm.target; else if (oldBpm.target) o.bpm.target = oldBpm.target;
    if (oldBpm.docRange) o.bpm.docRange = oldBpm.docRange;
    o.status = o.notes.length ? 'ok' : 'missing';
    delete o.partial; delete o.unverified; delete o.missing; delete o.draft;
    o.provenance = 'teacher'; o.teacherNotes = true;
    o.source = ov.source || o.source;
    o.assumptions = []; o.gaps = [];
    if (ov.note) o.assumptions.push('หมายเหตุครู: ' + ov.note);
    if (!o.notes.length) o.missing = EMPTY_MSG;
    return o;
  }
  function fromOverride(ov) {
    var o = overlay({ id: ov.id, period: ov.period, kind: ov.kind, title: ov.title, source: ov.source, meter: ov.meter, notes: [], bpm: { min: 30, max: 200 }, assumptions: [], gaps: [] }, ov);
    return o;
  }
  /** list = รายการที่สร้างไว้ของคาบหนึ่ง, ovs = รายการ override (หลายคาบก็ได้ กรองตาม period เอง) */
  function mergeItems(list, ovs, period) {
    var out = (list || []).slice(), used = {}, i, j, ov;
    for (i = 0; i < out.length; i++) {
      for (j = 0; j < (ovs || []).length; j++) {
        ov = ovs[j];
        if (ov.id === out[i].id && Number(ov.period) === Number(period)) { out[i] = overlay(out[i], ov); used[ov.id] = true; break; }
      }
    }
    for (j = 0; j < (ovs || []).length; j++) {
      ov = ovs[j];
      if (!used[ov.id] && Number(ov.period) === Number(period) && !hasId(list, ov.id)) out.push(fromOverride(ov));
    }
    for (i = 0; i < out.length; i++) {
      if (!out[i].notes || !out[i].notes.length) { out[i].status = 'missing'; if (!out[i].missing) out[i].missing = EMPTY_MSG; }
    }
    return out;
  }
  function hasId(list, id) { var i; for (i = 0; i < (list || []).length; i++) if (list[i].id === id) return true; return false; }

  /* ---------- ที่เก็บในเครื่อง ---------- */
  var mem = {};
  var storage = null;
  function ls() {
    if (storage) return storage;
    try { if (root.localStorage) return root.localStorage; } catch (e) {}
    return { getItem: function (k) { return mem.hasOwnProperty(k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  }
  function load() {
    var raw = null, o;
    try { raw = ls().getItem(KEY); } catch (e) {}
    if (!raw) return { version: 1, items: {} };
    try { o = JSON.parse(raw); } catch (e2) { return { version: 1, items: {} }; }
    if (!o || typeof o !== 'object' || !o.items || typeof o.items !== 'object') return { version: 1, items: {} };
    return o;
  }
  function save(o) { ls().setItem(KEY, JSON.stringify(o)); try { if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('ppk-kalimba-notes-changed')); } catch (e) {} return true; }
  function list() { var o = load(), k = keysOf(o.items), r = [], i; for (i = 0; i < k.length; i++) r.push(o.items[k[i]]); r.sort(function (a, b) { return a.period - b.period || (a.id < b.id ? -1 : 1); }); return r; }
  function get(id) { return load().items[id] || null; }
  function setItem(raw, tines) {
    var v = validateItem(raw, tines);
    if (!v.ok) return v;
    v.item.updatedAt = new Date().toISOString();
    var o = load(); o.items[v.item.id] = v.item; save(o);
    return v;
  }
  function removeItem(id) { var o = load(); if (!o.items[id]) return false; delete o.items[id]; save(o); return true; }
  function getItemsFor(gradeKey, period, base) {
    var all = list(), mine = [], i;
    for (i = 0; i < all.length; i++) if ((all[i].grade || 'M1') === (gradeKey || 'M1')) mine.push(all[i]);
    return mergeItems(base, mine, period);
  }

  /* ---------- JSON ส่งออก/นำเข้า ---------- */
  function exportObject() { return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), items: list() }; }
  function exportJSON() { return JSON.stringify(exportObject(), null, 2); }
  /** คืน { added, updated, rejected:[{id,errors}] } ; ถ้ามี item ที่ผิด จะข้ามเฉพาะรายการนั้น */
  function importJSON(text, tines) {
    var o, res = { added: 0, updated: 0, rejected: [], error: null }, i, v, had;
    try { o = JSON.parse(text); } catch (e) { res.error = 'ไฟล์ไม่ใช่ JSON ที่อ่านได้'; return res; }
    var arr = o && (isArr(o) ? o : o.items);
    if (!isArr(arr) || (o && !isArr(o) && o.format && o.format !== FORMAT)) { res.error = 'รูปแบบไฟล์ไม่ใช่ ' + FORMAT; return res; }
    for (i = 0; i < arr.length; i++) {
      v = validateItem(arr[i], tines);
      if (!v.ok) { res.rejected.push({ id: (arr[i] && arr[i].id) || ('#' + (i + 1)), errors: v.errors }); continue; }
      had = !!get(v.item.id);
      v.item.updatedAt = (arr[i] && arr[i].updatedAt) || new Date().toISOString();
      var st = load(); st.items[v.item.id] = v.item; save(st);
      if (had) res.updated++; else res.added++;
    }
    return res;
  }
  /** สำหรับ builder (node): ตรวจไฟล์ที่ครูส่งออก คืน {items, rejected} */
  function parsePublishFile(text, tines) {
    var o = JSON.parse(text), arr = isArr(o) ? o : (o.items || []), items = [], rejected = [], i, v;
    for (i = 0; i < arr.length; i++) { v = validateItem(arr[i], tines); if (v.ok) { v.item.updatedAt = arr[i].updatedAt || null; items.push(v.item); } else rejected.push({ id: arr[i] && arr[i].id, errors: v.errors }); }
    return { items: items, rejected: rejected };
  }

  var API = {
    KEY: KEY, FORMAT: FORMAT, EMPTY_MSG: EMPTY_MSG, VALID_DURATIONS: VALID_D, DEFAULT_TINES: DEFAULT_TINES,
    parseScore: parseScore, toScore: toScore, thaiOf: thaiOf, tokenPitch: tokenPitch, beatsPerBar: beatsPerBar,
    validateItem: validateItem, mergeItems: mergeItems, getItemsFor: getItemsFor,
    load: load, list: list, get: get, setItem: setItem, removeItem: removeItem,
    exportObject: exportObject, exportJSON: exportJSON, importJSON: importJSON, parsePublishFile: parsePublishFile,
    _useStorage: function (s) { storage = s; }
  };
  root.KalimbaNotes = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
