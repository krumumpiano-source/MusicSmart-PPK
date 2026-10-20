// Virtual Kalimba 17-Key Synthesizer & Practice Songs Player
// Web Audio API pure client-side physical acoustic synthesis

const VirtualKalimba = {
  audioCtx: null,
  activeSongInterval: null,
  isPlayingSong: false,
  currentSongIndex: 0,
  currentNoteIndex: 0,
  tempoBpm: 90,

  // Standard 17-Key Kalimba (C Major Tuning)
  // Physical alternating layout from center C4 (longest) outward
  TINES: [
    { id: 'D6', note: 'D6', solfege: '2\'\'', freq: 1174.66, heightPct: 65, key: '1' },
    { id: 'B5', note: 'B5', solfege: '7\'', freq: 987.77, heightPct: 68, key: '2' },
    { id: 'G5', note: 'G5', solfege: '5\'', freq: 783.99, heightPct: 73, key: '3' },
    { id: 'E5', note: 'E5', solfege: '3\'', freq: 659.25, heightPct: 77, key: '4' },
    { id: 'C5', note: 'C5', solfege: '1\'', freq: 523.25, heightPct: 82, key: '5' },
    { id: 'A4', note: 'A4', solfege: '6', freq: 440.00, heightPct: 87, key: '6' },
    { id: 'F4', note: 'F4', solfege: '4', freq: 349.23, heightPct: 93, key: '7' },
    { id: 'D4', note: 'D4', solfege: '2', freq: 293.66, heightPct: 97, key: '8' },
    { id: 'C4', note: 'C4', solfege: '1', freq: 261.63, heightPct: 100, isCenter: true, key: '9' },
    { id: 'E4', note: 'E4', solfege: '3', freq: 329.63, heightPct: 95, key: '0' },
    { id: 'G4', note: 'G4', solfege: '5', freq: 392.00, heightPct: 90, key: 'Q' },
    { id: 'B4', note: 'B4', solfege: '7', freq: 493.88, heightPct: 84, key: 'W' },
    { id: 'D5', note: 'D5', solfege: '2\'', freq: 587.33, heightPct: 79, key: 'E' },
    { id: 'F5', note: 'F5', solfege: '4\'', freq: 698.46, heightPct: 75, key: 'R' },
    { id: 'A5', note: 'A5', solfege: '6\'', freq: 880.00, heightPct: 70, key: 'T' },
    { id: 'C6', note: 'C6', solfege: '1\'\'', freq: 1046.50, heightPct: 66, key: 'Y' },
    { id: 'E6', note: 'E6', solfege: '3\'\'', freq: 1318.51, heightPct: 63, key: 'U' }
  ],

  // Practice Songs Library
  PRACTICE_SONGS: [
    {
      id: 'scale_c',
      title: '1. บันไดเสียง C Major (ขึ้น-ลง)',
      desc: 'ฝึกไล่ระดับเสียงพื้นฐาน C4 ถึง C5',
      tempo: 80,
      notes: [
        { note: 'C4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'E4', duration: 1 }, { note: 'F4', duration: 1 },
        { note: 'G4', duration: 1 }, { note: 'A4', duration: 1 },
        { note: 'B4', duration: 1 }, { note: 'C5', duration: 2 },
        { note: 'B4', duration: 1 }, { note: 'A4', duration: 1 },
        { note: 'G4', duration: 1 }, { note: 'F4', duration: 1 },
        { note: 'E4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'C4', duration: 2 }
      ]
    },
    {
      id: 'mary_lamb',
      title: '2. เพลงหนูมาลี (Mary Had a Little Lamb)',
      desc: 'เพลงฝึกซ้อมเดี่ยวคาบที่ 3-4 บรรเลงด้วยลิ้นกลาง',
      tempo: 90,
      notes: [
        { note: 'E4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'C4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'E4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'E4', duration: 2 },
        { note: 'D4', duration: 1 }, { note: 'D4', duration: 1 }, { note: 'D4', duration: 2 },
        { note: 'E4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'G4', duration: 2 },
        { note: 'E4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'C4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'E4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'E4', duration: 1 },
        { note: 'D4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'E4', duration: 1 }, { note: 'D4', duration: 1 }, { note: 'C4', duration: 2 }
      ]
    },
    {
      id: 'ode_to_joy',
      title: '3. เพลง Ode to Joy (Beethoven Symphony No. 9)',
      desc: 'เพลงฝึกรวมวงคาบที่ 5-7 เน้นความพร้อมเพรียง',
      tempo: 95,
      notes: [
        { note: 'E4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'F4', duration: 1 }, { note: 'G4', duration: 1 },
        { note: 'G4', duration: 1 }, { note: 'F4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'C4', duration: 1 }, { note: 'C4', duration: 1 }, { note: 'D4', duration: 1 }, { note: 'E4', duration: 1 },
        { note: 'E4', duration: 1.5 }, { note: 'D4', duration: 0.5 }, { note: 'D4', duration: 2 },
        { note: 'E4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'F4', duration: 1 }, { note: 'G4', duration: 1 },
        { note: 'G4', duration: 1 }, { note: 'F4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'D4', duration: 1 },
        { note: 'C4', duration: 1 }, { note: 'C4', duration: 1 }, { note: 'D4', duration: 1 }, { note: 'E4', duration: 1 },
        { note: 'D4', duration: 1.5 }, { note: 'C4', duration: 0.5 }, { note: 'C4', duration: 2 }
      ]
    },
    {
      id: 'new_year',
      title: '4. เพลงพระราชนิพนธ์ พรปีใหม่ (ท่อนสร้อย)',
      desc: 'เพลงฝึกปฏิบัติรวมวงระดับสูง คาบที่ 8-11',
      tempo: 85,
      notes: [
        { note: 'G4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'C5', duration: 2 },
        { note: 'A4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'E4', duration: 1 }, { note: 'D4', duration: 2 },
        { note: 'E4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'C5', duration: 1 }, { note: 'D5', duration: 2 },
        { note: 'C5', duration: 1 }, { note: 'A4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'E4', duration: 2 }
      ]
    },
    {
      id: 'lanna_folk',
      title: '5. เพลงล่องแม่ปิง / พื้นบ้านล้านนา',
      desc: 'เพลงบูรณาการวัฒนธรรมดนตรีท้องถิ่น คาบที่ 12-14',
      tempo: 80,
      notes: [
        { note: 'E4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'A4', duration: 1 }, { note: 'C5', duration: 2 },
        { note: 'D5', duration: 1 }, { note: 'C5', duration: 1 }, { note: 'A4', duration: 1 }, { note: 'G4', duration: 2 },
        { note: 'A4', duration: 1 }, { note: 'C5', duration: 1 }, { note: 'D5', duration: 1 }, { note: 'E5', duration: 2 },
        { note: 'D5', duration: 1 }, { note: 'C5', duration: 1 }, { note: 'A4', duration: 2 }
      ]
    }
  ],

  init() {
    this.renderTines();
    this.populateSongsSelect();
    this.bindKeyboardShortcuts();
  },

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  },

  // Physical Acoustic Synthesis of a Metal Kalimba Tine
  playNote(noteName) {
    const tine = this.TINES.find(t => t.note === noteName);
    if (!tine) return;

    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // 1. Primary fundamental tone (Sine wave)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tine.freq, now);

      // 2. Metallic harmonic strike (Triangle / High frequency overtones)
      const oscHarmonic = ctx.createOscillator();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(tine.freq * 2.756, now);

      // 3. Wooden body resonance filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(tine.freq * 3.5, now);
      filter.Q.setValueAtTime(3.0, now);

      // 4. Gain envelope (Sharp metal strike attack + slow ringing decay)
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.7, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      // Gain for harmonic
      const gainHarmonic = ctx.createGain();
      gainHarmonic.gain.setValueAtTime(0.25, now);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      // Connect nodes
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscHarmonic.connect(gainHarmonic);
      gainHarmonic.connect(ctx.destination);

      // Start & Stop
      osc.start(now);
      oscHarmonic.start(now);
      osc.stop(now + 1.85);
      oscHarmonic.stop(now + 0.1);

      // UI Highlight animation
      this.highlightTine(tine.id);

      // Mark practice activity in store for badges
      if (typeof Store !== 'undefined' && Store.recordStudentPractice) {
        const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
        if (user && user.studentId) {
          Store.recordStudentPractice(user.studentId, tine.note);
        }
      }
    } catch (e) {
      console.warn('Audio playback not permitted yet', e);
    }
  },

  highlightTine(tineId) {
    const el = document.getElementById(`tine-${tineId}`);
    if (el) {
      el.classList.add('active-hit');
      setTimeout(() => el.classList.remove('active-hit'), 220);
    }
  },

  renderTines() {
    const container = document.getElementById('kalimba-tines-container');
    if (!container) return;
    container.innerHTML = '';

    this.TINES.forEach((t) => {
      const tineDiv = document.createElement('div');
      tineDiv.className = `kalimba-tine ${t.isCenter ? 'is-center' : ''}`;
      tineDiv.id = `tine-${t.id}`;
      tineDiv.style.height = `${t.heightPct}%`;

      tineDiv.innerHTML = `
        <div class="tine-tip"></div>
        <div class="tine-labels">
          <div class="tine-solfege">${t.solfege}</div>
          <div class="tine-note">${t.note}</div>
          <div class="tine-key">${t.key}</div>
        </div>
      `;

      tineDiv.onclick = (e) => {
        e.preventDefault();
        this.playNote(t.note);
      };

      tineDiv.ontouchstart = (e) => {
        e.preventDefault();
        this.playNote(t.note);
      };

      container.appendChild(tineDiv);
    });
  },

  populateSongsSelect() {
    const sel = document.getElementById('kalimba-song-select');
    if (!sel) return;
    sel.innerHTML = '';

    this.PRACTICE_SONGS.forEach((song, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = song.title;
      sel.appendChild(opt);
    });

    this.onSongSelectChange(0);
  },

  onSongSelectChange(idx) {
    this.stopSong();
    this.currentSongIndex = parseInt(idx, 10) || 0;
    const song = this.PRACTICE_SONGS[this.currentSongIndex];
    if (!song) return;

    this.tempoBpm = song.tempo || 90;
    const tempoInput = document.getElementById('kalimba-tempo-input');
    const tempoVal = document.getElementById('kalimba-tempo-val');
    const descEl = document.getElementById('kalimba-song-desc');
    const noteRoll = document.getElementById('kalimba-song-noteroll');

    if (tempoInput) tempoInput.value = this.tempoBpm;
    if (tempoVal) tempoVal.textContent = `${this.tempoBpm} BPM`;
    if (descEl) descEl.textContent = song.desc;

    if (noteRoll) {
      noteRoll.innerHTML = '';
      song.notes.forEach((n, nIdx) => {
        const badge = document.createElement('span');
        badge.id = `song-note-${nIdx}`;
        badge.className = 'song-note-chip';
        badge.textContent = n.note;
        noteRoll.appendChild(badge);
      });
    }
  },

  onTempoChange(val) {
    this.tempoBpm = parseInt(val, 10) || 90;
    const tempoVal = document.getElementById('kalimba-tempo-val');
    if (tempoVal) tempoVal.textContent = `${this.tempoBpm} BPM`;
  },

  togglePlaySong() {
    if (this.isPlayingSong) {
      this.stopSong();
    } else {
      this.startSong();
    }
  },

  startSong() {
    const song = this.PRACTICE_SONGS[this.currentSongIndex];
    if (!song || song.notes.length === 0) return;

    this.isPlayingSong = true;
    this.currentNoteIndex = 0;

    const playBtn = document.getElementById('kalimba-play-btn');
    if (playBtn) {
      playBtn.innerHTML = '⏹️ หยุดซ้อม';
      playBtn.classList.add('playing');
    }

    this.playNextSongNote();
  },

  playNextSongNote() {
    if (!this.isPlayingSong) return;
    const song = this.PRACTICE_SONGS[this.currentSongIndex];
    if (!song) return;

    if (this.currentNoteIndex >= song.notes.length) {
      // Loop or finish
      this.currentNoteIndex = 0;
    }

    // Highlight note chip
    document.querySelectorAll('.song-note-chip').forEach(c => c.classList.remove('active'));
    const curChip = document.getElementById(`song-note-${this.currentNoteIndex}`);
    if (curChip) curChip.classList.add('active');

    const item = song.notes[this.currentNoteIndex];
    this.playNote(item.note);

    const beatMs = (60 / this.tempoBpm) * 1000;
    const noteDurationMs = item.duration * beatMs;

    this.currentNoteIndex++;
    this.activeSongInterval = setTimeout(() => {
      this.playNextSongNote();
    }, noteDurationMs);
  },

  stopSong() {
    this.isPlayingSong = false;
    if (this.activeSongInterval) {
      clearTimeout(this.activeSongInterval);
      this.activeSongInterval = null;
    }
    const playBtn = document.getElementById('kalimba-play-btn');
    if (playBtn) {
      playBtn.innerHTML = '▶️ ซ้อมเพลงนี้ (Play-Along)';
      playBtn.classList.remove('playing');
    }
    document.querySelectorAll('.song-note-chip').forEach(c => c.classList.remove('active'));
  },

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('modal-virtual-kalimba');
      if (!modal || !modal.classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const upper = e.key.toUpperCase();
      const matchedTine = this.TINES.find(t => t.key.toUpperCase() === upper);
      if (matchedTine) {
        e.preventDefault();
        this.playNote(matchedTine.note);
      }
    });
  },

  openModal() {
    const modal = document.getElementById('modal-virtual-kalimba');
    if (modal) {
      modal.classList.add('active');
      this.getAudioContext();
    }
  },

  closeModal() {
    this.stopSong();
    const modal = document.getElementById('modal-virtual-kalimba');
    if (modal) modal.classList.remove('active');
  }
};

if (typeof window !== 'undefined') {
  window.VirtualKalimba = VirtualKalimba;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualKalimba;
}
