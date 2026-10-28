// ==========================================================================
// Interactive Audio Tools: Metronome & Ear Training Drone (ห้องเครื่องดนตรี)
// สาระการเรียนรู้ศิลปะ (ดนตรี) • โรงเรียนพะเยาพิทยาคม
// ==========================================================================

const AudioTools = {
  audioCtx: null,

  // --- Metronome State ---
  metronome: {
    isRunning: false,
    bpm: 100,
    beatsPerMeasure: 4,
    currentBeat: 0,
    timerId: null,
    nextNoteTime: 0.0,
    lookahead: 25.0, // ms
    scheduleAheadTime: 0.1, // sec
    tapTimes: []
  },

  // --- Drone State ---
  drone: {
    isPlaying: false,
    activeNote: null,
    osc: null,
    gainNode: null,
    pitches: {
      'C4': { name: 'โด (C4)',   freq: 261.63 },
      'D4': { name: 'เร (D4)',   freq: 293.66 },
      'E4': { name: 'มี (E4)',   freq: 329.63 },
      'F4': { name: 'ฟา (F4)',   freq: 349.23 },
      'G4': { name: 'ซอล (G4)', freq: 392.00 },
      'A4': { name: 'ลา (A4)',   freq: 440.00 },
      'B4': { name: 'ที (B4)',   freq: 493.88 },
      'C5': { name: 'โดสูง (C5)', freq: 523.25 }
    }
  },

  ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!this.audioCtx) {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  },

  // ========================================================================
  // METRONOME ENGINE (Lookahead Web Audio Scheduler)
  // ========================================================================
  toggleMetronome() {
    if (this.metronome.isRunning) {
      this.stopMetronome();
    } else {
      this.startMetronome();
    }
  },

  startMetronome() {
    this.ensureAudioContext();
    this.metronome.isRunning = true;
    this.metronome.currentBeat = 0;
    this.metronome.nextNoteTime = this.audioCtx.currentTime + 0.05;

    this.updateMetronomeUI(true);
    this.scheduler();
  },

  stopMetronome() {
    this.metronome.isRunning = false;
    if (this.metronome.timerId) {
      clearTimeout(this.metronome.timerId);
      this.metronome.timerId = null;
    }
    this.updateMetronomeUI(false);
    this.resetBeatVisuals();
  },

  scheduler() {
    if (!this.metronome.isRunning) return;

    while (this.metronome.nextNoteTime < this.audioCtx.currentTime + this.metronome.scheduleAheadTime) {
      this.scheduleClick(this.metronome.currentBeat, this.metronome.nextNoteTime);
      this.advanceBeat();
    }

    this.metronome.timerId = setTimeout(() => this.scheduler(), this.metronome.lookahead);
  },

  scheduleClick(beatNumber, time) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const isAccent = (beatNumber === 0);
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
    osc.type = 'triangle';

    gain.gain.setValueAtTime(isAccent ? 0.6 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (isAccent ? 0.06 : 0.04));

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.07);

    // Synchronize UI highlight with audio time
    const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    setTimeout(() => {
      if (this.metronome.isRunning) {
        this.flashBeat(beatNumber, isAccent);
      }
    }, delayMs);
  },

  advanceBeat() {
    const secondsPerBeat = 60.0 / this.metronome.bpm;
    this.metronome.nextNoteTime += secondsPerBeat;
    this.metronome.currentBeat = (this.metronome.currentBeat + 1) % this.metronome.beatsPerMeasure;
  },

  setBpm(newBpm) {
    const clamped = Math.max(40, Math.min(240, parseInt(newBpm, 10) || 100));
    this.metronome.bpm = clamped;
    const input = document.getElementById('metronome-bpm-input');
    const display = document.getElementById('metronome-bpm-val');
    if (input) input.value = clamped;
    if (display) display.textContent = clamped;
  },

  changeBpmBy(delta) {
    this.setBpm(this.metronome.bpm + delta);
  },

  setBeats(beats) {
    this.metronome.beatsPerMeasure = parseInt(beats, 10) || 4;
    this.metronome.currentBeat = 0;
    this.renderBeatDots();
  },

  tapTempo() {
    const now = Date.now();
    const taps = this.metronome.tapTimes;

    if (taps.length > 0 && now - taps[taps.length - 1] > 2200) {
      taps.length = 0; // Reset if pause too long
    }

    taps.push(now);
    if (taps.length > 4) taps.shift();

    if (taps.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < taps.length; i++) {
        totalDiff += (taps[i] - taps[i - 1]);
      }
      const avgInterval = totalDiff / (taps.length - 1);
      const computedBpm = Math.round(60000 / avgInterval);
      this.setBpm(computedBpm);
    }
  },

  flashBeat(beatIndex, isAccent) {
    const dots = document.querySelectorAll('.metro-beat-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === beatIndex);
      dot.classList.toggle('accent', idx === beatIndex && isAccent);
    });

    const badge = document.getElementById('cockpit-metro-btn');
    if (badge) {
      badge.classList.add('pulse');
      setTimeout(() => badge.classList.remove('pulse'), 120);
    }
  },

  resetBeatVisuals() {
    document.querySelectorAll('.metro-beat-dot').forEach(d => {
      d.classList.remove('active', 'accent');
    });
  },

  renderBeatDots() {
    const container = document.getElementById('metro-beat-dots-container');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this.metronome.beatsPerMeasure; i++) {
      const dot = document.createElement('div');
      dot.className = `metro-beat-dot ${i === 0 ? 'accent-ready' : ''}`;
      container.appendChild(dot);
    }
  },

  updateMetronomeUI(running) {
    const btn = document.getElementById('btn-metronome-toggle');
    const badgeBtn = document.getElementById('cockpit-metro-btn');
    if (btn) {
      btn.innerHTML = running ? '⏸ หยุดเคาะ' : '▶ เริ่มเคาะจังหวะ';
      btn.className = running ? 'btn-nav-action danger' : 'btn-nav-action primary';
    }
    if (badgeBtn) {
      badgeBtn.classList.toggle('running', running);
      badgeBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${running ? '#ef4444' : 'none'}" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        ${running ? 'เคาะอยู่' : 'เมโทรนอม'} ${this.metronome.bpm}
      `;
    }
  },

  // ========================================================================
  // DRONE PITCH GENERATOR (Solfege Ear Training)
  // ========================================================================
  toggleDrone(noteKey) {
    if (this.drone.isPlaying && this.drone.activeNote === noteKey) {
      this.stopDrone();
    } else {
      this.playDrone(noteKey);
    }
  },

  playDrone(noteKey) {
    this.ensureAudioContext();
    const note = this.drone.pitches[noteKey];
    if (!note) return;

    this.stopDrone();

    const now = this.audioCtx.currentTime;
    this.drone.osc = this.audioCtx.createOscillator();
    this.drone.gainNode = this.audioCtx.createGain();

    this.drone.osc.type = 'sine';
    this.drone.osc.frequency.setValueAtTime(note.freq, now);

    // Smooth fade in
    this.drone.gainNode.gain.setValueAtTime(0.0001, now);
    this.drone.gainNode.linearRampToValueAtTime(0.3, now + 0.15);

    this.drone.osc.connect(this.drone.gainNode);
    this.drone.gainNode.connect(this.audioCtx.destination);

    this.drone.osc.start(now);
    this.drone.isPlaying = true;
    this.drone.activeNote = noteKey;

    this.updateDroneUI();
  },

  stopDrone() {
    if (this.drone.isPlaying && this.drone.gainNode) {
      const now = this.audioCtx.currentTime;
      this.drone.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.1);
      setTimeout(() => {
        if (this.drone.osc) {
          try { this.drone.osc.stop(); } catch (e) {}
          this.drone.osc.disconnect();
          this.drone.osc = null;
        }
      }, 120);
    }
    this.drone.isPlaying = false;
    this.drone.activeNote = null;
    this.updateDroneUI();
  },

  updateDroneUI() {
    document.querySelectorAll('.drone-note-btn').forEach(btn => {
      const key = btn.getAttribute('data-note');
      btn.classList.toggle('active', this.drone.isPlaying && this.drone.activeNote === key);
    });
    const status = document.getElementById('drone-active-status');
    if (status) {
      if (this.drone.isPlaying && this.drone.activeNote) {
        status.innerHTML = `🔊 กำลังเล่นเสียงโดรน: <strong>${this.drone.pitches[this.drone.activeNote].name}</strong> (${this.drone.pitches[this.drone.activeNote].freq} Hz)`;
      } else {
        status.textContent = 'เลือกเสียงที่ต้องการเทียบ (Solfege Drone)';
      }
    }
  }
};
