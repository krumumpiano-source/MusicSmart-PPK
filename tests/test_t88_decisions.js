// ตรวจการตัดสินของครู (t86u/t87u) ที่ใช้กับ ม.1: เกณฑ์คาลิมบ้า, ผลรวมคะแนน, คาบ 11/20, หัวข้อคาบ 18, คาบ 18-19,
// เนื้อเพลง, ชื่อโครงการ, ความยินยอม PDPA/ช่วงคาบเก็บคลิป — ข้อความอ่านจากข้อมูลที่สร้างจาก วก.5 เท่านั้น
const assert = require('assert'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const W = require('../app/data/wk5_plans.js').M1, L = require('../app/data/lessons.js').M1;
const PP = require('../app/js/period-policy.js');
global.WK5_PLANS = require('../app/data/wk5_plans.js'); global.PERIOD_POLICY = require('../app/data/period_policy.js');
const flat = PP.flat;
const zw = s => String(s).replace(/[\u200b\u200c\u200d\ufeff]/g, '');

// ---- 2) ผลรวมคะแนน ----
const R = require('../tools/curriculum/score_totals_report.js'), rows = R.load(), S = R.summarize(rows);
ok(rows.length === 20 && S.mismatch.length === 0, 'คะแนนสามแหล่ง (ตาราง วก.5 / wk5_plans / lessons) ตรงกันทุกคาบ: ' + S.mismatch.join(','));
ok(S.formative === 80 && S.exam === 20 && S.k + S.p + S.a === 100, 'รวม 80 + 10 + 10 = 100 (' + S.formative + '/' + S.exam + ')');
ok(S.k === 34 && S.p === 46 && S.a === 20, 'K:P:A จากตารางเกณฑ์จริง = 34:46:20 (' + [S.k, S.p, S.a] + ')');
ok(L['10'].assessment.max_score === 10 && W['11'].score_total === 10 && W['20'].score_total === 10 && W['18'].score_total === 0, 'คาบสอบ 10 คะแนน คาบ 18 ไม่เก็บคะแนน');
ok(W['19'].score_total === 10, 'คาบ 19 ยัง 10 คะแนน');

// ---- 1) เกณฑ์คาลิมบ้า P3-P10 ไม่อ้างว่าระบบให้คะแนนเอง ----
for (let p = 3; p <= 10; p++) {
  const t = zw(flat([W[p].rubric, W[p].tools, W[p].activities]));
  ok(!/Bell Curve|วัดค่ามิลลิวินาที|ms\b|ค่าเบี่ยงเบนเวลา|ระบบ(ให้คะแนน|ประเมิน|คำนวณ)อัตโนมัติ/i.test(t), 'P' + p + ' ไม่มีถ้อยคำให้ระบบให้คะแนน/วัด ms เอง');
}
const rubM = read('app/js/rubric-matrix.js');
ok(/ครูฟังการบรรเลง/.test(rubM) && !/อัตโนมัติ[^\n]{0,30}ระดับ/.test(rubM.split('ครูฟังการบรรเลง')[1].slice(0, 300)), 'หน้าครู: ครูฟังและให้ระดับเอง ระบบเก็บหลักฐานเท่านั้น');

// ---- 3) คาบ 11/20 ----
[11, 20].forEach(p => { const t = zw(flat(W[p])); ok(/ข้อสอบ 20 ข้อ\) 10 คะแนน/.test(t) && !/เก็บสะสม\s*10/.test(t), 'P' + p + ' มีเฉพาะ "สอบ 10" ไม่มีเก็บสะสม 10 ซ้ำ'); });

// ---- 4) หัวข้อคาบ 18 ----
ok(!/กรณีศึกษา/.test(zw(W[18].topic)) && !/กรณีศึกษา/.test(zw(L['17'].title || L['17'].topic || '')), 'หัวข้อคาบ 18 ไม่มี "กรณีศึกษา"');
['app/data/academic_docs.js', 'app/data/lessons.js', 'app/data/wk5_plans.js'].forEach(f => ok(!/สังคมท้องถิ่น\s+กรณีศึกษา/.test(zw(read(f))), f + ' ไม่มีหัวข้อคาบ 18 แบบเดิม'));

