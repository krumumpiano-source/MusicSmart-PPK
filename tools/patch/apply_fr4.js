#!/usr/bin/env node
// apply_fr4.js — ใส่การแก้ fix_report_4 ลงไฟล์โปรเจกต์ (idempotent: ข้ามถ้าทำแล้ว; ไม่พบจุดยึด = หยุด ไม่เดา)
// ใช้: node apply_fr4.js <projectRoot> [--dry]   (ตรวจสอบเท่านั้นเมื่อมี --dry)
// ปลอดภัยต่อ CRLF/LF: แปลงเป็น LF ตอนแก้ แล้วคืนรูปแบบเดิม
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const DRY = process.argv.includes('--dry');
const HERE = __dirname;
const only = (process.argv.find(a => a.indexOf('--only=') === 0) || '').slice(7).split(',').filter(Boolean);
let failed = 0;
const log = [];

function readF(rel) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f, 'utf8');
  return { f, crlf: raw.indexOf('\r\n') !== -1, text: raw.replace(/\r\n/g, '\n'), bom: raw.charCodeAt(0) === 0xFEFF };
}
function writeF(o, text) {
  let out = o.crlf ? text.replace(/\n/g, '\r\n') : text;
  if (!DRY) fs.writeFileSync(o.f, out, 'utf8');
}
function count(s, a) { let n = 0, i = 0; while ((i = s.indexOf(a, i)) !== -1) { n++; i += a.length; } return n; }

// แทนที่ข้อความจุดยึดที่ต้องพบ "ครั้งเดียว" ; ถ้ามี marker อยู่แล้ว = ข้าม
function step(ctx, name, anchor, fn, doneMark) {
  if (doneMark && ctx.text.indexOf(doneMark) !== -1) { log.push('  = ' + name + ' (มีอยู่แล้ว)'); return; }
  const n = typeof anchor === 'string' ? count(ctx.text, anchor) : (ctx.text.match(new RegExp(anchor.source, anchor.flags.replace('g', '') + 'g')) || []).length;
  if (n !== 1) { failed++; log.push('  ✗ ' + name + ' — พบจุดยึด ' + n + ' ที่ (ต้อง 1)'); return; }
  ctx.text = fn(ctx.text);
  log.push('  ✓ ' + name);
}
function replaceOnce(s, a, b) { if (typeof a === 'string') { const i = s.indexOf(a); return s.slice(0, i) + b + s.slice(i + a.length); } return s.replace(a, () => b); }
// ตัดเมธอดตั้งแต่ signature ถึง "\n  },\n" แรก
function methodRange(s, sig) {
  const i = s.indexOf(sig); if (i < 0) return null;
  const j = s.indexOf('\n  },\n', i); if (j < 0) return null;
  return [i, j + 5];
}

function file(rel, fn) {
  if (only.length && only.indexOf(rel) === -1 && only.indexOf(path.basename(rel)) === -1) return;
  log.push(rel);
  const o = readF(rel);
  if (!o) { failed++; log.push('  ✗ ไม่พบไฟล์'); return; }
  const before = o.text;
  fn(o);
  if (o.text !== before) writeF(o, o.text);
}

// ---------------------------------------------------------------- store.js
file('app/data/store.js', o => {
  step(o, 'ซิงค์ ppk_kalimba_devices ไปกับ extendedAssessments', "      'ppk_quiz_settings',\n", s => replaceOnce(s, "      'ppk_quiz_settings',\n", "      'ppk_quiz_settings',\n      'ppk_kalimba_devices',\n"), "'ppk_kalimba_devices'");
  step(o, 'แนบ deviceNo ในงานที่ส่ง', "      pendingUploadId: data.pendingUploadId || '',\n", s => replaceOnce(s, "      pendingUploadId: data.pendingUploadId || '',\n",
    "      pendingUploadId: data.pendingUploadId || '',\n      deviceNo: data.deviceNo !== undefined ? String(data.deviceNo) : ((typeof KalimbaDevices !== 'undefined' && KalimbaDevices.getDevice(className, period, studentId)) || existing.deviceNo || ''),\n"), 'deviceNo: data.deviceNo');
  const methods = fs.readFileSync(path.join(HERE, 'store_methods.txt'), 'utf8').replace(/\r\n/g, '\n');
  if (o.text.indexOf('getPeriodTask(grade, period)') !== -1) { log.push('  = ภาระงาน/คะแนนรายคาบ (มีอยู่แล้ว)'); return; }
  const sig = '  saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, score) {';
  const cm = '  // --- Teacher Feedback Loop on Student Submissions ---\n';
  const r = methodRange(o.text, sig);
  if (!r || count(o.text, sig) !== 1 || count(o.text, cm) !== 1 || o.text.indexOf(cm) > r[0]) { failed++; log.push('  ✗ ไม่พบ saveSubmissionTeacherFeedback/หัวคอมเมนต์'); return; }
  const start = o.text.indexOf(cm);
  o.text = o.text.slice(0, start) + methods + o.text.slice(r[1]);
  log.push('  ✓ getPeriodTask / setPeriodScore / saveSubmissionTeacherFeedback ใหม่');
});

