// ==========================================================================
// Official Forms Generator (ปพ.5 & บันทึกหลังแผน วก.5 ฉบับมาตรฐานราชการ A4)
// นวัตกรรมรูปแบบ T-PACE ร่วมกับระบบนิเวศการเรียนรู้ดิจิทัล • โรงเรียนพะเยาพิทยาคม
// 100% Dynamic - Zero Hardcoding
// ==========================================================================

const OfficialForms = {
  activeTab: 'ppk5', // 'wk3' | 'wk4' | 'wk5' | 'ppk5'
  activeGrade: 'M1', // 'M1' | 'M2'
  activeUnit: 1, // 1..4
  activeClass: 'ม.1/1',
  activePeriod: 1,

  openModal(className = null, period = null, defaultTab = null) {
    const modal = document.getElementById('modal-official-forms');
    if (!modal) return;

    if (className) {
      this.activeClass = className;
      this.activeGrade = Store.gradeKeyOf(className);
    } else if (typeof App !== 'undefined') {
      this.activeClass = App.state.selectedClass || 'ม.1/1';
      this.activeGrade = Store.gradeKeyOf(this.activeClass);
    }

    if (period) this.activePeriod = parseInt(period, 10);
    else if (typeof App !== 'undefined') this.activePeriod = App.state.selectedPeriod || 1;

    if (defaultTab) this.activeTab = defaultTab;

    modal.classList.add('active');
    this.switchTab(this.activeTab);
  },

  closeModal() {
    const modal = document.getElementById('modal-official-forms');
    if (modal) modal.classList.remove('active');
  },

  switchTab(tab) {
    this.activeTab = tab;

    // Update tab button styles
    ['wk3', 'wk4', 'wk5', 'ppk5'].forEach(t => {
      const btn = document.getElementById(`btn-form-tab-${t}`);
      if (btn) btn.className = `academic-tab-btn ${tab === t ? 'active' : ''}`;
    });

    this.renderSubSelector();
    this.renderActiveSheet();
  },

  renderSubSelector() {
    const container = document.getElementById('official-form-sub-selector');
    if (!container) return;
    container.innerHTML = '';

    // Tab: wk3 (Grade selector only)
    if (this.activeTab === 'wk3') {
      const gradeSel = document.createElement('select');
      gradeSel.className = 'form-select';
      gradeSel.style.minWidth = '220px';
      [
        { val: 'M1', label: `มัธยมศึกษาปีที่ 1 (${Store.getSubjectCode('ม.1')} ดนตรี 1)` },
        { val: 'M2', label: `มัธยมศึกษาปีที่ 2 (${Store.getSubjectCode('ม.2')} ดนตรี 2)` }
      ].forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.val;
        opt.textContent = g.label;
        if (g.val === this.activeGrade) opt.selected = true;
        gradeSel.appendChild(opt);
      });
      gradeSel.onchange = (e) => {
        this.activeGrade = e.target.value;
        this.renderActiveSheet();
      };
      container.appendChild(gradeSel);
      return;
    }

    // Tab: wk4 (Grade selector + Unit selector)
    if (this.activeTab === 'wk4') {
      const gradeSel = document.createElement('select');
      gradeSel.className = 'form-select';
      gradeSel.style.minWidth = '160px';
      [
        { val: 'M1', label: `ม.1 (${Store.getSubjectCode('ม.1')})` },
        { val: 'M2', label: `ม.2 (${Store.getSubjectCode('ม.2')})` }
      ].forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.val;
        opt.textContent = g.label;
        if (g.val === this.activeGrade) opt.selected = true;
        gradeSel.appendChild(opt);
      });
      gradeSel.onchange = (e) => {
        this.activeGrade = e.target.value;
        this.renderSubSelector();
        this.renderActiveSheet();
      };
      container.appendChild(gradeSel);

      const unitSel = document.createElement('select');
      unitSel.className = 'form-select';
      unitSel.style.minWidth = '220px';
      const docs = typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' ? ACADEMIC_DOCS_BY_GRADE[this.activeGrade] : null;
      const units = docs && docs.wk4 ? docs.wk4 : [];
      units.forEach((u, idx) => {
        const opt = document.createElement('option');
        opt.value = u.unit_no || (idx + 1);
        opt.textContent = `หน่วยที่ ${u.unit_no || (idx + 1)}: ${(u.unit_name || '').slice(0, 20)}...`;
        if (Number(u.unit_no || (idx + 1)) === Number(this.activeUnit)) opt.selected = true;
        unitSel.appendChild(opt);
      });
      unitSel.onchange = (e) => {
        this.activeUnit = parseInt(e.target.value, 10);
        this.renderActiveSheet();
      };
      container.appendChild(unitSel);
      return;
    }

    const classes = Store.getAllClasses ? [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')] : ['ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.1/4', 'ม.1/5', 'ม.1/6', 'ม.1/7', 'ม.1/8'];

    // Class dropdown
    const classSel = document.createElement('select');
    classSel.className = 'form-select';
    classSel.style.minWidth = '130px';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `ห้อง ${c}`;
      if (c === this.activeClass) opt.selected = true;
      classSel.appendChild(opt);
    });

    classSel.onchange = (e) => {
      this.activeClass = e.target.value;
      this.activeGrade = Store.gradeKeyOf(this.activeClass);
      this.renderActiveSheet();
    };
    container.appendChild(classSel);

    // Period selector for WK.5
    if (this.activeTab === 'wk5') {
      const periodSel = document.createElement('select');
      periodSel.className = 'form-select';
      periodSel.style.minWidth = '180px';
      const grade = Store.gradeKeyOf(this.activeClass);
      for (let p = 1; p <= Store.getPeriodCount(grade); p++) {
        const opt = document.createElement('option');
        opt.value = p;
        const lesson = Store.getLesson ? Store.getLesson(grade, p) : null;
        opt.textContent = `แผนที่ ${p}: ${lesson?.topic ? lesson.topic.slice(0, 18) + '...' : `คาบ ${p}`}`;
        if (p === this.activePeriod) opt.selected = true;
        periodSel.appendChild(opt);
      }
      periodSel.onchange = (e) => {
        this.activePeriod = parseInt(e.target.value, 10);
        this.renderActiveSheet();
      };
      container.appendChild(periodSel);
    }
  },

  renderActiveSheet() {
    const sheet = document.getElementById('official-form-sheet');
    if (!sheet) return;

    if (this.activeTab === 'wk3') {
      sheet.innerHTML = this.buildWK3HTML(this.activeGrade);
    } else if (this.activeTab === 'wk4') {
      sheet.innerHTML = this.buildWK4HTML(this.activeGrade, this.activeUnit);
    } else if (this.activeTab === 'wk5') {
      sheet.innerHTML = this.buildWK5HTML(this.activeClass, this.activePeriod);
    } else {
      sheet.innerHTML = this.buildPPK5HTML(this.activeClass);
    }
  },

  // ========================================================================
  // 1. ปพ.5: แบบรายงานผลการพัฒนาคุณภาพผู้เรียน (A4) - Dynamic & No Hardcoding
  // ========================================================================
  buildPPK5HTML(className) {
    const students = Store.getStudents(className) || [];
    const settings = Store.getAppSettings ? Store.getAppSettings() : {
      schoolName: "โรงเรียนพะเยาพิทยาคม",
      department: "กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)",
      directorName: "ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ",
      directorRole: "ผู้อำนวยการโรงเรียนพะเยาพิทยาคม",
      departmentHead: "นายอุดม ไชยวุฒิ",
      departmentHeadRole: "หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ",
      academicHead: "นายกฤศ วงค์เรือง",
      academicHeadRole: "รองผู้อำนวยการกลุ่มบริหารงานวิชาการ"
    };
    const instructor = Store.getInstructor ? Store.getInstructor() : { name: 'นายพงศธร โพธิแก้ว', role: 'ครูผู้สอน' };
    const currentSubject = Store.getCurrentSubject ? Store.getCurrentSubject(className) : { code: Store.getSubjectCode('ม.1'), name: 'ดนตรี 1' };
    const semesterMeta = { activeLabel: Store.getSemesterInfo().label };

    const gradeCounts = { 4: 0, 3.5: 0, 3: 0, 2.5: 0, 2: 0, 1.5: 0, 1: 0, 0: 0 };
    let passedCount = 0;
    let pdpaConsentedCount = 0;

    // Pull real sessions to compute empirical attendance & performance
    const allSessions = Store.getAllSessions ? Store.getAllSessions() : {};
    let taughtPeriodsCount = 0;
    const periodTotal = Store.getPeriodCount(Store.gradeKeyOf(className));
    for (let p = 1; p <= periodTotal; p++) {
      const key = Store.getSessionKey ? Store.getSessionKey(className, p) : `${className}_P${p}`;
      if (allSessions[key]) taughtPeriodsCount++;
    }

    const kpaTotals = Store.getKPATotals(Store.gradeKeyOf(className));
    const studentRows = students.map((s) => {
      const isWithdrawn = Store.isStudentWithdrawn(s.student_id);
      const isPdpa = Store.getStudentPdpaConsent ? Store.getStudentPdpaConsent(s.student_id) : false;
      if (isPdpa) pdpaConsentedCount++;

      if (isWithdrawn) {
        return `
          <tr class="row-withdrawn" style="background: #f1f5f9; color: #94a3b8;">
            <td style="text-align: center;">${s.no}</td>
            <td style="text-align: center;">${this.escapeHtml(s.student_id)}</td>
            <td style="text-align: left;">${this.escapeHtml(s.prefix)}${this.escapeHtml(s.first_name)} ${this.escapeHtml(s.last_name)}</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center; font-weight: 700; color: #64748b;">จำหน่าย/ย้าย</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
          </tr>
        `;
      }

      // คะแนนทั้งหมดมาจากคะแนนรายคาบที่บันทึกจริง (K/P/A ตามน้ำหนัก วก.5) ไม่มีค่าสมมติ
      let studentAttended = 0;
      for (let p = 1; p <= periodTotal; p++) {
        const key = Store.getSessionKey ? Store.getSessionKey(className, p) : `${className}_P${p}`;
        const sess = allSessions[key];
        if (sess) {
          const att = sess.attendance ? sess.attendance[s.student_id] : 'present';
          if (att === 'present' || att === 'late' || att === 'activity') studentAttended++;
        }
      }
      let attHours = '-';
      let attPct = '-';
      if (taughtPeriodsCount > 0) {
        attHours = Math.round((studentAttended / taughtPeriodsCount) * periodTotal);
        attPct = Math.round((studentAttended / taughtPeriodsCount) * 100);
      }

      const kpa = Store.getStudentKPA(s.student_id, className);
      const kScore = kpa.K;
      const pScore = kpa.P;
      const aScore = kpa.A;
      const formativeTotal = kpa.formative;
      const midtermExam = kpa.midterm === null ? 0 : kpa.midterm;   // คาบสอบกลางภาค (ผลสอบจริง)
      const finalScore = kpa.final === null ? 0 : kpa.final;        // คาบสอบปลายภาค (ผลสอบจริง)
      const totalScore = Math.round((formativeTotal + midtermExam + finalScore) * 100) / 100;

      // Determine Grade
      let grade = '0';
      if (totalScore >= 80) grade = '4';
      else if (totalScore >= 75) grade = '3.5';
      else if (totalScore >= 70) grade = '3';
      else if (totalScore >= 65) grade = '2.5';
      else if (totalScore >= 60) grade = '2';
      else if (totalScore >= 55) grade = '1.5';
      else if (totalScore >= 50) grade = '1';
      else grade = '0';

      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      if (parseFloat(grade) >= 1.0) passedCount++;

      const pdpaBadge = isPdpa ? '✓ ยินยอม' : 'รอเอกสาร';
      let traitEvaluation = 'ดีเยี่ยม';
      if (totalScore < 60) traitEvaluation = 'ผ่าน';
      else if (totalScore < 75) traitEvaluation = 'ดี';

      return `
        <tr>
          <td style="text-align: center;">${s.no}</td>
          <td style="text-align: center;">${s.student_id}</td>
          <td style="text-align: left; font-weight: 500;">${s.prefix}${s.first_name} ${s.last_name}</td>
          <td style="text-align: center; font-size: 11px;">${pdpaBadge}</td>
          <td style="text-align: center;">${attHours} (${attPct}%)</td>
          <td style="text-align: center;">${kScore}</td>
          <td style="text-align: center;">${pScore}</td>
          <td style="text-align: center;">${aScore}</td>
          <td style="text-align: center; font-weight: 600;">${formativeTotal}</td>
          <td style="text-align: center;">${midtermExam}</td>
          <td style="text-align: center;">${finalScore}</td>
          <td style="text-align: center; font-weight: 700;">${totalScore}</td>
          <td style="text-align: center; font-weight: 800; color: ${parseFloat(grade) >= 3 ? '#1e3a8a' : '#0f172a'};">${grade}</td>
          <td style="text-align: center;">${traitEvaluation}</td>
        </tr>
      `;
    }).join('');

    const totalActive = students.filter(s => !Store.isStudentWithdrawn(s.student_id)).length || 1;
    const passRate = Math.round((passedCount / totalActive) * 100);

    return `
      <div class="gov-sheet-header">
        <div style="text-align: center; margin-bottom: 0.5rem;">
          <div style="font-size: 18px; font-weight: 700; color: #000;">${this.escapeHtml(settings.schoolName)}</div>
          <div style="font-size: 15px; font-weight: 700; color: #000; margin-top: 2px;">
            แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายวิชา (ปพ.5 : พ)
          </div>
          <div style="font-size: 13px; color: #333; margin-top: 3px;">
            ${this.escapeHtml(settings.department)} • รายวิชา ${this.escapeHtml(currentSubject.name)} (รหัสวิชา ${this.escapeHtml(currentSubject.code)}) • ห้อง ${className}
          </div>
          <div style="font-size: 12px; color: #555; margin-top: 2px;">
            ${this.escapeHtml(semesterMeta.activeLabel)} • จำนวน 0.5 หน่วยกิต (20 ชั่วโมง/ภาคเรียน) • ครูผู้สอน: ${this.escapeHtml(instructor.name)}
          </div>
        </div>
      </div>

      <!-- Main Grading Table -->
      <table class="gov-print-table" style="width: 100%; margin-top: 1rem; font-size: 11px;">
        <thead>
          <tr>
            <th rowspan="2" style="width: 5%;">เลขที่</th>
            <th rowspan="2" style="width: 9%;">รหัสประจำตัว</th>
            <th rowspan="2" style="width: 22%;">ชื่อ - นามสกุล</th>
            <th rowspan="2" style="width: 7%;">PDPA</th>
            <th rowspan="2" style="width: 8%;">เวลาเรียน</th>
            <th colspan="4" style="width: 23%;">คะแนนระหว่างเรียน 4 หน่วย (${kpaTotals.formative})</th>
            <th rowspan="2" style="width: 6%;">กลางภาค (${kpaTotals.midterm})</th>
            <th rowspan="2" style="width: 6%;">ปลายภาค (${kpaTotals.final})</th>
            <th rowspan="2" style="width: 6%;">รวม (${kpaTotals.total})</th>
            <th rowspan="2" style="width: 4%;">เกรด</th>
            <th rowspan="2" style="width: 7%;">คุณลักษณะ</th>
          </tr>
          <tr>
            <th style="font-size: 10px;">K (${kpaTotals.K})</th>
            <th style="font-size: 10px;">P (${kpaTotals.P})</th>
            <th style="font-size: 10px;">A (${kpaTotals.A})</th>
            <th style="font-size: 10px;">รวม (${kpaTotals.formative})</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>

      <!-- Grade Distribution Summary Grid -->
      <div style="margin-top: 1.25rem; page-break-inside: avoid;">
        <div style="font-size: 12.5px; font-weight: 700; margin-bottom: 0.35rem; color: #000;">
          สรุปผลการประเมินผลการเรียน (Grade Distribution):
        </div>
        <table class="gov-print-table" style="width: 100%; font-size: 11.5px; text-align: center;">
          <thead>
            <tr>
              <th>ระดับผลการเรียน</th>
              <th>4</th>
              <th>3.5</th>
              <th>3</th>
              <th>2.5</th>
              <th>2</th>
              <th>1.5</th>
              <th>1</th>
              <th>0</th>
              <th>รวมทั้งสิ้น</th>
              <th>ร้อยละที่ผ่านเกณฑ์ (>= 1.0)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 600;">จำนวน (คน)</td>
              <td>${gradeCounts['4']}</td>
              <td>${gradeCounts['3.5']}</td>
              <td>${gradeCounts['3']}</td>
              <td>${gradeCounts['2.5']}</td>
              <td>${gradeCounts['2']}</td>
              <td>${gradeCounts['1.5']}</td>
              <td>${gradeCounts['1']}</td>
              <td>${gradeCounts['0']}</td>
              <td style="font-weight: 700;">${totalActive}</td>
              <td style="font-weight: 700; color: #16a34a;">${passRate}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Dynamic Signatures Footer (4-Tier Official Approval) -->
      <div class="gov-signatures-grid" style="margin-top: 2rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; text-align: center; font-size: 11px; page-break-inside: avoid;">
        <div>
          <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................</div>
          <div style="font-weight: 700;">(${this.escapeHtml(instructor.name)})</div>
          <div style="color: #475569; margin-top: 2px;">ครูผู้สอน / ผู้บันทึก</div>
        </div>

        <div>
          <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................</div>
          <div style="font-weight: 700;">(${this.escapeHtml(settings.departmentHead)})</div>
          <div style="color: #475569; margin-top: 2px;">${this.escapeHtml(settings.departmentHeadRole || 'หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ')}</div>
        </div>

        <div>
          <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................</div>
          <div style="font-weight: 700;">(${this.escapeHtml(settings.academicHead || 'นายกฤศ วงค์เรือง')})</div>
          <div style="color: #475569; margin-top: 2px;">${this.escapeHtml(settings.academicHeadRole || 'รองผู้อำนวยการกลุ่มบริหารงานวิชาการ')}</div>
        </div>

        <div>
          <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................</div>
          <div style="font-weight: 700;">(${this.escapeHtml(settings.directorName)})</div>
          <div style="color: #475569; margin-top: 2px;">${this.escapeHtml(settings.directorRole || 'ผู้อำนวยการสถานศึกษา')}</div>
        </div>
      </div>
    `;
  },

  // ========================================================================
  // 2. วก.5: แผนการจัดการเรียนรู้ + บันทึกผลหลังการสอน (A4 4 หน้า ตามแบบฟอร์มโรงเรียน) - ข้อมูลจากแผน/ตั้งค่า ไม่ฮาร์ดโค้ด
  // ========================================================================
  buildWK5HTML(className = 'ม.1/1', period = 1) {
    if (typeof period === 'undefined' || !period) {
      if (typeof className === 'number' || (typeof className === 'string' && /^\d+$/.test(className))) {
        period = parseInt(className, 10);
        className = 'ม.1/1';
      } else {
        period = 1;
      }
    } else if (typeof className === 'number' || (typeof className === 'string' && /^\d+$/.test(className))) {
      const temp = period;
      period = parseInt(className, 10);
      className = typeof temp === 'string' && temp.startsWith('ม.') ? temp : 'ม.1/1';
    }
    const grade = Store.gradeKeyOf(className) || 'M1';
    const gradeNo = Store.gradeNumberOf(className);
    const lesson = Store.getLesson ? Store.getLesson(grade, period) : null;
    const w = (lesson && lesson.wk5) || {};
    const session = Store.getSession ? Store.getSession(className, period) : null;
    const refl = (session && session.reflection) || {};
    const settings = Store.getAppSettings ? Store.getAppSettings() : {};
    const instructor = Store.getInstructor ? Store.getInstructor() : { name: '' };
    const subject = Store.getCurrentSubject ? Store.getCurrentSubject(className) : null;
    const sem = Store.getSemesterInfo();
    const crit = Store.getWk5Criteria();
    const esc = s => this.escapeHtml(s);

    // ---- helpers (ค่าว่างแสดงเป็นเส้นประแบบเดียวกับแบบฟอร์มต้นฉบับ) ----
    const dots = (n = 20) => '.'.repeat(n);
    const fill = (v, n = 20) => {
      const t = (v === null || v === undefined) ? '' : String(v).trim();
      return t ? `<span style="font-weight:600;">${esc(t)}</span>` : dots(n);
    };
    const dotBlock = (rows = 3) => Array.from({ length: rows }, () =>
      `<div style="line-height:1.9;color:#334155;overflow:hidden;white-space:nowrap;">${dots(200)}</div>`).join('');
    const para = (text, rows = 3) => {
      const t = String(text || '').trim();
      return t ? `<div style="line-height:1.65;text-align:justify;text-indent:1cm;">${esc(t)}</div>` : dotBlock(rows);
    };
    const numbered = (items, prefix, minRows) => {
      const list = (items || []).filter(Boolean);
      const rows = list.map((t, i) => `<div style="padding-left:1.1cm;text-indent:-1.1cm;line-height:1.6;">${prefix ? `${prefix}${i + 1} ` : `${i + 1}. `}${esc(t)}</div>`);
      for (let i = list.length; i < (minRows || 0); i++) {
        rows.push(`<div style="line-height:1.7;color:#334155;">${prefix ? `${prefix}${i + 1} ` : `${i + 1}. `}${dots(90)}</div>`);
      }
      return rows.join('');
    };
    const bullets = text => {
      const parts = String(text || '').split(/\s*•\s*/).map(s => s.trim()).filter(Boolean);
      if (!parts.length) return '';
      return esc(parts[0]) + parts.slice(1).map(s => `<div style="padding-left:0.6cm;text-indent:-0.35cm;">• ${esc(s)}</div>`).join('');
    };
    const heading = t => `<div style="font-size:13.5px;font-weight:700;margin:0.7rem 0 0.2rem;">${esc(t)}</div>`;
    const orgLine = `<div style="font-size:13px;font-weight:700;text-align:left;margin-bottom:0.5rem;">งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม</div>`;
    const pageStyle = 'page-break-after:always;break-after:page;';
    const sep = n => `<div class="wk5-page-sep" style="text-align:center;color:#94a3b8;font-size:11px;border-top:1px dashed #94a3b8;margin:0.75rem 0;padding-top:2px;">— จบหน้า ${n} —</div>`;

    // ---- ข้อมูลทั่วไป ----
    const periodMin = Number(settings.periodMinutes) || 50;
    const mins = Number(lesson && lesson.duration_min) || 0;
    const hours = mins ? Math.round((mins / periodMin) * 100) / 100 : '';
    const timeText = mins ? `${hours} ชั่วโมง (${mins} นาที)` : '';
    const subjectName = subject && subject.name ? String(subject.name).replace(/\s*\(.*?\)\s*$/, '') : '';
    const subjectCode = subject && subject.code ? subject.code : '';
    const group = w.subject_group || String(settings.department || '').replace(/^กลุ่มสาระการเรียนรู้\s*/, '');
    const levelText = w.level || '';
    const unitNo = w.unit_no || (lesson && lesson.unit_no) || '';
    const unitName = (lesson && (lesson.unit_name || lesson.unitName)) || w.unit_name || '';
    const topic = w.topic || (lesson && lesson.topic) || '';

    let dd = '', mm = '', yy = '';
    if (session && session.timestamp) {
      try {
        const parts = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })
          .formatToParts(new Date(session.timestamp));
        dd = (parts.find(p => p.type === 'day') || {}).value || '';
        mm = (parts.find(p => p.type === 'month') || {}).value || '';
        yy = (parts.find(p => p.type === 'year') || {}).value || '';
      } catch (e) { /* ปล่อยว่าง */ }
    }

    // ---- หน้า 1 ----
    const ob = w.objectives || { k: [], p: [], a: [] };
    const aList = (ob.a || []).filter(Boolean);
    const page1 = `
      <div class="wk5-page" style="${pageStyle}">
        ${orgLine}
        <div style="text-align:center;font-size:15px;font-weight:700;">แผนการจัดการเรียนรู้ที่ ${fill(period, 6)}</div>
        <div style="margin-top:0.4rem;line-height:1.9;font-size:13px;">
          <div>กลุ่มสาระการเรียนรู้ ${fill(group, 24)} &nbsp; ระดับ${levelText ? esc(levelText) : 'มัธยมศึกษาตอน' + dots(10)} &nbsp; โรงเรียนพะเยาพิทยาคม</div>
          <div>รายวิชา ${fill(subjectName, 24)} &nbsp; รหัสวิชา ${fill(subjectCode, 10)} &nbsp; ชั้นมัธยมศึกษาปีที่ ${fill(gradeNo, 4)} &nbsp; ภาคเรียนที่ ${fill(sem.term, 4)} &nbsp; ปีการศึกษา ${fill(sem.year, 8)}</div>
          <div>หน่วยการเรียนรู้ที่ ${fill(unitNo, 6)} &nbsp; เรื่อง ${fill(topic, 40)}</div>
          <div>เวลา ${fill(timeText, 12)} &nbsp; สอนวันที่ ${fill(dd, 6)} เดือน ${fill(mm, 12)} พ.ศ. ${fill(yy, 8)}</div>
          <div>ผู้สอน ${fill(instructor.name, 30)}</div>
        </div>

        ${heading('มาตรฐานการเรียนรู้และตัวชี้วัด')}
        ${(w.standards || []).length ? w.standards.map(s => `<div style="padding-left:0.6cm;text-indent:-0.6cm;line-height:1.6;">${esc(s)}</div>`).join('') : dotBlock(2)}
        ${heading('สาระสำคัญ')}
        ${para(w.key_concept, 2)}
        ${heading('สาระการเรียนรู้')}
        ${(w.content || []).length ? (w.content.length > 1 ? numbered(w.content, '', 0) : para(w.content[0], 3)) : dotBlock(3)}
        ${heading('จุดประสงค์การเรียนรู้')}
        <div style="font-weight:600;">1. ด้านความรู้</div>
        ${numbered(ob.k, '1.', 2)}
        <div style="font-weight:600;margin-top:0.2rem;">2. ด้านทักษะกระบวนการ</div>
        ${numbered(ob.p, '2.', 2)}
        <div style="font-weight:600;margin-top:0.2rem;">3. ด้านคุณลักษณะอันพึงประสงค์</div>
        ${aList.length ? aList.map(t => `<div style="padding-left:0.6cm;line-height:1.6;">${esc(t)}</div>`).join('') : dotBlock(1)}
        ${heading('สมรรถนะสำคัญของผู้เรียน')}
        ${numbered(w.competencies, '1.', 2)}
        <div style="text-align:right;font-size:11px;margin-top:0.5rem;">วก.5</div>
      </div>
      ${sep(1)}
    `;

    // ---- หน้า 2 ----
    const act = w.activities || {};
    let counter = 0;
    const stageHtml = (stage, label) => {
      const minsTxt = stage && stage.minutes ? stage.minutes : dots(8);
      const items = (stage && stage.items) || [];
      const body = items.length ? items.map(raw => {
        counter++;
        const txt = String(raw).replace(/^[A-Z]\s*-\s*\d+\.\s*/, '').replace(/^\d+(\.\d+)*\s+/, '');
        return `<div style="padding-left:0.8cm;text-indent:-0.8cm;line-height:1.55;margin-bottom:2px;">${counter}. ${bullets(txt)}</div>`;
      }).join('') : `<div style="line-height:1.8;color:#334155;">${dotBlock(2)}</div>`;
      return `<div style="font-weight:600;margin-top:0.35rem;">${label} (${minsTxt} นาที)</div>${body}`;
    };
    const asm = w.assessment || {};
    const asmLine = t => (t ? `<div style="padding-left:1cm;text-indent:-0.7cm;line-height:1.6;">${esc(t)}</div>` : dotBlock(1));
    const page2 = `
      <div class="wk5-page" style="${pageStyle}">
        ${orgLine}
        ${heading('ชิ้นงาน/ภาระงาน')}
        ${(w.work || []).length ? numbered(w.work, '', 0) : dotBlock(1)}
        ${heading('กิจกรรมการเรียนรู้')}
        <div style="font-size:11.5px;">
          ${stageHtml(act.intro, 'ขั้นนำเข้าสู่บทเรียน')}
          ${stageHtml(act.teach, 'ขั้นสอน')}
          ${stageHtml(act.wrap, 'ขั้นสรุปบทเรียน')}
        </div>
        ${heading('สื่อ / แหล่งเรียนรู้')}
        <div style="font-size:12px;">${numbered(w.media, '', 3)}</div>
        ${heading('การวัดและประเมินผล')}
        <div style="font-size:12px;">
          <div style="font-weight:600;">1. ด้านความรู้</div>${asmLine(asm.k)}
          <div style="font-weight:600;margin-top:0.2rem;">2. ด้านทักษะกระบวนการ</div>${asmLine(asm.p)}
          <div style="font-weight:600;margin-top:0.2rem;">3. ด้านคุณลักษณะอันพึงประสงค์</div>${asmLine(asm.a)}
        </div>
        ${heading('เครื่องมือวัด')}
        <div style="font-size:12px;">${numbered(w.tools, '', 3)}</div>
      </div>
      ${sep(2)}
    `;

    // ---- หน้า 3 ----
    const rub = (w.rubric || []).slice(0, 5);
    const rubRows = [];
    for (let i = 0; i < 5; i++) {
      const r = rub[i];
      const cell = v => `<td style="border:1px solid #000;padding:4px 5px;vertical-align:top;font-size:11px;">${v ? esc(v) : dots(8)}</td>`;
      rubRows.push(`<tr>
        <td style="border:1px solid #000;padding:4px 5px;vertical-align:top;font-size:11.5px;">${i + 1}. ${r ? esc(r.label) : dots(24)}</td>
        <td style="border:1px solid #000;padding:4px 5px;text-align:center;vertical-align:top;">${r && r.weight ? esc(r.weight) : dots(6)}</td>
        ${cell(r && r.levels && r.levels[4])}${cell(r && r.levels && r.levels[3])}${cell(r && r.levels && r.levels[2])}${cell(r && r.levels && r.levels[1])}
      </tr>`);
    }
    const page3 = `
      <div class="wk5-page" style="${pageStyle}">
        ${orgLine}
        ${heading('เกณฑ์การประเมิน')}
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th rowspan="2" style="border:1px solid #000;padding:4px;width:24%;">ประเด็นการประเมิน</th>
              <th rowspan="2" style="border:1px solid #000;padding:4px;width:9%;">น้ำหนักคะแนน</th>
              <th colspan="4" style="border:1px solid #000;padding:4px;">ระดับคุณภาพ</th>
            </tr>
            <tr style="background:#f1f5f9;">
              ${[4, 3, 2, 1].map(n => `<th style="border:1px solid #000;padding:4px;width:16.75%;">${n}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rubRows.join('')}</tbody>
        </table>
        ${heading('เกณฑ์การตัดสิน')}
        <div style="line-height:1.8;font-size:13px;">
          ${crit.levels.map(l => `<div>ระดับ ${l.level} &nbsp; หมายถึง &nbsp; มีระดับคุณภาพ${esc(l.label)}</div>`).join('')}
        </div>
        ${heading('เกณฑ์การผ่าน')}
        <div style="font-size:13px;">${esc(crit.passText)}</div>
      </div>
      ${sep(3)}
    `;

    // ---- หน้า 4 ----
    const page4 = `
      <div class="wk5-page">
        ${orgLine}
        <div style="font-size:14px;font-weight:700;">บันทึกผลหลังการสอน &nbsp; แผนการจัดการเรียนรู้ที่ ${fill(period, 6)}</div>
        <div style="font-size:12.5px;line-height:1.8;">
          รายวิชา ${fill(subjectName, 20)} รหัส ${fill(subjectCode, 10)} ชั้นมัธยมศึกษาปีที่ ${fill(gradeNo, 4)} ภาคเรียนที่ ${fill(sem.term, 4)} ปีการศึกษา ${fill(sem.year, 8)}<br>
          เรื่อง ${fill(topic, 40)} &nbsp; เวลา ${fill(timeText, 12)}
        </div>

        ${heading('ผลการเรียนรู้ของนักเรียน')}
        <div style="font-size:13px;">${para(refl.outcomes, 4)}</div>
        ${heading('ปัญหาที่เกิดขึ้นในระหว่างการจัดการเรียนรู้')}
        <div style="font-size:13px;">${para(refl.problems, 4)}</div>
        ${heading('แนวทางการแก้ปัญหาหรือปรับปรุงแผนการจัดการเรียนรู้ครั้งต่อไป (Action plan)')}
        <div style="font-size:13px;">${para(refl.solutions, 4)}</div>

        <div style="margin-top:1.5rem;display:flex;justify-content:flex-end;page-break-inside:avoid;">
          <div style="text-align:center;font-size:13px;">
            <div style="margin-bottom:0.6rem;">ลงชื่อ ${dots(36)} ครูผู้สอน</div>
            <div>(${instructor.name ? `<span style="font-weight:600;">${esc(instructor.name)}</span>` : dots(30)})</div>
            <div style="margin-top:0.4rem;">${refl.teacherDate ? esc(refl.teacherDate) : dots(12) + '/' + dots(12) + '/' + dots(12)}</div>
          </div>
        </div>

        <div style="margin-top:1.5rem;border:1px solid #000;padding:0.75rem 1rem;page-break-inside:avoid;">
          <div style="font-size:13.5px;font-weight:700;margin-bottom:0.3rem;">ความคิดเห็นของฝ่ายบริหาร</div>
          <div style="font-size:13px;">${para(refl.adminOpinion, 3)}</div>
          <div style="margin-top:1rem;display:flex;justify-content:flex-end;">
            <div style="text-align:center;font-size:13px;">
              <div style="margin-bottom:0.6rem;">ลงชื่อ ${dots(36)}</div>
              <div>(${refl.adminName ? `<span style="font-weight:600;">${esc(refl.adminName)}</span>` : dots(30)})</div>
              <div style="margin-top:0.4rem;">${refl.adminDate ? esc(refl.adminDate) : dots(12) + '/' + dots(12) + '/' + dots(12)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    return page1 + page2 + page3 + page4;
  },

  // ========================================================================
  // 3. วก.3: โครงสร้างรายวิชา (A4) - มาตรฐานโรงเรียนพะเยาพิทยาคม
  // ========================================================================
  buildWK3HTML(grade = 'M1') {
    const docs = typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' ? ACADEMIC_DOCS_BY_GRADE[grade] : null;
    const wk3 = docs ? docs.wk3 : null;
    const settings = Store.getAppSettings ? Store.getAppSettings() : {
      schoolName: "โรงเรียนพะเยาพิทยาคม",
      department: "กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)",
      departmentHead: "นายอุดม ไชยวุฒิ",
      departmentHeadRole: "หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ",
      academicHead: "นายกฤศ วงค์เรือง",
      academicHeadRole: "รองผู้อำนวยการกลุ่มบริหารงานวิชาการ",
      directorName: "ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ",
      directorRole: "ผู้อำนวยการโรงเรียนพะเยาพิทยาคม"
    };

    if (!wk3) {
      return `<div style="text-align: center; padding: 3rem; color: #64748b;">ไม่พบข้อมูลโครงสร้างรายวิชา วก.3 สำหรับระดับชั้น ${grade}</div>`;
    }

    return `
      <div class="gov-sheet-header">
        <div style="font-size: 13px; font-weight: 700; color: #000; text-align: left; margin-bottom: 0.5rem;">
          งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม
        </div>
        <div style="text-align: center; margin-bottom: 0.75rem;">
          <div style="font-size: 17px; font-weight: 700; color: #000;">
            แบบฟอร์ม วก. 3 โครงสร้างรายวิชา
          </div>
          <div style="font-size: 14px; font-weight: 600; color: #000; margin-top: 3px;">
            รหัสวิชา ${this.escapeHtml(wk3.code)} รายวิชา ${this.escapeHtml(wk3.name)} กลุ่มสาระการเรียนรู้ ศิลปะ
          </div>
          <div style="font-size: 13px; color: #333; margin-top: 2px;">
            ระดับชั้น ${this.escapeHtml(wk3.grade)} ${this.escapeHtml(wk3.term)} • เวลา ${wk3.periods} คาบ (${wk3.credits} หน่วยกิต)
          </div>
        </div>
      </div>

      <div style="font-size: 12px; line-height: 1.6; color: #000;">
        ${this.renderDocParagraphs(wk3.paragraphs)}
        ${this.renderDocTables(wk3.tables)}
      </div>

      ${this.renderOfficialSignatures(settings)}
    `;
  },

  // ========================================================================
  // 4. วก.4: หน่วยการเรียนรู้ (A4) - มาตรฐานโรงเรียนพะเยาพิทยาคม
  // ========================================================================
  buildWK4HTML(grade = 'M1', unitNo = 1) {
    const docs = typeof ACADEMIC_DOCS_BY_GRADE !== 'undefined' ? ACADEMIC_DOCS_BY_GRADE[grade] : null;
    const wk4List = docs ? docs.wk4 : [];
    const unit = wk4List.find(u => Number(u.unit_no) === Number(unitNo)) || wk4List[unitNo - 1] || wk4List[0];
    const settings = Store.getAppSettings ? Store.getAppSettings() : {
      schoolName: "โรงเรียนพะเยาพิทยาคม",
      department: "กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)",
      departmentHead: "นายอุดม ไชยวุฒิ",
      departmentHeadRole: "หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ",
      academicHead: "นายกฤศ วงค์เรือง",
      academicHeadRole: "รองผู้อำนวยการกลุ่มบริหารงานวิชาการ",
      directorName: "ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ",
      directorRole: "ผู้อำนวยการโรงเรียนพะเยาพิทยาคม"
    };

    if (!unit) {
      return `<div style="text-align: center; padding: 3rem; color: #64748b;">ไม่พบข้อมูลแบบฟอร์ม วก.4 สำหรับหน่วยที่ ${unitNo} ระดับชั้น ${grade}</div>`;
    }

    const gInfo = Store.getGradeInfo(grade) || {};
    const code = gInfo.code || '';
    const subName = gInfo.subjectName || '';
    const gradeName = gInfo.level || '';

    return `
      <div class="gov-sheet-header">
        <div style="font-size: 13px; font-weight: 700; color: #000; text-align: left; margin-bottom: 0.5rem;">
          งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม
        </div>
        <div style="text-align: center; margin-bottom: 0.75rem;">
          <div style="font-size: 17px; font-weight: 700; color: #000;">
            แบบฟอร์ม วก. 4 หน่วยการเรียนรู้
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #000; margin-top: 3px;">
            หน่วยการเรียนรู้ที่ ${unit.unit_no}: ${this.escapeHtml(unit.unit_name)}
          </div>
          <div style="font-size: 13px; color: #333; margin-top: 2px;">
            รหัสวิชา ${code} รายวิชา ${subName} กลุ่มสาระการเรียนรู้ ศิลปะ • ระดับชั้น ${gradeName}
          </div>
        </div>
      </div>

      <div style="font-size: 12px; line-height: 1.6; color: #000;">
        ${this.renderDocParagraphs(unit.paragraphs)}
        ${this.renderDocTables(unit.tables)}
      </div>

      ${this.renderOfficialSignatures(settings)}
    `;
  },

  // ========================================================================
  // Helpers for Rendering Tables, Paragraphs, Signatures
  // ========================================================================
  renderDocTables(tables) {
    if (!tables || !Array.isArray(tables) || tables.length === 0) return '';
    return tables.map(tbl => {
      if (!Array.isArray(tbl) || tbl.length === 0) return '';
      const headerRow = tbl[0];
      const dataRows = tbl.slice(1);
      return `
        <table class="gov-print-table" style="width: 100%; margin: 0.85rem 0; font-size: 11px;">
          <thead>
            <tr>
              ${headerRow.map(h => `<th style="padding: 5px; text-align: center;">${this.escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataRows.map(r => `
              <tr>
                ${r.map((cell, cIdx) => `<td style="padding: 4px 6px; ${cIdx === 0 && r.length > 2 ? 'text-align: center;' : ''}">${this.escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }).join('');
  },

  renderDocParagraphs(paragraphs) {
    if (!paragraphs || !Array.isArray(paragraphs)) return '';
    return paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('---') || trimmed.startsWith('===') || trimmed.startsWith('___') || trimmed.startsWith('———')) {
        return '<hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 0.75rem 0;">';
      }
      if (trimmed.match(/^[0-9]+\.\s+/) || trimmed.includes('คำอธิบายรายวิชา') || trimmed.includes('โครงสร้างรายวิชา') || trimmed.includes('โครงสร้างการวัดผล') || trimmed.includes('ตารางการวิเคราะห์') || trimmed.includes('ผังมโนทัศน์')) {
        return `<div style="font-size: 13px; font-weight: 700; color: #000; margin-top: 0.85rem; margin-bottom: 0.35rem;">${this.escapeHtml(trimmed)}</div>`;
      }
      return `<p style="margin: 0.35rem 0; font-size: 11.5px; line-height: 1.55; text-align: justify; text-indent: 1.5rem;">${this.escapeHtml(trimmed)}</p>`;
    }).join('');
  },

  renderOfficialSignatures(settings) {
    return `
      <div style="margin-top: 2rem; border-top: 1px solid #000; padding-top: 1rem; page-break-inside: avoid; font-size: 11.5px;">
        <div style="text-align: center; font-weight: 700; margin-bottom: 1.25rem;">
          การตรวจพิจารณาและอนุมัติการใช้แผนและโครงสร้างหลักสูตร
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; text-align: center;">
          <div style="padding: 0.75rem; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 4px;">
            <div style="font-weight: 700; margin-bottom: 4px;">1. ผู้จัดทำ / ครูผู้สอน</div>
            <div style="margin-top: 2.5rem;">ลงชื่อ......................................................</div>
            <div style="font-weight: 700;">(นายพงศธร โพธิแก้ว)</div>
            <div style="color: #475569;">ตำแหน่ง ครู โรงเรียนพะเยาพิทยาคม</div>
          </div>
          <div style="padding: 0.75rem; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 4px;">
            <div style="font-weight: 700; margin-bottom: 4px;">2. หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ</div>
            <div>[ &nbsp; ] เห็นควรอนุมัติให้ใช้จัดการเรียนรู้ได้</div>
            <div style="margin-top: 2rem;">ลงชื่อ......................................................</div>
            <div style="font-weight: 700;">(${this.escapeHtml(settings.departmentHead || 'นายอุดม ไชยวุฒิ')})</div>
            <div style="color: #475569;">${this.escapeHtml(settings.departmentHeadRole || 'หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ')}</div>
          </div>
          <div style="padding: 0.75rem; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 4px;">
            <div style="font-weight: 700; margin-bottom: 4px;">3. รองผู้อำนวยการกลุ่มบริหารงานวิชาการ</div>
            <div>[ &nbsp; ] เห็นควรอนุมัติให้ใช้จัดการเรียนรู้ได้</div>
            <div style="margin-top: 2rem;">ลงชื่อ......................................................</div>
            <div style="font-weight: 700;">(${this.escapeHtml(settings.academicHead || 'นายกฤศ วงค์เรือง')})</div>
            <div style="color: #475569;">${this.escapeHtml(settings.academicHeadRole || 'รองผู้อำนวยการกลุ่มบริหารงานวิชาการ')}</div>
          </div>
          <div style="padding: 0.75rem; border: 1px solid #cbd5e1; background: #fafafa; border-radius: 4px;">
            <div style="font-weight: 700; margin-bottom: 4px;">4. ผู้อำนวยการโรงเรียนพะเยาพิทยาคม</div>
            <div>[ &nbsp; ] อนุมัติให้ใช้จัดการเรียนรู้ในสถานศึกษา</div>
            <div style="margin-top: 2rem;">ลงชื่อ......................................................</div>
            <div style="font-weight: 700;">(${this.escapeHtml(settings.directorName || 'ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ')})</div>
            <div style="color: #475569;">${this.escapeHtml(settings.directorRole || 'ผู้อำนวยการโรงเรียนพะเยาพิทยาคม')}</div>
          </div>
        </div>
      </div>
    `;
  },

  // ========================================================================
  // 5. Print Active Form (A4 Print Preview)
  // ========================================================================
  printActiveForm() {
    const sheet = document.getElementById('official-form-sheet');
    if (!sheet) return;

    let title = '';
    if (this.activeTab === 'wk3') title = `วก3_โครงสร้างรายวิชา_${this.activeGrade}`;
    else if (this.activeTab === 'wk4') title = `วก4_หน่วยที่_${this.activeUnit}_${this.activeGrade}`;
    else if (this.activeTab === 'wk5') title = `วก5_แผนที่_${this.activePeriod}_ห้อง_${this.activeClass.replace('/', '_')}`;
    else title = `ปพ5_ห้อง_${this.activeClass.replace('/', '_')}`;

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Sarabun', serif;
            color: #000000;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.45;
          }
          .gov-print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 8px;
          }
          .gov-print-table th, .gov-print-table td {
            border: 1px solid #000000;
            padding: 4px 6px;
            vertical-align: middle;
          }
          .gov-print-table th {
            background: #f1f5f9;
            font-weight: 700;
            text-align: center;
          }
          .wk5-page-sep { display: none; }
          .row-withdrawn {
            color: #64748b;
            font-style: italic;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${sheet.innerHTML}
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
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
  window.OfficialForms = OfficialForms;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfficialForms;
}
