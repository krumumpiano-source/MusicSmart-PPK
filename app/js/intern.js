// ==========================================================================
// MusicSmart • นักศึกษาฝึกประสบการณ์วิชาชีพครู (Phase 3)
// InternMode : เข้าสู่ระบบ (รหัส นศ. + PIN) เห็นเนื้อหาครูเฉพาะห้องที่ได้รับมอบหมาย
//              แก้คะแนน = ส่งเข้าคิวรออนุมัติจากครูพี่เลี้ยง • บันทึกหลังสอนส่งถึงครูพี่เลี้ยง
// MentorPanel: ครูพี่เลี้ยงจัดการบัญชี นศ. • อนุมัติคะแนน • ดูบันทึกหลังสอน • แบบประเมินการนิเทศ
// Portfolio  : แฟ้มสะสมผลงาน (พิมพ์/บันทึกเป็น PDF จากเบราว์เซอร์)
// ==========================================================================
const InternMode = {
  OUTBOX: 'ppk_intern_outbox',
  DATA: 'ppk_intern_data',
  flushing: false,

  user() { const u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null; return u && u.role === 'intern' ? u : null; },
  isActive() { return !!this.user(); },
  classes() { const u = this.user(); return u ? (u.classes || []) : []; },
  _load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  _save(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  data() { return this._load(this.DATA, { since: 0, approvals: [], logs: [], evaluations: [] }); },

  async _auth(action, internId, pin) {
    const r = await StudentAuth._post({ action, internId: String(internId || '').trim(), pin: String(pin || '').trim() });
    if (r.status !== 'success') return { success: false, code: r.code, message: r.message };
    const user = { role: 'intern', internId: r.profile.internId, name: r.profile.name, classes: r.profile.classes || [],
      sessionToken: r.sessionToken, sessionExp: r.sessionExp, loggedInAt: new Date().toISOString() };
    Store.setCurrentUser(user);
    if (typeof Store.clearRoster === 'function') Store.clearRoster();
    return { success: true, user };
  },
  login(id, pin) { return this._auth('internLogin', id, pin); },
  setPin(id, pin) { return this._auth('internSetPin', id, pin); },

  hashId(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h.toString(36); },

  // ดึงข้อมูลห้องที่ได้รับมอบหมาย: รายชื่อ งานนักเรียน กำหนดส่ง สถานะอนุมัติ บันทึก/ผลนิเทศ
  async sync() {
    const u = this.user();
    if (!u) return { success: false };
    const d = this.data();
    const r = await StudentAuth._post({ action: 'internFetch', sessionToken: u.sessionToken, since: d.since || 0 });
    if (r.status !== 'success') return { success: false, code: r.code, message: r.message };
    const roster = {};
    (r.roster || []).forEach(s => { (roster[s.class] = roster[s.class] || []).push(s); });
    if (Object.keys(roster).length) Store.importRoster(roster);
    if (typeof TeacherPull !== 'undefined') TeacherPull.merge(r.submissions || []);
    if (typeof DueDates !== 'undefined') {
      const all = {}; (r.dueDates || []).forEach(x => { all[`${x.className}_p${x.period}`] = x; });
      localStorage.setItem(DueDates.KEY, JSON.stringify(all));
    }
    this._save(this.DATA, { since: r.nextSince || d.since || 0, approvals: r.approvals || [], logs: r.logs || [], evaluations: r.evaluations || [], syncedAt: new Date().toISOString() });
    await this.flush();
    return { success: true, students: (r.roster || []).length, submissions: (r.submissions || []).length };
  },

  queue(kind, payload) {
    const box = this._load(this.OUTBOX, []);
    box.push(Object.assign({ kind, queuedAt: new Date().toISOString() }, payload));
    this._save(this.OUTBOX, box);
    return this.flush();
  },

  proposeGrades(className, period, scores, comment) {
    const items = Object.keys(scores || {}).filter(sid => scores[sid] !== null && scores[sid] !== undefined && scores[sid] !== '')
      .map(sid => ({ clientId: `g_${this.hashId(`${className}|${period}|${sid}|${scores[sid]}|${comment || ''}`)}_${String(sid).replace(/\D/g, '')}`,
        className, period: Number(period), studentId: String(sid), score: Number(scores[sid]), comment: comment || '' }));
    if (!items.length) return Promise.resolve({ queued: 0 });
    return this.queue('grades', { items });
  },

  postLog(className, period, refl) {
    return this.queue('log', { clientId: `l_${this.hashId(`${className}|${period}|${JSON.stringify(refl)}`)}`, className, period: Number(period),
      result: refl.result || '', problems: refl.problems || '', solutions: refl.solutions || '' });
  },

  // เรียกจาก GoogleSheetSync.syncSessionLog เมื่อ นศ. บันทึกคาบ
  onSessionSaved(className, period, sess) {
    const refl = (sess && sess.reflection) || {};
    const result = refl.outcomes || refl.learningOutcome || sess.teachingSummary || '';
    const problems = refl.problems || sess.problemIssues || '';
    const solutions = refl.solutions || refl.suggestions || sess.solutions || '';
    if (result || problems || solutions) this.postLog(className, period, { result, problems, solutions });
    if (sess && sess.scores) this.proposeGrades(className, period, sess.scores, 'คะแนนประจำคาบ (นศ. เสนอ)');
    return { intern: true };
  },

  pendingCount() { return this._load(this.OUTBOX, []).length; },

  async flush() {
    const u = this.user();
    if (!u || this.flushing) return { skipped: true };
    this.flushing = true;
    try {
      const box = this._load(this.OUTBOX, []);
      const keep = [];
      for (const it of box) {
        try {
          const r = it.kind === 'grades'
            ? await StudentAuth._post({ action: 'internProposeGrade', sessionToken: u.sessionToken, items: it.items })
            : await StudentAuth._post({ action: 'internPostLog', sessionToken: u.sessionToken, className: it.className, period: it.period, result: it.result, problems: it.problems, solutions: it.solutions, clientId: it.clientId });
          if (r.status !== 'success' && (r.code === 'session_expired' || r.code === 'bad_session')) keep.push(it);
        } catch (e) { keep.push(it); }
      }
      this._save(this.OUTBOX, keep);
      return { success: true, remaining: keep.length };
    } finally { this.flushing = false; }
  },

  approvalStatus(className, period, studentId) {
    const list = this.data().approvals.filter(a => a.className === className && Number(a.period) === Number(period) && a.studentId === String(studentId));
    return list.length ? list[list.length - 1].status : '';
  }
};

const MentorPanel = {
  EVAL_ITEMS: ['การเตรียมการสอนและแผนการจัดการเรียนรู้', 'การจัดกิจกรรมการเรียนรู้', 'การใช้สื่อและเทคโนโลยี', 'การวัดและประเมินผล', 'บุคลิกภาพและการบริหารชั้นเรียน'],
  _post(body) {
    if (typeof TeacherPull === 'undefined' || !TeacherPull.isConfigured()) return Promise.reject(new Error('กรุณาตั้งค่า URL และรหัสซิงค์ก่อน'));
    const cfg = GoogleSheetSync.getConfig();
    return GoogleSheetSync.postJSON(cfg.webAppUrl, body);
  },
  saveIntern(internId, name, classes) { return this._post({ action: 'upsert_intern', internId, name, classes }); },
  listInterns() { return this._post({ action: 'list_interns' }); },
  resetPin(internId) { return this._post({ action: 'reset_intern_pin', internId }); },
  pending() { return this._post({ action: 'fetch_approvals', status: 'pending' }); },
  logs(internId) { return this._post({ action: 'fetch_intern_logs', internId: internId || '' }); },
  evaluate(internId, className, period, ratings, comments) {
    const mentor = (Store.getCurrentUser() || {}).name || 'ครูพี่เลี้ยง';
    return this._post({ action: 'post_supervision', internId, className, period, ratings, comments, mentor });
  },

  // อนุมัติ -> นำคะแนนเข้าบันทึกคาบในเครื่องครู
  async decide(id, approve) {
    const r = await this._post({ action: 'decide_approval', id, approve: !!approve });
    if (approve && r.approval) this.applyScore(r.approval);
    return r;
  },
  applyScore(a) {
    const sessions = Store.load('ppk_session_logs', {}) || {};
    const key = Store.getSessionKey(a.className, a.period);
    const sess = sessions[key] || { className: a.className, period: a.period, attendance: {}, scores: {} };
    sess.scores = Object.assign({}, sess.scores || {}, { [a.studentId]: Number(a.score) });
    sess.approvedFromIntern = true;
    sessions[key] = sess;
    Store.save('ppk_session_logs', sessions);
  },

  esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

  async open() {
    let m = document.getElementById('modal-mentor-panel');
    if (!m) { m = document.createElement('div'); m.id = 'modal-mentor-panel'; m.className = 'modal-overlay'; m.setAttribute('data-teacher-only', ''); document.body.appendChild(m); }
    m.classList.add('active');
    m.innerHTML = '<div class="modal-card" style="max-width:980px;width:96vw;max-height:92vh;overflow:auto;"><div class="modal-body">⏳ กำลังโหลด...</div></div>';
    let interns = [], pending = [], logs = [];
    try { interns = (await this.listInterns()).interns || []; pending = (await this.pending()).approvals || []; logs = (await this.logs()).logs || []; }
    catch (e) { m.innerHTML = `<div class="modal-card"><div class="modal-body">⚠️ ${this.esc(e.message)} <button class="btn-nav-action" onclick="document.getElementById('modal-mentor-panel').classList.remove('active')">ปิด</button></div></div>`; return; }
    const classes = [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')];
    const e = this.esc.bind(this);
    m.innerHTML = `<div class="modal-card" style="max-width:980px;width:96vw;max-height:92vh;overflow:auto;">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;"><h3 class="modal-title" style="margin:0;">👩‍🎓 นักศึกษาฝึกประสบการณ์วิชาชีพครู</h3>
        <button class="btn-nav-action" onclick="document.getElementById('modal-mentor-panel').classList.remove('active')">✕</button></div>
      <div class="modal-body" style="display:grid;gap:1rem;">
        <section><h4>บัญชี นศ. และห้องที่มอบหมาย</h4>
          <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">${interns.map(i => `<tr style="border-bottom:1px solid #e2e8f0;"><td>${e(i.internId)}</td><td>${e(i.name)}</td><td>${e(i.classes.join(', '))}</td><td>${i.hasPin ? '🔒 มี PIN' : '⚪ ยังไม่ตั้ง'}</td>
            <td><button class="btn-nav-action" data-reset="${e(i.internId)}">รีเซ็ต PIN</button> <button class="btn-nav-action" data-portfolio="${e(i.internId)}">📁 พอร์ตโฟลิโอ</button></td></tr>`).join('') || '<tr><td>ยังไม่มีบัญชี</td></tr>'}</table>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.5rem;align-items:center;">
            <input id="mp-id" class="form-input" placeholder="รหัส นศ. (อังกฤษ/ตัวเลข)" style="max-width:180px;">
            <input id="mp-name" class="form-input" placeholder="ชื่อ (เช่น นศ.ตัวอย่าง)" style="max-width:200px;">
            ${classes.map(c => `<label style="font-size:0.8rem;"><input type="checkbox" class="mp-cls" value="${e(c)}"> ${e(c)}</label>`).join('')}
            <button class="btn-nav-action primary" id="mp-save">บันทึกบัญชี</button></div></section>
        <section><h4>✅ คะแนนรออนุมัติ (${pending.length})</h4>
          ${pending.map(a => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:0.3rem 0;font-size:0.84rem;"><span>${e(a.internName)} • ${e(a.className)} คาบ ${a.period} • รหัส ${e(a.studentId)} → <strong>${a.score}</strong> ${a.comment ? '• ' + e(a.comment) : ''}</span>
            <span><button class="btn-nav-action primary" data-approve="${e(a.id)}">อนุมัติ</button> <button class="btn-nav-action" data-reject="${e(a.id)}">ไม่อนุมัติ</button></span></div>`).join('') || '<div style="color:#64748b;">ไม่มีรายการรออนุมัติ</div>'}</section>
        <section><h4>📝 บันทึกหลังสอนของ นศ. (${logs.length})</h4>
          ${logs.slice(-20).reverse().map(l => `<div style="border-left:3px solid #0284c7;padding:0.3rem 0.6rem;margin-bottom:0.4rem;font-size:0.84rem;"><strong>${e(l.internName)} • ${e(l.className)} คาบ ${l.period}</strong><br>ผล: ${e(l.result)}<br>ปัญหา: ${e(l.problems)}<br>แนวทางแก้: ${e(l.solutions)}</div>`).join('') || '<div style="color:#64748b;">ยังไม่มีบันทึก</div>'}</section>
        <section><h4>🧑‍🏫 แบบประเมินการนิเทศ</h4>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.4rem;">
            <select id="mp-eval-intern" class="form-select">${interns.map(i => `<option value="${e(i.internId)}">${e(i.name)} (${e(i.internId)})</option>`).join('')}</select>
            <select id="mp-eval-class" class="form-select">${classes.map(c => `<option>${e(c)}</option>`).join('')}</select>
            <input id="mp-eval-period" type="number" min="1" max="40" value="1" class="form-input" style="max-width:90px;"></div>
          ${this.EVAL_ITEMS.map((it, i) => `<div style="font-size:0.84rem;display:flex;justify-content:space-between;gap:0.5rem;"><span>${i + 1}. ${e(it)}</span><select class="form-select mp-rate" data-item="${e(it)}" style="max-width:90px;">${[5, 4, 3, 2, 1].map(n => `<option>${n}</option>`).join('')}</select></div>`).join('')}
          <textarea id="mp-eval-comments" class="form-input" rows="3" placeholder="ข้อเสนอแนะของครูพี่เลี้ยง" style="width:100%;margin-top:0.4rem;"></textarea>
          <button class="btn-nav-action primary" id="mp-eval-save">บันทึกผลการนิเทศ</button></section>
      </div></div>`;
    const reload = () => this.open();
    m.querySelector('#mp-save').onclick = async () => {
      const cls = [...m.querySelectorAll('.mp-cls:checked')].map(x => x.value);
      try { await this.saveIntern(m.querySelector('#mp-id').value.trim(), m.querySelector('#mp-name').value.trim(), cls); reload(); } catch (err) { alert('❌ ' + err.message); }
    };
    m.querySelectorAll('[data-reset]').forEach(b => { b.onclick = async () => { if (confirm('รีเซ็ต PIN ของ นศ. คนนี้?')) { await this.resetPin(b.dataset.reset); reload(); } }; });
    m.querySelectorAll('[data-approve]').forEach(b => { b.onclick = async () => { await this.decide(b.dataset.approve, true); reload(); }; });
    m.querySelectorAll('[data-reject]').forEach(b => { b.onclick = async () => { await this.decide(b.dataset.reject, false); reload(); }; });
    m.querySelectorAll('[data-portfolio]').forEach(b => { b.onclick = () => {
      const i = interns.find(x => x.internId === b.dataset.portfolio);
      Portfolio.open({ name: i.name, internId: i.internId, classes: i.classes, logs: logs.filter(l => l.internId === i.internId), evaluations: [] });
    }; });
    m.querySelector('#mp-eval-save').onclick = async () => {
      const ratings = {}; m.querySelectorAll('.mp-rate').forEach(s => { ratings[s.dataset.item] = Number(s.value); });
      try {
        const r = await this.evaluate(m.querySelector('#mp-eval-intern').value, m.querySelector('#mp-eval-class').value, Number(m.querySelector('#mp-eval-period').value), ratings, m.querySelector('#mp-eval-comments').value);
        alert(`✅ บันทึกผลการนิเทศแล้ว รวม ${r.total}/${this.EVAL_ITEMS.length * 5} คะแนน`);
      } catch (err) { alert('❌ ' + err.message); }
    };
  }
};

const Portfolio = {
  esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  build(info) {
    const e = this.esc.bind(this);
    const classes = info.classes || [];
    const grades = [...new Set(classes.map(c => (c.startsWith('ม.2') ? 'M2' : 'M1')))];
    const lessons = grades.flatMap(g => ((typeof LESSONS_DATA !== 'undefined' && LESSONS_DATA[g]) || []).map(l => Object.assign({ g }, l)));
    const subs = (typeof Store !== 'undefined') ? Object.values(Store.getAllSubmissions()).filter(s => classes.includes(s.className)) : [];
    const summaries = (typeof Analytics !== 'undefined') ? classes.map(c => Analytics.classSummary(c)) : [];
    const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>แฟ้มสะสมผลงาน ${e(info.name)}</title>
<style>body{font-family:'Sarabun','TH Sarabun New',sans-serif;max-width:900px;margin:auto;padding:24px;color:#111;line-height:1.5}h1,h2{color:#1e3a8a}h2{border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-top:28px;page-break-after:avoid}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #999;padding:4px 6px;vertical-align:top}.lesson{page-break-inside:avoid;margin-bottom:12px}@media print{.noprint{display:none}}</style></head><body>
<button class="noprint" onclick="window.print()">🖨️ พิมพ์ / บันทึกเป็น PDF</button>
<h1>แฟ้มสะสมผลงานการฝึกประสบการณ์วิชาชีพครู</h1>
<p><strong>${e(info.name)}</strong> (รหัส ${e(info.internId)}) • ห้องที่ได้รับมอบหมาย: ${e(classes.join(', '))}<br>รายวิชาดนตรี โรงเรียนพะเยาพิทยาคม • สร้างเมื่อ ${e(now)}</p>
<h2>1. แผนการจัดการเรียนรู้</h2>${lessons.map(l => `<div class="lesson"><strong>${e(l.g === 'M1' ? 'ม.1' : 'ม.2')} คาบ ${l.period}: ${e(l.topic)}</strong>
<div>K: ${e(l.kpa && l.kpa.k)} • P: ${e(l.kpa && l.kpa.p)} • A: ${e(l.kpa && l.kpa.a)}</div>
<ol>${(l.steps || []).map(s => `<li>${e(s.phase)} (${e(s.duration)} นาที): ${e(s.desc || s.action)}</li>`).join('')}</ol></div>`).join('') || '<p>-</p>'}
<h2>2. สื่อการเรียนรู้</h2><ul>${lessons.flatMap(l => (l.media || []).map(m => `<li>คาบ ${l.period}: ${e(m.title)}</li>`)).join('') || '<li>-</li>'}</ul>
<h2>3. ผลงานนักเรียน (ไม่แสดงชื่อ)</h2><table><tr><th>ห้อง</th><th>คาบ</th><th>รหัส</th><th>งาน</th><th>ส่งเมื่อ</th></tr>${subs.slice(0, 300).map(s => `<tr><td>${e(s.className)}</td><td>${e(s.period)}</td><td>${e(s.studentId)}</td><td>${e(String(s.content || '').slice(0, 300))}${s.url ? '<br>' + e(s.url) : ''}</td><td>${e(s.submittedAt)}</td></tr>`).join('') || '<tr><td colspan="5">-</td></tr>'}</table>
<h2>4. การวิจัยในชั้นเรียน (CAR) / ผลการเรียนรู้รายห้อง</h2><table><tr><th>ห้อง</th><th>นักเรียน</th><th>เวลาเรียนเฉลี่ย</th><th>กลุ่มเสี่ยง</th><th>งานค้าง</th></tr>${summaries.map(s => `<tr><td>${e(s.className)}</td><td>${s.rows.length}</td><td>${s.avgAttendance}%</td><td>${s.atRiskCount}</td><td>${s.missingTotal}</td></tr>`).join('') || '<tr><td colspan="5">-</td></tr>'}</table>
<h2>5. บันทึกหลังสอน</h2>${(info.logs || []).map(l => `<div class="lesson"><strong>${e(l.className)} คาบ ${e(l.period)}</strong><div>ผลการจัดการเรียนรู้: ${e(l.result)}</div><div>ปัญหา/อุปสรรค: ${e(l.problems)}</div><div>แนวทางแก้ไข: ${e(l.solutions)}</div></div>`).join('') || '<p>-</p>'}
<h2>6. ผลการนิเทศจากครูพี่เลี้ยง</h2>${(info.evaluations || []).map(v => `<div class="lesson"><strong>${e(v.className)} คาบ ${e(v.period)} • รวม ${e(v.total)} คะแนน</strong><ul>${Object.keys(v.ratings || {}).map(k => `<li>${e(k)}: ${e(v.ratings[k])}/5</li>`).join('')}</ul><div>ข้อเสนอแนะ: ${e(v.comments)} (${e(v.mentor)})</div></div>`).join('') || '<p>-</p>'}
</body></html>`;
  },
  open(info) {
    const html = this.build(info);
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'portfolio.html'; a.click(); }
    return html;
  },
  openForCurrentIntern() {
    const u = InternMode.user();
    if (!u) return;
    const d = InternMode.data();
    return this.open({ name: u.name, internId: u.internId, classes: u.classes, logs: d.logs, evaluations: d.evaluations });
  }
};

// ปุ่มเข้าสู่ระบบ นศ. (ในหน้าล็อกอินครู)
async function internLoginFromForm() {
  const id = (document.getElementById('auth-intern-id') || {}).value || '';
  const pin = (document.getElementById('auth-intern-pin') || {}).value || '';
  if (!/^\d{6}$/.test(pin.trim())) { alert('กรุณากรอก PIN 6 หลัก'); return; }
  let r = await InternMode.login(id, pin);
  if (!r.success && r.code === 'needs_pin') {
    const again = prompt('เข้าใช้ครั้งแรก: กรอก PIN 6 หลักเดิมอีกครั้งเพื่อตั้งเป็น PIN ของคุณ');
    if (again !== pin.trim()) { alert('PIN ไม่ตรงกัน'); return; }
    r = await InternMode.setPin(id, pin);
  }
  if (!r.success) { alert(r.message || 'เข้าสู่ระบบไม่สำเร็จ'); return; }
  await InternMode.sync().catch(() => {});
  location.reload();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { InternMode, MentorPanel, Portfolio };
