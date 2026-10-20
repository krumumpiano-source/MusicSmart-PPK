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
    webAppUrl: '',
    autoSync: true,
    lastSyncAt: null,
    syncCount: 0,
    syncStatus: 'unconfigured' // 'unconfigured' | 'synced' | 'pending' | 'syncing' | 'error'
  },

  isFlushing: false,

  init() {
    this.updateUIStatus();
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
      return { ...this.DEFAULT_CONFIG, ...JSON.parse(raw) };
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
  async flushOutbox() {
    if (this.isFlushing) return;
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
      // Pack items into batch payload
      const batchPayload = {
        action: 'batch_sync',
        items: outbox,
        sentAt: new Date().toISOString()
      };

      // Use text/plain with no-cors to prevent CORS preflight blockage in Google Apps Script
      await fetch(cfg.webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(batchPayload)
      });

      // Successful transmission - clear outbox
      const processedCount = outbox.length;
      this.saveOutbox([]);
      this.saveConfig({
        lastSyncAt: new Date().toISOString(),
        syncCount: (cfg.syncCount || 0) + processedCount,
        syncStatus: 'synced'
      });
    } catch (err) {
      console.warn('GoogleSheetSync: flush failed, will retry when online', err);
      this.saveConfig({ syncStatus: 'error' });
    } finally {
      this.isFlushing = false;
      this.setSyncingBadge(false);
      this.updateUIStatus();
    }
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
      submissionType: subData.submissionType || 'วิจารณ์ดนตรี Feldman',
      songTitle: subData.songTitle || subData.title || 'Kalimba 17 Keys',
      content: subData.content || '',
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

    this.flushOutbox();
    return {
      success: true,
      enqueuedTotal,
      message: `นำส่งข้อมูลทั้งหมด ${enqueuedTotal} รายการเข้าสู่คิวซิงค์ Google Sheets เรียบร้อยแล้ว`
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

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      this.saveConfig({
        webAppUrl: url,
        syncStatus: 'synced',
        lastSyncAt: new Date().toISOString()
      });
      return { success: true, message: 'เชื่อมต่อกับ Google Apps Script สำเร็จพร้อมบันทึกคู่ขนาน!' };
    } catch (e) {
      return { success: false, message: 'ไม่สามารถติดต่อ Web App ได้ กรุณาตรวจสอบ URL และสิทธิ์ Anyone (ทุกคน)' };
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
    this.updateUIStatus();
    modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('modal-google-sheet-sync');
    if (modal) modal.classList.remove('active');
  },

  saveSettingsFromModal() {
    const urlInput = document.getElementById('gs-webapp-url');
    if (!urlInput) return;
    const url = urlInput.value.trim();
    this.saveConfig({ webAppUrl: url });
    if (url) {
      this.testConnection(url).then(res => {
        alert(res.message);
        if (res.success) {
          this.flushOutbox();
        }
      });
    } else {
      alert('💾 บันทึกการตั้งค่าแล้ว (ยังไม่ได้เปิดใช้ Google Sheet Sync)');
    }
  },

  async handleTestFromModal() {
    const urlInput = document.getElementById('gs-webapp-url');
    const url = urlInput ? urlInput.value.trim() : '';
    const btn = document.getElementById('btn-gs-test');
    if (btn) btn.disabled = true;
    const res = await this.testConnection(url);
    if (btn) btn.disabled = false;
    alert(res.message);
    this.updateUIStatus();
  },

  async handleFullSyncFromModal() {
    const cfg = this.getConfig();
    if (!cfg.webAppUrl) {
      alert('⚠️ กรุณาระบุและบันทึก URL ของ Google Apps Script ก่อนทำการซิงค์ทั้งหมด');
      return;
    }
    const btn = document.getElementById('btn-gs-fullsync');
    if (btn) btn.disabled = true;
    const res = await this.fullSyncAll();
    if (btn) btn.disabled = false;
    alert(res.message);
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
 * MusicSmart PPK - Google Apps Script Backend (Serverless Dual-Save Engine)
 * สำหรับรับข้อมูลการบันทึกจาก MusicSmart แล้วเขียนลง Google Sheets อัตโนมัติ
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(20000);
  try {
    var rawText = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawText);
    var action = payload.action || 'sync';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'เชื่อมต่อ Google Sheet สำเร็จ: ' + ss.getName(),
        spreadsheetUrl: ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

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

    processSyncItem(ss, payload);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    appName: 'MusicSmart Google Sheets Sync Service',
    sheetName: ss.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

function processSyncItem(ss, item) {
  var type = item.type;
  var data = item.data || {};
  var now = new Date();
  var timestamp = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

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

  if (type === 'submission') {
    var sheet = getOrCreateSheet(ss, "งานนักเรียน_Submissions", [
      "วันเวลาที่ส่ง", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ประเภทงาน", "หัวข้องาน/เพลง", "เนื้อหาการส่งงาน (4 ขั้น Feldman)", "คะแนน", "ข้อเสนอแนะครู"
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
      data.score !== undefined ? data.score : "",
      data.feedback || data.teacherFeedback || ""
    ]);
    return { type: type, success: true };
  }

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

  if (type === 'rubric') {
    var sheet = getOrCreateSheet(ss, "คะแนนรูบริก_Rubrics", [
      "วันเวลาที่ประเมิน", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "ชื่อ-สกุล",
      "1. ท่าทางวิธีจับ (4)", "2. จังหวะ (4)", "3. คุณภาพเสียง (4)", "4. เทคนิคปฏิบัติ (4)",
      "คะแนนรวมดิบ (16)", "คะแนนแปลงมาตรฐาน (5)"
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

  return { type: type, success: false };
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
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
