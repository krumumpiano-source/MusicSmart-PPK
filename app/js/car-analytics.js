// ==========================================================================
// CAR Research Analytics Engine (ระบบคำนวณสถิติวิจัยในชั้นเรียนสำหรับ วPA คศ.4)
// นวัตกรรมรูปแบบ T-PACE ร่วมกับระบบนิเวศการเรียนรู้ดิจิทัล • โรงเรียนพะเยาพิทยาคม
// 100% Dynamic - Zero Hardcoding
// ==========================================================================

const CARAnalytics = {
  activeClass: 'ม.1/1',
  isEditingScores: false,

  openModal(className = null) {
    const modal = document.getElementById('modal-car-analytics');
    if (!modal) return;

    if (className) this.activeClass = className;
    else if (typeof App !== 'undefined') this.activeClass = App.state.selectedClass || 'ม.1/1';

    modal.classList.add('active');
    this.renderClassSelector();
    this.renderAnalytics();
  },

  closeModal() {
    const modal = document.getElementById('modal-car-analytics');
    if (modal) modal.classList.remove('active');
    this.isEditingScores = false;
  },

  renderClassSelector() {
    const sel = document.getElementById('car-class-select');
    if (!sel) return;
    sel.innerHTML = '';

    const classes = Store.getAllClasses
      ? [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')]
      : ['ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.1/4', 'ม.1/5', 'ม.1/6', 'ม.1/7', 'ม.1/14', 'ม.2/1', 'ม.2/2', 'ม.2/3', 'ม.2/4', 'ม.2/5', 'ม.2/6', 'ม.2/7', 'ม.2/14'];
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `ห้อง ${c}`;
      if (c === this.activeClass) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.onchange = (e) => {
      this.activeClass = e.target.value;
      this.renderAnalytics();
    };
  },

  _tTwoTailP(t, df) {
    if (typeof EvidenceCore !== 'undefined' && EvidenceCore && typeof EvidenceCore.tTwoTailP === 'function') {
      return EvidenceCore.tTwoTailP(t, df);
    }
    if (typeof t !== 'number' || !Number.isFinite(t) || !(df > 0)) return null;
    const lgamma = (x) => {
      const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
      let y = x, tmp = x + 5.5, s = 1.000000000190015;
      tmp -= (x + 0.5) * Math.log(tmp);
      for (let j = 0; j < 6; j++) { y += 1; s += c[j] / y; }
      return -tmp + Math.log(2.5066282746310005 * s / x);
    };
    const betacf = (a, b, x) => {
      const MAXIT = 300, EPS = 3e-12, FPMIN = 1e-300;
      const qab = a + b, qap = a + 1, qam = a - 1;
      let c = 1, d = 1 - qab * x / qap;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      d = 1 / d;
      let h = d;
      for (let m = 1; m <= MAXIT; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
      }
      return h;
    };
    const ibeta = (x, a, b) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
      if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
      return 1 - bt * betacf(b, a, 1 - x) / b;
    };
    return ibeta(df / (df + t * t), df / 2, 0.5);
  },

  _formatPValue(pVal) {
    if (pVal === null || pVal === undefined || !Number.isFinite(pVal)) return 'ยังไม่มีข้อมูล';
    if (pVal < 0.001) return '< .001';
    return pVal.toFixed(3);
  },

  // Calculate Pre/Post and Formative metrics dynamically with ZERO hardcoding
  computeStats(className) {
    const students = Store.getStudents(className) || [];
    const activeStudents = students.filter(s => !Store.isStudentWithdrawn(s.student_id));
    const savedScores = Store.getResearchScores ? Store.getResearchScores(className) : {};
    const hasNum = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

    const studentData = [];

    activeStudents.forEach((s) => {
      const saved = savedScores[s.student_id];
      const qAttempt = (typeof QuizEngine !== 'undefined') ? QuizEngine.getStudentAttempt(s.student_id, 1) : null;
      const preQuiz = (typeof QuizEngine !== 'undefined') ? QuizEngine.getStudentAttempt(s.student_id, 'pre') : null;
      const rubricSaved = Store.getStudentRubric ? Store.getStudentRubric(s.student_id, 1) : null;

      let preScore = null, postScore = null, formScore = null;

      if (saved && hasNum(saved.pre)) {
        preScore = Math.min(10, Math.max(0, Number(saved.pre)));
      } else if (preQuiz && hasNum(preQuiz.score)) {
        preScore = Math.min(10, Math.max(0, Number(preQuiz.score)));
      }

      if (saved && hasNum(saved.post)) {
        postScore = Math.min(10, Math.max(0, Number(saved.post)));
      } else if (qAttempt && hasNum(qAttempt.score)) {
        postScore = Math.min(10, Math.max(0, Number(qAttempt.score)));
      }

      if (saved && hasNum(saved.formative)) {
        formScore = Math.min(10, Math.max(0, Number(saved.formative)));
      } else if (rubricSaved && hasNum(rubricSaved.percentage)) {
        formScore = Math.min(10, Math.round(((Number(rubricSaved.percentage)) / 10) * 10) / 10);
      }

      const hasPair = preScore !== null && postScore !== null;
      const diff = hasPair ? Math.round((postScore - preScore) * 100) / 100 : null;
      const gain = (hasPair && (10 - preScore) > 0)
        ? Math.round(((postScore - preScore) / (10 - preScore)) * 100) / 100
        : null;

      studentData.push({
        no: s.no,
        id: s.student_id,
        name: `${s.prefix}${s.first_name} ${s.last_name}`,
        pre: preScore,
        post: postScore,
        diff: diff,
        gain: gain,
        formative: formScore !== null ? Math.round(formScore * 10) / 10 : null
      });
    });

    const preList = studentData.filter(st => st.pre !== null);
    const postList = studentData.filter(st => st.post !== null);
    const formList = studentData.filter(st => st.formative !== null);
    const paired = studentData.filter(st => st.pre !== null && st.post !== null);
    const n = paired.length;
    const totalStudents = activeStudents.length;
    const hasData = paired.length > 0;

    const meanPreRaw = preList.length > 0 ? preList.reduce((acc, st) => acc + st.pre, 0) / preList.length : null;
    const meanPostRaw = postList.length > 0 ? postList.reduce((acc, st) => acc + st.post, 0) / postList.length : null;

    let sdPreRaw = null;
    if (preList.length >= 2 && meanPreRaw !== null) {
      const sq = preList.reduce((acc, st) => acc + Math.pow(st.pre - meanPreRaw, 2), 0);
      sdPreRaw = Math.sqrt(sq / (preList.length - 1));
    }

    let sdPostRaw = null;
    if (postList.length >= 2 && meanPostRaw !== null) {
      const sq = postList.reduce((acc, st) => acc + Math.pow(st.post - meanPostRaw, 2), 0);
      sdPostRaw = Math.sqrt(sq / (postList.length - 1));
    }

    let meanDiffRaw = null, tValRaw = null, pValRaw = null, cohensDRaw = null, overallGainRaw = null;
    if (paired.length > 0) {
      const sumD = paired.reduce((acc, st) => acc + (st.post - st.pre), 0);
      const sumD2 = paired.reduce((acc, st) => acc + Math.pow(st.post - st.pre, 2), 0);
      meanDiffRaw = sumD / paired.length;

      const pairedMeanPre = paired.reduce((acc, st) => acc + st.pre, 0) / paired.length;
      const pairedMeanPost = paired.reduce((acc, st) => acc + st.post, 0) / paired.length;
      const pairedPctPre = (pairedMeanPre / 10) * 100;
      const pairedPctPost = (pairedMeanPost / 10) * 100;
      if (100 - pairedPctPre > 0) {
        overallGainRaw = (pairedPctPost - pairedPctPre) / (100 - pairedPctPre);
      }

      if (paired.length >= 2) {
        const varD = ((paired.length * sumD2) - (sumD * sumD)) / (paired.length * (paired.length - 1));
        const sdDiff = varD > 0 ? Math.sqrt(varD) : 0;
        const denom = Math.sqrt(((paired.length * sumD2) - (sumD * sumD)) / (paired.length - 1));
        if (denom > 0 && sdDiff > 0) {
          tValRaw = sumD / denom;
          cohensDRaw = meanDiffRaw / sdDiff;
          pValRaw = this._tTwoTailP(tValRaw, paired.length - 1);
        }
      }
    }

    const pctPreRaw = meanPreRaw !== null ? (meanPreRaw / 10) * 100 : null;
    const pctPostRaw = meanPostRaw !== null ? (meanPostRaw / 10) * 100 : null;
    const e1 = formList.length > 0
      ? Math.round(((formList.reduce((acc, st) => acc + st.formative, 0) / formList.length) / 10) * 1000) / 10
      : null;
    const e2 = meanPostRaw !== null
      ? Math.round((meanPostRaw / 10) * 1000) / 10
      : null;

    let gainLevel = 'ยังไม่มีข้อมูล';
    if (overallGainRaw !== null) {
      gainLevel = 'ปานกลาง (Medium)';
      if (overallGainRaw >= 0.70) gainLevel = 'สูง (High)';
      else if (overallGainRaw < 0.30) gainLevel = 'ต่ำ (Low)';
    }

    const overallGain = overallGainRaw !== null ? Math.round(overallGainRaw * 100) / 100 : null;
    const pVal = pValRaw !== null ? Math.round(pValRaw * 10000) / 10000 : null;

    return {
      className,
      n,
      totalStudents,
      hasData,
      meanPre: meanPreRaw !== null ? Math.round(meanPreRaw * 100) / 100 : null,
      sdPre: sdPreRaw !== null ? Math.round(sdPreRaw * 100) / 100 : null,
      meanPost: meanPostRaw !== null ? Math.round(meanPostRaw * 100) / 100 : null,
      sdPost: sdPostRaw !== null ? Math.round(sdPostRaw * 100) / 100 : null,
      meanDiff: meanDiffRaw !== null ? Math.round(meanDiffRaw * 100) / 100 : null,
      tVal: tValRaw !== null ? Math.round(tValRaw * 1000) / 1000 : null,
      pVal,
      cohensD: cohensDRaw !== null ? Math.round(cohensDRaw * 100) / 100 : null,
      pctPre: pctPreRaw !== null ? Math.round(pctPreRaw * 10) / 10 : null,
      pctPost: pctPostRaw !== null ? Math.round(pctPostRaw * 10) / 10 : null,
      overallGain,
      gainScore: overallGainRaw !== null ? Math.round(overallGainRaw * 1000) / 10 : null,
      gainLevel,
      e1,
      e2,
      e1Score: e1,
      e2Score: e2,
      eStandard: '80/80',
      isEPassed: (e1 !== null && e2 !== null && e1 >= 80 && e2 >= 80),
      students: studentData
    };
  },

  renderAnalytics() {
    const stats = this.computeStats(this.activeClass);
    const container = document.getElementById('car-analytics-display');
    if (!container) return;

    const settings = Store.getAppSettings ? Store.getAppSettings() : {
      researchTitle: "การพัฒนาทักษะการปฏิบัติเครื่องดนตรีคาลิมบ้าและการขับร้องโดยใช้รูปแบบการจัดการเรียนรู้เชิงรุก T-PACE Framework ร่วมกับแอปพลิเคชัน MusicSmart สำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 1",
      schoolName: "โรงเรียนพะเยาพิทยาคม"
    };

    const fmt = (v, suffix = '') => (v === null || v === undefined) ? 'ยังไม่มีข้อมูล' : `${v}${suffix}`;
    const pText = this._formatPValue(stats.pVal);
    const sigStars = (stats.pVal !== null && stats.pVal < 0.01) ? '**' : ((stats.pVal !== null && stats.pVal < 0.05) ? '*' : '');
    const tDisplay = stats.tVal !== null ? `${stats.tVal}${sigStars}` : 'ยังไม่มีข้อมูล';
    const diffDisplay = stats.meanDiff !== null ? `${stats.meanDiff >= 0 ? '+' : ''}${stats.meanDiff}` : 'ยังไม่มีข้อมูล';

    container.innerHTML = `
      <!-- Research Overview Hero Card -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; padding: 1.5rem 1.75rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div style="flex: 1; min-width: 300px;">
            <div style="font-size: 0.82rem; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">
              Classroom Action Research (CAR) • โครงร่างเตรียมความพร้อม
            </div>
            <h3 style="font-size: 1.15rem; font-weight: 700; margin: 4px 0 6px 0; color: #ffffff; line-height: 1.4;">
              ${this.escapeHtml(settings.researchTitle)}
            </h3>
            <div style="font-size: 0.85rem; color: #cbd5e1;">
              กลุ่มเป้าหมาย: นักเรียนชั้น ${stats.className} ${this.escapeHtml(settings.schoolName)} (จำนวนที่มีผลเปรียบเทียบ N = ${stats.n} / ทั้งหมด ${stats.totalStudents} คน)
            </div>
            <div style="margin-top: 8px; display: inline-block; background: rgba(254, 240, 138, 0.2); border: 1px solid #fde047; color: #fef08a; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;">
              📌 สถานะ: ${stats.hasData ? 'คำนวณจากข้อมูลจริงที่มีในระบบ' : 'ยังไม่มีข้อมูลผลสอบจริง (ไม่สร้างตัวเลขจำลอง)'}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn-nav-action" style="background: ${this.isEditingScores ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)'}; border: 1px solid rgba(255, 255, 255, 0.3); color: #ffffff;" onclick="CARAnalytics.toggleEditScores()">
              ${this.isEditingScores ? '💾 บันทึกคะแนนวิจัย' : '✏️ ปรับแก้คะแนนวิจัย'}
            </button>
            <button class="btn-nav-action" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: #ffffff;" onclick="CARAnalytics.exportCSV()">
              📥 ดาวน์โหลด CSV
            </button>
            <button class="btn-nav-action primary" style="background: #38bdf8; color: #0f172a; font-weight: 700; border: none;" onclick="CARAnalytics.copyApaTable()">
              📋 คัดลอกตารางวิจัย (Word/วPA)
            </button>
            <button class="btn-nav-action primary" style="background: #10b981; color: #ffffff; font-weight: 700; border: none;" onclick="CARAnalytics.openFullReportModal()">
              📄 พิมพ์เล่มวิจัย 5 บท (วก.7)
            </button>
          </div>
        </div>
      </div>

      <!-- Metric Stat Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <!-- Card 1: Pre-test Mean -->
        <div class="stat-card-clean" style="background: #ffffff; padding: 1.15rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">คะแนนก่อนเรียน (Pre-test)</div>
          <div style="font-size: 1.85rem; font-weight: 800; color: #d97706; margin-top: 2px;">
            ${fmt(stats.meanPre)} <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">${stats.sdPre !== null ? `(S.D. ${stats.sdPre})` : ''}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">${stats.pctPre !== null ? `คิดเป็นร้อยละ ${stats.pctPre}%` : 'ยังไม่มีข้อมูล'}</div>
        </div>

        <!-- Card 2: Post-test Mean -->
        <div class="stat-card-clean" style="background: #ffffff; padding: 1.15rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); border-left: 4px solid #16a34a;">
          <div style="font-size: 0.78rem; font-weight: 700; color: #16a34a;">คะแนนหลังเรียน (Post-test)</div>
          <div style="font-size: 1.85rem; font-weight: 800; color: #16a34a; margin-top: 2px;">
            ${fmt(stats.meanPost)} <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">${stats.sdPost !== null ? `(S.D. ${stats.sdPost})` : ''}</span>
          </div>
          <div style="font-size: 0.78rem; color: #15803d; margin-top: 4px;">${stats.pctPost !== null ? `คิดเป็นร้อยละ ${stats.pctPost}%${stats.pctPre !== null ? ` (${stats.pctPost - stats.pctPre >= 0 ? '+' : ''}${Math.round((stats.pctPost - stats.pctPre)*10)/10}%)` : ''}` : 'ยังไม่มีข้อมูล'}</div>
        </div>

        <!-- Card 3: Normalized Gain -->
        <div class="stat-card-clean" style="background: #ffffff; padding: 1.15rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); border-left: 4px solid var(--ppk-blue);">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--ppk-blue);">พัฒนาการสัมพัทธ์ (&lt;g&gt;)</div>
          <div style="font-size: 1.85rem; font-weight: 800; color: var(--ppk-navy-dark); margin-top: 2px;">
            ${fmt(stats.overallGain)}
          </div>
          <div style="font-size: 0.78rem; color: var(--ppk-blue); font-weight: 600; margin-top: 4px;">ระดับพัฒนาการ: ${stats.gainLevel}</div>
        </div>

        <!-- Card 4: E1 / E2 Efficiency -->
        <div class="stat-card-clean" style="background: #ffffff; padding: 1.15rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">ประสิทธิภาพนวัตกรรม (E1/E2)</div>
          <div style="font-size: 1.85rem; font-weight: 800; color: #7c3aed; margin-top: 2px;">
            ${stats.e1 !== null || stats.e2 !== null ? `${fmt(stats.e1)} / ${fmt(stats.e2)}` : 'ยังไม่มีข้อมูล'}
          </div>
          <div style="font-size: 0.78rem; color: ${stats.isEPassed ? '#16a34a' : '#d97706'}; font-weight: 600; margin-top: 4px;">
            ${stats.e1 !== null && stats.e2 !== null ? (stats.isEPassed ? '✅ สูงกว่าเกณฑ์ 80/80 ที่ตั้งไว้' : 'ต่ำกว่าเกณฑ์ 80/80') : 'ยังไม่มีข้อมูล'}
          </div>
        </div>
      </div>

      <!-- Formal APA Research Summary Table (สำหรับรายงาน วก.7 และ วPA) -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--ppk-navy-dark); margin: 0;">
            ตารางที่ 1: การเปรียบเทียบผลสัมฤทธิ์ก่อนเรียนและหลังเรียนด้วย t-test Dependent (N = ${stats.n})
          </h4>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            ${stats.pVal !== null ? 'คำนวณจากข้อมูลจริง' : 'ยังไม่มีข้อมูลสำหรับคำนวณ t-test'}
          </span>
        </div>

        <table class="academic-table" id="car-apa-table" style="font-size: 0.88rem;">
          <thead>
            <tr>
              <th style="text-align: left;">การทดสอบ</th>
              <th style="text-align: center;">N</th>
              <th style="text-align: center;">คะแนนเต็ม</th>
              <th style="text-align: center;">ค่าเฉลี่ย (&macr;X)</th>
              <th style="text-align: center;">S.D.</th>
              <th style="text-align: center;">ผลต่าง (&macr;D)</th>
              <th style="text-align: center;">t-value</th>
              <th style="text-align: center;">p-value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ก่อนเรียน (Pre-test)</td>
              <td style="text-align: center;">${stats.n}</td>
              <td style="text-align: center;">10</td>
              <td style="text-align: center; font-weight: 600;">${fmt(stats.meanPre)}</td>
              <td style="text-align: center;">${fmt(stats.sdPre)}</td>
              <td rowspan="2" style="text-align: center; font-weight: 700; vertical-align: middle; color: #16a34a;">${diffDisplay}</td>
              <td rowspan="2" style="text-align: center; font-weight: 800; vertical-align: middle; color: var(--ppk-blue); font-size: 1rem;">${tDisplay}</td>
              <td rowspan="2" style="text-align: center; font-weight: 700; vertical-align: middle; color: #16a34a;">${this.escapeHtml(pText)}</td>
            </tr>
            <tr>
              <td>หลังเรียน (Post-test)</td>
              <td style="text-align: center;">${stats.n}</td>
              <td style="text-align: center;">10</td>
              <td style="text-align: center; font-weight: 700; color: #16a34a;">${fmt(stats.meanPost)}</td>
              <td style="text-align: center;">${fmt(stats.sdPost)}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; margin-top: 0.75rem; background: var(--bg-subtle); padding: 0.75rem 1rem; border-radius: 4px;">
          ${stats.hasData
            ? `<strong>บทสรุปเชิงสถิติ:</strong> นักเรียนชั้น ${stats.className} (N = ${stats.n}) มีคะแนนหลังเรียนเฉลี่ย (&macr;X = ${fmt(stats.meanPost)}, S.D. = ${fmt(stats.sdPost)}) เปรียบเทียบกับก่อนเรียน (&macr;X = ${fmt(stats.meanPre)}, S.D. = ${fmt(stats.sdPre)}) ผลต่างเฉลี่ย ${diffDisplay} (${stats.tVal !== null ? `t = ${stats.tVal}, p = ${this.escapeHtml(pText)}` : 'ยังไม่สามารถคำนวณค่า t/p ได้'}) และมีค่าพัฒนาการสัมพัทธ์ &lt;g&gt; เท่ากับ ${fmt(stats.overallGain)} (${stats.gainLevel})`
            : `<strong>บทสรุปเชิงสถิติ:</strong> ยังไม่มีข้อมูลคะแนนก่อนเรียนและหลังเรียนสำหรับคำนวณสถิติของชั้น ${stats.className}`}
        </div>
      </div>

      <!-- Student Individual Roster Sample (With Optional Dynamic Score Inputs) -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--ppk-navy-dark); margin: 0;">
            ตารางบันทึกข้อมูลรายบุคคล (Raw Data Log) ${this.isEditingScores ? '• [โหมดป้อนคะแนนจริง]' : ''}
          </h4>
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            ${this.isEditingScores ? 'กรอกคะแนน (0-10) แล้วกดปุ่ม "บันทึกคะแนนวิจัย"' : 'ดึงคะแนนจริงจากแบบทดสอบและแบบประเมิน'}
          </span>
        </div>

        <div style="max-height: 320px; overflow-y: auto;">
          <table class="academic-table" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th style="width: 8%; text-align: center;">เลขที่</th>
                <th style="width: 14%; text-align: center;">รหัสนักเรียน</th>
                <th style="width: 32%;">ชื่อ - นามสกุล</th>
                <th style="width: 13%; text-align: center;">ก่อนเรียน (10)</th>
                <th style="width: 13%; text-align: center;">หลังเรียน (10)</th>
                <th style="width: 10%; text-align: center;">ผลต่าง (+D)</th>
                <th style="width: 10%; text-align: center;">Gain (&lt;g&gt;)</th>
              </tr>
            </thead>
            <tbody>
              ${stats.students.map(st => `
                <tr>
                  <td style="text-align: center;">${st.no}</td>
                  <td style="text-align: center; color: var(--text-muted);">${st.id}</td>
                  <td style="font-weight: 600;">${this.escapeHtml(st.name)}</td>
                  <td style="text-align: center;">
                    ${this.isEditingScores ? `
                      <input type="number" min="0" max="10" step="0.5" class="form-input car-score-input" data-student-id="${st.id}" data-field="pre" value="${st.pre !== null ? st.pre : ''}" placeholder="-" style="width: 60px; padding: 2px 4px; text-align: center; font-size: 0.82rem;">
                    ` : fmt(st.pre)}
                  </td>
                  <td style="text-align: center; font-weight: 700; color: #16a34a;">
                    ${this.isEditingScores ? `
                      <input type="number" min="0" max="10" step="0.5" class="form-input car-score-input" data-student-id="${st.id}" data-field="post" value="${st.post !== null ? st.post : ''}" placeholder="-" style="width: 60px; padding: 2px 4px; text-align: center; font-size: 0.82rem; color: #16a34a; font-weight: 700;">
                    ` : fmt(st.post)}
                  </td>
                  <td style="text-align: center; font-weight: 600; color: #0284c7;">${st.diff !== null ? (st.diff >= 0 ? '+' + st.diff : st.diff) : 'ยังไม่มีข้อมูล'}</td>
                  <td style="text-align: center; font-weight: 700;">${fmt(st.gain)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  toggleEditScores() {
    if (this.isEditingScores) {
      // Save scores from input fields
      const inputs = document.querySelectorAll('.car-score-input');
      const scores = Store.getResearchScores(this.activeClass);

      inputs.forEach(inp => {
        const sid = inp.getAttribute('data-student-id');
        const field = inp.getAttribute('data-field');
        const raw = String(inp.value ?? '').trim();
        if (!scores[sid]) scores[sid] = {};
        if (raw === '') {
          delete scores[sid][field];
        } else {
          const val = parseFloat(raw);
          if (Number.isFinite(val)) scores[sid][field] = val;
        }
      });

      Store.saveResearchScores(this.activeClass, scores);
      this.isEditingScores = false;
      this.renderAnalytics();
      alert('✅ บันทึกคะแนนวิจัยในชั้นเรียนเรียบร้อยแล้ว ระบบคำนวณสถิติใหม่ทันที');
    } else {
      this.isEditingScores = true;
      this.renderAnalytics();
    }
  },

  exportCSV() {
    const stats = this.computeStats(this.activeClass);
    const cell = (v) => (v === null || v === undefined) ? 'ยังไม่มีข้อมูล' : v;
    let csv = "เลขที่,รหัสนักเรียน,ชื่อ-สกุล,ก่อนเรียน(10),หลังเรียน(10),ผลต่าง,Normalized_Gain\n";
    stats.students.forEach(st => {
      csv += `${st.no},${st.id},"${st.name}",${cell(st.pre)},${cell(st.post)},${cell(st.diff)},${cell(st.gain)}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CAR_Research_Stats_${this.activeClass.replace('/', '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  copyApaTable() {
    const table = document.getElementById('car-apa-table');
    if (!table) return;

    const range = document.createRange();
    range.selectNode(table);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    try {
      document.execCommand('copy');
      alert('คัดลอกตารางสรุปผลสถิติวิจัย (APA Table) แล้ว สามารถนำไปวาง (Paste) ลงในเอกสาร Word หรือรายงาน วPA ได้ทันที!');
    } catch (err) {
      alert('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาลากคลุมตารางแล้วกด Ctrl+C');
    }
    window.getSelection().removeAllRanges();
  },

  // --- Official 5-Chapter CAR Research Report Generator (วก.7 ฉบับเต็ม) ---
  openFullReportModal() {
    alert('📌 แบบฟอร์มเล่มวิจัย 5 บท (วก.7): ขณะนี้อยู่ในสถานะโครงร่างเตรียมความพร้อม และปล่อยว่างข้อมูลวิจัยไว้ตามข้อกำหนด โดยระบบจะสร้างเล่มรายงานวิจัยฉบับสมบูรณ์อัตโนมัติเมื่อเริ่มจัดการเรียนการสอนและเก็บคะแนนนักเรียนจริงในภาคเรียนครับ');
  },

  closeFullReportModal() {
    const modal = document.getElementById('modal-car-full-report');
    if (modal) modal.classList.remove('active');
  },

  buildFullReportHTML(className) {
    const stats = this.computeStats(className);
    const settings = Store.getAppSettings ? Store.getAppSettings() : null;
    const instructor = Store.getInstructor ? Store.getInstructor() : { name: 'คุณครูพงศธร โพธิแก้ว', role: 'ครูประจำวิชา' };

    const schoolName = (settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม';
    const deptName = (settings && settings.department) || 'กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)';
    const deptHead = (settings && settings.departmentHead) || 'นายอุดม ไชยวุฒิ';
    const academicHead = (settings && settings.academicHead) || 'นายกฤศ วงค์เรือง';
    const academicHeadRole = (settings && settings.academicHeadRole) || 'รองผู้อำนวยการกลุ่มบริหารงานวิชาการ';
    const directorName = (settings && settings.directorName) || 'ว่าที่ร้อยตรีญาณบดินทร์ อินเตชะ';
    const directorRole = (settings && settings.directorRole) || 'ผู้อำนวยการโรงเรียนพะเยาพิทยาคม';
    const researchTitle = (settings && settings.researchTitle) || 'การพัฒนาระบบนิเวศการเรียนรู้ดนตรีดิจิทัลรูปแบบ T-PACE เพื่อส่งเสริมผลสัมฤทธิ์ทางการเรียนและทักษะการปฏิบัติเครื่องดนตรีคาลิมบ้า สำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 1';
    const appName = (settings && settings.appName) || 'MusicSmart';
    const term = Store.getSemesterInfo().label;

    const fmt = (v, suffix = '') => (v === null || v === undefined) ? 'ยังไม่มีข้อมูล' : `${v}${suffix}`;
    const pText = this._formatPValue(stats.pVal);
    const sigStars = (stats.pVal !== null && stats.pVal < 0.01) ? '**' : ((stats.pVal !== null && stats.pVal < 0.05) ? '*' : '');
    const tDisplay = stats.tVal !== null ? `${stats.tVal}${sigStars}` : 'ยังไม่มีข้อมูล';

    return `
      <div class="official-paperwork" style="max-width: 900px; margin: 0 auto; font-family: 'Sarabun', serif; line-height: 1.7; color: #111827;">
        
        <!-- Report Cover Header -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 1.5rem; margin-bottom: 2rem;">
          <div style="font-size: 1.1rem; font-weight: 700; color: #475569;">แบบฟอร์ม วก.7 (ฉบับสมบูรณ์)</div>
          <h1 style="font-size: 1.45rem; font-weight: 800; margin: 0.75rem 0; line-height: 1.4;">
            รายงานการวิจัยปฏิบัติการในชั้นเรียน (Classroom Action Research: CAR)<br>
            ประกอบการประเมินข้อตกลงในการพัฒนางาน (วPA)
          </h1>
          <div style="font-size: 1.15rem; font-weight: 700; color: #1e3a8a; margin-top: 0.5rem;">
            เรื่อง: ${this.escapeHtml(researchTitle)}
          </div>
          <div style="font-size: 0.95rem; margin-top: 0.65rem; color: #334155;">
            ผู้วิจัย: <strong>${this.escapeHtml(instructor.name)}</strong> (${this.escapeHtml(instructor.role)})<br>
            กลุ่มเป้าหมาย: นักเรียนชั้น${this.escapeHtml((Store.getGradeInfo(Store.gradeKeyOf(className)) || {}).level || '')} (${this.escapeHtml(className)}) จำนวน ${stats.n} คน<br>
            ${this.escapeHtml(deptName)} • ${this.escapeHtml(schoolName)} • ${this.escapeHtml(term)}
          </div>
        </div>

        <!-- บทที่ 1 -->
        <div class="report-chapter" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 0.75rem;">
            บทที่ 1 บทนำ (Introduction)
          </h2>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            <strong>1.1 ความเป็นมาและความสำคัญของปัญหา:</strong> สาระการเรียนรู้ดนตรี กลุ่มสาระการเรียนรู้ศิลปะ มุ่งเน้นให้ผู้เรียนมีความรู้ความเข้าใจในองค์ประกอบดนตรีและสามารถปฏิบัติเครื่องดนตรีได้อย่างถูกต้อง อย่างไรก็ตาม จากการจัดการเรียนรู้ในระดับชั้นมัธยมศึกษาปีที่ 1 พบว่าผู้เรียนมีพื้นฐานทางดนตรีที่แตกต่างกัน ขาดความมั่นใจในการจำตัวโน้ต และมีข้อจำกัดในการฝึกซ้อมเครื่องดนตรีเดี่ยว ผู้วิจัยจึงได้พัฒนารูปแบบการจัดการเรียนรู้เชิงรุก T-PACE Framework ร่วมกับแอปพลิเคชัน ${this.escapeHtml(appName)} เพื่อเป็นระบบนิเวศการเรียนรู้ดนตรีดิจิทัลที่สนับสนุนการเรียนรู้รายบุคคลและการฝึกปฏิบัติร่วมกันอย่างมีประสิทธิภาพ
          </p>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            <strong>1.2 วัตถุประสงค์การวิจัย:</strong><br>
            1) เพื่อเปรียบเทียบผลสัมฤทธิ์ทางการเรียนรู้ดนตรีก่อนเรียนและหลังเรียนด้วยรูปแบบ T-PACE ร่วมกับแอปพลิเคชัน ${this.escapeHtml(appName)}<br>
            2) เพื่อหาประสิทธิภาพของระบบนิเวศการเรียนรู้ดิจิทัล T-PACE ตามเกณฑ์มาตรฐาน 80/80 (E1/E2)<br>
            3) เพื่อประเมินทักษะการปฏิบัติเครื่องดนตรีคาลิมบ้า (P) และคุณลักษณะอันพึงประสงค์ (A) ของนักเรียน
          </p>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            <strong>1.3 สมมติฐานการวิจัย:</strong> นักเรียนชั้น${this.escapeHtml((Store.getGradeInfo(Store.gradeKeyOf(className)) || {}).level || '')} ที่ได้รับการจัดการเรียนรู้ตามรูปแบบ T-PACE ร่วมกับแอปพลิเคชัน ${this.escapeHtml(appName)} มีผลสัมฤทธิ์ทางการเรียนหลังเรียนสูงกว่าก่อนเรียนอย่างมีนัยสำคัญทางสถิติที่ระดับ .05 และมีประสิทธิภาพของนวัตกรรมไม่ต่ำกว่าเกณฑ์ 80/80
          </p>
        </div>

        <!-- บทที่ 2 -->
        <div class="report-chapter" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 0.75rem;">
            บทที่ 2 กรอบแนวคิดและนวัตกรรมการจัดการเรียนรู้ (Conceptual Framework)
          </h2>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            นวัตกรรม <strong>"T-PACE Music Learning Ecosystem"</strong> ขับเคลื่อนด้วยกระบวนการจัดการเรียนรู้ 5 ขั้นตอน ได้แก่:
          </p>
          <ul style="padding-left: 3rem; margin-bottom: 0.75rem;">
            <li><strong>T - Tune-in & Theory (7 นาที):</strong> การเทียบเสียงเครื่องดนตรีดิจิทัล และเชื่อมโยงทฤษฎีดนตรีสากล/ล้านนา</li>
            <li><strong>P - Practice & Precision (18 นาที):</strong> การฝึกซ้อมทักษะปฏิบัติรายบุคคลตามจังหวะช้า-เร็วด้วยระบบ Metronome</li>
            <li><strong>A - Active Assessment (9 นาที):</strong> การประเมินตนเองและเพื่อน (Peer Assessment) ตามเกณฑ์รูบริก 4 ระดับ</li>
            <li><strong>C - Creation & Collaboration (8 นาที):</strong> การร่วมมือสร้างสรรค์บทเพลงและการบรรเลงรวมวง (Ensemble)</li>
            <li><strong>E - Evaluation & Extension (8 นาที):</strong> การสะท้อนคิดสรุปผลและการนำไปประยุกต์ใช้ในชีวิตประจำวัน</li>
          </ul>
        </div>

        <!-- บทที่ 3 -->
        <div class="report-chapter" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 0.75rem;">
            บทที่ 3 วิธีดำเนินการวิจัย (Methodology)
          </h2>
          <p style="text-indent: 2.5rem; margin-bottom: 0.5rem;">
            <strong>กลุ่มเป้าหมาย:</strong> นักเรียนชั้นมัธยมศึกษาปีที่ ${this.escapeHtml(className.replace('ม.', ''))} ${this.escapeHtml((settings && settings.schoolName) || 'โรงเรียนพะเยาพิทยาคม')} ${this.escapeHtml(Store.getSemesterInfo().label)} จำนวน ${stats.n} คน
          </p>
          <p style="text-indent: 2.5rem; margin-bottom: 0.5rem;">
            <strong>เครื่องมือที่ใช้ในการวิจัย:</strong> 1) แผนการจัดการเรียนรู้เชิงรุก T-PACE จำนวน 20 คาบ 2) เว็บแอปพลิเคชัน MusicSmart และเครื่องตั้งเสียงดิจิทัล 3) แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียนรู้ 4) แบบประเมินทักษะปฏิบัติเครื่องดนตรีรูบริกเมทริกซ์ 4 ด้าน
          </p>
        </div>

        <!-- บทที่ 4 -->
        <div class="report-chapter" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 0.75rem;">
            บทที่ 4 ผลการวิเคราะห์ข้อมูลและสถิติวิจัย (Results & Findings)
          </h2>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            จากการนำนวัตกรรม T-PACE ร่วมกับแอปพลิเคชัน MusicSmart ไปจัดการเรียนรู้ ปรากฏผลการวิเคราะห์ข้อมูลทางสถิติดังนี้:
          </p>

          <div style="margin: 1.25rem 0;">
            <div style="font-weight: 700; text-align: center; margin-bottom: 6px;">
              ตารางที่ 1: ผลการเปรียบเทียบผลสัมฤทธิ์ทางการเรียนรู้ดนตรีก่อนเรียนและหลังเรียน (t-test for Dependent Samples)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; text-align: center;">
              <thead>
                <tr style="border-top: 2px solid #000; border-bottom: 1px solid #000; background: #f8fafc;">
                  <th style="padding: 8px;">การทดสอบ</th>
                  <th style="padding: 8px;">จำนวน (N)</th>
                  <th style="padding: 8px;">คะแนนเต็ม</th>
                  <th style="padding: 8px;">ค่าเฉลี่ย (&macr;X)</th>
                  <th style="padding: 8px;">S.D.</th>
                  <th style="padding: 8px;">t-value</th>
                  <th style="padding: 8px;">p-value</th>
                  <th style="padding: 8px;">พัฒนาการ (&lt;g&gt;)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px;">ก่อนเรียน (Pre-test)</td>
                  <td>${stats.n}</td>
                  <td>10</td>
                  <td>${fmt(stats.meanPre)}</td>
                  <td>${fmt(stats.sdPre)}</td>
                  <td rowspan="2" style="font-weight: 700; vertical-align: middle;">${tDisplay}</td>
                  <td rowspan="2" style="font-weight: 700; vertical-align: middle;">${this.escapeHtml(pText)}</td>
                  <td rowspan="2" style="font-weight: 700; vertical-align: middle; color: #16a34a;">${fmt(stats.gainScore, '%')}</td>
                </tr>
                <tr style="border-bottom: 2px solid #000;">
                  <td style="padding: 8px;">หลังเรียน (Post-test)</td>
                  <td>${stats.n}</td>
                  <td>10</td>
                  <td style="font-weight: 700; color: #1e3a8a;">${fmt(stats.meanPost)}</td>
                  <td>${fmt(stats.sdPost)}</td>
                </tr>
              </tbody>
            </table>
            <div style="font-size: 0.8rem; text-align: right; margin-top: 4px; color: #475569;">
              ระดับพัฒนาการ: ${stats.gainLevel}
            </div>
          </div>

          <div style="margin: 1.5rem 0;">
            <div style="font-weight: 700; text-align: center; margin-bottom: 6px;">
              ตารางที่ 2: ประสิทธิภาพของระบบนิเวศนวัตกรรมการเรียนรู้ดนตรีดิจิทัล (E1 / E2)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; text-align: center;">
              <thead>
                <tr style="border-top: 2px solid #000; border-bottom: 1px solid #000; background: #f8fafc;">
                  <th style="padding: 8px;">ดัชนีประสิทธิภาพ</th>
                  <th style="padding: 8px;">เกณฑ์มาตรฐานที่ตั้งไว้</th>
                  <th style="padding: 8px;">ผลประสิทธิภาพที่ได้จริง</th>
                  <th style="padding: 8px;">การแปลผล</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; text-align: left;">ประสิทธิภาพระหว่างกระบวนการเรียนรู้ (E1)</td>
                  <td>80.00%</td>
                  <td style="font-weight: 700; color: #1e3a8a;">${fmt(stats.e1Score, '%')}</td>
                  <td style="color: #16a34a; font-weight: 600;">${stats.e1Score !== null ? (stats.e1Score >= 80 ? 'สูงกว่าเกณฑ์ที่กำหนด' : 'ต่ำกว่าเกณฑ์ที่กำหนด') : 'ยังไม่มีข้อมูล'}</td>
                </tr>
                <tr style="border-bottom: 2px solid #000;">
                  <td style="padding: 8px; text-align: left;">ประสิทธิภาพผลลัพธ์หลังการจัดการเรียนรู้ (E2)</td>
                  <td>80.00%</td>
                  <td style="font-weight: 700; color: #1e3a8a;">${fmt(stats.e2Score, '%')}</td>
                  <td style="color: #16a34a; font-weight: 600;">${stats.e2Score !== null ? (stats.e2Score >= 80 ? 'สูงกว่าเกณฑ์ที่กำหนด' : 'ต่ำกว่าเกณฑ์ที่กำหนด') : 'ยังไม่มีข้อมูล'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- บทที่ 5 -->
        <div class="report-chapter" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 0.75rem;">
            บทที่ 5 สรุปผล อภิปรายผล และข้อเสนอแนะ (Conclusion & Discussion)
          </h2>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            ${stats.hasData
              ? `<strong>5.1 สรุปผลการวิจัย:</strong> ผลสัมฤทธิ์ทางการเรียนดนตรีของนักเรียนชั้น${this.escapeHtml((Store.getGradeInfo(Store.gradeKeyOf(className)) || {}).level || '')} มีคะแนนเฉลี่ยก่อนเรียน ${fmt(stats.meanPre)} คะแนน และหลังเรียน ${fmt(stats.meanPost)} คะแนน (${stats.tVal !== null ? `t = ${stats.tVal}, p = ${this.escapeHtml(pText)}` : 'ยังไม่มีข้อมูล t-test'}) มีพัฒนาการสัมพัทธ์คิดเป็นร้อยละ ${fmt(stats.gainScore, '%')} อยู่ในระดับ ${stats.gainLevel} และประสิทธิภาพของนวัตกรรมเท่ากับ ${fmt(stats.e1Score)}/${fmt(stats.e2Score)}`
              : `<strong>5.1 สรุปผลการวิจัย:</strong> ยังไม่มีข้อมูลคะแนนก่อนเรียนและหลังเรียนสำหรับสรุปผลการวิจัยของชั้น ${this.escapeHtml(className)}`}
          </p>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            <strong>5.2 การอภิปรายผล:</strong> การที่ผู้เรียนมีผลสัมฤทธิ์และทักษะปฏิบัติสูงขึ้น เนื่องจากการนำแอปพลิเคชัน ${this.escapeHtml(appName)} มาช่วยในขั้น Practice & Precision ทำให้ผู้เรียนได้รับผลย้อนกลับทันที (Instant Feedback) จากเครื่องเทียบเสียง และสามารถฝึกซ้อมซ้ำได้ตามความพร้อมของตนเอง ประกอบกับกระบวนการรวมวงในขั้น Collaboration ช่วยสร้างปฏิสัมพันธ์เชิงบวกระหว่างผู้เรียน
          </p>
          <p style="text-indent: 2.5rem; margin-bottom: 0.75rem;">
            <strong>5.3 ข้อเสนอแนะ:</strong> ควรขยายผลการนำระบบนิเวศการเรียนรู้ดนตรีดิจิทัลรูปแบบ T-PACE ไปปรับใช้กับระดับชั้นอื่น ๆ รวมถึงส่งเสริมให้มีการบูรณาการบทเพลงท้องถิ่นล้านนากับเครื่องดนตรีประเภทอื่นอย่างต่อเนื่อง
          </p>
        </div>

        <!-- Signature Section (4-Tier Official Approval) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 3rem; text-align: center; page-break-inside: avoid;">
          <div>
            <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................ผู้รายงานวิจัย</div>
            <div style="font-weight: 700;">(${this.escapeHtml(instructor.name)})</div>
            <div style="font-size: 0.88rem; color: #475569;">${this.escapeHtml(instructor.role || 'ครูผู้สอน')}</div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">วันที่ ........ เดือน .................... พ.ศ. ........</div>
          </div>
          <div>
            <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................ผู้ให้ความเห็นชอบ</div>
            <div style="font-weight: 700;">(${this.escapeHtml(deptHead)})</div>
            <div style="font-size: 0.88rem; color: #475569;">หัวหน้ากลุ่มสาระการเรียนรู้ศิลปะ</div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">วันที่ ........ เดือน .................... พ.ศ. ........</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2.5rem; text-align: center; page-break-inside: avoid;">
          <div>
            <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................ผู้ตรวจทานทางวิชาการ</div>
            <div style="font-weight: 700;">(${this.escapeHtml(academicHead)})</div>
            <div style="font-size: 0.88rem; color: #475569;">${this.escapeHtml(academicHeadRole)}</div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">วันที่ ........ เดือน .................... พ.ศ. ........</div>
          </div>
          <div>
            <div style="margin-bottom: 3.5rem;">ลงชื่อ......................................................ผู้อนุมัติผลงานวิจัย</div>
            <div style="font-weight: 700;">(${this.escapeHtml(directorName)})</div>
            <div style="font-size: 0.88rem; color: #475569;">${this.escapeHtml(directorRole)}</div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 2px;">วันที่ ........ เดือน .................... พ.ศ. ........</div>
          </div>
        </div>

      </div>
    `;
  },

  printFullReport() {
    window.print();
  },

  copyFullReportText() {
    const container = document.getElementById('car-full-report-content');
    if (!container) return;

    const text = container.innerText;
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 คัดลอกเนื้อหารายงานวิจัยในชั้นเรียน 5 บท (วก.7) ลงคลิปบอร์ดแล้ว!\nสามารถนำไปกดวาง (Ctrl+V) ลงใน Microsoft Word เพื่อส่งประเมิน วPA ได้ทันทีครับ');
    }).catch(() => {
      alert('กรุณาลากคลุมดำข้อความและกด Ctrl+C เพื่อคัดลอก');
    });
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
  window.CARAnalytics = CARAnalytics;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CARAnalytics;
}