// ---------------------------------------------------------------- app.js
file('app/js/app.js', o => {
  const methods = fs.readFileSync(path.join(HERE, 'app_methods.txt'), 'utf8').replace(/\r\n/g, '\n');
  // 1) เมธอดใหม่ ก่อน saveStudentFeedback
  step(o, 'เมธอดใหม่ (ภารกิจ/สถานะสื่อ/แถบเครื่องคาลิมบ้า)', '  saveStudentFeedback(className, period, studentId) {\n', s => replaceOnce(s, '  saveStudentFeedback(className, period, studentId) {\n', methods + '  saveStudentFeedback(className, period, studentId) {\n'), 'buildStudentTaskPromptHTML(gradeKey, period, lesson) {');
  // 2) ข้อความภารกิจฝั่งนักเรียน
  step(o, 'ภารกิจนักเรียนจาก วก.5 work', /        promptEl\.textContent = `ภารกิจประจำคาบ \(\$\{lesson\.assessment\.max_score\} คะแนน\)[^\n]*\n/,
    s => s.replace(/        promptEl\.textContent = `ภารกิจประจำคาบ \(\$\{lesson\.assessment\.max_score\} คะแนน\)[^\n]*\n/, () => '        promptEl.innerHTML = this.buildStudentTaskPromptHTML(gradeKey, this.state.studentPeriod, lesson);\n'), 'promptEl.innerHTML = this.buildStudentTaskPromptHTML');
  // 3) การ์ดคำแนะนำ: โชว์เมื่อมีคะแนนอย่างเดียว + คะแนนเต็มจริง
  step(o, 'การ์ดคำแนะนำแสดงเมื่อมีเฉพาะคะแนน', "      if (sub && sub.teacherFeedback && sub.teacherFeedback.feedback) {\n        feedbackCard.style.display = 'block';",
    s => replaceOnce(s, "      if (sub && sub.teacherFeedback && sub.teacherFeedback.feedback) {\n        feedbackCard.style.display = 'block';",
      "      if (sub && sub.teacherFeedback && (sub.teacherFeedback.feedback || (sub.teacherFeedback.score !== null && sub.teacherFeedback.score !== undefined))) {\n        feedbackCard.style.display = 'block';"), "sub.teacherFeedback.feedback || (sub.teacherFeedback.score");
  step(o, 'คะแนนเต็มในการ์ด ไม่ฮาร์ดโค้ด /3', '${tf.score} / 3', s => replaceOnce(s, '${tf.score} / 3', "${tf.score} / ${(Store.getPeriodWeights(gradeKey, this.state.studentPeriod) || {}).total || ''}"), '(Store.getPeriodWeights(gradeKey, this.state.studentPeriod) || {}).total');
  step(o, 'ข้อความคำแนะนำแสดงเมื่อมี', /          <div class="teacher-feedback-speech">\n            "\$\{this\.escapeHtml\(tf\.feedback\)\}"\n          <\/div>\n/,
    s => s.replace(/          <div class="teacher-feedback-speech">\n            "\$\{this\.escapeHtml\(tf\.feedback\)\}"\n          <\/div>\n/, () => '          ${tf.feedback ? `<div class="teacher-feedback-speech">"${this.escapeHtml(tf.feedback)}"</div>` : \'\'}\n'), "${tf.feedback ? `<div class=\"teacher-feedback-speech\">");
  // 4) วิดเจ็ตคาลิมบ้าในคู่มือนักเรียน
  step(o, 'ตั้งบริบทนักเรียน + mount วิดเจ็ต', "      lessonTextEl.innerHTML = this.buildStudentStudyGuideHTML(gradeKey, this.state.studentPeriod, lesson);\n",
    s => replaceOnce(s, "      lessonTextEl.innerHTML = this.buildStudentStudyGuideHTML(gradeKey, this.state.studentPeriod, lesson);\n",
      "      this.state._kmCtx = { role: 'student', className, studentId };\n      lessonTextEl.innerHTML = this.buildStudentStudyGuideHTML(gradeKey, this.state.studentPeriod, lesson);\n      if (typeof KalimbaMedia !== 'undefined') { try { KalimbaMedia.mountAll(lessonTextEl); } catch (e) { console.error('KalimbaMedia', e); } }\n"), 'this.state._kmCtx = {');
  step(o, 'สาขาคาลิมบ้าใน buildStudentStudyGuideHTML', "    } else if (aidIds.includes('staff-notes')) {\n",
    s => replaceOnce(s, "    } else if (aidIds.includes('staff-notes')) {\n",
      "    } else if (typeof KalimbaMedia !== 'undefined' && KalimbaMedia.hasKalimba(gradeKey, p)) {\n      // สื่อคาลิมบ้า (ผังลิ่ม + บรรทัด 5 เส้น + เมโทรนอม + เล่น) สร้างจากข้อมูลโน้ต — ไม่มีโน้ตเพลงฮาร์ดโค้ดในหน้า\n      html += KalimbaMedia.mountHTML(gradeKey, p, this.state._kmCtx || { role: 'student' });\n    } else if (aidIds.includes('staff-notes')) {\n"), 'KalimbaMedia.hasKalimba(gradeKey, p)');
  // 5) ป้ายสถานะสื่อ (นักเรียน)
  step(o, 'ป้ายสถานะสื่อ (นักเรียน: ไฟล์ academic)', '<span style="font-size: 0.76rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; white-space: nowrap;">คลิกเปิดอ่าน</span>',
    s => replaceOnce(s, '<span style="font-size: 0.76rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; white-space: nowrap;">คลิกเปิดอ่าน</span>', '${this.mediaStatusChipHTML(gradeKey, p, m)}'), 'this.mediaStatusChipHTML(gradeKey, p, m)');
  step(o, 'ป้ายสถานะสื่อ (นักเรียน: ลิงก์ที่เปิดไม่ได้)', "          itemHtml = `<span style=\"font-weight: 600; color: #0369a1;\">📄 ${this.escapeHtml(m.title)}</span>`;\n",
    s => replaceOnce(s, "          itemHtml = `<span style=\"font-weight: 600; color: #0369a1;\">📄 ${this.escapeHtml(m.title)}</span>`;\n",
      "          itemHtml = `<span style=\"font-weight: 600; color: #0369a1;\">📄 ${this.escapeHtml(m.title)}</span> ${this.mediaStatusChipHTML(gradeKey, p, m, 'ยังไม่มีลิงก์')}`;\n"), "mediaStatusChipHTML(gradeKey, p, m, 'ยังไม่มีลิงก์')");
  // 6) ครู: วิดเจ็ตในแท็บบทเรียน + สถานะสื่อ
  step(o, 'วิดเจ็ตคาลิมบ้าในแท็บบทเรียนครู', "    this.updateTimerDisplay();\n  },\n\n  // --- Modulo 5 Grouping",
    s => replaceOnce(s, "    this.updateTimerDisplay();\n  },\n\n  // --- Modulo 5 Grouping",
      "    let kmEl = document.getElementById('km-teacher-media');\n    if (!kmEl && mediaListEl && mediaListEl.parentNode) { kmEl = document.createElement('div'); kmEl.id = 'km-teacher-media'; mediaListEl.parentNode.insertBefore(kmEl, mediaListEl.nextSibling); }\n    if (kmEl) {\n      kmEl.innerHTML = (typeof KalimbaMedia !== 'undefined') ? KalimbaMedia.mountHTML(this.state.grade, lesson.period, { role: 'teacher', className: this.state.selectedClass }) : '';\n      if (kmEl.innerHTML && typeof KalimbaMedia !== 'undefined') { try { KalimbaMedia.mountAll(kmEl); } catch (e) { console.error('KalimbaMedia', e); } }\n    }\n\n    this.updateTimerDisplay();\n  },\n\n  // --- Modulo 5 Grouping"), "id = 'km-teacher-media'");
  step(o, 'ป้ายสถานะสื่อ (ครู)', "      btn.textContent = `📄 ${m.title} (${m.type})`;\n",
    s => replaceOnce(s, "      btn.textContent = `📄 ${m.title} (${m.type})`;\n",
      "      const _mst = this.mediaStatusOf(this.state.grade, lesson.period, m);\n      btn.textContent = `📄 ${m.title} (${m.type})` + (_mst && (_mst.status === 'missing_file' || _mst.status === 'dead_link' || _mst.status === 'no_link') ? (_mst.status === 'missing_file' ? ' — ⚠ ยังไม่มีไฟล์' : ' — ⚠ ลิงก์ใช้ไม่ได้') : '');\n"), 'const _mst = this.mediaStatusOf');
  // 7) หน้าตรวจงาน: ingest เลขเครื่อง, แถบเครื่อง, ป้ายเครื่อง, ตัดมาร์กเกอร์, ช่องคะแนนตามคะแนนเต็มจริง
  step(o, 'ingest เลขเครื่องจากงานที่ส่งมา', "    const allSubs = Store.getAllSubmissions();\n    const listEl = document.getElementById('teacher-submissions-list');",
    s => replaceOnce(s, "    const allSubs = Store.getAllSubmissions();\n    const listEl = document.getElementById('teacher-submissions-list');",
      "    const allSubs = Store.getAllSubmissions();\n    if (typeof KalimbaDevices !== 'undefined') { try { KalimbaDevices.ingestSubmissions(allSubs); } catch (e) { console.error('KalimbaDevices', e); } }\n    const taskT = Store.getPeriodTask(Store.gradeKeyOf(className), period);\n    const taskMax = taskT.max || 0;\n    const scoreDisabledAttr = taskT.canScore ? '' : ' disabled';\n    const scoreLabelText = taskT.canScore ? `คะแนน (0-${taskMax}):` : (taskT.exam ? `คะแนนสอบ (${taskMax}) มาจากระบบสอบ:` : 'ไม่เก็บคะแนนรายชิ้น:');\n    const listEl = document.getElementById('teacher-submissions-list');"), 'const taskT = Store.getPeriodTask');
  step(o, 'แถบหมายเลขเครื่อง', "    this.renderDueDateBar(className, period, listEl);\n\n    let submittedCount = 0;", s => replaceOnce(s, "    this.renderDueDateBar(className, period, listEl);\n\n    let submittedCount = 0;",
    "    this.renderDueDateBar(className, period, listEl);\n    this.renderKalimbaDeviceBar(className, period, listEl);\n\n    let submittedCount = 0;"), 'this.renderKalimbaDeviceBar(className, period, listEl);');
  step(o, 'ป้ายเครื่องบนการ์ดงาน', '              <span class="badge-success">ส่งงานแล้ว ✅</span>\n', s => replaceOnce(s, '              <span class="badge-success">ส่งงานแล้ว ✅</span>\n',
    '              <span class="badge-success">ส่งงานแล้ว ✅</span>\n              ${this._kalimbaDeviceBadge(className, period, s.student_id, sub)}\n'), 'this._kalimbaDeviceBadge(className, period, s.student_id, sub)');
  step(o, 'ตัดมาร์กเกอร์ออกจากเนื้อหาที่แสดง', "${this.escapeHtml(sub.content || '(ไม่มีข้อความ)')}", s => replaceOnce(s, "${this.escapeHtml(sub.content || '(ไม่มีข้อความ)')}", "${this.escapeHtml(this._stripKalimbaMark(sub.content) || '(ไม่มีข้อความ)')}"), '_stripKalimbaMark(sub.content)');
  // ช่องคะแนน 2 จุด (การ์ดงาน + แถวล่วงหน้า): ป้าย + max/step/disabled
  if (o.text.indexOf('max="${taskMax}"') !== -1) log.push('  = ช่องคะแนนตามคะแนนเต็มจริง (มีอยู่แล้ว)');
  else {
    const lab = /คะแนน \(0-3\):/g, inp = /min="0" max="3" step="1" value="\$\{currentScore\}"/g;
    const nl = (o.text.match(lab) || []).length, ni = (o.text.match(inp) || []).length;
    if (nl !== 2 || ni !== 2) { failed++; log.push('  ✗ ช่องคะแนน: พบป้าย ' + nl + ' / ช่อง ' + ni + ' (ต้อง 2/2)'); }
    else {
      o.text = o.text.replace(lab, () => '${scoreLabelText}').replace(inp, () => 'min="0" max="${taskMax}" step="0.5" value="${currentScore}"${scoreDisabledAttr}');
      log.push('  ✓ ช่องคะแนน 2 จุด ใช้คะแนนเต็มจริง / ปิดในคาบสอบ-ไม่เก็บคะแนน');
    }
  }
  // 8) บันทึกคะแนน: แจ้งเตือนเมื่อถูกปฏิเสธ (ไม่ตัดค่าเงียบ)
  step(o, 'saveStudentFeedback ตรวจคะแนน', "    const scoreVal = scoreEl ? scoreEl.value : null;\n\n    Store.saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, scoreVal);\n",
    s => replaceOnce(s, "    const scoreVal = scoreEl ? scoreEl.value : null;\n\n    Store.saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, scoreVal);\n",
      "    const scoreVal = (scoreEl && !scoreEl.disabled) ? scoreEl.value : null;\n\n    Store.saveSubmissionTeacherFeedback(className, period, studentId, feedbackText, scoreVal);\n    const fr = Store._lastFeedbackResult || {};\n    if (fr.hasScore && !fr.ok) {\n      const why = { over_max: `คะแนนเกินคะแนนเต็มของคาบนี้ (เต็ม ${fr.max}) — บันทึกเฉพาะคำแนะนำ ยังไม่บันทึกคะแนน`, invalid: 'คะแนนไม่ถูกต้อง — บันทึกเฉพาะคำแนะนำ', exam_period: 'คาบสอบ: คะแนนมาจากระบบสอบ ไม่บันทึกด้วยมือ', no_score_period: 'คาบนี้ไม่เก็บคะแนน', save_failed: 'บันทึกคะแนนไม่สำเร็จ' };\n      alert('⚠️ ' + (why[fr.reason] || 'ไม่บันทึกคะแนน'));\n      this.renderSubmissionsTab();\n      return;\n    }\n"), 'const fr = Store._lastFeedbackResult');
});

