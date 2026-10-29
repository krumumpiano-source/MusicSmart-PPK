// Storage Engine for MusicSmart PPK
// Local-First Persistence using localStorage with JSON Backup & SheetJS Export

const STORAGE_KEYS = {
  SETTINGS: 'ppk_app_settings',
  RESEARCH_SCORES: 'ppk_car_research_scores',
  INSTRUCTOR: 'ppk_instructor_profile',
  PROGRESS: 'ppk_class_progress',
  SESSIONS: 'ppk_session_logs',
  TIMETABLE: 'ppk_weekly_timetable',
  HOLIDAYS: 'ppk_holiday_logs',
  STUDENT_STATUS: 'ppk_student_status',
  SEMESTERS: 'ppk_semesters_meta',
  SUBJECTS: 'ppk_subjects_list',
  SUBMISSIONS: 'ppk_student_submissions',
  ACTIVE_ROLE: 'ppk_active_user_role',
  AUTH_CURRENT_USER: 'ppk_auth_current_user',
  STUDENT_ACCOUNTS: 'ppk_student_accounts',
  TEACHER_ACCOUNT: 'ppk_teacher_account',
  TEACHERS_LIST: 'ppk_teachers_list',
  SCHEDULE_ASSIGNMENTS: 'ppk_schedule_assignments',
  GOOGLE_SHEET_CONFIG: 'ppk_google_sheet_config',
  SYNC_OUTBOX: 'ppk_sync_outbox',
  AVATARS: 'ppk_profile_avatars',
  TERM_CONFIG: 'ppk_term_config'
};

// ปีการศึกษา/ภาคเรียน/รหัสวิชา คำนวณจาก app/data/term-config.js (วันที่ปัจจุบัน + ค่าที่ครูตั้ง) ที่เดียว
const TermCfg = (typeof TermConfig !== 'undefined') ? TermConfig : require('./term-config.js');

const DEFAULT_SCHEDULE_ASSIGNMENTS = {};

// รหัสผ่านครูไม่ได้เก็บเป็นข้อความธรรมดาในโค้ดอีกต่อไป เก็บเฉพาะค่า hash แบบมีเวอร์ชัน:
//   pbkdf2-sha256$v1$<รอบ>$<salt base64>$<hash base64>   (WebCrypto PBKDF2-SHA256, salt สุ่มต่อบัญชี)
// บัญชีเดิมที่เก็บ hash แบบเก่า (sha256_...) หรือรหัสผ่านตรง ๆ ในเครื่อง จะยังเข้าสู่ระบบได้
// และถูกอัปเกรดเป็นรูปแบบใหม่อัตโนมัติเมื่อเข้าสู่ระบบสำเร็จ
const DEFAULT_TEACHER_ACCOUNT = {
  email: 'krumum.piano@gmail.com',
  secretType: 'password', // 'password' or 'pin'
  secretHash: 'pbkdf2-sha256$v1$210000$qkSaZguyipmVy8i3sy3Viw==$Z/L/xYEJSuzQ/lRsOLSixRu6lIJd3EfD7EXOJHu5VXg=',
  name: 'นายพงศธร โพธิแก้ว'
};

// รหัสสำหรับบัญชีสาธิตเท่านั้น (ไม่ใช่รหัสจริง) ใช้ได้เฉพาะโหมดพัฒนา/ตัวอย่าง: localhost, USE_SAMPLE_DATA=1
const DEV_DEMO_PIN = 'demo-dev-only';

// บัญชีนักเรียนสาธิต (ม.1 = 00000, ม.2 = 0001 หรือ 00001) เปิดใช้เฉพาะโหมดพัฒนา/ตัวอย่างเท่านั้น (Store.isDevMode) ใช้รหัส DEV_DEMO_PIN
const TEST_STUDENTS = {
  '00000': {
    id: 'ม.1/1_0',
    student_id: '00000',
    prefix: 'นักเรียนทดสอบ ',
    first_name: 'ระดับชั้น ม.1',
    last_name: '(บัญชีสาธิต)',
    nickname: 'ทดสอบ ม.1',
    class: 'ม.1/1',
    no: 0,
    isTestAccount: true
  },
  '0001': {
    id: 'ม.2/1_0',
    student_id: '0001',
    prefix: 'นักเรียนทดสอบ ',
    first_name: 'ระดับชั้น ม.2',
    last_name: '(บัญชีสาธิต)',
    nickname: 'ทดสอบ ม.2',
    class: 'ม.2/1',
    no: 0,
    isTestAccount: true
  },
  '00001': {
    id: 'ม.2/1_0',
    student_id: '00001',
    prefix: 'นักเรียนทดสอบ ',
    first_name: 'ระดับชั้น ม.2',
    last_name: '(บัญชีสาธิต)',
    nickname: 'ทดสอบ ม.2',
    class: 'ม.2/1',
    no: 0,
    isTestAccount: true
  }
};

const DEFAULT_APP_SETTINGS = {
  appName: "MusicSmart",
  appBadge: "Adaptive T-PACE",
  innovationName: "ระบบนิเวศการเรียนรู้ดนตรีดิจิทัลรูปแบบ Adaptive T-PACE & 3-Tier Mastery",
  innovationSub: "Adaptive T-PACE & 3-Tier Mastery Music Learning Ecosystem",
  researchTitle: "การคิดค้นและปรับเปลี่ยนกระบวนการจัดการเรียนรู้ดนตรีโดยใช้นวัตกรรมรูปแบบการสอนเชิงรุกยืดหยุ่น (Adaptive T-PACE Model) ร่วมกับระบบการเรียนรู้ปรับเหมาะ 3 ระดับ (3-Tier Mastery Loop) เพื่อพัฒนาสมรรถนะการปฏิบัติคาลิมบ้าและการคิดขั้นสูงทางดนตรี ของนักเรียนชั้นมัธยมศึกษาปีที่ 1",
  schoolName: "โรงเรียนพะเยาพิทยาคม",
  schoolShort: "พ.พ.",
  minAttendancePercent: 80, // เกณฑ์เวลาเรียนขั้นต่ำ (ร้อยละ) ตามระเบียบ ปรับได้ในตั้งค่า
  periodMinutes: 50,        // นาทีต่อคาบ
  department: "กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)",
  directorName: "ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ",
  directorRole: "ผู้อำนวยการโรงเรียนพะเยาพิทยาคม",
  departmentHead: "นายอุดม ไชยวุฒิ",
  departmentHeadRole: "หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ",
  academicHead: "นายกฤศ วงค์เรือง",
  academicHeadRole: "รองผู้อำนวยการกลุ่มบริหารงานวิชาการ",
  evaluatorHead: "หัวหน้างานวัดและประเมินผล"
};

// ข้อมูลหัวตารางสอนทางการ (รหัสครู/ห้อง/วันที่ออก) อยู่คู่กับข้อมูลตารางสอนทางการ ไม่ฝังในโค้ดส่วนแสดงผล
const OFFICIAL_TIMETABLE_META = {
  teacherCode: '612',
  room: 'อส.5',
  date: '20.10.2569'
};

// ชื่อผู้สอนไม่ฝังซ้ำ: อ่านจากโปรไฟล์ที่บันทึก -> ตั้งค่าแอป (teacherName) -> บัญชีครูหลัก (DEFAULT_TEACHER_ACCOUNT.name)
const DEFAULT_INSTRUCTOR = {
  role: 'ครูประจำวิชา',
  name: ''
};

// เกณฑ์ตามแบบฟอร์ม วก.5 (แผนการจัดการเรียนรู้) ของโรงเรียน — ใช้ร่วมกันทั้งหน้าครู หน้านักเรียน และเอกสารพิมพ์
const WK5_FORM = {
  passLevel: 3,
  passPercent: 60,
  levels: [
    { level: 4, label: 'ดีเยี่ยม' },
    { level: 3, label: 'ดี' },
    { level: 2, label: 'พอใช้' },
    { level: 1, label: 'ปรับปรุง' }
  ],
  passText: 'ได้ระดับ 3 ขึ้นไป ร้อยละ 60 ถือว่าประสบผลสำเร็จในการสอน'
};

function emptyWk5Plan() {
  return {
    plan_no: null, unit_no: null, unit_name: '', topic: '', subject_group: '', level: '',
    standards: [], key_concept: '', content: [],
    objectives: { k: [], p: [], a: [] },
    competencies: [], work: [],
    activities: { note: '', intro: null, teach: null, wrap: null },
    media: [], assessment: { k: '', p: '', a: '' }, tools: [], rubric: []
  };
}

// code ของวิชาที่ autoCode=true คำนวณจาก term-config (คำนำหน้าของชั้น + เลขภาคเรียน) ใน Store.getAllSubjects()
const DEFAULT_SUBJECTS = [
  { id: 'M1_1', code: '', autoCode: true, name: 'ดนตรี 1 (ม.1)', grade: 'ม.1', periods: 20, active: true },
  { id: 'M1_EP', code: 'AR21105', name: 'ดนตรีสากล (ม.1/14 EP)', grade: 'ม.1/14', periods: 20, active: true },
  { id: 'M2', code: '', autoCode: true, name: 'ดนตรี 2 (ม.2)', grade: 'ม.2', periods: 20, active: true }
];

// activeId/Year/Term/Label ไม่ฝังในโค้ด — ได้จาก Store.getSemesterInfo() (term-config)
const DEFAULT_SEMESTER_META = {
  isArchiveView: false,
  viewingId: null,
  archives: {}
};

const OFFICIAL_TIMETABLE_2569_2 = {
  "จันทร์":    { 1: "", 2: "ม.1/7", 3: "", 4: "พักเที่ยง", 5: "", 6: "ม.1/14", 7: "ม.1/14", 8: "ม.2/4", 9: "", 10: "" },
  "อังคาร":    { 1: "จริยะ", 2: "", 3: "", 4: "พักเที่ยง", 5: "ม.1/1", 6: "", 7: "", 8: "ม.1/4", 9: "", 10: "" },
  "พุธ":       { 1: "", 2: "", 3: "ม.1/6", 4: "พักเที่ยง", 5: "ม.2/3", 6: "กก.ล.", 7: "กก.บ.", 8: "ประชุม PLC", 9: "ประชุม PLC", 10: "" },
  "พฤหัสบดี": { 1: "", 2: "ม.2/5", 3: "ม.2/7", 4: "พักเที่ยง", 5: "ม.2/6", 6: "ม.1/5", 7: "", 8: "ม.2/1", 9: "", 10: "" },
  "ศุกร์":     { 1: "", 2: "", 3: "ม.2/2", 4: "พักเที่ยง", 5: "", 6: "", 7: "ม.1/2", 8: "ม.1/3", 9: "", 10: "" }
};

const DEFAULT_TIMETABLE_PERIODS = [
  { no: 1, time: "08.20 - 09.10" },
  { no: 2, time: "09.10 - 10.00", breakAfter: "พัก 20 นาที (10.00 - 10.20)" },
  { no: 3, time: "10.20 - 11.10" },
  { no: 4, time: "11.10 - 12.00", canLunch: true, breakAfter: "พัก 20 นาที (12.00 - 12.20)" },
  { no: 5, time: "12.20 - 13.10", canLunch: true },
  { no: 6, time: "13.10 - 14.00" },
  { no: 7, time: "14.00 - 14.50", breakAfter: "พัก 10 นาที (14.50 - 15.00)" },
  { no: 8, time: "15.00 - 15.50" },
  { no: 9, time: "15.50 - 16.40" },
  { no: 10, time: "16.40 - 17.30" }
];

