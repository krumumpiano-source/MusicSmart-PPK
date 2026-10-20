// ==========================================================================
// Feldman 4-Step Music Criticism Workspace (ระบบวิจารณ์ดนตรีตามโมเดล Feldman)
// สาระการเรียนรู้ศิลปะ (ดนตรี 1 ศ21101) ชั้นมัธยมศึกษาปีที่ 1 • หน่วยการเรียนรู้ที่ 4
// ==========================================================================

const FeldmanCriticism = {
  activePeriod: 17,
  activeStudentId: null,
  selectedCoord: { valence: 6, arousal: -4 },
  selectedKeywords: ['คาลิมบ้า 17 คีย์', 'จังหวะช้า 65 BPM', 'เสียงกังวาน (Resonance)', 'โทนอบอุ่นผ่อนคลาย (Alpha)', 'แฝงความเหงาช่วงท้าย (Outlier)'],
  classroomKeywords: [
    { text: 'คาลิมบ้า 17 คีย์', count: 36, type: 'desc' },
    { text: 'จังหวะช้า 65 BPM', count: 34, type: 'analysis' },
    { text: 'เสียงกังวาน (Resonance)', count: 31, type: 'desc' },
    { text: 'โทนอบอุ่นผ่อนคลาย (Alpha)', count: 32, type: 'interp' },
    { text: 'ไดนามิกส์นุ่มนวล (Piano)', count: 29, type: 'analysis' },
    { text: 'บันไดเสียง C Major', count: 27, type: 'analysis' },
    { text: 'แฝงความเหงาช่วงท้าย (Outlier)', count: 6, type: 'outlier' },
    { text: 'ตื่นเต้นช่วงเปลี่ยนท่อน (Outlier)', count: 4, type: 'outlier' }
  ],

  openModal(period = 17, studentId = null) {
    const modal = document.getElementById('modal-feldman-criticism');
    if (!modal) return;

    if (!studentId && typeof App !== 'undefined') {
      studentId = App.state.studentId;
    }

    this.activePeriod = period || 17;
    this.activeStudentId = studentId || '35994';

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
        font-size: ${item.count > 30 ? '0.84rem' : '0.76rem'};
        padding: 3px 9px;
        border-radius: 999px;
        cursor: pointer;
      `;
      span.textContent = `${isSel ? '✓ ' : ''}${item.text} (${item.count})`;
      box.appendChild(span);
    });
  },

  autoPopulateFromAnalytics() {
    const songTitleInput = document.getElementById('feldman-song-title');
    const descInput = document.getElementById('feldman-step1-desc');
    const analysisInput = document.getElementById('feldman-step2-analysis');
    const interpInput = document.getElementById('feldman-step3-interp');

    if (songTitleInput && !songTitleInput.value.trim()) {
      songTitleInput.value = 'บทเพลงบรรเลงคาลิมบ้าผสานทำนองพื้นบ้านพะเยา (Acoustic Soundscape)';
    }
    if (descInput) {
      descInput.value = `บรรเลงด้วยคาลิมบ้า 17 คีย์ ให้เสียงกังวานใส (Resonance) ผสานเทคนิคเปิด-ปิดรูกล่องเสียง (Wah-wah) ในช่วงนาทีที่ 0:15–1:30 คีย์เวิร์ดที่พบในชั้นเรียน: ${this.selectedKeywords.join(', ')}`;
    }
    if (analysisInput) {
      analysisInput.value = `โครงสร้างบทเพลงอยู่ในบันไดเสียง C Major อัตราความเร็วช้าสม่ำเสมอประมาณ 65 BPM ควบคุมน้ำหนักเสียงระดับเบาถึงปานกลาง (Piano - Mezzo Piano) และมีการชะลอจังหวะ (Ritardando) ใน 4 ห้องสุดท้าย`;
    }
    if (interpInput) {
      interpInput.value = `จากพิกัดอารมณ์ (Valence ${this.selectedCoord.valence}, Arousal ${this.selectedCoord.arousal}) ผู้ฟังส่วนใหญ่ (85%) ตีความว่าสื่อถึงความสงบอบอุ่นและช่วยปรับคลื่นสมองสู่ภาวะผ่อนคลาย (Alpha State) ในขณะที่มีมุมมองเห็นต่าง (Outliers 15%) ที่ตีความว่าช่วงท้ายแฝงความรู้สึกเหงาและคิดถึงบ้านจากการทอดจังหวะช้าลง`;
    }
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
