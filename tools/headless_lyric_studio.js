// รัน: node tools/local_server.js 8931 &  แล้ว  node tools/headless_lyric_studio.js http://localhost:8931 /tmp/shots_lyric
// ตรวจหน้าจอจริง "เนื้อร้องใต้โน้ต + โหวตกลุ่ม" ที่ 360px และ 1024px (นักเรียน/ครู) บน Apps Script จำลองในเครื่อง
// ข้อมูลทดสอบเป็นรายชื่อสมมติ (รหัส 91001–91040) และข้อความ "ทดสอบN" เท่านั้น — ไม่ใช่เนื้อเพลงจริง
const pw = require(process.env.PW_PATH || '/workspace/bt/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8931', OUT = process.argv[3] || '/tmp/shots_lyric';
fs.mkdirSync(OUT, { recursive: true });
let fail = 0, pass = 0; const ck = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const VPS = [360, 1024];
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 360, height: 800 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(1200);
  // ---- ตั้งรายชื่อสมมติ 40 คน + PIN ----
  const setup = await p.evaluate(async () => {
    const T = 'LOCAL-PREVIEW-TOKEN', roster = [];
    for (let i = 1; i <= 40; i++) roster.push({ student_id: String(91000 + i), prefix: 'ด.ช.', first_name: 'สมมติ' + i, last_name: 'ทดสอบ', nickname: 'น' + i, class: 'ม.1/1', no: i });
    const r1 = await StudentAuth._post({ action: 'upload_roster', token: T, students: roster, replace: true });
    window.__tok = {};
    for (const id of ['91001', '91006', '91011', '91016']) { const r = await StudentAuth._post({ action: 'studentSetPin', studentId: id, pin: '246810' }); window.__tok[id] = r.sessionToken; }
    return { up: r1.status, srv: StudentAuth.isServerMode(), toks: Object.keys(window.__tok).filter(k => window.__tok[k]).length };
  });
  ck(setup.up === 'success' && setup.srv && setup.toks === 4, 'setup ' + JSON.stringify(setup));
  const api = (o, t) => p.evaluate(async ([o, t]) => StudentAuth._post(Object.assign({}, o, t ? { sessionToken: window.__tok[t] } : { token: 'LOCAL-PREVIEW-TOKEN' })), [o, t]);
  const teacher = patch => api({ action: 'lyric_teacher_set', className: 'ม.1/1', songKey: 'ode_to_joy', patch });
  const fill = (id, tag) => api({ action: 'studentLyricSave', songKey: 'ode_to_joy', cells: new Array(30).fill(0).map((_, i) => 'ทดสอบ' + tag + (i + 1)) }, id);
  const asStudent = async (id, per) => {
    await p.evaluate(async ([id, per]) => { const r = await StudentAuth.login(id, '246810'); if (!r.success) throw new Error('login ' + JSON.stringify(r)); document.getElementById('modal-auth-login').classList.remove('active'); App.switchRole('student', false); App.selectStudentPeriod(per); }, [id, per]);
    await p.waitForSelector('#student-lyric-studio .ls-wrap[data-ls] , #student-lyric-studio .ls-wrap[aria-busy=false]', { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(500);
  };
  const noYellow = () => p.evaluate(() => {
    const bad = []; document.querySelectorAll('#student-lyric-studio *, #lyric-teacher-panel *').forEach(e => {
      const cs = getComputedStyle(e); [cs.backgroundColor, cs.color, cs.borderTopColor].forEach(c => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); if (m && (m[4] === undefined || +m[4] > 0.05)) { const r = +m[1], g = +m[2], bl = +m[3]; if (r > 200 && g > 140 && bl < 130 && r - bl > 90) bad.push(e.className + ':' + c); } });
    }); return bad;
  });
  const check = async (sel, name, tag) => {
    for (const w of VPS) {
      await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(250);
      const m = await p.evaluate(sel => {
        const h = document.querySelector(sel); if (!h) return null;
        const btns = [...h.querySelectorAll('button:not([disabled]),input.ls-in')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height);
        const cols = {}; h.querySelectorAll('.ls-grid').forEach(g => { const tops = {}; [...g.children].forEach(c => { const t = Math.round(c.getBoundingClientRect().top); tops[t] = (tops[t] || 0) + 1; }); cols.first = Math.max.apply(null, Object.values(tops)); });
        const stu = sel.indexOf('student') >= 0; return { over: Math.max(h.scrollWidth - h.clientWidth, stu ? document.documentElement.scrollWidth - innerWidth : 0), minH: btns.length ? Math.min.apply(null, btns) : 99, cols: cols.first || 0, ins: h.querySelectorAll('input.ls-in').length, txt: h.innerText };
      }, sel);
      ck(!!m, `${name}@${w}: มี ${sel}`); if (!m) continue;
      ck(m.over <= 1, `${name}@${w}: ไม่ล้นแนวนอน (${m.over}; หน้านักเรียนทั้งหน้า / แผงครูเฉพาะแผง)`);
      ck(m.minH >= 40, `${name}@${w}: ปุ่ม/ช่องกดง่าย ≥40px (${m.minH})`);
      const y = await noYellow(); ck(y.length === 0, `${name}@${w}: ไม่มีสีเหลือง ${y.slice(0, 3)}`);
      ck(!/undefined|NaN|\[object/.test(m.txt), `${name}@${w}: ไม่มี undefined/NaN`);
      await p.evaluate(sel => { const h = document.querySelector(sel); document.querySelectorAll('body *').forEach(e => { if (h.contains(e) || e.contains(h)) return; const pos = getComputedStyle(e).position; if (pos === 'sticky' || pos === 'fixed') e.style.visibility = 'hidden'; }); }, sel);   // ซ่อนแถบลอยเฉพาะตอนถ่ายภาพ
      await (await p.$(sel)).screenshot({ path: `${OUT}/${name}_${w}.png` });
      if (tag) tag(m, w);
    }
  };
  // ---- 1) นักเรียน คาบ 8 ช่วงแต่ง ----
  await asStudent('91001', 8);
  await check('#student-lyric-studio', 's1_writing_p8', (m, w) => { ck(m.ins === 30, `P8 เพลงโอเด: ช่องเนื้อ 30 ช่อง (${m.ins})`); ck(w === 360 ? m.cols >= 3 : m.cols >= 6, `grid คอลัมน์ @${w} = ${m.cols}`); });
  const maxlen = await p.evaluate(() => [...document.querySelectorAll('#student-lyric-studio input.ls-in')].every(i => i.maxLength === 12));
  ck(maxlen, 'ทุกช่อง maxlength=12');
  // พิมพ์ผ่าน UI + บันทึก
  await p.fill('#student-lyric-studio input[data-cell="0"]', 'ทดสอบยาวเกินสิบสองตัวอักษรแน่นอน');
  const v0 = await p.inputValue('#student-lyric-studio input[data-cell="0"]');
  ck(v0.length <= 12, 'พิมพ์เกิน 12 ตัวถูกตัด (' + v0.length + ')');
  for (let i = 1; i < 30; i++) await p.fill(`#student-lyric-studio input[data-cell="${i}"]`, 'ทดสอบ' + (i + 1));
  await p.click('#student-lyric-studio [data-act=save]'); await p.waitForTimeout(700);
  const msg = await p.innerText('#student-lyric-studio .ls-msg.ok').catch(() => '');
  ck(/บันทึกแล้ว/.test(msg), 'บันทึกสำเร็จ: ' + msg);
  await check('#student-lyric-studio', 's2_saved_p8');
  // ---- 2) เพื่อนในกลุ่มบันทึก + ครูเปิดโหวต ----
  await fill('91006', 'ข'); await fill('91011', 'ค');
  await asStudent('91001', 8);
  let t = await p.innerText('#student-lyric-studio'); ck(!/ทดสอบข1/.test(t) && !/ทดสอบค1/.test(t), 'ช่วงแต่ง: ไม่เห็นเนื้อของเพื่อน');
  await teacher({ phase: 'voting' });
  await asStudent('91001', 8);
  await check('#student-lyric-studio', 's3_voting_p8', m => { ck(/เนื้อของ .*\(ฉัน\)/.test(m.txt), 'เห็นเนื้อของตัวเองในรายการ');  });
  const selfDis = await p.evaluate(() => { const b = [...document.querySelectorAll('#student-lyric-studio [data-act=vote]')]; return { n: b.length, dis: b.filter(x => x.disabled).length }; });
  ck(selfDis.n === 3 && selfDis.dis === 1, 'โหวต: 3 ผู้สมัคร และปุ่มโหวตตัวเองถูกปิด ' + JSON.stringify(selfDis));
  ck(/โหวตตัวเองไม่ได้/.test(await p.innerText('#student-lyric-studio')) && !/รอครูยืนยัน/.test(await p.innerText('#student-lyric-studio')), 'ป้าย "โหวตตัวเองไม่ได้" แสดง และไม่มีป้าย "รอครูยืนยัน" (ครูตัดสินแล้ว)');
  await p.click('#student-lyric-studio [data-act=vote]:not([disabled])'); await p.waitForTimeout(700);
  ck(/โหวตเนื้อนี้แล้ว/.test(await p.innerText('#student-lyric-studio')), 'โหวตแล้วแสดง ✓');
  await check('#student-lyric-studio', 's4_voted_p8', m => { ck(!/ผู้โหวต/.test(m.txt), 'นักเรียนไม่เห็นรายชื่อผู้โหวต'); });
  // ---- 3) ครู: ภาพรวม ----
  await api({ action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91006' }, '91006').then(r => ck(r.status === 'error' || r.status === 'success', 'vote 91006'));
  await api({ action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91011' }, '91011');
  await p.evaluate(() => { Store.setCurrentUser({ role: 'teacher', name: 'ครูทดสอบ', username: 'teacher_test' }); App.state.role = 'teacher'; App.state.grade = 'M1'; App.state.selectedClass = 'ม.1/1'; App.enterCockpit('ม.1/1', 8); });
  await p.waitForSelector('#lyric-teacher-panel .ls-wrap[data-ls=teacher]', { timeout: 8000 }).catch(() => {});
  ck(await p.$('#lyric-teacher-panel .ls-wrap[data-ls=teacher]') !== null, 'ครู P8: มีแผงเนื้อร้อง');
  await check('#lyric-teacher-panel', 't1_overview_voting_p8', m => { ck(/กลุ่ม 1/.test(m.txt) && /ผู้โหวต/.test(m.txt), 'ครูเห็นกลุ่ม 1 + ผู้โหวต'); });
  // ครูปิดโหวต → เสมอ (1 คะแนนต่อคน: 91001→?, 91006→91006? ไม่ได้ ฯลฯ) ดูผลจริงบนจอ
  await p.click('#lyric-teacher-panel [data-act=phase][data-v=closed]'); await p.waitForTimeout(800);
  await check('#lyric-teacher-panel', 't2_closed_p8');
  const tt = await p.innerText('#lyric-teacher-panel'); ck(/ปิดโหวต/.test(tt), 'ครู: แสดงสถานะปิดโหวต');
  // ครูเลือกเนื้อ + ล็อก
  await p.click('#lyric-teacher-panel [data-group="1"] [data-act=pick]'); await p.waitForTimeout(700);
  await p.click('#lyric-teacher-panel [data-act=lock][data-v="1"]'); await p.waitForTimeout(700);
  await check('#lyric-teacher-panel', 't3_locked_p8', m => ck(/ครูเลือกแล้ว|ล็อก/.test(m.txt), 'ครูเห็นสถานะล็อก/ครูเลือก'));
  await asStudent('91001', 8);
  await check('#student-lyric-studio', 's5_locked_p8', m => { ck(/ครูล็อกผลแล้ว/.test(m.txt), 'นักเรียนเห็นล็อกแล้ว'); ck(!/โหวตเนื้อนี้</.test(m.txt), ''); });
  ck(await p.evaluate(() => document.querySelectorAll('#student-lyric-studio [data-act=vote]').length === 0), 'ล็อกแล้วไม่มีปุ่มโหวต');
  // ---- 4) แท็บ Joy ใน P8 + คาบ 10 (1 คน 1 โน้ต) ----
  await p.evaluate(() => document.querySelector('#student-lyric-studio [data-act=song][data-key=joy_to_the_world]').click()); await p.waitForTimeout(800);
  await check('#student-lyric-studio', 's6_joy_p8', m => { ck(m.ins === 1, 'Joy: นักเรียนแก้ได้ 1 ช่อง (วรรคของตน) ' + m.ins); });
  await asStudent('91006', 10);
  await check('#student-lyric-studio', 's7_p10_one_per_note', m => { ck(/วรรคที่ 2/.test(m.txt), 'เลขที่ 6 = ลำดับที่ 2 ในกลุ่ม → วรรคที่ 2'); });
  await p.evaluate(() => { Store.setCurrentUser({ role: 'teacher', name: 'ครูทดสอบ', username: 'teacher_test' }); App.state.role = 'teacher'; App.state.grade = 'M1'; App.enterCockpit('ม.1/1', 10); });
  await p.waitForSelector('#lyric-teacher-panel .ls-wrap[data-ls=teacher]', { timeout: 8000 }).catch(() => {});
  await check('#lyric-teacher-panel', 't4_p10', m => ck(/1 โน้ต = 1 วรรค/.test(m.txt), 'ครู P10: โครง 1 โน้ต = 1 วรรค'));
  // ---- 5) คาบที่ไม่เกี่ยว ไม่มีแผง ----
  await asStudent('91001', 5);
  ck(await p.$('#student-lyric-studio .ls-wrap') === null, 'คาบ 5: ไม่มีแผงเนื้อร้อง');
  ck(errs.length === 0, 'ไม่มี pageerror: ' + errs.slice(0, 2));
  console.log(`headless_lyric_studio: pass=${pass} fail=${fail}`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
