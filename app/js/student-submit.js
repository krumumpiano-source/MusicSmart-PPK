// ==========================================================================
// MusicSmart • ส่งงานจากมือถือนักเรียน (StudentOutbox) และครูดึงงาน (TeacherPull)
// นักเรียน: ใช้โทเค็นเข้าสู่ระบบ (ไม่ใช่รหัสซิงค์ครู) ส่งงาน/คะแนนแบบทดสอบเข้า Apps Script
//           ออฟไลน์ = เก็บในคิวแล้วส่งใหม่อัตโนมัติ • เซสชันหมดอายุ = ขอ PIN ใหม่ คิวไม่หาย
// ครู:     กด "ดึงงานนักเรียน" (หรือดึงอัตโนมัติเมื่อเปิดแอป) แล้วงานจะเข้าหน้าตรวจงาน/คะแนนเดิม
// ==========================================================================
const StudentOutbox = {
  KEY: 'ppk_student_outbox',
  STATUS_KEY: 'ppk_student_submit_status',
  RETRY_MS: 60000,
  MAX_BATCH: 20,
  flushing: false,
  needsReauth: false,
  _timer: null,

  _load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  _save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  getItems() { return this._load(this.KEY, []); },
  saveItems(items) { this._save(this.KEY, items); },
  getStatuses() { return this._load(this.STATUS_KEY, {}); },
  setStatus(taskKey, state, extra) {
    const all = this.getStatuses();
    all[taskKey] = Object.assign({ state, at: new Date().toISOString() }, extra || {});
    this._save(this.STATUS_KEY, all);
  },

  currentStudent() {
    const u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null;
    return u && u.role === 'student' ? u : null;
  },
  isActive() {
    return !!this.currentStudent() && typeof StudentAuth !== 'undefined' && StudentAuth.isServerMode();
  },

  assignmentKey(className, period) { return `a:${className}_p${period}`; },
  quizKey(unitNo) { return `q:u${unitNo}`; },

  newClientId(kind, sid) {
    return `${kind === 'quiz' ? 'q' : 'a'}_${String(sid).replace(/\D/g, '')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  enqueue(kind, taskKey, data) {
    const u = this.currentStudent();
    if (!u) return null;
    // ส่งใหม่ในงานเดิม = แทนที่รายการที่ยังรอส่ง (ฉบับล่าสุดเท่านั้น)
    const items = this.getItems().filter(it => it.taskKey !== taskKey);
    const item = { clientId: this.newClientId(kind, u.studentId), kind, taskKey, data: Object.assign({}, data, { clientTime: new Date().toISOString() }), queuedAt: new Date().toISOString(), attempts: 0 };
    items.push(item);
    this.saveItems(items);
    this.setStatus(taskKey, 'pending');
    this.render();
    this.flush();
    return item;
  },

  statusFor(taskKey) {
    const s = this.getStatuses()[taskKey];
    if (!s) return null;
    if (s.state === 'sent') return { state: 'sent', label: 'ส่งแล้ว ✅', cls: 'badge-success', at: s.at };
    if (s.state === 'failed') return { state: 'failed', label: s.permanent ? 'ส่งไม่สำเร็จ ❌' : 'ส่งไม่สำเร็จ (จะลองใหม่) ⚠️', cls: 'badge-danger', message: s.message };
    return { state: 'pending', label: 'รอส่ง ⏳', cls: 'badge-warning' };
  },

  sessionValid(u) { return !!(u && u.sessionToken && (!u.sessionExp || Number(u.sessionExp) > Date.now())); },

  async flush() {
    if (this.flushing || !this.isActive()) return { skipped: true };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.render(); return { offline: true }; }
    const u = this.currentStudent();
    const items = this.getItems();
    if (!items.length) { this.render(); return { empty: true }; }
    if (!this.sessionValid(u)) { this.needsReauth = true; this.render(); return { needsReauth: true }; }

    this.flushing = true;
    const batch = items.slice(0, this.MAX_BATCH);
    try {
      const r = await StudentAuth._post({ action: 'studentSubmit', sessionToken: u.sessionToken,
        items: batch.map(it => ({ clientId: it.clientId, kind: it.kind, data: it.data })) });
      if (r.status !== 'success') {
        if (r.code === 'session_expired' || r.code === 'bad_session') { this.needsReauth = true; return { needsReauth: true }; }
        throw new Error(r.message || 'ส่งไม่สำเร็จ');
      }
      this.needsReauth = false;
      const done = new Set([...(r.accepted || []), ...(r.duplicates || [])]);
      const rejected = {};
      (r.rejected || []).forEach(x => { rejected[x.clientId] = x.reason; });
      const remaining = [];
      this.getItems().forEach(it => {
        if (done.has(it.clientId)) { this.setStatus(it.taskKey, 'sent'); return; }
        const reason = rejected[it.clientId];
        if (reason && reason !== 'rate_limited') {
          this.setStatus(it.taskKey, 'failed', { permanent: true, message: this.reasonText(reason) });
          return;
        }
        remaining.push(it);
      });
      this.saveItems(remaining);
      return { success: true, sent: done.size };
    } catch (e) {
      const kept = this.getItems().map(it => Object.assign({}, it, { attempts: (it.attempts || 0) + (batch.some(b => b.clientId === it.clientId) ? 1 : 0) }));
      this.saveItems(kept);
      batch.forEach(it => this.setStatus(it.taskKey, 'failed', { message: 'เชื่อมต่อไม่ได้ จะส่งใหม่อัตโนมัติ' }));
      return { success: false, message: e.message };
    } finally {
      this.flushing = false;
      this.render();
      if (typeof App !== 'undefined' && App.renderStudentPortal && typeof document !== 'undefined' && document.getElementById && document.getElementById('view-student')) {
        try { App.renderStudentPortal(); } catch (e) { /* ignore */ }
      }
    }
  },

  reasonText(code) {
    return ({ too_long: 'คำตอบยาวเกิน 5,000 ตัวอักษร', bad_url: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', empty: 'ไม่มีคำตอบหรือลิงก์',
      bad_period: 'คาบเรียนไม่ถูกต้อง', bad_score: 'คะแนนไม่ถูกต้อง' })[code] || 'ข้อมูลไม่ถูกต้อง';
  },

  async reauth(pin) {
    const u = this.currentStudent();
    if (!u) return { success: false };
    const res = await StudentAuth.login(u.studentId, pin);
    if (res.success) { this.needsReauth = false; await this.flush(); }
    this.render();
    return res;
  },

  // แถบสถานะการส่งงานในหน้านักเรียน (คิว/ล้มเหลว/ขอ PIN ใหม่)
  render() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const host = document.getElementById('view-student');
    if (!host || !this.currentStudent()) return;
    let el = document.getElementById('student-sync-pill');
    if (!el) {
      el = document.createElement('div');
      el.id = 'student-sync-pill';
      el.style.cssText = 'margin-bottom:0.75rem;border-radius:10px;padding:0.6rem 0.9rem;font-size:0.86rem;font-weight:600;';
      host.insertBefore(el, host.firstChild);
    }
    const n = this.getItems().length;
    if (this.needsReauth) {
      el.style.background = '#fef3c7'; el.style.color = '#92400e'; el.style.display = 'block';
      el.innerHTML = `🔑 เซสชันหมดอายุ กรุณากรอก PIN อีกครั้งเพื่อส่งงานที่รอส่ง (${n} รายการ ยังอยู่ครบ)
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
          <input id="student-reauth-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN 6 หลัก" class="form-input" style="max-width:140px;text-align:center;">
          <button type="button" id="student-reauth-btn" class="btn-nav-action primary">ยืนยัน PIN</button>
        </div>`;
      const btn = document.getElementById('student-reauth-btn');
      if (btn) btn.onclick = async () => {
        const pin = (document.getElementById('student-reauth-pin') || {}).value || '';
        const r = await this.reauth(pin.trim());
        if (!r.success) alert(r.message || 'PIN ไม่ถูกต้อง');
        else if (typeof App !== 'undefined' && App.renderStudentPortal) App.renderStudentPortal();
      };
      return;
    }
    if (!n) { el.style.display = 'none'; return; }
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    el.style.display = 'block'; el.style.background = '#fff7ed'; el.style.color = '#9a3412';
    el.textContent = offline ? `📴 ออฟไลน์ • รอส่ง ${n} รายการ จะส่งให้ครูอัตโนมัติเมื่อต่อเน็ต` : `⏳ รอส่งให้ครู ${n} รายการ (ระบบจะลองใหม่อัตโนมัติ)`;
  },

  init() {
    if (typeof window === 'undefined' || this._timer) return;
    this._timer = setInterval(() => { if (this.getItems().length) this.flush(); }, this.RETRY_MS);
    if (this._timer && this._timer.unref) this._timer.unref();
    if (window.addEventListener) {
      window.addEventListener('online', () => this.flush());
      window.addEventListener('offline', () => this.render());
    }
    setTimeout(() => this.flush(), 2000);
  }
};

const TeacherPull = {
  SINCE_KEY: 'ppk_teacher_pull_since',
  LATE_DAYS: 7,
  pulling: false,

  isConfigured() {
    if (typeof GoogleSheetSync === 'undefined') return false;
    const c = GoogleSheetSync.getConfig();
    return !!(c.webAppUrl && c.syncToken);
  },

  thaiTime(iso) {
    try { return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }); } catch (e) { return String(iso || ''); }
  },

  // ส่งช้า: ได้รับหลังวันที่ครูบันทึกคาบนั้นเกิน LATE_DAYS วัน (ถ้ามีบันทึกคาบ)
  isLate(className, period, receivedIso) {
    if (typeof Store === 'undefined' || !Store.getAllSessions) return false;
    const sess = Store.getAllSessions()[Store.getSessionKey(className, period)];
    const base = sess && (sess.updatedAt || sess.savedAt || sess.createdAt);
    if (!base) return false;
    return new Date(receivedIso).getTime() > new Date(base).getTime() + this.LATE_DAYS * 86400000;
  },

  merge(rows) {
    let subs = 0, quizzes = 0;
    const all = Store.getAllSubmissions();
    rows.forEach(r => {
      const sid = String(r.student_id || '').trim();
      const cls = String(r['class'] || '');
      const no = Number(r.period_or_unit);
      if (!sid || !no) return;
      if (r.kind === 'assignment') {
        const key = `${cls}_p${no}_${sid}`;
        const prev = all[key] || {};
        if (prev.receivedAt && prev.receivedAt >= r.received_at) return;
        all[key] = Object.assign({}, prev, {
          key, className: cls, period: no, studentId: sid,
          submissionType: r.submission_type || 'งานนักเรียน (มือถือ)',
          content: String(r.content || ''), url: String(r.url || ''),
          submittedAt: this.thaiTime(r.received_at), receivedAt: r.received_at,
          source: 'student_device', late: this.isLate(cls, no, r.received_at), status: 'submitted',
          score: prev.score !== undefined ? prev.score : null, feedback: prev.feedback || ''
        });
        subs++;
      } else if (r.kind === 'quiz') {
        const qkey = `music_quiz_${sid}_u${no}`;
        let prev = null;
        try { prev = JSON.parse(localStorage.getItem(qkey) || 'null'); } catch (e) { prev = null; }
        if (prev && prev.receivedAt && prev.receivedAt >= r.received_at) return;
        const total = Number(r.total) || 0;
        localStorage.setItem(qkey, JSON.stringify(Object.assign({}, prev || {}, {
          submitted: true, unitNo: no, score: Number(r.score) || 0, maxScore: total, totalQuestions: total,
          percentage: Number(r.percentage) || 0, timeSpentSeconds: Number(r.time_spent_sec) || 0,
          submittedAt: this.thaiTime(r.received_at), receivedAt: r.received_at, source: 'student_device'
        })));
        quizzes++;
      }
    });
    // บันทึกตรงโดยไม่ส่งกลับขึ้นชีตซ้ำ (ข้อมูลอยู่ในชีตแล้ว)
    Store.save('ppk_student_submissions', all);
    return { subs, quizzes };
  },

  async pull(opts = {}) {
    if (this.pulling) return { skipped: true };
    if (!this.isConfigured()) {
      if (!opts.silent) alert('กรุณาตั้งค่า URL และรหัสซิงค์ในหน้าต่าง "ซิงค์คู่ Google Sheets" ก่อน');
      return { success: false, code: 'unconfigured' };
    }
    this.pulling = true;
    const cfg = GoogleSheetSync.getConfig();
    let since = Number(localStorage.getItem(this.SINCE_KEY) || 0);
    let total = { subs: 0, quizzes: 0 };
    try {
      for (let page = 0; page < 10; page++) {
        const r = await GoogleSheetSync.postJSON(cfg.webAppUrl, { action: 'fetch_student_submissions', since, limit: 500 });
        const m = this.merge(r.submissions || []);
        total.subs += m.subs; total.quizzes += m.quizzes;
        if (r.nextSince) { since = Number(r.nextSince); localStorage.setItem(this.SINCE_KEY, String(since)); }
        if (!r.more) break;
      }
      localStorage.setItem(this.SINCE_KEY + '_at', new Date().toISOString());
      const msg = `📥 ดึงงานนักเรียนแล้ว: งาน ${total.subs} • แบบทดสอบ ${total.quizzes} รายการ`;
      if (!opts.silent || total.subs + total.quizzes > 0) GoogleSheetSync.showToast(msg, 'success');
      if (typeof App !== 'undefined' && App.state && App.state.role === 'teacher') {
        try { if (App.renderCurrentTab && document.getElementById('view-cockpit')?.style.display !== 'none') App.renderCurrentTab(); } catch (e) { /* ignore */ }
        try { if (App.renderDashboard) App.renderDashboard(); } catch (e) { /* ignore */ }
      }
      return Object.assign({ success: true }, total);
    } catch (e) {
      if (!opts.silent) GoogleSheetSync.showToast('⚠️ ดึงงานนักเรียนไม่สำเร็จ — ' + e.message, 'error');
      return { success: false, message: e.message };
    } finally {
      this.pulling = false;
    }
  }
};

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.addEventListener) StudentOutbox.init();
if (typeof module !== 'undefined' && module.exports) module.exports = { StudentOutbox, TeacherPull };
