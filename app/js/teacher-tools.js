// ==========================================================================
// MusicSmart • เครื่องมือครู (Phase 2)
// - ทวงงานผู้ยังไม่ส่ง (แจ้งเตือนในแอปนักเรียน) และส่งคำแนะนำครูถึงมือถือนักเรียน
// - แดชบอร์ดห้องเรียน/รายบุคคล (คะแนน เวลาเรียน กลุ่มเสี่ยง)
// - ส่งออก Excel/CSV รูปแบบคล้าย ปพ.5
// ==========================================================================
const Analytics = {
  PERIODS: 20,
  RISK: { minAttendancePct: 80, maxMissing: 3, minQuizPct: 50 },

  _sessions() { return (typeof Store !== 'undefined' && Store.getAllSessions) ? Store.getAllSessions() : {}; },
  _quiz(sid, unit) { try { return JSON.parse(localStorage.getItem(`music_quiz_${sid}_u${unit}`) || 'null'); } catch (e) { return null; } },

  // ข้อมูลรายนักเรียน (คำนวณจากข้อมูลในเครื่องครู)
  studentStats(className, s) {
    const sid = String(s.student_id);
    const sessions = this._sessions();
    const subs = Store.getAllSubmissions();
    const periodScores = [];
    let present = 0, recorded = 0, absent = 0, leave = 0, scoreSum = 0, scoreMax = 0, submitted = 0, missing = 0, late = 0;
    for (let p = 1; p <= this.PERIODS; p++) {
      const sess = sessions[Store.getSessionKey(className, p)];
      const att = sess && sess.attendance ? sess.attendance[sid] : undefined;
      if (att) {
        recorded++;
        if (att === 'present' || att === 'late' || att === 'activity') present++;
        else if (att === 'absent') absent++;
        else if (att === 'leave') leave++;
      }
      const sc = sess && sess.scores ? sess.scores[sid] : undefined;
      const sub = subs[`${className}_p${p}_${sid}`];
      const fbScore = sub && sub.teacherFeedback && sub.teacherFeedback.score !== null && sub.teacherFeedback.score !== undefined && sub.teacherFeedback.score !== '' ? Number(sub.teacherFeedback.score) : undefined;
      const val = sc !== undefined && sc !== null ? Number(sc) : fbScore;
      periodScores.push(val === undefined ? '' : val);
      if (sess) { scoreMax += 3; if (val !== undefined) scoreSum += val; }
      if (sub) { submitted++; if (sub.late) late++; }
      else if (sess || (typeof DueDates !== 'undefined' && DueDates.get(className, p) && Date.now() > new Date(DueDates.get(className, p).dueAt).getTime())) missing++;
    }
    const quizzes = [1, 2, 3, 4].map(u => { const q = this._quiz(sid, u); return q && q.submitted ? { score: Number(q.score) || 0, max: Number(q.maxScore || q.totalQuestions) || 10 } : null; });
    const qDone = quizzes.filter(Boolean);
    const quizPct = qDone.length ? Math.round(qDone.reduce((a, q) => a + q.score / q.max, 0) / qDone.length * 100) : null;
    const attendancePct = recorded ? Math.round(present / recorded * 100) : 100;
    const flags = [];
    if (recorded && attendancePct < this.RISK.minAttendancePct) flags.push('เวลาเรียนต่ำกว่า 80%');
    if (missing >= this.RISK.maxMissing) flags.push(`ค้างส่งงาน ${missing} ชิ้น`);
    if (quizPct !== null && quizPct < this.RISK.minQuizPct) flags.push('คะแนนแบบทดสอบต่ำกว่า 50%');
    return {
      no: s.no, studentId: sid, name: `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim(),
      periodScores, scoreSum, scoreMax, present, absent, leave, recorded, attendancePct,
      submitted, missing, late, quizzes, quizPct, flags, atRisk: flags.length > 0,
      eligible: !recorded || attendancePct >= 80
    };
  },

  classSummary(className) {
    const rows = Store.getStudents(className).map(s => this.studentStats(className, s));
    const n = rows.length || 1;
    return {
      className, rows,
      avgAttendance: Math.round(rows.reduce((a, r) => a + r.attendancePct, 0) / n),
      atRiskCount: rows.filter(r => r.atRisk).length,
      missingTotal: rows.reduce((a, r) => a + r.missing, 0)
    };
  },

  missingFor(className, period) {
    const subs = Store.getAllSubmissions();
    return Store.getStudents(className).filter(s => !subs[`${className}_p${period}_${s.student_id}`]);
  },

  // ---- ส่งออกแบบ ปพ.5 (สมมติฐาน: คะแนนเก็บรายคาบเต็มคาบละ 3, แบบทดสอบ 4 หน่วย, เกณฑ์เวลาเรียน 80% = มีสิทธิ์สอบ) ----
  pp5Rows(className) {
    const sum = this.classSummary(className);
    const header = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล'];
    for (let p = 1; p <= this.PERIODS; p++) header.push(`คาบ${p}`);
    header.push('รวมคะแนนเก็บ', 'คะแนนเต็ม', 'แบบทดสอบ1', 'แบบทดสอบ2', 'แบบทดสอบ3', 'แบบทดสอบ4',
      'มาเรียน', 'ขาด', 'ลา', 'เวลาเรียน(%)', 'สิทธิ์สอบ', 'ส่งงาน', 'ค้างส่ง', 'ส่งช้า', 'กลุ่มเสี่ยง');
    const rows = sum.rows.map(r => [r.no, r.studentId, r.name, ...r.periodScores, r.scoreSum, r.scoreMax,
      ...r.quizzes.map(q => (q ? q.score : '')), r.present, r.absent, r.leave, r.attendancePct, r.eligible ? 'มีสิทธิ์' : 'มส',
      r.submitted, r.missing, r.late, r.flags.join('; ')]);
    return [[`แบบบันทึกผลการเรียน (รูปแบบคล้าย ปพ.5) ห้อง ${className}`], header, ...rows];
  },

  toCSV(rows) {
    const esc = v => { const s = String(v === undefined || v === null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  },

  _download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },

  exportClass(className, format = 'xlsx') {
    const rows = this.pp5Rows(className);
    const fname = `ปพ5_${className.replace(/\//g, '-')}`;
    if (format === 'xlsx' && typeof XLSX !== 'undefined') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'ปพ5');
      XLSX.writeFile(wb, fname + '.xlsx');
      return 'xlsx';
    }
    this._download(new Blob([this.toCSV(rows)], { type: 'text/csv;charset=utf-8' }), fname + '.csv');
    return 'csv';
  }
};

// ทวงงาน / ส่งคำแนะนำ (ฝั่งครู)
const Notices = {
  async _post(items) {
    if (typeof TeacherPull === 'undefined' || !TeacherPull.isConfigured()) throw new Error('กรุณาตั้งค่า URL และรหัสซิงค์ก่อน');
    const cfg = GoogleSheetSync.getConfig();
    return GoogleSheetSync.postJSON(cfg.webAppUrl, { action: 'post_notices', items });
  },
  async remindMissing(className, period, customMsg) {
    const missing = Analytics.missingFor(className, period);
    if (!missing.length) return { posted: 0, missing: 0 };
    const due = (typeof DueDates !== 'undefined') ? DueDates.get(className, period) : null;
    const msg = customMsg || `🔔 คุณครูแจ้ง: ยังไม่ได้ส่งงานคาบที่ ${period}${due ? ' (กำหนดส่ง ' + new Date(due.dueAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ')' : ''} กรุณาส่งให้เรียบร้อย`;
    const r = await this._post(missing.map(s => ({ studentId: s.student_id, kind: 'reminder', ref: `${className}_p${period}`, message: msg })));
    return { posted: r.posted, missing: missing.length };
  },
  async postFeedback(className, period, studentId, text, score) {
    const teacher = (Store.getCurrentUser && Store.getCurrentUser()) || {};
    return this._post([{ studentId, kind: 'feedback', ref: `${className}_p${period}`, message: text || '(ให้คะแนนแล้ว)', score: score === '' ? null : score, teacher: teacher.name || 'คุณครู' }]);
  }
};

// แจ้งเตือน/คำแนะนำบนมือถือนักเรียน
const StudentNotices = {
  KEY: 'ppk_student_notices',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{"items":[],"since":0,"seen":[]}'); } catch (e) { return { items: [], since: 0, seen: [] }; } },
  save(d) { localStorage.setItem(this.KEY, JSON.stringify(d)); },

  async fetch() {
    if (typeof StudentOutbox === 'undefined' || !StudentOutbox.isActive()) return null;
    const u = StudentOutbox.currentStudent();
    if (!StudentOutbox.sessionValid(u)) return null;
    const d = this.get();
    try {
      const r = await StudentAuth._post({ action: 'studentNotices', sessionToken: u.sessionToken, since: d.since || 0 });
      if (r.status !== 'success') return null;
      (r.notices || []).forEach(n => {
        if (d.items.some(x => x.id === n.id)) return;
        d.items.push(n);
        if (n.createdMs > (d.since || 0)) d.since = n.createdMs;
        if (n.kind === 'feedback') this.applyFeedback(u.studentId, n);
      });
      d.items = d.items.slice(-100);
      this.save(d);
      this.render();
      return r.notices || [];
    } catch (e) { return null; }
  },

  // คำแนะนำครู -> แสดงในการ์ด "คำแนะนำจากคุณครู" ของงานนั้น
  applyFeedback(studentId, n) {
    const m = /^(.*)_p(\d+)$/.exec(n.ref || '');
    if (!m) return;
    const all = Store.getAllSubmissions();
    const key = `${m[1]}_p${m[2]}_${studentId}`;
    all[key] = Object.assign({ key, className: m[1], period: Number(m[2]), studentId, content: '', submittedAt: '' }, all[key] || {}, {
      teacherFeedback: { feedback: n.message, score: n.score === null || n.score === '' ? null : Number(n.score), teacherName: n.teacher || 'คุณครู', teacherRole: 'ครูผู้สอน', feedbackAt: new Date(n.createdMs).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) }
    });
    Store.save('ppk_student_submissions', all);
  },

  unseen() { const d = this.get(); return d.items.filter(n => !d.seen.includes(n.id)); },
  markSeen() { const d = this.get(); d.seen = d.items.map(n => n.id).slice(-200); this.save(d); this.render(); },

  render() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const host = document.getElementById('view-student');
    if (!host) return;
    let box = document.getElementById('student-notice-box');
    const list = this.unseen();
    if (!list.length) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'student-notice-box';
      box.style.cssText = 'margin-bottom:0.75rem;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:0.75rem 0.9rem;font-size:0.88rem;';
      host.insertBefore(box, host.firstChild);
    }
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    box.innerHTML = `<div style="font-weight:800;color:#3730a3;margin-bottom:0.35rem;">📣 ข้อความจากคุณครู (${list.length})</div>` +
      list.slice(-5).map(n => `<div style="padding:0.3rem 0;border-top:1px dashed #c7d2fe;">${n.kind === 'feedback' ? '💬 คำแนะนำงาน' : '🔔 แจ้งเตือน'}: ${esc(n.message)}${n.score !== null && n.score !== undefined && n.score !== '' ? ` • คะแนน ${esc(n.score)}` : ''}</div>`).join('') +
      `<button type="button" id="student-notice-ok" class="btn-nav-action" style="margin-top:0.4rem;">รับทราบ</button>`;
    document.getElementById('student-notice-ok').onclick = () => this.markSeen();
  }
};