// ---------------------------------------------------------------- index.html
file('app/index.html', o => {
  // 1) ตัวป้องกันเบราว์เซอร์เก่า (ES5) + polyfill ก่อนสคริปต์อื่น
  const guard = fs.readFileSync(path.join(HERE, '..', 'build', 'legacy_guard.html'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '\n');
  step(o, 'ตัวป้องกันเบราว์เซอร์เก่า + legacy-polyfills.js ใน <head>', '  <meta charset="UTF-8">\n',
    s => replaceOnce(s, '  <meta charset="UTF-8">\n', '  <meta charset="UTF-8">\n' + guard + '  <script src="js/legacy-polyfills.js?v=20261028_10"></script>\n'), 'ms-legacy-guard');
  // 2) สคริปต์ใหม่ทั้งหมด วางต่อจาก virtual-kalimba.js (ก่อน app.js)
  const re = /^([ \t]*)<script src="(js\/virtual-kalimba\.js)(\?[^"]*)?"([^>]*)><\/script>[ \t]*$/m;
  const add = ['data/kalimba_media.js', 'data/media_manifest.js', 'js/kalimba-devices.js', 'js/kalimba-notes.js', 'js/kalimba-practice.js', 'js/kalimba-media.js', 'js/kalimba-note-editor.js', 'js/period-media.js'];
  step(o, 'script tags (kalimba_media / notes / practice / editor / period-media)', re, s => s.replace(re, (all, ind, src, q, rest) =>
    all + '\n' + add.map(a => ind + '<script src="' + a + '?v=20261028_10"' + rest + '></script>').join('\n')), 'js/kalimba-note-editor.js');
});

