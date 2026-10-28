/* กิจกรรมฟังเปรียบเทียบเสียง คาบ 16 (วก.5): ข้อมูลจาก ENSEMBLE_DATA · ไม่ฮาร์ดโค้ด · ไม่นับคะแนน · เสียงจำลองระบุชัด · ลงทะเบียน */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
global.window = global;
const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const W = require(path.join(ROOT, 'app/data/wk5_plans.js')).M1;
const D = require(path.join(ROOT, 'app/data/ensemble_data.js')); global.ENSEMBLE_DATA = D;
const TL = require(path.join(ROOT, 'app/js/timbre-listening.js'));
const src = fs.readFileSync(path.join(ROOT, 'app/js/timbre-listening.js'), 'utf8');
const body = { innerHTML: '' }, modal = { classList: { on: false, add() { this.on = true; }, remove() { this.on = false; } }, innerHTML: '' };
global.document = { getElementById: id => id === 'timbre-listening-body' ? body : (id === TL.MODAL_ID ? modal : null) };
const w16 = JSON.stringify(W[16]);

check('วก.5 คาบ 16 มี Timbre / Tempo / Dynamics / Feldman 4 ขั้นตอน', ['Timbre', 'Tempo', 'Dynamics', 'Description', 'Analysis', 'Interpretation', 'Judgement'].every(w => w16.indexOf(w) >= 0));
const L = D.listening;
check('ข้อมูลกิจกรรมอยู่ใน ENSEMBLE_DATA.listening (คาบ 16) พร้อม 3 ระดับความเร็ว/ความดัง และ Feldman 4 ขั้น', L && L.period === 16 && L.tempos.length >= 3 && L.dynamics.length >= 3 && L.feldman.length === 4 && L.review === true);
check('ขั้น Feldman ตรงชื่อ วก.5 ตามลำดับ', ['Description', 'Analysis', 'Interpretation', 'Judgement'].every((w, i) => L.feldman[i].label.indexOf(w) >= 0));
check('ความเร็วเรียงช้า→เร็ว · ความดังเรียงเบา→ดัง', L.tempos[0].bpm < L.tempos[1].bpm && L.tempos[1].bpm < L.tempos[2].bpm && L.dynamics[0].gain < L.dynamics[1].gain && L.dynamics[1].gain < L.dynamics[2].gain);
check('3 วัฒนธรรมจากข้อมูล (ไทย/พื้นบ้าน/สากล) และมีเครื่องให้เลือกทุกวัฒนธรรม ไม่มีผู้อำนวยเพลง/เสียงร้อง', TL.cultures().length === 3 && TL.cultures().every(c => TL.instrumentsOf(c.key).length >= 4) && TL.cultures().every(c => TL.instrumentsOf(c.key).every(i => i.cls !== 'ผู้อำนวยเพลง' && i.cls !== 'เสียงร้อง')));
check('เครื่องไม่ซ้ำภายในวัฒนธรรมเดียวกัน', TL.cultures().every(c => { const l = TL.instrumentsOf(c.key).map(i => i.id); return new Set(l).size === l.length; }));
// เสียง
const s1 = TL.schedule('ranat_ek', 60, 1), s2 = TL.schedule('ranat_ek', 120, 1), s3 = TL.schedule('ranat_ek', 60, 0.25);
check('schedule: ความเร็ว 120 BPM ห่างโน้ตครึ่งหนึ่งของ 60 BPM', s1.length === L.pattern.length && Math.abs(s1[1].t - 1) < 1e-9 && Math.abs(s2[1].t - 0.5) < 1e-9);
check('schedule: ความดังเบาลดค่า peak ตาม gain', Math.abs(s3[0].peak - s1[0].peak * 0.25) < 1e-9);
check('schedule: ความถี่มาจาก preset ของข้อมูล และไม่รู้จักเครื่อง → []', Math.abs(s1[0].freq - D.synthPresets.struck.freq) < 1e-9 && TL.schedule('nope', 60, 1).length === 0);
// เปิดกิจกรรม
check('openModal เปิดได้เมื่อมีข้อมูล และแสดงข้อความเสียงจำลอง + ไม่นับคะแนนเก็บ + ครบ 4 ขั้น Feldman', TL.openModal() && modal.classList.on && /เสียงจำลอง/.test(body.innerHTML) && /ไม่นับคะแนนเก็บ/.test(body.innerHTML) && L.feldman.every(f => body.innerHTML.indexOf(f.label) >= 0));
check('เลือกเสียง A (ไทย) และ B (สากล) ต่างวัฒนธรรมโดยค่าเริ่มต้น', TL.state.sel.A.cat === 'thai' && TL.state.sel.B.cat === 'western');
TL.setSel('A', 'cat', 'folk');
check('เปลี่ยนวัฒนธรรมแล้วเครื่องเปลี่ยนเป็นเครื่องแรกของวัฒนธรรมนั้น', TL.state.sel.A.cat === 'folk' && TL.state.sel.A.inst === TL.instrumentsOf('folk')[0].id);
TL.toggleMood('A', L.moods[0]); TL.toggleMood('A', L.moods[1]); TL.toggleMood('A', L.moods[0]);
check('เลือก/ยกเลิกคำอารมณ์ได้', TL.state.moods.A.length === 1 && TL.state.moods.A[0] === L.moods[1]);
TL.setFeldman('description', 'ได้ยินเสียงกลอง'); TL.setFeldman('judgement', 'x'.repeat(5000));
const saved = JSON.parse(store[TL.storeKey()]);
check('บันทึกร่างต่อรหัสนักเรียน (guest) และจำกัดความยาว 1200 ตัวอักษร', /^ppk_timbre_listen_guest_p16$/.test(TL.storeKey()) && saved.feldman.description === 'ได้ยินเสียงกลอง' && saved.feldman.judgement.length === 1200 && saved.sel.A.cat === 'folk');
TL.openModal();
check('เปิดใหม่แล้วโหลดร่างเดิมกลับมา', TL.state.sel.A.cat === 'folk' && TL.state.feldman.description === 'ได้ยินเสียงกลอง' && body.innerHTML.indexOf('ได้ยินเสียงกลอง') >= 0);
// ข้อสอบฟัง
global.AudioContext = function () { this.currentTime = 0; this.destination = {}; this.resume = () => {}; this.createGain = () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }); this.createOscillator = () => ({ frequency: { setValueAtTime() {} }, connect() {}, start() { global.__osc = (global.__osc || 0) + 1; }, stop() {} }); };
TL.startTest('tempo', () => 0.99);
check('ฝึกฟังแยกระดับ: เล่นเสียงจริง (จำลอง) แล้วรอคำตอบ', TL.state.test && TL.state.test.idx === L.tempos.length - 1 && global.__osc === L.pattern.length);
TL.answerTest(0); const t1 = TL.state.tally.tempo.slice();
TL.answerTest(L.tempos.length - 1);
check('ตอบผิดแสดงเฉลย · ตอบได้ครั้งเดียวต่อข้อ', t1[0] === 0 && t1[1] === 1 && TL.state.tally.tempo[1] === 1 && /ยังไม่ใช่/.test(body.innerHTML));
TL.startTest('dyn', () => 0); TL.answerTest(0);
check('ตอบถูกนับ (ความดัง)', TL.state.tally.dyn[0] === 1 && TL.state.tally.dyn[1] === 1 && /✓ ถูกต้อง/.test(body.innerHTML));
check('ไม่มีการเขียนคะแนนเก็บ/ส่งเซิร์ฟเวอร์ (ไม่ใช้ Store.save/fetch/submit)', !/Store\.(save|submit|add|record|set)|fetch\(|XMLHttpRequest|submit/.test(src.replace(/\/\*[\s\S]*?\*\//, '')));
// XSS
D.instruments[TL.instrumentsOf('thai')[0].id].name = '<b onmouseover=x>'; TL.openModal();
check('ชื่อเครื่องที่มี HTML ถูก escape', body.innerHTML.indexOf('<b onmouseover') < 0);
// ไม่ฮาร์ดโค้ด
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check('โค้ดไม่ฝังชื่อเครื่อง/คำอารมณ์/BPM/ขั้น Feldman (อยู่ในข้อมูล)', !/ระนาด|ซอด้วง|ซออู้|Violin|สงบ|สนุกสนาน|Description|Judgement|144|\b96\b/.test(code));
// ลงทะเบียน
const idx = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'app/sw.js'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
check('index.html และ sw.js ลงทะเบียนไฟล์', idx.indexOf('js/timbre-listening.js') > 0 && sw.indexOf("'./js/timbre-listening.js'") > 0);
check('เส้นทาง timbre_feldman.html เปิดกิจกรรมฟังก่อน แล้วตกกลับ Feldman', /TimbreListening\.openModal\(\)[\s\S]{0,200}FeldmanCriticism\.openModal/.test(app));
check('ช่องสื่อ p16 ใน วก.5 (ซอล้านนา / แจ๊ส) ยังเป็นของจริงที่ครูวาง — กิจกรรมนี้แสดงควบกับ PeriodMedia', /PeriodMedia\.mountHTML/.test(src));
console.log('test_timbre_listening: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
