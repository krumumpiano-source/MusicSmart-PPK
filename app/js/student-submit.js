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
    const item = { clientId: this.newClientId(kind === 'quiz_answers' ? 'quiz' : kind, u.studentId), kind, taskKey, data: Object.assign({}, data, { clientTime: new Date().toISOString() }), queuedAt: new Date().toISOString(), attempts: 0 };
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
    if (s.state === 'sent') return { state: 'sent', label: 'ส่งแล้ว ✅', cls: 'badge-success', at: s.at, result: s.result };
    if (s.state === 'failed') return { state: 'failed', label: s.permanent ? 'ส่งไม่สำเร็จ ❌' : 'ส่งไม่สำเร็จ (จะลองใหม่) ⚠️', cls: 'badge-danger', message: s.message };
    return { state: 'pending', label: 'รอส่ง ⏳', cls: 'badge-warning' };
  },

  sessionValid(u) { return !!(u && u.sessionToken && (!u.sessionExp || Number(u.sessionExp) > Date.now())); },

  async flush() {
    // ถ้ากำลังส่งอยู่ รอรอบนั้นเสร็จแล้วส่งรายการที่เหลือ
    if (this.flushing && this._inflight) { await this._inflight.catch(() => {}); return this.flush(); }
    if (!this.isActive()) return { skipped: true };
    this._inflight = this._flushOnce();
    try { return await this._inflight; } finally { this._inflight = null; }
  },

  async _flushOnce() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.render(); return { offline: true }; }
    const u = this.currentStudent();
    const items = this.getItems();
    if (!items.length) { this.render(); return { empty: true }; }
    if (!this.sessionValid(u)) { this.needsReauth = true; this.render(); return { needsReauth: true }; }
    if (this.isCloudMode()) return this._flushCloud(items);

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
      const results = r.results || {};
      this.getItems().forEach(it => {
        if (done.has(it.clientId)) {
          this.setStatus(it.taskKey, 'sent', results[it.clientId] ? { result: results[it.clientId] } : undefined);
          if (results[it.clientId] && typeof this.onResult === 'function') { try { this.onResult(it, results[it.clientId]); } catch (e) { /* ignore */ } }
          return;
        }
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

  // โหมด Cloudflare: ส่งเฉพาะงานที่เป็นลิงก์ (งานประจำคาบ/คลิปฝึกซ้อม) ไปยัง Worker
  // ประเภทอื่นยังไม่รองรับในโหมดนี้ และการอัปโหลดไฟล์ไม่ใช้แล้ว (ตัดสินใจให้นักเรียนส่งลิงก์แทน)
  isCloudMode() {
    return typeof StudentAuth !== 'undefined' && !!StudentAuth.isCloudMode && StudentAuth.isCloudMode();
  },

  _cloudPayload(it) {
    if (it.kind !== 'assignment' && it.kind !== 'recording') return { reason: 'unsupported_cloud' };
    const d = it.data || {};
    const url = String(d.url || '').trim();
    if (!url) return { reason: 'empty' };
    const payload = {
      assignment_key: String(it.taskKey || '').slice(0, 120),
      clip_no: 1,
      video_url: url,
      title: String(d.title || '').slice(0, 200),
      note: String(d.content || '').slice(0, 5000),
      submission_type: String(d.submissionType || '').slice(0, 60)
    };
    if (d.period) payload.period = Number(d.period);
    return { payload };
  },

  async _flushCloud(items) {
    this.flushing = true;
    const batch = items.slice(0, this.MAX_BATCH);
    const done = new Set();
    const rejected = {};
    const results = {};
    let transientMessage = '';
    try {
      for (const it of batch) {
        let send;
        if (it.kind === 'quiz_answers') {
          const d = it.data || {};
          send = () => CloudApi.request('POST', '/api/quiz/units/' + encodeURIComponent(Number(d.unitNo) || 0) + '/submit', {
            client_id: it.clientId, answers: d.answers || {}, practice: !!d.practice, time_spent: Number(d.timeSpentSeconds) || 0
          });
        } else {
          const p = this._cloudPayload(it);
          if (p.reason) { rejected[it.clientId] = p.reason; continue; }
          send = () => CloudApi.Submissions.submitVideo(p.payload);
        }
        try {
          const r = await send();
          done.add(it.clientId);
          if (it.kind === 'quiz_answers' && r) results[it.clientId] = { score: r.score, total: r.total, percentage: r.percentage, practice: !!r.practice };
        } catch (e) {
          if (e.status === 401) { this.needsReauth = true; transientMessage = 'กรุณาใส่ PIN อีกครั้งเพื่อส่งงาน'; break; }
          if (e.status === 0 || e.status === 429 || e.status >= 500) { transientMessage = 'เชื่อมต่อไม่ได้ จะส่งใหม่อัตโนมัติ'; break; }
          rejected[it.clientId] = e.code || 'invalid_data';
        }
      }
      const remaining = [];
      this.getItems().forEach(it => {
        if (done.has(it.clientId)) {
          const res = results[it.clientId];
          this.setStatus(it.taskKey, 'sent', res ? { result: res } : undefined);
          if (res && typeof this.onResult === 'function') { try { this.onResult(it, res); } catch (e) { /* ignore */ } }
          return;
        }
        const reason = rejected[it.clientId];
        if (reason) { this.setStatus(it.taskKey, 'failed', { permanent: true, message: this.reasonText(reason) }); return; }
        if (batch.some(b => b.clientId === it.clientId) && transientMessage) this.setStatus(it.taskKey, 'failed', { message: transientMessage });
        remaining.push(it);
      });
      this.saveItems(remaining);
      return { success: !transientMessage, sent: done.size };
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
      bad_period: 'คาบเรียนไม่ถูกต้อง', invalid_url: 'ลิงก์ต้องเป็น https:// และห้ามมีชื่อผู้ใช้/รหัสผ่านในลิงก์', unsupported_cloud: 'ประเภทงานนี้ยังไม่รองรับในระบบใหม่', bad_score: 'คะแนนไม่ถูกต้อง', no_quiz: 'ครูยังไม่ได้อัปโหลดแบบทดสอบหน่วยนี้', duplicate_quiz: 'ส่งแบบทดสอบหน่วยนี้ไปแล้ว ไม่สามารถส่งซ้ำได้', practice_limit: 'ทำแบบฝึกหน่วยนี้ครบจำนวนครั้งแล้ว', bad_unit: 'หน่วยการเรียนรู้ไม่ถูกต้อง' })[code] || 'ข้อมูลไม่ถูกต้อง';
  },

  TASKS_KEY: 'ppk_student_tasks',
  getTasks() { return this._load(this.TASKS_KEY, { dueDates: [] }); },
  dueFor(className, period) {
    const d = (this.getTasks().dueDates || []).find(x => x.className === className && Number(x.period) === Number(period));
    return d ? d.dueAt : '';
  },
  async refreshTasks() {
    const u = this.currentStudent();
    if (!this.isActive() || !this.sessionValid(u)) return null;
    if (this.isCloudMode()) {
      try {
        const r = await CloudApi.request('GET', '/api/due-dates');
        const dueDates = (r.due_dates || []).map(d => ({ className: d.class_name, period: Number(d.period), dueAt: d.due_at, title: d.title || '' }));
        this._save(this.TASKS_KEY, { dueDates, fetchedAt: new Date().toISOString() });
        return { status: 'success', dueDates };
      } catch (e) {
        if (e && e.status === 401) this.needsReauth = true;
        return null;
      }
    }
    try {
      const r = await StudentAuth._post({ action: 'studentTasks', sessionToken: u.sessionToken });
      if (r.status === 'success') { this._save(this.TASKS_KEY, { dueDates: r.dueDates || [], fetchedAt: new Date().toISOString() }); return r; }
      if (r.code === 'session_expired' || r.code === 'bad_session') this.needsReauth = true;
    } catch (e) { /* offline: keep cache */ }
    return null;
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
    setTimeout(() => {
      this.flush();
      this.refreshTasks().then(() => { if (typeof DueNotifier !== 'undefined') DueNotifier.check(); });
    }, 2000);
  }
};

