// รันบนเครื่องที่มี Chrome + playwright-core:  node tools/headless_evidence_ui.js http://localhost:8894 /out/dir
// ตรวจศูนย์หลักฐาน คศ.4 ที่ 360px: เปิดครบทุกแท็บ, ไม่มี error, ไม่มีการล้นแนวนอน, ฟอร์มบันทึกจริง
const path = require('path');
const pw = require(process.env.PW_PATH || '/workspace/bt/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://localhost:8894', OUT = process.argv[3] || '/tmp/ev_shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; let fail = 0;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  const ck = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
  // ครู + ข้อมูลระดับ (จากฟังก์ชัน Store จริง) บนห้องแรกของ ม.1
  const seeded = await p.evaluate(() => {
    Store.setCurrentUser({ role: 'teacher', name: 'ครูทดสอบ', username: 'teacher_test' });
    var cl = Store.getAllClasses('M1')[0], g = Store.gradeKeyOf(cl), st = Store.getStudents(cl).slice(0, 20), pre = [1, 2, 2, 1, 3, 2], post = [3, 3, 4, 2, 4, 3];
    st.forEach(function (s, i) { var a = pre[i % 6], z = post[i % 6]; Store.saveStudentRubric(s.student_id, 3, Store.buildRubricRecord(g, 3, { K: a, P: a, A: a }), cl); Store.saveStudentRubric(s.student_id, 9, Store.buildRubricRecord(g, 9, { K: z, P: z, A: z }), cl); });
    return { cl: cl, n: st.length };
  });
  console.log('seed', JSON.stringify(seeded));
  await p.evaluate(() => { var m = document.getElementById('modal-auth-login'); if (m) m.classList.remove('active'); });
  const sunk = []; await p.evaluate(() => { window.__sunk = []; EvidenceHub.sink = function (n, m, c) { window.__sunk.push({ n: n, m: m, len: (c.length || 0) }); }; });
  // ปุ่มในเมนูเครื่องมือ
  ck(await p.evaluate(() => !!document.getElementById('btn-evidence-hub')), 'มีปุ่ม "ศูนย์หลักฐาน คศ.4" ในเมนูเครื่องมือ');
  await p.evaluate(() => EvidenceHub.open('board')); await p.waitForTimeout(400);
  const overflow = async (label) => {
    const r = await p.evaluate(() => { var card = document.querySelector('#modal-evidence-hub .eh-card'), body = document.getElementById('eh-body'); var bad = []; Array.prototype.forEach.call(card.querySelectorAll('*'), function (el) { var r = el.getBoundingClientRect(); if (r.width && (r.right > card.getBoundingClientRect().right + 1) && !el.closest('.eh-tw') && !el.closest('.eh-tabs')) bad.push(el.tagName + '.' + (el.className || '') + ':' + Math.round(r.right)); }); return { docW: document.documentElement.scrollWidth, cardW: Math.round(card.getBoundingClientRect().width), bodySW: body.scrollWidth, bodyCW: body.clientWidth, bad: bad.slice(0, 5) }; });
    ck(r.docW <= 360 && r.bodySW <= r.bodyCW + 1 && r.bad.length === 0, label + ' ไม่ล้นแนวนอน ' + JSON.stringify(r));
  };
  const tabs = ['board', 'items', 'outcome', 'dossier', 'research', 'settings'];
  for (const t of tabs) {
    await p.evaluate(t => EvidenceHub.go(t), t); await p.waitForTimeout(250);
    await overflow('แท็บ ' + t);
    await p.screenshot({ path: path.join(OUT, 'eh_360_' + t + '.png') });
  }
  // เพิ่มหลักฐานผ่านฟอร์ม
  await p.evaluate(() => EvidenceHub.go('items'));
  await p.fill('#eh-title', 'วก.5 ม.1 ฉบับล่าสุด'); await p.check('input[name="eh-pw"][value="outcome"]'); await p.fill('#eh-source', 'ไฟล์ของครู');
  await p.click('#eh-form button[type=submit]'); await p.waitForTimeout(300);
  ck(await p.evaluate(() => EvidenceHub.getItems().length === 1 && /บันทึกหลักฐานแล้ว/.test(document.getElementById('eh-body').textContent)), 'ฟอร์มบันทึกหลักฐานได้');
  await p.fill('#eh-title', 'ไม่เลือกเส้นทาง'); await p.fill('#eh-source', 'x'); await p.click('#eh-form button[type=submit]'); await p.waitForTimeout(300);
  ck(await p.evaluate(() => EvidenceHub.getItems().length === 1 && /⚠/.test(document.getElementById('eh-body').textContent)), 'ไม่เลือกเส้นทาง → แจ้งเตือน ไม่บันทึก');
  await p.screenshot({ path: path.join(OUT, 'eh_360_items_warn.png') });
  // ผลสัมฤทธิ์: มีตาราง/กราฟ และข้อความระบุเกณฑ์
  await p.evaluate(c => { EvidenceHub.state.className = c; EvidenceHub.go('outcome'); }, seeded.cl); await p.waitForTimeout(300);
  const txt = await p.evaluate(() => document.getElementById('eh-body').textContent);
  ck(/คาบ 3/.test(txt) && /คาบ 9/.test(txt) && /60/.test(txt), 'หน้าผลสัมฤทธิ์ระบุคาบก่อน/หลัง + เกณฑ์ 60%');
  ck(await p.evaluate(() => document.querySelectorAll('#eh-body svg').length >= 1 && document.querySelectorAll('#eh-body .eh-tw table').length >= 1), 'มีกราฟ SVG และตาราง');
  await overflow('ผลสัมฤทธิ์(มีข้อมูล)'); await p.screenshot({ path: path.join(OUT, 'eh_360_outcome_data.png'), fullPage: false });
  await p.evaluate(() => { var b = document.getElementById('eh-body'); b.scrollTop = b.scrollHeight; }); await p.screenshot({ path: path.join(OUT, 'eh_360_outcome_data_bottom.png') });
  // วิจัย: เพิ่มคำตอบแบบสอบถาม
  await p.evaluate(() => EvidenceHub.go('research')); await p.waitForTimeout(250);
  await p.fill('#eh-qin', '5 4 4 5 4 4 5 4 4 | ชอบมาก\n3 3 4 3 4 3 3 4 3\n9 9 9'); await p.evaluate(() => EvidenceHub.addResponses()); await p.waitForTimeout(250);
  ck(await p.evaluate(() => EvidenceHub.getResponses().length === 2 && /ข้ามบรรทัด/.test(document.getElementById('eh-body').textContent)), 'เพิ่มคำตอบ 2 บรรทัดที่ถูก ข้ามบรรทัดผิด');
  await overflow('วิจัย(มีคำตอบ)'); await p.screenshot({ path: path.join(OUT, 'eh_360_research_data.png') });
  // ส่งออกผ่านปุ่ม
  await p.evaluate(() => { EvidenceHub.state.className = EvidenceHub.state.className; EvidenceHub.downloadBundle('') });
  ck(await p.evaluate(() => window.__sunk.some(s => /\.zip$/.test(s.n) && s.len > 500)), 'ปุ่มชุดส่งออก ZIP ทำงาน');
  // dossier
  await p.evaluate(() => EvidenceHub.go('dossier')); await p.waitForTimeout(250); await overflow('เอกสารนวัตกรรม'); await p.screenshot({ path: path.join(OUT, 'eh_360_dossier_data.png') });
  // ปิดหน้าต่าง + นักเรียนเข้าไม่ได้
  await p.evaluate(() => EvidenceHub.close()); ck(await p.evaluate(() => !document.getElementById('modal-evidence-hub').classList.contains('active')), 'ปิดหน้าต่างได้');
  await p.evaluate(() => { Store.setCurrentUser({ role: 'student', name: 'x', username: 'x' }); });
  ck(await p.evaluate(() => EvidenceHub.open() === false && !document.getElementById('modal-evidence-hub').classList.contains('active')), 'นักเรียนเปิดไม่ได้');
  ck(errs.length === 0, 'ไม่มี JS error ' + JSON.stringify(errs.slice(0, 3)));
  await b.close(); console.log(fail ? 'FAILED ' + fail : 'ALL UI CHECKS PASSED'); process.exit(fail ? 1 : 0);
})();
