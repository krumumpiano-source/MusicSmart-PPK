/* ห้องสำรวจวงดนตรี: ข้อมูลขับเคลื่อน (ไม่ฮาร์ดโค้ด) · ครอบคลุมตาม วก.5 คาบ 12/14 · ป้ายร่างโดยระบบ · แบบทดสอบจากข้อมูล · ลงทะเบียน sw/index */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
global.window = global;
const W = require(path.join(ROOT, 'app/data/wk5_plans.js')).M1;
const B = require(path.join(ROOT, 'tools/curriculum/build_ensemble_data.js'));
const D = require(path.join(ROOT, 'app/data/ensemble_data.js'));
global.ENSEMBLE_DATA = D;
const EX = require(path.join(ROOT, 'app/js/ensemble-explorer.js'));
const srcJs = fs.readFileSync(path.join(ROOT, 'app/js/ensemble-explorer.js'), 'utf8');
const txt = p => JSON.stringify(W[p]);

// ===== ข้อมูล =====
check('ensemble_data.js ตรงกับ source และผ่านการตรวจความสมบูรณ์', B.build().problems.length === 0 && fs.readFileSync(path.join(ROOT, 'app/data/ensemble_data.js'), 'utf8').replace(/\r\n/g, '\n') === B.build().js, B.build().problems.join(';'));
check('วก.5 คาบ 12 ระบุ 4 ภาค: สะล้อซอซึง / โปงลาง / กลองยาว / รองเง็ง', ['สะล้อซอซึง', 'โปงลาง', 'กลองยาว', 'รองเง็ง'].every(w => txt(12).indexOf(w) >= 0));
const folk = D.categories.folk.ensembles;
check('วงพื้นบ้านครบ 4 ภาคตาม วก.5 (เหนือ อีสาน กลาง ใต้) ภาคละ 1 วง', D.regions.length === 4 && D.regions.every(r => Object.keys(folk).filter(k => folk[k].region === r).length === 1));
check('ชื่อวงพื้นบ้านตรง วก.5: ล้านนา=สะล้อซอซึง อีสาน=โปงลาง กลาง=กลองยาว ใต้=รองเง็ง', /สะล้อ/.test(folk.lanna_salor.name) && /โปงลาง/.test(folk.ponglang.name) && /กลองยาว/.test(folk.klong_yao.name) && /รองเง็ง/.test(folk.rongngeng.name));
const thai = D.categories.thai.ensembles;
check('วงไทยครบ 3 ตระกูลตาม วก.5: ปี่พาทย์ เครื่องสาย มโหรี', Object.keys(thai).length === 3 && /ปี่พาทย์/.test(thai.piphat_hard.name) && /เครื่องสาย/.test(thai.string_ensemble.name) && /มโหรี/.test(thai.mahori.name) && /ปี่พาทย์.*เครื่องสาย.*มโหรี/.test(txt(12)));
check('ขนาดวงตาม วก.5 (เครื่องห้า-เครื่องคู่-เครื่องใหญ่) ใช้เฉพาะคำที่ วก.5 มี', Object.keys(thai).every(k => !thai[k].size || txt(12).indexOf(thai[k].size) >= 0));
const west = D.categories.western.ensembles;
check('วงสากลครบ 5 ประเภทตาม วก.5 คาบ 14 (Orchestra / Band / Chamber / Jazz / Pop-Rock)', Object.keys(west).length === 5 && /Orchestra/.test(west.orchestra.name) && /Band/.test(west.concert_band.name) && /Chamber/.test(west.string_quartet.name) && /Jazz/.test(west.jazz_band.name) && /Pop-Rock/.test(west.pop_rock.name) && ['Orchestra', 'Band', 'Chamber', 'Jazz', 'Pop-Rock'].every(w => txt(14).indexOf(w) >= 0));
check('ประเภทเครื่อง: ไทย/พื้นบ้านใช้ ตี เป่า ดีด สี · สากลใช้ 5 ประเภท ตาม วก.5', D.classSets.thai.join() === 'ตี,เป่า,ดีด,สี' && D.classSets.western.join() === 'สาย,ลมไม้,ทองเหลือง,ลิ่มนิ้ว,กระทบ' && ['ดีด', 'สี', 'ตี', 'เป่า'].every(w => txt(12).indexOf(w) >= 0) && ['สาย', 'ลมไม้', 'ทองเหลือง', 'ลิ่มนิ้ว', 'กระทบ'].every(w => txt(14).indexOf(w) >= 0));
check('ทุกวงติดป้ายรอครูตรวจ (review=true) — ไม่อ้างว่าตรวจแล้ว', ['thai', 'folk', 'western'].every(c => Object.keys(D.categories[c].ensembles).every(k => D.categories[c].ensembles[k].review === true)) && /รอครูตรวจ/.test(D.reviewLabel));
check('ทุกวงอ้างอิงคาบ วก.5 (12 หรือ 14)', ['thai', 'folk', 'western'].every(c => Object.keys(D.categories[c].ensembles).every(k => [12, 14].indexOf(D.categories[c].ensembles[k].period) >= 0 && /วก\.5/.test(D.categories[c].ensembles[k].wk5))));

