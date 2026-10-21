// ==========================================================================
// MusicSmart • Student Auth (รหัสนักเรียน + PIN) และ RoleGuard (แยกสิ่งที่นักเรียน/ครูเห็น)
// - โหมดเซิร์ฟเวอร์: ตรวจรหัส/PIN ที่ Google Apps Script (รายชื่อจริงอยู่ในชีตของครูเท่านั้น)
// - โหมดออฟไลน์/ตัวอย่าง: ใช้รายชื่อในเครื่อง (Store) สำหรับสาธิตและทดสอบ
// ==========================================================================
const StudentAuth = {
  API_KEY: 'ppk_student_api_url',

  // URL ของ Apps Script ที่นักเรียนใช้ (ไม่ใช่ความลับ: ใช้ได้เฉพาะ action ของนักเรียน)
  getApiUrl() {
    try {
      if (typeof location !== 'undefined' && location.search) {
        const api = new URLSearchParams(location.search).get('api');
        if (api && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(api)) {
          localStorage.setItem(this.API_KEY, api);
          return api;
        }
      }
      const saved = localStorage.getItem(this.API_KEY);
      if (saved) return saved;
    } catch (e) { /* ignore */ }
    if (typeof MUSICSMART_PUBLIC_API_URL !== 'undefined' && MUSICSMART_PUBLIC_API_URL) return MUSICSMART_PUBLIC_API_URL;
    if (typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.getConfig) return GoogleSheetSync.getConfig().webAppUrl || '';
    return '';
  },

  isServerMode() { return !!this.getApiUrl(); },

  async _post(body, url) {
    const target = url || this.getApiUrl();
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    return res.json();
  },

  _sessionFromProfile(p) {
    return {
      role: 'student',
      studentId: String(p.studentId),
      studentClass: p.studentClass,
      name: p.name,
      nickname: p.nickname || '',
      no: p.no,
      source: 'server',
      loggedInAt: new Date().toISOString()
    };
  },

  // ---- student actions: return { success, ... } ----
  async lookup(studentId) {
    const id = String(studentId || '').trim();
    if (!this.isServerMode()) {
      const s = Store.getStudentById(id);
      if (!s) return { success: false, code: 'not_found', mode: 'local' };
      const acc = Store.getStudentAccount(id);
      return { success: true, mode: 'local', hasPin: !!(acc && (acc.pinHash || acc.pin)), studentClass: s.class,
        displayName: `${s.prefix}${s.first_name} ${s.last_name}` };
    }
    try {
      const r = await this._post({ action: 'studentLookup', studentId: id });
      if (r.status !== 'success') return { success: false, code: r.code, message: r.message, mode: 'server' };
      return { success: true, mode: 'server', hasPin: !!r.hasPin, studentClass: r.studentClass, displayName: r.maskedName, locked: !!r.locked };
    } catch (e) {
      return { success: false, code: 'network', mode: 'server', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต' };
    }
  },

  async _auth(action, studentId, pin) {
    const id = String(studentId || '').trim();
    const p = String(pin || '').trim();
    if (!/^\d{6}$/.test(p)) return { success: false, code: 'bad_pin', message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก (0-9)' };
    if (!this.isServerMode()) {
      const res = action === 'studentSetPin' ? Store.registerStudentPin(id, p) : Store.verifyStudentLogin(id, p);
      return { ...res, mode: 'local' };
    }
    try {
      const r = await this._post({ action, studentId: id, pin: p });
      if (r.status !== 'success') return { success: false, code: r.code, message: r.message, needsRegistration: r.code === 'needs_pin', mode: 'server' };
      const user = this._sessionFromProfile(r.profile);
      Store.setCurrentUser(user);
      return { success: true, user, mode: 'server' };
    } catch (e) {
      return { success: false, code: 'network', mode: 'server', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต' };
    }
  },
  setPin(studentId, pin) { return this._auth('studentSetPin', studentId, pin); },
  login(studentId, pin) { return this._auth('studentLogin', studentId, pin); },

  // ---- teacher actions (ใช้ Sync Token ของครู) ----
  _teacherCfg() {
    const cfg = (typeof GoogleSheetSync !== 'undefined') ? GoogleSheetSync.getConfig() : {};
    if (!cfg.webAppUrl || !cfg.syncToken) throw new Error('กรุณาตั้งค่า URL และรหัสซิงค์ (Sync Token) ในหน้าต่าง "ซิงค์คู่ Google Sheets" ก่อน');
    return cfg;
  },
  rosterForUpload() {
    const src = Store.getRoster ? Store.getRoster() : {};
    const list = [];
    Object.keys(src).forEach(cls => (src[cls] || []).forEach(s => list.push({
      student_id: s.student_id, prefix: s.prefix || '', first_name: s.first_name || '', last_name: s.last_name || '',
      nickname: s.nickname || '', class: s.class || cls, no: s.no || ''
    })));
    return list;
  },
  async uploadRoster(replace = false) {
    const cfg = this._teacherCfg();
    const students = this.rosterForUpload();
    if (!students.length) throw new Error('ยังไม่มีรายชื่อนักเรียนในเครื่องนี้ กรุณานำเข้ารายชื่อก่อน');
    const r = await this._post({ action: 'upload_roster', token: cfg.syncToken, students, replace }, cfg.webAppUrl);
    if (r.status !== 'success') throw new Error(r.message || 'อัปโหลดไม่สำเร็จ');
    return r;
  },
  async resetPinServer(studentId) {
    const cfg = this._teacherCfg();
    const r = await this._post({ action: 'reset_student_pin', token: cfg.syncToken, studentId: String(studentId) }, cfg.webAppUrl);
    if (r.status !== 'success') throw new Error(r.message || 'รีเซ็ตไม่สำเร็จ');
    return r;
  },
  studentLink() {
    let base = 'https://krumumpiano-source.github.io/MusicSmart-PPK/';
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') base = location.origin + location.pathname;
    let url = base + '?role=student';
    const api = (typeof GoogleSheetSync !== 'undefined') ? GoogleSheetSync.getConfig().webAppUrl : '';
    if (api) url += '&api=' + encodeURIComponent(api);
    return url;
  }
};

// ==========================================================================
// RoleGuard: ข้อมูลสำหรับครูต้องไม่ถูกสร้างลง DOM ของนักเรียนเลย (ไม่ใช่แค่ซ่อนด้วย CSS)
// ==========================================================================
const RoleGuard = {
  // ส่วนของหน้าเว็บที่เป็นของครูเท่านั้น จะถูกลบออกจาก DOM เมื่อเป็นนักเรียน
  TEACHER_ONLY_SELECTORS: [
    '#view-dashboard', '#view-cockpit', '#header-middle-teacher', '#teacher-actions-group', '#role-selector-pill',
    '#student-switcher-container',
    '#modal-reflection', '#modal-user-management', '#modal-timetable', '#modal-teaching-assignment', '#modal-makeup',
    '#modal-holiday', '#modal-export', '#modal-student-status', '#modal-transcript', '#modal-semester', '#modal-subjects',
    '#modal-academic-docs', '#modal-rubric-scoring', '#modal-car-analytics', '#modal-car-full-report',
    '#modal-official-forms', '#modal-app-settings', '#modal-google-sheet-sync', '#modal-lesson-editor',
    '#modal-curriculum-hub', '#modal-first-time-setup', '[data-teacher-only]'
  ],
  purged: false,

  isStudent() {
    const u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null;
    return !u || u.role !== 'teacher';
  },

  purgeTeacherDom(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d || !d.querySelectorAll) return 0;
    let n = 0;
    this.TEACHER_ONLY_SELECTORS.forEach(sel => {
      d.querySelectorAll(sel).forEach(el => { el.remove(); n++; });
    });
    this.purged = true;
    return n;
  },

  // บทเรียนฉบับนักเรียน: เหลือเฉพาะเนื้อหาที่ต้องเรียน + ภาระงาน
  // ตัดขั้นตอนการสอน (steps), คำแนะนำครูพี่เลี้ยง (mentor_tips), รูบริกสำหรับครู, เฉลย ออก
  STUDENT_MEDIA_BLOCK: /(ครู|teacher|แผนการสอน|lesson.?plan|เฉลย|answer|rubric|รูบริก|คู่มือครู)/i,
  sanitizeLesson(lesson) {
    if (!lesson) return null;
    return {
      lesson_id: lesson.lesson_id,
      grade: lesson.grade,
      period: lesson.period,
      unit_no: lesson.unit_no,
      unit_name: lesson.unit_name,
      topic: lesson.topic,
      duration_min: lesson.duration_min,
      kpa: lesson.kpa ? { k: lesson.kpa.k, p: lesson.kpa.p, a: lesson.kpa.a } : undefined,
      media: (lesson.media || [])
        .filter(m => m && !this.STUDENT_MEDIA_BLOCK.test(`${m.title || ''} ${m.url || ''}`))
        .map(m => ({ title: m.title, type: m.type, url: m.url })),
      assessment: lesson.assessment ? { has_score: !!lesson.assessment.has_score, max_score: lesson.assessment.max_score } : undefined
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StudentAuth, RoleGuard };
}
