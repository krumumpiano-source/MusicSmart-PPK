// ==========================================================================
// Interactive Matrix Rubric Scoring (ระบบประเมินรูบริก 4 ระดับคุณภาพ ระดับคุณภาพ 1-4 ตาม วก.5)
// สาระการเรียนรู้ศิลปะ (สาระดนตรี) • โรงเรียนพะเยาพิทยาคม
// ==========================================================================

const RubricMatrix = {
  activeStudent: null,
  activePeriod: 1,
  activeRubricDoc: null,
  selectedLevels: {}, // criterionIndex -> level (4, 3, 2, 1)
  activeRows: null,   // แถวเกณฑ์จาก วก.5 (WK5_PLANS) ถ้ามี: [{label, weight, dim, levels}]
  activeGrade: '',
  note: '',
  dirty: false,

  // Map period & grade to the appropriate official rubric document in ACADEMIC_DOCS_BY_GRADE[grade].eval
  getRubricForPeriod(period, grade = null) {
    const resolvedGrade = grade
      || Store.gradeKeyOf(this.activeStudent?.class)
      || (typeof App !== 'undefined' && App.state?.grade ? App.state.grade : '');

    const docsSource = (typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' && ACADEMIC_DOCS_BY_GRADE[resolvedGrade])
      ? ACADEMIC_DOCS_BY_GRADE[resolvedGrade]
      : (typeof ACADEMIC_DOCS !== 'undefined' ? ACADEMIC_DOCS : null);

    if (!docsSource || !docsSource.eval) return null;
    const evals = docsSource.eval;

    const unitNo = (typeof Store !== 'undefined' && Store.getUnitNoForPeriod)
      ? Store.getUnitNoForPeriod(resolvedGrade || 'M1', period)
      : ((period <= 7) ? 1 : (period <= 11) ? 2 : (period <= 15) ? 3 : 4);

    if (unitNo === 1) {
      // Unit 1: Solo Kalimba & Posture (ฉบับที่ 1)
      return evals.find(e => e.doc_no === 1) || evals[0];
    } else if (period === 10) {
      // Unit 2 Plan 10: Peer Critique & Reflection (ฉบับที่ 4)
      return evals.find(e => e.doc_no === 4) || evals.find(e => e.doc_no === 2) || evals[0];
    } else if (unitNo === 2) {
      // Unit 2: Mini-Recital Ensemble & Polyphony (ฉบับที่ 2)
      return evals.find(e => e.doc_no === 2) || evals[1];
    } else if (period === 12 || period === 13 || period === 16) {
      // Unit 3 (Plans 12-13) & Unit 4 (Plan 16): Cultural & Aesthetic Observation (ฉบับที่ 8)
      return evals.find(e => e.doc_no === 8) || evals[0];
    } else if (unitNo === 3) {
      // Unit 3 (Plans 14-15): Music Culture & Podcast (ฉบับที่ 5)
      return evals.find(e => e.doc_no === 5) || evals[4] || evals[0];
    } else if (period === 17) {
      // Unit 4 (Plan 17): Feldman 4-Step Music Criticism (ฉบับที่ 7)
      return evals.find(e => e.doc_no === 7) || evals[0];
    } else if (period === 18) {
      // Unit 4 (Plan 18): Digital Playlist Curation & Music Therapy (ฉบับที่ 6)
      return evals.find(e => e.doc_no === 6) || evals[0];
    } else {
      return evals.find(e => e.doc_no === 8) || evals[0];
    }
  },

  // อ่านแถวเกณฑ์จาก วก.5 ของคาบนั้น (4 แถว: K, P, A, สมรรถนะ) พร้อมน้ำหนักคะแนน
  getWk5Rows(period, grade) {
    const plans = (typeof WK5_PLANS !== 'undefined' && WK5_PLANS) ? WK5_PLANS[grade] : null;
    const plan = plans ? plans[String(period)] : null;
    if (!plan || !Array.isArray(plan.rubric) || plan.rubric.length === 0) return null;
    return plan.rubric.map(r => {
      const label = String(r.label || '');
      let dim = null;
      if (/\(K\)/.test(label)) dim = 'K';
      else if (/\(P\)/.test(label)) dim = 'P';
      else if (/\(A\)/.test(label)) dim = 'A';
      const w = parseFloat(r.weight);
      return { label, dim, weight: (dim && Number.isFinite(w) && w > 0) ? w : 0, levels: r.levels || {} };
    });
  },

  // ระดับที่เลือก -> {K,P,A} สำหรับ Store.computeDimPoints
  levelsByDim() {
    const out = { K: null, P: null, A: null };
    if (!this.activeRows) return out;
    this.activeRows.forEach((r, i) => { if (r.dim && this.selectedLevels[i]) out[r.dim] = Number(this.selectedLevels[i]); });
    return out;
  },

  openScoringModal(studentId, period = null) {
    if (!studentId) return;
    const modal = document.getElementById('modal-rubric-scoring');
    if (!modal) return;

    if (!period && typeof App !== 'undefined') {
      period = App.state.selectedPeriod;
    }

    this.activeStudent = Store.getStudentById(studentId);
    this.activePeriod = period || 1;
    const studentGrade = Store.gradeKeyOf(this.activeStudent?.class);
    this.activeRubricDoc = this.getRubricForPeriod(this.activePeriod, studentGrade);
    this.selectedLevels = {};
    this.activeGrade = studentGrade;
    this.activeRows = this.getWk5Rows(this.activePeriod, studentGrade);
    if (this.activeRows && Store.isExamPeriod && Store.isExamPeriod(studentGrade, this.activePeriod)) {
      alert('คาบสอบ: คะแนนมาจากระบบสอบ (ผู้เรียนสอบในแอปตามเวลาที่ครูเปิดสอบ) ไม่ต้องประเมินด้วยรูบริก');
      return;
    }

    // Load existing rubric breakdown if already saved
    const saved = Store.getStudentRubric(studentId, this.activePeriod);
    if (saved && saved.breakdown) {
      this.selectedLevels = { ...saved.breakdown };
    } else if (this.activeRows && saved && saved.levels) {
      // ระดับที่ให้แบบเร็ว (ปุ่ม 4/3/2/1 ในรายชื่อ) → แสดงในแถว K/P/A ที่ตรงกัน
      this.activeRows.forEach((r, i) => { if (r.dim && saved.levels[r.dim]) this.selectedLevels[i] = Number(saved.levels[r.dim]); });
    } else if (this.activeRows) {
      // วก.5: ไม่มีค่าเริ่มต้น ครูต้องเลือกระดับเอง (แถวที่ไม่ได้เลือก = ยังไม่ประเมิน)
    } else {
      // Default all criteria to 3 (ดี / ผ่านเกณฑ์)
      if (this.activeRubricDoc && this.activeRubricDoc.tables && this.activeRubricDoc.tables[0]) {
        const rows = this.activeRubricDoc.tables[0].slice(1);
        rows.forEach((_, idx) => {
          this.selectedLevels[idx] = 3;
        });
      }
    }

    this.note = (saved && saved.note) ? String(saved.note) : '';
    this.dirty = false;
    modal.classList.add('active');
    this.renderModalContent();
  },

  closeModal() {
    const modal = document.getElementById('modal-rubric-scoring');
    if (modal) modal.classList.remove('active');
  },

  renderModalContent() {
    const s = this.activeStudent;
    const doc = this.activeRubricDoc;
    if (!s || (!doc && !this.activeRows)) return;

    const nameEl = document.getElementById('rubric-modal-student-name');
    const titleEl = document.getElementById('rubric-modal-rubric-title');
    const tableContainer = document.getElementById('rubric-modal-matrix-container');

    if (nameEl) {
      nameEl.innerHTML = `
        <strong>${this.escapeHtml(s.prefix)}${this.escapeHtml(s.first_name)} ${this.escapeHtml(s.last_name)}</strong> (${this.escapeHtml(s.class || '')} เลขที่ ${this.escapeHtml(s.no)} • รหัส ${this.escapeHtml(s.student_id)})
        <span class="student-nickname-chip" style="margin-left: 0.5rem;">${this.escapeHtml(s.nickname || '-')}</span>
      `;
    }

    if (titleEl) {
      const sInfo = Store.getGradeInfo(Store.gradeKeyOf(s.class)) || {};
      const subjLabel = sInfo.code ? `${sInfo.subjectName} (${sInfo.code})` : '';
      const docTitle = this.activeRows ? 'แบบประเมินตามแผนการจัดการเรียนรู้ (วก.5)' : doc.title;
      titleEl.textContent = `${docTitle} (คาบที่ ${this.activePeriod} • ${subjLabel}) • ระดับคุณภาพ 1-4`;
    }

    if (!tableContainer) return;

    if (this.activeRows) { tableContainer.innerHTML = this.renderWk5Table(); this.updateComputedScoreBadge(); return; }

    const tableData = doc.tables && doc.tables[0] ? doc.tables[0] : null;
    if (!tableData || tableData.length < 2) {
      tableContainer.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">ไม่พบตารางเกณฑ์รูบริกสำหรับบทเรียนนี้</p>`;
      return;
    }

    const headers = tableData[0];
    const rows = tableData.slice(1);

    let html = `
      <table class="rubric-matrix-table">
        <thead>
          <tr>
            <th style="width: 28%;">${this.escapeHtml(headers[0] || 'ประเด็นการประเมิน')}</th>
            <th style="width: 18%;" class="level-col">ดีเยี่ยม (4 คะแนน)</th>
            <th style="width: 18%;" class="level-col">ดี (3 คะแนน)</th>
            <th style="width: 18%;" class="level-col">พอใช้ (2 คะแนน)</th>
            <th style="width: 18%;" class="level-col">ปรับปรุง (1 คะแนน)</th>
          </tr>
        </thead>
        <tbody>
    `;

    rows.forEach((row, rowIdx) => {
      const hasWeightCol = row.length >= 6;
      const critName = hasWeightCol ? `${row[0]} (${row[1]})` : (row[0] || `เกณฑ์ที่ ${rowIdx + 1}`);
      const desc4 = (hasWeightCol ? row[2] : row[1]) || 'ปฏิบัติได้อย่างถูกต้องยอดเยี่ยม สม่ำเสมอ';
      const desc3 = (hasWeightCol ? row[3] : row[2]) || 'ปฏิบัติได้อย่างถูกต้องเป็นส่วนใหญ่';
      const desc2 = (hasWeightCol ? row[4] : row[3]) || 'ปฏิบัติได้บางส่วน มีข้อผิดพลาดเล็กน้อย';
      const desc1 = (hasWeightCol ? row[5] : row[4]) || 'ยังไม่สามารถปฏิบัติได้ ต้องได้รับการชี้แนะ';
      const currentSelected = this.selectedLevels[rowIdx] || 3;

      html += `
        <tr>
          <td class="crit-cell">
            <div style="font-weight: 700; color: var(--ppk-navy-dark); font-size: 0.88rem;">${this.escapeHtml(critName)}</div>
          </td>
          <td class="level-cell ${currentSelected === 4 ? 'selected' : ''}" onclick="RubricMatrix.selectLevel(${rowIdx}, 4)">
            <div class="level-choice-chip">ดีเยี่ยม (4)</div>
            <div class="level-desc-text">${this.escapeHtml(desc4)}</div>
          </td>
          <td class="level-cell ${currentSelected === 3 ? 'selected' : ''}" onclick="RubricMatrix.selectLevel(${rowIdx}, 3)">
            <div class="level-choice-chip">ดี (3)</div>
            <div class="level-desc-text">${this.escapeHtml(desc3)}</div>
          </td>
          <td class="level-cell ${currentSelected === 2 ? 'selected' : ''}" onclick="RubricMatrix.selectLevel(${rowIdx}, 2)">
            <div class="level-choice-chip">พอใช้ (2)</div>
            <div class="level-desc-text">${this.escapeHtml(desc2)}</div>
          </td>
          <td class="level-cell ${currentSelected === 1 ? 'selected' : ''}" onclick="RubricMatrix.selectLevel(${rowIdx}, 1)">
            <div class="level-choice-chip">ปรับปรุง (1)</div>
            <div class="level-desc-text">${this.escapeHtml(desc1)}</div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;

    this.updateComputedScoreBadge();
  },

  // ---- หน้าให้คะแนนหน้างาน (มือถือ/แท็บเล็ต): การ์ดต่อแถวเกณฑ์ ปุ่มระดับ 4/3/2/1 ใหญ่ พร้อมคำอธิบายระดับของคาบนั้น ----
  LEVEL_NAMES: { 4: 'ดีเยี่ยม', 3: 'ดี', 2: 'พอใช้', 1: 'ปรับปรุง' },

  _kalimbaPeriod() {
    const KD = (typeof window !== 'undefined') ? window.KalimbaDevices : null;
    return !!(KD && KD.kalimbaPeriods && KD.kalimbaPeriods().indexOf(Number(this.activePeriod)) >= 0);
  },

  _deviceLabel() {
    const KD = window.KalimbaDevices, s = this.activeStudent;
    const cur = KD.getDevice(s.class, this.activePeriod, s.student_id);
    return cur === KD.NO_NUMBER ? 'ไม่มีเลข' : (cur || 'ยังไม่ระบุ');
  },

  _metaHtml() {
    let h = '';
    if (window.GroupObservation && this.activeStudent && window.GroupObservation.isObservationPeriod(this.activePeriod)) h += window.GroupObservation.panelHtml(this.activeStudent.class, this.activePeriod, this.activeStudent.student_id);
    if (this._kalimbaPeriod()) {
      h += `<div class="rm-meta" id="rm-device-box">🔢 เครื่องคาลิมบ้า: <strong id="rm-dev-label">${this.escapeHtml(this._deviceLabel())}</strong> ` +
        `<input id="rm-dev-input" class="rm-dev-input" type="text" inputmode="numeric" maxlength="3" placeholder="012" aria-label="แก้หมายเลขเครื่อง 3 หลัก"> ` +
        `<button type="button" class="rm-mini-btn" onclick="RubricMatrix.setDevice()">ตั้งเลข</button> ` +
        `<button type="button" class="rm-mini-btn" onclick="RubricMatrix.setDevice(true)">ไม่มีเลข</button><span id="rm-dev-msg" class="rm-dev-msg"></span></div>`;
      const P = (typeof window !== 'undefined') ? window.KalimbaPractice : null;
      if (P && P.rows) {
        const rows = P.rows({ className: this.activeStudent.class, period: this.activePeriod }).filter(r => String(r.studentId) === String(this.activeStudent.student_id));
        const txt = rows.length ? rows.map(r => `${this.escapeHtml(r.itemId)}: ฝึก ${r.plays} ครั้ง · BPM สูงสุด ${r.bestBpm}`).join(' / ') : 'ยังไม่มีบันทึกการฝึกในแอป';
        h += `<div class="rm-meta rm-evidence">📎 ครูฟังการบรรเลงแล้วให้ระดับเอง โดยดูทั้งความถูกต้องของโน้ตและจังหวะ/การตรงเวลา — ระบบเก็บเฉพาะข้อมูลประกอบ (BPM ที่ทำได้ จำนวนครั้งที่ฝึก หมายเลขเครื่อง) ไม่ให้คะแนนเอง · หลักฐานประกอบ (ไม่ใช่คะแนน): ${txt}</div>`;
      }
    }
    return h;
  },

  setDevice(none) {
    const KD = window.KalimbaDevices, s = this.activeStudent;
    if (!KD || !s) return;
    const inp = document.getElementById('rm-dev-input'), msg = document.getElementById('rm-dev-msg');
    const res = KD.set(s.class, this.activePeriod, s.student_id, none ? KD.NO_NUMBER : (inp ? inp.value : ''), 'teacher');
    if (msg) { msg.textContent = res.ok ? '✓ บันทึกแล้ว' : ('⚠ ' + res.reason); msg.style.color = res.ok ? '#15803d' : '#b91c1c'; }
    const lab = document.getElementById('rm-dev-label');
    if (res.ok && lab) lab.textContent = this._deviceLabel();
  },

  _rosterList() {
    const s = this.activeStudent;
    if (!s || typeof App === 'undefined' || !App.getClassStudents) return [];
    return App.getClassStudents(s.class).filter(x => !(Store.isStudentWithdrawn && Store.isStudentWithdrawn(x.student_id)));
  },

  _navHtml() {
    const list = this._rosterList();
    const i = list.findIndex(x => String(x.student_id) === String(this.activeStudent.student_id));
    const hasPrev = i > 0, hasNext = i >= 0 && i < list.length - 1;
    return `<div class="rm-actionbar">` +
      `<button type="button" class="rm-nav-btn" ${hasPrev ? '' : 'disabled'} onclick="RubricMatrix.goStudent(-1)">◀ ก่อนหน้า</button>` +
      `<span class="rm-pos">${i >= 0 ? (i + 1) : '-'} / ${list.length}</span>` +
      `<button type="button" class="rm-nav-btn" ${hasNext ? '' : 'disabled'} onclick="RubricMatrix.goStudent(1)">ถัดไป ▶</button>` +
      `<button type="button" class="rm-save-next" onclick="RubricMatrix.saveScore({ next: true })">💾 บันทึก ${hasNext ? '& คนถัดไป' : '(คนสุดท้าย)'}</button></div>`;
  },

  goStudent(delta, force) {
    const list = this._rosterList();
    const i = list.findIndex(x => String(x.student_id) === String(this.activeStudent.student_id));
    const t = list[i + delta];
    if (!t) return false;
    if (this.dirty && !force && typeof confirm === 'function' && !confirm('ยังไม่ได้บันทึกคะแนนของคนนี้ ไปคนอื่นโดยไม่บันทึกหรือไม่?')) return false;
    this.openScoringModal(t.student_id, this.activePeriod);
    return true;
  },

  setNote(v) { this.note = String(v || '').slice(0, 300); this.dirty = true; },

  renderWk5Table() {
    const L = [4, 3, 2, 1];
    const calc0 = this.computeScore();
    let html = `<div class="rm-live" id="rm-live" aria-live="polite"></div>` + this._metaHtml();
    if (calc0.maxRaw === 0) {
      html += `<div class="rm-meta">ℹ️ คาบนี้ วก.5 ไม่กำหนดคะแนน K/P/A — บันทึกระดับเป็นข้อสังเกตของครูเท่านั้น (ไม่คำนวณคะแนนรวม)</div>`;
    }
    html += `<div class="rm-cards">`;
    this.activeRows.forEach((row, idx) => {
      const sel = this.selectedLevels[idx] || 0;
      const wTxt = row.weight > 0 ? `${row.weight} คะแนน` : 'ไม่มีคะแนน';
      html += `<section class="rm-card" aria-label="${this.escapeHtml(row.label)}"><div class="rm-card-head"><div class="rm-card-title">${this.escapeHtml(row.label)}</div>` +
        `<span class="rm-weight ${row.weight > 0 ? '' : 'rm-weight-0'}">${wTxt}</span></div><div class="rm-levels" role="group">` +
        L.map(n => `<button type="button" class="rm-lv rm-lv-${n}${sel === n ? ' sel' : ''}" data-row="${idx}" data-lv="${n}" aria-pressed="${sel === n}" onclick="RubricMatrix.selectLevel(${idx}, ${n})">` +
          `<span class="rm-lv-badge">${n}<small>${this.LEVEL_NAMES[n]}</small></span><span class="rm-lv-desc">${this.escapeHtml(row.levels[String(n)] || '')}</span></button>`).join('') +
        `</div></section>`;
    });
    html += `</div><label class="rm-note-label" for="rm-note">📝 บันทึกเพิ่มเติม (ไม่บังคับ)</label>` +
      `<textarea id="rm-note" class="rm-note" maxlength="300" rows="2" placeholder="เช่น ดีดโน้ตถูกแต่จังหวะเร็วขึ้นช่วงท้าย" oninput="RubricMatrix.setNote(this.value)">${this.escapeHtml(this.note)}</textarea>` +
      this._navHtml();
    return html;
  },

  selectLevel(critIndex, level) {
    this.selectedLevels[critIndex] = level;
    this.dirty = true;
    if (this.activeRows && typeof document !== 'undefined') {
      // อัปเดตในที่ ไม่วาดใหม่ทั้งหน้า (ไม่ให้หน้าเลื่อนกลับไปบนสุดบนมือถือ)
      const btns = document.querySelectorAll('#rubric-modal-matrix-container .rm-lv[data-row="' + critIndex + '"]');
      if (btns.length) {
        for (let i = 0; i < btns.length; i++) {
          const on = Number(btns[i].getAttribute('data-lv')) === Number(level);
          btns[i].classList.toggle('sel', on);
          btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        this.updateComputedScoreBadge();
        return;
      }
    }
    this.renderModalContent();
  },

  selectLevelAll(level) {
    this.dirty = true;
    if (this.activeRows) {
      this.activeRows.forEach((r, idx) => { if (r.weight > 0) this.selectedLevels[idx] = level; });
      this.renderModalContent();
      return;
    }
    if (this.activeRubricDoc && this.activeRubricDoc.tables && this.activeRubricDoc.tables[0]) {
      const rows = this.activeRubricDoc.tables[0].slice(1);
      rows.forEach((_, idx) => {
        this.selectedLevels[idx] = level;
      });
      this.renderModalContent();
    }
  },

  computeScore() {
    if (this.activeRows) {
      const calc = Store.computeDimPoints(this.activeGrade, this.activePeriod, this.levelsByDim());
      return { wk5: true, sum: calc.total, maxRaw: calc.max, percentage: calc.max ? Math.round(calc.total / calc.max * 100) : 0,
        scaledScore: calc.total, dims: calc.dims, complete: calc.complete, levels: calc.levels };
    }
    const keys = Object.keys(this.selectedLevels);
    if (keys.length === 0) return { totalRaw: 0, maxRaw: 0, scaledScore: 3, percentage: 100 };

    let sum = 0;
    keys.forEach(k => {
      sum += (this.selectedLevels[k] || 0);
    });

    const maxRaw = keys.length * 4;
    const percentage = Math.round((sum / maxRaw) * 100);

    // Scale to lesson score scale: 3 points scale for daily rubric
    // 85%+ = 3, 60-84% = 2, <60% = 1
    let scaledScore = 2;
    if (percentage >= 80) scaledScore = 3;
    else if (percentage < 55) scaledScore = 1;

    return {
      sum: sum,
      maxRaw: maxRaw,
      percentage: percentage,
      scaledScore: scaledScore
    };
  },

  updateComputedScoreBadge() {
    const badge = document.getElementById('rubric-modal-computed-score');
    const live = document.getElementById('rm-live');
    const calc = this.computeScore();
    if (live && calc.wk5) {
      const d = calc.dims;
      live.innerHTML = calc.maxRaw === 0 ? 'คาบนี้ไม่มีคะแนน K/P/A' :
        `<span class="rm-live-total">${calc.sum}<small> / ${calc.maxRaw}</small></span><span class="rm-live-dims">K ${d.K} · P ${d.P} · A ${d.A}</span>` +
        (calc.complete ? '' : '<span class="rm-live-warn">ยังเลือกไม่ครบ</span>');
      live.className = 'rm-live' + (calc.complete ? ' rm-live-ok' : '');
    }
    if (!badge) return;
    if (calc.wk5) {
      const d = calc.dims;
      badge.innerHTML = calc.complete
        ? `คะแนนคาบนี้: <strong>${calc.sum} / ${calc.maxRaw}</strong> (K ${d.K} • P ${d.P} • A ${d.A}) &nbsp;|&nbsp; คะแนน = น้ำหนัก × ระดับ ÷ 4`
        : `เลือกระดับให้ครบทุกแถวที่มีน้ำหนักคะแนนก่อนบันทึก (ตอนนี้ ${calc.sum} / ${calc.maxRaw})`;
      return;
    }
    let color = '#16a34a';
    let label = 'ดีเยี่ยม (3)';
    if (calc.scaledScore === 2) {
      color = '#0284c7';
      label = 'ผ่านเกณฑ์ (2)';
    } else if (calc.scaledScore === 1) {
      color = '#d97706';
      label = 'ควรปรับปรุง (1)';
    }

    badge.innerHTML = `
      คะแนนรวมรูบริก: <strong>${calc.sum} / ${calc.maxRaw}</strong> (${calc.percentage}%)
      &nbsp;➔&nbsp; ตัดเกรดประจำคาบ: <span class="badge" style="background: ${color}; color: #ffffff; padding: 3px 10px; border-radius: 9999px;">${label}</span>
    `;
  },

  saveScore(opts) {
    if (!this.activeStudent) return;
    const calc = this.computeScore();
    if (calc.wk5) {
      const noScore = calc.maxRaw === 0;
      if (!noScore && !calc.complete) { alert('กรุณาเลือกระดับให้ครบทุกแถวที่มีน้ำหนักคะแนน'); return; }
      const cls = this.activeStudent.class;
      const rec = {
        breakdown: this.selectedLevels, levels: calc.levels, dims: calc.dims,
        sum: calc.sum, maxRaw: calc.maxRaw, percentage: calc.percentage, scaledScore: calc.sum,
        source: 'rubric', updatedAt: new Date().toLocaleString('th-TH')
      };
      if (this.note) rec.note = this.note;
      if (noScore) rec.noScore = true;
      Store.saveStudentRubric(this.activeStudent.student_id, this.activePeriod, rec, cls);
      this.dirty = false;
      if (typeof App !== 'undefined' && !noScore) App.setStudentScore(this.activeStudent.student_id, calc.sum);
      const wantNext = !!(opts && opts.next);
      if (wantNext && this.goStudent(1, true)) { if (typeof App !== 'undefined') App.renderAssessmentTab(); return; }
      this.closeModal();
      if (typeof App !== 'undefined') App.renderAssessmentTab();
      return;
    }

    // Save detailed breakdown in Store
    Store.saveStudentRubric(this.activeStudent.student_id, this.activePeriod, {
      breakdown: this.selectedLevels,
      sum: calc.sum,
      maxRaw: calc.maxRaw,
      percentage: calc.percentage,
      scaledScore: calc.scaledScore,
      updatedAt: new Date().toLocaleString('th-TH')
    });

    // Save student period score in Cockpit
    if (typeof App !== 'undefined') {
      App.setStudentScore(this.activeStudent.student_id, calc.scaledScore);
    }

    this.closeModal();
    if (typeof App !== 'undefined') {
      App.renderAssessmentTab();
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

if (typeof window !== 'undefined') {
  window.RubricMatrix = RubricMatrix;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RubricMatrix;
}