// ===== ไม่ฮาร์ดโค้ด =====
check('ส่วนหัวไฟล์ไม่อ้าง "100% Dynamic - Zero Hardcoding" ที่ไม่จริงอีก', !/Zero Hardcoding/i.test(srcJs.split('\n').slice(0, 14).join('\n')) || /ไม่มีเนื้อหา/.test(srcJs));
check('โค้ดตัวแสดงไม่มีชื่อเครื่อง/วงฝังอยู่ (ระนาด ซอ จะเข้ แคน โปงลาง Violin Cello ฯลฯ)', !/ระนาด|ซอด้วง|จะเข้|แคน|โปงลาง|สะล้อ|Violin|Cello|Timpani|ปี่พาทย์/.test(srcJs.replace(/\/\/.*$/gm, '')));
check('ไม่ใช้ prompt()/alert() เป็นช่องทางทดสอบ (ยกเว้นแจ้งข้อมูลโหลดไม่เสร็จ)', !/prompt\(/.test(srcJs));

// ===== แสดงผลด้วย DOM จำลอง =====
const BAN = /รอครูตรวจ|ร่างโดยระบบ|ครูโปรดยืนยัน|ผังที่นั่งเป็นแบบร่าง|ข้อมูลร่าง|ระบบตั้งเป็น|ข้อสังเกตสำหรับครู/;
const els = {};
['ensemble-pills-selector', 'ensemble-info-banner', 'ensemble-stage-canvas', 'ensemble-instrument-inspector', 'ens-cat-thai', 'ens-cat-folk', 'ens-cat-western'].forEach(i => { els[i] = { innerHTML: '', className: '', style: {} }; });
const modal = { classList: { on: false, add() { this.on = true; }, remove() { this.on = false; } } };
global.document = { getElementById: id => id === 'modal-ensemble-explorer' ? modal : (els[id] || null) };
global.alert = m => { global.__alerts.push(m); };
global.__alerts = [];
global.App = { state: { role: 'student', studentPeriod: 12 } };
['thai', 'folk', 'western'].forEach(c => {
  EX.openModal(c);
  Object.keys(D.categories[c].ensembles).forEach(ek => {
    EX.selectEnsemble(ek);
    const e = D.categories[c].ensembles[ek];
    const stage = els['ensemble-stage-canvas'].innerHTML;
    const all = e.seating.every(s => stage.indexOf(D.instruments[s.inst].name.replace(/&/g, '&amp;')) >= 0);
    check(c + '/' + ek + ': ผังแสดงเครื่องครบ ' + e.seating.length + ' ชิ้น + ชื่อวง + ที่มา วก.5 · นักเรียนไม่เห็นป้าย/คำเตือนร่าง', all && els['ensemble-info-banner'].innerHTML.indexOf(e.name.replace(/&/g, '&amp;')) >= 0 && els['ensemble-info-banner'].innerHTML.indexOf('วก.5') >= 0 && !BAN.test(els['ensemble-info-banner'].innerHTML + els['ensemble-stage-canvas'].innerHTML));
    EX.selectSeat(0);
    const card = EX.getInstrumentCard(c, ek, 0);
    check(c + '/' + ek + ': การ์ดเครื่องดนตรี (ชื่อไทย/อังกฤษ ประเภท บทบาท วิธีเล่น ป้ายเสียงจริง/เสียงจำลอง) จากข้อมูล', card.cls && card.role && card.tone && card.en && card.how && els['ensemble-instrument-inspector'].innerHTML.indexOf('ประเภท: ' + card.cls) >= 0 && els['ensemble-instrument-inspector'].innerHTML.indexOf('จัดเครื่องดนตรีในวงตามประเภท') >= 0 && els['ensemble-instrument-inspector'].innerHTML.indexOf('วิธีเล่น') >= 0 && els['ensemble-instrument-inspector'].innerHTML.indexOf(card.en.replace(/&/g, '&amp;')) >= 0 && /ฟังเสียงจำลอง|ฟังเสียงจริง|ไม่ได้/.test(els['ensemble-instrument-inspector'].innerHTML) && !BAN.test(els['ensemble-instrument-inspector'].innerHTML));
  });
});
EX.openModal('folk');
check('แท็บพื้นบ้านแสดงลิงก์ครบ 4 ภาค', D.regions.every(r => els['ensemble-info-banner'].innerHTML.indexOf(r) >= 0));
check('เปิดด้วยหมวดไม่ถูกต้อง → ตกกลับหมวดแรก (ไม่พัง)', (EX.openModal('zzz'), EX.activeCategory === 'thai'));
check('ปุ่มหมวด 3 หมวดมีสถานะ active ถูกต้อง', (EX.switchCategory('western'), els['ens-cat-western'].className.indexOf('active') >= 0 && els['ens-cat-thai'].className.indexOf('active') < 0));
// XSS: ข้อมูลที่มีแท็กต้องถูก escape
(function () {
  const e = D.categories.thai.ensembles.piphat_hard, old = e.name; e.name = '<img src=x onerror=alert(1)>';
  EX.openModal('thai', 'piphat_hard');
  check('ชื่อวงที่มี HTML ถูก escape ใน banner และปุ่มเลือกวง', els['ensemble-info-banner'].innerHTML.indexOf('<img src=x') < 0 && els['ensemble-pills-selector'].innerHTML.indexOf('<img') < 0);
  e.name = old;
})();

// ===== เสียงจำลองจากข้อมูล =====
(function () {
  const calls = [];
  global.AudioContext = function () { this.currentTime = 0; this.destination = {}; this.resume = () => {}; this.createGain = () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }); this.createOscillator = () => { const o = { frequency: { setValueAtTime(f) { o.f = f; } }, connect() {}, start() { calls.push(o); }, stop() {} }; return o; }; };
  EX._ctx = null; EX.playSample('ranat_thum'); EX.playSample('ching'); EX.playSample('nonexistent');
  check('playSample ใช้ preset จากข้อมูล (เครื่องที่ไม่มีไฟล์เสียงจริง: ระนาดทุ้ม=struck · ฉิ่ง=bell 2093 · ฉิ่ง=bell 2093) และไม่พังเมื่อ id ไม่มี', calls.length === 2 && calls[0].type === D.synthPresets.struck.wave && Math.abs(calls[0].f - 659.25) < 1e-6 && Math.abs(calls[1].f - 2093) < 1e-6);
})();

