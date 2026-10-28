/* kalimba-practice.js — ES5 · (1) บันทึกการฝึกเล่นตาม (จำนวนครั้ง, BPM ที่ทำได้) เป็น "ข้อมูลประกอบ" เท่านั้น — ไม่ให้คะแนนอัตโนมัติ
 *                          (2) คาบ 7: จับลวดลายสอบปฏิบัติแบบสุ่ม 1 ใน N (N = 12 ตาม วก.5) ต่อนักเรียน (กำหนดแน่นอนจากรหัสนักเรียน → ครูคำนวณซ้ำได้โดยไม่ต้องซิงก์) + ครูสุ่มใหม่/กำหนดเองได้
 * คะแนนคาบ 7 (4 คะแนน) ครูให้เองตามเกณฑ์เดิม (rubric เดียวกันทุกลวดลาย) */
(function (root) {
  'use strict';
  var KEY_LOG = 'ppk_kalimba_practice', KEY_P7 = 'ppk_kalimba_p7';
  var SALT = 'musicsmart-p7-pattern-v1'; // เกลือสำหรับสุ่มลวดลายเท่านั้น ไม่เกี่ยวกับรหัสผ่าน
  var storage = null, mem = {};
  function ls() {
    if (storage) return storage;
    try { if (root.localStorage) return root.localStorage; } catch (e) {}
    return { getItem: function (k) { return mem.hasOwnProperty(k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); } };
  }
  function read(k) { var r = null, o; try { r = ls().getItem(k); } catch (e) {} if (!r) return {}; try { o = JSON.parse(r); } catch (e2) { return {}; } return (o && typeof o === 'object') ? o : {}; }
  function write(k, o) { ls().setItem(k, JSON.stringify(o)); }
  function keyOf(ctx, itemId) { return [ctx.className || '', ctx.studentId || '', ctx.period, itemId].join('|'); }
  function nowIso() { return new Date().toISOString(); }

  /** บันทึกว่าเล่นตามจนจบหนึ่งรอบที่ BPM นี้ */
  function log(ctx, itemId, bpm) {
    if (!ctx || !ctx.studentId || !itemId) return null;
    var o = read(KEY_LOG), k = keyOf(ctx, itemId), r = o[k] || { className: ctx.className || '', studentId: String(ctx.studentId), period: Number(ctx.period), itemId: itemId, plays: 0, bestBpm: 0, firstAt: nowIso() };
    bpm = Math.round(Number(bpm) || 0);
    r.plays += 1; r.lastBpm = bpm; r.lastAt = nowIso(); if (bpm > r.bestBpm) r.bestBpm = bpm;
    o[k] = r; write(KEY_LOG, o); return r;
  }
  function get(ctx, itemId) { return read(KEY_LOG)[keyOf(ctx, itemId)] || null; }
  function rows(filter) {
    var o = read(KEY_LOG), out = [], k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) {
      if (filter && ((filter.className && o[k].className !== filter.className) || (filter.period && o[k].period !== Number(filter.period)))) continue;
      out.push(o[k]);
    }
    out.sort(function (a, b) { return a.period - b.period || (a.studentId < b.studentId ? -1 : 1); });
    return out;
  }
  function summaryText(ctx, itemId) {
    var r = get(ctx, itemId);
    return r ? ('ฝึกเล่นตามแล้ว ' + r.plays + ' ครั้ง · BPM สูงสุดที่เล่นจบ ' + r.bestBpm) : 'ยังไม่ได้ฝึกเล่นตามในรายการนี้';
  }
  function csvCell(v) { v = String(v === undefined || v === null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(filter) {
    var r = rows(filter), out = ['\uFEFFห้อง,รหัสนักเรียน,คาบ,รายการ,จำนวนครั้งที่ฝึก,BPM สูงสุด,ครั้งล่าสุด (UTC)'], i;
    for (i = 0; i < r.length; i++) out.push([r[i].className, r[i].studentId, r[i].period, r[i].itemId, r[i].plays, r[i].bestBpm, r[i].lastAt].map(csvCell).join(','));
    return out.join('\r\n');
  }

  /* ---------- คาบ 7: ลวดลายสอบแบบสุ่ม ---------- */
  function fnv(str) { var h = 0x811c9dc5, i; for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h >>> 0; }
  function p7Key(ctx) { return (ctx.className || '') + '|' + ctx.studentId; }
  /** itemIds = รายการลวดลาย (เรียงคงที่) → { itemId, index, source:'auto'|'teacher' } */
  function assignPattern(ctx, itemIds) {
    if (!ctx || !ctx.studentId || !itemIds || !itemIds.length) return null;
    var ov = read(KEY_P7)[p7Key(ctx)], i;
    if (ov) for (i = 0; i < itemIds.length; i++) if (itemIds[i] === ov.itemId) return { itemId: ov.itemId, index: i, source: 'teacher' };
    i = fnv(SALT + '|' + p7Key(ctx) + '|' + ctx.period) % itemIds.length;
    return { itemId: itemIds[i], index: i, source: 'auto' };
  }
  function setPatternOverride(ctx, itemId) { var o = read(KEY_P7); o[p7Key(ctx)] = { itemId: itemId, at: nowIso() }; write(KEY_P7, o); }
  function clearPatternOverride(ctx) { var o = read(KEY_P7); delete o[p7Key(ctx)]; write(KEY_P7, o); }
  function p7Rows(className, students, itemIds, period) {
    var out = [], i, sid, a;
    for (i = 0; i < (students || []).length; i++) {
      sid = students[i].id;
      a = assignPattern({ className: className, studentId: sid, period: period || 7 }, itemIds);
      out.push({ className: className, studentId: sid, name: students[i].name || '', patternNo: a ? a.index + 1 : '', itemId: a ? a.itemId : '', source: a ? a.source : '' });
    }
    return out;
  }
  function p7CSV(rowsIn) {
    var out = ['\uFEFFห้อง,รหัสนักเรียน,ชื่อ,ลวดลายที่,รหัสรายการ,ที่มา'], i, r;
    for (i = 0; i < rowsIn.length; i++) { r = rowsIn[i]; out.push([r.className, r.studentId, r.name, r.patternNo, r.itemId, r.source === 'teacher' ? 'ครูกำหนด' : 'สุ่มอัตโนมัติ'].map(csvCell).join(',')); }
    return out.join('\r\n');
  }
  /** ดึงรายชื่อห้องจาก Store (รูปแบบฟิลด์อาจต่างกัน — รองรับหลายชื่อ) */
  function studentsOf(className) {
    var list = [];
    try { list = (root.Store && root.Store.getStudents) ? (root.Store.getStudents(className) || []) : []; } catch (e) { list = []; }
    var out = [], i, s;
    for (i = 0; i < list.length; i++) {
      s = list[i] || {};
      out.push({ id: String(s.id || s.student_id || s.studentId || s.code || ''), name: s.name || s.fullname || s.full_name || ((s.firstname || '') + ' ' + (s.lastname || '')) });
    }
    return out.filter(function (x) { return x.id; });
  }

  var API = {
    KEY_LOG: KEY_LOG, KEY_P7: KEY_P7, log: log, get: get, rows: rows, summaryText: summaryText, toCSV: toCSV,
    assignPattern: assignPattern, setPatternOverride: setPatternOverride, clearPatternOverride: clearPatternOverride,
    p7Rows: p7Rows, p7CSV: p7CSV, studentsOf: studentsOf,
    exportAll: function () { return { log: read(KEY_LOG), p7: read(KEY_P7) }; },
    _useStorage: function (s) { storage = s; }
  };
  root.KalimbaPractice = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
