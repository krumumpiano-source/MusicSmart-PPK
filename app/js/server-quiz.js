// ==========================================================================
// MusicSmart • แบบทดสอบที่ตรวจบนเซิร์ฟเวอร์ (มือถือนักเรียน)
// เครื่องนักเรียนได้รับเฉพาะคำถาม/ตัวเลือก (ไม่มีเฉลย) ส่งคำตอบ -> Apps Script ตรวจและบันทึกคะแนน
// ออฟไลน์: คำตอบรอในคิว (StudentOutbox) แล้วตรวจเมื่อส่งได้ • practice = แบบฝึก ไม่นับคะแนน
// ==========================================================================
const ServerQuiz = {
  CACHE_PREFIX: 'ppk_quiz_cache_u',
  state: { unitNo: 1, practice: false, quiz: null, startedAt: 0 },

  shouldUse() { return typeof StudentOutbox !== 'undefined' && StudentOutbox.isActive(); },
  taskKey(unitNo, practice) { return practice ? `p:u${unitNo}` : StudentOutbox.quizKey(unitNo); },

  async load(unitNo) {
    const u = StudentOutbox.currentStudent();
    const cacheKey = this.CACHE_PREFIX + unitNo;
    if (u && StudentOutbox.sessionValid(u)) {
      try {
        const r = await StudentAuth._post({ action: 'studentQuizGet', sessionToken: u.sessionToken, unitNo: Number(unitNo) });
        if (r.status === 'success') {
          // ป้องกันไว้อีกชั้น: ตัดฟิลด์เฉลยทิ้งถ้ามี
          r.questions = (r.questions || []).map(q => ({ id: q.id, question: q.question, bloom: q.bloom || '', choices: (q.choices || []).map(c => ({ key: c.key, text: c.text })) }));
          localStorage.setItem(cacheKey, JSON.stringify(r));
          return r;
        }
        if (r.code === 'session_expired' || r.code === 'bad_session') { StudentOutbox.needsReauth = true; StudentOutbox.render(); return { error: 'reauth', message: r.message }; }
        return { error: r.code || 'error', message: r.message };
      } catch (e) { /* offline -> cache */ }
    } else if (u) {
      StudentOutbox.needsReauth = true; StudentOutbox.render();
    }
    try { const c = JSON.parse(localStorage.getItem(cacheKey) || 'null'); if (c) return Object.assign(c, { fromCache: true }); } catch (e) { /* ignore */ }
    return { error: 'offline', message: 'ยังโหลดแบบทดสอบไม่ได้ กรุณาต่ออินเทอร์เน็ตแล้วลองใหม่' };
  },

  _esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

  resultHtml(unitNo, practice) {
    const st = StudentOutbox.statusFor(this.taskKey(unitNo, practice));
    if (!st) return '';
    if (st.state === 'sent' && st.result) {
      return `<div style="padding:1.25rem;text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
        <div style="font-size:2rem;font-weight:800;color:#166534;">${st.result.score} / ${st.result.total}</div>
        <div style="color:#166534;font-weight:600;">${practice ? 'แบบฝึก (ไม่นับคะแนน)' : 'บันทึกคะแนนให้คุณครูแล้ว'} • ${st.result.percentage}%</div>
        <div style="font-size:0.82rem;color:#475569;margin-top:0.5rem;">🔒 ระบบไม่แสดงเฉลย คุณครูจะเฉลยในชั้นเรียน</div></div>`;
    }
    if (st.state === 'failed') return `<div style="padding:1rem;background:#fef2f2;border-radius:10px;color:#991b1b;font-weight:600;">${this._esc(st.label)} ${this._esc(st.message || '')}</div>`;
    return `<div style="padding:1rem;background:#fff7ed;border-radius:10px;color:#9a3412;font-weight:600;">⏳ ส่งคำตอบแล้ว รอตรวจ (ถ้าออฟไลน์ ระบบจะส่งให้อัตโนมัติเมื่อต่อเน็ต)</div>`;
  },

  async open(unitNo, opts = {}) {
    const practice = !!opts.practice;
    this.state = { unitNo: Number(unitNo), practice, quiz: null, startedAt: Date.now() };
    const modal = typeof document !== 'undefined' ? document.getElementById('modal-quiz') : null;
    const box = typeof document !== 'undefined' ? document.getElementById('quiz-question-container') : null;
    const title = typeof document !== 'undefined' ? document.getElementById('quiz-modal-title') : null;
    const pills = typeof document !== 'undefined' ? document.getElementById('quiz-question-pills') : null;
    if (modal) modal.classList.add('active');
    if (pills) pills.innerHTML = '';
    const prev = StudentOutbox.statusFor(this.taskKey(unitNo, practice));
    if (!practice && prev && prev.state !== 'failed') {
      if (title) title.textContent = `แบบทดสอบหน่วยที่ ${unitNo}`;
      if (box) box.innerHTML = this.resultHtml(unitNo, false);
      return { alreadySubmitted: true };
    }
    if (box) box.innerHTML = '<div style="padding:1rem;color:#64748b;">⏳ กำลังโหลดแบบทดสอบ...</div>';
    const quiz = await this.load(unitNo);
    if (quiz.error) { if (box) box.innerHTML = `<div style="padding:1rem;color:#b91c1c;font-weight:600;">⚠️ ${this._esc(quiz.message || 'โหลดไม่สำเร็จ')}</div>`; return quiz; }
    this.state.quiz = quiz;
    if (title) title.textContent = `${practice ? '🎯 แบบฝึก (ไม่นับคะแนน): ' : ''}${quiz.title || 'แบบทดสอบหน่วยที่ ' + unitNo}`;
    if (box) {
      box.innerHTML = quiz.questions.map((q, i) => `
        <div class="quiz-server-q" style="margin-bottom:1rem;padding:0.85rem;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="font-weight:700;margin-bottom:0.5rem;">${i + 1}. ${this._esc(q.question)}</div>
          ${q.choices.map(c => `<label style="display:block;padding:0.35rem 0;cursor:pointer;"><input type="radio" name="sq_${this._esc(q.id)}" value="${this._esc(c.key)}"> ${this._esc(c.key)}. ${this._esc(c.text)}</label>`).join('')}
        </div>`).join('') + `<button type="button" id="server-quiz-submit" class="btn-nav-action primary" style="width:100%;justify-content:center;">ส่งคำตอบ ✅</button>`;
      const btn = document.getElementById('server-quiz-submit');
      if (btn) btn.onclick = () => this.submitFromDom();
    }
    return quiz;
  },

  collectFromDom() {
    const answers = {};
    (this.state.quiz ? this.state.quiz.questions : []).forEach(q => {
      const el = document.querySelector(`input[name="sq_${CSS && CSS.escape ? CSS.escape(q.id) : q.id}"]:checked`);
      if (el) answers[q.id] = el.value;
    });
    return answers;
  },

  async submitFromDom() {
    const answers = this.collectFromDom();
    const total = this.state.quiz ? this.state.quiz.questions.length : 0;
    if (Object.keys(answers).length < total && !confirm(`ตอบแล้ว ${Object.keys(answers).length}/${total} ข้อ ต้องการส่งเลยหรือไม่?`)) return;
    await this.submit(answers);
    const box = document.getElementById('quiz-question-container');
    if (box) box.innerHTML = this.resultHtml(this.state.unitNo, this.state.practice);
  },

  async submit(answers) {
    const { unitNo, practice, startedAt } = this.state;
    StudentOutbox.enqueue('quiz_answers', this.taskKey(unitNo, practice), {
      unitNo, answers, practice, timeSpentSeconds: Math.round((Date.now() - (startedAt || Date.now())) / 1000)
    });
    await StudentOutbox.flush();
    return StudentOutbox.statusFor(this.taskKey(unitNo, practice));
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = ServerQuiz;