// ---------------------------------------------------------------- sw.js
file('app/sw.js', o => {
  const v = /APP_VERSION\s*=\s*'v(\d+)'/.exec(o.text);
  const want = ['./js/legacy-polyfills.js', './data/kalimba_media.js', './data/media_manifest.js', './js/kalimba-devices.js', './js/kalimba-notes.js', './js/kalimba-practice.js', './js/kalimba-media.js', './js/kalimba-note-editor.js', './js/period-media.js', './js/ensemble-explorer.js'];
  const missing = want.filter(w => o.text.indexOf("'" + w + "'") === -1);
  if (!missing.length) { log.push('  = รายการแคชมีอยู่แล้ว'); return; }
  missing.forEach(w => { if (!fs.existsSync(path.join(ROOT, 'app', w.slice(2)))) log.push('  ! ยังไม่มีไฟล์ ' + w + ' ในโปรเจกต์ — ต้องคัดลอกมาก่อนใช้งาน (ไม่เช่นนั้นการติดตั้งออฟไลน์จะล้ม)'); });
  const lines = o.text.split('\n'); const idx = lines.findIndex(l => /'\.\/js\/virtual-kalimba\.js'/.test(l));
  if (idx < 0) { failed++; log.push('  ✗ ไม่พบ ./js/virtual-kalimba.js ในรายการแคช'); return; }
  if (!/,\s*$/.test(lines[idx])) { failed++; log.push('  ✗ บรรทัดแคชไม่ลงท้ายด้วย , — ตรวจด้วยมือ'); return; }
  lines.splice(idx + 1, 0, ...missing.map(w => "  '" + w + "',"));
  o.text = lines.join('\n');
  if (v) o.text = o.text.replace(/APP_VERSION\s*=\s*'v\d+'/, () => "APP_VERSION = 'v" + (Number(v[1]) + 1) + "'");
  log.push('  ✓ เพิ่มไฟล์ในแคชออฟไลน์ ' + missing.length + ' ไฟล์ (รวม ensemble-explorer.js)' + (v ? ' + bump v' + v[1] + '→v' + (Number(v[1]) + 1) : ''));
});

