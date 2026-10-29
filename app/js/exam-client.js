// ==========================================================================
// MusicSmart • ห้องสอบกลางภาค/ปลายภาค (ฝั่งเบราว์เซอร์)
// หลักความปลอดภัย: ไฟล์นี้ "ไม่มีข้อสอบและไม่มีเฉลย"
//  - นักเรียน: ขอข้อสอบจาก Apps Script เมื่อห้องสอบเปิดเท่านั้น เก็บในหน่วยความจำ (ไม่ลง localStorage/Service Worker)
//  - ครู: เลือกไฟล์คลังข้อสอบจากเครื่อง (tools/exams_private/*.json) -> ดูตัวอย่าง -> อัปโหลดขึ้นเซิร์ฟเวอร์
//  - ออนไลน์เท่านั้น: ถ้าไม่มีอินเทอร์เน็ตจะไม่ขึ้นข้อสอบ
// ==========================================================================
const ExamClient = {
  KIND_LABEL: { midterm: 'สอบกลางภาค', final: 'สอบปลายภาค' },
  KINDS: ['midterm', 'final'],
  current: null,      // { attemptId, deadlineMs, offset, questions, kind } — เฉพาะในหน่วยความจำ
  _poll: null,
  _tick: null,
  _submitting: false,
  _bankDraft: null,   // ตัวอย่างคลังข้อสอบที่ครูเลือก (ในหน่วยความจำ)

  _esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  _fmt(ms) { return ms ? new Date(ms).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'; },

  // ---------------------------------------------------------------- ฟังก์ชันล้วน (ทดสอบได้)
  /** ตรวจรูปแบบไฟล์คลังข้อสอบ -> { ok, errors[], kind, items[], stats } */
  validateBank(bank) {
    const errors = [];
    if (!bank || typeof bank !== 'object') return { ok: false, errors: ['ไฟล์ไม่ใช่คลังข้อสอบ (JSON)'] };
    if (this.KINDS.indexOf(bank.kind) === -1) errors.push('ชนิดข้อสอบต้องเป็น midterm หรือ final');
    const items = Array.isArray(bank.items) ? bank.items : [];
    if (!items.length) errors.push('ไม่พบข้อสอบ');
    const seen = {};
    const byPeriod = {}, byDiff = {}, drafts = [];
    items.forEach((q, i) => {
      const n = i + 1;
      if (!q || !q.id || !q.question) { errors.push('ข้อ ' + n + ': ไม่มีรหัสหรือโจทย์'); return; }
      if (seen[q.id]) errors.push('ข้อ ' + n + ': รหัสซ้ำ');
      seen[q.id] = true;
      const ch = Array.isArray(q.choices) ? q.choices : [];
      if (ch.length < 3 || ch.length > 5) errors.push('ข้อ ' + n + ': ต้องมี 3-5 ตัวเลือก');
      if (!(Number(q.correctIndex) >= 0 && Number(q.correctIndex) < ch.length)) errors.push('ข้อ ' + n + ': ไม่มีเฉลยที่ถูกต้อง');
      byPeriod[q.srcPeriod] = (byPeriod[q.srcPeriod] || 0) + 1;
      byDiff[q.difficulty || '-'] = (byDiff[q.difficulty || '-'] || 0) + 1;
      if (/draft|รอครู/i.test(String(q.status || ''))) drafts.push(q.id);
    });
    const expected = Number(bank.itemsExpected) || 0;
    if (expected && items.length !== expected) errors.push('จำนวนข้อ ' + items.length + ' ไม่ตรงกับที่กำหนด ' + expected);
    return { ok: errors.length === 0, errors, kind: bank.kind, items, stats: { total: items.length, byPeriod, byDiff, drafts: drafts.length } };
  },

  /** เลือกผลที่ดีที่สุดต่อนักเรียน (คะแนนสูงสุด; เท่ากันใช้ครั้งล่าสุด) จากรายการ attempts ของครู */
  bestAttempts(attempts) {
    const best = {};
    (attempts || []).forEach(a => {
      if (!a || a.status !== 'submitted' || a.points === null || a.points === undefined) return;
      const k = String(a.studentId);
      const cur = best[k];
      if (!cur || a.points > cur.points || (a.points === cur.points && a.submittedMs > cur.submittedMs)) best[k] = a;
    });
    return best;
  },

  // ---------------------------------------------------------------- นักเรียน
  _student() { return (typeof StudentOutbox !== 'undefined' && StudentOutbox.currentStudent) ? StudentOutbox.currentStudent() : null; },
  _usable() { return !!(typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive && StudentOutbox.isActive() && typeof StudentAuth !== 'undefined'); },

  async _call(action, extra) {
    const u = this._student();
    if (!u || !StudentOutbox.sessionValid(u)) return { status: 'error', code: 'reauth', message: 'กรุณาเข้าสู่ระบบด้วย PIN อีกครั้ง' };
    if (this._cloud()) return this._cloudCall(action, extra);
    return StudentAuth._post(Object.assign({ action, sessionToken: u.sessionToken }, extra || {}));
  },

  _cloud() { return typeof StudentAuth !== 'undefined' && !!StudentAuth.isCloudMode && StudentAuth.isCloudMode() && typeof CloudApi !== 'undefined'; },

  // โหมด Cloud: แปลง action เดิมเป็น endpoint ของ Worker และคืนรูปแบบเดิม { status, ... }
  // เครือข่ายขัดข้อง (status 0) โยนต่อเพื่อให้หน้าจอแจ้ง "ต้องต่ออินเทอร์เน็ต" เหมือนเดิม
  async _cloudCall(action, extra) {
    const x = extra || {};
    const routes = {
      studentExamStatus: ['GET', '/api/exams/status'],
      studentExamStart: ['POST', '/api/exams/start'],
      studentExamSubmit: ['POST', '/api/exams/submit', { attemptId: x.attemptId, answers: x.answers }],
      exam_upload_bank: ['PUT', '/api/exams/bank', { kind: x.kind, items: x.items }],
      exam_open: ['POST', '/api/exams/sessions', x],
      exam_close: ['POST', '/api/exams/sessions/' + encodeURIComponent(x.sessionId || '') + '/close'],
      exam_sessions: ['GET', '/api/exams/sessions'],
      exam_results: ['GET', '/api/exams/results?sessionId=' + encodeURIComponent(x.sessionId || '')],
      exam_grant_retake: ['POST', '/api/exams/grants', x]
    };
    const rt = routes[action];
    if (!rt) return { status: 'error', code: 'unsupported', message: 'คำสั่งนี้ไม่รองรับในระบบใหม่' };
    try {
      return Object.assign({ status: 'success' }, await CloudApi.request(rt[0], rt[1], rt[2]));
    } catch (e) {
      if (e && e.status === 0) throw e;
      return { status: 'error', code: (e && e.code) || 'error', message: (e && e.message) || 'ไม่สำเร็จ' };
    }
  },

  mountStudent() {
    if (typeof document === 'undefined' || !document.getElementById('student-exam-card')) return;
    this.refreshStudent();
    if (!this._poll) this._poll = setInterval(() => { if (!this.current && document.visibilityState !== 'hidden') this.refreshStudent(); }, 45000);
  },

  _closedHtml(msg) {
    return '<div style="display:flex;align-items:center;gap:0.6rem;"><span style="font-size:1.2rem;">🔒</span><div style="font-weight:700;color:#475569;">' + this._esc(msg || 'ยังไม่เปิดสอบ') + '</div></div>';
  },

  async refreshStudent() {
    const host = document.getElementById('student-exam-card');
    if (!host || this.current) return;
    host.style.display = '';
    if (!this._usable()) { host.innerHTML = this._closedHtml('ยังไม่เปิดสอบ'); return; }
    let r;
    try { r = await this._call('studentExamStatus'); } catch (e) { host.innerHTML = this._closedHtml('ยังไม่เปิดสอบ (ตรวจสอบสถานะไม่ได้ — ต้องต่ออินเทอร์เน็ต)'); return; }
    if (!r || r.status !== 'success' || !r.open) { host.innerHTML = this._closedHtml('ยังไม่เปิดสอบ'); return; }
    const label = this.KIND_LABEL[r.kind] || 'สอบ';
    let html = '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
      '<div><div style="font-weight:800;color:#9a3412;">📝 เปิด' + this._esc(label) + 'แล้ว</div>' +
      '<div style="font-size:0.8rem;color:#7c2d12;">ปิดรับ ' + this._fmt(r.closeMs) + ' • เวลาทำ ' + Number(r.durationMin) + ' นาที • ' + Number(r.items) + ' ข้อ • เหลือสิทธิ์ ' + Number(r.attemptsLeft) + ' ครั้ง</div></div>';
    if (r.canStart) html += '<button type="button" class="btn-nav-action primary" id="exam-start-btn">' + (r.inProgress ? 'ทำข้อสอบต่อ' : 'เริ่มทำข้อสอบ') + '</button>';
    html += '</div>';
    if (r.last) html += '<div style="margin-top:0.5rem;font-size:0.85rem;color:#166534;font-weight:700;">ส่งแล้ว: ' + Number(r.last.points) + ' / ' + Number(r.last.maxPoints) + ' คะแนน (ระบบไม่แสดงเฉลย)</div>';
    host.innerHTML = html;
    const btn = document.getElementById('exam-start-btn');
    if (btn) btn.onclick = () => this.start();
  },

  async start() {
    const btn = document.getElementById('exam-start-btn'); if (btn) btn.disabled = true;
    let r;
    try { r = await this._call('studentExamStart'); } catch (e) { alert('เริ่มสอบไม่ได้ ต้องต่ออินเทอร์เน็ตแล้วลองใหม่'); if (btn) btn.disabled = false; return; }
    if (!r || r.status !== 'success') {
      alert((r && r.message) || 'เริ่มสอบไม่ได้');
      if (btn) btn.disabled = false;
      this.refreshStudent();
      return;
    }
    this.current = { attemptId: r.attemptId, kind: r.kind, deadlineMs: Number(r.deadlineMs), offset: Number(r.serverNow) - Date.now(), questions: r.questions || [], maxPoints: r.maxPoints };
    this._submitting = false;
    this._renderOverlay();
  },

  _renderOverlay() {
    let ov = document.getElementById('exam-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'exam-overlay'; document.body.appendChild(ov); }
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;overflow:auto;padding:1rem;';
    const c = this.current;
    ov.innerHTML = '<div style="max-width:760px;margin:0 auto;">' +
      '<div style="position:sticky;top:0;background:#fff;padding:0.5rem 0;border-bottom:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">' +
      '<div style="font-weight:800;">' + this._esc(this.KIND_LABEL[c.kind] || 'สอบ') + ' • ' + c.questions.length + ' ข้อ</div>' +
      '<div id="exam-timer" style="font-weight:800;color:#b91c1c;font-variant-numeric:tabular-nums;">--:--</div></div>' +
      c.questions.map((q, i) => '<div style="margin:1rem 0;padding:0.85rem;border:1px solid #e2e8f0;border-radius:10px;">' +
        '<div style="font-weight:700;margin-bottom:0.5rem;">' + (i + 1) + '. ' + this._esc(q.question) + '</div>' +
        (q.choices || []).map(ch => '<label style="display:block;padding:0.35rem 0;cursor:pointer;"><input type="radio" name="ex_' + this._esc(q.id) + '" value="' + this._esc(ch.key) + '"> ' + this._esc(ch.key) + '. ' + this._esc(ch.text) + '</label>').join('') +
        '</div>').join('') +
      '<button type="button" id="exam-submit-btn" class="btn-nav-action primary" style="width:100%;justify-content:center;margin-bottom:2rem;">ส่งคำตอบ ✅</button>' +
      '<div id="exam-msg" style="font-weight:700;margin-bottom:2rem;"></div></div>';
    document.getElementById('exam-submit-btn').onclick = () => this.submit(false);
    window.onbeforeunload = () => 'กำลังสอบอยู่ ต้องการออกจากหน้านี้หรือไม่?';
    clearInterval(this._tick);
    this._tick = setInterval(() => this._onTick(), 1000);
    this._onTick();
  },

  _remainingMs() { const c = this.current; return c ? c.deadlineMs - (Date.now() + c.offset) : 0; },

  _onTick() {
    const t = document.getElementById('exam-timer');
    const left = Math.max(0, this._remainingMs());
    if (t) { const s = Math.ceil(left / 1000); t.textContent = '⏱ ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    if (left <= 0 && this.current && !this._submitting) this.submit(true);
  },

  _collect() {
    const answers = {};
    ((this.current && this.current.questions) || []).forEach(q => {
      const el = document.querySelector('input[name="ex_' + (window.CSS && CSS.escape ? CSS.escape(q.id) : q.id) + '"]:checked');
      if (el) answers[q.id] = el.value;
    });
    return answers;
  },

  async submit(auto) {
    if (!this.current || this._submitting) return;
    const answers = this._collect();
    const total = this.current.questions.length;
    if (!auto && Object.keys(answers).length < total && !confirm('ตอบแล้ว ' + Object.keys(answers).length + '/' + total + ' ข้อ ต้องการส่งเลยหรือไม่?')) return;
    this._submitting = true;
    const msg = document.getElementById('exam-msg'); if (msg) msg.textContent = '⏳ กำลังส่งคำตอบ...';
    let r;
    try { r = await this._call('studentExamSubmit', { attemptId: this.current.attemptId, answers }); }
    catch (e) {
      this._submitting = false;
      if (msg) msg.textContent = '⚠️ ส่งไม่สำเร็จ (ออฟไลน์?) — คำตอบยังอยู่ในหน้านี้ ต่อเน็ตแล้วกดส่งอีกครั้งก่อนหมดเวลา';
      return;
    }
    if (r && r.status === 'success') { this._finish('<div style="font-size:2rem;font-weight:800;color:#166534;">' + Number(r.points) + ' / ' + Number(r.maxPoints) + '</div><div style="font-weight:700;">ส่งข้อสอบแล้ว • ตอบถูก ' + Number(r.correct) + ' / ' + Number(r.items) + ' ข้อ</div><div style="font-size:0.85rem;color:#475569;margin-top:0.5rem;">🔒 ระบบไม่แสดงเฉลย คุณครูจะเฉลยในชั้นเรียน</div>'); return; }
    this._submitting = false;
    if (r && (r.code === 'late' || r.code === 'closed')) { this._finish('<div style="font-weight:800;color:#b91c1c;">' + this._esc(r.message || 'หมดเวลาสอบแล้ว') + '</div><div style="font-size:0.85rem;margin-top:0.5rem;">กรุณาแจ้งคุณครู</div>'); return; }
    if (msg) msg.textContent = '⚠️ ' + ((r && r.message) || 'ส่งไม่สำเร็จ');
  },

  _finish(html) {
    clearInterval(this._tick); this._tick = null;
    window.onbeforeunload = null;
    this.current = null;   // ลบข้อสอบออกจากหน่วยความจำ
    const ov = document.getElementById('exam-overlay');
    if (ov) { ov.innerHTML = '<div style="max-width:520px;margin:4rem auto;text-align:center;padding:1.5rem;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;">' + html + '<button type="button" class="btn-nav-action primary" id="exam-close-btn" style="margin-top:1rem;">ปิด</button></div>'; document.getElementById('exam-close-btn').onclick = () => { ov.remove(); this.refreshStudent(); }; }
  },

  // ---------------------------------------------------------------- ครู
  _cfg() { return (typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.getConfig) ? GoogleSheetSync.getConfig() : {}; },
  async _tpost(action, extra) {
    if (this._cloud()) {
      if (!CloudApi.Auth.isTeacher()) return { status: 'error', message: 'กรุณาเข้าสู่ระบบครูก่อน' };
      try { return await this._cloudCall(action, extra); }
      catch (e) { return { status: 'error', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ต้องออนไลน์)' }; }
    }
    const cfg = this._cfg();
    if (!cfg.webAppUrl || !cfg.syncToken) return { status: 'error', message: 'ยังไม่ได้ตั้งค่า Google Sheet (URL และรหัสซิงค์) ในหน้าตั้งค่า' };
    try { return await StudentAuth._post(Object.assign({ action, token: cfg.syncToken }, extra || {}), cfg.webAppUrl); }
    catch (e) { return { status: 'error', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ต้องออนไลน์)' }; }
  },
  _classes() {
    const set = {};
    try { (Store.getRoster() || []).forEach(s => { if (s && s.class) set[s.class] = true; }); } catch (e) { /* ignore */ }
    return Object.keys(set).sort();
  },
  _say(msg, ok) { const el = document.getElementById('exam-admin-msg'); if (el) { el.textContent = msg; el.style.color = ok ? '#15803d' : '#b91c1c'; } },
  _localInput(ms) { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); },

  mountTeacher() {
    const host = typeof document !== 'undefined' ? document.getElementById('exam-admin-panel') : null;
    if (!host) return;
    const classes = this._classes();
    const now = Date.now();
    host.innerHTML = '<div style="font-weight:700;font-size:0.95rem;color:var(--ppk-navy-dark);margin-bottom:0.35rem;">ห้องสอบกลางภาค/ปลายภาค (ข้อสอบและเฉลยอยู่บนเซิร์ฟเวอร์ — นักเรียนเห็นเมื่อครูเปิดห้องสอบเท่านั้น)</div>' +
      '<p style="font-size:0.78rem;color:#64748b;margin-bottom:0.6rem;">ขั้นตอน: ① เลือกไฟล์คลังข้อสอบ (.json จากโฟลเดอร์ tools/exams_private) → ตรวจทาน ② อัปโหลด ③ เปิดห้องสอบรายห้อง ④ ดึงผลเข้าสมุดคะแนน (กลางภาค = คาบ 11, ปลายภาค = คาบ 20)</p>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin-bottom:0.5rem;"><input type="file" id="exam-bank-file" accept=".json,application/json" class="form-input" style="max-width:320px;"><button type="button" class="btn-nav-action" id="exam-bank-preview-btn">ดูตัวอย่าง</button></div>' +
      '<div id="exam-bank-preview"></div>' +
      '<div style="border-top:1px solid #e2e8f0;margin:0.75rem 0;"></div>' +
      '<div style="font-weight:700;font-size:0.85rem;margin-bottom:0.3rem;">เปิดห้องสอบ</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.5rem;margin-bottom:0.5rem;">' +
      '<div><label class="form-label">ชนิดข้อสอบ</label><select id="exam-open-kind" class="form-select"><option value="midterm">สอบกลางภาค</option><option value="final">สอบปลายภาค</option></select></div>' +
      '<div><label class="form-label">ห้องเรียน</label><select id="exam-open-class" class="form-select">' + classes.map(c => '<option>' + this._esc(c) + '</option>').join('') + '</select></div>' +
      '<div><label class="form-label">เริ่มเปิดสอบ</label><input id="exam-open-at" type="datetime-local" class="form-input" value="' + this._localInput(now) + '"></div>' +
      '<div><label class="form-label">ปิดรับ</label><input id="exam-close-at" type="datetime-local" class="form-input" value="' + this._localInput(now + 60 * 60000) + '"></div>' +
      '<div><label class="form-label">เวลาทำ (นาที)</label><input id="exam-duration" type="number" min="5" max="180" class="form-input" value="25"></div>' +
      '<div><label class="form-label">สอบได้กี่ครั้ง</label><select id="exam-attempts" class="form-select"><option value="1">1 ครั้ง</option><option value="2">2 ครั้ง</option><option value="3">3 ครั้ง</option></select></div></div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;"><button type="button" class="btn-complete-period" id="exam-open-btn">เปิดห้องสอบ</button><button type="button" class="btn-nav-action" id="exam-refresh-btn">รีเฟรชรายการห้องสอบ</button><span id="exam-admin-msg" style="font-size:0.8rem;"></span></div>' +
      '<div id="exam-sessions" style="margin-top:0.6rem;"></div><div id="exam-results" style="margin-top:0.6rem;"></div>';
    document.getElementById('exam-bank-preview-btn').onclick = () => this.previewBank();
    document.getElementById('exam-open-btn').onclick = () => this.openSession();
    document.getElementById('exam-refresh-btn').onclick = () => this.listSessions();
  },

  previewBank() {
    const input = document.getElementById('exam-bank-file'); const box = document.getElementById('exam-bank-preview');
    const f = input && input.files && input.files[0];
    if (!f) { this._say('เลือกไฟล์คลังข้อสอบก่อน', false); return; }
    const reader = new FileReader();
    reader.onload = () => {
      let json = null;
      try { json = JSON.parse(String(reader.result)); } catch (e) { this._say('ไฟล์ไม่ใช่ JSON', false); return; }
      const v = this.validateBank(json);
      this._bankDraft = v.ok ? json : null;
      if (!v.ok) { box.innerHTML = '<div style="color:#b91c1c;font-size:0.82rem;">' + v.errors.map(e => this._esc(e)).join('<br>') + '</div>'; return; }
      const periods = Object.keys(v.stats.byPeriod).sort((a, b) => a - b).map(p => 'คาบ ' + p + ': ' + v.stats.byPeriod[p]).join(' • ');
      const diffs = Object.keys(v.stats.byDiff).map(d => d + ' ' + v.stats.byDiff[d]).join(' • ');
      box.innerHTML = '<div style="font-size:0.82rem;margin-bottom:0.4rem;"><strong>' + this._esc(this.KIND_LABEL[json.kind]) + '</strong> ' + v.stats.total + ' ข้อ • ' + this._esc(periods) + ' • ความยาก: ' + this._esc(diffs) +
        (v.stats.drafts ? ' • <span style="color:#b45309;font-weight:700;">ฉบับร่าง รอครูตรวจ ' + v.stats.drafts + ' ข้อ</span>' : '') + '</div>' +
        '<div style="max-height:260px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem;font-size:0.8rem;">' + v.items.map((q, i) => '<div style="margin-bottom:0.5rem;"><strong>' + (i + 1) + '.</strong> ' + this._esc(q.question) + ' <span style="color:#64748b;">[คาบ ' + this._esc(q.srcPeriod) + ' • ' + this._esc(q.difficulty) + ']</span><br>' +
          q.choices.map((c, k) => '<span style="margin-right:0.6rem;' + (k === Number(q.correctIndex) ? 'color:#15803d;font-weight:700;' : '') + '">' + 'กขคงจ'[k] + '. ' + this._esc(c.text) + '</span>').join('') + '<br><em style="color:#64748b;">เหตุผล: ' + this._esc(q.explanation) + '</em></div>').join('') + '</div>' +
        '<label style="font-size:0.82rem;display:block;margin:0.5rem 0;"><input type="checkbox" id="exam-bank-reviewed"> ฉันตรวจทานข้อสอบและเฉลยชุดนี้แล้ว</label>' +
        '<button type="button" class="btn-complete-period" id="exam-bank-upload-btn">อัปโหลดคลังข้อสอบขึ้นเซิร์ฟเวอร์</button>';
      document.getElementById('exam-bank-upload-btn').onclick = () => this.uploadBank();
    };
    reader.readAsText(f, 'utf-8');
  },

  async uploadBank() {
    const bank = this._bankDraft;
    if (!bank) { this._say('ยังไม่มีคลังข้อสอบที่ตรวจรูปแบบผ่าน', false); return; }
    const chk = document.getElementById('exam-bank-reviewed');
    if (!chk || !chk.checked) { this._say('ต้องติ๊กยืนยันว่าตรวจทานข้อสอบแล้ว', false); return; }
    const items = bank.items.map(q => ({ id: q.id, question: q.question, choices: q.choices.map(c => ({ text: c.text })), correctIndex: q.correctIndex,
      explanation: q.explanation, srcPeriod: q.srcPeriod, srcObjective: q.srcObjective, difficulty: q.difficulty, status: 'teacher_reviewed' }));
    this._say('กำลังอัปโหลด...', true);
    const r = await this._tpost('exam_upload_bank', { kind: bank.kind, items });
    this._say(r.status === 'success' ? '✅ อัปโหลดแล้ว ' + r.items + ' ข้อ (' + (this.KIND_LABEL[r.kind] || r.kind) + ')' : (r.message || 'อัปโหลดไม่สำเร็จ'), r.status === 'success');
    if (r.status === 'success') { this._bankDraft = null; const box = document.getElementById('exam-bank-preview'); if (box) box.innerHTML = ''; }
  },

  async openSession() {
    const g = id => document.getElementById(id);
    const openAt = new Date(g('exam-open-at').value).getTime(), closeAt = new Date(g('exam-close-at').value).getTime();
    const r = await this._tpost('exam_open', { kind: g('exam-open-kind').value, className: g('exam-open-class').value, openAt, closeAt,
      durationMin: Number(g('exam-duration').value), maxAttempts: Number(g('exam-attempts').value) });
    this._say(r.status === 'success' ? '✅ เปิดห้องสอบแล้ว (' + r.items + ' ข้อ)' : (r.message || 'เปิดห้องสอบไม่สำเร็จ'), r.status === 'success');
    if (r.status === 'success') this.listSessions();
  },

  async listSessions() {
    const box = document.getElementById('exam-sessions');
    const r = await this._tpost('exam_sessions', {});
    if (r.status !== 'success') { this._say(r.message || 'ดึงรายการไม่สำเร็จ', false); return; }
    const stateTh = { scheduled: 'รอเปิด', open: 'เปิดอยู่', closed: 'ปิดแล้ว', ended: 'หมดเวลา' };
    box.innerHTML = r.sessions.length ? '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;"><tr style="text-align:left;"><th>ชนิด</th><th>ห้อง</th><th>ช่วงเวลา</th><th>สถานะ</th><th>ส่งแล้ว</th><th></th></tr>' +
      r.sessions.slice().reverse().map(s => '<tr style="border-top:1px solid #e2e8f0;"><td>' + this._esc(this.KIND_LABEL[s.kind] || s.kind) + '</td><td>' + this._esc(s.className) + '</td><td>' + this._fmt(s.openMs) + ' – ' + this._fmt(s.closeMs) + '</td><td>' + stateTh[s.state] + '</td><td>' + s.submitted + (s.inProgress ? ' (กำลังทำ ' + s.inProgress + ')' : '') + '</td><td>' +
        (s.state === 'open' || s.state === 'scheduled' ? '<button type="button" class="btn-nav-action" data-exam-close="' + this._esc(s.sessionId) + '">ปิดห้องสอบ</button> ' : '') +
        '<button type="button" class="btn-nav-action" data-exam-results="' + this._esc(s.sessionId) + '" data-kind="' + this._esc(s.kind) + '" data-class="' + this._esc(s.className) + '">ผลสอบ/นำเข้าสมุดคะแนน</button></td></tr>').join('') + '</table>' : '<div style="font-size:0.8rem;color:#64748b;">ยังไม่มีห้องสอบ</div>';
    box.querySelectorAll('[data-exam-close]').forEach(b => { b.onclick = async () => { const x = await this._tpost('exam_close', { sessionId: b.getAttribute('data-exam-close') }); this._say(x.status === 'success' ? 'ปิดห้องสอบแล้ว' : (x.message || 'ปิดไม่สำเร็จ'), x.status === 'success'); this.listSessions(); }; });
    box.querySelectorAll('[data-exam-results]').forEach(b => { b.onclick = () => this.showResults(b.getAttribute('data-exam-results'), b.getAttribute('data-kind'), b.getAttribute('data-class')); });
  },

  async showResults(sessionId, kind, className) {
    const box = document.getElementById('exam-results');
    const r = await this._tpost('exam_results', { sessionId });
    if (r.status !== 'success') { this._say(r.message || 'ดึงผลไม่สำเร็จ', false); return; }
    const best = this.bestAttempts(r.attempts);
    const applied = (typeof Store !== 'undefined' && Store.applyExamResults) ? Store.applyExamResults(className, kind, Object.keys(best).map(k => best[k])) : { applied: 0 };
    const rows = Object.keys(best).map(k => best[k]).sort((a, b) => Number(a.no) - Number(b.no));
    const nameOf = a => a.name || a.studentId;
    const inProg = r.attempts.filter(a => a.status === 'in_progress').length;
    box.innerHTML = '<div style="font-size:0.82rem;font-weight:700;margin-bottom:0.3rem;">ผลสอบ ' + this._esc(this.KIND_LABEL[kind] || kind) + ' ห้อง ' + this._esc(className) + ' — นำเข้าสมุดคะแนนแล้ว ' + applied.applied + ' คน (ใช้คะแนนครั้งที่ดีที่สุด)' + (inProg ? ' • ยังทำอยู่ ' + inProg + ' คน' : '') + '</div>' +
      '<table style="width:100%;font-size:0.8rem;border-collapse:collapse;"><tr style="text-align:left;"><th>เลขที่</th><th>ชื่อ</th><th>คะแนน</th><th>ถูก</th><th>ระดับ</th><th>ผลผ่าน (≥50%)</th><th>ครั้งที่</th><th></th></tr>' +
      (rows.map(a => '<tr style="border-top:1px solid #e2e8f0;"><td>' + this._esc(a.no) + '</td><td>' + this._esc(nameOf(a)) + '</td><td>' + a.points + '</td><td>' + a.correct + '/' + a.items + '</td><td>' + a.level + '</td><td>' + (a.points >= 5 ? '✅ ผ่าน' : '❌ ต้องสอบซ่อม') + '</td><td>' + a.attemptNo + '</td><td>' +
        (a.points < 5 ? '<button type="button" class="btn-nav-action" data-exam-retake="' + this._esc(a.studentId) + '">ให้สิทธิ์สอบซ่อม</button>' : '') + '</td></tr>').join('') || '<tr><td colspan="8">ยังไม่มีผู้ส่งข้อสอบ</td></tr>') + '</table>';
    box.querySelectorAll('[data-exam-retake]').forEach(b => { b.onclick = async () => { const x = await this._tpost('exam_grant_retake', { sessionId, studentId: b.getAttribute('data-exam-retake'), extra: 1 }); this._say(x.status === 'success' ? 'ให้สิทธิ์สอบซ่อมแล้ว (นักเรียนเข้าสอบได้อีก 1 ครั้งขณะห้องสอบยังเปิด)' : (x.message || 'ไม่สำเร็จ'), x.status === 'success'); }; });
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = ExamClient;
