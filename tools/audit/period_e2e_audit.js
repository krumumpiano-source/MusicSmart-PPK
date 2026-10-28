// period_e2e_audit.js — ตรวจ "ครบวงจร" ของทั้ง 20 คาบ ม.1 (ไม่แก้ข้อมูลจริง: ใช้นักเรียนตัวอย่าง + ล้างหลังตรวจ)
// เนื้อหาคาบ → ภารกิจนักเรียน (ต้องตรง วก.5) → ส่งงาน → คิวตรวจของครู → บันทึกคะแนน (≤เต็ม, K/P/A) → สมุดคะแนน → สื่อ
// ไม่ปรุงเนื้อหา: ช่องที่เอกสารไม่มีข้อมูล รายงานเป็น "ขาด" เท่านั้น
'use strict';

// ดึงเมธอดจาก app.js เป็นฟังก์ชันที่รันได้ (ใช้ this จำลอง) — ไม่ต้องโหลด DOM
function extractMethod(appSrc, name) {
  const re = new RegExp('\\n  ' + name + '\\(([^)]*)\\) \\{\\n');
  const m = re.exec(appSrc); if (!m) return null;
  const start = m.index + 1;
  const end = appSrc.indexOf('\n  },\n', start);
  if (end < 0) return null;
  const body = appSrc.slice(appSrc.indexOf('{', start + name.length) + 1, end + 1);
  return new Function(m[1], body);
}

function examPeriodsOf(Store, grade) {
  const out = [], n = Store.getPeriodCount(grade);
  for (let p = 1; p <= n; p++) { const w = Store.getPeriodWeights(grade, p); if (w && w.exam) out.push(p); }
  return out;
}

function eqArr(a, b) { return a.length === b.length && a.every((x, i) => String(x) === String(b[i])); }