// ===== แบบทดสอบจากข้อมูล =====
(function () {
  const qs = EX.buildQuestions();
  check('แบบทดสอบสร้างจากข้อมูล: มีคำถามภาค 4 ข้อ + ประเภทเครื่องหลายข้อ', qs.filter(q => /ภาคใด/.test(q.q)).length === 4 && qs.length > 20);
  check('ทุกคำถามมีคำตอบอยู่ในตัวเลือก และตัวเลือกไม่ซ้ำ', qs.every(q => q.choices.indexOf(q.a) >= 0 && new Set(q.choices).size === q.choices.length));
  check('คำถามภาคตอบตรงข้อมูล (โปงลาง → อีสาน)', qs.some(q => /โปงลาง/.test(q.q) && /อีสาน/.test(q.a)));
  EX.openModal('thai'); EX.startQuiz();
  const q = EX.quiz.q; const ok = q.choices.indexOf(q.a);
  EX.answerQuiz(ok); EX.answerQuiz((ok + 1) % q.choices.length);
  check('ตอบถูกนับคะแนน ตอบซ้ำไม่นับ · แสดงผล ✓ และข้อความ "ไม่นับคะแนนเก็บ"', EX.quiz.score.ok === 1 && EX.quiz.score.all === 1 && els['ensemble-instrument-inspector'].innerHTML.indexOf('✓ ถูกต้อง') >= 0 && els['ensemble-instrument-inspector'].innerHTML.indexOf('ไม่นับคะแนนเก็บ') >= 0);
  EX.nextQuiz(); check('ข้อต่อไป เก็บคะแนนสะสม', EX.quiz.score.all === 1);
  EX.endQuiz(); check('กลับไปผังวงได้', EX.quiz === null);
})();

// ===== ลงทะเบียน =====
const idx = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'app/sw.js'), 'utf8');
check('index.html โหลดข้อมูลก่อนตัวแสดง', idx.indexOf('data/ensemble_data.js') > 0 && idx.indexOf('data/ensemble_data.js') < idx.indexOf('js/ensemble-explorer.js'));
check('sw.js แคชไฟล์ข้อมูลวงดนตรี', sw.indexOf("'./data/ensemble_data.js'") > 0);
check('ปุ่มวงดนตรีบนมือถือเรียก openModal ที่มีอยู่จริง (ไม่ใช่ .open())', idx.indexOf('EnsembleExplorer.open()') < 0 && typeof EX.openModal === 'function' && typeof EX.open === 'undefined');
check('ป้ายแท็บพื้นบ้านบอกครบ 4 ภาค', /พื้นบ้าน 4 ภาค \(เหนือ\/อีสาน\/กลาง\/ใต้\)/.test(idx));

