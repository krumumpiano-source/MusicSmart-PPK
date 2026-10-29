// ==========================================================================
// เข้าสู่ระบบครูผ่านเซิร์ฟเวอร์ (Apps Script) — Phase 6
// - รหัสผ่านตรวจบนเซิร์ฟเวอร์ (hash ใน Script Properties) ไม่มีรหัสผ่านจริงในไฟล์เว็บ
// - สำเร็จ: เครื่องได้ SYNC_TOKEN อัตโนมัติ + เก็บตัวตรวจแบบออฟไลน์ (PBKDF2) 30 วัน
// - เซิร์ฟเวอร์ยังไม่ตั้งรหัสผ่าน (not_configured) หรือไม่มี URL → ใช้ระบบเดิมในเครื่อง
// - เมื่อเคยเข้าสู่ระบบผ่านเซิร์ฟเวอร์แล้ว ระบบเดิม (รหัสเริ่มต้นในไฟล์) จะถูกปิดบนเครื่องนั้น
// ==========================================================================
const TeacherAuth = {
  OFFLINE_KEY: 'ppk_teacher_offline_verifier',
  SERVER_FLAG: 'ppk_teacher_server_auth',
  OFFLINE_DAYS: 30,
  ITER: 100000,

  apiUrl() { return (typeof StudentAuth !== 'undefined' && StudentAuth.getApiUrl) ? StudentAuth.getApiUrl() : ''; },
  _hex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); },
  async _derive(password, saltHex) {
    const c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : null;
    if (!c) return '';
    const enc = new TextEncoder();
    const key = await c.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    return this._hex(await c.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: this.ITER }, key, 256));
  },
  async _saveOffline(email, password) {
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) return;
    const salt = this._hex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await this._derive(password, salt);
    if (hash) localStorage.setItem(this.OFFLINE_KEY, JSON.stringify({ email, salt, hash, until: Date.now() + this.OFFLINE_DAYS * 86400000 }));
  },
  async _checkOffline(email, password) {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(this.OFFLINE_KEY) || 'null'); } catch (e) { v = null; }
    if (!v || v.email !== email || Number(v.until) < Date.now()) return false;
    return (await this._derive(password, v.salt)) === v.hash;
  },
  serverManaged() { return localStorage.getItem(this.SERVER_FLAG) === '1'; },

  _setUser(email, name, extra) {
    const acc = Store.getTeacherAccount ? Store.getTeacherAccount() : {};
    const user = Object.assign({ role: 'teacher', email, name: name || acc.name || 'คุณครู', teacherId: 'admin_primary',
      teacherRole: 'ครูประจำวิชา (แอดมิน)', roleCategory: 'mentor', isAdmin: true, loggedInAt: new Date().toISOString() }, extra || {});
    Store.setCurrentUser(user);
    return user;
  },

  // rawPassword (ถ้ามี) = ค่าที่พิมพ์/วางมาก่อนตัดช่องว่างหัวท้าย — ใช้ลองซ้ำเมื่อรหัสที่ตั้งไว้ก่อนหน้านี้มีช่องว่างติดมา
  async login(emailRaw, password, rawPassword) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const url = this.apiUrl();
    const legacy = async () => {
      if (this.serverManaged()) return { success: false, message: 'ไม่มีอินเทอร์เน็ต และเครื่องนี้ยังไม่เคยเข้าสู่ระบบแบบออฟไลน์ได้ กรุณาต่อเน็ตแล้วลองใหม่' };
      return await Store.verifyTeacherLogin(email, password);
    };
    if (!url) return legacy();
    let r;
    try {
      r = await StudentAuth._post({ action: 'teacherLogin', email, password });
    } catch (e) {
      if (await this._checkOffline(email, password)) return { success: true, offline: true, user: this._setUser(email, '', { offline: true }) };
      return legacy();
    }
    if (r && r.code === 'wrong_password' && rawPassword && rawPassword !== password) {
      try {
        const r2 = await StudentAuth._post({ action: 'teacherLogin', email, password: rawPassword });
        if (r2 && r2.status === 'success') { r = r2; password = rawPassword; }
      } catch (e) { /* คงผลลัพธ์เดิม */ }
    }
    if (r && r.status === 'success') {
      localStorage.setItem(this.SERVER_FLAG, '1');
      if (r.syncToken && typeof GoogleSheetSync !== 'undefined') {
        const cfg = GoogleSheetSync.getConfig();
        GoogleSheetSync.saveConfig({ webAppUrl: cfg.webAppUrl || url, syncToken: r.syncToken });
      }
      await this._saveOffline(email, password).catch(() => {});
      return { success: true, user: this._setUser(r.email, r.name) };
    }
    if (r && r.code === 'not_configured') {
      const lr = await legacy();
      if (lr.success) lr.notice = 'ℹ️ ยังไม่ได้ตั้งรหัสผ่านครูบนเซิร์ฟเวอร์ — แนะนำให้ตั้ง (ลืมรหัสผ่าน? → ตั้งรหัสใหม่ด้วยรหัสซิงค์)';
      return lr;
    }
    return { success: false, code: r && r.code, message: (r && r.message) || 'เข้าสู่ระบบไม่สำเร็จ' };
  },

  /** ตั้ง/รีเซ็ตรหัสผ่านด้วย SYNC_TOKEN (ลืมรหัสผ่าน หรือเปลี่ยนรหัส) */
  async resetWithToken(syncToken, emailRaw, newPassword, name) {
    const url = this.apiUrl();
    if (!url) return { success: false, message: 'ยังไม่ได้ตั้งค่า URL ของ Apps Script' };
    const r = await StudentAuth._post({ action: 'teacher_set_password', token: String(syncToken || '').trim(), email: String(emailRaw || '').trim().toLowerCase(), password: newPassword, name: name || '' });
    if (r.status !== 'success') return { success: false, code: r.code, message: r.message === 'unauthorized' ? 'รหัสซิงค์ (SYNC_TOKEN) ไม่ถูกต้อง' : (r.message || 'ตั้งรหัสไม่สำเร็จ') };
    localStorage.removeItem(this.OFFLINE_KEY);
    return { success: true };
  },

  openForgot() {
    let m = document.getElementById('modal-teacher-forgot');
    if (!m) {
      m = document.createElement('div'); m.id = 'modal-teacher-forgot'; m.className = 'modal-overlay'; m.style.zIndex = '100010';
      m.innerHTML = `<div class="modal-card" style="max-width:440px;"><div class="modal-header"><h3 class="modal-title" style="margin:0;">🔑 ตั้งรหัสผ่านครูใหม่</h3></div>
        <div class="modal-body" style="display:grid;gap:0.5rem;font-size:0.88rem;">
          <div style="color:#475569;">ใช้ <b>รหัสซิงค์ (SYNC_TOKEN)</b> ที่ตั้งไว้ใน Apps Script (Project Settings → Script Properties) เพื่อยืนยันว่าเป็นครู</div>
          <input type="password" id="tf-token" class="form-input" placeholder="รหัสซิงค์ SYNC_TOKEN" autocomplete="off">
          <input type="email" id="tf-email" class="form-input" placeholder="อีเมลครู">
          <input type="password" id="tf-pw" class="form-input" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" autocomplete="new-password">
          <input type="password" id="tf-pw2" class="form-input" placeholder="ยืนยันรหัสผ่านใหม่" autocomplete="new-password">
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;"><button class="btn-nav-action" id="tf-cancel">ยกเลิก</button><button class="btn-nav-action primary" id="tf-save">ตั้งรหัสผ่าน</button></div>
        </div></div>`;
      document.body.appendChild(m);
      m.querySelector('#tf-cancel').onclick = () => m.classList.remove('active');
      m.querySelector('#tf-save').onclick = async () => {
        // ตัดช่องว่างหัวท้าย (เช่น ติดมาตอนคัดลอก/วาง) ให้ตรงกับหน้าเข้าสู่ระบบที่ตัดช่องว่างเช่นกัน
        const pw = m.querySelector('#tf-pw').value.trim(), pw2 = m.querySelector('#tf-pw2').value.trim();
        if (pw !== pw2) { alert('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
        const r = await this.resetWithToken(m.querySelector('#tf-token').value, m.querySelector('#tf-email').value, pw).catch(e => ({ success: false, message: e.message }));
        if (!r.success) { alert('❌ ' + r.message); return; }
        m.querySelectorAll('input').forEach(i => { i.value = ''; });
        m.classList.remove('active');
        alert('✅ ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่');
      };
    }
    const cfg = typeof GoogleSheetSync !== 'undefined' ? GoogleSheetSync.getConfig() : {};
    m.querySelector('#tf-token').value = cfg.syncToken || '';
    m.querySelector('#tf-email').value = (document.getElementById('auth-teacher-email') || {}).value || '';
    m.classList.add('active');
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { TeacherAuth };