function audit(env) {
  const { Store, LESSONS_DATA, WK5_PLANS, KALIMBA_MEDIA, KalimbaMedia, KalimbaDevices, appSrc, className, students } = env;
  const grade = 'M1';
  const n = Store.getPeriodCount(grade);
  const lessons = (LESSONS_DATA && LESSONS_DATA[grade]) || [];
  const exams = examPeriodsOf(Store, grade);
  const rows = [];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const buildPrompt = extractMethod(appSrc || '', 'buildStudentTaskPromptHTML');
  const sid = (students[0] && (students[0].student_id || students[0].id)) || 'T0001';
  const sid2 = (students[1] && (students[1].student_id || students[1].id)) || 'T0002';
  const ks = {};
  const note = (p, s) => { (ks[p] = ks[p] || []).push(s); };

  for (let p = 1; p <= n; p++) {
    const lesson = lessons.find(l => Number(l.period) === p) || null;
    const plan = (WK5_PLANS && WK5_PLANS[grade] && WK5_PLANS[grade][String(p)]) || null;
    const task = Store.getPeriodTask(grade, p);
    const w = Store.getPeriodWeights(grade, p) || { k: 0, p: 0, a: 0, total: 0, exam: false };
    const r = { period: p, topic: (lesson && lesson.topic) || '', kind: w.exam ? 'สอบ' : (w.total ? 'เก็บคะแนน' : 'ไม่เก็บคะแนน'), max: w.total, weights: w.k + '/' + w.p + '/' + w.a };

    // 1) เนื้อหา/ขั้นตอน
    r.lessonContent = !!(lesson && lesson.topic && Array.isArray(lesson.steps) && lesson.steps.length);
    if (!r.lessonContent) note(p, 'เนื้อหา/ขั้นตอนของคาบไม่ครบ');
    // 2) ภารกิจนักเรียน ต้องตรง วก.5 ทุกบรรทัด
    const planWork = plan && Array.isArray(plan.work) ? plan.work.map(x => String(x || '').trim()).filter(Boolean) : [];
    r.wk5Work = planWork.length;
    let promptOk = false;
    if (task.exam) {
      promptOk = !!buildPrompt && String(Reflect.apply(buildPrompt, { escapeHtml: esc }, [grade, p, lesson])).indexOf('ระบบสอบ') !== -1;
    } else if (buildPrompt) {
      const html = String(Reflect.apply(buildPrompt, { escapeHtml: esc }, [grade, p, lesson]));
      promptOk = planWork.length > 0 && eqArr(task.work, planWork) && planWork.every(wk => html.indexOf(esc(wk)) !== -1);
      if (!planWork.length) note(p, 'วก.5 ไม่ระบุภาระงานของคาบนี้ (นักเรียนเห็นข้อความ "ครูยังไม่ได้ระบุ")');
    }
    r.taskMatchesDocs = promptOk;
    // 3) น้ำหนัก = คะแนนเต็มในบทเรียน
    const lessonMax = lesson && lesson.assessment && lesson.assessment.has_score ? Number(lesson.assessment.max_score) || 0 : 0;
    r.weightsConsistent = Math.abs(lessonMax - w.total) < 0.005 && (w.total === 0 || Math.abs(w.k + w.p + w.a - w.total) < 0.005);
    if (!r.weightsConsistent) note(p, 'น้ำหนัก K/P/A ไม่ตรงกับคะแนนเต็มของคาบ');
    // 4) ส่งงาน → คิวตรวจ
    r.submitOk = null; r.reviewQueueOk = null; r.scoreOk = null; r.gradebookOk = null;
    const key = className + '_p' + p + '_' + sid;
    if (task.acceptsSubmission) {
      Store.saveStudentSubmission(className, p, sid, { content: 'ทดสอบระบบ คาบ ' + p, submissionType: 'text' });
      const all = Store.getAllSubmissions();
      r.submitOk = !!all[key] && all[key].content.indexOf('ทดสอบระบบ') === 0;
      r.reviewQueueOk = Object.keys(all).filter(k => all[k].className === className && Number(all[k].period) === p).length >= 1;
    } else { r.submitOk = 'n/a'; r.reviewQueueOk = 'n/a'; }
    // 5) ให้คะแนน
    if (task.canScore) {
      const over = Store.saveSubmissionTeacherFeedback(className, p, sid, 'ดี', task.max + 1) && Store._lastFeedbackResult;
      const rejectOver = !!over && over.ok === false && over.reason === 'over_max' && over.max === task.max;
      const bad = Store.setPeriodScore(className, p, sid, -1).reason === 'invalid';
      Store.saveSubmissionTeacherFeedback(className, p, sid, 'ดี', task.max);
      const okRes = Store._lastFeedbackResult;
      r.scoreOk = rejectOver && bad && okRes.ok === true && okRes.score === task.max;
      const kpa = Store.getStudentKPA(sid, className);
      r.gradebookOk = kpa.scoredPeriods.indexOf(p) !== -1;
      // คะแนนครึ่งหนึ่งต้องเข้าสมุดคะแนนตามสัดส่วน K/P/A ของคาบนั้น (เทียบส่วนต่างก่อน-หลัง)
      const k0 = Store.getStudentKPA(sid2, className);
      Store.setPeriodScore(className, p, sid2, task.max / 2);
      const k2 = Store.getStudentKPA(sid2, className);
      const half = task.max / 2;
      const ex = { K: half * w.k / w.total, P: half * w.p / w.total, A: half * w.a / w.total };
      r.gradebookOk = r.gradebookOk && k2.scoredPeriods.indexOf(p) !== -1 && Math.abs((k2.K - k0.K) - ex.K) < 0.011 && Math.abs((k2.P - k0.P) - ex.P) < 0.011 && Math.abs((k2.A - k0.A) - ex.A) < 0.011;
    } else if (task.exam) {
      const rej = Store.setPeriodScore(className, p, sid, 5);
      r.scoreOk = rej.ok === false && rej.reason === 'exam_period';
      const kind = p === exams[0] ? 'midterm' : 'final';
      const ap = Store.applyExamResults(className, kind, [{ studentId: sid, points: w.total, correct: 20, items: 20, level: 4, attemptNo: 1 }]);
      const kpa = Store.getStudentKPA(sid, className);
      r.gradebookOk = ap.applied === 1 && ap.period === p && (kind === 'midterm' ? kpa.midterm === w.total : kpa.final === w.total);
    } else {
      const rej = Store.setPeriodScore(className, p, sid, 1);
      r.scoreOk = rej.ok === false && rej.reason === 'no_score_period';
      r.gradebookOk = 'n/a';
    }
    // 6) สื่อ
    const ms = (KALIMBA_MEDIA && KALIMBA_MEDIA.mediaStatus && KALIMBA_MEDIA.mediaStatus[grade] && KALIMBA_MEDIA.mediaStatus[grade][p]) || [];
    const okSt = { in_app: 1, file: 1, generated: 1, external: 1 };
    r.mediaTotal = ms.length;
    r.mediaWorks = ms.filter(m => okSt[m.status]).length;
    r.mediaMissing = ms.filter(m => !okSt[m.status]).map(m => ({ title: m.title, status: m.status, url: m.url }));
    r.mediaUnknown = ms.filter(m => m.status === 'unknown').length;
    r.mediaWorksAll = ms.length > 0 ? r.mediaMissing.length === 0 : null;
    r.mediaExternalOnly = ms.filter(m => m.status === 'external').length;
    // 7) คาลิมบ้า: โน้ต + ช่องเครื่อง
    const items = KalimbaMedia ? KalimbaMedia.getItems(grade, p) : [];
    r.kalimbaItems = items.length;
    r.notesPresent = items.length ? items.every(it => !it.missing && Array.isArray(it.notes) && it.notes.length > 0) : null;
    r.notesMissingItems = items.filter(it => it.missing || !it.notes || !it.notes.length).map(it => it.title || it.id);
    if (items.length) {
      // หมายเลขเครื่อง 3 หลัก (001–060) · "ไม่มีเลข" ต้องเลือกเองได้ · ต้องแนบไปกับงานและออก CSV
      const setRes = KalimbaDevices.set(className, p, sid, '001', 'student');
      const tagged = KalimbaDevices.tagContent('งาน', className, p, sid, 5000);
      const back = KalimbaDevices.parseContent(tagged);
      const csv = KalimbaDevices.exportCSV(className, p);
      const row = KalimbaDevices.rowsFor(className, p, '').filter(x => String(x.studentId) === String(sid))[0];
      const okNum = !!(setRes && setRes.ok) && back.device === '001' && back.content === 'งาน' && !!row && row.device === '001' && csv.indexOf('หมายเลขเครื่อง') !== -1;
      const noRes = KalimbaDevices.set(className, p, sid, KalimbaDevices.NO_NUMBER, 'student');
      const back2 = KalimbaDevices.parseContent(KalimbaDevices.tagContent('งาน', className, p, sid, 5000));
      const okNone = !!(noRes && noRes.ok) && back2.device === KalimbaDevices.NO_NUMBER;
      const badRes = KalimbaDevices.set(className, p, sid, '9!', 'student');
      r.deviceField = okNum && okNone && !(badRes && badRes.ok);
      KalimbaDevices.set(className, p, sid, '', 'teacher');
    } else r.deviceField = null;
    r.notes = ks[p] || [];
    rows.push(r);
  }
  return { rows };
}

