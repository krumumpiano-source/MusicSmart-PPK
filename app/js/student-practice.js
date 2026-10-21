// ==========================================================================
// Phase 4 (นักเรียน): ปฏิทินงาน + แจ้งเตือน, ความก้าวหน้าของฉัน (จากเซิร์ฟเวอร์),
// เมโทรนอม (Web Audio), ส่งคลิปฝึกซ้อมเป็นลิงก์, แบบฝึกไม่นับคะแนน
// ==========================================================================

const TaskCalendar = {
  DAY_MS: 86400000,
  // คืน task รายการเดียวต่อคาบ: กำหนดส่ง + สถานะส่ง
  tasks(now = Date.now()) {
    if (typeof StudentOutbox === 'undefined') return [];
    const t = StudentOutbox.getTasks();
    return (t.dueDates || []).map(d => {
      const st = StudentOutbox.statusFor(StudentOutbox.assignmentKey(d.className, d.period));
      const due = new Date(d.dueAt).getTime();
      const done = !!(st && (st.state === 'sent' || st.state === 'pending'));
      return { className: d.className, period: d.period, title: d.title || `งานคาบที่ ${d.period}`, dueAt: d.dueAt, dueMs: due,
        done, overdue: !done && due < now, soon: !done && due >= now && due - now <= this.DAY_MS };
    }).sort((a, b) => a.dueMs - b.dueMs);
  },
  // ตารางเดือน (เวลาไทย) : weeks[][] ของ { day, ymd, tasks }
  month(year, month0, tasks) {
    const ymd = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
    const first = new Date(Date.UTC(year, month0, 1));
    const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < first.getUTCDay(); i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      const key = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, ymd: key, tasks: tasks.filter(t => ymd(t.dueMs) === key) });
    }
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  },
  MONTHS: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  view: null,
  async open() {
    if (typeof StudentOutbox !== 'undefined' && StudentOutbox.refreshTasks) await StudentOutbox.refreshTasks().catch(() => {});
    const n = new Date(Date.now() + 7 * 3600000);
    this.view = this.view || { y: n.getUTCFullYear(), m: n.getUTCMonth() };
    this.render();
  },
  shift(delta) { let m = this.view.m + delta, y = this.view.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } this.view = { y, m }; this.render(); },
  render() {
    const tasks = this.tasks();
    const weeks = this.month(this.view.y, this.view.m, tasks);
    const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const cell = c => !c ? '<td></td>' : `<td style="vertical-align:top;height:58px;border:1px solid #e2e8f0;padding:2px;font-size:0.72rem;"><div style="color:#64748b;">${c.day}</div>${c.tasks.map(t =>
      `<div style="border-radius:4px;padding:1px 3px;margin-top:1px;background:${t.done ? '#dcfce7' : t.overdue ? '#fee2e2' : '#fef9c3'};">${t.done ? '✅' : t.overdue ? '⛔' : '⏰'} คาบ ${t.period}</div>`).join('')}</td>`;
    const list = tasks.filter(t => !t.done).map(t => `<li>${t.overdue ? '⛔ เลยกำหนด' : t.soon ? '⏰ ภายใน 24 ชม.' : '📌'} ${e(t.title)} • ส่ง ${e(TeacherPull.thaiTime(t.dueAt))}</li>`).join('') || '<li>ไม่มีงานค้าง 🎉</li>';
    const html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <button class="btn-nav-action" onclick="TaskCalendar.shift(-1)">◀</button><b>${this.MONTHS[this.view.m]} ${this.view.y + 543}</b><button class="btn-nav-action" onclick="TaskCalendar.shift(1)">▶</button></div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => `<th style="font-size:0.75rem;">${d}</th>`).join('')}</tr>
      ${weeks.map(w => `<tr>${w.map(cell).join('')}</tr>`).join('')}</table>
      <h4 style="margin:0.75rem 0 0.25rem;">งานที่ยังไม่ส่ง</h4><ul style="margin:0;padding-left:1.1rem;font-size:0.85rem;">${list}</ul>
      <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
        <button class="btn-nav-action" onclick="DueNotifier.enable()">🔔 เปิดการแจ้งเตือนบนมือถือ</button>
        <span style="font-size:0.75rem;color:#64748b;">${e(DueNotifier.statusText())}</span></div>`;
    StudentPanels.show('📅 ปฏิทินงานของฉัน', html);
  }
};

const DueNotifier = {
  KEY: 'ppk_due_notified',
  supported() { return typeof Notification !== 'undefined'; },
  statusText() {
    if (!this.supported()) return 'เครื่องนี้ไม่รองรับการแจ้งเตือน — จะแสดงแถบเตือนในแอปแทน';
    if (Notification.permission === 'granted') return 'เปิดการแจ้งเตือนแล้ว (เตือนเมื่อเปิดแอป/ซิงค์ ก่อนครบกำหนด 24 ชม.)';
    if (Notification.permission === 'denied') return 'การแจ้งเตือนถูกปิดในเบราว์เซอร์ — ใช้แถบเตือนในแอปแทน';
    return 'ยังไม่ได้เปิดการแจ้งเตือน';
  },
  async enable() {
    if (!this.supported()) { alert('เครื่องนี้ไม่รองรับการแจ้งเตือน ระบบจะแสดงแถบเตือนในแอปแทน'); return 'unsupported'; }
    const p = await Notification.requestPermission();
    if (p === 'granted') this.check({ force: true });
    if (typeof TaskCalendar !== 'undefined' && TaskCalendar.view) TaskCalendar.render();
    return p;
  },
  _seen() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch (e) { return {}; } },
  // คืนรายการที่ต้องเตือน (ใกล้ครบ 24 ชม. หรือเลยกำหนด) ที่ยังไม่เคยเตือนในสถานะนั้น
  due(now = Date.now()) {
    const seen = this._seen();
    return TaskCalendar.tasks(now).filter(t => (t.soon || t.overdue) && seen[`${t.className}_p${t.period}`] !== (t.overdue ? 'overdue' : 'soon'));
  },
  async check(opts = {}) {
    const list = this.due(opts.now);
    if (!list.length) { this.banner(TaskCalendar.tasks(opts.now).filter(t => t.soon || t.overdue)); return { shown: 0, via: 'none' }; }
    const seen = this._seen();
    let via = 'inapp';
    const canNotify = this.supported() && Notification.permission === 'granted';
    for (const t of list) {
      const body = `${t.title} • ${t.overdue ? 'เลยกำหนดส่งแล้ว รีบส่งนะ' : 'ครบกำหนดภายใน 24 ชม.'}`;
      if (canNotify) {
        via = 'notification';
        try {
          const reg = (typeof navigator !== 'undefined' && navigator.serviceWorker) ? await navigator.serviceWorker.getRegistration() : null;
          if (reg && reg.showNotification) await reg.showNotification('MusicSmart: งานใกล้ครบกำหนด', { body, tag: `due_${t.className}_${t.period}`, icon: 'icons/icon-192.png' });
          else new Notification('MusicSmart: งานใกล้ครบกำหนด', { body });
        } catch (e) { via = 'inapp'; }
      }
      seen[`${t.className}_p${t.period}`] = t.overdue ? 'overdue' : 'soon';
    }
    localStorage.setItem(this.KEY, JSON.stringify(seen));
    this.banner(TaskCalendar.tasks(opts.now).filter(t => t.soon || t.overdue));
    return { shown: list.length, via };
  },
  banner(list) {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const box = document.getElementById('student-due-banner');
    if (!box) return;
    if (!list.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = `⏰ มีงาน ${list.length} รายการที่ใกล้/เลยกำหนดส่ง — <a href="#" onclick="TaskCalendar.open();return false;">ดูปฏิทินงาน</a>`;
  }
};

const StudentProgress = {
  KEY: 'ppk_student_progress',
  cached() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  async fetch() {
    const u = StudentOutbox.currentStudent();
    if (!u || !StudentOutbox.sessionValid(u)) return { success: false, code: 'needs_login', message: 'กรุณาเข้าสู่ระบบด้วย PIN อีกครั้ง' };
    const r = await StudentAuth._post({ action: 'studentProgress', sessionToken: u.sessionToken });
    if (r.status !== 'success') return { success: false, code: r.code, message: r.message };
    const data = Object.assign({}, r, { fetchedAt: new Date().toISOString() });
    delete data.status;
    localStorage.setItem(this.KEY, JSON.stringify(data));
    return Object.assign({ success: true }, data);
  },
  async open() {
    let d = await this.fetch().catch(e => ({ success: false, message: e.message }));
    let note = '';
    if (!d.success) { note = `⚠️ ${d.message || 'ออฟไลน์'} — แสดงข้อมูลล่าสุดที่บันทึกไว้`; d = this.cached(); }
    if (!d) { StudentPanels.show('📈 ความก้าวหน้าของฉัน', `<p>${note || 'ยังไม่มีข้อมูล'}</p>`); return; }
    const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const bar = p => `<div style="background:#e2e8f0;border-radius:4px;height:8px;"><div style="width:${Math.max(0, Math.min(100, p))}%;background:${p >= 50 ? '#16a34a' : '#dc2626'};height:8px;border-radius:4px;"></div></div>`;
    const html = `${note ? `<p style="color:#b45309;font-size:0.8rem;">${e(note)}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;font-size:0.85rem;">
        <div>📤 ส่งงานแล้ว <b>${d.submittedPeriods.length}</b> คาบ</div><div>⛔ งานค้าง <b>${d.missing.length}</b></div>
        <div>⌛ ส่งช้า <b>${d.late}</b></div><div>🎧 คลิปฝึกซ้อม <b>${d.recordings}</b></div>
        <div style="grid-column:span 2;">📝 คะแนนแบบทดสอบเฉลี่ย (นับคะแนน) <b>${d.quizAverage === null ? '-' : d.quizAverage + '%'}</b></div></div>
      ${d.missing.length ? `<p style="font-size:0.82rem;color:#b91c1c;">งานที่ยังไม่ส่ง: คาบ ${d.missing.join(', ')}</p>` : ''}
      <h4 style="margin:0.6rem 0 0.25rem;">แบบทดสอบ (นับคะแนน)</h4>${d.quizzes.map(q => `<div style="font-size:0.8rem;">หน่วย ${q.unitNo}: ดีที่สุด ${q.best}% (ทำ ${q.attempts} ครั้ง)${bar(q.best)}</div>`).join('') || '<div style="font-size:0.8rem;">ยังไม่มี</div>'}
      <h4 style="margin:0.6rem 0 0.25rem;">แบบฝึก (ไม่นับคะแนน)</h4>${d.practice.map(q => `<div style="font-size:0.8rem;">หน่วย ${q.unitNo}: ล่าสุด ${q.last}% • ดีที่สุด ${q.best}% (${q.attempts} ครั้ง)</div>`).join('') || '<div style="font-size:0.8rem;">ยังไม่มี</div>'}
      <h4 style="margin:0.6rem 0 0.25rem;">คำแนะนำจากครู</h4>${d.feedback.slice().reverse().map(f => `<div style="font-size:0.8rem;border-left:3px solid #6366f1;padding-left:6px;margin-bottom:4px;">${e(f.message)}${f.score !== null && f.score !== undefined ? ` (คะแนน ${e(f.score)})` : ''}</div>`).join('') || '<div style="font-size:0.8rem;">ยังไม่มี</div>'}
      <p style="font-size:0.7rem;color:#94a3b8;">อัปเดต ${e(TeacherPull.thaiTime(d.fetchedAt))}</p>`;
    StudentPanels.show('📈 ความก้าวหน้าของฉัน', html);
  }
};

