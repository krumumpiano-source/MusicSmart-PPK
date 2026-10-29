// ==========================================================================
// ซิงค์ข้อมูลครู/นักเรียนกับ Cloudflare Worker (ใช้เฉพาะโหมด Cloud)
// - คาบเรียน (เช็คชื่อ/คะแนน) ส่งขึ้นเซิร์ฟเวอร์พร้อมเวอร์ชัน และดึงลงเครื่องเมื่อเซิร์ฟเวอร์ใหม่กว่า
// - วันกำหนดส่งงาน: ครูตั้ง นักเรียนดู
// - การแจ้งเตือนจากครูถึงนักเรียนรายคน
// ==========================================================================
const CloudSync = {
  VERSIONS_KEY: 'ppk_cloud_session_versions',
  PENDING_KEY: 'ppk_cloud_pending_sessions',
  SESSIONS_KEY: 'ppk_session_logs',
  DUE_KEY: 'ppk_due_dates',

  isCloud() {
    return typeof StudentAuth !== 'undefined' && !!StudentAuth.isCloudMode && StudentAuth.isCloudMode()
      && typeof CloudApi !== 'undefined';
  },
  isTeacher() { return this.isCloud() && CloudApi.Auth.isTeacher(); },
  isStudent() { return this.isCloud() && CloudApi.Auth.isStudent(); },

  _read(key, def) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); } catch (e) { return def; }
  },
  _write(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  versions() { return this._read(this.VERSIONS_KEY, {}); },
  pending() { return this._read(this.PENDING_KEY, []); },

  // ---------- คาบเรียน (sessions) ----------

  // ใส่คาบที่ยังไม่มีเวอร์ชัน (ข้อมูลเก่าก่อนเปิดโหมด Cloud) เข้าคิวส่งขึ้นเซิร์ฟเวอร์ครั้งเดียว
  _queueUnversioned() {
    if (typeof Store === 'undefined' || !Store.getAllSessions) return;
    const vers = this.versions();
    const set = new Set(this.pending());
    Object.keys(Store.getAllSessions()).forEach(key => { if (!vers[key]) set.add(key); });
    this._write(this.PENDING_KEY, [...set]);
  },

  // เรียกหลังบันทึกคาบในเครื่อง: เข้าคิวแล้วส่งทันที (ถ้าส่งไม่ได้ จะลองใหม่ครั้งต่อไป)
  async pushSession(className, period) {
    if (!this.isTeacher()) return { skipped: true };
    const key = Store.getSessionKey(className, period);
    const set = new Set(this.pending());
    set.add(key);
    this._write(this.PENDING_KEY, [...set]);
    return this.flushSessions();
  },

  async flushSessions() {
    if (!this.isTeacher()) return { skipped: true };
    const queue = this.pending();
    if (!queue.length) return { ok: true, pushed: 0, pending: 0 };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, pending: queue.length };
    const all = Store.getAllSessions();
    const vers = this.versions();
    const left = [];
    let pushed = 0;
    let lastErr = '';
    for (const key of queue) {
      const sess = all[key];
      if (!sess) continue;
      try {
        let base = vers[key] || 0;
        let res = await CloudApi.Sessions.save(key, sess.className, sess.period, sess, base);
        if (res.conflict) {
          // เซิร์ฟเวอร์มีเวอร์ชันใหม่กว่า (เครื่องอื่นแก้ไขไว้): เครื่องนี้ที่เพิ่งบันทึกเป็นฝ่ายชนะ
          base = res.current_version;
          res = await CloudApi.Sessions.save(key, sess.className, sess.period, sess, base);
        }
        if (res.conflict) throw new Error('บันทึกคาบซ้ำซ้อน ลองใหม่อีกครั้ง');
        vers[key] = res.version;
        pushed++;
      } catch (e) {
        left.push(key);
        lastErr = (e && e.message) || String(e);
      }
    }
    this._write(this.VERSIONS_KEY, vers);
    this._write(this.PENDING_KEY, left);
    if (left.length && typeof GoogleSheetSync !== 'undefined') {
      GoogleSheetSync.showToast(`⚠️ ส่งคาบเรียนขึ้นเซิร์ฟเวอร์ไม่สำเร็จ ${left.length} คาบ (จะลองใหม่อัตโนมัติ) — ${lastErr}`, 'error');
    }
    return { ok: left.length === 0, pushed, pending: left.length };
  },

  // ดึงคาบจากเซิร์ฟเวอร์ที่ใหม่กว่าเครื่องนี้ (ข้ามคาบที่ยังมีการแก้ไขค้างอยู่)
  async pullSessions() {
    if (!this.isTeacher()) return { skipped: true };
    const rows = await CloudApi.Sessions.list('');
    const all = Store.getAllSessions();
    const vers = this.versions();
    const pendingSet = new Set(this.pending());
    let applied = 0;
    rows.forEach(r => {
      if (pendingSet.has(r.session_key) || !r.data) return;
      if ((vers[r.session_key] || 0) >= Number(r.version || 0)) return;
      all[r.session_key] = r.data;
      vers[r.session_key] = Number(r.version || 0);
      applied++;
    });
    if (applied) {
      this._write(this.VERSIONS_KEY, vers);
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(all));
    }
    return { ok: true, applied };
  },

  // ---------- วันกำหนดส่งงาน ----------

  async pullDueDates() {
    if (!this.isCloud() || !CloudApi.Auth.session()) return { skipped: true };
    const r = await CloudApi.request('GET', '/api/due-dates');
    const map = {};
    (r.due_dates || []).forEach(d => {
      map[`${d.class_name}_p${d.period}`] = { className: d.class_name, period: Number(d.period), dueAt: d.due_at, title: d.title || '' };
    });
    this._write(this.DUE_KEY, map);
    return { ok: true, count: Object.keys(map).length };
  },

  async pushDueDate(className, period, dueAt, title) {
    return CloudApi.request('POST', '/api/due-dates', {
      class_name: className,
      period: Number(period),
      due_at: dueAt ? new Date(dueAt).toISOString() : '',
      title: title || ''
    });
  },

  // ---------- การแจ้งเตือน ----------

  async postNotices(items) {
    return CloudApi.request('POST', '/api/notices', { items });
  },

  async fetchMyNotices(sinceMs) {
    const r = await CloudApi.request('GET', '/api/notices/mine?since=' + encodeURIComponent(Number(sinceMs) || 0));
    return r.notices || [];
  },

  // ---------- เริ่มต้นทำงาน ----------

  async init() {
    if (!this.isCloud()) return { skipped: true };
    const out = {};
    try {
      if (this.isTeacher()) {
        this._queueUnversioned();
        out.sessionsPushed = (await this.flushSessions()).pushed || 0;
        out.sessionsPulled = (await this.pullSessions()).applied || 0;
      }
      await this.pullDueDates();
    } catch (e) {
      console.warn('CloudSync.init', e);
      out.error = (e && e.message) || String(e);
    }
    return out;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { CloudSync };
