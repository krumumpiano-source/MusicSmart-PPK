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
  TEACHERS_LIST: 'ppk_teachers_list'
};

const DEFAULT_TEACHER_ACCOUNT = {
  email: 'krumum.piano@gmail.com',
  secretType: 'password', // 'password' or 'pin'
  secret: 'ppk1234',
  name: 'นายพงศธร โพธิแก้ว'
};

const DEFAULT_APP_SETTINGS = {
  appName: "MusicSmart",
  appBadge: "Adaptive T-PACE",
  innovationName: "ระบบนิเวศการเรียนรู้ดนตรีดิจิทัลรูปแบบ Adaptive T-PACE & 3-Tier Mastery",
  innovationSub: "Adaptive T-PACE & 3-Tier Mastery Music Learning Ecosystem",
  researchTitle: "การคิดค้นและปรับเปลี่ยนกระบวนการจัดการเรียนรู้ดนตรีโดยใช้นวัตกรรมรูปแบบการสอนเชิงรุกยืดหยุ่น (Adaptive T-PACE Model) ร่วมกับระบบการเรียนรู้ปรับเหมาะ 3 ระดับ (3-Tier Mastery Loop) เพื่อพัฒนาสมรรถนะการปฏิบัติคาลิมบ้าและการคิดขั้นสูงทางดนตรี ของนักเรียนชั้นมัธยมศึกษาปีที่ 1",
  schoolName: "โรงเรียนพะเยาพิทยาคม",
  schoolShort: "พ.พ.",
  department: "กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)",
  directorName: "ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ",
  directorRole: "ผู้อำนวยการโรงเรียนพะเยาพิทยาคม",
  departmentHead: "นายอุดม ไชยวุฒิ",
  departmentHeadRole: "หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ",
  academicHead: "นายกฤศ วงค์เรือง",
  academicHeadRole: "รองผู้อำนวยการกลุ่มบริหารงานวิชาการ",
  evaluatorHead: "หัวหน้างานวัดและประเมินผล"
};

const DEFAULT_INSTRUCTOR = {
  role: 'ครูประจำวิชา',
  name: 'นายพงศธร โพธิแก้ว'
};

const DEFAULT_SUBJECTS = [
  { id: 'M1_1', code: 'ศ21101', name: 'ดนตรี 1 (ม.1 พื้นฐาน)', grade: 'ม.1', periods: 20, active: true },
  { id: 'M1', code: 'ศ21102', name: 'ดนตรีสากล (ม.1 เพิ่มเติม)', grade: 'ม.1', periods: 20, active: true },
  { id: 'M1_EP', code: 'AR21105', name: 'ดนตรีสากล (ม.1/14 EP)', grade: 'ม.1/14', periods: 20, active: true },
  { id: 'M2_1', code: 'ศ22101', name: 'ดนตรี 2 (ม.2 พื้นฐาน)', grade: 'ม.2', periods: 20, active: true },
  { id: 'M2', code: 'ศ22102', name: 'ดนตรีสากล (ม.2 เพิ่มเติม)', grade: 'ม.2', periods: 20, active: true }
];