const Metronome = {
  bpm: 90, beats: 4, beat: 0, timer: null, ctx: null,
  intervalMs(bpm) { const b = Math.max(30, Math.min(240, Number(bpm) || 90)); return Math.round(60000 / b); },
  isRunning() { return !!this.timer; },
  click(accent) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = this.ctx || new AC();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
      o.frequency.value = accent ? 1500 : 1000;
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.06);
    } catch (e) { /* ไม่มีเสียงก็ไม่เป็นไร */ }
  },
  tick() {
    this.click(this.beat % this.beats === 0);
    const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('metro-beat') : null;
    if (el) el.textContent = String((this.beat % this.beats) + 1);
    this.beat++;
  },
  start(bpm) { this.stop(); if (bpm) this.bpm = Number(bpm); this.beat = 0; this.tick(); this.timer = setInterval(() => this.tick(), this.intervalMs(this.bpm)); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  setBpm(v) { this.bpm = Math.max(30, Math.min(240, Number(v) || 90)); const l = document.getElementById('metro-bpm-label'); if (l) l.textContent = this.bpm; if (this.isRunning()) this.start(); },
  open() {
    StudentPanels.show('🥁 เมโทรนอม', `<div style="text-align:center;">
      <div id="metro-beat" style="font-size:3rem;font-weight:800;color:#4f46e5;">1</div>
      <div><b id="metro-bpm-label">${this.bpm}</b> BPM</div>
      <input type="range" min="30" max="240" value="${this.bpm}" oninput="Metronome.setBpm(this.value)" style="width:100%;">
      <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.5rem;">
        <select class="form-select" onchange="Metronome.beats=Number(this.value)" style="max-width:110px;">${[2, 3, 4, 6].map(n => `<option value="${n}" ${n === this.beats ? 'selected' : ''}>${n}/4</option>`).join('')}</select>
        <button class="btn-nav-action primary" onclick="Metronome.isRunning()?Metronome.stop():Metronome.start()">▶️/⏸ เริ่ม/หยุด</button>
        <button class="btn-nav-action" onclick="Tuner.openModal()">🎙️ จูนเนอร์โครมาติก</button></div></div>`, () => Metronome.stop());
  }
};

