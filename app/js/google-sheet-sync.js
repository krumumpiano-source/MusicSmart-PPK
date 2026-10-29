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
    if (cfg.autoSync && cfg.webAppUrl && (typeof navigator === 'undefined' || navigator.onLine)) {
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
      scaledScore: rubricData.scaledScore !== undefined ? rubricData.scaledScore : 0
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
      timestamp: new Date().toISOString()
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

  /**
   * เวอร์ชันโค้ด Apps Script ที่แอปนี้คาดหวัง — อ่านจากเทมเพลต APPS_SCRIPT_CODE (ซึ่งซิงค์จาก google_apps_script.js)
   * จึงเป็นแหล่งเดียวกับไฟล์จริงเสมอ ไม่ต้องจำแก้สองที่
   */
  expectedGasVersion() {
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

  copyAppsScriptCode() {
    const code = this.APPS_SCRIPT_CODE;
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        alert('📋 คัดลอกโค้ด Google Apps Script เรียบร้อยแล้ว!\nนำไปวางใน Extensions -> Apps Script บน Google Sheet ของคุณได้ทันที');
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
      alert('📋 คัดลอกโค้ด Google Apps Script เรียบร้อยแล้ว!\nนำไปวางใน Extensions -> Apps Script บน Google Sheet ของคุณได้ทันที');
    } catch (e) {
      alert('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกจากกล่องข้อความ');
    }
    document.body.removeChild(ta);
  },

  // Google Apps Script source code template for 1-click copy
  APPS_SCRIPT_CODE: `/**
 * ============================================================================
 * MusicSmart PPK - Google Apps Script Backend (Serverless Dual-Save Engine)
 * ระบบคลาวด์รับข้อมูลการสอน บันทึกหลังสอน (วก.5) งานนักเรียน และคะแนนอัตโนมัติ
 * โรงเรียนพะเยาพิทยาคม • กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)
 * ============================================================================
 * 
 * วิธีการติดตั้ง (ครั้งเดียว 1 นาที):
 * 1. เปิด Google Sheet เปล่าขึ้นมา 1 ไฟล์ ตั้งชื่อว่า "MusicSmart_Data_PPK"
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) -> "Apps Script"
 * 3. ลบโค้ดเดิมทั้งหมดในนั้น แล้ววางโค้ดไฟล์นี้ลงไปทั้งหมด
 * 4. กดปุ่มบันทึก (ไอคอนแผ่นดิสก์ 💾)
 * 5. กดปุ่มสีน้ำเงินด้านขวาบน "ทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้ใหม่" (New deployment)
 *    - เลือกประเภท: "เว็บแอป" (Web app)
 *    - คำอธิบาย: "MusicSmart Sync v1"
 *    - ดำเนินการในฐานะ: "ฉัน" (Me)
 *    - ผู้มีสิทธิ์เข้าถึง: "ทุกคน" (Anyone) **สำคัญมาก ต้องเลือก Anyone**
 * 6. กด "ทำให้ใช้งานได้" (Deploy) และให้สิทธิ์อนุญาตเข้าถึง Google Sheet
 * 7. คัดลอก "URL เว็บแอป" (ขึ้นต้นด้วย https://script.google.com/macros/s/.../exec)
 *    นำไปวางในหน้าต่าง "ซิงค์คู่ Google Sheets" ของระบบ MusicSmart
 * 8. ความปลอดภัย (จำเป็น): ไปที่ ⚙️ การตั้งค่าโปรเจกต์ (Project Settings) -> คุณสมบัติของสคริปต์
 *    (Script Properties) -> เพิ่ม SYNC_TOKEN = ข้อความสุ่มยาว ๆ (เช่น 32 ตัวอักษรขึ้นไป)
 *    แล้วนำค่าเดียวกันไปใส่ช่อง "รหัสซิงค์ (Sync Token)" ในหน้าต่างซิงค์ของ MusicSmart
 *    คำขอที่ไม่มี token ถูกต้องจะถูกปฏิเสธ (unauthorized) ทุกครั้ง
 *    หลังแก้โค้ดทุกครั้ง: Deploy -> Manage deployments -> แก้ไข -> Version: New version
 * 9. ระบบเข้าสู่ระบบนักเรียน: ครูกดปุ่ม "อัปโหลดรายชื่อขึ้น Google Sheet" (จัดการผู้ใช้ > นักเรียน)
 *    1 ครั้งต่อภาคเรียน ระบบจะสร้างชีต "นักเรียน_Students_Auth" เก็บรายชื่อและ PIN แบบแฮช (SHA-256 + salt)
 *    นักเรียนใช้ action studentLookup / studentSetPin / studentLogin ได้โดยไม่ต้องมี token
 *    แต่จะได้ข้อมูลเฉพาะของตัวเองเท่านั้น (รหัส ชื่อ ห้อง) ไม่มีทางดึงรายชื่อทั้งหมดได้
 * ============================================================================
 */

// เวอร์ชันโค้ดฝั่ง Apps Script — แอปเทียบค่านี้กับค่าที่แอปคาดหวัง (ผ่าน action 'ping')
// ถ้าไม่ตรง/ไม่มี แอปจะแจ้งครูว่า "ต้องอัปเดต GAS". ⚠ เปลี่ยนค่านี้ทุกครั้งที่แก้โค้ดไฟล์นี้ (รูปแบบ ปี.เดือน.วัน-ลำดับ)
// แล้วรัน: python tools/sync_apps_script_template.py  (ให้ปุ่ม 1-Click Copy ในแอปตรงกัน) — ดู docs/GAS_AUTODEPLOY_TH.md
var GAS_VERSION = '2026.10.29-2';

function doPost(e) {
  // อัปโหลดชิ้นไฟล์นักเรียน: ไม่ต้องรอ Lock รวม (แต่ละชิ้นเขียนไฟล์ของตัวเอง)
  var rawPeek = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
  if (/"action"\\s*:\\s*"studentUpload/.test(rawPeek.slice(0, 1000))) {
    if (rawPeek.length > UPLOAD_MAX_BODY) return jsonOut({ status: 'error', code: 'too_large', message: 'ชิ้นข้อมูลใหญ่เกินไป' });
    var up = null;
    try { up = JSON.parse(rawPeek); } catch (pe) { up = null; }
    if (up && UPLOAD_ACTIONS.indexOf(up.action) !== -1) {
      if (up.action === 'studentUploadChunk') return jsonOut(handleUploadAction(SpreadsheetApp.getActiveSpreadsheet(), up));
      var ulock = LockService.getScriptLock();
      var ugot = ulock.tryLock(20000);
      if (!ugot) return jsonOut({ status: 'error', message: 'ระบบกำลังยุ่ง ลองใหม่อีกครั้ง' });
      try { return jsonOut(handleUploadAction(SpreadsheetApp.getActiveSpreadsheet(), up)); } finally { if (ugot) ulock.releaseLock(); }
    }
  }
  var lock = LockService.getScriptLock();
  // รอ Lock สูงสุด 20 วินาทีเพื่อป้องกันการเขียนข้อมูลชนกันพร้อมกัน
  var gotLock = lock.tryLock(20000);
  if (!gotLock) return jsonOut({ status: 'error', message: 'ระบบกำลังยุ่ง ลองใหม่อีกครั้ง' });
  try {
    var rawText = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawText);

    // 0a. ระบบเข้าสู่ระบบของนักเรียน (ไม่ใช้ SYNC_TOKEN แต่เปิดเผยเฉพาะข้อมูลของนักเรียนคนนั้น)
    if (payload && STUDENT_PUBLIC_ACTIONS.indexOf(payload.action) !== -1) {
      if (rawText.length > STUDENT_MAX_BODY) return jsonOut({ status: 'error', code: 'too_large', message: 'ข้อมูลใหญ่เกินไป' });
      return jsonOut(handleStudentPublicAction(SpreadsheetApp.getActiveSpreadsheet(), payload));
    }

    // 0a2. ครูเข้าสู่ระบบด้วยรหัสผ่าน (ตรวจบนเซิร์ฟเวอร์)
    if (payload && TEACHER_PUBLIC_ACTIONS.indexOf(payload.action) !== -1) {
      if (rawText.length > STUDENT_MAX_BODY) return jsonOut({ status: 'error', code: 'too_large', message: 'ข้อมูลใหญ่เกินไป' });
      return jsonOut(handleTeacherPublicAction(payload));
    }

    // 0a3. ลืมรหัสผ่าน/PIN: ขอรหัสยืนยันทางอีเมล หรือขอให้ครูรีเซ็ต แล้วตั้งรหัสใหม่ด้วยรหัสยืนยัน
    if (payload && PASSWORD_RESET_PUBLIC_ACTIONS.indexOf(payload.action) !== -1) {
      if (rawText.length > STUDENT_MAX_BODY) return jsonOut({ status: 'error', code: 'too_large', message: 'ข้อมูลใหญ่เกินไป' });
      return jsonOut(handlePasswordResetPublic_(SpreadsheetApp.getActiveSpreadsheet(), payload));
    }

    // 0b. นักศึกษาฝึกสอน (ใช้โทเค็น นศ. ที่จำกัดเฉพาะห้องที่ได้รับมอบหมาย)
    if (payload && INTERN_PUBLIC_ACTIONS.indexOf(payload.action) !== -1) {
      if (rawText.length > STUDENT_MAX_BODY) return jsonOut({ status: 'error', code: 'too_large', message: 'ข้อมูลใหญ่เกินไป' });
      return jsonOut(handleInternAction(SpreadsheetApp.getActiveSpreadsheet(), payload));
    }

    // 0. ตรวจสอบรหัสซิงค์ (SYNC_TOKEN ใน Script Properties)
    var expectedToken = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (!expectedToken || !payload || payload.token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: expectedToken ? 'unauthorized' : 'unauthorized: SYNC_TOKEN not configured in Script Properties'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var action = payload.action || 'sync';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ตรวจสอบการเชื่อมต่อ (Ping Test)
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'เชื่อมต่อ Google Sheet สำเร็จ: ' + ss.getName(),
        gasVersion: GAS_VERSION,
        serverTime: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1b. ครูอัปโหลดรายชื่อนักเรียน / รีเซ็ต PIN / ดูสถานะ PIN (ต้องมี token)
    if (action === 'upload_roster') return jsonOut(uploadStudentRoster(ss, payload.students || [], !!payload.replace));
    if (action === 'download_roster') return jsonOut(downloadStudentRoster(ss));
    if (action === 'uploadProfileAvatar') return jsonOut(uploadProfileAvatar_(ss, payload));
    if (action === 'fetchProfileAvatars') return jsonOut(fetchProfileAvatars_(ss, payload));
    if (action === 'reset_student_pin') return jsonOut(resetStudentPinServer(ss, payload.studentId));
    if (action === 'student_pin_status') return jsonOut(studentPinStatus(ss));
    if (action === 'fetch_due_dates') return jsonOut({ status: 'success', dueDates: listDueDates_(ss, payload.className || '') });
    if (action === 'decide_intern') return jsonOut(decideIntern(ss, payload));
    if (action === 'upsert_intern') return jsonOut(upsertIntern(ss, payload));
    if (action === 'reset_intern_pin') return jsonOut(resetInternPin(ss, payload.internId));
    if (action === 'list_interns') return jsonOut(listInterns(ss));
    if (action === 'list_reset_requests') return jsonOut(listResetRequests_(ss));
    if (action === 'decide_reset_request') return jsonOut(decideResetRequest_(ss, payload));
    if (action === 'fetch_approvals') return jsonOut(fetchApprovals(ss, payload.status || ''));
    if (action === 'decide_approval') return jsonOut(decideApproval(ss, payload.id, !!payload.approve));
    if (action === 'fetch_intern_logs') return jsonOut(fetchInternLogs(ss, payload.internId || ''));
    if (action === 'post_supervision') return jsonOut(postSupervision(ss, payload));
    if (action === 'post_notices') return jsonOut(postNotices(ss, payload.items || []));
    if (action === 'set_due_date') return jsonOut(setDueDate(ss, payload));
    if (action === 'exam_upload_bank') return jsonOut(examUploadBank_(ss, payload));
    if (action === 'exam_open') return jsonOut(examOpen_(ss, payload));
    if (action === 'exam_close') return jsonOut(examClose_(ss, payload));
    if (action === 'exam_sessions') return jsonOut(examListSessions_(ss, payload));
    if (action === 'exam_results') return jsonOut(examResults_(ss, payload));
    if (action === 'exam_grant_retake') return jsonOut(examGrantRetake_(ss, payload));
    if (action === 'upload_quiz_bank') return jsonOut(uploadQuizBank(ss, payload.units || []));
    if (action === 'fetch_student_submissions') return jsonOut(fetchStudentSubmissions(ss, Number(payload.since || 0), Number(payload.limit || 500)));

    // 2. การซิงค์แบบเป็นกลุ่ม (Batch Sync จาก Outbox)
    if (action === 'batch_sync') {
      var items = payload.items || [];
      var processedCount = 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it && it.type) {
          processSyncItem(ss, it);
          processedCount++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        processed: processedCount,
        syncedAt: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. การซิงค์รายการเดี่ยวแบบทันที (Realtime Single Sync)
    var result = processSyncItem(ss, payload);
    return ContentService.createTextOutput(JSON.stringify({
      status: (result && result.success) ? 'success' : 'error',
      type: payload.type,
      syncedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (gotLock) lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    appName: 'MusicSmart Google Sheets Sync Service',
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ประมวลผลและแยกข้อมูลลง Sheet แต่ละประเภทอัตโนมัติ
 */
function processSyncItem(ss, item) {
  var type = item.type;
  var data = item.data || {};
  var now = new Date();
  var timestamp = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

  // --------------------------------------------------------------------------
  // A. บันทึกหลังสอน วก.5 (Session Logs)
  // --------------------------------------------------------------------------
  if (type === 'session_log') {
    var sheet = getOrCreateSheet(ss, "วก5_บันทึกหลังสอน", [
      "วันเวลาที่บันทึก", "ห้องเรียน", "คาบที่", "ผู้สอน", "บทบาท",
      "นร.มา", "นร.ขาด", "นร.ลา", "สรุปผลการจัดกิจกรรม (Outcomes)",
      "ปัญหาและอุปสรรค (Problems)", "แนวทางแก้ไข (Solutions)", "ส่งต่อคาบถัดไป (Handover)", "รหัสอ้างอิง"
    ]);

    var attSummary = data.attendanceSummary || {};
    var refl = data.reflection || {};
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.period || "",
      data.instructorName || (data.instructor ? data.instructor.name : ""),
      data.instructorRole || (data.instructor ? data.instructor.role : ""),
      attSummary.present !== undefined ? attSummary.present : (data.presentCount || ""),
      attSummary.absent !== undefined ? attSummary.absent : (data.absentCount || ""),
      attSummary.leave !== undefined ? attSummary.leave : (data.leaveCount || ""),
      refl.outcomes || refl.learningOutcome || data.teachingSummary || "",
      refl.problems || data.problemIssues || "",
      refl.solutions || refl.suggestions || data.solutions || "",
      data.handoverNote || "",
      (data.className || "") + "_P" + (data.period || "")
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // B. งานนักเรียน / การวิจารณ์ดนตรี Feldman (Submissions & File/Video Uploads)
  // --------------------------------------------------------------------------
  if (type === 'submission') {
    var fileUrl = data.url || "";

    // หากมีการแนบไฟล์หรือคลิป (Base64) ให้อัปโหลดลง Google Drive ของครูอัตโนมัติ
    if (data.fileBase64 && data.fileName) {
      try {
        var folderName = "MusicSmart_Student_Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

        var base64Content = data.fileBase64.indexOf(',') > -1 
          ? data.fileBase64.split(',')[1] 
          : data.fileBase64;
        var decoded = Utilities.base64Decode(base64Content);
        var safeFileName = "[" + (data.className || "PPK") + "_" + (data.studentId || "std") + "] " + data.fileName;
        var blob = Utilities.newBlob(decoded, data.mimeType || "application/octet-stream", safeFileName);
        var file = folder.createFile(blob);
        applyDriveSharing_(file);   // ค่าเริ่มต้น: ส่วนตัว (เฉพาะครูเจ้าของ Drive)
        var driveLink = file.getUrl();
        fileUrl = fileUrl ? (fileUrl + " | " + driveLink) : driveLink;
      } catch (fErr) {
        fileUrl = fileUrl ? (fileUrl + " (Drive: " + fErr.toString() + ")") : ("Drive: " + fErr.toString());
      }
    }

    var sheet = getOrCreateSheet(ss, "งานนักเรียน_Submissions", [
      "วันเวลาที่ส่ง", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ประเภทงาน", "หัวข้องาน/เพลง", "เนื้อหาการส่งงาน (4 ขั้น Feldman)", "ลิงก์ไฟล์แนบ/คลิป (Google Drive/URL)", "คะแนน", "ข้อเสนอแนะครู"
    ]);
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.period || "",
      data.studentId || "",
      data.studentName || "",
      data.submissionType || "งานนักเรียน",
      data.songTitle || data.title || "",
      data.content || "",
      fileUrl,
      data.score !== undefined ? data.score : "",
      data.feedback || data.teacherFeedback || ""
    ]);
    return { type: type, success: true, fileUrl: fileUrl };
  }

  // --------------------------------------------------------------------------
  // C. คะแนนแบบทดสอบท้ายหน่วย (Quiz Results)
  // --------------------------------------------------------------------------
  if (type === 'quiz_result') {
    var sheet = getOrCreateSheet(ss, "คะแนนแบบทดสอบ_Quiz", [
      "วันเวลาที่ทำแบบทดสอบ", "หน่วยที่", "ชื่อหน่วยการเรียนรู้", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ห้องเรียน", "เลขที่", "คะแนนที่ได้", "คะแนนเต็ม", "ร้อยละ (%)", "เวลาที่ใช้ (วินาที)"
    ]);
    sheet.appendRow([
      timestamp,
      data.unitNo || "",
      data.unitTitle || "",
      data.studentId || "",
      data.studentName || "",
      data.studentClass || "",
      data.studentNo || "",
      data.score !== undefined ? data.score : "",
      data.totalQuestions || 20,
      data.percentage !== undefined ? data.percentage + "%" : "",
      data.timeSpentSeconds || 0
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // D. ประเมินรูบริกปฏิบัติคาลิมบ้า 4 ด้าน (Rubrics)
  // --------------------------------------------------------------------------
  if (type === 'rubric') {
    var sheet = getOrCreateSheet(ss, "คะแนนรูบริก_Rubrics", [
      "วันเวลาที่ประเมิน", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "ชื่อ-สกุล",
      "1. ท่าทางวิธีจับ (เต็ม 4)", "2. จังหวะ (เต็ม 4)", "3. คุณภาพเสียง (เต็ม 4)", "4. เทคนิคปฏิบัติ (เต็ม 4)",
      "คะแนนรวมดิบ (เต็ม 16)", "คะแนนแปลงมาตรฐาน (เต็ม 5)"
    ]);
    var b = data.breakdown || {};
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.period || "",
      data.studentId || "",
      data.studentName || "",
      b.posture !== undefined ? b.posture : "",
      b.rhythm !== undefined ? b.rhythm : "",
      b.tone !== undefined ? b.tone : "",
      b.technique !== undefined ? b.technique : "",
      data.sum !== undefined ? data.sum : "",
      data.scaledScore !== undefined ? data.scaledScore : ""
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // E. การเช็คชื่อเข้าเรียน (Attendance)
  // --------------------------------------------------------------------------
  if (type === 'attendance') {
    var sheet = getOrCreateSheet(ss, "การเช็คชื่อ_Attendance", [
      "วันเวลา", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "เลขที่", "ชื่อ-สกุล", "สถานะเข้าเรียน"
    ]);
    var records = data.records || [];
    var rows = [];
    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      rows.push([
        timestamp,
        data.className || "",
        data.period || "",
        r.studentId || "",
        r.no || "",
        r.name || "",
        r.status || "มา"
      ]);
    }
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return { type: type, success: true, count: rows.length };
  }

  // --------------------------------------------------------------------------
  // F. การมอบหมายคาบสอน & คำแนะนำนิเทศ นศ.ฝึกสอน (Schedule Assignment & Mentoring)
  // --------------------------------------------------------------------------
  if (type === 'assignment') {
    var sheet = getOrCreateSheet(ss, "ตารางสอน_นิเทศฝึกสอน", [
      "วันเวลาที่บันทึก", "วันในสัปดาห์", "คาบที่", "ห้องเรียน", "ผู้สอนที่รับมอบหมาย",
      "รูปแบบการสอน", "ครูพี่เลี้ยง", "คำแนะนำจากครูพี่เลี้ยง (Pedagogical Advice)",
      "วิธีการสอนแนะนำ (T-PACE Process)", "จุดสังเกตการนิเทศ", "บันทึกสะท้อนผล นศ.ฝึกสอน"
    ]);
    sheet.appendRow([
      timestamp,
      data.day || "",
      data.periodNo || "",
      data.className || "",
      data.teacherName || "",
      data.assignRole || "",
      data.mentorName || "",
      data.mentorAdvice || "",
      data.teachingMethod || "",
      data.focusPoints || "",
      data.traineeFeedback || ""
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // G. คะแนนวิจัยชั้นเรียน CAR (Pre-test / Post-test / Formative)
  // --------------------------------------------------------------------------
  if (type === 'research_car') {
    var sheet = getOrCreateSheet(ss, "วิจัยCAR_PrePost", [
      "วันเวลา", "ห้องเรียน", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ก่อนเรียน (Pre-Test)", "หลังเรียน (Post-Test)", "ระหว่างทาง (Formative)", "ผลพัฒนา (Gain)"
    ]);
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.studentId || "",
      data.studentName || "",
      data.pre !== undefined ? data.pre : "",
      data.post !== undefined ? data.post : "",
      data.formative !== undefined ? data.formative : "",
      data.gain !== undefined ? data.gain : ""
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // H. แผนการสอนและหลักสูตรที่ครูปรับแต่ง (Customized Curriculum & Lesson Plans)
  // --------------------------------------------------------------------------
  if (type === 'curriculum_lesson') {
    var sheet = getOrCreateSheet(ss, "แผนการสอน_Curriculum", [
      "วันเวลาที่แก้ไข", "ระดับชั้น", "คาบที่", "ชื่อหน่วยการเรียนรู้", "หัวข้อบทเรียน",
      "จุดประสงค์ KPA", "เวลาสอน (นาที)", "ขั้นตอน 5 ขั้น T-PACE", "จำนวนสื่อการสอน", "ผู้แก้ไข/ครูผู้สอน"
    ]);
    sheet.appendRow([
      timestamp,
      data.grade || "",
      data.period || "",
      data.unitName || data.unit_name || "",
      data.topic || "",
      data.kpaSummary || "",
      data.durationMin || data.duration_min || 50,
      data.stepsSummary || "",
      data.mediaCount !== undefined ? data.mediaCount : "",
      data.updatedBy || ""
    ]);
    return { type: type, success: true };
  }

  return { type: type, success: false, reason: "unknown_type" };
}

/**
 * ผู้ช่วยค้นหาหรือสร้าง Sheet ใหม่พร้อมจัดรูปแบบส่วนหัวอัตโนมัติ
 */
function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a"); // Dark slate navy
      headerRange.setFontColor("#f8fafc");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      for (var col = 1; col <= headers.length; col++) {
        sheet.setColumnWidth(col, 160);
      }
    }
  }
  return sheet;
}

/* ============================================================================
 * ระบบเข้าสู่ระบบนักเรียน (Student Auth) — รหัสนักเรียน + PIN 6 หลัก
 * ============================================================================ */
var STUDENT_PUBLIC_ACTIONS = ['studentLookup', 'studentSetPin', 'studentLogin', 'studentSubmit', 'studentQuizGet', 'studentTasks', 'studentNotices', 'studentProgress', 'uploadProfileAvatar', 'fetchProfileAvatars', 'studentExamStatus', 'studentExamStart', 'studentExamSubmit', 'studentEmailStatus', 'studentEmailStart', 'studentEmailConfirm'];
var STUDENT_MAX_BODY = 350000;          // ขนาดคำขอสูงสุดของนักเรียน (ตัวอักษร)
var STUDENT_SESSION_DAYS = 30;         // อายุโทเค็นเข้าสู่ระบบของนักเรียน
var STUDENT_SUBMIT_PER_HOUR = 60;      // ส่งงานได้สูงสุดต่อคนต่อชั่วโมง
var STUDENT_MAX_ITEMS = 20;            // รายการต่อคำขอ
var STUDENT_INBOX_SHEET = 'นักเรียนส่งงาน_Inbox';
var STUDENT_INBOX_HEADERS = ['received_at', 'received_ms', 'client_id', 'student_id', 'class', 'kind', 'period_or_unit',
  'content', 'url', 'score', 'total', 'percentage', 'time_spent_sec', 'submission_type', 'title', 'client_time', 'due_at', 'late', 'practice', 'upload_id'];
var DUE_SHEET = 'กำหนดส่ง_DueDates';
var DUE_HEADERS = ['class', 'period', 'due_at', 'title', 'updated_at'];
var QUIZ_BANK_SHEET = 'คลังข้อสอบ_QuizBank';
var QUIZ_BANK_HEADERS = ['unit_no', 'unit_title', 'qid', 'question', 'choices_json', 'correct', 'explanation', 'bloom'];
var STUDENT_AUTH_SHEET = 'นักเรียน_Students_Auth';
var STUDENT_AUTH_HEADERS = ['student_id', 'prefix', 'first_name', 'last_name', 'nickname', 'class', 'no',
  'salt', 'pin_hash', 'failed_count', 'locked_until', 'pin_set_at', 'last_login', 'email'];
var STUDENT_MAX_FAILS = 5;
var STUDENT_LOCK_MINUTES = 15;
var STUDENT_GLOBAL_PER_MINUTE = 300; // กันการสุ่มเดารหัสจำนวนมาก (ทั้งระบบ ต่อ 1 นาที)

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function toHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function getPinPepper_() {
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('PIN_PEPPER');
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('PIN_PEPPER', pepper);
  }
  return pepper;
}

function hashPin_(studentId, pin, salt) {
  var value = salt + ':' + studentId + ':' + pin + ':' + getPinPepper_();
  var h = '';
  for (var i = 0; i < 100; i++) {
    h = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + value, Utilities.Charset.UTF_8));
  }
  return h;
}

function cleanId_(v) { return String(v === undefined || v === null ? '' : v).replace(/\\s+/g, ''); }

function getStudentSheet_(ss) {
  var sheet = getOrCreateSheet(ss, STUDENT_AUTH_SHEET, STUDENT_AUTH_HEADERS);
  // ชีตเดิมที่สร้างก่อนมีคอลัมน์อีเมล: เติมหัวคอลัมน์ให้ (ข้อมูลเดิมไม่เปลี่ยน)
  if (sheet.getLastColumn() < STUDENT_AUTH_HEADERS.length) {
    sheet.getRange(1, 1, 1, STUDENT_AUTH_HEADERS.length).setValues([STUDENT_AUTH_HEADERS]);
  }
  return sheet;
}

function findStudentRow_(sheet, studentId) {
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (cleanId_(values[r][0]) === studentId) {
      var o = { row: r + 1 };
      for (var c = 0; c < STUDENT_AUTH_HEADERS.length; c++) o[STUDENT_AUTH_HEADERS[c]] = values[r][c];
      return o;
    }
  }
  return null;
}

function writeStudentRow_(sheet, rec) {
  var row = STUDENT_AUTH_HEADERS.map(function (h) { return rec[h] === undefined ? '' : rec[h]; });
  sheet.getRange(rec.row, 1, 1, row.length).setValues([row]);
}

function maskName_(name) {
  var s = String(name || '');
  return s ? s.charAt(0) + '•••' : '•••';
}

function publicProfile_(rec) {
  return {
    studentId: cleanId_(rec.student_id),
    name: String(rec.prefix || '') + String(rec.first_name || '') + ' ' + String(rec.last_name || ''),
    nickname: String(rec.nickname || ''),
    studentClass: String(rec['class'] || ''),
    no: rec.no
  };
}

function globalStudentThrottle_() {
  var cache = CacheService.getScriptCache();
  var key = 'stu_rate_' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n <= STUDENT_GLOBAL_PER_MINUTE;
}

function handleStudentPublicAction(ss, payload) {
  if (!globalStudentThrottle_()) {
    return { status: 'error', code: 'rate_limited', message: 'มีการเข้าสู่ระบบจำนวนมาก กรุณารอสักครู่แล้วลองใหม่' };
  }
  if (payload.action === 'studentSubmit') return studentSubmit_(ss, payload);
  if (payload.action === 'studentQuizGet') return studentQuizGet_(ss, payload);
  if (payload.action === 'studentExamStatus') return studentExamStatus_(ss, payload);
  if (payload.action === 'studentExamStart') return studentExamStart_(ss, payload);
  if (payload.action === 'studentExamSubmit') return studentExamSubmit_(ss, payload);
  if (payload.action === 'studentTasks') return studentTasks_(ss, payload);
  if (payload.action === 'studentProgress') return studentProgress_(ss, payload);
  if (payload.action === 'studentNotices') return studentNotices_(ss, payload);
  if (payload.action === 'uploadProfileAvatar') return uploadProfileAvatar_(ss, payload);
  if (payload.action === 'fetchProfileAvatars') return fetchProfileAvatars_(ss, payload);
  if (payload.action === 'studentEmailStatus' || payload.action === 'studentEmailStart' || payload.action === 'studentEmailConfirm') return studentEmailAction_(ss, payload);
  var studentId = cleanId_(payload.studentId);
  if (!/^\\d{4,10}$/.test(studentId)) return { status: 'error', code: 'bad_id', message: 'รูปแบบรหัสนักเรียนไม่ถูกต้อง' };
  var sheet = getStudentSheet_(ss);
  var rec = findStudentRow_(sheet, studentId);
  if (!rec) return { status: 'error', code: 'not_found', message: 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาแจ้งคุณครู' };
  var hasPin = !!rec.pin_hash;
  var now = Date.now();
  var lockedUntil = Number(rec.locked_until || 0);

  if (payload.action === 'studentLookup') {
    // เปิดเผยเพียงห้องเรียนและอักษรตัวแรกของชื่อ เพื่อให้นักเรียนยืนยันตัวเอง
    return { status: 'success', exists: true, hasPin: hasPin, studentClass: String(rec['class'] || ''),
      maskedName: maskName_(rec.first_name), locked: lockedUntil > now };
  }

  var pin = String(payload.pin || '');
  if (!/^\\d{6}$/.test(pin)) return { status: 'error', code: 'bad_pin', message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก' };

  if (payload.action === 'studentSetPin') {
    if (hasPin) return { status: 'error', code: 'pin_exists', message: 'รหัสนี้ตั้ง PIN แล้ว หากลืม PIN กรุณาให้คุณครูรีเซ็ต' };
    rec.salt = Utilities.getUuid();
    rec.pin_hash = hashPin_(studentId, pin, rec.salt);
    rec.failed_count = 0;
    rec.locked_until = '';
    rec.pin_set_at = new Date().toISOString();
    rec.last_login = rec.pin_set_at;
    writeStudentRow_(sheet, rec);
    return withSession_({ status: 'success', profile: publicProfile_(rec) }, rec);
  }

  // studentLogin
  if (lockedUntil > now) {
    return { status: 'error', code: 'locked', message: 'ใส่ PIN ผิดหลายครั้ง ระบบล็อกชั่วคราว ' + STUDENT_LOCK_MINUTES + ' นาที' };
  }
  if (!hasPin) return { status: 'error', code: 'needs_pin', message: 'ยังไม่ได้ตั้ง PIN กรุณาตั้ง PIN ก่อน' };
  if (hashPin_(studentId, pin, String(rec.salt)) !== String(rec.pin_hash)) {
    rec.failed_count = Number(rec.failed_count || 0) + 1;
    var left = STUDENT_MAX_FAILS - rec.failed_count;
    if (rec.failed_count >= STUDENT_MAX_FAILS) {
      rec.locked_until = now + STUDENT_LOCK_MINUTES * 60000;
      rec.failed_count = 0;
      left = 0;
    }
    writeStudentRow_(sheet, rec);
    return { status: 'error', code: 'wrong_pin', attemptsLeft: left,
      message: left > 0 ? 'PIN ไม่ถูกต้อง (เหลืออีก ' + left + ' ครั้ง)' : 'ใส่ PIN ผิดหลายครั้ง ระบบล็อกชั่วคราว ' + STUDENT_LOCK_MINUTES + ' นาที' };
  }
  rec.failed_count = 0;
  rec.locked_until = '';
  rec.last_login = new Date().toISOString();
  writeStudentRow_(sheet, rec);
  return withSession_({ status: 'success', profile: publicProfile_(rec) }, rec);
}

/** ครูอัปโหลด/อัปเดตรายชื่อ (เก็บ PIN เดิมไว้) replace=true จะลบรหัสที่ไม่อยู่ในรายชื่อใหม่ */
function uploadStudentRoster(ss, students, replace) {
  var sheet = getStudentSheet_(ss);
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var r = 1; r < values.length; r++) index[cleanId_(values[r][0])] = r;
  var seen = {}, added = 0, updated = 0;
  for (var i = 0; i < students.length; i++) {
    var s = students[i] || {};
    var id = cleanId_(s.student_id);
    if (!/^\\d{4,10}$/.test(id) || seen[id]) continue;
    seen[id] = true;
    var base = [id, s.prefix || '', s.first_name || '', s.last_name || '', s.nickname || '', s['class'] || '', s.no || ''];
    if (index[id] !== undefined) {
      var row = values[index[id]];
      for (var c = 0; c < base.length; c++) row[c] = base[c];
      updated++;
    } else {
      var newRow = base.concat(['', '', 0, '', '', '', '']);
      index[id] = values.length;
      values.push(newRow);
      added++;
    }
  }
  var removed = 0;
  if (replace) {
    var kept = [values[0]];
    for (var k = 1; k < values.length; k++) {
      if (seen[cleanId_(values[k][0])]) kept.push(values[k]); else removed++;
    }
    values = kept;
  }
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, STUDENT_AUTH_HEADERS.length).setValues(values.map(function (row) {
    var out = [];
    for (var c = 0; c < STUDENT_AUTH_HEADERS.length; c++) out.push(row[c] === undefined ? '' : row[c]);
    return out;
  }));
  return { status: 'success', added: added, updated: updated, removed: removed, total: values.length - 1 };
}

function resetStudentPinServer(ss, studentId) {
  var id = cleanId_(studentId);
  var sheet = getStudentSheet_(ss);
  var rec = findStudentRow_(sheet, id);
  if (!rec) return { status: 'error', code: 'not_found', message: 'ไม่พบรหัสนักเรียนนี้ในชีต' };
  rec.salt = ''; rec.pin_hash = ''; rec.failed_count = 0; rec.locked_until = ''; rec.pin_set_at = '';
  writeStudentRow_(sheet, rec);
  return { status: 'success', studentId: id };
}

function studentPinStatus(ss) {
  var values = getStudentSheet_(ss).getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    list.push({ studentId: cleanId_(values[r][0]), hasPin: !!values[r][8], locked: Number(values[r][10] || 0) > Date.now() });
  }
  return { status: 'success', students: list };
}

/* ============================================================================
 * โทเค็นเข้าสู่ระบบนักเรียน (HMAC-SHA256) + การส่งงานจากมือถือนักเรียน
 * ============================================================================ */
function getSessionSecret_() {
  var props = PropertiesService.getScriptProperties();
  var sec = props.getProperty('STUDENT_SESSION_SECRET');
  if (!sec) {
    sec = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('STUDENT_SESSION_SECRET', sec);
  }
  return sec;
}

function b64url_(str) {
  return Utilities.base64EncodeWebSafe(str, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

function signSession_(body) {
  return toHex_(Utilities.computeHmacSha256Signature(body, getSessionSecret_(), Utilities.Charset.UTF_8));
}

// pv = เวลาตั้ง PIN: เมื่อครูรีเซ็ต PIN โทเค็นเก่าจะใช้ไม่ได้ทันที
function issueSessionToken_(rec) {
  var exp = Date.now() + STUDENT_SESSION_DAYS * 86400000;
  var body = b64url_(JSON.stringify({ sid: cleanId_(rec.student_id), exp: exp, pv: String(rec.pin_set_at || '') }));
  return { token: body + '.' + signSession_(body), exp: exp };
}

function withSession_(res, rec) {
  var t = issueSessionToken_(rec);
  res.sessionToken = t.token;
  res.sessionExp = t.exp;
  return res;
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** ตรวจโทเค็น คืน { rec } หรือ { error } */
function verifySessionToken_(ss, token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { error: 'bad_session' };
  if (!safeEqual_(signSession_(parts[0]), parts[1])) return { error: 'bad_session' };
  var claims;
  try {
    var pad = parts[0] + '==='.slice((parts[0].length + 3) % 4);
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString());
  } catch (e) { return { error: 'bad_session' }; }
  if (!claims || !claims.sid || Number(claims.exp) < Date.now()) return { error: 'session_expired' };
  var rec = findStudentRow_(getStudentSheet_(ss), cleanId_(claims.sid));
  if (!rec || !rec.pin_hash || String(rec.pin_set_at || '') !== String(claims.pv || '')) return { error: 'session_expired' };
  return { rec: rec };
}

function str_(v, max) { return String(v === undefined || v === null ? '' : v).slice(0, max); }

function validateSubmission_(it) {
  if (!it || typeof it !== 'object') return 'invalid';
  var cid = String(it.clientId || '');
  if (!/^[A-Za-z0-9_.:-]{8,80}$/.test(cid)) return 'bad_client_id';
  var d = it.data || {};
  if (it.kind === 'assignment') {
    var p = Number(d.period);
    if (!(p >= 1 && p <= 40 && Math.floor(p) === p)) return 'bad_period';
    if (String(d.content || '').length > 5000) return 'too_long';
    if (d.url && (!/^https?:\\/\\//i.test(String(d.url)) || String(d.url).length > 500)) return 'bad_url';
    if (d.uploadId && !/^[A-Za-z0-9_-]{8,60}$/.test(String(d.uploadId))) return 'bad_upload';
    if (!d.content && !d.url && !d.uploadId) return 'empty';
    return '';
  }
  if (it.kind === 'recording') {
    // คลิปฝึกซ้อม: ส่งเป็นลิงก์เท่านั้น (Google Drive / YouTube ฯลฯ)
    var rp = Number(d.period);
    if (!(rp >= 1 && rp <= 40 && Math.floor(rp) === rp)) return 'bad_period';
    if (d.uploadId && !/^[A-Za-z0-9_-]{8,60}$/.test(String(d.uploadId))) return 'bad_upload';
    if (!d.uploadId && (!d.url || !/^https:\\/\\//i.test(String(d.url)) || String(d.url).length > 500)) return 'bad_url';
    if (d.uploadId && d.url && !/^https:\\/\\//i.test(String(d.url))) return 'bad_url';
    if (String(d.content || '').length > 1000) return 'too_long';
    return '';
  }
  if (it.kind === 'quiz_answers') {
    var u = Number(d.unitNo);
    if (!(u >= 1 && u <= 20 && Math.floor(u) === u)) return 'bad_unit';
    if (!d.answers || typeof d.answers !== 'object') return 'invalid';
    var ks = Object.keys(d.answers);
    if (ks.length > 100) return 'too_many';
    for (var i = 0; i < ks.length; i++) if (String(ks[i]).length > 40 || String(d.answers[ks[i]]).length > 4) return 'invalid';
    return '';
  }
  return 'bad_kind';
}

function studentSubmit_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var rec = v.rec;
  var sid = cleanId_(rec.student_id);           // รหัสนักเรียนมาจากโทเค็นเท่านั้น ไม่เชื่อค่าจากเครื่อง
  var items = payload.items;
  if (!items || Object.prototype.toString.call(items) !== '[object Array]') return { status: 'error', code: 'invalid', message: 'รูปแบบข้อมูลไม่ถูกต้อง' };
  if (items.length > STUDENT_MAX_ITEMS) return { status: 'error', code: 'too_many', message: 'ส่งได้ครั้งละไม่เกิน ' + STUDENT_MAX_ITEMS + ' รายการ' };

  var inbox = getOrCreateSheet(ss, STUDENT_INBOX_SHEET, STUDENT_INBOX_HEADERS);
  var existing = {};
  var quizCounts = {};
  var vals = inbox.getDataRange().getValues();
  for (var r = 1; r < vals.length; r++) {
    var rowSid = cleanId_(vals[r][3]);
    existing[rowSid + '|' + String(vals[r][2])] = true;
    if (rowSid === sid && String(vals[r][5]) === 'quiz' && String(vals[r][18]) !== 'true' && vals[r][18] !== true) {
      var uKey = Number(vals[r][6]);
      if (uKey >= 1) quizCounts[uKey] = (quizCounts[uKey] || 0) + 1;
    }
  }

  var cache = CacheService.getScriptCache();
  var rlKey = 'stu_submit_' + sid + '_' + Math.floor(Date.now() / 3600000);
  var used = Number(cache.get(rlKey) || 0);

  var accepted = [], duplicates = [], rejected = [], results = {};
  var profile = publicProfile_(rec);
  ensureHeaders_(inbox, STUDENT_INBOX_HEADERS);
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var cid = it && it.clientId ? String(it.clientId) : '';
    var err = validateSubmission_(it);
    if (err) { rejected.push({ clientId: cid, reason: err }); continue; }
    if (existing[sid + '|' + cid]) { duplicates.push(cid); continue; }  // ส่งซ้ำด้วย clientId เดิม = สำเร็จ (idempotent)
    if (used >= STUDENT_SUBMIT_PER_HOUR) { rejected.push({ clientId: cid, reason: 'rate_limited' }); continue; }
    used++;
    var d = it.data || {};
    var now = new Date();
    if (it.kind === 'quiz_answers') {
      var uNo = Number(d.unitNo);
      var practice = !!d.practice;
      if (!practice) {
        var maxQuiz = quizAllowedAttempts_(ss, sid, uNo);
        if ((quizCounts[uNo] || 0) >= maxQuiz) {
          used--;
          rejected.push({ clientId: cid, reason: 'duplicate_quiz' });
          continue;
        }
      }
      var g = gradeQuiz_(ss, uNo, d.answers);
      if (!g) { used--; rejected.push({ clientId: cid, reason: 'no_quiz' }); continue; }
      inbox.appendRow([now.toISOString(), now.getTime(), cid, sid, profile.studentClass, practice ? 'practice_quiz' : 'quiz', uNo,
        '', '', g.score, g.total, g.percentage, Math.max(0, Math.min(86400, Number(d.timeSpentSeconds) || 0)),
        'server_graded', g.title, str_(d.clientTime, 40), '', '', practice, '']);
      if (!practice) {
        quizCounts[uNo] = (quizCounts[uNo] || 0) + 1;
        processSyncItem(ss, { type: 'quiz_result', data: { unitNo: uNo, unitTitle: g.title, studentId: sid,
          studentName: profile.name, studentClass: profile.studentClass, studentNo: profile.no, score: g.score,
          totalQuestions: g.total, percentage: g.percentage, timeSpentSeconds: Number(d.timeSpentSeconds) || 0 } });
      }
      results[cid] = { score: g.score, total: g.total, percentage: g.percentage, practice: practice };
    } else {
      var urlOut = str_(d.url, 500), upId = '';
      if (d.uploadId) {
        var upRec = resolveUpload_(ss, sid, String(d.uploadId));
        if (!upRec) { used--; rejected.push({ clientId: cid, reason: 'bad_upload' }); continue; }
        upId = String(d.uploadId);
        urlOut = urlOut ? (urlOut + ' | ' + String(upRec.file_url)) : String(upRec.file_url);
      }
      var due = getDueDate_(ss, profile.studentClass, Number(d.period));
      var late = !!(due && now.getTime() > new Date(due).getTime());
      inbox.appendRow([now.toISOString(), now.getTime(), cid, sid, profile.studentClass, it.kind, Number(d.period),
        str_(d.content, 5000), urlOut, '', '', '', '',
        str_(d.submissionType, 40), str_(d.title, 200), str_(d.clientTime, 40), due || '', late, false, upId]);
      processSyncItem(ss, { type: 'submission', data: { className: profile.studentClass, period: Number(d.period), studentId: sid,
        studentName: profile.name, submissionType: (str_(d.submissionType, 40) || (it.kind === 'recording' ? 'คลิปฝึกซ้อม (ลิงก์)' : 'งานนักเรียน (มือถือ)')) + (late ? ' (ส่งช้า)' : ''), songTitle: str_(d.title, 200),
        content: str_(d.content, 5000), url: urlOut } });
      results[cid] = { late: late, dueAt: due || '', fileUrl: upId ? urlOut : '' };
    }
    existing[sid + '|' + cid] = true;
    accepted.push(cid);
  }
  cache.put(rlKey, String(used), 3700);
  return { status: 'success', accepted: accepted, duplicates: duplicates, rejected: rejected, results: results };
}

/** ครูดึงงานที่นักเรียนส่งจากมือถือ (เฉพาะที่ใหม่กว่า since) */
function fetchStudentSubmissions(ss, since, limit) {
  var vals = getOrCreateSheet(ss, STUDENT_INBOX_SHEET, STUDENT_INBOX_HEADERS).getDataRange().getValues();
  var out = [], next = since || 0;
  limit = Math.max(1, Math.min(limit || 500, 1000));
  for (var r = 1; r < vals.length && out.length < limit; r++) {
    var ms = Number(vals[r][1]);
    if (!(ms > (since || 0))) continue;
    var o = {};
    for (var c = 0; c < STUDENT_INBOX_HEADERS.length; c++) o[STUDENT_INBOX_HEADERS[c]] = vals[r][c];
    o.student_id = cleanId_(o.student_id);
    out.push(o);
    if (ms > next) next = ms;
  }
  return { status: 'success', submissions: out, nextSince: next, more: out.length >= limit };
}

/* ============================================================================
 * กำหนดส่งงาน (Due dates) และแบบทดสอบที่ตรวจบนเซิร์ฟเวอร์ (เฉลยอยู่ในชีตครูเท่านั้น)
 * ============================================================================ */
function ensureHeaders_(sheet, headers) {
  var vals = sheet.getDataRange().getValues();
  var row = vals[0] || [];
  if (row.length < headers.length || String(row[headers.length - 1]) !== headers[headers.length - 1]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function setDueDate(ss, payload) {
  var cls = str_(payload.className, 40), period = Number(payload.period);
  if (!cls || !(period >= 1 && period <= 40)) return { status: 'error', message: 'ห้อง/คาบไม่ถูกต้อง' };
  var dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
  if (dueAt && isNaN(dueAt.getTime())) return { status: 'error', message: 'วันที่ไม่ถูกต้อง' };
  var sheet = getOrCreateSheet(ss, DUE_SHEET, DUE_HEADERS);
  var vals = sheet.getDataRange().getValues();
  var kept = [vals[0] || DUE_HEADERS];
  for (var r = 1; r < vals.length; r++) {
    if (!(String(vals[r][0]) === cls && Number(vals[r][1]) === period)) kept.push(vals[r]);
  }
  if (dueAt) kept.push([cls, period, dueAt.toISOString(), str_(payload.title, 200), new Date().toISOString()]);
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, DUE_HEADERS.length).setValues(kept.map(function (row) {
    var o = []; for (var c = 0; c < DUE_HEADERS.length; c++) o.push(row[c] === undefined ? '' : row[c]); return o;
  }));
  return { status: 'success', className: cls, period: period, dueAt: dueAt ? dueAt.toISOString() : '' };
}

function listDueDates_(ss, cls) {
  var vals = getOrCreateSheet(ss, DUE_SHEET, DUE_HEADERS).getDataRange().getValues();
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    if (!cls || String(vals[r][0]) === cls) out.push({ className: String(vals[r][0]), period: Number(vals[r][1]), dueAt: String(vals[r][2]), title: String(vals[r][3] || '') });
  }
  return out;
}

function getDueDate_(ss, cls, period) {
  var list = listDueDates_(ss, cls);
  for (var i = 0; i < list.length; i++) if (list[i].period === period) return list[i].dueAt;
  return '';
}

/** นักเรียนดูกำหนดส่งของห้องตัวเอง */
function studentTasks_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var cls = String(v.rec['class'] || '');
  return { status: 'success', studentClass: cls, dueDates: listDueDates_(ss, cls) };
}

/** นักเรียนดูความก้าวหน้าของตนเอง: งานที่ส่ง คะแนนแบบทดสอบ (แยกแบบฝึก) งานค้าง และคำแนะนำครู — เฉพาะของตัวเอง */
function studentProgress_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var sid = String(v.rec.student_id), cls = String(v.rec['class'] || '');
  var vals = getOrCreateSheet(ss, STUDENT_INBOX_SHEET, STUDENT_INBOX_HEADERS).getDataRange().getValues();
  var h = vals[0] || [], ix = {};
  for (var c = 0; c < h.length; c++) ix[h[c]] = c;
  var submitted = {}, quizzes = {}, practice = {}, recordings = 0, late = 0;
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    if (String(row[ix.student_id]) !== sid) continue;
    var kind = String(row[ix.kind]), pu = Number(row[ix.period_or_unit]);
    if (kind === 'quiz' || kind === 'practice_quiz') {
      var target = kind === 'quiz' ? quizzes : practice;
      var pct = Number(row[ix.percentage]) || 0;
      var prev = target[pu];
      target[pu] = { unitNo: pu, best: Math.max(prev ? prev.best : 0, pct), last: pct, attempts: (prev ? prev.attempts : 0) + 1 };
    } else if (kind === 'recording') {
      recordings++;  // คลิปฝึกซ้อมไม่นับแทนงานประจำคาบ
    } else {
      if (!submitted[pu]) submitted[pu] = { period: pu, late: false, kinds: [] };
      if (submitted[pu].kinds.indexOf(kind) === -1) submitted[pu].kinds.push(kind);
      if (row[ix.late] === true || String(row[ix.late]) === 'true') submitted[pu].late = true;
    }
  }
  Object.keys(submitted).forEach(function (k) { if (submitted[k].late) late++; });
  var due = listDueDates_(ss, cls), now = Date.now(), missing = [];
  due.forEach(function (d) { if (!submitted[d.period] && new Date(d.dueAt).getTime() < now) missing.push(d.period); });
  var qs = Object.keys(quizzes).map(function (k) { return quizzes[k]; });
  var avg = qs.length ? Math.round(qs.reduce(function (a, q) { return a + q.best; }, 0) / qs.length) : null;
  var fb = [];
  var nv = getOrCreateSheet(ss, NOTICE_SHEET, NOTICE_HEADERS).getDataRange().getValues();
  for (var n = 1; n < nv.length; n++) {
    if (String(nv[n][1]) !== sid || String(nv[n][3]) !== 'feedback') continue;
    fb.push({ ref: String(nv[n][4]), message: String(nv[n][5]), score: nv[n][6] === '' ? null : nv[n][6], createdMs: Number(nv[n][2]) });
  }
  return { status: 'success', studentClass: cls, dueDates: due,
    submittedPeriods: Object.keys(submitted).map(function (k) { return submitted[k]; }),
    quizzes: qs, practice: Object.keys(practice).map(function (k) { return practice[k]; }),
    quizAverage: avg, missing: missing, late: late, recordings: recordings, feedback: fb.slice(-20) };
}

/** ครูอัปโหลดคลังข้อสอบ (แทนที่ทั้งหมด) */
function uploadQuizBank(ss, units) {
  var rows = [QUIZ_BANK_HEADERS], n = 0;
  for (var i = 0; i < units.length; i++) {
    var u = units[i] || {};
    var qs = u.questions || [];
    for (var j = 0; j < qs.length; j++) {
      var q = qs[j] || {};
      if (!q.id || !q.correct) continue;
      var choices = (q.choices || []).map(function (c) { return { key: str_(c.key, 4), text: str_(c.text, 500) }; });
      rows.push([Number(u.unit_no), str_(u.title, 200), str_(q.id, 40), str_(q.question, 1000), JSON.stringify(choices), str_(q.correct, 4), str_(q.explanation, 1000), str_(q.bloom, 40)]);
      n++;
    }
  }
  var sheet = getOrCreateSheet(ss, QUIZ_BANK_SHEET, QUIZ_BANK_HEADERS);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, QUIZ_BANK_HEADERS.length).setValues(rows);
  return { status: 'success', questions: n, units: units.length };
}

function quizUnit_(ss, unitNo) {
  var vals = getOrCreateSheet(ss, QUIZ_BANK_SHEET, QUIZ_BANK_HEADERS).getDataRange().getValues();
  var out = { title: '', questions: [] };
  for (var r = 1; r < vals.length; r++) {
    if (Number(vals[r][0]) !== unitNo) continue;
    out.title = String(vals[r][1] || '');
    var choices = [];
    try { choices = JSON.parse(String(vals[r][4] || '[]')); } catch (e) { choices = []; }
    out.questions.push({ id: String(vals[r][2]), question: String(vals[r][3]), choices: choices, correct: String(vals[r][5]), bloom: String(vals[r][7] || '') });
  }
  return out.questions.length ? out : null;
}

/** นักเรียนรับข้อสอบ (ไม่มีเฉลย ไม่มีคำอธิบาย) */
function studentQuizGet_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var u = quizUnit_(ss, Number(payload.unitNo));
  if (!u) return { status: 'error', code: 'no_quiz', message: 'ครูยังไม่ได้อัปโหลดแบบทดสอบหน่วยนี้' };
  return { status: 'success', unitNo: Number(payload.unitNo), title: u.title,
    questions: u.questions.map(function (q) { return { id: q.id, question: q.question, choices: q.choices, bloom: q.bloom }; }) };
}

/** ตรวจคำตอบด้วยเฉลยในชีต: answers = { qid: key } */
function gradeQuiz_(ss, unitNo, answers) {
  var u = quizUnit_(ss, unitNo);
  if (!u) return null;
  var score = 0;
  for (var i = 0; i < u.questions.length; i++) {
    var q = u.questions[i];
    if (answers && String(answers[q.id] || '') === q.correct) score++;
  }
  var total = u.questions.length;
  return { score: score, total: total, percentage: Math.round(score / total * 100), title: u.title };
}

/* ============================================================================
 * ห้องสอบกลางภาค/ปลายภาค (Exam Rooms) — ข้อสอบและเฉลย "อยู่บนเซิร์ฟเวอร์เท่านั้น"
 * - ครูอัปโหลดคลังข้อสอบ (exam_upload_bank) แล้วเปิดห้องสอบรายห้อง (exam_open) กำหนดช่วงเวลา/เวลาทำ/จำนวนครั้ง
 * - นักเรียนได้รับข้อสอบ "หลังเข้าสู่ระบบ + อยู่ห้องนั้น + ห้องสอบเปิดอยู่" เท่านั้น (studentExamStart)
 * - เซิร์ฟเวอร์สลับข้อ/ตัวเลือกต่อคน ตรวจคำตอบเอง ไม่ส่งเฉลยกลับ และปฏิเสธการส่งที่เลยเวลา
 * ============================================================================ */
var EXAM_BANK_SHEET = 'คลังข้อสอบกลางปลายภาค_ExamBank';
var EXAM_BANK_HEADERS = ['kind', 'qid', 'question', 'choices_json', 'correct', 'explanation', 'src_period', 'src_objective', 'difficulty', 'status'];
var EXAM_SESSION_SHEET = 'ห้องสอบ_ExamSessions';
var EXAM_SESSION_HEADERS = ['session_id', 'kind', 'class', 'open_ms', 'close_ms', 'duration_min', 'max_attempts', 'closed_ms', 'created_ms', 'max_points', 'items'];
var EXAM_ATTEMPT_SHEET = 'ผลสอบ_ExamAttempts';
var EXAM_ATTEMPT_HEADERS = ['attempt_id', 'session_id', 'kind', 'class', 'student_id', 'student_name', 'no', 'attempt_no',
  'started_ms', 'deadline_ms', 'submitted_ms', 'status', 'order_json', 'correct', 'items', 'points', 'level', 'late'];
var EXAM_GRANT_SHEET = 'สิทธิ์สอบซ่อม_ExamRetakes';
var EXAM_GRANT_HEADERS = ['session_id', 'student_id', 'extra', 'granted_ms'];
var EXAM_KINDS = ['midterm', 'final'];
var EXAM_KEYS = ['ก', 'ข', 'ค', 'ง', 'จ'];
var EXAM_GRACE_MS = 15000;          // เผื่อเวลาเครือข่ายหลังหมดเวลา (วินาที x1000)
var EXAM_MAX_POINTS = 10;
var EXAM_DEFAULT_MINUTES = 25;

function examNum_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function examMs_(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  var n = Number(v);
  if (!isNaN(n) && String(v).trim() !== '') return n;
  var d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function examSeed_(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}
function examRng_(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function examShuffle_(arr, rnd) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rnd() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function examBankRows_(ss, kind) {
  var rows = rowsOf_(getOrCreateSheet(ss, EXAM_BANK_SHEET, EXAM_BANK_HEADERS), EXAM_BANK_HEADERS), out = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].kind) !== kind) continue;
    var choices = [];
    try { choices = JSON.parse(String(rows[i].choices_json || '[]')); } catch (e) { choices = []; }
    out.push({ qid: String(rows[i].qid), question: String(rows[i].question), choices: choices, correct: String(rows[i].correct) });
  }
  return out;
}

/** ครูอัปโหลดคลังข้อสอบของ kind หนึ่ง (แทนที่เฉพาะ kind นั้น) — ห้ามอัปโหลดขณะมีห้องสอบเปิดอยู่ */
function examUploadBank_(ss, payload) {
  var kind = String(payload.kind || '');
  if (EXAM_KINDS.indexOf(kind) === -1) return { status: 'error', code: 'bad_kind', message: 'ชนิดข้อสอบไม่ถูกต้อง (midterm/final)' };
  var items = payload.items;
  if (Object.prototype.toString.call(items) !== '[object Array]' || !items.length) return { status: 'error', code: 'invalid', message: 'ไม่พบข้อสอบ' };
  if (items.length > 60) return { status: 'error', code: 'too_many', message: 'ข้อสอบมากเกิน 60 ข้อ' };
  var now = Date.now();
  var sess = rowsOf_(getOrCreateSheet(ss, EXAM_SESSION_SHEET, EXAM_SESSION_HEADERS), EXAM_SESSION_HEADERS);
  for (var s = 0; s < sess.length; s++) {
    if (String(sess[s].kind) === kind && !sess[s].closed_ms && examNum_(sess[s].close_ms) > now) {
      return { status: 'error', code: 'session_open', message: 'มีห้องสอบที่ยังไม่ปิด กรุณาปิดห้องสอบก่อนเปลี่ยนคลังข้อสอบ' };
    }
  }
  var seen = {}, rows = [];
  for (var i = 0; i < items.length; i++) {
    var q = items[i] || {};
    var id = str_(q.id, 40), text = str_(q.question, 1000);
    var ch = Object.prototype.toString.call(q.choices) === '[object Array]' ? q.choices : [];
    if (!id || !text || seen[id]) return { status: 'error', code: 'invalid', message: 'ข้อที่ ' + (i + 1) + ' ไม่ครบหรือรหัสซ้ำ' };
    if (ch.length < 3 || ch.length > EXAM_KEYS.length) return { status: 'error', code: 'invalid', message: 'ข้อที่ ' + (i + 1) + ' ต้องมี 3-5 ตัวเลือก' };
    var texts = ch.map(function (c) { return str_(c && c.text !== undefined ? c.text : c, 500); });
    var ci = Number(q.correctIndex);
    if (!(ci >= 0 && ci < texts.length) || texts.some(function (t) { return !t; })) return { status: 'error', code: 'invalid', message: 'ข้อที่ ' + (i + 1) + ' เฉลย/ตัวเลือกไม่ถูกต้อง' };
    seen[id] = true;
    var keyed = texts.map(function (t, k) { return { key: EXAM_KEYS[k], text: t }; });
    rows.push([kind, id, text, JSON.stringify(keyed), EXAM_KEYS[ci], str_(q.explanation, 1000), str_(q.srcPeriod, 20), str_(q.srcObjective, 300), str_(q.difficulty, 20), str_(q.status, 60)]);
  }
  var sheet = getOrCreateSheet(ss, EXAM_BANK_SHEET, EXAM_BANK_HEADERS);
  var all = rowsOf_(sheet, EXAM_BANK_HEADERS), kept = [EXAM_BANK_HEADERS];
  for (var r = 0; r < all.length; r++) {
    if (String(all[r].kind) !== kind) kept.push(EXAM_BANK_HEADERS.map(function (h) { return all[r][h] === undefined ? '' : all[r][h]; }));
  }
  for (var k = 0; k < rows.length; k++) kept.push(rows[k]);
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, EXAM_BANK_HEADERS.length).setValues(kept);
  return { status: 'success', kind: kind, items: rows.length };
}

function examSessions_(ss) { return rowsOf_(getOrCreateSheet(ss, EXAM_SESSION_SHEET, EXAM_SESSION_HEADERS), EXAM_SESSION_HEADERS); }
function examEffectiveClose_(sess) {
  var c = examNum_(sess.close_ms), z = examNum_(sess.closed_ms);
  return z ? Math.min(c, z) : c;
}
function examSessionState_(sess, now) {
  if (examNum_(sess.closed_ms) && examNum_(sess.closed_ms) <= now) return 'closed';
  if (now < examNum_(sess.open_ms)) return 'scheduled';
  if (now < examNum_(sess.close_ms)) return 'open';
  return 'ended';
}
/** ห้องสอบที่ "เปิดอยู่ตอนนี้" ของห้องเรียนนั้น (ห้องอื่นไม่เห็น) */
function examActiveSession_(ss, cls, now) {
  var list = examSessions_(ss), best = null;
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (String(s['class']) !== String(cls)) continue;
    if (examSessionState_(s, now) !== 'open') continue;
    if (!best || examNum_(s.created_ms) >= examNum_(best.created_ms)) best = s;
  }
  return best;
}

function examOpen_(ss, payload) {
  var kind = String(payload.kind || '');
  var cls = str_(payload.className, 40);
  if (EXAM_KINDS.indexOf(kind) === -1 || !cls) return { status: 'error', code: 'invalid', message: 'ห้อง/ชนิดข้อสอบไม่ถูกต้อง' };
  var now = Date.now();
  var openMs = payload.openAt ? examMs_(payload.openAt) : now;
  var closeMs = examMs_(payload.closeAt);
  if (!openMs || !closeMs || closeMs <= openMs) return { status: 'error', code: 'invalid', message: 'ช่วงเวลาเปิด-ปิดสอบไม่ถูกต้อง' };
  if (closeMs <= now) return { status: 'error', code: 'invalid', message: 'เวลาปิดสอบผ่านไปแล้ว' };
  var minutes = Math.max(5, Math.min(180, Math.round(examNum_(payload.durationMin) || EXAM_DEFAULT_MINUTES)));
  var attempts = Math.max(1, Math.min(3, Math.round(examNum_(payload.maxAttempts) || 1)));
  var bank = examBankRows_(ss, kind);
  if (!bank.length) return { status: 'error', code: 'no_bank', message: 'ยังไม่ได้อัปโหลดคลังข้อสอบชนิดนี้' };
  var sheet = getOrCreateSheet(ss, EXAM_SESSION_SHEET, EXAM_SESSION_HEADERS);
  var list = rowsOf_(sheet, EXAM_SESSION_HEADERS);
  for (var i = 0; i < list.length; i++) {   // ห้อง+ชนิดเดียวกัน เปิดได้ทีละรอบ: ปิดรอบเก่าที่ยังค้าง
    if (String(list[i].kind) === kind && String(list[i]['class']) === cls && !list[i].closed_ms && examNum_(list[i].close_ms) > now) {
      list[i].closed_ms = now; writeRow_(sheet, EXAM_SESSION_HEADERS, list[i]);
    }
  }
  var id = 'EX' + now.toString(36) + Utilities.getUuid().slice(0, 4);
  sheet.appendRow([id, kind, cls, openMs, closeMs, minutes, attempts, '', now, EXAM_MAX_POINTS, bank.length]);
  return { status: 'success', sessionId: id, kind: kind, className: cls, openMs: openMs, closeMs: closeMs, durationMin: minutes, maxAttempts: attempts, items: bank.length };
}

function examClose_(ss, payload) {
  var sheet = getOrCreateSheet(ss, EXAM_SESSION_SHEET, EXAM_SESSION_HEADERS);
  var list = rowsOf_(sheet, EXAM_SESSION_HEADERS), id = String(payload.sessionId || '');
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].session_id) === id) {
      if (!list[i].closed_ms) { list[i].closed_ms = Date.now(); writeRow_(sheet, EXAM_SESSION_HEADERS, list[i]); }
      return { status: 'success', sessionId: id, closedMs: Number(list[i].closed_ms) };
    }
  }
  return { status: 'error', code: 'not_found', message: 'ไม่พบห้องสอบ' };
}

function examAttemptsSheet_(ss) { return getOrCreateSheet(ss, EXAM_ATTEMPT_SHEET, EXAM_ATTEMPT_HEADERS); }

function examListSessions_(ss, payload) {
  var now = Date.now(), cls = str_(payload.className, 40);
  var att = rowsOf_(examAttemptsSheet_(ss), EXAM_ATTEMPT_HEADERS);
  var out = examSessions_(ss).filter(function (s) { return !cls || String(s['class']) === cls; }).map(function (s) {
    var sub = 0, prog = 0;
    for (var i = 0; i < att.length; i++) {
      if (String(att[i].session_id) !== String(s.session_id)) continue;
      if (att[i].status === 'submitted') sub++; else if (att[i].status === 'in_progress') prog++;
    }
    return { sessionId: String(s.session_id), kind: String(s.kind), className: String(s['class']), openMs: examNum_(s.open_ms), closeMs: examNum_(s.close_ms),
      closedMs: examNum_(s.closed_ms), durationMin: examNum_(s.duration_min), maxAttempts: examNum_(s.max_attempts), items: examNum_(s.items),
      state: examSessionState_(s, now), submitted: sub, inProgress: prog };
  });
  return { status: 'success', serverNow: now, sessions: out };
}

/** ครูดูผลสอบ (ไม่มีข้อสอบ/เฉลย/ลำดับข้อ) — ใช้นำคะแนนเข้าสมุดคะแนน */
function examResults_(ss, payload) {
  var kind = str_(payload.kind, 20), cls = str_(payload.className, 40), sid = str_(payload.sessionId, 40);
  var rows = rowsOf_(examAttemptsSheet_(ss), EXAM_ATTEMPT_HEADERS).filter(function (a) {
    return (!kind || String(a.kind) === kind) && (!cls || String(a['class']) === cls) && (!sid || String(a.session_id) === sid);
  }).map(function (a) {
    return { attemptId: String(a.attempt_id), sessionId: String(a.session_id), kind: String(a.kind), className: String(a['class']), studentId: cleanId_(a.student_id),
      name: String(a.student_name), no: a.no, attemptNo: examNum_(a.attempt_no), startedMs: examNum_(a.started_ms), submittedMs: examNum_(a.submitted_ms),
      status: String(a.status), correct: a.correct === '' ? null : examNum_(a.correct), items: examNum_(a.items), points: a.points === '' ? null : examNum_(a.points),
      level: a.level === '' ? null : examNum_(a.level), late: String(a.late) === 'true' };
  });
  return { status: 'success', attempts: rows };
}

function examGrantRetake_(ss, payload) {
  var sid = cleanId_(payload.studentId), id = String(payload.sessionId || '');
  var extra = Math.max(1, Math.min(2, Math.round(examNum_(payload.extra) || 1)));
  if (!id && (payload.unitNo || payload.period)) {
    var recQ = findStudentRow_(getStudentSheet_(ss), sid);
    if (!recQ) return { status: 'error', code: 'not_found', message: 'ไม่พบนักเรียน' };
    var targetId = payload.unitNo ? ('quiz_u' + Number(payload.unitNo)) : ('p' + Number(payload.period));
    getOrCreateSheet(ss, EXAM_GRANT_SHEET, EXAM_GRANT_HEADERS).appendRow([targetId, sid, extra, Date.now()]);
    return { status: 'success', sessionId: targetId, studentId: sid, extra: extra };
  }
  if (/^(quiz_u\\d+|u\\d+|p\\d+|\\d+)$/.test(id)) {
    var recU = findStudentRow_(getStudentSheet_(ss), sid);
    if (!recU) return { status: 'error', code: 'not_found', message: 'ไม่พบนักเรียน' };
    getOrCreateSheet(ss, EXAM_GRANT_SHEET, EXAM_GRANT_HEADERS).appendRow([id, sid, extra, Date.now()]);
    return { status: 'success', sessionId: id, studentId: sid, extra: extra };
  }
  var sess = null, list = examSessions_(ss);
  for (var i = 0; i < list.length; i++) if (String(list[i].session_id) === id) sess = list[i];
  if (!sess) return { status: 'error', code: 'not_found', message: 'ไม่พบห้องสอบ' };
  var rec = findStudentRow_(getStudentSheet_(ss), sid);
  if (!rec || String(rec['class']) !== String(sess['class'])) return { status: 'error', code: 'not_in_room', message: 'นักเรียนไม่อยู่ในห้องที่สอบ' };
  getOrCreateSheet(ss, EXAM_GRANT_SHEET, EXAM_GRANT_HEADERS).appendRow([id, sid, extra, Date.now()]);
  return { status: 'success', sessionId: id, studentId: sid, extra: extra };
}

function quizAllowedAttempts_(ss, sid, unitOrPeriod) {
  var extra = 0;
  var n = Number(unitOrPeriod);
  var keys = [String(n), 'quiz_u' + n, 'u' + n, 'p' + n];
  var rows = rowsOf_(getOrCreateSheet(ss, EXAM_GRANT_SHEET, EXAM_GRANT_HEADERS), EXAM_GRANT_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (cleanId_(rows[i].student_id) === sid && keys.indexOf(String(rows[i].session_id)) !== -1) {
      extra += examNum_(rows[i].extra);
    }
  }
  return 1 + extra;
}

function examAllowed_(ss, sess, sid) {
  var extra = 0, rows = rowsOf_(getOrCreateSheet(ss, EXAM_GRANT_SHEET, EXAM_GRANT_HEADERS), EXAM_GRANT_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].session_id) === String(sess.session_id) && cleanId_(rows[i].student_id) === sid) extra += examNum_(rows[i].extra);
  }
  return examNum_(sess.max_attempts) + extra;
}

/** ปิดความพยายามที่ค้างและเลยเวลาแล้ว (นับเป็นใช้สิทธิ์ ไม่ให้คะแนน) */
function examExpireStale_(sheet, attempts, now) {
  for (var i = 0; i < attempts.length; i++) {
    var a = attempts[i];
    if (a.status === 'in_progress' && now > examNum_(a.deadline_ms) + EXAM_GRACE_MS) { a.status = 'expired'; writeRow_(sheet, EXAM_ATTEMPT_HEADERS, a); }
  }
}

function examLevel_(correct, items) {
  var p = items ? correct / items : 0;
  return p >= 0.8 ? 4 : p >= 0.7 ? 3 : p >= 0.5 ? 2 : 1;
}

function examStudentView_(ss, rec, now) {
  var cls = String(rec['class']), sid = cleanId_(rec.student_id);
  var sess = examActiveSession_(ss, cls, now);
  if (!sess) return { sess: null };
  var sheet = examAttemptsSheet_(ss);
  var mine = rowsOf_(sheet, EXAM_ATTEMPT_HEADERS).filter(function (a) { return cleanId_(a.student_id) === sid && String(a.session_id) === String(sess.session_id); });
  examExpireStale_(sheet, mine, now);
  var used = 0, running = null, last = null;
  for (var i = 0; i < mine.length; i++) {
    if (mine[i].status === 'in_progress') running = mine[i]; else used++;
    if (mine[i].status === 'submitted') last = mine[i];
  }
  var allowed = examAllowed_(ss, sess, sid);
  return { sess: sess, sheet: sheet, mine: mine, used: used, running: running, last: last, allowed: allowed, left: Math.max(0, allowed - used), sid: sid };
}

function studentExamStatus_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var now = Date.now();
  var view = examStudentView_(ss, v.rec, now);
  if (!view.sess) return { status: 'success', open: false };   // เป็นกลาง: ไม่บอกว่ามีตาราง/ห้องอื่น
  var r = { status: 'success', open: true, kind: String(view.sess.kind), closeMs: examEffectiveClose_(view.sess), durationMin: examNum_(view.sess.duration_min),
    items: examNum_(view.sess.items), attemptsLeft: view.left, canStart: view.left > 0 || (!!view.running && examNum_(view.running.deadline_ms) > now),
    inProgress: !!view.running && examNum_(view.running.deadline_ms) > now, serverNow: now };
  if (view.last) r.last = { points: examNum_(view.last.points), maxPoints: examNum_(view.sess.max_points), correct: examNum_(view.last.correct), items: examNum_(view.last.items) };
  return r;
}

function examQuestionsFor_(bank, order) {
  var byId = {}, i;
  for (i = 0; i < bank.length; i++) byId[bank[i].qid] = bank[i];
  var out = [];
  for (i = 0; i < order.length; i++) {
    var q = byId[order[i].id];
    if (!q) continue;
    out.push({ id: q.qid, question: q.question, choices: order[i].p.map(function (idx, k) { return { key: EXAM_KEYS[k], text: String(q.choices[idx].text) }; }) });
  }
  return out;
}

function studentExamStart_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var now = Date.now(), rec = v.rec;
  var view = examStudentView_(ss, rec, now);
  if (!view.sess) return { status: 'error', code: 'not_open', message: 'ยังไม่เปิดสอบ' };
  var sess = view.sess;
  var bank = examBankRows_(ss, String(sess.kind));
  if (!bank.length) return { status: 'error', code: 'not_open', message: 'ยังไม่เปิดสอบ' };
  var att = view.running && examNum_(view.running.deadline_ms) > now ? view.running : null;
  var order;
  if (att) {
    try { order = JSON.parse(String(att.order_json)); } catch (e) { order = null; }
  }
  if (!att) {
    if (view.left <= 0) return { status: 'error', code: 'no_attempts', message: 'ใช้สิทธิ์สอบครบแล้ว' };
    var rnd = examRng_(examSeed_(Utilities.getUuid() + '|' + view.sid + '|' + now));
    order = examShuffle_(bank, rnd).map(function (q) {
      var idx = []; for (var k = 0; k < q.choices.length; k++) idx.push(k);
      return { id: q.qid, p: examShuffle_(idx, rnd) };
    });
    var deadline = Math.min(examEffectiveClose_(sess), now + examNum_(sess.duration_min) * 60000);
    var profile = publicProfile_(rec);
    var attemptId = 'AT' + now.toString(36) + Utilities.getUuid().slice(0, 6);
    view.sheet.appendRow([attemptId, sess.session_id, sess.kind, sess['class'], view.sid, profile.name, profile.no, view.used + 1,
      now, deadline, '', 'in_progress', JSON.stringify(order), '', order.length, '', '', '']);
    att = { attempt_id: attemptId, deadline_ms: deadline };
  }
  if (!order) return { status: 'error', code: 'error', message: 'เริ่มสอบไม่สำเร็จ กรุณาแจ้งครู' };
  return { status: 'success', attemptId: String(att.attempt_id), kind: String(sess.kind), deadlineMs: examNum_(att.deadline_ms), serverNow: now,
    items: order.length, maxPoints: examNum_(sess.max_points), questions: examQuestionsFor_(bank, order) };
}

function studentExamSubmit_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var now = Date.now(), sid = cleanId_(v.rec.student_id);
  var sheet = examAttemptsSheet_(ss);
  var id = String(payload.attemptId || ''), att = null, list = rowsOf_(sheet, EXAM_ATTEMPT_HEADERS);
  for (var i = 0; i < list.length; i++) if (String(list[i].attempt_id) === id && cleanId_(list[i].student_id) === sid) att = list[i];
  if (!att) return { status: 'error', code: 'bad_attempt', message: 'ไม่พบการสอบนี้' };
  var sess = null, ss_ = examSessions_(ss);
  for (var s = 0; s < ss_.length; s++) if (String(ss_[s].session_id) === String(att.session_id)) sess = ss_[s];
  var maxPts = sess ? examNum_(sess.max_points) : EXAM_MAX_POINTS;
  if (att.status === 'submitted') {   // ส่งซ้ำ (เครือข่ายสะดุด) = ตอบผลเดิม ไม่ตรวจใหม่
    return { status: 'success', submitted: true, correct: examNum_(att.correct), items: examNum_(att.items), points: examNum_(att.points), maxPoints: maxPts, level: examNum_(att.level), duplicate: true };
  }
  if (att.status !== 'in_progress') return { status: 'error', code: 'closed', message: 'การสอบครั้งนี้สิ้นสุดแล้ว' };
  var limit = examNum_(att.deadline_ms);
  if (sess) limit = Math.min(limit, examEffectiveClose_(sess));
  if (now > limit + EXAM_GRACE_MS) {
    att.status = 'late_rejected'; att.submitted_ms = now; att.late = true; writeRow_(sheet, EXAM_ATTEMPT_HEADERS, att);
    return { status: 'error', code: 'late', message: 'หมดเวลาสอบแล้ว ระบบไม่รับคำตอบ' };
  }
  var order = []; try { order = JSON.parse(String(att.order_json)); } catch (e) { order = []; }
  var bank = examBankRows_(ss, String(att.kind)), byId = {};
  for (var b = 0; b < bank.length; b++) byId[bank[b].qid] = bank[b];
  var answers = payload.answers && typeof payload.answers === 'object' ? payload.answers : {};
  var correct = 0;
  for (var o = 0; o < order.length; o++) {
    var q = byId[order[o].id];
    if (!q) continue;
    var picked = EXAM_KEYS.indexOf(String(answers[order[o].id] || ''));
    if (picked < 0 || picked >= order[o].p.length) continue;
    if (String(q.choices[order[o].p[picked]].key) === q.correct) correct++;   // เทียบกับเฉลยบนเซิร์ฟเวอร์เท่านั้น
  }
  var items = order.length;
  var points = items ? Math.round(correct / items * maxPts * 100) / 100 : 0;
  var level = examLevel_(correct, items);
  att.status = 'submitted'; att.submitted_ms = now; att.correct = correct; att.items = items; att.points = points; att.level = level; att.late = now > limit;
  writeRow_(sheet, EXAM_ATTEMPT_HEADERS, att);
  return { status: 'success', submitted: true, correct: correct, items: items, points: points, maxPoints: maxPts, level: level };
}

/* ============================================================================
 * แจ้งเตือนนักเรียน (ทวงงาน) และคำแนะนำครูต่องาน — นักเรียนเห็นเฉพาะของตัวเอง
 * ============================================================================ */
var NOTICE_SHEET = 'แจ้งเตือน_Notices';
var NOTICE_HEADERS = ['notice_id', 'student_id', 'created_ms', 'kind', 'ref', 'message', 'score', 'teacher'];

function postNotices(ss, items) {
  if (!items || items.length > 1000) return { status: 'error', message: 'จำนวนรายการไม่ถูกต้อง' };
  var sheet = getOrCreateSheet(ss, NOTICE_SHEET, NOTICE_HEADERS);
  var now = Date.now(), n = 0;
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var sid = cleanId_(it.studentId);
    var kind = it.kind === 'feedback' ? 'feedback' : 'reminder';
    if (!/^\\d{4,10}$/.test(sid) || !it.message) continue;
    sheet.appendRow([Utilities.getUuid(), sid, now, kind, str_(it.ref, 80), str_(it.message, 1000),
      it.score === undefined || it.score === null ? '' : str_(it.score, 10), str_(it.teacher, 80)]);
    n++;
  }
  return { status: 'success', posted: n };
}

function studentNotices_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var sid = cleanId_(v.rec.student_id);
  var since = Number(payload.since || 0);
  var vals = getOrCreateSheet(ss, NOTICE_SHEET, NOTICE_HEADERS).getDataRange().getValues();
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    if (cleanId_(vals[r][1]) !== sid || !(Number(vals[r][2]) > since)) continue;
    out.push({ id: String(vals[r][0]), createdMs: Number(vals[r][2]), kind: String(vals[r][3]), ref: String(vals[r][4]),
      message: String(vals[r][5]), score: vals[r][6] === '' ? null : vals[r][6], teacher: String(vals[r][7] || '') });
  }
  return { status: 'success', notices: out.slice(-50) };
}

/* ============================================================================
 * นักศึกษาฝึกประสบการณ์วิชาชีพครู (Intern): บัญชี/PIN, โทเค็นจำกัดห้อง,
 * คิวอนุมัติคะแนนโดยครูพี่เลี้ยง, บันทึกหลังสอน, แบบประเมินการนิเทศ
 * ============================================================================ */
var INTERN_SHEET = 'นศ_Interns';
var INTERN_HEADERS = ['intern_id', 'name', 'classes', 'salt', 'pin_hash', 'failed_count', 'locked_until', 'pin_set_at', 'active',
  'status', 'university', 'faculty', 'major', 'phone', 'email', 'term', 'academic_year', 'preferred_classes', 'mentor_name', 'registered_at', 'decided_at', 'reject_reason'];
var APPROVAL_SHEET = 'รออนุมัติคะแนน_Approvals';
var APPROVAL_HEADERS = ['approval_id', 'created_ms', 'intern_id', 'intern_name', 'class', 'period', 'student_id', 'score', 'comment', 'status', 'decided_ms', 'client_id'];
var INTERN_LOG_SHEET = 'นศ_บันทึกหลังสอน';
var INTERN_LOG_HEADERS = ['log_id', 'created_ms', 'intern_id', 'intern_name', 'class', 'period', 'result', 'problems', 'solutions', 'client_id'];
var SUPERVISION_SHEET = 'นิเทศ_Supervision';
var SUPERVISION_HEADERS = ['eval_id', 'created_ms', 'intern_id', 'class', 'period', 'ratings_json', 'total', 'comments', 'mentor'];
var INTERN_PUBLIC_ACTIONS = ['internRegister', 'internLogin', 'internSetPin', 'internFetch', 'internProposeGrade', 'internPostLog'];

function rowsOf_(sheet, headers) {
  var vals = sheet.getDataRange().getValues(), out = [];
  for (var r = 1; r < vals.length; r++) {
    var o = { row: r + 1 };
    for (var c = 0; c < headers.length; c++) o[headers[c]] = vals[r][c];
    out.push(o);
  }
  return out;
}
function writeRow_(sheet, headers, rec) {
  sheet.getRange(rec.row, 1, 1, headers.length).setValues([headers.map(function (h) { return rec[h] === undefined ? '' : rec[h]; })]);
}
function internSheet_(ss) { return getOrCreateSheet(ss, INTERN_SHEET, INTERN_HEADERS); }
function findIntern_(ss, id) {
  var list = rowsOf_(internSheet_(ss), INTERN_HEADERS);
  for (var i = 0; i < list.length; i++) if (String(list[i].intern_id) === id) return list[i];
  return null;
}
function internClasses_(rec) { return String(rec.classes || '').split(',').map(function (c) { return c.trim(); }).filter(String); }
function cleanInternId_(v) { var s = String(v || '').trim(); return /^[A-Za-z0-9_-]{3,30}$/.test(s) ? s : ''; }

// ---- ครูจัดการบัญชี นศ. (ต้องใช้ token) ----
function upsertIntern(ss, payload) {
  var id = cleanInternId_(payload.internId);
  if (!id) return { status: 'error', message: 'รหัส นศ. ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3-30 ตัว' };
  var classes = (payload.classes || []).map(function (c) { return str_(c, 20); }).filter(String);
  var sheet = internSheet_(ss);
  ensureHeaders_(sheet, INTERN_HEADERS);
  var rec = findIntern_(ss, id);
  if (!rec) {
    sheet.appendRow([id, str_(payload.name, 80), classes.join(','), '', '', 0, '', '', true, 'approved']);
    return { status: 'success', created: true, internId: id };
  }
  rec.name = str_(payload.name, 80) || rec.name; rec.classes = classes.join(','); if (String(rec.status || '') !== 'rejected') rec.status = 'approved'; rec.active = payload.active === false ? false : true;
  writeRow_(sheet, INTERN_HEADERS, rec);
  return { status: 'success', created: false, internId: id };
}
function resetInternPin(ss, internId) {
  var rec = findIntern_(ss, cleanInternId_(internId));
  if (!rec) return { status: 'error', message: 'ไม่พบ นศ.' };
  rec.salt = ''; rec.pin_hash = ''; rec.failed_count = 0; rec.locked_until = ''; rec.pin_set_at = '';
  writeRow_(internSheet_(ss), INTERN_HEADERS, rec);
  return { status: 'success' };
}
function listInterns(ss) {
  return { status: 'success', interns: rowsOf_(internSheet_(ss), INTERN_HEADERS).map(function (r) {
    var o = { internId: String(r.intern_id), name: String(r.name), classes: internClasses_(r), hasPin: !!r.pin_hash, active: r.active !== false,
      status: String(r.status || 'approved'), registeredAt: String(r.registered_at || ''), decidedAt: String(r.decided_at || ''), rejectReason: String(r.reject_reason || '') };
    INTERN_PROFILE_FIELDS.forEach(function (k) { o[k] = String(r[k] === undefined ? '' : r[k]); });   // ข้อมูลส่วนตัว: เฉพาะครูที่มี token
    return o;
  }) };
}

// ---- โทเค็น นศ. ----
function issueInternToken_(rec) {
  var exp = Date.now() + STUDENT_SESSION_DAYS * 86400000;
  var body = b64url_(JSON.stringify({ iid: String(rec.intern_id), role: 'intern', exp: exp, pv: String(rec.pin_set_at || '') }));
  return { token: body + '.' + signSession_(body), exp: exp };
}
function verifyInternToken_(ss, token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2 || !safeEqual_(signSession_(parts[0]), parts[1])) return { error: 'bad_session' };
  var claims;
  try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + '==='.slice((parts[0].length + 3) % 4))).getDataAsString()); }
  catch (e) { return { error: 'bad_session' }; }
  if (!claims || claims.role !== 'intern' || !claims.iid) return { error: 'bad_session' };
  if (Number(claims.exp) < Date.now()) return { error: 'session_expired' };
  var rec = findIntern_(ss, String(claims.iid));
  if (!rec || rec.active === false || !rec.pin_hash || String(rec.pin_set_at || '') !== String(claims.pv || '')) return { error: 'session_expired' };
  if (String(rec.status || 'approved') !== 'approved') return { error: 'session_expired' };
  return { rec: rec, classes: internClasses_(rec) };
}

function handleInternAction(ss, payload) {
  if (!globalStudentThrottle_()) return { status: 'error', code: 'rate_limited', message: 'กรุณารอสักครู่' };
  var a = payload.action;
  if (a === 'internRegister') return internRegister_(ss, payload);
  if (a === 'internLogin' || a === 'internSetPin') {
    var rec = findIntern_(ss, cleanInternId_(payload.internId));
    if (!rec || rec.active === false) return { status: 'error', code: 'not_found', message: 'ไม่พบบัญชี นศ. กรุณากด "ลงทะเบียน" ก่อน' };
    var st = String(rec.status || 'approved');
    // ไม่บอกสถานะจนกว่าจะยืนยัน PIN ถูก (กันการสอดส่องรหัส) — ยกเว้นบัญชีที่ยังไม่มี PIN
    if (st !== 'approved' && rec.pin_hash && /^\\d{6}$/.test(String(payload.pin || '')) &&
        hashPin_('intern:' + rec.intern_id, String(payload.pin), String(rec.salt)) === String(rec.pin_hash) && Number(rec.locked_until || 0) <= Date.now()) {
      if (st === 'pending') return { status: 'error', code: 'pending', message: 'ลงทะเบียนแล้ว รอครูประจำวิชาอนุมัติ' };
      return { status: 'error', code: 'rejected', message: 'ครูไม่อนุมัติการลงทะเบียน' + (rec.reject_reason ? ': ' + rec.reject_reason : '') + ' (ลงทะเบียนใหม่ได้)' };
    }
    var pin = String(payload.pin || '');
    if (!/^\\d{6}$/.test(pin)) return { status: 'error', code: 'bad_pin', message: 'PIN ต้องเป็นตัวเลข 6 หลัก' };
    var sheet = internSheet_(ss), now = Date.now();
    if (st !== 'approved' && (a === 'internSetPin' || !rec.pin_hash)) {
      return { status: 'error', code: st === 'pending' ? 'pending' : 'rejected', message: st === 'pending' ? 'ลงทะเบียนแล้ว รอครูประจำวิชาอนุมัติ' : 'ครูไม่อนุมัติการลงทะเบียน (ลงทะเบียนใหม่ได้)' };
    }
    if (a === 'internSetPin') {
      if (rec.pin_hash) return { status: 'error', code: 'pin_exists', message: 'ตั้ง PIN แล้ว หากลืมให้ครูพี่เลี้ยงรีเซ็ต' };
      rec.salt = Utilities.getUuid(); rec.pin_hash = hashPin_('intern:' + rec.intern_id, pin, rec.salt);
      rec.pin_set_at = new Date().toISOString(); rec.failed_count = 0; rec.locked_until = '';
    } else {
      if (Number(rec.locked_until || 0) > now) return { status: 'error', code: 'locked', message: 'ใส่ PIN ผิดหลายครั้ง ล็อก 15 นาที' };
      if (!rec.pin_hash) return { status: 'error', code: 'needs_pin', message: 'เข้าใช้ครั้งแรก กรุณาตั้ง PIN' };
      if (hashPin_('intern:' + rec.intern_id, pin, String(rec.salt)) !== String(rec.pin_hash)) {
        rec.failed_count = Number(rec.failed_count || 0) + 1;
        if (rec.failed_count >= STUDENT_MAX_FAILS) { rec.locked_until = now + STUDENT_LOCK_MINUTES * 60000; rec.failed_count = 0; }
        writeRow_(sheet, INTERN_HEADERS, rec);
        return { status: 'error', code: 'wrong_pin', message: 'PIN ไม่ถูกต้อง' };
      }
      rec.failed_count = 0; rec.locked_until = '';
    }
    writeRow_(sheet, INTERN_HEADERS, rec);
    var t = issueInternToken_(rec);
    if (st !== 'approved') return { status: 'error', code: 'wrong_pin', message: 'PIN ไม่ถูกต้อง' };
    return { status: 'success', sessionToken: t.token, sessionExp: t.exp, profile: internOwnProfile_(rec) };
  }

  var v = verifyInternToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  var iid = String(v.rec.intern_id), classes = v.classes;
  function allowed(c) { return classes.indexOf(String(c)) !== -1; }

  if (a === 'internFetch') {
    var since = Number(payload.since || 0);
    var roster = rowsOf_(getStudentSheet_(ss), STUDENT_AUTH_HEADERS).filter(function (r) { return allowed(r['class']); }).map(function (r) {
      return { student_id: cleanId_(r.student_id), prefix: String(r.prefix || ''), first_name: String(r.first_name || ''), last_name: String(r.last_name || ''), nickname: String(r.nickname || ''), class: String(r['class']), no: r.no };
    });
    var subs = rowsOf_(getOrCreateSheet(ss, STUDENT_INBOX_SHEET, STUDENT_INBOX_HEADERS), STUDENT_INBOX_HEADERS)
      .filter(function (r) { return allowed(r['class']) && Number(r.received_ms) > since; })
      .map(function (r) { delete r.row; r.student_id = cleanId_(r.student_id); return r; });
    var approvals = rowsOf_(getOrCreateSheet(ss, APPROVAL_SHEET, APPROVAL_HEADERS), APPROVAL_HEADERS).filter(function (r) { return String(r.intern_id) === iid; })
      .map(function (r) { return { id: String(r.approval_id), className: String(r['class']), period: Number(r.period), studentId: cleanId_(r.student_id), score: r.score, status: String(r.status) }; });
    var logs = rowsOf_(getOrCreateSheet(ss, INTERN_LOG_SHEET, INTERN_LOG_HEADERS), INTERN_LOG_HEADERS).filter(function (r) { return String(r.intern_id) === iid; })
      .map(function (r) { return { className: String(r['class']), period: Number(r.period), result: String(r.result), problems: String(r.problems), solutions: String(r.solutions), createdMs: Number(r.created_ms) }; });
    var evals = rowsOf_(getOrCreateSheet(ss, SUPERVISION_SHEET, SUPERVISION_HEADERS), SUPERVISION_HEADERS).filter(function (r) { return String(r.intern_id) === iid; })
      .map(function (r) { var rt = {}; try { rt = JSON.parse(String(r.ratings_json || '{}')); } catch (e) { rt = {}; } return { className: String(r['class']), period: Number(r.period), ratings: rt, total: Number(r.total), comments: String(r.comments), mentor: String(r.mentor), createdMs: Number(r.created_ms) }; });
    var due = listDueDates_(ss, '').filter(function (d) { return allowed(d.className); });
    var next = since; subs.forEach(function (s) { if (Number(s.received_ms) > next) next = Number(s.received_ms); });
    return { status: 'success', classes: classes, roster: roster, submissions: subs, nextSince: next, approvals: approvals, logs: logs, evaluations: evals, dueDates: due };
  }

  if (a === 'internProposeGrade') {
    var items = payload.items || [];
    if (items.length > 100) return { status: 'error', code: 'too_many', message: 'ส่งได้ครั้งละไม่เกิน 100 รายการ' };
    var ap = getOrCreateSheet(ss, APPROVAL_SHEET, APPROVAL_HEADERS);
    var seen = {}; rowsOf_(ap, APPROVAL_HEADERS).forEach(function (r) { seen[String(r.intern_id) + '|' + String(r.client_id)] = true; });
    var accepted = [], rejected = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {}, cid = String(it.clientId || '');
      if (!/^[A-Za-z0-9_.:-]{8,80}$/.test(cid)) { rejected.push({ clientId: cid, reason: 'bad_client_id' }); continue; }
      if (!allowed(it.className)) { rejected.push({ clientId: cid, reason: 'class_not_assigned' }); continue; }
      var sc = Number(it.score), p = Number(it.period);
      if (!(p >= 1 && p <= 40) || !(sc >= 0 && sc <= 100) || !/^\\d{4,10}$/.test(cleanId_(it.studentId))) { rejected.push({ clientId: cid, reason: 'invalid' }); continue; }
      if (seen[iid + '|' + cid]) { accepted.push(cid); continue; }
      ap.appendRow([Utilities.getUuid(), Date.now(), iid, String(v.rec.name), String(it.className), p, cleanId_(it.studentId), sc, str_(it.comment, 1000), 'pending', '', cid]);
      seen[iid + '|' + cid] = true; accepted.push(cid);
    }
    return { status: 'success', accepted: accepted, rejected: rejected };
  }

  if (a === 'internPostLog') {
    if (!allowed(payload.className)) return { status: 'error', code: 'class_not_assigned', message: 'ไม่ใช่ห้องที่ได้รับมอบหมาย' };
    var pp = Number(payload.period);
    if (!(pp >= 1 && pp <= 40)) return { status: 'error', code: 'invalid', message: 'คาบไม่ถูกต้อง' };
    var lg = getOrCreateSheet(ss, INTERN_LOG_SHEET, INTERN_LOG_HEADERS);
    var cid2 = str_(payload.clientId, 80);
    var dup = rowsOf_(lg, INTERN_LOG_HEADERS).some(function (r) { return String(r.intern_id) === iid && cid2 && String(r.client_id) === cid2; });
    if (!dup) {
      lg.appendRow([Utilities.getUuid(), Date.now(), iid, String(v.rec.name), String(payload.className), pp, str_(payload.result, 3000), str_(payload.problems, 3000), str_(payload.solutions, 3000), cid2]);
      processSyncItem(ss, { type: 'session_log', data: { className: String(payload.className), period: pp, instructorName: String(v.rec.name), instructorRole: 'นศ.ฝึกประสบการณ์วิชาชีพครู',
        reflection: { outcomes: str_(payload.result, 3000), problems: str_(payload.problems, 3000), solutions: str_(payload.solutions, 3000) } } });
    }
    return { status: 'success', duplicate: dup };
  }
  return { status: 'error', code: 'unknown', message: 'unknown action' };
}

// ---- ครูพี่เลี้ยง: คิวอนุมัติ / บันทึกหลังสอน / แบบประเมินการนิเทศ (ต้องใช้ token) ----
function fetchApprovals(ss, status) {
  var list = rowsOf_(getOrCreateSheet(ss, APPROVAL_SHEET, APPROVAL_HEADERS), APPROVAL_HEADERS)
    .filter(function (r) { return !status || String(r.status) === status; })
    .map(function (r) { return { id: String(r.approval_id), createdMs: Number(r.created_ms), internId: String(r.intern_id), internName: String(r.intern_name), className: String(r['class']), period: Number(r.period), studentId: cleanId_(r.student_id), score: Number(r.score), comment: String(r.comment), status: String(r.status) }; });
  return { status: 'success', approvals: list };
}
function decideApproval(ss, id, approve) {
  var sheet = getOrCreateSheet(ss, APPROVAL_SHEET, APPROVAL_HEADERS);
  var list = rowsOf_(sheet, APPROVAL_HEADERS);
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].approval_id) !== String(id)) continue;
    if (String(list[i].status) !== 'pending') return { status: 'error', message: 'รายการนี้ตัดสินแล้ว' };
    list[i].status = approve ? 'approved' : 'rejected'; list[i].decided_ms = Date.now();
    writeRow_(sheet, APPROVAL_HEADERS, list[i]);
    return { status: 'success', approval: { id: String(id), className: String(list[i]['class']), period: Number(list[i].period), studentId: cleanId_(list[i].student_id), score: Number(list[i].score), status: list[i].status } };
  }
  return { status: 'error', message: 'ไม่พบรายการ' };
}
function fetchInternLogs(ss, internId) {
  return { status: 'success', logs: rowsOf_(getOrCreateSheet(ss, INTERN_LOG_SHEET, INTERN_LOG_HEADERS), INTERN_LOG_HEADERS)
    .filter(function (r) { return !internId || String(r.intern_id) === String(internId); })
    .map(function (r) { return { internId: String(r.intern_id), internName: String(r.intern_name), className: String(r['class']), period: Number(r.period), result: String(r.result), problems: String(r.problems), solutions: String(r.solutions), createdMs: Number(r.created_ms) }; }) };
}
function postSupervision(ss, payload) {
  var id = cleanInternId_(payload.internId);
  if (!id || !findIntern_(ss, id)) return { status: 'error', message: 'ไม่พบ นศ.' };
  var ratings = payload.ratings || {}, total = 0, clean = {};
  Object.keys(ratings).slice(0, 20).forEach(function (k) { var n = Math.max(0, Math.min(5, Number(ratings[k]) || 0)); clean[str_(k, 80)] = n; total += n; });
  getOrCreateSheet(ss, SUPERVISION_SHEET, SUPERVISION_HEADERS).appendRow([Utilities.getUuid(), Date.now(), id, str_(payload.className, 20), Number(payload.period) || '', JSON.stringify(clean), total, str_(payload.comments, 3000), str_(payload.mentor, 80)]);
  return { status: 'success', total: total };
}

/* ============================================================================
 * อัปโหลดไฟล์/คลิปจากมือถือนักเรียน → Google Drive ของครู (แบ่งเป็นชิ้น, ส่งต่อได้, ไม่ซ้ำ)
 * - ยืนยันตัวด้วยโทเค็นนักเรียน รหัสนักเรียนมาจากโทเค็นเท่านั้น
 * - ชิ้นงานพักไว้ใน Drive: MusicSmart_Upload_Staging/<uploadId>/c000000 …  (ไม่ใช้ CacheService เพราะจำกัด 100KB)
 * - ประกอบไฟล์ด้วย Drive API แบบ resumable (UrlFetchApp) ทีละชิ้น ไม่โหลดทั้งไฟล์เข้าหน่วยความจำ
 * - ไฟล์ปลายทางเป็นส่วนตัวของครู (เจ้าของสคริปต์) เว้นแต่ตั้ง DRIVE_SHARE_ANYONE_WITH_LINK = true
 * ============================================================================ */
var UPLOAD_ACTIONS = ['studentUploadStart', 'studentUploadChunk', 'studentUploadFinish', 'studentUploadStatus'];
var UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;        // 2 MB ต่อชิ้น (base64 ≈ 2.7 MB ต่อคำขอ; ต้องเป็นทวีคูณของ 256 KB)
var UPLOAD_MAX_BODY = 3 * 1024 * 1024;           // ขนาดคำขอสูงสุด (ตัวอักษร) ของการอัปโหลด
var UPLOAD_EXPIRE_HOURS = 24;                    // ชิ้นงานค้างเกินนี้ถูกล้างทิ้ง
var UPLOAD_SHEET = 'อัปโหลด_Uploads';
var UPLOAD_HEADERS = ['upload_id', 'student_id', 'class', 'period', 'purpose', 'file_name', 'ext', 'mime', 'size', 'chunk_size',
  'total_chunks', 'status', 'started_ms', 'finished_ms', 'staging_folder_id', 'file_id', 'file_url', 'day', 'error'];
var UPLOAD_ROOT_FOLDER = 'MusicSmart_Student_Uploads';
var UPLOAD_STAGING_FOLDER = 'MusicSmart_Upload_Staging';
// นามสกุล → ชนิด MIME ที่ยอมรับ + รูปแบบไบต์ต้นไฟล์ (magic) ที่ต้องตรง
var UPLOAD_TYPES = {
  jpg: { mimes: ['image/jpeg'], magic: 'jpeg' }, jpeg: { mimes: ['image/jpeg'], magic: 'jpeg' },
  png: { mimes: ['image/png'], magic: 'png' }, webp: { mimes: ['image/webp'], magic: 'webp' },
  heic: { mimes: ['image/heic', 'image/heif'], magic: 'heic' }, heif: { mimes: ['image/heic', 'image/heif'], magic: 'heic' },
  mp3: { mimes: ['audio/mpeg', 'audio/mp3'], magic: 'mp3' }, m4a: { mimes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'], magic: 'isobmff' },
  aac: { mimes: ['audio/aac', 'audio/x-aac'], magic: 'aac' }, wav: { mimes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], magic: 'wav' },
  ogg: { mimes: ['audio/ogg', 'application/ogg'], magic: 'ogg' }, mp4: { mimes: ['video/mp4'], magic: 'isobmff' },
  mov: { mimes: ['video/quicktime'], magic: 'isobmff' }, webm: { mimes: ['video/webm', 'audio/webm'], magic: 'webm' },
  pdf: { mimes: ['application/pdf'], magic: 'pdf' }
};

function uploadCfg_() {
  var p = PropertiesService.getScriptProperties();
  var num = function (k, d) { var v = Number(p.getProperty(k)); return v > 0 ? v : d; };
  return { maxBytes: num('UPLOAD_MAX_MB', 50) * 1024 * 1024, dailyBytes: num('UPLOAD_DAILY_MB', 300) * 1024 * 1024,
    dailyCount: num('UPLOAD_DAILY_COUNT', 20), shareLink: String(p.getProperty('DRIVE_SHARE_ANYONE_WITH_LINK') || '') === 'true' };
}

/** แชร์แบบทุกคนที่มีลิงก์เฉพาะเมื่อครูเปิดค่า DRIVE_SHARE_ANYONE_WITH_LINK=true (ค่าเริ่มต้น: ส่วนตัว) */
function applyDriveSharing_(file) {
  if (uploadCfg_().shareLink) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
}

function bangkokDay_(ms) { return new Date(ms + 7 * 3600000).toISOString().slice(0, 10); }

function sniffType_(bytes) {
  var b = function (i) { return i < bytes.length ? (bytes[i] + 256) % 256 : -1; };
  var s = function (i, n) { var o = ''; for (var k = 0; k < n; k++) o += String.fromCharCode(b(i + k)); return o; };
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return 'jpeg';
  if (s(0, 8) === '\\x89PNG\\r\\n\\x1a\\n') return 'png';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WAVE') return 'wav';
  if (s(0, 4) === '%PDF') return 'pdf';
  if (s(0, 4) === 'OggS') return 'ogg';
  if (b(0) === 0x1A && b(1) === 0x45 && b(2) === 0xDF && b(3) === 0xA3) return 'webm';
  if (s(4, 4) === 'ftyp') {
    var brand = s(8, 4);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(brand)) return 'heic';
    return 'isobmff';
  }
  if (s(0, 3) === 'ID3') return 'mp3';
  if (b(0) === 0xFF && (b(1) & 0xF6) === 0xF0) return 'aac';      // ADTS
  if (b(0) === 0xFF && (b(1) & 0xE0) === 0xE0) return 'mp3';      // MPEG audio frame
  return '';
}

function uploadSheet_(ss) { return getOrCreateSheet(ss, UPLOAD_SHEET, UPLOAD_HEADERS); }

function findUpload_(sheet, uploadId) {
  var vals = sheet.getDataRange().getValues();
  for (var r = 1; r < vals.length; r++) {
    if (String(vals[r][0]) !== uploadId) continue;
    var o = { _row: r + 1 };
    for (var c = 0; c < UPLOAD_HEADERS.length; c++) o[UPLOAD_HEADERS[c]] = vals[r][c];
    return o;
  }
  return null;
}

function updateUpload_(sheet, u, fields) {
  for (var k in fields) {
    if (!fields.hasOwnProperty(k)) continue;
    u[k] = fields[k];
    sheet.getRange(u._row, UPLOAD_HEADERS.indexOf(k) + 1, 1, 1).setValues([[fields[k]]]);
  }
}

function childFolder_(parent, name) {
  var it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function safeName_(s) { return String(s || '').replace(/[\\\\\\/:*?"<>|#%\\x00-\\x1f]/g, '_').slice(0, 60); }

function chunkName_(i) { return 'c' + ('000000' + i).slice(-6); }

function stagedChunks_(folder) {
  var out = {}, it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); var m = /^c(\\d{6})$/.exec(f.getName()); if (m) out[Number(m[1])] = f; }
  return out;
}

function trashStaging_(u) {
  if (!u.staging_folder_id) return;
  try { DriveApp.getFolderById(String(u.staging_folder_id)).setTrashed(true); } catch (e) { /* ลบไปแล้ว */ }
}

function uploadPublic_(u) {
  return { uploadId: String(u.upload_id), status: String(u.status), size: Number(u.size), chunkSize: Number(u.chunk_size),
    totalChunks: Number(u.total_chunks), fileUrl: String(u.file_url || ''), fileId: String(u.file_id || ''), fileName: String(u.file_name) };
}

function handleUploadAction(ss, payload) {
  if (!globalStudentThrottle_()) return { status: 'error', code: 'rate_limited', message: 'ระบบมีผู้ใช้จำนวนมาก กรุณารอสักครู่' };
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณากรอก PIN อีกครั้ง' };
  var sid = cleanId_(v.rec.student_id);
  var cid = String(payload.uploadId || '');
  if (!/^[A-Za-z0-9_-]{8,60}$/.test(cid)) return { status: 'error', code: 'bad_upload_id', message: 'รหัสการอัปโหลดไม่ถูกต้อง' };
  var uploadId = sid + '_' + cid;                     // ผูกกับนักเรียน: คนอื่นใช้รหัสเดียวกันไม่ได้
  var sheet = uploadSheet_(ss);
  var u = findUpload_(sheet, uploadId);
  if (payload.action === 'studentUploadStart') return uploadStart_(ss, sheet, v.rec, sid, uploadId, u, payload);
  if (!u) return { status: 'error', code: 'no_upload', message: 'ไม่พบการอัปโหลดนี้ กรุณาเริ่มใหม่' };
  if (payload.action === 'studentUploadStatus') return uploadStatus_(u);
  if (String(u.status) === 'done') return { status: 'success', done: true, upload: uploadPublic_(u) };
  if (String(u.status) !== 'open') return { status: 'error', code: 'upload_' + u.status, message: uploadErrText_(String(u.status), String(u.error)) };
  if (Date.now() - Number(u.started_ms) > UPLOAD_EXPIRE_HOURS * 3600000) {
    trashStaging_(u); updateUpload_(sheet, u, { status: 'expired' });
    return { status: 'error', code: 'upload_expired', message: 'การอัปโหลดค้างนานเกินไป กรุณาเริ่มใหม่' };
  }
  if (payload.action === 'studentUploadChunk') return uploadChunk_(sheet, u, payload);
  return uploadFinish_(ss, sheet, u);
}

function uploadErrText_(status, err) {
  if (status === 'rejected') return 'ไฟล์ไม่ตรงกับชนิดที่แจ้ง (' + err + ') กรุณาเลือกไฟล์ใหม่';
  if (status === 'expired') return 'การอัปโหลดค้างนานเกินไป กรุณาเริ่มใหม่';
  return 'อัปโหลดไม่สำเร็จ';
}

function uploadStart_(ss, sheet, rec, sid, uploadId, u, payload) {
  var cfg = uploadCfg_();
  var name = String(payload.fileName || '');
  var ext = (/\\.([A-Za-z0-9]{2,5})$/.exec(name) || [])[1];
  ext = ext ? ext.toLowerCase() : '';
  var t = UPLOAD_TYPES[ext];
  var mime = String(payload.mimeType || '').toLowerCase();
  var size = Number(payload.size);
  var period = Number(payload.period);
  var rawPurpose = String(payload.purpose || '');
  var purpose = (rawPurpose === 'recording' || rawPurpose === 'quiz' || rawPurpose === 'exam') ? rawPurpose : 'assignment';
  if (!t) return { status: 'error', code: 'bad_type', message: 'ไม่รองรับไฟล์ชนิดนี้ (รับ รูป jpg/png/heic/webp, เสียง mp3/m4a/aac/wav/ogg, วิดีโอ mp4/mov/webm, pdf)' };
  if (mime && t.mimes.indexOf(mime) === -1) return { status: 'error', code: 'type_mismatch', message: 'นามสกุลไฟล์กับชนิดไฟล์ไม่ตรงกัน' };
  if (!(size > 0) || Math.floor(size) !== size) return { status: 'error', code: 'bad_size', message: 'ขนาดไฟล์ไม่ถูกต้อง' };
  if (size > cfg.maxBytes) return { status: 'error', code: 'too_large', message: 'ไฟล์ใหญ่เกิน ' + Math.round(cfg.maxBytes / 1048576) + ' MB' };
  if (!(period >= 1 && period <= 40 && Math.floor(period) === period)) return { status: 'error', code: 'bad_period', message: 'คาบเรียนไม่ถูกต้อง' };
  if (u) {
    // เริ่มซ้ำด้วยรหัสเดิม = ทำต่อ (ต้องเป็นไฟล์เดิม)
    if (Number(u.size) !== size || String(u.ext) !== ext) return { status: 'error', code: 'upload_id_conflict', message: 'รหัสการอัปโหลดนี้ใช้กับไฟล์อื่นแล้ว' };
    var st = uploadStatus_(u);
    return st;
  }
  // โควตารายวัน (นับจากขนาดที่แจ้งตอนเริ่ม ไม่รวมที่ถูกปฏิเสธ)
  var today = bangkokDay_(Date.now()), usedBytes = 0, usedCount = 0;
  var vals = sheet.getDataRange().getValues();
  for (var r = 1; r < vals.length; r++) {
    if (cleanId_(vals[r][1]) !== sid || String(vals[r][17]) !== today || String(vals[r][11]) === 'rejected') continue;
    usedBytes += Number(vals[r][8]) || 0; usedCount++;
  }
  if (usedCount + 1 > cfg.dailyCount || usedBytes + size > cfg.dailyBytes) {
    return { status: 'error', code: 'quota', message: 'วันนี้อัปโหลดครบโควตาแล้ว (' + cfg.dailyCount + ' ไฟล์ / ' + Math.round(cfg.dailyBytes / 1048576) + ' MB) ลองใหม่พรุ่งนี้ หรือส่งเป็นลิงก์แทน' };
  }
  cleanupStaleUploads(5);   // ล้างของค้างไปด้วยเล็กน้อย
  var staging = childFolder_(childFolder_(null, UPLOAD_STAGING_FOLDER), uploadId);
  var now = Date.now();
  var profile = publicProfile_(rec);
  sheet.appendRow([uploadId, sid, profile.studentClass, period, purpose, safeName_(name), ext, t.mimes[0], size, UPLOAD_CHUNK_BYTES,
    Math.ceil(size / UPLOAD_CHUNK_BYTES), 'open', now, '', staging.getId(), '', '', today, '']);
  return uploadStatus_(findUpload_(sheet, uploadId));
}

function uploadStatus_(u) {
  var received = [];
  if (String(u.status) === 'open') {
    try { received = Object.keys(stagedChunks_(DriveApp.getFolderById(String(u.staging_folder_id)))).map(Number).sort(function (a, b) { return a - b; }); } catch (e) { received = []; }
  }
  return { status: 'success', upload: uploadPublic_(u), received: received, done: String(u.status) === 'done' };
}

function uploadChunk_(sheet, u, payload) {
  var n = Number(u.total_chunks), cs = Number(u.chunk_size), size = Number(u.size);
  var idx = Number(payload.index);
  if (!(idx >= 0 && idx < n && Math.floor(idx) === idx)) return { status: 'error', code: 'bad_index', message: 'ลำดับชิ้นไม่ถูกต้อง' };
  var b64 = String(payload.data || '');
  if (!/^[A-Za-z0-9+\\/=]+$/.test(b64)) return { status: 'error', code: 'bad_chunk', message: 'ข้อมูลชิ้นไม่ถูกต้อง' };
  var bytes = Utilities.base64Decode(b64);
  var expectLen = idx === n - 1 ? size - cs * (n - 1) : cs;
  if (bytes.length !== expectLen) return { status: 'error', code: 'bad_chunk_size', message: 'ขนาดชิ้นไม่ถูกต้อง' };
  if (idx === 0) {
    var kind = sniffType_(bytes);
    var want = UPLOAD_TYPES[String(u.ext)].magic;
    if (kind !== want) {
      trashStaging_(u);
      updateUpload_(sheet, u, { status: 'rejected', error: 'ไม่ใช่ไฟล์ ' + u.ext });
      return { status: 'error', code: 'type_mismatch', message: 'เนื้อไฟล์ไม่ใช่ ' + u.ext + ' จริง กรุณาเลือกไฟล์ใหม่' };
    }
  }
  var folder = DriveApp.getFolderById(String(u.staging_folder_id));
  var have = stagedChunks_(folder);
  if (have[idx]) {
    if (have[idx].getSize() === expectLen) return { status: 'success', index: idx, duplicate: true };
    have[idx].setTrashed(true);   // ชิ้นเดิมเสีย เขียนทับ
  }
  folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', chunkName_(idx)));
  return { status: 'success', index: idx };
}

function uploadFinish_(ss, sheet, u) {
  var sid = cleanId_(u.student_id);
  var uPeriod = Number(u.period);
  var isExamUpload = (String(u.purpose) === 'quiz' || String(u.purpose) === 'exam');
  if (isExamUpload) {
    var allowed = quizAllowedAttempts_(ss, sid, uPeriod);
    var doneCount = 0;
    var upVals = sheet.getDataRange().getValues();
    for (var r = 1; r < upVals.length; r++) {
      if (String(upVals[r][0]) === String(u.upload_id)) continue;
      var rPurpose = String(upVals[r][4] || '');
      if (cleanId_(upVals[r][1]) === sid && Number(upVals[r][3]) === uPeriod && String(upVals[r][11]) === 'done' && (rPurpose === 'quiz' || rPurpose === 'exam')) {
        doneCount++;
      }
    }
    var inboxVals = getOrCreateSheet(ss, STUDENT_INBOX_SHEET, STUDENT_INBOX_HEADERS).getDataRange().getValues();
    for (var ir = 1; ir < inboxVals.length; ir++) {
      if (cleanId_(inboxVals[ir][3]) === sid && String(inboxVals[ir][5]) === 'quiz' && Number(inboxVals[ir][6]) === uPeriod && String(inboxVals[ir][18]) !== 'true' && inboxVals[ir][18] !== true) {
        doneCount++;
      }
    }
    if (doneCount >= allowed) {
      return { status: 'error', code: 'duplicate_quiz', message: 'ส่งแบบทดสอบของคาบนี้ไปแล้ว ไม่สามารถส่งซ้ำได้ เว้นแต่ครูอนุญาตให้ส่งใหม่' };
    }
  }
  var folder = DriveApp.getFolderById(String(u.staging_folder_id));
  var have = stagedChunks_(folder), n = Number(u.total_chunks), missing = [];
  for (var i = 0; i < n; i++) if (!have[i]) missing.push(i);
  if (missing.length) return { status: 'error', code: 'missing_chunks', missing: missing.slice(0, 50), message: 'ยังส่งไม่ครบ ' + missing.length + ' ชิ้น' };
  var dest = childFolder_(childFolder_(childFolder_(null, UPLOAD_ROOT_FOLDER), safeName_(u['class'] || 'ไม่ระบุห้อง')), 'คาบ' + Number(u.period));
  var stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss');
  // ชื่อไฟล์ใช้รหัสนักเรียน ไม่ใช้ชื่อ
  var fileName = (u.purpose === 'recording' ? 'ฝึกซ้อม_' : 'งาน_') + cleanId_(u.student_id) + '_p' + Number(u.period) + '_' + stamp + '.' + u.ext;
  var token = ScriptApp.getOAuthToken();
  var init = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, 'X-Upload-Content-Type': String(u.mime), 'X-Upload-Content-Length': String(u.size) },
    payload: JSON.stringify({ name: fileName, parents: [dest.getId()], mimeType: String(u.mime) })
  });
  var hdr = init.getHeaders() || {};
  var session = hdr.Location || hdr.location;
  if (!session) return { status: 'error', code: 'drive_error', message: 'Drive ไม่ตอบรับ (' + init.getResponseCode() + ') ลองกดส่งใหม่' };
  var cs = Number(u.chunk_size), size = Number(u.size), fileId = '';
  for (var k = 0; k < n; k++) {
    var part = have[k].getBlob().getBytes();
    var start = k * cs, end = start + part.length - 1;
    var res = UrlFetchApp.fetch(session, { method: 'put', muteHttpExceptions: true, contentType: String(u.mime),
      headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + size }, payload: part });
    var code = res.getResponseCode();
    if (k < n - 1 && code !== 308) return { status: 'error', code: 'drive_error', message: 'Drive ขัดข้องระหว่างประกอบไฟล์ ลองกดส่งใหม่' };
    if (k === n - 1) {
      if (code !== 200 && code !== 201) return { status: 'error', code: 'drive_error', message: 'Drive ขัดข้อง (' + code + ') ลองกดส่งใหม่' };
      fileId = JSON.parse(res.getContentText()).id;
    }
  }
  var file = DriveApp.getFileById(fileId);
  applyDriveSharing_(file);
  updateUpload_(sheet, u, { status: 'done', finished_ms: Date.now(), file_id: fileId, file_url: file.getUrl() });
  trashStaging_(u);
  return { status: 'success', done: true, upload: uploadPublic_(u) };
}

/** ล้างชิ้นงานค้าง (เรียกจากทริกเกอร์ตามเวลา หรือระหว่างเริ่มอัปโหลด) */
function cleanupStaleUploads(maxItems) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = uploadSheet_(ss), vals = sheet.getDataRange().getValues(), cut = Date.now() - UPLOAD_EXPIRE_HOURS * 3600000, n = 0;
  var limit = Number(maxItems) > 0 ? Number(maxItems) : 1000;
  for (var r = 1; r < vals.length && n < limit; r++) {
    if (String(vals[r][11]) !== 'open' || Number(vals[r][12]) > cut) continue;
    var u = findUpload_(sheet, String(vals[r][0]));
    trashStaging_(u); updateUpload_(sheet, u, { status: 'expired' }); n++;
  }
  return n;
}

/** ครูกดรันครั้งเดียวในหน้า Apps Script: ตั้งทริกเกอร์ล้างชิ้นงานค้างทุก 6 ชั่วโมง */
function installUploadCleanupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cleanupStaleUploads') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cleanupStaleUploads').timeBased().everyHours(6).create();
  return 'ok';
}

/** ใช้ตอนส่งงาน: คืนลิงก์ไฟล์ที่อัปโหลดเสร็จแล้วของนักเรียนคนนี้ */
function resolveUpload_(ss, sid, cid) {
  if (!/^[A-Za-z0-9_-]{8,60}$/.test(String(cid || ''))) return null;
  var u = findUpload_(uploadSheet_(ss), sid + '_' + cid);
  return u && String(u.status) === 'done' && cleanId_(u.student_id) === sid ? u : null;
}

/* ============================================================================
 * เข้าสู่ระบบครูผ่านเซิร์ฟเวอร์ (Phase 6)
 * - รหัสผ่านครูเก็บเป็น hash (SHA-256 ×100 + salt + PIN_PEPPER) ใน Script Properties: TEACHER_AUTH (ไม่อยู่ในชีต/เว็บ)
 * - ตั้ง/รีเซ็ตรหัสผ่าน: ไม่มี action สาธารณะแล้ว (ตัด SYNC_TOKEN ออกจากการรีเซ็ต) → ครูรีเซ็ตทางอีเมลเท่านั้น (setTeacherPassword ใช้ภายในฟังก์ชันรีเซ็ตอีเมล)
 * - เข้าสู่ระบบสำเร็จ: คืน SYNC_TOKEN ให้เครื่องครู (เครื่องใหม่ตั้งค่าซิงค์อัตโนมัติ)
 * ============================================================================ */
var TEACHER_PUBLIC_ACTIONS = ['teacherLogin', 'teacherAuthStatus'];
var TEACHER_MAX_FAILS = 5;
var TEACHER_LOCK_MINUTES = 15;
var TEACHER_MIN_PASSWORD = 8;

function teacherAuth_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('TEACHER_AUTH') || 'null'); } catch (e) { return null; }
}
function saveTeacherAuth_(a) { PropertiesService.getScriptProperties().setProperty('TEACHER_AUTH', JSON.stringify(a)); }
function normEmail_(v) { return String(v || '').trim().toLowerCase(); }

function validateTeacherPassword_(pw) {
  if (pw.length < TEACHER_MIN_PASSWORD || pw.length > 128) return { status: 'error', code: 'weak_password', message: 'รหัสผ่านต้องยาว ' + TEACHER_MIN_PASSWORD + '–128 ตัวอักษร' };
  if (/^(.)\\1+$/.test(pw) || /^(12345678|password|ppk\\d+)/i.test(pw)) return { status: 'error', code: 'weak_password', message: 'รหัสผ่านเดาง่ายเกินไป' };
  return null;
}

function setTeacherPassword(payload) {
  var email = normEmail_(payload.email), pw = String(payload.password || '');
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return { status: 'error', code: 'bad_email', message: 'อีเมลไม่ถูกต้อง' };
  var pwErr = validateTeacherPassword_(pw);
  if (pwErr) return pwErr;
  var old = teacherAuth_() || {};
  var salt = Utilities.getUuid();
  saveTeacherAuth_({ email: email, name: str_(payload.name, 80) || old.name || '', salt: salt, hash: hashPin_('teacher:' + email, pw, salt),
    set_at: new Date().toISOString(), failed: 0, locked_until: 0 });
  return { status: 'success', email: email };
}

function handleTeacherPublicAction(payload) {
  if (!globalStudentThrottle_()) return { status: 'error', code: 'rate_limited', message: 'มีผู้ใช้จำนวนมาก กรุณารอสักครู่' };
  var a = teacherAuth_();
  if (payload.action === 'teacherAuthStatus') return { status: 'success', configured: !!(a && a.hash) };
  if (!a || !a.hash) return { status: 'error', code: 'not_configured', message: 'ยังไม่ได้ตั้งรหัสผ่านครูบนเซิร์ฟเวอร์' };
  var now = Date.now();
  if (Number(a.locked_until || 0) > now) return { status: 'error', code: 'locked', message: 'ใส่รหัสผิดหลายครั้ง ล็อก ' + TEACHER_LOCK_MINUTES + ' นาที' };
  var email = normEmail_(payload.email), pw = String(payload.password || '');
  var ok = email === a.email && pw.length > 0 && pw.length <= 128 && safeEqual_(hashPin_('teacher:' + a.email, pw, a.salt), a.hash);
  if (!ok) {
    a.failed = Number(a.failed || 0) + 1;
    if (a.failed >= TEACHER_MAX_FAILS) { a.locked_until = now + TEACHER_LOCK_MINUTES * 60000; a.failed = 0; }
    saveTeacherAuth_(a);
    return { status: 'error', code: 'wrong_password', message: 'อีเมลหรือรหัสผ่านครูไม่ถูกต้อง (ตรวจที่เซิร์ฟเวอร์) — ลืมรหัสผ่านให้กด "ลืมรหัสผ่าน?"' };
  }
  if (a.failed || a.locked_until) { a.failed = 0; a.locked_until = 0; saveTeacherAuth_(a); }
  return { status: 'success', email: a.email, name: a.name || '', passwordSetAt: a.set_at,
    syncToken: PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN') || '' };
}

/* ============================================================================
 * นศ. ลงทะเบียนเอง (Phase 6): สถานะ pending → ครูอนุมัติ (กำหนดห้อง) / ไม่อนุมัติ
 * ข้อมูลส่วนตัวอยู่ในชีต นศ_Interns เท่านั้น ส่งให้ครูที่มี SYNC_TOKEN, นศ. เห็นเฉพาะของตัวเองหลังเข้าสู่ระบบ
 * ============================================================================ */
var INTERN_REG_PER_HOUR = 20;
var INTERN_PROFILE_FIELDS = ['university', 'faculty', 'major', 'phone', 'email', 'term', 'academic_year', 'preferred_classes', 'mentor_name'];

function validateInternRegistration_(p) {
  var errs = [];
  var name = String(p.fullName || '').trim().replace(/\\s+/g, ' ');
  if (name.length < 4 || name.length > 80 || !/\\s/.test(name)) errs.push('ชื่อ-สกุล');
  var id = String(p.internId || '').trim();
  if (!/^[A-Za-z0-9_-]{5,20}$/.test(id)) errs.push('รหัสนักศึกษา (อังกฤษ/ตัวเลข 5–20 ตัว)');
  ['university', 'faculty', 'major'].forEach(function (k) { var v = String(p[k] || '').trim(); if (v.length < 2 || v.length > 120) errs.push({ university: 'มหาวิทยาลัย', faculty: 'คณะ', major: 'สาขา' }[k]); });
  var phone = String(p.phone || '').replace(/[\\s-]/g, '');
  if (!/^0\\d{8,9}$/.test(phone)) errs.push('เบอร์โทร (เช่น 0812345678)');
  var email = normEmail_(p.email);
  if (!/^[^\\s@]{1,64}@[^\\s@]+\\.[^\\s@]{2,}$/.test(email) || email.length > 120) errs.push('อีเมล');
  var term = String(p.term || '').trim();
  if (['1', '2', '3'].indexOf(term) === -1) errs.push('ภาคเรียน');
  var year = Number(p.academicYear);
  if (!(year >= 2560 && year <= 2600)) errs.push('ปีการศึกษา (พ.ศ.)');
  var pin = String(p.pin || '');
  if (!/^\\d{6}$/.test(pin) || /^(\\d)\\1{5}$/.test(pin) || pin === '123456' || pin === '654321') errs.push('PIN 6 หลัก (ห้ามเลขซ้ำ/เรียง)');
  var pref = (Object.prototype.toString.call(p.preferredClasses) === '[object Array]' ? p.preferredClasses : []).slice(0, 10).map(function (c) { return str_(c, 20); }).filter(String);
  var mentor = String(p.mentorName || '').trim();
  if (mentor.length > 80) errs.push('ครูพี่เลี้ยง');
  return { errs: errs, rec: { intern_id: id, name: name, university: str_(String(p.university).trim(), 120), faculty: str_(String(p.faculty).trim(), 120),
    major: str_(String(p.major).trim(), 120), phone: phone, email: email, term: term, academic_year: year, preferred_classes: pref.join(','), mentor_name: mentor }, pin: pin };
}

function internRegister_(ss, payload) {
  var cache = CacheService.getScriptCache();
  var hk = 'intern_reg_' + Math.floor(Date.now() / 3600000);
  var n = Number(cache.get(hk) || 0);
  if (n >= INTERN_REG_PER_HOUR) return { status: 'error', code: 'rate_limited', message: 'มีการลงทะเบียนจำนวนมาก กรุณาลองใหม่ภายหลัง' };
  cache.put(hk, String(n + 1), 3700);
  var v = validateInternRegistration_(payload);
  if (v.errs.length) return { status: 'error', code: 'invalid', fields: v.errs, message: 'กรุณาตรวจสอบ: ' + v.errs.join(', ') };
  var sheet = internSheet_(ss);
  ensureHeaders_(sheet, INTERN_HEADERS);
  var existing = findIntern_(ss, v.rec.intern_id);
  if (existing && String(existing.status || 'approved') !== 'rejected') {
    return { status: 'error', code: 'duplicate', message: String(existing.status) === 'pending' ? 'รหัสนักศึกษานี้ลงทะเบียนแล้ว รอครูอนุมัติ' : 'รหัสนักศึกษานี้มีบัญชีแล้ว หากลืม PIN ให้ครูรีเซ็ต' };
  }
  var salt = Utilities.getUuid(), now = new Date().toISOString();
  var rec = existing || { row: sheet.getDataRange().getValues().length + 1 };
  Object.keys(v.rec).forEach(function (k) { rec[k] = v.rec[k]; });
  rec.classes = ''; rec.salt = salt; rec.pin_hash = hashPin_('intern:' + v.rec.intern_id, v.pin, salt); rec.failed_count = 0; rec.locked_until = '';
  rec.pin_set_at = now; rec.active = true; rec.status = 'pending'; rec.registered_at = now; rec.decided_at = ''; rec.reject_reason = '';
  writeRow_(sheet, INTERN_HEADERS, rec);
  return { status: 'success', internId: v.rec.intern_id, message: 'ลงทะเบียนแล้ว รอครูประจำวิชาอนุมัติ' };
}

function internOwnProfile_(rec) {
  var o = { internId: String(rec.intern_id), name: String(rec.name), classes: internClasses_(rec), status: String(rec.status || 'approved') };
  INTERN_PROFILE_FIELDS.forEach(function (k) { o[k] = String(rec[k] === undefined ? '' : rec[k]); });
  return o;
}

function decideIntern(ss, payload) {
  var rec = findIntern_(ss, cleanInternId_(payload.internId));
  if (!rec) return { status: 'error', message: 'ไม่พบ นศ.' };
  if (payload.approve) {
    var classes = (payload.classes || []).map(function (c) { return str_(c, 20); }).filter(String);
    if (!classes.length) return { status: 'error', code: 'no_classes', message: 'กรุณาเลือกห้องที่มอบหมายอย่างน้อย 1 ห้อง' };
    rec.status = 'approved'; rec.classes = classes.join(','); rec.active = true; rec.reject_reason = '';
  } else {
    rec.status = 'rejected'; rec.reject_reason = str_(payload.reason, 300); rec.classes = '';
    rec.pin_set_at = new Date().toISOString();   // ยกเลิกโทเค็นที่อาจมีอยู่
  }
  rec.decided_at = new Date().toISOString();
  ensureHeaders_(internSheet_(ss), INTERN_HEADERS);
  writeRow_(internSheet_(ss), INTERN_HEADERS, rec);
  return { status: 'success', internId: String(rec.intern_id), state: rec.status };
}

/* ============================================================================
 * ลืมรหัสผ่าน / PIN — รีเซ็ตด้วยรหัสยืนยัน 6 หลัก (ทุกบทบาท: ครู/แอดมิน, นศ.ฝึกสอน, นักเรียน)
 *  1) ผู้ใช้ที่มีอีเมล: ระบบส่งรหัสยืนยันไปที่อีเมลที่ลงทะเบียนไว้ (หมดอายุ 15 นาที, ลองได้ 5 ครั้ง)
 *  2) นักเรียน (และ นศ.) ที่ไม่มีอีเมล: กด "ลืมรหัส" → เกิดคำขอรอครู → ครูกดยืนยันในแผงครู
 *     → ระบบออกรหัสยืนยันให้ครู (แสดงครั้งเดียว) → ครูแจ้งผู้ใช้ → ผู้ใช้ตั้งรหัสใหม่เอง
 *  - รหัสยืนยันเก็บเป็น hash เท่านั้น (ชีต รีเซ็ตรหัส_PasswordResets) ไม่เก็บรหัสจริง
 *  - อีเมลที่เป็นแอดมินครู: ADMIN_TEACHER_EMAILS + อีเมลบัญชีครูบนเซิร์ฟเวอร์ + เจ้าของสคริปต์
 *    + Script Property ADMIN_EMAILS (คั่นด้วย , ได้หลายอีเมล)
 *  - ต้องอนุญาตสิทธิ์ส่งอีเมล (MailApp) หนึ่งครั้ง: รันฟังก์ชัน authorizeEmailScope ในตัวแก้ไข Apps Script
 * ============================================================================ */
var PASSWORD_RESET_PUBLIC_ACTIONS = ['resetRequest', 'resetConfirm'];
var RESET_SHEET = 'รีเซ็ตรหัส_PasswordResets';
var RESET_HEADERS = ['request_id', 'role', 'subject', 'kind', 'status', 'code_hash', 'salt', 'email', 'created_ms', 'expires_ms', 'attempts', 'decided_ms', 'used_ms'];
var RESET_EMAIL_TTL_MIN = 15;            // รหัสที่ส่งทางอีเมลใช้ได้กี่นาที
var RESET_TEACHER_CODE_TTL_HOURS = 24;   // รหัสที่ครูออกให้ใช้ได้กี่ชั่วโมง
var RESET_PENDING_TTL_DAYS = 14;         // คำขอที่ครูยังไม่ตอบ ค้างได้กี่วัน
var RESET_MAX_ATTEMPTS = 5;              // ใส่รหัสผิดได้กี่ครั้งต่อรหัส
var RESET_REQUESTS_PER_HOUR = 3;         // ขอรหัสได้กี่ครั้งต่อบัญชีต่อชั่วโมง (กันถล่มอีเมล)
var ADMIN_TEACHER_EMAILS = ['krumum.piano@gmail.com'];
var MAIL_SENDER_NAME = 'MusicSmart PPK';

function isValidEmail_(e) { return /^[^\\s@]{1,64}@[^\\s@]+\\.[^\\s@]{2,}$/.test(e) && e.length <= 120; }

function maskEmail_(e) {
  var p = String(e || '').split('@');
  var l = p[0] || '';
  return l.charAt(0) + '•••' + (l.length > 2 ? l.charAt(l.length - 1) : '') + '@' + (p[1] || '');
}

/** เรียกครั้งเดียวจากตัวแก้ไข Apps Script เพื่อให้เจ้าของสคริปต์อนุญาตสิทธิ์ส่งอีเมล */
function authorizeEmailScope() { return MailApp.getRemainingDailyQuota(); }

/** อีเมลที่ถือว่าเป็นครู/แอดมิน (ใช้รีเซ็ตรหัสผ่านครูทางอีเมลได้) */
function teacherEmails_() {
  var out = [], seen = {};
  function add(v) { var e = normEmail_(v); if (isValidEmail_(e) && !seen[e]) { seen[e] = true; out.push(e); } }
  ADMIN_TEACHER_EMAILS.forEach(add);
  var a = teacherAuth_();
  if (a && a.email) add(a.email);
  var extra = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS');
  if (extra) String(extra).split(/[,;\\s]+/).forEach(add);
  try { if (typeof Session !== 'undefined') add(Session.getEffectiveUser().getEmail()); } catch (e) { /* ไม่มีสิทธิ์อ่านอีเมลเจ้าของ */ }
  return out;
}

function resetSheet_(ss) { return getOrCreateSheet(ss, RESET_SHEET, RESET_HEADERS); }
// ชีตแปลงสตริงตัวเลขเป็นตัวเลข (รหัสที่ขึ้นต้นด้วย 0 หาย) จึงใส่ตัวอักษรนำหน้า S/I/T ให้ subject เสมอ
function subjKey_(role, subject) { return { student: 'S', intern: 'I', teacher: 'T' }[role] + String(subject); }
function subjOf_(key) { return String(key).slice(1); }

function newResetCode_() {
  var h = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + ':' + Date.now() + ':' + Math.random(), Utilities.Charset.UTF_8));
  var n = parseInt(h.slice(0, 10), 16) % 1000000;
  return ('000000' + n).slice(-6);
}

function resetCodeHash_(key, code, salt) { return hashPin_('reset:' + key, code, salt); }

function resetThrottle_(scope, value) {
  var cache = CacheService.getScriptCache();
  var h = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, scope + ':' + value, Utilities.Charset.UTF_8)).slice(0, 40);
  var key = 'rst_' + h + '_' + Math.floor(Date.now() / 3600000);
  var n = Number(cache.get(key) || 0);
  if (n >= RESET_REQUESTS_PER_HOUR) return false;
  cache.put(key, String(n + 1), 3700);
  return true;
}

function resetRowOpen_(r, now) {
  var st = String(r.status);
  if (st === 'sent' || st === 'approved') return Number(r.expires_ms) > now;
  if (st === 'pending') return Number(r.created_ms) + RESET_PENDING_TTL_DAYS * 86400000 > now;
  return false;
}

function addResetRow_(ss, rec) {
  resetSheet_(ss).appendRow(RESET_HEADERS.map(function (h) { return rec[h] === undefined ? '' : rec[h]; }));
}

/** ยกเลิกคำขอ/รหัสเดิมของบัญชีนี้ (kinds = ชนิดที่จะยกเลิก) */
function supersedeResets_(ss, key, kinds) {
  var sheet = resetSheet_(ss);
  rowsOf_(sheet, RESET_HEADERS).forEach(function (r) {
    if (String(r.subject) !== key || kinds.indexOf(String(r.kind)) === -1) return;
    if (['sent', 'approved', 'pending'].indexOf(String(r.status)) === -1) return;
    r.status = 'superseded';
    writeRow_(sheet, RESET_HEADERS, r);
  });
}

/** ลบแถวเก่าที่ปิดแล้ว (ไม่ลบคำขอที่ยังเปิดอยู่) เพื่อไม่ให้ชีตโตไม่จำกัด */
function cleanupResetRows_(ss) {
  var sheet = resetSheet_(ss), now = Date.now();
  var rows = rowsOf_(sheet, RESET_HEADERS);
  if (rows.length < 150) return;
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (!resetRowOpen_(r, now) && Number(r.created_ms) + 7 * 86400000 < now) sheet.deleteRow(r.row);
  }
}

function sendResetMail_(to, subject, body) {
  try {
    MailApp.sendEmail({ to: to, subject: subject, body: body, name: MAIL_SENDER_NAME });
    return true;
  } catch (e) {
    try { if (typeof Logger !== 'undefined') Logger.log('sendResetMail_ failed: ' + e); } catch (e2) { /* ignore */ }
    return false;
  }
}

function resetMailBody_(purposeTh, code, minutes) {
  return 'รหัสยืนยันสำหรับ' + purposeTh + ' คือ\\n\\n    ' + code + '\\n\\n' +
    'รหัสนี้ใช้ได้ภายใน ' + minutes + ' นาที และใช้ได้เพียงครั้งเดียว\\n' +
    'ห้ามบอกรหัสนี้กับผู้อื่น (ครูจะไม่ขอรหัสนี้จากนักเรียน)\\n' +
    'หากคุณไม่ได้เป็นผู้ขอ ให้เพิกเฉยอีเมลนี้ รหัสผ่านเดิมของคุณจะไม่ถูกเปลี่ยน\\n\\n' +
    '— MusicSmart โรงเรียนพะเยาพิทยาคม';
}

/** หา "ครู/นศ." จากอีเมลหรือรหัส นศ. ที่ผู้ใช้พิมพ์ (คืน null ถ้าไม่พบ) */
function resolveStaff_(ss, identifier) {
  var raw = String(identifier || '').trim();
  var email = normEmail_(raw);
  if (isValidEmail_(email) && teacherEmails_().indexOf(email) !== -1) return { role: 'teacher', subject: email, email: email };
  var iid = cleanInternId_(raw);
  var list = rowsOf_(internSheet_(ss), INTERN_HEADERS);
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.active === false) continue;
    if ((iid && String(r.intern_id) === iid) || (isValidEmail_(email) && normEmail_(r.email) === email)) {
      var re = normEmail_(r.email);
      return { role: 'intern', subject: String(r.intern_id), email: isValidEmail_(re) ? re : '', rec: r };
    }
  }
  return null;
}

function isWeakPin_(pin) { return /^(\\d)\\1{5}$/.test(pin) || pin === '123456' || pin === '654321'; }

/** ตรวจรหัสใหม่ตามบทบาท คืนข้อความผิดพลาดหรือ null */
function validateNewSecret_(role, secret) {
  if (role === 'teacher') return validateTeacherPassword_(secret);
  if (!/^\\d{6}$/.test(secret)) return { status: 'error', code: 'bad_pin', message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก' };
  if (isWeakPin_(secret)) return { status: 'error', code: 'weak_pin', message: 'PIN เดาง่ายเกินไป (ห้ามเลขซ้ำทั้งหมด/เรียงลำดับ)' };
  return null;
}

function handlePasswordResetPublic_(ss, payload) {
  if (!globalStudentThrottle_()) return { status: 'error', code: 'rate_limited', message: 'มีการใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่' };
  if (payload.action === 'resetRequest') return passwordResetRequest_(ss, payload);
  return passwordResetConfirm_(ss, payload);
}

var RESET_GENERIC_STAFF_MSG = 'หากอีเมล/รหัสนี้มีบัญชีในระบบ ระบบได้ส่งรหัสยืนยัน 6 หลักไปยังอีเมลที่ลงทะเบียนไว้แล้ว (ตรวจสอบกล่องจดหมายขยะด้วย) — หากไม่มีอีเมลหรือไม่ได้รับ ให้ นศ. กด "ขอให้ครูรีเซ็ตให้"';

function passwordResetRequest_(ss, payload) {
  var via = payload.via === 'teacher' ? 'teacher' : 'email';
  var now = Date.now();
  if (payload.role === 'student') {
    var sid = cleanId_(payload.id);
    if (!/^\\d{4,10}$/.test(sid)) return { status: 'error', code: 'bad_id', message: 'รูปแบบรหัสนักเรียนไม่ถูกต้อง' };
    var rec = findStudentRow_(getStudentSheet_(ss), sid);
    if (!rec) return { status: 'error', code: 'not_found', message: 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาแจ้งคุณครู' };
    if (!resetThrottle_('student', sid)) return { status: 'error', code: 'rate_limited', message: 'ขอรหัสบ่อยเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่ หรือแจ้งคุณครู' };
    var em = normEmail_(rec.email);
    if (via === 'email' && isValidEmail_(em)) {
      var sent = issueEmailReset_(ss, 'student', sid, em, 'รีเซ็ตรหัส PIN นักเรียน');
      if (!sent) return { status: 'error', code: 'mail_failed', message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ หรือกด "ขอให้ครูรีเซ็ตให้"' };
      return { status: 'success', mode: 'email', maskedEmail: maskEmail_(em), expiresMin: RESET_EMAIL_TTL_MIN };
    }
    return openTeacherReset_(ss, 'student', sid, !isValidEmail_(em));
  }

  // ครู/นศ.: ตอบแบบเดียวกันเสมอ ไม่เปิดเผยว่ามีบัญชีหรือไม่
  var ident = String(payload.id || '').trim();
  if (!ident || ident.length > 120) return { status: 'error', code: 'bad_id', message: 'กรุณาระบุอีเมล หรือรหัสนักศึกษา' };
  if (!resetThrottle_('staff', ident.toLowerCase())) return { status: 'error', code: 'rate_limited', message: 'ขอรหัสบ่อยเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่' };
  var who = resolveStaff_(ss, ident);
  var generic = { status: 'success', mode: 'generic', expiresMin: RESET_EMAIL_TTL_MIN, message: RESET_GENERIC_STAFF_MSG };
  if (!who) return generic;
  if (who.role === 'teacher') {
    if (via === 'email') issueEmailReset_(ss, 'teacher', who.subject, who.email, 'ตั้งรหัสผ่านครูใหม่ (MusicSmart)');
    return generic;
  }
  // นศ.ฝึกสอน: ถ้าไม่มีอีเมล หรือเลือกให้ครูรีเซ็ต → ส่งคำขอถึงครูพี่เลี้ยง
  if (via === 'teacher' || !who.email) {
    openTeacherReset_(ss, 'intern', who.subject, !who.email);
    return { status: 'success', mode: 'teacher', message: 'ส่งคำขอรีเซ็ต PIN ถึงครูประจำวิชาแล้ว กรุณาติดต่อครูเพื่อรับรหัสยืนยัน' };
  }
  issueEmailReset_(ss, 'intern', who.subject, who.email, 'รีเซ็ต PIN นักศึกษาฝึกสอน (MusicSmart)');
  return generic;
}

/** ออกรหัสและส่งอีเมล (ถ้าส่งไม่สำเร็จ ไม่บันทึกรหัส) */
function issueEmailReset_(ss, role, subject, email, purposeTh) {
  var key = subjKey_(role, subject);
  var code = newResetCode_(), salt = Utilities.getUuid(), now = Date.now();
  if (!sendResetMail_(email, '[MusicSmart] รหัสยืนยัน ' + code, resetMailBody_(purposeTh, code, RESET_EMAIL_TTL_MIN))) return false;
  cleanupResetRows_(ss);
  supersedeResets_(ss, key, ['email']);
  addResetRow_(ss, { request_id: Utilities.getUuid(), role: role, subject: key, kind: 'email', status: 'sent', code_hash: resetCodeHash_(key, code, salt), salt: salt,
    email: '', created_ms: now, expires_ms: now + RESET_EMAIL_TTL_MIN * 60000, attempts: 0 });
  return true;
}

/** สร้างคำขอให้ครูรีเซ็ต (หนึ่งคำขอที่เปิดอยู่ต่อบัญชี) */
function openTeacherReset_(ss, role, subject, noEmail) {
  var key = subjKey_(role, subject), now = Date.now();
  var msg = 'ส่งคำขอรีเซ็ตรหัส PIN ถึงครูประจำวิชาแล้ว กรุณาติดต่อครูเพื่อรับรหัสยืนยัน แล้วกลับมากรอกรหัสที่หน้านี้เพื่อตั้ง PIN ใหม่ด้วยตนเอง';
  var existing = rowsOf_(resetSheet_(ss), RESET_HEADERS).filter(function (r) {
    return String(r.subject) === key && String(r.kind) === 'teacher' && resetRowOpen_(r, now);
  });
  if (existing.length) return { status: 'success', mode: 'teacher', existing: true, noEmail: !!noEmail, message: msg };
  cleanupResetRows_(ss);
  addResetRow_(ss, { request_id: Utilities.getUuid(), role: role, subject: key, kind: 'teacher', status: 'pending', created_ms: now, attempts: 0 });
  return { status: 'success', mode: 'teacher', existing: false, noEmail: !!noEmail, message: msg };
}

function passwordResetConfirm_(ss, payload) {
  var bad = { status: 'error', code: 'invalid_code', message: 'รหัสยืนยันไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาขอรหัสใหม่' };
  var role, subject;
  if (payload.role === 'student') {
    role = 'student'; subject = cleanId_(payload.id);
    if (!/^\\d{4,10}$/.test(subject)) return { status: 'error', code: 'bad_id', message: 'รูปแบบรหัสนักเรียนไม่ถูกต้อง' };
  } else {
    var who = resolveStaff_(ss, payload.id);
    if (!who) return bad;
    role = who.role; subject = who.subject;
  }
  var code = String(payload.code === undefined || payload.code === null ? '' : payload.code).replace(/\\s+/g, '');
  var secret = String(payload.secret === undefined || payload.secret === null ? '' : payload.secret);
  if (!/^\\d{6}$/.test(code)) return { status: 'error', code: 'bad_code', message: 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก' };
  var weak = validateNewSecret_(role, secret);   // ตรวจก่อนนับครั้งที่ลอง เพื่อไม่ให้รหัสใหม่ที่ไม่ผ่านเกณฑ์ใช้รหัสยืนยันหมด
  if (weak) return weak;

  var key = subjKey_(role, subject), now = Date.now();
  var sheet = resetSheet_(ss);
  var open = rowsOf_(sheet, RESET_HEADERS).filter(function (r) {
    return String(r.subject) === key && String(r.kind) !== 'bind' && (String(r.status) === 'sent' || String(r.status) === 'approved') && Number(r.expires_ms) > now;
  });
  if (!open.length) return bad;
  var match = null;
  for (var i = 0; i < open.length; i++) {
    if (safeEqual_(resetCodeHash_(key, code, String(open[i].salt)), String(open[i].code_hash))) { match = open[i]; break; }
  }
  if (!match) {
    var left = RESET_MAX_ATTEMPTS;
    open.forEach(function (r) {
      r.attempts = Number(r.attempts || 0) + 1;
      if (r.attempts >= RESET_MAX_ATTEMPTS) r.status = 'burned';
      left = Math.min(left, Math.max(0, RESET_MAX_ATTEMPTS - r.attempts));
      writeRow_(sheet, RESET_HEADERS, r);
    });
    return { status: 'error', code: 'invalid_code', attemptsLeft: left,
      message: left > 0 ? 'รหัสยืนยันไม่ถูกต้อง (เหลืออีก ' + left + ' ครั้ง)' : 'ใส่รหัสผิดหลายครั้ง รหัสนี้ถูกยกเลิกแล้ว กรุณาขอรหัสใหม่' };
  }
  var applied = applyNewSecret_(ss, role, subject, secret);
  if (applied.status !== 'success') return applied;
  match.status = 'used'; match.used_ms = now;
  writeRow_(sheet, RESET_HEADERS, match);
  supersedeResets_(ss, key, ['email', 'teacher']);
  return { status: 'success', role: role, message: 'ตั้งรหัสใหม่เรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสใหม่' };
}

function applyNewSecret_(ss, role, subject, secret) {
  var now = new Date().toISOString();
  if (role === 'teacher') {
    return setTeacherPassword({ email: subject, password: secret });
  }
  if (role === 'student') {
    var sheet = getStudentSheet_(ss), rec = findStudentRow_(sheet, subject);
    if (!rec) return { status: 'error', code: 'not_found', message: 'ไม่พบรหัสนักเรียนนี้ในระบบ' };
    rec.salt = Utilities.getUuid(); rec.pin_hash = hashPin_(subject, secret, rec.salt);
    rec.failed_count = 0; rec.locked_until = ''; rec.pin_set_at = now;   // pin_set_at เปลี่ยน → โทเค็นเก่าของนักเรียนใช้ไม่ได้
    writeStudentRow_(sheet, rec);
    return { status: 'success' };
  }
  var irec = findIntern_(ss, subject);
  if (!irec) return { status: 'error', code: 'not_found', message: 'ไม่พบบัญชี นศ.' };
  irec.salt = Utilities.getUuid(); irec.pin_hash = hashPin_('intern:' + irec.intern_id, secret, irec.salt);
  irec.failed_count = 0; irec.locked_until = ''; irec.pin_set_at = now;
  writeRow_(internSheet_(ss), INTERN_HEADERS, irec);
  return { status: 'success' };
}

// ---- ฝั่งครู (ต้องใช้ SYNC_TOKEN): ดูคำขอ / ยืนยันออกรหัส / ปฏิเสธ ----
function listResetRequests_(ss) {
  var now = Date.now();
  var out = rowsOf_(resetSheet_(ss), RESET_HEADERS).filter(function (r) {
    return String(r.kind) === 'teacher' && (String(r.status) === 'pending' || String(r.status) === 'approved') && resetRowOpen_(r, now);
  }).map(function (r) {
    var role = String(r.role), id = subjOf_(r.subject), name = '', cls = '';
    if (role === 'student') {
      var s = findStudentRow_(getStudentSheet_(ss), id);
      if (s) { name = String(s.prefix || '') + String(s.first_name || '') + ' ' + String(s.last_name || ''); cls = String(s['class'] || ''); }
    } else {
      var i = findIntern_(ss, id);
      if (i) { name = String(i.name || ''); cls = internClasses_(i).join(', '); }
    }
    return { id: String(r.request_id), role: role, subjectId: id, name: name, className: cls, status: String(r.status),
      createdMs: Number(r.created_ms), expiresMs: String(r.status) === 'approved' ? Number(r.expires_ms) : 0 };
  });
  out.sort(function (a, b) { return a.createdMs - b.createdMs; });
  return { status: 'success', requests: out };
}

function decideResetRequest_(ss, payload) {
  var sheet = resetSheet_(ss), now = Date.now();
  var rows = rowsOf_(sheet, RESET_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.request_id) !== String(payload.requestId) || String(r.kind) !== 'teacher') continue;
    if (!resetRowOpen_(r, now) || (String(r.status) !== 'pending' && String(r.status) !== 'approved')) return { status: 'error', code: 'closed', message: 'คำขอนี้ปิดแล้วหรือหมดอายุ' };
    var id = subjOf_(r.subject);
    if (!payload.approve) {
      r.status = 'rejected'; r.decided_ms = now;
      writeRow_(sheet, RESET_HEADERS, r);
      return { status: 'success', requestId: String(r.request_id), state: 'rejected' };
    }
    var code = newResetCode_(), salt = Utilities.getUuid();
    r.status = 'approved'; r.salt = salt; r.code_hash = resetCodeHash_(String(r.subject), code, salt);
    r.decided_ms = now; r.expires_ms = now + RESET_TEACHER_CODE_TTL_HOURS * 3600000; r.attempts = 0;
    writeRow_(sheet, RESET_HEADERS, r);
    return { status: 'success', requestId: String(r.request_id), state: 'approved', role: String(r.role), subjectId: id, code: code, expiresMs: r.expires_ms };
  }
  return { status: 'error', code: 'not_found', message: 'ไม่พบคำขอ' };
}

// ---- นักเรียนผูกอีเมลของตนเอง (ยืนยันเจ้าของอีเมลด้วยรหัสก่อนบันทึก กันพิมพ์ผิดแล้วรหัสไปถึงคนอื่น) ----
function studentEmailAction_(ss, payload) {
  var v = verifySessionToken_(ss, payload.sessionToken);
  if (v.error) return { status: 'error', code: v.error, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  var rec = v.rec, sid = cleanId_(rec.student_id), key = subjKey_('student', sid);
  var cur = normEmail_(rec.email);
  if (payload.action === 'studentEmailStatus') {
    return { status: 'success', hasEmail: isValidEmail_(cur), maskedEmail: isValidEmail_(cur) ? maskEmail_(cur) : '' };
  }
  var now = Date.now();
  if (payload.action === 'studentEmailStart') {
    var email = normEmail_(payload.email);
    if (!isValidEmail_(email)) return { status: 'error', code: 'bad_email', message: 'อีเมลไม่ถูกต้อง' };
    if (!resetThrottle_('bind', sid)) return { status: 'error', code: 'rate_limited', message: 'ขอรหัสบ่อยเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่' };
    var code = newResetCode_(), salt = Utilities.getUuid();
    if (!sendResetMail_(email, '[MusicSmart] ยืนยันอีเมล ' + code, resetMailBody_('ยืนยันอีเมลสำหรับกู้รหัส PIN นักเรียน', code, RESET_EMAIL_TTL_MIN))) {
      return { status: 'error', code: 'mail_failed', message: 'ส่งอีเมลไม่สำเร็จ ตรวจสอบอีเมลแล้วลองใหม่' };
    }
    cleanupResetRows_(ss);
    supersedeResets_(ss, key, ['bind']);
    addResetRow_(ss, { request_id: Utilities.getUuid(), role: 'student', subject: key, kind: 'bind', status: 'sent', code_hash: resetCodeHash_(key + ':bind', code, salt), salt: salt,
      email: email, created_ms: now, expires_ms: now + RESET_EMAIL_TTL_MIN * 60000, attempts: 0 });
    return { status: 'success', maskedEmail: maskEmail_(email), expiresMin: RESET_EMAIL_TTL_MIN };
  }
  // studentEmailConfirm
  var code2 = String(payload.code === undefined || payload.code === null ? '' : payload.code).replace(/\\s+/g, '');
  if (!/^\\d{6}$/.test(code2)) return { status: 'error', code: 'bad_code', message: 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก' };
  var sheet = resetSheet_(ss);
  var rows = rowsOf_(sheet, RESET_HEADERS).filter(function (r) {
    return String(r.subject) === key && String(r.kind) === 'bind' && String(r.status) === 'sent' && Number(r.expires_ms) > now;
  });
  if (!rows.length) return { status: 'error', code: 'invalid_code', message: 'รหัสยืนยันไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาขอรหัสใหม่' };
  var row = rows[rows.length - 1];
  if (!safeEqual_(resetCodeHash_(key + ':bind', code2, String(row.salt)), String(row.code_hash))) {
    row.attempts = Number(row.attempts || 0) + 1;
    if (row.attempts >= RESET_MAX_ATTEMPTS) row.status = 'burned';
    writeRow_(sheet, RESET_HEADERS, row);
    var left = Math.max(0, RESET_MAX_ATTEMPTS - row.attempts);
    return { status: 'error', code: 'invalid_code', attemptsLeft: left, message: left > 0 ? 'รหัสยืนยันไม่ถูกต้อง (เหลืออีก ' + left + ' ครั้ง)' : 'ใส่รหัสผิดหลายครั้ง กรุณาขอรหัสใหม่' };
  }
  var ssheet = getStudentSheet_(ss), cur2 = findStudentRow_(ssheet, sid);
  if (!cur2) return { status: 'error', code: 'not_found', message: 'ไม่พบบัญชี' };
  cur2.email = String(row.email);
  writeStudentRow_(ssheet, cur2);
  row.status = 'used'; row.used_ms = now;
  writeRow_(sheet, RESET_HEADERS, row);
  return { status: 'success', hasEmail: true, maskedEmail: maskEmail_(String(row.email)) };
}

/* ============================================================================
 * ระบบรูปโปรไฟล์นักเรียนและครู (เก็บไฟล์ใน Google Drive ตามระบบเดิม + ซิงค์ผ่านชีต)
 * ============================================================================ */
var AVATAR_SHEET = 'โปรไฟล์_Avatars';
var AVATAR_HEADERS = ['target_key', 'role', 'owner_id', 'class', 'file_id', 'file_url', 'thumb_data_url', 'updated_ms'];
var AVATAR_FOLDER_NAME = 'โปรไฟล์_Avatars';
var AVATAR_MAX_BYTES = 200 * 1024;

function checkAvatarAuth_(ss, payload) {
  var expectedToken = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (expectedToken && payload && (payload.token === expectedToken || payload.syncToken === expectedToken)) {
    return { role: 'teacher' };
  }
  if (payload && payload.sessionToken) {
    var sv = verifySessionToken_(ss, payload.sessionToken);
    if (sv && sv.rec) {
      return {
        role: 'student',
        studentId: cleanId_(sv.rec.student_id),
        studentClass: String(sv.rec['class'] || ''),
        rec: sv.rec
      };
    }
    var iv = verifyInternToken_(ss, payload.sessionToken);
    if (iv && iv.rec) {
      return {
        role: 'intern',
        internId: String(iv.rec.intern_id),
        classes: iv.classes || [],
        rec: iv.rec
      };
    }
    return { error: (sv && sv.error) || 'bad_session' };
  }
  return { error: 'unauthorized' };
}

function uploadProfileAvatar_(ss, payload) {
  var auth = checkAvatarAuth_(ss, payload);
  if (auth.error) return { status: 'error', code: auth.error, message: 'กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปโปรไฟล์' };

  var targetKey = str_(payload.targetKey, 80).replace(/[^A-Za-z0-9_.@-]/g, '_');
  var role = payload.role === 'teacher' ? 'teacher' : 'student';
  var ownerId = str_(payload.ownerId || targetKey, 80);
  var cls = str_(payload.className || '', 20);

  if (auth.role === 'student') {
    if (payload.role === 'teacher' || (payload.ownerId && cleanId_(payload.ownerId) !== auth.studentId) || (targetKey && targetKey !== 'student_' + auth.studentId)) {
      return { status: 'error', code: 'forbidden', message: 'นักเรียนอัปโหลดได้เฉพาะรูปโปรไฟล์ของตนเองเท่านั้น' };
    }
    role = 'student';
    ownerId = auth.studentId;
    targetKey = 'student_' + auth.studentId;
    cls = auth.studentClass;
  } else if (auth.role === 'intern') {
    var expectedInternKey = 'intern_' + safeName_(auth.internId);
    if (payload.role === 'student' || (payload.ownerId && String(payload.ownerId) !== auth.internId) || (targetKey && targetKey !== expectedInternKey && targetKey !== 'teacher_' + safeName_(auth.internId))) {
      return { status: 'error', code: 'forbidden', message: 'นักศึกษาฝึกสอนอัปโหลดได้เฉพาะรูปโปรไฟล์ของตนเองเท่านั้น' };
    }
    role = 'teacher';
    ownerId = auth.internId;
    if (!targetKey) targetKey = expectedInternKey;
  }

  if (!targetKey) return { status: 'error', code: 'bad_target', message: 'ไม่พบรหัสผู้ใช้สำหรับอัปโหลดรูปโปรไฟล์' };

  var mime = String(payload.mimeType || '').toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) === -1) {
    return { status: 'error', code: 'bad_type', message: 'รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP เท่านั้น' };
  }
  var ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  var b64 = String(payload.base64Data || '');
  var thumb = String(payload.thumbDataUrl || '');
  if (!b64 && thumb.indexOf('base64,') !== -1) b64 = thumb.split('base64,')[1];
  if (!b64 || b64.length > 300000 || !/^[A-Za-z0-9+\\/=\\r\\n]+$/.test(b64)) {
    return { status: 'error', code: 'bad_image', message: 'ข้อมูลรูปภาพไม่ถูกต้องหรือมีขนาดใหญ่เกินไป' };
  }
  if (thumb && (thumb.length > 48000 || !/^data:image\\/(jpeg|png|webp);base64,/i.test(thumb))) {
    return { status: 'error', code: 'bad_image', message: 'ข้อมูลรูปตัวอย่างไม่ถูกต้องหรือใหญ่เกินกำหนด' };
  }

  var bytes = null;
  try {
    bytes = Utilities.base64Decode(b64.replace(/[\\r\\n]/g, ''));
  } catch (e) {
    return { status: 'error', code: 'bad_image', message: 'ถอดรหัสรูปภาพไม่สำเร็จ' };
  }
  if (!bytes || !bytes.length || bytes.length > AVATAR_MAX_BYTES) {
    return { status: 'error', code: bytes && bytes.length > AVATAR_MAX_BYTES ? 'too_large' : 'bad_image', message: 'ขนาดไฟล์รูปภาพต้องไม่เกิน 200 KB' };
  }
  var magic = sniffType_(bytes);
  var wantMagic = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpeg');
  if (magic !== wantMagic) {
    return { status: 'error', code: 'bad_type', message: 'เนื้อไฟล์รูปภาพไม่ตรงกับชนิดที่ระบุ' };
  }

  var fileId = '', fileUrl = '';
  try {
    var rootFolder = childFolder_(null, UPLOAD_ROOT_FOLDER);
    var avatarRoot = childFolder_(rootFolder, AVATAR_FOLDER_NAME);
    var subFolder = childFolder_(avatarRoot, role === 'teacher' ? 'ครู_Teachers' : 'นักเรียน_Students');
    var fname = 'avatar_' + safeName_(targetKey) + '_' + Date.now() + '.' + ext;
    var file = subFolder.createFile(Utilities.newBlob(bytes, mime, fname));
    applyDriveSharing_(file);
    fileId = file.getId();
    fileUrl = file.getUrl();
  } catch (err) {
    // กรณีสภาพแวดล้อมจำกัดสิทธิ์ Drive ให้เก็บเฉพาะ thumbDataUrl ในชีต
    fileId = '';
    fileUrl = '';
  }

  var sheet = getOrCreateSheet(ss, AVATAR_SHEET, AVATAR_HEADERS);
  var vals = sheet.getDataRange().getValues();
  var foundRow = -1, oldFileId = '';
  for (var r = 1; r < vals.length; r++) {
    if (String(vals[r][0]) === targetKey) {
      foundRow = r + 1;
      oldFileId = String(vals[r][4] || '');
      break;
    }
  }
  if (oldFileId && oldFileId !== fileId) {
    try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {}
  }
  var now = Date.now();
  var rowVals = [targetKey, role, ownerId, cls, fileId, fileUrl, str_(thumb, 48000), now];
  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, AVATAR_HEADERS.length).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
  return { status: 'success', targetKey: targetKey, fileId: fileId, fileUrl: fileUrl, thumbDataUrl: thumb, updatedMs: now };
}

function fetchProfileAvatars_(ss, payload) {
  var auth = checkAvatarAuth_(ss, payload);
  if (auth.error) return { status: 'error', code: auth.error, message: 'กรุณาเข้าสู่ระบบก่อนดึงรูปโปรไฟล์' };

  var cls = str_(payload && payload.className || '', 20);
  var sheet = getOrCreateSheet(ss, AVATAR_SHEET, AVATAR_HEADERS);
  var vals = sheet.getDataRange().getValues();
  var out = {};
  for (var r = 1; r < vals.length; r++) {
    var key = String(vals[r][0] || '');
    if (!key) continue;
    var role = String(vals[r][1] || '');
    var ownerId = String(vals[r][2] || '');
    var rowCls = String(vals[r][3] || '');
    if (auth.role === 'student') {
      var isOwnStudent = (role === 'student' && (cleanId_(ownerId) === auth.studentId || key === 'student_' + auth.studentId));
      if (role !== 'teacher' && !isOwnStudent) continue;
    } else if (auth.role === 'intern') {
      if (role === 'student') {
        if (auth.classes.indexOf(rowCls) === -1) continue;
        if (cls && rowCls && rowCls !== cls) continue;
      }
    } else {
      if (cls && role === 'student' && rowCls && rowCls !== cls) continue;
    }
    out[key] = {
      targetKey: key,
      role: role,
      ownerId: ownerId,
      className: rowCls,
      fileId: String(vals[r][4] || ''),
      fileUrl: String(vals[r][5] || ''),
      thumbDataUrl: String(vals[r][6] || ''),
      updatedMs: Number(vals[r][7] || 0)
    };
  }
  return { status: 'success', avatars: out };
}

function downloadStudentRoster(ss) {
  var sheet = getStudentSheet_(ss);
  var vals = sheet.getDataRange().getValues();
  var students = [];
  for (var r = 1; r < vals.length; r++) {
    var sid = cleanId_(vals[r][0]);
    if (!sid) continue;
    students.push({
      student_id: sid,
      prefix: String(vals[r][1] || ''),
      first_name: String(vals[r][2] || ''),
      last_name: String(vals[r][3] || ''),
      nickname: String(vals[r][4] || ''),
      class: String(vals[r][5] || ''),
      no: Number(vals[r][6]) || r
    });
  }
  return { status: 'success', students: students };
}`
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSheetSync;
}
