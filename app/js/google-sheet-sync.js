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
    syncStatus: 'synced' // 'unconfigured' | 'synced' | 'pending' | 'syncing' | 'error'
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
      this.saveConfig({ syncStatus: 'synced', lastError: '' });
      return { success: true, message: reply.message || 'เชื่อมต่อกับ Google Apps Script สำเร็จ' };
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
        btn.innerHTML = origText || '🚀 ซิงค์ข้อมูลทั้งหมดในเครื่องขึ้นชีตเดี๋ยวนี้ (Full Sync)';
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
 * ============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // รอ Lock สูงสุด 20 วินาทีเพื่อป้องกันการเขียนข้อมูลชนกันพร้อมกัน
  lock.tryLock(20000);
  try {
    var rawText = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawText);

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
        serverTime: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

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
    lock.releaseLock();
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
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
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
}`
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleSheetSync;
}
