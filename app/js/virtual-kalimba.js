// Virtual Kalimba 17-Key Synthesizer & ห้องซ้อม (รายการแบบฝึกดึงจากข้อมูล วก.5 — ไม่ฝังในโค้ด)
// Web Audio API pure client-side physical acoustic synthesis

const VirtualKalimba = {
  audioCtx: null,

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

  // รายการบทเพลง/แบบฝึก "ไม่ได้ฝังในโค้ดนี้อีกต่อไป" — ดึงจาก KALIMBA_MEDIA (สร้างจาก วก.5, tools/curriculum/kalimba_media_source.json)
  // ผ่าน KalimbaMedia.getItems() ซึ่งซ้อนโน้ตที่ครูใส่เอง (KalimbaNotes) ให้อัตโนมัติ
  // เพลงเดิมที่ไม่อยู่ใน วก.5 (หนูมาลี, Ode to Joy ฉบับเดิม, พรปีใหม่, ล่องแม่ปิง) ถูกนำออกจากรายการนักเรียน ม.1
  GRADE_KEY: 'M1',
  STUDENT_ALL_PERIODS: false, // false = นักเรียนเห็นเพลง/แบบฝึกถึงคาบที่กำลังเปิดเท่านั้น (คาบก่อนหน้าเปิดทบทวนได้; คาบถัดไปยังไม่เห็น); ตั้ง true เพื่อเปิดทุกคาบ
  currentItem: null,
  widget: null,

  init() {
    this.renderTines();
    this.populateSongsSelect();
    if (typeof window !== 'undefined') window.addEventListener('ppk-kalimba-notes-changed', () => { const sel = document.getElementById('kalimba-song-select'); if (sel && this.currentItem) this.populateSongsSelect(this.currentItem.id); });
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
      const R = this._root();
      if (R.KalimbaMedia && R.KalimbaMedia.isMuted && R.KalimbaMedia.isMuted()) {
        // โหมดปิดเสียงคาลิมบ้า: ไม่ส่งเสียง แต่ลิ่มยังสว่างและนับการฝึกตามปกติ (ฟังเฉพาะเมโทรนอม)
        this.highlightTine(tine.id);
        this._recordPractice(tine.note);
        return;
      }
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
      this._recordPractice(tine.note);
    } catch (e) {
      console.warn('Audio playback not permitted yet', e);
    }
  },

  _recordPractice(note) {
    if (typeof Store !== 'undefined' && Store.recordStudentPractice) {
      const user = Store.getCurrentUser ? Store.getCurrentUser() : null;
      if (user && user.studentId) Store.recordStudentPractice(user.studentId, note);
    }
  },

  /** ปุ่มปิด/เปิดเสียงคาลิมบ้าในหน้าต่างซ้อม (ใช้ค่าร่วมกับวิดเจ็ต) */
  toggleMute() {
    const R = this._root();
    if (R.KalimbaMedia && R.KalimbaMedia.setMuted) R.KalimbaMedia.setMuted(!R.KalimbaMedia.isMuted());
    this.syncMuteButton();
  },
  syncMuteButton() {
    const R = this._root(), b = typeof document !== 'undefined' && document.getElementById('kalimba-vk-mute');
    if (!b) return;
    const m = !!(R.KalimbaMedia && R.KalimbaMedia.isMuted && R.KalimbaMedia.isMuted());
    b.className = 'km-mute' + (m ? ' km-on' : '');
    b.setAttribute('aria-pressed', m ? 'true' : 'false');
    b.textContent = m ? '🔇 ปิดเสียงคาลิมบ้าอยู่ — ได้ยินเฉพาะเมโทรนอม (แตะเพื่อเปิด)' : '🔊 ปิดเสียงคาลิมบ้า (ฝึกกับเมโทรนอมเท่านั้น)';
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

  // ---- รายการ (data-driven) ----
  _root() { return typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {}); },
  _items(period) {
    const r = this._root();
    if (r.KalimbaMedia && r.KalimbaMedia.getItems) return r.KalimbaMedia.getItems(this.GRADE_KEY, period) || [];
    const m = r.KALIMBA_MEDIA;
    return (m && m.periods && m.periods[this.GRADE_KEY] && m.periods[this.GRADE_KEY][String(period)]) || [];
  },
  /** [{ period, items:[item…] }] เรียงตามคาบ — เฉพาะคาบที่ วก.5 มีแบบฝึก/บทเพลง */
  buildSongList(maxPeriod) {
    const m = this._root().KALIMBA_MEDIA;
    const g = m && m.periods && m.periods[this.GRADE_KEY];
    if (!g) return [];
    return Object.keys(g).map(Number).sort((a, b) => a - b)
      .filter(p => !maxPeriod || p <= maxPeriod)
      .map(p => ({ period: p, items: this._items(p) })).filter(x => x.items.length);
  },
  _role() {
    try { const u = typeof Store !== 'undefined' && Store.getCurrentUser ? Store.getCurrentUser() : null; return u ? (u.role || '') : ''; } catch (e) { return ''; }
  },
  _isStaff() { const r = this._role(); return r === 'teacher' || r === 'intern'; },
  _currentPeriod() {
    try {
      if (typeof App !== 'undefined' && App.state) return Number(this._isStaff() ? App.state.selectedPeriod : (App.state.studentPeriod || App.state.selectedPeriod)) || 0;
    } catch (e) {}
    return 0;
  },
  _periodTopic(p) {
    try { const l = typeof Store !== 'undefined' && Store.getLesson ? Store.getLesson(this.GRADE_KEY, p) : null; if (l && l.topic) return String(l.topic).length > 48 ? String(l.topic).slice(0, 46) + '…' : l.topic; } catch (e) {}
    return '';
  },
  populateSongsSelect(preferItemId) {
    const sel = document.getElementById('kalimba-song-select');
    if (!sel) return;
    const cur = this._currentPeriod();
    const limit = (!this._isStaff() && !this.STUDENT_ALL_PERIODS && cur) ? cur : 0;
    const list = this.buildSongList(limit);
    sel.innerHTML = '';
    let firstOfCurrent = null, first = null;
    list.forEach(g => {
      const og = document.createElement('optgroup');
      const topic = this._periodTopic(g.period);
      og.label = 'คาบที่ ' + g.period + (topic ? ' — ' + topic : '');
      g.items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = g.period + '|' + it.id;
        opt.textContent = it.title; // ชื่อตามที่ วก.5 / source ตั้งไว้ ไม่ใส่เลขลำดับเอง
        og.appendChild(opt);
        if (!first) first = opt.value;
        if (!firstOfCurrent && g.period === cur) firstOfCurrent = opt.value;
        if (preferItemId && it.id === preferItemId) firstOfCurrent = opt.value;
      });
      sel.appendChild(og);
    });
    if (!list.length) {
      const o = document.createElement('option'); o.value = ''; o.textContent = 'ยังไม่มีแบบฝึกใน วก.5'; sel.appendChild(o);
    }
    const pick = firstOfCurrent || first;
    if (pick) sel.value = pick;
    this.onSongSelectChange(sel.value);
  },

  _findItem(val) {
    const parts = String(val || '').split('|');
    const p = Number(parts[0]);
    if (!p) return null;
    const it = this._items(p).filter(x => x.id === parts[1])[0];
    return it ? { period: p, item: it } : null;
  },

  onSongSelectChange(val) {
    this.stopSong();
    const box = document.getElementById('kalimba-vk-widget');
    const found = this._findItem(val);
    this.currentItem = found ? found.item : null;
    if (this.widget) { try { this.widget.destroy(); } catch (e) {} this.widget = null; }
    this._clearPhysical();
    const editBtn = document.getElementById('kalimba-vk-edit');
    if (editBtn) editBtn.style.display = (this._isStaff() && this._root().KalimbaNoteEditor && found) ? 'inline-flex' : 'none';
    if (!box) return;
    if (!found) { box.innerHTML = '<div style="padding:12px;color:#fca5a5;">ยังไม่มีแบบฝึกให้เลือก</div>'; return; }
    const R = this._root();
    if (!R.KalimbaMedia || !R.KalimbaMedia.Widget) { box.innerHTML = '<div style="padding:12px;color:#fca5a5;">โมดูลแสดงโน้ตยังโหลดไม่เสร็จ — รีเฟรชหน้า</div>'; return; }
    const self = this, item = found.item, period = found.period;
    box.innerHTML = '';
    const holder = document.createElement('div'); holder.className = 'vk-widget-light'; box.appendChild(holder);
    this.widget = new R.KalimbaMedia.Widget(holder, item, { tines: false });
    const w = this.widget, orig = w._noteState;
    w._noteState = function (idx, what) { orig.call(w, idx, what); self._syncPhysical(w, idx, what); };
    this._lastPeriod = period;
  },

  _clearPhysical() {
    document.querySelectorAll('#kalimba-tines-container .kalimba-tine.active-hit').forEach(e => e.classList.remove('active-hit'));
    const cn = document.getElementById('kalimba-current-note'); if (cn) cn.textContent = '-';
  },
  _syncPhysical(w, idx, what) {
    if (what === 'reset') { this._clearPhysical(); return; }
    const n = w.notes && w.notes[idx]; if (!n) return;
    n.p.forEach(pitch => {
      const el = document.getElementById('tine-' + pitch);
      if (el) { if (what === 'on') el.classList.add('active-hit'); else el.classList.remove('active-hit'); }
    });
    if (what === 'on') { const cn = document.getElementById('kalimba-current-note'); if (cn) cn.textContent = n.p.length ? (n.th || '') + ' (' + n.p.join('+') + ')' : 'พัก'; }
  },

  openEditor() {
    const R = this._root();
    if (R.KalimbaNoteEditor && this.currentItem) R.KalimbaNoteEditor.open({ gradeKey: this.GRADE_KEY, period: this._lastPeriod, itemId: this.currentItem.id });
  },

  // เข้ากันได้กับปุ่ม/โค้ดเดิม — ตอนนี้ควบคุมผ่านวิดเจ็ตของแบบฝึก (เล่น/พัก/หยุด/BPM/เมโทรนอม)
  onSongChange(val) { return this.onSongSelectChange(val); },
  onTempoChange(val) { if (this.widget) this.widget.setBpm(val); },
  setTempo(val) { return this.onTempoChange(val); },
  togglePlay() { return this.togglePlaySong(); },
  stopPlay() { return this.stopSong(); },
  togglePlaySong() { if (this.widget) { if (this.widget.transport.state === 'playing') this.widget.stop(); else this.widget.play(); } },
  startSong() { if (this.widget) this.widget.play(); },
  stopSong() { if (this.widget) { try { this.widget.stop(); } catch (e) {} } this._clearPhysical(); },

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

  openModal(preferItemId) {
    const modal = document.getElementById('modal-virtual-kalimba');
    if (modal) {
      modal.classList.add('active');
      this.getAudioContext();
      this.populateSongsSelect(preferItemId);
      this.syncMuteButton();
      if (!this._muteBound && typeof window !== 'undefined') { this._muteBound = true; window.addEventListener('ppk-kalimba-mute-changed', () => this.syncMuteButton()); }
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
