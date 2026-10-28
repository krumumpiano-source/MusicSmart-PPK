// ==========================================================================
// Interactive Matrix Rubric Scoring (ระบบประเมินรูบริก 4 ระดับคุณภาพ ระดับ คศ.4)
// สาระการเรียนรู้ศิลปะ (สาระดนตรี) • โรงเรียนพะเยาพิทยาคม
// ==========================================================================

const RubricMatrix = {
  activeStudent: null,
  activePeriod: 1,
  activeRubricDoc: null,
  selectedLevels: {}, // criterionIndex -> level (4, 3, 2, 1)

  // Map period & grade to the appropriate official rubric document in ACADEMIC_DOCS_BY_GRADE[grade].eval
  getRubricForPeriod(period, grade = null) {
    const resolvedGrade = grade
      || (this.activeStudent?.class?.startsWith('ม.2') ? 'M2' : null)
      || (typeof App !== 'undefined' && App.state?.grade ? App.state.grade : 'M1');

    const docsSource = (typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' && ACADEMIC_DOCS_BY_GRADE[resolvedGrade])
      ? ACADEMIC_DOCS_BY_GRADE[resolvedGrade]
      : (typeof ACADEMIC_DOCS !== 'undefined' ? ACADEMIC_DOCS : null);

    if (!docsSource || !docsSource.eval) return null;
    const evals = docsSource.eval;

    if (period <= 4) {
      // Unit 1: Solo Kalimba & Posture (ฉบับที่ 1)
      return evals.find(e => e.doc_no === 1) || evals[0];
    } else if (period === 10) {
      // Unit 2 Plan 10: Peer Critique & Reflection (ฉบับที่ 4)
      return evals.find(e => e.doc_no === 4) || evals.find(e => e.doc_no === 2) || evals[0];
    } else if (period <= 11) {
      // Unit 2: Mini-Recital Ensemble & Polyphony (ฉบับที่ 2)
      return evals.find(e => e.doc_no === 2) || evals[1];
    } else if (period === 12 || period === 13 || period === 16) {
      // Unit 3 (Plans 12-13) & Unit 4 (Plan 16): Cultural & Aesthetic Observation (ฉบับที่ 8)
      return evals.find(e => e.doc_no === 8) || evals[0];
    } else if (period === 14 || period === 15) {
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

  openScoringModal(studentId, period = null) {
    if (!studentId) return;
    const modal = document.getElementById('modal-rubric-scoring');
    if (!modal) return;

    if (!period && typeof App !== 'undefined') {
      period = App.state.selectedPeriod;
    }

    this.activeStudent = Store.getStudentById(studentId);
    this.activePeriod = period || 1;
    const studentGrade = this.activeStudent?.class?.startsWith('ม.2') ? 'M2' : 'M1';
    this.activeRubricDoc = this.getRubricForPeriod(this.activePeriod, studentGrade);
    this.selectedLevels = {};

    // Load existing rubric breakdown if already saved
    const saved = Store.getStudentRubric(studentId, this.activePeriod);
    if (saved && saved.breakdown) {
      this.selectedLevels = { ...saved.breakdown };
    } else {
      // Default all criteria to 3 (ดี / ผ่านเกณฑ์)
      if (this.activeRubricDoc && this.activeRubricDoc.tables && this.activeRubricDoc.tables[0]) {
        const rows = this.activeRubricDoc.tables[0].slice(1);
        rows.forEach((_, idx) => {
          this.selectedLevels[idx] = 3;
        });
      }
    }

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
    if (!s || !doc) return;

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
      const subjLabel = s.class?.startsWith('ม.2') ? 'ดนตรี 2 (ศ22102)' : 'ดนตรี 1 (ศ21102)';
      titleEl.textContent = `${doc.title} (คาบที่ ${this.activePeriod} • ${subjLabel}) • มาตรฐานวิทยฐานะ คศ.4`;
    }

    if (!tableContainer) return;

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

  selectLevel(critIndex, level) {
    this.selectedLevels[critIndex] = level;
    this.renderModalContent();
  },

  selectLevelAll(level) {
    if (this.activeRubricDoc && this.activeRubricDoc.tables && this.activeRubricDoc.tables[0]) {
      const rows = this.activeRubricDoc.tables[0].slice(1);
      rows.forEach((_, idx) => {
        this.selectedLevels[idx] = level;
      });
      this.renderModalContent();
    }
  },

  computeScore() {
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
    if (!badge) return;

    const calc = this.computeScore();
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

  saveScore() {
    if (!this.activeStudent) return;
    const calc = this.computeScore();

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