// ---------------------------------------------------------------- google-sheet-sync.js (CRLF)
file('app/js/google-sheet-sync.js', o => {
  const a = "content: String(subData.content || '').slice(0, 5000),";
  step(o, 'แนบเลขเครื่องในงานที่ส่งขึ้นเซิร์ฟเวอร์ (มาร์กเกอร์)', a, s => replaceOnce(s, a, "content: (typeof KalimbaDevices !== 'undefined' ? KalimbaDevices.tagContent(subData.content, className, period, studentId, 5000) : String(subData.content || '').slice(0, 5000)),"), 'KalimbaDevices.tagContent(subData.content');
});

// ---------------------------------------------------------------- fr5: store.js (ซิงค์โน้ตที่ครูใส่) 
file('app/data/store.js', o => {
  step(o, 'ซิงค์ ppk_kalimba_notes ไปกับ extendedAssessments', "      'ppk_kalimba_devices',\n", s => replaceOnce(s, "      'ppk_kalimba_devices',\n", "      'ppk_kalimba_devices',\n      'ppk_kalimba_notes',\n"), "'ppk_kalimba_notes'");
});

// ---------------------------------------------------------------- fr5: app.js (เส้นทางสื่อในแอป, สื่อเสียงรายคาบ, ข้อความตรงไปตรงมา)
file('app/js/app.js', o => {
  const routeMethods = [
    "  // เส้นทางสื่อ \"ในแอป\" (ไม่ใช่ไฟล์): ห้องสำรวจวงดนตรี / กระดานวิจารณ์ Feldman / รูบริก",
    "  isLessonMediaRoute(url) {",
    "    const u = String(url || '');",
    "    return /^ensemble\\/(thai|folk|western)$/i.test(u) || /^rubric\\//i.test(u) || /(^|\\/)timbre_feldman\\.html$/i.test(u);",
    "  },",
    "",
    "  openLessonMediaRoute(url, period) {",
    "    const u = String(url || '');",
    "    const em = /^ensemble\\/(thai|folk|western)$/i.exec(u);",
    "    if (em) {",
    "      if (typeof EnsembleExplorer !== 'undefined') EnsembleExplorer.openModal(em[1].toLowerCase());",
    "      else alert('ห้องสำรวจวงดนตรียังโหลดไม่เสร็จ ลองรีเฟรชหน้าแล้วเปิดใหม่');",
    "      return true;",
    "    }",
    "    if (/(^|\\/)timbre_feldman\\.html$/i.test(u)) {",
    "      if (typeof FeldmanCriticism !== 'undefined') FeldmanCriticism.openModal(Number(period) || 16);",
    "      return true;",
    "    }",
    "    if (/^rubric\\//i.test(u)) {",
    "      alert('รูบริกนี้ครูใช้ตอนให้คะแนน: เปิดจากปุ่ม 📊 ข้างชื่อนักเรียนในรายชื่อห้อง (เกณฑ์มาจาก วก.5 ของคาบนั้น)');",
    "      return true;",
    "    }",
    "    return false;",
    "  },",
    "",
    ""
  ].join('\n');
  const sig = '  openStudentMediaDoc(url, title, gradeKey = \'M1\', period = 1) {\n';
  step(o, 'เมธอดเส้นทางสื่อในแอป', sig, s => replaceOnce(s, sig, routeMethods + sig), 'isLessonMediaRoute(url) {');
  // นักเรียน: ลิงก์ที่กดแล้วเปิดได้จริง
  const sA = "        let itemHtml = '';\n        if (isAcademic) {\n";
  step(o, 'นักเรียน: ลิงก์ ensemble/ Feldman เปิดในแอปได้จริง', sA, s => replaceOnce(s, sA,
    "        let itemHtml = '';\n        if (this.isLessonMediaRoute(rawUrl) && /^rubric\\//i.test(rawUrl)) {\n          itemHtml = `<span style=\"font-weight: 600; color: #0369a1;\">📄 ${this.escapeHtml(m.title)}</span> <span style=\"font-size: 0.76rem; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; white-space: nowrap;\">เกณฑ์ที่ครูใช้ประเมิน</span>`;\n        } else if (this.isLessonMediaRoute(rawUrl)) {\n          itemHtml = `<a href=\"javascript:void(0)\" onclick=\"App.openLessonMediaRoute('${this.escapeHtml(rawUrl)}', ${p})\" style=\"color: #0369a1; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; text-decoration: none;\"><span>🎼 ${this.escapeHtml(m.title)}</span><span style=\"font-size: 0.76rem; background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; white-space: nowrap;\">เปิดในแอป</span></a>`;\n        } else if (isAcademic) {\n"), 'this.isLessonMediaRoute(rawUrl) && /^rubric');
  // ครู: ปุ่มสื่อ
  const tA = "      if (url.startsWith('academic/')) {\n        btn.href = 'javascript:void(0)';\n";
  step(o, 'ครู: ปุ่มสื่อ ensemble/ rubric/ Feldman เปิดในแอป', tA, s => replaceOnce(s, tA,
    "      if (this.isLessonMediaRoute(url)) {\n        btn.href = 'javascript:void(0)';\n        btn.onclick = (e) => { e.preventDefault(); App.openLessonMediaRoute(url, lesson.period); };\n      } else if (url.startsWith('academic/')) {\n        btn.href = 'javascript:void(0)';\n"), 'btn.onclick = (e) => { e.preventDefault(); App.openLessonMediaRoute(url');
  // ครู: คาบที่เปิดไฟล์ academic/media — ใช้คาบของบทเรียนนี้ ไม่เดาจากตัวเลขในชื่อไฟล์ (เช่น "3rds" → คาบ 3)
  const tB = "            const num = url.match(/ผ(\\d+)/) || url.match(/\\d+/);\n";
  step(o, 'ครู: เปิดเอกสารสื่อของคาบนี้ ไม่เดาคาบจากตัวเลขในชื่อไฟล์', tB, s => replaceOnce(s, tB, "            const num = url.match(/ผ(\\d+)/);\n"), "const num = url.match(/ผ(\\d+)/);\n            const period = num");
  // ข้อความตรงไปตรงมาเมื่อไม่มีไฟล์จริง
  const fA = "        <div style=\"margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;\">\n          <button class=\"btn-nav-action primary\" onclick=\"StudentPanels.close(); App.openMusicAidsModal();\">";
  step(o, 'แผงสำรอง: บอกตรงๆ ว่ายังไม่มีไฟล์ฉบับเต็ม', fA, s => replaceOnce(s, fA,
    "        <p style=\"background: #fff8e1; color: #795548; padding: 6px 8px; border-radius: 6px; font-size: 0.82rem;\">ℹ️ เอกสาร/ไฟล์ฉบับเต็มของรายการนี้ยังไม่ได้อัปโหลดเข้าแอป — ข้างบนเป็นเพียงสรุปหัวข้อของคาบ (ครูกำลังจัดเตรียม)</p>\n" + fA), 'เอกสาร/ไฟล์ฉบับเต็มของรายการนี้ยังไม่ได้อัปโหลดเข้าแอป');
  // สื่อเสียง/คลิปรายคาบ (นักเรียน + ครู)
  const pS = "if (typeof KalimbaMedia !== 'undefined') { try { KalimbaMedia.mountAll(lessonTextEl); } catch (e) { console.error('KalimbaMedia', e); } }\n";
  step(o, 'นักเรียน: ตัวเล่นสื่อเสียงรายคาบ (PeriodMedia)', pS, s => replaceOnce(s, pS, pS +
    "      if (typeof PeriodMedia !== 'undefined') { try { lessonTextEl.insertAdjacentHTML('beforeend', PeriodMedia.mountHTML(gradeKey, this.state.studentPeriod, { role: 'student' })); PeriodMedia.mountAll(lessonTextEl); } catch (e) { console.error('PeriodMedia', e); } }\n"), "PeriodMedia.mountHTML(gradeKey, this.state.studentPeriod");
  const pT = "      if (kmEl.innerHTML && typeof KalimbaMedia !== 'undefined') { try { KalimbaMedia.mountAll(kmEl); } catch (e) { console.error('KalimbaMedia', e); } }\n";
  step(o, 'ครู: สถานะสื่อเสียงรายคาบ (PeriodMedia)', pT, s => replaceOnce(s, pT, pT +
    "      if (typeof PeriodMedia !== 'undefined') { try { kmEl.insertAdjacentHTML('beforeend', PeriodMedia.mountHTML(this.state.grade, lesson.period, { role: 'teacher' })); PeriodMedia.mountAll(kmEl); } catch (e) { console.error('PeriodMedia', e); } }\n"), "PeriodMedia.mountHTML(this.state.grade, lesson.period");
});

