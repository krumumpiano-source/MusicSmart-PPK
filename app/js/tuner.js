// ==========================================================================
// Web Audio Chromatic & Kalimba 17-Key Tuner (ระบบตั้งเสียงคาลิมบ้าอัจฉริยะ)
// สาระการเรียนรู้ศิลปะ (ดนตรี) • โรงเรียนพะเยาพิทยาคม
// ==========================================================================

const Tuner = {
  audioCtx: null,
  analyser: null,
  micStream: null,
  sourceNode: null,
  rafId: null,
  isRunning: false,
  mode: 'kalimba', // 'kalimba' | 'chromatic'
  selectedTineIndex: 8, // Default to C4 (index 8: 9th tine, center)

  // 17-Key Kalimba Standard C Major Tines (Physical Left-to-Right layout)
  kalimbaTines: [
    { note: 'D6', freq: 1174.66, number: '2°°', solfege: 'เร',  hand: 'L', lengthPct: 58 },
    { note: 'B5', freq: 987.77,  number: '7°',  solfege: 'ที',  hand: 'L', lengthPct: 63 },
    { note: 'G5', freq: 783.99,  number: '5°',  solfege: 'ซอล', hand: 'L', lengthPct: 68 },
    { note: 'E5', freq: 659.25,  number: '3°',  solfege: 'มี',  hand: 'L', lengthPct: 73 },
    { note: 'C5', freq: 523.25,  number: '1°',  solfege: 'โด',  hand: 'L', lengthPct: 79 },
    { note: 'A4', freq: 440.00,  number: '6',   solfege: 'ลา',  hand: 'L', lengthPct: 85 },
    { note: 'F4', freq: 349.23,  number: '4',   solfege: 'ฟา',  hand: 'L', lengthPct: 91 },
    { note: 'D4', freq: 293.66,  number: '2',   solfege: 'เร',  hand: 'L', lengthPct: 96 },
    { note: 'C4', freq: 261.63,  number: '1',   solfege: 'โด',  hand: 'C', lengthPct: 100 }, // Center longest
    { note: 'E4', freq: 329.63,  number: '3',   solfege: 'มี',  hand: 'R', lengthPct: 94 },
    { note: 'G4', freq: 392.00,  number: '5',   solfege: 'ซอล', hand: 'R', lengthPct: 88 },
    { note: 'B4', freq: 493.88,  number: '7',   solfege: 'ที',  hand: 'R', lengthPct: 82 },
    { note: 'D5', freq: 587.33,  number: '2°',  solfege: 'เร',  hand: 'R', lengthPct: 76 },
    { note: 'F5', freq: 698.46,  number: '4°',  solfege: 'ฟา',  hand: 'R', lengthPct: 71 },
    { note: 'A5', freq: 880.00,  number: '6°',  solfege: 'ลา',  hand: 'R', lengthPct: 66 },
    { note: 'C6', freq: 1046.50, number: '1°°', solfege: 'โด',  hand: 'R', lengthPct: 61 },
    { note: 'E6', freq: 1318.51, number: '3°°', solfege: 'มี',  hand: 'R', lengthPct: 56 }
  ],

  // Chromatic note names for general tuning
  noteNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],

  init() {
    this.renderTinesKeyboard();
  },

  openModal() {
    const modal = document.getElementById('modal-tuner');
    if (!modal) return;
    modal.classList.add('active');
    this.renderTinesKeyboard();
    this.updateDisplay(null, null, null, 'พร้อมเริ่มจับเสียง...');
  },

  closeModal() {
    const modal = document.getElementById('modal-tuner');
    if (modal) modal.classList.remove('active');
    this.stopListening();
  },

  setMode(mode) {
    this.mode = mode;
    const btnKalimba = document.getElementById('btn-tuner-mode-kalimba');
    const btnChrom = document.getElementById('btn-tuner-mode-chrom');
    if (btnKalimba && btnChrom) {
      if (mode === 'kalimba') {
        btnKalimba.classList.add('active');
        btnChrom.classList.remove('active');
      } else {
        btnKalimba.classList.remove('active');
        btnChrom.classList.add('active');
      }
    }
  },

  async toggleListening() {
    if (this.isRunning) {
      this.stopListening();
    } else {
      await this.startListening();
    }
  },

  async startListening() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.sourceNode.connect(this.analyser);

      this.isRunning = true;
      const btn = document.getElementById('btn-tuner-toggle');
      if (btn) {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
          หยุดจับเสียงไมค์
        `;
        btn.classList.add('danger');
      }

      this.updateDisplay(null, null, null, 'กำลังดักฟังเสียงเครื่องดนตรี...');
      this.processAudio();
    } catch (err) {
      console.error('Tuner Error:', err);
      alert('ไม่สามารถเข้าถึงไมโครโฟนได้: กรุณาอนุญาตการใช้งานไมค์บนเบราว์เซอร์เพื่อตั้งเสียง หรือกดที่ลิ่มคาลิมบ้าเพื่อฟังเสียงเทียบ');
      this.updateDisplay(null, null, null, 'ไมโครโฟนไม่พร้อมใช้งาน (กดลิ่มเพื่อฟังเสียงเทียบ)');
    }
  },

  stopListening() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    const btn = document.getElementById('btn-tuner-toggle');
    if (btn) {
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        เริ่มเปิดไมโครโฟนตั้งเสียง
      `;
      btn.classList.remove('danger');
    }
    this.updateDisplay(null, null, null, 'หยุดการจับเสียงแล้ว');
    this.highlightTine(-1);
  },

  processAudio() {
    if (!this.isRunning || !this.analyser) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    const freq = this.detectPitch(buffer, this.audioCtx.sampleRate);
    if (freq > 0) {
      this.handleDetectedPitch(freq);
    }

    this.rafId = requestAnimationFrame(() => this.processAudio());
  },

  // Autocorrelation Pitch Detection
  detectPitch(buffer, sampleRate) {
    const SIZE = buffer.length;
    let sumSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / SIZE);
    if (rms < 0.015) return -1; // Too quiet

    // Normalized Square Difference
    let r1 = 0, r2 = SIZE - 1;
    const thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const trimmed = buffer.slice(r1, r2);
    const c = new Array(trimmed.length).fill(0);
    for (let i = 0; i < trimmed.length; i++) {
      for (let j = 0; j < trimmed.length - i; j++) {
        c[i] = c[i] + trimmed[j] * trimmed[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < trimmed.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    // Parabolic interpolation for sub-sample accuracy
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    const pitch = sampleRate / T0;
    if (pitch >= 180 && pitch <= 2000) {
      return pitch;
    }
    return -1;
  },

  handleDetectedPitch(freq) {
    if (this.mode === 'kalimba') {
      // Find closest tine among the 17 kalimba tines
      let closestIdx = 0;
      let minDiff = Infinity;
      this.kalimbaTines.forEach((tine, idx) => {
        const diff = Math.abs(freq - tine.freq);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      const target = this.kalimbaTines[closestIdx];
      // Cents deviation = 1200 * log2(detected / target)
      const cents = Math.round(1200 * Math.log2(freq / target.freq));
      this.updateDisplay(target, freq, cents);
      this.highlightTine(closestIdx);
    } else {
      // General Chromatic tuning
      const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
      const midi = Math.round(noteNum) + 69;
      const noteIndex = midi % 12;
      const octave = Math.floor(midi / 12) - 1;
      const noteName = this.noteNames[noteIndex] + octave;
      const targetFreq = 440 * Math.pow(2, (midi - 69) / 12);
      const cents = Math.round(1200 * Math.log2(freq / targetFreq));

      const target = {
        note: noteName,
        number: '',
        solfege: '',
        freq: targetFreq
      };
      this.updateDisplay(target, freq, cents);
      this.highlightTine(-1);
    }
  },

  updateDisplay(target, detectedFreq, cents, customStatus) {
    const noteEl = document.getElementById('tuner-display-note');
    const numEl = document.getElementById('tuner-display-number');
    const freqEl = document.getElementById('tuner-display-freq');
    const centsBadge = document.getElementById('tuner-display-cents');
    const statusText = document.getElementById('tuner-display-status');
    const needle = document.getElementById('tuner-needle');

    if (!target) {
      if (noteEl) noteEl.textContent = '--';
      if (numEl) numEl.textContent = '';
      if (freqEl) freqEl.textContent = '0.0 Hz';
      if (centsBadge) {
        centsBadge.textContent = '0 cents';
        centsBadge.className = 'tuner-cents-tag in-tune';
      }
      if (statusText) statusText.textContent = customStatus || 'รอสัญญาณเสียง...';
      if (needle) needle.style.transform = `translateX(-50%) rotate(0deg)`;
      return;
    }

    if (noteEl) noteEl.textContent = target.note;
    if (numEl) numEl.textContent = target.number ? `${target.number} (${target.solfege})` : '';
    if (freqEl) freqEl.textContent = `${detectedFreq.toFixed(1)} Hz (เป้าหมาย: ${target.freq.toFixed(1)} Hz)`;

    // Needle rotation: -50 cents = -45 deg, +50 cents = +45 deg
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const deg = (clampedCents / 50) * 45;
    if (needle) needle.style.transform = `translateX(-50%) rotate(${deg}deg)`;

    if (centsBadge && statusText) {
      centsBadge.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;
      if (Math.abs(cents) <= 6) {
        centsBadge.className = 'tuner-cents-tag in-tune';
        statusText.innerHTML = `<span style="color: #059669; font-weight: 700;">🟢 เสียงตรงเป๊ะ (IN TUNE)</span>`;
      } else if (cents < -6) {
        centsBadge.className = 'tuner-cents-tag flat';
        statusText.innerHTML = `<span style="color: #d97706; font-weight: 700;">🟠 เสียงต่ำเกินไป (FLAT) - ใช้ค้อนเคาะปลายลิ่มขึ้นเบาๆ</span>`;
      } else {
        centsBadge.className = 'tuner-cents-tag sharp';
        statusText.innerHTML = `<span style="color: #dc2626; font-weight: 700;">🔴 เสียงสูงเกินไป (SHARP) - ใช้ค้อนเคาะหัวลิ่มลงเบาๆ</span>`;
      }
    }
  },

  renderTinesKeyboard() {
    const container = document.getElementById('tuner-kalimba-keyboard');
    if (!container) return;
    container.innerHTML = '';

    this.kalimbaTines.forEach((tine, idx) => {
      const el = document.createElement('div');
      el.className = `kalimba-tine-key ${idx === this.selectedTineIndex ? 'selected' : ''}`;
      el.id = `kalimba-tine-${idx}`;
      el.style.height = `${tine.lengthPct}%`;
      el.title = `คลิกเพื่อฟังเสียงเทียบ: ${tine.note} (${tine.number} - ${tine.solfege})`;

      el.innerHTML = `
        <div class="tine-top-cap"></div>
        <div class="tine-number">${tine.number}</div>
        <div class="tine-note">${tine.note}</div>
        <div class="tine-solfege">${tine.solfege}</div>
      `;

      el.onclick = () => {
        this.selectTine(idx);
        this.playReferenceTone(tine.freq);
      };

      container.appendChild(el);
    });
  },

  selectTine(idx) {
    this.selectedTineIndex = idx;
    const target = this.kalimbaTines[idx];
    document.querySelectorAll('.kalimba-tine-key').forEach((el, i) => {
      el.classList.toggle('selected', i === idx);
    });
    this.updateDisplay(target, target.freq, 0, `เสียงเทียบ: ${target.note} (${target.number})`);
  },

  highlightTine(idx) {
    document.querySelectorAll('.kalimba-tine-key').forEach((el, i) => {
      el.classList.toggle('active-detected', i === idx);
    });
  },

  playReferenceTone(freq) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Sine wave with slight harmonic overtone for kalimba pluck warmth
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Attack and gentle exponential decay
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 1.85);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
};
