// ==========================================================================
// Google Sheets Dual-Save & Sync Engine (Local-First + Google Sheets API)
// MusicSmart PPK • ระบบบันทึกข้อมูลคู่ขนาน (ในเครื่อง + Google Sheets อัตโนมัติ)
// ==========================================================================

const GoogleSheetSync = {
  STORAGE_KEYS: {
    CONFIG: 'ppk_google_sheet_config',
    OUTBOX: 'ppk_sync_outbox'
  },

  DEFAULT_CONFIG: {
    // ไม่ฝัง URL ไว้ในโค้ดอีกต่อไป ครูกรอก URL + Sync Token ในหน้าต่าง "ซิงค์คู่ Google Sheets"
    // ตัวอย่างรูปแบบ: https://script.google.com/macros/s/AKfycb.../exec
    webAppUrl: '',
    syncToken: '',
    autoSync: true,
    lastSyncAt: null,
    syncCount: 0,
    syncStatus: 'synced', // 'unconfigured' | 'synced' | 'pending' | 'syncing' | 'error'
    gasVersion: '',       // เวอร์ชันโค้ดที่ Apps Script ที่ deploy อยู่รายงานกลับมา (ว่าง = ยังไม่เคยตรวจ/โค้ดเก่าที่ไม่รายงาน)
    gasOutdated: false    // true = เวอร์ชันไม่ตรงกับที่แอปคาดหวัง → ต้องอัปเดต GAS
  },

  isFlushing: false,
  RETRY_INTERVAL_MS: 60000,
  _retryTimer: null,

  init() {
    this.updateUIStatus();
    // Retry pending outbox periodically and on startup
    if (typeof setInterval !== 'undefined' && !this._retryTimer) {
      this._retryTimer = setInterval(() => {
        if (this.getOutbox().length > 0) this.flushOutbox({ silent: true });
      }, this.RETRY_INTERVAL_MS);
      if (this._retryTimer && this._retryTimer.unref) this._retryTimer.unref();
    }
    if (this.getOutbox().length > 0) setTimeout(() => this.flushOutbox({ silent: true }), 3000);
    // Auto flush when coming back online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateUIStatus();
        this.flushOutbox();
      });
      window.addEventListener('offline', () => {
        this.updateUIStatus();
      });
    }
  },

  getConfig() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.CONFIG);
      if (!raw) return { ...this.DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      // Backwards compatible: a URL saved by older versions is kept as-is.
      return {
        ...this.DEFAULT_CONFIG,
        ...parsed,
        webAppUrl: (parsed.webAppUrl || '').trim(),
        syncToken: (parsed.syncToken || '').trim()
      };
    } catch (e) {
      return { ...this.DEFAULT_CONFIG };
    }
  },

  saveConfig(cfg) {
    const current = this.getConfig();
    const merged = { ...current, ...cfg };
    try {
      localStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(merged));
    } catch (e) {
      console.warn('GoogleSheetSync: Failed to save config', e);
    }
    this.updateUIStatus();
    return merged;
  },

  getOutbox() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.OUTBOX);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  saveOutbox(items) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.OUTBOX, JSON.stringify(items));
    } catch (e) {
      console.warn('GoogleSheetSync: Failed to save outbox', e);
    }
    this.updateUIStatus();
  },

  /**
   * บันทึกคำสั่งซิงค์ลงใน Outbox และส่งขึ้น Google Sheet ทันทีหากเชื่อมต่ออยู่
   */
  enqueue(type, data) {
    const item = {
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type,
      data,
      enqueuedAt: new Date().toISOString(),
      attempts: 0
    };

    const outbox = this.getOutbox();
    outbox.push(item);
    this.saveOutbox(outbox);

    const cfg = this.getConfig();
    const cloudOn = typeof CloudSync !== 'undefined' && CloudSync.isTeacher();
    if (cfg.autoSync && (cfg.webAppUrl || cloudOn) && (typeof navigator === 'undefined' || navigator.onLine)) {
      this.flushOutbox();
    }
    return item;
  },

  /**
   * เคลียร์ Outbox และส่งข้อมูลขึ้น Google Sheets ผ่าน Web App URL
   */
  async flushOutbox(opts = {}) {
    if (this.isFlushing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.updateUIStatus();
      return;
    }
    if (typeof CloudSync !== 'undefined' && CloudSync.isTeacher()) return this._flushCloud(opts);
    const cfg = this.getConfig();
    if (!cfg.webAppUrl) {
      this.updateUIStatus();
      return;
    }

    const outbox = this.getOutbox();
    if (outbox.length === 0) {
      this.updateUIStatus();
      return;
    }

    this.isFlushing = true;
    this.setSyncingBadge(true);

    try {
      const batchPayload = {
        action: 'batch_sync',
        items: outbox,
        sentAt: new Date().toISOString()
      };
      const reply = await this.postJSON(cfg.webAppUrl, batchPayload);

      // Server confirmed: remove only the items that were sent (new ones may have been added meanwhile)
      const sentIds = new Set(outbox.map(it => it.id));
      this.saveOutbox(this.getOutbox().filter(it => !sentIds.has(it.id)));
      this.saveConfig({
        lastSyncAt: new Date().toISOString(),
        syncCount: (cfg.syncCount || 0) + (reply.processed !== undefined ? reply.processed : outbox.length),
        syncStatus: 'synced',
        lastError: ''
      });
      return { success: true };
    } catch (err) {
      console.warn('GoogleSheetSync: flush failed, items kept in outbox for retry', err);
      const kept = this.getOutbox().map(it => ({ ...it, attempts: (it.attempts || 0) + 1 }));
      this.saveOutbox(kept);
      const msg = (err && err.message) ? err.message : String(err);
      this.saveConfig({ syncStatus: 'error', lastError: msg });
      if (!opts.silent || this._lastToastError !== msg) {
        this._lastToastError = msg;
        this.showToast(`⚠️ ส่งข้อมูลเข้า Google Sheet ไม่สำเร็จ (${kept.length} รายการรอส่ง) — ${msg}`, 'error');
      }
      return { success: false, message: msg };
    } finally {
      this.isFlushing = false;
      this.setSyncingBadge(false);
      this.updateUIStatus();
    }
  },

  /**
   * โหมด Cloud: ส่งคิวของครูไปที่ Worker (/api/sync/batch) ทีละ 100 รายการ
   * รายการที่เซิร์ฟเวอร์ตอบกลับแล้ว (applied / archived / duplicate / error) จะถูกนำออกจากคิว
   * ส่วนที่ส่งไม่สำเร็จเพราะเครือข่าย/เซิร์ฟเวอร์ จะคงอยู่ในคิวเพื่อลองใหม่
   */
  async _flushCloud(opts = {}) {
    const outbox = this.getOutbox();
    if (outbox.length === 0) {
      this.updateUIStatus();
      return { success: true };
    }
    this.isFlushing = true;
    this.setSyncingBadge(true);
    try {
      const doneIds = new Set();
      let rejected = 0;
      let lastErr = '';
      for (let i = 0; i < outbox.length; i += 100) {
        const chunk = outbox.slice(i, i + 100);
        const reply = await CloudApi.request('POST', '/api/sync/batch', {
          items: chunk.map(it => ({ id: it.id, type: it.type, data: it.data }))
        });
        (reply.results || []).forEach(r => {
          if (r.id) doneIds.add(r.id);
          if (r.status === 'error') { rejected++; lastErr = r.message || 'error'; }
        });
      }
      this.saveOutbox(this.getOutbox().filter(it => !doneIds.has(it.id)));
      const cfg = this.getConfig();
      this.saveConfig({
        lastSyncAt: new Date().toISOString(),
        syncCount: (cfg.syncCount || 0) + doneIds.size,
        syncStatus: rejected ? 'error' : 'synced',
        lastError: rejected ? `ข้อมูล ${rejected} รายการไม่ผ่านการตรวจสอบ: ${lastErr}` : ''
      });
      return { success: true, rejected };
    } catch (err) {
      console.warn('GoogleSheetSync: cloud flush failed, items kept in outbox', err);
      const kept = this.getOutbox().map(it => ({ ...it, attempts: (it.attempts || 0) + 1 }));
      this.saveOutbox(kept);
      const msg = (err && err.message) ? err.message : String(err);
      this.saveConfig({ syncStatus: 'error', lastError: msg });
      if (!opts.silent || this._lastToastError !== msg) {
        this._lastToastError = msg;
        this.showToast(`⚠️ ส่งข้อมูลขึ้นเซิร์ฟเวอร์ไม่สำเร็จ (${kept.length} รายการรอส่ง) — ${msg}`, 'error');
      }
      return { success: false, message: msg };
    } finally {
      this.isFlushing = false;
      this.setSyncingBadge(false);
      this.updateUIStatus();
    }
  },

  /**
   * ส่ง JSON แบบ text/plain (ไม่เกิด CORS preflight) แล้วอ่านคำตอบจาก Apps Script
   * สำเร็จเฉพาะเมื่อ reply.status === 'success' เท่านั้น
   */
  async postJSON(url, payload) {
    const cfg = this.getConfig();
    const body = JSON.stringify({ ...payload, token: cfg.syncToken || '' });
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow'
      });
    } catch (e) {
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
      throw new Error(offline ? 'ออฟไลน์ จะส่งใหม่อัตโนมัติเมื่อต่อเน็ต' : 'ติดต่อ Web App ไม่ได้ (ตรวจ URL / สิทธิ์ Anyone)');
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let reply;
    try {
      reply = await res.json();
    } catch (e) {
      throw new Error('คำตอบจาก Apps Script ไม่ใช่ JSON (ตรวจ URL ว่าลงท้าย /exec และ deploy เป็น Web app)');
    }
    if (!reply || reply.status !== 'success') {
      const m = reply && reply.message ? reply.message : 'unknown error';
      throw new Error(/unauthorized/i.test(m) ? 'รหัสซิงค์ (Sync Token) ไม่ถูกต้องหรือยังไม่ได้ตั้ง SYNC_TOKEN' : m);
    }
    return reply;
  },

  showToast(message, type = 'info') {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('gs-sync-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gs-sync-toast';
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:92vw;padding:10px 16px;border-radius:10px;font-size:0.9rem;box-shadow:0 6px 20px rgba(0,0,0,.18);cursor:pointer;';
      el.onclick = () => { el.style.display = 'none'; this.openModal(); };
      document.body.appendChild(el);
    }
    const colors = type === 'error' ? ['#fef2f2', '#991b1b', '#fecaca'] : ['#f0fdf4', '#166534', '#bbf7d0'];
    el.style.background = colors[0]; el.style.color = colors[1]; el.style.border = '1px solid ' + colors[2];
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 8000);
  },

  /**
   * ซิงค์บันทึกหลังสอน วก.5
   */
  syncSessionLog(className, period, sessionData) {
    // นศ.ฝึกสอน: ส่งบันทึกหลังสอน + เสนอคะแนนเข้าคิวอนุมัติ (ไม่ใช้รหัสซิงค์ครู)
    if (typeof InternMode !== 'undefined' && InternMode.isActive()) return InternMode.onSessionSaved(className, period, sessionData);
    const instructor = sessionData.instructor || (typeof Store !== 'undefined' ? Store.getInstructor() : {});
    const refl = sessionData.reflection || {};
    
    // Calculate attendance summary
    let present = 0, absent = 0, leave = 0;
    if (sessionData.attendance && typeof sessionData.attendance === 'object') {
      Object.values(sessionData.attendance).forEach(val => {
        if (val === 'present') present++;
        else if (val === 'absent') absent++;
        else if (val === 'leave') leave++;
      });
    }

    return this.enqueue('session_log', {
      className,
      period,
      instructorName: instructor.name || 'นายพงศธร โพธิแก้ว',
      instructorRole: instructor.role || 'ครูประจำวิชา',
      attendanceSummary: { present, absent, leave },
      presentCount: present,
      absentCount: absent,
      leaveCount: leave,
      teachingSummary: refl.outcomes || refl.learningOutcome || '',
      problemIssues: refl.problems || '',
      solutions: refl.solutions || refl.suggestions || '',
      handoverNote: sessionData.handoverNote || '',
      timestamp: sessionData.timestamp || new Date().toISOString()
    });
  },

  /**
   * ซิงค์งานนักเรียน / การวิจารณ์ดนตรี Feldman
   */
  syncSubmission(className, period, studentId, subData) {
    // มือถือนักเรียน (โหมดเซิร์ฟเวอร์): ส่งผ่านโทเค็นนักเรียน ไม่ใช้รหัสซิงค์ของครู ไม่ส่งไฟล์
    if (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive()) {
      // มีไฟล์กำลังอัปโหลด: StudentUpload จะส่งงานพร้อมไฟล์เมื่ออัปโหลดเสร็จ
      if (subData.pendingUploadId) return null;
      return StudentOutbox.enqueue('assignment', StudentOutbox.assignmentKey(className, period), {
        period: Number(period), content: (typeof KalimbaDevices !== 'undefined' ? KalimbaDevices.tagContent(subData.content, className, period, studentId, 5000) : String(subData.content || '').slice(0, 5000)), url: String(subData.url || '').slice(0, 500),
        submissionType: subData.submissionType || 'text', title: subData.songTitle || subData.title || ''
      });
    }
    let studentName = '';
    if (typeof Store !== 'undefined' && Store.getStudentById) {
      const s = Store.getStudentById(studentId);
      if (s) studentName = `${s.prefix}${s.first_name} ${s.last_name}`;
    }

    return this.enqueue('submission', {
      className,
      period,
      studentId,
      studentName,
      submissionType: subData.submissionType || 'งานนักเรียน',
      songTitle: subData.songTitle || subData.title || '',
      content: subData.content || '',
      url: subData.url || '',
      fileName: subData.fileName || '',
      fileBase64: subData.fileBase64 || '',
      mimeType: subData.mimeType || '',
      fileSize: subData.fileSize || 0,
      score: subData.score,
      feedback: subData.feedback || subData.teacherFeedback || ''
    });
  },

  /**
   * ซิงค์คะแนนแบบทดสอบท้ายหน่วย Quiz
   */
  syncQuizResult(quizData) {
    // มือถือนักเรียน: คะแนนต้องตรวจบนเซิร์ฟเวอร์เท่านั้น (ServerQuiz) ไม่ส่งคะแนนที่คิดในเครื่อง
    if (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive()) return null;
    return this.enqueue('quiz_result', {
      unitNo: quizData.unitNo || 1,
      unitTitle: quizData.unitTitle || `หน่วยการเรียนรู้ที่ ${quizData.unitNo || 1}`,
      studentId: quizData.studentId || '',
      studentName: quizData.studentName || '',
      studentClass: quizData.studentClass || '',
      studentNo: quizData.studentNo || '',
      score: quizData.score !== undefined ? quizData.score : 0,
      totalQuestions: quizData.totalQuestions || 20,
      percentage: quizData.percentage !== undefined ? quizData.percentage : 0,
      timeSpentSeconds: quizData.timeSpentSeconds || 0
    });
  },

  /**
   * ซิงค์คะแนนรูบริกปฏิบัติคาลิมบ้า 4 ด้าน
   */
  syncRubric(studentId, period, rubricData, className) {
    let studentName = '';
    let stClass = className || '';
    if (typeof Store !== 'undefined' && Store.getStudentById) {
      const s = Store.getStudentById(studentId);
      if (s) {
        studentName = `${s.prefix}${s.first_name} ${s.last_name}`;
        if (!stClass) stClass = s.class;
      }
    }

    return this.enqueue('rubric', {
      className: stClass,
      period,
      studentId,
      studentName,
      breakdown: rubricData.breakdown || {},
      sum: rubricData.sum !== undefined ? rubricData.sum : 0,
      scaledScore: rubricData.scaledScore !== undefined ? rubricData.scaledScore : 0,
      rubricData: rubricData && typeof rubricData === 'object' ? rubricData : {}
    });
  },

  /**
   * ซิงค์การมอบหมายคาบสอน & คำแนะนำนิเทศ นศ.ฝึกสอน
   */
  syncAssignment(day, periodNo, assignmentData) {
    return this.enqueue('assignment', {
      day,
      periodNo,
      className: assignmentData.className || '',
      teacherName: assignmentData.teacherName || '',
      assignRole: assignmentData.assignRole || 'trainee',
      mentorName: assignmentData.mentorName || 'นายพงศธร โพธิแก้ว',
      mentorAdvice: assignmentData.mentorAdvice || '',
      teachingMethod: assignmentData.teachingMethod || '',
      focusPoints: assignmentData.focusPoints || '',
      traineeFeedback: assignmentData.traineeFeedback || ''
    });
  },

  /**
   * ซิงค์แผนการสอนและหลักสูตรที่ครูปรับแต่งเข้าสู่ Google Sheet (แท็บ แผนการสอน_Curriculum)
   */
  syncCurriculumLesson(grade, period, lessonData) {
    const instructor = typeof Store !== 'undefined' ? Store.getInstructor() : {};
    const kpa = lessonData.kpa || {};
    const steps = lessonData.steps || [];
    const stepsSummary = steps.map(s => `[${s.phase || ''} (${s.duration || s.time_min || 10}น.)] ${s.desc || ''}`).join('\n');

    return this.enqueue('curriculum_lesson', {
      grade,
      period: Number(period),
      topic: lessonData.topic || '',
      unitName: lessonData.unit_name || lessonData.unitName || '',
      kpaSummary: `K: ${kpa.k || '-'} | P: ${kpa.p || '-'} | A: ${kpa.a || '-'}`,
      durationMin: Number(lessonData.duration_min || lessonData.durationMin || 50),
      stepsSummary: stepsSummary,
      mediaCount: Array.isArray(lessonData.media) ? lessonData.media.length : 0,
      updatedBy: instructor.name || 'คุณครูผู้สอน',
      timestamp: new Date().toISOString(),
      lessonData: lessonData && typeof lessonData === 'object' ? lessonData : {}
    });
  },

  /**
   * ซิงค์คะแนนวิจัยชั้นเรียน CAR (Pre-test / Post-test)
   */
  syncResearch(className, studentId, pre, post, formative) {
    let studentName = '';
    if (typeof Store !== 'undefined' && Store.getStudentById) {
      const s = Store.getStudentById(studentId);
      if (s) studentName = `${s.prefix}${s.first_name} ${s.last_name}`;
    }

    const preNum = Number(pre || 0);
    const postNum = Number(post || 0);
    const gain = Number((postNum - preNum).toFixed(2));

    return this.enqueue('research_car', {
      className,
      studentId,
      studentName,
      pre: preNum,
      post: postNum,
      formative: Number(formative || 0),
      gain
    });
  },

  /**
   * ซิงค์ข้อมูลทั้งหมดที่มีอยู่ในเครื่องขึ้น Google Sheets (Full Sync)
   */
  async fullSyncAll() {
    if (typeof Store === 'undefined') return { success: false, message: 'Store unavailable' };

    let enqueuedTotal = 0;

    // 1. All Sessions (วก.5)
    const sessions = Store.getAllSessions ? Store.getAllSessions() : {};
    Object.keys(sessions).forEach(k => {
      const sess = sessions[k];
      if (sess && sess.className && sess.period) {
        this.syncSessionLog(sess.className, sess.period, sess);
        enqueuedTotal++;
      }
    });

    // 2. All Submissions
    const submissions = Store.getAllSubmissions ? Store.getAllSubmissions() : {};
    Object.keys(submissions).forEach(k => {
      const sub = submissions[k];
      if (sub && sub.studentId) {
        this.syncSubmission(sub.className || '', sub.period || '', sub.studentId, sub);
        enqueuedTotal++;
      }
    });

    // 3. All Schedule Assignments
    const assignments = Store.getScheduleAssignments ? Store.getScheduleAssignments() : {};
    Object.keys(assignments).forEach(k => {
      const a = assignments[k];
      if (a && a.day && a.periodNo) {
        this.syncAssignment(a.day, a.periodNo, a);
        enqueuedTotal++;
      }
    });

    // 4. All Custom Lessons (Curriculum updates)
    if (typeof Store !== 'undefined' && Store.getCustomLessons) {
      ['M1', 'M2'].forEach(grade => {
        const customLessons = Store.getCustomLessons(grade) || {};
        Object.keys(customLessons).forEach(p => {
          const l = customLessons[p];
          if (l) {
            this.syncCurriculumLesson(grade, p, l);
            enqueuedTotal++;
          }
        });
      });
    }

    // Flush outbox and wait for transmission
    const flushRes = await this.flushOutbox();
    if (enqueuedTotal > 0 && flushRes && flushRes.success === false) {
      throw new Error(flushRes.message + ' (ข้อมูลยังอยู่ในคิว จะส่งใหม่อัตโนมัติ)');
    }

    return {
      success: true,
      enqueuedTotal,
      message: enqueuedTotal > 0
        ? `✅ ซิงค์สำเร็จ! นำส่งข้อมูลทั้งหมด ${enqueuedTotal} รายการขึ้น Google Sheets เรียบร้อยแล้ว`
        : `ℹ️ ในเครื่องนี้ยังไม่มีบันทึกข้อมูลใหม่ (หากบันทึกไว้ในอุปกรณ์อื่น กรุณากด Full Sync บนอุปกรณ์นั้น หรือทดลองบันทึก วก.5 ในห้องเรียน ข้อมูลจะวิ่งเข้าชีตทันทีครับ)`
    };
  },

  EXPECTED_GAS_VERSION: '2026.10.29-2',

  /**
   * เวอร์ชันโค้ด Apps Script ที่แอปนี้คาดหวัง — ซิงค์จาก google_apps_script.js (และเทมเพลตใน data/gas_template.js)
   * จึงเป็นแหล่งเดียวกับไฟล์จริงเสมอ ไม่ต้องจำแก้สองที่
   */
  expectedGasVersion() {
    if (this.EXPECTED_GAS_VERSION) return this.EXPECTED_GAS_VERSION;
    const m = /var GAS_VERSION = '([^']+)'/.exec(this.APPS_SCRIPT_CODE || '');
    return m ? m[1] : '';
  },

  /** เทียบเวอร์ชันที่ GAS รายงาน (reply.gasVersion) กับที่แอปคาดหวัง; ไม่รายงาน = โค้ดเก่า */
  evaluateGasVersion(reply) {
    const expected = this.expectedGasVersion();
    const actual = (reply && reply.gasVersion) ? String(reply.gasVersion) : '';
    if (!expected) return { ok: true, expected, actual, message: '' };
    if (actual === expected) return { ok: true, expected, actual, message: 'Apps Script เป็นเวอร์ชันล่าสุด (' + actual + ')' };
    return {
      ok: false, expected, actual,
      message: 'ต้องอัปเดต GAS — Apps Script ที่ deploy อยู่เป็นเวอร์ชัน ' + (actual || 'เก่า (ไม่รายงานเวอร์ชัน)') + ' แต่แอปต้องการ ' + expected + ' (วางโค้ดใหม่ด้วยปุ่มคัดลอก แล้ว Deploy → Manage deployments → New version หรือใช้ auto-deploy ตาม docs/GAS_AUTODEPLOY_TH.md)'
    };
  },

  /** ตรวจเวอร์ชัน GAS เงียบ ๆ (เมื่อมี URL + ออนไลน์) — เรียกตอนครูเปิดหน้าต่างซิงค์ ไม่ throw */
  async checkGasVersion() {
    try {
      const cfg = this.getConfig();
      if (!cfg.webAppUrl || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
      const r = await this.testConnection(cfg.webAppUrl);
      return r;
    } catch (e) { return null; }
  },

  /**
   * ทดสอบการเชื่อมต่อ URL Web App ของ Google Sheets
   */
  async testConnection(testUrl) {
    const url = (testUrl || this.getConfig().webAppUrl || '').trim();
    if (!url) {
      return { success: false, message: 'กรุณาระบุ URL ของ Google Apps Script Web App ก่อนทดสอบ' };
    }

    try {
      const payload = {
        action: 'ping',
        sentAt: new Date().toISOString()
      };

      this.saveConfig({ webAppUrl: url });
      const reply = await this.postJSON(url, payload);
      const ver = this.evaluateGasVersion(reply);
      this.saveConfig({ syncStatus: 'synced', lastError: '', gasVersion: ver.actual, gasOutdated: !ver.ok });
      return { success: true, gasOutdated: !ver.ok, gasVersion: ver.actual, expectedGasVersion: ver.expected, message: (reply.message || 'เชื่อมต่อกับ Google Apps Script สำเร็จ') + (ver.ok ? '' : ' — ' + ver.message) };
    } catch (e) {
      return { success: false, message: e.message || 'ไม่สามารถติดต่อ Web App ได้' };
    }
  },

  /**
   * อัปเดตการแสดงผลป้ายสถานะในหน้าจอต่างๆ
   */
  updateUIStatus() {
    if (typeof document === 'undefined') return;

    const cfg = this.getConfig();
    const outbox = this.getOutbox();
    const pendingCount = outbox.length;
    const isOnline = (typeof navigator === 'undefined' || navigator.onLine);

    // 1. Cockpit Bottom Bar Badge
    const cockpitBadge = document.getElementById('cockpit-sync-badge');
    if (cockpitBadge) {
      if (!cfg.webAppUrl) {
        cockpitBadge.innerHTML = `
          <span style="color: #059669;">💾 บันทึกในเครื่อง (Local)</span>
          <button class="btn-preset-chip" style="font-size: 0.72rem; padding: 2px 8px; margin-left: 6px; background: #fef3c7; color: #b45309; border-color: #fde68a;" onclick="GoogleSheetSync.openModal()">
            + เชื่อม Google Sheets
          </button>
        `;
      } else if (pendingCount > 0) {
        cockpitBadge.innerHTML = `
          <span style="color: #059669;">💾 ในเครื่อง</span>
          <span style="color: #d97706; font-size: 0.8rem; margin-left: 6px; cursor: pointer;" onclick="GoogleSheetSync.openModal()">
            ⏳ รอส่งเข้าชีต (${pendingCount})
          </span>
        `;
      } else {
        cockpitBadge.innerHTML = `
          <span style="color: #059669; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            บันทึกพร้อมกัน: ในเครื่อง + Google Sheets
          </span>
        `;
      }
    }

    // 2. Header Status Pill
    const headerPill = document.getElementById('btn-google-sheets-pill');
    if (headerPill) {
      if (!cfg.webAppUrl) {
        headerPill.innerHTML = `📊 เชื่อมต่อ Google Sheet`;
        headerPill.style.borderColor = '#cbd5e1';
        headerPill.style.color = '#475569';
        headerPill.style.background = '#f8fafc';
      } else if (cfg.syncStatus === 'error' && pendingCount > 0) {
        headerPill.innerHTML = `⚠️ ซิงค์ไม่สำเร็จ (${pendingCount})`;
        headerPill.title = cfg.lastError || '';
        headerPill.style.borderColor = '#fecaca';
        headerPill.style.color = '#991b1b';
        headerPill.style.background = '#fef2f2';
      } else if (cfg.gasOutdated) {
        headerPill.innerHTML = `⚠️ ต้องอัปเดต GAS`;
        headerPill.title = 'โค้ด Apps Script ที่ deploy อยู่ไม่ตรงกับแอป (เวอร์ชัน ' + (cfg.gasVersion || 'เก่า') + ') — เปิดหน้าต่างซิงค์เพื่อดูวิธีอัปเดต';
        headerPill.style.borderColor = '#fed7aa';
        headerPill.style.color = '#9a3412';
        headerPill.style.background = '#fff7ed';
      } else if (pendingCount > 0) {
        headerPill.innerHTML = `⏳ Google Sheet (${pendingCount})`;
        headerPill.style.borderColor = '#fde68a';
        headerPill.style.color = '#b45309';
        headerPill.style.background = '#fefce8';
      } else {
        headerPill.innerHTML = `🟢 Google Sheet ซิงค์คู่แล้ว`;
        headerPill.style.borderColor = '#bbf7d0';
        headerPill.style.color = '#15803d';
        headerPill.style.background = '#f0fdf4';
      }
    }

    // 3. Modal Form fields
    const urlInput = document.getElementById('gs-webapp-url');
    if (urlInput && document.activeElement !== urlInput) {
      urlInput.value = cfg.webAppUrl || '';
    }
    const tokenInput = document.getElementById('gs-sync-token');
    if (tokenInput && document.activeElement !== tokenInput) {
      tokenInput.value = cfg.syncToken || '';
    }

    const modalStatus = document.getElementById('gs-sync-modal-status');
    if (modalStatus) {
      const lastSyncStr = cfg.lastSyncAt ? new Date(cfg.lastSyncAt).toLocaleString('th-TH') : 'ยังไม่มีการซิงค์';
      modalStatus.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.65rem 0.85rem;">
            <div style="font-size: 0.75rem; color: #64748b;">สถานะการเชื่อมต่อ:</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: ${cfg.webAppUrl ? '#15803d' : '#94a3b8'};">
              ${cfg.webAppUrl ? (isOnline ? '🟢 เชื่อมต่อพร้อมบันทึกคู่' : '🟡 ออฟไลน์ (รอต่อเน็ต)') : '⚪ ยังไม่ได้ตั้งค่า URL'}
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.65rem 0.85rem;">
            <div style="font-size: 0.75rem; color: #64748b;">รายการที่บันทึกลงชีตแล้ว:</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: #0284c7;">
              ${cfg.syncCount || 0} รายการ
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.65rem 0.85rem;">
            <div style="font-size: 0.75rem; color: #64748b;">รอส่งขึ้นชีต (Pending):</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: ${pendingCount > 0 ? '#b45309' : '#64748b'};">
              ${pendingCount} รายการ
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.65rem 0.85rem;">
            <div style="font-size: 0.75rem; color: #64748b;">ซิงค์ล่าสุดเมื่อ:</div>
            <div style="font-weight: 600; font-size: 0.85rem; color: #334155;">
              ${lastSyncStr}
            </div>
          </div>
        </div>
      `;
    }
  },

  setSyncingBadge(isSyncing) {
    if (typeof document === 'undefined') return;
    const pill = document.getElementById('btn-google-sheets-pill');
    if (pill && isSyncing) {
      pill.innerHTML = `🔄 กำลังส่งข้อมูลเข้า Google Sheet...`;
      pill.style.background = '#eff6ff';
      pill.style.borderColor = '#bfdbfe';
      pill.style.color = '#1d4ed8';
    }
  },

  openModal() {
    const modal = document.getElementById('modal-google-sheet-sync');
    if (!modal) return;
    const box = document.getElementById('gs-sync-result-box');
    if (box) box.style.display = 'none';
    this.updateUIStatus();
    modal.classList.add('active');
    if (!this._gasChecked) { this._gasChecked = true; this.checkGasVersion(); }
  },

  closeModal() {
    const modal = document.getElementById('modal-google-sheet-sync');
    if (modal) modal.classList.remove('active');
  },

  showSyncModalBanner(message, type = 'info') {
    const box = document.getElementById('gs-sync-result-box');
    if (!box) return;
    box.style.display = 'block';

    let bg = '#eff6ff', border = '#bfdbfe', color = '#1e40af';
    if (type === 'success') {
      bg = '#f0fdf4'; border = '#bbf7d0'; color = '#166534';
    } else if (type === 'warning') {
      bg = '#fffbeb'; border = '#fde68a'; color = '#92400e';
    } else if (type === 'error') {
      bg = '#fef2f2'; border = '#fecaca'; color = '#991b1b';
    }

    box.style.background = bg;
    box.style.border = `1px solid ${border}`;
    box.style.color = color;
    box.innerHTML = message;
  },

  readTokenFromModal() {
    const t = document.getElementById('gs-sync-token');
    if (t) this.saveConfig({ syncToken: t.value.trim() });
  },

  saveSettingsFromModal() {
    this.readTokenFromModal();
    const urlInput = document.getElementById('gs-webapp-url');
    if (!urlInput) return;
    const url = urlInput.value.trim();
    this.saveConfig({ webAppUrl: url });
    if (url) {
      this.showSyncModalBanner('⏳ กำลังทดสอบเชื่อมต่อ URL และบันทึกการตั้งค่า...', 'info');
      this.testConnection(url).then(res => {
        if (res.success) {
          this.showSyncModalBanner(`✅ ${res.message}`, 'success');
          this.flushOutbox();
        } else {
          this.showSyncModalBanner(`⚠️ ${res.message}`, 'warning');
        }
      });
    } else {
      this.showSyncModalBanner('💾 บันทึกการตั้งค่าแล้ว (ยังไม่ได้เปิดใช้ Google Sheet Sync)', 'info');
    }
  },

  async handleTestFromModal() {
    this.readTokenFromModal();
    const urlInput = document.getElementById('gs-webapp-url');
    const url = urlInput ? urlInput.value.trim() : '';
    const btn = document.getElementById('btn-gs-test');
    if (btn) btn.disabled = true;

    this.showSyncModalBanner('⏳ กำลังทดสอบส่งสัญญาณ Ping ไปยัง Google Apps Script...', 'info');

    try {
      const res = await this.testConnection(url);
      if (res.success) {
        this.showSyncModalBanner(`✅ ${res.message}`, 'success');
      } else {
        this.showSyncModalBanner(`❌ ${res.message}`, 'error');
      }
    } catch (e) {
      this.showSyncModalBanner(`❌ เกิดข้อผิดพลาด: ${e.toString()}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
      this.updateUIStatus();
    }
  },

  /**
   * ส่งข้อมูลทดสอบ 1 แถวขึ้น Google Sheet ทันทีเพื่อให้ครูเห็นผลลัพธ์ในชีตจริง
   */
  async handleSendTestRowFromModal() {
    this.readTokenFromModal();
    const urlInput = document.getElementById('gs-webapp-url');
    const inputUrl = urlInput ? urlInput.value.trim() : '';
    let cfg = this.getConfig();
    if (inputUrl && inputUrl !== cfg.webAppUrl) {
      cfg = this.saveConfig({ webAppUrl: inputUrl });
    }

    if (!cfg.webAppUrl) {
      this.showSyncModalBanner('⚠️ กรุณาระบุ URL ของ Google Apps Script ก่อนทดสอบส่งข้อมูล', 'warning');
      return;
    }

    const testBtn = document.getElementById('btn-gs-send-test');
    const origText = testBtn ? testBtn.innerHTML : '';
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML = '🔄 กำลังส่งข้อมูลทดสอบ...';
    }

    this.showSyncModalBanner('⏳ กำลังส่งข้อมูลทดสอบ 1 แถวขึ้น Google Sheets...', 'info');

    try {
      const now = new Date();
      const testItem = {
        type: 'session_log',
        data: {
          className: 'ทดสอบระบบ (PPK)',
          period: 1,
          instructorName: 'นายพงศธร โพธิแก้ว (ทดสอบ)',
          instructorRole: 'ครูประจำวิชา',
          attendanceSummary: { present: 40, absent: 0, leave: 0 },
          presentCount: 40,
          absentCount: 0,
          leaveCount: 0,
          teachingSummary: 'ทดสอบการเชื่อมต่อระบบบันทึกคู่ขนาน MusicSmart PPK -> Google Sheets สำเร็จสมบูรณ์',
          problemIssues: 'ไม่มีปัญหา',
          solutions: 'ระบบทำงานสมบูรณ์ 100%',
          handoverNote: 'ทดสอบส่งแถวแรกเข้า Google Sheet',
          timestamp: now.toISOString()
        }
      };

      const payload = {
        action: 'batch_sync',
        items: [testItem],
        sentAt: now.toISOString()
      };

      await this.postJSON(cfg.webAppUrl, payload);

      this.saveConfig({
        lastSyncAt: now.toISOString(),
        syncCount: (cfg.syncCount || 0) + 1,
        syncStatus: 'synced'
      });

      this.updateUIStatus();
      this.showSyncModalBanner('✅ ส่งแถวทดสอบเข้า Google Sheet สำเร็จเรียบร้อยแล้ว! 📊 คุณครูสามารถเปิด Google Sheet ดูที่แท็บ <strong>"วก5_บันทึกหลังสอน"</strong> จะพบแถวทดสอบปรากฏทันทีครับ', 'success');
    } catch (e) {
      this.showSyncModalBanner('❌ เกิดข้อผิดพลาดในการส่งข้อมูลทดสอบ: ' + e.toString(), 'error');
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML = origText || '🧪 ส่งข้อมูลทดสอบ 1 แถวขึ้นชีต';
      }
    }
  },

  async handleFullSyncFromModal() {
    this.readTokenFromModal();
    const urlInput = document.getElementById('gs-webapp-url');
    const inputUrl = urlInput ? urlInput.value.trim() : '';
    let cfg = this.getConfig();
    if (inputUrl && inputUrl !== cfg.webAppUrl) {
      cfg = this.saveConfig({ webAppUrl: inputUrl });
    }

    if (!cfg.webAppUrl) {
      this.showSyncModalBanner('⚠️ กรุณาระบุและบันทึก URL ของ Google Apps Script ก่อนทำการซิงค์ทั้งหมด', 'warning');
      return;
    }

    const btn = document.getElementById('btn-gs-fullsync');
    const origText = btn ? btn.innerHTML : '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '🔄 กำลังส่งข้อมูลขึ้นชีต...';
    }
    this.showSyncModalBanner('🔄 กำลังสแกนข้อมูลในเครื่องและส่งขึ้น Google Sheet...', 'info');

    try {
      const res = await this.fullSyncAll();
      this.updateUIStatus();

      if (res.enqueuedTotal > 0) {
        this.showSyncModalBanner(`✅ <strong>ซิงค์สำเร็จ!</strong> นำส่งข้อมูลทั้งหมด ${res.enqueuedTotal} รายการขึ้น Google Sheets เรียบร้อยแล้ว สามารถเปิดตรวจดูในไฟล์ Google Sheets ได้เลยครับ`, 'success');
      } else {
        this.showSyncModalBanner(`ℹ️ <strong>ในอุปกรณ์/เบราว์เซอร์นี้ยังไม่มีบันทึกคาบสอนเดิม (0 รายการ)</strong><br>แต่ระบบเชื่อมต่อ Google Sheet พร้อมแล้ว 100% ทุกครั้งที่คุณครูกด <em>"บันทึกข้อมูลและปิดคาบ (วก.5)"</em> หรือนักเรียนส่งงาน ข้อมูลจะวิ่งเข้าชีตทันทีครับ!<br><div style="margin-top: 6px;">💡 หรือคุณครูสามารถกดปุ่ม <strong>"🧪 ส่งข้อมูลทดสอบ 1 แถวขึ้นชีต"</strong> ด้านบนเพื่อทดสอบดูผลลัพธ์ในชีตจริงได้ทันทีครับ</div>`, 'info');
      }
    } catch (err) {
      this.showSyncModalBanner('❌ เกิดข้อผิดพลาดในการซิงค์: ' + err.toString(), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText || '🚀 ซิงค์ทั้งหมดตอนนี้';
      }
      this.updateUIStatus();
    }
  },

  _notifyUser(message, type = 'info') {
    if (typeof UiDialogs !== 'undefined' && typeof UiDialogs.toast === 'function') {
      UiDialogs.toast(message, type);
    } else if (typeof alert === 'function') {
      alert(message);
    }
  },

  ensureAppsScriptTemplate() {
    const cur = this.APPS_SCRIPT_CODE;
    if (cur) return Promise.resolve(cur);
    if (this._gasTemplatePromise) return this._gasTemplatePromise;
    if (typeof document === 'undefined' || !document.createElement) return Promise.resolve('');
    this._gasTemplatePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'data/gas_template.js?v=20261119_02';
      s.async = true;
      s.onload = () => resolve((typeof window !== 'undefined' && window.MUSICSMART_GAS_TEMPLATE) || '');
      s.onerror = () => {
        this._gasTemplatePromise = null;
        reject(new Error('ไม่สามารถโหลดเทมเพลต Google Apps Script ได้'));
      };
      (document.head || document.body).appendChild(s);
    });
    return this._gasTemplatePromise;
  },

  async copyAppsScriptCode() {
    let code = '';
    try {
      code = await this.ensureAppsScriptTemplate();
    } catch (e) {
      this._notifyUser('❌ ' + (e && e.message ? e.message : 'โหลดเทมเพลตไม่สำเร็จ'), 'error');
      return;
    }
    if (!code) {
      this._notifyUser('❌ ไม่พบเทมเพลต Google Apps Script', 'error');
      return;
    }
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        this._notifyUser('📋 คัดลอกโค้ด Google Apps Script เรียบร้อยแล้ว! นำไปวางใน Extensions -> Apps Script ได้ทันที', 'success');
      }).catch(() => {
        this.fallbackCopyText(code);
      });
    } else {
      this.fallbackCopyText(code);
    }
  },

  fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this._notifyUser('📋 คัดลอกโค้ด Google Apps Script เรียบร้อยแล้ว! นำไปวางใน Extensions -> Apps Script ได้ทันที', 'success');
    } catch (e) {
      this._notifyUser('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกจากกล่องข้อความ', 'warning');
    }
    document.body.removeChild(ta);
  },

  // Lazy-loaded from app/data/gas_template.js in browser, or required directly in Node tests
  get APPS_SCRIPT_CODE() {
    if (typeof window !== 'undefined' && window.MUSICSMART_GAS_TEMPLATE) {
      return window.MUSICSMART_GAS_TEMPLATE;
    }
    if (typeof globalThis !== 'undefined' && globalThis.MUSICSMART_GAS_TEMPLATE) {
      return globalThis.MUSICSMART_GAS_TEMPLATE;
    }
    if (typeof require === 'function') {
      try {
        return require('../data/gas_template.js');
      } catch (e) {
        return '';
      }
    }
    return '';
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSheetSync;
}