// ---------------------------------------------------------------- fr5: virtual-kalimba.js (คำอธิบายเพลงฝึกอิสระ ไม่อ้างคาบที่ วก.5 ไม่ได้ระบุ)
file('app/js/virtual-kalimba.js', o => {
  const rx = /desc: '([^']*?)\s*คาบที่ [^']*'/g;
  const n = (o.text.match(rx) || []).length;
  if (n === 0) { log.push('  = คำอธิบายเพลงฝึก (ไม่มีคำว่า "คาบที่" แล้ว)'); return; }
  if (n !== 4) { failed++; log.push('  ✗ คำอธิบายเพลงฝึก: พบ ' + n + ' จุด (ต้อง 4)'); return; }
  o.text = o.text.replace(rx, (all, pre) => "desc: '" + pre.replace(/[\s,]+$/, '') + " (เพลงฝึกเล่นอิสระ — ไม่ได้อ้างอิงคาบใน วก.5; โน้ตประจำคาบดูที่หน้าบทเรียน)'");
  log.push('  ✓ ตัดคำอ้างคาบที่ วก.5 ไม่ได้ระบุ ออกจากคำอธิบายเพลงฝึก 4 เพลง (โน้ตเดิมไม่แตะ)');
});

// ---------------------------------------------------------------- fr5: aids ของคาบ (ผ่านตัวสร้าง ไม่แก้ lessons.js ด้วยมือ)
file('tools/curriculum/patch_lessons_m1.js', o => {
  const a = "  setv(l, 'topic', w.topic, tag);\n";
  step(o, 'patch_lessons: ใช้ aids จาก overrides', a, s => replaceOnce(s, a, a + "  if (OV.aids && OV.aids[String(p)]) setv(l, 'aids', OV.aids[String(p)], tag);\n"), 'OV.aids');
});
file('tools/curriculum/wk5_m1_overrides.json', o => {
  if (o.text.indexOf('"aids"') !== -1) { log.push('  = aids มีอยู่แล้ว'); return; }
  const re = /\n  \}\n\}\s*$/;
  if (!re.test(o.text)) { failed++; log.push('  ✗ รูปแบบท้ายไฟล์ JSON ไม่ตรง'); return; }
  o.text = o.text.replace(re, () => '\n  },\n  "aids": {\n    "_note": "คาบ 14 ตาม วก.5 = จำแนกวงดนตรีสากล จึงเปิดห้องสำรวจวงสากล (เดิมชี้ไปหมวดพื้นบ้านผิดคาบ)",\n    "14": ["ensemble:western"]\n  }\n}\n');
  log.push('  ✓ aids ของคาบ 14 → ensemble:western');
});

