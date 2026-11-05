// ภาพหน้าจอ 360/1024: ครู P19 (ผลสังเกต), ครู P3 (เกณฑ์คาลิมบ้า), คลังหลักฐาน (ตั้งค่า + ฟอร์มคลิป), นักเรียน P18
const { PIN_A } = require('../tests/lib/test_pins');
const pw = require(process.env.PW_PATH || '/workspace/bt/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://localhost:8894', OUT = process.argv[3] || '/workspace/shots';
let fail = 0, pass = 0; const ck = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
(async () => {
  const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const w of [360, 1024]) {
    const p = await b.newPage({ viewport: { width: w, height: w === 360 ? 740 : 800 } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
    // นักเรียน P18
    await p.evaluate((pin) => { var cls = Store.getAllClasses('M1'), st = Store.getStudents(cls[0]); Store.registerStudentPin(st[0].student_id, pin); var a = document.getElementById('modal-auth-login'); if (a) a.classList.remove('active'); App.state.role = 'student'; App.selectStudentPeriod(18); }, PIN_A);
    await p.waitForTimeout(500);
    const st = await p.evaluate(() => document.getElementById('view-student').innerText);
    ck(!/กรณีศึกษา/.test(st) && /ประเมินรวมในคาบที่ 19|คาบที่ 19/.test(st), `${w}px นักเรียน P18: หัวข้อไม่มี "กรณีศึกษา" และบอกว่าประเมินรวมคาบ 19`);
    await p.screenshot({ path: `${OUT}/student_p18_${w}.png` });
    // ครู
    await p.evaluate(() => { Store.setCurrentUser({ role: 'teacher', name: 'ครูทดสอบ', username: 'teacher_test' }); App.state.role = 'teacher'; App.state.grade = 'M1'; App.enterCockpit(Store.getAllClasses('M1')[0], 1); });
    for (const per of [19, 3]) {
      await p.evaluate(per => { App.selectPeriod(per); const c = Store.getAllClasses('M1')[0]; const s = Store.getStudents(c)[0]; RubricMatrix.openScoringModal(s.student_id, per); }, per);
      await p.waitForTimeout(500);
      const t = await p.evaluate(() => { const m = document.getElementById('modal-rubric-scoring'); return { act: m.classList.contains('active'), txt: m.innerText, ow: m.scrollWidth - m.clientWidth, hasObs: !!m.querySelector('.rm-obs') }; });
      ck(t.act, `${w}px ครู P${per}: เปิดหน้าให้คะแนน`);
      if (per === 19) ck(t.hasObs && /ผลสังเกต|สังเกต/.test(t.txt), `${w}px ครู P19: มีช่องบันทึกผลสังเกต 2 เกณฑ์`);
      if (per === 3) ck(/ครูฟัง|ครูให้ระดับ|หลักฐานประกอบ \(ไม่ใช่คะแนน\)/.test(t.txt) && !/\bms\b|อัตโนมัติ/.test(t.txt), `${w}px ครู P3: เกณฑ์ใหม่ ไม่มี ms/อัตโนมัติ`);
      ck(t.ow <= 2, `${w}px ครู P${per}: ไม่ล้นแนวนอน (${t.ow})`);
      await p.screenshot({ path: `${OUT}/teacher_p${per}_${w}.png` });
      await p.evaluate(() => document.getElementById('modal-rubric-scoring').classList.remove('active'));
    }
    // คลังหลักฐาน
    for (const tab of ['items', 'settings']) {
      await p.evaluate(tab => { EvidenceHub.open(tab); }, tab); await p.waitForTimeout(400);
      const e = await p.evaluate(() => { const b = document.getElementById('eh-body'); return { txt: b.innerText + ' ' + [...b.querySelectorAll('input')].map(i => i.value).join(' '), ow: b.scrollWidth - b.clientWidth }; });
      if (tab === 'items') ck(/คลิป|ความยินยอม/.test(e.txt), `${w}px คลังหลักฐาน: ฟอร์มมีส่วนคลิป/ความยินยอม`);
      if (tab === 'settings') ck(/โครงการพัฒนาวิชาการของโรงเรียน/.test(e.txt) && /9, 10, 13, 15, 19|9.*10.*13.*15.*19/.test(e.txt), `${w}px คลังหลักฐาน: ตั้งค่าชื่อโครงการเริ่มต้นกลาง + ช่วงคาบคลิป`);
      ck(e.ow <= 2, `${w}px คลังหลักฐาน ${tab}: ไม่ล้นแนวนอน (${e.ow})`);
      await p.screenshot({ path: `${OUT}/evidence_${tab}_${w}.png` });
    }
    ck(errs.length === 0, `${w}px ไม่มี JS error ${JSON.stringify(errs).slice(0, 200)}`);
    await p.close();
  }
  await b.close(); console.log(`t88 shots: pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0);
})();