// ---- 6) คาบ 18/19 ----
const t19 = zw(flat(W[19]));
ok(/คาบที่ 18 ไม่เก็บคะแนน/.test(zw(flat(W[18]))) && /ตั้งแต่คาบที่ 18/.test(t19) && /ไม่เปลี่ยนน้ำหนักรวม 10 คะแนน/.test(t19), 'ข้อความ วก.5 คาบ 18/19 ตามที่ครูตัดสิน');
const lab = PP.labels('M1', 18); ok(lab.kind === 'unscored-task' && lab.evalPeriod === 19 && /ประเมินรวมในคาบที่ 19/.test(lab.max), 'ป้ายนักเรียนคาบ 18 ไม่เก็บคะแนน → ประเมินรวมคาบ 19: ' + lab.max);
ok(PP.get('M1', 18).submitKinds.join() === 'text,link' && PP.get('M1', 18).kind === 'task', 'คาบ 18 ส่งงานข้อความ/ลิงก์ได้');
const store = {}; global.window = global; global.Store = { load: (k, d) => (k in store ? store[k] : d), save: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; }, getAllSubmissions: () => ({ 'ม.1/1_p18_90001': { content: 'ตัวอย่าง', url: 'https://example.org/x' } }) };
const GO = require('../app/js/group-observation.js');
ok(GO.CRITERIA.length === 2 && GO.isObservationPeriod(18) && GO.isObservationPeriod(19) && !GO.isObservationPeriod(10), 'ผลสังเกต 2 เกณฑ์ ใช้ได้เฉพาะคาบ 18-19');
ok(GO.set('ม.1/1', 19, '90001', { research: 3, role: 4, note: 'ตัวอย่างบันทึก' }).ok && GO.get('ม.1/1', 19, '90001').role === 4, 'บันทึก/อ่านผลสังเกตคาบ 19');
ok(!GO.set('ม.1/1', 10, '90001', { research: 3 }).ok, 'คาบอื่นบันทึกไม่ได้');
ok(GO.get('ม.1/1', 18, '90001').research === 0 && GO.get('ม.1/1', 19, '90002').role === 0, 'แยกตามคาบ/นักเรียน');
ok(GO.submission('ม.1/1', 18, '90001').url === 'https://example.org/x' && /งานที่ส่งในคาบที่ 18/.test(GO.panelHtml('ม.1/1', 19, '90001')) && /ผลสังเกตที่บันทึกไว้ในคาบที่ 18/.test(GO.panelHtml('ม.1/1', 19, '90001')), 'แผงคาบ 19 แสดงงานและผลสังเกตจากคาบ 18');
ok(!/คะแนน/.test(GO.panelHtml('ม.1/1', 18, '90001').replace(/ไม่เก็บคะแนน|ไม่ได้ถูกคำนวณเป็นคะแนนอัตโนมัติ|นำไปประเมินรวม/g, '')) , 'แผงผลสังเกตไม่ให้ตัวเลขคะแนน');
ok(Object.keys(store).join() === GO.KEY, 'เก็บในคีย์เดียว ' + GO.KEY);

// ---- 7) เนื้อเพลง ----
const LC = require('../app/js/lyric-core.js');
ok(LC.defaultSettings('ode_to_joy').mode === 'draft_vote' && LC.defaultSettings('joy_to_the_world').mode === 'one_per_note', 'ค่าเริ่มต้น P8-9 โหวต / P10 หนึ่งคนต่อโน้ต');
ok(LC.defaultSettings('ode_to_joy').selfVote === false && LC.defaultSettings('ode_to_joy').showTally === 'afterClose', 'ห้ามโหวตตัวเอง · แสดงผลหลังปิดโหวต');
const ui = read('app/js/lyric-studio.js'); ok(!/รอครูยืนยัน/.test(ui), 'หน้าจอไม่มีป้าย "รอครูยืนยัน" ของกติกาที่ครูตัดสินแล้ว');
ok(/โหวตเนื้อของกลุ่มใน Lyric Studio/.test(zw(flat([W[8], W[9]]))) && !/โหวตเนื้อของกลุ่มใน Lyric Studio/.test(zw(flat(W[10]))), 'วก.5 P8-9 มีขั้นโหวตใน Lyric Studio, P10 ไม่มี');