const Store = {
  // --- In-Memory Read-Through Cache & O(1) Hash Indexes ---
  _cache: new Map(),
  _studentIndex: null,
  _lessonIndex: null,
  _loginLocks: new Map(),

  // Deterministic Salted Hash (64-char hex digest) for PIN/Secret Protection
  hashSecret(secret, salt = 'ppk_musicsmart_v2') {
    const str = `${salt}:${String(secret || '').trim()}:ppk_sec_2569`;
    let h1 = 0xdeadbeef ^ str.length;
    let h2 = 0x41c6ce57 ^ str.length;
    let h3 = 0x811c9dc5 ^ str.length;
    let h4 = 0xcbf29ce4 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
      h3 = Math.imul(h3 ^ ch, 16777619);
      h4 = Math.imul(h4 ^ ch, 2246822507);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
    h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
    const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
    return `sha256_${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h1 ^ h3)}${hex(h2 ^ h4)}`;
  },

  // ===== โหมดพัฒนา/ตัวอย่าง: เปิดบัญชีสาธิตและรหัสทดสอบเฉพาะเมื่อชัดเจนว่าไม่ใช่เว็บจริง =====
  isDevMode() {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.USE_SAMPLE_DATA === true) return true;
      if (typeof process !== 'undefined' && process.env && process.env.USE_SAMPLE_DATA === '1') return true;
      if (typeof location !== 'undefined' && location && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(String(location.hostname || ''))) return true;
    } catch (e) {}
    return false;
  },
  getTestStudent(key) {
    return this.isDevMode() && Object.prototype.hasOwnProperty.call(TEST_STUDENTS, key) ? TEST_STUDENTS[key] : null;
  },

  // ===== รหัสผ่านครู: PBKDF2-SHA256 (WebCrypto) + salt สุ่มต่อบัญชี + เทียบแบบ constant-time =====
  STRONG_HASH_PREFIX: 'pbkdf2-sha256$v1$',
  STRONG_HASH_ITERATIONS: 210000,

  _webcrypto() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    if (typeof require === 'function') {
      try { return require('crypto').webcrypto; } catch (e) { /* ignore */ }
    }
    throw new Error('เบราว์เซอร์นี้ไม่รองรับ WebCrypto (ต้องเปิดผ่าน HTTPS หรือ localhost)');
  },
  _bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  },
  _b64ToBytes(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
  /** เทียบสองสตริง/ไบต์โดยใช้เวลาเท่ากันไม่ว่าจะต่างตรงไหน */
  _timingSafeEqual(a, b) {
    const x = typeof a === 'string' ? new TextEncoder().encode(a) : a;
    const y = typeof b === 'string' ? new TextEncoder().encode(b) : b;
    let diff = x.length ^ y.length;
    const n = Math.max(x.length, y.length);
    for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
    return diff === 0;
  },
  isStrongHash(v) {
    return typeof v === 'string' && v.indexOf(this.STRONG_HASH_PREFIX) === 0;
  },
  async _pbkdf2(secret, saltBytes, iterations) {
    const c = this._webcrypto();
    const key = await c.subtle.importKey('raw', new TextEncoder().encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
    const bits = await c.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256);
    return new Uint8Array(bits);
  },
  async hashSecretStrong(secret, iterations) {
    const iter = iterations || this.STRONG_HASH_ITERATIONS;
    const salt = this._webcrypto().getRandomValues(new Uint8Array(16));
    const hash = await this._pbkdf2(String(secret || '').trim(), salt, iter);
    return this.STRONG_HASH_PREFIX + iter + '$' + this._bytesToB64(salt) + '$' + this._bytesToB64(hash);
  },
  async verifySecretStrong(secret, stored) {
    if (!this.isStrongHash(stored)) return false;
    const parts = String(stored).split('$');
    if (parts.length !== 5) return false;
    const iter = parseInt(parts[2], 10);
    if (!(iter >= 10000 && iter <= 5000000)) return false;
    try {
      const salt = this._b64ToBytes(parts[3]);
      const expected = this._b64ToBytes(parts[4]);
      const actual = await this._pbkdf2(String(secret || '').trim(), salt, iter);
      return this._timingSafeEqual(actual, expected);
    } catch (e) {
      return false;
    }
  },
  /** ตรวจรหัสกับระเบียนครู (รองรับรูปแบบใหม่ + hash/รหัสแบบเก่าในเครื่อง) -> { ok, legacy } */
  async verifyRecordSecret(rec, secret) {
    const clean = String(secret || '').trim();
    if (!rec || !clean) return { ok: false, legacy: false };
    const h = rec.secretHash || '';
    if (this.isStrongHash(h)) {
      return { ok: await this.verifySecretStrong(clean, h), legacy: false };
    }
    const inputLegacy = this.hashSecret(clean, 'teacher');
    if (h && this._timingSafeEqual(inputLegacy, String(h))) return { ok: true, legacy: true };
    if (!h && rec.secret && this._timingSafeEqual(inputLegacy, this.hashSecret(String(rec.secret).trim(), 'teacher'))) return { ok: true, legacy: true };
    if (rec.secret && this._timingSafeEqual(clean, String(rec.secret).trim())) return { ok: true, legacy: true };
    return { ok: false, legacy: false };
  },
  /** อัปเกรดรหัสแบบเก่าเป็น PBKDF2 และลบรหัสผ่านตัวอักษรธรรมดาออกจากเครื่อง */
  async upgradeTeacherSecret(teacherId, secret) {
    const strong = await this.hashSecretStrong(secret);
    const list = this.getTeachersList();
    const t = list.find(x => x.id === teacherId);
    if (t) {
      t.secretHash = strong;
      delete t.secret;
      this.saveTeachersList(list);
    }
    if (teacherId === 'admin_primary' || (t && t.isAdmin)) {
      const next = { ...this.getTeacherAccount(), secretHash: strong, updatedAt: new Date().toISOString() };
      delete next.secret;
      this.save(STORAGE_KEYS.TEACHER_ACCOUNT, next);
    }
    return strong;
  },

  checkRateLimit(actorKey) {
    const rec = this._loginLocks.get(actorKey);
    if (!rec) return { allowed: true };
    if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
      const waitSec = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
      return {
        allowed: false,
        waitSec,
        message: `🔒 พยายามเข้าสู่ระบบผิดพลาดเกินกำหนด กรุณารอ ${waitSec} วินาทีแล้วลองใหม่อีกครั้ง`
      };
    }
    if (rec.lockedUntil && Date.now() >= rec.lockedUntil) {
      this._loginLocks.delete(actorKey);
    }
    return { allowed: true };
  },

  recordLoginAttempt(actorKey, isSuccess) {
    if (isSuccess) {
      this._loginLocks.delete(actorKey);
      return;
    }
    const rec = this._loginLocks.get(actorKey) || { count: 0, lockedUntil: null };
    rec.count += 1;
    if (rec.count >= 5) {
      rec.lockedUntil = Date.now() + 60 * 1000; // Lock for 60 seconds after 5 failed attempts
    }
    this._loginLocks.set(actorKey, rec);
  },

  // --- Generic Storage Helpers (Read-Through & Write-Through Cache) ---
  load(key, defaultVal = null) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    try {
      const d = localStorage.getItem(key);
      if (d === null || d === undefined) return defaultVal;
      const parsed = JSON.parse(d);
      this._cache.set(key, parsed);
      return parsed;
    } catch (e) {
      return defaultVal;
    }
  },

  save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      this._cache.set(key, val);
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      this._cache.delete(key);
      return true;
    } catch (e) {
      return false;
    }
  },

  clearCache() {
    this._cache.clear();
  },

  // --- Application & Innovation Settings (No Hardcoding) ---
  getAppSettings() {
    const saved = this.load(STORAGE_KEYS.SETTINGS, null);
    return saved ? { ...DEFAULT_APP_SETTINGS, ...saved } : { ...DEFAULT_APP_SETTINGS };
  },

  saveAppSettings(settings) {
    const current = this.getAppSettings();
    const merged = { ...current, ...settings };
    this.save(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  },

  getResearchScores(className) {
    return this.load(`${STORAGE_KEYS.RESEARCH_SCORES}_${className}`, {}) || {};
  },

  saveResearchScores(className, scoresObj) {
    return this.save(`${STORAGE_KEYS.RESEARCH_SCORES}_${className}`, scoresObj);
  },

  saveStudentResearchScore(className, studentId, pre, post, formative) {
    const scores = this.getResearchScores(className);
    let pPre = pre, pPost = post, pForm = formative;
    if (typeof pre === 'object' && pre !== null) {
      pPre = pre.pre;
      pPost = pre.post;
      pForm = pre.formative;
    }
    const prev = scores[studentId] || {};
    const toNumOrNull = (val, fallback) => {
      if (val !== undefined && val !== null && val !== '') {
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
      }
      return fallback !== undefined ? fallback : null;
    };
    scores[studentId] = {
      pre: toNumOrNull(pPre, prev.pre !== undefined ? prev.pre : null),
      post: toNumOrNull(pPost, prev.post !== undefined ? prev.post : null),
      formative: toNumOrNull(pForm, prev.formative !== undefined ? prev.formative : null),
      updatedAt: new Date().toISOString()
    };
    const res = this.saveResearchScores(className, scores);
    if (res && typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncResearch === 'function') {
      try {
        GoogleSheetSync.syncResearch(className, studentId, scores[studentId].pre, scores[studentId].post, scores[studentId].formative);
      } catch (e) {}
    }
    return res;
  },

  getUnitNoForPeriod(gradeOrClass, period) {
    const p = Number(period) || 1;
    const raw = String(gradeOrClass || '');
    const gradeKey = /^M\d+$/.test(raw) ? raw : (this.gradeKeyOf(raw) || 'M1');
    const lesson = (this.getLesson && this.getLesson(gradeKey, p)) || (this._lessonOf && this._lessonOf(gradeKey, p)) || null;
    const uNo = lesson && Number(lesson.unit_no);
    if (uNo >= 1) return uNo;
    return (p <= 7) ? 1 : (p <= 11) ? 2 : (p <= 15) ? 3 : 4;
  },

  getCurrentSubject(className) {
    const subjects = this.getAllSubjects();
    const gradeNo = this.gradeNumberOf(className);
    const grade = gradeNo ? `ม.${gradeNo}` : '';
    if (className === 'ม.1/14') {
      return subjects.find(s => s.code === 'AR21105') || { code: 'AR21105', name: 'ดนตรีสากล (ม.1/14 EP)', periods: 20 };
    }
    const match = subjects.find(s => s.grade === grade);
    if (match) return match;
    return { code: '', name: '', periods: this.getPeriodCount(this.gradeKeyOf(className)) };
  },

  // --- Instructor Profile ---
  getInstructor() {
    const saved = this.load(STORAGE_KEYS.INSTRUCTOR, null);
    const inst = saved ? { ...DEFAULT_INSTRUCTOR, ...saved } : { ...DEFAULT_INSTRUCTOR };
    if (!inst.name) inst.name = this._defaultTeacherName();
    return inst;
  },

  _defaultTeacherName() {
    let s = null;
    try { s = this.getAppSettings ? this.getAppSettings() : null; } catch (e) {}
    return (s && s.teacherName) || DEFAULT_TEACHER_ACCOUNT.name || '';
  },

  getTimetableMeta() {
    return { ...OFFICIAL_TIMETABLE_META };
  },

  setInstructor(role, name) {
    const defaultTeacher = this._defaultTeacherName();
    const profile = { role, name: name || (role === 'ครูประจำวิชา' ? defaultTeacher : 'คุณครูฝึกสอน') };
    this.save(STORAGE_KEYS.INSTRUCTOR, profile);
    return profile;
  },

  // --- Students Roster (with O(1) Hash Map Index) ---
  // รายชื่อจริงเก็บเฉพาะในเครื่อง (localStorage) ผ่านการนำเข้า JSON/Excel
  // ไฟล์ data/students.js บนเว็บเป็นข้อมูลตัวอย่างเท่านั้น (ไม่มีชื่อจริง)
  ROSTER_KEY: 'ppk_students_roster',
  _rosterCache: undefined,

  getRoster() {
    if (this._rosterCache === undefined) {
      const local = this.load(this.ROSTER_KEY, null);
      this._rosterCache = (local && typeof local === 'object' && Object.keys(local).length > 0) ? local : null;
    }
    const base = this._rosterCache || ((typeof STUDENTS_DATA !== 'undefined' && STUDENTS_DATA) ? STUDENTS_DATA : {});
    // นศ.ฝึกสอน: เห็นเฉพาะห้องที่ได้รับมอบหมายเท่านั้น (ห้ามเปิดสิทธิ์ห้องเรียนก่อนครูอนุมัติ)
    const u = this.getCurrentUser ? this.getCurrentUser() : null;
    if (u && u.role === 'intern') {
      const allowed = new Set(Array.isArray(u.classes) ? u.classes : []);
      const out = {};
      Object.keys(base).forEach(c => { if (allowed.has(c)) out[c] = base[c]; });
      return out;
    }
    return base;
  },

  hasLocalRoster() {
    this.getRoster();
    return !!this._rosterCache;
  },

  isSampleRoster() {
    return !this.hasLocalRoster() && typeof STUDENTS_IS_SAMPLE !== 'undefined' && !!STUDENTS_IS_SAMPLE;
  },

  /**
   * Normalise a roster from JSON ({"ม.1/1":[...]}, or a flat array) or Excel rows
   * (columns: ห้อง/class, เลขที่/no, รหัสนักเรียน/student_id, คำนำหน้า/prefix, ชื่อ/first_name, นามสกุล/last_name, ชื่อเล่น/nickname)
   */
  normalizeRoster(input) {
    let rows = [];
    if (Array.isArray(input)) rows = input;
    else if (input && typeof input === 'object') {
      const src = input.STUDENTS_DATA || input.students || input;
      Object.keys(src).forEach(cls => {
        if (Array.isArray(src[cls])) src[cls].forEach(r => rows.push({ class: cls, ...r }));
      });
    }
    const pick = (r, keys) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
      }
      return '';
    };
    const out = {};
    rows.forEach(r => {
      const cls = pick(r, ['class', 'className', 'ห้อง', 'ห้องเรียน', 'ชั้น']);
      const sid = pick(r, ['student_id', 'studentId', 'รหัสนักเรียน', 'เลขประจำตัว', 'รหัส']);
      const first = pick(r, ['first_name', 'firstName', 'ชื่อ']);
      if (!cls || !sid || !first) return;
      if (!out[cls]) out[cls] = [];
      const no = Number(pick(r, ['no', 'เลขที่', 'rollNo'])) || (out[cls].length + 1);
      out[cls].push({
        id: `${cls}_${no}`,
        student_id: sid,
        prefix: pick(r, ['prefix', 'คำนำหน้า', 'คำนำหน้าชื่อ']),
        first_name: first,
        last_name: pick(r, ['last_name', 'lastName', 'นามสกุล']),
        nickname: pick(r, ['nickname', 'ชื่อเล่น']),
        class: cls,
        no
      });
    });
    Object.keys(out).forEach(c => out[c].sort((a, b) => a.no - b.no));
    return out;
  },

  importRoster(input) {
    const roster = this.normalizeRoster(input);
    const classes = Object.keys(roster);
    if (classes.length === 0) return { success: false, error: 'ไม่พบข้อมูลนักเรียน (ต้องมี ห้อง, รหัสนักเรียน, ชื่อ)' };
    this.save(this.ROSTER_KEY, roster);
    this._rosterCache = undefined;
    this._studentIndex = null;
    let count = 0;
    classes.forEach(c => { count += roster[c].length; });
    return { success: true, classes: classes.length, count };
  },

  clearRoster() {
    try { localStorage.removeItem(this.ROSTER_KEY); } catch (e) {}
    this._rosterCache = undefined;
    this._studentIndex = null;
  },

  getStudents(className) {
    const roster = this.getRoster();
    return roster[className] || [];
  },

  _ensureStudentIndex() {
    if (!this._studentIndex) {
      const roster = this.getRoster();
      this._studentIndex = new Map();
      for (const className of Object.keys(roster)) {
        const list = roster[className] || [];
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          this._studentIndex.set(String(s.student_id).trim(), { ...s, class: className });
        }
      }
    }
  },

  isTestStudentId(studentId) {
    const key = String(studentId || '').trim();
    return Boolean(this.getTestStudent(key));
  },

  // บัญชีสาธิตใช้รหัสทดสอบ DEV_DEMO_PIN เฉพาะโหมดพัฒนา/ตัวอย่าง — ไม่ผูกกับรหัสผ่านครู
  isTestStudentSecretValid(secret) {
    if (!this.isDevMode()) return false;
    const clean = String(secret || '').trim();
    if (!clean) return false;
    return this._timingSafeEqual(clean, DEV_DEMO_PIN);
  },

  getStudentById(studentId) {
    const key = String(studentId || '').trim();
    if (this.getTestStudent(key)) {
      return { ...this.getTestStudent(key) };
    }
    this._ensureStudentIndex();
    return this._studentIndex ? (this._studentIndex.get(key) || null) : null;
  },

  getAllClasses(grade = 'M1') {
    const list = [];
    const source = this.getRoster();
    const prefix = `ม.${String(grade).replace(/^M/, '')}/`;
    for (const key of Object.keys(source)) {
      if (key.startsWith(prefix)) {
        list.push(key);
      }
    }
    list.sort((a, b) => {
      const numA = parseInt(a.split('/')[1], 10);
      const numB = parseInt(b.split('/')[1], 10);
      return numA - numB;
    });
    return list;
  },

  // --- Lessons Data with Overlay Customization Layer ---
  getCustomLessons(grade = 'M1') {
    const all = this.load('ppk_custom_lessons', {}) || {};
    return all[grade] || {};
  },

  saveCustomLesson(grade, period, customData) {
    const all = this.load('ppk_custom_lessons', {}) || {};
    if (!all[grade]) all[grade] = {};
    const p = Number(period);
    all[grade][p] = {
      ...(all[grade][p] || {}),
      ...customData,
      updatedAt: new Date().toISOString(),
      isCustomized: true
    };
    this.save('ppk_custom_lessons', all);
    if (this._lessonIndex) this._lessonIndex.clear();

    // Dual-Save hook to Google Sheets
    if (typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncCurriculumLesson === 'function') {
      try {
        GoogleSheetSync.syncCurriculumLesson(grade, p, all[grade][p]);
      } catch (e) {
        console.warn('Sync custom lesson error:', e);
      }
    }

    return this.getLesson(grade, p);
  },

  resetCustomLesson(grade, period) {
    const all = this.load('ppk_custom_lessons', {}) || {};
    const p = Number(period);
    if (all[grade] && all[grade][p]) {
      delete all[grade][p];
      this.save('ppk_custom_lessons', all);
      if (this._lessonIndex) this._lessonIndex.clear();
      return true;
    }
    return false;
  },

  resetAllCustomLessons() {
    this.save('ppk_custom_lessons', {});
    if (this._lessonIndex) this._lessonIndex.clear();
    return true;
  },

  // แปลงชื่อห้อง (เช่น ม.2/3) เป็นรหัสชั้น (M2) และเลขชั้น (2)
  gradeNumberOf(className) {
    const m = String(className || '').match(/^ม\.(\d+)/);
    return m ? m[1] : '';
  },

  gradeKeyOf(className) {
    const n = this.gradeNumberOf(className);
    return n ? `M${n}` : '';
  },

  // ข้อมูลระดับชั้น/รายวิชา จากรหัสชั้น (M1, M2, ...) อ่านจากรายวิชาที่ตั้งไว้ ไม่ฝังชื่อวิชา
  getGradeInfo(gradeKey) {
    const n = String(gradeKey || '').replace(/^M/, '');
    if (!/^\d+$/.test(n)) return null;
    const short = `ม.${n}`;
    const subj = this.getAllSubjects().find(s => s.grade === short) || null;
    return {
      key: `M${n}`,
      number: n,
      short,
      level: `มัธยมศึกษาปีที่ ${n}`,
      subject: subj,
      code: subj ? subj.code : '',
      subjectName: subj ? String(subj.name).replace(/\s*\(.*\)\s*$/, '') : ''
    };
  },

  // สรุปโครงสร้างคะแนนรายวิชา คำนวณจาก LESSONS_DATA (ไม่ฮาร์ดโค้ดจำนวนคาบ/คะแนน)
  getCourseSummary(gradeKey) {
    const lessons = (typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA[gradeKey]) ? LESSONS_DATA[gradeKey] : [];
    const isExam = l => ['quiz', 'exam'].includes(l.assessment?.type);
    const unitMap = new Map();
    const examRows = [];
    let collect = 0;
    let total = 0;
    lessons.forEach(l => {
      const a = l.assessment || {};
      const sc = a.has_score ? Number(a.max_score) || 0 : 0;
      if (!sc) return;
      total += sc;
      if (isExam(l)) {
        examRows.push({ period: l.period, name: l.unit_name || l.topic || '', score: sc });
        return;
      }
      collect += sc;
      if (!unitMap.has(l.unit_no)) unitMap.set(l.unit_no, { unit_no: l.unit_no, unit_name: l.unit_name || '', score: 0, periods: [] });
      const u = unitMap.get(l.unit_no);
      u.score += sc;
      u.periods.push(l.period);
    });
    const unitNos = new Set(lessons.map(l => l.unit_no));
    return { periods: lessons.length, unitCount: unitNos.size, unitRows: [...unitMap.values()], examRows, collect, total };
  },

  // เกณฑ์/ค่าคงที่ของแบบฟอร์ม วก.5
  getWk5Criteria() {
    return WK5_FORM;
  },

  // จำนวนคาบของรายวิชา (อ่านจากข้อมูลบทเรียน ไม่ฮาร์ดโค้ด 20)
  getPeriodCount(grade) {
    if (typeof LESSONS_DATA === 'undefined' || !LESSONS_DATA[grade]) return 0;
    return LESSONS_DATA[grade].length;
  },

  // แผน วก.5 แบบมีโครงสร้าง (สร้างจากเอกสารแผน; ไม่มี => null เช่นคาบสอบ)
  // แผน วก.5 ของคาบ: ใช้แผนจากเอกสารเมื่อหัวข้อตรงกับบทเรียนในแอปเท่านั้น
  // (กันข้อมูลแผนเก่าที่ไม่ตรงหลักสูตรปัจจุบัน) ถ้าไม่ตรง/ไม่มี => สร้างจากบทเรียนในแอป
  // เฉพาะช่องที่มีข้อมูลจริง ช่องอื่นเว้นว่างให้ครูกรอกในตัวแก้ไขบทเรียน
  getWk5Plan(grade, period) {
    const p = Number(period);
    const base = (typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA[grade])
      ? LESSONS_DATA[grade].find(l => Number(l.period) === p) : null;
    const plan = (typeof WK5_PLANS !== 'undefined' && WK5_PLANS && WK5_PLANS[grade]) ? (WK5_PLANS[grade][p] || null) : null;
    if (plan && (!base || String(plan.topic).trim() === String(base.topic).trim())) {
      return { ...plan, source: 'plan' };
    }
    return base ? this._deriveWk5FromLesson(base) : null;
  },

  _deriveWk5FromLesson(base) {
    const w = emptyWk5Plan();
    const kpa = base.kpa || {};
    w.source = 'lesson';
    w.topic = base.topic || '';
    w.unit_no = base.unit_no || '';
    w.unit_name = base.unit_name || '';
    w.objectives = { k: kpa.k ? [kpa.k] : [], p: kpa.p ? [kpa.p] : [], a: kpa.a ? [kpa.a] : [] };
    w.media = (base.media || []).map(m => m && m.title).filter(Boolean);
    const steps = (base.steps || []).filter(s => s && (s.phase || s.desc));
    const mk = list => ({
      minutes: list.reduce((a, s) => a + (Number(s.duration) || 0), 0) || '',
      items: list.map(s => (s.phase ? String(s.phase).replace(/\s*\(\d+\s*นาที\)\s*$/, '') + ': ' : '') + (s.desc || ''))
    });
    if (steps.length >= 3) {
      w.activities = { intro: mk(steps.slice(0, 1)), teach: mk(steps.slice(1, -1)), wrap: mk(steps.slice(-1)) };
    } else if (steps.length) {
      w.activities = { intro: mk(steps.slice(0, 1)), teach: mk(steps.slice(1)), wrap: mk([]) };
    }
    const a = base.assessment || {};
    if (Array.isArray(a.rubrics) && a.rubrics.length) {
      const levels = {};
      a.rubrics.forEach(r => { if (r && r.score) levels[r.score] = r.desc || ''; });
      w.rubric = [{ label: 'เกณฑ์การประเมินผลงาน/การปฏิบัติ', weight: a.max_score || '', levels }];
    }
    return w;
  },

  _mergeWk5(plan, custom) {
    const b = plan || emptyWk5Plan();
    if (!custom) return b;
    return {
      ...b,
      ...custom,
      objectives: { ...(b.objectives || {}), ...(custom.objectives || {}) },
      assessment: { ...(b.assessment || {}), ...(custom.assessment || {}) },
      activities: { ...(b.activities || {}), ...(custom.activities || {}) }
    };
  },

  // ระดับชั้นที่ใช้ วก.5 เป็นแหล่งเดียวของ "การ์ดเนื้อหาคาบ" (หัวข้อ/หน่วย/KPA/ขั้นตอน/เวลา/สื่อ) — ไม่ใช้ข้อความ legacy ใน lessons.js
  WK5_PROJECT_GRADES: ['M1'],

  // สร้างฟิลด์ของการ์ดบทเรียนจาก วก.5 ล้วน ๆ (ไม่เพิ่มข้อมูลที่ วก.5 ไม่มี)
  _projectWk5(base, plan) {
    const txt = a => (Array.isArray(a) ? a : [a]).filter(x => x !== undefined && x !== null).map(x => String(x).trim()).filter(Boolean).join(' ');
    const act = plan.activities || {};
    const steps = ['intro', 'teach', 'wrap'].filter(k => act[k] && (act[k].title || (act[k].items || []).length)).map(k => {
      const mins = Number(act[k].minutes) || 0;
      return { phase: String(act[k].title || '') + (mins ? ` (${mins} นาที)` : ''), duration: mins, desc: (act[k].items || []).map(x => String(x)).join('\n') };
    });
    const norm = t => String(t || '').replace(/\s*\((doc|app|link|image|tool|video|rubric|interactive|app_module)\)\s*$/i, '').replace(/\s+/g, '');
    const wkTitles = (plan.media || []).map(norm);
    const o = plan.objectives || {};
    const total = Number(plan.score_total) || 0;
    return {
      ...base,
      topic: plan.topic || base.topic,
      unit_no: plan.unit_no || base.unit_no,
      unit_name: plan.unit_name || base.unit_name,
      kpa: { k: txt(o.k), p: txt(o.p), a: txt(o.a) },
      steps,
      duration_min: steps.reduce((a, s) => a + s.duration, 0) || base.duration_min,
      mentor_tips: '',
      aids: /ปฐมนิเทศ/.test(String(plan.topic || '')) ? ['orientation'] : [],
      media: (base.media || []).filter(m => m && wkTitles.indexOf(norm(m.title)) !== -1),
      assessment: { ...(base.assessment || {}), max_score: total, has_score: total > 0 },
      fromWk5: true
    };
  },

  getLesson(grade, period) {
    if (typeof LESSONS_DATA === 'undefined' || !LESSONS_DATA[grade]) return null;
    const p = Number(period);
    let base = (LESSONS_DATA[grade] || []).find(l => Number(l.period) === p);
    if (!base) return null;

    const plan = this.getWk5Plan(grade, p);
    if (plan && plan.source === 'plan' && this.WK5_PROJECT_GRADES.indexOf(grade) !== -1) base = this._projectWk5(base, plan);
    const custom = this.getCustomLessons(grade)[p];
    if (!custom) return { ...base, wk5: this._mergeWk5(plan, null) };

    return {
      ...base,
      ...custom,
      kpa: { ...(base.kpa || {}), ...(custom.kpa || {}) },
      steps: custom.steps || base.steps,
      media: custom.media || base.media,
      assessment: { ...(base.assessment || {}), ...(custom.assessment || {}) },
      wk5: this._mergeWk5(plan, { ...(custom.topic ? { topic: custom.topic } : {}), ...(custom.wk5 || {}) }),
      isCustomized: true
    };
  },

  getAllLessons(grade = 'M1') {
    if (typeof LESSONS_DATA === 'undefined' || !LESSONS_DATA[grade]) return [];
    return (LESSONS_DATA[grade] || []).map(l => this.getLesson(grade, l.period));
  },

  // --- Class Progress Tracking ---
  getAllProgress() {
    return this.load(STORAGE_KEYS.PROGRESS, {}) || {};
  },

  getClassProgress(className) {
    const all = this.getAllProgress();
    return all[className] || {
      lastPeriod: 0,
      nextPeriod: 1,
      lastInstructor: '-',
      lastDate: '-',
      lastHandover: 'ยังไม่มีบันทึกส่งต่องาน'
    };
  },

  // --- Sessions Logs (with Atomic Write Rollback Protection) ---
  getAllSessions() {
    return this.load(STORAGE_KEYS.SESSIONS, {}) || {};
  },

  getSessionKey(className, period) {
    return `${className}_P${period}`;
  },

  getSession(className, period) {
    const all = this.getAllSessions();
    return all[this.getSessionKey(className, period)] || null;
  },

  saveSession(className, period, sessionData) {
    const all = this.getAllSessions();
    const key = this.getSessionKey(className, period);
    const prevSessionBackup = all[key] ? JSON.parse(JSON.stringify(all[key])) : undefined;
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    all[key] = {
      className,
      period,
      timestamp: now.toISOString(),
      dateStr,
      ...sessionData
    };

    if (!this.save(STORAGE_KEYS.SESSIONS, all)) {
      if (prevSessionBackup === undefined) delete all[key];
      else all[key] = prevSessionBackup;
      return null;
    }

    // Update Class Progress Atomically
    const allProgress = this.getAllProgress();
    allProgress[className] = {
      lastPeriod: period,
      nextPeriod: Math.min(20, period + 1),
      lastInstructor: sessionData.instructor?.name || this.getInstructor().name,
      lastDate: dateStr,
      lastHandover: sessionData.handoverNote || 'ไม่มีบันทึกเพิ่มเติม'
    };

    if (!this.save(STORAGE_KEYS.PROGRESS, allProgress)) {
      // Rollback session write on failure
      if (prevSessionBackup === undefined) delete all[key];
      else all[key] = prevSessionBackup;
      this.save(STORAGE_KEYS.SESSIONS, all);
      return null;
    }

    if (typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncSessionLog === 'function') {
      try {
        GoogleSheetSync.syncSessionLog(className, period, all[key]);
      } catch (e) {
        console.warn('Dual-save to Google Sheet error:', e);
      }
    }

    // โหมด Cloud: ส่งคาบ (เช็คชื่อ/คะแนน) ขึ้น D1 — ล้มเหลวแล้วจะลองใหม่ครั้งถัดไป
    if (typeof CloudSync !== 'undefined' && CloudSync.pushSession) {
      CloudSync.pushSession(className, period).catch(() => {});
    }

    return all[key];
  },

  // --- Student Lifecycle & Status (จำหน่ายออก/ย้ายสถานศึกษา) ---
  getAllStudentStatuses() {
    return this.load(STORAGE_KEYS.STUDENT_STATUS, {}) || {};
  },

  getStudentStatus(studentId) {
    const all = this.getAllStudentStatuses();
    return all[studentId] || { status: 'active', date: '', reason: '', note: '', pdpaConsent: false };
  },

  setStudentStatus(studentId, { status, date, reason, note, pdpaConsent }) {
    const all = this.getAllStudentStatuses();
    const existing = all[studentId] || {};
    all[studentId] = {
      status: status || 'active',
      date: date || new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
      reason: reason || '',
      note: note || '',
      pdpaConsent: pdpaConsent !== undefined ? !!pdpaConsent : (existing.pdpaConsent || false),
      updatedAt: new Date().toISOString(),
      updatedBy: this.getInstructor().name
    };
    this.save(STORAGE_KEYS.STUDENT_STATUS, all);
    return all[studentId];
  },

  getStudentPdpaConsent(studentId) {
    const st = this.getStudentStatus(studentId);
    return !!st.pdpaConsent;
  },

  setStudentPdpaConsent(studentId, isConsented) {
    const all = this.getAllStudentStatuses();
    if (!all[studentId]) all[studentId] = { status: 'active' };
    all[studentId].pdpaConsent = !!isConsented;
    all[studentId].updatedAt = new Date().toISOString();
    return this.save(STORAGE_KEYS.STUDENT_STATUS, all);
  },

  isStudentWithdrawn(studentId) {
    const st = this.getStudentStatus(studentId);
    return st.status === 'withdrawn' || st.status === 'transferred';
  },

  getStudentTranscript(className, studentId) {
    const students = this.getStudents(className);
    const student = students.find(s => s.student_id === studentId);
    if (!student) return null;

    const statusObj = this.getStudentStatus(studentId);
    const sessions = this.getAllSessions();
    const progress = this.getClassProgress(className);
    const grade = this.gradeKeyOf(className);
    const allLessons = this.getAllLessons(grade);

    let attendedCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let lateCount = 0;
    let activityCount = 0;
    let totalEligibleSessions = 0;

    const scoresList = [];
    let totalScoreEarned = 0;
    let totalMaxScore = 0;

    for (let p = 1; p <= progress.lastPeriod; p++) {
      const key = this.getSessionKey(className, p);
      const sess = sessions[key];
      const lesson = allLessons.find(l => l.period === p);
      const lessonTitle = lesson ? lesson.topic : `คาบที่ ${p}`;
      const maxScore = lesson?.assessment?.max_score || 3;

      if (sess) {
        totalEligibleSessions++;
        const att = sess.attendance[studentId] || 'present';
        if (att === 'present' || att === 'remedial') attendedCount++;
        else if (att === 'absent' || att === 'truant') absentCount++;
        else if (att === 'leave' || att === 'sick') leaveCount++;
        else if (att === 'late') lateCount++;
        else if (att === 'activity') activityCount++;

        const sc = sess.scores[studentId];
        const hasScore = sc !== undefined && sc !== null && sc !== '';
        if (hasScore) totalScoreEarned += Number(sc);
        totalMaxScore += maxScore;

        scoresList.push({
          period: p,
          dateStr: sess.dateStr || '-',
          lessonTitle,
          attendance: att,
          score: hasScore ? sc : '-',
          maxScore
        });
      }
    }

    const attendancePct = totalEligibleSessions > 0
      ? Math.round(((attendedCount + lateCount + activityCount) / totalEligibleSessions) * 100)
      : 100;

    return {
      student,
      className,
      status: statusObj,
      attendanceStats: {
        totalEligibleSessions,
        attendedCount,
        absentCount,
        leaveCount,
        lateCount,
        activityCount,
        attendancePct
      },
      scoresList,
      totalScoreEarned,
      totalMaxScore,
      scorePct: totalMaxScore > 0 ? Math.round((totalScoreEarned / totalMaxScore) * 100) : 0,
      instructor: this.getInstructor(),
      semesterLabel: this.getSemesterInfo().label,
      generatedAt: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  },

  // --- Remedial & Make-up Score System (ระบบติดตามงานค้าง/สอบซ่อม) ---
  getPendingMakeups(className) {
    const grade = this.gradeKeyOf(className);
    const students = this.getStudents(className);
    const sessions = this.getAllSessions();
    const pendingList = [];

    const periodTotal = this.getPeriodCount(grade);
    for (let p = 1; p <= periodTotal; p++) {
      const lesson = this.getLesson(grade, p);
      if (!lesson || !lesson.assessment?.has_score) continue;
      // คาบสอบ (กลาง/ปลายภาค) ให้คะแนนจากข้อสอบ ไม่ใช่ระดับ 1-4 -> ไม่รวมในรายการระดับ (ดู getPendingExamMakeups)
      if (this.isExamPeriod && this.isExamPeriod(grade, p)) continue;

      const key = this.getSessionKey(className, p);
      const sess = sessions[key];
      if (!sess) continue;

      students.forEach(s => {
        // Skip withdrawn/transferred students
        if (this.isStudentWithdrawn(s.student_id)) return;

        const isAbsent = sess.attendance[s.student_id] === 'absent' || sess.attendance[s.student_id] === 'leave';
        const hasScore = sess.scores[s.student_id] !== undefined;

        if (isAbsent && !hasScore) {
          pendingList.push({
            student: s,
            period: p,
            lessonTopic: lesson.topic,
            maxScore: lesson.assessment.max_score,
            reason: sess.attendance[s.student_id] === 'absent' ? 'ขาดเรียน' : 'ลา'
          });
        }
      });
    }

    return pendingList;
  },

  // นักเรียนที่ขาด/ลาในคาบสอบ และยังไม่มีคะแนนสอบ -> ต้องสอบชดเชยผ่านแผงข้อสอบ (ไม่ใช่ปุ่มระดับ 1-4)
  getPendingExamMakeups(className) {
    const grade = this.gradeKeyOf(className);
    const students = this.getStudents(className);
    const sessions = this.getAllSessions();
    const out = [];
    (this.getExamPeriods(grade) || []).forEach(p => {
      const sess = sessions[this.getSessionKey(className, p)];
      if (!sess) return;
      const att = sess.attendance || {}, sc = sess.scores || {};
      students.forEach(s => {
        if (this.isStudentWithdrawn(s.student_id)) return;
        const a = att[s.student_id];
        if ((a === 'absent' || a === 'leave') && sc[s.student_id] === undefined) out.push({ student: s, period: p, reason: a === 'absent' ? 'ขาดเรียน' : 'ลา' });
      });
    });
    return out;
  },

  saveMakeupScore(className, period, studentId, score) {
    const all = this.getAllSessions();
    const key = this.getSessionKey(className, period);
    if (!all[key]) return false;

    if (!all[key].scores) all[key].scores = {};
    all[key].scores[studentId] = score;

    return this.save(STORAGE_KEYS.SESSIONS, all);
  },

  // --- Holiday & School Activity Logging (งดการเรียนการสอน) ---
  logHoliday(className, dateStr, reason) {
    const logs = this.load(STORAGE_KEYS.HOLIDAYS, []) || [];

    const entry = {
      id: Date.now(),
      className,
      date: dateStr || new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
      reason,
      instructor: this.getInstructor().name
    };
    logs.push(entry);
    this.save(STORAGE_KEYS.HOLIDAYS, logs);

    // Update class progress note WITHOUT advancing period
    const allProgress = this.getAllProgress();
    if (allProgress[className]) {
      allProgress[className].lastHandover = `[งดสอน ${entry.date}]: ${reason}`;
      this.save(STORAGE_KEYS.PROGRESS, allProgress);
    }

    return entry;
  },

  getHolidayLogs(className) {
    const logs = this.load(STORAGE_KEYS.HOLIDAYS, []) || [];
    return className ? logs.filter(l => l.className === className) : logs;
  },

  // --- Helper: Collect & Restore Extended Prefix Keys (Rubrics, Quizzes, Feldman, Research, Practice) ---
  collectExtendedAssessmentData() {
    const prefixes = [
      'music_rubric_',
      'music_quiz_',
      'music_feldman_',
      'feldman_criticism_',
      'ppk_practice_log_',
      'ppk_quiz_settings',
      'ppk_kalimba_devices',
      'ppk_kalimba_notes',
      `${STORAGE_KEYS.RESEARCH_SCORES}_`
    ];
    const collected = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && prefixes.some(pref => k.startsWith(pref))) {
          collected[k] = localStorage.getItem(k);
        }
      }
    } catch (e) {}
    return collected;
  },

  restoreExtendedAssessmentData(extMap) {
    if (!extMap || typeof extMap !== 'object') return;
    try {
      for (const [k, rawVal] of Object.entries(extMap)) {
        if (typeof rawVal === 'string') {
          localStorage.setItem(k, rawVal);
          this._cache.delete(k);
        }
      }
    } catch (e) {}
  },

  // --- Semester & Term Lifecycle Management ---
  getSemesterMeta() {
    const saved = this.load(STORAGE_KEYS.SEMESTERS, null);
    const cur = this.getSemesterInfo();
    const base = { ...DEFAULT_SEMESTER_META, activeId: cur.id, activeYear: cur.year, activeTerm: cur.term, activeLabel: cur.label };
    return saved ? { ...base, ...saved } : base;
  },

  // --- ปีการศึกษา/ภาคเรียน/รหัสวิชา (term-config) ---
  // ค่าที่ครูตั้ง (ปฏิทินภาคเรียน, คำนำหน้ารหัสวิชาต่อชั้น, override) — ว่าง = ใช้ค่าเริ่มต้นใน term-config.js
  getTermConfigRaw() { return this.load(STORAGE_KEYS.TERM_CONFIG, null); },
  getTermConfig() { return TermCfg.normalize(this.getTermConfigRaw()); },
  saveTermConfig(cfg) {
    const n = TermCfg.normalize(cfg);
    this.save(STORAGE_KEYS.TERM_CONFIG, n);
    return n;
  },

  // แหล่งข้อมูลเดียวของ "ภาคเรียน/ปีการศึกษา" — คำนวณจากวันที่ (now) + ปฏิทิน + override ที่ครูตั้ง
  // ทุกหน้า/เอกสารต้องเรียกผ่านฟังก์ชันนี้ (ห้ามพิมพ์ตัวเลขภาคเรียนเอง)
  getSemesterInfo(now) {
    const r = TermCfg.resolve(this.getTermConfigRaw(), now);
    const term = String(r.term);
    const year = String(r.year);
    return {
      term,
      year,
      id: r.id,
      source: r.source,           // calendar | projected | override
      projected: r.projected,     // true = ปฏิทินปีนี้ต่อจากปีล่าสุดที่ครูกรอก (ควรตรวจวันเริ่ม/จบ)
      inBreak: r.inBreak,
      label: `ภาคเรียนที่ ${term} ปีการศึกษา ${year}`,
      shortLabel: `ภาคเรียนที่ ${term}/${year}`,
      short: `${term}/${year}`
    };
  },

  // รหัสวิชาของชั้น (รับ 'ม.1' | 'M1' | 'ม.1/7') ณ วันที่ now — ว่างถ้ายังไม่ได้ตั้งคำนำหน้าของชั้นนั้น
  getSubjectCode(grade, now) {
    return TermCfg.subjectCode(this.getTermConfigRaw(), grade, this.getSemesterInfo(now).term);
  },

  // เปลี่ยนภาคเรียนอัตโนมัติเมื่อถึงวันเริ่มภาคใหม่: เก็บข้อมูลภาคเดิมเข้า archive (ไม่ลบ) แล้วเริ่มภาคใหม่
  // เรียกตอนเปิดแอป/กลับมาที่แอป — ปิดได้ด้วย term-config.autoRollover=false
  autoRolloverIfNeeded(now) {
    const cfg = this.getTermConfig();
    const cur = this.getSemesterInfo(now);
    const saved = this.load(STORAGE_KEYS.SEMESTERS, null);
    if (!saved || !saved.activeId) {
      // ครั้งแรก: ตราข้อมูลปัจจุบันด้วยภาคเรียนที่คำนวณได้ ณ วันที่ now
      const meta = { ...this.getSemesterMeta(), activeId: cur.id, activeYear: cur.year, activeTerm: cur.term, activeLabel: cur.label };
      this.saveSemesterMeta(meta);
      return { changed: false, stamped: true, id: cur.id };
    }
    if (saved.isArchiveView || !cfg.autoRollover || saved.activeId === cur.id) return { changed: false, id: saved.activeId };
    const from = saved.activeId;
    this.startNewSemester(cur.year, cur.term, { auto: true });
    return { changed: true, from, to: cur.id };
  },

  // ปรับข้อความคงที่ของหลักสูตร ม.1 (lessons / wk5 / quizzes / academic_docs) ให้ตรงรหัสวิชา+ภาคเรียนปัจจุบัน — ทำซ้ำได้ (idempotent)
  applyTermToStaticData(now) {
    const info = this.getSemesterInfo(now);
    const key = info.id + '|' + this.getSubjectCode('ม.1', now) + '|' + JSON.stringify(this.getTermConfigRaw() && this.getTermConfigRaw().subjectPrefixByGrade || '');
    if (this._termAppliedKey === key) return false;
    const raw = this.getTermConfigRaw();
    const targets = [];
    try { if (typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA.M1) targets.push(LESSONS_DATA.M1); } catch (e) {}
    try { if (typeof WK5_PLANS !== 'undefined' && WK5_PLANS.M1) targets.push(WK5_PLANS.M1); } catch (e) {}
    try { if (typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' && ACADEMIC_DOCS_BY_GRADE.M1) targets.push(ACADEMIC_DOCS_BY_GRADE.M1); } catch (e) {}
    try { if (typeof QUIZZES_DATA !== 'undefined' && QUIZZES_DATA) targets.push(QUIZZES_DATA.M1 || QUIZZES_DATA); } catch (e) {}
    targets.forEach(t => TermCfg.applyDeep(raw, t, 'ม.1', now));
    this._termAppliedKey = key;
    return true;
  },

  saveSemesterMeta(meta) {
    return this.save(STORAGE_KEYS.SEMESTERS, meta);
  },

  startNewSemester(year, term, opts) {
    const meta = this.getSemesterMeta();
    const oldId = meta.activeId;
    const oldLabel = meta.activeLabel;

    // 1. Snapshot current semester into archive (including submissions & extended assessment keys)
    if (!meta.archives) meta.archives = {};
    meta.archives[oldId] = {
      id: oldId,
      year: meta.activeYear,
      term: meta.activeTerm,
      label: oldLabel,
      archivedAt: new Date().toISOString(),
      data: {
        progress: this.getAllProgress(),
        sessions: this.getAllSessions(),
        submissions: this.getAllSubmissions(),
        holidays: this.getHolidayLogs(),
        timetable: this.getTimetable(),
        studentStatus: this.getAllStudentStatuses(),
        extendedAssessments: this.collectExtendedAssessmentData()
      }
    };

    // 2. Set new active semester
    meta.activeId = `${year}_${term}`;
    meta.activeYear = String(year);
    meta.activeTerm = String(term);
    meta.activeLabel = `ภาคเรียนที่ ${term} ปีการศึกษา ${year}`;
    meta.isArchiveView = false;
    meta.viewingId = null;
    this.saveSemesterMeta(meta);

    // 3. Reset active progress, sessions, submissions, and holidays for the new semester
    this.remove(STORAGE_KEYS.PROGRESS);
    this.remove(STORAGE_KEYS.SESSIONS);
    this.remove(STORAGE_KEYS.SUBMISSIONS);
    this.remove(STORAGE_KEYS.HOLIDAYS);

    // เริ่มภาคเรียนด้วยมือที่ไม่ตรงกับที่คำนวณจากวันที่ -> ตั้ง override ให้การแสดงผล/รหัสวิชาตามภาคที่เลือก
    if (!(opts && opts.auto) && this.getSemesterInfo().id !== meta.activeId) {
      const cfg = this.getTermConfig();
      cfg.override = { enabled: true, year: Number(year), term: Number(term), until: null };
      this.saveTermConfig(cfg);
    }

    return meta;
  },

  getArchivedSemesters() {
    const meta = this.getSemesterMeta();
    return Object.values(meta.archives || {});
  },

  switchArchiveView(archiveId) {
    const meta = this.getSemesterMeta();
    if (archiveId && meta.archives && meta.archives[archiveId]) {
      meta.isArchiveView = true;
      meta.viewingId = archiveId;
    } else {
      meta.isArchiveView = false;
      meta.viewingId = null;
    }
    this.saveSemesterMeta(meta);
    return meta;
  },

  exportSemesterArchiveJSON(archiveId) {
    const meta = this.getSemesterMeta();
    if (archiveId && meta.archives && meta.archives[archiveId]) {
      return JSON.stringify(meta.archives[archiveId], null, 2);
    }
    return null;
  },

  // --- Dynamic Subject Management ---
  getAllSubjects() {
    const parsed = this.load(STORAGE_KEYS.SUBJECTS, null);
    const base = (Array.isArray(parsed) && parsed.length > 0) ? parsed : DEFAULT_SUBJECTS;
    const raw = this.getTermConfigRaw();
    const term = this.getSemesterInfo().term;
    // วิชาหลักของแต่ละชั้น (M1_1, M2) รหัสวิชาคำนวณจากภาคเรียน — ครูแก้รหัสเองได้ (autoCode=false) หรือกำหนด subjectCodeOverride
    return base.map(s => {
      const auto = s.autoCode !== false && (s.autoCode === true || s.id === 'M1_1' || s.id === 'M2');
      const code = auto ? TermCfg.subjectCode(raw, s.grade, term) : '';
      return code ? { ...s, code, autoCode: true } : { ...s };
    });
  },

  saveSubjects(subjects) {
    return this.save(STORAGE_KEYS.SUBJECTS, subjects);
  },

  addSubject(code, name, grade, periods = 20) {
    const subjects = this.getAllSubjects();
    const id = 'SUBJ_' + Date.now();
    const newSubj = {
      id,
      code: code.trim(),
      name: name.trim(),
      grade: grade.trim(),
      periods: parseInt(periods, 10) || 20,
      active: true
    };
    subjects.push(newSubj);
    this.saveSubjects(subjects);
    return newSubj;
  },

  updateSubject(id, data) {
    const subjects = this.getAllSubjects();
    const idx = subjects.findIndex(s => s.id === id);
    if (idx !== -1) {
      const next = { ...subjects[idx], ...data };
      if (data && data.code !== undefined && data.code !== subjects[idx].code) next.autoCode = false; // ครูตั้งรหัสเอง
      subjects[idx] = next;
      this.saveSubjects(subjects);
      return subjects[idx];
    }
    return null;
  },

  deleteSubject(id) {
    let subjects = this.getAllSubjects();
    subjects = subjects.filter(s => s.id !== id);
    this.saveSubjects(subjects);
    return true;
  },

  // --- Weekly Timetable System (ตารางสอนประจำสัปดาห์ 10 คาบ) ---
  getTimetable() {
    const parsed = this.load(STORAGE_KEYS.TIMETABLE, null);
    if (parsed && (parsed.version === '2569_2_official' || (parsed.schedule && parsed.schedule["จันทร์"] && parsed.schedule["จันทร์"][2] === "ม.1/7"))) {
      parsed.periods = DEFAULT_TIMETABLE_PERIODS;
      return parsed;
    }
    return this.setOfficialTimetable();
  },

  setOfficialTimetable() {
    let s = null;
    try {
      s = this.getAppSettings ? this.getAppSettings() : null;
    } catch (e) {}
    const tt = {
      version: '2569_2_official',
      teacherCode: OFFICIAL_TIMETABLE_META.teacherCode,
      teacherName: this._defaultTeacherName(),
      school: (s && s.schoolName) ? s.schoolName : 'โรงเรียนพะเยาพิทยาคม',
      term: this.getSemesterInfo().shortLabel,
      room: OFFICIAL_TIMETABLE_META.room,
      date: OFFICIAL_TIMETABLE_META.date,
      periods: DEFAULT_TIMETABLE_PERIODS,
      schedule: JSON.parse(JSON.stringify(OFFICIAL_TIMETABLE_2569_2))
    };
    this.saveTimetable(tt);
    return tt;
  },

  saveTimetable(timetableData) {
    return this.save(STORAGE_KEYS.TIMETABLE, timetableData);
  },

  getTodayDayName() {
    const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
    const dayIdx = new Date().getDay();
    return days[dayIdx] || "จันทร์";
  },

  // --- Timetable Assignments & Trainee Mentoring ---
  getScheduleAssignments() {
    let assignments = this.load(STORAGE_KEYS.SCHEDULE_ASSIGNMENTS, null);
    if (!assignments || typeof assignments !== 'object') {
      assignments = {};
      this.save(STORAGE_KEYS.SCHEDULE_ASSIGNMENTS, assignments);
    } else {
      let cleaned = false;
      for (const key of Object.keys(assignments)) {
        const item = assignments[key];
        if (item && item.mentorAdvice && (
          item.mentorAdvice.includes('ตรวจสอบ Dead Tines คีย์กลาง') ||
          item.mentorAdvice.includes('ร่วมสอน: ครูพี่เลี้ยงนำเข้าสู่บทเรียนโน้ตสากล 10 นาที')
        )) {
          delete assignments[key];
          cleaned = true;
        }
      }
      if (cleaned) {
        this.save(STORAGE_KEYS.SCHEDULE_ASSIGNMENTS, assignments);
      }
    }
    return assignments;
  },

  getScheduleAssignment(day, periodNo) {
    const assignments = this.getScheduleAssignments();
    const key = `${day}-${periodNo}`;
    return assignments[key] || null;
  },

  saveScheduleAssignment(day, periodNo, data) {
    const assignments = this.getScheduleAssignments();
    const key = `${day}-${periodNo}`;
    const existing = assignments[key] || {};
    assignments[key] = {
      ...existing,
      ...data,
      day: day,
      periodNo: parseInt(periodNo, 10),
      updatedAt: new Date().toISOString()
    };
    this.save(STORAGE_KEYS.SCHEDULE_ASSIGNMENTS, assignments);
    if (typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncAssignment === 'function') {
      try {
        GoogleSheetSync.syncAssignment(day, periodNo, assignments[key]);
      } catch (e) {}
    }
    return assignments[key];
  },

  deleteScheduleAssignment(day, periodNo) {
    const assignments = this.getScheduleAssignments();
    const key = `${day}-${periodNo}`;
    if (assignments[key]) {
      delete assignments[key];
      this.save(STORAGE_KEYS.SCHEDULE_ASSIGNMENTS, assignments);
      return true;
    }
    return false;
  },

  getTraineeTeachingSummary() {
    const assignments = this.getScheduleAssignments();
    const list = Object.values(assignments);
    const traineeSlots = list.filter(a => a.assignRole === 'trainee');
    const coTeachSlots = list.filter(a => a.assignRole === 'co-teach');
    return {
      totalAssigned: list.length,
      traineeCount: traineeSlots.length,
      coTeachCount: coTeachSlots.length,
      slots: list
    };
  },

  getTodayClasses() {
    const tt = this.getTimetable();
    const todayName = this.getTodayDayName();
    const daySchedule = tt.schedule[todayName] || tt.schedule[todayName.replace('บดี', 'ฯ')] || {};
    const assignments = this.getScheduleAssignments();
    const result = [];

    tt.periods.forEach(p => {
      const cls = daySchedule[p.no];
      if (cls) {
        const isLunch = cls === 'พักกลางวัน' || cls === 'พักเที่ยง';
        const isActivity = ['จริยะ', 'กก.ล.', 'กก.บ.', 'ประชุม PLC'].includes(cls);
        let subjCode = '';
        if (this.gradeNumberOf(cls)) subjCode = this.getCurrentSubject(cls).code;

        const assignKey = `${todayName}-${p.no}`;
        const assignment = assignments[assignKey] || null;

        result.push({
          periodNo: p.no,
          time: p.time,
          className: cls,
          subjCode,
          isLunch,
          isActivity,
          room: this.gradeNumberOf(cls) ? OFFICIAL_TIMETABLE_META.room : '',
          assignment: assignment
        });
      }
    });

    return { dayName: todayName, classes: result };
  },

  // --- Reset All Data (เริ่มใหม่ 0/20) ---
  resetAllData() {
    this.remove(STORAGE_KEYS.PROGRESS);
    this.remove(STORAGE_KEYS.SESSIONS);
    this.remove(STORAGE_KEYS.SUBMISSIONS);
    this.remove(STORAGE_KEYS.HOLIDAYS);
    return true;
  },

  // --- Full 100% Backup & Restore (Including Submissions, Rubrics, Quizzes, Feldman & Research) ---
  exportBackupJSON() {
    const payload = {
      version: '2.5',
      exportedAt: new Date().toISOString(),
      settings: this.getAppSettings(),
      instructor: this.getInstructor(),
      semesterMeta: this.getSemesterMeta(),
      subjects: this.getAllSubjects(),
      studentStatus: this.getAllStudentStatuses(),
      studentAccounts: this.getAllStudentAccounts(),
      progress: this.getAllProgress(),
      sessions: this.getAllSessions(),
      submissions: this.getAllSubmissions(),
      timetable: this.getTimetable(),
      scheduleAssignments: this.getScheduleAssignments(),
      holidays: this.getHolidayLogs(),
      extendedAssessments: this.collectExtendedAssessmentData(),
      roster: this.hasLocalRoster() ? this.getRoster() : undefined
    };
    return JSON.stringify(payload, null, 2);
  },

  importBackupJSON(jsonString) {
    try {
      const payload = JSON.parse(jsonString);
      if (payload.settings) this.save(STORAGE_KEYS.SETTINGS, payload.settings);
      if (payload.instructor) this.save(STORAGE_KEYS.INSTRUCTOR, payload.instructor);
      if (payload.progress) this.save(STORAGE_KEYS.PROGRESS, payload.progress);
      if (payload.sessions) this.save(STORAGE_KEYS.SESSIONS, payload.sessions);
      if (payload.submissions) this.save(STORAGE_KEYS.SUBMISSIONS, payload.submissions);
      if (payload.timetable) this.save(STORAGE_KEYS.TIMETABLE, payload.timetable);
      if (payload.scheduleAssignments) this.save(STORAGE_KEYS.SCHEDULE_ASSIGNMENTS, payload.scheduleAssignments);
      if (payload.holidays) this.save(STORAGE_KEYS.HOLIDAYS, payload.holidays);
      if (payload.studentStatus) this.save(STORAGE_KEYS.STUDENT_STATUS, payload.studentStatus);
      if (payload.studentAccounts) this.save(STORAGE_KEYS.STUDENT_ACCOUNTS, payload.studentAccounts);
      if (payload.semesterMeta) this.save(STORAGE_KEYS.SEMESTERS, payload.semesterMeta);
      if (payload.subjects) this.save(STORAGE_KEYS.SUBJECTS, payload.subjects);
      if (payload.roster) this.importRoster(payload.roster);
      if (payload.extendedAssessments) {
        this.restoreExtendedAssessmentData(payload.extendedAssessments);
      }
      return { success: true, count: Object.keys(payload.sessions || {}).length };
    } catch (e) {
      console.error('Import failed', e);
      return { success: false, error: e.message };
    }
  },

  // --- Export Excel / CSV for MIS ---
  generateCSVData(className) {
    const students = this.getStudents(className);
    const sessions = this.getAllSessions();
    const statuses = this.getAllStudentStatuses();
    
    const headers = ['เลขที่', 'รหัสนักเรียน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น', 'สถานะนักเรียน'];
    const periodTotal = this.getPeriodCount(this.gradeKeyOf(className));
    for (let p = 1; p <= periodTotal; p++) {
      headers.push(`คาบที่ ${p} (สถานะ)`);
      headers.push(`คาบที่ ${p} (คะแนน)`);
    }

    const rows = [headers];

    students.forEach(s => {
      const st = statuses[s.student_id]?.status || 'ปกติ';
      const row = [s.no, s.student_id, s.prefix, s.first_name, s.last_name, s.nickname, st];
      for (let p = 1; p <= periodTotal; p++) {
        const key = this.getSessionKey(className, p);
        const sess = sessions[key];
        if (sess) {
          const status = sess.attendance[s.student_id] || '-';
          const score = sess.scores[s.student_id] !== undefined ? sess.scores[s.student_id] : '-';
          row.push(status);
          row.push(score);
        } else {
          row.push('-');
          row.push('-');
        }
      }
      rows.push(row);
    });

    return rows;
  },

  // --- Active Role Management ---
  getActiveRole() {
    const user = this.getCurrentUser ? this.getCurrentUser() : null;
    if (user && user.role) return user.role;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);
      if (saved === 'teacher') {
        if (user && user.role === 'teacher') return 'teacher';
        return 'student';
      }
      return saved || 'student';
    } catch (e) {
      return 'student';
    }
  },

  setActiveRole(role) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, role);
    } catch (e) {}
    return role;
  },

  // --- Teacher To-Do List Engine (Bug-Fixed & Unified) ---
  getTeacherTodoList() {
    const todos = [];
    const todayClasses = this.getTodayClasses();
    const sessions = this.getAllSessions();
    const progresses = this.getAllProgress();

    // 1. Classes to teach today
    if (todayClasses && todayClasses.classes) {
      todayClasses.classes.forEach(c => {
        if (!c.isLunch && !c.isActivity) {
          const progObj = progresses[c.className];
          const lastP = (progObj && typeof progObj === 'object')
            ? Number(progObj.lastPeriod || 0)
            : (Number(progObj) || 0);
          const targetP = Math.min(20, Math.max(1, lastP + 1));
          const sessKey = this.getSessionKey(c.className, targetP);
          const isDone = !!sessions[sessKey];
          const isTrainee = c.assignment && c.assignment.assignRole === 'trainee';
          const isCoTeach = c.assignment && c.assignment.assignRole === 'co-teach';
          let titleText = `สอนวันนี้ คาบ ${c.periodNo} (${c.time})`;
          let badgeText = isDone ? 'บันทึกแล้ว' : 'รอสอน';
          let badgeClass = isDone ? 'badge-success' : 'badge-primary';

          if (isTrainee) {
            titleText = `🎓 นิเทศ นศ.ฝึกสอน คาบ ${c.periodNo} (${c.time})`;
            badgeText = isDone ? 'นิเทศแล้ว' : 'รอนิเทศ';
            badgeClass = isDone ? 'badge-success' : 'badge-warning';
          } else if (isCoTeach) {
            titleText = `👥 ร่วมสอน (Co-teach) คาบ ${c.periodNo} (${c.time})`;
            badgeText = isDone ? 'บันทึกแล้ว' : 'รอร่วมสอน';
            badgeClass = isDone ? 'badge-success' : 'badge-info';
          }

          todos.push({
            id: `today-${c.className}-${c.periodNo}`,
            type: 'today_class',
            title: titleText,
            subtitle: `ห้อง ${c.className} • ${c.subjCode} (เนื้อหาคาบที่ ${targetP})${c.assignment ? ' • ' + (c.assignment.teacherName || '') : ''}`,
            className: c.className,
            period: targetP,
            isDone: isDone,
            badge: badgeText,
            badgeClass: badgeClass,
            actionText: isDone ? 'ดูบันทึก' : (isTrainee ? 'เข้านิเทศ' : 'เข้าสอน')
          });
        }
      });
    }

    // 2. Track absent students needing make-up tests / assignments across all recorded sessions
    Object.keys(sessions).forEach(key => {
      const sess = sessions[key];
      if (!sess || !sess.attendance) return;
      const [cls, pStr] = key.split('_');
      const periodNum = parseInt(String(pStr || '').replace(/\D+/g, ''), 10) || Number(sess.period) || 1;
      const students = this.getStudents(cls);
      const studentMap = {};
      students.forEach(s => { studentMap[s.student_id] = s; });

      Object.keys(sess.attendance).forEach(sId => {
        if (this.isStudentWithdrawn(sId)) return;
        const att = sess.attendance[sId];
        const sc = sess.scores ? sess.scores[sId] : null;
        // If absent or leave and no score yet, flag for remedial
        if ((att === 'absent' || att === 'leave') && (sc === undefined || sc === null || sc === 0)) {
          const sObj = studentMap[sId] || { first_name: sId, last_name: '', no: '-' };
          todos.push({
            id: `absent-${cls}-${periodNum}-${sId}`,
            type: 'makeup_score',
            title: `นักเรียนขาดเรียน/ต้องตามงาน คาบที่ ${periodNum}`,
            subtitle: `ห้อง ${cls} • เลขที่ ${sObj.no} ${sObj.prefix || ''}${sObj.first_name} ${sObj.last_name} (${att === 'absent' ? 'ขาด' : 'ลา'})`,
            className: cls,
            period: periodNum,
            studentId: sId,
            studentName: `${sObj.first_name} ${sObj.last_name}`,
            isDone: false,
            badge: 'ตามงานซ่อม',
            badgeClass: 'badge-warning',
            actionText: 'บันทึกคะแนนซ่อม'
          });
        }
      });
    });

    // 3. Post-teaching reflection reminder if session recorded without outcomes
    Object.keys(sessions).forEach(key => {
      const sess = sessions[key];
      const outcomeText = sess?.reflection?.outcomes || sess?.reflection?.learningOutcome || '';
      if (sess && outcomeText.trim() === '') {
        const [cls, pStr] = key.split('_');
        const periodNum = parseInt(String(pStr || '').replace(/\D+/g, ''), 10) || Number(sess.period) || 1;
        todos.push({
          id: `reflection-${cls}-${periodNum}`,
          type: 'reflection_missing',
          title: `ยังไม่ได้บันทึกผลหลังสอน คาบที่ ${periodNum}`,
          subtitle: `ห้อง ${cls} • บันทึกเวลาเรียนแล้วแต่ยังไม่มีผลประเมิน วก.5`,
          className: cls,
          period: periodNum,
          isDone: false,
          badge: 'รอเขียน วก.5',
          badgeClass: 'badge-warning',
          actionText: 'เขียนบันทึกหลังสอน'
        });
      }
    });

    return todos;
  },

  // --- Student Submissions API (Unified & Cached) ---
  getAllSubmissions() {
    return this.load(STORAGE_KEYS.SUBMISSIONS, {}) || {};
  },

  getStudentSubmissions(studentId) {
    const all = this.getAllSubmissions();
    const sId = String(studentId || '').trim();
    const result = [];
    Object.keys(all).forEach(k => {
      if (k.endsWith(`_${sId}`)) {
        result.push(all[k]);
      }
    });
    return result;
  },

  saveStudentSubmission(className, period, studentId, data) {
    const all = this.getAllSubmissions();
    const key = `${className}_p${period}_${studentId}`;
    const existing = all[key] || {};
    all[key] = {
      ...existing,
      key,
      className,
      period,
      studentId,
      submissionType: data.submissionType || existing.submissionType || 'text',
      content: data.content !== undefined ? data.content : (data.answerText || existing.content || ''),
      url: data.url !== undefined ? data.url : (data.attachmentUrl || existing.url || ''),
      fileName: data.fileName || existing.fileName || '',
      fileBase64: data.fileBase64 || existing.fileBase64 || '',
      mimeType: data.mimeType || existing.mimeType || '',
      fileSize: data.fileSize || existing.fileSize || 0,
      pendingUploadId: data.pendingUploadId || '',
      deviceNo: data.deviceNo !== undefined ? String(data.deviceNo) : ((typeof KalimbaDevices !== 'undefined' && KalimbaDevices.getDevice(className, period, studentId)) || existing.deviceNo || ''),
      submittedAt: new Date().toLocaleString('th-TH'),
      status: data.status || 'submitted',
      score: data.score !== undefined ? data.score : (existing.score || null),
      feedback: data.feedback !== undefined ? data.feedback : (existing.feedback || '')
    };
    if (this.save(STORAGE_KEYS.SUBMISSIONS, all)) {
      if (typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncSubmission === 'function') {
        try {
          GoogleSheetSync.syncSubmission(className, period, studentId, all[key]);
        } catch (e) {}
      }
      return all[key];
    }
    return null;
  },

  // --- Quick Post-Teaching Notes (วก.5 - Unified Schema) ---
  savePostTeachingReflection(className, period, data) {
    const sessions = this.getAllSessions();
    const key = this.getSessionKey(className, period);
    const sess = sessions[key] || {
      className,
      period,
      timestamp: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString('th-TH'),
      instructor: this.getInstructor(),
      attendance: {},
      scores: {},
      handoverNote: '',
      reflection: {}
    };

    const outcomes = data.outcomes || data.learningOutcome || '';
    const problems = data.problems || '';
    const solutions = data.solutions || data.suggestions || '';

    sess.reflection = {
      outcomes,
      learningOutcome: outcomes,
      problems,
      solutions,
      suggestions: solutions,
      recordedAt: new Date().toISOString(),
      recordedBy: this.getInstructor().name
    };
    if (data.handoverNote !== undefined) {
      sess.handoverNote = data.handoverNote;
    }

    sessions[key] = sess;
    const saved = this.save(STORAGE_KEYS.SESSIONS, sessions);

    const allProgress = this.getAllProgress();
    if (allProgress[className]) {
      allProgress[className].lastHandover = sess.handoverNote || solutions || allProgress[className].lastHandover;
      allProgress[className].lastDate = sess.dateStr;
      this.save(STORAGE_KEYS.PROGRESS, allProgress);
    }

    if (saved && typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncSessionLog === 'function') {
      try {
        GoogleSheetSync.syncSessionLog(className, period, sess);
      } catch (e) {}
    }

    return saved;
  },

  // --- Rubric Breakdown & Quiz Grade Storage (Cached) ---
  getStudentRubric(studentId, period) {
    return this.load(`music_rubric_${studentId}_p${period}`, null);
  },

  saveStudentRubric(studentId, period, rubricData, className) {
    const res = this.save(`music_rubric_${studentId}_p${period}`, rubricData);
    if (res && typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncRubric === 'function') {
      try {
        GoogleSheetSync.syncRubric(studentId, period, rubricData, className);
      } catch (e) {}
    }
    return res;
  },

  // ===== คะแนนรายคาบ K/P/A ตาม วก.5: คะแนนด้าน = น้ำหนัก × ระดับ(1-4) ÷ 4 =====
  _round2(x) { return Math.round((Number(x) || 0) * 100) / 100; },

  _lessonOf(grade, period) {
    if (typeof LESSONS_DATA === 'undefined' || !LESSONS_DATA[grade]) return null;
    return LESSONS_DATA[grade].find(l => Number(l.period) === Number(period)) || null;
  },

  isExamPeriod(grade, period) {
    const l = this._lessonOf(grade, period);
    return !!l && ['quiz', 'exam'].includes(l.assessment && l.assessment.type);
  },

  // คาบสอบของชั้น เรียงตามคาบ (ม.1: [11, 20]) -> คนแรก = กลางภาค, คนสุดท้าย = ปลายภาค
  getExamPeriods(grade) {
    const list = (typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA[grade]) ? LESSONS_DATA[grade] : [];
    return list.filter(l => ['quiz', 'exam'].includes(l.assessment && l.assessment.type)).map(l => Number(l.period)).sort((a, b) => a - b);
  },

  getPeriodWeights(grade, period) {
    const l = this._lessonOf(grade, period);
    if (!l) return null;
    const a = l.assessment || {};
    const max = a.has_score ? (Number(a.max_score) || 0) : 0;
    const exam = this.isExamPeriod(grade, period);
    let w = a.weights;
    if (!w && typeof WK5_PLANS !== 'undefined' && WK5_PLANS[grade] && WK5_PLANS[grade][String(period)]) w = WK5_PLANS[grade][String(period)].weights;
    if (w) {
      const k = Number(w.k) || 0, p = Number(w.p) || 0, aa = Number(w.a) || 0;
      return { k, p, a: aa, total: this._round2(k + p + aa), exam };
    }
    return { k: 0, p: max, a: 0, total: max, exam, legacy: true }; // ชั้นที่ยังไม่มี K/P/A (ม.2): นับเป็นด้านทักษะ
  },

  // ระดับ(ทุกด้านเท่ากัน) -> คะแนนรวมของคาบ; คาบสอบ/ไม่มีคะแนน = null
  levelPoints(grade, period, level) {
    const w = this.getPeriodWeights(grade, period);
    const lv = Number(level);
    if (!w || w.exam || !w.total || !(lv >= 1 && lv <= 4)) return null;
    return this._round2(w.total * lv / 4);
  },

  pointsToLevel(grade, period, points) {
    for (let lv = 1; lv <= 4; lv++) {
      const p = this.levelPoints(grade, period, lv);
      if (p !== null && Math.abs(p - Number(points)) < 0.005) return lv;
    }
    return null;
  },

  // levels = {K,P,A} (1-4 หรือ null) -> {dims:{K,P,A}, total, max, complete}
  computeDimPoints(grade, period, levels) {
    const w = this.getPeriodWeights(grade, period) || { k: 0, p: 0, a: 0, total: 0 };
    const lv = levels || {};
    const out = { dims: { K: 0, P: 0, A: 0 }, levels: { K: null, P: null, A: null }, total: 0, max: w.total, complete: true };
    [['K', w.k], ['P', w.p], ['A', w.a]].forEach(([d, wt]) => {
      const n = Number(lv[d]);
      if (wt > 0) {
        if (n >= 1 && n <= 4) { out.dims[d] = this._round2(wt * n / 4); out.levels[d] = n; } else out.complete = false;
      } else if (n >= 1 && n <= 4) out.levels[d] = n;
    });
    out.total = this._round2(out.dims.K + out.dims.P + out.dims.A);
    return out;
  },

  buildRubricRecord(grade, period, levels) {
    const c = this.computeDimPoints(grade, period, levels);
    return { levels: c.levels, dims: c.dims, sum: c.total, maxRaw: c.max, percentage: c.max ? Math.round(c.total / c.max * 100) : 0,
      scaledScore: c.total, source: 'level', updatedAt: new Date().toLocaleString('th-TH') };
  },

  // ให้ระดับเดียวกันทุกด้าน -> บันทึก rubric + คืนคะแนนรวม (ไม่แตะ session; ผู้เรียกบันทึกเอง)
  recordUniformLevel(studentId, className, period, level) {
    const grade = this.gradeKeyOf(className);
    const pts = this.levelPoints(grade, period, level);
    if (pts === null) return null;
    this.saveStudentRubric(studentId, period, this.buildRubricRecord(grade, period, { K: level, P: level, A: level }), className);
    return pts;
  },

  // ระดับผลสอบ: ตอบถูก 16-20 (>=80%) = 4, 14-15 (70-79%) = 3, 10-13 (50-69%) = 2, <10 = 1  (ผ่านรายบุคคล >= 50%)
  examLevel(correct, items = 20) {
    const pct = items ? (Number(correct) / items) * 100 : 0;
    if (pct >= 80) return 4;
    if (pct >= 70) return 3;
    if (pct >= 50) return 2;
    return 1;
  },

  // คะแนนเต็มรวมของชั้น แยก K/P/A (ระหว่างภาค) + สอบกลางภาค/ปลายภาค อ่านจากน้ำหนักในบทเรียนจริง
  getKPATotals(grade) {
    const list = (typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA[grade]) ? LESSONS_DATA[grade] : [];
    const t = { K: 0, P: 0, A: 0, formative: 0, midterm: 0, final: 0, total: 0 };
    const exams = this.getExamPeriods(grade);
    list.forEach(l => {
      const w = this.getPeriodWeights(grade, l.period);
      if (!w) return;
      if (w.exam) {
        if (Number(l.period) === exams[0]) t.midterm += w.total; else t.final += w.total;
      } else { t.K += w.k; t.P += w.p; t.A += w.a; }
    });
    t.formative = this._round2(t.K + t.P + t.A);
    t.total = this._round2(t.formative + t.midterm + t.final);
    return t;
  },

  // สรุปคะแนนจริงของนักเรียน 1 คน จากคะแนนรายคาบที่บันทึก (ไม่มีค่าสมมติ)
  getStudentKPA(studentId, className) {
    const grade = this.gradeKeyOf(className);
    const n = this.getPeriodCount(grade);
    const exams = this.getExamPeriods(grade);
    const midP = exams[0], finP = exams[exams.length - 1];
    const r = { K: 0, P: 0, A: 0, formative: 0, midterm: null, final: null, total: 0, kWithExams: 0, scoredPeriods: [] };
    for (let p = 1; p <= n; p++) {
      const sess = this.getSession(className, p);
      const raw = sess && sess.scores ? sess.scores[studentId] : undefined;
      if (raw === undefined || raw === null || raw === '') continue;
      const w = this.getPeriodWeights(grade, p);
      if (!w || !w.total) continue;
      const sc = Math.min(w.total, Math.max(0, Number(raw)));
      if (!Number.isFinite(sc)) continue;
      r.scoredPeriods.push(p);
      if (w.exam) { if (p === midP) r.midterm = sc; else if (p === finP) r.final = sc; continue; }
      const rub = this.getStudentRubric(studentId, p);
      let d;
      if (rub && rub.dims && Math.abs((Number(rub.dims.K) + Number(rub.dims.P) + Number(rub.dims.A)) - sc) < 0.011) d = rub.dims;
      else d = { K: sc * w.k / w.total, P: sc * w.p / w.total, A: sc * w.a / w.total };
      r.K += Number(d.K) || 0; r.P += Number(d.P) || 0; r.A += Number(d.A) || 0; r.formative += sc;
    }
    ['K', 'P', 'A', 'formative'].forEach(k => { r[k] = this._round2(r[k]); });
    r.total = this._round2(r.formative + (r.midterm || 0) + (r.final || 0));
    r.kWithExams = this._round2(r.K + (r.midterm || 0) + (r.final || 0));
    return r;
  },

  // นำผลสอบกลางภาค/ปลายภาค (ที่เซิร์ฟเวอร์ตรวจแล้ว) เข้าสมุดคะแนน: กลางภาค = คาบ exams[0] (11), ปลายภาค = คาบสุดท้าย (20)
  // ไม่เรียก saveSession เพื่อไม่ให้ไปเลื่อนคาบถัดไปของห้อง; ผลสอบ = K 10 คะแนน (ระดับ 4/3/2/1 ตามจำนวนข้อที่ถูก)
  applyExamResults(className, kind, attempts) {
    const grade = this.gradeKeyOf(className);
    const exams = this.getExamPeriods(grade);
    if (!exams || !exams.length) return { applied: 0, period: null };
    const period = kind === 'final' ? exams[exams.length - 1] : exams[0];
    const w = this.getPeriodWeights(grade, period);
    const maxPts = w && w.total ? w.total : 10;
    const all = this.getAllSessions();
    const key = this.getSessionKey(className, period);
    const now = new Date();
    const base = all[key] || { className, period, timestamp: now.toISOString(), dateStr: now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) };
    const scores = Object.assign({}, base.scores || {});
    const examLog = Object.assign({}, base.exam || {});
    let applied = 0;
    (attempts || []).forEach(a => {
      if (!a || !a.studentId || a.points === null || a.points === undefined) return;
      const pts = Math.min(maxPts, Math.max(0, Number(a.points)));
      if (!Number.isFinite(pts)) return;
      scores[a.studentId] = pts;
      examLog[a.studentId] = { points: pts, correct: a.correct, items: a.items, level: a.level, attemptNo: a.attemptNo, source: 'server-exam' };
      applied++;
    });
    if (!applied) return { applied: 0, period };
    all[key] = Object.assign({}, base, { scores, exam: examLog });
    if (!this.save(STORAGE_KEYS.SESSIONS, all)) return { applied: 0, period, error: 'save_failed' };
    return { applied, period };
  },

  saveStudentQuizGrade(studentId, unitNo, score) {
    try {
      const key = `music_quiz_grade_${studentId}_u${unitNo}`;
      localStorage.setItem(key, String(score));
      this._cache.set(key, Number(score));
      return true;
    } catch (e) {
      return false;
    }
  },

  // --- Authentication & Account Management (Salted Hash + Rate Limiting) ---
  getCurrentUser() {
    return this.load(STORAGE_KEYS.AUTH_CURRENT_USER, null);
  },

  setCurrentUser(userData) {
    if (userData) {
      this.save(STORAGE_KEYS.AUTH_CURRENT_USER, userData);
      if (userData.role) {
        this.setActiveRole(userData.role);
      }
      return true;
    } else {
      return this.remove(STORAGE_KEYS.AUTH_CURRENT_USER);
    }
  },

  logout() {
    this.remove(STORAGE_KEYS.ACTIVE_ROLE);
    return this.remove(STORAGE_KEYS.AUTH_CURRENT_USER);
  },

  getTeacherAccount() {
    const parsed = this.load(STORAGE_KEYS.TEACHER_ACCOUNT, null);
    const appSettings = this.getAppSettings ? this.getAppSettings() : null;
    const defaultName = (appSettings && appSettings.teacherName) || DEFAULT_TEACHER_ACCOUNT.name;
    if (parsed) {
      if (parsed.email === 'music@ppk.ac.th') {
        parsed.email = DEFAULT_TEACHER_ACCOUNT.email;
      }
      return { ...DEFAULT_TEACHER_ACCOUNT, name: defaultName, ...parsed };
    }
    return { ...DEFAULT_TEACHER_ACCOUNT, name: defaultName };
  },

  async saveTeacherAccount(accountData) {
    const current = this.getTeacherAccount();
    const data = { ...accountData };
    const rawSecret = data.secret !== undefined ? String(data.secret).trim() : '';
    delete data.secret; // ไม่เก็บรหัสผ่านตัวอักษรธรรมดาเด็ดขาด
    let secretHash = current.secretHash || DEFAULT_TEACHER_ACCOUNT.secretHash;
    if (rawSecret) {
      secretHash = await this.hashSecretStrong(rawSecret);
    }
    const updated = {
      ...current,
      ...data,
      secretHash,
      updatedAt: new Date().toISOString()
    };
    delete updated.secret;
    if (this.save(STORAGE_KEYS.TEACHER_ACCOUNT, updated)) {
      try {
        const teachers = this.getTeachersList();
        const adminIdx = teachers.findIndex(t => t.isAdmin || t.id === 'admin_primary');
        if (adminIdx !== -1) {
          teachers[adminIdx].email = updated.email;
          teachers[adminIdx].name = updated.name;
          if (rawSecret) {
            delete teachers[adminIdx].secret;
            teachers[adminIdx].secretHash = secretHash;
          }
          this.saveTeachersList(teachers);
        }
      } catch (e) {}
      return updated;
    }
    return null;
  },

  async changeAdminPassword(newSecret) {
    if (!newSecret || !String(newSecret).trim()) {
      return { success: false, message: 'กรุณาระบุรหัสผ่านใหม่' };
    }
    const cleanSecret = String(newSecret).trim();
    const adminAcc = this.getTeacherAccount();
    const updated = await this.saveTeacherAccount({
      ...adminAcc,
      secret: cleanSecret
    });
    if (updated) {
      return { success: true, message: 'เปลี่ยนรหัสผ่านแอดมินเรียบร้อยแล้ว' };
    }
    return { success: false, message: 'ไม่สามารถบันทึกรหัสผ่านใหม่ได้' };
  },

  // --- Teaching Team & Co-Teachers (ครูร่วมสอน & ครูฝึกสอน) ---
  getTeachersList() {
    let list = this.load(STORAGE_KEYS.TEACHERS_LIST, null);
    const adminAcc = this.getTeacherAccount();
    const currentInst = this.getInstructor();

    if (!list || !Array.isArray(list) || list.length === 0) {
      list = [
        {
          id: 'admin_primary',
          name: adminAcc.name || currentInst.name || 'นายพงศธร โพธิแก้ว',
          email: adminAcc.email || 'krumum.piano@gmail.com',
          role: 'ครูประจำวิชา (แอดมิน)',
          roleCategory: 'mentor',
          isAdmin: true,
          secretHash: adminAcc.secretHash || DEFAULT_TEACHER_ACCOUNT.secretHash,
          institution: 'โรงเรียนพะเยาพิทยาคม',
          activeTeaching: true,
          note: 'ครูผู้สอนหลัก / ผู้ดูแลระบบ'
        },
        {
          id: 'teacher_kouocking',
          name: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู (เอกดนตรี มพ.)',
          email: 'kouocking@gmail.com',
          role: 'ครูนักศึกษาฝึกประสบการณ์วิชาชีพ',
          roleCategory: 'trainee',
          isAdmin: false,
          secretHash: '',
          needsFirstTimeSetup: true,
          status: 'pending',
          classes: [],
          institution: 'เอกดนตรี มหาวิทยาลัยพะเยา',
          activeTeaching: false,
          note: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู เอกดนตรี มหาวิทยาลัยพะเยา'
        }
      ];
      this.saveTeachersList(list);
    } else {
      // นำ trainee@ppk.ac.th ออกจากพื้นที่จัดเก็บเดิมหากเคยบันทึกไว้
      const filtered = list.filter(t => !(t.email && t.email.toLowerCase() === 'trainee@ppk.ac.th') && t.id !== 'trainee_default');
      if (filtered.length !== list.length) {
        list = filtered;
        this.saveTeachersList(list);
      }

      const adminItem = list.find(t => t.isAdmin || t.id === 'admin_primary');
      if (adminItem) {
        let changed = false;
        if (adminAcc.email && adminItem.email !== adminAcc.email) {
          adminItem.email = adminAcc.email;
          changed = true;
        }
        if (adminAcc.name && adminItem.name !== adminAcc.name) {
          adminItem.name = adminAcc.name;
          changed = true;
        }
        if (adminAcc.secretHash && adminItem.secretHash !== adminAcc.secretHash) {
          adminItem.secretHash = adminAcc.secretHash;
          changed = true;
        }
        if (adminItem.secret) {
          delete adminItem.secret; // ล้างรหัสผ่านตัวอักษรธรรมดาที่เคยค้างในเครื่อง
          changed = true;
        }
        if (changed) this.saveTeachersList(list);
      }

      // Ensure kouocking@gmail.com exists in existing storage and remains pending until explicitly approved
      const kouockingItem = list.find(t => (t.email && t.email.toLowerCase() === 'kouocking@gmail.com') || t.id === 'teacher_kouocking');
      if (!kouockingItem) {
        list.push({
          id: 'teacher_kouocking',
          name: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู (เอกดนตรี มพ.)',
          email: 'kouocking@gmail.com',
          role: 'ครูนักศึกษาฝึกประสบการณ์วิชาชีพ',
          roleCategory: 'trainee',
          isAdmin: false,
          secretHash: '',
          needsFirstTimeSetup: true,
          status: 'pending',
          classes: [],
          institution: 'เอกดนตรี มหาวิทยาลัยพะเยา',
          activeTeaching: false,
          note: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู เอกดนตรี มหาวิทยาลัยพะเยา'
        });
        this.saveTeachersList(list);
      } else if (kouockingItem.needsFirstTimeSetup && !kouockingItem.status) {
        kouockingItem.status = 'pending';
        if (!Array.isArray(kouockingItem.classes)) kouockingItem.classes = [];
        this.saveTeachersList(list);
      }
    }
    return list;
  },

  isTeacherApproved(teacher) {
    if (!teacher) return false;
    if (teacher.isAdmin || teacher.id === 'admin_primary') return true;
    if (teacher.status === 'pending' || teacher.status === 'rejected') return false;
    const isKouocking = teacher.id === 'teacher_kouocking' || (teacher.email && teacher.email.toLowerCase() === 'kouocking@gmail.com');
    if (isKouocking && teacher.status !== 'approved') return false;
    return true;
  },

  approveTeacher(idOrEmail, classes = null) {
    const t = this.getTeacherByEmail(idOrEmail);
    if (!t) return { success: false, message: 'ไม่พบบัญชีผู้สอน' };
    const assigned = Array.isArray(classes) ? classes : (Array.isArray(t.classes) && t.classes.length ? t.classes : (Array.isArray(t.preferredClasses) ? t.preferredClasses : []));
    return this.updateTeacher(t.id, { status: 'approved', classes: assigned });
  },

  saveTeachersList(list) {
    return this.save(STORAGE_KEYS.TEACHERS_LIST, list);
  },

  addTeacher(data) {
    const list = this.getTeachersList();
    const cleanName = (data.name || '').trim();
    if (!cleanName) return { success: false, message: 'กรุณาระบุชื่อ-นามสกุลครูผู้สอน' };

    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanInternId = String(data.internId || data.id || '').trim().toLowerCase();

    const existingIdx = list.findIndex(t =>
      (cleanEmail && t.email && t.email.toLowerCase() === cleanEmail) ||
      (cleanInternId && ((t.id && t.id.toLowerCase() === cleanInternId) || (t.internId && t.internId.toLowerCase() === cleanInternId)))
    );

    const cleanSecret = (data.secret || '').trim(); // ไม่มีรหัสผ่านเริ่มต้นตายตัว

    if (existingIdx !== -1) {
      const current = list[existingIdx];
      const updated = {
        ...current,
        name: cleanName || current.name,
        email: cleanEmail || current.email,
        internId: data.internId || current.internId || '',
        classes: data.classes !== undefined ? data.classes : (current.classes || []),
        preferredClasses: data.preferredClasses !== undefined ? data.preferredClasses : (current.preferredClasses || []),
        status: data.status || current.status || 'approved',
        role: data.role || current.role || 'ครูนักศึกษาฝึกสอน',
        roleCategory: data.roleCategory || current.roleCategory || 'trainee',
        secretHash: cleanSecret ? this.hashSecret(cleanSecret, 'teacher') : (current.secretHash || ''),
        institution: (data.institution || current.institution || 'โรงเรียนพะเยาพิทยาคม').trim(),
        activeTeaching: data.activeTeaching !== undefined ? !!data.activeTeaching : current.activeTeaching,
        note: (data.note || current.note || '').trim(),
        updatedAt: new Date().toISOString()
      };
      list[existingIdx] = updated;
      this.saveTeachersList(list);
      return { success: true, teacher: updated };
    }

    if (!cleanSecret) return { success: false, message: 'กรุณากำหนดรหัสผ่านหรือ PIN เริ่มต้น' };
    const newTeacher = {
      id: data.id || ('teacher_' + Date.now()),
      internId: data.internId || '',
      classes: data.classes || [],
      preferredClasses: data.preferredClasses || [],
      status: data.status || 'approved',
      name: cleanName,
      email: cleanEmail || ('teacher_' + Date.now().toString().slice(-4) + '@ppk.ac.th'),
      role: data.role || 'ครูนักศึกษาฝึกสอน',
      roleCategory: data.roleCategory || (data.role && data.role.includes('ฝึกสอน') ? 'trainee' : 'co_teacher'),
      isAdmin: false,
      secretHash: this.hashSecret(cleanSecret, 'teacher'),
      institution: (data.institution || 'โรงเรียนพะเยาพิทยาคม').trim(),
      activeTeaching: !!data.activeTeaching && data.status !== 'pending',
      note: (data.note || '').trim(),
      createdAt: new Date().toISOString()
    };

    if (newTeacher.activeTeaching) {
      list.forEach(t => t.activeTeaching = false);
      this.setInstructor(newTeacher.role, newTeacher.name);
    }

    list.push(newTeacher);
    this.saveTeachersList(list);
    return { success: true, teacher: newTeacher };
  },

  updateTeacher(id, updateData) {
    const list = this.getTeachersList();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return { success: false, message: 'ไม่พบข้อมูลครูผู้สอน' };

    const current = list[idx];
    const isAdminTarget = !!(current.isAdmin || current.id === 'admin_primary');
    const data = { ...updateData };
    const rawSecret = data.secret !== undefined ? String(data.secret).trim() : '';
    delete data.secret; // ไม่เก็บรหัสผ่านตัวอักษรธรรมดา
    if (rawSecret && isAdminTarget) {
      return { success: false, message: 'การเปลี่ยนรหัสผ่านแอดมินให้ใช้ Store.changeAdminPassword (เก็บแบบ PBKDF2)' };
    }
    let secretHash = current.secretHash;
    if (rawSecret) {
      secretHash = this.hashSecret(rawSecret, 'teacher'); // รหัสผู้ช่วย/นศ. อัปเกรดเป็น PBKDF2 เมื่อเข้าสู่ระบบ
    }

    const updated = {
      ...current,
      ...data,
      secretHash: secretHash,
      updatedAt: new Date().toISOString()
    };
    delete updated.secret;

    list[idx] = updated;

    if (updated.activeTeaching) {
      list.forEach((t, i) => { if (i !== idx) t.activeTeaching = false; });
      this.setInstructor(updated.role, updated.name);
    }

    if (isAdminTarget) {
      const adminAcc = this.getTeacherAccount();
      const nextAcc = {
        ...adminAcc,
        name: updated.name,
        email: updated.email,
        secretHash: updated.secretHash,
        updatedAt: new Date().toISOString()
      };
      delete nextAcc.secret;
      this.save(STORAGE_KEYS.TEACHER_ACCOUNT, nextAcc);
    }

    this.saveTeachersList(list);
    return { success: true, teacher: updated };
  },

  deleteTeacher(id) {
    const list = this.getTeachersList();
    const target = list.find(t => t.id === id);
    if (!target) return { success: false, message: 'ไม่พบข้อมูลครูผู้สอน' };
    if (target.isAdmin || target.id === 'admin_primary') {
      return { success: false, message: 'ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (Admin) ได้' };
    }

    const filtered = list.filter(t => t.id !== id);
    if (target.activeTeaching) {
      const admin = filtered.find(t => t.isAdmin) || filtered[0];
      if (admin) {
        admin.activeTeaching = true;
        this.setInstructor(admin.role, admin.name);
      }
    }

    this.saveTeachersList(filtered);
    return { success: true };
  },

  setActiveTeacher(id) {
    const list = this.getTeachersList();
    const target = list.find(t => t.id === id);
    if (!target) return { success: false, message: 'ไม่พบครูผู้สอนที่เลือก' };

    list.forEach(t => t.activeTeaching = (t.id === id));
    this.saveTeachersList(list);
    this.setInstructor(target.role, target.name);
    return { success: true, teacher: target };
  },

  getTeacherByEmail(email) {
    if (!email) return null;
    const key = String(email).trim().toLowerCase();
    const teachers = this.getTeachersList();
    return teachers.find(t =>
      (t.email && t.email.toLowerCase() === key) ||
      (t.id && t.id.toLowerCase() === key) ||
      (t.internId && String(t.internId).toLowerCase() === key) ||
      (t.name && t.name.toLowerCase() === key)
    ) || null;
  },

  async completeTeacherFirstTimeSetup(teacherId, data) {
    const list = this.getTeachersList();
    const idx = list.findIndex(t => t.id === teacherId);
    if (idx === -1) return { success: false, message: 'ไม่พบบัญชีผู้สอน' };

    const teacher = list[idx];
    if (!this.isTeacherApproved(teacher)) {
      return {
        success: false,
        code: 'pending',
        message: 'รอครูอนุมัติ: บัญชีนักศึกษาฝึกสอนนี้ต้องได้รับอนุมัติและเปิดสิทธิ์จากครูประจำวิชาก่อนจึงจะตั้งรหัสผ่านได้'
      };
    }
    const newName = (data.name || '').trim() || teacher.name;
    const newSecret = (data.secret || '').trim();
    if (!newSecret) return { success: false, message: 'กรุณาระบุรหัสผ่านใหม่' };

    teacher.name = newName;
    delete teacher.secret;
    teacher.secretHash = await this.hashSecretStrong(newSecret);
    teacher.needsFirstTimeSetup = false;
    teacher.institution = (data.institution || teacher.institution || 'เอกดนตรี มหาวิทยาลัยพะเยา').trim();
    teacher.updatedAt = new Date().toISOString();

    list[idx] = teacher;
    this.saveTeachersList(list);
    this.setActiveTeacher(teacher.id);

    const isIntern = teacher.roleCategory === 'trainee' ||
                     (teacher.role && teacher.role.includes('ฝึกสอน')) ||
                     (teacher.role && teacher.role.includes('นศ')) ||
                     !teacher.isAdmin;

    const user = {
      role: isIntern ? 'intern' : 'teacher',
      email: teacher.email,
      name: teacher.name,
      teacherId: teacher.id,
      internId: teacher.internId || teacher.id,
      teacherRole: teacher.role,
      roleCategory: teacher.roleCategory || (isIntern ? 'trainee' : 'mentor'),
      isAdmin: !!teacher.isAdmin,
      classes: isIntern ? (Array.isArray(teacher.classes) ? teacher.classes : []) : [...this.getAllClasses('M1'), ...this.getAllClasses('M2')],
      loggedInAt: new Date().toISOString()
    };
    this.setCurrentUser(user);
    return { success: true, user, teacher, isIntern };
  },

  async verifyTeacherLogin(email, secret) {
    const rate = this.checkRateLimit('teacher_login');
    if (!rate.allowed) {
      return { success: false, message: rate.message };
    }

    const teachers = this.getTeachersList();
    const inputKey = (email || '').trim().toLowerCase();
    const inputSecret = (secret || '').trim();

    let match = null;
    let matchLegacy = false;
    for (const t of teachers) {
      const targetEmail = (t.email || '').trim().toLowerCase();
      const targetName = (t.name || '').trim().toLowerCase();
      const targetId = (t.id || '').trim().toLowerCase();
      const targetInternId = (t.internId || '').trim().toLowerCase();
      const isIdentifierMatch = (inputKey === targetEmail || inputKey === targetName || inputKey === targetId || (targetInternId && inputKey === targetInternId));
      if (!isIdentifierMatch) continue;

      if (t.needsFirstTimeSetup) { match = t; break; }

      const vr = await this.verifyRecordSecret(t, inputSecret);
      if (vr.ok) { match = t; matchLegacy = vr.legacy; break; }
    }

    if (match) {
      if (!this.isTeacherApproved(match)) {
        const isRejected = match.status === 'rejected';
        return {
          success: false,
          code: isRejected ? 'rejected' : 'pending',
          message: isRejected ? 'ครูไม่อนุมัติการลงทะเบียน' : 'รอครูอนุมัติ: บัญชีนักศึกษาฝึกสอนอยู่ระหว่างรอครูประจำวิชาอนุมัติ'
        };
      }
      if (match.needsFirstTimeSetup) {
        return {
          success: true,
          needsSetup: true,
          teacher: match,
          message: 'เข้าสู่ระบบครั้งแรกสำเร็จ กรุณาตั้งรหัสผ่านประจำตัว'
        };
      }

      this.recordLoginAttempt('teacher_login', true);
      if (matchLegacy) await this.upgradeTeacherSecret(match.id, inputSecret);
      this.setActiveTeacher(match.id);
      const isIntern = match.roleCategory === 'trainee' ||
                       (match.role && match.role.includes('ฝึกสอน')) ||
                       (match.role && match.role.includes('นศ')) ||
                       !match.isAdmin;

      const user = {
        role: isIntern ? 'intern' : 'teacher',
        email: match.email,
        name: match.name,
        teacherId: match.id,
        internId: match.internId || match.id,
        teacherRole: match.role,
        roleCategory: match.roleCategory || (isIntern ? 'trainee' : 'mentor'),
        isAdmin: !!match.isAdmin,
        classes: isIntern ? (Array.isArray(match.classes) ? match.classes : []) : (match.classes && match.classes.length ? match.classes : [...this.getAllClasses('M1'), ...this.getAllClasses('M2')]),
        loggedInAt: new Date().toISOString()
      };
      this.setCurrentUser(user);
      return { success: true, user, isIntern };
    }

    const acc = this.getTeacherAccount();
    const targetEmail = (acc.email || '').trim().toLowerCase();
    if (inputKey === targetEmail) {
      const vr = await this.verifyRecordSecret(acc, inputSecret);
      if (vr.ok) {
        this.recordLoginAttempt('teacher_login', true);
        if (vr.legacy) await this.upgradeTeacherSecret('admin_primary', inputSecret);
        const user = {
          role: 'teacher',
          email: acc.email,
          name: acc.name,
          teacherId: 'admin_primary',
          teacherRole: 'ครูประจำวิชา (แอดมิน)',
          roleCategory: 'mentor',
          isAdmin: true,
          loggedInAt: new Date().toISOString()
        };
        this.setCurrentUser(user);
        return { success: true, user };
      }
    }

    this.recordLoginAttempt('teacher_login', false);
    return { success: false, message: 'อีเมล/ชื่อผู้ใช้ หรือรหัสผ่าน/PIN ของครูไม่ถูกต้อง' };
  },

  getAllStudentAccounts() {
    return this.load(STORAGE_KEYS.STUDENT_ACCOUNTS, {}) || {};
  },

  getStudentAccount(studentId) {
    const key = String(studentId || '').trim();
    if (this.getTestStudent(key)) {
      return {
        studentId: key,
        pin: DEV_DEMO_PIN,
        isTestAccount: true
      };
    }
    const all = this.getAllStudentAccounts();
    return all[key] || null;
  },

  registerStudentPin(studentId, pin) {
    const sId = String(studentId).trim();
    const pinStr = String(pin).trim();
    if (!/^\d{6}$/.test(pinStr)) {
      return { success: false, message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น (0-9)' };
    }
    const studentInfo = this.getStudentById(sId);
    if (!studentInfo) {
      return { success: false, message: 'ไม่พบรหัสนักเรียนนี้ในฐานข้อมูลโรงเรียน' };
    }
    const all = this.getAllStudentAccounts();
    all[sId] = {
      studentId: sId,
      pinHash: this.hashSecret(pinStr, sId),
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (this.save(STORAGE_KEYS.STUDENT_ACCOUNTS, all)) {
      const user = {
        role: 'student',
        studentId: sId,
        studentClass: studentInfo.class,
        name: `${studentInfo.prefix}${studentInfo.first_name} ${studentInfo.last_name}`,
        nickname: studentInfo.nickname || '',
        no: studentInfo.no,
        loggedInAt: new Date().toISOString()
      };
      this.setCurrentUser(user);
      return { success: true, user };
    }
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  },

  verifyStudentLogin(studentId, pin) {
    const sId = String(studentId).trim();
    const pinStr = String(pin).trim();

    if (this.isTestStudentId(sId)) {
      const studentInfo = this.getStudentById(sId);
      if (!this.isTestStudentSecretValid(pinStr)) {
        return { success: false, message: 'รหัสบัญชีสาธิตไม่ถูกต้อง (บัญชีสาธิตใช้ได้เฉพาะโหมดพัฒนา/ตัวอย่างเท่านั้น)' };
      }
      const user = {
        role: 'student',
        studentId: sId,
        studentClass: studentInfo.class,
        name: `${studentInfo.prefix}${studentInfo.first_name} ${studentInfo.last_name}`,
        nickname: studentInfo.nickname || '',
        no: studentInfo.no,
        isTestAccount: true,
        loggedInAt: new Date().toISOString()
      };
      this.setCurrentUser(user);
      return { success: true, user };
    }

    const rate = this.checkRateLimit(`student_${sId}`);
    if (!rate.allowed) {
      return { success: false, message: rate.message };
    }

    const studentInfo = this.getStudentById(sId);
    if (!studentInfo) {
      return { success: false, message: 'ไม่พบรหัสนักเรียนนี้ในฐานข้อมูลโรงเรียน (กรุณาตรวจสอบรหัส 5 หลัก)' };
    }
    const acc = this.getStudentAccount(sId);
    if (!acc) {
      return { success: false, needsRegistration: true, student: studentInfo, message: 'ยังไม่เคยตั้งรหัส PIN 6 หลัก กรุณาตั้ง PIN เพื่อเปิดใช้งาน' };
    }

    const inputHash = this.hashSecret(pinStr, sId);
    const isMatched = (acc.pinHash && acc.pinHash === inputHash) || (acc.pin && acc.pin === pinStr);

    if (!isMatched) {
      this.recordLoginAttempt(`student_${sId}`, false);
      return { success: false, message: 'รหัส PIN 6 หลักไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
    }

    this.recordLoginAttempt(`student_${sId}`, true);

    // Auto-migrate legacy plaintext PIN to salted hash on login
    if (acc.pin && !acc.pinHash) {
      const all = this.getAllStudentAccounts();
      all[sId] = {
        studentId: sId,
        pinHash: inputHash,
        registeredAt: acc.registeredAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.save(STORAGE_KEYS.STUDENT_ACCOUNTS, all);
    }

    const user = {
      role: 'student',
      studentId: sId,
      studentClass: studentInfo.class,
      name: `${studentInfo.prefix}${studentInfo.first_name} ${studentInfo.last_name}`,
      nickname: studentInfo.nickname || '',
      no: studentInfo.no,
      loggedInAt: new Date().toISOString()
    };
    this.setCurrentUser(user);
    return { success: true, user };
  },

  resetStudentPin(studentId) {
    const sId = String(studentId).trim();
    const all = this.getAllStudentAccounts();
    this._loginLocks.delete(`student_${sId}`);
    if (all[sId]) {
      delete all[sId];
      if (this.save(STORAGE_KEYS.STUDENT_ACCOUNTS, all)) {
        return { success: true, message: `รีเซ็ตรหัส PIN ของนักเรียนรหัส ${sId} เรียบร้อยแล้ว (นักเรียนสามารถตั้ง PIN ใหม่ได้ทันที)` };
      }
      return { success: false, message: 'เกิดข้อผิดพลาดในการรีเซ็ต' };
    }
    return { success: true, message: `นักเรียนรหัส ${sId} ยังไม่มีการตั้ง PIN อยู่แล้ว` };
  },

  // --- ภาระงานรายคาบ (อ่านจาก วก.5 + น้ำหนัก K/P/A — ไม่ฮาร์ดโค้ด) ---
  // คืนข้อมูลที่ทั้งฝั่งนักเรียน (ข้อความภารกิจ) และฝั่งครู (คะแนนเต็ม/รับคะแนนได้หรือไม่) ใช้ร่วมกัน
  getPeriodTask(grade, period) {
    const p = Number(period);
    const lesson = this._lessonOf ? this._lessonOf(grade, p) : this.getLesson(grade, p);
    let plan = null;
    try { plan = (this.getWk5Plan && this.getWk5Plan(grade, p)) || (lesson && lesson.wk5) || null; } catch (e) { plan = (lesson && lesson.wk5) || null; }
    const work = plan && Array.isArray(plan.work) ? plan.work.map(x => String(x || '').trim()).filter(Boolean) : [];
    const w = this.getPeriodWeights(grade, p);
    const exam = !!(w && w.exam);
    const total = w && w.total ? w.total : 0;
    const asm = (plan && plan.assessment) || {};
    const text = work.concat([asm.k, asm.p, asm.a].map(x => String(x || ''))).join(' ');
    const kinds = ['text'];
    if (/คลิป|วิดีโอ|วีดิโอ|วีดีโอ|video/i.test(text)) kinds.push('video');
    if (/ไฟล์|แนบ|ภาพถ่าย|รูปถ่าย/.test(text)) kinds.push('file');
    if (/ลิงก์|ลิงค์|link|url/i.test(text)) kinds.push('link');
    return {
      period: p,
      topic: lesson && lesson.topic ? lesson.topic : '',
      work,
      hasWork: work.length > 0,
      weights: w ? { k: w.k, p: w.p, a: w.a } : { k: 0, p: 0, a: 0 },
      max: total,
      exam,
      scored: total > 0 && !exam,
      canScore: total > 0 && !exam,
      acceptsSubmission: !exam,
      kinds,
      note: exam ? 'คาบสอบ: คะแนนมาจากระบบสอบ' : (total > 0 ? '' : 'คาบนี้ไม่เก็บคะแนนรายชิ้น')
    };
  },

  // บันทึกคะแนนรายคาบของนักเรียน 1 คน ลงสมุดคะแนน (session.scores) โดยไม่เลื่อนคาบถัดไปของห้อง
  // ปฏิเสธ (ไม่ตัดค่าเงียบๆ): คาบไม่เก็บคะแนน / คาบสอบ / ค่าไม่ใช่ตัวเลข / เกินคะแนนเต็ม
  setPeriodScore(className, period, studentId, score) {
    const grade = this.gradeKeyOf(className);
    const w = this.getPeriodWeights(grade, period);
    if (!w || !w.total) return { ok: false, reason: 'no_score_period', max: 0 };
    if (w.exam) return { ok: false, reason: 'exam_period', max: w.total };
    const n = Number(score);
    if (score === '' || score === null || score === undefined || !Number.isFinite(n) || n < 0) return { ok: false, reason: 'invalid', max: w.total };
    if (n > w.total + 1e-9) return { ok: false, reason: 'over_max', max: w.total };
    const val = this._round2(n);
    const all = this.getAllSessions();
    const key = this.getSessionKey(className, period);
    const now = new Date();
    const base = all[key] || { className, period, timestamp: now.toISOString(), dateStr: now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) };
    const scores = Object.assign({}, base.scores || {});
    scores[studentId] = val;
    all[key] = Object.assign({}, base, { scores });
    if (!this.save(STORAGE_KEYS.SESSIONS, all)) return { ok: false, reason: 'save_failed', max: w.total };
    return { ok: true, score: val, max: w.total };
  },

  // --- Teacher Feedback Loop on Student Submissions ---
  saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, score) {
    const subs = this.getAllSubmissions();
    const key = `${className}_p${period}_${studentId}`;
    if (!subs[key]) {
      subs[key] = {
        className,
        period,
        studentId,
        content: '',
        url: '',
        submittedAt: new Date().toISOString()
      };
    }
    const instructor = this.getInstructor ? this.getInstructor() : { name: 'คุณครู' };
    const hasScore = score !== undefined && score !== null && String(score) !== '';
    const res = hasScore ? this.setPeriodScore(className, period, studentId, score) : { ok: true };
    const prev = subs[key].teacherFeedback && subs[key].teacherFeedback.score !== undefined ? subs[key].teacherFeedback.score : null;
    subs[key].teacherFeedback = {
      feedback: (feedbackText || '').trim(),
      score: hasScore ? (res.ok ? res.score : prev) : null,
      scoreStatus: hasScore ? (res.ok ? 'saved' : res.reason) : 'none',
      teacherName: instructor.name,
      teacherRole: instructor.role,
      feedbackAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    this._lastFeedbackResult = Object.assign({ hasScore }, res);
    return this.save(STORAGE_KEYS.SUBMISSIONS, subs);
  },


  // --- Student Practice Activity & Gamification Badges ---
  recordStudentPractice(studentId, note) {
    try {
      const key = `ppk_practice_log_${studentId}`;
      const existing = localStorage.getItem(key);
      const count = existing ? parseInt(existing, 10) + 1 : 1;
      localStorage.setItem(key, String(count));
      this._cache.set(key, count);
      return count;
    } catch (e) {
      return 1;
    }
  },

  // --- Profile Avatars (Students & Teachers) synced with Google Drive ---
  getAllAvatars() {
    return this.load(STORAGE_KEYS.AVATARS, {}) || {};
  },

  getAvatar(targetKey) {
    if (!targetKey) return null;
    const all = this.getAllAvatars();
    return all[String(targetKey).trim()] || null;
  },

  getAvatarUrl(targetKey) {
    const av = this.getAvatar(targetKey);
    if (!av) return '';
    if (av.thumbDataUrl) return av.thumbDataUrl;
    if (av.fileId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(av.fileId)}&sz=w256`;
    return av.fileUrl || '';
  },

  getStudentAvatarUrl(studentId) {
    return this.getAvatarUrl('student_' + String(studentId || '').trim());
  },

  getTeacherAvatarUrl(identifier) {
    const clean = String(identifier || 'admin_primary').trim().toLowerCase().replace(/[^a-z0-9_.@-]/g, '_');
    return this.getAvatarUrl('teacher_' + clean) || this.getAvatarUrl('teacher_admin_primary');
  },

  async saveProfileAvatar({ targetKey, role, ownerId, className, mimeType, base64Data, thumbDataUrl }) {
    const cleanKey = String(targetKey || '').trim().replace(/[^A-Za-z0-9_.@-]/g, '_');
    if (!cleanKey) return { success: false, message: 'ไม่พบรหัสผู้ใช้' };
    const all = this.getAllAvatars();
    const entry = {
      targetKey: cleanKey,
      role: role === 'teacher' ? 'teacher' : 'student',
      ownerId: String(ownerId || cleanKey),
      className: String(className || ''),
      thumbDataUrl: thumbDataUrl || '',
      fileId: (all[cleanKey] && all[cleanKey].fileId) || '',
      fileUrl: (all[cleanKey] && all[cleanKey].fileUrl) || '',
      updatedMs: Date.now()
    };
    all[cleanKey] = entry;
    this.save(STORAGE_KEYS.AVATARS, all);

    // Upload to Google Drive via Apps Script if URL is configured
    let apiUrl = '';
    let syncToken = '';
    if (typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.getConfig) {
      const cfg = GoogleSheetSync.getConfig();
      apiUrl = cfg.webAppUrl || '';
      syncToken = cfg.syncToken || '';
    }
    if (!apiUrl && typeof StudentAuth !== 'undefined' && StudentAuth.getApiUrl) {
      apiUrl = StudentAuth.getApiUrl();
    }
    if (apiUrl && typeof fetch !== 'undefined') {
      try {
        const currentUser = this.getCurrentUser ? this.getCurrentUser() : null;
        const payload = {
          action: 'uploadProfileAvatar',
          token: syncToken,
          sessionToken: (currentUser && currentUser.sessionToken) || '',
          targetKey: cleanKey,
          role: entry.role,
          ownerId: entry.ownerId,
          className: entry.className,
          mimeType: mimeType || 'image/jpeg',
          base64Data: base64Data || '',
          thumbDataUrl: thumbDataUrl || ''
        };
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        });
        const data = await res.json();
        if (data && data.status === 'success') {
          entry.fileId = data.fileId || entry.fileId;
          entry.fileUrl = data.fileUrl || entry.fileUrl;
          entry.updatedMs = data.updatedMs || entry.updatedMs;
          all[cleanKey] = entry;
          this.save(STORAGE_KEYS.AVATARS, all);
          return { success: true, syncedDrive: true, entry };
        }
      } catch (err) {
        console.warn('Google Drive avatar upload deferred (saved locally):', err);
      }
    }
    return { success: true, syncedDrive: false, entry };
  },

  async syncAvatarsFromServer(className = '') {
    let apiUrl = '';
    let syncToken = '';
    if (typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.getConfig) {
      const cfg = GoogleSheetSync.getConfig();
      apiUrl = cfg.webAppUrl || '';
      syncToken = cfg.syncToken || '';
    }
    if (!apiUrl && typeof StudentAuth !== 'undefined' && StudentAuth.getApiUrl) {
      apiUrl = StudentAuth.getApiUrl();
    }
    if (!apiUrl || typeof fetch === 'undefined') return false;
    try {
      const currentUser = this.getCurrentUser ? this.getCurrentUser() : null;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'fetchProfileAvatars',
          className,
          token: syncToken,
          sessionToken: (currentUser && currentUser.sessionToken) || ''
        }),
        redirect: 'follow'
      });
      const data = await res.json();
      if (data && data.status === 'success' && data.avatars) {
        const all = this.getAllAvatars();
        let changed = false;
        Object.keys(data.avatars).forEach(k => {
          const remote = data.avatars[k];
          const local = all[k];
          if (!local || (Number(remote.updatedMs || 0) >= Number(local.updatedMs || 0))) {
            all[k] = remote;
            changed = true;
          }
        });
        if (changed) this.save(STORAGE_KEYS.AVATARS, all);
        return changed;
      }
    } catch (e) {}
    return false;
  },

  getStudentBadges(studentId, className) {
    const badges = [
      {
        id: 'first_submission',
        icon: '🚀',
        title: 'ก้าวแรกสู่นักดนตรี',
        desc: 'ส่งแบบฝึกหัดหรือภารกิจในคาบเรียนชิ้นแรกสำเร็จ',
        unlocked: false
      },
      {
        id: 'tuner_master',
        icon: '🎵',
        title: 'เซียนคาลิมบ้า (Tuner & Synth)',
        desc: 'เข้าฝึกปฏิบัติดนตรีผ่านเครื่องตั้งเสียงหรือคาลิมบ้าจำลอง',
        unlocked: false
      },
      {
        id: 'quiz_champion',
        icon: '💯',
        title: 'แชมป์ทฤษฎีดนตรี',
        desc: 'ทำแบบทดสอบวัดผลสัมฤทธิ์ท้ายหน่วยได้คะแนนยอดเยี่ยม (>= 80%)',
        unlocked: false
      },
      {
        id: 'feldman_critic',
        icon: '🎨',
        title: 'นักวิจารณ์ศิลปะดนตรี',
        desc: 'ส่งใบวิจารณ์ผลงานดนตรี 4 ขั้นตอนตามหลัก Feldman สำเร็จ',
        unlocked: false
      },
      {
        id: 'perfect_attendance',
        icon: '⭐',
        title: 'วินัยยอดเยี่ยม (100% Attendance)',
        desc: 'มีเวลาเรียนสะสมครบ 100% ตรงต่อเวลาทุกคาบ',
        unlocked: false
      }
    ];

    try {
      // 1. Check Submissions
      const subs = this.getAllSubmissions();
      const hasSub = Object.keys(subs).some(k => k.endsWith(`_${studentId}`));
      if (hasSub) badges[0].unlocked = true;

      // 2. Check Practice
      const practiceCount = localStorage.getItem(`ppk_practice_log_${studentId}`);
      if (practiceCount && parseInt(practiceCount, 10) > 0) badges[1].unlocked = true;

      // 3. Check Quizzes
      for (let u = 1; u <= 4; u++) {
        const rawScore = localStorage.getItem(`music_quiz_grade_${studentId}_u${u}`);
        const attemptObj = this.load(`music_quiz_${studentId}_u${u}`, null);
        if ((rawScore && Number(rawScore) >= 8) || (attemptObj && Number(attemptObj.score) >= 8)) {
          badges[2].unlocked = true;
          break;
        }
      }

      // 4. Check Feldman (supports music_feldman_{studentId}_p15..18 and legacy keys)
      let hasFeldman = false;
      const maxPeriods = Math.max(0, ...Object.keys(typeof LESSONS_DATA === 'undefined' ? {} : LESSONS_DATA).map(g => LESSONS_DATA[g].length));
      for (let p = 1; p <= maxPeriods; p++) {
        const fObj = this.load(`music_feldman_${studentId}_p${p}`, null);
        if ((fObj && fObj.submitted) || localStorage.getItem(`feldman_criticism_p${p}_${studentId}`)) {
          hasFeldman = true;
          break;
        }
      }
      if (hasFeldman) badges[3].unlocked = true;

      // 5. Check Attendance
      if (className) {
        const transcript = this.getStudentTranscript(className, studentId);
        if (transcript && transcript.attendanceStats && transcript.attendanceStats.attendancePct >= 95) {
          badges[4].unlocked = true;
        }
      }
    } catch (e) {}

    return badges;
  }
};

// Invalidate in-memory cache if another browser tab modifies localStorage
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e.key) {
      Store._cache.delete(e.key);
    } else {
      Store.clearCache();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
