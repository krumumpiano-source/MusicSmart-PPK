// ==========================================================================
// Music Learning Management System (Music LMS) - Application Controller
// Phayaophitthayakhom School • กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)
// ==========================================================================

const App = {
  state: {
    grade: 'M1',
    activeSubjectId: 'M1',
    selectedClass: 'ม.1/1',
    selectedPeriod: 1,
    activeTab: 'lesson',
    attendance: {}, // student_id -> 'present' | 'absent' | 'leave' | 'late' | 'activity'
    scores: {},     // student_id -> number
    timerSeconds: 50 * 60,
    timerInterval: null,
    timerRunning: false,
    currentEditingStudentId: null,
    currentEditingStudentClass: null,
    role: 'student',
    studentClass: null,
    studentId: null,
    studentPeriod: 1,
    academicTab: 'wk3',
    academicDocId: null,
    submissionsFilter: 'all'
  },

  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPwaPrompt = e;
      console.log('MusicSmart: PWA install prompt captured and ready.');
    });

    // Check URL parameters for explicit student portal link (e.g. ?role=student or ?student=1)
    const urlParams = new URLSearchParams(window.location.search);
    const isStudentLink = urlParams.has('student') || urlParams.get('role') === 'student';

    let currentUser = Store.getCurrentUser ? Store.getCurrentUser() : null;

    // CRITICAL FIX: If opening student link, NEVER use teacher session!
    if (isStudentLink && currentUser && currentUser.role === 'teacher') {
      Store.logout();
      currentUser = null;
    }

    if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'intern')) {
      this.state.role = 'student';
    } else {
      this.state.role = 'teacher';
    }

    this.applyAppSettings();
    this.renderCourseTabs();
    this.updateSemesterBadge();
    this.updateInstructorBadge();
    this.populateExportClassSelect();

    if (currentUser && currentUser.role === 'student') {
      this.state.studentId = currentUser.studentId;
      this.state.studentClass = currentUser.studentClass;
      this.initStudentPortal();
    }

    if (typeof Tuner !== 'undefined' && Tuner.init) Tuner.init();
    if (typeof AudioTools !== 'undefined' && AudioTools.renderBeatDots) AudioTools.renderBeatDots();
    if (typeof VirtualKalimba !== 'undefined' && VirtualKalimba.init) VirtualKalimba.init();
    if (typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.init) GoogleSheetSync.init();

    // Check authentication and lock down unauthorized access
    const isAuth = this.checkAuth();
    if (isAuth && currentUser && (currentUser.role === 'teacher' || currentUser.role === 'intern')) {
      this.renderTodaySchedule();
      this.renderTeacherTodoList();
      this.renderDashboard();
      // ดึงงานที่นักเรียนส่งจากมือถืออัตโนมัติเมื่อเปิดแอป (ถ้าตั้งค่าซิงค์แล้ว)
      if (typeof TeacherPull !== 'undefined' && TeacherPull.isConfigured()) setTimeout(() => TeacherPull.pull({ silent: true }), 1500);
    }

    this.initModalManager();
  },

  // --- Quick Tools Dropdown Menu Controller ---
  toggleToolsMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const panel = document.getElementById('tools-dropdown-panel');
    if (panel) {
      const isHidden = panel.style.display === 'none' || !panel.style.display;
      panel.style.display = isHidden ? 'block' : 'none';
    }
  },

  closeToolsMenu() {
    const panel = document.getElementById('tools-dropdown-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  },

  // --- Modal System Hardening (Escape Key, Backdrop Click & Body Scroll Lock) ---
  initModalManager() {
    const updateBodyLock = () => {
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) {
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
      }
    };

    const observer = new MutationObserver(() => {
      updateBodyLock();
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          // SECURITY GUARD: Never close auth modal if user is not authenticated!
          if (modal.id === 'modal-auth-login' && !Store.getCurrentUser()) {
            return;
          }
          const closeBtn = modal.querySelector('.btn-close-modal, .modal-close-btn');
          if (closeBtn) {
            closeBtn.click();
          } else {
            modal.classList.remove('active');
          }
        }
      });
    });

    document.addEventListener('click', (e) => {
      const wrapper = document.querySelector('.quick-tools-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        App.closeToolsMenu();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
        if (activeModals.length > 0) {
          const topModal = activeModals[activeModals.length - 1];
          // SECURITY GUARD: Never close auth modal on Escape if not authenticated!
          if (topModal && topModal.id === 'modal-auth-login' && !Store.getCurrentUser()) {
            return;
          }
          const closeBtn = topModal.querySelector('.btn-close-modal, .modal-close-btn');
          if (closeBtn) {
            closeBtn.click();
          } else {
            topModal.classList.remove('active');
          }
        }
        App.closeToolsMenu();
      }
    });
  },

  // --- Authentication & User Session Controller ---
  checkAuth() {
    const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
    const authModal = document.getElementById('modal-auth-login');
    const authUserBadge = document.getElementById('auth-user-badge');
    const authUserBar = document.getElementById('auth-user-bar');
    const studentSwitcher = document.getElementById('student-switcher-container');
    const teacherActions = document.getElementById('teacher-actions-group');
    const studentActions = document.getElementById('student-actions-group');
    const headerMiddle = document.getElementById('header-middle-teacher');
    const roleSelector = document.getElementById('role-selector-pill');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCockpit = document.getElementById('view-cockpit');
    const viewStudent = document.getElementById('view-student');

    if (!user) {
      // 1. NON-AUTHENTICATED STATE: Strict privacy lockdown
      this.state.studentId = null;
      this.state.studentClass = null;
      if (viewDashboard) viewDashboard.style.display = 'none';
      if (viewCockpit) viewCockpit.style.display = 'none';
      if (viewStudent) viewStudent.style.display = 'none';
      if (studentSwitcher) studentSwitcher.style.display = 'none';
      if (teacherActions) teacherActions.style.display = 'none';
      if (studentActions) studentActions.style.display = 'none';
      if (headerMiddle) headerMiddle.style.display = 'none';
      if (roleSelector) roleSelector.style.display = 'none';
      if (authUserBadge) authUserBadge.style.display = 'none';
      if (authUserBar) authUserBar.style.display = 'none';

      // Always show Login Modal locked to student tab
      if (authModal) authModal.classList.add('active');
      this.switchAuthTab('student');
      return false;
    }

    if (authUserBar) authUserBar.style.display = 'flex';
    if (authModal) authModal.classList.remove('active');

    if (user.role === 'teacher' || user.role === 'intern') {
      const isIntern = user.role === 'intern';
      // นศ.ฝึกสอน: เห็นเนื้อหาครูเฉพาะห้องที่ได้รับมอบหมาย ไม่มีสิทธิ์ตั้งค่า/รหัสซิงค์/จัดการผู้ใช้
      if (isIntern && typeof RoleGuard !== 'undefined') RoleGuard.purgeForIntern();
      if (!isIntern && typeof RoleGuard !== 'undefined') RoleGuard.purgeInternOnly();
      if (authUserBadge && isIntern) {
        authUserBadge.style.display = 'inline-block';
        authUserBadge.innerHTML = `👩‍🎓 <span style="color:var(--ppk-navy-dark);">${this.escapeHtml(user.name || 'นศ.ฝึกสอน')}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(นศ.ฝึกประสบการณ์ • ${this.escapeHtml((user.classes || []).join(', '))})</span>`;
      } else if (authUserBadge) {
        authUserBadge.style.display = 'inline-block';
        authUserBadge.innerHTML = `👨‍🏫 <span style="color:var(--ppk-navy-dark);">${this.escapeHtml(user.name || 'คุณครู')}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${this.escapeHtml(user.email || 'ครูผู้สอน')})</span>`;
      }
      if (studentSwitcher) studentSwitcher.style.display = 'none';
      if (teacherActions) teacherActions.style.display = 'flex';
      if (studentActions) studentActions.style.display = 'none';
      if (headerMiddle) headerMiddle.style.display = 'flex';
      if (roleSelector) roleSelector.style.display = 'flex';
      this.switchRole('teacher', false);
    } else if (user.role === 'student') {
      this.state.studentId = user.studentId;
      this.state.studentClass = user.studentClass;
      if (authUserBadge) {
        authUserBadge.style.display = 'inline-block';
        authUserBadge.innerHTML = `🎓 <span style="color:var(--ppk-navy-dark);">${this.escapeHtml(user.name)}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${this.escapeHtml(user.studentClass)} เลขที่ ${user.no}</span>`;
      }
      // CRITICAL PRIVACY: teacher-only sections are REMOVED from the DOM (not just hidden) for students
      if (typeof RoleGuard !== 'undefined') RoleGuard.purgeTeacherDom();
      if (studentSwitcher) studentSwitcher.style.display = 'none';
      if (teacherActions) teacherActions.style.display = 'none';
      if (studentActions) studentActions.style.display = 'flex';
      if (headerMiddle) headerMiddle.style.display = 'none';
      if (roleSelector) roleSelector.style.display = 'none';
      this.switchRole('student', false);
    }
    return true;
  },

  switchAuthTab(tab) {
    const btnStudent = document.getElementById('auth-tab-student-btn');
    const btnTeacher = document.getElementById('auth-tab-teacher-btn');
    const paneStudent = document.getElementById('auth-pane-student');
    const paneTeacher = document.getElementById('auth-pane-teacher');

    if (tab === 'student') {
      if (btnStudent) {
        btnStudent.style.background = '#ffffff';
        btnStudent.style.color = '#1e3a8a';
        btnStudent.style.borderBottom = '3px solid #0284c7';
      }
      if (btnTeacher) {
        btnTeacher.style.background = '#f1f5f9';
        btnTeacher.style.color = '#64748b';
        btnTeacher.style.borderBottom = '3px solid transparent';
      }
      if (paneStudent) paneStudent.style.display = 'block';
      if (paneTeacher) paneTeacher.style.display = 'none';
      setTimeout(() => document.getElementById('auth-student-id')?.focus(), 150);
    } else {
      if (btnTeacher) {
        btnTeacher.style.background = '#ffffff';
        btnTeacher.style.color = '#1e3a8a';
        btnTeacher.style.borderBottom = '3px solid #0284c7';
      }
      if (btnStudent) {
        btnStudent.style.background = '#f1f5f9';
        btnStudent.style.color = '#64748b';
        btnStudent.style.borderBottom = '3px solid transparent';
      }
      if (paneStudent) paneStudent.style.display = 'none';
      if (paneTeacher) paneTeacher.style.display = 'block';
      this.onTeacherEmailInput(document.getElementById('auth-teacher-email')?.value);
      setTimeout(() => document.getElementById('auth-teacher-secret')?.focus(), 150);
    }
  },

  _authEls() {
    const g = (id) => document.getElementById(id);
    return {
      previewBox: g('auth-student-preview-box'), previewName: g('auth-student-preview-name'), previewMeta: g('auth-student-preview-meta'),
      pinTag: g('auth-student-pin-status-tag'), modeLogin: g('auth-student-mode-login'), modeRegister: g('auth-student-mode-register'),
      indicator: g('auth-student-id-indicator'), errorBox: g('auth-student-id-error')
    };
  },

  _resetAuthStudentUi() {
    const e = this._authEls();
    if (e.indicator) e.indicator.style.display = 'none';
    if (e.previewBox) e.previewBox.style.display = 'none';
    if (e.modeLogin) e.modeLogin.style.display = 'none';
    if (e.modeRegister) e.modeRegister.style.display = 'none';
    if (e.errorBox) { e.errorBox.style.display = 'none'; e.errorBox.textContent = ''; }
  },

  _showAuthStudentError(html) {
    const e = this._authEls();
    if (e.indicator) { e.indicator.textContent = '❌'; e.indicator.style.display = 'block'; }
    if (e.errorBox) { e.errorBox.style.display = 'block'; e.errorBox.innerHTML = html; }
  },

  _showStudentAuthMode(hasPin) {
    const e = this._authEls();
    if (e.pinTag) {
      e.pinTag.textContent = hasPin ? '🔒 ตั้ง PIN แล้ว' : '✨ เข้าใช้งานครั้งแรก (ยังไม่ตั้ง PIN)';
      e.pinTag.style.background = hasPin ? '#dcfce7' : '#fef3c7';
      e.pinTag.style.color = hasPin ? '#15803d' : '#92400e';
    }
    if (e.modeLogin) e.modeLogin.style.display = hasPin ? 'block' : 'none';
    if (e.modeRegister) e.modeRegister.style.display = hasPin ? 'none' : 'block';
    setTimeout(() => document.getElementById(hasPin ? 'auth-student-pin' : 'auth-student-new-pin')?.focus(), 150);
  },

  // ขั้นที่ 1: กรอกรหัสนักเรียน -> ตรวจสอบกับเซิร์ฟเวอร์ (หรือรายชื่อในเครื่องในโหมดสาธิต)
  async onAuthStudentIdInput(val) {
    const cleanId = (val || '').trim();
    this._authLookupSeq = (this._authLookupSeq || 0) + 1;
    const seq = this._authLookupSeq;
    this._resetAuthStudentUi();
    if (cleanId.length !== 5) return;

    const e = this._authEls();
    if (e.indicator) { e.indicator.textContent = '⏳'; e.indicator.style.display = 'block'; }
    const res = await StudentAuth.lookup(cleanId);
    if (seq !== this._authLookupSeq) return; // ผู้ใช้พิมพ์ต่อแล้ว

    if (!res.success) {
      if (e.indicator) e.indicator.style.display = 'none';
      if (res.code === 'network' || res.code === 'rate_limited') {
        this._showAuthStudentError(`⚠️ ${this.escapeHtml(res.message || 'เชื่อมต่อไม่ได้')}`);
      } else {
        this._showAuthStudentError(`⚠️ ไม่พบเลขประจำตัว <strong>${this.escapeHtml(cleanId)}</strong> ในระบบ<br><span style="font-size:0.78rem; font-weight:normal; opacity:0.9;">กรุณาตรวจสอบเลขประจำตัว 5 หลัก หรือแจ้งคุณครูผู้สอนเพื่อลงทะเบียน</span>`);
      }
      return;
    }

    if (e.indicator) { e.indicator.textContent = '✅'; e.indicator.style.display = 'block'; }
    if (e.previewBox) e.previewBox.style.display = 'block';
    if (e.previewName) e.previewName.textContent = res.displayName || '-';
    if (e.previewMeta) e.previewMeta.textContent = `ห้อง ${res.studentClass || '-'} • รหัส: ${cleanId}${res.mode === 'local' ? ' • (โหมดสาธิตในเครื่อง)' : ''}`;
    if (res.locked) {
      this._showAuthStudentError('🔒 ใส่ PIN ผิดหลายครั้ง ระบบล็อกชั่วคราว 15 นาที หรือให้คุณครูรีเซ็ต PIN');
    }
    this._showStudentAuthMode(res.hasPin);
  },

  _afterStudentLogin(user, isFirstTime) {
    this.checkAuth();
    const isStandalone = (typeof PwaInstall !== 'undefined') ? PwaInstall.isStandalone()
      : (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    if (!isStandalone) {
      this.openStudentPwaPromptModal(user, isFirstTime);
    } else if (!isFirstTime) {
      alert(`🎉 ยินดีต้อนรับ ${user.name} เข้าสู่ระบบ MusicSmart`);
    }
  },

  // ขั้นที่ 2ก: เข้าสู่ระบบด้วยรหัส + PIN
  async handleStudentLogin() {
    const studentId = (document.getElementById('auth-student-id')?.value || '').trim();
    const pin = (document.getElementById('auth-student-pin')?.value || '').trim();

    if (!studentId || studentId.length !== 5) {
      alert('กรุณากรอกเลขประจำตัวนักเรียน 5 หลักให้ถูกต้อง');
      document.getElementById('auth-student-id')?.focus();
      return;
    }
    if (!pin) {
      alert('กรุณากรอกรหัส PIN 6 หลัก');
      document.getElementById('auth-student-pin')?.focus();
      return;
    }

    const res = await StudentAuth.login(studentId, pin);
    if (res.success) {
      this._afterStudentLogin(res.user, false);
    } else if (res.needsRegistration) {
      alert(res.message || 'ยังไม่ได้ตั้งรหัส PIN กรุณาตั้ง PIN ก่อน');
      this._showStudentAuthMode(false);
    } else {
      alert(res.message || 'เข้าสู่ระบบไม่สำเร็จ');
      const pinEl = document.getElementById('auth-student-pin');
      if (pinEl) { pinEl.value = ''; pinEl.focus(); }
    }
  },

  // ขั้นที่ 2ข: เข้าใช้ครั้งแรก บังคับตั้ง PIN แล้วเข้าสู่ระบบทันที
  async handleStudentRegisterPin() {
    const studentId = (document.getElementById('auth-student-id')?.value || '').trim();
    const newPin = (document.getElementById('auth-student-new-pin')?.value || '').trim();
    const confirmPin = (document.getElementById('auth-student-confirm-pin')?.value || '').trim();

    if (!studentId || studentId.length !== 5) {
      alert('กรุณากรอกเลขประจำตัวนักเรียน 5 หลักให้ถูกต้อง');
      document.getElementById('auth-student-id')?.focus();
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      alert('กรุณาตั้งรหัส PIN เป็นตัวเลข 6 หลัก (0-9) เท่านั้น');
      document.getElementById('auth-student-new-pin')?.focus();
      return;
    }
    if (newPin !== confirmPin) {
      alert('รหัส PIN ทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      document.getElementById('auth-student-confirm-pin')?.focus();
      return;
    }

    const res = await StudentAuth.setPin(studentId, newPin);
    if (res.success) {
      this._afterStudentLogin(res.user, true);
    } else {
      alert(res.message || 'ตั้งรหัส PIN ไม่สำเร็จ');
      if (res.code === 'pin_exists') this._showStudentAuthMode(true);
    }
  },

  openStudentPwaPromptModal(user, isFirstTime = false) {
    const modal = document.getElementById('modal-student-pwa-prompt');
    if (!modal) return;

    const titleEl = document.getElementById('pwa-prompt-student-title');
    if (titleEl && user) {
      titleEl.textContent = isFirstTime 
        ? `🎉 ตั้งรหัส PIN สำเร็จแล้ว! ยินดีต้อนรับ ${user.name}`
        : `👋 ยินดีต้อนรับ ${user.name}`;
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const nativeBox = document.getElementById('pwa-prompt-native');
    const iosBox = document.getElementById('pwa-prompt-ios');

    if (isIos) {
      if (nativeBox) nativeBox.style.display = 'none';
      if (iosBox) iosBox.style.display = 'block';
    } else {
      if (nativeBox) nativeBox.style.display = 'block';
      if (iosBox) iosBox.style.display = 'none';
    }

    modal.classList.add('active');
  },

  closeStudentPwaPromptModal() {
    const modal = document.getElementById('modal-student-pwa-prompt');
    if (modal) modal.classList.remove('active');
  },

  copyStudentShareLink() {
    let url = (typeof StudentAuth !== 'undefined') ? StudentAuth.studentLink() : `${window.location.origin}${window.location.pathname}?role=student`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        alert(`📋 คัดลอกลิงก์สำหรับส่งให้นักเรียนเรียบร้อยแล้ว!\n\n${url}\n\nเมื่อนักเรียนเปิดลิงก์นี้ ระบบจะแสดงหน้าล็อกอินให้นักเรียนกรอกเลขประจำตัว 5 หลัก และบังคับตั้งรหัส PIN พร้อมติดตั้งแอพทันที โดยไม่เห็นข้อมูลของครูครับ`);
      }).catch(() => {
        prompt('กรุณาคัดลอกลิงก์สำหรับส่งให้นักเรียนด้านล่างนี้ครับ:', url);
      });
    } else {
      prompt('กรุณาคัดลอกลิงก์สำหรับส่งให้นักเรียนด้านล่างนี้ครับ:', url);
    }
  },

  openTeacherLoginModal() {
    const authModal = document.getElementById('modal-auth-login');
    if (authModal) {
      authModal.classList.add('active');
      this.switchAuthTab('teacher');
    }
  },

  onTeacherEmailInput(val) {
    const email = (val || '').trim();
    const teacher = Store.getTeacherByEmail ? Store.getTeacherByEmail(email) : null;
    const hintEl = document.getElementById('auth-teacher-first-time-hint');
    const defaultHintEl = document.getElementById('auth-teacher-default-hint');
    const secretInput = document.getElementById('auth-teacher-secret');

    if (teacher && teacher.needsFirstTimeSetup) {
      if (hintEl) hintEl.style.display = 'block';
      if (defaultHintEl) defaultHintEl.style.display = 'none';
      if (secretInput) {
        secretInput.placeholder = '✨ นักศึกษาฝึกสอนเข้าสู่ระบบครั้งแรกไม่ต้องใส่รหัส (กดปุ่มเข้าสู่ระบบได้เลย)';
        secretInput.value = '';
        secretInput.disabled = true;
      }
    } else {
      if (hintEl) hintEl.style.display = 'none';
      if (defaultHintEl) defaultHintEl.style.display = 'block';
      if (secretInput) {
        secretInput.disabled = false;
        secretInput.placeholder = 'กรอกรหัสผ่านหรือ PIN ครู';
      }
    }
  },

  async handleTeacherLogin() {
    const email = (document.getElementById('auth-teacher-email')?.value || '').trim();
    const secretInput = document.getElementById('auth-teacher-secret');
    const secret = (secretInput?.value || '').trim();

    if (!email) {
      alert('กรุณากรอกอีเมลครูผู้สอน');
      return;
    }

    const teacher = Store.getTeacherByEmail ? Store.getTeacherByEmail(email) : null;
    if ((!teacher || !teacher.needsFirstTimeSetup) && !secret) {
      alert('กรุณากรอกรหัสผ่านหรือรหัส PIN');
      return;
    }

    const res = (typeof TeacherAuth !== 'undefined') ? await TeacherAuth.login(email, secret) : Store.verifyTeacherLogin(email, secret);
    if (res.success && res.notice) console.info(res.notice);
    if (res.success) {
      if (res.needsSetup) {
        this.openFirstTimeSetupModal(res.teacher);
        return;
      }
      if (typeof RoleGuard !== 'undefined' && RoleGuard.purged) { location.reload(); return; }
      this.checkAuth();
      alert(`👨‍🏫 ยินดีต้อนรับ ${res.user.name} เข้าสู่ห้องปฏิบัติการครู`);
    } else {
      alert(res.message);
    }
  },

  openFirstTimeSetupModal(teacher) {
    this.currentFirstTimeTeacher = teacher;
    const modal = document.getElementById('modal-first-time-setup');
    if (!modal) return;

    const nameInput = document.getElementById('setup-teacher-name');
    const emailInput = document.getElementById('setup-teacher-email');
    const instInput = document.getElementById('setup-teacher-inst');
    const secretInput = document.getElementById('setup-teacher-secret');
    const confirmInput = document.getElementById('setup-teacher-confirm-secret');

    if (nameInput) nameInput.value = teacher.name || 'นักศึกษาฝึกประสบการณ์วิชาชีพครู (เอกดนตรี มพ.)';
    if (emailInput) emailInput.value = teacher.email || 'kouocking@gmail.com';
    if (instInput) instInput.value = teacher.institution || 'เอกดนตรี มหาวิทยาลัยพะเยา';
    if (secretInput) secretInput.value = '';
    if (confirmInput) confirmInput.value = '';

    modal.classList.add('active');
    setTimeout(() => {
      if (secretInput) secretInput.focus();
    }, 200);
  },

  handleSaveFirstTimeSetup() {
    const teacher = this.currentFirstTimeTeacher || Store.getTeacherByEmail('kouocking@gmail.com');
    if (!teacher) {
      alert('ไม่พบข้อมูลบัญชีผู้สอน กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const name = (document.getElementById('setup-teacher-name')?.value || '').trim();
    const secret = (document.getElementById('setup-teacher-secret')?.value || '').trim();
    const confirmSecret = (document.getElementById('setup-teacher-confirm-secret')?.value || '').trim();
    const inst = (document.getElementById('setup-teacher-inst')?.value || '').trim();

    if (!name) {
      alert('กรุณาระบุชื่อ-นามสกุลของท่าน');
      return;
    }
    if (!secret || secret.length < 4) {
      alert('กรุณาตั้งรหัสผ่านหรือ PIN อย่างน้อย 4 ตัวอักษร/ตัวเลข');
      return;
    }
    if (secret !== confirmSecret) {
      alert('รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    const res = Store.completeTeacherFirstTimeSetup(teacher.id, {
      name: name,
      secret: secret,
      institution: inst
    });

    if (res.success) {
      const modal = document.getElementById('modal-first-time-setup');
      if (modal) modal.classList.remove('active');
      this.checkAuth();
      this.updateInstructorBadge();
      alert(`🎉 ยินดีต้อนรับคุณครู ${res.teacher.name}!\nบันทึกรหัสผ่านประจำตัวและเริ่มใช้งานระบบเรียบร้อยแล้วครับ`);
    } else {
      alert(res.message || 'เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน');
    }
  },

  triggerPwaInstall() {
    if (typeof PwaInstall !== 'undefined') { PwaInstall.install(); return; }
    if (this.deferredPwaPrompt) {
      this.deferredPwaPrompt.prompt();
      this.deferredPwaPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
          alert('🎉 กำลังติดตั้งแอป MusicSmart ลงบนอุปกรณ์ของคุณเรียบร้อยแล้วครับ!');
        } else {
          console.log('User dismissed the PWA install prompt');
        }
        this.deferredPwaPrompt = null;
      });
    } else {
      // Check if already in standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (isStandalone) {
        alert('📱 คุณได้ติดตั้งและเปิดใช้งาน MusicSmart ผ่านแอปพลิเคชันเรียบร้อยแล้วครับ!');
        return;
      }

      // Browser fallback message (iOS Safari or Chrome desktop/already installed)
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        alert('📲 วิธีติดตั้งบน iPhone / iPad:\n1. แตะที่ปุ่ม "แชร์" (Share 📤) ด้านล่างของ Safari\n2. เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen ➕)\n3. แตะ "เพิ่ม" (Add) เพื่อเปิดใช้งานแบบเต็มจอได้ทันที');
      } else {
        alert('📲 สำหรับเบราว์เซอร์ Chrome/Edge:\nแตะที่เมนู 3 จุด (⋮ หรือ ⋯) มุมขวาบน แล้วเลือก "ติดตั้งแอป MusicSmart" (Install App) หรือ "เพิ่มลงในหน้าจอหลัก" ครับ');
      }
    }
  },

  handleLogout() {
    const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
    const name = user ? user.name : 'ผู้ใช้งาน';
    if (confirm(`ต้องการออกจากระบบ (${name}) หรือไม่?`)) {
      Store.logout();
      if (typeof RoleGuard !== 'undefined' && RoleGuard.purged) { location.reload(); return; }
      this.state.role = 'student';
      this.state.studentId = null;
      this.state.studentClass = null;
      const studentIdInput = document.getElementById('auth-student-id');
      const studentPinInput = document.getElementById('auth-student-pin');
      const studentNewPin = document.getElementById('auth-student-new-pin');
      const studentConfirmPin = document.getElementById('auth-student-confirm-pin');
      if (studentIdInput) studentIdInput.value = '';
      if (studentPinInput) studentPinInput.value = '';
      if (studentNewPin) studentNewPin.value = '';
      if (studentConfirmPin) studentConfirmPin.value = '';
      this.onAuthStudentIdInput('');
      this.checkAuth();
    }
  },

  // --- Dynamic Application & Innovation Branding ---
  applyAppSettings() {
    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    if (!settings) return;

    // 1. Update Document Title & Meta
    document.title = `${settings.appName} • ${settings.innovationName} - ${settings.schoolName}`;

    // 2. Update Header Brand Section
    const crestEl = document.getElementById('app-crest-badge');
    if (crestEl) {
      crestEl.innerHTML = `<span style="font-size: 0.85rem; font-weight: 800; letter-spacing: -0.5px;">${this.escapeHtml(settings.appBadge || 'T-PACE')}</span>`;
      crestEl.title = `${settings.appName} • ${settings.schoolName}`;
    }

    const nameEl = document.getElementById('app-display-name');
    if (nameEl) nameEl.textContent = settings.appName;

    const badgeEl = document.getElementById('app-display-badge');
    if (badgeEl) badgeEl.textContent = `${settings.appBadge} Ecosystem`;

    const subEl = document.getElementById('app-display-sub');
    if (subEl) subEl.textContent = `${settings.innovationName} • ${settings.schoolName}`;

    // 3. Update Instructor Modal Mentor Name
    const mentorNameEl = document.getElementById('modal-instructor-mentor-name');
    if (mentorNameEl && settings.teacherName) {
      mentorNameEl.textContent = settings.teacherName;
    }
  },

  openSettingsModal() {
    const settings = Store.getAppSettings();
    const inst = Store.getInstructor();
    const teacherAcc = Store.getTeacherAccount();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('setting-app-name', settings.appName);
    setVal('setting-app-badge', settings.appBadge);
    setVal('setting-innovation-name', settings.innovationName);
    setVal('setting-research-title', settings.researchTitle);
    setVal('setting-school-name', settings.schoolName);
    setVal('setting-school-short', settings.schoolShort);
    setVal('setting-department-name', settings.department);
    setVal('setting-teacher-name', inst.name);
    setVal('setting-dept-head', settings.departmentHead);
    setVal('setting-academic-head', settings.academicHead || 'นายกฤศ วงค์เรือง');
    setVal('setting-director-name', settings.directorName);
    setVal('setting-teacher-email', teacherAcc.email || 'krumum.piano@gmail.com');
    setVal('setting-teacher-secret', teacherAcc.secret || 'ppk1234');

    this.populatePinResetControls();

    const modal = document.getElementById('modal-app-settings');
    if (modal) modal.classList.add('active');
  },

  populatePinResetControls() {
    const classSel = document.getElementById('setting-pin-reset-class') || document.getElementById('user-pin-reset-class');
    if (!classSel) return;
    const classes = [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')];
    classSel.innerHTML = '';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classSel.appendChild(opt);
    });
    this.onPinResetClassChange(classes[0] || 'ม.1/1');
  },

  onPinResetClassChange(className) {
    const studentSel = document.getElementById('setting-pin-reset-student') || document.getElementById('user-pin-reset-student');
    if (!studentSel) return;
    const students = Store.getStudents(className);
    studentSel.innerHTML = '';
    students.forEach(s => {
      const acc = Store.getStudentAccount(s.student_id);
      const opt = document.createElement('option');
      opt.value = s.student_id;
      const statusIcon = acc ? '🔒 ตั้ง PIN แล้ว' : '⚪ ยังไม่ตั้ง PIN';
      opt.textContent = `เลขที่ ${s.no} ${s.prefix}${s.first_name} ${s.last_name} (${s.student_id}) - ${statusIcon}`;
      studentSel.appendChild(opt);
    });
  },

  handleResetStudentPinClick() {
    const studentSel = document.getElementById('setting-pin-reset-student') || document.getElementById('user-pin-reset-student');
    const studentId = studentSel ? studentSel.value : null;
    if (!studentId) {
      alert('กรุณาเลือกนักเรียนที่ต้องการรีเซ็ต PIN');
      return;
    }
    const studentInfo = Store.getStudentById(studentId);
    const name = studentInfo ? `${studentInfo.prefix}${studentInfo.first_name} ${studentInfo.last_name}` : studentId;
    if (confirm(`ยืนยันการรีเซ็ตรหัส PIN ของ ${name} (รหัส ${studentId}) หรือไม่?\nเมื่อรีเซ็ตแล้ว นักเรียนจะสามารถเข้าสู่ระบบและตั้ง PIN 6 หลักใหม่ได้ด้วยตนเอง`)) {
      const res = Store.resetStudentPin(studentId);
      this.resetStudentPinOnServer(studentId);
      alert(res.message);
      const classSel = document.getElementById('setting-pin-reset-class') || document.getElementById('user-pin-reset-class');
      if (classSel) this.onPinResetClassChange(classSel.value);
    }
  },

  closeSettingsModal() {
    const modal = document.getElementById('modal-app-settings');
    if (modal) modal.classList.remove('active');
  },

  saveSettingsFromModal() {
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();

    const appName = getVal('setting-app-name') || 'MusicSmart';
    const appBadge = getVal('setting-app-badge') || 'T-PACE';
    const innovationName = getVal('setting-innovation-name') || 'รูปแบบการจัดการเรียนรู้เชิงรุก T-PACE Framework ร่วมกับแอปพลิเคชัน MusicSmart';
    const researchTitle = getVal('setting-research-title');
    const schoolName = getVal('setting-school-name') || 'โรงเรียนพะเยาพิทยาคม';
    const schoolShort = getVal('setting-school-short') || 'พ.พ.';
    const department = getVal('setting-department-name');
    const teacherName = getVal('setting-teacher-name');
    const departmentHead = getVal('setting-dept-head');
    const academicHead = getVal('setting-academic-head');
    const directorName = getVal('setting-director-name');
    const teacherEmail = getVal('setting-teacher-email');
    const teacherSecret = getVal('setting-teacher-secret');

    Store.saveAppSettings({
      appName,
      appBadge,
      innovationName,
      researchTitle,
      schoolName,
      schoolShort,
      department,
      departmentHead,
      academicHead,
      directorName
    });

    if (teacherEmail || teacherSecret) {
      Store.saveTeacherAccount({
        email: teacherEmail || 'krumum.piano@gmail.com',
        secret: teacherSecret || 'ppk1234',
        name: teacherName || Store.getInstructor().name
      });
    }

    if (teacherName) {
      Store.setInstructor(Store.getInstructor().role, teacherName);
      this.updateInstructorBadge();
    }

    this.applyAppSettings();
    this.closeSettingsModal();
    alert('✅ บันทึกการตั้งค่านวัตกรรมและข้อมูลผู้ใช้งานเรียบร้อยแล้ว (อัปเดตแบบเรียลไทม์)');
  },

  resetDefaultSettings() {
    if (confirm('ต้องการคืนค่าการตั้งค่านวัตกรรมเป็นค่าเริ่มต้นตามหลักสูตร ม.1 (ศ21101) หรือไม่?')) {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.TEACHER_ACCOUNT);
      this.applyAppSettings();
      this.openSettingsModal();
      alert('🔄 คืนค่าเริ่มต้นเรียบร้อยแล้ว');
    }
  },

  // --- Dynamic Subjects & Course Switcher ---
  renderCourseTabs() {
    const subjects = Store.getAllSubjects();
    const nav = document.getElementById('header-course-nav');
    if (!nav) return;
    nav.innerHTML = '';

    subjects.forEach(subj => {
      if (!subj.active) return;
      const btn = document.createElement('button');
      btn.className = `course-tab-btn ${subj.id === this.state.activeSubjectId ? 'active' : ''}`;
      btn.textContent = `${subj.code} ${subj.name}`;
      btn.onclick = () => this.switchSubject(subj.id);
      nav.appendChild(btn);
    });
  },

  switchSubject(subjectId) {
    const subjects = Store.getAllSubjects();
    const target = subjects.find(s => s.id === subjectId) || subjects[0];
    if (!target) return;

    this.state.activeSubjectId = target.id;
    this.state.grade = target.grade === 'ม.1' ? 'M1' : (target.grade === 'ม.2' ? 'M2' : target.id);

    // Update active tab styles
    this.renderCourseTabs();

    // Update Title
    const titleEl = document.getElementById('dashboard-title');
    if (titleEl) {
      titleEl.textContent = `ห้องเรียนระดับชั้น${target.grade} (${target.code} ${target.name})`;
    }

    this.renderDashboard();
    this.populateExportClassSelect();
  },

  // --- Semester & Archive State ---
  updateSemesterBadge() {
    const meta = Store.getSemesterMeta();
    const labelEl = document.getElementById('header-semester-label');
    if (labelEl) {
      labelEl.textContent = meta.activeLabel || 'ภาคเรียนที่ 1/2569';
    }

    const banner = document.getElementById('archive-notification-banner');
    if (banner) {
      if (meta.isArchiveView && meta.viewingId && meta.archives[meta.viewingId]) {
        banner.style.display = 'flex';
        document.getElementById('archive-banner-text').textContent = meta.archives[meta.viewingId].label;
      } else {
        banner.style.display = 'none';
      }
    }
  },

  exitArchiveView() {
    Store.switchArchiveView(null);
    this.updateSemesterBadge();
    this.renderDashboard();
    alert('✅ กลับสู่ภาคเรียนปัจจุบันเรียบร้อยแล้ว');
  },

  // --- Today's Schedule Widget ---
  renderTodaySchedule() {
    const todayData = Store.getTodayClasses();
    const titleEl = document.getElementById('today-schedule-title');
    if (titleEl) {
      titleEl.textContent = `ตารางสอนประจำวันนี้ (วัน${todayData.dayName})`;
    }

    const grid = document.getElementById('today-slots-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (todayData.classes.length === 0) {
      grid.innerHTML = `
        <div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.88rem;">
          ไม่มีคาบสอนตามตารางในวันนี้ (หรือยังไม่ได้ระบุตารางสอน) • 
          <a href="javascript:void(0)" onclick="App.openTimetableModal()" style="color: var(--ppk-blue); font-weight: 600; text-decoration: underline;">
            คลิกที่นี่เพื่อจัดตารางสอน
          </a>
        </div>
      `;
      return;
    }

    todayData.classes.forEach(slot => {
      const pill = document.createElement('div');
      pill.className = `today-slot-pill ${slot.isLunch ? 'is-lunch' : ''} ${slot.isActivity ? 'is-activity' : ''}`;
      if (slot.isLunch) {
        pill.innerHTML = `
          <div class="today-slot-time">คาบที่ ${slot.periodNo} (${slot.time})</div>
          <div class="today-slot-class" style="color: #b45309;">พักเที่ยง</div>
        `;
      } else if (slot.isActivity) {
        pill.innerHTML = `
          <div class="today-slot-time">คาบที่ ${slot.periodNo} (${slot.time})</div>
          <div class="today-slot-class" style="font-size: 0.95rem; color: #334155;">${this.escapeHtml(slot.className)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">ภาระงาน / กิจกรรม</div>
        `;
      } else {
        let assignInfo = '';
        if (slot.assignment) {
          if (slot.assignment.assignRole === 'trainee') {
            assignInfo = `
              <div style="font-size: 0.72rem; color: #b45309; font-weight: 700; margin-top: 3px; display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed #fde68a; padding-top: 2px;">
                <span>🎓 นศ.ฝึกสอน</span>
                <span onclick="event.stopPropagation(); App.openTeachingAssignmentModal('${todayData.dayName}', ${slot.periodNo});" style="text-decoration: underline; color: #9a3412; cursor: pointer; font-weight: 600;">💡 คำแนะนำ</span>
              </div>
            `;
          } else if (slot.assignment.assignRole === 'co-teach') {
            assignInfo = `
              <div style="font-size: 0.72rem; color: #3730a3; font-weight: 700; margin-top: 3px; display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed #c7d2fe; padding-top: 2px;">
                <span>👥 ร่วมสอน</span>
                <span onclick="event.stopPropagation(); App.openTeachingAssignmentModal('${todayData.dayName}', ${slot.periodNo});" style="text-decoration: underline; color: #3730a3; cursor: pointer; font-weight: 600;">💡 คำแนะนำ</span>
              </div>
            `;
          }
        }
        pill.innerHTML = `
          <div class="today-slot-time">คาบที่ ${slot.periodNo} (${slot.time})</div>
          <div class="today-slot-class">${this.escapeHtml(slot.className)} <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-muted);">(${slot.subjCode || 'ดนตรีสากล'})</span></div>
          <div style="font-size: 0.72rem; color: var(--ppk-navy); font-weight: 600; margin-top: 2px;">ห้อง ${slot.room || 'อส.5'}</div>
          ${assignInfo}
        `;
        pill.onclick = () => {
          const prog = Store.getClassProgress(slot.className);
          App.enterCockpit(slot.className, prog.nextPeriod);
        };
      }
      grid.appendChild(pill);
    });
  },

  // --- Role Switcher (Teacher vs Student View) ---
  switchRole(role, save = true) {
    const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
    if (role === 'teacher') {
      if (!user || (user.role !== 'teacher' && user.role !== 'intern')) {
        alert('🔒 พื้นที่เฉพาะสำหรับคุณครูผู้สอน กรุณาเข้าสู่ระบบด้วยบัญชีครู');
        this.openTeacherLoginModal();
        return;
      }
    } else if (role === 'student') {
      if (!user || user.role !== 'student') {
        if (user && user.role === 'teacher') {
          if (confirm('คุณครูต้องการสลับไปยังหน้านักเรียนเพื่อทดสอบระบบใช่หรือไม่?\n\n(ระบบจะออกจากบัญชีครูเพื่อเข้าสู่หน้าจอนักเรียน โดยนักเรียนจะต้องกรอกเลขประจำตัว 5 หลักและรหัส PIN)')) {
            Store.logout();
            this.state.studentId = null;
            this.state.studentClass = null;
            this.checkAuth();
          }
          return;
        } else {
          this.switchAuthTab('student');
          const authModal = document.getElementById('modal-auth-login');
          if (authModal) authModal.classList.add('active');
          return;
        }
      }
    }

    this.state.role = role;
    if (save) Store.setActiveRole(role);

    const btnTeacher = document.getElementById('btn-role-teacher');
    const btnStudent = document.getElementById('btn-role-student');
    const headerMiddle = document.getElementById('header-middle-teacher');
    const teacherActions = document.getElementById('teacher-actions-group');
    const studentActions = document.getElementById('student-actions-group');
    const roleSelector = document.getElementById('role-selector-pill');
    const studentSwitcher = document.getElementById('student-switcher-container');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCockpit = document.getElementById('view-cockpit');
    const viewStudent = document.getElementById('view-student');

    if (role === 'student') {
      if (btnTeacher) btnTeacher.classList.remove('active');
      if (btnStudent) btnStudent.classList.add('active');
      if (headerMiddle) headerMiddle.style.display = 'none';
      if (teacherActions) teacherActions.style.display = 'none';
      if (roleSelector) roleSelector.style.display = 'none';
      if (studentSwitcher) studentSwitcher.style.display = 'none';
      if (studentActions) studentActions.style.display = 'flex';

      if (viewDashboard) viewDashboard.style.display = 'none';
      if (viewCockpit) viewCockpit.style.display = 'none';
      if (viewStudent) viewStudent.style.display = 'block';

      this.renderStudentPortal();
    } else {
      if (btnTeacher) btnTeacher.classList.add('active');
      if (btnStudent) btnStudent.classList.remove('active');
      if (headerMiddle) headerMiddle.style.display = 'flex';
      if (teacherActions) teacherActions.style.display = 'flex';
      if (roleSelector) roleSelector.style.display = 'flex';
      if (studentSwitcher) studentSwitcher.style.display = 'none';
      if (studentActions) studentActions.style.display = 'none';

      if (viewStudent) viewStudent.style.display = 'none';
      if (viewDashboard) viewDashboard.style.display = 'block';
      if (viewCockpit) viewCockpit.style.display = 'none';

      this.renderTeacherTodoList();
      this.renderDashboard();
    }
  },

  // --- Teacher To-Do List Widget ---
  renderTeacherTodoList() {
    const todoContainer = document.getElementById('teacher-todo-list');
    const badgeCount = document.getElementById('teacher-todo-count-badge');
    if (!todoContainer) return;

    const todos = Store.getTeacherTodoList();
    if (badgeCount) {
      badgeCount.textContent = `${todos.length} รายการ`;
      badgeCount.className = todos.length > 0 ? 'badge-warning' : 'badge-success';
    }

    if (todos.length === 0) {
      todoContainer.innerHTML = `
        <div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.88rem; background: var(--bg-subtle); border-radius: var(--radius-sm);">
          🎉 เรียบร้อยทุกรายการ! ไม่มีงานค้างตรวจหรือนักเรียนค้างประเมิน
        </div>
      `;
      return;
    }

    todoContainer.innerHTML = '';
    todos.forEach(item => {
      const card = document.createElement('div');
      const isWarn = item.type === 'makeup_score' || item.type === 'reflection_missing';
      card.className = `todo-item-card ${isWarn ? 'is-warning' : 'is-info'}`;
      card.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="${item.badgeClass}" style="font-size: 0.72rem; padding: 1px 6px; border-radius: 4px;">${this.escapeHtml(item.badge)}</span>
            <div class="todo-item-title">${this.escapeHtml(item.title)}</div>
          </div>
          <div class="todo-item-desc">${this.escapeHtml(item.subtitle)}</div>
        </div>
        <button class="btn-todo-action">
          ${this.escapeHtml(item.actionText)}
        </button>
      `;

      card.onclick = () => {
        if (item.type === 'today_class' || item.type === 'makeup_score') {
          App.enterCockpit(item.className, item.period);
          if (item.type === 'makeup_score') {
            App.switchTab('assessment');
          }
        } else if (item.type === 'reflection_missing') {
          App.enterCockpit(item.className, item.period);
          App.openReflectionModal();
        }
      };

      todoContainer.appendChild(card);
    });
  },

  // --- Student Portal Controller ---
  initStudentPortal() {
    const classSelect = document.getElementById('select-student-class');
    if (!classSelect) return;

    const allClasses = [
      'ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.1/4', 'ม.1/5', 'ม.1/6', 'ม.1/7', 'ม.1/14',
      'ม.2/1', 'ม.2/2', 'ม.2/3', 'ม.2/4', 'ม.2/5', 'ม.2/6', 'ม.2/7', 'ม.2/14'
    ];

    classSelect.innerHTML = '';
    allClasses.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = cls;
      if (cls === this.state.studentClass) opt.selected = true;
      classSelect.appendChild(opt);
    });

    this.populateStudentPersonSelect(this.state.studentClass);
  },

  populateStudentPersonSelect(className) {
    const personSelect = document.getElementById('select-student-person');
    if (!personSelect) return;

    const students = Store.getStudents(className);
    personSelect.innerHTML = '';

    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.student_id;
      opt.textContent = `เลขที่ ${s.no} ${s.prefix}${s.first_name} ${s.last_name}`;
      if (s.student_id === this.state.studentId) opt.selected = true;
      personSelect.appendChild(opt);
    });

    if (students.length > 0 && (!this.state.studentId || !students.some(s => s.student_id === this.state.studentId))) {
      this.state.studentId = students[0].student_id;
      personSelect.value = this.state.studentId;
    }
  },

  onStudentClassChange(className) {
    this.state.studentClass = className;
    this.populateStudentPersonSelect(className);
    this.renderStudentPortal();
  },

  onStudentPersonChange(studentId) {
    this.state.studentId = studentId;
    this.renderStudentPortal();
  },

  selectStudentPeriod(period) {
    this.state.studentPeriod = parseInt(period, 10);
    this.renderStudentPortal();
  },

  renderStudentPortal() {
    const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
    if (!user || user.role !== 'student') {
      const viewStudent = document.getElementById('view-student');
      if (viewStudent) viewStudent.style.display = 'none';
      this.checkAuth();
      return;
    }

    const studentId = user.studentId || this.state.studentId;
    let student = Store.getStudentById ? Store.getStudentById(studentId) : null;
    if (!student && user.studentClass) {
      // โหมดเซิร์ฟเวอร์: เครื่องนักเรียนไม่มีรายชื่อทั้งห้อง ใช้ข้อมูลของตัวเองจากการเข้าสู่ระบบเท่านั้น
      student = { student_id: String(studentId), prefix: '', first_name: user.name || '', last_name: '',
        nickname: user.nickname || '', class: user.studentClass, no: user.no || '-' };
    }
    if (!student) {
      console.warn('Student account not found in roster:', studentId);
      return;
    }

    const className = student.class;
    this.state.studentId = student.student_id;
    this.state.studentClass = student.class;

    const studentSwitcher = document.getElementById('student-switcher-container');
    if (studentSwitcher) studentSwitcher.style.display = 'none';

    // 1. Update Student Profile Bar
    const nameEl = document.getElementById('student-portal-name');
    const idEl = document.getElementById('student-portal-id');
    const classEl = document.getElementById('student-portal-class');
    const noEl = document.getElementById('student-portal-no');
    const subjEl = document.getElementById('student-portal-subject');
    const statusBadge = document.getElementById('student-portal-status-badge');

    if (nameEl) nameEl.textContent = `${student.prefix}${student.first_name}${student.last_name ? ' ' + student.last_name : ''} (${student.nickname || '-'})`;
    if (idEl) idEl.textContent = student.student_id;
    if (classEl) classEl.textContent = className;
    if (noEl) noEl.textContent = student.no;

    let subjText = 'ศ21102 ดนตรีสากล 1 (ม.1)';
    let gradeKey = 'M1';
    if (className === 'ม.1/14') {
      subjText = 'AR21105 ดนตรีสากล (EP ม.1/14)';
      gradeKey = 'M1';
    } else if (className.startsWith('ม.2')) {
      subjText = 'ศ22102 ดนตรีสากล 2 (ม.2)';
      gradeKey = 'M2';
    }
    if (subjEl) subjEl.textContent = subjText;

    const studentStatus = Store.getStudentStatus(studentId);
    if (statusBadge) {
      if (studentStatus.status === 'withdrawn') {
        statusBadge.textContent = 'ลาออกกลางคัน';
        statusBadge.className = 'badge-danger';
      } else if (studentStatus.status === 'transferred') {
        statusBadge.textContent = 'ย้ายสถานศึกษา';
        statusBadge.className = 'badge-warning';
      } else {
        statusBadge.textContent = 'สถานะปกติ';
        statusBadge.className = 'badge-success';
      }
    }

    // Render Gamification Achievement Badges Strip
    const badgesStrip = document.getElementById('student-badges-strip');
    if (badgesStrip) {
      badgesStrip.innerHTML = '';
      const badges = Store.getStudentBadges ? Store.getStudentBadges(studentId, className) : [];
      
      const titleLabel = document.createElement('div');
      titleLabel.style.cssText = 'font-size: 0.82rem; font-weight: 700; color: #1e3a8a; white-space: nowrap; margin-right: 0.25rem; display: flex; align-items: center; gap: 4px;';
      titleLabel.innerHTML = `<span>🏆</span> เหรียญเกียรติยศ:`;
      badgesStrip.appendChild(titleLabel);

      badges.forEach(b => {
        const badgeCard = document.createElement('div');
        badgeCard.className = `badge-card ${b.unlocked ? 'unlocked' : 'locked'}`;
        badgeCard.title = `${b.title} - ${b.desc} (${b.unlocked ? 'ปลดล็อกแล้ว' : 'ยังไม่ปลดล็อก'})`;
        badgeCard.innerHTML = `
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-info">
            <span class="badge-name">${this.escapeHtml(b.title)}</span>
            <span class="badge-status">${b.unlocked ? 'ปลดล็อกแล้ว ⭐' : 'ยังไม่ปลดล็อก 🔒'}</span>
          </div>
        `;
        badgesStrip.appendChild(badgeCard);
      });
    }

    // 2. Metrics: Course Progress
    const sessions = Store.getAllSessions();
    let completedSessionsCount = 0;
    for (let p = 1; p <= 20; p++) {
      if (sessions[Store.getSessionKey(className, p)]) {
        completedSessionsCount++;
      }
    }
    const progressPct = Math.round((completedSessionsCount / 20) * 100);
    const progressTextEl = document.getElementById('student-progress-text');
    const progressPctEl = document.getElementById('student-progress-pct');
    const progressBarEl = document.getElementById('student-progress-bar');
    const progressFootnote = document.getElementById('student-progress-footnote');

    if (progressTextEl) progressTextEl.textContent = `คาบที่ ${completedSessionsCount}/20`;
    if (progressPctEl) progressPctEl.textContent = `${progressPct}%`;
    if (progressBarEl) progressBarEl.style.width = `${Math.max(5, progressPct)}%`;
    if (progressFootnote) progressFootnote.textContent = `จัดการเรียนรู้แล้ว ${completedSessionsCount} จากทั้งหมด 20 คาบ`;

    // 3. Metrics: Attendance Rate
    let recordedClassesCount = 0;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    for (let p = 1; p <= 20; p++) {
      const sess = sessions[Store.getSessionKey(className, p)];
      if (sess && sess.attendance) {
        const att = sess.attendance[studentId];
        if (att) {
          recordedClassesCount++;
          if (att === 'present' || att === 'late' || att === 'activity') presentCount++;
          else if (att === 'absent') absentCount++;
          else if (att === 'leave') leaveCount++;
        }
      }
    }

    const attPct = recordedClassesCount > 0 ? Math.round((presentCount / recordedClassesCount) * 100) : 100;
    const attPctEl = document.getElementById('student-attendance-pct');
    const attStatusEl = document.getElementById('student-attendance-status');
    const attBreakdownEl = document.getElementById('student-attendance-breakdown');

    if (attPctEl) {
      attPctEl.textContent = `${attPct}%`;
      attPctEl.style.color = attPct >= 80 ? '#16a34a' : '#dc2626';
    }
    if (attStatusEl) {
      if (attPct >= 80) {
        attStatusEl.textContent = 'มีสิทธิ์สอบ';
        attStatusEl.className = 'badge-success';
      } else {
        attStatusEl.textContent = 'เวลาเรียนไม่พอ (<80%)';
        attStatusEl.className = 'badge-danger';
      }
    }
    if (attBreakdownEl) {
      attBreakdownEl.textContent = `มาเรียน ${presentCount} ครั้ง • ขาด ${absentCount} • ลา ${leaveCount}`;
    }

    // 4. Metrics: Score Summary Breakdown
    let totalScore = 0;
    let scoredPeriodsCount = 0;
    for (let p = 1; p <= 20; p++) {
      const sess = sessions[Store.getSessionKey(className, p)];
      if (sess && sess.scores && sess.scores[studentId] !== undefined && sess.scores[studentId] !== null) {
        totalScore += Number(sess.scores[studentId]);
        scoredPeriodsCount++;
      }
    }
    const maxPossible = scoredPeriodsCount * 3;
    const scorePct = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 100;
    const scoreTextEl = document.getElementById('student-score-text');
    const scorePctEl = document.getElementById('student-score-pct');
    const theoryScoreEl = document.getElementById('score-theory-text');
    const practiceScoreEl = document.getElementById('score-practice-text');

    if (scoreTextEl) scoreTextEl.textContent = `${totalScore} / ${maxPossible > 0 ? maxPossible : 3}`;
    if (scorePctEl) scorePctEl.textContent = `${scorePct}%`;
    if (theoryScoreEl) theoryScoreEl.textContent = `${totalScore} คะแนน`;
    if (practiceScoreEl) practiceScoreEl.textContent = totalScore >= 2 ? 'ผ่านเกณฑ์ดีมาก' : (totalScore > 0 ? 'ผ่านเกณฑ์' : 'รอการประเมิน');

    // 5. To-Do List (Student assignments & remedial tasks)
    const todoListEl = document.getElementById('student-todo-list');
    if (todoListEl) {
      todoListEl.innerHTML = '';
      const allSubmissions = Store.getAllSubmissions();
      const todos = [];

      // Check remedial needed
      for (let p = 1; p <= 20; p++) {
        const sess = sessions[Store.getSessionKey(className, p)];
        if (sess && sess.attendance && (sess.attendance[studentId] === 'absent' || sess.attendance[studentId] === 'leave')) {
          const sc = sess.scores ? sess.scores[studentId] : 0;
          if (!sc) {
            todos.push({
              period: p,
              title: `ภารกิจซ่อมเสริม: คาบที่ ${p}`,
              subtitle: 'ขาดเรียน/ต้องส่งแบบฝึกหัดชดเชย',
              status: 'remedial',
              statusLabel: 'งานซ่อม',
              statusClass: 'badge-danger'
            });
          }
        }
      }

      // Check current period assignment
      const currentPeriodKey = `${className}_p${this.state.studentPeriod}_${studentId}`;
      const curSub = allSubmissions[currentPeriodKey];
      const st = this.studentTaskStatus(className, this.state.studentPeriod, !!curSub);
      todos.push({
        period: this.state.studentPeriod,
        title: `แบบฝึกหัดคาบที่ ${this.state.studentPeriod}`,
        subtitle: st.subtitle,
        status: st.state,
        statusLabel: st.label,
        statusClass: st.cls
      });

      todos.forEach(t => {
        const item = document.createElement('div');
        item.className = 'student-todo-item';
        item.innerHTML = `
          <div>
            <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${this.escapeHtml(t.title)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${this.escapeHtml(t.subtitle)}</div>
          </div>
          <span class="${t.statusClass}" style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px;">${this.escapeHtml(t.statusLabel)}</span>
        `;
        item.onclick = () => this.selectStudentPeriod(t.period);
        todoListEl.appendChild(item);
      });
    }

    // 6. Periods Selector Grid (20 buttons)
    const periodsContainer = document.getElementById('student-periods-list');
    if (periodsContainer) {
      periodsContainer.innerHTML = '';
      const allSubmissions = Store.getAllSubmissions();

      for (let p = 1; p <= 20; p++) {
        const btn = document.createElement('button');
        btn.className = `student-period-btn ${p === this.state.studentPeriod ? 'active' : ''}`;
        const hasSession = !!sessions[Store.getSessionKey(className, p)];
        const subKey = `${className}_p${p}_${studentId}`;
        const hasSub = !!allSubmissions[subKey];

        let icon = '';
        if (hasSub) icon = ' ✓';
        else if (hasSession) icon = ' •';

        btn.textContent = `${p}${icon}`;
        btn.title = `คาบที่ ${p}`;
        btn.onclick = () => this.selectStudentPeriod(p);
        periodsContainer.appendChild(btn);
      }
    }

    // 7. Render Workspace: Lesson Content & In-Page Submission Area
    // ฉบับนักเรียน: ตัดขั้นตอนการสอน คำแนะนำครู รูบริกครู ออกก่อนสร้าง DOM
    const lesson = RoleGuard.sanitizeLesson(Store.getLesson(gradeKey, this.state.studentPeriod));
    const badgePeriodEl = document.getElementById('student-workspace-period-badge');
    const titleEl = document.getElementById('student-workspace-title');
    const lessonTextEl = document.getElementById('student-lesson-text');
    const promptEl = document.getElementById('student-assignment-prompt');
    const statusChipEl = document.getElementById('student-submission-status-chip');
    const textInput = document.getElementById('student-submission-text');
    const urlInput = document.getElementById('student-submission-url');
    const timestampEl = document.getElementById('student-submission-timestamp');

    if (badgePeriodEl) badgePeriodEl.textContent = `คาบที่ ${this.state.studentPeriod}`;
    if (titleEl) titleEl.textContent = lesson?.topic || `เนื้อหาการเรียนรู้ คาบที่ ${this.state.studentPeriod}`;

    if (lessonTextEl) {
      lessonTextEl.innerHTML = this.buildStudentStudyGuideHTML(gradeKey, this.state.studentPeriod, lesson);
    }

    if (promptEl) {
      if (lesson?.assessment?.has_score) {
        promptEl.textContent = `ภารกิจประจำคาบ: ปฏิบัติตามกิจกรรมการเรียนรู้ อธิบายความเข้าใจ หรือบันทึกผลการปฏิบัติเครื่องดนตรี (${lesson.topic})`;
      } else {
        promptEl.textContent = `ภารกิจ: บันทึกความเข้าใจ หรืออธิบายข้อคิดที่ได้จากการเรียนรู้ในคาบที่ ${this.state.studentPeriod}`;
      }
    }

    // Check submission state
    const allSubs = Store.getAllSubmissions();
    const submissionKey = `${className}_p${this.state.studentPeriod}_${studentId}`;
    const sub = allSubs[submissionKey];

    if (sub) {
      if (textInput) textInput.value = sub.content || '';
      if (urlInput) urlInput.value = sub.url || '';
      const st = this.studentTaskStatus(className, this.state.studentPeriod, true);
      if (timestampEl) timestampEl.innerHTML = st.state === 'sent' || st.state === 'done'
        ? `<span style="color: #16a34a; font-weight: 600;">✅ ส่งงานสำเร็จเมื่อ: ${this.escapeHtml(sub.submittedAt)}</span>`
        : `<span style="color: ${st.state === 'failed' ? '#dc2626' : '#d97706'}; font-weight: 600;">${this.escapeHtml(st.subtitle)}</span>`;
      if (statusChipEl) {
        statusChipEl.innerHTML = `<span class="${st.cls}" style="font-size: 0.82rem; padding: 4px 10px; border-radius: 9999px;">${this.escapeHtml(st.label)}</span>`;
      }
    } else {
      if (textInput) textInput.value = '';
      if (urlInput) urlInput.value = '';
      if (timestampEl) timestampEl.textContent = 'ยังไม่ได้ส่งงานในคาบนี้';
      if (statusChipEl) {
        statusChipEl.innerHTML = `<span class="badge-warning" style="font-size: 0.82rem; padding: 4px 10px; border-radius: 9999px;">ยังไม่ได้ส่งงาน</span>`;
      }
    }

    // Two-way Teacher Feedback Loop in Student Portal
    const feedbackCard = document.getElementById('student-teacher-feedback-card');
    if (feedbackCard) {
      if (sub && sub.teacherFeedback && sub.teacherFeedback.feedback) {
        feedbackCard.style.display = 'block';
        const tf = sub.teacherFeedback;
        feedbackCard.innerHTML = `
          <div class="teacher-feedback-header">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #dbeafe; color: #1e40af; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
                👨‍🏫
              </div>
              <div>
                <div style="font-weight: 700; color: #1e3a8a; font-size: 0.95rem;">
                  คำแนะนำจาก${this.escapeHtml(tf.teacherName || 'คุณครู')} (${this.escapeHtml(tf.teacherRole || 'ครูผู้สอน')})
                </div>
                <div style="font-size: 0.75rem; color: #64748b;">
                  บันทึกเมื่อ: ${this.escapeHtml(tf.feedbackAt || 'เมื่อเร็วๆ นี้')}
                </div>
              </div>
            </div>
            ${tf.score !== null && tf.score !== undefined ? `
              <span class="badge-primary" style="font-size: 0.85rem; padding: 4px 10px; border-radius: 9999px; font-weight: 700;">
                ⭐ คะแนนที่ได้รับ: ${tf.score} / 3
              </span>
            ` : ''}
          </div>
          <div class="teacher-feedback-speech">
            "${this.escapeHtml(tf.feedback)}"
          </div>
        `;
      } else {
        feedbackCard.style.display = 'none';
      }
    }

    // Render Unit Quiz & Feldman Action Buttons
    const quizActionButtons = document.getElementById('student-quiz-action-buttons');
    const quizActionTitle = document.getElementById('student-quiz-action-title');
    if (quizActionButtons) {
      const curPeriod = this.state.studentPeriod;
      const unitNo = (curPeriod <= 4) ? 1 : (curPeriod <= 11) ? 2 : (curPeriod <= 15) ? 3 : 4;
      const unitNames = { 1: 'พื้นฐานคาลิมบ้า', 2: 'ปฏิบัติรวมวงคาลิมบ้า', 3: 'รอบรู้วงดนตรีและวัฒนธรรม', 4: 'สุนทรียภาพแห่งการฟัง' };

      if (quizActionTitle) {
        quizActionTitle.textContent = `แบบทดสอบท้ายหน่วยที่ ${unitNo}: ${unitNames[unitNo]} (10 ข้อ)`;
      }

      const attempt = (typeof QuizEngine !== 'undefined') ? QuizEngine.getStudentAttempt(studentId, unitNo) : null;
      let quizBtnText = `📝 ทำแบบทดสอบหน่วยที่ ${unitNo}`;
      let quizBtnClass = 'btn-nav-action primary';
      if (attempt && attempt.submitted) {
        quizBtnText = `📋 ดูผลการสอบ (${attempt.score}/${attempt.maxScore} คะแนน)`;
        quizBtnClass = 'btn-nav-action';
      }

      let btnsHtml = `
        <button class="${quizBtnClass}" onclick="QuizEngine.openQuizModal(${unitNo}, '${studentId}')">
          ${quizBtnText}
        </button>
      `;

      if (curPeriod >= 15) {
        btnsHtml += `
          <button class="btn-nav-action" style="background: #fdf2f8; color: #db2777; border-color: #fbcfe8; font-weight: 600;" onclick="FeldmanCriticism.openModal(${curPeriod}, '${studentId}')" title="เขียนใบวิจารณ์ผลงานดนตรี 4 ขั้นตอน">
            🎨 ใบวิจารณ์ Feldman
          </button>
        `;
      }

      if (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive()) {
        btnsHtml += `<button class="btn-nav-action" style="background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe;font-weight:600;" onclick="PracticeQuiz.open(${unitNo})" title="ทำแบบฝึกได้ไม่จำกัด ไม่นับคะแนน">🧪 แบบฝึก (ไม่นับคะแนน)</button>`;
        const qs = StudentOutbox.statusFor(StudentOutbox.quizKey(unitNo));
        if (qs) btnsHtml += `<span class="${qs.cls}" style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; align-self: center;">แบบทดสอบ: ${this.escapeHtml(qs.label)}</span>`;
      }
      quizActionButtons.innerHTML = btnsHtml;
    }
    if (typeof StudentOutbox !== 'undefined') StudentOutbox.render();
    if (typeof StudentNotices !== 'undefined') StudentNotices.render();
    if (typeof StudentUpload !== 'undefined') StudentUpload.render();
  },

  onStudentFileSelected(input) {
    if (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive() && typeof StudentUpload !== 'undefined') { StudentUpload.pick(input); return; }
    const previewEl = document.getElementById('student-file-preview');
    if (!previewEl) return;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      if (file.size > 20 * 1024 * 1024) {
        alert('⚠️ ไฟล์มีขนาด ' + sizeMB + ' MB ซึ่งเกิน 20 MB\nแนะนำให้อัปโหลดลง Google Drive หรือ YouTube แล้วนำลิงก์มาวางในช่องลิงก์ด้านล่างแทนครับ');
        input.value = '';
        previewEl.style.display = 'none';
        return;
      }
      previewEl.style.display = 'block';
      previewEl.innerHTML = `✅ เลือกไฟล์: <strong>${this.escapeHtml(file.name)}</strong> (${sizeMB} MB) • พร้อมอัปโหลดเข้า Google Drive ครู`;
    } else {
      previewEl.style.display = 'none';
    }
  },

  async handleStudentSubmit() {
    const textInput = document.getElementById('student-submission-text');
    const urlInput = document.getElementById('student-submission-url');
    const fileInput = document.getElementById('student-submission-file');
    const content = textInput ? textInput.value.trim() : '';
    const url = urlInput ? urlInput.value.trim() : '';
    const remoteUpload = (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive() && typeof StudentUpload !== 'undefined');
    const pickedFile = remoteUpload ? (StudentUpload.picked || (fileInput && fileInput.files && fileInput.files[0]) || null) : null;
    const hasFile = pickedFile || (fileInput && fileInput.files && fileInput.files[0]);

    if (!content && !url && !hasFile) {
      alert('กรุณาพิมพ์คำตอบ แนบไฟล์ หรือใส่ลิงก์ผลงานก่อนกดส่งงานครับ');
      return;
    }

    let fileBase64 = '';
    let fileName = '';
    let mimeType = '';
    let fileSize = 0;

    if (hasFile && !remoteUpload) {
      const file = fileInput.files[0];
      fileName = file.name;
      mimeType = file.type || 'application/octet-stream';
      fileSize = file.size;
      try {
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch (err) {
        console.warn('File read error:', err);
      }
    }

    const remoteMode = (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive());
    if (remoteMode && url && !/^https?:\/\//i.test(url)) {
      alert('ลิงก์ผลงานต้องขึ้นต้นด้วย http:// หรือ https://');
      return;
    }
    if (remoteMode && hasFile) {
      // อัปโหลดไฟล์เข้า Drive ครูแบบแบ่งชิ้น แล้วส่งงาน (ข้อความ+ลิงก์+ไฟล์) เมื่ออัปโหลดเสร็จ
      const r = await StudentUpload.add(pickedFile, { purpose: 'assignment', period: this.state.studentPeriod, className: this.state.studentClass, content, url });
      if (!r.success) { alert('⚠️ ' + r.message); return; }
      Store.saveStudentSubmission(this.state.studentClass, this.state.studentPeriod, this.state.studentId,
        { submissionType: 'file_upload', content, url, fileName: pickedFile.name, fileSize: pickedFile.size, mimeType: pickedFile.type, pendingUploadId: r.id });
      StudentUpload.picked = null;
      if (fileInput) fileInput.value = '';
      alert(`📤 เริ่มอัปโหลดไฟล์งานคาบที่ ${this.state.studentPeriod} แล้ว${r.warn ? '\n⏳ ' + r.warn : ''}\nดูความคืบหน้าใต้ช่องแนบไฟล์ (ถ้าเน็ตหลุด ระบบจะทำต่อเองเมื่อออนไลน์)`);
      this.renderStudentPortal();
      return;
    }
    if (remoteMode && url && !/^https?:\/\//i.test(url)) {
      alert('ลิงก์ผลงานต้องขึ้นต้นด้วย http:// หรือ https://');
      return;
    }
    if (remoteMode && content.length > 5000) {
      alert('คำตอบยาวเกิน 5,000 ตัวอักษร กรุณาย่อให้สั้นลง');
      return;
    }

    const subType = (hasFile && !remoteMode) ? (url ? 'file_and_url' : 'file_upload') : (url ? 'mixed' : 'text');

    Store.saveStudentSubmission(
      this.state.studentClass,
      this.state.studentPeriod,
      this.state.studentId,
      {
        submissionType: subType,
        content,
        url,
        fileName,
        fileBase64,
        mimeType,
        fileSize
      }
    );

    alert(remoteMode
      ? `📤 บันทึกงานคาบที่ ${this.state.studentPeriod} แล้ว กำลังส่งให้คุณครู\nดูสถานะได้ที่ป้าย ส่งแล้ว / รอส่ง / ส่งไม่สำเร็จ (ถ้าออฟไลน์ ระบบจะส่งให้อัตโนมัติเมื่อต่อเน็ต)`
      : `🎉 ส่งงานประจำคาบที่ ${this.state.studentPeriod} เรียบร้อยแล้วครับ!\nระบบกำลังบันทึกข้อมูลและส่งเข้า Google Sheet / Google Drive ให้คุณครู`);
    this.renderStudentPortal();
  },

  // สถานะงานของนักเรียน: ส่งแล้ว / รอส่ง / ส่งไม่สำเร็จ
  studentTaskStatus(className, period, hasLocal) {
    const remote = (typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive())
      ? StudentOutbox.statusFor(StudentOutbox.assignmentKey(className, period)) : null;
    if (remote) {
      const sub = remote.state === 'sent' ? 'ครูได้รับงานแล้ว'
        : remote.state === 'failed' ? (remote.message || 'ส่งไม่สำเร็จ จะลองใหม่อัตโนมัติ')
        : 'บันทึกในเครื่องแล้ว กำลังส่งให้ครู';
      return { state: remote.state, label: remote.label, cls: remote.cls, subtitle: sub };
    }
    if (hasLocal) return { state: 'done', label: 'ส่งแล้ว ✅', cls: 'badge-success', subtitle: 'ส่งงานเรียบร้อยแล้ว' };
    const due = (typeof StudentOutbox !== 'undefined') ? StudentOutbox.dueFor(className, period) : '';
    if (due) {
      const overdue = Date.now() > new Date(due).getTime();
      return { state: 'todo', label: overdue ? 'เลยกำหนดส่ง' : 'ยังไม่ส่ง', cls: overdue ? 'badge-danger' : 'badge-warning',
        subtitle: `กำหนดส่ง ${new Date(due).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}` };
    }
    return { state: 'todo', label: 'ยังไม่ส่ง', cls: 'badge-warning', subtitle: 'ส่งคำตอบในหน้าบทเรียนนี้' };
  },

  buildStudentStudyGuideHTML(gradeKey, period, lesson) {
    if (!lesson) {
      return `<p style="color: var(--text-muted);">กำลังจัดเตรียมแผนการเรียนรู้สำหรับคาบนี้</p>`;
    }

    const p = parseInt(period, 10);
    const isM1 = (gradeKey === 'M1');

    let html = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <span style="background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 0.78rem; padding: 3px 8px; border-radius: 4px;">
            หน่วยที่ ${lesson.unit_no}: ${this.escapeHtml(lesson.unit_name)}
          </span>
          <h3 style="margin: 0.4rem 0 0.2rem 0; font-size: 1.15rem; color: #1e3a8a; font-weight: 800;">
            ${this.escapeHtml(lesson.topic)}
          </h3>
        </div>
        <button class="btn-nav-action" style="font-size: 0.8rem; background: #fef08a; color: #854d0e; border-color: #fde047; font-weight: 700;" onclick="App.openMusicAidsModal()">
          🎼 สื่อโน้ตสากล & ผังคาลิมบ้า
        </button>
      </div>

      <!-- K-P-A Goals -->
      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
        <div style="font-weight: 700; color: #1e3a8a; font-size: 0.88rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
          <span>🎯</span> เป้าหมายการเรียนรู้ในคาบนี้:
        </div>
        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.86rem; color: #334155; line-height: 1.6;">
          <li><strong>ด้านความรู้ (K):</strong> ${this.escapeHtml(lesson.kpa?.k || '-')}</li>
          <li><strong>ด้านทักษะปฏิบัติ (P):</strong> ${this.escapeHtml(lesson.kpa?.p || '-')}</li>
          <li><strong>ด้านคุณลักษณะ (A):</strong> ${this.escapeHtml(lesson.kpa?.a || '-')}</li>
        </ul>
      </div>
    `;

    // --- Dynamic Period-Specific Interactive Learning Content ---
    if (p === 1) {
      // Period 1: Orientation
      html += `
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); border: 1.5px solid #93c5fd; border-radius: 10px; padding: 1.1rem; margin-bottom: 1.25rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #1e40af; font-size: 0.98rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem;">
            <span>📢</span> ข้อมูลปฐมนิเทศรายวิชาและเกณฑ์คะแนน 100 คะแนนเต็ม
          </h4>
          <div style="font-size: 0.86rem; color: #334155; line-height: 1.6; margin-bottom: 0.75rem;">
            ยินดีต้อนรับสู่รายวิชาดนตรี ในภาคเรียนนี้จัดการเรียนรู้ 20 คาบ โดยใช้แอปพลิเคชัน <strong>MusicSmart</strong> ควบคู่การปฏิบัติเครื่องดนตรีคาลิมบ้า 17 คีย์
          </div>

          <!-- Score Table -->
          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 0.85rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: center;">
              <thead style="background: #1e3a8a; color: #ffffff;">
                <tr>
                  <th style="padding: 6px;">หมวดการประเมิน</th>
                  <th style="padding: 6px;">สัดส่วน</th>
                  <th style="padding: 6px;">รายละเอียดคะแนน</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px; font-weight: 700; text-align: left;">1. คะแนนเก็บระหว่างภาคเรียน</td>
                  <td style="padding: 6px; font-weight: 700; color: #2563eb;">80 คะแนน</td>
                  <td style="padding: 6px; text-align: left;">ความรู้ K (30) + ปฏิบัติ P (30) + จิตพิสัย A (20)</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                  <td style="padding: 6px; font-weight: 700; text-align: left;">2. สอบวัดผลกลางภาค (คาบที่ 11)</td>
                  <td style="padding: 6px; font-weight: 700; color: #d97706;">10 คะแนน</td>
                  <td style="padding: 6px; text-align: left;">สอบทักษะปฏิบัติเดี่ยว/กลุ่ม 8 คะแนน + ข้อสอบทฤษฎี 2 คะแนน</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px; font-weight: 700; text-align: left;">3. สอบวัดผลปลายภาค (คาบที่ 19-20)</td>
                  <td style="padding: 6px; font-weight: 700; color: #16a34a;">10 คะแนน</td>
                  <td style="padding: 6px; text-align: left;">สอบปฏิบัติรวมวง 8 คะแนน + ข้อสอบทฤษฎี 2 คะแนน</td>
                </tr>
                <tr style="background: #f1f5f9; font-weight: 800; color: #0f172a;">
                  <td style="padding: 6px; text-align: left;">รวมทั้งสิ้น</td>
                  <td style="padding: 6px; color: #1e40af;">100 คะแนน</td>
                  <td style="padding: 6px; text-align: left;">เกณฑ์เวลาเรียนต้องไม่น้อยกว่า 80% (16 จาก 20 คาบ)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Rules -->
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.75rem; font-size: 0.82rem; color: #92400e;">
            <strong>🔒 กฎและข้อตกลง 4 ข้อสำคัญในห้องปฏิบัติการดนตรี:</strong>
            <ol style="margin: 0.35rem 0 0 0; padding-left: 1.25rem; line-height: 1.5;">
              <li>ถือเครื่องคาลิมบ้าด้วยสองมือเสมอ และวางบนผ้ารองเครื่องประจำโต๊ะ ไม่วางซ้อนกัน</li>
              <li>ห้ามดึง ดัด หรืองัดลิ่มเสียงเหล็กเด็ดขาด (หากเสียงเพี้ยนให้ใช้ค้อนจูนเสียงเคาะเบาๆ)</li>
              <li>เมื่อได้ยินสัญญาณเคาะ Woodblock 3 จังหวะ ให้หยุดดีดทันทีและสบตาคุณครู</li>
              <li>ตรวจเช็ค ทำความสะอาด และเก็บเครื่องดนตรีลงในซองกันกระแทกก่อนออกจากห้องเรียน</li>
            </ol>
          </div>
        </div>
      `;
    } else if (isM1 && p >= 2 && p <= 5) {
      // M.1 Periods 2-5: Basic Kalimba & Standard Staff Notation
      html += `
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 1.1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-weight: 800; color: #1e3a8a; font-size: 0.96rem;">
              🎼 สื่อฝึกอ่านโน้ตสากลในกุญแจซอล (C4 - C5) & ผังลิ่มเสียง 17 คีย์
            </div>
            <span style="font-size: 0.78rem; color: #64748b;">(แตะที่ตัวโน้ตเพื่อฟังเสียงจริง)</span>
          </div>

          <!-- Interactive Note Chips for Students -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 0.5rem; margin-bottom: 1rem;">
            ${[
              { note: 'C4', num: '1', th: 'โด', pos: 'เส้นน้อยล่าง' },
              { note: 'D4', num: '2', th: 'เร', pos: 'ใต้เส้นที่ 1' },
              { note: 'E4', num: '3', th: 'มี', pos: 'คาบเส้นที่ 1' },
              { note: 'F4', num: '4', th: 'ฟา', pos: 'ช่องที่ 1' },
              { note: 'G4', num: '5', th: 'ซอล', pos: 'คาบเส้นที่ 2' },
              { note: 'A4', num: '6', th: 'ลา', pos: 'ช่องที่ 2' },
              { note: 'B4', num: '7', th: 'ที', pos: 'คาบเส้นที่ 3' },
              { note: 'C5', num: '1̇', th: 'โดสูง', pos: 'ช่องที่ 3' }
            ].map(item => `
              <div onclick="App.playAidsNote('${item.note}')" style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0.5rem 0.25rem; text-align: center; cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#38bdf8';" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';">
                <div style="font-weight: 800; font-size: 1.05rem; color: #1e3a8a;">${item.note}</div>
                <div style="font-size: 0.85rem; font-weight: 700; color: #0284c7;">(${item.num} ${item.th})</div>
                <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">${item.pos}</div>
              </div>
            `).join('')}
          </div>

          <!-- Key Tips -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.82rem;">
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.65rem;">
              <strong style="color: #1d4ed8;">👍 ท่าทางการจับและดีด:</strong><br>
              ผ่อนคลายข้อมือ สองมือโอบประคองตัวเครื่องด้านข้าง ใช้ปลายนิ้วโป้งสะกิดลิ่มเสียงทำมุม <strong>45 องศา</strong> ห้ามใช้เล็บจิกตรงๆ
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.65rem;">
              <strong style="color: #15803d;">🎹 ลิ่มเสียงคาลิมบ้า 17 คีย์:</strong><br>
              ลิ่มกลางยาวที่สุดคือ <strong>C4 (1)</strong> จากนั้นโน้ตจะไล่ระดับเสียงสลับ <strong>ซ้าย-ขวา-ซ้าย-ขวา</strong> ออกไปสองข้าง
            </div>
          </div>
        </div>
      `;
    } else if (isM1 && p >= 6 && p <= 8) {
      // M.1 Song Practice (Mary & Twinkle)
      html += `
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 1.1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-weight: 800; color: #1e3a8a; font-size: 0.96rem;">
              🐑 โน้ตเพลงฝึกซ้อมเดี่ยว: เพลงหนูมาลี (Mary Had a Little Lamb)
            </div>
            <button class="btn-nav-action primary" style="font-size: 0.78rem; padding: 4px 10px;" onclick="VirtualKalimba.openModal()">
              ▶ ซ้อมในห้องซ้อมจำลอง (Virtual Kalimba)
            </button>
          </div>

          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; font-family: monospace; font-size: 0.9rem; line-height: 1.7; overflow-x: auto;">
            <div><strong>[ท่อน 1]</strong> | 3 &nbsp;2 &nbsp;1 &nbsp;2 | 3 &nbsp;3 &nbsp;3 &nbsp;- | 2 &nbsp;2 &nbsp;2 &nbsp;- | 3 &nbsp;5 &nbsp;5 &nbsp;- |</div>
            <div style="color: #64748b;">เนื้อร้อง: | หนู มา ลี มี &nbsp;| ลูก แมว เหมียว | ลูก แมว เหมียว | ลูก แมว เหมียว |</div>
            <div style="margin-top: 0.5rem;"><strong>[ท่อน 2]</strong> | 3 &nbsp;2 &nbsp;1 &nbsp;2 | 3 &nbsp;3 &nbsp;3 &nbsp;3 | 2 &nbsp;2 &nbsp;3 &nbsp;2 | 1 &nbsp;- &nbsp;- &nbsp;- |</div>
            <div style="color: #64748b;">เนื้อร้อง: | หนู มา ลี มี &nbsp;| ลูก แมว เหมียว | ขน มัน ดู คล้าย | สำ &nbsp;ลี &nbsp;- &nbsp;- |</div>
          </div>
        </div>
      `;
    } else if (!isM1 && p >= 5 && p <= 6) {
      // M.2 Canon / Round (Row Your Boat)
      html += `
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); border: 1.5px solid #86efac; border-radius: 10px; padding: 1.1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-weight: 800; color: #166534; font-size: 0.96rem;">
              🚣‍♂️ บทเพลงวนรอบ Canon / Round: Row, Row, Row Your Boat (ม.2)
            </div>
            <button class="btn-nav-action primary" style="font-size: 0.78rem; padding: 4px 10px;" onclick="VirtualKalimba.openModal()">
              ▶ ซ้อมใน Virtual Kalimba
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.65rem; margin-bottom: 0.85rem; font-size: 0.8rem;">
            <div style="background: #dcfce7; border: 1px solid #86efac; border-radius: 6px; padding: 0.55rem;">
              <strong style="color: #15803d;">🟢 กลุ่ม A (กลุ่มนำ):</strong> เริ่มบรรเลงตั้งแต่ห้องที่ 1 ห้ามเร่งจังหวะ
            </div>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.55rem;">
              <strong style="color: #1d4ed8;">🔵 กลุ่ม B (กลุ่มตาม):</strong> เริ่มเล่นห้อง 1 เมื่อกลุ่ม A เข้าสู่ห้องที่ 3
            </div>
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 0.55rem;">
              <strong style="color: #b45309;">🟡 กลุ่ม C (Ostinato):</strong> ดีดโน้ต C4 (1) คลอจังหวะเบสต่อเนื่อง
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; font-family: monospace; font-size: 0.88rem; line-height: 1.7; overflow-x: auto;">
            <div>ห้อง 1-2 (กลุ่ม A เริ่ม): | <strong>1</strong> . <strong>1</strong> . | <strong>1</strong> <strong>2</strong> <strong>3</strong> . | &nbsp; Row row row your boat</div>
            <div>ห้อง 3-4 (<span style="color:#2563eb; font-weight:700;">🔔 กลุ่ม B เข้า</span>): | <strong>3</strong> <strong>2</strong> <strong>3</strong> <strong>4</strong> | <strong>5</strong> . . . | &nbsp; Gently down the stream</div>
            <div>ห้อง 5-6: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <strong>1̇</strong><strong>1̇</strong><strong>1̇</strong> <strong>5</strong><strong>5</strong><strong>5</strong> | <strong>3</strong><strong>3</strong><strong>3</strong> <strong>1</strong><strong>1</strong><strong>1</strong> | &nbsp; Merrily merrily merrily merrily</div>
            <div>ห้อง 7-8: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <strong>5</strong> <strong>4</strong> <strong>3</strong> <strong>2</strong> | <strong>1</strong> . . . | &nbsp; Life is but a dream</div>
          </div>
        </div>
      `;
    }

    // --- เนื้อหา/สื่อที่ต้องเรียน (ฉบับนักเรียน: ไม่แสดงขั้นตอนการสอนของครู) ---
    const studentMedia = (lesson.media || []).filter(m => m && m.title);
    if (studentMedia.length > 0) {
      html += `
        <div style="font-weight: 700; color: #1e3a8a; font-size: 0.92rem; margin-bottom: 0.65rem;">
          📚 สื่อและเนื้อหาที่ต้องเรียนในคาบนี้:
        </div>
      `;
      studentMedia.forEach((m) => {
        const safeUrl = /^(https?:\/\/|academic\/|images\/|\.\/)/.test(m.url || '') ? m.url : '';
        html += `
          <div style="margin-bottom: 0.5rem; padding: 0.55rem 0.85rem; background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 6px; font-size: 0.86rem;">
            ${safeUrl ? `<a href="${this.escapeHtml(safeUrl)}" target="_blank" rel="noopener" style="color: #0369a1; font-weight: 600;">${this.escapeHtml(m.title)}</a>` : `<span style="font-weight: 600; color: #0369a1;">${this.escapeHtml(m.title)}</span>`}
          </div>
        `;
      });
    }

    // --- Action Bar for Student ---
    html += `
      <div style="margin-top: 1.25rem; padding: 0.85rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <span style="font-size: 0.82rem; color: #475569; font-weight: 600;">
          💡 เครื่องมือพร้อมเรียนประจำคาบ:
        </span>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
          <button class="btn-nav-action" style="font-size: 0.78rem; padding: 4px 8px;" onclick="Tuner.openModal()">
            🎸 เครื่องตั้งเสียง (Tuner)
          </button>
          <button class="btn-nav-action" style="font-size: 0.78rem; padding: 4px 8px; background: #eff6ff; color: #1d4ed8;" onclick="VirtualKalimba.openModal()">
            🎵 ซ้อมคาลิมบ้าจำลอง
          </button>
          <button class="btn-nav-action" style="font-size: 0.78rem; padding: 4px 8px; background: #fef08a; color: #854d0e;" onclick="App.openMusicAidsModal()">
            🎼 สื่อโน้ตสากล
          </button>
        </div>
      </div>
    `;

    return html;
  },

  updateInstructorBadge() {
    const inst = Store.getInstructor();
    const roleEl = document.getElementById('badge-instructor-role');
    const nameEl = document.getElementById('badge-instructor-name');
    if (roleEl) roleEl.textContent = inst.role;
    if (nameEl) nameEl.textContent = inst.name;
  },

  // --- User & Admin Management System ---
  openUserManagementModal(initialTab = 'admin') {
    const modal = document.getElementById('modal-user-management');
    if (!modal) return;
    this.switchUserMgmtTab(initialTab);
    modal.classList.add('active');
  },

  closeUserManagementModal() {
    const modal = document.getElementById('modal-user-management');
    if (modal) modal.classList.remove('active');
  },

  switchUserMgmtTab(tabName) {
    const tabs = ['admin', 'teachers', 'students'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-user-${t}`);
      const pane = document.getElementById(`user-pane-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.classList.add('active');
          btn.style.background = '#1e3a8a';
          btn.style.color = '#ffffff';
        } else {
          btn.classList.remove('active');
          btn.style.background = '#ffffff';
          btn.style.color = '#475569';
        }
      }
      if (pane) {
        pane.style.display = (t === tabName) ? 'block' : 'none';
      }
    });

    if (tabName === 'admin') this.renderAdminProfileTab();
    else if (tabName === 'teachers') this.renderTeachersTab();
    else if (tabName === 'students') this.renderStudentPinsTab();
  },

  renderAdminProfileTab() {
    const adminAcc = Store.getTeacherAccount();
    const inst = Store.getInstructor();
    const nameDisplay = document.getElementById('user-admin-name-display');
    const emailDisplay = document.getElementById('user-admin-email-display');
    if (nameDisplay) nameDisplay.textContent = adminAcc.name || inst.name || 'นายพงศธร โพธิแก้ว';
    if (emailDisplay) emailDisplay.innerHTML = `อีเมลล็อกอิน: <strong>${adminAcc.email || 'krumum.piano@gmail.com'}</strong>`;

    const newPassInput = document.getElementById('admin-new-password');
    const confPassInput = document.getElementById('admin-confirm-password');
    if (newPassInput) newPassInput.value = '';
    if (confPassInput) confPassInput.value = '';
  },

  handleAdminPasswordChange() {
    const newPass = (document.getElementById('admin-new-password')?.value || '').trim();
    const confPass = (document.getElementById('admin-confirm-password')?.value || '').trim();

    if (!newPass) {
      alert('⚠️ กรุณาระบุรหัสผ่านใหม่');
      return;
    }
    if (newPass.length < 4) {
      alert('⚠️ รหัสผ่านควรมีความยาวอย่างน้อย 4 ตัวอักษรขึ้นไป');
      return;
    }
    if (newPass !== confPass) {
      alert('⚠️ รหัสผ่านใหม่และรหัสยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    const res = Store.changeAdminPassword(newPass);
    if (res.success) {
      alert(`✅ ${res.message}\nรหัสผ่านใหม่ของคุณครูคือ: ${newPass}`);
      this.renderAdminProfileTab();
    } else {
      alert(`❌ ${res.message}`);
    }
  },

  renderTeachersTab() {
    const list = Store.getTeachersList();
    const currentInst = Store.getInstructor();
    const container = document.getElementById('user-mgmt-teachers-list');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 2rem;">ไม่พบข้อมูลครูผู้สอน</div>';
      return;
    }

    container.innerHTML = list.map(t => {
      const isActiveTeaching = t.activeTeaching || (currentInst && currentInst.name === t.name);
      const isMentor = !!t.isAdmin || t.id === 'admin_primary';
      const roleBadgeBg = isMentor ? '#2563eb' : (t.role.includes('ฝึกสอน') ? '#0284c7' : '#10b981');
      const roleIcon = isMentor ? '👑' : (t.role.includes('ฝึกสอน') ? '🎓' : '🤝');

      return `
        <div class="student-card" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.15rem; border-radius: 12px; border: 1.5px solid ${isActiveTeaching ? '#2563eb' : '#e2e8f0'}; background: ${isActiveTeaching ? '#f0f7ff' : '#ffffff'}; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 0;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: ${roleBadgeBg}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
              ${roleIcon}
            </div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a;">${t.name}</span>
                <span class="badge" style="background: ${roleBadgeBg}; color: #ffffff; padding: 2px 7px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700;">
                  ${t.role}
                </span>
                ${isActiveTeaching ? '<span class="badge" style="background: #16a34a; color: #ffffff; padding: 2px 7px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700;">🎯 กำลังสอนคาบนี้</span>' : ''}
              </div>
              <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <span>🏫 สังกัด: <strong>${t.institution || 'โรงเรียนพะเยาพิทยาคม'}</strong></span>
                <span>📧 บัญชี: <strong>${t.email}</strong></span>
                <span>🔑 รหัสผ่าน: ${t.needsFirstTimeSetup ? '<span style="color:#d97706; font-weight:700;">(รอตั้งรหัสครั้งแรก)</span>' : `<code>${t.secret || '****'}</code>`}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;">
            ${!isActiveTeaching ? `
              <button class="btn-nav-action" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; background: #ffffff; border-color: #cbd5e1; font-weight: 600;" onclick="App.handleSelectActiveTeacher('${t.id}')" title="สลับให้ท่านนี้เป็นผู้ปฏิบัติการสอนในคาบนี้">
                🎯 เลือกสอนคาบนี้
              </button>
            ` : `
              <span style="font-size: 0.8rem; font-weight: 700; color: #16a34a; padding: 0.35rem 0.65rem;">✓ ผู้สอนหลักในคาบ</span>
            `}
            ${!isMentor ? `
              <button class="btn-nav-action" style="color: #ef4444; border-color: #fecaca; background: #fff5f5; padding: 0.35rem 0.65rem;" onclick="App.handleDeleteTeacher('${t.id}')" title="ลบครูท่านนี้">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  toggleAddTeacherForm(show) {
    const box = document.getElementById('add-teacher-form-box');
    if (!box) return;
    const isShowing = box.style.display !== 'none';
    const targetShow = (show !== undefined) ? show : !isShowing;
    box.style.display = targetShow ? 'block' : 'none';
    if (targetShow) {
      document.getElementById('new-teacher-name').value = '';
      document.getElementById('new-teacher-email').value = '';
      document.getElementById('new-teacher-secret').value = '1234';
      document.getElementById('new-teacher-institution').value = 'มหาวิทยาลัยพะเยา';
      document.getElementById('new-teacher-name').focus();
    }
  },

  handleSaveNewTeacher() {
    const name = (document.getElementById('new-teacher-name')?.value || '').trim();
    const role = document.getElementById('new-teacher-role')?.value || 'ครูนักศึกษาฝึกสอน';
    const institution = (document.getElementById('new-teacher-institution')?.value || '').trim();
    const email = (document.getElementById('new-teacher-email')?.value || '').trim();
    const secret = (document.getElementById('new-teacher-secret')?.value || '').trim();

    if (!name) {
      alert('⚠️ กรุณาระบุชื่อ-นามสกุลครูผู้สอน');
      return;
    }
    if (!secret) {
      alert('⚠️ กรุณากำหนดรหัสผ่านหรือ PIN เริ่มต้น');
      return;
    }

    const res = Store.addTeacher({
      name,
      role,
      institution: institution || 'มหาวิทยาลัยพะเยา',
      email: email || `teacher_${Date.now().toString().slice(-4)}@ppk.ac.th`,
      secret
    });

    if (res.success) {
      alert(`✅ เพิ่ม ${name} (${role}) เข้าระบบเรียบร้อยแล้ว!`);
      this.toggleAddTeacherForm(false);
      this.renderTeachersTab();
      this.updateInstructorBadge();
    } else {
      alert(`❌ ${res.message}`);
    }
  },

  handleSelectActiveTeacher(id) {
    const res = Store.setActiveTeacher(id);
    if (res.success) {
      this.updateInstructorBadge();
      this.renderTeachersTab();
      if (this.state.selectedClass) {
        this.updateCockpitHeader();
      }
      alert(`🎯 สลับผู้ปฏิบัติการสอนเป็น: ${res.teacher.name} (${res.teacher.role}) เรียบร้อยแล้ว`);
    } else {
      alert(`❌ ${res.message}`);
    }
  },

  handleDeleteTeacher(id) {
    if (confirm('ต้องการลบข้อมูลครูผู้สอนท่านนี้ออกจากระบบหรือไม่?')) {
      const res = Store.deleteTeacher(id);
      if (res.success) {
        this.renderTeachersTab();
        this.updateInstructorBadge();
        alert('🗑️ ลบข้อมูลเรียบร้อยแล้ว');
      } else {
        alert(`❌ ${res.message}`);
      }
    }
  },

  renderRosterStatus() {
    const el = document.getElementById('roster-status');
    if (!el || typeof Store === 'undefined') return;
    const classes = [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')];
    let n = 0;
    classes.forEach(c => { n += Store.getStudents(c).length; });
    el.innerHTML = Store.hasLocalRoster()
      ? `✅ ใช้รายชื่อที่นำเข้าในเครื่องนี้: ${classes.length} ห้อง ${n} คน`
      : `⚠️ ยังไม่ได้นำเข้ารายชื่อ (กำลังใช้ข้อมูลตัวอย่าง ${n} คน)`;
  },

  importRosterFile(file) {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    const done = (res) => {
      if (res.success) {
        alert(`✅ นำเข้ารายชื่อสำเร็จ ${res.classes} ห้อง ${res.count} คน (เก็บในเครื่องนี้เท่านั้น)`);
        location.reload();
      } else {
        alert('❌ นำเข้าไม่สำเร็จ: ' + res.error);
      }
    };
    const reader = new FileReader();
    if (/\.(xlsx|xls|csv)$/.test(name)) {
      if (typeof XLSX === 'undefined') { alert('ไม่พบไลบรารี Excel (ต้องต่ออินเทอร์เน็ตครั้งแรก)'); return; }
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          let rows = [];
          wb.SheetNames.forEach(sn => {
            XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' }).forEach(r => {
              if (!r['ห้อง'] && !r['class'] && !r['ห้องเรียน']) r['ห้อง'] = sn.replace('_', '/');
              rows.push(r);
            });
          });
          done(Store.importRoster(rows));
        } catch (err) { done({ success: false, error: err.message }); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          let text = String(e.target.result);
          if (/\.js$/.test(name)) {
            const m = text.match(/=\s*(\{[\s\S]*\})\s*;/);
            if (!m) throw new Error('ไม่พบ STUDENTS_DATA ในไฟล์ .js');
            text = m[1];
          }
          done(Store.importRoster(JSON.parse(text)));
        } catch (err) { done({ success: false, error: err.message }); }
      };
      reader.readAsText(file, 'utf-8');
    }
  },

  async uploadQuizBankToServer() {
    try {
      const r = await TeacherPull.uploadQuizBank();
      alert(`✅ อัปโหลดคลังข้อสอบแล้ว ${r.questions} ข้อ (${r.units} หน่วย)\nนักเรียนจะทำแบบทดสอบโดยไม่เห็นเฉลย และเซิร์ฟเวอร์ตรวจคะแนนให้`);
    } catch (err) { alert('❌ ' + err.message); }
  },

  // แถบกำหนดส่งงานของคาบนี้ (หน้าตรวจงาน)
  renderDueDateBar(className, period, listEl) {
    if (typeof DueDates === 'undefined' || !listEl || !listEl.parentNode) return;
    let bar = document.getElementById('submissions-due-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'submissions-due-bar';
      bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:0.6rem 0.85rem;margin-bottom:0.75rem;font-size:0.85rem;';
      listEl.parentNode.insertBefore(bar, listEl);
    }
    const due = DueDates.get(className, period);
    const local = due ? new Date(new Date(due.dueAt).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '';
    bar.innerHTML = `<strong>📅 กำหนดส่งงานคาบที่ ${this.escapeHtml(period)}:</strong>
      <input type="datetime-local" id="due-date-input" class="form-input" style="max-width:220px;padding:0.3rem 0.5rem;" value="${local}">
      <button type="button" class="btn-nav-action primary" id="due-date-save">บันทึก</button>
      ${due ? '<button type="button" class="btn-nav-action" id="due-date-clear">ล้าง</button>' : ''}
      <button type="button" class="btn-nav-action" id="due-remind-btn" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa;">🔔 ทวงงานผู้ยังไม่ส่ง (${(typeof Analytics !== 'undefined') ? Analytics.missingFor(className, period).length : 0})</button>
      <span style="color:#475569;">${due ? 'ส่งหลังเวลานี้ = ส่งช้า' : 'ยังไม่ตั้ง (ใช้เกณฑ์เดิม: หลังบันทึกคาบเกิน 7 วัน)'}</span>`;
    const save = async (val) => {
      try {
        // ค่าที่กรอกเป็นเวลาไทย (UTC+7)
        const iso = val ? new Date(val + ':00+07:00').toISOString() : '';
        const r = await DueDates.set(className, period, iso, `งานคาบที่ ${period}`);
        GoogleSheetSync.showToast(r.server ? '✅ บันทึกกำหนดส่งแล้ว (ส่งขึ้นเซิร์ฟเวอร์แล้ว)' : '✅ บันทึกกำหนดส่งในเครื่องนี้แล้ว', 'success');
      } catch (e) { alert('⚠️ บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ: ' + e.message); }
      this.renderSubmissionsTab();
    };
    document.getElementById('due-date-save').onclick = () => save(document.getElementById('due-date-input').value);
    const remind = document.getElementById('due-remind-btn');
    if (remind) remind.onclick = async () => {
      if (!confirm('ส่งแจ้งเตือนถึงนักเรียนที่ยังไม่ส่งงานคาบนี้? นักเรียนจะเห็นข้อความเมื่อเปิดแอปครั้งถัดไป')) return;
      try { const r = await Notices.remindMissing(className, period); alert(`✅ ส่งแจ้งเตือนแล้ว ${r.posted} คน`); }
      catch (e) { alert('❌ ' + e.message); }
    };
    const clr = document.getElementById('due-date-clear');
    if (clr) clr.onclick = () => save('');
  },

  async uploadRosterToServer(replace = false) {
    const el = document.getElementById('roster-upload-status');
    try {
      if (el) el.textContent = '⏳ กำลังอัปโหลดรายชื่อ...';
      const r = await StudentAuth.uploadRoster(replace);
      const msg = `✅ อัปโหลดสำเร็จ: เพิ่ม ${r.added} • อัปเดต ${r.updated} • รวม ${r.total} คน (PIN เดิมยังอยู่)`;
      if (el) el.textContent = msg;
      alert(msg);
    } catch (err) {
      if (el) el.textContent = '❌ ' + err.message;
      alert('❌ ' + err.message);
    }
  },

  async resetStudentPinOnServer(studentId) {
    const cfg = (typeof GoogleSheetSync !== 'undefined') ? GoogleSheetSync.getConfig() : {};
    if (!cfg.webAppUrl || !cfg.syncToken) return;
    try {
      await StudentAuth.resetPinServer(studentId);
      if (GoogleSheetSync.showToast) GoogleSheetSync.showToast(`รีเซ็ต PIN รหัส ${studentId} บนเซิร์ฟเวอร์แล้ว`, 'success');
    } catch (err) {
      alert('⚠️ รีเซ็ต PIN บนเซิร์ฟเวอร์ไม่สำเร็จ: ' + err.message);
    }
  },

  clearRoster() {
    if (!confirm('ล้างรายชื่อนักเรียนที่นำเข้าในเครื่องนี้?')) return;
    Store.clearRoster();
    location.reload();
  },

  renderStudentPinsTab() {
    this.renderRosterStatus();
    const classSel = document.getElementById('user-pin-reset-class');
    if (!classSel) return;
    const classes = [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')];
    classSel.innerHTML = '';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classSel.appendChild(opt);
    });
    this.onUserPinClassChange(classes[0] || 'ม.1/1');
  },

  onUserPinClassChange(className) {
    const studentSel = document.getElementById('user-pin-reset-student');
    if (!studentSel) return;
    studentSel.innerHTML = '';
    const students = Store.getStudents(className);
    const accounts = Store.getAllStudentAccounts();

    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const hasPin = !!(accounts[s.id] && (accounts[s.id].pinHash || accounts[s.id].pin));
      opt.textContent = `เลขที่ ${s.rollNo} • ${s.id} - ${s.name} ${hasPin ? '🔒 (มี PIN แล้ว)' : '🔓 (ยังไม่ตั้ง)'}`;
      studentSel.appendChild(opt);
    });
  },

  handleUserResetStudentPin() {
    const studentSel = document.getElementById('user-pin-reset-student');
    if (!studentSel || !studentSel.value) {
      alert('⚠️ กรุณาเลือกนักเรียน');
      return;
    }
    const studentId = studentSel.value;
    const sName = studentSel.options[studentSel.selectedIndex]?.text || studentId;

    if (confirm(`ต้องการรีเซ็ตรหัส PIN ของ ${sName} หรือไม่?\nนักเรียนจะต้องตั้ง PIN 6 หลักใหม่ในการเข้าใช้ครั้งถัดไป`)) {
      this.resetStudentPinOnServer(studentId);
      if (Store.resetStudentPin(studentId)) {
        alert(`✅ รีเซ็ต PIN เรียบร้อยแล้ว!\nนักเรียนรหัส ${studentId} จะต้องตั้ง PIN ใหม่เมื่อเข้าใช้ครั้งถัดไป`);
        const classSel = document.getElementById('user-pin-reset-class');
        if (classSel) this.onUserPinClassChange(classSel.value);
      } else {
        alert('❌ เกิดข้อผิดพลาดในการรีเซ็ต PIN');
      }
    }
  },

  // Fallback compatibility for previous openInstructorModal
  openInstructorModal() {
    this.openUserManagementModal('teachers');
  },
  closeInstructorModal() {
    this.closeUserManagementModal();
  },
  selectInstructorRole(role) {
    const list = Store.getTeachersList();
    const target = list.find(t => t.role === role) || list[0];
    if (target) {
      this.handleSelectActiveTeacher(target.id);
    }
    this.closeInstructorModal();
  },
  updateTraineeName(name) {
    const list = Store.getTeachersList();
    const trainee = list.find(t => t.roleCategory === 'trainee');
    if (trainee) {
      Store.updateTeacher(trainee.id, { name });
      this.updateInstructorBadge();
    }
  },

  // --- Dashboard Rendering (Classes List) ---
  renderDashboard() {
    const grid = document.getElementById('classrooms-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const classes = Store.getAllClasses(this.state.grade);
    const progress = Store.getAllProgress();
    const statuses = Store.getAllStudentStatuses();

    classes.forEach(className => {
      const prog = progress[className] || { lastPeriod: 0, nextPeriod: 1, lastInstructor: '-', lastHandover: 'ยังไม่มีบันทึกส่งต่องาน' };
      const students = Store.getStudents(className);
      
      let withdrawnCount = 0;
      students.forEach(s => {
        const st = statuses[s.student_id]?.status;
        if (st === 'withdrawn' || st === 'transferred') withdrawnCount++;
      });
      const activeCount = students.length - withdrawnCount;

      const pct = Math.round((prog.lastPeriod / 20) * 100);

      const card = document.createElement('div');
      card.className = 'class-card';
      card.innerHTML = `
        <div>
          <div class="class-card-top">
            <div class="class-card-name">${className}</div>
            <div class="class-card-count">
              ${activeCount} คน ${withdrawnCount > 0 ? `<span style="color:#b45309;">(จำหน่าย ${withdrawnCount})</span>` : ''}
            </div>
          </div>

          <div class="class-card-stats">
            <div class="stat-line">
              <span class="stat-line-label">ความก้าวหน้า:</span>
              <span class="stat-line-value">คาบที่ ${prog.lastPeriod}/20 (${pct}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div class="stat-line" style="margin-top: 0.35rem;">
              <span class="stat-line-label">ผู้สอนล่าสุด:</span>
              <span class="stat-line-value">${this.escapeHtml(prog.lastInstructor || '-')}</span>
            </div>
          </div>

          <div class="handover-note-box" title="${this.escapeHtml(prog.lastHandover || '')}">
            <strong>ส่งต่องาน:</strong> ${this.escapeHtml(prog.lastHandover || 'ไม่มีบันทึก')}
          </div>
        </div>

        <button class="btn-enter-class" onclick="App.enterCockpit('${className}', ${prog.nextPeriod})">
          เข้าห้องเรียน คาบที่ ${prog.nextPeriod}
        </button>
      `;
      grid.appendChild(card);
    });
  },

  // --- Classroom Cockpit ---
  enterCockpit(className, period = 1) {
    this.state.selectedClass = className;
    this.state.selectedPeriod = period;
    this.state.activeTab = 'lesson';

    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-cockpit').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.renderPeriodPills();
    this.updateCockpitHeader();
    this.loadSessionData();
    this.switchTab('lesson');
    this.checkMakeupsBanner();
    if (typeof GoogleSheetSync !== 'undefined' && GoogleSheetSync.updateUIStatus) {
      GoogleSheetSync.updateUIStatus();
    }
  },

  showDashboard() {
    this.timerPause();
    if (typeof AudioTools !== 'undefined') {
      AudioTools.stopMetronome();
      AudioTools.stopDrone();
    }
    document.getElementById('view-cockpit').style.display = 'none';
    document.getElementById('view-dashboard').style.display = 'block';
    this.renderDashboard();
    this.renderTodaySchedule();
    this.renderTeacherTodoList();
  },

  updateCockpitHeader() {
    const inst = Store.getInstructor();
    document.getElementById('cockpit-class-title').textContent = `ห้อง ${this.state.selectedClass}`;
    document.getElementById('cockpit-instructor-info').textContent = `ผู้สอนปัจจุบัน: ${inst.name} (${inst.role})`;
  },

  renderPeriodPills() {
    const container = document.getElementById('period-pills-container');
    if (!container) return;
    container.innerHTML = '';

    const prog = Store.getClassProgress(this.state.selectedClass);

    for (let p = 1; p <= 20; p++) {
      const btn = document.createElement('button');
      btn.className = 'period-pill';
      if (p === this.state.selectedPeriod) btn.classList.add('active');
      if (p <= prog.lastPeriod) btn.classList.add('completed');
      btn.textContent = `คาบ ${p}`;
      btn.onclick = () => this.selectPeriod(p);
      container.appendChild(btn);
    }
  },

  selectPeriod(period) {
    this.state.selectedPeriod = parseInt(period, 10);
    this.renderPeriodPills();
    this.loadSessionData();
    this.renderCurrentTab();
  },

  loadSessionData() {
    const className = this.state.selectedClass;
    const period = this.state.selectedPeriod;
    const existing = Store.getSession(className, period);
    const students = Store.getStudents(className);

    this.state.attendance = {};
    this.state.scores = {};

    students.forEach(s => {
      this.state.attendance[s.student_id] = existing?.attendance?.[s.student_id] || 'present';
      if (existing?.scores?.[s.student_id] !== undefined) {
        this.state.scores[s.student_id] = existing.scores[s.student_id];
      }
    });

    // Update submissions badge count for current period
    const allSubs = Store.getAllSubmissions();
    let subCount = 0;
    students.forEach(s => {
      if (allSubs[`${className}_p${period}_${s.student_id}`]) subCount++;
    });
    const subBadge = document.getElementById('tab-badge-submissions');
    if (subBadge) subBadge.textContent = `${subCount}`;

    this.timerReset(50);
  },

  // --- Cockpit Tabs ---
  switchTab(tabName) {
    if (tabName === 'evaluation') tabName = 'assessment';
    this.state.activeTab = tabName;

    const btnLesson = document.getElementById('tab-btn-lesson');
    const btnAtt = document.getElementById('tab-btn-attendance');
    const btnAssess = document.getElementById('tab-btn-assessment');
    const btnSubs = document.getElementById('tab-btn-submissions');

    if (btnLesson) btnLesson.classList.toggle('active', tabName === 'lesson');
    if (btnAtt) btnAtt.classList.toggle('active', tabName === 'attendance');
    if (btnAssess) btnAssess.classList.toggle('active', tabName === 'assessment');
    if (btnSubs) btnSubs.classList.toggle('active', tabName === 'submissions');

    const paneLesson = document.getElementById('tab-content-lesson');
    const paneAtt = document.getElementById('tab-content-attendance');
    const paneAssess = document.getElementById('tab-content-assessment');
    const paneSubs = document.getElementById('tab-content-submissions');

    if (paneLesson) paneLesson.style.display = tabName === 'lesson' ? 'block' : 'none';
    if (paneAtt) paneAtt.style.display = tabName === 'attendance' ? 'block' : 'none';
    if (paneAssess) paneAssess.style.display = tabName === 'assessment' ? 'block' : 'none';
    if (paneSubs) paneSubs.style.display = tabName === 'submissions' ? 'block' : 'none';

    this.renderCurrentTab();
  },

  renderCurrentTab() {
    if (this.state.activeTab === 'lesson') {
      this.renderLessonTab();
    } else if (this.state.activeTab === 'attendance') {
      this.renderAttendanceTab();
    } else if (this.state.activeTab === 'assessment') {
      this.renderAssessmentTab();
    } else if (this.state.activeTab === 'submissions') {
      this.renderSubmissionsTab();
    }
  },

  // --- Tab 1: Lesson Plan ---
  renderLessonTab() {
    this.renderCockpitMentoringBanner();
    const lesson = Store.getLesson(this.state.grade, this.state.selectedPeriod);
    if (!lesson) {
      document.getElementById('lesson-topic').textContent = `บทเรียนคาบที่ ${this.state.selectedPeriod}`;
      document.getElementById('kpa-k').textContent = '-';
      document.getElementById('kpa-p').textContent = '-';
      document.getElementById('kpa-a').textContent = '-';
      document.getElementById('steps-timeline').innerHTML = '<p style="color:var(--text-muted);">ยังไม่มีข้อมูลบทเรียนสำหรับคาบนี้</p>';
      document.getElementById('mentor-tips-text').textContent = 'ไม่มีคำแนะนำเพิ่มเติม';
      document.getElementById('media-list').innerHTML = '';
      return;
    }

    const customBadge = document.getElementById('lesson-customized-badge');
    if (customBadge) {
      customBadge.style.display = lesson.isCustomized ? 'inline-flex' : 'none';
    }

    document.getElementById('lesson-topic').textContent = `คาบที่ ${lesson.period}: ${lesson.topic}`;
    document.getElementById('kpa-k').textContent = lesson.kpa?.k || '-';
    document.getElementById('kpa-p').textContent = lesson.kpa?.p || '-';
    document.getElementById('kpa-a').textContent = lesson.kpa?.a || '-';

    const timelineEl = document.getElementById('steps-timeline');
    timelineEl.innerHTML = '';
    (lesson.steps || []).forEach((step, idx) => {
      const item = document.createElement('div');
      item.className = 'timeline-step-row';
      item.dataset.phaseIdx = idx;
      item.style.cursor = 'pointer';
      item.title = 'คลิกเพื่อตั้งนาฬิกาไปที่ขั้นตอนนี้ทันที';
      item.onclick = () => App.jumpToTpacePhase(idx);
      const duration = step.duration || step.time_min || 10;
      const desc = step.desc || step.action || '';
      item.innerHTML = `
        <div class="timeline-step-badge">${duration} นาที</div>
        <div>
          <div style="font-weight: 700; color: var(--ppk-navy-dark); font-size: 0.95rem;">${step.phase}</div>
          <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.25rem;">${desc}</div>
        </div>
      `;
      timelineEl.appendChild(item);
    });

    document.getElementById('mentor-tips-text').textContent = lesson.mentor_tips || lesson.mentor_tip || 'จัดการเรียนรู้ตามลำดับขั้น เน้นให้นักเรียนได้ลงมือฝึกปฏิบัติอย่างทั่วถึง';

    const mediaListEl = document.getElementById('media-list');
    mediaListEl.innerHTML = '';
    const mediaItems = lesson.media || lesson.media_links || [];
    mediaItems.forEach(m => {
      const btn = document.createElement('a');
      btn.className = 'btn-nav-action';
      const url = m.url || '#';
      if (url.startsWith('academic/')) {
        btn.href = 'javascript:void(0)';
        btn.onclick = (e) => {
          e.preventDefault();
          if (url.includes('/wk5/')) {
            const num = url.match(/\d+/);
            const period = num ? parseInt(num[0], 10) : lesson.period;
            App.openAcademicDocsForPeriod(period);
          } else if (url.includes('/media/')) {
            const num = url.match(/ผ(\d+)/) || url.match(/\d+/);
            const period = num ? parseInt(num[1] || num[0], 10) : lesson.period;
            App.openAcademicDocsModal('media', `media_${String(period).padStart(2, '0')}`);
          } else if (url.includes('/eval/')) {
            App.openAcademicDocsModal('eval');
          } else {
            App.openAcademicDocsModal('wk3');
          }
        };
      } else {
        btn.href = url;
        btn.target = '_blank';
      }
      btn.textContent = `📄 ${m.title} (${m.type})`;
      mediaListEl.appendChild(btn);
    });

    this.updateTimerDisplay();
  },

  // --- Tab 2: Attendance & Status ---
  renderAttendanceTab() {
    const className = this.state.selectedClass;
    const students = Store.getStudents(className);
    const statuses = Store.getAllStudentStatuses();
    const grid = document.getElementById('students-attendance-grid');
    grid.innerHTML = '';

    let cPresent = 0, cAbsent = 0, cLeave = 0, cLate = 0, cWithdrawn = 0;

    students.forEach(s => {
      const st = statuses[s.student_id] || { status: 'active' };
      const isWithdrawn = st.status === 'withdrawn' || st.status === 'transferred';
      const currentAtt = this.state.attendance[s.student_id] || 'present';

      if (isWithdrawn) {
        cWithdrawn++;
      } else {
        if (currentAtt === 'present') cPresent++;
        else if (currentAtt === 'absent') cAbsent++;
        else if (currentAtt === 'leave') cLeave++;
        else if (currentAtt === 'late') cLate++;
      }

      const card = document.createElement('div');
      card.className = `student-card ${isWithdrawn ? 'is-withdrawn' : ''}`;

      let statusBadgeHtml = '';
      if (st.status === 'transferred') {
        statusBadgeHtml = `<span class="student-status-tag transferred">ย้ายสถานศึกษา (${st.date || ''})</span>`;
      } else if (st.status === 'withdrawn') {
        statusBadgeHtml = `<span class="student-status-tag withdrawn">จำหน่ายออก (${st.date || ''})</span>`;
      }

      const pdpaConsent = Store.getStudentPdpaConsent ? Store.getStudentPdpaConsent(s.student_id) : !!st.pdpaConsent;
      const pdpaBadgeHtml = pdpaConsent ? `<span class="badge-pdpa" title="ผู้ปกครองยินยอม PDPA บันทึกภาพ/วิดีโอเพื่อการศึกษา">🛡️ PDPA</span>` : '';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
          <div class="student-no-badge">${s.no}</div>
          <div class="student-info-col">
            <div class="student-name-row">
              <span class="student-nickname-chip">${s.nickname || '-'}</span>
              <span class="student-fullname" title="${s.prefix}${s.first_name} ${s.last_name}">${s.prefix}${s.first_name}</span>
              ${pdpaBadgeHtml}
            </div>
            ${statusBadgeHtml}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.4rem;">
          ${!isWithdrawn ? `
            <button class="btn-att-chip ${currentAtt}" onclick="App.toggleAttendance('${s.student_id}')">
              ${this.getAttendanceLabel(currentAtt)}
            </button>
          ` : `
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">(ไม่นับเวลาเรียน)</span>
          `}
          <button class="btn-nav-action" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" onclick="App.openStudentStatusModal('${className}', '${s.student_id}')" title="จัดการสถานะนักเรียน หรือพิมพ์ใบส่งต่อ">
            ⚙️
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    document.getElementById('count-present').textContent = cPresent;
    document.getElementById('count-absent').textContent = cAbsent;
    document.getElementById('count-leave').textContent = cLeave;
    document.getElementById('count-late').textContent = cLate;
    document.getElementById('count-withdrawn').textContent = cWithdrawn;
    document.getElementById('tab-badge-attendance').textContent = students.length;
  },

  getAttendanceLabel(type) {
    switch (type) {
      case 'present': return 'มา';
      case 'absent': return 'ขาด';
      case 'leave': return 'ลา';
      case 'late': return 'สาย';
      case 'activity': return 'กิจกรรม';
      default: return 'มา';
    }
  },

  toggleAttendance(studentId) {
    const cycle = ['present', 'absent', 'leave', 'late', 'activity'];
    const current = this.state.attendance[studentId] || 'present';
    const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
    this.state.attendance[studentId] = cycle[nextIdx];
    this.renderAttendanceTab();
  },

  setAllPresent() {
    const className = this.state.selectedClass;
    const students = Store.getStudents(className);
    students.forEach(s => {
      if (!Store.isStudentWithdrawn(s.student_id)) {
        this.state.attendance[s.student_id] = 'present';
      }
    });
    this.renderAttendanceTab();
  },

  // --- Tab 3: Assessment & Rubrics ---
  renderAssessmentTab() {
    const lesson = Store.getLesson(this.state.grade, this.state.selectedPeriod);
    const rubricsListEl = document.getElementById('rubrics-list');
    rubricsListEl.innerHTML = '';

    if (lesson?.assessment?.rubrics && lesson.assessment.rubrics.length > 0) {
      document.getElementById('rubric-banner').style.display = 'block';
      document.getElementById('assessment-max-score').textContent = `คะแนนเต็ม: ${lesson.assessment.max_score} คะแนน`;

      lesson.assessment.rubrics.forEach(r => {
        const item = document.createElement('div');
        item.innerHTML = `<strong>ระดับ ${r.score} (${r.label}):</strong> ${this.escapeHtml(r.desc)}`;
        rubricsListEl.appendChild(item);
      });
    } else {
      document.getElementById('rubric-banner').style.display = 'none';
    }

    const className = this.state.selectedClass;
    const students = Store.getStudents(className);
    const statuses = Store.getAllStudentStatuses();
    const grid = document.getElementById('students-scoring-grid');
    grid.innerHTML = '';

    students.forEach(s => {
      const st = statuses[s.student_id] || { status: 'active' };
      const isWithdrawn = st.status === 'withdrawn' || st.status === 'transferred';
      const isAbsent = this.state.attendance[s.student_id] === 'absent';
      const currentScore = this.state.scores[s.student_id];
      const pdpaConsent = Store.getStudentPdpaConsent ? Store.getStudentPdpaConsent(s.student_id) : !!st.pdpaConsent;
      const unitNo = (this.state.selectedPeriod <= 4) ? 1 : (this.state.selectedPeriod <= 11) ? 2 : (this.state.selectedPeriod <= 15) ? 3 : 4;
      const qAttempt = (typeof QuizEngine !== 'undefined') ? QuizEngine.getStudentAttempt(s.student_id, unitNo) : null;

      let quizBtnHtml = '';
      if (qAttempt && qAttempt.submitted) {
        quizBtnHtml = `
          <button class="btn-nav-action" style="padding: 0.35rem 0.55rem; font-size: 0.78rem; background: #ecfdf5; color: #047857; border-color: #a7f3d0; font-weight: 600;" onclick="QuizEngine.openQuizModal(${unitNo}, '${s.student_id}')" title="ตรวจข้อสอบท้ายหน่วยที่ ${unitNo} (${qAttempt.score}/${qAttempt.maxScore} คะแนน)">
            🎯 สอบ: ${qAttempt.score}/${qAttempt.maxScore}
          </button>
        `;
      } else {
        quizBtnHtml = `
          <button class="btn-nav-action" style="padding: 0.35rem 0.55rem; font-size: 0.78rem; color: #64748b;" onclick="QuizEngine.openQuizModal(${unitNo}, '${s.student_id}')" title="เปิดทำข้อสอบท้ายหน่วยที่ ${unitNo} ของนักเรียนคนนี้">
            📝 สอบ U${unitNo}
          </button>
        `;
      }

      const card = document.createElement('div');
      card.className = `student-card ${isWithdrawn ? 'is-withdrawn' : ''}`;
      if (isAbsent && !isWithdrawn) card.style.opacity = '0.65';

      let statusMsg = '';
      if (isWithdrawn) statusMsg = `<span style="color:var(--text-muted); font-size:0.75rem;">(จำหน่าย/ย้าย)</span>`;
      else if (isAbsent) statusMsg = `<span style="color:#dc2626; font-size:0.75rem;">(ขาดเรียน - รอสอบซ่อม)</span>`;

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
          <div class="student-no-badge">${s.no}</div>
          <div class="student-info-col">
            <div class="student-name-row">
              <span class="student-nickname-chip">${s.nickname || '-'}</span>
              <span class="student-fullname">${s.prefix}${s.first_name}</span>
              ${pdpaConsent ? `<span class="badge-pdpa" title="ยินยอม PDPA">🛡️</span>` : ''}
            </div>
            ${statusMsg}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.4rem;">
          ${!isWithdrawn ? `
            <div class="score-buttons-group">
              <button class="btn-score-choice ${currentScore === 3 ? 'active-3' : ''}" onclick="App.setStudentScore('${s.student_id}', 3)" title="ให้คะแนน 3 (ดีเยี่ยม)">3</button>
              <button class="btn-score-choice ${currentScore === 2 ? 'active-2' : ''}" onclick="App.setStudentScore('${s.student_id}', 2)" title="ให้คะแนน 2 (ผ่านเกณฑ์)">2</button>
              <button class="btn-score-choice ${currentScore === 1 ? 'active-1' : ''}" onclick="App.setStudentScore('${s.student_id}', 1)" title="ให้คะแนน 1 (ปรับปรุง)">1</button>
            </div>
            <button class="btn-nav-action" style="padding: 0.35rem 0.55rem; font-size: 0.78rem;" onclick="RubricMatrix.openScoringModal('${s.student_id}')" title="เปิดตารางรูบริก 4 ระดับคุณภาพ (ระดับ คศ.4)">
              📊 รูบริก
            </button>
            ${quizBtnHtml}
          ` : `
            <span style="font-size: 0.78rem; color: var(--text-muted);">-</span>
          `}
        </div>
      `;
      grid.appendChild(card);
    });
  },

  setStudentScore(studentId, score) {
    this.state.scores[studentId] = score;
    this.renderAssessmentTab();
  },

  batchScoreAll(score) {
    const className = this.state.selectedClass;
    const students = Store.getStudents(className);
    students.forEach(s => {
      if (!Store.isStudentWithdrawn(s.student_id) && this.state.attendance[s.student_id] !== 'absent') {
        this.state.scores[s.student_id] = score;
      }
    });
    this.renderAssessmentTab();
  },

  // --- Tab 4: Student Submissions & Teacher Feedback Loop ---
  setSubmissionsFilter(filter) {
    this.state.submissionsFilter = filter || 'all';
    this.renderSubmissionsTab();
  },

  toggleUnsubmittedDetail(studentId) {
    const detailEl = document.getElementById(`unsub-detail-${studentId}`);
    if (detailEl) {
      const isHidden = detailEl.style.display === 'none' || !detailEl.style.display;
      detailEl.style.display = isHidden ? 'block' : 'none';
    }
  },

  // ลิงก์ผลงาน: แยกหลายลิงก์ (ข้อความ | ไฟล์ Drive) และเปิดเฉพาะ http(s)
  submissionLinksHtml(urlField) {
    return String(urlField || '').split(' | ').map(u => u.trim()).filter(u => /^https?:\/\//i.test(u)).map(u => {
      const drive = /^https:\/\/(drive|docs)\.google\.com\//i.test(u);
      return `<div style="margin-top: 6px;"><a href="${this.escapeHtml(u)}" target="_blank" rel="noopener" style="color: ${drive ? '#047857' : '#2563eb'}; font-weight: 600; text-decoration: underline;">${drive ? '📎 เปิดไฟล์แนบใน Google Drive ครู' : '🔗 เปิดลิงก์ผลงาน / คลิปวิดีโอของนักเรียน'}</a></div>`;
    }).join('');
  },

  // คลิปฝึกซ้อมของนักเรียน (ลิงก์/ไฟล์) ในคาบนี้ — ไม่นับเป็นงานประจำคาบ
  renderPracticeRecordings(className, period, listEl) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem('ppk_student_recordings') || '{}'); } catch (e) { all = {}; }
    const rows = [];
    Store.getStudents(className).forEach(s => {
      (all[`${className}_p${period}_${s.student_id}`] || []).forEach(r => rows.push({ s, r }));
    });
    const box = document.createElement('div');
    box.id = 'teacher-practice-recordings';
    box.style.cssText = 'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:0.6rem 0.85rem;margin-top:0.75rem;font-size:0.85rem;';
    box.innerHTML = `<div style="font-weight:700;color:#166534;margin-bottom:4px;">🎧 คลิปฝึกซ้อมของนักเรียน (คาบที่ ${period}) — ${rows.length} รายการ <span style="font-weight:400;color:#64748b;">(ไม่นับเป็นงานประจำคาบ)</span></div>` +
      (rows.length ? rows.map(({ s, r }) => `<div style="padding:4px 0;border-top:1px dashed #bbf7d0;">เลขที่ ${this.escapeHtml(s.no)} • ${this.escapeHtml(s.prefix + s.first_name)} • ${this.escapeHtml(r.at || '')}${r.note ? ' • ' + this.escapeHtml(r.note) : ''}${this.submissionLinksHtml(r.url)}</div>`).join('')
        : '<div style="color:#64748b;">ยังไม่มีคลิปฝึกซ้อม (กด 📥 ดึงงานนักเรียน เพื่ออัปเดต)</div>');
    listEl.appendChild(box);
  },

  renderSubmissionsTab() {
    const className = this.state.selectedClass;
    const period = this.state.selectedPeriod;
    const students = Store.getStudents(className);
    const allSubs = Store.getAllSubmissions();
    const listEl = document.getElementById('teacher-submissions-list');
    const summaryEl = document.getElementById('submissions-filter-summary');
    const badgeEl = document.getElementById('tab-badge-submissions');

    if (!listEl) return;
    listEl.innerHTML = '';
    this.renderDueDateBar(className, period, listEl);

    let submittedCount = 0;
    const allItems = [];

    students.forEach(s => {
      const key = `${className}_p${period}_${s.student_id}`;
      const sub = allSubs[key];
      if (sub) submittedCount++;
      allItems.push({ student: s, sub, key });
    });

    const pendingCount = students.length - submittedCount;

    if (badgeEl) badgeEl.textContent = `${submittedCount}`;
    if (summaryEl) summaryEl.textContent = `ส่งงานแล้ว ${submittedCount} จากทั้งหมด ${students.length} คน (คาบที่ ${period})`;

    // Update filter counts
    const countAllEl = document.getElementById('sub-filter-count-all');
    const countSubmittedEl = document.getElementById('sub-filter-count-submitted');
    const countPendingEl = document.getElementById('sub-filter-count-pending');
    if (countAllEl) countAllEl.textContent = `${students.length}`;
    if (countSubmittedEl) countSubmittedEl.textContent = `${submittedCount}`;
    if (countPendingEl) countPendingEl.textContent = `${pendingCount}`;

    // Update active filter pill style
    const currentFilter = this.state.submissionsFilter || 'all';
    ['all', 'submitted', 'pending'].forEach(f => {
      const pill = document.getElementById(`sub-filter-${f}`);
      if (pill) {
        if (f === currentFilter) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      }
    });

    // Apply filtering
    let filteredItems = allItems;
    if (currentFilter === 'submitted') {
      filteredItems = allItems.filter(item => !!item.sub);
    } else if (currentFilter === 'pending') {
      filteredItems = allItems.filter(item => !item.sub);
    }

    if (filteredItems.length === 0) {
      const emptyMsg = currentFilter === 'submitted'
        ? 'ยังไม่มีนักเรียนส่งงานในคาบนี้'
        : currentFilter === 'pending'
          ? '🎉 นักเรียนทุกคนส่งงานครบถ้วนแล้ว!'
          : 'ไม่พบข้อมูลนักเรียน';
      listEl.innerHTML = `<div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">${emptyMsg}</div>`;
      return;
    }

    filteredItems.forEach(({ student: s, sub }) => {
      const hasFeedback = sub && sub.teacherFeedback && sub.teacherFeedback.feedback;
      const currentScore = (sub && sub.teacherFeedback && sub.teacherFeedback.score !== null && sub.teacherFeedback.score !== undefined) 
        ? sub.teacherFeedback.score 
        : (this.state.scores[s.student_id] !== undefined ? this.state.scores[s.student_id] : '');

      if (sub) {
        // Full expanded submission card for submitted works
        const card = document.createElement('div');
        card.className = 'student-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        card.style.gap = '0.75rem';
        card.style.background = '#ffffff';
        card.style.border = '1.5px solid #a7f3d0';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.08)';

        const subContentHtml = `
          <div style="background: #f1f5f9; padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; line-height: 1.6; color: #1e293b;">
            <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">เนื้อหาที่นักเรียนส่ง:</div>
            <div style="white-space: pre-wrap;">${this.escapeHtml(sub.content || '(ไม่มีข้อความ)')}</div>
            ${sub.fileName ? `<div style="margin-top: 6px; font-size: 0.82rem; font-weight: 600; color: #0284c7;">📎 ไฟล์แนบ: ${this.escapeHtml(sub.fileName)}</div>` : ''}
            ${this.submissionLinksHtml(sub.url)}
            <div style="font-size: 0.72rem; color: #059669; margin-top: 6px;">ส่งเมื่อ: ${this.escapeHtml(sub.submittedAt)}${sub.source === 'student_device' ? ' • 📱 ส่งจากมือถือนักเรียน' : ''}${sub.late ? ' <span class="badge-danger" style="font-size:0.7rem;padding:1px 6px;border-radius:4px;">ส่งช้า</span>' : ''}</div>
          </div>
        `;

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span class="student-no-badge" style="width: 32px; height: 32px; font-size: 0.85rem;">${s.no}</span>
              <div>
                <div style="font-weight: 700; color: var(--ppk-navy-dark); font-size: 0.98rem;">
                  ${s.prefix}${s.first_name} ${s.last_name} (${s.nickname || '-'})
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  รหัสประจำตัว: ${s.student_id} • ห้อง ${className}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span class="badge-success">ส่งงานแล้ว ✅</span>
              ${hasFeedback ? '<span class="badge-primary">ให้คำแนะนำแล้ว ⭐</span>' : ''}
            </div>
          </div>

          ${subContentHtml}

          <!-- Teacher Feedback Input & Score Controls -->
          <div style="background: #eff6ff; padding: 0.85rem 1rem; border-radius: var(--radius-sm); border: 1px solid #bfdbfe;">
            <div style="font-size: 0.82rem; font-weight: 700; color: #1e40af; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.35rem;">
              <span>💬</span> คำแนะนำจากครูผู้สอน (Teacher Feedback) & บันทึกคะแนน:
            </div>
            <textarea id="feedback-text-${s.student_id}" class="form-textarea" rows="2" style="background: #ffffff; width: 100%; font-size: 0.88rem; box-sizing: border-box;" placeholder="พิมพ์คำแนะนำ ชมเชย หรือข้อที่ต้องพัฒนาเพิ่มเติม...">${hasFeedback ? this.escapeHtml(sub.teacherFeedback.feedback) : ''}</textarea>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.82rem; font-weight: 600; color: #1e40af;">คะแนน (0-3):</span>
                <input type="number" id="feedback-score-${s.student_id}" min="0" max="3" step="1" value="${currentScore}" style="width: 65px; padding: 0.3rem 0.5rem; border: 1px solid #93c5fd; border-radius: 4px; font-weight: 700; text-align: center;">
              </div>
              <button class="btn-nav-action primary" style="padding: 0.4rem 0.85rem; font-size: 0.82rem;" onclick="App.saveStudentFeedback('${className}', ${period}, '${s.student_id}')">
                💾 บันทึกคำแนะนำ & คะแนน
              </button>
            </div>
          </div>
        `;
        listEl.appendChild(card);
      } else {
        // Clean compact one-line row for unsubmitted students (reduces cognitive overload)
        const row = document.createElement('div');
        row.className = 'unsubmitted-compact-row';
        row.id = `unsub-row-${s.student_id}`;

        row.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span class="student-no-badge" style="width: 28px; height: 28px; font-size: 0.8rem; background: #e2e8f0;">${s.no}</span>
              <div>
                <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${s.prefix}${s.first_name} ${s.last_name} (${s.nickname || '-'})</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">รหัส ${s.student_id}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge-neutral" style="font-size: 0.72rem; background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 4px;">ยังไม่ส่ง</span>
              ${hasFeedback ? '<span class="badge-primary" style="font-size: 0.72rem;">บันทึกล่วงหน้าแล้ว ⭐</span>' : ''}
              <button class="btn-nav-action" style="padding: 3px 8px; font-size: 0.75rem;" onclick="App.toggleUnsubmittedDetail('${s.student_id}')">
                ✏️ ให้คะแนน/แนะนำล่วงหน้า
              </button>
            </div>
          </div>
          <div id="unsub-detail-${s.student_id}" style="display: none; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px dashed #cbd5e1;">
            <div style="background: #eff6ff; padding: 0.75rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid #bfdbfe;">
              <div style="font-size: 0.78rem; font-weight: 700; color: #1e40af; margin-bottom: 0.35rem;">
                💬 คำแนะนำล่วงหน้า & บันทึกคะแนน:
              </div>
              <textarea id="feedback-text-${s.student_id}" class="form-textarea" rows="2" style="background: #ffffff; width: 100%; font-size: 0.85rem; box-sizing: border-box;" placeholder="พิมพ์คำแนะนำ หรือข้อความเตือนให้นักเรียนส่งงาน...">${hasFeedback ? this.escapeHtml(sub.teacherFeedback.feedback) : ''}</textarea>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 0.8rem; font-weight: 600; color: #1e40af;">คะแนน (0-3):</span>
                  <input type="number" id="feedback-score-${s.student_id}" min="0" max="3" step="1" value="${currentScore}" style="width: 60px; padding: 0.25rem 0.4rem; border: 1px solid #93c5fd; border-radius: 4px; font-weight: 700; text-align: center;">
                </div>
                <button class="btn-nav-action primary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;" onclick="App.saveStudentFeedback('${className}', ${period}, '${s.student_id}')">
                  💾 บันทึก
                </button>
              </div>
            </div>
          </div>
        `;
        listEl.appendChild(row);
      }
    });
    this.renderPracticeRecordings(className, period, listEl);
  },

  saveStudentFeedback(className, period, studentId) {
    const textEl = document.getElementById(`feedback-text-${studentId}`);
    const scoreEl = document.getElementById(`feedback-score-${studentId}`);
    const feedbackText = textEl ? textEl.value.trim() : '';
    const scoreVal = scoreEl ? scoreEl.value : null;

    Store.saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, scoreVal);
    // นศ.ฝึกสอน: คะแนนต้องรอครูพี่เลี้ยงอนุมัติ
    if (typeof InternMode !== 'undefined' && InternMode.isActive()) {
      if (scoreVal !== null && scoreVal !== '') InternMode.proposeGrades(className, period, { [studentId]: scoreVal }, feedbackText);
      alert('📨 ส่งคะแนน/คำแนะนำให้ครูพี่เลี้ยงอนุมัติแล้ว (จะมีผลเมื่ออนุมัติ)');
      this.renderSubmissionsTab();
      return;
    }
    // ส่งคำแนะนำถึงมือถือนักเรียน (ถ้าตั้งค่าซิงค์แล้ว)
    if (typeof Notices !== 'undefined' && typeof TeacherPull !== 'undefined' && TeacherPull.isConfigured()) {
      Notices.postFeedback(className, period, studentId, feedbackText, scoreVal)
        .catch(err => GoogleSheetSync.showToast('⚠️ ส่งคำแนะนำถึงมือถือนักเรียนไม่สำเร็จ: ' + err.message, 'error'));
    }
    if (scoreVal !== null && scoreVal !== '') {
      this.state.scores[studentId] = Number(scoreVal);
    }

    alert('✅ บันทึกคำแนะนำและคะแนนให้นักเรียนเรียบร้อยแล้ว!\nนักเรียนจะเห็นข้อความนี้ทันทีเมื่อเข้าสู่ระบบ');
    this.renderSubmissionsTab();
    this.renderAssessmentTab();
  },

  // --- Student Status Modal & Transcript ---
  openStudentStatusModal(className, studentId) {
    this.state.currentEditingStudentId = studentId;
    this.state.currentEditingStudentClass = className;

    const students = Store.getStudents(className);
    const student = students.find(s => s.student_id === studentId);
    if (!student) return;

    const st = Store.getStudentStatus(studentId);

    document.getElementById('status-modal-student-name').textContent = `${student.prefix}${student.first_name} ${student.last_name} (${student.nickname || '-'})`;
    document.getElementById('status-modal-student-meta').textContent = `รหัสประจำตัว: ${student.student_id} • ห้อง: ${className} • เลขที่: ${student.no}`;

    document.getElementById('student-status-select').value = st.status || 'active';
    document.getElementById('student-status-date').value = st.date || '';
    document.getElementById('student-status-reason').value = st.reason || '';
    document.getElementById('student-status-note').value = st.note || '';

    const pdpaCb = document.getElementById('student-status-pdpa');
    if (pdpaCb) {
      pdpaCb.checked = Store.getStudentPdpaConsent ? Store.getStudentPdpaConsent(studentId) : !!st.pdpaConsent;
    }

    document.getElementById('modal-student-status').classList.add('active');
  },

  closeStudentStatusModal() {
    document.getElementById('modal-student-status').classList.remove('active');
  },

  saveStudentStatusFromModal() {
    const studentId = this.state.currentEditingStudentId;
    if (!studentId) return;

    const status = document.getElementById('student-status-select').value;
    const date = document.getElementById('student-status-date').value.trim();
    const reason = document.getElementById('student-status-reason').value.trim();
    const note = document.getElementById('student-status-note').value.trim();
    const pdpaConsent = document.getElementById('student-status-pdpa')?.checked || false;

    Store.setStudentStatus(studentId, { status, date, reason, note, pdpaConsent });
    if (Store.setStudentPdpaConsent) Store.setStudentPdpaConsent(studentId, pdpaConsent);

    this.closeStudentStatusModal();
    this.renderAttendanceTab();
    this.renderAssessmentTab();
    alert('✅ บันทึกสถานะผู้เรียนและความยินยอม PDPA เรียบร้อยแล้ว');
  },

  openHandoverTranscriptFromStatus() {
    const studentId = this.state.currentEditingStudentId;
    const className = this.state.currentEditingStudentClass;
    this.closeStudentStatusModal();
    this.openTranscriptModal(className, studentId);
  },

  openTranscriptModal(className, studentId) {
    const data = Store.getStudentTranscript(className, studentId);
    if (!data) {
      alert('ไม่พบข้อมูลนักเรียน');
      return;
    }

    const container = document.getElementById('printable-transcript-content');
    if (!container) return;

    const s = data.student;
    const st = data.status;
    const att = data.attendanceStats;

    let scoreRowsHtml = '';
    data.scoresList.forEach(row => {
      scoreRowsHtml += `
        <tr>
          <td>${row.period}</td>
          <td>${row.dateStr}</td>
          <td style="text-align: left;">${row.lessonTitle}</td>
          <td>${this.getAttendanceLabel(row.attendance)}</td>
          <td><strong>${row.score}</strong> / ${row.maxScore}</td>
        </tr>
      `;
    });

    if (data.scoresList.length === 0) {
      scoreRowsHtml = `<tr><td colspan="5" style="text-align: center; color: #64748b;">ยังไม่มีข้อมูลการประเมินในภาคเรียนนี้</td></tr>`;
    }

    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const schoolName = (settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม';
    const deptName = (settings && settings.department) || 'กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)';
    const deptHead = (settings && settings.departmentHead) || 'นายอุดม ไชยวุฒิ';
    const appBranding = (settings && settings.appName) ? `${settings.appName} (${settings.innovationName})` : 'ระบบบริหารจัดการชั้นเรียน รร.พะเยาพิทยาคม';

    container.innerHTML = `
      <div class="transcript-header">
        <h2>${this.escapeHtml(schoolName)}</h2>
        <h3>${this.escapeHtml(deptName)}</h3>
        <p style="font-size: 14px; margin-top: 4px;">
          <strong>ใบสรุปผลการประเมินการเรียนรู้และคะแนนเก็บรายบุคคล</strong><br>
          (สำหรับส่งต่องานทะเบียนวัดผล / โอนย้ายสถานศึกษา)
        </p>
      </div>

      <div class="transcript-meta-grid">
        <div><strong>ชื่อ-สกุล:</strong> ${s.prefix}${s.first_name} ${s.last_name} (${s.nickname || '-'})</div>
        <div><strong>รหัสประจำตัว:</strong> ${s.student_id}</div>
        <div><strong>ระดับชั้น:</strong> ${className} (เลขที่ ${s.no})</div>
        <div><strong>ภาคเรียน:</strong> ${data.semesterLabel}</div>
        <div><strong>สถานะปัจจุบัน:</strong> ${st.status === 'transferred' ? 'ย้ายสถานศึกษา' : (st.status === 'withdrawn' ? 'จำหน่ายออก' : 'ปกติ')}</div>
        <div><strong>มีผลตั้งแต่วันที่:</strong> ${st.date || '-'}</div>
        <div style="grid-column: 1 / -1;"><strong>สาเหตุ/หมายเหตุ:</strong> ${st.reason || '-'} ${st.note ? `(${st.note})` : ''}</div>
      </div>

      <div style="margin-top: 1rem; margin-bottom: 0.5rem; font-weight: 700;">
        1. สรุปสถิติเวลาเรียน (Attendance Summary)
      </div>
      <table class="transcript-table">
        <thead>
          <tr>
            <th>จำนวนคาบทั้งหมด</th>
            <th>มาเรียน</th>
            <th>ขาดเรียน</th>
            <th>ลา</th>
            <th>มาสาย</th>
            <th>กิจกรรม</th>
            <th>เวลาเรียนคิดเป็นร้อยละ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${att.totalEligibleSessions} คาบ</td>
            <td>${att.attendedCount}</td>
            <td>${att.absentCount}</td>
            <td>${att.leaveCount}</td>
            <td>${att.lateCount}</td>
            <td>${att.activityCount}</td>
            <td><strong>${att.attendancePct}%</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 1.25rem; margin-bottom: 0.5rem; font-weight: 700;">
        2. รายละเอียดคะแนนเก็บตามแผนการจัดการเรียนรู้ (Assessment Breakdown)
      </div>
      <table class="transcript-table">
        <thead>
          <tr>
            <th style="width: 50px;">คาบ</th>
            <th style="width: 100px;">วันที่</th>
            <th>หน่วยการเรียนรู้ / เรื่องที่ประเมิน</th>
            <th style="width: 80px;">เวลาเรียน</th>
            <th style="width: 100px;">คะแนนที่ได้</th>
          </tr>
        </thead>
        <tbody>
          ${scoreRowsHtml}
        </tbody>
        <tfoot>
          <tr style="font-weight: 700; background: #f8fafc;">
            <td colspan="4" style="text-align: right;">รวมคะแนนเก็บสะสมถึงปัจจุบัน:</td>
            <td>${data.totalScoreEarned} / ${data.totalMaxScore} (${data.scorePct}%)</td>
          </tr>
        </tfoot>
      </table>

      <div class="transcript-signatures-grid">
        <div>
          <div>(......................................................)</div>
          <div style="margin-top: 4px;"><strong>${data.instructor.name}</strong></div>
          <div style="font-size: 12px; color: #475569;">ครูผู้สอน</div>
        </div>
        <div>
          <div>(......................................................)</div>
          <div style="margin-top: 4px;"><strong>${this.escapeHtml(deptHead)}</strong></div>
          <div style="font-size: 12px; color: #475569;">หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ</div>
        </div>
        <div>
          <div>(......................................................)</div>
          <div style="margin-top: 4px;"><strong>${this.escapeHtml(settings?.academicHead || 'นายกฤศ วงค์เรือง')}</strong></div>
          <div style="font-size: 12px; color: #475569;">รองผู้อำนวยการกลุ่มบริหารงานวิชาการ</div>
        </div>
      </div>

      <div style="text-align: right; margin-top: 2rem; font-size: 11px; color: #64748b;">
        ออกเอกสาร ณ วันที่ ${data.generatedAt} • ${this.escapeHtml(appBranding)}
      </div>
    `;

    document.getElementById('modal-transcript').classList.add('active');
  },

  closeTranscriptModal() {
    document.getElementById('modal-transcript').classList.remove('active');
  },

  exportTranscriptExcel() {
    const studentId = this.state.currentEditingStudentId;
    const className = this.state.currentEditingStudentClass;
    const data = Store.getStudentTranscript(className, studentId);
    if (!data) return;

    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const schoolName = (settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม';
    const deptName = (settings && settings.department) || 'กลุ่มสาระการเรียนรู้ศิลปะ';

    const rows = [
      [`${schoolName} - ${deptName}`],
      ['ใบสรุปผลการประเมินการเรียนรู้และคะแนนเก็บรายบุคคล (กรณีส่งต่อ/ย้ายสถานศึกษา)'],
      [''],
      ['ชื่อ-สกุล', `${data.student.prefix}${data.student.first_name} ${data.student.last_name}`, 'รหัสประจำตัว', data.student.student_id],
      ['ห้อง', className, 'เลขที่', data.student.no],
      ['สถานะ', data.status.status, 'มีผลตั้งแต่วันที่', data.status.date || '-'],
      ['สาเหตุ', data.status.reason || '-'],
      [''],
      ['คาบที่', 'วันที่', 'หน่วยการเรียนรู้', 'เวลาเรียน', 'คะแนนที่ได้', 'คะแนนเต็ม']
    ];

    data.scoresList.forEach(r => {
      rows.push([r.period, r.dateStr, r.lessonTitle, this.getAttendanceLabel(r.attendance), r.score, r.maxScore]);
    });

    rows.push([''], ['รวมคะแนนเก็บสะสม', '', '', '', data.totalScoreEarned, data.totalMaxScore]);

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transcript");
      XLSX.writeFile(wb, `ใบสรุปคะแนน_${data.student.student_id}_${data.student.first_name}.xlsx`);
    } else {
      alert('ดาวน์โหลด SheetJS ไม่สำเร็จ');
    }
  },

  // --- Semester Lifecycle & Archive Modal ---
  openSemesterModal() {
    const meta = Store.getSemesterMeta();
    document.getElementById('active-semester-display-title').textContent = meta.activeLabel;
    this.renderArchivedSemestersList();
    document.getElementById('modal-semester').classList.add('active');
  },

  closeSemesterModal() {
    document.getElementById('modal-semester').classList.remove('active');
  },

  renderArchivedSemestersList() {
    const listEl = document.getElementById('archived-semesters-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const archives = Store.getArchivedSemesters();
    if (archives.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">ยังไม่มีประวัติเทอมที่จัดเก็บในคลัง</div>';
      return;
    }

    archives.forEach(arc => {
      const card = document.createElement('div');
      card.className = 'student-card';
      const dateStr = arc.archivedAt ? new Date(arc.archivedAt).toLocaleDateString('th-TH') : '-';
      card.innerHTML = `
        <div>
          <div style="font-weight: 700; color: var(--ppk-navy-dark);">${arc.label}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">จัดเก็บเมื่อ: ${dateStr}</div>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn-nav-action" onclick="App.viewArchive('${arc.id}')">ดูข้อมูลย้อนหลัง</button>
          <button class="btn-nav-action" onclick="App.exportArchiveJSON('${arc.id}')">ดาวน์โหลด JSON</button>
        </div>
      `;
      listEl.appendChild(card);
    });
  },

  viewArchive(archiveId) {
    Store.switchArchiveView(archiveId);
    this.closeSemesterModal();
    this.updateSemesterBadge();
    this.showDashboard();
    alert('🔍 สลับสู่โหมดดูประวัติย้อนหลังเรียบร้อยแล้ว');
  },

  exportArchiveJSON(archiveId) {
    const jsonStr = Store.exportSemesterArchiveJSON(archiveId);
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Archive_Semester_${archiveId}.json`;
    link.click();
  },

  confirmStartNewSemester() {
    const year = document.getElementById('new-term-year-input').value.trim();
    const term = document.getElementById('new-term-no-select').value;
    if (!year) {
      alert('กรุณาระบุปีการศึกษา');
      return;
    }

    const msg = `⚠️ ต้องการปิดเทอมปัจจุบันและเริ่มต้น "ภาคเรียนที่ ${term} ปีการศึกษา ${year}" ใช่หรือไม่?\n\n*ข้อมูลของเทอมปัจจุบันจะถูกบันทึกเข้าคลังย้อนหลังอัตโนมัติ และห้องเรียนจะรีเซ็ตเริ่มคาบที่ 1 ใหม่*`;
    if (confirm(msg)) {
      Store.startNewSemester(year, term);
      this.closeSemesterModal();
      this.updateSemesterBadge();
      this.renderDashboard();
      alert(`🚀 เริ่มต้นภาคเรียนที่ ${term} ปีการศึกษา ${year} เรียบร้อยแล้ว!`);
      location.reload();
    }
  },

  // --- Dynamic Subjects Manager Modal ---
  openSubjectsModal() {
    this.renderSubjectsTable();
    document.getElementById('modal-subjects').classList.add('active');
  },

  closeSubjectsModal() {
    document.getElementById('modal-subjects').classList.remove('active');
  },

  renderSubjectsTable() {
    const tbody = document.getElementById('subjects-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const subjects = Store.getAllSubjects();
    subjects.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700;">${s.code}</td>
        <td style="text-align: left;">${s.name}</td>
        <td>${s.grade}</td>
        <td>${s.periods}</td>
        <td>
          <button class="btn-nav-action" style="padding: 2px 6px; font-size: 0.72rem; color: #dc2626;" onclick="App.handleDeleteSubject('${s.id}')">ลบ</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  handleAddNewSubject() {
    const code = document.getElementById('new-subj-code').value.trim();
    const name = document.getElementById('new-subj-name').value.trim();
    const grade = document.getElementById('new-subj-grade').value;
    const periods = parseInt(document.getElementById('new-subj-periods').value, 10) || 20;

    if (!code || !name) {
      alert('กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบถ้วน');
      return;
    }

    Store.addSubject(code, name, grade, periods);
    document.getElementById('new-subj-code').value = '';
    document.getElementById('new-subj-name').value = '';
    this.renderSubjectsTable();
    this.renderCourseTabs();
    alert('✅ เพิ่มรายวิชาเรียบร้อยแล้ว');
  },

  handleDeleteSubject(id) {
    if (confirm('ต้องการลบรายวิชานี้หรือไม่?')) {
      Store.deleteSubject(id);
      this.renderSubjectsTable();
      this.renderCourseTabs();
    }
  },

  // --- Timetable Modal & Official 2/2569 Schedule ---
  openTimetableModal(mode) {
    if (mode) {
      this.state.timetableMode = mode;
    } else if (!this.state.timetableMode) {
      this.state.timetableMode = 'official';
    }

    const isOfficial = this.state.timetableMode === 'official';
    const tt = Store.getTimetable();
    const settings = Store.getAppSettings ? Store.getAppSettings() : null;

    // Dynamically update Timetable Modal Header from AppSettings / Timetable config
    const teacherName = (settings && settings.teacherName) || tt.teacherName || 'คุณครูพงศธร โพธิแก้ว';
    const schoolName = (settings && settings.schoolName) || tt.school || 'โรงเรียนพะเยาพิทยาคม';
    const term = (settings && settings.academicTerm) || tt.term || 'ภาคเรียนที่ 2/2569';
    const dept = (settings && settings.department) || 'กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)';

    const ttTitleEl = document.getElementById('timetable-modal-title');
    if (ttTitleEl) {
      ttTitleEl.textContent = `ตารางสอน ${tt.teacherCode || '612'} ${teacherName} ${term} ${schoolName}`;
    }
    const ttSubEl = document.getElementById('timetable-modal-sub');
    if (ttSubEl) {
      ttSubEl.innerHTML = `${this.escapeHtml(dept)} • ห้องปฏิบัติการดนตรี: <strong>${this.escapeHtml(tt.room || 'อส.5')}</strong> • ออกให้ ณ วันที่ ${this.escapeHtml(tt.date || '20.10.2569')}`;
    }

    const table = document.getElementById('timetable-editor-table');
    table.innerHTML = '';
    table.className = `timetable-table ${isOfficial ? 'mode-official' : ''}`;

    const toggleBtn = document.getElementById('btn-toggle-tt-mode');
    if (toggleBtn) {
      toggleBtn.innerHTML = isOfficial ? '✏️ โหมดแก้ไขตาราง' : '👁️ ดูแบบทางการ';
    }

    const saveBtn = document.getElementById('btn-save-timetable');
    if (saveBtn) {
      saveBtn.style.display = isOfficial ? 'none' : 'inline-block';
    }

    const days = [
      { key: "จันทร์", label: "จันทร์" },
      { key: "อังคาร", label: "อังคาร" },
      { key: "พุธ", label: "พุธ" },
      { key: "พฤหัสบดี", label: "พฤหัสฯ" },
      { key: "ศุกร์", label: "ศุกร์" }
    ];

    const m1Classes = Store.getAllClasses('M1').filter(c => c !== 'ม.1/14');
    const m2Classes = Store.getAllClasses('M2').filter(c => c !== 'ม.2/14');
    const activities = ['จริยะ', 'กก.ล.', 'กก.บ.', 'ประชุม PLC'];

    // Mentoring & Assignment Statistics
    const assignments = Store.getScheduleAssignments();
    const summary = Store.getTraineeTeachingSummary();
    const statMentorEl = document.getElementById('tt-stat-mentor-count');
    const statTraineeEl = document.getElementById('tt-stat-trainee-count');
    const statCoTeachEl = document.getElementById('tt-stat-coteach-count');

    let totalTeachingSlots = 0;
    days.forEach(d => {
      const daySlots = tt.schedule[d.key] || tt.schedule[d.label] || {};
      tt.periods.forEach(p => {
        const c = daySlots[p.no];
        if (c && !['พักกลางวัน', 'พักเที่ยง', 'จริยะ', 'กก.ล.', 'กก.บ.', 'ประชุม PLC'].includes(c)) {
          totalTeachingSlots++;
        }
      });
    });

    const mentorSlotsCount = Math.max(0, totalTeachingSlots - summary.traineeCount);
    if (statMentorEl) statMentorEl.textContent = `👨‍🏫 ครูประจำวิชาสอนหลัก: ${mentorSlotsCount} คาบ`;
    if (statTraineeEl) statTraineeEl.textContent = `🎓 มอบหมาย นศ.ฝึกสอน: ${summary.traineeCount} คาบ`;
    if (statCoTeachEl) statCoTeachEl.textContent = `👥 ร่วมสอน (Co-teach): ${summary.coTeachCount} คาบ`;

    // Table Header (Row 1: Period Numbers, Row 2: Times)
    let thead = '<thead>';
    thead += '<tr><th style="min-width: 80px; vertical-align: middle;">คาบที่</th>';
    tt.periods.forEach(p => {
      const isDivider = p.no === 2 || p.no === 4 || p.no === 7;
      thead += `<th class="${isDivider ? 'break-divider-col' : ''}" style="min-width: 85px;">${p.no}</th>`;
    });
    thead += '</tr>';

    thead += '<tr><th style="font-size: 0.75rem; color: var(--text-muted); vertical-align: middle;">เวลา</th>';
    tt.periods.forEach(p => {
      const isDivider = p.no === 2 || p.no === 4 || p.no === 7;
      thead += `<th class="${isDivider ? 'break-divider-col' : ''}" style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">${p.time}</th>`;
    });
    thead += '</tr></thead>';

    // Table Body
    let tbody = '<tbody>';
    days.forEach(d => {
      tbody += `<tr><td style="font-weight: 700; color: var(--ppk-navy); background: var(--bg-subtle); vertical-align: middle;">${d.label}</td>`;
      const daySlots = tt.schedule[d.key] || tt.schedule[d.label] || {};

      tt.periods.forEach(p => {
        const isDivider = p.no === 2 || p.no === 4 || p.no === 7;
        const currentVal = daySlots[p.no] || '';
        const isLunch = currentVal === 'พักกลางวัน' || currentVal === 'พักเที่ยง';
        const isActivity = activities.includes(currentVal);
        const assignKey = `${d.key}-${p.no}`;
        const assignment = assignments[assignKey];

        let traineeBadge = '';
        let cellClassExtra = '';
        if (assignment) {
          if (assignment.assignRole === 'trainee') {
            traineeBadge = `<div class="tt-badge-trainee" title="มอบหมายให้ นศ.ฝึกสอน (${this.escapeHtml(assignment.teacherName)})">🎓 นศ.ฝึกสอน</div>`;
            cellClassExtra = 'has-trainee';
          } else if (assignment.assignRole === 'co-teach') {
            traineeBadge = `<div class="tt-badge-coteach" title="ร่วมสอน (Co-teach) กับครูพี่เลี้ยง">👥 ร่วมสอน</div>`;
            cellClassExtra = 'has-coteach';
          }
        }

        if (isOfficial) {
          // Official Document Re-creation View
          let cellContent = '&nbsp;';
          if (isLunch) {
            cellContent = '<div class="tt-cell-lunch">พักเที่ยง</div>';
          } else if (isActivity) {
            cellContent = `<div class="tt-cell-activity">${this.escapeHtml(currentVal)}</div>`;
          } else if (currentVal) {
            let subj = 'ศ21102';
            let shortClass = currentVal.replace('ม.', '');
            if (currentVal === 'ม.1/14') {
              subj = 'AR21105';
              shortClass = 'M.1/14';
            } else if (currentVal.startsWith('ม.2/')) {
              subj = 'ศ22102';
              shortClass = currentVal.replace('ม.', '');
            }
            cellContent = `
              <div class="tt-cell-box ${cellClassExtra}" style="cursor: pointer; position: relative;" onclick="App.onTimetableCellClick('${d.key}', ${p.no}, '${currentVal}')" title="แตะเพื่อเลือก: มอบหมาย นศ.ฝึกสอน/คำแนะนำนิเทศ หรือเข้าห้องเรียน">
                <div class="tt-subj">${subj}</div>
                <div class="tt-class">${shortClass}</div>
                <div class="tt-room">อส.5</div>
                ${traineeBadge}
              </div>
            `;
          }
          tbody += `<td class="${isDivider ? 'break-divider-col' : ''}">${cellContent}</td>`;
        } else {
          // Editable Select View
          let selectHtml = `<select class="timetable-select" data-day="${d.key}" data-period="${p.no}" onchange="App.updateTimetableSelectColor(this)">`;
          selectHtml += `<option value="">(ว่าง)</option>`;
          selectHtml += `<option value="พักเที่ยง" ${isLunch ? 'selected' : ''}>พักเที่ยง</option>`;

          selectHtml += `<optgroup label="วิชา ศ21102 (ดนตรี ม.1)">`;
          m1Classes.forEach(c => {
            selectHtml += `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c} (ศ21102)</option>`;
          });
          selectHtml += `</optgroup>`;

          selectHtml += `<optgroup label="วิชา AR21105 (ม.1/14)">`;
          selectHtml += `<option value="ม.1/14" ${currentVal === 'ม.1/14' ? 'selected' : ''}>ม.1/14 (AR21105)</option>`;
          selectHtml += `</optgroup>`;

          selectHtml += `<optgroup label="วิชา ศ22102 (ดนตรี ม.2)">`;
          m2Classes.forEach(c => {
            selectHtml += `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c} (ศ22102)</option>`;
          });
          selectHtml += `</optgroup>`;

          selectHtml += `<optgroup label="ภาระงาน / กิจกรรม">`;
          activities.forEach(act => {
            selectHtml += `<option value="${act}" ${act === currentVal ? 'selected' : ''}>${act}</option>`;
          });
          selectHtml += `</optgroup>`;

          selectHtml += `</select>`;

          let assignBtn = '';
          if (currentVal && !isLunch && !isActivity) {
            assignBtn = `<button type="button" class="btn-preset-chip" style="font-size: 0.65rem; margin-top: 3px; display: block; width: 100%; text-align: center;" onclick="App.openTeachingAssignmentModal('${d.key}', ${p.no})">🎓 มอบหมาย</button>`;
          }

          tbody += `<td class="${isDivider ? 'break-divider-col' : ''}">${selectHtml}${assignBtn}</td>`;
        }
      });
      tbody += `</tr>`;
    });
    tbody += '</tbody>';

    table.innerHTML = thead + tbody;

    if (!isOfficial) {
      table.querySelectorAll('.timetable-select').forEach(sel => {
        this.updateTimetableSelectColor(sel);
      });
    }

    document.getElementById('modal-timetable').classList.add('active');
  },

  onTimetableCellClick(day, periodNo, className) {
    if (!className || className === 'พักเที่ยง' || className === 'พักกลางวัน') return;
    const assignment = Store.getScheduleAssignment(day, periodNo);
    const teacherName = assignment ? assignment.teacherName : 'ครูประจำวิชา (นายพงศธร)';
    const roleText = assignment ? (assignment.assignRole === 'trainee' ? '🎓 นศ.ฝึกสอน' : '👥 ร่วมสอน') : '👨‍🏫 ครูประจำวิชา';

    const action = confirm(
      `📅 วัน${day} คาบที่ ${periodNo} (ห้อง ${className})\n` +
      `ผู้สอน: ${teacherName} [${roleText}]\n\n` +
      `• กด [ ตกลง (OK) ] เพื่อ "มอบหมายคาบสอน & บันทึกคำแนะนำนิเทศจากครูพี่เลี้ยง"\n` +
      `• กด [ ยกเลิก (Cancel) ] เพื่อ "เข้าสู่ห้องเรียน Cockpit ทันที"`
    );

    if (action) {
      App.openTeachingAssignmentModal(day, periodNo);
    } else {
      App.closeTimetableModal();
      App.enterCockpit(className, 1);
    }
  },

  toggleTimetableMode() {
    this.state.timetableMode = this.state.timetableMode === 'official' ? 'edit' : 'official';
    this.openTimetableModal(this.state.timetableMode);
  },

  resetToOfficialTimetable() {
    if (confirm('ต้องการคืนค่าเป็น "ตารางสอนทางการ 612 ภาคเรียนที่ 2/2569 โรงเรียนพะเยาพิทยาคม" (ห้อง อส.5) หรือไม่?')) {
      Store.setOfficialTimetable();
      this.state.timetableMode = 'official';
      this.openTimetableModal('official');
      this.renderTodaySchedule();
      alert('✅ คืนค่าตารางสอนทางการ ภาคเรียนที่ 2/2569 เรียบร้อยแล้ว');
    }
  },

  printTimetable() {
    this.state.timetableMode = 'official';
    this.openTimetableModal('official');
    window.print();
  },

  updateTimetableSelectColor(sel) {
    if (!sel) return;
    sel.classList.remove('is-lunch', 'is-class', 'is-activity', 'is-empty');
    if (sel.value === 'พักกลางวัน' || sel.value === 'พักเที่ยง') {
      sel.classList.add('is-lunch');
    } else if (['จริยะ', 'กก.ล.', 'กก.บ.', 'ประชุม PLC'].includes(sel.value)) {
      sel.classList.add('is-activity');
    } else if (sel.value) {
      sel.classList.add('is-class');
    } else {
      sel.classList.add('is-empty');
    }
  },

  closeTimetableModal() {
    document.getElementById('modal-timetable').classList.remove('active');
  },

  saveTimetableFromEditor() {
    const tt = Store.getTimetable();
    const selects = document.querySelectorAll('#timetable-editor-table select');
    
    selects.forEach(sel => {
      const day = sel.getAttribute('data-day');
      const periodNo = parseInt(sel.getAttribute('data-period'), 10);
      const val = sel.value;
      if (!tt.schedule[day]) tt.schedule[day] = {};
      tt.schedule[day][periodNo] = val;
    });

    Store.saveTimetable(tt);
    this.state.timetableMode = 'official';
    this.openTimetableModal('official');
    this.renderTodaySchedule();
    alert('✅ บันทึกตารางสอนประจำสัปดาห์เรียบร้อยแล้ว');
  },

  // --- Timetable Teaching Assignment & Trainee Mentoring Controller ---
  openTeachingAssignmentModal(defaultDay = null, defaultPeriod = null) {
    const daySelect = document.getElementById('assign-select-day');
    const periodSelect = document.getElementById('assign-select-period');
    const teacherSelect = document.getElementById('assign-teacher-id');
    const modal = document.getElementById('modal-teaching-assignment');
    if (!modal) return;

    // 1. Populate period select (1 - 10)
    if (periodSelect) {
      periodSelect.innerHTML = '';
      for (let p = 1; p <= 10; p++) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = `คาบที่ ${p}`;
        periodSelect.appendChild(opt);
      }
    }

    // 2. Populate teacher select
    if (teacherSelect) {
      teacherSelect.innerHTML = '';
      const teachers = Store.getTeachersList();
      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.role || 'ผู้สอน'})`;
        teacherSelect.appendChild(opt);
      });
    }

    // 3. Set default day and period
    const tt = Store.getTimetable();
    const todayName = Store.getTodayDayName();
    const targetDay = defaultDay || (tt.schedule[todayName] ? todayName : 'อังคาร');
    const targetPeriod = defaultPeriod || 5;

    if (daySelect) daySelect.value = targetDay;
    if (periodSelect) periodSelect.value = targetPeriod;

    this.onAssignmentSlotChanged();
    modal.classList.add('active');
  },

  onAssignmentSlotChanged() {
    const day = document.getElementById('assign-select-day')?.value || 'อังคาร';
    const periodNo = parseInt(document.getElementById('assign-select-period')?.value || '5', 10);
    const tt = Store.getTimetable();
    const periods = tt.periods || DEFAULT_TIMETABLE_PERIODS;
    const periodMeta = periods.find(p => p.no === periodNo) || { time: '' };
    const daySlots = tt.schedule[day] || {};
    const className = daySlots[periodNo] || '';

    const badge = document.getElementById('assign-slot-meta-badge');
    if (badge) {
      if (className) {
        badge.textContent = `ห้อง ${className} • คาบ ${periodNo} (${periodMeta.time})`;
        badge.style.background = '#e0f2fe';
        badge.style.color = '#0369a1';
      } else {
        badge.textContent = `(คาบว่างไม่มีชั้นเรียน) • คาบ ${periodNo} (${periodMeta.time})`;
        badge.style.background = '#f1f5f9';
        badge.style.color = '#64748b';
      }
    }

    const assignment = Store.getScheduleAssignment(day, periodNo);
    const teacherSelect = document.getElementById('assign-teacher-id');
    const roleSelect = document.getElementById('assign-role-type');
    const adviceInput = document.getElementById('assign-mentor-advice');
    const methodInput = document.getElementById('assign-teaching-method');
    const focusInput = document.getElementById('assign-focus-points');
    const feedbackInput = document.getElementById('assign-trainee-feedback');

    if (assignment) {
      if (teacherSelect) teacherSelect.value = assignment.teacherId || 'teacher_kouocking';
      if (roleSelect) roleSelect.value = assignment.assignRole || 'trainee';
      if (adviceInput) adviceInput.value = assignment.mentorAdvice || '';
      if (methodInput) methodInput.value = assignment.teachingMethod || '';
      if (focusInput) focusInput.value = assignment.focusPoints || '';
      if (feedbackInput) feedbackInput.value = assignment.traineeFeedback || '';
    } else {
      // Default suggestion for trainee
      const teachers = Store.getTeachersList();
      const trainee = teachers.find(t => t.roleCategory === 'trainee') || teachers[1] || teachers[0];
      if (teacherSelect && trainee) teacherSelect.value = trainee.id;
      if (roleSelect) roleSelect.value = 'trainee';
      if (adviceInput) adviceInput.value = '';
      if (methodInput) methodInput.value = '';
      if (focusInput) focusInput.value = '';
      if (feedbackInput) feedbackInput.value = '';
    }
  },

  appendAdvicePreset(text) {
    const el = document.getElementById('assign-mentor-advice');
    if (!el) return;
    if (el.value.trim().length > 0) {
      el.value = el.value.trim() + '\n• ' + text;
    } else {
      el.value = '• ' + text;
    }
  },

  appendMethodPreset(text) {
    const el = document.getElementById('assign-teaching-method');
    if (!el) return;
    if (el.value.trim().length > 0) {
      el.value = el.value.trim() + '\n• ' + text;
    } else {
      el.value = '• ' + text;
    }
  },

  saveCurrentAssignment() {
    const day = document.getElementById('assign-select-day')?.value;
    const periodNo = parseInt(document.getElementById('assign-select-period')?.value, 10);
    const teacherId = document.getElementById('assign-teacher-id')?.value;
    const assignRole = document.getElementById('assign-role-type')?.value;
    const mentorAdvice = (document.getElementById('assign-mentor-advice')?.value || '').trim();
    const teachingMethod = (document.getElementById('assign-teaching-method')?.value || '').trim();
    const focusPoints = (document.getElementById('assign-focus-points')?.value || '').trim();
    const traineeFeedback = (document.getElementById('assign-trainee-feedback')?.value || '').trim();

    const tt = Store.getTimetable();
    const className = tt.schedule[day]?.[periodNo] || '';

    const teachers = Store.getTeachersList();
    const teacher = teachers.find(t => t.id === teacherId) || { name: 'คุณครู' };
    const currentInst = Store.getInstructor();

    Store.saveScheduleAssignment(day, periodNo, {
      className,
      teacherId,
      teacherName: teacher.name,
      assignRole,
      mentorName: currentInst.name || 'นายพงศธร โพธิแก้ว',
      mentorAdvice,
      teachingMethod,
      focusPoints,
      traineeFeedback
    });

    this.closeTeachingAssignmentModal();
    if (document.getElementById('modal-timetable')?.classList.contains('active')) {
      this.openTimetableModal(this.state.timetableMode || 'official');
    }
    this.renderTodaySchedule();
    this.renderCockpitMentoringBanner();
    alert(`✅ บันทึกการมอบหมายคาบสอนและคำแนะนำนิเทศเรียบร้อยแล้ว!\n\nวัน${day} คาบที่ ${periodNo} (${className || 'คาบสอน'})\nผู้สอน: ${teacher.name}\nคำแนะนำ: ${mentorAdvice ? 'ระบุเรียบร้อย' : 'ตามมาตรฐาน'}`);
  },

  deleteCurrentAssignment() {
    const day = document.getElementById('assign-select-day')?.value;
    const periodNo = parseInt(document.getElementById('assign-select-period')?.value, 10);
    if (confirm(`ต้องการยกเลิกการมอบหมายคาบ วัน${day} คาบที่ ${periodNo} หรือไม่?`)) {
      Store.deleteScheduleAssignment(day, periodNo);
      this.closeTeachingAssignmentModal();
      if (document.getElementById('modal-timetable')?.classList.contains('active')) {
        this.openTimetableModal(this.state.timetableMode || 'official');
      }
      this.renderTodaySchedule();
      this.renderCockpitMentoringBanner();
      alert('🗑️ ยกเลิกการมอบหมายคาบนี้เรียบร้อยแล้ว');
    }
  },

  jumpToAssignedCockpit() {
    const day = document.getElementById('assign-select-day')?.value;
    const periodNo = parseInt(document.getElementById('assign-select-period')?.value, 10);
    const tt = Store.getTimetable();
    const className = tt.schedule[day]?.[periodNo];
    if (className && className.startsWith('ม.')) {
      this.closeTeachingAssignmentModal();
      this.closeTimetableModal();
      this.enterCockpit(className, 1);
    } else {
      alert('คาบนี้ไม่มีชั้นเรียนที่จัดการเรียนรู้ (เป็นคาบว่างหรือกิจกรรม)');
    }
  },

  closeTeachingAssignmentModal() {
    const modal = document.getElementById('modal-teaching-assignment');
    if (modal) modal.classList.remove('active');
  },

  renderCockpitMentoringBanner() {
    const banner = document.getElementById('cockpit-mentoring-guidance-banner');
    if (!banner) return;

    const className = this.state.selectedClass;
    const periodNo = this.state.selectedPeriod;

    // Search assignments for this class
    const assignments = Store.getScheduleAssignments();
    let matchedAssignment = null;

    for (const [key, assign] of Object.entries(assignments)) {
      if (assign.className === className) {
        matchedAssignment = assign;
        break;
      }
    }

    if (!matchedAssignment) {
      banner.style.display = 'none';
      return;
    }

    const isTrainee = matchedAssignment.assignRole === 'trainee';
    const isCoTeach = matchedAssignment.assignRole === 'co-teach';
    const roleBadge = isTrainee ?
      `<span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">🎓 นศ.ฝึกสอน ปฏิบัติการสอน</span>` :
      (isCoTeach ?
        `<span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">👥 ร่วมสอน (Co-teaching)</span>` :
        `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">👨‍🏫 ครูประจำวิชา</span>`
      );

    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.65rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span style="font-size: 1.1rem;">💡</span>
          <strong style="color: #9a3412; font-size: 0.95rem;">คำแนะนำ & วิธีการสอนจากครูพี่เลี้ยง (สำหรับคาบนี้)</strong>
          ${roleBadge}
          <span style="font-size: 0.8rem; color: #78350f;">ผู้สอน: <strong>${this.escapeHtml(matchedAssignment.teacherName || 'คุณครู')}</strong></span>
        </div>
        <button class="btn-nav-action" style="font-size: 0.75rem; padding: 3px 8px; background: #fff7ed; border-color: #fdba74; color: #9a3412;" onclick="App.openTeachingAssignmentModal('${matchedAssignment.day}', ${matchedAssignment.periodNo})">
          ✏️ ปรับปรุงคำแนะนำนิเทศ
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem; font-size: 0.84rem;">
        <div style="background: rgba(255,255,255,0.85); border: 1px solid #fed7aa; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-weight: 700; color: #7c2d12; margin-bottom: 3px;">📌 คำแนะนำสำคัญ & จิตวิทยาชั้นเรียน:</div>
          <div style="color: #431407; line-height: 1.4;">${this.escapeHtml(matchedAssignment.mentorAdvice || 'ให้คำแนะนำตามบริบทของคาบ')}</div>
        </div>

        <div style="background: rgba(255,255,255,0.85); border: 1px solid #fed7aa; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-weight: 700; color: #7c2d12; margin-bottom: 3px;">🎯 วิธีการ & ขั้นตอนการสอนที่แนะนำ:</div>
          <div style="color: #431407; line-height: 1.4;">${this.escapeHtml(matchedAssignment.teachingMethod || 'ตามขั้นตอนแผนการสอน T-PACE')}</div>
        </div>
      </div>

      ${matchedAssignment.focusPoints ? `
        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #92400e;">
          <strong>🔍 จุดเน้นการสังเกต/นิเทศ:</strong> ${this.escapeHtml(matchedAssignment.focusPoints)}
        </div>
      ` : ''}

      ${matchedAssignment.traineeFeedback ? `
        <div style="margin-top: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.8rem; color: #166534;">
          <strong>📝 สะท้อนคิดจาก นศ.ฝึกสอน:</strong> ${this.escapeHtml(matchedAssignment.traineeFeedback)}
        </div>
      ` : ''}
    `;
  },

  // --- Make-up Assessment Dialog ---
  checkMakeupsBanner() {
    const className = this.state.selectedClass;
    const pending = Store.getPendingMakeups(className);
    const banner = document.getElementById('makeup-alert-banner');
    if (banner) {
      if (pending.length > 0) {
        banner.style.display = 'flex';
        document.getElementById('makeup-alert-count').textContent = pending.length;
      } else {
        banner.style.display = 'none';
      }
    }
  },

  openMakeupModal() {
    const className = this.state.selectedClass;
    const pending = Store.getPendingMakeups(className);
    const listEl = document.getElementById('makeup-students-list');
    listEl.innerHTML = '';

    if (pending.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">ไม่มีนักเรียนค้างสอบในห้องนี้</div>';
    } else {
      pending.forEach(item => {
        const row = document.createElement('div');
        row.className = 'student-card';
        row.innerHTML = `
          <div>
            <div style="font-weight: 700; color: var(--ppk-navy-dark);">
              เลขที่ ${item.student.no}: ${item.student.prefix}${item.student.first_name} ${item.student.last_name} (${item.student.nickname || '-'})
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              คาบที่ ${item.period}: ${item.lessonTopic} • สาเหตุ: <span style="color:#dc2626;">${item.reason}</span>
            </div>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn-score-choice" onclick="App.handleMakeupScore('${className}', ${item.period}, '${item.student.student_id}', 3)">3</button>
            <button class="btn-score-choice" onclick="App.handleMakeupScore('${className}', ${item.period}, '${item.student.student_id}', 2)">2</button>
            <button class="btn-score-choice" onclick="App.handleMakeupScore('${className}', ${item.period}, '${item.student.student_id}', 1)">1</button>
          </div>
        `;
        listEl.appendChild(row);
      });
    }

    document.getElementById('modal-makeup').classList.add('active');
  },

  handleMakeupScore(className, period, studentId, score) {
    Store.saveMakeupScore(className, period, studentId, score);
    this.openMakeupModal();
    this.checkMakeupsBanner();
    this.renderAssessmentTab();
  },

  closeMakeupModal() {
    document.getElementById('modal-makeup').classList.remove('active');
  },

  // --- Holiday / Activity Modal ---
  openHolidayModal() {
    document.getElementById('modal-holiday').classList.add('active');
  },

  closeHolidayModal() {
    document.getElementById('modal-holiday').classList.remove('active');
  },

  confirmHolidayLog() {
    const className = this.state.selectedClass;
    const reason = document.getElementById('holiday-reason-select').value;
    const note = document.getElementById('holiday-custom-note').value.trim();
    const fullReason = note ? `${reason} (${note})` : reason;

    Store.logHoliday(className, null, fullReason);
    this.closeHolidayModal();
    alert(`✅ บันทึกงดสอนห้อง ${className} เรียบร้อยแล้ว (ไม่เลื่อนคาบเรียน)`);
    this.showDashboard();
  },

  // --- Reflection & Finishing Period ---
  openReflectionModal() {
    const className = this.state.selectedClass;
    const period = this.state.selectedPeriod;
    const students = Store.getStudents(className);
    const inst = Store.getInstructor();

    let eligibleTotal = 0;
    let presentCount = 0;
    students.forEach(s => {
      if (!Store.isStudentWithdrawn(s.student_id)) {
        eligibleTotal++;
        if (this.state.attendance[s.student_id] === 'present') presentCount++;
      }
    });

    const pct = eligibleTotal > 0 ? Math.round((presentCount / eligibleTotal) * 100) : 100;
    document.getElementById('refl-stat-attendance').textContent = `${pct}% (${presentCount}/${eligibleTotal} คน)`;
    document.getElementById('refl-stat-instructor').textContent = `${inst.name} (${inst.role})`;

    const existing = Store.getSession(className, period);
    document.getElementById('refl-handover-note').value = existing?.handoverNote || '';
    document.getElementById('refl-outcomes').value = existing?.reflection?.outcomes || `นักเรียนร้อยละ ${pct} สามารถปฏิบัติตามกิจกรรมการเรียนรู้ได้ตามเป้าหมาย`;
    document.getElementById('refl-problems').value = existing?.reflection?.problems || '';
    document.getElementById('refl-solutions').value = existing?.reflection?.solutions || '';

    document.getElementById('modal-reflection').classList.add('active');
  },

  closeReflectionModal() {
    document.getElementById('modal-reflection').classList.remove('active');
  },

  // --- Music Visual Aids & Interactive Staff/Kalimba Modal ---
  openMusicAidsModal(initialTab = 'staff') {
    const modal = document.getElementById('modal-music-visual-aids');
    if (modal) {
      modal.classList.add('active');
      this.switchMusicAidsTab(initialTab);
    }
  },

  closeMusicAidsModal() {
    const modal = document.getElementById('modal-music-visual-aids');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  switchMusicAidsTab(tab) {
    const tabs = ['staff', 'kalimba', 'songs', 'rhythm'];
    tabs.forEach(t => {
      const pane = document.getElementById(`pane-aids-${t}`);
      const btn = document.getElementById(`tab-btn-aids-${t}`);
      if (pane) {
        pane.style.display = (t === tab) ? 'block' : 'none';
      }
      if (btn) {
        if (t === tab) {
          btn.classList.add('active');
          btn.style.background = '#ffffff';
          btn.style.color = '#1e3a8a';
          btn.style.fontWeight = '700';
        } else {
          btn.classList.remove('active');
          btn.style.background = 'transparent';
          btn.style.color = '#64748b';
          btn.style.fontWeight = '600';
        }
      }
    });
  },

  playAidsNote(note) {
    if (typeof VirtualKalimba !== 'undefined' && VirtualKalimba.playNote) {
      VirtualKalimba.playNote(note);
    }
    // Visual feedback on staff note card
    const card = document.getElementById(`aids-note-card-${note}`);
    if (card) {
      card.style.transform = 'scale(1.08)';
      card.style.borderColor = '#0284c7';
      card.style.boxShadow = '0 0 12px rgba(2, 132, 199, 0.4)';
      setTimeout(() => {
        card.style.transform = 'scale(1)';
        card.style.borderColor = '#cbd5e1';
        card.style.boxShadow = 'none';
      }, 250);
    }
  },


  saveSessionAndFinish() {
    const className = this.state.selectedClass;
    const period = this.state.selectedPeriod;

    const handoverNote = document.getElementById('refl-handover-note').value.trim();
    const outcomes = document.getElementById('refl-outcomes').value.trim();
    const problems = document.getElementById('refl-problems').value.trim();
    const solutions = document.getElementById('refl-solutions').value.trim();

    const sessionData = {
      instructor: Store.getInstructor(),
      attendance: this.state.attendance,
      scores: this.state.scores,
      reflection: { outcomes, problems, solutions },
      handoverNote
    };

    Store.saveSession(className, period, sessionData);
    this.closeReflectionModal();
    alert(`✅ บันทึกข้อมูลการสอน คาบที่ ${period} ของห้อง ${className} เรียบร้อยแล้ว`);
    this.showDashboard();
  },

  // --- Digital Countdown Timer & Smart T-PACE Phase Progress ---
  getTpacePhases() {
    const lesson = Store.getLesson(this.state.grade, this.state.selectedPeriod);
    const defaultPhases = [
      { code: 'T', label: 'T • Tune-in', mins: 5 },
      { code: 'P', label: 'P • Present', mins: 10 },
      { code: 'A', label: 'A • Apply', mins: 20 },
      { code: 'C', label: 'C • Check', mins: 10 },
      { code: 'E', label: 'E • Evaluate', mins: 5 }
    ];
    if (!lesson || !Array.isArray(lesson.steps) || lesson.steps.length === 0) {
      return defaultPhases;
    }
    const codes = ['T', 'P', 'A', 'C', 'E'];
    return lesson.steps.slice(0, 5).map((s, idx) => {
      const mins = Number(s.duration || s.time_min || defaultPhases[idx]?.mins || 10);
      const code = codes[idx] || `S${idx + 1}`;
      return {
        code,
        label: s.phase || defaultPhases[idx]?.label || code,
        mins
      };
    });
  },

  playPhaseChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25]; // C5 -> E5 gentle classroom chime
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.14);
        osc.stop(ctx.currentTime + i * 0.14 + 0.45);
      });
    } catch (e) {
      // Ignore audio errors if browser blocks autoplay
    }
  },

  jumpToTpacePhase(phaseIdx) {
    const phases = this.getTpacePhases();
    const totalMins = phases.reduce((acc, p) => acc + p.mins, 0) || 50;
    let elapsedMinsBefore = 0;
    for (let i = 0; i < phaseIdx && i < phases.length; i++) {
      elapsedMinsBefore += phases[i].mins;
    }
    const remainingMins = Math.max(0, totalMins - elapsedMinsBefore);
    this.state.timerSeconds = remainingMins * 60;
    this.state.currentTpacePhaseIdx = phaseIdx;
    this.updateTimerDisplay();
  },

  timerStart() {
    if (this.state.timerRunning) return;
    this.state.timerRunning = true;
    this.state.timerInterval = setInterval(() => {
      if (this.state.timerSeconds > 0) {
        this.state.timerSeconds--;
        this.updateTimerDisplay(true);
      } else {
        this.timerPause();
        this.playPhaseChime();
        alert('🔔 หมดเวลาคาบเรียน 50 นาทีแล้วครับ');
      }
    }, 1000);
  },

  timerPause() {
    this.state.timerRunning = false;
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  },

  timerReset(minutes = 50) {
    this.timerPause();
    this.state.timerSeconds = minutes * 60;
    this.state.currentTpacePhaseIdx = 0;
    this.updateTimerDisplay();
  },

  updateTimerDisplay(fromTick = false) {
    const mins = Math.floor(this.state.timerSeconds / 60);
    const secs = this.state.timerSeconds % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('timer-display');
    if (el) el.textContent = str;

    // Update T-PACE Phase Progress Bar & Timeline Step Rows
    const phases = this.getTpacePhases();
    const totalSeconds = (phases.reduce((acc, p) => acc + p.mins, 0) || 50) * 60;
    const elapsedSeconds = Math.max(0, totalSeconds - this.state.timerSeconds);

    let cumulativeSec = 0;
    let activeIdx = phases.length - 1;
    for (let i = 0; i < phases.length; i++) {
      const phaseSec = phases[i].mins * 60;
      if (elapsedSeconds < cumulativeSec + phaseSec) {
        activeIdx = i;
        break;
      }
      cumulativeSec += phaseSec;
    }

    if (fromTick && this.state.currentTpacePhaseIdx !== undefined && this.state.currentTpacePhaseIdx !== activeIdx) {
      this.playPhaseChime();
    }
    this.state.currentTpacePhaseIdx = activeIdx;

    // Update chips in #tpace-phase-bar
    const barEl = document.getElementById('tpace-phase-bar');
    if (barEl) {
      const chips = barEl.querySelectorAll('.tpace-phase-chip');
      chips.forEach((chip, idx) => {
        const p = phases[idx];
        if (p) {
          chip.textContent = `${p.code} • ${p.mins}น.`;
          chip.title = `${p.label} (${p.mins} นาที) — คลิกเพื่อข้ามไปขั้นตอนนี้`;
        }
        chip.classList.remove('active', 'completed');
        if (idx < activeIdx) {
          chip.classList.add('completed');
        } else if (idx === activeIdx) {
          chip.classList.add('active');
        }
      });
    }

    // Highlight corresponding row in #steps-timeline
    const timelineEl = document.getElementById('steps-timeline');
    if (timelineEl) {
      const rows = timelineEl.querySelectorAll('.timeline-step-row');
      rows.forEach((row, idx) => {
        row.classList.remove('active-phase', 'completed-phase');
        if (idx < activeIdx) {
          row.classList.add('completed-phase');
        } else if (idx === activeIdx) {
          row.classList.add('active-phase');
        }
      });
    }
  },

  // --- Export & Reports Hub ---
  openExportModal() {
    this.populateExportClassSelect();
    document.getElementById('modal-export').classList.add('active');
  },

  closeExportModal() {
    document.getElementById('modal-export').classList.remove('active');
  },

  populateExportClassSelect() {
    const sel = document.getElementById('export-class-select');
    if (!sel) return;
    sel.innerHTML = '';
    const classes = [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')];
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `ห้อง ${c}`;
      sel.appendChild(opt);
    });
  },

  exportExcel() {
    const className = document.getElementById('export-class-select').value;
    const data = Store.generateCSVData(className);
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, className.replace('/', '_'));
      XLSX.writeFile(wb, `คะแนนและเวลาเรียน_${className.replace('/', '_')}.xlsx`);
    } else {
      const csvContent = "\uFEFF" + data.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `คะแนน_${className.replace('/', '_')}.csv`;
      link.click();
    }
  },

  exportWk5() {
    const className = document.getElementById('export-class-select').value;
    const sessions = Store.getAllSessions();
    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const schoolName = (settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม';

    let text = `=======================================================\n`;
    text += `สรุปบันทึกหลังการจัดการเรียนรู้ (แบบฟอร์ม วก.5)\n`;
    text += `${schoolName} • ห้อง ${className}\n`;
    text += `=======================================================\n\n`;

    let found = 0;
    for (let p = 1; p <= 20; p++) {
      const key = Store.getSessionKey(className, p);
      const s = sessions[key];
      if (s) {
        found++;
        text += `[ คาบที่ ${p} ] วันที่: ${s.dateStr} | ผู้สอน: ${s.instructor.name} (${s.instructor.role})\n`;
        text += `• ผลการจัดการเรียนรู้: ${s.reflection.outcomes || '-'}\n`;
        text += `• ปัญหาและอุปสรรค: ${s.reflection.problems || '-'}\n`;
        text += `• แนวทางแก้ไข: ${s.reflection.solutions || '-'}\n`;
        if (s.handoverNote) text += `• บันทึกส่งต่องาน: ${s.handoverNote}\n`;
        text += `-------------------------------------------------------\n`;
      }
    }

    if (found === 0) {
      alert(`ยังไม่มีบันทึกหลังสอนสำหรับห้อง ${className} ครับ`);
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      alert(`📋 คัดลอกบันทึกหลังสอนของห้อง ${className} จำนวน ${found} คาบ ลงใน Clipboard เรียบร้อยแล้ว!\nสามารถนำไปกดวาง (Ctrl+V) ในเอกสาร Word วก.5 ได้ทันทีครับ`);
    }).catch(() => {
      alert(text);
    });
  },

  backupJSON() {
    const jsonStr = Store.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_MusicLMS_PPK_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  },

  handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = Store.importBackupJSON(e.target.result);
      if (res.success) {
        alert(`✅ กู้คืนข้อมูลสำเร็จเรียบร้อย! (นำเข้าบันทึก ${res.count} คาบ)`);
        location.reload();
      } else {
        alert(`❌ เกิดข้อผิดพลาดในการกู้คืน: ${res.error}`);
      }
    };
    reader.readAsText(file);
  },

  // --- Academic Documents Hub (วก. 1 - วก. 7) ---
  openAcademicDocsModal(defaultTab = 'wk3', docId = null, forceGrade = null) {
    const modal = document.getElementById('modal-academic-docs');
    if (!modal) return;
    if (forceGrade) {
      this.state.academicGrade = forceGrade;
    } else if (!this.state.academicGrade) {
      const isM2 = (this.state.selectedGrade === 'M2') ||
                   (this.state.selectedClass && String(this.state.selectedClass).includes('2'));
      this.state.academicGrade = isM2 ? 'M2' : 'M1';
    }
    if (typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' && ACADEMIC_DOCS_BY_GRADE[this.state.academicGrade]) {
      ACADEMIC_DOCS = ACADEMIC_DOCS_BY_GRADE[this.state.academicGrade];
    }
    modal.classList.add('active');
    this.switchAcademicTab(defaultTab, docId);
  },

  switchAcademicGrade(grade) {
    this.state.academicGrade = grade;
    if (typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' && ACADEMIC_DOCS_BY_GRADE[grade]) {
      ACADEMIC_DOCS = ACADEMIC_DOCS_BY_GRADE[grade];
    }
    this.switchAcademicTab(this.state.academicTab || 'wk3', null);
  },

  openAcademicDocsForPeriod(period = null) {
    if (period === null) {
      period = this.state.selectedPeriod || 1;
    }
    const isM2 = (this.state.selectedGrade === 'M2') ||
                 (this.state.selectedClass && String(this.state.selectedClass).includes('2'));
    this.openAcademicDocsModal('wk5', period, isM2 ? 'M2' : 'M1');
  },

  closeAcademicDocsModal() {
    const modal = document.getElementById('modal-academic-docs');
    if (modal) modal.classList.remove('active');
  },

  switchAcademicTab(tabKey, docId = null) {
    this.state.academicTab = tabKey;
    const curGrade = this.state.academicGrade || 'M1';
    if (typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' && ACADEMIC_DOCS_BY_GRADE[curGrade]) {
      ACADEMIC_DOCS = ACADEMIC_DOCS_BY_GRADE[curGrade];
    }
    
    // Update active tab button style
    document.querySelectorAll('.academic-tab-btn').forEach(b => {
      b.classList.remove('active');
    });
    const activeBtn = document.getElementById(`ac-tab-${tabKey}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Build selector
    const selectorContainer = document.getElementById('academic-selector-container');
    if (!selectorContainer) return;
    selectorContainer.innerHTML = '';

    if (typeof ACADEMIC_DOCS === 'undefined') {
      selectorContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">กำลังโหลดข้อมูลวิชาการ...</span>';
      return;
    }

    // Add Grade Switcher Pill (M.1 vs M.2)
    const gradeSwitchWrap = document.createElement('div');
    gradeSwitchWrap.style.cssText = 'display:inline-flex; gap:4px; background:#e2e8f0; padding:3px; border-radius:8px; margin-right:10px; vertical-align:middle;';
    gradeSwitchWrap.innerHTML = `
      <button type="button" onclick="App.switchAcademicGrade('M1')" style="border:none; padding:4px 10px; border-radius:6px; font-family:inherit; font-size:0.8rem; font-weight:700; cursor:pointer; background:${curGrade === 'M1' ? '#1e3a8a' : 'transparent'}; color:${curGrade === 'M1' ? '#fff' : '#334155'};">
        🎵 ม.1 ดนตรี 1 (ศ21102 • 79 ไฟล์)
      </button>
      <button type="button" onclick="App.switchAcademicGrade('M2')" style="border:none; padding:4px 10px; border-radius:6px; font-family:inherit; font-size:0.8rem; font-weight:700; cursor:pointer; background:${curGrade === 'M2' ? '#1e3a8a' : 'transparent'}; color:${curGrade === 'M2' ? '#fff' : '#334155'};">
        🎶 ม.2 ดนตรี 2 (ศ22102 • 79 ไฟล์)
      </button>
    `;
    selectorContainer.appendChild(gradeSwitchWrap);

    if (tabKey === 'wk3') {
      this.state.academicDocId = 'wk3';
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'badge-primary';
      badgeSpan.style.cssText = 'font-size: 0.85rem; padding: 4px 10px; border-radius: 4px;';
      badgeSpan.textContent = curGrade === 'M2'
        ? '📖 ศ22102 ดนตรี 2 (ชั้น ม.2) • โครงสร้างรายวิชา 20 คาบ (4 หน่วย × 20 + กลางภาค 10 + ปลายภาค 10 = 100 คะแนน)'
        : '📖 ศ21102 ดนตรี 1 (ชั้น ม.1) • โครงสร้างรายวิชา 20 คาบ (0.5 หน่วยกิต)';
      selectorContainer.appendChild(badgeSpan);
    } else if (tabKey === 'wk4') {
      const units = ACADEMIC_DOCS.wk4 || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '360px';
      units.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.unit_no;
        opt.textContent = `หน่วยที่ ${u.unit_no}: ${u.unit_name}`;
        if (docId && String(docId) === String(u.unit_no)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId ? parseInt(docId, 10) : (units[0]?.unit_no || 1);
    } else if (tabKey === 'wk5') {
      const plans = ACADEMIC_DOCS.wk5 || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '460px';
      plans.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.period;
        opt.textContent = `แผนที่ ${p.period}: ${p.topic}`;
        if (docId && String(docId) === String(p.period)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId ? parseInt(docId, 10) : (plans[0]?.period || 1);
    } else if (tabKey === 'manuals') {
      const manuals = ACADEMIC_DOCS.manuals || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '500px';
      manuals.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = m.title;
        if (docId !== null && String(docId) === String(idx)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId !== null ? parseInt(docId, 10) : 0;
    } else if (tabKey === 'media') {
      const medias = ACADEMIC_DOCS.media || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '480px';
      medias.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.period;
        opt.textContent = `สื่อ/ใบงาน คาบที่ ${m.period}: ${m.title}`;
        if (docId && String(docId) === String(m.period)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId ? parseInt(docId, 10) : (medias[0]?.period || 1);
    } else if (tabKey === 'eval') {
      const evals = ACADEMIC_DOCS.eval || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '460px';
      evals.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.doc_no;
        opt.textContent = `ฉบับที่ ${e.doc_no}: ${e.title}`;
        if (docId && String(docId) === String(e.doc_no)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId ? parseInt(docId, 10) : (evals[0]?.doc_no || 1);
    } else if (tabKey === 'tests') {
      const tests = ACADEMIC_DOCS.tests || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '420px';
      tests.forEach((t, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = t.title;
        if (docId !== null && String(docId) === String(idx)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId !== null ? parseInt(docId, 10) : 0;
    } else if (tabKey === 'supp') {
      const supps = ACADEMIC_DOCS.supp || [];
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.style.maxWidth = '460px';
      supps.forEach((s, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = s.title;
        if (docId !== null && String(docId) === String(idx)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = (e) => this.selectAcademicDoc(e.target.value);
      selectorContainer.appendChild(sel);
      this.state.academicDocId = docId !== null ? parseInt(docId, 10) : 0;
    }

    this.renderAcademicContent();
  },

  selectAcademicDoc(docId) {
    this.state.academicDocId = docId;
    this.renderAcademicContent();
  },

  renderAcademicContent() {
    const display = document.getElementById('academic-doc-display');
    const footerMeta = document.getElementById('academic-doc-meta-footer');
    if (!display || typeof ACADEMIC_DOCS === 'undefined') return;

    display.innerHTML = '';
    const tab = this.state.academicTab;
    const docId = this.state.academicDocId;

    let docObj = null;

    if (tab === 'wk3') {
      docObj = ACADEMIC_DOCS.wk3;
    } else if (tab === 'wk4') {
      docObj = (ACADEMIC_DOCS.wk4 || []).find(u => String(u.unit_no) === String(docId)) || ACADEMIC_DOCS.wk4[0];
    } else if (tab === 'wk5') {
      docObj = (ACADEMIC_DOCS.wk5 || []).find(p => String(p.period) === String(docId)) || ACADEMIC_DOCS.wk5[0];
    } else if (tab === 'manuals') {
      const idx = parseInt(docId, 10) || 0;
      docObj = (ACADEMIC_DOCS.manuals || [])[idx] || (ACADEMIC_DOCS.manuals || [])[0];
    } else if (tab === 'media') {
      docObj = (ACADEMIC_DOCS.media || []).find(m => String(m.period) === String(docId)) || ACADEMIC_DOCS.media[0];
    } else if (tab === 'eval') {
      docObj = (ACADEMIC_DOCS.eval || []).find(e => String(e.doc_no) === String(docId)) || ACADEMIC_DOCS.eval[0];
    } else if (tab === 'tests') {
      const idx = parseInt(docId, 10) || 0;
      docObj = ACADEMIC_DOCS.tests[idx] || ACADEMIC_DOCS.tests[0];
    } else if (tab === 'supp') {
      const idx = parseInt(docId, 10) || 0;
      docObj = ACADEMIC_DOCS.supp[idx] || ACADEMIC_DOCS.supp[0];
    }

    if (!docObj) {
      display.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted);">ไม่พบข้อมูลเอกสาร</div>';
      return;
    }

    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const schoolName = (settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม';
    const deptName = (settings && settings.department) || 'กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)';
    const curGrade = this.state.academicGrade || 'M1';
    const subjStr = curGrade === 'M2' ? 'รายวิชา ดนตรี 2 (ศ22102) ชั้นมัธยมศึกษาปีที่ 2' : 'รายวิชา ดนตรี 1 (ศ21102) ชั้นมัธยมศึกษาปีที่ 1';

    let html = '';
    const titleText = docObj.title || docObj.topic || docObj.unit_name || docObj.filename || '';
    html += `<h2 class="academic-doc-title">${this.escapeHtml(titleText)}</h2>`;
    html += `<div class="academic-doc-subtitle">${this.escapeHtml(deptName)} • ${this.escapeHtml(schoolName)} • ${this.escapeHtml(subjStr)}</div>`;

    // Render paragraphs
    if (docObj.paragraphs && docObj.paragraphs.length > 0) {
      docObj.paragraphs.forEach(p => {
        if (!p) return;
        if (p.startsWith('==') || p.startsWith('--') || p.startsWith('__')) {
          html += '<hr style="border:none; border-top:1px solid #e2e8f0; margin:1rem 0;" />';
        } else if (p.length < 95 && (p.includes('หน่วยการเรียนรู้') || p.includes('มาตรฐาน') || p.includes('สาระสำคัญ') || p.includes('จุดประสงค์') || p.includes('กิจกรรมการเรียนรู้') || p.includes('ภารกิจ') || p.includes('เกณฑ์การประเมิน') || p.includes('ขั้นตอน') || p.includes('สื่อ / แหล่งเรียนรู้') || p.includes('การวัดและประเมินผล') || p.includes('บันทึกผลหลังการสอน'))) {
          html += `<h3 class="academic-section-h2">${this.escapeHtml(p)}</h3>`;
        } else if (p.startsWith('💡') || p.startsWith('📎') || p.startsWith('คำแนะนำ') || p.startsWith('ข้อสังเกต') || /^[TPACE]\s*-\s*\d+\./.test(p)) {
          html += `<div class="academic-callout">${this.escapeHtml(p)}</div>`;
        } else {
          html += `<p style="margin-bottom: 0.75rem; text-indent: 1.5rem;">${this.escapeHtml(p)}</p>`;
        }
      });
    }

    // Render tables
    if (docObj.tables && docObj.tables.length > 0) {
      docObj.tables.forEach((table, tIdx) => {
        html += `<div style="overflow-x: auto; margin: 1.25rem 0;">`;
        html += `<table class="academic-table">`;
        table.forEach((row, rIdx) => {
          html += `<tr>`;
          row.forEach(cell => {
            const tag = rIdx === 0 ? 'th' : 'td';
            html += `<${tag}>${this.escapeHtml(cell)}</${tag}>`;
          });
          html += `</tr>`;
        });
        html += `</table></div>`;
      });
    }

    display.innerHTML = html;
    if (footerMeta) {
      footerMeta.textContent = `เอกสาร: ${docObj.filename || titleText} • ${schoolName}`;
    }
  },

  copyCurrentAcademicDoc() {
    const display = document.getElementById('academic-doc-display');
    if (!display) return;
    const text = display.innerText;
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 คัดลอกเนื้อหาเอกสารวิชาการลงในคลิปบอร์ดเรียบร้อยแล้ว!\nสามารถนำไปกดวาง (Ctrl+V) ใน Microsoft Word ได้ทันทีครับ');
    }).catch(() => {
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาลากคลุมดำข้อความและกด Ctrl+C');
    });
  },

  printCurrentAcademicDoc() {
    const display = document.getElementById('academic-doc-display');
    if (!display) return;

    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const schoolName = (settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม';

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>เอกสารวิชาการ ${this.escapeHtml(schoolName)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Sarabun', serif; font-size: 14px; line-height: 1.6; padding: 2.5cm 2cm; color: #000; }
          h2 { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 5px; }
          .sub { font-size: 13px; text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
          th, td { border: 1px solid #000; padding: 6px 8px; }
          th { background: #f0f0f0; font-weight: 700; text-align: center; }
          .callout { border: 1px solid #000; padding: 10px; margin: 15px 0; background: #fafafa; }
          p { margin-bottom: 8px; text-indent: 1.5cm; }
        </style>
      </head>
      <body>
        ${display.innerHTML}
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
  },

  // =========================================================================
  // Customizable Curriculum & Lesson Plan Editor (Overlay Architecture)
  // =========================================================================

  openCurrentLessonEditor() {
    this.openLessonEditorModal(this.state.grade || 'M1', this.state.selectedPeriod || 1);
  },

  openLessonEditorModal(grade, period) {
    const p = Number(period);
    const g = grade || 'M1';
    const lesson = Store.getLesson(g, p);
    if (!lesson) {
      alert(`ไม่พบข้อมูลบทเรียนคาบที่ ${p}`);
      return;
    }

    const titleEl = document.getElementById('modal-lesson-editor-title');
    if (titleEl) {
      titleEl.textContent = `✏️ ปรับแต่งแผนการสอน (${g === 'M1' ? 'ม.1 ศ21101/ศ21102' : 'ม.2 ศ22101/ศ22102'} / คาบที่ ${p})`;
    }

    document.getElementById('editor-lesson-grade').value = g;
    document.getElementById('editor-lesson-period').value = p;
    document.getElementById('editor-lesson-topic').value = lesson.topic || '';
    document.getElementById('editor-lesson-unit-name').value = lesson.unit_name || lesson.unitName || '';

    // KPA
    document.getElementById('editor-kpa-k').value = lesson.kpa?.k || '';
    document.getElementById('editor-kpa-p').value = lesson.kpa?.p || '';
    document.getElementById('editor-kpa-a').value = lesson.kpa?.a || '';

    // 5 T-PACE Steps
    const stepsContainer = document.getElementById('editor-steps-container');
    if (stepsContainer) {
      stepsContainer.innerHTML = '';
      const defaultSteps = [
        { phase: 'ขั้นนำเข้าสู่บทเรียน (Tune-in)', duration: 5, desc: '' },
        { phase: 'ขั้นสอนและชี้แจง (Present)', duration: 10, desc: '' },
        { phase: 'ขั้นปฏิบัติการและฝึกฝน (Apply)', duration: 20, desc: '' },
        { phase: 'ขั้นตรวจสอบและร่วมวิจารณ์ (Check)', duration: 10, desc: '' },
        { phase: 'ขั้นสรุปและประเมินผล (Evaluate)', duration: 5, desc: '' }
      ];
      const steps = (lesson.steps && lesson.steps.length > 0) ? lesson.steps : defaultSteps;
      steps.forEach((s, idx) => {
        const stepRow = document.createElement('div');
        stepRow.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem;';
        stepRow.innerHTML = `
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.5rem; margin-bottom: 0.4rem;">
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #1e293b;">ขั้นตอนที่ ${idx + 1}:</label>
              <input type="text" class="form-input editor-step-phase" value="${App.escapeHtml(s.phase || '')}" placeholder="ชื่อขั้นตอน">
            </div>
            <div>
              <label style="font-size: 0.76rem; font-weight: 700; color: #1e293b;">เวลา (นาที):</label>
              <input type="number" min="1" max="120" class="form-input editor-step-duration" value="${Number(s.duration || s.time_min || 10)}" oninput="App.recalcEditorTotalDuration()">
            </div>
          </div>
          <div>
            <label style="font-size: 0.76rem; font-weight: 600; color: #64748b;">กิจกรรมการจัดการเรียนรู้:</label>
            <textarea class="form-input editor-step-desc" rows="2" placeholder="รายละเอียดกิจกรรม">${App.escapeHtml(s.desc || s.action || '')}</textarea>
          </div>
        `;
        stepsContainer.appendChild(stepRow);
      });
    }

    // Media
    this.renderEditorMediaRows(lesson.media || []);

    // Mentor Tips
    document.getElementById('editor-mentor-tips').value = lesson.mentor_tips || lesson.mentor_tip || '';

    this.recalcEditorTotalDuration();

    const modal = document.getElementById('modal-lesson-editor');
    if (modal) modal.classList.add('active');
  },

  recalcEditorTotalDuration() {
    const durInputs = document.querySelectorAll('.editor-step-duration');
    let total = 0;
    durInputs.forEach(inp => {
      total += Number(inp.value || 0);
    });
    const badge = document.getElementById('editor-total-duration-badge');
    if (badge) {
      badge.textContent = `รวม ${total} นาที`;
    }
  },

  renderEditorMediaRows(mediaList = []) {
    const container = document.getElementById('editor-media-container');
    if (!container) return;
    container.innerHTML = '';
    if (mediaList.length === 0) {
      container.innerHTML = `<div id="editor-media-empty-text" style="font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 0.5rem;">ยังไม่มีสื่อหรือเอกสารแนบในคาบนี้</div>`;
      return;
    }
    mediaList.forEach(m => this.addEditorMediaRow(m));
  },

  addEditorMediaRow(item = null) {
    const container = document.getElementById('editor-media-container');
    if (!container) return;
    const emptyText = document.getElementById('editor-media-empty-text');
    if (emptyText) emptyText.remove();

    const row = document.createElement('div');
    row.className = 'editor-media-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 2fr auto; gap: 0.5rem; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.4rem 0.6rem;';
    
    const titleVal = item ? (item.title || '') : '';
    const typeVal = item ? (item.type || 'link') : 'link';
    const urlVal = item ? (item.url || '') : '';

    row.innerHTML = `
      <input type="text" class="form-input editor-media-title" value="${App.escapeHtml(titleVal)}" placeholder="ชื่อสื่อ/เอกสาร" style="font-size: 0.82rem; padding: 4px 8px;">
      <select class="form-select editor-media-type" style="font-size: 0.82rem; padding: 4px 8px;">
        <option value="video" ${typeVal === 'video' ? 'selected' : ''}>🎬 วิดีโอ/คลิป</option>
        <option value="doc" ${typeVal === 'doc' ? 'selected' : ''}>📄 เอกสาร/ชีต</option>
        <option value="link" ${typeVal === 'link' ? 'selected' : ''}>🔗 ลิงก์ภายนอก</option>
        <option value="drive" ${typeVal === 'drive' ? 'selected' : ''}>📁 Google Drive</option>
      </select>
      <input type="text" class="form-input editor-media-url" value="${App.escapeHtml(urlVal)}" placeholder="URL หรือพาธไฟล์" style="font-size: 0.82rem; padding: 4px 8px; font-family: monospace;">
      <button type="button" class="btn-preset-chip" style="background: #fef2f2; color: #dc2626; border-color: #fecaca; font-weight: 700; padding: 3px 8px;" onclick="App.removeEditorMediaRow(this)" title="ลบสื่อนี้">
        ✕
      </button>
    `;
    container.appendChild(row);
  },

  removeEditorMediaRow(btn) {
    if (!btn) return;
    const row = btn.closest('.editor-media-row');
    if (row) row.remove();
    const container = document.getElementById('editor-media-container');
    if (container && container.children.length === 0) {
      container.innerHTML = `<div id="editor-media-empty-text" style="font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 0.5rem;">ยังไม่มีสื่อหรือเอกสารแนบในคาบนี้</div>`;
    }
  },

  saveLessonEditorModal() {
    const grade = document.getElementById('editor-lesson-grade').value || 'M1';
    const period = Number(document.getElementById('editor-lesson-period').value || 1);
    const topic = document.getElementById('editor-lesson-topic').value.trim();
    const unitName = document.getElementById('editor-lesson-unit-name').value.trim();

    if (!topic) {
      alert('⚠️ กรุณาระบุหัวข้อบทเรียน');
      return;
    }

    const kpa = {
      k: document.getElementById('editor-kpa-k').value.trim(),
      p: document.getElementById('editor-kpa-p').value.trim(),
      a: document.getElementById('editor-kpa-a').value.trim()
    };

    // Steps
    const stepRows = document.querySelectorAll('#editor-steps-container > div');
    const steps = [];
    let totalDuration = 0;
    stepRows.forEach(row => {
      const phase = row.querySelector('.editor-step-phase')?.value.trim() || '';
      const duration = Number(row.querySelector('.editor-step-duration')?.value || 10);
      const desc = row.querySelector('.editor-step-desc')?.value.trim() || '';
      totalDuration += duration;
      steps.push({ phase, duration, desc });
    });

    // Media
    const mediaRows = document.querySelectorAll('#editor-media-container .editor-media-row');
    const media = [];
    mediaRows.forEach(row => {
      const title = row.querySelector('.editor-media-title')?.value.trim() || '';
      const type = row.querySelector('.editor-media-type')?.value || 'link';
      const url = row.querySelector('.editor-media-url')?.value.trim() || '';
      if (title || url) {
        media.push({ title: title || url, type, url: url || '#' });
      }
    });

    const mentorTips = document.getElementById('editor-mentor-tips').value.trim();

    const customData = {
      topic,
      unit_name: unitName,
      unitName,
      kpa,
      steps,
      duration_min: totalDuration || 50,
      media,
      mentor_tips: mentorTips
    };

    Store.saveCustomLesson(grade, period, customData);
    this.closeLessonEditorModal();

    // If currently in Cockpit on that period, refresh immediately
    if (this.state.grade === grade && Number(this.state.selectedPeriod) === period) {
      this.renderLessonTab();
      if (this.setupTpaceTimer) this.setupTpaceTimer(true);
    }

    // If Curriculum Hub is open, refresh cards
    const hubModal = document.getElementById('modal-curriculum-hub');
    if (hubModal && hubModal.classList.contains('active')) {
      this.renderCurriculumHubCards(grade);
    }

    alert(`✅ บันทึกและปรับแต่งแผนการสอน (${grade === 'M1' ? 'ม.1' : 'ม.2'} คาบที่ ${period}) เรียบร้อยแล้ว!\nระบบได้อัปเดตเวลานาฬิกา T-PACE และส่งซิงค์คู่ขนานขึ้น Google Sheets ให้โดยอัตโนมัติครับ`);
  },

  resetCurrentLessonModal() {
    const grade = document.getElementById('editor-lesson-grade').value || 'M1';
    const period = Number(document.getElementById('editor-lesson-period').value || 1);

    if (!confirm(`คุณครูต้องการคืนค่าแผนการสอน คาบที่ ${period} กลับเป็น "แผนมาตรฐานของโรงเรียน" ใช่หรือไม่?`)) {
      return;
    }

    Store.resetCustomLesson(grade, period);
    this.closeLessonEditorModal();

    if (this.state.grade === grade && Number(this.state.selectedPeriod) === period) {
      this.renderLessonTab();
      if (this.setupTpaceTimer) this.setupTpaceTimer(true);
    }

    const hubModal = document.getElementById('modal-curriculum-hub');
    if (hubModal && hubModal.classList.contains('active')) {
      this.renderCurriculumHubCards(grade);
    }

    alert(`🔄 คืนค่าแผนการสอนคาบที่ ${period} เป็นแผนมาตรฐานโรงเรียนเรียบร้อยแล้วครับ`);
  },

  closeLessonEditorModal() {
    const modal = document.getElementById('modal-lesson-editor');
    if (modal) modal.classList.remove('active');
  },

  // --- Curriculum Hub (คลังแผนการสอน 40 คาบ) ---
  openCurriculumHubModal(defaultGrade = null) {
    const grade = defaultGrade || this.state.grade || 'M1';
    this.currentHubGrade = grade;
    this.switchCurriculumHubGrade(grade);
    const modal = document.getElementById('modal-curriculum-hub');
    if (modal) modal.classList.add('active');
  },

  closeCurriculumHubModal() {
    const modal = document.getElementById('modal-curriculum-hub');
    if (modal) modal.classList.remove('active');
  },

  switchCurriculumHubGrade(grade) {
    this.currentHubGrade = grade;
    const tabM1 = document.getElementById('hub-tab-m1');
    const tabM2 = document.getElementById('hub-tab-m2');
    if (tabM1 && tabM2) {
      if (grade === 'M1') {
        tabM1.className = 'btn-nav-action primary';
        tabM2.className = 'btn-nav-action';
      } else {
        tabM1.className = 'btn-nav-action';
        tabM2.className = 'btn-nav-action primary';
      }
    }
    this.renderCurriculumHubCards(grade);
  },

  renderCurriculumHubCards(grade) {
    const container = document.getElementById('curriculum-hub-cards');
    if (!container) return;
    container.innerHTML = '';

    const lessons = Store.getAllLessons(grade) || [];
    lessons.forEach(l => {
      const isCustom = !!l.isCustomized;
      const totalDuration = (l.steps || []).reduce((acc, s) => acc + (s.duration || s.time_min || 10), 0) || l.duration_min || 50;
      const card = document.createElement('div');
      card.style.cssText = `
        background: #ffffff;
        border: 1px solid ${isCustom ? '#fde68a' : '#e2e8f0'};
        border-radius: 12px;
        padding: 1rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      `;
      card.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: #1e40af;">คาบที่ ${l.period}</span>
            <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 9999px; ${isCustom ? 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;' : 'background: #f1f5f9; color: #475569;'}">
              ${isCustom ? '✏️ ปรับแต่งเฉพาะ' : 'มาตรฐาน'}
            </span>
          </div>
          <div style="font-size: 0.76rem; color: #64748b; margin-bottom: 0.25rem;">
            ${App.escapeHtml(l.unit_name || l.unitName || 'หน่วยการเรียนรู้')}
          </div>
          <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-bottom: 0.5rem; line-height: 1.4;">
            ${App.escapeHtml(l.topic || '')}
          </div>
          <div style="font-size: 0.78rem; color: #475569; margin-bottom: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            <strong>K:</strong> ${App.escapeHtml(l.kpa?.k || '-')}
          </div>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 0.65rem; margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">⏱️ ${totalDuration} นาที</span>
          <button type="button" class="btn-preset-chip" style="background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; font-weight: 700; padding: 4px 10px; cursor: pointer;" onclick="App.openLessonEditorModal('${grade}', ${l.period})">
            ✏️ ปรับแต่งแผน
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  resetAllCurriculumModal() {
    if (!confirm('⚠️ คุณครูต้องการคืนค่าแผนการสอนทั้งหมด 40 คาบ (ทั้ง ม.1 และ ม.2) กลับเป็น "แผนมาตรฐานของโรงเรียน" ใช่หรือไม่?')) {
      return;
    }
    Store.resetAllCustomLessons();
    this.renderCurriculumHubCards(this.currentHubGrade || 'M1');
    if (this.renderLessonTab) this.renderLessonTab();
    if (this.setupTpaceTimer) this.setupTpaceTimer(true);
    alert('🔄 คืนค่าแผนการสอนทั้ง 40 คาบเป็นแผนมาตรฐานโรงเรียนเรียบร้อยแล้วครับ');
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