// ===== fr9: เปิดตามคาบ (วก.5 คาบ 12 = ไทย+พื้นบ้าน · คาบ 14 = สากล) =====
(function () {
  global.__alerts.length = 0;
  EX.openModal('thai', null, 12);
  check('คาบ 12: เปิดได้เฉพาะหมวดไทย+พื้นบ้าน (ไม่มีสากล) · ปุ่มสากลถูกซ่อน', EX.categoriesFor(12).join() === 'thai,folk' && els['ens-cat-western'].style.display === 'none' && els['ens-cat-thai'].style.display === '');
  EX.openModal('western', null, 12);
  check('คาบ 12 ขอหมวดสากล → ตกกลับหมวดไทย (ไม่หลุดไปแสดงวงสากล)', EX.activeCategory === 'thai' && Object.keys(EX.ensemblesIn('thai')).length === 3);
  EX.openModal('thai', null, 14);
  check('คาบ 14: เปิดได้เฉพาะสากล 5 วง · ปุ่มไทย/พื้นบ้านถูกซ่อน · pills มี 5', EX.categoriesFor(14).join() === 'western' && EX.activeCategory === 'western' && els['ens-cat-thai'].style.display === 'none' && els['ens-cat-folk'].style.display === 'none' && (els['ensemble-pills-selector'].innerHTML.match(/ens-pill/g) || []).length === 5);
  const cnt = global.__alerts.length;
  modal.classList.on = false; EX.openModal('thai', null, 13);
  check('คาบ 13/15 ไม่มีวงใน วก.5 → ไม่เปิดและแจ้งข้อความ', modal.classList.on === false && global.__alerts.length === cnt + 1);
  modal.classList.on = false; EX.openModal('thai', null, 15);
  check('คาบ 15 เช่นกัน', modal.classList.on === false);
  EX.openModal('thai', null, [12, 14]);
  check('นักเรียนเปิดจากเมนูรวมหลังเรียนถึงคาบ 14 → เห็นครบ 3 หมวด', EX.categoriesFor([12, 14]).length === 3);
  check('periodsAvailable = [12,14] จากข้อมูล (ไม่ฮาร์ดโค้ด) · hasPeriod', EX.periodsAvailable().join() === '12,14' && EX.hasPeriod(12) && EX.hasPeriod(14) && !EX.hasPeriod(13) && !EX.hasPeriod(15));
  EX.openModal('thai');
  check('ไม่ระบุคาบ (มุมมองครู) → ทุกหมวด', EX.categoriesFor(null).length === 3 && els['ens-cat-western'].style.display === '');
})();

// ===== fr9: ผังที่นั่งทั้ง 12 วง — ไม่ทับซ้อน/ไม่ตกหล่น/ปุ่มอ่านได้ =====
(function () {
  let n = 0;
  ['thai', 'folk', 'western'].forEach(c => Object.keys(D.categories[c].ensembles).forEach(ek => {
    n++;
    const e = D.categories[c].ensembles[ek], rows = EX.layoutRows(e.seating);
    const flat = [].concat.apply([], rows).sort((a, b) => a - b);
    check(c + '/' + ek + ': ผังแถว — ทุกที่นั่งอยู่ในแถวเดียวพอดี (ไม่ซ้ำ/ไม่ตกหล่น)', flat.length === e.seating.length && flat.every((v, i) => v === i));
    check(c + '/' + ek + ': แถวเรียงจากหลังไปหน้า และในแถวเรียงซ้าย→ขวา', rows.every((r, ri) => r.every((v, i) => i === 0 || e.seating[r[i - 1]].x <= e.seating[v].x) && (ri === 0 || e.seating[rows[ri - 1][0]].y < e.seating[r[0]].y)));
    EX.openModal(c, ek);
    const st = els['ensemble-stage-canvas'].innerHTML;
    check(c + '/' + ek + ': HTML ผังเป็นแถว (ไม่ใช้ position:absolute/left%/top%) · ปุ่มที่นั่งครบ', !/position\s*:\s*absolute|left\s*:\s*\d+%/.test(st) && (st.match(/class="ens-seat[" ]/g) || []).length === e.seating.length && (st.match(/class="ens-row"/g) || []).length === rows.length);
  }));
  check('ตรวจผังครบ 12 วง', n === 12);
  const css = fs.readFileSync(path.join(ROOT, 'app/css/styles.css'), 'utf8');
  check('CSS ปุ่มที่นั่ง/ชิป/ตัวเลือก สูง ≥44px และตัดบรรทัดได้ (ไม่ ellipsis ตัดชื่อ)', /\.ens-seat\s*\{[^}]*min-height:\s*44px/.test(css) && /\.ens-chip\s*\{[^}]*min-height:\s*44px/.test(css) && /\.ens-choice\s*\{[^}]*min-height:\s*44px/.test(css) && /\.ens-seat\s*\{[^}]*white-space:\s*normal/.test(css) && !/\.ens-seat[^{]*\{[^}]*text-overflow/.test(css));
})();