const Recording = {
  validUrl(u) { return /^https:\/\/\S+$/i.test(String(u || '').trim()) && String(u).length <= 500; },
  submit(period, url, note) {
    if (!this.validUrl(url)) return { success: false, message: 'กรุณาวางลิงก์ https:// (Google Drive / YouTube) ของคลิปฝึกซ้อม' };
    const u = StudentOutbox.currentStudent();
    if (!u) return { success: false, message: 'กรุณาเข้าสู่ระบบนักเรียน' };
    const item = StudentOutbox.enqueue('recording', `r:${u.studentClass || ''}_p${period}_${Date.now().toString(36)}`,
      { period: Number(period), url: String(url).trim(), content: String(note || '').slice(0, 1000), submissionType: 'คลิปฝึกซ้อม (ลิงก์)', title: 'คลิปฝึกซ้อม' });
    return { success: !!item, item };
  },
  async submitFile(period, note) {
    const f = typeof StudentUpload !== 'undefined' ? StudentUpload.picked : null;
    if (!f) return { success: false, message: 'ยังไม่ได้เลือกไฟล์/อัดคลิป' };
    const r = await StudentUpload.add(f, { purpose: 'recording', period, content: note });
    if (r.success) StudentUpload.picked = null;
    return r;
  },
  open(period) {
    const up = typeof StudentUpload !== 'undefined';
    StudentPanels.show('🎧 ส่งคลิปฝึกซ้อม', `${up ? `<div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:8px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">📤 อัปโหลดไฟล์ตรงเข้า Drive ครู (ไม่เกิน 50 MB)</div>
        <label class="btn-nav-action" style="cursor:pointer;">🎙️ อัดเสียง<input type="file" accept="audio/*" capture style="display:none;" onchange="StudentUpload.pick(this,'rec-file-preview')"></label>
        <label class="btn-nav-action" style="cursor:pointer;">🎥 อัดวิดีโอ<input type="file" accept="video/*" capture="environment" style="display:none;" onchange="StudentUpload.pick(this,'rec-file-preview')"></label>
        <label class="btn-nav-action" style="cursor:pointer;">📁 เลือกไฟล์<input type="file" accept="${StudentUpload.ACCEPT}" style="display:none;" onchange="StudentUpload.pick(this,'rec-file-preview')"></label>
        <div id="rec-file-preview" style="display:none;font-size:0.8rem;color:#059669;margin-top:4px;"></div></div>` : ''}
      <p style="font-size:0.82rem;color:#475569;">หรือ อัปโหลดขึ้น Google Drive / YouTube เอง แล้ววางลิงก์ (https://)</p>
      <input id="rec-period" type="number" min="1" max="40" class="form-input" value="${Number(period) || 1}" style="max-width:100px;"> คาบที่
      <input id="rec-url" class="form-input" placeholder="https://drive.google.com/..." style="width:100%;margin-top:0.4rem;">
      <textarea id="rec-note" class="form-input" placeholder="บันทึกการฝึก (เช่น ฝึกเพลงอะไร กี่นาที)" style="width:100%;margin-top:0.4rem;"></textarea>
      <button class="btn-nav-action primary" style="margin-top:0.5rem;" onclick="(async function(){const per=document.getElementById('rec-period').value,note=document.getElementById('rec-note').value;if(typeof StudentUpload!=='undefined'&&StudentUpload.picked){const u=await Recording.submitFile(per,note);alert(u.success?'📤 เริ่มอัปโหลดคลิปแล้ว ดูความคืบหน้าได้ในหน้าบทเรียน'+(u.warn?'\n⏳ '+u.warn:''):'⚠️ '+u.message);if(u.success)StudentPanels.close();return;}const r=Recording.submit(document.getElementById('rec-period').value,document.getElementById('rec-url').value,document.getElementById('rec-note').value);alert(r.success?'📤 ส่งคลิปแล้ว (ถ้าออฟไลน์จะส่งอัตโนมัติเมื่อมีเน็ต)':'⚠️ '+r.message);if(r.success)StudentPanels.close();})()">ส่งคลิป</button>`);
  }
};

