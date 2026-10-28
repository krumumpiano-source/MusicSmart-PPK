// ==========================================================================
// ห้องสำรวจวงดนตรี (Interactive Ensemble Explorer) • สาระดนตรี ม.1 หน่วยที่ 3
// วก.5 คาบ 12: วงดนตรีไทย (ปี่พาทย์ เครื่องสาย มโหรี) + วงพื้นบ้าน 4 ภาค (ล้านนา อีสาน กลาง ใต้)
// วก.5 คาบ 14: วงดนตรีสากล 5 ประเภท
//
// ข้อมูลทั้งหมด (ชื่อวง ภาค เครื่องดนตรี บทบาท ผังที่นั่ง เสียงจำลอง) อยู่ใน app/data/ensemble_data.js
// ซึ่งสร้างจาก tools/curriculum/ensemble_source.json (node tools/curriculum/build_ensemble_data.js)
// ไฟล์นี้มีแต่ตรรกะแสดงผล — ไม่มีเนื้อหาวงดนตรีฝังอยู่ในโค้ด
// รายการที่ review=true คือร่างโดยระบบ ต้องให้ครูตรวจก่อนใช้สอน — ป้าย/คำเตือนร่างแสดงเฉพาะมุมมองครู (พับอยู่ใน 'ข้อสังเกตสำหรับครู') นักเรียนไม่เห็น
// เปิดตามคาบ: openModal(cat, key, period) แสดงเฉพาะวงที่ วก.5 ของคาบนั้นระบุ (คาบ 12 = ไทย+พื้นบ้าน, คาบ 14 = สากล)
// ผังที่นั่ง: จัดเป็นแถวจากค่า y ในข้อมูล (ไม่วางทับซ้อนแบบ absolute) — ปุ่มสูง ≥44px ตัดบรรทัดชื่อได้ ใช้ได้ที่ 360px ถึง 1024px
// ==========================================================================