function totals(env) {
  // ให้ "ระดับ 4" ทุกคาบที่เก็บคะแนน แล้วสมุดคะแนนต้องรวมเป็น K/P/A ตามน้ำหนัก (+สอบ)
  const { Store, className, students } = env;
  const grade = 'M1';
  const sid = (students[2] && students[2].student_id) || (students[0] && students[0].student_id) || 'T0003';
  const n = Store.getPeriodCount(grade);
  for (let p = 1; p <= n; p++) {
    const w = Store.getPeriodWeights(grade, p);
    if (w && w.total && !w.exam) Store.setPeriodScore(className, p, sid, w.total);
  }
  const exams = examPeriodsOf(Store, grade);
  Store.applyExamResults(className, 'midterm', [{ studentId: sid, points: Store.getPeriodWeights(grade, exams[0]).total }]);
  Store.applyExamResults(className, 'final', [{ studentId: sid, points: Store.getPeriodWeights(grade, exams[exams.length - 1]).total }]);
  return { expected: Store.getKPATotals(grade), actual: Store.getStudentKPA(sid, className) };
}

function mark(v) { return v === null || v === undefined ? '–' : (v === 'n/a' ? 'ไม่ใช้' : (v === true ? '✅' : (v === false ? '❌' : String(v)))); }

function toMarkdown(rows) {
  const head = ['คาบ', 'ประเภท', 'เต็ม (K/P/A)', 'เนื้อหา+ขั้นตอน', 'งานตรง วก.5', 'ส่งงาน', 'เข้าคิวตรวจ', 'ให้คะแนน', 'เข้าสมุดคะแนน', 'สื่อใช้ได้', 'โน้ตครบ', 'ช่องเลขเครื่อง'];
  const lines = ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'];
  rows.forEach(r => {
    const media = r.mediaTotal ? (r.mediaWorks + '/' + r.mediaTotal + (r.mediaWorksAll ? ' ✅' : ' ⚠')) : '–';
    lines.push('| ' + [r.period, r.kind, r.max + ' (' + r.weights + ')', mark(r.lessonContent), mark(r.taskMatchesDocs), mark(r.submitOk), mark(r.reviewQueueOk), mark(r.scoreOk), mark(r.gradebookOk), media, mark(r.notesPresent), mark(r.deviceField)].join(' | ') + ' |');
  });
  return lines.join('\n');
}

module.exports = { audit, totals, toMarkdown, extractMethod };