// ===== fr9: มุมมองครู/นักเรียน — คำเตือนร่างเห็นเฉพาะครู และพับอยู่ใน "ข้อสังเกตสำหรับครู" =====
(function () {
  global.App.state.role = 'student';
  let leak = [];
  ['thai', 'folk', 'western'].forEach(c => Object.keys(D.categories[c].ensembles).forEach(ek => {
    EX.openModal(c, ek); EX.selectSeat(0);
    const all = els['ensemble-info-banner'].innerHTML + els['ensemble-stage-canvas'].innerHTML + els['ensemble-instrument-inspector'].innerHTML + els['ensemble-pills-selector'].innerHTML;
    if (BAN.test(all) || /\(\s*รอครู|\(\s*ร่าง/.test(all)) leak.push(c + '/' + ek);
  }));
  check('นักเรียน: ทั้ง 12 วง ไม่มีข้อความร่าง/รอครูตรวจ/ข้อสังเกตสำหรับครูในหน้าจอ', leak.length === 0, leak.join(','));
  global.App.state.role = 'teacher';
  EX.openModal('thai', 'piphat_hard');
  const b = els['ensemble-info-banner'].innerHTML;
  check('ครู: มี <details> "ข้อสังเกตสำหรับครู" (พับ ไม่ใช่ open) พร้อมป้ายร่างและหมายเหตุ', /<details class="ens-teacher">/.test(b) && b.indexOf('ข้อสังเกตสำหรับครู') > 0 && b.indexOf(D.reviewLabel) > 0 && b.indexOf('open') < 0 || /<details class="ens-teacher"><summary>/.test(b));
  global.App.state.role = 'student';
  check('clean(): ตัดวงเล็บ (รอครูตรวจ) สำหรับนักเรียน และคงข้อความอื่น', EX.clean('ภาคกลาง (รอครูตรวจ)') === 'ภาคกลาง' && EX.clean('งานมงคล (ร่างโดยระบบ – รอครูตรวจ) ใช้ในพิธี') === 'งานมงคล ใช้ในพิธี' && EX.clean('(รอครูตรวจ)') === '');
  global.App.state.role = 'teacher'; check('clean(): ครูเห็นต้นฉบับ', EX.clean('ภาคกลาง (รอครูตรวจ)') === 'ภาคกลาง (รอครูตรวจ)');
  global.App.state.role = 'student';
})();

// ===== fr9: รูปภาพ (Commons) + เครดิต + ภาพประกอบ =====
(function () {
  const withImg = [], noImg = [];
  ['thai', 'folk', 'western'].forEach(c => Object.keys(D.categories[c].ensembles).forEach(ek => (D.categories[c].ensembles[ek].image ? withImg : noImg).push(ek)));
  check('ภาพจริง 11 วง · ไม่มีภาพ 1 วง (รองเง็ง) → นักเรียนไม่เห็นกรอบ ครูเห็นโน้ต', withImg.length === 11 && noImg.join() === 'rongngeng' && withImg.indexOf('mahori') >= 0);
  const ok = /^(CC0|Public domain|CC BY( [0-9.]+)?|CC BY-SA [0-9.]+)$/;
  const attr = fs.readFileSync(path.join(ROOT, 'app/media/m1/ATTRIBUTION.md'), 'utf8');
  ['thai', 'folk', 'western'].forEach(c => Object.keys(D.categories[c].ensembles).forEach(ek => {
    const e = D.categories[c].ensembles[ek], im = e.image; if (!im) return;
    const fp = path.join(ROOT, 'app', im.file), buf = fs.existsSync(fp) ? fs.readFileSync(fp) : Buffer.alloc(0);
    check(ek + ': ไฟล์ภาพเปิดได้ (JPEG magic) ขนาด ≥ 20KB และอยู่ในโฟลเดอร์คาบของวง', buf.length >= 20000 && buf[0] === 0xFF && buf[1] === 0xD8 && im.file.indexOf('media/m1/p' + e.period + '/') === 0);
    check(ek + ': สิทธิ์ใช้งานอยู่ในชุดที่อนุญาต + มีผู้สร้าง/ลิงก์ Commons และอยู่ใน ATTRIBUTION.md', ok.test(im.license) && im.author && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(im.page) && attr.indexOf(im.page) > 0 && attr.indexOf(im.author) > 0);
    EX.openModal(c, ek);
    const b = els['ensemble-info-banner'].innerHTML;
    check(ek + ': หน้าจอแสดงภาพ + เครดิต (ผู้สร้าง สิทธิ์ ลิงก์ Commons) + มี onerror fallback', b.indexOf('<img class="ens-img" src="' + im.file) > 0 && b.indexOf(im.license) > 0 && b.indexOf(im.page) > 0 && b.indexOf('onerror=') > 0);
  }));
  noImg.forEach(ek => {
    const c = 'folk', e = D.categories[c].ensembles[ek];
    global.App.state.role = 'student'; EX.openModal(c, ek);
    const sb = els['ensemble-info-banner'].innerHTML;
    check(ek + ': นักเรียนไม่เห็นกรอบภาพ/ภาพแทน SVG/<img>/โน้ตครู (ไม่มีกรอบว่าง ไม่มีภาพผิด)', sb.indexOf('<img') < 0 && sb.indexOf('<svg') < 0 && sb.indexOf('ens-fig') < 0 && sb.indexOf('ครูเตรียมภาพ') < 0);
    global.App.state.role = 'teacher'; EX.openModal(c, ek);
    const tb = els['ensemble-info-banner'].innerHTML;
    check(ek + ': ครูเห็นโน้ต "ครูเตรียมภาพ" (มาจากข้อมูล ensemble_images.json) ที่อธิบายว่าทำไมไม่มีภาพ', /ens-fig-note/.test(tb) && tb.indexOf('ครูเตรียมภาพ') > 0 && e.imageTeacherNote && tb.indexOf('<img') < 0);
    global.App.state.role = 'student';
  });
  // ภาพที่ใช้ได้เพียงใกล้เคียงต้องมีโน้ตครู (ไม่เห็นในมุมมองนักเรียน)
  ['string_ensemble', 'mahori', 'lanna_salor', 'string_quartet'].forEach(ek => {
    const c = ['thai', 'folk', 'western'].filter(k => D.categories[k].ensembles[ek])[0], e = D.categories[c].ensembles[ek];
    global.App.state.role = 'student'; EX.openModal(c, ek);
    const sb = els['ensemble-info-banner'].innerHTML;
    global.App.state.role = 'teacher'; EX.openModal(c, ek);
    const tb = els['ensemble-info-banner'].innerHTML;
    check(ek + ': ภาพมีโน้ตครูยืนยัน (teacherNote) — ครูเห็น นักเรียนไม่เห็น', e.image.teacherNote && tb.indexOf(e.image.teacherNote.slice(0, 14)) > 0 && sb.indexOf(e.image.teacherNote.slice(0, 14)) < 0);
    global.App.state.role = 'student';
  });
  check('ภาพ string_ensemble ไม่ใช่ภาพแผ่นเครื่องสายแยกชิ้นเดิม (ใช้หน้า p.43 ของหนังสือ พ.ศ. 2473) และ alt ไม่อ้างเครื่องที่ไม่ปรากฏ', /p\. 43/.test(D.categories.thai.ensembles.string_ensemble.image.title) && /p\. 39/.test(D.categories.thai.ensembles.mahori.image.title) && D.categories.thai.ensembles.string_ensemble.image.file !== D.categories.thai.ensembles.mahori.image.file);
  const mdImgs = {}; ['thai', 'folk', 'western'].forEach(c => Object.keys(D.categories[c].ensembles).forEach(ek => { const im = D.categories[c].ensembles[ek].image; if (im) mdImgs[im.file] = (mdImgs[im.file] || 0) + 1; }));
  check('ไม่มีสองวงใช้ไฟล์ภาพเดียวกัน', Object.keys(mdImgs).every(f => mdImgs[f] === 1));
  check('ATTRIBUTION.md ไม่อ้างว่า "มโหรี" ไม่มีภาพอีก และบอกวิธีที่รองเง็งไม่มีภาพ', !/มโหรี" และ "รองเง็ง" ยังไม่มีภาพ/.test(attr) && /รองเง็ง/.test(attr) && /ครูเตรียมภาพ/.test(attr));
  const sw = fs.readFileSync(path.join(ROOT, 'app/sw.js'), 'utf8');
  check('sw.js แคชภาพวงดนตรีทั้ง 11 ไฟล์ + ไฟล์เสียงจริง (ใช้งานออฟไลน์ได้)', withImg.every(ek => { let f; ['thai', 'folk', 'western'].forEach(c => { if (D.categories[c].ensembles[ek]) f = D.categories[c].ensembles[ek].image.file; }); return sw.indexOf("'./" + f + "'") > 0; }));
  Object.keys(D.instruments).filter(k => D.instruments[k].audio).forEach(k => check('sw.js แคชไฟล์เสียงจริงของ ' + k, sw.indexOf("'./" + D.instruments[k].audio.file + "'") > 0));
})();

// ===== เสียงจริง (มีไฟล์จริง+เครดิต) vs เสียงจำลอง (ติดป้าย) =====
(function () {
  const real = Object.keys(D.instruments).filter(k => D.instruments[k].audio), attr = fs.readFileSync(path.join(ROOT, 'app/media/m1/ATTRIBUTION.md'), 'utf8');
  check('เสียงจริงมีเครื่องเดียว (ระนาดเอก) และข้อมูลครบ: ไฟล์ mp3+ogg ต้นฉบับ สิทธิ์ CC BY-SA ผู้สร้าง ลิงก์ Commons และบอกการแปลงไฟล์', real.join() === 'ranat_ek' && (function () { const a = D.instruments.ranat_ek.audio; return /^CC BY-SA [0-9.]+$/.test(a.license) && a.author && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(a.page) && /แปลง/.test(a.change) && a.original; })());
  real.forEach(k => {
    const a = D.instruments[k].audio, f = path.join(ROOT, 'app', a.file), o = path.join(ROOT, 'app', a.original);
    const b = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0), ob = fs.existsSync(o) ? fs.readFileSync(o) : Buffer.alloc(0);
    check(k + ': ไฟล์ mp3 เป็น MP3 จริง (ID3/frame sync) ขนาด ≥ 5KB · ไฟล์ ogg ต้นฉบับขึ้นต้น OggS', b.length >= 5000 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) && ob.length >= 5000 && ob.slice(0, 4).toString() === 'OggS');
    check(k + ': เครดิตเสียงอยู่ใน ATTRIBUTION.md', attr.indexOf(a.author) > 0 && attr.indexOf(a.page) > 0 && attr.indexOf(a.license) > 0);
  });
  // เล่นเสียงจริงผ่าน HTMLAudio ไม่ใช่ oscillator และมีเครดิตบนจอ
  const played = [], oscs = [];
  global.Audio = function (src) { this.src = src; this.addEventListener = () => {}; this.pause = () => {}; this.play = () => { played.push(this.src); return Promise.resolve(); }; };
  global.AudioContext = function () { this.currentTime = 0; this.destination = {}; this.resume = () => {}; this.createGain = () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }); this.createOscillator = () => { const o = { frequency: { setValueAtTime() {} }, connect() {}, start() { oscs.push(1); }, stop() {} }; return o; }; };
  EX._ctx = null; EX.playSample('ranat_ek');
  check('ปุ่มระนาดเอกเล่นไฟล์เสียงจริง (HTMLAudio) ไม่ใช้ oscillator จำลอง', played.length === 1 && played[0] === D.instruments.ranat_ek.audio.file && oscs.length === 0);
  EX.playSample('ching');
  check('ปุ่มเครื่องอื่น (ฉิ่ง) ยังเป็นเสียงจำลอง ไม่เรียกไฟล์เสียงจริง', played.length === 1 && oscs.length === 1);
  global.App.state.role = 'student';
  EX.openModal('thai', 'piphat_hard');
  const idx = D.categories.thai.ensembles.piphat_hard.seating.findIndex(s => s.inst === 'ranat_ek'), idx2 = D.categories.thai.ensembles.piphat_hard.seating.findIndex(s => s.inst === 'ching');
  const stage = els['ensemble-stage-canvas'].innerHTML + els['ensemble-instrument-inspector'].innerHTML;
  check('ผังวง/แผงเครื่อง: เครื่องที่มีเสียงจริงมี 🎧 · คำอธิบายสีบอก "เสียงจำลอง" สำหรับเครื่องอื่น + เครดิตผู้สร้าง/สิทธิ์/ลิงก์ Commons บนจอ', idx >= 0 && stage.indexOf('🎧') > 0 && /เสียงจำลอง/.test(stage) && stage.indexOf(D.instruments.ranat_ek.audio.author) > 0 && stage.indexOf(D.instruments.ranat_ek.audio.license) > 0 && stage.indexOf(D.instruments.ranat_ek.audio.page) > 0);
  EX.selectSeat(idx);
  let ins = els['ensemble-instrument-inspector'].innerHTML;
  check('การ์ดระนาดเอก: ปุ่ม "ฟังเสียงจริง" + ป้ายเสียงจริง + เครดิต + ไม่มีคำว่าเสียงสังเคราะห์/ปุ่มเสียงจำลอง', /ฟังเสียงจริง/.test(ins) && /ens-badge real/.test(ins) && ins.indexOf('CC BY-SA') > 0 && ins.indexOf('Wikimedia Commons') > 0 && ins.indexOf('ฟังเสียงจำลอง') < 0 && ins.indexOf('เสียงสังเคราะห์') < 0);
  EX.selectSeat(idx2);
  ins = els['ensemble-instrument-inspector'].innerHTML;
  check('การ์ดฉิ่ง: ปุ่ม+ป้าย "เสียงจำลอง" ชัดเจน ไม่แสดงว่าเป็นเสียงจริง', /ฟังเสียงจำลอง/.test(ins) && /ens-badge sim/.test(ins) && ins.indexOf('ฟังเสียงจริง') < 0);
  // ไฟล์เสียงจริงเล่นไม่ได้ → ถอยเป็นเสียงจำลอง
  global.Audio = function () { this.addEventListener = () => {}; this.pause = () => {}; this.play = () => Promise.reject(new Error('blocked')); };
  oscs.length = 0; EX.playSample('ranat_ek');
  return Promise.resolve().then(() => Promise.resolve()).then(() => { check('เสียงจริงเล่นไม่ได้ → ถอยเป็นเสียงจำลอง ไม่เงียบ/ไม่พัง', oscs.length === 1); delete global.Audio; });
})();

