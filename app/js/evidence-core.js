// ==========================================================================
// EvidenceCore — ตรรกะล้วน (ไม่แตะ DOM/Store) ของศูนย์หลักฐาน คศ.4
// ใช้ได้ทั้งในเบราว์เซอร์และ node (สำหรับ tests) • เขียนแบบ ES5 เพื่อมือถือรุ่นเก่า
// หลักการ: ไม่แต่งตัวเลข — ไม่มีข้อมูล = คืน null/ตัวแทน "[ครูระบุ: …]" ไม่ใช่ค่าเดา
// ==========================================================================
(function (root) {
  'use strict';
  var PH = function (t) { return '[ครูระบุ: ' + t + ']'; };
  var NODATA = function (t) { return '[ยังไม่มีข้อมูล: ' + t + ']'; };

  // ---------- helpers ----------
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function num(x) { if (x === null || x === undefined || x === '') return null; var n = Number(x); return isFinite(n) ? n : null; }
  function round(x, d) { if (!isNum(x)) return null; var m = Math.pow(10, d === undefined ? 2 : d); return Math.round(x * m) / m; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mean(a) { if (!a.length) return null; var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function sd(a) { if (a.length < 2) return null; var m = mean(a), s = 0, i; for (i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return Math.sqrt(s / (a.length - 1)); }
  function uniq(a) { var o = [], i; for (i = 0; i < a.length; i++) if (o.indexOf(a[i]) < 0) o.push(a[i]); return o; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** คาบ 1-20 ไม่ซ้ำ เรียงจากน้อยไปมาก (ไม่รับค่าอื่น) */
  function cleanPeriods(a) {
    var o = [], i, n;
    for (i = 0; i < a.length; i++) { n = Number(a[i]); if (n >= 1 && n <= 20 && Math.floor(n) === n && o.indexOf(n) < 0) o.push(n); }
    return o.sort(function (x, y) { return x - y; });
  }
  /** ตรวจเงื่อนไขก่อนบันทึกคลิป/ภาพที่มีนักเรียน: อยู่ในช่วงคาบ + นักเรียนทุกคนมีความยินยอม (ไม่มีฟังก์ชันตรวจ = ถือว่าไม่มีความยินยอม) */
  function clipGate(cfg, period, studentIds, consentOf) {
    var win = (cfg && cfg.clip && cfg.clip.periods) || [], ids = Array.isArray(studentIds) ? studentIds : [], missing = [], i;
    var p = (period === '' || period === null || period === undefined) ? null : Number(period);
    for (i = 0; i < ids.length; i++) { var okc = false; try { okc = typeof consentOf === 'function' && consentOf(ids[i]) === true; } catch (e) {} if (!okc) missing.push(ids[i]); }
    return { inWindow: p !== null && win.indexOf(p) >= 0, hasStudents: ids.length > 0, missing: missing, ok: p !== null && win.indexOf(p) >= 0 && ids.length > 0 && !missing.length };
  }

  function mergeConfig(defaults, saved) {
    var out = clone(defaults);
    if (!saved || typeof saved !== 'object') return out;
    ['alignmentLabel', 'satisfactionCriterion'].forEach(function (k) { if (saved[k] !== undefined && saved[k] !== '') out[k] = saved[k]; });
    // ชื่อเดิมที่เคยเป็นค่าเริ่มต้น และครูยังไม่ได้ยืนยัน → ใช้ค่าเป็นกลางแทน (ไม่ให้ค่าตั้งต้นเก่าค้างเป็น "ชื่อทางการ")
    out.alignmentLabelConfirmed = saved.alignmentLabelConfirmed === true;
    if (!out.alignmentLabelConfirmed && saved.alignmentLabel === out.alignmentLabelTeacherWording) out.alignmentLabel = defaults.alignmentLabel;
    if (saved.clip && typeof saved.clip === 'object' && Array.isArray(saved.clip.periods)) out.clip.periods = cleanPeriods(saved.clip.periods);
    out.clip.requireConsent = true; // ต้องมีความยินยอมเสมอ — ปรับได้เฉพาะช่วงคาบ
    ['target', 'criterion', 'measure', 'dossier', 'consent'].forEach(function (k) { if (saved[k] && typeof saved[k] === 'object') { for (var x in saved[k]) out[k][x] = saved[k][x]; } });
    ['pathways', 'kinds', 'likertBands', 'designs'].forEach(function (k) { if (Array.isArray(saved[k]) && saved[k].length) out[k] = clone(saved[k]); });
    if (saved.checklist && typeof saved.checklist === 'object') { for (var p in saved.checklist) if (Array.isArray(saved.checklist[p])) out.checklist[p] = clone(saved.checklist[p]); }
    if (saved.questionnaire && typeof saved.questionnaire === 'object') {
      var q = saved.questionnaire;
      if (q.title) out.questionnaire.title = q.title;
      if (isNum(q.scaleMin)) out.questionnaire.scaleMin = q.scaleMin;
      if (isNum(q.scaleMax)) out.questionnaire.scaleMax = q.scaleMax;
      if (Array.isArray(q.dims) && q.dims.length) out.questionnaire.dims = clone(q.dims);
      if (Array.isArray(q.items) && q.items.length) out.questionnaire.items = clone(q.items);
      if (Array.isArray(q.openQuestions)) out.questionnaire.openQuestions = clone(q.openQuestions);
    }
    if (saved.pseudoSalt) out.pseudoSalt = saved.pseudoSalt;
    return out;
  }

  // ---------- SHA-256 (sync, pure JS) สำหรับรหัสแทนตัวตน ----------
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8Bytes(str) { var b = [], i, c; str = unescape(encodeURIComponent(String(str))); for (i = 0; i < str.length; i++) { c = str.charCodeAt(i); b.push(c); } return b; }
  function sha256Hex(str) {
    var m = utf8Bytes(str), l = m.length * 8, i, j;
    m.push(0x80); while ((m.length % 64) !== 56) m.push(0);
    var hi = Math.floor(l / 4294967296), lo = l >>> 0;
    m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < m.length; i += 64) {
      var w = [], a, b, c, d, e, f, g, h, t1, t2;
      for (j = 0; j < 16; j++) w[j] = (m[i + 4 * j] << 24) | (m[i + 4 * j + 1] << 16) | (m[i + 4 * j + 2] << 8) | m[i + 4 * j + 3];
      for (j = 16; j < 64; j++) { var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3); var s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0; }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (j = 0; j < 64; j++) {
        t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K256[j] + w[j]) | 0;
        t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = ''; for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }
  function newSalt() {
    var s = '', i;
    try { if (root.crypto && root.crypto.getRandomValues) { var u = new Uint8Array(16); root.crypto.getRandomValues(u); for (i = 0; i < u.length; i++) s += ('0' + u[i].toString(16)).slice(-2); return s; } } catch (e) {}
    for (i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s + sha256Hex(String(Date.now())).slice(0, 8);
  }
  function pseudonym(studentId, salt) { return 'S' + sha256Hex(String(salt) + '|' + String(studentId)).slice(0, 8).toUpperCase(); }

  // ---------- สถิติ ----------
  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, t = x + 5.5, s = 1.000000000190015, j;
    t -= (x + 0.5) * Math.log(t);
    for (j = 0; j < 6; j++) { y += 1; s += c[j] / y; }
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function betacf(a, b, x) {
    var MAXIT = 300, EPS = 3e-12, FPMIN = 1e-300, m, m2, aa, del, h, c, d, qab = a + b, qap = a + 1, qam = a - 1;
    c = 1; d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; h = d;
    for (m = 1; m <= MAXIT; m++) {
      m2 = 2 * m; aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  /** p-value สองทาง ของ t ที่ df */
  function tTwoTailP(t, df) { if (!isNum(t) || !(df > 0)) return null; return ibeta(df / (df + t * t), df / 2, 0.5); }
  /** ค่าวิกฤต t (สองทาง) ที่ระดับนัยสำคัญ alpha */
  function tCrit(df, alpha) {
    var lo = 0, hi = 1000, mid, i; alpha = alpha || 0.05;
    for (i = 0; i < 200; i++) { mid = (lo + hi) / 2; if (tTwoTailP(mid, df) > alpha) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /** paired t-test: pre/post เป็นอาร์เรย์ความยาวเท่ากัน (เฉพาะคนที่มีครบทั้งสองจุด) */
  function pairedStats(pre, post, maxScale) {
    var n = Math.min(pre.length, post.length), i, d = [], a = [], b = [];
    for (i = 0; i < n; i++) { if (isNum(pre[i]) && isNum(post[i])) { a.push(pre[i]); b.push(post[i]); d.push(post[i] - pre[i]); } }
    n = d.length;
    var r = { n: n, meanPre: null, meanPost: null, sdPre: null, sdPost: null, meanDiff: null, sdDiff: null, t: null, df: null, p: null, dz: null, dav: null, ci95: null, gain: null, note: '' };
    if (n === 0) { r.note = 'ไม่มีนักเรียนที่มีข้อมูลทั้งก่อนและหลัง'; return r; }
    r.meanPre = mean(a); r.meanPost = mean(b); r.meanDiff = mean(d);
    var mx = isNum(maxScale) ? maxScale : null;
    if (mx !== null && mx - r.meanPre > 0) r.gain = (r.meanPost - r.meanPre) / (mx - r.meanPre);
    if (n < 2) { r.note = 'ต้องมีอย่างน้อย 2 คนจึงคำนวณ t-test ได้'; return r; }
    r.sdPre = sd(a); r.sdPost = sd(b); r.sdDiff = sd(d); r.df = n - 1;
    if (r.sdDiff === 0) { r.note = 'ผลต่างทุกคนเท่ากัน (SD=0) จึงคำนวณ t และ d ไม่ได้'; return r; }
    r.t = r.meanDiff / (r.sdDiff / Math.sqrt(n));
    r.p = tTwoTailP(r.t, r.df);
    r.dz = r.meanDiff / r.sdDiff;
    var avgSd = (r.sdPre + r.sdPost) / 2; if (avgSd > 0) r.dav = r.meanDiff / avgSd;
    var tc = tCrit(r.df, 0.05), se = r.sdDiff / Math.sqrt(n); r.ci95 = [r.meanDiff - tc * se, r.meanDiff + tc * se];
    if (n < 30) r.note = 'n < 30: ตรวจสมมติฐานการแจกแจงของผลต่างก่อนใช้ t-test (เสริมด้วยการพิจารณาข้อมูลดิบ)';
    return r;
  }
  function effectLabel(d) { if (!isNum(d)) return ''; var a = Math.abs(d); return a < 0.2 ? 'น้อยมาก' : a < 0.5 ? 'น้อย' : a < 0.8 ? 'ปานกลาง' : 'มาก'; }
  function gainLabel(g) { if (!isNum(g)) return ''; return g >= 0.7 ? 'สูง' : g >= 0.3 ? 'ปานกลาง' : 'ต่ำ'; }
  function fmt(x, d) { return isNum(x) ? String(round(x, d === undefined ? 2 : d)) : '–'; }
  function fmtP(p) { if (!isNum(p)) return '–'; return p < 0.001 ? '< .001' : String(round(p, 3)); }

  // ---------- ข้อมูลระดับ K/P/A ----------
  // rows: [{id, className, period, K, P, A}] ระดับ 1–4 หรือ null (ไม่ประเมินด้านนั้น)
  var DIMS = ['K', 'P', 'A'];
  function rowValue(row, dim) {
    if (dim === 'ALL') { var v = [], i, x; for (i = 0; i < 3; i++) { x = num(row[DIMS[i]]); if (x !== null) v.push(x); } return v.length ? mean(v) : null; }
    return num(row[dim]);
  }
  /** ค่าต่อนักเรียนของ "จุดวัด" (ชุดคาบ) = เฉลี่ยค่าของคาบที่มีข้อมูล */
  function measurePoint(rows, periods, dim) {
    var by = {}, out = {}, i, r, v;
    for (i = 0; i < rows.length; i++) {
      r = rows[i]; if (periods.indexOf(Number(r.period)) < 0) continue;
      v = rowValue(r, dim); if (v === null) continue;
      (by[r.id] = by[r.id] || []).push(v);
    }
    for (var id in by) out[id] = mean(by[id]);
    return out;
  }
  function periodsWithData(rows) {
    var by = {}, i, r;
    for (i = 0; i < rows.length; i++) { r = rows[i]; if (rowValue(r, 'ALL') !== null) { by[r.period] = (by[r.period] || 0) + 1; } }
    return Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (p) { return { period: p, n: by[p] }; });
  }
  /** เลือกจุดก่อน/หลัง: auto = คาบแรก/คาบสุดท้ายที่มีข้อมูล ≥ minN คน */
  function pickPoints(rows, cfg, minN) {
    var m = cfg.measure || {}, pw = periodsWithData(rows).filter(function (x) { return x.n >= (minN || 2); });
    if (m.mode === 'periods') {
      var b = (m.baselinePeriods || []).map(Number), a = (m.afterPeriods || []).map(Number);
      return { mode: 'periods', baseline: b, after: a, ok: b.length > 0 && a.length > 0, reason: (b.length && a.length) ? '' : 'ยังไม่ได้เลือกคาบก่อน/หลัง' };
    }
    if (pw.length < 2) return { mode: 'auto', baseline: [], after: [], ok: false, reason: 'ต้องมีข้อมูลระดับอย่างน้อย 2 คาบ (ขณะนี้ ' + pw.length + ' คาบ)' };
    return { mode: 'auto', baseline: [pw[0].period], after: [pw[pw.length - 1].period], ok: true, reason: '' };
  }
  function passes(value, cfg) { return isNum(value) && value >= (cfg.criterion.level - 1e-9); }
  function pctAt(values, cfg) {
    var n = values.length, c = 0, i; if (!n) return { n: 0, count: 0, pct: null, met: null };
    for (i = 0; i < n; i++) if (passes(values[i], cfg)) c++;
    var pct = c / n * 100;
    return { n: n, count: c, pct: pct, met: pct >= cfg.criterion.pct };
  }
  /** เปรียบเทียบก่อน–หลัง ต่อ K/P/A/ALL */
  function compare(rows, cfg, points) {
    var res = { points: points, dims: {}, n: 0 };
    if (!points || !points.ok) return res;
    ['K', 'P', 'A', 'ALL'].forEach(function (dim) {
      var pre = measurePoint(rows, points.baseline, dim), post = measurePoint(rows, points.after, dim), ids = [], id;
      for (id in pre) if (post[id] !== undefined) ids.push(id);
      var a = ids.map(function (k) { return pre[k]; }), b = ids.map(function (k) { return post[k]; });
      var st = pairedStats(a, b, cfg.criterion.maxLevel);
      st.pctBefore = pctAt(a, cfg); st.pctAfter = pctAt(b, cfg);
      st.effectLabel = effectLabel(st.dz); st.gainLabel = gainLabel(st.gain);
      st.ids = ids; st.pre = a; st.post = b;
      res.dims[dim] = st;
    });
    res.n = res.dims.ALL.n;
    return res;
  }
  /** สรุปรายคาบ */
  function perPeriod(rows, cfg) {
    return periodsWithData(rows).map(function (pw) {
      var o = { period: pw.period, n: pw.n, dims: {} };
      ['K', 'P', 'A', 'ALL'].forEach(function (dim) {
        var m = measurePoint(rows, [pw.period], dim), vals = [], id;
        for (id in m) vals.push(m[id]);
        var pc = pctAt(vals, cfg);
        o.dims[dim] = { n: vals.length, mean: mean(vals), sd: sd(vals), count: pc.count, pct: pc.pct, met: pc.met };
      });
      return o;
    });
  }

  // ---------- CSV / ZIP ----------
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(headers, rows) {
    var out = [headers.map(csvCell).join(',')], i;
    for (i = 0; i < rows.length; i++) out.push(rows[i].map(csvCell).join(','));
    return out.join('\r\n') + '\r\n';
  }
  /** CSV รายคนแบบไม่ระบุตัวตน — ไม่มีชื่อ ไม่มีรหัสนักเรียนจริง */
  function researchCSV(rows, cfg, salt, points, className) {
    var cmp = compare(rows, cfg, points), d = cmp.dims.ALL || { ids: [] }, i, out = [];
    function lv(map, id) { return map[id] === undefined ? '' : round(map[id], 2); }
    var maps = {};
    ['K', 'P', 'A', 'ALL'].forEach(function (dim) { maps[dim] = { pre: measurePoint(rows, points.baseline, dim), post: measurePoint(rows, points.after, dim) }; });
    var ids = {}, id;
    ['K', 'P', 'A', 'ALL'].forEach(function (dim) { for (id in maps[dim].pre) ids[id] = 1; for (id in maps[dim].post) ids[id] = 1; });
    var list = Object.keys(ids).map(function (x) { return { id: x, p: pseudonym(x, salt) }; }).sort(function (a, b) { return a.p < b.p ? -1 : 1; });
    for (i = 0; i < list.length; i++) {
      id = list[i].id;
      var pre = maps.ALL.pre[id], post = maps.ALL.post[id];
      out.push([list[i].p, className || '', lv(maps.K.pre, id), lv(maps.K.post, id), lv(maps.P.pre, id), lv(maps.P.post, id), lv(maps.A.pre, id), lv(maps.A.post, id),
        lv(maps.ALL.pre, id), lv(maps.ALL.post, id), (pre !== undefined && post !== undefined) ? round(post - pre, 2) : '',
        post !== undefined ? (passes(post, cfg) ? 1 : 0) : '']);
    }
    return toCSV(['รหัสแทนตัวตน', 'ห้อง', 'K_ก่อน', 'K_หลัง', 'P_ก่อน', 'P_หลัง', 'A_ก่อน', 'A_หลัง', 'รวม_ก่อน', 'รวม_หลัง', 'ผลต่าง', 'ถึงเกณฑ์ระดับ_หลัง(1/0)'], out);
  }
  function summaryCSV(cmp, cfg, className) {
    var rows = [], names = { K: 'K ความรู้', P: 'P ทักษะ', A: 'A เจตคติ', ALL: 'รวม K/P/A' };
    ['K', 'P', 'A', 'ALL'].forEach(function (dim) {
      var s = cmp.dims[dim]; if (!s) return;
      rows.push([className || '', names[dim], s.n, round(s.meanPre, 3), round(s.sdPre, 3), round(s.meanPost, 3), round(s.sdPost, 3), round(s.meanDiff, 3), round(s.sdDiff, 3), round(s.t, 3), s.df, round(s.p, 4), round(s.dz, 3), round(s.dav, 3), s.ci95 ? round(s.ci95[0], 3) : '', s.ci95 ? round(s.ci95[1], 3) : '', round(s.gain, 3), s.pctBefore.pct === null ? '' : round(s.pctBefore.pct, 1), s.pctAfter.pct === null ? '' : round(s.pctAfter.pct, 1), cfg.criterion.pct, s.pctAfter.met === null ? '' : (s.pctAfter.met ? 'ผ่าน' : 'ไม่ผ่าน')]);
    });
    return toCSV(['ห้อง', 'ด้าน', 'n', 'mean_ก่อน', 'SD_ก่อน', 'mean_หลัง', 'SD_หลัง', 'mean_diff', 'SD_diff', 't', 'df', 'p(2ทาง)', 'Cohen_dz', 'Cohen_dav', 'CI95_low', 'CI95_high', 'normalized_gain', '%ถึงเกณฑ์_ก่อน', '%ถึงเกณฑ์_หลัง', 'เกณฑ์%', 'ผลเทียบเกณฑ์'], rows);
  }
  function periodCSV(pp, cfg, className) {
    var rows = pp.map(function (o) {
      var r = [className || '', o.period, o.n];
      ['K', 'P', 'A', 'ALL'].forEach(function (dim) { var x = o.dims[dim]; r.push(x.mean === null ? '' : round(x.mean, 3), x.pct === null ? '' : round(x.pct, 1)); });
      r.push(cfg.criterion.pct); r.push(o.dims.ALL.met === null ? '' : (o.dims.ALL.met ? 'ผ่าน' : 'ไม่ผ่าน'));
      return r;
    });
    return toCSV(['ห้อง', 'คาบ', 'n', 'K_mean', 'K_%ถึงเกณฑ์', 'P_mean', 'P_%ถึงเกณฑ์', 'A_mean', 'A_%ถึงเกณฑ์', 'รวม_mean', 'รวม_%ถึงเกณฑ์', 'เกณฑ์%', 'ผลเทียบเกณฑ์(รวม)'], rows);
  }

  // ZIP แบบ store (ไม่บีบอัด) — ไม่ต้องพึ่งไลบรารี
  var CRC_T = null;
  function crc32(b) {
    if (!CRC_T) { CRC_T = []; for (var n = 0, c, k; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC_T[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF, i; for (i = 0; i < b.length; i++) crc = CRC_T[(crc ^ b[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {
    var parts = [], central = [], offset = 0, i;
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    for (i = 0; i < files.length; i++) {
      var nameB = utf8Bytes(files[i].name), data = typeof files[i].content === 'string' ? utf8Bytes(files[i].content) : files[i].content, crc = crc32(data);
      var head = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), nameB);
      parts.push(head, data);
      central.push([0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameB));
      offset += head.length + data.length;
    }
    var cd = [], cdLen = 0; for (i = 0; i < central.length; i++) { cd.push(central[i]); cdLen += central[i].length; }
    var end = [0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(offset), u16(0));
    var all = parts.concat(cd, [end]), total = 0; for (i = 0; i < all.length; i++) total += all[i].length;
    var out = new Uint8Array(total), pos = 0, j;
    for (i = 0; i < all.length; i++) { for (j = 0; j < all[i].length; j++) out[pos++] = all[i][j]; }
    return out;
  }
  function withBOM(s) { return '\uFEFF' + s; }

  // ---------- SVG กราฟ ----------
  var COL = { pre: '#94a3b8', post: '#2563eb', ok: '#16a34a', bad: '#dc2626', line: '#f59e0b', txt: '#334155' };
  function barChartBeforeAfter(cmp, width, height) {
    width = width || 320; height = height || 180;
    var dims = ['K', 'P', 'A', 'ALL'], names = { K: 'K', P: 'P', A: 'A', ALL: 'รวม' }, maxV = 4, left = 28, bottom = 26, top = 14, W = width - left - 8, H = height - bottom - top, g = W / dims.length, s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="100%" role="img" aria-label="ค่าเฉลี่ยระดับก่อนและหลัง">'];
    var y = function (v) { return top + H - (v / maxV) * H; }, i, t;
    for (t = 0; t <= maxV; t++) s.push('<line x1="' + left + '" x2="' + (width - 8) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="#e2e8f0"/><text x="' + (left - 4) + '" y="' + (y(t) + 3) + '" font-size="9" text-anchor="end" fill="' + COL.txt + '">' + t + '</text>');
    for (i = 0; i < dims.length; i++) {
      var st = cmp.dims[dims[i]], x0 = left + i * g + g * 0.12, bw = g * 0.34;
      if (st && isNum(st.meanPre)) {
        s.push('<rect x="' + x0 + '" y="' + y(st.meanPre) + '" width="' + bw + '" height="' + (top + H - y(st.meanPre)) + '" fill="' + COL.pre + '"/><text x="' + (x0 + bw / 2) + '" y="' + (y(st.meanPre) - 2) + '" font-size="9" text-anchor="middle" fill="' + COL.txt + '">' + fmt(st.meanPre) + '</text>');
        s.push('<rect x="' + (x0 + bw + 2) + '" y="' + y(st.meanPost) + '" width="' + bw + '" height="' + (top + H - y(st.meanPost)) + '" fill="' + COL.post + '"/><text x="' + (x0 + bw * 1.5 + 2) + '" y="' + (y(st.meanPost) - 2) + '" font-size="9" text-anchor="middle" fill="' + COL.txt + '">' + fmt(st.meanPost) + '</text>');
      } else s.push('<text x="' + (left + i * g + g / 2) + '" y="' + (top + H / 2) + '" font-size="9" text-anchor="middle" fill="#94a3b8">ไม่มีข้อมูล</text>');
      s.push('<text x="' + (left + i * g + g / 2) + '" y="' + (height - 10) + '" font-size="10" text-anchor="middle" fill="' + COL.txt + '">' + names[dims[i]] + '</text>');
    }
    s.push('<rect x="' + left + '" y="1" width="8" height="8" fill="' + COL.pre + '"/><text x="' + (left + 11) + '" y="9" font-size="9" fill="' + COL.txt + '">ก่อน</text><rect x="' + (left + 46) + '" y="1" width="8" height="8" fill="' + COL.post + '"/><text x="' + (left + 57) + '" y="9" font-size="9" fill="' + COL.txt + '">หลัง</text></svg>');
    return s.join('');
  }
  function barChartPctPeriods(pp, cfg, width, height) {
    width = width || 320; height = height || 180;
    var left = 28, bottom = 26, top = 14, W = width - left - 8, H = height - bottom - top, n = pp.length, g = n ? W / n : W, s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="100%" role="img" aria-label="ร้อยละนักเรียนที่ถึงเกณฑ์รายคาบ">'];
    var y = function (v) { return top + H - (v / 100) * H; }, i, t;
    for (t = 0; t <= 100; t += 25) s.push('<line x1="' + left + '" x2="' + (width - 8) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="#e2e8f0"/><text x="' + (left - 4) + '" y="' + (y(t) + 3) + '" font-size="9" text-anchor="end" fill="' + COL.txt + '">' + t + '</text>');
    if (!n) s.push('<text x="' + (width / 2) + '" y="' + (height / 2) + '" font-size="11" text-anchor="middle" fill="#94a3b8">ยังไม่มีข้อมูลรายคาบ</text>');
    for (i = 0; i < n; i++) {
      var v = pp[i].dims.ALL.pct, bw = Math.min(g * 0.7, 26), x0 = left + i * g + (g - bw) / 2;
      if (isNum(v)) s.push('<rect x="' + x0 + '" y="' + y(v) + '" width="' + bw + '" height="' + (top + H - y(v)) + '" fill="' + (v >= cfg.criterion.pct ? COL.ok : COL.bad) + '"/><text x="' + (x0 + bw / 2) + '" y="' + (y(v) - 2) + '" font-size="8" text-anchor="middle" fill="' + COL.txt + '">' + Math.round(v) + '</text>');
      s.push('<text x="' + (x0 + bw / 2) + '" y="' + (height - 10) + '" font-size="9" text-anchor="middle" fill="' + COL.txt + '">' + pp[i].period + '</text>');
    }
    s.push('<line x1="' + left + '" x2="' + (width - 8) + '" y1="' + y(cfg.criterion.pct) + '" y2="' + y(cfg.criterion.pct) + '" stroke="' + COL.line + '" stroke-width="1.5" stroke-dasharray="4 3"/><text x="' + (width - 10) + '" y="' + (y(cfg.criterion.pct) - 3) + '" font-size="9" text-anchor="end" fill="' + COL.line + '">เกณฑ์ ' + cfg.criterion.pct + '%</text></svg>');
    return s.join('');
  }

  // ---------- แบบสอบถามความพึงพอใจ ----------
  function likertLabel(m, cfg) {
    if (!isNum(m)) return '–'; var b = cfg.likertBands.slice().sort(function (a, c) { return c.min - a.min; }), i;
    for (i = 0; i < b.length; i++) if (m >= b[i].min - 1e-9) return b[i].label; return b[b.length - 1].label;
  }
  /** responses: [{answers:{q1:5,...}, comments:{...}}] — ไม่มีชื่อ/รหัสจริง */
  function scoreQuestionnaire(cfg, responses) {
    var q = cfg.questionnaire, items = q.items, lo = q.scaleMin, hi = q.scaleMax, res = { n: responses.length, items: [], dims: [], overall: null, invalid: 0 };
    var valid = [], i, j;
    for (i = 0; i < responses.length; i++) {
      var ok = true, a = responses[i].answers || {};
      for (j = 0; j < items.length; j++) { var v = num(a[items[j].id]); if (v !== null && (v < lo || v > hi || Math.floor(v) !== v)) ok = false; }
      if (ok) valid.push(responses[i]); else res.invalid++;
    }
    res.nValid = valid.length;
    var allDim = {};
    items.forEach(function (it) {
      var vals = valid.map(function (r) { return num((r.answers || {})[it.id]); }).filter(function (x) { return x !== null; });
      var m = mean(vals); (allDim[it.dim] = allDim[it.dim] || []).push({ vals: vals, m: m });
      res.items.push({ id: it.id, dim: it.dim, text: it.text, n: vals.length, mean: m, sd: sd(vals), label: likertLabel(m, cfg) });
    });
    var overallMeans = [];
    q.dims.forEach(function (d) {
      var its = res.items.filter(function (x) { return x.dim === d.id && x.mean !== null; });
      var m = its.length ? mean(its.map(function (x) { return x.mean; })) : null;
      // SD ของคะแนนเฉลี่ยรายคนในด้านนั้น
      var per = valid.map(function (r) { var v = items.filter(function (it) { return it.dim === d.id; }).map(function (it) { return num((r.answers || {})[it.id]); }).filter(function (x) { return x !== null; }); return v.length ? mean(v) : null; }).filter(function (x) { return x !== null; });
      res.dims.push({ id: d.id, label: d.label, n: per.length, mean: m, sd: sd(per), label2: likertLabel(m, cfg) });
      if (m !== null) overallMeans.push(m);
    });
    var perAll = valid.map(function (r) { var v = items.map(function (it) { return num((r.answers || {})[it.id]); }).filter(function (x) { return x !== null; }); return v.length ? mean(v) : null; }).filter(function (x) { return x !== null; });
    res.overall = perAll.length ? { n: perAll.length, mean: mean(perAll), sd: sd(perAll), label: likertLabel(mean(perAll), cfg), met: mean(perAll) >= cfg.satisfactionCriterion } : null;
    return res;
  }
  function questionnaireCSV(cfg, responses) {
    var items = cfg.questionnaire.items, heads = ['ลำดับ(ไม่ระบุตัวตน)'].concat(items.map(function (i) { return i.id; })).concat(cfg.questionnaire.openQuestions.map(function (_, k) { return 'ข้อเสนอแนะ' + (k + 1); }));
    var rows = responses.map(function (r, idx) { return [idx + 1].concat(items.map(function (i) { return num((r.answers || {})[i.id]) === null ? '' : r.answers[i.id]; })).concat(cfg.questionnaire.openQuestions.map(function (_, k) { return (r.comments || [])[k] || ''; })); });
    return toCSV(heads, rows);
  }
  function questionnaireSummaryCSV(cfg, sc) {
    var rows = sc.items.map(function (i) { return [i.id, i.dim, i.text, i.n, round(i.mean, 3), round(i.sd, 3), i.label]; });
    sc.dims.forEach(function (d) { rows.push(['DIM_' + d.id, d.id, d.label, d.n, round(d.mean, 3), round(d.sd, 3), d.label2]); });
    if (sc.overall) rows.push(['OVERALL', '', 'ภาพรวม', sc.overall.n, round(sc.overall.mean, 3), round(sc.overall.sd, 3), sc.overall.label]);
    return toCSV(['รหัส', 'ด้าน', 'ข้อความ', 'n', 'mean', 'SD', 'แปลผล'], rows);
  }
  function questionnaireText(cfg) {
    var q = cfg.questionnaire, L = ['# ' + q.title, '', '**คำชี้แจง:** โปรดทำเครื่องหมายระดับความพึงพอใจ (' + q.scaleMin + ' = น้อยที่สุด … ' + q.scaleMax + ' = มากที่สุด) การตอบไม่มีผลต่อคะแนนวิชา และไม่ต้องใส่ชื่อ', ''];
    q.dims.forEach(function (d) {
      L.push('## ' + d.label, '', '| ข้อ | ข้อความ | ' + Array.apply(null, Array(q.scaleMax - q.scaleMin + 1)).map(function (_, i) { return q.scaleMin + i; }).join(' | ') + ' |', '|---|---|' + Array.apply(null, Array(q.scaleMax - q.scaleMin + 1)).map(function () { return '---'; }).join('|') + '|');
      q.items.filter(function (i) { return i.dim === d.id; }).forEach(function (i) { L.push('| ' + i.id + ' | ' + i.text + ' | ' + Array.apply(null, Array(q.scaleMax - q.scaleMin + 1)).map(function () { return '☐'; }).join(' | ') + ' |'); });
      L.push('');
    });
    q.openQuestions.forEach(function (t, k) { L.push((k + 1) + '. ' + t + ': ________________________________'); });
    return L.join('\n') + '\n';
  }

  // ---------- หลักฐาน ----------
  function validateItem(it, cfg, consentOf) {
    var errs = [];
    if (!it || typeof it !== 'object') return ['ข้อมูลไม่ถูกต้อง'];
    if (!String(it.title || '').trim()) errs.push('ต้องมีชื่อหลักฐาน');
    var pw = (cfg.pathways || []).map(function (p) { return p.id; });
    var mine = Array.isArray(it.pathways) ? it.pathways.filter(function (p) { return pw.indexOf(p) >= 0; }) : [];
    if (!mine.length) errs.push('ต้องผูกอย่างน้อย 1 เส้นทาง (ผลสัมฤทธิ์/นวัตกรรม/วิจัย/PA/ให้คำปรึกษา)');
    if (!(cfg.kinds || []).some(function (k) { return k.id === it.kind; })) errs.push('ต้องเลือกชนิดหลักฐาน');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(it.date || ''))) errs.push('ต้องมีวันที่ (ปปปป-ดด-วว)');
    if (!String(it.source || '').trim()) errs.push('ต้องระบุแหล่งที่มา');
    if (it.period !== null && it.period !== undefined && it.period !== '' && !(Number(it.period) >= 1)) errs.push('คาบต้องเป็นตัวเลข');
    if (it.studentClip === true) {
      if (it.kind !== 'photo' && it.kind !== 'video') errs.push('คลิป/ภาพที่มีนักเรียนต้องเลือกชนิด ภาพถ่าย หรือ วิดีโอ/เสียง');
      var g = clipGate(cfg, it.period, it.studentIds, consentOf);
      if (!g.hasStudents) errs.push('ต้องระบุนักเรียนที่ปรากฏในคลิป/ภาพอย่างน้อย 1 คน');
      if (!g.inWindow) errs.push('คาบนี้อยู่นอกช่วงเก็บคลิปที่ตั้งไว้ (' + ((cfg.clip && cfg.clip.periods) || []).join(', ') + ') — ครูปรับช่วงได้ในหน้าตั้งค่า');
      if (g.missing.length) errs.push('ยังไม่มีความยินยอม PDPA/ผู้ปกครองของนักเรียน: ' + g.missing.join(', ') + ' — บันทึกคลิป/ภาพไม่ได้จนกว่าจะมีความยินยอม');
    }
    return errs;
  }
  function normalizeItem(it, cfg) {
    return { id: it.id, title: String(it.title || '').trim(), pathways: uniq(it.pathways || []), kind: it.kind, date: it.date,
      period: (it.period === '' || it.period === null || it.period === undefined) ? null : Number(it.period), className: it.className || '',
      source: String(it.source || '').trim(), link: String(it.link || '').trim(), note: String(it.note || '').trim(), checklist: it.checklist || '',
      studentClip: it.studentClip === true, studentIds: it.studentClip === true && Array.isArray(it.studentIds) ? uniq(it.studentIds.map(String)) : [],
      alignment: it.alignment || cfg.alignmentLabel, createdAt: it.createdAt || '', auto: !!it.auto };
  }
  /** ตารางหลักฐานต่อเส้นทาง: เก็บแล้ว/ขาด ตาม checklist */
  function buildBoard(cfg, items) {
    return cfg.pathways.map(function (pw) {
      var mine = items.filter(function (i) { return (i.pathways || []).indexOf(pw.id) >= 0; });
      var defs = cfg.checklist[pw.id] || [];
      // หลักฐานที่ไม่ระบุข้อตรวจ นับให้ "ข้อแรกที่ชนิดตรงกัน" เพียงข้อเดียว (กันนับซ้ำเกินจริง); ระบุข้อตรวจเองได้เสมอ
      var firstFor = function (i) { for (var k = 0; k < defs.length; k++) { if ((defs[k].kinds || []).indexOf(i.kind) >= 0) return defs[k].id; } return null; };
      var list = defs.map(function (c) {
        var m = mine.filter(function (i) { return i.checklist === c.id || ((!i.checklist) && !i.auto && firstFor(i) === c.id); });
        var min = Number(c.min) || 1;
        return { id: c.id, label: c.label, hint: c.hint || '', kinds: c.kinds || [], min: min, have: m.length, ok: m.length >= min, items: m };
      });
      var okN = list.filter(function (x) { return x.ok; }).length;
      return { id: pw.id, label: pw.label, total: list.length, collected: okN, pct: list.length ? Math.round(okN / list.length * 100) : 0, items: mine, checklist: list,
        missing: list.filter(function (x) { return !x.ok; }) };
    });
  }
  function evidenceCSV(items, cfg) {
    var pn = {}; cfg.pathways.forEach(function (p) { pn[p.id] = p.label; }); var kn = {}; cfg.kinds.forEach(function (k) { kn[k.id] = k.label; });
    return toCSV(['วันที่', 'ชื่อหลักฐาน', 'เส้นทาง', 'ชนิด', 'คาบ', 'ห้อง', 'แหล่งที่มา', 'ลิงก์/ที่เก็บ', 'ป้ายสอดคล้อง', 'หมายเหตุ', 'อัตโนมัติ'],
      items.map(function (i) { return [i.date, i.title, (i.pathways || []).map(function (p) { return pn[p] || p; }).join(' | '), kn[i.kind] || i.kind, i.period === null ? '' : i.period, i.className, i.source, i.link, i.alignment, i.note, i.auto ? 'ใช่' : '']; }));
  }
  function boardMarkdown(cfg, board, only) {
    var L = ['# ดัชนีหลักฐาน — ' + cfg.alignmentLabel, '', 'เป้าหมาย: ' + cfg.target.position + ' (ปัจจุบัน ' + cfg.target.current + ') • เกณฑ์อ้างอิง ' + cfg.target.rule, ''];
    board.filter(function (b) { return !only || only === b.id; }).forEach(function (b) {
      L.push('## ' + b.label + ' — เก็บแล้ว ' + b.collected + '/' + b.total + ' รายการ', '');
      b.checklist.forEach(function (c) { L.push('- ' + (c.ok ? '[x]' : '[ ]') + ' ' + c.label + ' (' + c.have + '/' + c.min + ')' + (c.ok ? '' : (c.hint ? ' — ต้องเพิ่ม: ' + c.hint : ' — ต้องเพิ่ม'))); });
      L.push('', '**หลักฐานที่ผูกกับเส้นทางนี้ (' + b.items.length + ')**', '');
      b.items.forEach(function (i) { L.push('- ' + i.date + ' • ' + i.title + ' • แหล่งที่มา: ' + i.source + (i.link ? ' • ' + i.link : '')); });
      if (!b.items.length) L.push('- (ยังไม่มี)');
      L.push('');
    });
    return L.join('\n');
  }

  // ---------- เอกสารนวัตกรรม ----------
  function buildDossier(ctx) {
    var cfg = ctx.cfg, d = cfg.dossier || {}, f = function (v, hint) { return String(v || '').trim() ? String(v).trim() : PH(hint); };
    var o = ctx.outcome, L = [];
    L.push('# ' + f(d.innovationName, 'ชื่อนวัตกรรมการสอน'), '', '> ร่างเอกสาร — สร้างจากข้อมูลในแอป ณ วันที่ ' + (ctx.today || PH('วันที่')) + ' • ป้ายสอดคล้อง: ' + cfg.alignmentLabel + ' • ข้อความ [ครูระบุ …] / [ยังไม่มีข้อมูล …] ต้องกรอกเองก่อนใช้', '');
    L.push('**ผู้พัฒนา:** ' + f(d.owner, 'ชื่อ-ตำแหน่ง') + '  ', '**สถานศึกษา:** ' + f(d.school, 'โรงเรียน') + '  ', '**วิชา/ระดับชั้น:** ' + f(d.subject, 'รหัสวิชา/ชื่อวิชา/ชั้น') + '  ', '**ตำแหน่งที่ขอ:** ' + cfg.target.position + ' (หลักเกณฑ์ ' + cfg.target.rule + ')', '');
    L.push('## 1. ที่มาและสภาพปัญหา', '', f(d.problem, 'สภาพปัญหาที่พบในห้องเรียน พร้อมข้อมูลสนับสนุน'), '');
    L.push('## 2. วัตถุประสงค์', '', f(d.objectives, 'วัตถุประสงค์ (ควรสอดคล้องกับตัวชี้วัดและเกณฑ์ ' + cfg.criterion.pct + '% ที่ระดับ ' + cfg.criterion.level + ' ขึ้นไป)'), '');
    L.push('## 3. แนวคิด/ทฤษฎีที่ใช้', '', f(d.concept, 'แนวคิด ทฤษฎี และงานวิจัยที่เกี่ยวข้อง'), '');
    L.push('## 4. ลักษณะนวัตกรรมและขั้นตอนการใช้', '', f(d.steps, 'ขั้นตอนการใช้นวัตกรรม'), '', '**เครื่องมือ/สื่อ:** ' + f(d.tools, 'รายการสื่อ/เครื่องมือ'), '');
    if (ctx.facts) {
      L.push('**ข้อมูลจากแอปที่ตรวจสอบได้:**', '');
      Object.keys(ctx.facts).forEach(function (k) { L.push('- ' + k + ': ' + ctx.facts[k]); });
      L.push('');
    }
    L.push('## 5. กลุ่มเป้าหมายและเครื่องมือเก็บข้อมูล', '');
    L.push(o && o.n ? ('- จำนวนนักเรียนที่มีข้อมูลก่อน–หลังครบ (ห้อง ' + (ctx.className || PH('ห้อง')) + '): n = ' + o.n) : '- ' + NODATA('จำนวนนักเรียนที่มีข้อมูลก่อน–หลัง'));
    L.push('- เครื่องมือ: ระดับคุณภาพ K/P/A 4 ระดับตาม วก.5 (ความถี่ในการประเมินตามแผน), แบบสอบถามความพึงพอใจ ' + (ctx.questionnaire && ctx.questionnaire.nValid ? '' : '(' + NODATA('ยังไม่มีผู้ตอบ') + ')'), '');
    L.push('## 6. ผลการใช้นวัตกรรม', '');
    if (o && o.n && o.dims.ALL && o.dims.ALL.t !== null) {
      var A = o.dims.ALL;
      L.push('ตาราง: ระดับเฉลี่ยก่อน–หลัง (ช่วงคาบก่อน: ' + o.points.baseline.join(',') + ' • ช่วงคาบหลัง: ' + o.points.after.join(',') + ')', '', '| ด้าน | n | ก่อน (M, SD) | หลัง (M, SD) | ผลต่าง | t (df) | p | Cohen dz | gain |', '|---|---|---|---|---|---|---|---|---|');
      [['K', 'K'], ['P', 'P'], ['A', 'A'], ['ALL', 'รวม']].forEach(function (x) { var s = o.dims[x[0]]; if (s && s.n) L.push('| ' + x[1] + ' | ' + s.n + ' | ' + fmt(s.meanPre) + ', ' + fmt(s.sdPre) + ' | ' + fmt(s.meanPost) + ', ' + fmt(s.sdPost) + ' | ' + fmt(s.meanDiff) + ' | ' + fmt(s.t) + ' (' + (s.df === null ? '–' : s.df) + ') | ' + fmtP(s.p) + ' | ' + fmt(s.dz) + ' | ' + fmt(s.gain) + ' |'); });
      L.push('', 'นักเรียนที่ถึงระดับ ' + cfg.criterion.level + ' ขึ้นไป (รวม K/P/A): ก่อน ' + (A.pctBefore.pct === null ? '–' : fmt(A.pctBefore.pct, 1) + '%') + ' → หลัง ' + (A.pctAfter.pct === null ? '–' : fmt(A.pctAfter.pct, 1) + '%') + ' (เกณฑ์ ' + cfg.criterion.pct + '%: ' + (A.pctAfter.met ? 'ผ่าน' : 'ไม่ผ่าน') + ')', '');
    } else L.push(NODATA('ยังไม่มีข้อมูลก่อน–หลังที่ครบพอ — บันทึกระดับ K/P/A รายคาบ แล้วกลับมาสร้างเอกสารใหม่'), '');
    var qs = ctx.questionnaire;
    L.push('**ความพึงพอใจ:** ' + (qs && qs.overall ? 'ค่าเฉลี่ยรวม ' + fmt(qs.overall.mean) + ' (SD ' + fmt(qs.overall.sd) + ') แปลผล "' + qs.overall.label + '" (n = ' + qs.overall.n + ')' : NODATA('ยังไม่มีผลแบบสอบถาม')), '');
    L.push('## 7. การเผยแพร่และขยายผล', '', f(d.dissemination, 'หลักฐานการเผยแพร่/ขยายผล/ให้คำปรึกษาผู้อื่น'), '');
    L.push('## 8. ข้อจำกัดและข้อเสนอแนะ', '', PH('ข้อจำกัดของการวิจัย/นวัตกรรมและข้อเสนอแนะ'), '');
    L.push('## ภาคผนวก: ดัชนีหลักฐาน', '');
    (ctx.items || []).forEach(function (i) { L.push('- ' + i.date + ' • ' + i.title + ' • ' + i.source); });
    if (!(ctx.items || []).length) L.push('- ' + NODATA('ยังไม่มีหลักฐานที่บันทึก'));
    return L.join('\n') + '\n';
  }
  function markdownToHtml(md) {
    var lines = md.split('\n'), out = ['<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>เอกสาร</title><style>body{font-family:"TH Sarabun New",Sarabun,Tahoma,sans-serif;font-size:16pt;line-height:1.4}table{border-collapse:collapse}td,th{border:1px solid #444;padding:3px 6px}</style></head><body>'], i, inList = false, inTable = false;
    function inl(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
    for (i = 0; i < lines.length; i++) {
      var l = lines[i], m;
      if (inList && !/^- /.test(l)) { out.push('</ul>'); inList = false; }
      if (inTable && !/^\|/.test(l)) { out.push('</table>'); inTable = false; }
      if ((m = /^(#{1,3}) (.*)$/.exec(l))) out.push('<h' + m[1].length + '>' + inl(m[2]) + '</h' + m[1].length + '>');
      else if (/^\|[-| ]+\|$/.test(l)) continue;
      else if (/^\|/.test(l)) { if (!inTable) { out.push('<table>'); inTable = true; } out.push('<tr>' + l.replace(/^\||\|$/g, '').split('|').map(function (c) { return '<td>' + inl(c.trim()) + '</td>'; }).join('') + '</tr>'); }
      else if (/^- /.test(l)) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inl(l.slice(2)) + '</li>'); }
      else if (/^> /.test(l)) out.push('<blockquote>' + inl(l.slice(2)) + '</blockquote>');
      else if (l.trim()) out.push('<p>' + inl(l) + '</p>');
    }
    if (inList) out.push('</ul>'); if (inTable) out.push('</table>');
    out.push('</body></html>'); return out.join('\n');
  }

  // ---------- ชุดวิจัย ----------
  function designMarkdown(cfg) {
    var L = ['# ทางเลือกรูปแบบการวิจัย', '', 'ข้อมูลนี้เป็นแนวทางประกอบการตัดสินใจ ไม่ใช่ผลวิจัย ครูต้องเลือกและอธิบายเหตุผลในโครงร่างเอง', ''];
    cfg.designs.forEach(function (x, i) { L.push('## ' + (i + 1) + '. ' + x.label, '', '- เหมาะเมื่อ: ' + x.use, '- ข้อมูลที่ต้องมี: ' + x.data, '- การวิเคราะห์: ' + x.analysis, '- ข้อควรระวัง: ' + x.caution, '- แอปช่วยได้: ' + x.appSupport, ''); });
    return L.join('\n');
  }
  function consentDraft(cfg) {
    var c = cfg.consent || {}, f = function (v, h) { return String(v || '').trim() ? v : PH(h); };
    return ['# ร่างหนังสือขอความยินยอมเข้าร่วมการวิจัย (ฉบับร่าง)', '',
      '> **ฉบับร่างเพื่อประกอบการพิจารณาเท่านั้น** ไม่ใช่เอกสารที่ผ่านการรับรองด้านจริยธรรม ต้องให้ผู้บริหารสถานศึกษา/คณะกรรมการที่เกี่ยวข้องตรวจและปรับถ้อยคำก่อนใช้จริง และต้องสอดคล้องกับ พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) โดยเฉพาะข้อมูลของผู้เยาว์', '',
      '## ส่วนที่ 1 สำหรับผู้ปกครอง', '', 'เรียน ผู้ปกครองของนักเรียน', '',
      'ข้าพเจ้า ' + f(c.researcherName, 'ชื่อผู้วิจัย') + ' ตำแหน่งครู สังกัด ' + f(c.school, 'โรงเรียน') + ' ขออนุญาตให้บุตรหลานของท่านเข้าร่วมการวิจัยเรื่อง "' + f(c.title, 'ชื่อเรื่องวิจัย') + '"', '',
      '1. **วัตถุประสงค์:** ' + PH('อธิบายวัตถุประสงค์ด้วยภาษาที่ผู้ปกครองเข้าใจง่าย'),
      '2. **สิ่งที่นักเรียนจะทำ:** ทำกิจกรรมการเรียนตามปกติ และตอบแบบสอบถามความพึงพอใจ (ใช้เวลาประมาณ ' + PH('นาที') + ')',
      '3. **ข้อมูลที่เก็บ:** ระดับผลการเรียนรู้รายคาบ และคำตอบแบบสอบถาม — ข้อมูลที่นำไปรายงานจะ**ไม่ระบุชื่อ**นักเรียน ใช้รหัสแทนตัวตน และไม่เผยแพร่ภาพ/เสียงที่ระบุตัวตนได้ เว้นแต่ได้รับความยินยอมแยกต่างหาก',
      '4. **การเก็บรักษาข้อมูล:** ' + f(c.dataRetention, 'สถานที่/ระยะเวลาเก็บ และผู้เข้าถึงข้อมูล'),
      '5. **ความเสี่ยง/ประโยชน์:** ' + PH('ระบุความเสี่ยงที่อาจเกิดขึ้น (ถ้ามี) และประโยชน์'),
      '6. **การไม่เข้าร่วม/ถอนตัว:** การไม่ยินยอมหรือถอนตัวไม่มีผลต่อคะแนน เกรด หรือการเรียนของนักเรียนแต่อย่างใด และสามารถขอให้ลบข้อมูลของบุตรหลานได้',
      '7. **ติดต่อสอบถาม:** ' + f(c.contact, 'ช่องทางติดต่อผู้วิจัย'), '',
      (c.ethicsRef ? 'อ้างอิงการพิจารณา: ' + c.ethicsRef : 'อ้างอิงการพิจารณา: ' + PH('หมายเลข/หน่วยงานที่พิจารณา (ถ้ามี)')), '',
      '☐ ยินยอมให้บุตรหลานเข้าร่วม  ☐ ไม่ยินยอม', '', 'ลงชื่อผู้ปกครอง ........................................  วันที่ ....../....../......', '',
      '## ส่วนที่ 2 ความเห็นชอบของนักเรียน (Assent)', '', 'ครูอธิบายว่ากำลังทำอะไร นักเรียนมีสิทธิ์เลือกไม่ร่วมหรือหยุดได้ทุกเมื่อโดยไม่มีผลต่อคะแนน', '',
      '☐ ฉันเข้าใจและยินดีเข้าร่วม  ☐ ฉันไม่ต้องการเข้าร่วม', '', 'ลงชื่อนักเรียน ........................................  วันที่ ....../....../......', ''].join('\n');
  }
  function methodNote(cfg, cmp, salted) {
    var L = ['# หมายเหตุวิธีการวิเคราะห์ (Method note)', '',
      '> สร้างจากการตั้งค่าปัจจุบัน — ไม่มีผลลัพธ์/ตัวเลขการวิจัยในส่วนนี้', '',
      '## ข้อมูล', '', '- ระดับคุณภาพ K (ความรู้) P (ทักษะ) A (เจตคติ) ระดับ 1–' + cfg.criterion.maxLevel + ' ที่ครูบันทึกรายคาบตาม วก.5 (การประเมินโดยครู ณ ห้องเรียน)',
      '- จุดก่อน–หลัง: ' + (cfg.measure.mode === 'periods' ? 'ครูเลือกคาบเอง' : 'อัตโนมัติ = คาบแรกและคาบสุดท้ายที่มีข้อมูลของห้อง') + (cmp && cmp.points && cmp.points.ok ? ' (ก่อน: คาบ ' + cmp.points.baseline.join(',') + '; หลัง: คาบ ' + cmp.points.after.join(',') + ')' : ''),
      '- ถ้าจุดวัดมีหลายคาบ ใช้ค่าเฉลี่ยของคาบที่มีข้อมูลต่อคน; ค่า "รวม" = เฉลี่ยของด้านที่ประเมินในคาบนั้น',
      '- ข้อมูลที่ขาด: ตัดออกเป็นรายคู่ (pairwise) — วิเคราะห์เฉพาะนักเรียนที่มีทั้งก่อนและหลัง; ไม่ใส่ค่าแทน/ไม่เดาค่า', '',
      '## สถิติ', '', '- paired t-test สองทาง, df = n − 1; p-value จากการแจกแจง t (ไม่ใช้ตารางประมาณ)', '- ขนาดอิทธิพล: Cohen\'s dz = ค่าเฉลี่ยผลต่าง ÷ SD ของผลต่าง; รายงาน d_av = ผลต่างเฉลี่ย ÷ ค่าเฉลี่ยของ SD ก่อนและหลัง ด้วย',
      '- normalized gain (Hake) = (หลัง − ก่อน) ÷ (' + cfg.criterion.maxLevel + ' − ก่อน) จากค่าเฉลี่ยกลุ่ม',
      '- ร้อยละที่ถึงเกณฑ์: นักเรียนที่ค่าระดับ ≥ ' + cfg.criterion.level + ' เทียบเกณฑ์ ' + cfg.criterion.pct + '% ของห้อง (กฎ: ' + (cfg.criterion.passRule === 'all' ? 'ทุกด้านที่ประเมินต้อง ≥ เกณฑ์' : 'ใช้ค่าเฉลี่ยของด้านที่ประเมิน') + ')',
      '- ความพึงพอใจ: ค่าเฉลี่ย Likert ' + cfg.questionnaire.scaleMin + '–' + cfg.questionnaire.scaleMax + ' แปลผลตามช่วงที่ตั้งไว้; เกณฑ์ผ่านเฉลี่ย ≥ ' + cfg.satisfactionCriterion, '',
      '## การคุ้มครองข้อมูล', '', '- ไฟล์ส่งออกเพื่อวิจัยใช้ "รหัสแทนตัวตน" (SHA-256 พร้อมเกลือสุ่มเฉพาะเครื่อง) ไม่มีชื่อ-นามสกุลและไม่มีรหัสนักเรียนจริง', '- ตารางจับคู่รหัสแทนตัวตนกับตัวตนจริงเก็บเฉพาะในเครื่องของครู ไม่รวมในชุดส่งออก',
      '- ข้อมูลทั้งหมดอยู่ในเครื่อง (localStorage) ไม่ส่งออกอินเทอร์เน็ต เว้นแต่ครูดาวน์โหลดไฟล์เอง', '',
      '## ข้อจำกัดที่ต้องเขียนในรายงาน', '', '- ผู้ประเมินคือครูผู้สอน (อาจมีอคติของผู้ประเมิน) ควรอธิบายแนวทางลดอคติ เช่น ใช้เกณฑ์ระดับคุณภาพที่กำหนดล่วงหน้าใน วก.5',
      '- ถ้าไม่มีกลุ่มควบคุม สรุปเชิงสาเหตุไม่ได้ ควรใช้คำว่า "พัฒนาการ/ความแตกต่างก่อน–หลัง"', '- n เล็ก (< 30) ควรตรวจการแจกแจงของผลต่าง', ''];
    return L.join('\n');
  }
  function pathwayReport(cfg, board) {
    var map = [
      ['outcome', 'หน้า "ผลสัมฤทธิ์": ก่อน–หลัง K/P/A, ร้อยละถึงเกณฑ์, t-test, Cohen d, gain, กราฟ, CSV', 'ครูต้องบันทึกระดับ K/P/A รายคาบให้ครบ และเลือกคาบก่อน–หลังให้ตรงแผน'],
      ['innovation', 'หน้า "เอกสารนวัตกรรม": ร่างเอกสารจากข้อมูลจริงในแอป + ตัวแทน [ครูระบุ]', 'ครูต้องกรอกที่มา แนวคิด ขั้นตอน IOC ผู้เชี่ยวชาญ ภาพ/วิดีโอการใช้จริง'],
      ['research', 'หน้า "ชุดวิจัย": ทางเลือกรูปแบบวิจัย, แบบสอบถามพร้อมคิดคะแนน, ส่งออกรายห้อง, ร่างหนังสือยินยอม, หมายเหตุวิธีวิเคราะห์', 'ครูต้องเลือกแบบวิจัย ขอความเห็นชอบ/ผ่านผู้บริหาร เก็บข้อมูลจริง เขียนรายงาน เผยแพร่'],
      ['pa', 'หน้า "กระดานหลักฐาน": รายการตรวจ PA (ข้อตกลง วิธีดำเนินการ ผลเชิงปริมาณ/คุณภาพ ผลงานวิชาการ)', 'ครูต้องจัดทำข้อตกลง PA และผลงานทางวิชาการ 1 รายการ (PDF) ตามหลักเกณฑ์ฉบับจริง'],
      ['mentoring', 'หน้า "กระดานหลักฐาน": บันทึกหลักฐานการให้คำปรึกษา/PLC/เผยแพร่', 'ครูต้องเก็บหลักฐานภายนอกแอป (คำสั่ง เกียรติบัตร บันทึกประชุม) แล้วลงทะเบียนในกระดาน']
    ];
    var L = ['# รายงาน: เส้นทางผลงาน คศ.4 → ฟีเจอร์ในแอป → สิ่งที่ครูต้องเตรียม', ''];
    map.forEach(function (m) { var b = board.filter(function (x) { return x.id === m[0]; })[0]; L.push('## ' + (b ? b.label : m[0]), '', '- ฟีเจอร์: ' + m[1], '- ครูต้องเตรียม: ' + m[2], '- สถานะหลักฐานตอนนี้: ' + (b ? b.collected + '/' + b.total + ' รายการตรวจ' : '–'), ''); });
    return L.join('\n');
  }

  var API = {
    PH: PH, NODATA: NODATA, mergeConfig: mergeConfig, sha256Hex: sha256Hex, newSalt: newSalt, pseudonym: pseudonym,
    mean: mean, sd: sd, tTwoTailP: tTwoTailP, tCrit: tCrit, pairedStats: pairedStats, effectLabel: effectLabel, gainLabel: gainLabel, fmt: fmt, fmtP: fmtP, round: round,
    rowValue: rowValue, measurePoint: measurePoint, periodsWithData: periodsWithData, pickPoints: pickPoints, pctAt: pctAt, compare: compare, perPeriod: perPeriod,
    toCSV: toCSV, researchCSV: researchCSV, summaryCSV: summaryCSV, periodCSV: periodCSV, zipStore: zipStore, withBOM: withBOM, crc32: crc32,
    barChartBeforeAfter: barChartBeforeAfter, barChartPctPeriods: barChartPctPeriods,
    likertLabel: likertLabel, scoreQuestionnaire: scoreQuestionnaire, questionnaireCSV: questionnaireCSV, questionnaireSummaryCSV: questionnaireSummaryCSV, questionnaireText: questionnaireText,
    clipGate: clipGate, cleanPeriods: cleanPeriods, validateItem: validateItem, normalizeItem: normalizeItem, buildBoard: buildBoard, evidenceCSV: evidenceCSV, boardMarkdown: boardMarkdown,
    buildDossier: buildDossier, markdownToHtml: markdownToHtml, designMarkdown: designMarkdown, consentDraft: consentDraft, methodNote: methodNote, pathwayReport: pathwayReport, esc: esc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.EvidenceCore = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