// กำหนดส่งงาน (ครูตั้งต่อห้อง/คาบ) เก็บในเครื่องครูและส่งขึ้นเซิร์ฟเวอร์
const DueDates = {
  KEY: 'ppk_due_dates',
  all() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
  get(className, period) { return this.all()[`${className}_p${period}`] || null; },
  async set(className, period, dueAt, title) {
    const all = this.all();
    const k = `${className}_p${period}`;
    if (dueAt) all[k] = { className, period: Number(period), dueAt: new Date(dueAt).toISOString(), title: title || '' };
    else delete all[k];
    localStorage.setItem(this.KEY, JSON.stringify(all));
    if (typeof CloudSync !== 'undefined' && CloudSync.isTeacher()) {
      await CloudSync.pushDueDate(className, period, dueAt, title);
      return { success: true, server: true };
    }
    if (TeacherPull.isConfigured()) {
      const cfg = GoogleSheetSync.getConfig();
      await GoogleSheetSync.postJSON(cfg.webAppUrl, { action: 'set_due_date', className, period: Number(period), dueAt: dueAt ? new Date(dueAt).toISOString() : '', title: title || '' });
      return { success: true, server: true };
    }
    return { success: true, server: false };
  }
};

const TeacherPull = {
  SINCE_KEY: 'ppk_teacher_pull_since',
  LATE_DAYS: 7,
  pulling: false,

  isCloud() { return typeof StudentAuth !== 'undefined' && !!StudentAuth.isCloudMode && StudentAuth.isCloudMode(); },

  isConfigured() {
    if (typeof InternMode !== 'undefined' && InternMode.isActive()) return true;
    if (this.isCloud()) return typeof CloudApi !== 'undefined' && CloudApi.Auth.isTeacher();
    if (typeof GoogleSheetSync === 'undefined') return false;
    const c = GoogleSheetSync.getConfig();
    return !!(c.webAppUrl && c.syncToken);
  },

  thaiTime(iso) {
    try { return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }); } catch (e) { return String(iso || ''); }
  },

  // ส่งช้า: ได้รับหลังวันที่ครูบันทึกคาบนั้นเกิน LATE_DAYS วัน (ถ้ามีบันทึกคาบ)
  isLate(className, period, receivedIso, row) {
    if (row && row.due_at) return row.late === true || String(row.late).toUpperCase() === 'TRUE';
    const due = DueDates.get(className, period);
    if (due) return new Date(receivedIso).getTime() > new Date(due.dueAt).getTime();
    // ไม่มีกำหนดส่ง: ใช้เกณฑ์เดิม (หลังบันทึกคาบนั้นเกิน 7 วัน)
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
          source: 'student_device', attachment: !!r.upload_id, fileName: r.upload_id ? String(r.title || '') : (prev.fileName || ''), late: this.isLate(cls, no, r.received_at, r), dueAt: r.due_at || (DueDates.get(cls, no) || {}).dueAt || '', status: 'submitted',
          score: prev.score !== undefined ? prev.score : null, feedback: prev.feedback || ''
        });
        subs++;
      } else if (r.kind === 'recording') { // คลิปฝึกซ้อม: เก็บแยก ไม่ถือเป็นการส่งงานประจำคาบ
        const recAll = JSON.parse(localStorage.getItem('ppk_student_recordings') || '{}');
        const key = `${cls}_p${no}_${sid}`;
        const recs = (recAll[key] || []).filter(x => x.clientId !== r.client_id);
        recs.push({ clientId: r.client_id, url: String(r.url || ''), note: String(r.content || ''), at: this.thaiTime(r.received_at), file: !!r.upload_id, title: String(r.title || '') });
        recAll[key] = recs.slice(-10);
        localStorage.setItem('ppk_student_recordings', JSON.stringify(recAll));
        subs++;
      } else if (r.kind === 'quiz') { // คะแนนที่ตรวจบนเซิร์ฟเวอร์
        const qkey = `music_quiz_${sid}_u${no}`;
        let prev = null;
        try { prev = JSON.parse(localStorage.getItem(qkey) || 'null'); } catch (e) { prev = null; }
        if (prev && prev.receivedAt && prev.receivedAt >= r.received_at) return;
        const total = Number(r.total) || 0;
        localStorage.setItem(qkey, JSON.stringify(Object.assign({}, prev || {}, {
          submitted: true, details: (prev && prev.details) || [], serverGraded: true, unitNo: no, score: Number(r.score) || 0, maxScore: total, totalQuestions: total,
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

  // อัปโหลดคลังข้อสอบ (มีเฉลย) ขึ้นชีตของครู เพื่อให้เซิร์ฟเวอร์ตรวจคะแนนนักเรียน
  async uploadQuizBank() {
    if (!this.isConfigured()) throw new Error(this.isCloud() ? 'กรุณาเข้าสู่ระบบครูก่อน' : 'กรุณาตั้งค่า URL และรหัสซิงค์ก่อน');
    if (typeof QUIZZES_DATA === 'undefined') throw new Error('ไม่พบคลังข้อสอบ');
    const units = QUIZZES_DATA.units.map(u => ({ unit_no: u.unit_no, title: u.title,
      questions: u.questions.map(q => ({ id: q.id, question: q.question, choices: q.choices, correct: q.correct, explanation: q.explanation, bloom: q.bloom })) }));
    if (this.isCloud()) return CloudApi.request('PUT', '/api/quiz/bank', { units });
    const cfg = GoogleSheetSync.getConfig();
    return GoogleSheetSync.postJSON(cfg.webAppUrl, { action: 'upload_quiz_bank', units });
  },

  // โหมด Cloud: แปลงแถวจาก D1 ให้เป็นรูปแบบเดียวกับแถวจากชีต (รองรับ a:<ห้อง>_p<คาบ> และ r:<ห้อง>_p<คาบ>_<id>)
  _cloudInfo(r) {
    const ak = String(r.assignment_key || '');
    let m = /^a:(.+)_p(\d+)$/.exec(ak);
    if (m) return { kind: 'assignment', cls: m[1], no: Number(m[2]) };
    m = /^r:(.+)_p(\d+)_[^_]+$/.exec(ak);
    if (m) return { kind: 'recording', cls: m[1], no: Number(m[2]) };
    return null;
  },

  // งานส่ง + ผลแบบทดสอบจาก D1 -> แถวรูปแบบเดียวกับชีต สำหรับ merge()
  _cloudToRows(subs, quizzes) {
    const mapped = [];
    const infos = [];
    (subs || []).forEach(r => {
      const info = this._cloudInfo(r);
      if (!info || !info.no) return;
      infos.push({ r, info });
      if (info.kind === 'assignment') {
        mapped.push({ kind: 'assignment', student_id: r.student_id, class: info.cls, period_or_unit: info.no,
          content: r.note || '', url: r.video_url || '', submission_type: r.submission_type || '', title: r.title || '',
          received_at: r.submitted_at || r.updated_at, upload_id: null, due_at: null });
      } else {
        mapped.push({ kind: 'recording', student_id: r.student_id, class: info.cls, period_or_unit: info.no, client_id: 'cloud:' + r.id,
          content: r.note || '', url: r.video_url || '', submission_type: 'คลิปฝึกซ้อม (ลิงก์)', title: r.title || 'คลิปฝึกซ้อม',
          received_at: r.submitted_at || r.updated_at, upload_id: null });
      }
    });
    (quizzes || []).forEach(a => {
      mapped.push({ kind: 'quiz', student_id: a.student_id, class: a.class_name || '', period_or_unit: a.unit_no,
        score: a.score, total: a.total, percentage: a.percentage, time_spent_sec: a.time_spent || 0, received_at: a.created_at });
    });
    return { mapped, infos };
  },

  async _pullCloud(opts = {}) {
    if (this.pulling) return { skipped: true };
    if (!this.isConfigured()) {
      if (!opts.silent) alert('กรุณาเข้าสู่ระบบครูก่อน');
      return { success: false, code: 'unconfigured' };
    }
    this.pulling = true;
    try {
      const rows = await CloudApi.Submissions.listForClass('');
      // คะแนนแบบทดสอบที่ตรวจบนเซิร์ฟเวอร์ (ไม่รวมแบบฝึก)
      const qr = await CloudApi.request('GET', '/api/quiz/attempts');
      const { mapped, infos } = this._cloudToRows(rows, qr.attempts);
      const m = this.merge(mapped);
      // เก็บ cloudId ไว้ใช้ตอนให้คะแนน และรับคะแนน/คำแนะนำที่ครูบันทึกบนเซิร์ฟเวอร์ ถ้าเครื่องนี้ยังไม่มี
      const all = Store.getAllSubmissions();
      infos.forEach(({ r, info }) => {
        if (info.kind !== 'assignment') return;
        const key = `${info.cls}_p${info.no}_${r.student_id}`;
        const rec = all[key];
        if (!rec) return;
        rec.cloudId = r.id;
        const local = rec.teacherFeedback;
        const hasLocal = local && (local.feedback || (local.score !== null && local.score !== undefined && local.score !== ''));
        if (!hasLocal && (r.feedback || (r.score !== null && r.score !== undefined))) {
          rec.teacherFeedback = { feedback: r.feedback || '', score: (r.score === undefined ? null : r.score), teacherName: 'คุณครู', teacherRole: 'ครูผู้สอน', feedbackAt: this.thaiTime(r.updated_at) };
        }
      });
      Store.save('ppk_student_submissions', all);
      localStorage.setItem(this.SINCE_KEY + '_at', new Date().toISOString());
      const msg = `📥 ดึงงานนักเรียนจากเซิร์ฟเวอร์แล้ว: งาน ${m.subs} • แบบทดสอบ ${m.quizzes} รายการ`;
      if (!opts.silent) GoogleSheetSync.showToast(msg, 'success');
      return { success: true, ...m };
    } catch (e) {
      if (!opts.silent) GoogleSheetSync.showToast('⚠️ ดึงงานไม่สำเร็จ: ' + (e.message || e), 'error');
      return { success: false, message: e.message };
    } finally {
      this.pulling = false;
    }
  },

  async pull(opts = {}) {
    if (this.isCloud() && !(typeof InternMode !== 'undefined' && InternMode.isActive())) return this._pullCloud(opts);
    if (typeof InternMode !== 'undefined' && InternMode.isActive()) {
      const r = await InternMode.sync().catch(e => ({ success: false, message: e.message }));
      if (!opts.silent) GoogleSheetSync.showToast(r.success ? `📥 ซิงค์ห้องที่สอนแล้ว: งาน ${r.submissions} รายการ` : '⚠️ ' + (r.message || 'ซิงค์ไม่สำเร็จ'), r.success ? 'success' : 'error');
      return r;
    }
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
if (typeof module !== 'undefined' && module.exports) module.exports = { StudentOutbox, TeacherPull, DueDates };
