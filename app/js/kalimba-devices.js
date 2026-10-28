/* ============================================================================
 * kalimba-devices.js — หมายเลขเครื่องคาลิมบ้า รายนักเรียน รายคาบ
 *  - นักเรียนกรอกเอง (local-first) → เก็บใน localStorage คีย์ ppk_kalimba_devices
 *  - ซิงค์: คีย์นี้ถูกรวมใน Store.collectExtendedAssessmentData() (extendedAssessments) และ
 *    ตอนส่งงานบนมือถือนักเรียน จะแนบมาร์กเกอร์ [[เครื่องคาลิมบ้า:N]] ท้ายเนื้อหางาน (ไม่ต้องแก้เซิร์ฟเวอร์)
 *  - ครู: ดู/ค้นหา/แก้ไข/ส่งออก CSV/ดูประวัติการแก้ไข (audit) และตั้งช่วงหมายเลขเครื่องได้เอง
 *  - ไม่มีจำนวนเครื่องฮาร์ดโค้ด: ช่วงเริ่มต้นคำนวณจากจำนวนนักเรียนในห้อง จนกว่าครูจะตั้งค่าเอง
 *  - ES5 ล้วน (มือถือรุ่นเก่า)
 * ============================================================================ */
(function (root) {
  'use strict';

  var KEY = 'ppk_kalimba_devices';
  /** ค่าพิเศษ: เครื่องที่ไม่มีหมายเลขติดอยู่ (นักเรียนระบุเองได้) */
  var NO_NUMBER = 'ไม่มีเลข';
  var MARK_RE = /\n?\[\[เครื่องคาลิมบ้า:([^\]\n]{1,16})\]\]\s*$/;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nowIso() { return new Date().toISOString(); }

  var KD = {
    KEY: KEY,
    /** ผู้ให้ข้อมูลรายชื่อ (ทดสอบ/ที่อื่น override ได้) */
    provider: {
      classes: function () {
        try { if (root.Store && root.Store.getAllClasses) return root.Store.getAllClasses('M1') || []; } catch (e) {}
        return [];
      },
      students: function (className) {
        try { if (root.Store && root.Store.getStudents) return root.Store.getStudents(className) || []; } catch (e) {}
        return [];
      }
    },

    _load: function () {
      var db = null;
      try {
        if (root.Store && root.Store.load) db = root.Store.load(KEY, null);
        else if (root.localStorage) { var raw = root.localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : null; }
      } catch (e) { db = null; }
      if (!db || typeof db !== 'object') db = {};
      if (!db.config) db.config = { mode: 'range', from: 1, to: 60, list: [] };
      if (!db.records) db.records = {};
      db.version = 1;
      return db;
    },
    _save: function (db) {
      try {
        if (root.Store && root.Store.save) root.Store.save(KEY, db);
        else if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(db));
      } catch (e) { return false; }
      return true;
    },

    /* ---------- ตั้งค่าช่วงหมายเลขเครื่อง (ครูกำหนดเอง) ---------- */
    getConfig: function () { return this._load().config; },
    setConfig: function (cfg) {
      var db = this._load(), c = db.config;
      if (cfg.mode === 'list') {
        var arr = (cfg.list || []).map(function (x) { return KD.normalize(x); }).filter(function (x) { return x; });
        c.mode = 'list'; c.list = arr;
      } else {
        var f = parseInt(cfg.from, 10), t = (cfg.to === null || cfg.to === '' || cfg.to === undefined) ? null : parseInt(cfg.to, 10);
        if (!isFinite(f) || f < 0) f = 1;
        if (t !== null && (!isFinite(t) || t < f)) t = null;
        c.mode = 'range'; c.from = f; c.to = t;
      }
      this._save(db);
      return c;
    },
    /** ช่วงที่ใช้งานจริง: ครูตั้งไว้ → ใช้ตามนั้น; ไม่ตั้ง → 1..จำนวนนักเรียนในห้อง (คำนวณจากรายชื่อ) */
    effectiveRange: function (className) {
      var c = this.getConfig();
      if (c.mode === 'list') return { mode: 'list', list: c.list.slice() };
      var to = c.to;
      if (to === null || to === undefined) {
        var n = className ? this.provider.students(className).length : 0;
        if (!n) { var cls = this.provider.classes(), i, m = 0; for (i = 0; i < cls.length; i++) m = Math.max(m, this.provider.students(cls[i]).length); n = m; }
        to = n || null;
      }
      return { mode: 'range', from: c.from, to: to, derived: (c.to === null || c.to === undefined) };
    },
    NO_NUMBER: NO_NUMBER,
    isNone: function (v) { return this.normalize(v) === NO_NUMBER; },
    /** หมายเลขเครื่องเป็นเลข 3 หลัก (เช่น 12 → 012); 'ไม่มีเลข' คงไว้ */
    normalize: function (v) {
      var x = String(v === undefined || v === null ? '' : v).replace(/\s+/g, '').toUpperCase().slice(0, 16);
      if (x === 'ไม่มี' || x === 'ไม่มีหมายเลข') x = NO_NUMBER;
      if (/^\d{1,3}$/.test(x)) x = ('000' + x).slice(-3);
      return x;
    },
    validate: function (value, className) {
      var v = this.normalize(value);
      if (!v) return { ok: true, value: '', cleared: true };
      if (v === NO_NUMBER) return { ok: true, value: v };
      if (!/^[0-9A-Z\u0E00-\u0E7F_\-\/]+$/.test(v)) return { ok: false, reason: 'ใช้ได้เฉพาะตัวเลข ตัวอักษร หรือเครื่องหมาย - _ /' };
      var r = this.effectiveRange(className);
      if (r.mode === 'list') {
        if (r.list.indexOf(v) === -1) return { ok: false, reason: 'หมายเลขนี้ไม่อยู่ในรายการเครื่องที่ครูกำหนด' };
      } else {
        if (!/^\d{1,3}$/.test(v)) return { ok: false, reason: 'ต้องเป็นตัวเลข 3 หลัก เช่น 012 (ถ้าเครื่องไม่มีเลข ให้เลือก "เครื่องนี้ไม่มีหมายเลข")' };
        var n = parseInt(v, 10);
        if (n < r.from) return { ok: false, reason: 'หมายเลขต่ำกว่าช่วงที่ครูกำหนด (เริ่มที่ ' + r.from + ')' };
        if (r.to !== null && n > r.to) return { ok: false, reason: 'หมายเลขเกินช่วงเครื่องที่มี (1-' + r.to + ' ตามที่ครูกำหนด/จำนวนนักเรียน)' };
        v = ('000' + n).slice(-3);
      }
      return { ok: true, value: v };
    },

    /* ---------- ข้อมูลรายนักเรียน/คาบ ---------- */
    recKey: function (className, period, studentId) { return String(className) + '_p' + Number(period) + '_' + String(studentId); },
    get: function (className, period, studentId) {
      return this._load().records[this.recKey(className, period, studentId)] || null;
    },
    getDevice: function (className, period, studentId) {
      var r = this.get(className, period, studentId); return r ? r.device : '';
    },
    /** บันทึก/แก้ไข + เพิ่มประวัติ (audit). by = 'student' | 'teacher' */
    set: function (className, period, studentId, value, by, atIso, opts) {
      opts = opts || {};
      var chk = opts.skipValidate ? { ok: true, value: this.normalize(value) } : this.validate(value, className);
      if (!chk.ok) return { ok: false, reason: chk.reason };
      var db = this._load(), k = this.recKey(className, period, studentId), rec = db.records[k], at = atIso || nowIso();
      var prev = rec ? rec.device : '';
      if (rec && prev === chk.value) return { ok: true, changed: false, record: rec };
      if (!rec && !chk.value) return { ok: true, changed: false, record: null };
      if (!rec) rec = db.records[k] = { className: String(className), period: Number(period), studentId: String(studentId), device: '', updatedAt: at, by: by || 'student', history: [] };
      rec.history.push({ device: chk.value, prev: prev, at: at, by: by || 'student' });
      rec.device = chk.value; rec.updatedAt = at; rec.by = by || 'student';
      this._save(db);
      return { ok: true, changed: true, record: rec };
    },
    /** รับค่าที่นักเรียนส่งมาทางงาน (ฝั่งครู): ถ้าครูเคยแก้เองแล้ว ถือค่าของครูเป็นหลัก ไม่ทับ */
    applyRemote: function (className, period, studentId, value, atIso) {
      var rec = this.get(className, period, studentId), v = this.normalize(value);
      if (!v) return { ok: true, changed: false, skipped: 'empty' };
      if (rec && rec.by === 'teacher') return { ok: true, changed: false, skipped: 'teacher_edit' };
      if (rec && rec.device === v) return { ok: true, changed: false, skipped: 'same' };
      return this.set(className, period, studentId, v, 'student', atIso || nowIso(), { skipValidate: true });
    },
    /** อ่านมาร์กเกอร์ในงานที่นักเรียนส่งมา (ทุกคาบ) แล้วบันทึกเป็นหมายเลขเครื่อง — เรียกตอนครูเปิดหน้าตรวจงาน/ตารางเครื่อง */
    ingestSubmissions: function (subs) {
      var n = 0, k, s, pr;
      subs = subs || {};
      for (k in subs) {
        if (!subs.hasOwnProperty(k)) continue;
        s = subs[k]; if (!s) continue;
        var km = /^(.*)_p(\d+)_([^_]+)$/.exec(k);
        var cn = s.className || (km && km[1]), pd = s.period || (km && km[2]), sid = s.studentId || (km && km[3]);
        if (!cn || !pd || !sid) continue;
        pr = this.parseContent(s.content);
        if (!pr.device) pr = { device: this.normalize(s.deviceNo || '') };
        if (!pr.device) continue;
        if (this.applyRemote(cn, pd, sid, pr.device).changed) n++;
      }
      return n;
    },

    /* ---------- แนบ/แกะค่ากับเนื้อหางาน (ซิงค์โดยไม่แก้เซิร์ฟเวอร์) ---------- */
    marker: function (device) { return '\n[[เครื่องคาลิมบ้า:' + this.normalize(device) + ']]'; },
    /** คืนเนื้อหา + มาร์กเกอร์ (ตัดเนื้อหาให้พอดี maxLen) ถ้าไม่มีหมายเลขเครื่องคืนเนื้อหาเดิม */
    tagContent: function (content, className, period, studentId, maxLen) {
      var dev = this.getDevice(className, period, studentId), c = String(content || '');
      c = this.parseContent(c).content;
      if (!dev) return maxLen ? c.slice(0, maxLen) : c;
      var mk = this.marker(dev);
      if (maxLen) c = c.slice(0, Math.max(0, maxLen - mk.length));
      return c + mk;
    },
    parseContent: function (content) {
      var s = String(content || ''), m = MARK_RE.exec(s);
      if (!m) return { content: s, device: '' };
      return { content: s.replace(MARK_RE, ''), device: this.normalize(m[1]) };
    },

    /* ---------- แถวสำหรับมุมมองครู / ส่งออก ---------- */
    rowsFor: function (className, period, query) {
      var studs = this.provider.students(className), rows = [], i, s, id, rec, q = String(query || '').toLowerCase();
      for (i = 0; i < studs.length; i++) {
        s = studs[i]; id = String(s.student_id !== undefined ? s.student_id : s.id);
        rec = this.get(className, period, id);
        var name = KD.nameOf(s);
        var row = { className: className, period: Number(period), no: s.no || s.number || s.seat || (i + 1), studentId: id, name: name,
          device: rec ? rec.device : '', updatedAt: rec ? rec.updatedAt : '', by: rec ? rec.by : '', history: rec ? rec.history : [] };
        if (q) {
          var hay = (name + ' ' + id + ' ' + row.device).toLowerCase();
          if (hay.indexOf(q) === -1) continue;
        }
        rows.push(row);
      }
      return rows;
    },
    nameOf: function (s) {
      return String(s.name || s.full_name || s.fullName || ((s.prefix || '') + (s.first_name || s.firstName || '') + ' ' + (s.last_name || s.lastName || '')) || s.student_id || '').replace(/^\s+|\s+$/g, '');
    },
    conflicts: function (className, period) {
      var rows = this.rowsFor(className, period), map = {}, i, out = {};
      for (i = 0; i < rows.length; i++) if (rows[i].device && rows[i].device !== NO_NUMBER) (map[rows[i].device] = map[rows[i].device] || []).push(rows[i].studentId);
      for (var d in map) if (map.hasOwnProperty(d) && map[d].length > 1) out[d] = map[d];
      return out;
    },
    fmtTime: function (iso) {
      if (!iso) return '';
      var t = Date.parse(iso); if (!isFinite(t)) return String(iso);
      return new Date(t + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' (UTC+7)';
    },
    csvCell: function (v) {
      var s = String(v === undefined || v === null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    },
    toCSV: function (rows) {
      var head = ['ห้อง', 'คาบ', 'เลขที่', 'รหัสนักเรียน', 'ชื่อ-สกุล', 'หมายเลขเครื่อง', 'อัปเดตล่าสุด', 'ผู้บันทึก', 'จำนวนครั้งที่แก้', 'ประวัติการแก้ไข'];
      var lines = [head.map(KD.csvCell).join(',')], i, r, h;
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        h = (r.history || []).map(function (x) { return (x.prev || '-') + '→' + (x.device || '(ลบ)') + ' @' + KD.fmtTime(x.at) + ' โดย' + (x.by === 'teacher' ? 'ครู' : 'นักเรียน'); }).join(' | ');
        lines.push([r.className, r.period, r.no, r.studentId, r.name, r.device, KD.fmtTime(r.updatedAt), r.by === 'teacher' ? 'ครู' : (r.by ? 'นักเรียน' : ''), (r.history || []).length, h].map(KD.csvCell).join(','));
      }
      return '\uFEFF' + lines.join('\r\n') + '\r\n';
    },
    exportCSV: function (className, period) { // period = 'all' → ทุกคาบที่มีคาลิมบ้า
      var ps = (period === 'all') ? this.kalimbaPeriods() : [period], rows = [], i;
      for (i = 0; i < ps.length; i++) rows = rows.concat(this.rowsFor(className, ps[i]));
      return this.toCSV(rows);
    },
    kalimbaPeriods: function () {
      var m = root.KALIMBA_MEDIA, out = [], g, p;
      if (m && m.periods) for (g in m.periods) if (m.periods.hasOwnProperty(g)) for (p in m.periods[g]) if (m.periods[g].hasOwnProperty(p) && m.periods[g][p].length) out.push(Number(p));
      out.sort(function (a, b) { return a - b; });
      return out;
    },
    download: function (filename, text) {
      try {
        var blob = new root.Blob([text], { type: 'text/csv;charset=utf-8' });
        if (root.navigator && root.navigator.msSaveBlob) { root.navigator.msSaveBlob(blob, filename); return; }
        var url = root.URL.createObjectURL(blob), a = root.document.createElement('a');
        a.href = url; a.download = filename; root.document.body.appendChild(a); a.click();
        root.setTimeout(function () { root.document.body.removeChild(a); root.URL.revokeObjectURL(url); }, 500);
      } catch (e) { /* ไม่รองรับดาวน์โหลด */ }
    },

    /* ---------- ช่องกรอกของนักเรียน ---------- */
    mountField: function (el, ctx) {
      if (!el) return;
      var cur = this.getDevice(ctx.className, ctx.period, ctx.studentId), r = this.effectiveRange(ctx.className);
      var hint = r.mode === 'list' ? ('เลือกจากรายการที่ครูกำหนด: ' + r.list.join(', '))
        : ('เลข 3 หลักที่ติดอยู่กับเครื่อง' + (r.to ? ' (' + ('000' + r.from).slice(-3) + '–' + ('000' + r.to).slice(-3) + ')' : ''));
      var isNone = cur === NO_NUMBER;
      el.innerHTML = '<label style="font-weight:700;color:#1e3a8a;">🔢 หมายเลขเครื่องคาลิมบ้าที่ใช้ในคาบนี้</label><br/>' +
        '<input type="text" inputmode="numeric" maxlength="' + (r.mode === 'list' ? 16 : 3) + '" value="' + esc(isNone ? '' : cur) + '"' + (isNone ? ' disabled' : '') + ' data-role="dev" aria-label="หมายเลขเครื่องคาลิมบ้า 3 หลัก" placeholder="เช่น 012" style="min-height:44px;font-size:16px;width:7em;"/> ' +
        '<button type="button" class="km-btn" data-role="devsave" style="padding:6px 12px;min-height:44px;">บันทึก</button><br/>' +
        '<label style="display:inline-block;line-height:44px;font-size:14px;"><input type="checkbox" data-role="devnone"' + (isNone ? ' checked' : '') + ' style="width:20px;height:20px;"/> เครื่องนี้ไม่มีหมายเลข</label><br/>' +
        '<span class="km-msg" data-role="devmsg" style="color:#546e7a;" aria-live="polite">' + esc(hint) + (cur ? ' · บันทึกไว้แล้ว: ' + esc(cur) : '') + '</span>';
      var inp = el.querySelector('[data-role="dev"]'), btn = el.querySelector('[data-role="devsave"]'), msg = el.querySelector('[data-role="devmsg"]');
      var none = el.querySelector('[data-role="devnone"]');
      none.onclick = function () { inp.disabled = !!none.checked; if (none.checked) inp.value = ''; };
      function save() {
        var res = KD.set(ctx.className, ctx.period, ctx.studentId, none.checked ? NO_NUMBER : inp.value, 'student');
        if (!res.ok) { msg.style.color = '#b71c1c'; msg.innerHTML = '⚠ ' + esc(res.reason); return; }
        msg.style.color = '#1b5e20';
        msg.innerHTML = res.record && res.record.device === NO_NUMBER ? '✓ บันทึกแล้ว: เครื่องนี้ไม่มีหมายเลข' : res.record && res.record.device ? '✓ บันทึกหมายเลขเครื่อง ' + esc(res.record.device) + ' แล้ว (จะส่งไปพร้อมงานคาบนี้)' : '✓ ล้างหมายเลขเครื่องแล้ว';
        if (typeof ctx.onSave === 'function') ctx.onSave(res);
      }
      btn.onclick = save;
      inp.onkeydown = function (e) { e = e || root.event; if (e.keyCode === 13) { save(); return false; } };
    },

    /* ---------- มุมมองครู (modal) ---------- */
    openTeacherView: function (opts) {
      opts = opts || {};
      try { if (root.Store && root.Store.getAllSubmissions) this.ingestSubmissions(root.Store.getAllSubmissions()); } catch (e) {}
      var doc = root.document, old = doc.getElementById('km-dev-modal');
      if (old) old.parentNode.removeChild(old);
      var wrap = doc.createElement('div'); wrap.id = 'km-dev-modal';
      wrap.setAttribute('style', 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.55);overflow:auto;-webkit-overflow-scrolling:touch;');
      doc.body.appendChild(wrap);
      var classes = this.provider.classes(), periods = this.kalimbaPeriods();
      var st = { className: opts.className || classes[0] || '', period: opts.period || periods[0] || 3, q: '' };
      function draw() {
        var i, rows = KD.rowsFor(st.className, st.period, st.q), conf = KD.conflicts(st.className, st.period), cfg = KD.getConfig(), er = KD.effectiveRange(st.className);
        var h = '<div style="background:#fff;max-width:980px;margin:16px auto;border-radius:12px;padding:14px;font-size:14px;-webkit-box-sizing:border-box;box-sizing:border-box;">';
        h += '<div style="font-weight:800;font-size:17px;color:#1e3a8a;">🔢 หมายเลขเครื่องคาลิมบ้า — มุมมองครู <button type="button" data-a="close" class="km-btn" style="float:right;">ปิด</button></div><div style="clear:both"></div>';
        h += '<div style="margin:8px 0;">ห้อง <select data-a="cls">';
        for (i = 0; i < classes.length; i++) h += '<option' + (classes[i] === st.className ? ' selected' : '') + '>' + esc(classes[i]) + '</option>';
        h += '</select> &nbsp; คาบ <select data-a="per">';
        for (i = 0; i < periods.length; i++) h += '<option value="' + periods[i] + '"' + (periods[i] === Number(st.period) ? ' selected' : '') + '>คาบ ' + periods[i] + '</option>';
        h += '</select> &nbsp; <input data-a="q" type="text" placeholder="ค้นหาชื่อ / รหัส / หมายเลขเครื่อง" value="' + esc(st.q) + '" style="padding:6px 8px;width:220px;max-width:100%;"/></div>';
        h += '<div style="margin:6px 0;padding:8px;background:#f3f8ff;border-radius:8px;font-size:13px;">⚙ ช่วงหมายเลขเครื่อง: ';
        h += 'ใช้งานอยู่ = ' + (er.mode === 'list' ? 'รายการ [' + esc(er.list.join(', ')) + ']' : (er.from + '–' + (er.to === null ? 'ไม่จำกัด' : er.to) + (er.derived ? ' (คำนวณจากจำนวนนักเรียนในห้อง)' : ' (ครูตั้งค่า)'))) + '<br/>';
        h += 'ตั้งใหม่: จาก <input data-a="from" type="number" style="width:70px;padding:4px;" value="' + esc(cfg.from) + '"/> ถึง <input data-a="to" type="number" style="width:70px;padding:4px;" value="' + esc(cfg.to === null ? '' : cfg.to) + '" placeholder="อัตโนมัติ"/> ' +
          '<button type="button" class="km-btn" data-a="cfg-range" style="padding:5px 10px;">ใช้ช่วงนี้</button> หรือรายการเฉพาะ (คั่นด้วยจุลภาค) <input data-a="list" type="text" style="width:200px;padding:4px;" value="' + esc(cfg.mode === 'list' ? cfg.list.join(',') : '') + '" placeholder="เช่น A1,A2,B1"/> ' +
          '<button type="button" class="km-btn" data-a="cfg-list" style="padding:5px 10px;">ใช้รายการนี้</button></div>';
        h += '<div style="margin:6px 0;"><button type="button" class="km-btn" data-a="csv">⬇ ส่งออก CSV (ห้อง/คาบนี้)</button><button type="button" class="km-btn" data-a="csv-all">⬇ CSV ทุกคาบคาลิมบ้า</button><button type="button" class="km-btn" data-a="audit">📜 ประวัติการแก้ไขทั้งหมด</button></div>';
        var filled = 0; for (i = 0; i < rows.length; i++) if (rows[i].device) filled++;
        h += '<div style="font-size:12px;color:#546e7a;margin-bottom:4px;">แสดง ' + rows.length + ' คน · กรอกแล้ว ' + filled + ' · ที่ซ้ำกัน ' + Object.keys(conf).length + ' หมายเลข</div>';
        h += '<div style="overflow-x:auto;"><table style="border-collapse:collapse;width:100%;font-size:13px;"><thead><tr style="background:#e3f2fd;"><th style="padding:5px;text-align:left;">เลขที่</th><th style="text-align:left;">รหัส</th><th style="text-align:left;">ชื่อ-สกุล</th><th>หมายเลขเครื่อง</th><th style="text-align:left;">อัปเดตล่าสุด</th><th>ประวัติ</th></tr></thead><tbody>';
        for (i = 0; i < rows.length; i++) {
          var r = rows[i], dup = r.device && conf[r.device];
          h += '<tr style="border-bottom:1px solid #eceff1;' + (dup ? 'background:#fff8e1;' : '') + '"><td style="padding:5px;">' + esc(r.no) + '</td><td>' + esc(r.studentId) + '</td><td>' + esc(r.name) + '</td>' +
            '<td style="text-align:center;"><input data-a="dev" data-sid="' + esc(r.studentId) + '" type="text" value="' + esc(r.device) + '" style="width:70px;padding:4px;text-align:center;"/>' + (dup ? ' <span title="ซ้ำกับนักเรียนคนอื่น">⚠ซ้ำ</span>' : '') + '</td>' +
            '<td style="font-size:12px;">' + esc(KD.fmtTime(r.updatedAt)) + (r.by ? ' · ' + (r.by === 'teacher' ? 'ครู' : 'นักเรียน') : '') + '</td>' +
            '<td style="text-align:center;">' + (r.history.length ? '<span data-a="hist" data-sid="' + esc(r.studentId) + '" style="cursor:pointer;color:#1565c0;text-decoration:underline;">' + r.history.length + ' ครั้ง</span>' : '-') + '</td></tr>';
        }
        h += '</tbody></table></div><div data-role="msg" style="margin-top:6px;font-size:13px;" aria-live="polite"></div><div data-role="pane" style="margin-top:8px;"></div></div>';
        wrap.innerHTML = h;
      }
      function msg(t, bad) { var m = wrap.querySelector('[data-role="msg"]'); if (m) { m.style.color = bad ? '#b71c1c' : '#1b5e20'; m.innerHTML = esc(t); } }
      function tgt(e) { var t = (e || root.event).target || (e || root.event).srcElement; while (t && t !== wrap && !(t.getAttribute && t.getAttribute('data-a'))) t = t.parentNode; return (t && t !== wrap) ? t : null; }
      wrap.onclick = function (e) {
        var t = tgt(e); if (!t) { return; } var a = t.getAttribute('data-a'), pane = wrap.querySelector('[data-role="pane"]'), i;
        if (a === 'close') { wrap.parentNode.removeChild(wrap); }
        else if (a === 'csv') KD.download('kalimba_devices_' + st.className.replace(/[^\w\u0E00-\u0E7F]/g, '_') + '_p' + st.period + '.csv', KD.exportCSV(st.className, st.period));
        else if (a === 'csv-all') KD.download('kalimba_devices_' + st.className.replace(/[^\w\u0E00-\u0E7F]/g, '_') + '_all.csv', KD.exportCSV(st.className, 'all'));
        else if (a === 'cfg-range') { KD.setConfig({ mode: 'range', from: wrap.querySelector('[data-a="from"]').value, to: wrap.querySelector('[data-a="to"]').value }); draw(); msg('บันทึกช่วงหมายเลขเครื่องแล้ว'); }
        else if (a === 'cfg-list') { KD.setConfig({ mode: 'list', list: wrap.querySelector('[data-a="list"]').value.split(/[,\s]+/) }); draw(); msg('บันทึกรายการหมายเลขเครื่องแล้ว'); }
        else if (a === 'hist') {
          var rec = KD.get(st.className, st.period, t.getAttribute('data-sid')), hh = '<b>ประวัติ ' + esc(t.getAttribute('data-sid')) + ' (คาบ ' + st.period + ')</b><ul style="margin:4px 0 0 18px;padding:0;">';
          if (rec) for (i = rec.history.length - 1; i >= 0; i--) hh += '<li>' + esc(KD.fmtTime(rec.history[i].at)) + ' — ' + esc(rec.history[i].prev || '-') + ' → ' + esc(rec.history[i].device || '(ลบ)') + ' โดย' + (rec.history[i].by === 'teacher' ? 'ครู' : 'นักเรียน') + '</li>';
          pane.innerHTML = hh + '</ul>';
        } else if (a === 'audit') {
          var all = KD.auditLog(st.className, st.period), hh2 = '<b>ประวัติการแก้ไขทั้งหมด — ' + esc(st.className) + ' คาบ ' + st.period + ' (' + all.length + ' รายการ)</b><ul style="margin:4px 0 0 18px;padding:0;">';
          for (i = 0; i < all.length; i++) hh2 += '<li>' + esc(KD.fmtTime(all[i].at)) + ' — ' + esc(all[i].studentId) + ' ' + esc(all[i].name) + ': ' + esc(all[i].prev || '-') + ' → ' + esc(all[i].device || '(ลบ)') + ' โดย' + (all[i].by === 'teacher' ? 'ครู' : 'นักเรียน') + '</li>';
          pane.innerHTML = hh2 + '</ul>';
        }
      };
      wrap.onchange = function (e) {
        var t = tgt(e); if (!t) return; var a = t.getAttribute('data-a');
        if (a === 'cls') { st.className = t.value; draw(); }
        else if (a === 'per') { st.period = parseInt(t.value, 10); draw(); }
        else if (a === 'dev') {
          var res = KD.set(st.className, st.period, t.getAttribute('data-sid'), t.value, 'teacher');
          if (!res.ok) { msg('⚠ ' + res.reason, true); t.style.background = '#ffebee'; } else { draw(); msg('บันทึกแล้ว'); }
        }
      };
      wrap.oninput = function (e) { var t = tgt(e); if (t && t.getAttribute('data-a') === 'q') { st.q = t.value; var pos = t.selectionStart; draw(); var n = wrap.querySelector('[data-a="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} } } };
      draw();
      return wrap;
    },
    auditLog: function (className, period) {
      var rows = this.rowsFor(className, period), out = [], i, j, r;
      for (i = 0; i < rows.length; i++) { r = rows[i]; for (j = 0; j < r.history.length; j++) out.push({ at: r.history[j].at, studentId: r.studentId, name: r.name, device: r.history[j].device, prev: r.history[j].prev, by: r.history[j].by }); }
      out.sort(function (a, b) { return a.at < b.at ? 1 : (a.at > b.at ? -1 : 0); });
      return out;
    }
  };

  root.KalimbaDevices = KD;
  if (typeof module !== 'undefined' && module.exports) module.exports = KD;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