// ===== fr9: แบบทดสอบทบทวนไม่นับคะแนน/ไม่บันทึก · การ์ดเครื่องที่ไม่มีเสียง =====
(function () {
  global.Store = new Proxy({}, { get(t, k) { throw new Error('quiz must not touch Store.' + String(k)); } });
  let threw = null;
  try { EX.openModal('thai', null, 12); EX.startQuiz(); EX.answerQuiz(0); EX.nextQuiz(); EX.endQuiz(); } catch (e) { threw = e.message; }
  check('แบบทดสอบทบทวนไม่เรียก Store/ไม่บันทึกคะแนน', threw === null, threw);
  delete global.Store;
  check('แบบทดสอบจำกัดตามคาบ: คาบ 14 ไม่มีคำถามภาค (พื้นบ้าน) และคาบ 12 ไม่มีคำถามเครื่องสากล', (EX.openModal('western', null, 14), !EX.buildQuestions().some(q => /ภาคใด/.test(q.q))) && (EX.openModal('thai', null, 12), !EX.buildQuestions().some(q => /Violin|Cello|Timpani|Trumpet/.test(q.q))));
  const saved = global.AudioContext; delete global.AudioContext; delete global.webkitAudioContext;
  const simSeat = D.categories.thai.ensembles.piphat_hard.seating.findIndex(s => !D.instruments[s.inst].audio);
  EX.openModal('thai', 'piphat_hard'); EX.selectSeat(simSeat);
  check('อุปกรณ์ไม่มี Web Audio → การ์ดบอกว่าเล่นเสียงจำลองไม่ได้ (ไม่มีปุ่มเล่นเสียง ไม่ใช่ "ยังไม่มีเสียง" ที่ดูเหมือนข้อมูลขาด)', /เล่นเสียงจำลองไม่ได้/.test(els['ensemble-instrument-inspector'].innerHTML) && els['ensemble-instrument-inspector'].innerHTML.indexOf('ฟังเสียงจำลอง') < 0);
  global.AudioContext = saved;
  EX.openModal('thai', 'piphat_hard'); EX.selectSeat(simSeat);
  check('มี Web Audio → การ์ดมีปุ่ม "ฟังเสียงจำลอง" และบอกว่าเป็นเสียงสังเคราะห์', /ฟังเสียงจำลอง/.test(els['ensemble-instrument-inspector'].innerHTML) && /เสียงสังเคราะห์/.test(els['ensemble-instrument-inspector'].innerHTML));
  // ทุกเครื่องมีชื่ออังกฤษและวิธีเล่น
  check('ทุกเครื่อง (60) มีชื่ออังกฤษและวิธีเล่น (how หรือ howBySynth)', Object.keys(D.instruments).every(k => D.instruments[k].en && (D.instruments[k].how || D.howBySynth[D.instruments[k].synth])));
})();

