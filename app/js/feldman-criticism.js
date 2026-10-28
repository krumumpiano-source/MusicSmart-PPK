// ==========================================================================
// Feldman 4-Step Music Criticism Workspace (ระบบวิจารณ์ดนตรีตามโมเดล Feldman)
// สาระการเรียนรู้ศิลปะ (ดนตรี 1 ม.1 — รหัสวิชาคำนวณจาก term-config.js) ชั้นมัธยมศึกษาปีที่ 1 • หน่วยการเรียนรู้ที่ 4
// ==========================================================================

const FeldmanCriticism = {
  activePeriod: 17,
  activeStudentId: null,
  // ไม่มีค่าตัวอย่างฝังไว้: จุดพิกัด/คีย์เวิร์ดเริ่มว่าง นักเรียนเลือกเอง · รายการคีย์เวิร์ดสร้างจาก ENSEMBLE_DATA.listening (วก.5 คาบ 16)
  selectedCoord: null,
  selectedKeywords: [],
  get classroomKeywords() {
    const d = typeof window !== 'undefined' ? window.ENSEMBLE_DATA : null;
    const L = d && d.listening;
    if (!L) return [];
    const out = [];
    ((d.classSets && d.classSets.thai) || []).concat((d.classSets && d.classSets.western) || []).forEach(x => { if (!out.some(o => o.text === x)) out.push({ text: x, type: 'desc' }); });
    (L.tempos || []).forEach(x => out.push({ text: 'ความเร็ว' + x.label, type: 'analysis' }));
    (L.dynamics || []).forEach(x => out.push({ text: 'ความดัง ' + x.label, type: 'analysis' }));
    (L.moods || []).forEach(x => out.push({ text: x, type: 'interp' }));
    return out;
  },

  openModal(period = 17, studentId = null) {
    const modal = document.getElementById('modal-feldman-criticism');
    if (!modal) return;

    if (!studentId && typeof App !== 'undefined') {
      studentId = App.state.studentId;
    }

    this.activePeriod = period || 17;
    this.activeStudentId = studentId || (typeof Store !== 'undefined' && Store.getCurrentUser() && Store.getCurrentUser().studentId) || '';

    this.selectedCoord = null;
    this.selectedKeywords = [];
    const mk = document.getElementById('feldman-user-marker');
    if (mk && mk.style) mk.style.display = 'none';
    const ro = document.getElementById('feldman-coord-readout');
    if (ro) ro.textContent = '(ยังไม่ได้เลือกจุด — คลิกบนกราฟเพื่อพล็อตอารมณ์ที่รู้สึก)';
    modal.classList.add('active');
    this.loadFormData();
    this.renderWordCloud();
  },

  onGridClick(event) {
    const grid = document.getElementById('feldman-2d-grid');
    const marker = document.getElementById('feldman-user-marker');
    const readout = document.getElementById('feldman-coord-readout');
    if (!grid || !marker) return;

    const rect = grid.getBoundingClientRect();
    const xPct = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(5, Math.min(95, ((event.clientY - rect.top) / rect.height) * 100));

    marker.style.display = '';
    marker.style.left = `${xPct}%`;
    marker.style.top = `${yPct}%`;

    const valence = Math.round(((xPct - 50) / 50) * 10);
    const arousal = Math.round(((50 - yPct) / 50) * 10);
    this.selectedCoord = { valence, arousal };

    const zoneLabel = arousal <= 0
      ? (valence >= 0 ? 'สงบ/ผ่อนคลาย (Alpha State)' : 'เหงา/ครุ่นคิด (Outlier Zone)')
      : (valence >= 0 ? 'คึกคัก/ตื่นตัว (Sympathetic)' : 'กดดัน/เร่งเร้า');

    if (readout) {
      readout.textContent = `(Valence: ${valence >= 0 ? '+' + valence : valence}, Arousal: ${arousal >= 0 ? '+' + arousal : arousal} • ${zoneLabel})`;
    }
  },

  toggleKeyword(kw) {
    const idx = this.selectedKeywords.indexOf(kw);
    if (idx >= 0) {
      this.selectedKeywords.splice(idx, 1);
    } else {
      this.selectedKeywords.push(kw);
    }
    this.renderWordCloud();
  },

  renderWordCloud() {
    const box = document.getElementById('feldman-wordcloud-box');
    if (!box) return;
    box.innerHTML = '';

    this.classroomKeywords.forEach(item => {
      const isSel = this.selectedKeywords.includes(item.text);
      const isOutlier = item.type === 'outlier';
      const span = document.createElement('button');
      span.type = 'button';
      span.onclick = () => this.toggleKeyword(item.text);
      span.style.cssText = `
        border: 1px solid ${isOutlier ? '#f59e0b' : (isSel ? '#2563eb' : '#cbd5e1')};
        background: ${isOutlier ? (isSel ? '#fef3c7' : '#fffbeb') : (isSel ? '#dbeafe' : '#ffffff')};
        color: ${isOutlier ? '#b45309' : (isSel ? '#1e40af' : '#475569')};
        font-weight: ${isSel ? '700' : '500'};
        font-size: 0.8rem;
        padding: 3px 9px;
        border-radius: 999px;
        cursor: pointer;
      `;
      span.textContent = `${isSel ? '✓ ' : ''}${item.text}`;
      box.appendChild(span);
    });
  },

  // ไม่เติมข้อความสำเร็จรูป/สถิติตัวอย่างแทนนักเรียน — แสดงเฉพาะคำถามช่วยคิดจากข้อมูล วก.5 เป็น placeholder และคำที่นักเรียนเลือกไว้
  autoPopulateFromAnalytics() {
    const d = typeof window !== 'undefined' ? window.ENSEMBLE_DATA : null;
    const L = d && d.listening;
    const ids = ['feldman-step1-desc', 'feldman-step2-analysis', 'feldman-step3-interp', 'feldman-step4-eval'];
    if (L && L.feldman) L.feldman.forEach((f, i) => { const el = document.getElementById(ids[i]); if (el) el.placeholder = f.label + ' ' + f.hint + ' — ' + f.prompt; });
    const kw = this.selectedKeywords.length ? 'คำที่คุณเลือกไว้: ' + this.selectedKeywords.join(', ') : 'ยังไม่ได้เลือกคีย์เวิร์ด';
    const c = this.selectedCoord ? `จุดอารมณ์ (Valence ${this.selectedCoord.valence}, Arousal ${this.selectedCoord.arousal})` : 'ยังไม่ได้เลือกจุดอารมณ์';
    const ro = document.getElementById('feldman-coord-readout');
    if (ro && !this.selectedCoord) ro.textContent = '(ยังไม่ได้เลือกจุด)';
    if (typeof alert === 'function') alert('เขียนด้วยคำพูดของตนเอง: ' + kw + ' · ' + c + '\n(ระบบไม่เขียนแทน — ใช้คำถามช่วยคิดในช่องแต่ละขั้น)');
  },

  closeModal() {
    const modal = document.getElementById('modal-feldman-criticism');
    if (modal) modal.classList.remove('active');
  },

  getStorageKey(studentId, period) {
    return `music_feldman_${studentId}_p${period}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  loadFormData() {
    const student = Store.getStudentById(this.activeStudentId);
    const headerTitle = document.getElementById('feldman-modal-title');
    const headerMeta = document.getElementById('feldman-modal-meta');

    if (headerTitle) {
      headerTitle.textContent = `แบบวิจารณ์ผลงานดนตรีเชิงประจักษ์ตามแนวทาง Feldman (คาบที่ ${this.activePeriod})`;
    }
    if (headerMeta && student) {
      headerMeta.innerHTML = `
        ผู้บันทึก: <strong>${this.escapeHtml(student.prefix)}${this.escapeHtml(student.first_name)} ${this.escapeHtml(student.last_name)}</strong> (ชั้น ${this.escapeHtml(student.class || 'ม.1')} • เลขที่ ${this.escapeHtml(student.no)})
      `;
    }

    const storageKey = this.getStorageKey(this.activeStudentId, this.activePeriod);
    const data = (typeof Store !== 'undefined' && Store.load)
      ? (Store.load(storageKey, {}) || {})
      : (() => {
          const raw = localStorage.getItem(storageKey);
          return raw ? JSON.parse(raw) : {};
        })();

    const songTitleInput = document.getElementById('feldman-song-title');
    const descInput = document.getElementById('feldman-step1-desc');
    const analysisInput = document.getElementById('feldman-step2-analysis');
    const interpInput = document.getElementById('feldman-step3-interp');
    const evalInput = document.getElementById('feldman-step4-eval');
    const statusChip = document.getElementById('feldman-status-badge');

    if (songTitleInput) songTitleInput.value = data.songTitle || '';
    if (descInput) descInput.value = data.step1_desc || '';
    if (analysisInput) analysisInput.value = data.step2_analysis || '';
    if (interpInput) interpInput.value = data.step3_interp || '';
    if (evalInput) evalInput.value = data.step4_eval || '';

    if (statusChip) {
      if (data.submitted) {
        statusChip.innerHTML = `<span class="badge" style="background: #16a34a; color: #ffffff; padding: 4px 10px; border-radius: 9999px;">✅ ส่งใบวิจารณ์แล้ว (${this.escapeHtml(data.submittedAt)})</span>`;
      } else {
        statusChip.innerHTML = `<span class="badge" style="background: #f59e0b; color: #ffffff; padding: 4px 10px; border-radius: 9999px;">✏️ กำลังร่างเนื้อหา</span>`;
      }
    }
  },

  saveDraft() {
    const data = this.gatherFormData(false);
    const key = this.getStorageKey(this.activeStudentId, this.activePeriod);
    if (typeof Store !== 'undefined' && Store.save) {
      Store.save(key, data);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
    alert('บันทึกแบบร่างเรียบร้อยแล้ว คุณสามารถกลับมาเขียนต่อได้ตลอดเวลา');
    this.loadFormData();
  },

  submitCriticism() {
    const data = this.gatherFormData(true);
    if (!data.songTitle || !data.step1_desc || !data.step2_analysis || !data.step3_interp || !data.step4_eval) {
      if (!confirm('คุณยังกรอกข้อมูลไม่ครบทั้ง 4 ขั้นตอน ต้องการยืนยันการส่งใบวิจารณ์หรือไม่?')) {
        return;
      }
    }

    data.submitted = true;
    data.submittedAt = new Date().toLocaleString('th-TH');

    const key = this.getStorageKey(this.activeStudentId, this.activePeriod);
    if (typeof Store !== 'undefined' && Store.save) {
      Store.save(key, data);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }

    // Resolve actual student class (supports both M.1 and M.2 across all 16 rooms)
    const studentObj = (typeof Store !== 'undefined' && Store.getStudentById)
      ? Store.getStudentById(this.activeStudentId)
      : null;
    const actualClass = studentObj?.class || (typeof App !== 'undefined' ? App.state.studentClass : 'ม.1/1');

    if (typeof Store !== 'undefined' && typeof Store.saveStudentSubmission === 'function') {
      Store.saveStudentSubmission(actualClass, this.activePeriod, this.activeStudentId, {
        submissionType: 'feldman',
        content: `[ใบวิจารณ์ดนตรี Feldman 4 ขั้น: เพลง ${data.songTitle}]\n1. บรรยาย: ${data.step1_desc}\n2. วิเคราะห์: ${data.step2_analysis}\n3. ตีความ: ${data.step3_interp}\n4. ประเมินค่า: ${data.step4_eval}`
      });
    }

    alert('🎉 ส่งใบวิจารณ์ดนตรีตามแนวทาง Feldman สำเร็จ! ข้อมูลถูกส่งเข้าสู่ระบบของครูผู้สอนแล้ว');
    this.closeModal();
    if (typeof App !== 'undefined' && typeof App.renderStudentPortal === 'function') {
      App.renderStudentPortal();
    }
  },

  gatherFormData(isSubmit) {
    return {
      studentId: this.activeStudentId,
      period: this.activePeriod,
      coord: this.selectedCoord,
      keywords: this.selectedKeywords,
      songTitle: document.getElementById('feldman-song-title')?.value.trim() || '',
      step1_desc: document.getElementById('feldman-step1-desc')?.value.trim() || '',
      step2_analysis: document.getElementById('feldman-step2-analysis')?.value.trim() || '',
      step3_interp: document.getElementById('feldman-step3-interp')?.value.trim() || '',
      step4_eval: document.getElementById('feldman-step4-eval')?.value.trim() || '',
      submitted: isSubmit,
      updatedAt: new Date().toLocaleString('th-TH')
    };
  }
};

if (typeof window !== 'undefined') {
  window.FeldmanCriticism = FeldmanCriticism;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeldmanCriticism;
}