const PracticeQuiz = {
  open(unitNo) {
    if (typeof ServerQuiz !== 'undefined' && ServerQuiz.shouldUse()) return ServerQuiz.open(unitNo, { practice: true });
    alert('กรุณาเข้าสู่ระบบนักเรียนเพื่อทำแบบฝึก');
  }
};

const StudentPanels = {
  _onClose: null,
  show(title, html, onClose) {
    if (typeof document === 'undefined' || !document.createElement) return;
    let m = document.getElementById('modal-student-panel');
    if (!m) {
      m = document.createElement('div'); m.id = 'modal-student-panel'; m.className = 'modal-overlay';
      m.innerHTML = '<div class="modal-content" style="max-width:560px;"><div class="modal-header"><h3 id="student-panel-title"></h3><button class="modal-close" onclick="StudentPanels.close()">✕</button></div><div id="student-panel-body" class="modal-body" style="max-height:70vh;overflow:auto;"></div></div>';
      document.body.appendChild(m);
    }
    if (this._onClose && this._onClose !== onClose) { try { this._onClose(); } catch (e) { /* */ } }
    this._onClose = onClose || null;
    document.getElementById('student-panel-title').textContent = title;
    document.getElementById('student-panel-body').innerHTML = html;
    m.classList.add('active');
  },
  close() {
    const m = document.getElementById('modal-student-panel');
    if (m) m.classList.remove('active');
    if (this._onClose) { try { this._onClose(); } catch (e) { /* */ } this._onClose = null; }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { TaskCalendar, DueNotifier, StudentProgress, Metronome, Recording, PracticeQuiz, StudentPanels };