// ===== fr9: ปุ่ม/การ์ดตามคาบ ต้องมาจากสื่อใน วก.5 (ไม่ฮาร์ดโค้ดช่วงคาบ) =====
(function () {
  const app = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
  check('app.js ไม่ใช้ช่วงคาบฮาร์ดโค้ดกับปุ่มวงดนตรี/Feldman (ใช้ MediaViews.periodTools)', !/curPeriod\s*>=\s*12\s*&&\s*curPeriod\s*<=\s*15/.test(app) && !/curPeriod\s*>=\s*16\b/.test(app) && /MediaViews\.periodTools/.test(app));
  check('app.js ไม่มีปุ่ม openModal() ของวงดนตรีแบบไม่ระบุคาบ ยกเว้นเมนูรวมที่ผ่าน App.openEnsemble', (app.match(/EnsembleExplorer\.openModal\(\)/g) || []).length === 0);
  const idx2 = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
  check('เมนูเครื่องมือ/แถบล่างมือถือเรียก App.openEnsemble (กรองตามคาบสำหรับนักเรียน)', /App\.openEnsemble\(\); App\.closeToolsMenu/.test(idx2) && /id="mnav-ensemble" onclick="App\.openEnsemble/.test(idx2));
  check('index.html ไม่เหลือ "ม.2/1" และ "แบบทดสอบวงดนตรี" ในโมดัลวงดนตรี', (function () { const a = idx2.indexOf('id="modal-ensemble-explorer"'), b2 = idx2.indexOf('modal-app-settings'); const m = idx2.slice(a, b2); return m.indexOf('ม.2/1') < 0 && m.indexOf('แบบทดสอบทบทวน') > 0; })());
  const L = require(path.join(ROOT, 'app/data/lessons.js')).M1;
  const aid = p => (L.filter(l => l.period === p)[0] || {}).aids || [];
  const has = (p, w) => aid(p).some(a => a.indexOf(w) === 0);
  check('aids ตามสื่อ วก.5: คาบ 12 = ensemble:thai · 14 = ensemble:western · 13/15 ไม่มี ensemble · 17 = feldman · 16/18 ไม่มี feldman', aid(12).join() === 'ensemble:thai' && aid(14).join() === 'ensemble:western' && !has(13, 'ensemble') && !has(15, 'ensemble') && has(17, 'feldman') && !has(16, 'feldman') && !has(18, 'feldman'));
  check('ทุกคาบที่มี aid ensemble คือคาบที่ข้อมูลวงดนตรีมี (aids ↔ ENSEMBLE_DATA สอดคล้อง)', L.every(l => (l.aids || []).some(a => a.indexOf('ensemble') === 0) === EX.hasPeriod(l.period)));
  // periodTools จาก MediaViews (โหลดแบบ vm ในเทสต์เส้นทางสื่อ — ที่นี่ตรวจรูปแบบอย่างเดียว)
  const mv = fs.readFileSync(path.join(ROOT, 'app/js/media-views.js'), 'utf8');
  check('MediaViews.periodTools ใช้ตารางเส้นทางสื่อ (route ensemble/feldman) และเปิดห้องสำรวจพร้อมคาบ', /periodTools:\s*function/.test(mv) && /openModal\(r\.ensemble, null, Number\(period\)/.test(mv));
})();
console.log('test_ensemble_explorer: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
