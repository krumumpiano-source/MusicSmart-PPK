// ==========================================================================
// Interactive Quiz Engine with Dynamic Anti-Cheating Randomizer (สุ่มข้อ & สลับตัวเลือก)
// ระบบทำแบบทดสอบออนไลน์ตามพิมพ์เขียว 40 ข้อ • สาระการเรียนรู้ศิลปะ (ดนตรี) โรงเรียนพะเยาพิทยาคม
// ==========================================================================

const QuizEngine = {
  settings: {
    shuffleQuestions: true,
    shuffleChoices: true
  },

  state: {
    unitNo: 1,
    studentId: null,
    currentQuestionIndex: 0,
    answers: {}, // questionIndex (0-9) -> assignedKey ('ก' | 'ข' | 'ค' | 'ง')
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,
    submitted: false,
    lastResult: null,
    sessionQuestions: [] // Shuffled questions & choices for this active session
  },

  init() {
    this.loadSettings();
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem('ppk_quiz_settings');
      if (raw) {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load quiz settings:', e);
    }
  },

  saveSettings() {
    try {
      localStorage.setItem('ppk_quiz_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save quiz settings:', e);
    }
  },

  toggleShuffle() {
    const isShuffleActive = !(this.settings.shuffleQuestions && this.settings.shuffleChoices);
    this.settings.shuffleQuestions = isShuffleActive;
    this.settings.shuffleChoices = isShuffleActive;
    this.saveSettings();

    if (!this.state.submitted) {
      if (confirm(`สลับโหมดการสุ่มข้อและตัวเลือกเป็น: ${isShuffleActive ? 'เปิดใช้งาน (Anti-Cheating ON)' : 'ปิดการสุ่ม (ตามลำดับมาตรฐาน)'}\nระบบจะเริ่มชุดข้อสอบใหม่ตามการตั้งค่านี้ ต้องการดำเนินการหรือไม่?`)) {
        this.clearActiveSession(this.state.studentId, this.state.unitNo);
        const unitData = this.getCurrentUnit();
        this.state.sessionQuestions = this.generateSessionQuestions(unitData);
        this.state.answers = {};
        this.state.currentQuestionIndex = 0;
        this.state.elapsedSeconds = 0;
        this.state.startTime = Date.now();
        this.saveActiveSession();
        this.renderQuizUI();
      }
    } else {
      this.renderQuizUI();
    }
  },

  // Fisher-Yates array shuffle algorithm
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Generate randomized session questions and randomized choices with 100% accurate key mapping
  generateSessionQuestions(unit) {
    const KEYS = ['ก', 'ข', 'ค', 'ง'];
    let rawQuestions = JSON.parse(JSON.stringify(unit.questions || []));

    // 1. Shuffle Questions if enabled
    if (this.settings.shuffleQuestions) {
      rawQuestions = this.shuffleArray(rawQuestions);
    }

    // 2. Shuffle Choices for each question if enabled
    return rawQuestions.map((q, qIdx) => {
      let choices = (q.choices || []).map(c => ({
        text: c.text,
        originalKey: c.key,
        isCorrect: (c.key === q.correct)
      }));

      if (this.settings.shuffleChoices) {
        choices = this.shuffleArray(choices);
      }

      let sessionCorrectKey = null;
      const mappedChoices = choices.map((c, cIdx) => {
        const assignedKey = KEYS[cIdx] || c.originalKey;
        if (c.isCorrect) {
          sessionCorrectKey = assignedKey;
        }
        return {
          key: assignedKey,
          text: c.text,
          originalKey: c.originalKey,
          isCorrect: c.isCorrect
        };
      });

      return {
        displayNo: qIdx + 1,
        id: q.id,
        originalNo: q.no,
        question: q.question,
        bloom: q.bloom,
        explanation: q.explanation,
        choices: mappedChoices,
        sessionCorrect: sessionCorrectKey,
        originalCorrect: q.correct
      };
    });
  },

  openQuizModal(unitNo = 1, studentId = null) {
    this.loadSettings();
    const modal = document.getElementById('modal-quiz');
    if (!modal) return;

    if (!studentId && typeof App !== 'undefined') {
      studentId = App.state.studentId;
    }
    studentId = studentId || (typeof Store !== 'undefined' && Store.getCurrentUser() && Store.getCurrentUser().studentId) || '';

    const unitData = QUIZZES_DATA.units.find(u => u.unit_no === parseInt(unitNo, 10));
    if (!unitData) {
      alert('ไม่พบข้อมูลแบบทดสอบสำหรับหน่วยนี้');
      return;
    }

    this.state.unitNo = unitNo;
    this.state.studentId = studentId;

    // Check if student already has a recorded attempt
    const existing = this.getStudentAttempt(this.state.studentId, unitNo);
    if (existing && existing.submitted) {
      this.state.submitted = true;
      this.state.lastResult = existing;
      this.state.sessionQuestions = existing.sessionQuestions || this.generateSessionQuestions(unitData);
      this.state.currentQuestionIndex = 0;
      this.state.answers = {};
      this.state.elapsedSeconds = existing.timeSpentSeconds || 0;
    } else {
      // Check if there is an in-progress unsubmitted session to prevent resetting on page reload
      const savedSession = this.getActiveSession(this.state.studentId, unitNo);
      if (savedSession && savedSession.sessionQuestions && savedSession.sessionQuestions.length > 0) {
        this.state.sessionQuestions = savedSession.sessionQuestions;
        this.state.answers = savedSession.answers || {};
        this.state.currentQuestionIndex = savedSession.currentQuestionIndex || 0;
        this.state.elapsedSeconds = savedSession.elapsedSeconds || 0;
        this.state.submitted = false;
        this.state.lastResult = null;
      } else {
        // Generate a fresh attempt with randomized questions & choices
        this.state.sessionQuestions = this.generateSessionQuestions(unitData);
        this.state.answers = {};
        this.state.currentQuestionIndex = 0;
        this.state.elapsedSeconds = 0;
        this.state.submitted = false;
        this.state.lastResult = null;
        this.saveActiveSession();
      }
    }

    this.state.startTime = Date.now() - (this.state.elapsedSeconds * 1000);
    modal.classList.add('active');
    this.startTimer();
    this.renderQuizUI();
  },

  closeQuizModal() {
    this.stopTimer();
    this.saveActiveSession();
    const modal = document.getElementById('modal-quiz');
    if (modal) modal.classList.remove('active');
  },

  startTimer() {
    this.stopTimer();
    if (this.state.submitted) {
      const timerEl = document.getElementById('quiz-timer-display');
      if (timerEl && this.state.lastResult) {
        const mins = String(Math.floor(this.state.lastResult.timeSpentSeconds / 60)).padStart(2, '0');
        const secs = String(this.state.lastResult.timeSpentSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
      }
      return;
    }

    this.state.timerInterval = setInterval(() => {
      this.state.elapsedSeconds++;
      const timerEl = document.getElementById('quiz-timer-display');
      if (timerEl) {
        const mins = String(Math.floor(this.state.elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(this.state.elapsedSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
      }
    }, 1000);
  },

  stopTimer() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  },

  getCurrentUnit() {
    return QUIZZES_DATA.units.find(u => u.unit_no === parseInt(this.state.unitNo, 10)) || QUIZZES_DATA.units[0];
  },

  renderQuizUI() {
    if (typeof document === 'undefined') return;
    const unit = this.getCurrentUnit();
    const questions = (this.state.sessionQuestions && this.state.sessionQuestions.length > 0)
      ? this.state.sessionQuestions
      : unit.questions;

    const titleEl = document.getElementById('quiz-modal-title');
    const subtitleEl = document.getElementById('quiz-modal-subtitle');
    const container = document.getElementById('quiz-question-container');
    const navPills = document.getElementById('quiz-question-pills');
    const toggleEl = document.getElementById('quiz-anti-cheat-toggle');

    if (titleEl) titleEl.textContent = unit.title;
    if (subtitleEl) {
      const isRandomized = this.settings.shuffleQuestions && this.settings.shuffleChoices;
      subtitleEl.textContent = `แบบทดสอบท้ายหน่วยการเรียนรู้ที่ ${unit.unit_no} (10 ข้อ 10 คะแนน) • อิงพิมพ์เขียว Test Blueprint ${isRandomized ? '• สุ่มข้อและสลับตัวเลือกป้องกันการคัดลอก' : ''}`;
    }

    // Update Anti-Cheat Toggle Pill
    if (toggleEl) {
      const isRandomized = this.settings.shuffleQuestions && this.settings.shuffleChoices;
      toggleEl.className = `quiz-anti-cheat-pill ${isRandomized ? 'active' : 'off'}`;
      toggleEl.innerHTML = isRandomized
        ? '<span>🎲 สุ่มข้อ &amp; สลับตัวเลือก: <strong>เปิด (Anti-Cheat ON)</strong></span>'
        : '<span>🔒 ลำดับข้อสอบมาตรฐาน: <strong>เรียงตามเดิม (OFF)</strong></span>';
    }

    // Render Pills
    if (navPills) {
      navPills.innerHTML = '';
      questions.forEach((q, idx) => {
        const pill = document.createElement('button');
        const isAnswered = this.state.answers[idx] !== undefined;
        const isCurrent = idx === this.state.currentQuestionIndex;

        let pillClass = 'quiz-nav-pill';
        if (isCurrent) pillClass += ' active';
        if (isAnswered) pillClass += ' answered';

        if (this.state.submitted && this.state.lastResult) {
          const isCorrect = this.state.lastResult.details[idx]?.isCorrect;
          pillClass += isCorrect ? ' correct' : ' wrong';
        }

        pill.className = pillClass;
        pill.textContent = idx + 1;
        pill.onclick = () => this.goToQuestion(idx);
        navPills.appendChild(pill);
      });
    }

    if (!container) return;

    if (this.state.submitted && this.state.lastResult) {
      this.renderResultReview(container, unit);
      return;
    }

    // Render Active Question
    const q = questions[this.state.currentQuestionIndex];
    if (!q) return;

    const selectedChoice = this.state.answers[this.state.currentQuestionIndex];
    const isRandomized = this.settings.shuffleQuestions && this.settings.shuffleChoices;

    container.innerHTML = `
      <div class="quiz-card-box">
        <div class="quiz-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="quiz-q-badge">ข้อที่ ${q.displayNo || (this.state.currentQuestionIndex + 1)} จาก ${questions.length}</span>
            <span class="quiz-bloom-tag">${this.escapeHtml(q.bloom || 'ความรู้ความจำ')}</span>
            ${isRandomized ? `<span class="quiz-random-tag" title="ข้อและตัวเลือกสุ่มเรียงลำดับเฉพาะรายบุคคล">🎲 ป้องกันการคัดลอก</span>` : ''}
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${q.id || ''}</span>
        </div>

        <div class="quiz-q-text">
          ${this.escapeHtml(q.question)}
        </div>

        <div class="quiz-choices-list">
          ${q.choices.map(c => `
            <div class="quiz-choice-item ${selectedChoice === c.key ? 'selected' : ''}" onclick="QuizEngine.selectChoice('${c.key}')">
              <div class="choice-key-circle">${c.key}</div>
              <div class="choice-text-label">${this.escapeHtml(c.text)}</div>
            </div>
          `).join('')}
        </div>

        <div class="quiz-action-bar">
          <button class="btn-nav-action" onclick="QuizEngine.prevQuestion()" ${this.state.currentQuestionIndex === 0 ? 'disabled' : ''}>
            ◀ ข้อก่อนหน้า
          </button>

          <div style="font-size: 0.85rem; color: var(--text-muted);">
            ตอบแล้ว ${Object.keys(this.state.answers).length} / ${questions.length} ข้อ
          </div>

          ${this.state.currentQuestionIndex < questions.length - 1 ? `
            <button class="btn-nav-action primary" onclick="QuizEngine.nextQuestion()">
              ข้อถัดไป ▶
            </button>
          ` : `
            <button class="btn-nav-action primary" style="background: #16a34a; border-color: #16a34a;" onclick="QuizEngine.confirmSubmit()">
              ส่งแบบทดสอบ ✅
            </button>
          `}
        </div>
      </div>
    `;
  },

  selectChoice(key) {
    if (this.state.submitted) return;
    this.state.answers[this.state.currentQuestionIndex] = key;
    this.saveActiveSession();
    this.renderQuizUI();
  },

  goToQuestion(idx) {
    this.state.currentQuestionIndex = idx;
    this.saveActiveSession();
    this.renderQuizUI();
  },

  prevQuestion() {
    if (this.state.currentQuestionIndex > 0) {
      this.state.currentQuestionIndex--;
      this.saveActiveSession();
      this.renderQuizUI();
    }
  },

  nextQuestion() {
    const questions = this.state.sessionQuestions.length > 0 ? this.state.sessionQuestions : this.getCurrentUnit().questions;
    if (this.state.currentQuestionIndex < questions.length - 1) {
      this.state.currentQuestionIndex++;
      this.saveActiveSession();
      this.renderQuizUI();
    }
  },

  confirmSubmit() {
    const questions = this.state.sessionQuestions.length > 0 ? this.state.sessionQuestions : this.getCurrentUnit().questions;
    const answeredCount = Object.keys(this.state.answers).length;
    const total = questions.length;

    if (answeredCount < total) {
      if (!confirm(`คุณยังตอบไม่ครบ (ตอบแล้ว ${answeredCount}/${total} ข้อ) ต้องการส่งแบบทดสอบทันทีหรือไม่?`)) {
        return;
      }
    } else {
      if (!confirm('ยืนยันการส่งแบบทดสอบ? หลังจากส่งแล้วระบบจะตรวจคำตอบและบันทึกคะแนนทันที')) {
        return;
      }
    }

    this.submitQuiz();
  },

  submitQuiz() {
    this.stopTimer();
    const unit = this.getCurrentUnit();
    const questions = this.state.sessionQuestions.length > 0 ? this.state.sessionQuestions : unit.questions;
    let score = 0;
    const details = [];

    questions.forEach((q, idx) => {
      const chosen = this.state.answers[idx] || null;
      const isCorrect = (chosen === q.sessionCorrect);
      if (isCorrect) score++;

      const chosenChoice = q.choices.find(c => c.key === chosen);
      const correctChoice = q.choices.find(c => c.key === q.sessionCorrect);

      details.push({
        questionId: q.id,
        displayNo: q.displayNo || (idx + 1),
        originalNo: q.originalNo,
        question: q.question,
        chosen: chosen,
        chosenText: chosenChoice ? chosenChoice.text : null,
        correct: q.sessionCorrect,
        correctText: correctChoice ? correctChoice.text : null,
        isCorrect: isCorrect,
        bloom: q.bloom,
        explanation: q.explanation,
        choices: q.choices
      });
    });

    const isRandomized = this.settings.shuffleQuestions && this.settings.shuffleChoices;
    const result = {
      unitNo: unit.unit_no,
      studentId: this.state.studentId,
      score: score,
      maxScore: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      timeSpentSeconds: this.state.elapsedSeconds,
      submittedAt: new Date().toLocaleString('th-TH'),
      submitted: true,
      shuffled: isRandomized,
      sessionQuestions: questions,
      details: details
    };

    this.state.submitted = true;
    this.state.lastResult = result;

    // Clear active temporary session once submitted
    this.clearActiveSession(this.state.studentId, unit.unit_no);

    // Save final attempt to persistent store
    this.saveStudentAttempt(this.state.studentId, unit.unit_no, result);

    // Automatically update student's Gradebook K score if active in Teacher role
    if (typeof Store !== 'undefined' && Store.saveStudentQuizGrade) {
      Store.saveStudentQuizGrade(this.state.studentId, unit.unit_no, score);
    }

    this.renderQuizUI();
  },

  renderResultReview(container, unit) {
    const res = this.state.lastResult;
    const mins = Math.floor(res.timeSpentSeconds / 60);
    const secs = res.timeSpentSeconds % 60;

    const activeRole = (typeof Store !== 'undefined' && Store.getActiveRole) 
      ? Store.getActiveRole() 
      : ((typeof App !== 'undefined' && App.state?.role) ? App.state.role : 'teacher');
    const isStudent = (activeRole === 'student');

    let gradeBadgeColor = '#16a34a';
    let gradeLabel = 'ผ่านเกณฑ์ระดับยอดเยี่ยม';
    if (res.percentage < 50) {
      gradeBadgeColor = '#dc2626';
      gradeLabel = 'ไม่ผ่านเกณฑ์ (ควรสอบซ่อมเสริม)';
    } else if (res.percentage < 70) {
      gradeBadgeColor = '#d97706';
      gradeLabel = 'ผ่านเกณฑ์ระดับพอใช้';
    }

    container.innerHTML = `
      <div class="quiz-result-summary-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.9rem; color: var(--text-muted);">ผลการประเมินท้ายหน่วยที่ ${res.unitNo}</div>
            <div style="font-size: 2.2rem; font-weight: 800; color: var(--ppk-navy-dark); line-height: 1.1; margin-top: 4px;">
              ${res.score} <span style="font-size: 1.2rem; font-weight: 600; color: var(--text-muted);">/ ${res.maxScore} คะแนน</span>
            </div>
            <div style="margin-top: 6px; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="badge" style="background: ${gradeBadgeColor}; color: #ffffff; padding: 4px 12px; font-size: 0.85rem; border-radius: 9999px;">
                ${gradeLabel} (${res.percentage}%)
              </span>
              ${res.shuffled ? `
                <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; font-size: 0.78rem; border-radius: 9999px;">
                  🎲 สุ่มข้อ & สลับตัวเลือกเรียบร้อย (Anti-Cheating Verified)
                </span>
              ` : ''}
            </div>
          </div>

          <div style="text-align: right; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
            <div>⏱ ใช้เวลา: ${mins} นาที ${secs} วินาที</div>
            <div>📅 วันที่ส่ง: ${res.submittedAt}</div>
            <div style="margin-top: 0.5rem;">
              <button class="btn-nav-action" onclick="QuizEngine.retakeQuiz(${res.unitNo})">ทำแบบทดสอบซ้ำ (สุ่มชุดใหม่ 🎲)</button>
            </div>
          </div>
        </div>
      </div>

      ${isStudent ? `
        <!-- Student Confidential View: Hide answer keys to prevent leaking to peers -->
        <div class="quiz-student-security-box" style="margin-top: 1.5rem; padding: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: var(--radius-md); text-align: center;">
          <div style="width: 52px; height: 52px; margin: 0 auto 0.75rem auto; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">
            🔒
          </div>
          <div style="font-weight: 700; font-size: 1.1rem; color: var(--ppk-navy-dark); margin-bottom: 0.35rem;">
            บันทึกผลคะแนนเข้าสู่ระบบเรียบร้อยแล้ว
          </div>
          <div style="font-size: 0.88rem; color: var(--text-secondary); max-width: 540px; margin: 0 auto; line-height: 1.6;">
            คะแนนของคุณได้รับการบันทึกเข้าสู่สมุดประเมินผล ปพ.5 ของคุณครูเรียบร้อยแล้ว<br>
            <span style="color: #0369a1; font-weight: 600;">🔒 ระบบสงวนการแสดงเฉลยคำตอบ</span> เพื่อป้องกันการส่งต่อเฉลย และรักษาความเที่ยงตรง เป็นธรรมในการวัดผลตามมาตรฐานการทดสอบดิจิทัล (คุณครูผู้สอนจะทำการเฉลยและสรุปบทเรียนร่วมกันในชั้นเรียน)
          </div>
        </div>
      ` : `
        <!-- Teacher View: Full Academic Review & Rationale -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--ppk-navy-dark); margin: 0;">
            เฉลยคำตอบพร้อมคำอธิบายทางวิชาการ (Academic Rationale)
          </h4>
          <span style="font-size: 0.78rem; font-weight: 600; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px;">
            👤 สิทธิ์ครูผู้สอน: แสดงเฉลยละเอียด
          </span>
        </div>

        <div class="quiz-review-list">
          ${res.details.map((d) => `
            <div class="quiz-review-item ${d.isCorrect ? 'correct' : 'wrong'}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--ppk-navy);">
                  ข้อที่ ${d.displayNo}. ${d.isCorrect ? '✅ ถูกต้อง' : '❌ ผิด'} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">(${d.questionId})</span>
                </div>
                <span class="quiz-bloom-tag">${this.escapeHtml(d.bloom)}</span>
              </div>
              <div style="font-size: 0.92rem; color: var(--text-primary); margin-bottom: 0.65rem;">
                ${this.escapeHtml(d.question)}
              </div>
              <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
                <span style="color: ${d.isCorrect ? '#16a34a' : '#dc2626'}; font-weight: 600;">
                  คำตอบของนักเรียน: ${d.chosen ? `ข้อ ${d.chosen}. ${this.escapeHtml(d.chosenText || '')}` : 'ไม่ได้ตอบ'}
                </span>
                ${!d.isCorrect ? `
                  <div style="color: #16a34a; font-weight: 600; margin-top: 0.25rem;">
                    เฉลยที่ถูกต้อง: ข้อ ${d.correct}. ${this.escapeHtml(d.correctText || '')}
                  </div>
                ` : ''}
              </div>
              <div class="quiz-explanation-box">
                💡 <strong>เหตุผลทางวิชาการ:</strong> ${this.escapeHtml(d.explanation)}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  },

  retakeQuiz(unitNo) {
    if (confirm('คุณต้องการทำแบบทดสอบใหม่อีกครั้งหรือไม่? ระบบจะสุ่มลำดับข้อสอบและสลับตัวเลือกใหม่ทั้งหมด')) {
      const unitData = QUIZZES_DATA.units.find(u => u.unit_no === parseInt(unitNo, 10));
      this.clearActiveSession(this.state.studentId, unitNo);
      this.state.sessionQuestions = this.generateSessionQuestions(unitData);
      this.state.submitted = false;
      this.state.lastResult = null;
      this.state.answers = {};
      this.state.currentQuestionIndex = 0;
      this.state.elapsedSeconds = 0;
      this.state.startTime = Date.now();
      this.saveActiveSession();
      this.startTimer();
      this.renderQuizUI();
    }
  },

  // Active Session Persistence (Prevents mid-test reset on accidental reload)
  getActiveSessionKey(studentId, unitNo) {
    return `music_quiz_active_session_${studentId}_u${unitNo}`;
  },

  getActiveSession(studentId, unitNo) {
    try {
      const raw = localStorage.getItem(this.getActiveSessionKey(studentId, unitNo));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  saveActiveSession() {
    if (this.state.submitted) return;
    try {
      const sessionData = {
        unitNo: this.state.unitNo,
        studentId: this.state.studentId,
        sessionQuestions: this.state.sessionQuestions,
        answers: this.state.answers,
        currentQuestionIndex: this.state.currentQuestionIndex,
        elapsedSeconds: this.state.elapsedSeconds,
        timestamp: Date.now()
      };
      localStorage.setItem(this.getActiveSessionKey(this.state.studentId, this.state.unitNo), JSON.stringify(sessionData));
    } catch (e) {}
  },

  clearActiveSession(studentId, unitNo) {
    try {
      localStorage.removeItem(this.getActiveSessionKey(studentId, unitNo));
    } catch (e) {}
  },

  // Final Submitted Attempt Persistence
  getStorageKey(studentId, unitNo) {
    return `music_quiz_${studentId}_u${unitNo}`;
  },

  getStudentAttempt(studentId, unitNo) {
    try {
      const raw = localStorage.getItem(this.getStorageKey(studentId, unitNo));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  saveStudentAttempt(studentId, unitNo, result) {
    try {
      localStorage.setItem(this.getStorageKey(studentId, unitNo), JSON.stringify(result));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuizEngine;
}
