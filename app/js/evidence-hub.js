// ==========================================================================
// EvidenceHub — ศูนย์หลักฐาน คศ.4 (ครูใช้เท่านั้น • ออฟไลน์ • เก็บในเครื่อง)
// ผลสัมฤทธิ์ / นวัตกรรม / วิจัย / PA / ให้คำปรึกษา — ตั้งค่าได้ทั้งหมด ไม่ส่งข้อมูลออกอินเทอร์เน็ต
// ES5 เพื่อมือถือรุ่นเก่า • ใช้ EvidenceCore (ตรรกะ) + EvidenceDefaults (ค่าตั้งต้น)
// ==========================================================================
var EvidenceHub = {
  KEYS: { cfg: 'ppk_evidence_config', items: 'ppk_evidence_items', resp: 'ppk_evidence_q_responses' },
  state: { tab: 'board', className: '', filter: '', editId: null, msg: '' },
  sink: null, // ใช้ใน tests: function(name, mime, content)

  _C: function () { return (typeof EvidenceCore !== 'undefined') ? EvidenceCore : (typeof require === 'function' ? require('./evidence-core.js') : null); },
  _D: function () { return (typeof EvidenceDefaults !== 'undefined') ? EvidenceDefaults : null; },
  _esc: function (s) { return this._C().esc(s); },

  // ---------- สิทธิ์: ครูเท่านั้น ----------
  canUse: function () {
    try { var u = Store.getCurrentUser(); return !!(u && u.role === 'teacher'); } catch (e) { return false; }
  },

  // ---------- ที่เก็บข้อมูล ----------
  getConfig: function () {
    var C = this._C(), cfg = C.mergeConfig(this._D(), Store.load(this.KEYS.cfg, null));
    if (!cfg.pseudoSalt) { cfg.pseudoSalt = C.newSalt(); Store.save(this.KEYS.cfg, this._savable(cfg)); }
    return cfg;
  },
  _savable: function (cfg) { var o = JSON.parse(JSON.stringify(cfg)); return o; },
  saveConfig: function (cfg) { return Store.save(this.KEYS.cfg, this._savable(cfg)); },
  getItems: function () { var a = Store.load(this.KEYS.items, []); return Array.isArray(a) ? a : []; },
  saveItems: function (a) { return Store.save(this.KEYS.items, a); },
  getResponses: function () { var a = Store.load(this.KEYS.resp, []); return Array.isArray(a) ? a : []; },
  saveResponses: function (a) { return Store.save(this.KEYS.resp, a); },
  today: function () { var d = new Date(); function z(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); },

  /** ความยินยอม PDPA/ผู้ปกครองของนักเรียน (เก็บในสถานะนักเรียน) — ใช้เป็นประตูก่อนบันทึกคลิป/ภาพที่มีนักเรียน */
  consentOf: function (studentId) { try { return Store.getStudentPdpaConsent(studentId) === true; } catch (e) { return false; } },
  _clipStudentsHtml: function (className, selected) {
    var self = this, sel = selected || [], list = [], h = '';
    try { list = (className ? (Store.getStudents(className) || []) : []).filter(function (s) { return !Store.isStudentWithdrawn(s.student_id); }); } catch (e) {}
    if (!className) return '<span class="eh-note">เลือกห้องก่อน จึงจะเลือกนักเรียนที่ปรากฏได้</span>';
    list.forEach(function (s) {
      var ok = self.consentOf(s.student_id), nm = (s.first_name || '') + ' ' + (s.last_name || '');
      h += '<label class="eh-chip' + (ok ? '' : ' eh-chip-off') + '"><input type="checkbox" name="eh-stu" value="' + self._esc(s.student_id) + '"' + (sel.indexOf(String(s.student_id)) >= 0 && ok ? ' checked' : '') + (ok ? '' : ' disabled') + '> ' + self._esc(s.student_id + ' ' + nm.trim()) + (ok ? ' ✓ ยินยอม' : ' ✗ ยังไม่มีความยินยอม') + '</label>';
    });
    return h || '<span class="eh-note">ไม่พบรายชื่อนักเรียนในห้องนี้</span>';
  },
  refreshClipStudents: function () {
    var c = document.getElementById('eh-class'), box = document.getElementById('eh-stu-box'); if (c && box) box.innerHTML = this._clipStudentsHtml(c.value, []);
  },
  addItem: function (raw) {
    if (!this.canUse()) return { ok: false, errors: ['สำหรับครูผู้สอนเท่านั้น'] };
    var C = this._C(), cfg = this.getConfig(), errs = C.validateItem(raw, cfg, this.consentOf);
    if (errs.length) return { ok: false, errors: errs };
    var items = this.getItems(), it = C.normalizeItem(raw, cfg);
    if (it.id) { var k; for (k = 0; k < items.length; k++) if (items[k].id === it.id) { it.createdAt = items[k].createdAt; items[k] = it; this.saveItems(items); return { ok: true, item: it, updated: true }; } }
    it.id = 'ev_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    it.createdAt = new Date().toISOString();
    items.push(it); this.saveItems(items);
    return { ok: true, item: it };
  },
  deleteItem: function (id) { if (!this.canUse()) return -1; var items = this.getItems().filter(function (i) { return i.id !== id; }); this.saveItems(items); return items.length; },

  // ---------- ข้อมูลระดับ K/P/A จากสมุดคะแนนรายคาบในแอป ----------
  classes: function () {
    var out = []; try { ['M1', 'M2'].forEach(function (g) { (Store.getAllClasses(g) || []).forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); }); }); } catch (e) {}
    return out;
  },
  collectRows: function (className) {
    var rows = [], grade, n, p, st = [];
    if (!this.canUse()) return rows;
    try { grade = Store.gradeKeyOf(className); n = Store.getPeriodCount(grade); st = (Store.getStudents(className) || []).filter(function (s) { return !Store.isStudentWithdrawn(s.student_id); }); } catch (e) { return rows; }
    st.forEach(function (s) {
      for (p = 1; p <= n; p++) {
        var rub = Store.getStudentRubric(s.student_id, p);
        if (rub && rub.levels && (Number(rub.levels.K) > 0 || Number(rub.levels.P) > 0 || Number(rub.levels.A) > 0)) rows.push({ id: s.student_id, className: className, period: p, K: Number(rub.levels.K) > 0 ? Number(rub.levels.K) : null, P: Number(rub.levels.P) > 0 ? Number(rub.levels.P) : null, A: Number(rub.levels.A) > 0 ? Number(rub.levels.A) : null });
      }
    });
    return rows;
  },
  analyze: function (className) {
    var C = this._C(), cfg = this.getConfig(), rows = this.collectRows(className), pts = C.pickPoints(rows, cfg, 2);
    var cmp = C.compare(rows, cfg, pts), pp = C.perPeriod(rows, cfg);
    return { cfg: cfg, rows: rows, points: pts, cmp: cmp, perPeriod: pp, className: className };
  },
  autoItems: function () {
    var out = [], self = this, cfg = this.getConfig();
    this.classes().forEach(function (c) {
      var rows = self.collectRows(c); if (!rows.length) return;
      var ids = {}, ps = {}; rows.forEach(function (r) { ids[r.id] = 1; ps[r.period] = 1; });
      out.push({ id: 'auto_score_' + c, auto: true, title: 'ข้อมูลระดับ K/P/A รายคาบ ห้อง ' + c + ' (' + Object.keys(ids).length + ' คน, ' + Object.keys(ps).length + ' คาบ)', pathways: ['outcome', 'research', 'pa'], kind: 'score',
        date: self.today(), period: null, className: c, source: 'แอป MusicSmart (คำนวณสดจากสมุดคะแนนรายคาบ)', link: '', note: 'หลักฐานอัตโนมัติ — ไม่แทนรายงานที่ครูตรวจแล้ว', checklist: 'o_data', alignment: cfg.alignmentLabel });
    });
    try { var t = Store.getTraineeTeachingSummary(); if (t && t.traineeCount > 0) out.push({ id: 'auto_trainee', auto: true, title: 'ช่องตารางสอนที่มอบหมายให้นักศึกษาฝึกสอน ' + t.traineeCount + ' ช่อง', pathways: ['mentoring'], kind: 'doc', date: this.today(), period: null, className: '', source: 'แอป MusicSmart (ตารางสอน)', link: '', note: 'ข้อมูลสนับสนุน — ยังไม่นับเป็นบันทึกการให้คำปรึกษา ครูต้องเพิ่มบันทึกเอง', checklist: '', alignment: cfg.alignmentLabel }); } catch (e) {}
    return out;
  },
  allItems: function () { return this.getItems().concat(this.autoItems()); },
  board: function () { return this._C().buildBoard(this.getConfig(), this.allItems()); },

  // ---------- ส่งออก ----------
  _emit: function (name, mime, content) {
    if (!this.canUse()) return false;
    if (typeof this.sink === 'function') { this.sink(name, mime, content); return true; }
    try {
      var blob = new Blob([content], { type: mime });
      if (window.navigator && window.navigator.msSaveBlob) { window.navigator.msSaveBlob(blob, name); return true; }
      var url = (window.URL || window.webkitURL).createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); (window.URL || window.webkitURL).revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { return false; }
  },
  dlCSV: function (name, csv) { return this._emit(name, 'text/csv;charset=utf-8', this._C().withBOM(csv)); },
  dlText: function (name, md) { return this._emit(name, 'text/markdown;charset=utf-8', this._C().withBOM(md)); },
  dlHtml: function (name, md) { return this._emit(name, 'text/html;charset=utf-8', this._C().withBOM(this._C().markdownToHtml(md))); },

  dossierContext: function (className) {
    var C = this._C(), an = this.analyze(className), cfg = an.cfg, resp = this.getResponses();
    var facts = {};
    try { var g = Store.gradeKeyOf(className); facts['จำนวนคาบในรายวิชา (วก.5)'] = Store.getPeriodCount(g); } catch (e) {}
    facts['จำนวนนักเรียนที่มีข้อมูลระดับอย่างน้อย 1 คาบ'] = (function () { var m = {}; an.rows.forEach(function (r) { m[r.id] = 1; }); return Object.keys(m).length; })();
    return { cfg: cfg, outcome: an.cmp, className: className, questionnaire: C.scoreQuestionnaire(cfg, resp), items: this.allItems(), today: this.today(), facts: facts };
  },
  dossier: function (className) { return this._C().buildDossier(this.dossierContext(className)); },

  /** ชุดส่งออกต่อเส้นทาง (หรือทั้งหมด) เป็น ZIP — ไม่มีชื่อ/รหัสจริงของนักเรียน */
  bundle: function (pathwayId, className) {
    if (!this.canUse()) return { name: '', files: [], bytes: [] };
    var C = this._C(), cfg = this.getConfig(), items = this.allItems(), board = C.buildBoard(cfg, items), files = [], an = null, resp = this.getResponses();
    var only = pathwayId || '';
    var sel = only ? items.filter(function (i) { return (i.pathways || []).indexOf(only) >= 0; }) : items;
    files.push({ name: '00_evidence_index.md', content: C.boardMarkdown(cfg, board, only) });
    files.push({ name: '01_evidence_list.csv', content: C.withBOM(C.evidenceCSV(sel, cfg)) });
    var wants = function (ids) { return !only || ids.indexOf(only) >= 0; };
    if (className && wants(['outcome', 'research', 'pa', 'innovation'])) {
      an = this.analyze(className);
      if (an.rows.length) {
        files.push({ name: '10_outcome_per_period.csv', content: C.withBOM(C.periodCSV(an.perPeriod, an.cfg, className)) });
        if (an.points.ok) {
          files.push({ name: '11_outcome_summary_stats.csv', content: C.withBOM(C.summaryCSV(an.cmp, an.cfg, className)) });
          files.push({ name: '12_outcome_pseudonymised.csv', content: C.withBOM(C.researchCSV(an.rows, an.cfg, an.cfg.pseudoSalt, an.points, className)) });
        }
      }
    }
    if (wants(['research', 'innovation']) && resp.length) {
      var sc = C.scoreQuestionnaire(cfg, resp);
      files.push({ name: '20_questionnaire_responses.csv', content: C.withBOM(C.questionnaireCSV(cfg, resp)) });
      files.push({ name: '21_questionnaire_summary.csv', content: C.withBOM(C.questionnaireSummaryCSV(cfg, sc)) });
    }
    if (wants(['innovation', 'pa'])) files.push({ name: '30_innovation_dossier_draft.md', content: this.dossier(className || this.state.className || '') });
    if (wants(['research'])) {
      files.push({ name: '40_research_designs.md', content: C.designMarkdown(cfg) });
      files.push({ name: '41_consent_draft.md', content: C.consentDraft(cfg) });
      files.push({ name: '42_method_note.md', content: C.methodNote(cfg, an ? an.cmp : null) });
      files.push({ name: '43_questionnaire_form.md', content: C.questionnaireText(cfg) });
    }
    files.push({ name: '99_README.txt', content: 'ชุดส่งออกจากศูนย์หลักฐาน คศ.4 (MusicSmart) — สร้าง ' + this.today() + '\nไม่มีชื่อ-นามสกุลและรหัสนักเรียนจริงในไฟล์ใด ๆ (ใช้รหัสแทนตัวตน)\nไฟล์ที่มีข้อความ [ครูระบุ …] / [ยังไม่มีข้อมูล …] ต้องกรอก/เก็บข้อมูลเองก่อนนำไปใช้\n' });
    return { name: 'evidence_' + (only || 'all') + '_' + this.today() + '.zip', files: files, bytes: C.zipStore(files) };
  },
  downloadBundle: function (pathwayId) {
    var b = this.bundle(pathwayId || '', this.state.className || ''); return this._emit(b.name, 'application/zip', b.bytes);
  },
  linkKeyCSV: function (className) {
    if (!this.canUse()) return '';
    var C = this._C(), cfg = this.getConfig(), st = Store.getStudents(className) || [];
    return C.toCSV(['รหัสแทนตัวตน', 'รหัสนักเรียนจริง', 'เลขที่', 'ห้อง'], st.map(function (s) { return [C.pseudonym(s.student_id, cfg.pseudoSalt), s.student_id, s.no, className]; }));
  },

  // ---------- UI ----------
  open: function (tab) {
    if (!this.canUse()) { try { alert('หน้านี้สำหรับครูผู้สอนเท่านั้น'); } catch (e) {} return false; }
    var cls = this.classes();
    if (!this.state.className || cls.indexOf(this.state.className) < 0) this.state.className = (typeof App !== 'undefined' && App.state && App.state.selectedClass && cls.indexOf(App.state.selectedClass) >= 0) ? App.state.selectedClass : (cls[0] || '');
    if (tab) this.state.tab = tab;
    var m = document.getElementById('modal-evidence-hub');
    if (!m) {
      m = document.createElement('div'); m.id = 'modal-evidence-hub'; m.className = 'modal-overlay';
      m.innerHTML = '<div class="modal-card eh-card"><div class="modal-header eh-head"><div><h3 class="eh-title">🏅 ศูนย์หลักฐาน คศ.4</h3><div class="eh-sub" id="eh-sub"></div></div><button class="modal-close-btn" onclick="EvidenceHub.close()" aria-label="ปิด">✕</button></div><div class="eh-tabs" id="eh-tabs"></div><div class="eh-body" id="eh-body"></div></div>';
      document.body.appendChild(m);
    }
    m.classList.add('active'); this.render(); return true;
  },
  close: function () { var m = document.getElementById('modal-evidence-hub'); if (m) m.classList.remove('active'); },
  go: function (tab) { this.state.tab = tab; this.state.msg = ''; this.render(); },
  setClass: function (c) { this.state.className = c; this.render(); },
  TABS: [['board', 'กระดานหลักฐาน'], ['items', 'บันทึกหลักฐาน'], ['outcome', 'ผลสัมฤทธิ์'], ['dossier', 'เอกสารนวัตกรรม'], ['research', 'ชุดวิจัย'], ['settings', 'ตั้งค่า']],

  render: function () {
    var cfg = this.getConfig(), self = this, tabs = '';
    this.TABS.forEach(function (t) { tabs += '<button type="button" class="eh-tab' + (self.state.tab === t[0] ? ' on' : '') + '" onclick="EvidenceHub.go(\'' + t[0] + '\')">' + t[1] + '</button>'; });
    var sub = document.getElementById('eh-sub'); if (sub) sub.textContent = cfg.alignmentLabel + ' • ' + cfg.target.position + ' • ครูเท่านั้น • ข้อมูลอยู่ในเครื่องนี้';
    document.getElementById('eh-tabs').innerHTML = tabs;
    var fn = this['_tab_' + this.state.tab] || this._tab_board;
    var body = document.getElementById('eh-body');
    body.innerHTML = (this.state.msg ? '<div class="eh-msg">' + this._esc(this.state.msg) + '</div>' : '') + fn.call(this, cfg);
  },
  _classSelect: function () {
    var s = '<label class="eh-lbl">ห้อง <select class="form-select eh-in" onchange="EvidenceHub.setClass(this.value)">', self = this;
    this.classes().forEach(function (c) { s += '<option' + (c === self.state.className ? ' selected' : '') + '>' + self._esc(c) + '</option>'; });
    return s + '</select></label>';
  },

  _tab_board: function (cfg) {
    var C = this._C(), b = this.board(), h = '<p class="eh-note">ป้ายสอดคล้อง: <b>' + this._esc(cfg.alignmentLabel) + '</b> — เก็บแล้ว/ขาด ตามรายการตรวจของแต่ละเส้นทาง (รายการตั้งต้นจากหลักเกณฑ์ ว9/2564 ครูต้องตรวจกับประกาศฉบับจริงและแก้ได้ในหน้า "ตั้งค่า")</p>';
    h += '<div class="eh-row"><button class="btn-nav-action primary" onclick="EvidenceHub.downloadBundle(\'\')">⬇ ชุดส่งออกทั้งหมด (ZIP)</button> ' + this._classSelect() + '</div>';
    var self = this;
    b.forEach(function (p) {
      h += '<div class="eh-card2"><div class="eh-ph"><b>' + self._esc(p.label) + '</b><span class="eh-badge ' + (p.pct === 100 ? 'ok' : (p.pct >= 50 ? 'mid' : 'low')) + '">' + p.collected + '/' + p.total + '</span></div>'
        + '<div class="eh-bar"><i style="width:' + p.pct + '%"></i></div><ul class="eh-ul">';
      p.checklist.forEach(function (c) { h += '<li class="' + (c.ok ? 'ok' : 'miss') + '">' + (c.ok ? '✔ ' : '✖ ') + self._esc(c.label) + ' <span class="eh-cnt">(' + c.have + '/' + c.min + ')</span>' + (c.ok || !c.hint ? '' : '<div class="eh-hint">ต้องเพิ่ม: ' + self._esc(c.hint) + '</div>') + (!c.ok && !c.hint ? '<div class="eh-hint">ต้องเพิ่มหลักฐานรายการนี้</div>' : '') + '</li>'; });
      h += '</ul><button class="btn-nav-action" onclick="EvidenceHub.downloadBundle(\'' + p.id + '\')">⬇ ชุดส่งออกเส้นทางนี้ (ZIP)</button> <button class="btn-nav-action" onclick="EvidenceHub.state.filter=\'' + p.id + '\';EvidenceHub.go(\'items\')">ดูหลักฐาน (' + p.items.length + ')</button></div>';
    });
    return h;
  },

  _tab_items: function (cfg) {
    var C = this._C(), self = this, e = null, items = this.getItems(), all = this.allItems(), f = this.state.filter;
    if (this.state.editId) items.forEach(function (i) { if (i.id === self.state.editId) e = i; });
    e = e || { title: '', pathways: f ? [f] : [], kind: 'doc', date: this.today(), period: '', className: this.state.className, source: '', link: '', note: '', checklist: '', alignment: cfg.alignmentLabel };
    var h = '<div class="eh-card2"><b>' + (e.id ? 'แก้ไขหลักฐาน' : 'เพิ่มหลักฐาน') + '</b><form id="eh-form" onsubmit="return EvidenceHub.submitItem(event)"><input type="hidden" id="eh-id" value="' + this._esc(e.id || '') + '">';
    h += '<label class="eh-lbl">ชื่อหลักฐาน *<input id="eh-title" class="form-input eh-in" value="' + this._esc(e.title) + '"></label><div class="eh-lbl">ผูกกับเส้นทาง * (เลือกอย่างน้อย 1)<div class="eh-chips">';
    cfg.pathways.forEach(function (p) { h += '<label class="eh-chip"><input type="checkbox" name="eh-pw" value="' + self._esc(p.id) + '"' + (e.pathways.indexOf(p.id) >= 0 ? ' checked' : '') + '> ' + self._esc(p.label) + '</label>'; });
    h += '</div></div><label class="eh-lbl">ชนิดหลักฐาน *<select id="eh-kind" class="form-select eh-in">';
    cfg.kinds.forEach(function (k) { h += '<option value="' + k.id + '"' + (e.kind === k.id ? ' selected' : '') + '>' + self._esc(k.label) + '</option>'; });
    h += '</select></label><label class="eh-lbl">วันที่ *<input id="eh-date" type="date" class="form-input eh-in" value="' + this._esc(e.date) + '"></label>';
    h += '<label class="eh-lbl">คาบ (ถ้ามี)<input id="eh-period" type="number" min="1" class="form-input eh-in" value="' + this._esc(e.period === null ? '' : e.period) + '"></label>';
    h += '<label class="eh-lbl">ห้อง (ถ้ามี)<select id="eh-class" class="form-select eh-in" onchange="EvidenceHub.refreshClipStudents()"><option value="">—</option>';
    this.classes().forEach(function (c) { h += '<option' + (c === e.className ? ' selected' : '') + '>' + self._esc(c) + '</option>'; });
    h += '</select></label>';
    h += '<div class="eh-lbl eh-clipbox"><label class="eh-chip"><input type="checkbox" id="eh-clip"' + (e.studentClip ? ' checked' : '') + '> คลิป/ภาพนี้มีนักเรียนปรากฏ (ต้องมีความยินยอม PDPA/ผู้ปกครองก่อนบันทึก)</label>'
      + '<div class="eh-note">ช่วงคาบที่ตั้งไว้สำหรับเก็บคลิป: ' + this._esc((cfg.clip && cfg.clip.periods || []).join(', ')) + ' (ครูปรับได้ในแท็บตั้งค่า) — นักเรียนที่ยังไม่มีความยินยอมเลือกไม่ได้</div>'
      + '<div class="eh-chips" id="eh-stu-box">' + this._clipStudentsHtml(e.className, e.studentIds || []) + '</div></div>';
    h += '<label class="eh-lbl">แหล่งที่มา * (ใครออก/เก็บจากไหน)<input id="eh-source" class="form-input eh-in" value="' + this._esc(e.source) + '"></label>';
    h += '<label class="eh-lbl">ลิงก์/ที่เก็บไฟล์ (Drive, โฟลเดอร์ในเครื่อง)<input id="eh-link" class="form-input eh-in" value="' + this._esc(e.link) + '"></label>';
    h += '<label class="eh-lbl">ตอบรายการตรวจข้อใด (ไม่เลือก = จับตามชนิด)<select id="eh-check" class="form-select eh-in"><option value="">—</option>';
    cfg.pathways.forEach(function (p) { (cfg.checklist[p.id] || []).forEach(function (c) { h += '<option value="' + self._esc(c.id) + '"' + (e.checklist === c.id ? ' selected' : '') + '>' + self._esc(p.label + ' › ' + c.label) + '</option>'; }); });
    h += '</select></label><label class="eh-lbl">ป้ายสอดคล้อง<input id="eh-align" class="form-input eh-in" value="' + this._esc(e.alignment || cfg.alignmentLabel) + '"></label>';
    h += '<label class="eh-lbl">หมายเหตุ<textarea id="eh-note" class="form-input eh-in" rows="2">' + this._esc(e.note) + '</textarea></label><div class="eh-row"><button class="btn-nav-action primary" type="submit">💾 บันทึก</button>' + (e.id ? ' <button type="button" class="btn-nav-action" onclick="EvidenceHub.state.editId=null;EvidenceHub.render()">ยกเลิกแก้ไข</button>' : '') + '</div></form></div>';
    h += '<div class="eh-row"><label class="eh-lbl">กรองเส้นทาง <select class="form-select eh-in" onchange="EvidenceHub.state.filter=this.value;EvidenceHub.render()"><option value="">ทั้งหมด</option>';
    cfg.pathways.forEach(function (p) { h += '<option value="' + p.id + '"' + (f === p.id ? ' selected' : '') + '>' + self._esc(p.label) + '</option>'; });
    h += '</select></label> <button class="btn-nav-action" onclick="EvidenceHub.dlCSV(\'evidence_list.csv\', EvidenceCore.evidenceCSV(EvidenceHub.allItems(), EvidenceHub.getConfig()))">⬇ CSV รายการหลักฐาน</button></div>';
    var shown = all.filter(function (i) { return !f || (i.pathways || []).indexOf(f) >= 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var pn = {}; cfg.pathways.forEach(function (p) { pn[p.id] = p.label; });
    if (!shown.length) h += '<p class="eh-note">ยังไม่มีหลักฐานในเส้นทางนี้</p>';
    shown.forEach(function (i) {
      h += '<div class="eh-item"><div><b>' + self._esc(i.title) + '</b>' + (i.auto ? ' <span class="eh-badge mid">อัตโนมัติ</span>' : '') + '</div><div class="eh-meta">' + self._esc(i.date) + ' • ' + self._esc((i.pathways || []).map(function (p) { return pn[p] || p; }).join(', ')) + ' • ' + self._esc(i.source) + (i.className ? ' • ' + self._esc(i.className) : '') + (i.period ? ' • คาบ ' + i.period : '') + '</div>'
        + (i.auto ? '' : '<div><button class="btn-nav-action" onclick="EvidenceHub.state.editId=\'' + i.id + '\';EvidenceHub.render()">แก้ไข</button> <button class="btn-nav-action" onclick="EvidenceHub.confirmDelete(\'' + i.id + '\')">ลบ</button></div>') + '</div>';
    });
    return h;
  },
  submitItem: function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var pw = [], els = document.getElementsByName('eh-pw'), i;
    for (i = 0; i < els.length; i++) if (els[i].checked) pw.push(els[i].value);
    var v = function (id) { return document.getElementById(id).value; };
    var stu = [], se = document.getElementsByName('eh-stu'), j; for (j = 0; j < se.length; j++) if (se[j].checked) stu.push(se[j].value);
    var raw = { studentClip: !!(document.getElementById('eh-clip') && document.getElementById('eh-clip').checked), studentIds: stu, id: v('eh-id') || undefined, title: v('eh-title'), pathways: pw, kind: v('eh-kind'), date: v('eh-date'), period: v('eh-period'), className: v('eh-class'), source: v('eh-source'), link: v('eh-link'), checklist: v('eh-check'), alignment: v('eh-align'), note: v('eh-note') };
    var r = this.addItem(raw);
    if (!r.ok) { this.state.msg = '⚠ ' + r.errors.join(' • '); this.render(); return false; }
    this.state.msg = '✔ บันทึกหลักฐานแล้ว'; this.state.editId = null; this.render(); return false;
  },
  confirmDelete: function (id) { var ok = true; try { ok = confirm('ลบหลักฐานนี้?'); } catch (e) {} if (ok) { this.deleteItem(id); this.state.msg = 'ลบแล้ว'; this.render(); } },

  _tab_outcome: function (cfg) {
    var C = this._C(), self = this, an = this.analyze(this.state.className), h = '<div class="eh-row">' + this._classSelect() + '</div>';
    h += '<p class="eh-note">ใช้เฉพาะระดับ K/P/A ที่ครูบันทึกจริงในสมุดคะแนนรายคาบ — <b>ไม่ใส่ค่าแทน/ค่าเดา</b> นักเรียนที่ไม่มีข้อมูลทั้งก่อนและหลังจะไม่ถูกนับ</p>';
    var pd = C.periodsWithData(an.rows);
    h += '<div class="eh-card2"><b>จุดวัดก่อน–หลัง</b><div class="eh-row"><label class="eh-chip"><input type="radio" name="eh-mode" ' + (cfg.measure.mode === 'auto' ? 'checked' : '') + ' onclick="EvidenceHub.setMeasure(\'auto\')"> อัตโนมัติ (คาบแรก vs คาบล่าสุดที่มีข้อมูล)</label><label class="eh-chip"><input type="radio" name="eh-mode" ' + (cfg.measure.mode === 'periods' ? 'checked' : '') + ' onclick="EvidenceHub.setMeasure(\'periods\')"> เลือกคาบเอง</label></div>';
    if (cfg.measure.mode === 'periods') {
      ['baselinePeriods', 'afterPeriods'].forEach(function (k) {
        h += '<div class="eh-lbl">' + (k === 'baselinePeriods' ? 'คาบ "ก่อน"' : 'คาบ "หลัง"') + '<div class="eh-chips">';
        pd.forEach(function (x) { h += '<label class="eh-chip"><input type="checkbox" ' + (cfg.measure[k].indexOf(x.period) >= 0 ? 'checked' : '') + ' onclick="EvidenceHub.togglePeriod(\'' + k + '\',' + x.period + ')"> คาบ ' + x.period + ' (n=' + x.n + ')</label>'; });
        h += '</div></div>';
      });
    }
    h += '</div>';
    if (!an.rows.length) return h + '<p class="eh-warn">ยังไม่มีข้อมูลระดับ K/P/A ของห้องนี้ — บันทึกระดับรายคาบในหน้าสมุดคะแนนก่อน แล้วกลับมาที่หน้านี้</p>';
    var pts = an.points;
    if (!pts.ok) h += '<p class="eh-warn">ยังวิเคราะห์ก่อน–หลังไม่ได้: ' + this._esc(pts.reason) + '</p>';
    else {
      h += '<p class="eh-note">ก่อน = คาบ ' + pts.baseline.join(',') + ' • หลัง = คาบ ' + pts.after.join(',') + ' • n (มีครบทั้งสองจุด) = ' + an.cmp.n + '</p>';
      h += '<div class="eh-tw"><table class="eh-t"><thead><tr><th>ด้าน</th><th>n</th><th>ก่อน M (SD)</th><th>หลัง M (SD)</th><th>ผลต่าง</th><th>t (df)</th><th>p</th><th>d<sub>z</sub></th><th>gain</th><th>≥ระดับ' + cfg.criterion.level + ' ก่อน→หลัง</th></tr></thead><tbody>';
      [['K', 'K ความรู้'], ['P', 'P ทักษะ'], ['A', 'A เจตคติ'], ['ALL', 'รวม']].forEach(function (x) {
        var s = an.cmp.dims[x[0]]; if (!s) return;
        h += '<tr><td>' + x[1] + '</td><td>' + s.n + '</td><td>' + C.fmt(s.meanPre) + ' (' + C.fmt(s.sdPre) + ')</td><td>' + C.fmt(s.meanPost) + ' (' + C.fmt(s.sdPost) + ')</td><td>' + C.fmt(s.meanDiff) + '</td><td>' + C.fmt(s.t) + ' (' + (s.df === null ? '–' : s.df) + ')</td><td>' + C.fmtP(s.p) + '</td><td>' + C.fmt(s.dz) + (s.effectLabel ? ' <small>(' + s.effectLabel + ')</small>' : '') + '</td><td>' + C.fmt(s.gain) + (s.gainLabel ? ' <small>(' + s.gainLabel + ')</small>' : '') + '</td><td>' + (s.pctBefore.pct === null ? '–' : C.fmt(s.pctBefore.pct, 1)) + '% → ' + (s.pctAfter.pct === null ? '–' : C.fmt(s.pctAfter.pct, 1)) + '% ' + (s.pctAfter.met === null ? '' : (s.pctAfter.met ? '<b class="eh-okt">ผ่านเกณฑ์ ' + cfg.criterion.pct + '%</b>' : '<b class="eh-badt">ไม่ถึงเกณฑ์ ' + cfg.criterion.pct + '%</b>')) + '</td></tr>';
        if (s.note) h += '<tr><td colspan="10" class="eh-hint">' + self._esc(x[1] + ': ' + s.note) + '</td></tr>';
      });
      h += '</tbody></table></div><div class="eh-chart">' + C.barChartBeforeAfter(an.cmp, 320, 180) + '</div>';
    }
    h += '<div class="eh-card2"><b>รายคาบ (K/P/A และร้อยละที่ถึงระดับ ' + cfg.criterion.level + ' ขึ้นไป เทียบเกณฑ์ ' + cfg.criterion.pct + '%)</b><div class="eh-chart">' + C.barChartPctPeriods(an.perPeriod, cfg, 320, 180) + '</div><div class="eh-tw"><table class="eh-t"><thead><tr><th>คาบ</th><th>n</th><th>K</th><th>P</th><th>A</th><th>รวม</th><th>%ถึงเกณฑ์</th></tr></thead><tbody>';
    an.perPeriod.forEach(function (o) { var d = o.dims; h += '<tr><td>' + o.period + '</td><td>' + o.n + '</td><td>' + C.fmt(d.K.mean) + '</td><td>' + C.fmt(d.P.mean) + '</td><td>' + C.fmt(d.A.mean) + '</td><td>' + C.fmt(d.ALL.mean) + '</td><td>' + (d.ALL.pct === null ? '–' : C.fmt(d.ALL.pct, 1) + '%') + ' ' + (d.ALL.met ? '✔' : '✖') + '</td></tr>'; });
    h += '</tbody></table></div></div><div class="eh-row">';
    h += '<button class="btn-nav-action" onclick="EvidenceHub.exportOutcome(\'pseudo\')">⬇ CSV รายคน (รหัสแทนตัวตน)</button> <button class="btn-nav-action" onclick="EvidenceHub.exportOutcome(\'summary\')">⬇ CSV สถิติสรุป</button> <button class="btn-nav-action" onclick="EvidenceHub.exportOutcome(\'period\')">⬇ CSV รายคาบ</button> <button class="btn-nav-action primary" onclick="EvidenceHub.saveOutcomeAsEvidence()">📌 บันทึกผลนี้เป็นหลักฐาน</button> <button class="btn-nav-action" onclick="EvidenceHub.exportLinkKey()">🔑 ตารางจับคู่รหัส (เก็บเอง ห้ามแนบ)</button></div>';
    return h;
  },
  setMeasure: function (mode) { var c = this.getConfig(); c.measure.mode = mode; this.saveConfig(c); this.render(); },
  togglePeriod: function (k, p) { var c = this.getConfig(), a = c.measure[k], i = a.indexOf(p); if (i >= 0) a.splice(i, 1); else a.push(p); a.sort(function (x, y) { return x - y; }); this.saveConfig(c); this.render(); },
  exportOutcome: function (kind) {
    var C = this._C(), an = this.analyze(this.state.className), cn = this.state.className, tag = cn.replace(/[^\w]+/g, '_') || 'class';
    if (kind === 'period') return this.dlCSV('outcome_per_period_' + tag + '.csv', C.periodCSV(an.perPeriod, an.cfg, cn));
    if (!an.points.ok) { this.state.msg = '⚠ ยังไม่มีจุดก่อน–หลังที่ใช้ได้'; this.render(); return false; }
    if (kind === 'summary') return this.dlCSV('outcome_summary_' + tag + '.csv', C.summaryCSV(an.cmp, an.cfg, cn));
    return this.dlCSV('outcome_pseudonymised_' + tag + '.csv', C.researchCSV(an.rows, an.cfg, an.cfg.pseudoSalt, an.points, cn));
  },
  exportLinkKey: function () {
    var ok = true; try { ok = confirm('ไฟล์นี้จับคู่รหัสแทนตัวตนกับรหัสนักเรียนจริง — เก็บไว้เองเท่านั้น ห้ามแนบกับงานวิจัย/ส่งต่อ ดำเนินการต่อ?'); } catch (e) {}
    if (ok) this.dlCSV('PRIVATE_link_key_' + (this.state.className || '').replace(/[^\w]+/g, '_') + '.csv', this.linkKeyCSV(this.state.className));
  },
  saveOutcomeAsEvidence: function () {
    var an = this.analyze(this.state.className), n = an.cmp ? an.cmp.n : 0;
    var r = this.addItem({ title: 'รายงานวิเคราะห์ผลสัมฤทธิ์ ห้อง ' + this.state.className + (an.points.ok ? ' (ก่อนคาบ ' + an.points.baseline.join(',') + ' / หลังคาบ ' + an.points.after.join(',') + ', n=' + n + ')' : ' (ยังไม่มีจุดก่อน–หลัง)'), pathways: ['outcome', 'pa'], kind: 'report', date: this.today(), period: '', className: this.state.className, source: 'แอป MusicSmart — หน้าผลสัมฤทธิ์ (ครูตรวจสอบแล้ว)', link: '', checklist: 'o_report', note: 'บันทึกเมื่อครูกดปุ่ม — ตัวเลขเปลี่ยนได้ถ้าข้อมูลคะแนนเปลี่ยน ให้ส่งออก CSV เก็บไว้ประกอบ' });
    this.state.msg = r.ok ? '✔ บันทึกเป็นหลักฐานแล้ว (ที่กระดานหลักฐาน)' : '⚠ ' + r.errors.join(' • '); this.render();
  },

  _tab_dossier: function (cfg) {
    var self = this, d = cfg.dossier, fields = [['innovationName', 'ชื่อนวัตกรรม', 1], ['owner', 'ผู้พัฒนา (ชื่อ-ตำแหน่ง)', 1], ['school', 'สถานศึกษา', 1], ['subject', 'รายวิชา/ชั้น', 1], ['problem', 'สภาพปัญหา/ที่มา', 3], ['objectives', 'วัตถุประสงค์', 3], ['concept', 'แนวคิด/ทฤษฎี', 3], ['steps', 'ขั้นตอนการใช้นวัตกรรม', 3], ['tools', 'สื่อ/เครื่องมือ', 2], ['dissemination', 'การเผยแพร่/ขยายผล', 2]];
    var h = '<p class="eh-note">ช่องที่ว่างจะแสดงเป็น <b>[ครูระบุ: …]</b> ในเอกสาร และผลลัพธ์ทุกตัวเลขมาจากข้อมูลจริงในแอปเท่านั้น (ไม่มีข้อมูล = <b>[ยังไม่มีข้อมูล …]</b>)</p><div class="eh-row">' + this._classSelect() + '</div><div class="eh-card2">';
    fields.forEach(function (f) { h += '<label class="eh-lbl">' + f[1] + (f[2] === 1 ? '<input class="form-input eh-in" data-dos="' + f[0] + '" value="' + self._esc(d[f[0]]) + '">' : '<textarea class="form-input eh-in" rows="' + f[2] + '" data-dos="' + f[0] + '">' + self._esc(d[f[0]]) + '</textarea>') + '</label>'; });
    h += '<button class="btn-nav-action primary" onclick="EvidenceHub.saveDossierFields()">💾 บันทึกข้อมูลเอกสาร</button></div><div class="eh-row"><button class="btn-nav-action primary" onclick="EvidenceHub.dlText(\'innovation_dossier.md\', EvidenceHub.dossier(EvidenceHub.state.className))">⬇ Markdown</button> <button class="btn-nav-action primary" onclick="EvidenceHub.dlHtml(\'innovation_dossier.html\', EvidenceHub.dossier(EvidenceHub.state.className))">⬇ HTML (เปิดใน Word → บันทึกเป็น .docx)</button> <button class="btn-nav-action" onclick="EvidenceHub.saveDossierAsEvidence()">📌 ลงทะเบียนร่างเป็นหลักฐาน</button></div><pre class="eh-pre">' + this._esc(this.dossier(this.state.className)) + '</pre>';
    return h;
  },
  saveDossierFields: function () {
    var c = this.getConfig(), els = document.querySelectorAll('[data-dos]'), i;
    for (i = 0; i < els.length; i++) c.dossier[els[i].getAttribute('data-dos')] = els[i].value;
    this.saveConfig(c); this.state.msg = '✔ บันทึกแล้ว'; this.render();
  },
  saveDossierAsEvidence: function () {
    var r = this.addItem({ title: 'ร่างเอกสารนวัตกรรม (สร้างจากแอป)', pathways: ['innovation'], kind: 'doc', date: this.today(), period: '', className: this.state.className, source: 'แอป MusicSmart — ตัวสร้างเอกสารนวัตกรรม (ร่าง ต้องกรอกเพิ่ม)', link: '', checklist: '', note: 'ยังมีช่อง [ครูระบุ] ที่ต้องกรอกก่อนใช้จริง' });
    this.state.msg = r.ok ? '✔ ลงทะเบียนแล้ว' : '⚠ ' + r.errors.join(' • '); this.render();
  },

  _tab_research: function (cfg) {
    var C = this._C(), self = this, resp = this.getResponses(), sc = C.scoreQuestionnaire(cfg, resp), q = cfg.questionnaire;
    var h = '<div class="eh-card2"><b>รูปแบบการวิจัยที่เลือกได้</b>';
    cfg.designs.forEach(function (x) { h += '<details class="eh-det"><summary>' + self._esc(x.label) + '</summary><ul class="eh-ul"><li>เหมาะเมื่อ: ' + self._esc(x.use) + '</li><li>ข้อมูลที่ต้องมี: ' + self._esc(x.data) + '</li><li>วิเคราะห์: ' + self._esc(x.analysis) + '</li><li>ข้อควรระวัง: ' + self._esc(x.caution) + '</li><li>แอปช่วยได้: ' + self._esc(x.appSupport) + '</li></ul></details>'; });
    h += '</div><div class="eh-card2"><b>' + this._esc(q.title) + '</b><p class="eh-note">กรอกคำตอบทีละคนต่อบรรทัด: ตัวเลข ' + q.scaleMin + '–' + q.scaleMax + ' เรียงตามข้อ (' + q.items.length + ' ข้อ) คั่นด้วยเว้นวรรค/คอมมา ตามด้วย <code>|</code> ข้อเสนอแนะ (ไม่ต้องใส่ชื่อ)</p><textarea id="eh-qin" class="form-input eh-in" rows="4" placeholder="เช่น 5 4 4 5 5 3 4 4 5 | ชอบฝึกบนมือถือ"></textarea><div class="eh-row"><button class="btn-nav-action primary" onclick="EvidenceHub.addResponses()">➕ เพิ่มคำตอบ</button> <button class="btn-nav-action" onclick="EvidenceHub.clearResponses()">ล้างคำตอบทั้งหมด (' + resp.length + ')</button></div>';
    h += '<div class="eh-tw"><table class="eh-t"><thead><tr><th>ข้อ</th><th>ข้อความ</th><th>n</th><th>M</th><th>SD</th><th>แปลผล</th></tr></thead><tbody>';
    sc.items.forEach(function (i) { h += '<tr><td>' + i.id + '</td><td>' + self._esc(i.text) + '</td><td>' + i.n + '</td><td>' + C.fmt(i.mean) + '</td><td>' + C.fmt(i.sd) + '</td><td>' + i.label + '</td></tr>'; });
    sc.dims.forEach(function (d) { h += '<tr class="eh-sumr"><td colspan="2">' + self._esc(d.label) + '</td><td>' + d.n + '</td><td>' + C.fmt(d.mean) + '</td><td>' + C.fmt(d.sd) + '</td><td>' + d.label2 + '</td></tr>'; });
    h += '</tbody></table></div>' + (sc.overall ? '<p><b>ภาพรวม M = ' + C.fmt(sc.overall.mean) + ' (SD ' + C.fmt(sc.overall.sd) + ') = ' + sc.overall.label + '</b> • เกณฑ์ ≥ ' + cfg.satisfactionCriterion + ': ' + (sc.overall.met ? 'ผ่าน' : 'ไม่ผ่าน') + ' • n = ' + sc.overall.n + (sc.invalid ? ' • คำตอบไม่ถูกต้องที่ข้าม ' + sc.invalid : '') + '</p>' : '<p class="eh-warn">ยังไม่มีคำตอบ — จึงยังไม่มีค่าเฉลี่ย (ไม่ใส่ค่าเดา)</p>');
    h += '<div class="eh-row"><button class="btn-nav-action" onclick="EvidenceHub.dlText(\'questionnaire_form.md\', EvidenceCore.questionnaireText(EvidenceHub.getConfig()))">⬇ แบบสอบถามพิมพ์แจก</button> <button class="btn-nav-action" onclick="EvidenceHub.dlCSV(\'questionnaire_responses.csv\', EvidenceCore.questionnaireCSV(EvidenceHub.getConfig(), EvidenceHub.getResponses()))">⬇ CSV คำตอบ</button> <button class="btn-nav-action" onclick="EvidenceHub.dlCSV(\'questionnaire_summary.csv\', EvidenceCore.questionnaireSummaryCSV(EvidenceHub.getConfig(), EvidenceCore.scoreQuestionnaire(EvidenceHub.getConfig(), EvidenceHub.getResponses())))">⬇ CSV สรุป</button></div></div>';
    var cs = cfg.consent;
    h += '<div class="eh-card2"><b>ร่างหนังสือยินยอม/ความเห็นชอบ (ฉบับร่าง — ผู้บริหารต้องตรวจก่อนใช้)</b>';
    [['researcherName', 'ชื่อผู้วิจัย'], ['school', 'โรงเรียน'], ['title', 'ชื่อเรื่องวิจัย'], ['contact', 'ช่องทางติดต่อ'], ['dataRetention', 'การเก็บรักษาข้อมูล'], ['ethicsRef', 'อ้างอิงการพิจารณา (ถ้ามี)']].forEach(function (f) { h += '<label class="eh-lbl">' + f[1] + '<input class="form-input eh-in" data-con="' + f[0] + '" value="' + self._esc(cs[f[0]]) + '"></label>'; });
    h += '<div class="eh-row"><button class="btn-nav-action" onclick="EvidenceHub.saveConsentFields()">💾 บันทึก</button> <button class="btn-nav-action primary" onclick="EvidenceHub.dlText(\'consent_draft.md\', EvidenceCore.consentDraft(EvidenceHub.getConfig()))">⬇ ร่างหนังสือยินยอม</button> <button class="btn-nav-action" onclick="EvidenceHub.dlText(\'research_designs.md\', EvidenceCore.designMarkdown(EvidenceHub.getConfig()))">⬇ รูปแบบวิจัย</button> <button class="btn-nav-action" onclick="EvidenceHub.dlText(\'method_note.md\', EvidenceCore.methodNote(EvidenceHub.getConfig(), EvidenceHub.analyze(EvidenceHub.state.className).cmp))">⬇ หมายเหตุวิธีวิเคราะห์</button> <button class="btn-nav-action primary" onclick="EvidenceHub.downloadBundle(\'research\')">⬇ ชุดวิจัยทั้งชุด (ZIP)</button></div></div>';
    h += '<div class="eh-row">' + this._classSelect() + '</div>';
    return h;
  },
  addResponses: function () {
    var C = this._C(), cfg = this.getConfig(), ta = document.getElementById('eh-qin'), lines = String(ta.value || '').split(/\r?\n/), resp = this.getResponses(), added = 0, bad = 0, n = cfg.questionnaire.items.length;
    lines.forEach(function (ln) {
      if (!ln.trim()) return;
      var parts = ln.split('|'), nums = parts[0].split(/[\s,]+/).filter(function (x) { return x !== ''; }).map(Number), ans = {}, i, ok = nums.length === n;
      for (i = 0; i < nums.length && ok; i++) if (!(nums[i] >= cfg.questionnaire.scaleMin && nums[i] <= cfg.questionnaire.scaleMax) || Math.floor(nums[i]) !== nums[i]) ok = false;
      if (!ok) { bad++; return; }
      cfg.questionnaire.items.forEach(function (it, k) { ans[it.id] = nums[k]; });
      resp.push({ answers: ans, comments: parts.slice(1).join('|').trim() ? [parts.slice(1).join('|').trim()] : [], addedAt: new Date().toISOString() }); added++;
    });
    this.saveResponses(resp); this.state.msg = '✔ เพิ่ม ' + added + ' คำตอบ' + (bad ? ' • ข้ามบรรทัดที่ไม่ถูกต้อง ' + bad + ' (ต้องมี ' + n + ' ตัวเลขในช่วง ' + cfg.questionnaire.scaleMin + '–' + cfg.questionnaire.scaleMax + ')' : ''); this.render();
  },
  clearResponses: function () { var ok = true; try { ok = confirm('ล้างคำตอบแบบสอบถามทั้งหมด?'); } catch (e) {} if (ok) { this.saveResponses([]); this.render(); } },
  saveConsentFields: function () { var c = this.getConfig(), els = document.querySelectorAll('[data-con]'), i; for (i = 0; i < els.length; i++) c.consent[els[i].getAttribute('data-con')] = els[i].value; this.saveConfig(c); this.state.msg = '✔ บันทึกแล้ว'; this.render(); },

  _tab_settings: function (cfg) {
    var self = this, h = '<div class="eh-card2"><b>ป้ายสอดคล้อง/เกณฑ์</b>';
    h += '<label class="eh-lbl">ชื่อโครงการ/ป้ายสอดคล้อง (ติดกับหลักฐานทุกชิ้น — แก้ได้)<input id="eh-s-align" class="form-input eh-in" value="' + this._esc(cfg.alignmentLabel) + '"></label>';
    h += '<label class="eh-chip"><input type="checkbox" id="eh-s-alignok"' + (cfg.alignmentLabelConfirmed ? ' checked' : '') + '> ครูยืนยันแล้วว่าเป็นชื่อโครงการทางการ</label>';
    h += '<p class="eh-note">ค่าเริ่มต้นเป็นชื่อกลางจนกว่าครูยืนยัน — คำที่ครูใช้เรียกคือ “' + this._esc(cfg.alignmentLabelTeacherWording || '') + '” (ยังไม่ยืนยันว่าเป็นชื่อในเอกสารของโรงเรียน ตรวจกับเอกสารจริงก่อนใช้)</p>';
    h += '<label class="eh-lbl">ช่วงคาบที่เก็บคลิป/ภาพนักเรียน (คั่นด้วยจุลภาค เช่น 9,10,13,15,19) — ต้องมีความยินยอม PDPA ก่อนเสมอ<input id="eh-s-clip" class="form-input eh-in" value="' + this._esc((cfg.clip && cfg.clip.periods || []).join(',')) + '"></label>';
    h += '<label class="eh-lbl">ระดับที่ถือว่าผ่าน (1–' + cfg.criterion.maxLevel + ')<input id="eh-s-lv" type="number" min="1" max="' + cfg.criterion.maxLevel + '" class="form-input eh-in" value="' + cfg.criterion.level + '"></label>';
    h += '<label class="eh-lbl">เกณฑ์ร้อยละนักเรียนที่ถึงระดับ<input id="eh-s-pct" type="number" min="1" max="100" class="form-input eh-in" value="' + cfg.criterion.pct + '"></label>';
    h += '<label class="eh-lbl">เกณฑ์ความพึงพอใจ (ค่าเฉลี่ยขั้นต่ำ)<input id="eh-s-sat" type="number" step="0.01" class="form-input eh-in" value="' + cfg.satisfactionCriterion + '"></label>';
    h += '<label class="eh-lbl">ชื่อเส้นทาง (หนึ่งบรรทัดต่อเส้นทาง รูปแบบ <code>id|ชื่อ</code>)<textarea id="eh-s-pw" class="form-input eh-in" rows="5">' + this._esc(cfg.pathways.map(function (p) { return p.id + '|' + p.label; }).join('\n')) + '</textarea></label>';
    h += '<label class="eh-lbl">รายการตรวจต่อเส้นทาง (JSON ขั้นสูง)<textarea id="eh-s-cl" class="form-input eh-in" rows="8">' + this._esc(JSON.stringify(cfg.checklist, null, 1)) + '</textarea></label>';
    h += '<label class="eh-lbl">ข้อคำถามแบบสอบถาม (บรรทัดละข้อ <code>id|ด้าน|ข้อความ</code>)<textarea id="eh-s-qi" class="form-input eh-in" rows="6">' + this._esc(cfg.questionnaire.items.map(function (i) { return i.id + '|' + i.dim + '|' + i.text; }).join('\n')) + '</textarea></label>';
    h += '<div class="eh-row"><button class="btn-nav-action primary" onclick="EvidenceHub.saveSettings()">💾 บันทึกการตั้งค่า</button> <button class="btn-nav-action" onclick="EvidenceHub.resetSettings()">คืนค่าตั้งต้น</button></div></div>';
    h += '<p class="eh-note">ข้อมูลทั้งหมดอยู่ในเครื่องนี้ (localStorage) ไม่ถูกส่งไป Google Sheets หรือเซิร์ฟเวอร์ใด ๆ — ส่งออกเมื่อครูกดดาวน์โหลดเท่านั้น</p>';
    return h;
  },
  saveSettings: function () {
    var c = this.getConfig(), v = function (id) { return document.getElementById(id).value; }, err = [];
    c.alignmentLabel = v('eh-s-align').trim() || c.alignmentLabel;
    c.alignmentLabelConfirmed = !!document.getElementById('eh-s-alignok').checked;
    var cp = this._C().cleanPeriods(v('eh-s-clip').split(/[,\s]+/).filter(Boolean));
    if (cp.length) c.clip.periods = cp; else err.push('ช่วงคาบเก็บคลิปต้องมีอย่างน้อย 1 คาบ (1–20)');
    var lv = Number(v('eh-s-lv')), pc = Number(v('eh-s-pct')), st = Number(v('eh-s-sat'));
    if (lv >= 1 && lv <= c.criterion.maxLevel) c.criterion.level = lv; else err.push('ระดับไม่ถูกต้อง');
    if (pc >= 1 && pc <= 100) c.criterion.pct = pc; else err.push('ร้อยละไม่ถูกต้อง');
    if (st >= 1) c.satisfactionCriterion = st; else err.push('เกณฑ์ความพึงพอใจไม่ถูกต้อง');
    var pw = v('eh-s-pw').split(/\r?\n/).map(function (l) { var p = l.split('|'); return { id: (p[0] || '').trim(), label: p.slice(1).join('|').trim() }; }).filter(function (p) { return p.id && p.label; });
    if (pw.length) c.pathways = pw; else err.push('ต้องมีอย่างน้อย 1 เส้นทาง');
    try { var cl = JSON.parse(v('eh-s-cl')); if (cl && typeof cl === 'object') c.checklist = cl; } catch (e) { err.push('JSON รายการตรวจไม่ถูกต้อง'); }
    var qi = v('eh-s-qi').split(/\r?\n/).map(function (l) { var p = l.split('|'); return { id: (p[0] || '').trim(), dim: (p[1] || '').trim(), text: p.slice(2).join('|').trim() }; }).filter(function (i) { return i.id && i.dim && i.text; });
    var dimIds = c.questionnaire.dims.map(function (d) { return d.id; });
    if (qi.length && qi.every(function (i) { return dimIds.indexOf(i.dim) >= 0; })) { if (JSON.stringify(qi) !== JSON.stringify(c.questionnaire.items)) { c.questionnaire.items = qi; if (this.getResponses().length) err.push('แก้ข้อคำถามแล้ว: คำตอบเดิมอาจไม่ตรงกับข้อใหม่ ควรล้างคำตอบเดิม'); } } else err.push('ข้อคำถามต้องใช้ด้านที่มีอยู่: ' + dimIds.join(', '));
    this.saveConfig(c); this.state.msg = err.length ? '⚠ ' + err.join(' • ') : '✔ บันทึกการตั้งค่าแล้ว'; this.render();
  },
  resetSettings: function () { var ok = true; try { ok = confirm('คืนค่าตั้งต้น? (หลักฐาน/คำตอบไม่หาย)'); } catch (e) {} if (ok) { var salt = this.getConfig().pseudoSalt; Store.remove(this.KEYS.cfg); var c = this.getConfig(); c.pseudoSalt = salt; this.saveConfig(c); this.render(); } }
};
if (typeof window !== 'undefined') window.EvidenceHub = EvidenceHub;
if (typeof module !== 'undefined' && module.exports) module.exports = EvidenceHub;
