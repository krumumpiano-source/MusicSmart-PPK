/* ============================================================================
 * group-observation.js — บันทึกผลสังเกตของครู (คาบ 18 → ใช้ประเมินรวมในคาบ 19) · ES5
 *  ตามที่ครูตัดสิน (28 ต.ค. 2569): คาบ 18 ไม่เก็บคะแนน แต่ครูบันทึกผลสังเกตและตรวจงานที่กลุ่มส่ง (ข้อความ/ลิงก์)
 *  เพื่อนำไปประเมินรวมในคาบ 19 (10 คะแนน ไม่เปลี่ยนน้ำหนัก) — เกณฑ์ 2 ข้อตามข้อความ วก.5 คาบ 19:
 *    1) ความครบถ้วนของการค้นคว้าตามมิติที่กลุ่มรับผิดชอบ  2) การปฏิบัติหน้าที่ตามบทบาท
 *  ระดับที่บันทึก (1-4) เป็น "ข้อมูลประกอบการตัดสินของครู" — ไม่ถูกนำไปคำนวณเป็นคะแนนอัตโนมัติ
 *  เก็บใน localStorage คีย์ ppk_group_observation (ในเครื่องครู) — ไม่ส่งออกนอกเครื่อง
 * ============================================================================ */
(function (root) {
  'use strict';
  var KEY = 'ppk_group_observation';
  var PERIODS = [18, 19];
  var CRITERIA = [
    { id: 'research', label: 'ความครบถ้วนของการค้นคว้าตามมิติที่กลุ่มรับผิดชอบ' },
    { id: 'role', label: 'การปฏิบัติหน้าที่ตามบทบาท' }
  ];
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load() {
    try {
      var raw = root.Store && root.Store.load ? root.Store.load(KEY, null) : (root.localStorage ? JSON.parse(root.localStorage.getItem(KEY) || 'null') : null);
      return raw && typeof raw === 'object' && !(raw instanceof Array) ? raw : {};
    } catch (e) { return {}; }
  }
  function save(db) {
    try {
      if (root.Store && root.Store.save) return !!root.Store.save(KEY, db);
      if (root.localStorage) { root.localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    } catch (e) {}
    return false;
  }
  function k(className, period, studentId) { return String(className) + '_p' + Number(period) + '_' + String(studentId); }
  function lvl(v) { var n = parseInt(v, 10); return n >= 1 && n <= 4 ? n : 0; }

  var GroupObservation = {
    KEY: KEY, PERIODS: PERIODS, CRITERIA: CRITERIA,
    isObservationPeriod: function (p) { return PERIODS.indexOf(Number(p)) >= 0; },
    get: function (className, period, studentId) {
      var r = load()[k(className, period, studentId)];
      return r ? { research: lvl(r.research), role: lvl(r.role), note: String(r.note || ''), updatedAt: r.updatedAt || '' } : { research: 0, role: 0, note: '', updatedAt: '' };
    },
    set: function (className, period, studentId, v) {
      if (!this.isObservationPeriod(period)) return { ok: false, reason: 'bad_period' };
      if (!className || !studentId) return { ok: false, reason: 'no_student' };
      var db = load(), rec = { research: lvl(v && v.research), role: lvl(v && v.role), note: String((v && v.note) || '').slice(0, 300), updatedAt: new Date().toISOString() };
      if (!rec.research && !rec.role && !rec.note) delete db[k(className, period, studentId)]; else db[k(className, period, studentId)] = rec;
      return save(db) ? { ok: true, record: rec } : { ok: false, reason: 'save_failed' };
    },
    /** งานที่นักเรียนส่งในคาบ (ข้อความ/ลิงก์) จากระบบส่งงานเดิม — อ่านอย่างเดียว */
    submission: function (className, period, studentId) {
      try {
        var all = root.Store && root.Store.getAllSubmissions ? root.Store.getAllSubmissions() : {}, s = all[k(className, period, studentId)];
        return s ? { content: String(s.content || ''), url: String(s.url || ''), submittedAt: s.submittedAt || '' } : null;
      } catch (e) { return null; }
    },
    /** HTML ของแผงบันทึกผลสังเกต (ใช้ในหน้าให้คะแนนของครู) */
    panelHtml: function (className, period, studentId) {
      if (!this.isObservationPeriod(period)) return '';
      var cur = this.get(className, period, studentId), h = '', self = this;
      h += '<div class="rm-meta rm-obs" id="rm-obs-box"><b>👁 ผลสังเกตของครู — คาบที่ ' + Number(period) + (Number(period) === 18 ? ' (ไม่เก็บคะแนน · นำไปประเมินรวมในคาบที่ 19)' : ' (ใช้ประกอบการให้ระดับ K/P/A ของคาบนี้)') + '</b>';
      h += '<div class="rm-obs-hint">ระดับ 1–4 ที่บันทึกที่นี่เป็นข้อมูลประกอบการตัดสินของครู — ไม่ได้ถูกคำนวณเป็นคะแนนอัตโนมัติ</div>';
      CRITERIA.forEach(function (c) {
        h += '<label class="rm-obs-row">' + esc(c.label) + ' <select class="rm-obs-sel" id="rm-obs-' + c.id + '" aria-label="' + esc(c.label) + '"><option value="0">ยังไม่บันทึก</option>';
        [4, 3, 2, 1].forEach(function (n) { h += '<option value="' + n + '"' + (cur[c.id] === n ? ' selected' : '') + '>ระดับ ' + n + '</option>'; });
        h += '</select></label>';
      });
      h += '<label class="rm-obs-row rm-obs-note">บันทึกผลสังเกต <textarea id="rm-obs-note" maxlength="300" rows="2" class="rm-note" placeholder="เช่น บทบาทที่ปฏิบัติ / ข้อมูลที่ค้นคว้ามา">' + esc(cur.note) + '</textarea></label>';
      h += '<button type="button" class="rm-mini-btn" onclick="GroupObservation.saveFromPanel()">บันทึกผลสังเกต</button><span id="rm-obs-msg" class="rm-dev-msg"></span>';
      var sub18 = this.submission(className, 18, studentId);
      h += '<div class="rm-obs-sub"><b>งานที่ส่งในคาบที่ 18:</b> ' + (sub18 && (sub18.content || sub18.url) ? esc(sub18.content).slice(0, 400) + (sub18.url ? ' · <a href="' + esc(sub18.url) + '" target="_blank" rel="noopener">ลิงก์ที่ส่ง</a>' : '') : 'ยังไม่มีงานที่ส่ง') + '</div>';
      if (Number(period) === 19) {
        var o18 = this.get(className, 18, studentId);
        h += '<div class="rm-obs-sub"><b>ผลสังเกตที่บันทึกไว้ในคาบที่ 18:</b> ' + (o18.research || o18.role || o18.note ? CRITERIA.map(function (c) { return esc(c.label) + ' = ' + (o18[c.id] ? 'ระดับ ' + o18[c.id] : 'ยังไม่บันทึก'); }).join(' · ') + (o18.note ? ' · ' + esc(o18.note) : '') : 'ยังไม่มี') + '</div>';
      }
      return h + '</div>';
    },
    /** อ่านค่าจากแผงบนหน้าจอแล้วบันทึก (ใช้กับ RubricMatrix.activeStudent / activePeriod) */
    saveFromPanel: function () {
      var RM = root.RubricMatrix, s = RM && RM.activeStudent, d = root.document; if (!s || !d) return;
      var g = function (id) { var e = d.getElementById(id); return e ? e.value : ''; };
      var res = this.set(s.class, RM.activePeriod, s.student_id, { research: g('rm-obs-research'), role: g('rm-obs-role'), note: g('rm-obs-note') });
      var m = d.getElementById('rm-obs-msg'); if (m) { m.textContent = res.ok ? '✓ บันทึกแล้ว' : '⚠ บันทึกไม่สำเร็จ'; m.style.color = res.ok ? '#15803d' : '#b91c1c'; }
    },
    esc: esc
  };
  root.GroupObservation = GroupObservation;
  if (typeof module !== 'undefined' && module.exports) module.exports = GroupObservation;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
