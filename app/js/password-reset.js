// ==========================================================================
// MusicSmart • ลืมรหัสผ่าน / PIN (ทุกบทบาท)
// 1) มีอีเมลที่ลงทะเบียนไว้ (ครู/แอดมิน, นศ.ฝึกสอน, นักเรียนที่ผูกอีเมลแล้ว):
//    ขอรหัสยืนยัน 6 หลักทางอีเมล → กรอกรหัส + ตั้งรหัสใหม่เอง
// 2) นักเรียน/นศ. ที่ไม่มีอีเมล: ระบบส่งคำขอถึงครู → ครูกด "ยืนยันและออกรหัส" ในแผงครู
//    → ครูแจ้งรหัสยืนยันให้ผู้ใช้ → ผู้ใช้กรอกรหัสแล้วตั้งรหัสใหม่เอง (ครูไม่เห็น/ไม่ตั้งรหัสให้)
// - นักเรียนผูกอีเมลของตัวเองได้หลังเข้าสู่ระบบ (ยืนยันเจ้าของอีเมลด้วยรหัสก่อนบันทึก)
// ==========================================================================
const PasswordReset = {
  POLL_MS: 5 * 60 * 1000,
  _state: null,
  _timer: null,

  esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  _el(id) { return document.getElementById(id); },
  _net(e) { return { success: false, code: 'network', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' }; },
  _hasServer() { return typeof StudentAuth !== 'undefined' && StudentAuth.isServerMode && StudentAuth.isServerMode(); },
  _norm(r) { return Object.assign({ success: r && r.status === 'success' }, r || {}); },

  // ---------------- API (public: ไม่ต้องใช้รหัสซิงค์) ----------------
  // kind: 'student' | 'staff' (ครู/แอดมิน/นศ.ฝึกสอน) · via: 'email' | 'teacher'
  _cloud() { return typeof StudentAuth !== 'undefined' && !!StudentAuth.isCloudMode && StudentAuth.isCloudMode() && typeof CloudApi !== 'undefined'; },
  // โหมด Cloud: ไม่มีอีเมล — ทุกคำขอไปที่ครู; คืนรูปแบบเดิม { success, ... } (เครือข่ายขัดข้อง = ข้อความเดิม)
  async _cloudCall(method, path, body, anonymous) {
    try { return Object.assign({ success: true, status: 'success' }, await CloudApi.request(method, path, body, anonymous ? { anonymous: true } : undefined)); }
    catch (e) {
      if (e && e.status === 0) return this._net(e);
      return { success: false, status: 'error', code: (e && e.code) || 'error', message: (e && e.message) || 'ไม่สำเร็จ' };
    }
  },
  async requestReset(kind, id, via) {
    if (this._cloud()) return this._cloudCall('POST', '/api/pin-reset/request', { role: kind === 'student' ? 'student' : 'staff', id: String(id || '').trim() }, true);
    if (!this._hasServer()) return { success: false, code: 'no_server', message: 'ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ (Apps Script) จึงรีเซ็ตด้วยตนเองไม่ได้ — กรุณาติดต่อครูประจำวิชา' };
    try { return this._norm(await StudentAuth._post({ action: 'resetRequest', role: kind, id: String(id || '').trim(), via: via === 'teacher' ? 'teacher' : 'email' })); }
    catch (e) { return this._net(e); }
  },
  async confirmReset(kind, id, code, secret) {
    if (this._cloud()) {
      const r = await this._cloudCall('POST', '/api/pin-reset/confirm', { role: kind === 'student' ? 'student' : 'staff', id: String(id || '').trim(), code: String(code || '').replace(/\s+/g, ''), secret: String(secret || '') }, true);
      if (r.success) this.syncLocalSecret(kind, id, secret);
      return r;
    }
    if (!this._hasServer()) return { success: false, code: 'no_server', message: 'ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์' };
    try {
      const r = this._norm(await StudentAuth._post({ action: 'resetConfirm', role: kind, id: String(id || '').trim(), code: String(code || '').replace(/\s+/g, ''), secret: String(secret || '') }));
      if (r.success) this.syncLocalSecret(kind, id, secret);
      return r;
    } catch (e) { return this._net(e); }
  },

  _session() { const u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null; return u && u.role === 'student' ? u.sessionToken : ''; },
  async emailStatus() {
    if (this._cloud()) return { success: false, code: 'no_email', message: 'ระบบใหม่ไม่ใช้อีเมลกู้ PIN — หากลืม PIN ให้กด "ลืมรหัส PIN?" แล้วขอให้ครูรีเซ็ตให้' };
    const t = this._session(); if (!t) return { success: false, code: 'no_session', message: 'กรุณาเข้าสู่ระบบก่อน' };
    try { return this._norm(await StudentAuth._post({ action: 'studentEmailStatus', sessionToken: t })); } catch (e) { return this._net(e); }
  },
  async emailStart(email) {
    const t = this._session(); if (!t) return { success: false, code: 'no_session', message: 'กรุณาเข้าสู่ระบบก่อน' };
    try { return this._norm(await StudentAuth._post({ action: 'studentEmailStart', sessionToken: t, email: String(email || '').trim() })); } catch (e) { return this._net(e); }
  },
  async emailConfirm(code) {
    const t = this._session(); if (!t) return { success: false, code: 'no_session', message: 'กรุณาเข้าสู่ระบบก่อน' };
    try { return this._norm(await StudentAuth._post({ action: 'studentEmailConfirm', sessionToken: t, code: String(code || '').replace(/\s+/g, '') })); } catch (e) { return this._net(e); }
  },

  // ---------------- API (ครู: ใช้รหัสซิงค์ของเครื่องครู) ----------------
  _teacherPost(body) {
    if (typeof GoogleSheetSync === 'undefined') return Promise.reject(new Error('ไม่พบระบบซิงค์'));
    const cfg = GoogleSheetSync.getConfig();
    if (!cfg.webAppUrl || !cfg.syncToken) return Promise.reject(new Error('กรุณาตั้งค่า URL และรหัสซิงค์ในหน้าต่าง "ซิงค์คู่ Google Sheets" ก่อน'));
    return GoogleSheetSync.postJSON(cfg.webAppUrl, body);
  },
  async listRequests() {
    if (this._cloud()) { const r = await CloudApi.request('GET', '/api/pin-reset/requests'); return r.requests || []; }
    const r = await this._teacherPost({ action: 'list_reset_requests' }); return r.requests || [];
  },
  async decide(requestId, approve) {
    if (this._cloud()) return Object.assign({ status: 'success' }, await CloudApi.request('POST', '/api/pin-reset/requests/' + encodeURIComponent(requestId) + '/decide', { approve: !!approve }));
    return this._teacherPost({ action: 'decide_reset_request', requestId, approve: !!approve });
  },

  // รหัสใหม่ที่เพิ่งตั้ง ต้องใช้ได้กับบัญชีที่เก็บไว้ในเครื่องนี้ด้วย (ไม่เช่นนั้นรหัสเก่ายังเข้าได้จากข้อมูลในเครื่อง)
  syncLocalSecret(kind, id, secret) {
    try {
      if (kind !== 'staff' || typeof Store === 'undefined' || !Store.getTeachersList || !Store.upgradeTeacherSecret) return;
      const key = String(id || '').trim().toLowerCase();
      const acc = Store.getTeacherAccount ? Store.getTeacherAccount() : {};
      Store.getTeachersList().forEach(t => {
        const hit = String(t.email || '').toLowerCase() === key || String(t.internId || '').toLowerCase() === key || String(t.id || '').toLowerCase() === 'intern_' + key ||
          (t.id === 'admin_primary' && String(acc.email || '').toLowerCase() === key);
        if (hit) Store.upgradeTeacherSecret(t.id, secret);
      });
      if (String(acc.email || '').toLowerCase() === key) Store.upgradeTeacherSecret('admin_primary', secret);
      if (typeof TeacherAuth !== 'undefined' && TeacherAuth.OFFLINE_KEY) localStorage.removeItem(TeacherAuth.OFFLINE_KEY);
    } catch (e) { /* ไม่ให้ขั้นตอนนี้ทำให้การรีเซ็ตล้ม */ }
  },

  // ---------------- UI: ผู้ใช้ลืมรหัส ----------------
  openStudent(prefillId) {
    const id = prefillId !== undefined ? prefillId : ((this._el('auth-student-id') || {}).value || '');
    this._state = { kind: 'student', step: 'request', id: String(id || '').trim(), msg: '', info: '', busy: false };
    this._modal(); this._render();
  },
  openStaff(prefillId) {
    const id = prefillId !== undefined ? prefillId : ((this._el('auth-teacher-email') || {}).value || '');
    this._state = { kind: 'staff', step: 'request', id: String(id || '').trim(), msg: '', info: '', busy: false };
    this._modal(); this._render();
  },
  close() { const m = this._el('modal-password-reset'); if (m) m.classList.remove('active'); },

  _modal() {
    let m = this._el('modal-password-reset');
    if (!m) {
      m = document.createElement('div'); m.id = 'modal-password-reset'; m.className = 'modal-overlay'; m.style.zIndex = '100012';
      document.body.appendChild(m);
    }
    m.classList.add('active');
    return m;
  },

  _render() {
    const m = this._el('modal-password-reset'); if (!m || !this._state) return;
    const s = this._state, e = this.esc.bind(this), stu = s.kind === 'student';
    const idLabel = stu ? 'รหัสประจำตัวนักเรียน' : 'อีเมล หรือ รหัสนักศึกษา (นศ.ฝึกสอน)';
    const idInput = `<input id="pr-id" class="form-input" value="${e(s.id)}" placeholder="${stu ? 'เลขประจำตัว 5 หลัก' : 'อีเมลครู / อีเมลหรือรหัส นศ.'}" ${stu ? 'inputmode="numeric" maxlength="10"' : 'autocomplete="username"'} ${s.step !== 'request' ? 'readonly style="background:#f1f5f9;"' : ''}>`;
    let body = '';
    const cloud = this._cloud();
    if (s.step === 'request' && cloud) {
      body = `<div style="color:#475569;">ใส่${stu ? 'รหัสนักเรียน' : 'รหัสนักศึกษา'} ระบบจะส่งคำขอถึงครูประจำวิชา ครูจะตรวจสอบว่าเป็นตัวคุณจริง แล้วแจ้ง <b>รหัสยืนยัน 6 หลัก</b> ให้ จากนั้นคุณตั้ง ${stu ? 'PIN' : 'PIN'} ใหม่ได้ด้วยตัวเอง</div>
        <label class="form-label">${stu ? idLabel : 'รหัสนักศึกษา (นศ.ฝึกสอน)'}</label>${idInput}
        <button class="btn-nav-action primary" id="pr-send" style="justify-content:center;">📨 ส่งคำขอถึงครู</button>
        <a href="#" id="pr-have" style="font-size:0.82rem;color:#0284c7;text-align:center;">มีรหัสยืนยันจากครูแล้ว → ตั้งรหัสใหม่</a>`;
    } else if (s.step === 'request') {
      body = `<div style="color:#475569;">${stu
        ? 'ใส่รหัสนักเรียน ระบบจะส่งรหัสยืนยันไปที่อีเมลที่คุณผูกไว้ <b>หากยังไม่ได้ผูกอีเมล</b> ระบบจะส่งคำขอถึงครูประจำวิชา แล้วครูจะแจ้งรหัสยืนยันให้คุณ'
        : 'ระบบจะส่งรหัสยืนยัน 6 หลักไปที่อีเมลที่ลงทะเบียนไว้ (ครู/แอดมิน และ นศ.ฝึกสอนที่ลงทะเบียนด้วยอีเมล)'}</div>
        <label class="form-label">${idLabel}</label>${idInput}
        <button class="btn-nav-action primary" id="pr-send" style="justify-content:center;">📧 ขอรหัสยืนยัน</button>
        <a href="#" id="pr-have" style="font-size:0.82rem;color:#0284c7;text-align:center;">มีรหัสยืนยันแล้ว (จากอีเมล/จากครู) → ตั้งรหัสใหม่</a>
        ${stu ? '' : '<button class="btn-nav-action" id="pr-askteacher" style="justify-content:center;font-size:0.82rem;">👩‍🏫 นศ.ฝึกสอน: ไม่มีอีเมล/ไม่ได้รับอีเมล → ขอให้ครูรีเซ็ตให้</button>'}`;
    } else if (s.step === 'wait') {
      body = `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:0.8rem;color:#78350f;line-height:1.55;">
        <b>📨 ส่งคำขอรีเซ็ตถึงครูประจำวิชาแล้ว</b><br>${e(s.info || 'กรุณาติดต่อครูประจำวิชาเพื่อขอรับรหัสยืนยัน')}<br>
        <span style="font-size:0.82rem;">เมื่อครูกดยืนยัน ครูจะแจ้ง <b>รหัสยืนยัน 6 หลัก</b> ให้คุณ (ใช้ได้ 24 ชั่วโมง) แล้วกลับมากดปุ่มด้านล่างเพื่อตั้ง${stu ? ' PIN' : 'รหัส'}ใหม่ด้วยตัวเอง</span></div>
        <button class="btn-nav-action primary" id="pr-have2" style="justify-content:center;">✅ ได้รับรหัสยืนยันจากครูแล้ว → ตั้งรหัสใหม่</button>`;
    } else {
      const pwLabel = (stu || cloud) ? 'PIN ใหม่ 6 หลัก (ตัวเลข ห้ามซ้ำ/เรียง)' : 'รหัสผ่านใหม่ (ครู ≥ 8 ตัวอักษร / นศ. PIN 6 หลัก)';
      body = `${s.info ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:0.6rem 0.8rem;color:#065f46;">${e(s.info)}</div>` : ''}
        <label class="form-label">${idLabel}</label>${idInput}
        <label class="form-label">รหัสยืนยัน 6 หลัก</label>
        <input id="pr-code" class="form-input" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code" style="letter-spacing:6px;text-align:center;font-weight:800;font-size:1.15rem;">
        <label class="form-label">${pwLabel}</label>
        <input id="pr-pw" type="password" class="form-input" ${stu ? 'inputmode="numeric" maxlength="6"' : ''} autocomplete="new-password">
        <input id="pr-pw2" type="password" class="form-input" placeholder="ยืนยันรหัสใหม่อีกครั้ง" ${stu ? 'inputmode="numeric" maxlength="6"' : ''} autocomplete="new-password">
        <button class="btn-nav-action primary" id="pr-save" style="justify-content:center;">💾 ตั้งรหัสใหม่</button>
        ${cloud ? '<a href="#" id="pr-askteacher2" style="font-size:0.82rem;color:#0284c7;text-align:center;">ยังไม่มีรหัส/รหัสหมดอายุ → ส่งคำขอถึงครูอีกครั้ง</a>' : `<a href="#" id="pr-resend" style="font-size:0.82rem;color:#0284c7;text-align:center;">ไม่ได้รับรหัส? ขออีเมลอีกครั้ง</a>
        ${stu ? '<a href="#" id="pr-askteacher2" style="font-size:0.82rem;color:#0284c7;text-align:center;">ไม่มี/ใช้อีเมลไม่ได้ → ขอให้ครูรีเซ็ตให้</a>' : '<a href="#" id="pr-askteacher2" style="font-size:0.82rem;color:#0284c7;text-align:center;">นศ.ฝึกสอน: ขอให้ครูรีเซ็ตให้</a>'}`}`;
    }
    m.innerHTML = `<div class="modal-card" style="max-width:440px;width:94vw;"><div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;">
      <h3 class="modal-title" style="margin:0;">🔑 ลืม${stu ? ' PIN' : 'รหัสผ่าน / PIN'}</h3><button class="btn-nav-action" id="pr-close">✕</button></div>
      <div class="modal-body" style="display:grid;gap:0.55rem;font-size:0.88rem;">${body}
        <div id="pr-msg" role="alert" style="${s.msg ? '' : 'display:none;'}background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:0.55rem 0.75rem;font-weight:600;">${e(s.msg)}</div></div></div>`;
    this._wire(m);
  },

  _wire(m) {
    const s = this._state, q = sel => m.querySelector(sel), on = (sel, fn) => { const el = q(sel); if (el) el.onclick = ev => { ev.preventDefault(); fn(); }; };
    const idv = () => String((q('#pr-id') || {}).value || s.id || '').trim();
    const go = (step, extra) => { Object.assign(s, { step, msg: '' }, extra || {}); this._render(); };
    const fail = msg => { s.msg = msg; const el = q('#pr-msg'); if (el) { el.textContent = msg; el.style.display = ''; } s.busy = false; };
    const busy = (btn, on2) => { if (btn) { btn.disabled = on2; btn.style.opacity = on2 ? '0.6' : ''; } };
    on('#pr-close', () => this.close());
    const request = async (via, btn) => {
      const id = idv(); s.id = id;
      if (!id) { fail(s.kind === 'student' ? 'กรุณาใส่รหัสนักเรียน' : 'กรุณาใส่อีเมลหรือรหัสนักศึกษา'); return; }
      busy(btn, true);
      const r = await this.requestReset(s.kind, id, via);
      busy(btn, false);
      if (!r.success) { fail(r.message || 'ส่งคำขอไม่สำเร็จ'); return; }
      if (r.mode === 'teacher') { go('wait', { info: r.message || '' }); return; }
      const where = r.maskedEmail ? `ส่งรหัสยืนยันไปที่ ${r.maskedEmail} แล้ว` : 'หากมีบัญชีนี้ ระบบส่งรหัสยืนยันไปที่อีเมลที่ลงทะเบียนไว้แล้ว';
      go('verify', { info: `${where} (ใช้ได้ ${r.expiresMin || 15} นาที — ตรวจกล่องจดหมายขยะด้วย)` });
    };
    on('#pr-send', () => request('email', q('#pr-send')));
    on('#pr-askteacher', () => request('teacher', q('#pr-askteacher')));
    on('#pr-askteacher2', () => request('teacher'));
    on('#pr-resend', () => request('email'));
    const haveCode = () => { const id = idv(); if (!id) { fail(s.kind === 'student' ? 'กรุณาใส่รหัสนักเรียนก่อน' : 'กรุณาใส่อีเมลหรือรหัสนักศึกษาก่อน'); return; } s.id = id; go('verify', { info: '' }); };
    on('#pr-have', haveCode); on('#pr-have2', () => go('verify', { info: '' }));
    const idEl = q('#pr-id'); if (idEl) idEl.onkeydown = ev => { if (ev.key === 'Enter' && s.step === 'request') request('email', q('#pr-send')); };
    on('#pr-save', async () => {
      const code = String((q('#pr-code') || {}).value || '').trim(), pw = String((q('#pr-pw') || {}).value || '').trim(), pw2 = String((q('#pr-pw2') || {}).value || '').trim();
      if (!/^\d{6}$/.test(code)) { fail('กรุณากรอกรหัสยืนยัน 6 หลัก'); return; }
      if (pw !== pw2) { fail('รหัสใหม่ทั้งสองช่องไม่ตรงกัน'); return; }
      if (s.kind === 'student' && !/^\d{6}$/.test(pw)) { fail('PIN ต้องเป็นตัวเลข 6 หลัก'); return; }
      if (s.kind === 'staff' && !/^\d{6}$/.test(pw) && pw.length < 8) { fail('รหัสผ่านครูต้องยาวอย่างน้อย 8 ตัวอักษร (หรือ PIN 6 หลักสำหรับ นศ.ฝึกสอน)'); return; }
      const btn = q('#pr-save'); busy(btn, true);
      const r = await this.confirmReset(s.kind, idv(), code, pw);
      busy(btn, false);
      if (!r.success) { fail(r.message || 'ตั้งรหัสไม่สำเร็จ'); return; }
      this.close();
      this._afterSuccess(s.kind, idv());
    });
  },

  _afterSuccess(kind, id) {
    if (kind === 'student') {
      const el = this._el('auth-student-id');
      if (el) { el.value = id; if (typeof App !== 'undefined' && App.onAuthStudentIdInput) App.onAuthStudentIdInput(id); }
      setTimeout(() => { const p = this._el('auth-student-pin'); if (p) p.focus(); }, 300);
    } else {
      const el = this._el('auth-teacher-email'); if (el) el.value = id;
      const sec = this._el('auth-teacher-secret'); if (sec) { sec.value = ''; setTimeout(() => sec.focus(), 100); }
    }
    alert('✅ ตั้งรหัสใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่');
  },

  // ---------------- UI: นักเรียนผูกอีเมล (หลังเข้าสู่ระบบ) ----------------
  async openStudentEmail() {
    const m = this._modal();
    if (this._cloud()) {
      m.innerHTML = '<div class="modal-card" style="max-width:420px;width:94vw;"><div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;"><h3 class="modal-title" style="margin:0;">🔑 กู้ PIN เมื่อลืม</h3><button class="btn-nav-action" id="pe-close">✕</button></div>' +
        '<div class="modal-body" style="display:grid;gap:0.55rem;font-size:0.88rem;color:#475569;">ระบบนี้ไม่ต้องผูกอีเมล หากลืม PIN ให้กด <b>"ลืมรหัส PIN?"</b> ที่หน้าเข้าสู่ระบบ ระบบจะส่งคำขอถึงครู ครูจะแจ้งรหัสยืนยัน 6 หลักให้ แล้วคุณตั้ง PIN ใหม่ได้ด้วยตัวเอง</div></div>';
      m.querySelector('#pe-close').onclick = () => m.classList.remove('active');
      return;
    }
    m.innerHTML = '<div class="modal-card" style="max-width:420px;"><div class="modal-body">⏳ กำลังตรวจสอบ...</div></div>';
    const st = await this.emailStatus();
    this._renderEmail(m, st.success ? st : { hasEmail: false, error: st.message });
  },
  _renderEmail(m, st, step, note) {
    const e = this.esc.bind(this);
    const head = st.hasEmail ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:0.6rem 0.8rem;color:#065f46;">✅ ผูกอีเมลแล้ว: <b>${e(st.maskedEmail)}</b><br><span style="font-size:0.8rem;">ใช้กู้ PIN ได้เองเมื่อลืม (เปลี่ยนอีเมลได้โดยยืนยันอีเมลใหม่)</span></div>`
      : '<div style="color:#475569;">ผูกอีเมลของคุณไว้ เมื่อลืม PIN จะกู้ได้เองทันทีโดยไม่ต้องรอครู (ถ้าไม่มีอีเมลก็ใช้วิธีขอให้ครูรีเซ็ตได้)</div>';
    const form = step === 'code'
      ? `<div style="color:#065f46;">${e(note || '')}</div><input id="pe-code" class="form-input" inputmode="numeric" maxlength="6" placeholder="รหัสยืนยัน 6 หลักจากอีเมล" style="letter-spacing:5px;text-align:center;font-weight:800;"><button class="btn-nav-action primary" id="pe-confirm" style="justify-content:center;">✅ ยืนยันอีเมล</button>`
      : `<input id="pe-email" type="email" class="form-input" placeholder="อีเมลของคุณ (เช่น name@gmail.com)" autocomplete="email"><button class="btn-nav-action primary" id="pe-start" style="justify-content:center;">📧 ส่งรหัสยืนยันไปที่อีเมลนี้</button>`;
    m.innerHTML = `<div class="modal-card" style="max-width:420px;width:94vw;"><div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;"><h3 class="modal-title" style="margin:0;">✉️ อีเมลสำหรับกู้ PIN</h3><button class="btn-nav-action" id="pe-close">✕</button></div>
      <div class="modal-body" style="display:grid;gap:0.55rem;font-size:0.88rem;">${head}${st.error ? `<div style="color:#b91c1c;">${e(st.error)}</div>` : ''}${form}
      <div id="pe-msg" role="alert" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:8px;padding:0.55rem 0.75rem;font-weight:600;"></div></div></div>`;
    const q = s => m.querySelector(s), fail = t => { const el = q('#pe-msg'); el.textContent = t; el.style.display = ''; };
    q('#pe-close').onclick = () => m.classList.remove('active');
    if (q('#pe-start')) q('#pe-start').onclick = async () => {
      const r = await this.emailStart(q('#pe-email').value);
      if (!r.success) { fail(r.message || 'ส่งรหัสไม่สำเร็จ'); return; }
      this._renderEmail(m, st, 'code', `ส่งรหัสไปที่ ${r.maskedEmail} แล้ว (ใช้ได้ ${r.expiresMin || 15} นาที)`);
    };
    if (q('#pe-confirm')) q('#pe-confirm').onclick = async () => {
      const r = await this.emailConfirm(q('#pe-code').value);
      if (!r.success) { fail(r.message || 'ยืนยันไม่สำเร็จ'); return; }
      this._renderEmail(m, { hasEmail: true, maskedEmail: r.maskedEmail });
    };
  },

  // ---------------- UI: ครู — คำขอรีเซ็ตรหัสจากนักเรียน/นศ. ----------------
  _fmt(ms) { try { return new Date(Number(ms)).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } },

  async renderQueue(containerId) {
    const box = this._el(containerId || 'pin-reset-requests'); if (!box) return;
    const e = this.esc.bind(this);
    box.innerHTML = '<div style="color:#64748b;font-size:0.82rem;">⏳ กำลังโหลดคำขอรีเซ็ตรหัส...</div>';
    let list;
    try { list = await this.listRequests(); }
    catch (err) { box.innerHTML = `<div style="color:#64748b;font-size:0.82rem;">ℹ️ ดูคำขอรีเซ็ตรหัสไม่ได้: ${e(err.message)}</div>`; return; }
    const rows = list.map(x => `<div class="pr-row" data-id="${e(x.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;border-bottom:1px solid #e2e8f0;padding:0.45rem 0;">
      <span>${x.role === 'intern' ? '👩‍🎓 นศ.' : '🎓'} <b>${e(x.name || x.subjectId)}</b> • รหัส ${e(x.subjectId)}${x.className ? ' • ' + e(x.className) : ''}<br>
        <span style="font-size:0.76rem;color:#64748b;">ขอเมื่อ ${e(this._fmt(x.createdMs))}${x.status === 'approved' ? ` • ออกรหัสแล้ว (หมดอายุ ${e(this._fmt(x.expiresMs))})` : ' • รอครูยืนยัน'}</span></span>
      <span><button class="btn-nav-action primary" data-approve="${e(x.id)}">${x.status === 'approved' ? '🔁 ออกรหัสใหม่' : '✅ ยืนยันและออกรหัส'}</button> <button class="btn-nav-action" data-reject="${e(x.id)}">ปฏิเสธ</button></span></div>`).join('');
    box.innerHTML = `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:1rem;margin-bottom:1rem;">
      <h4 style="font-size:0.95rem;font-weight:700;color:#92400e;margin:0 0 0.4rem 0;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
        <span>📨 คำขอรีเซ็ตรหัสจากนักเรียน/นศ. (${list.length})</span><button class="btn-nav-action" id="pr-refresh" style="font-size:0.76rem;">🔄 รีเฟรช</button></h4>
      <p style="font-size:0.78rem;color:#92400e;margin:0 0 0.5rem 0;">ตรวจว่าเป็นตัวนักเรียนจริงก่อนกดยืนยัน ระบบจะออก <b>รหัสยืนยัน 6 หลัก</b> (แสดงครั้งเดียว) ให้แจ้งนักเรียนด้วยตนเอง แล้วนักเรียนตั้ง PIN ใหม่เอง (ครูไม่เห็น PIN)</p>
      <div id="pr-issued"></div>
      ${rows || '<div style="color:#64748b;font-size:0.84rem;">ไม่มีคำขอที่รออยู่</div>'}</div>`;
    box.querySelector('#pr-refresh').onclick = () => this.renderQueue(containerId);
    const issued = box.querySelector('#pr-issued');
    box.querySelectorAll('[data-approve]').forEach(b => { b.onclick = async () => {
      const x = list.find(i => i.id === b.dataset.approve);
      if (!confirm(`ยืนยันว่าเป็นตัวนักเรียนจริง และออกรหัสยืนยันให้ ${x ? (x.name || x.subjectId) : ''} ?`)) return;
      b.disabled = true;
      try {
        const r = await this.decide(b.dataset.approve, true);
        if (r.status !== 'success') { alert('❌ ' + (r.message || 'ออกรหัสไม่สำเร็จ')); this.renderQueue(containerId); return; }
        issued.innerHTML = `<div style="background:#ecfdf5;border:2px solid #10b981;border-radius:10px;padding:0.75rem;margin-bottom:0.6rem;text-align:center;">
          <div style="font-size:0.84rem;color:#065f46;">รหัสยืนยันของ <b>${e(x ? (x.name || x.subjectId) : r.subjectId)}</b> (รหัส ${e(r.subjectId)})</div>
          <div style="font-size:2rem;font-weight:800;letter-spacing:8px;color:#064e3b;">${e(r.code)}</div>
          <div style="font-size:0.76rem;color:#065f46;">แจ้งนักเรียนด้วยตนเอง • ใช้ได้ถึง ${e(this._fmt(r.expiresMs))} • แสดงครั้งเดียว (หายให้กด "ออกรหัสใหม่")</div></div>`;
        const row = b.closest('.pr-row'); if (row) row.remove();
      } catch (err) { alert('❌ ' + err.message); b.disabled = false; }
    }; });
    box.querySelectorAll('[data-reject]').forEach(b => { b.onclick = async () => {
      if (!confirm('ปฏิเสธคำขอนี้?')) return;
      try { await this.decide(b.dataset.reject, false); this.renderQueue(containerId); } catch (err) { alert('❌ ' + err.message); }
    }; });
  },

  // แจ้งเตือนครูเมื่อมีคำขอรอ (เรียกเมื่อโหลดหน้า และทุก 5 นาทีขณะเปิดแอป)
  async checkPending(silent) {
    try {
      const u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null;
      if (!u || u.role !== 'teacher') return 0;
      const cfg = (typeof GoogleSheetSync !== 'undefined') ? GoogleSheetSync.getConfig() : {};
      if (!this._cloud() && (!cfg.webAppUrl || !cfg.syncToken)) return 0;
      const list = await this.listRequests();
      const pending = list.filter(x => x.status === 'pending').length;
      if (pending && !silent && typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.showToast) {
        GoogleSheetSync.showToast(`🔑 มีคำขอรีเซ็ตรหัสรอครูยืนยัน ${pending} รายการ — เปิด "จัดการผู้ใช้ → นักเรียน"`, 'info');
      }
      return pending;
    } catch (e) { return 0; }
  },
  startPolling() {
    if (this._timer || typeof setInterval === 'undefined') return;
    setTimeout(() => this.checkPending(false), 4000);
    this._timer = setInterval(() => this.checkPending(false), this.POLL_MS);
  }
};

if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => PasswordReset.startPolling());
}
if (typeof module !== 'undefined' && module.exports) module.exports = { PasswordReset };
