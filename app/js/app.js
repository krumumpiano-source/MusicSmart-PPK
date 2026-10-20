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
    role: 'teacher',
    studentClass: 'ม.1/1',
    studentId: '35994',
    studentPeriod: 1,
    academicTab: 'wk3',
    academicDocId: null,
    submissionsFilter: 'all'
  },

  init() {
    this.state.role = Store.getActiveRole();
    this.applyAppSettings();
    this.renderCourseTabs();
    this.updateSemesterBadge();
    this.updateInstructorBadge();
    this.renderTodaySchedule();
    this.renderTeacherTodoList();
    this.renderDashboard();
    this.populateExportClassSelect();
    this.initStudentPortal();
    if (typeof Tuner !== 'undefined' && Tuner.init) Tuner.init();
    if (typeof AudioTools !== 'undefined' && AudioTools.renderBeatDots) AudioTools.renderBeatDots();
    if (typeof VirtualKalimba !== 'undefined' && VirtualKalimba.init) VirtualKalimba.init();
    this.checkAuth();
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
    const studentSwitcher = document.getElementById('student-switcher-container');
    const teacherActions = document.getElementById('teacher-actions-group');
    const headerMiddle = document.getElementById('header-middle-teacher');

    if (!user) {
      if (authModal) authModal.classList.add('active');
      if (authUserBadge) authUserBadge.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
      this.switchAuthTab('student');
      return false;
    }

    if (authModal) authModal.classList.remove('active');

    if (user.role === 'teacher') {
      if (authUserBadge) {
        authUserBadge.innerHTML = `👨‍🏫 <span style="color:var(--ppk-navy-dark);">${this.escapeHtml(user.name || 'คุณครู')}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${this.escapeHtml(user.email || 'ครูผู้สอน')})</span>`;
      }
      if (studentSwitcher) studentSwitcher.style.display = 'block';
      if (teacherActions) teacherActions.style.display = 'flex';
      if (headerMiddle) headerMiddle.style.display = 'flex';
      this.switchRole('teacher', false);
    } else if (user.role === 'student') {
      this.state.studentId = user.studentId;
      this.state.studentClass = user.studentClass;
      if (authUserBadge) {
        authUserBadge.innerHTML = `🎓 <span style="color:var(--ppk-navy-dark);">${this.escapeHtml(user.name)}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${this.escapeHtml(user.studentClass)} เลขที่ ${user.no}</span>`;
      }
      if (studentSwitcher) studentSwitcher.style.display = 'none';
      if (teacherActions) teacherActions.style.display = 'none';
      if (headerMiddle) headerMiddle.style.display = 'none';
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
      setTimeout(() => document.getElementById('auth-teacher-secret')?.focus(), 150);
    }
  },

  onAuthStudentIdInput(val) {
    const cleanId = (val || '').trim();
    const previewBox = document.getElementById('auth-student-preview-box');
    const previewName = document.getElementById('auth-student-preview-name');
    const previewMeta = document.getElementById('auth-student-preview-meta');
    const modeLogin = document.getElementById('auth-student-mode-login');
    const modeRegister = document.getElementById('auth-student-mode-register');
    const indicator = document.getElementById('auth-student-id-indicator');

    if (cleanId.length === 5) {
      const studentInfo = Store.getStudentById(cleanId);
      if (studentInfo) {
        if (indicator) {
          indicator.textContent = '✅';
          indicator.style.display = 'block';
        }
        if (previewBox) previewBox.style.display = 'block';
        if (previewName) previewName.textContent = `${studentInfo.prefix}${studentInfo.first_name} ${studentInfo.last_name} (${studentInfo.nickname || '-'})`;
        if (previewMeta) previewMeta.textContent = `ห้อง ${studentInfo.class} • เลขที่ ${studentInfo.no} • รหัส: ${studentInfo.student_id}`;

        const acc = Store.getStudentAccount(cleanId);
        if (acc) {
          if (modeLogin) modeLogin.style.display = 'block';
          if (modeRegister) modeRegister.style.display = 'none';
          setTimeout(() => document.getElementById('auth-student-pin')?.focus(), 150);
        } else {
          if (modeLogin) modeLogin.style.display = 'none';
          if (modeRegister) modeRegister.style.display = 'block';
          setTimeout(() => document.getElementById('auth-student-new-pin')?.focus(), 150);
        }
        return;
      }
    }

    if (indicator) indicator.style.display = 'none';
    if (previewBox) previewBox.style.display = 'none';
    if (modeLogin) modeLogin.style.display = 'none';
    if (modeRegister) modeRegister.style.display = 'none';
  },

  handleStudentLogin() {
    const studentId = (document.getElementById('auth-student-id')?.value || '').trim();
    const pin = (document.getElementById('auth-student-pin')?.value || '').trim();

    if (!studentId || studentId.length !== 5) {
      alert('กรุณากรอกรหัสนักเรียน 5 หลักให้ถูกต้อง');
      return;
    }
    if (!pin) {
      alert('กรุณากรอกรหัส PIN 6 หลัก');
      return;
    }

    const res = Store.verifyStudentLogin(studentId, pin);
    if (res.success) {
      this.checkAuth();
      alert(`🎉 ยินดีต้อนรับ ${res.user.name} เข้าสู่ระบบ MusicSmart`);
    } else {
      alert(res.message);
    }
  },

  handleStudentRegisterPin() {
    const studentId = (document.getElementById('auth-student-id')?.value || '').trim();
    const newPin = (document.getElementById('auth-student-new-pin')?.value || '').trim();
    const confirmPin = (document.getElementById('auth-student-confirm-pin')?.value || '').trim();

    if (!studentId || studentId.length !== 5) {
      alert('กรุณากรอกรหัสนักเรียน 5 หลักให้ถูกต้อง');
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      alert('กรุณาตั้งรหัส PIN เป็นตัวเลข 6 หลัก (0-9)');
      return;
    }
    if (newPin !== confirmPin) {
      alert('รหัส PIN ทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    const res = Store.registerStudentPin(studentId, newPin);
    if (res.success) {
      this.checkAuth();
      alert(`🎉 ตั้งรหัส PIN 6 หลักสำเร็จแล้ว!\nยินดีต้อนรับ ${res.user.name} เข้าสู่บทเรียนดนตรี`);
    } else {
      alert(res.message);
    }
  },

  handleTeacherLogin() {
    const email = (document.getElementById('auth-teacher-email')?.value || '').trim();
    const secret = (document.getElementById('auth-teacher-secret')?.value || '').trim();

    if (!email) {
      alert('กรุณากรอกอีเมลครูผู้สอน');
      return;
    }
    if (!secret) {
      alert('กรุณากรอกรหัสผ่านหรือรหัส PIN');
      return;
    }

    const res = Store.verifyTeacherLogin(email, secret);
    if (res.success) {
      this.checkAuth();
      alert(`👨‍🏫 ยินดีต้อนรับ ${res.user.name} เข้าสู่ห้องปฏิบัติการครู`);
    } else {
      alert(res.message);
    }
  },

  handleLogout() {
    const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
    const name = user ? user.name : 'ผู้ใช้งาน';
    if (confirm(`ต้องการออกจากระบบ (${name}) หรือไม่?`)) {
      Store.logout();
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
    setVal('setting-teacher-email', teacherAcc.email || 'music@ppk.ac.th');
    setVal('setting-teacher-secret', teacherAcc.secret || 'ppk1234');

    this.populatePinResetControls();

    const modal = document.getElementById('modal-app-settings');
    if (modal) modal.classList.add('active');
  },

  populatePinResetControls() {
    const classSel = document.getElementById('setting-pin-reset-class');
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
    const studentSel = document.getElementById('setting-pin-reset-student');
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
    const studentSel = document.getElementById('setting-pin-reset-student');
    const studentId = studentSel ? studentSel.value : null;
    if (!studentId) {
      alert('กรุณาเลือกนักเรียนที่ต้องการรีเซ็ต PIN');
      return;
    }
    const studentInfo = Store.getStudentById(studentId);
    const name = studentInfo ? `${studentInfo.prefix}${studentInfo.first_name} ${studentInfo.last_name}` : studentId;
    if (confirm(`ยืนยันการรีเซ็ตรหัส PIN ของ ${name} (รหัส ${studentId}) หรือไม่?\nเมื่อรีเซ็ตแล้ว นักเรียนจะสามารถเข้าสู่ระบบและตั้ง PIN 6 หลักใหม่ได้ด้วยตนเอง`)) {
      const res = Store.resetStudentPin(studentId);
      alert(res.message);
      const classSel = document.getElementById('setting-pin-reset-class');
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
        email: teacherEmail || 'music@ppk.ac.th',
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
        pill.innerHTML = `
          <div class="today-slot-time">คาบที่ ${slot.periodNo} (${slot.time})</div>
          <div class="today-slot-class">${this.escapeHtml(slot.className)} <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-muted);">(${slot.subjCode || 'ดนตรีสากล'})</span></div>
          <div style="font-size: 0.72rem; color: var(--ppk-navy); font-weight: 600; margin-top: 2px;">ห้อง ${slot.room || 'อส.5'}</div>
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
    this.state.role = role;
    if (save) Store.setActiveRole(role);

    const btnTeacher = document.getElementById('btn-role-teacher');
    const btnStudent = document.getElementById('btn-role-student');
    const headerMiddle = document.getElementById('header-middle-teacher');
    const teacherActions = document.getElementById('teacher-actions-group');
    const studentActions = document.getElementById('student-actions-group');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCockpit = document.getElementById('view-cockpit');
    const viewStudent = document.getElementById('view-student');

    if (role === 'student') {
      if (btnTeacher) btnTeacher.classList.remove('active');
      if (btnStudent) btnStudent.classList.add('active');
      if (headerMiddle) headerMiddle.style.display = 'none';
      if (teacherActions) teacherActions.style.display = 'none';
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
            App.switchTab('evaluation');
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
    const className = this.state.studentClass;
    const studentId = this.state.studentId;
    const students = Store.getStudents(className);
    const student = students.find(s => s.student_id === studentId) || students[0];
    if (!student) return;

    this.state.studentId = student.student_id;

    // 1. Update Student Profile Bar
    const nameEl = document.getElementById('student-portal-name');
    const idEl = document.getElementById('student-portal-id');
    const classEl = document.getElementById('student-portal-class');
    const noEl = document.getElementById('student-portal-no');
    const subjEl = document.getElementById('student-portal-subject');
    const statusBadge = document.getElementById('student-portal-status-badge');

    if (nameEl) nameEl.textContent = `${student.prefix}${student.first_name} ${student.last_name} (${student.nickname || '-'})`;
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
      todos.push({
        period: this.state.studentPeriod,
        title: `แบบฝึกหัดคาบที่ ${this.state.studentPeriod}`,
        subtitle: curSub ? 'ส่งงานเรียบร้อยแล้ว' : 'ส่งคำตอบในหน้าบทเรียนนี้',
        status: curSub ? 'done' : 'pending',
        statusLabel: curSub ? 'ส่งแล้ว ✅' : 'รอส่ง ⏳',
        statusClass: curSub ? 'badge-success' : 'badge-warning'
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
    const lesson = Store.getLesson(gradeKey, this.state.studentPeriod);
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
      if (lesson) {
        let html = `
          <div style="margin-bottom: 1rem;">
            <strong style="color: var(--ppk-navy);">หน่วยการเรียนรู้ที่ ${lesson.unit_no}:</strong> ${this.escapeHtml(lesson.unit_name)}
          </div>
          <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
            <div style="font-weight: 600; color: var(--ppk-navy-dark); margin-bottom: 0.35rem;">จุดประสงค์การเรียนรู้ (K-P-A):</div>
            <ul style="padding-left: 1.25rem; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">
              <li><strong>ความรู้ (K):</strong> ${this.escapeHtml(lesson.kpa?.k || '-')}</li>
              <li><strong>ทักษะกระบวนการ (P):</strong> ${this.escapeHtml(lesson.kpa?.p || '-')}</li>
              <li><strong>คุณลักษณะอันพึงประสงค์ (A):</strong> ${this.escapeHtml(lesson.kpa?.a || '-')}</li>
            </ul>
          </div>
        `;

        if (lesson.steps && lesson.steps.length > 0) {
          html += `<div style="font-weight: 600; color: var(--ppk-navy-dark); margin-bottom: 0.5rem;">กิจกรรมการเรียนรู้:</div>`;
          lesson.steps.forEach(st => {
            html += `
              <div style="margin-bottom: 0.65rem; padding-left: 0.5rem; border-left: 3px solid var(--ppk-blue);">
                <div style="font-weight: 600; font-size: 0.88rem; color: var(--ppk-navy);">${this.escapeHtml(st.phase)}</div>
                <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 2px;">${this.escapeHtml(st.desc)}</div>
              </div>
            `;
          });
        }

        if (lesson.mentor_tips) {
          html += `
            <div style="margin-top: 1rem; padding: 0.75rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); font-size: 0.85rem; color: #92400e;">
              ${this.escapeHtml(lesson.mentor_tips)}
            </div>
          `;
        }

        lessonTextEl.innerHTML = html;
      } else {
        lessonTextEl.innerHTML = `<p style="color: var(--text-muted);">กำลังจัดเตรียมแผนการเรียนรู้สำหรับคาบนี้</p>`;
      }
    }

    if (promptEl) {
      if (lesson?.assessment?.rubrics && lesson.assessment.rubrics.length > 0) {
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
      if (timestampEl) timestampEl.innerHTML = `<span style="color: #16a34a; font-weight: 600;">✅ ส่งงานสำเร็จเมื่อ: ${sub.submittedAt}</span>`;
      if (statusChipEl) {
        statusChipEl.innerHTML = `<span class="badge-success" style="font-size: 0.82rem; padding: 4px 10px; border-radius: 9999px;">ส่งงานแล้ว</span>`;
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

      quizActionButtons.innerHTML = btnsHtml;
    }
  },

  handleStudentSubmit() {
    const textInput = document.getElementById('student-submission-text');
    const urlInput = document.getElementById('student-submission-url');
    const content = textInput ? textInput.value.trim() : '';
    const url = urlInput ? urlInput.value.trim() : '';

    if (!content && !url) {
      alert('กรุณาพิมพ์คำตอบหรือใส่ลิงก์ผลงานก่อนกดส่งงานครับ');
      return;
    }

    Store.saveStudentSubmission(
      this.state.studentClass,
      this.state.studentPeriod,
      this.state.studentId,
      {
        submissionType: url ? 'mixed' : 'text',
        content,
        url
      }
    );

    alert(`🎉 ส่งงานประจำคาบที่ ${this.state.studentPeriod} เรียบร้อยแล้วครับ!`);
    this.renderStudentPortal();
  },
  updateInstructorBadge() {
    const inst = Store.getInstructor();
    const roleEl = document.getElementById('badge-instructor-role');
    const nameEl = document.getElementById('badge-instructor-name');
    if (roleEl) roleEl.textContent = inst.role;
    if (nameEl) nameEl.textContent = inst.name;
  },

  openInstructorModal() {
    const inst = Store.getInstructor();
    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const mentorNameEl = document.getElementById('modal-instructor-mentor-name');
    if (mentorNameEl && settings && settings.teacherName) {
      mentorNameEl.textContent = settings.teacherName;
    }
    const isMentor = inst.role === 'ครูประจำวิชา';
    document.getElementById('check-mentor').style.display = isMentor ? 'inline' : 'none';
    document.getElementById('check-trainee').style.display = !isMentor ? 'inline' : 'none';

    if (!isMentor && inst.name) {
      document.getElementById('input-trainee-name').value = inst.name;
    }
    document.getElementById('modal-instructor').classList.add('active');
  },

  closeInstructorModal() {
    document.getElementById('modal-instructor').classList.remove('active');
  },

  selectInstructorRole(role) {
    if (role === 'ครูประจำวิชา') {
      const s = Store.getAppSettings ? Store.getAppSettings() : null;
      const defaultTeacher = (s && s.teacherName) || 'คุณครูพงศธร โพธิแก้ว';
      Store.setInstructor('ครูประจำวิชา', defaultTeacher);
    } else {
      const traineeName = document.getElementById('input-trainee-name').value.trim() || 'คุณครูฝึกสอน';
      Store.setInstructor('ครูฝึกสอน', traineeName);
    }
    this.updateInstructorBadge();
    this.closeInstructorModal();
    if (this.state.selectedClass) {
      this.updateCockpitHeader();
    }
  },

  updateTraineeName(name) {
    const inst = Store.getInstructor();
    if (inst.role === 'ครูฝึกสอน') {
      Store.setInstructor('ครูฝึกสอน', name);
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
            ${sub.url ? `<div style="margin-top: 6px;"><a href="${this.escapeHtml(sub.url)}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline;">🔗 เปิดลิงก์ผลงานของนักเรียน</a></div>` : ''}
            <div style="font-size: 0.72rem; color: #059669; margin-top: 6px;">ส่งเมื่อ: ${this.escapeHtml(sub.submittedAt)}</div>
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
  },

  saveStudentFeedback(className, period, studentId) {
    const textEl = document.getElementById(`feedback-text-${studentId}`);
    const scoreEl = document.getElementById(`feedback-score-${studentId}`);
    const feedbackText = textEl ? textEl.value.trim() : '';
    const scoreVal = scoreEl ? scoreEl.value : null;

    Store.saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, scoreVal);
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
              <div class="tt-cell-box" style="cursor: pointer;" onclick="App.enterCockpit('${currentVal}', 1); App.closeTimetableModal();" title="แตะเพื่อเข้าห้องเรียน ${currentVal}">
                <div class="tt-subj">${subj}</div>
                <div class="tt-class">${shortClass}</div>
                <div class="tt-room">อส.5</div>
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
          tbody += `<td class="${isDivider ? 'break-divider-col' : ''}">${selectHtml}</td>`;
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
