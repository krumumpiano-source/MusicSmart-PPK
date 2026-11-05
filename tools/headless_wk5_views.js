// รัน: node tools/headless_wk5_views.js http://localhost:8894 [out.json]
// ตรวจ "สองทิศทาง" ทั้ง 20 คาบ × 3 มุมมอง (นักเรียน / ครู / ครูฝึก) ว่าเครื่องมือ ป้ายคะแนน สื่อ ตรงกับ วก.5:
//   ✔ คาบที่ วก.5 ใช้คาลิมบ้า → ต้องมีปุ่ม/ช่องหมายเลขเครื่อง ·  ✘ คาบที่ไม่ใช้ → ต้องไม่มีเลยในทุกมุมมอง
const { PIN_A } = require('../tests/lib/test_pins');
const pw = require(process.env.PW_PATH || '/workspace/bt/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://localhost:8894', OUTJ = process.argv[3] || '/tmp/wk5_views.json';
let fail = 0, pass = 0; const ck = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
  const rep = { student: [], teacher: [], intern: [] };
  // ---------- นักเรียน ----------
  await p.evaluate((pin) => { var cls = Store.getAllClasses('M1'), st = Store.getStudents(cls[0]); Store.registerStudentPin(st[0].student_id, pin); var a = document.getElementById('modal-auth-login'); if (a) a.classList.remove('active'); App.switchRole('student', false); }, PIN_A);
  for (let per = 1; per <= 20; per++) {
    await p.evaluate(per => { App.state.role = 'student'; App.selectStudentPeriod(per); }, per); await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const per = App.state.studentPeriod, g = Store.gradeKeyOf(App.state.studentClass), vis = e => e && e.offsetParent !== null;
      const tl = PeriodPolicy.tools(g, per), lb = PeriodPolicy.labels(g, per), v = document.getElementById('view-student');
      const tools = {}; ['metronome', 'kalimba', 'notation'].forEach(t => { tools[t] = [...document.querySelectorAll('[data-tool="' + t + '"]')].filter(vis).length; });
      const media = [...v.querySelectorAll('audio,video')].map(e => e.getAttribute('src') || '');
      return { per, tl, kal: KalimbaMedia.hasKalimba(g, per), lb, tools, gt: !!document.getElementById('student-group-task'), txt: v.innerText, devField: [...v.querySelectorAll('[data-role="dev"]')].filter(vis).length,
        chip: (document.getElementById('student-submission-status-chip') || {}).innerText || '', max: (document.getElementById('student-assignment-max-score') || {}).innerText || '', media };
    });
    ck(per === 18 ? r.gt : !r.gt, `นักเรียน P${per}: กล่อง "งานค้นคว้ากลุ่ม · หน้าที่ของฉัน" ${per === 18 ? 'ต้องมี' : 'ต้องไม่มี'}`);
    for (const t of ['metronome', 'kalimba', 'notation']) ck(r.tl[t] ? r.tools[t] > 0 : r.tools[t] === 0, `นักเรียน P${per}: ปุ่ม ${t} ${r.tl[t] ? 'ต้องมี' : 'ต้องไม่มี'} (พบ ${r.tools[t]})`);
    ck(r.tl.kalimba === r.kal, `นักเรียน P${per}: tools.kalimba ตรง hasKalimba`);
    ck(r.kal ? true : r.devField === 0, `นักเรียน P${per}: ช่องหมายเลขเครื่องต้องไม่มีในคาบที่ไม่ใช้คาลิมบ้า`);
    if (!r.kal) for (const w of ['ซ้อมคาลิมบ้า', 'Virtual Kalimba', 'สื่อโน้ตสากล', 'ผังคาลิมบ้า', 'หมายเลขเครื่องคาลิมบ้า']) ck(!r.txt.includes(w), `นักเรียน P${per}: ต้องไม่มีข้อความ "${w}"`);
    if (!r.tl.metronome) ck(!/เมโทรนอม/.test(r.txt), `นักเรียน P${per}: ต้องไม่มีเมโทรนอม`);
    ck(!/คาบฝึกทักษะ/.test(r.chip + r.max + r.txt), `นักเรียน P${per}: ไม่มีป้าย "คาบฝึกทักษะ"`);
    ck(!/ยังไม่มีไฟล์|รอครูอัปโหลด|ยังไม่มีสื่อ|☐|ต้องเตรียม \(|ต้องเตรียม:|ครูต้องยืนยัน/.test(r.txt), `นักเรียน P${per}: ไม่มีข้อความไฟล์หาย/เช็กลิสต์ครู`);
    ck(r.media.every(s => s && !/^undefined|null$/.test(s)), `นักเรียน P${per}: ทุก <audio>/<video> มี src`);
    ck(!/ปฏิทินงาน|ความก้าวหน้าของฉัน|เครื่องมือเสริมประจำหน่วย/.test(r.txt), `นักเรียน P${per}: ไม่มีแถบปฏิทิน/เครื่องมือเสริมที่ไม่มีใน วก.5`);
    if (r.lb.kind === 'exam') ck(!/^คะแนนเต็ม/.test(r.max) && /สอบ/.test(r.max), `นักเรียน P${per}: คาบสอบแสดงป้ายสอบ ไม่ใช่คะแนนเต็มงาน (${r.max})`);
    if (r.lb.kind === 'scored') ck(/คะแนนเต็ม: \d+/.test(r.max), `นักเรียน P${per}: คาบเก็บคะแนนแสดงคะแนนเต็ม`);
    if (r.lb.kind === 'none') ck(r.chip.trim() === '' && !/ยังไม่ได้ส่งงาน/.test(r.chip), `นักเรียน P${per}: คาบไม่มีงานไม่มีป้ายสถานะส่งงาน`);
    ck(!/ยังไม่ได้ส่งงาน|ส่งคำตอบ/.test(r.lb.kind === 'exam' ? r.chip : ''), `นักเรียน P${per}: คาบสอบไม่มีป้ายส่งงาน`);
    ck(!/ครูต้องยืนยัน|สัดส่วน/.test(r.txt) || per !== 19, `นักเรียน P${per}: ไม่เห็นสัดส่วนที่ครูยังต้องยืนยัน`);
    rep.student.push({ per, tools: r.tools, max: r.max, chip: r.chip.trim(), kal: r.kal, devField: r.devField });
  }
  // ---------- นักเรียน P18: เห็นกลุ่ม/หน้าที่/งานที่ต้องค้นคว้า และส่งข้อความหรือลิงก์ได้ ----------
  await p.evaluate(() => { App.state.role = 'student'; App.selectStudentPeriod(18); }); await p.waitForTimeout(300);
  const gt = await p.evaluate(() => {
    const q = id => document.getElementById(id), box = q('student-group-task');
    const o = { groups: q('gt-group').options.length - 1, roles: q('gt-role').options.length - 1, roleNames: [...q('gt-role').options].slice(1).map(x => x.text), emptyMsg: q('gt-out').innerText };
    q('gt-group').value = '3'; q('gt-group').dispatchEvent(new Event('change')); q('gt-role').value = '2'; q('gt-role').dispatchEvent(new Event('change'));
    o.out = q('gt-out').innerText; o.dim3 = MediaViews._internals.influenceDims(18)[2];
    q('student-submission-text').value = 'ผลค้นคว้า: ตัวอย่าง';
    const btn = q('gt-out').querySelector('button'); o.hasBtn = !!btn; if (btn) btn.click();
    o.filled = q('student-submission-text').value; o.url = !!q('student-submission-url') && q('student-submission-url').offsetParent !== null; o.txtBox = q('student-submission-text').offsetParent !== null;
    return o;
  });
  ck(gt.groups === 5 && gt.roles === 8, 'นักเรียน P18: เลือกได้ 5 กลุ่ม / 8 หน้าที่ (ตาม วก.5)');
  ck(gt.roleNames[0] === 'ผู้อำนวยการแคมเปญ' && gt.roleNames[7].indexOf('โฆษกสรุปผล') >= 0 && !/^และ/.test(gt.roleNames[7]), 'นักเรียน P18: ชื่อหน้าที่ตรง วก.5 · ' + gt.roleNames.join('|'));
  ck(gt.out.indexOf(gt.dim3) >= 0 && gt.out.indexOf(gt.roleNames[1]) >= 0 && /งานที่ต้องค้นคว้า/.test(gt.out), 'นักเรียน P18: เลือกกลุ่ม 3 หน้าที่ 2 แล้วเห็นมิติ+หน้าที่+งานที่ต้องค้นคว้า');
  ck(/^\[กลุ่มที่ 3 · มิติ: /.test(gt.filled) && gt.filled.indexOf('ผลค้นคว้า: ตัวอย่าง') > 0, 'นักเรียน P18: ปุ่มใส่หัวข้อกลุ่มลงช่องคำตอบ (ไม่ทับข้อความเดิม)');
  ck(gt.txtBox && gt.url, 'นักเรียน P18: ส่งเป็นข้อความหรือลิงก์ได้ (ช่องข้อความ + ช่องลิงก์ มองเห็น)');
  await p.screenshot({ path: process.env.SHOT18 || '/tmp/p18_student_group.png', fullPage: false });
  // ---------- ครู / ครูฝึก ----------
  for (const role of ['teacher', 'intern']) {
    await p.evaluate(role => { Store.setCurrentUser({ role: role, name: 'ครูทดสอบ', username: 'teacher_test' }); const a = document.getElementById('modal-auth-login'); if (a) a.classList.remove('active'); App.state.role = role; App.state.grade = 'M1'; App.enterCockpit(Store.getAllClasses('M1')[0], 1); }, role);
    for (let per = 1; per <= 20; per++) {
      await p.evaluate(per => { App.selectPeriod(per); }, per); await p.waitForTimeout(150);
      const r = await p.evaluate(() => {
        const per = App.state.selectedPeriod, g = App.state.grade, W = WK5_PLANS[g][per], vis = e => e && e.offsetParent !== null;
        const card = document.querySelector('[data-tool-scope="lesson"]'), tl = PeriodPolicy.tools(g, per);
        const steps = document.getElementById('steps-timeline').innerText, kpa = ['kpa-k', 'kpa-p', 'kpa-a'].map(i => document.getElementById(i).innerText).join('\n');
        const nz = s => String(s).replace(/\s+/g, ''), wtxt = nz(PeriodPolicy.flat(W));
        const stepLines = steps.split('\n').map(s => s.trim()).filter(s => s && !/^\d+ นาที$/.test(s));
        const bad = stepLines.filter(s => !wtxt.includes(nz(s.replace(/\s*\(\d+ นาที\)$/, '').replace(/^\[|\]$/g, '')))).filter(s => !wtxt.includes(nz(s.replace(/^\d+\.\s*/, ''))));
        const todo = [...document.querySelectorAll('[data-pm-todo],[data-mv-todo]')].map(e => e.parentElement.innerText + '|' + e.innerText);
        const mvOpen = [...document.querySelectorAll('.mv-open')].map(e => e.innerText.trim());
        return { per, tl, mvOpen, notationVisible: vis(card), bad, hasConfirm: !!document.getElementById('wk5-confirm-box'), confirmTxt: (document.getElementById('wk5-confirm-box') || {}).innerText || '', todo, topic: document.getElementById('lesson-topic').innerText,
          tipsVisible: vis(document.getElementById('mentor-tips-container')), kpaOk: nz(kpa).length > 10, steps };
      });
      ck(r.tl.notation ? r.notationVisible : !r.notationVisible, `${role} P${per}: การ์ดสื่อโน้ต/ผังคาลิมบ้า ${r.tl.notation ? 'ต้องมี' : 'ต้องไม่มี'}`);
      ck(r.bad.length === 0, `${role} P${per}: ทุกบรรทัดในการ์ดมาจาก วก.5 (ผิด: ${r.bad.slice(0, 2).join(' / ').slice(0, 120)})`);
      ck(!r.tipsVisible, `${role} P${per}: ไม่มีกล่อง "ข้อเสนอแนะ" ที่ไม่ได้มาจาก วก.5`);
      ck(r.topic.includes(String(per)), `${role} P${per}: หัวข้อคาบ`);
      if (per === 13) ck(r.hasConfirm && /ครูต้องยืนยัน/.test(r.confirmTxt), `${role} P${per}: มี "ครูต้องยืนยัน" สัดส่วนคะแนน 2 แบบ`);
      if (per === 19) ck(!r.hasConfirm, `${role} P${per}: ครูตัดสินแล้ว (ตารางคะแนน K2/P5/A3) ไม่ต้องมีกล่อง "ครูต้องยืนยัน"`);
      if (per !== 13 && per !== 19) ck(!r.hasConfirm, `${role} P${per}: ไม่มี "ครูต้องยืนยัน" (ไม่มีข้อขัดแย้ง)`);
      rep[role].push({ per, notation: r.notationVisible, todo: r.todo, mvOpen: r.mvOpen, confirm: r.hasConfirm });
    }
  }
  const t18 = rep.teacher.find(x => x.per === 18).todo.join('\n');
  ck(t18.trim() === '' && !/p18_case/.test(t18), 'ครู P18: ไม่มีรายการ "ต้องเตรียม" ค้าง (คลิปเดิมถูกแทนด้วยงานค้นคว้ากลุ่ม + แผนภาพในแอป)');
  ck(rep.teacher.find(x => x.per === 18).mvOpen.some(s => /แผนภาพ 5 มิติ/.test(s)), 'ครู P18: สื่อ "แผนภาพ 5 มิติ" เปิดได้ในแอป');
  const tg = await p.evaluate(() => { const h = MediaViews._internals.groupTeacherHTML(18), d = document.createElement('div'); d.innerHTML = h; const n = (per) => MediaViews.hasGroupTask(per); return { txt: d.innerText || d.textContent, rows: d.querySelectorAll('tr').length, other: [1, 5, 17, 19, 20].some(n), self: n(18) }; });
  ck(/กลุ่ม ↔ มิติ/.test(tg.txt) && /รอครูยืนยัน/.test(tg.txt) && tg.rows >= 5 && /ผู้อำนวยการแคมเปญ/.test(tg.txt), 'ครู P18: ตารางกลุ่ม↔มิติ + 8 บทบาท + ป้ายรอครูยืนยัน');
  ck(tg.self && !tg.other, 'MediaViews.hasGroupTask: จริงเฉพาะคาบ 18');
  ck(rep.student.find(x => x.per === 18).tools.kalimba === 0 && rep.student.find(x => x.per === 18).devField === 0, 'นักเรียน P18: ไม่มีคาลิมบ้า/ช่องหมายเลขเครื่อง');
  ck(errs.length === 0, 'ไม่มี JS error: ' + errs.slice(0, 2).join(' | '));
  require('fs').writeFileSync(OUTJ, JSON.stringify(rep, null, 1));
  console.log(`headless wk5 views: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
})();