// ---- 9) ชื่อโครงการ / PDPA / ช่วงคลิป ----
const D = require('../app/data/evidence_config.js'), C = require('../app/js/evidence-core.js'), cfg = C.mergeConfig(D, null);
ok(cfg.alignmentLabel === 'โครงการพัฒนาวิชาการของโรงเรียน' && cfg.alignmentLabelConfirmed === false, 'ชื่อโครงการตั้งต้นเป็นกลาง ยังไม่ยืนยัน');
ok(C.mergeConfig(D, { alignmentLabel: 'พัฒนาวิชาการสู่ความเป็นเลิศ' }).alignmentLabel === 'โครงการพัฒนาวิชาการของโรงเรียน', 'ค่าเก่าที่ยังไม่ยืนยัน → กลับเป็นชื่อกลาง');
ok(C.mergeConfig(D, { alignmentLabel: 'พัฒนาวิชาการสู่ความเป็นเลิศ', alignmentLabelConfirmed: true }).alignmentLabel === 'พัฒนาวิชาการสู่ความเป็นเลิศ', 'ครูยืนยันแล้ว → ใช้ชื่อที่ครูตั้ง');
ok(cfg.clip.periods.join() === '9,10,13,15,19' && cfg.clip.requireConsent === true, 'ช่วงคลิปตั้งต้น 9,10,13,15,19 และต้องมีความยินยอม');
ok(C.mergeConfig(D, { clip: { periods: [3, '5', 5, 99, 'x'], requireConsent: false } }).clip.periods.join() === '3,5' && C.mergeConfig(D, { clip: { requireConsent: false } }).clip.requireConsent === true, 'ครูปรับช่วงคาบได้ (กรองค่าผิด) แต่ปิดความยินยอมไม่ได้');
const base = { title: 'คลิปทดสอบ', pathways: ['innovation'], kind: 'video', date: '2026-10-28', source: 'ครูถ่าย', period: 9, studentClip: true, studentIds: ['a', 'b'] };
const yes = id => id === 'a' || id === 'b';
ok(C.validateItem(base, cfg, yes).length === 0, 'มีความยินยอมครบ + อยู่ในช่วง → บันทึกได้');
ok(C.validateItem(base, cfg).length === 1 && /ความยินยอม/.test(C.validateItem(base, cfg)[0]), 'ไม่มีตัวตรวจความยินยอม → ไม่ผ่าน (fail-closed)');
ok(C.validateItem(base, cfg, id => id === 'a').some(e => /ยังไม่มีความยินยอม.*b/.test(e)), 'มีนักเรียนที่ไม่ยินยอม 1 คน → ไม่ผ่านและบอกว่าใคร');
ok(C.validateItem(Object.assign({}, base, { period: 12 }), cfg, yes).some(e => /นอกช่วงเก็บคลิป/.test(e)), 'คาบนอกช่วง → ไม่ผ่าน');
ok(C.validateItem(Object.assign({}, base, { studentIds: [] }), cfg, yes).some(e => /นักเรียนที่ปรากฏ/.test(e)), 'ไม่ระบุนักเรียน → ไม่ผ่าน');
ok(C.validateItem(Object.assign({}, base, { kind: 'doc' }), cfg, yes).some(e => /ภาพถ่าย/.test(e)), 'ชนิดไม่ใช่ภาพ/วิดีโอ → ไม่ผ่าน');
ok(C.validateItem(Object.assign({}, base, { studentClip: false, studentIds: [], period: 12 }), cfg).length === 0, 'หลักฐานที่ไม่มีนักเรียนปรากฏไม่ถูกบังคับ');
ok(C.normalizeItem(base, cfg).studentIds.join() === 'a,b', 'เก็บรายชื่อนักเรียนที่ปรากฏ');
const hub = read('app/js/evidence-hub.js'); ok(/consentOf/.test(hub) && /validateItem\(raw, cfg, this\.consentOf\)/.test(hub), 'ศูนย์หลักฐานส่งตัวตรวจความยินยอมเข้าประตูบันทึก');
const doc = read('docs/PDPA_CONSENT_DRAFT_TH.md');
ok(/ฉบับร่างต้นแบบ/.test(doc) && /ไม่ใช่คำแนะนำทางกฎหมาย/.test(doc) && /ฝ่ายวิชาการ/.test(doc) && /ภาคเรียน/.test(doc) && /ถอนความยินยอม/.test(doc), 'เอกสาร PDPA ระบุว่าเป็นร่าง/ไม่ใช่คำแนะนำกฎหมาย/ลงนามรายภาค/ฝ่ายวิชาการอนุมัติ');
ok(!/\d+\s*%|100\s*%|ผู้เชี่ยวชาญ 3|IOC/.test(doc), 'เอกสาร PDPA ไม่มีตัวเลขผลลัพธ์/ผู้เชี่ยวชาญที่ไม่มีข้อมูลจริง');

// ---- โค้ดใหม่ ----
['app/js/group-observation.js', 'tools/curriculum/score_totals_report.js', 'tools/curriculum/patch_teacher_decisions_20261028.py'].forEach(f => ok(!/Math\.random/.test(read(f)), f + ' ไม่ใช้ Math.random'));
const sw = read('app/sw.js'), idx = read('app/index.html');
ok(/group-observation\.js/.test(sw) && /group-observation\.js\?v=/.test(idx), 'group-observation.js อยู่ใน sw.js และ index.html');
console.log('test_t88_decisions: ' + n + ' checks OK');
