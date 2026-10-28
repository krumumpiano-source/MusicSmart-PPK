/* timbre-listening.js — ES5 · กิจกรรมฟังเปรียบเทียบเสียงต่างวัฒนธรรม คาบ 16 (วก.5 ม.1) + Feldman 4 ขั้นตอน
 * - ใช้เป็นกิจกรรมสำรองในแอปเมื่อครูยังไม่มีไฟล์เสียงจริง (ช่อง p16_* ใน PeriodMedia ถ้ามีไฟล์จะแสดงด้านบน)
 * - เสียงเป็นเสียงจำลอง (Web Audio) จาก ENSEMBLE_DATA.synthPresets — ไม่ใช่เสียงเครื่องดนตรีจริง
 * - ข้อมูลทั้งหมด (เครื่อง วัฒนธรรม ระดับความเร็ว/ความดัง คำอารมณ์ ขั้น Feldman) มาจาก ENSEMBLE_DATA ไม่ฮาร์ดโค้ด
 * - ไม่นับคะแนนเก็บ (ครูให้คะแนนเอง) · บันทึกร่างไว้ในเครื่องนักเรียน (ppk_timbre_listen_<รหัส>) */
(function (root) {
  'use strict';
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function data() { return root.ENSEMBLE_DATA || null; }
  function L() { var d = data(); return d && d.listening; }
  function byId(id) { return root.document && root.document.getElementById ? root.document.getElementById(id) : null; }

  var TL = {
    MODAL_ID: 'modal-timbre-listening',
    state: null,
    _ctx: null,

    /** เครื่องดนตรีของแต่ละวัฒนธรรม (หมวดวง) — รวมจากผังที่นั่งในข้อมูล ตัดซ้ำ ตัดผู้อำนวยเพลง/เสียงร้อง */
    instrumentsOf: function (cat) {
      var d = data(), out = [], seen = {}, c = d && d.categories[cat];
      if (!c) return out;
      Object.keys(c.ensembles).forEach(function (ek) {
        c.ensembles[ek].seating.forEach(function (s) {
          var ins = d.instruments[s.inst];
          if (!ins || seen[s.inst] || ins.cls === 'ผู้อำนวยเพลง' || ins.cls === 'เสียงร้อง') return;
          seen[s.inst] = 1; out.push({ id: s.inst, name: ins.name, cls: ins.cls, tone: ins.tone, synth: ins.synth, review: ins.review !== false });
        });
      });
      return out;
    },
    cultures: function () {
      var d = data(); if (!d) return [];
      return Object.keys(d.categories).map(function (k) { return { key: k, label: d.categories[k].name || k }; });
    },
    studentId: function () {
      try {
        if (root.App && root.App.state && root.App.state.studentId) return String(root.App.state.studentId);
        if (root.Store && root.Store.getCurrentUser) { var u = root.Store.getCurrentUser(); if (u && u.studentId) return String(u.studentId); }
      } catch (e) {}
      return 'guest';
    },
    storeKey: function () { return 'ppk_timbre_listen_' + this.studentId() + '_p16'; },
    load: function () { try { var raw = root.localStorage && root.localStorage.getItem(this.storeKey()); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    save: function () {
      try { if (root.localStorage) root.localStorage.setItem(this.storeKey(), JSON.stringify({ sel: this.state.sel, moods: this.state.moods, feldman: this.state.feldman, savedAt: new Date().toISOString() })); return true; } catch (e) { return false; }
    },
    fresh: function () {
      var cs = this.cultures(), a = cs[0] ? cs[0].key : 'thai', b = cs[cs.length - 1] ? cs[cs.length - 1].key : 'western';
      var ia = this.instrumentsOf(a)[0], ib = this.instrumentsOf(b)[0];
      var saved = this.load() || {};
      return {
        sel: saved.sel || { A: { cat: a, inst: ia && ia.id }, B: { cat: b, inst: ib && ib.id } },
        moods: saved.moods || { A: [], B: [] },
        feldman: saved.feldman || {},
        tempoIdx: 1, dynIdx: 1,
        test: null, tally: { tempo: [0, 0], dyn: [0, 0] }, msg: ''
      };
    },

    /** เล่นรูปแบบสั้น ๆ ด้วยเสียงจำลองของเครื่อง ที่ bpm และ gain ที่กำหนด; คืนรายการโน้ตที่จัดตาราง (ใช้ทดสอบได้) */
    schedule: function (instId, bpm, gain) {
      var d = data(), ins = d && d.instruments[instId]; if (!ins) return [];
      var pr = d.synthPresets[ins.synth] || d.synthPresets.generic, beat = 60 / bpm, pat = L().pattern, out = [], i;
      for (i = 0; i < pat.length; i++) out.push({ t: i * beat, freq: pr.freq * pat[i], wave: pr.wave, peak: Math.max(0.001, pr.peak * gain), attack: pr.attack, decay: Math.min(pr.decay, beat * 0.95) });
      return out;
    },
    play: function (instId, bpm, gain) {
      try {
        var AC = root.AudioContext || root.webkitAudioContext; if (!AC) { this.say('เบราว์เซอร์นี้เล่นเสียงไม่ได้'); return false; }
        if (!this._ctx) this._ctx = new AC();
        var ctx = this._ctx; if (ctx.resume) ctx.resume();
        var notes = this.schedule(instId, bpm, gain), t0 = ctx.currentTime + 0.05;
        notes.forEach(function (n) {
          var o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + n.t;
          o.type = n.wave; o.frequency.setValueAtTime(n.freq, t);
          g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(n.peak, t + Math.max(0.003, n.attack));
          g.gain.exponentialRampToValueAtTime(0.001, t + n.attack + n.decay);
          o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + n.attack + n.decay + 0.05);
        });
        return notes.length > 0;
      } catch (e) { return false; }
    },
    say: function (m) { if (this.state) this.state.msg = m; },
    cur: function (w) { var s = this.state.sel[w]; return s && s.inst; },
    playSide: function (w) {
      var L0 = L(), t = L0.tempos[this.state.tempoIdx], dy = L0.dynamics[this.state.dynIdx];
      if (!this.cur(w)) return false;
      return this.play(this.cur(w), t.bpm, dy.gain);
    },

    /** ข้อสอบฟังแยกระดับ (ไม่นับคะแนนเก็บ): สุ่มระดับความเร็วหรือความดัง แล้วให้นักเรียนตอบ */
    startTest: function (kind, rnd) {
      var L0 = L(), list = kind === 'tempo' ? L0.tempos : L0.dynamics, r = typeof rnd === 'function' ? rnd() : Math.random();
      var idx = Math.min(list.length - 1, Math.floor(r * list.length)), w = 'A';
      this.state.test = { kind: kind, idx: idx, answered: false, ok: null };
      var bpm = kind === 'tempo' ? L0.tempos[idx].bpm : L0.tempos[1].bpm, gain = kind === 'dyn' ? L0.dynamics[idx].gain : L0.dynamics[1].gain;
      if (this.cur(w)) this.play(this.cur(w), bpm, gain);
      this.render();
    },
    replayTest: function () {
      var t = this.state.test, L0 = L(); if (!t) return;
      this.play(this.cur('A'), t.kind === 'tempo' ? L0.tempos[t.idx].bpm : L0.tempos[1].bpm, t.kind === 'dyn' ? L0.dynamics[t.idx].gain : L0.dynamics[1].gain);
    },
    answerTest: function (i) {
      var t = this.state.test; if (!t || t.answered) return;
      t.answered = true; t.ok = (i === t.idx);
      var k = t.kind === 'tempo' ? 'tempo' : 'dyn'; this.state.tally[k][1]++; if (t.ok) this.state.tally[k][0]++;
      this.render();
    },
    setSel: function (w, field, v) {
      var s = this.state.sel[w];
      if (field === 'cat') { s.cat = v; var l = this.instrumentsOf(v); s.inst = l[0] ? l[0].id : null; } else s.inst = v;
      this.save(); this.render();
    },
    setTempo: function (i) { this.state.tempoIdx = Number(i) || 0; this.render(); },
    setDyn: function (i) { this.state.dynIdx = Number(i) || 0; this.render(); },
    toggleMood: function (w, m) {
      var a = this.state.moods[w], i = a.indexOf(m); if (i >= 0) a.splice(i, 1); else a.push(m);
      this.save(); this.render();
    },
    setFeldman: function (key, v) { this.state.feldman[key] = String(v || '').slice(0, 1200); this.save(); },
    openFeldman: function () {
      if (root.FeldmanCriticism && root.FeldmanCriticism.openModal) { this.closeModal(); root.FeldmanCriticism.openModal(16); }
    },

    ensureModal: function () {
      var m = byId(this.MODAL_ID);
      if (m || !root.document || !root.document.createElement) return m;
      m = root.document.createElement('div'); m.id = this.MODAL_ID; m.className = 'modal-overlay';
      m.innerHTML = '<div class="modal-card" style="max-width:860px;width:95vw;max-height:94vh;display:flex;flex-direction:column;"><div class="modal-header"><h3 style="margin:0;font-size:1.1rem;">🎧 ฟังเปรียบเทียบเสียงต่างวัฒนธรรม (คาบ 16)</h3><button class="modal-close-btn" onclick="TimbreListening.closeModal()">✕</button></div><div id="timbre-listening-body" style="padding:12px 16px;overflow:auto;"></div></div>';
      (root.document.body || root.document.documentElement).appendChild(m);
      return m;
    },
    openModal: function () {
      var d = data();
      if (!d || !d.listening) { if (root.alert) root.alert('ข้อมูลกิจกรรมฟังยังโหลดไม่เสร็จ ลองรีเฟรชหน้าแล้วเปิดใหม่'); return false; }
      var m = this.ensureModal(); if (!m) return false;
      this.state = this.fresh();
      m.classList.add('active'); this.render(); return true;
    },
    closeModal: function () { var m = byId(this.MODAL_ID); if (m) m.classList.remove('active'); },

    sideHTML: function (w) {
      var d = data(), self = this, s = this.state.sel[w], cs = this.cultures(), list = this.instrumentsOf(s.cat), ins = d.instruments[s.inst] || {};
      var h = '<div style="flex:1;min-width:250px;border:1px solid #cfd8dc;border-radius:8px;padding:8px 10px;background:#fff;"><div style="font-weight:700;">เสียง ' + w + '</div>';
      h += '<select aria-label="วัฒนธรรม ' + w + '" onchange="TimbreListening.setSel(\'' + w + '\',\'cat\',this.value)" style="width:100%;margin:4px 0;padding:6px;">' + cs.map(function (c) { return '<option value="' + esc(c.key) + '"' + (c.key === s.cat ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') + '</select>';
      h += '<select aria-label="เครื่องดนตรี ' + w + '" onchange="TimbreListening.setSel(\'' + w + '\',\'inst\',this.value)" style="width:100%;margin:4px 0;padding:6px;">' + list.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === s.inst ? ' selected' : '') + '>' + esc(i.name) + '</option>'; }).join('') + '</select>';
      h += '<button class="btn-nav-action primary" onclick="TimbreListening.playSide(\'' + w + '\')" style="width:100%;margin:4px 0;">▶ ฟังเสียง ' + w + '</button>';
      h += '<div style="font-size:12px;color:#546e7a;">ประเภท: ' + esc(ins.cls || '-') + '</div>';
      h += '<div style="margin-top:6px;font-size:13px;">อารมณ์ที่รู้สึก:</div><div>' + L().moods.map(function (m) {
        var on = self.state.moods[w].indexOf(m) >= 0;
        return '<button type="button" onclick="TimbreListening.toggleMood(\'' + w + '\',this.getAttribute(\'data-m\'))" data-m="' + esc(m) + '" aria-pressed="' + on + '" style="margin:2px;padding:4px 8px;border-radius:14px;border:1px solid #90a4ae;background:' + (on ? '#c8e6c9' : '#fff') + ';">' + esc(m) + '</button>';
      }).join('') + '</div></div>';
      return h;
    },
    testHTML: function () {
      var L0 = L(), t = this.state.test, tl = this.state.tally, h = '<div style="margin:10px 0;padding:8px 10px;border-left:4px solid #6a1b9a;background:#f3e5f5;border-radius:6px;"><div style="font-weight:700;">ฝึกฟังแยกระดับ (ไม่นับคะแนนเก็บ)</div>';
      h += '<div style="font-size:13px;margin:4px 0;">ฟังเสียง A แล้วบอกว่า<b>ความเร็ว (Tempo)</b>หรือ<b>ความดัง-เบา (Dynamics)</b>อยู่ระดับไหน</div>';
      h += '<button class="btn-nav-action" onclick="TimbreListening.startTest(\'tempo\')">🎲 สุ่มความเร็ว</button> <button class="btn-nav-action" onclick="TimbreListening.startTest(\'dyn\')">🎲 สุ่มความดัง</button>';
      if (t) {
        var list = t.kind === 'tempo' ? L0.tempos : L0.dynamics;
        h += '<div style="margin-top:6px;"><button class="btn-nav-action" onclick="TimbreListening.replayTest()">🔁 ฟังซ้ำ</button> ' + list.map(function (x, i) { return '<button class="btn-nav-action" onclick="TimbreListening.answerTest(' + i + ')">' + esc(x.label) + '</button>'; }).join(' ') + '</div>';
        if (t.answered) h += '<div style="margin-top:4px;font-weight:700;color:' + (t.ok ? '#2e7d32' : '#c62828') + ';">' + (t.ok ? '✓ ถูกต้อง' : '✗ ยังไม่ใช่ — คำตอบคือ "' + esc(list[t.idx].label) + '"') + '</div>';
      }
      h += '<div style="font-size:12px;color:#546e7a;margin-top:4px;">ฝึกแล้ว: ความเร็ว ถูก ' + tl.tempo[0] + '/' + tl.tempo[1] + ' · ความดัง ถูก ' + tl.dyn[0] + '/' + tl.dyn[1] + '</div></div>';
      return h;
    },
    render: function () {
      var body = byId('timbre-listening-body'), L0 = L(), self = this; if (!body || !this.state) return;
      var h = '';
      if (root.PeriodMedia && root.PeriodMedia.mountHTML) { try { h += root.PeriodMedia.mountHTML('M1', 16, { role: 'student' }); } catch (e) {} }
      h += '<div style="background:#fff8e1;color:#6d4c41;padding:6px 8px;border-radius:6px;font-size:12px;margin-bottom:8px;">⚠ เสียงในกิจกรรมนี้เป็น <b>เสียงจำลอง</b> ไม่ใช่เสียงเครื่องดนตรีจริง — ใช้ฝึกสังเกตสีสันเสียง ความเร็ว ความดัง-เบา · ฟังเพลงจริงจากครู/สื่อในคาบ · ไม่นับคะแนนเก็บ</div>';
      h += '<div style="font-size:13px;margin-bottom:6px;">' + esc(L0.wk5) + '</div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + this.sideHTML('A') + this.sideHTML('B') + '</div>';
      h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;"><label style="font-size:13px;">ความเร็ว (Tempo) <select aria-label="ความเร็ว" onchange="TimbreListening.setTempo(this.value)">' + L0.tempos.map(function (x, i) { return '<option value="' + i + '"' + (i === self.state.tempoIdx ? ' selected' : '') + '>' + esc(x.label) + ' (' + x.bpm + ' BPM)</option>'; }).join('') + '</select></label>';
      h += '<label style="font-size:13px;">ความดัง-เบา (Dynamics) <select aria-label="ความดัง" onchange="TimbreListening.setDyn(this.value)">' + L0.dynamics.map(function (x, i) { return '<option value="' + i + '"' + (i === self.state.dynIdx ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label></div>';
      h += this.testHTML();
      h += '<div style="margin:10px 0;"><div style="font-weight:700;">วิจารณ์ตามหลัก Feldman 4 ขั้นตอน (ร่าง บันทึกในเครื่องนี้)</div>' + L0.feldman.map(function (f) {
        return '<div style="margin:6px 0;"><div style="font-size:13px;"><b>' + esc(f.label) + '</b> — ' + esc(f.hint) + '</div><div style="font-size:12px;color:#546e7a;">' + esc(f.prompt) + '</div><textarea rows="2" data-fk="' + esc(f.key) + '" oninput="TimbreListening.setFeldman(this.getAttribute(\'data-fk\'),this.value)" style="width:100%;padding:6px;">' + esc(self.state.feldman[f.key] || '') + '</textarea></div>';
      }).join('') + '<button class="btn-nav-action primary" onclick="TimbreListening.openFeldman()">🎨 ไปกรอกแบบฟอร์มวิจารณ์ Feldman ฉบับส่งครู</button></div>';
      body.innerHTML = h;
    }
  };
  root.TimbreListening = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
