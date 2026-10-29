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
  isCloud() { return typeof StudentAuth !== 'undefined' && !!StudentAuth.isCloudMode && StudentAuth.isCloudMode(); },

  // โหมด Cloudflare Worker: ตรวจรหัสครูที่ D1 แล้วเก็บโทเค็นไว้ใน CloudApi
  async _cloudLogin(email, password) {
    try {
      const sess = await CloudApi.Auth.teacherLogin(email, password);
      localStorage.setItem(this.SERVER_FLAG, '1');
      await this._saveOffline(email, password).catch(() => {});
      if (typeof CloudSync !== 'undefined') CloudSync.init();
      return { success: true, user: this._setUser(email, sess.name) };
    } catch (e) {
      if (e && e.status === 0) {
        if (await this._checkOffline(email, password)) return { success: true, offline: true, user: this._setUser(email, '', { offline: true }) };
        return { success: false, code: 'network', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต' };
      }
      if (e && e.status === 429) return { success: false, code: 'locked', message: e.message };
      return { success: false, code: (e && e.code) || 'invalid_credentials', message: (e && e.message) || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    }
  },

  async login(emailRaw, password, rawPassword) {
    const email = String(emailRaw || '').trim().toLowerCase();
    if (this.isCloud() && typeof CloudApi !== 'undefined') return this._cloudLogin(email, password);
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
      if (lr.success) lr.notice = 'ℹ️ ยังไม่ได้ตั้งรหัสผ่านครูบนเซิร์ฟเวอร์ — แนะนำให้ตั้ง (ลืมรหัสผ่าน? → ใช้ลืมรหัสผ่านทางอีเมล)';
      return lr;
    }
    return { success: false, code: r && r.code, message: (r && r.message) || 'เข้าสู่ระบบไม่สำเร็จ' };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { TeacherAuth };