const DEFAULT_SEMESTER_META = {
  activeId: '2569_2',
  activeYear: '2569',
  activeTerm: '2',
  activeLabel: 'ภาคเรียนที่ 2 ปีการศึกษา 2569',
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
    scores[studentId] = {
      pre: pPre !== undefined ? Number(pPre) : (scores[studentId]?.pre || 0),
      post: pPost !== undefined ? Number(pPost) : (scores[studentId]?.post || 0),
      formative: pForm !== undefined ? Number(pForm) : (scores[studentId]?.formative || 0),
      updatedAt: new Date().toISOString()
    };
    return this.saveResearchScores(className, scores);
  },

  getCurrentSubject(className) {
    const subjects = this.getAllSubjects();
    const grade = className.startsWith('ม.1') ? 'ม.1' : (className.startsWith('ม.2') ? 'ม.2' : '');
    if (className === 'ม.1/14') {
      return subjects.find(s => s.code === 'AR21105') || { code: 'AR21105', name: 'ดนตรีสากล (ม.1/14 EP)', periods: 20 };
    }
    const match = subjects.find(s => s.grade === grade);
    if (match) return match;
    return grade === 'ม.1' 
      ? { code: 'ศ21101', name: 'ดนตรี 1 (ม.1)', periods: 20 }
      : { code: 'ศ22101', name: 'ดนตรี 2 (ม.2)', periods: 20 };
  },

  // --- Instructor Profile ---
  getInstructor() {
    const saved = this.load(STORAGE_KEYS.INSTRUCTOR, null);
    return saved ? { ...DEFAULT_INSTRUCTOR, ...saved } : { ...DEFAULT_INSTRUCTOR };
  },

  setInstructor(role, name) {
    let defaultTeacher = DEFAULT_INSTRUCTOR.name;
    try {
      const s = this.getAppSettings ? this.getAppSettings() : null;
      if (s && s.teacherName) defaultTeacher = s.teacherName;
    } catch (e) {}
    const profile = { role, name: name || (role === 'ครูประจำวิชา' ? defaultTeacher : 'คุณครูฝึกสอน') };
    this.save(STORAGE_KEYS.INSTRUCTOR, profile);
    return profile;
  },

  // --- Students Roster (with O(1) Hash Map Index) ---
  getStudents(className) {
    if (typeof STUDENTS_DATA !== 'undefined' && STUDENTS_DATA[className]) {
      return STUDENTS_DATA[className];
    }
    return [];
  },

  _ensureStudentIndex() {
    if (!this._studentIndex && typeof STUDENTS_DATA !== 'undefined') {
      this._studentIndex = new Map();
      for (const className of Object.keys(STUDENTS_DATA)) {
        const list = STUDENTS_DATA[className] || [];
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          this._studentIndex.set(String(s.student_id).trim(), { ...s, class: className });
        }
      }
    }
  },

  getStudentById(studentId) {
    if (typeof STUDENTS_DATA === 'undefined') return null;
    this._ensureStudentIndex();
    const key = String(studentId || '').trim();
    return this._studentIndex ? (this._studentIndex.get(key) || null) : null;
  },

  getAllClasses(grade = 'M1') {
    const list = [];
    const source = typeof STUDENTS_DATA !== 'undefined' ? STUDENTS_DATA : {};
    const prefix = grade === 'M1' ? 'ม.1/' : 'ม.2/';
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

  // --- Lessons Data (with O(1) Composite Key Index) ---
  getLesson(grade, period) {
    if (typeof LESSONS_DATA === 'undefined' || !LESSONS_DATA[grade]) return null;
    if (!this._lessonIndex) {
      this._lessonIndex = new Map();
      for (const g of Object.keys(LESSONS_DATA)) {
        (LESSONS_DATA[g] || []).forEach(l => {
          this._lessonIndex.set(`${g}_${l.period}`, l);
        });
      }
    }
    return this._lessonIndex.get(`${grade}_${Number(period)}`) || null;
  },

  getAllLessons(grade = 'M1') {
    if (typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA[grade]) {
      return LESSONS_DATA[grade];
    }
    return [];
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
    const grade = className.startsWith('ม.1') ? 'M1' : 'M2';
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
        if (att === 'present') attendedCount++;
        else if (att === 'absent') absentCount++;
        else if (att === 'leave') leaveCount++;
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
      semesterLabel: this.getSemesterMeta().activeLabel,
      generatedAt: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  },

  // --- Remedial & Make-up Score System (ระบบติดตามงานค้าง/สอบซ่อม) ---
  getPendingMakeups(className) {
    const grade = className.startsWith('ม.1') ? 'M1' : 'M2';
    const students = this.getStudents(className);
    const sessions = this.getAllSessions();
    const pendingList = [];

    for (let p = 1; p <= 20; p++) {
      const lesson = this.getLesson(grade, p);
      if (!lesson || !lesson.assessment?.has_score) continue;

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
    return saved ? { ...DEFAULT_SEMESTER_META, ...saved } : { ...DEFAULT_SEMESTER_META };
  },

  saveSemesterMeta(meta) {
    return this.save(STORAGE_KEYS.SEMESTERS, meta);
  },

  startNewSemester(year, term) {
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
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [...DEFAULT_SUBJECTS];
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
      subjects[idx] = { ...subjects[idx], ...data };
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
      teacherCode: '612',
      teacherName: (s && s.teacherName) ? s.teacherName : 'ครูพงศธร โพธิแก้ว',
      school: (s && s.schoolName) ? s.schoolName : 'โรงเรียนพะเยาพิทยาคม',
      term: (s && s.academicTerm) ? s.academicTerm : 'ภาคเรียนที่ 2/2569',
      room: 'อส.5',
      date: '20.10.2569',
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

  getTodayClasses() {
    const tt = this.getTimetable();
    const todayName = this.getTodayDayName();
    const daySchedule = tt.schedule[todayName] || tt.schedule[todayName.replace('บดี', 'ฯ')] || {};
    const result = [];

    tt.periods.forEach(p => {
      const cls = daySchedule[p.no];
      if (cls) {
        const isLunch = cls === 'พักกลางวัน' || cls === 'พักเที่ยง';
        const isActivity = ['จริยะ', 'กก.ล.', 'กก.บ.', 'ประชุม PLC'].includes(cls);
        let subjCode = '';
        if (cls === 'ม.1/14') subjCode = 'AR21105';
        else if (cls.startsWith('ม.1/')) subjCode = 'ศ21102';
        else if (cls.startsWith('ม.2/')) subjCode = 'ศ22102';

        result.push({
          periodNo: p.no,
          time: p.time,
          className: cls,
          subjCode,
          isLunch,
          isActivity,
          room: cls.startsWith('ม.') ? 'อส.5' : ''
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
      holidays: this.getHolidayLogs(),
      extendedAssessments: this.collectExtendedAssessmentData()
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
      if (payload.holidays) this.save(STORAGE_KEYS.HOLIDAYS, payload.holidays);
      if (payload.studentStatus) this.save(STORAGE_KEYS.STUDENT_STATUS, payload.studentStatus);
      if (payload.studentAccounts) this.save(STORAGE_KEYS.STUDENT_ACCOUNTS, payload.studentAccounts);
      if (payload.semesterMeta) this.save(STORAGE_KEYS.SEMESTERS, payload.semesterMeta);
      if (payload.subjects) this.save(STORAGE_KEYS.SUBJECTS, payload.subjects);
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
    for (let p = 1; p <= 20; p++) {
      headers.push(`คาบที่ ${p} (สถานะ)`);
      headers.push(`คาบที่ ${p} (คะแนน)`);
    }

    const rows = [headers];

    students.forEach(s => {
      const st = statuses[s.student_id]?.status || 'ปกติ';
      const row = [s.no, s.student_id, s.prefix, s.first_name, s.last_name, s.nickname, st];
      for (let p = 1; p <= 20; p++) {
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
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE) || 'teacher';
    } catch (e) {
      return 'teacher';
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
          todos.push({
            id: `today-${c.className}-${c.periodNo}`,
            type: 'today_class',
            title: `สอนวันนี้ คาบ ${c.periodNo} (${c.time})`,
            subtitle: `ห้อง ${c.className} • ${c.subjCode} (เนื้อหาคาบที่ ${targetP})`,
            className: c.className,
            period: targetP,
            isDone: isDone,
            badge: isDone ? 'บันทึกแล้ว' : 'รอสอน',
            badgeClass: isDone ? 'badge-success' : 'badge-primary',
            actionText: isDone ? 'ดูบันทึก' : 'เข้าสอน'
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
      submittedAt: new Date().toLocaleString('th-TH'),
      status: data.status || 'submitted',
      score: data.score !== undefined ? data.score : (existing.score || null),
      feedback: data.feedback !== undefined ? data.feedback : (existing.feedback || '')
    };
    if (this.save(STORAGE_KEYS.SUBMISSIONS, all)) {
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

    return saved;
  },

  // --- Rubric Breakdown & Quiz Grade Storage (Cached) ---
  getStudentRubric(studentId, period) {
    return this.load(`music_rubric_${studentId}_p${period}`, null);
  },

  saveStudentRubric(studentId, period, rubricData) {
    return this.save(`music_rubric_${studentId}_p${period}`, rubricData);
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

  saveTeacherAccount(accountData) {
    const current = this.getTeacherAccount();
    const rawSecret = accountData.secret !== undefined ? String(accountData.secret).trim() : '';
    let secretHash = current.secretHash || this.hashSecret(DEFAULT_TEACHER_ACCOUNT.secret, 'teacher');
    if (rawSecret && !rawSecret.startsWith('sha256_')) {
      secretHash = this.hashSecret(rawSecret, 'teacher');
    }
    const updated = {
      ...current,
      ...accountData,
      secretHash,
      updatedAt: new Date().toISOString()
    };
    if (this.save(STORAGE_KEYS.TEACHER_ACCOUNT, updated)) {
      try {
        const teachers = this.getTeachersList();
        const adminIdx = teachers.findIndex(t => t.isAdmin || t.id === 'admin_primary');
        if (adminIdx !== -1) {
          teachers[adminIdx].email = updated.email;
          teachers[adminIdx].name = updated.name;
          if (rawSecret) {
            teachers[adminIdx].secret = rawSecret;
            teachers[adminIdx].secretHash = secretHash;
          }
          this.saveTeachersList(teachers);
        }
      } catch (e) {}
      return updated;
    }
    return null;
  },

  changeAdminPassword(newSecret) {
    if (!newSecret || !String(newSecret).trim()) {
      return { success: false, message: 'กรุณาระบุรหัสผ่านใหม่' };
    }
    const cleanSecret = String(newSecret).trim();
    const adminAcc = this.getTeacherAccount();
    const updated = this.saveTeacherAccount({
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
          secret: adminAcc.secret || 'ppk1234',
          secretHash: adminAcc.secretHash || this.hashSecret(adminAcc.secret || 'ppk1234', 'teacher'),
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
          secret: '',
          secretHash: '',
          needsFirstTimeSetup: true,
          institution: 'เอกดนตรี มหาวิทยาลัยพะเยา',
          activeTeaching: false,
          note: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู เอกดนตรี มหาวิทยาลัยพะเยา'
        },
        {
          id: 'trainee_default',
          name: 'คุณครูฝึกสอน',
          email: 'trainee@ppk.ac.th',
          role: 'ครูนักศึกษาฝึกสอน',
          roleCategory: 'trainee',
          isAdmin: false,
          secret: '1234',
          secretHash: this.hashSecret('1234', 'teacher'),
          institution: 'มหาวิทยาลัยพะเยา',
          activeTeaching: false,
          note: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู'
        }
      ];
      this.saveTeachersList(list);
    } else {
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
        if (adminAcc.secret && adminItem.secret !== adminAcc.secret) {
          adminItem.secret = adminAcc.secret;
          adminItem.secretHash = adminAcc.secretHash || this.hashSecret(adminAcc.secret, 'teacher');
          changed = true;
        }
        if (changed) this.saveTeachersList(list);
      }

      // Ensure kouocking@gmail.com exists in existing storage
      const kouockingExists = list.some(t => (t.email && t.email.toLowerCase() === 'kouocking@gmail.com') || t.id === 'teacher_kouocking');
      if (!kouockingExists) {
        list.push({
          id: 'teacher_kouocking',
          name: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู (เอกดนตรี มพ.)',
          email: 'kouocking@gmail.com',
          role: 'ครูนักศึกษาฝึกประสบการณ์วิชาชีพ',
          roleCategory: 'trainee',
          isAdmin: false,
          secret: '',
          secretHash: '',
          needsFirstTimeSetup: true,
          institution: 'เอกดนตรี มหาวิทยาลัยพะเยา',
          activeTeaching: false,
          note: 'นักศึกษาฝึกประสบการณ์วิชาชีพครู เอกดนตรี มหาวิทยาลัยพะเยา'
        });
        this.saveTeachersList(list);
      }
    }
    return list;
  },

  saveTeachersList(list) {
    return this.save(STORAGE_KEYS.TEACHERS_LIST, list);
  },

  addTeacher(data) {
    const list = this.getTeachersList();
    const cleanName = (data.name || '').trim();
    if (!cleanName) return { success: false, message: 'กรุณาระบุชื่อ-นามสกุลครูผู้สอน' };

    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (cleanEmail && list.some(t => t.email && t.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'อีเมลหรือชื่อผู้ใช้นี้มีในระบบแล้ว' };
    }

    const cleanSecret = (data.secret || '1234').trim();
    const newTeacher = {
      id: 'teacher_' + Date.now(),
      name: cleanName,
      email: cleanEmail || ('teacher_' + Date.now().toString().slice(-4) + '@ppk.ac.th'),
      role: data.role || 'ครูนักศึกษาฝึกสอน',
      roleCategory: data.roleCategory || (data.role && data.role.includes('ฝึกสอน') ? 'trainee' : 'co_teacher'),
      isAdmin: false,
      secret: cleanSecret,
      secretHash: this.hashSecret(cleanSecret, 'teacher'),
      institution: (data.institution || 'โรงเรียนพะเยาพิทยาคม').trim(),
      activeTeaching: !!data.activeTeaching,
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
    const rawSecret = updateData.secret !== undefined ? String(updateData.secret).trim() : '';
    let secretHash = current.secretHash;
    if (rawSecret && rawSecret !== current.secret) {
      secretHash = this.hashSecret(rawSecret, 'teacher');
    }

    const updated = {
      ...current,
      ...updateData,
      secret: rawSecret || current.secret,
      secretHash: secretHash,
      updatedAt: new Date().toISOString()
    };

    list[idx] = updated;

    if (updated.activeTeaching) {
      list.forEach((t, i) => { if (i !== idx) t.activeTeaching = false; });
      this.setInstructor(updated.role, updated.name);
    }

    if (updated.isAdmin || updated.id === 'admin_primary') {
      const adminAcc = this.getTeacherAccount();
      this.save(STORAGE_KEYS.TEACHER_ACCOUNT, {
        ...adminAcc,
        name: updated.name,
        email: updated.email,
        secret: updated.secret,
        secretHash: updated.secretHash,
        updatedAt: new Date().toISOString()
      });
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
    return teachers.find(t => (t.email && t.email.toLowerCase() === key) || (t.id && t.id.toLowerCase() === key)) || null;
  },

  completeTeacherFirstTimeSetup(teacherId, data) {
    const list = this.getTeachersList();
    const idx = list.findIndex(t => t.id === teacherId);
    if (idx === -1) return { success: false, message: 'ไม่พบบัญชีผู้สอน' };

    const teacher = list[idx];
    const newName = (data.name || '').trim() || teacher.name;
    const newSecret = (data.secret || '').trim();
    if (!newSecret) return { success: false, message: 'กรุณาระบุรหัสผ่านใหม่' };

    teacher.name = newName;
    teacher.secret = newSecret;
    teacher.secretHash = this.hashSecret(newSecret, 'teacher');
    teacher.needsFirstTimeSetup = false;
    teacher.institution = (data.institution || teacher.institution || 'เอกดนตรี มหาวิทยาลัยพะเยา').trim();
    teacher.updatedAt = new Date().toISOString();

    list[idx] = teacher;
    this.saveTeachersList(list);
    this.setActiveTeacher(teacher.id);

    const user = {
      role: 'teacher',
      email: teacher.email,
      name: teacher.name,
      teacherId: teacher.id,
      teacherRole: teacher.role,
      isAdmin: !!teacher.isAdmin,
      loggedInAt: new Date().toISOString()
    };
    this.setCurrentUser(user);
    return { success: true, user, teacher };
  },

  verifyTeacherLogin(email, secret) {
    const rate = this.checkRateLimit('teacher_login');
    if (!rate.allowed) {
      return { success: false, message: rate.message };
    }

    const teachers = this.getTeachersList();
    const inputKey = (email || '').trim().toLowerCase();
    const inputSecret = (secret || '').trim();
    const inputHash = this.hashSecret(inputSecret, 'teacher');

    const match = teachers.find(t => {
      const targetEmail = (t.email || '').trim().toLowerCase();
      const targetName = (t.name || '').trim().toLowerCase();
      const targetId = (t.id || '').trim().toLowerCase();
      const isIdentifierMatch = (inputKey === targetEmail || inputKey === targetName || inputKey === targetId);
      if (!isIdentifierMatch) return false;

      // If user needs first time setup, bypass password verification!
      if (t.needsFirstTimeSetup) {
        return true;
      }

      const targetHash = t.secretHash || this.hashSecret(String(t.secret || '').trim(), 'teacher');
      return (inputHash === targetHash || inputSecret === String(t.secret).trim());
    });

    if (match) {
      if (match.needsFirstTimeSetup) {
        return {
          success: true,
          needsSetup: true,
          teacher: match,
          message: 'เข้าสู่ระบบครั้งแรกสำเร็จ กรุณาตั้งรหัสผ่านประจำตัว'
        };
      }

      this.recordLoginAttempt('teacher_login', true);
      this.setActiveTeacher(match.id);
      const user = {
        role: 'teacher',
        email: match.email,
        name: match.name,
        teacherId: match.id,
        teacherRole: match.role,
        isAdmin: !!match.isAdmin,
        loggedInAt: new Date().toISOString()
      };
      this.setCurrentUser(user);
      return { success: true, user };
    }

    const acc = this.getTeacherAccount();
    const targetEmail = (acc.email || '').trim().toLowerCase();
    const targetHash = acc.secretHash || this.hashSecret(String(acc.secret || '').trim(), 'teacher');
    if (inputKey === targetEmail && (inputHash === targetHash || inputSecret === String(acc.secret).trim())) {
      this.recordLoginAttempt('teacher_login', true);
      const user = {
        role: 'teacher',
        email: acc.email,
        name: acc.name,
        isAdmin: true,
        loggedInAt: new Date().toISOString()
      };
      this.setCurrentUser(user);
      return { success: true, user };
    }

    this.recordLoginAttempt('teacher_login', false);
    return { success: false, message: 'อีเมล/ชื่อผู้ใช้ หรือรหัสผ่าน/PIN ของครูไม่ถูกต้อง' };
  },

  getAllStudentAccounts() {
    return this.load(STORAGE_KEYS.STUDENT_ACCOUNTS, {}) || {};
  },

  getStudentAccount(studentId) {
    const all = this.getAllStudentAccounts();
    return all[String(studentId).trim()] || null;
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
    subs[key].teacherFeedback = {
      feedback: (feedbackText || '').trim(),
      score: score !== undefined && score !== null && String(score) !== '' ? Number(score) : null,
      teacherName: instructor.name,
      teacherRole: instructor.role,
      feedbackAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    // If score provided, also sync into session score for period
    if (score !== undefined && score !== null && String(score) !== '') {
      const sess = this.getSession(className, period);
      if (sess) {
        if (!sess.scores) sess.scores = {};
        sess.scores[studentId] = Number(score);
        this.saveSession(className, period, sess);
      }
    }

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
      for (let p = 15; p <= 20; p++) {
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