// ---------------------------------------------------------------- fr5: deploy.yml
file('.github/workflows/deploy.yml', o => {
  const a = "      - name: Upload artifact\n";
  step(o, 'deploy: สร้าง manifest สื่อ + แปลงไวยากรณ์สำหรับมือถือเก่า (เฉพาะ _site)', a, s => replaceOnce(s, a,
    "      - name: Legacy-browser transpile (only the deployed copy, source untouched)\n        run: |\n          npm i --no-save esbuild acorn\n          node tools/build/build_legacy.js _site\n\n" + a), 'build_legacy.js _site');
  const t = "          node tests/test_password_security.js\n";
  step(o, 'test: เทสต์ใหม่ของโน้ต/สื่อ/มือถือเก่า', t, s => replaceOnce(s, t, t + "          node tools/curriculum/build_kalimba_media.js --check\n          node tools/curriculum/build_period_media.js --check\n          node tests/test_kalimba_notes.js\n          node tests/test_kalimba_media.js\n          node tests/test_period_media.js\n"), 'build_period_media.js --check');
});

// ---------------------------------------------------------------- fr5: tests/test_student_guide_data.js (เมธอดช่วยที่อยู่นอกช่วงที่ดึงมาทดสอบ)
file('tests/test_student_guide_data.js', o => {
  const a = "[c])), ${methods} });";
  step(o, 'เทสต์คู่มือนักเรียน: จำลอง mediaStatusChipHTML', a, s => replaceOnce(s, a, "[c])), mediaStatusChipHTML: () => '', ${methods} });"), 'mediaStatusChipHTML: () =>');
});

console.log(log.join('\n'));
console.log(failed ? '\n✗ มี ' + failed + ' จุดที่ไม่สำเร็จ' + (DRY ? ' (dry-run)' : '') : '\n✓ ครบทุกจุด' + (DRY ? ' (dry-run: ยังไม่เขียนไฟล์)' : ''));
process.exit(failed ? 1 : 0);