// หน้าต่างแดชบอร์ด (สร้างเฉพาะเมื่อครูเปิด)
const TeacherDashboard = {
  open(className) {
    const classes = [...Store.getAllClasses('M1'), ...Store.getAllClasses('M2')];
    const cls = className || (typeof App !== 'undefined' && App.state.selectedClass) || classes[0];
    let modal = document.getElementById('modal-teacher-dashboard');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-teacher-dashboard';
      modal.className = 'modal-overlay';
      modal.setAttribute('data-teacher-only', '');
      document.body.appendChild(modal);
    }
    const sum = Analytics.classSummary(cls);
    const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    modal.innerHTML = `<div class="modal-card" style="max-width:1100px;width:96vw;max-height:92vh;overflow:auto;">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <h3 class="modal-title" style="margin:0;">📊 แดชบอร์ดห้องเรียน</h3>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          <select id="dash-class" class="form-select">${classes.map(c => `<option ${c === cls ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <button type="button" class="btn-nav-action" id="dash-xlsx">⬇️ Excel (ปพ.5)</button>
          <button type="button" class="btn-nav-action" id="dash-csv">⬇️ CSV</button>
          <button type="button" class="btn-nav-action" id="dash-close">✕</button>
        </div>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">
          <div class="badge-primary" style="padding:0.4rem 0.8rem;border-radius:8px;">นักเรียน ${sum.rows.length} คน</div>
          <div class="badge-success" style="padding:0.4rem 0.8rem;border-radius:8px;">เวลาเรียนเฉลี่ย ${sum.avgAttendance}%</div>
          <div class="badge-danger" style="padding:0.4rem 0.8rem;border-radius:8px;">กลุ่มเสี่ยง ${sum.atRiskCount} คน</div>
          <div class="badge-warning" style="padding:0.4rem 0.8rem;border-radius:8px;">งานค้างรวม ${sum.missingTotal}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
          <thead><tr style="background:#1e3a8a;color:#fff;"><th>เลขที่</th><th>รหัส</th><th>ชื่อ-สกุล</th><th>คะแนนเก็บ</th><th>แบบทดสอบ</th><th>เวลาเรียน</th><th>ส่ง/ค้าง/ช้า</th><th>สถานะ</th></tr></thead>
          <tbody>${sum.rows.map(r => `<tr data-sid="${esc(r.studentId)}" style="border-bottom:1px solid #e2e8f0;cursor:pointer;${r.atRisk ? 'background:#fef2f2;' : ''}">
            <td>${esc(r.no)}</td><td>${esc(r.studentId)}</td><td>${esc(r.name)}</td><td>${r.scoreSum}/${r.scoreMax}</td>
            <td>${r.quizPct === null ? '-' : r.quizPct + '%'}</td><td>${r.attendancePct}%${r.eligible ? '' : ' (มส)'}</td>
            <td>${r.submitted}/${r.missing}/${r.late}</td><td>${r.atRisk ? '⚠️ ' + esc(r.flags.join(', ')) : '✅ ปกติ'}</td></tr>`).join('')}</tbody>
        </table>
        <div id="dash-detail" style="margin-top:0.75rem;"></div>
      </div></div>`;
    modal.classList.add('active');
    modal.querySelector('#dash-close').onclick = () => modal.classList.remove('active');
    modal.querySelector('#dash-class').onchange = e => this.open(e.target.value);
    modal.querySelector('#dash-xlsx').onclick = () => Analytics.exportClass(cls, 'xlsx');
    modal.querySelector('#dash-csv').onclick = () => Analytics.exportClass(cls, 'csv');
    modal.querySelectorAll('tr[data-sid]').forEach(tr => { tr.onclick = () => this.detail(sum, tr.getAttribute('data-sid')); });
  },
  detail(sum, sid) {
    const r = sum.rows.find(x => x.studentId === sid);
    const el = document.getElementById('dash-detail');
    if (!r || !el) return;
    el.innerHTML = `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:0.75rem;">
      <strong>👤 ${String(r.name).replace(/</g, '&lt;')} (${r.studentId})</strong>
      <div style="margin-top:0.4rem;font-size:0.84rem;">คะแนนรายคาบ: ${r.periodScores.map((v, i) => `<span title="คาบ ${i + 1}" style="display:inline-block;min-width:1.6rem;text-align:center;border:1px solid #e2e8f0;margin:1px;border-radius:4px;">${v === '' ? '·' : v}</span>`).join('')}</div>
      <div style="font-size:0.84rem;">แบบทดสอบ: ${r.quizzes.map((q, i) => `หน่วย ${i + 1}: ${q ? q.score + '/' + q.max : '-'}`).join(' • ')}</div>
      <div style="font-size:0.84rem;">มา ${r.present} • ขาด ${r.absent} • ลา ${r.leave} (บันทึก ${r.recorded} คาบ)</div>
      ${r.flags.length ? `<div style="color:#b91c1c;font-weight:600;">⚠️ ${r.flags.join(' • ')}</div>` : ''}</div>`;
  }
};

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.addEventListener) {
  setTimeout(() => { try { StudentNotices.render(); StudentNotices.fetch(); } catch (e) { /* ignore */ } }, 2500);
}
if (typeof module !== 'undefined' && module.exports) module.exports = { Analytics, Notices, StudentNotices, TeacherDashboard };