const EnsembleExplorer = {
  activeCategory: 'thai', // 'thai' | 'folk' | 'western'
  activeEnsembleKey: null,
  selectedSeat: null,      // index ใน seating
  quiz: null,
  period: null,            // คาบที่เปิดมา: ตัวเลข หรือ อาร์เรย์ของคาบ (นักเรียนเปิดจากเมนูรวม = คาบที่ถึงแล้ว) · null = ไม่จำกัด (ครู)

  // ---- ข้อมูล ----
  getData() {
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
    return root.ENSEMBLE_DATA || null;
  },
  categoryKeys() { const d = this.getData(); return d ? Object.keys(d.categories) : []; },
  getEnsembles(cat) { const d = this.getData(); return d && d.categories[cat] ? d.categories[cat].ensembles : {}; },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  // ---- มุมมองครู/นักเรียน ----
  isTeacher() { return typeof App !== 'undefined' && !!App.state && App.state.role === 'teacher'; },
  // ข้อความร่างในข้อมูล เช่น "(รอครูตรวจ)" — นักเรียนไม่เห็น (ครูเห็นต้นฉบับ)
  clean(s) {
    if (s == null) return '';
    const t = String(s);
    if (this.isTeacher()) return t;
    return t.replace(/\s*[(（][^)）]*(?:รอครูตรวจ|ร่างโดยระบบ|ครูโปรดยืนยัน)[^)）]*[)）]/g, '').replace(/\s{2,}/g, ' ').trim();
  },
  hasDraftMark(s) { return /รอครูตรวจ|ร่างโดยระบบ|ครูโปรดยืนยัน/.test(String(s || '')); },

  // ---- คาบ ↔ วง (ข้อมูล: ensemble.period) ----
  periodsAvailable() {
    const d = this.getData(), out = {};
    if (!d) return [];
    Object.keys(d.categories).forEach(ck => { const m = d.categories[ck].ensembles; Object.keys(m).forEach(k => { if (m[k].period) out[m[k].period] = 1; }); });
    return Object.keys(out).map(Number).sort((a, b) => a - b);
  },
  hasPeriod(p) { return this.periodsAvailable().indexOf(Number(p)) >= 0; },
  _pset(period) { return period == null ? null : (Array.isArray(period) ? period.map(Number) : [Number(period)]); },
  // หมวดที่เปิดได้ในคาบนั้น (ไม่ระบุคาบ = ทุกหมวด)
  categoriesFor(period) {
    const d = this.getData();
    if (!d) return [];
    const ps = this._pset(period);
    if (!ps || !ps.length) return this.categoryKeys();
    return this.categoryKeys().filter(ck => Object.keys(d.categories[ck].ensembles).some(k => ps.indexOf(d.categories[ck].ensembles[k].period) >= 0));
  },
  // วงในหมวด (กรองตามคาบที่เปิดมา)
  ensemblesIn(cat) {
    const all = this.getEnsembles(cat), out = {};
    const ps = this._pset(this.period);
    Object.keys(all).forEach(k => { if (!ps || !ps.length || ps.indexOf(all[k].period) >= 0) out[k] = all[k]; });
    return out;
  },

  // ---- ผังที่นั่ง: จัดเป็นแถวตามค่า y แล้วเรียงซ้าย→ขวาตามค่า x (ไม่ทับซ้อนโดยโครงสร้าง) ----
  layoutRows(seating, threshold) {
    const th = threshold == null ? 12 : threshold;
    const idx = seating.map((s, i) => i).sort((a, b) => (seating[a].y - seating[b].y) || (seating[a].x - seating[b].x));
    const rows = [];
    idx.forEach(i => {
      const last = rows[rows.length - 1];
      if (last && seating[i].y - seating[last[0]].y <= th) last.push(i); else rows.push([i]);
    });
    rows.forEach(r => r.sort((a, b) => (seating[a].x - seating[b].x) || (a - b)));
    return rows;
  },

  // การ์ดเครื่องดนตรี: รวมข้อมูลเครื่อง (instruments) + บทบาทเฉพาะวง (seating)
  getInstrumentCard(cat, ensKey, seatIdx) {
    const d = this.getData();
    const ens = d && d.categories[cat] && d.categories[cat].ensembles[ensKey];
    const seat = ens && ens.seating[seatIdx];
    if (!seat) return null;
    const ins = d.instruments[seat.inst] || {};
    const synth = ins.synth || 'generic';
    return {
      id: seat.inst, name: ins.name || seat.inst, en: ins.en || '', cls: ins.cls || '', detail: ins.detail || '',
      role: seat.role || '', tone: seat.tone || ins.tone || '', synth: synth,
      how: ins.how || (d.howBySynth || {})[synth] || '',
      review: !!(ins.review || ens.review), ensembleName: ens.name, wk5: ens.wk5 || '',
      audio: ins.audio || null, image: ins.image || null, hasSample: this.hasSample(seat.inst)
    };
  },

  // ---- เสียงจำลอง (Web Audio) จาก synthPresets ในข้อมูล — ไม่ใช่เสียงเครื่องดนตรีจริง ----
  audioCtor() {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
  },
  hasSample(instId) {
    const d = this.getData();
    const ins = d && d.instruments[instId];
    if (!ins) return false;
    if (ins.audio) return true;
    return !!(d.synthPresets[ins.synth] && this.audioCtor());
  },
  // เสียงจริง (ไฟล์จาก Commons ที่ระบุใน ensemble_audio.json → ins.audio) — ถ้าเล่นไม่ได้จะใช้เสียงจำลองแทนและบอกบนจอ
  playReal(ins) {
    try {
      if (typeof Audio === 'undefined' || !ins || !ins.audio || !ins.audio.file) return false;
      if (this._aud) { try { this._aud.pause(); } catch (e) { /* ข้าม */ } }
      const a = new Audio(ins.audio.file);
      this._aud = a;
      const fallback = () => {
        const s = typeof document !== 'undefined' && document.getElementById && document.getElementById('ens-audio-status');
        if (s) s.textContent = 'เล่นเสียงจริงไม่ได้ในขณะนี้ (ไฟล์ไม่พร้อม/ออฟไลน์) — ได้ยินเป็นเสียงจำลองแทน';
        this.playSynth(ins);
      };
      a.addEventListener('error', fallback);
      const r = a.play();
      if (r && typeof r.catch === 'function') r.catch(fallback);
      return true;
    } catch (e) { return false; }
  },
  playSample(instId) {
    const d0 = this.getData();
    const ins0 = d0 && d0.instruments[instId];
    if (ins0 && ins0.audio && this.playReal(ins0)) return;
    if (ins0) this.playSynth(ins0);
  },
  playSynth(ins) {
    try {
      const d = this.getData();
      if (!d || !ins) return;
      const pr = d.synthPresets[ins.synth] || d.synthPresets.generic;
      const AC = this.audioCtor();
      if (!AC || !pr) return;
      if (!this._ctx) this._ctx = new AC();
      const ctx = this._ctx;
      if (ctx.resume) ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = pr.wave;
      osc.frequency.setValueAtTime(pr.freq, t);
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(pr.peak, t + Math.max(0.003, pr.attack));
      gain.gain.exponentialRampToValueAtTime(0.001, t + pr.attack + pr.decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + pr.attack + pr.decay + 0.05);
    } catch (e) {
      console.log('Audio preview error', e);
    }
  },

  openModal(defaultCategory = 'thai', ensembleKey = null, period = null) {
    const modal = document.getElementById('modal-ensemble-explorer');
    if (!modal) return;
    if (!this.getData()) { alert('ข้อมูลวงดนตรียังโหลดไม่เสร็จ ลองรีเฟรชหน้าแล้วเปิดใหม่'); return; }
    this.period = this._pset(period);
    let cats = this.categoriesFor(this.period);
    if (!cats.length) { this.period = null; alert('ยังไม่มีวงดนตรีของคาบนี้ใน วก.5'); return; }
    this.activeCategory = cats.indexOf(defaultCategory) >= 0 ? defaultCategory : cats[0];
    const keys = Object.keys(this.ensemblesIn(this.activeCategory));
    this.activeEnsembleKey = ensembleKey && keys.indexOf(ensembleKey) >= 0 ? ensembleKey : keys[0];
    this.selectedSeat = null;
    this.quiz = null;
    modal.classList.add('active');
    this.render();
  },

  closeModal() {
    const modal = document.getElementById('modal-ensemble-explorer');
    if (modal) modal.classList.remove('active');
  },

  switchCategory(catKey) {
    this.activeCategory = catKey;
    this.activeEnsembleKey = Object.keys(this.ensemblesIn(catKey))[0];
    this.selectedSeat = null;
    this.quiz = null;
    this.render();
  },

  // เลื่อนไปยังส่วนที่เพิ่งเปลี่ยน (มือถือ: รายชื่อวงยาว ผัง/การ์ดอยู่ใต้จอ) — ไม่ทำอะไรถ้าไม่มี DOM
  _scrollTo(id, block) {
    try {
      const el = typeof document !== 'undefined' && document.getElementById && document.getElementById(id);
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: block || 'start' });
    } catch (e) { /* เบราว์เซอร์เก่า: ข้าม */ }
  },

  selectEnsemble(key) {
    this.activeEnsembleKey = key;
    this.selectedSeat = null;
    this.quiz = null;
    this.render();
    this._scrollTo('ensemble-info-banner', 'start');
  },

  selectSeat(idx) {
    this.selectedSeat = idx;
    this.quiz = null;
    const card = this.getInstrumentCard(this.activeCategory, this.activeEnsembleKey, idx);
    if (card && card.hasSample) this.playSample(card.id);
    this.render();
    this._scrollTo('ensemble-instrument-inspector', 'nearest');
  },

  // ---- แสดงผล ----
  reviewBadge(on) {
    const d = this.getData();
    return on ? `<span class="ens-draft">${this.esc(d.reviewLabel)}</span>` : '';
  },

  // ภาพวง: ภาพจริงจาก Commons (พร้อมเครดิต) หรือภาพประกอบ SVG ที่ติดป้าย 'ภาพประกอบ'
  placeholderSVG(ens) {
    const E = s => this.esc(s);
    const dots = ens.seating.map((s, i) => `<circle cx="${(10 + Number(s.x) * 0.8).toFixed(1)}" cy="${(14 + Number(s.y) * 0.5).toFixed(1)}" r="5" fill="#93c5fd" stroke="#1d4ed8" stroke-width="1"/>`).join('');
    return `<svg viewBox="0 0 100 70" class="ens-ph" role="img" aria-label="ภาพประกอบ: ผังวง ${E(ens.name)}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="98" height="68" rx="6" fill="#f1f5f9" stroke="#cbd5e1"/><path d="M8 60 Q50 44 92 60" fill="none" stroke="#94a3b8" stroke-dasharray="3 2"/>${dots}<text x="50" y="9" text-anchor="middle" font-size="6" fill="#475569">ภาพประกอบ</text></svg>`;
  },
  imageHTML(ens) {
    const E = s => this.esc(s);
    const im = ens.image;
    // ไม่มีภาพที่ตรวจแล้ว: นักเรียนไม่เห็นกรอบภาพ (ไม่มีกรอบว่าง/ภาพแทน) · ครูเห็นโน้ต "ครูเตรียมภาพ"
    if (!im) return this.isTeacher() && ens.imageTeacherNote ? `<div class="ens-fig-note">📷 ${this.esc(ens.imageTeacherNote)}</div>` : '';
    return `<div class="ens-fig"><img class="ens-img" src="${E(im.file)}" alt="${E(im.alt)}" loading="lazy" onerror="var f=this.parentNode;if(f&&f.style)f.style.display='none';">
      <div class="ens-credit">ภาพ: ${E(im.alt)} · ${E(im.author)} · ${E(im.license)} · <a href="${E(im.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></div></div>`;
  },

  render() {
    const d = this.getData();
    if (!d) return;
    const cats = this.categoryKeys();
    const allowed = this.categoriesFor(this.period);
    const ensMap = this.ensemblesIn(this.activeCategory);
    const ens = ensMap[this.activeEnsembleKey];
    if (!ens) return;
    const E = s => this.esc(s), C = s => this.esc(this.clean(s));
    const teacher = this.isTeacher();

    cats.forEach(k => {
      const btn = document.getElementById(`ens-cat-${k}`);
      if (btn) {
        btn.className = `academic-tab-btn ${this.activeCategory === k ? 'active' : ''}`;
        btn.style.display = allowed.indexOf(k) >= 0 ? '' : 'none';
      }
    });

    const selectorContainer = document.getElementById('ensemble-pills-selector');
    if (selectorContainer) {
      selectorContainer.innerHTML = Object.keys(ensMap).map(k => `
        <button type="button" class="btn-nav-action ens-pill ${this.activeEnsembleKey === k ? 'primary' : ''}" onclick="EnsembleExplorer.selectEnsemble('${E(k)}')">
          ${E(ensMap[k].name)}
        </button>
      `).join('');
    }

    const infoEl = document.getElementById('ensemble-info-banner');
    if (infoEl) {
      const folkRegions = this.activeCategory === 'folk'
        ? `<div class="ens-sub">ครบ 4 ภาคตาม วก.5: ${d.regions.map(r => {
            const key = Object.keys(ensMap).filter(k => ensMap[k].region === r)[0];
            return key ? `<a href="javascript:void(0)" class="ens-region" style="${key === this.activeEnsembleKey ? 'font-weight:800;' : ''}" onclick="EnsembleExplorer.selectEnsemble('${E(key)}')">${E(r)}</a>` : E(r);
          }).join(' • ')}</div>` : '';
      const facts = [];
      if (ens.region) facts.push(`ภูมิภาค: <strong>${E(this.clean(ens.region))}</strong>`);
      if (ens.size) facts.push(`ขนาดวง: <strong>${C(ens.size)}</strong>`);
      if (this.clean(ens.era)) facts.push(`ยุค/ที่มา: <strong>${C(ens.era)}</strong>`);
      if (this.clean(ens.occasion)) facts.push(`โอกาสที่ใช้: ${C(ens.occasion)}`);
      const teacherNotes = teacher ? this.teacherNotesHTML(ens) : '';
      infoEl.innerHTML = `
        <h3 class="ens-title">${E(ens.name)}</h3>
        ${this.imageHTML(ens)}
        <div class="ens-sub">${facts.join(' • ')}</div>
        <div class="ens-sub ens-ref">อ้างอิง: ${E(ens.wk5)}</div>
        ${folkRegions}
        ${this.clean(ens.soundChar) ? `<div class="ens-timbre">🔊 <strong>สีสันของเสียง (Timbre):</strong> ${C(ens.soundChar)}</div>` : ''}
        ${teacherNotes}
      `;
    }

    const stageEl = document.getElementById('ensemble-stage-canvas');
    if (stageEl) {
      const rows = this.layoutRows(ens.seating);
      stageEl.innerHTML = `
        <div class="ens-stage" role="group" aria-label="ผังที่นั่ง ${E(ens.name)}">
          <div class="ens-stage-back">ด้านหลังเวที</div>
          ${rows.map(r => `<div class="ens-row">${r.map(idx => {
            const card = this.getInstrumentCard(this.activeCategory, this.activeEnsembleKey, idx);
            const sel = this.selectedSeat === idx;
            return `<button type="button" class="ens-seat${sel ? ' sel' : ''}" aria-pressed="${sel ? 'true' : 'false'}" data-seat="${idx}" onclick="EnsembleExplorer.selectSeat(${idx})"><span class="ens-seat-n">${idx + 1}</span><span class="ens-seat-name">${E(card.name)}</span>${card.audio ? '<span class="ens-seat-real" title="มีเสียงจริง">🎧 เสียงจริง</span>' : ''}</button>`;
          }).join('')}</div>`).join('')}
          <div class="ens-stage-front">🎭 ด้านหน้าเวที (ผู้ฟัง)</div>
        </div>
      `;
    }
    this.renderInspector();
  },

  // ข้อสังเกตสำหรับครู (เห็นเฉพาะครู · พับไว้)
  teacherNotesHTML(ens) {
    const d = this.getData(), E = s => this.esc(s);
    const marks = [];
    ['era', 'soundChar', 'occasion', 'region'].forEach(f => { if (this.hasDraftMark(ens[f])) marks.push(f + ': ' + ens[f]); });
    return `<details class="ens-teacher"><summary>ข้อสังเกตสำหรับครู</summary>
      <div>${ens.review ? this.reviewBadge(true) : ''} ${E(d.reviewNote)}</div>
      ${ens.note ? `<div>${E(ens.note)}</div>` : ''}
      ${ens.image && ens.image.teacherNote ? `<div>📷 ${E(ens.image.teacherNote)}</div>` : ''}
      ${marks.length ? `<div>ฟิลด์ที่ยังเป็นร่าง (นักเรียนไม่เห็นข้อความร่าง): ${marks.map(E).join(' · ')}</div>` : ''}
      <div>ผังที่นั่งจัดเป็นแถวตามตำแหน่งในข้อมูล (ไม่ใช่ผังจริงของวง) — ถ้าต้องการผังจริง แก้ x/y ใน ensemble_source.json</div>
    </details>`;
  },

  // เครดิตเสียงจริง (CC BY-SA ต้องระบุผู้สร้าง สิทธิ์ ลิงก์ และการแก้ไข)
  audioCredit(a) {
    const E = s => this.esc(s);
    return `${E(a.author)} · ${E(a.license)} · <a href="${E(a.page)}" target="_blank" rel="noopener">Wikimedia Commons</a> · ${E(a.change)}`;
  },

  renderInspector() {
    const el = document.getElementById('ensemble-instrument-inspector');
    if (!el) return;
    const E = s => this.esc(s);
    if (this.quiz) { this.renderQuiz(el); return; }

    const ens = this.ensemblesIn(this.activeCategory)[this.activeEnsembleKey];
    if (!ens) return;
    // กลุ่มตามประเภทเครื่องดนตรี (วก.5: ไทย = ดีด สี ตี เป่า · สากล = สาย ลมไม้ ทองเหลือง ลิ่มนิ้ว กระทบ)
    const groups = {};
    ens.seating.forEach((s, i) => { const c = this.getInstrumentCard(this.activeCategory, this.activeEnsembleKey, i); (groups[c.cls || 'อื่น ๆ'] = groups[c.cls || 'อื่น ๆ'] || []).push({ i: i, c: c }); });
    // ป้ายแหล่งเสียง: เครื่องที่มีไฟล์เสียงจริง = 🎧 พร้อมเครดิต · เครื่องอื่น = เสียงจำลอง (สังเคราะห์)
    const reals = [], seen = {};
    ens.seating.forEach((s, i) => { const c = this.getInstrumentCard(this.activeCategory, this.activeEnsembleKey, i); if (c.audio && !seen[c.id]) { seen[c.id] = 1; reals.push(c); } });
    const hasSim = ens.seating.some((s, i) => !this.getInstrumentCard(this.activeCategory, this.activeEnsembleKey, i).audio);
    const legend = (reals.length ? reals.map(c => `🎧 <strong>${E(c.name)}</strong> = เสียงจริง (${E(c.audio.label)}) · ${this.audioCredit(c.audio)}`).join('<br>') : '')
      + (reals.length && hasSim ? '<br>' : '') + (hasSim ? '🔈 เครื่องอื่น = <strong>เสียงจำลอง</strong> (สังเคราะห์จากคอมพิวเตอร์ ไม่ใช่เสียงเครื่องจริง)' : '');
    const groupHtml = `
      <div class="ens-groups">
        <strong>จัดเครื่องดนตรีในวงตามประเภท:</strong>
        ${Object.keys(groups).map(g => `<div class="ens-grp"><span class="ens-cls">${E(g)}</span> ${groups[g].map(x => `<button type="button" class="ens-chip" onclick="EnsembleExplorer.selectSeat(${x.i})">${x.c.audio ? '🎧 ' : ''}${E(x.c.name)}</button>`).join(' ')}</div>`).join('')}
      </div>
      <div class="ens-legend">${legend}</div>`;

    if (this.selectedSeat == null) {
      el.innerHTML = `
        <div class="ens-hint">
          👉 <strong>แตะที่เครื่องดนตรีในผังที่นั่ง</strong> เพื่อดูชื่อ ประเภท บทบาทในวง วิธีเล่น และฟังเสียงจำลอง (ศ 2.1 ม.1/4)
        </div>${groupHtml}`;
      return;
    }
    const c = this.getInstrumentCard(this.activeCategory, this.activeEnsembleKey, this.selectedSeat);
    const sound = c.audio
      ? `<button type="button" class="btn-nav-action primary ens-play" onclick="EnsembleExplorer.playSample('${E(c.id)}')">🎧 ฟังเสียงจริง</button><div class="ens-badge real">เสียงจริง</div>`
      : c.hasSample
        ? `<button type="button" class="btn-nav-action primary ens-play" onclick="EnsembleExplorer.playSample('${E(c.id)}')">🔊 ฟังเสียงจำลอง</button><div class="ens-badge sim">เสียงจำลอง</div>`
        : `<span class="ens-nosound">🔇 เบราว์เซอร์/อุปกรณ์นี้เล่นเสียงจำลองไม่ได้ (ยังอ่านข้อมูลเครื่องได้ตามปกติ)</span>`;
    el.innerHTML = `
      <div class="ens-card">
        <div class="ens-card-head">
          <div>
            <span class="ens-cls">ประเภท: ${E(c.cls || '-')}${c.detail ? ' (' + E(c.detail) + ')' : ''}</span>
            <h4 class="ens-card-name">${E(c.name)}</h4>
            ${c.en ? `<div class="ens-card-en">${E(c.en)}</div>` : ''}
          </div>
          <div class="ens-card-sound">${sound}</div>
        </div>
        <div class="ens-card-body">
          <div>🎯 <strong>บทบาทหน้าที่ในวง:</strong> ${E(c.role)}</div>
          ${c.how ? `<div>🖐 <strong>วิธีเล่น:</strong> ${E(c.how)}</div>` : ''}
          ${this.clean(c.tone) ? `<div>🎨 <strong>เอกลักษณ์ของเสียง (Timbre):</strong> ${E(this.clean(c.tone))}</div>` : ''}
          <div class="ens-card-note">ในวง: ${E(c.ensembleName)}${c.audio ? '' : (c.hasSample ? ' • เสียงที่กดฟังเป็นเสียงสังเคราะห์จำลอง ไม่ใช่เสียงเครื่องจริง' : '')}</div>
          ${c.audio ? `<div class="ens-card-note">🎧 เสียงจริง: ${E(c.audio.label)} · ${this.audioCredit(c.audio)}<br><span id="ens-audio-status"></span></div>` : ''}
        </div>
      </div>${groupHtml}`;
  },

  // ---- แบบทดสอบทบทวน (ไม่นับคะแนน · ไม่บันทึกผลที่ใด): สร้างจากข้อมูล (ภาคของวงพื้นบ้าน + ประเภทของเครื่องดนตรี) ----
  buildQuestions() {
    const d = this.getData();
    const qs = [];
    const seen = {};
    this.categoriesFor(this.period).forEach(ck => {
      const set = ck === 'western' ? d.classSets.western : d.classSets.thai;
      const ensMap = this.ensemblesIn(ck);
      Object.keys(ensMap).forEach(ek => {
        const e = ensMap[ek];
        if (ck === 'folk' && e.region) qs.push({ q: `วง "${e.name}" เป็นวงดนตรีพื้นบ้านของภาคใด?`, a: e.region, choices: d.regions.slice() });
        e.seating.forEach(s => {
          const ins = d.instruments[s.inst];
          if (!ins || set.indexOf(ins.cls) < 0 || seen[ck + ':' + s.inst]) return;
          seen[ck + ':' + s.inst] = 1;
          qs.push({ q: `"${ins.name}" จัดเป็นเครื่องดนตรีประเภทใด?`, a: ins.cls, choices: set.slice() });
        });
      });
    });
    return qs;
  },

  startQuiz() {
    if (!this.getData()) return;
    const qs = this.buildQuestions();
    if (!qs.length) return;
    this.quiz = { q: qs[Math.floor(Math.random() * qs.length)], answered: null, score: (this.quiz && this.quiz.score) || { ok: 0, all: 0 } };
    this.renderInspector();
  },

  answerQuiz(i) {
    if (!this.quiz || this.quiz.answered != null) return;
    this.quiz.answered = i;
    this.quiz.score.all++;
    if (this.quiz.q.choices[i] === this.quiz.q.a) this.quiz.score.ok++;
    this.renderInspector();
  },

  nextQuiz() { this.startQuiz(); },
  endQuiz() { this.quiz = null; this.renderInspector(); },

  renderQuiz(el) {
    const E = s => this.esc(s), z = this.quiz, q = z.q;
    const done = z.answered != null;
    el.innerHTML = `
      <div class="ens-quiz">
        <div class="ens-quiz-h">🎮 แบบทดสอบทบทวน (ไม่นับคะแนนเก็บ) • ตอบถูก ${z.score.ok}/${z.score.all}</div>
        <div class="ens-quiz-q">${E(q.q)}</div>
        <div class="ens-quiz-c">
          ${q.choices.map((c, i) => `<button type="button" class="btn-nav-action ens-choice ${done && c === q.a ? 'primary' : ''}" ${done ? 'disabled' : ''} onclick="EnsembleExplorer.answerQuiz(${i})">${E(c)}</button>`).join('')}
        </div>
        ${done ? `<div class="ens-quiz-r" style="color:${q.choices[z.answered] === q.a ? '#15803d' : '#b45309'};">${q.choices[z.answered] === q.a ? '✓ ถูกต้อง' : '✗ คำตอบที่ถูกคือ "' + E(q.a) + '"'}</div>
          <div style="margin-top:6px;"><button type="button" class="btn-nav-action primary ens-choice" onclick="EnsembleExplorer.nextQuiz()">ข้อต่อไป</button> <button type="button" class="btn-nav-action ens-choice" onclick="EnsembleExplorer.endQuiz()">กลับไปผังวง</button></div>` : ''}
        <div class="ens-quiz-n">ใช้ทบทวนเท่านั้น — ไม่บันทึก ไม่ส่งครู และไม่นับเป็นคะแนน</div>
      </div>`;
  }
};

if (typeof window !== 'undefined') {
  window.EnsembleExplorer = EnsembleExplorer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnsembleExplorer;
}
