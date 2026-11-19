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
    if (typeof Metronome !== 'undefined' && Metronome.open) {
      Metronome.open();
      return;
    }
    const modal = document.getElementById('modal-tuner');
    if (modal) modal.classList.add('active');
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
      if (typeof AudioEngine !== 'undefined' && AudioEngine.resume) {
        this.audioCtx = await AudioEngine.resume();
      } else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }
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
      if (typeof ScreenWakeLock !== 'undefined') {
        ScreenWakeLock.request('tuner');
      }
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
      const msg = 'ไม่สามารถเข้าถึงไมโครโฟนได้: กรุณาอนุญาตการใช้งานไมค์บนเบราว์เซอร์เพื่อตั้งเสียง หรือกดที่ลิ่มคาลิมบ้าเพื่อฟังเสียงเทียบ';
      if (typeof UiDialogs !== 'undefined' && UiDialogs.toast) UiDialogs.toast(msg, 'warning');
      else alert(msg);
      this.updateDisplay(null, null, null, 'ไมโครโฟนไม่พร้อมใช้งาน (กดลิ่มเพื่อฟังเสียงเทียบ)');
    }
  },

  stopListening() {
    this.isRunning = false;
    if (typeof ScreenWakeLock !== 'undefined') {
      ScreenWakeLock.release('tuner');
    }
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

    if (!this._buffer || this._buffer.length !== this.analyser.fftSize) {
      this._buffer = new Float32Array(this.analyser.fftSize);
    }
    this.analyser.getFloatTimeDomainData(this._buffer);

    const freq = this.detectPitch(this._buffer, this.audioCtx.sampleRate);
    if (freq > 0) {
      this.handleDetectedPitch(freq);
    }

    this.rafId = requestAnimationFrame(() => this.processAudio());
  },

  // McLeod Pitch Method (NSDF) restricted to 180–2000 Hz lags (fast & octave-stable)
  detectPitch(buffer, sampleRate) {
    const SIZE = buffer && buffer.length ? buffer.length : 0;
    if (SIZE < 64 || !sampleRate) return -1;

    let sumSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / SIZE);
    if (rms < 0.015) return -1; // Too quiet

    const minLag = Math.max(2, Math.floor(sampleRate / 2000));
    const maxLag = Math.min(Math.floor(SIZE / 2), Math.ceil(sampleRate / 180));
    if (maxLag <= minLag + 2) return -1;

    if (!this._nsdf || this._nsdf.length < maxLag + 2) {
      this._nsdf = new Float32Array(maxLag + 2);
    }
    const nsdf = this._nsdf;

    // Running energy m(tau) = sum_{j=0}^{SIZE-1-tau} (x[j]^2 + x[j+tau]^2)
    let m = 2 * sumSquares;
    for (let tau = 1; tau < minLag; tau++) {
      const a = buffer[SIZE - tau];
      const b = buffer[tau - 1];
      m -= (a * a + b * b);
    }

    for (let tau = minLag; tau <= maxLag; tau++) {
      const a = buffer[SIZE - tau];
      const b = buffer[tau - 1];
      m -= (a * a + b * b);
      if (m <= 1e-9) {
        nsdf[tau] = 0;
        continue;
      }
      let acf = 0;
      const limit = SIZE - tau;
      for (let j = 0; j < limit; j++) {
        acf += buffer[j] * buffer[j + tau];
      }
      nsdf[tau] = (2 * acf) / m;
    }

    // Collect key maxima (highest peak in each positive lobe)
    const peaks = [];
    let globalMax = 0;
    let inPositive = false;
    let curMaxVal = 0;
    let curMaxLag = -1;

    for (let tau = minLag; tau <= maxLag; tau++) {
      const v = nsdf[tau];
      if (v > 0) {
        if (!inPositive || v > curMaxVal) {
          curMaxVal = v;
          curMaxLag = tau;
        }
        inPositive = true;
      } else if (inPositive) {
        if (curMaxLag >= minLag) {
          peaks.push({ lag: curMaxLag, val: curMaxVal });
          if (curMaxVal > globalMax) globalMax = curMaxVal;
        }
        inPositive = false;
        curMaxVal = 0;
        curMaxLag = -1;
      }
    }
    if (inPositive && curMaxLag >= minLag) {
      peaks.push({ lag: curMaxLag, val: curMaxVal });
      if (curMaxVal > globalMax) globalMax = curMaxVal;
    }

    if (globalMax < 0.45 || !peaks.length) return -1;

    // Pick first key maximum >= 0.80 * globalMax to avoid octave jumps on overtones
    const threshold = 0.80 * globalMax;
    let chosen = -1;
    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i].val >= threshold) {
        chosen = peaks[i].lag;
        break;
      }
    }
    if (chosen <= 0) return -1;

    let T0 = chosen;
    if (T0 > minLag && T0 < maxLag) {
      const x1 = nsdf[T0 - 1], x2 = nsdf[T0], x3 = nsdf[T0 + 1];
      const denom = x1 + x3 - 2 * x2;
      if (denom < -1e-12) {
        const shift = (x1 - x3) / (2 * denom);
        if (Math.abs(shift) <= 1) T0 += shift;
      }
    }

    if (!Number.isFinite(T0) || T0 <= 0) return -1;
    const pitch = sampleRate / T0;
    if (Number.isFinite(pitch) && pitch >= 180 && pitch <= 2000) {
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
      if (typeof AudioEngine !== 'undefined' && AudioEngine.getContext) {
        this.audioCtx = AudioEngine.getContext();
      } else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
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

if (typeof module !== 'undefined' && module.exports) module.exports = Tuner;
