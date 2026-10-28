// ศูนย์หลักฐาน คศ.4 — ตรรกะสถิติ/ส่งออก/หลักฐาน (ไม่มีข้อมูลสมมติ, ไม่มีชื่อนักเรียนในไฟล์วิจัย)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const D = require('../app/data/evidence_config.js');
const C = require('../app/js/evidence-core.js');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const near = (a, b, e, m) => ok(Math.abs(a - b) <= e, `${m}: ${a} ≈ ${b}`);
const cfg = C.mergeConfig(D, null);

// --- สถิติเทียบค่าอ้างอิงจาก scipy.stats.ttest_rel (คำนวณภายนอก) ---
let s = C.pairedStats([1, 2, 3, 4, 5], [2, 4, 4, 6, 8], 4);
near(s.t, 4.810702354, 1e-6, 't (ตัวอย่างมือคำนวณ)'); ok(s.df === 4, 'df'); near(s.p, 0.0085809187, 1e-6, 'p'); near(s.dz, 2.1514114968, 1e-6, 'dz');
const a = [2, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 3, 1, 2, 3, 3];
const b = [1, 3, 3, 2, 2, 3, 2, 1, 2, 2, 1, 3, 4, 4, 1, 4, 2, 3, 1, 1, 3, 1, 1, 3, 4];
s = C.pairedStats(a, b, 4);
near(s.t, 2.1908902300206643, 1e-9, 't (scipy)'); near(s.p, 0.038406944516837814, 1e-9, 'p (scipy)'); near(s.dz, 0.4381780460041329, 1e-9, 'dz (scipy)');
near(s.ci95[0], 0.023185400464621586, 1e-6, 'CI low (scipy)'); near(s.ci95[1], 0.7768145995353785, 1e-6, 'CI high (scipy)');
near(C.tCrit(24, 0.05), 2.0638985616280245, 1e-6, 't critical df=24');
ok(C.sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 test vector');
ok(C.sha256Hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256 empty');
// gain (Hake) = (post-pre)/(max-pre)
near(C.pairedStats([1, 2], [3, 3], 4).gain, (3 - 1.5) / (4 - 1.5), 1e-9, 'normalized gain');
// n ต่ำ/ผลต่างคงที่ → ไม่เดาค่า
ok(C.pairedStats([], [], 4).t === null && C.pairedStats([], [], 4).meanPre === null, 'n=0 → null');
ok(C.pairedStats([2], [3], 4).t === null && C.pairedStats([2], [3], 4).p === null, 'n=1 → ไม่มี t/p');
const same = C.pairedStats([1, 2, 3], [2, 3, 4], 4); ok(same.t === null && same.dz === null && /SD=0/.test(same.note), 'ผลต่างคงที่ (SD=0) → ไม่คำนวณ t/d แต่บอกเหตุผล');
ok(C.fmt(null) === '–' && C.fmtP(null) === '–', 'ค่าว่างแสดง –');

// --- ข้อมูลรายคาบ → ก่อน/หลัง/เกณฑ์ ---
const rows = [];
const lv = { 3: [1, 2, 2, 3, 2, 1], 9: [3, 3, 4, 4, 3, 2] };
lv[3].forEach((v, i) => rows.push({ id: '9000' + i, className: 'ม.1/1', period: 3, K: v, P: v, A: v }));
lv[9].forEach((v, i) => rows.push({ id: '9000' + i, className: 'ม.1/1', period: 9, K: v, P: v, A: null }));
rows.push({ id: '90099', className: 'ม.1/1', period: 9, K: 4, P: 4, A: 4 }); // มีเฉพาะหลัง → ไม่ถูกจับคู่
let pts = C.pickPoints(rows, cfg, 2);
ok(pts.ok && pts.baseline[0] === 3 && pts.after[0] === 9, 'auto: คาบแรก vs คาบล่าสุดที่มีข้อมูล');
let cmp = C.compare(rows, cfg, pts);
ok(cmp.n === 6, 'จับคู่เฉพาะคนที่มีครบสองจุด (6 ไม่ใช่ 7)');
ok(cmp.dims.A.n === 0 && cmp.dims.A.meanPost === null, 'ด้าน A ที่หลังไม่ได้ประเมิน → ไม่มีค่า (ไม่ใส่ค่าแทน)');
ok(cmp.dims.K.pctBefore.pct === 1 / 6 * 100 && cmp.dims.K.pctBefore.count === 1, '% ถึงระดับ 3 ก่อน = 1/6');
ok(cmp.dims.K.pctAfter.count === 5 && cmp.dims.K.pctAfter.met === true, '% ถึงระดับ 3 หลัง = 5/6 ≥ 60%');
const cfg2 = C.mergeConfig(D, { criterion: { level: 4, pct: 60 } });
ok(C.compare(rows, cfg2, pts).dims.K.pctAfter.met === false, 'เปลี่ยนเกณฑ์เป็นระดับ 4 → ไม่ผ่าน (เกณฑ์ตั้งค่าได้)');
ok(!C.pickPoints(rows.filter(r => r.period === 3), cfg, 2).ok, 'มีคาบเดียว → ยังวิเคราะห์ก่อน–หลังไม่ได้');
ok(!C.pickPoints([], cfg, 2).ok, 'ไม่มีข้อมูล → ไม่ ok');
const manual = C.pickPoints(rows, C.mergeConfig(D, { measure: { mode: 'periods', baselinePeriods: [3], afterPeriods: [9] } }), 2);
ok(manual.ok && manual.mode === 'periods', 'เลือกคาบเอง');
const pp = C.perPeriod(rows, cfg); ok(pp.length === 2 && pp[0].period === 3 && pp[1].n === 7, 'รายคาบ');

// --- CSV ไม่ระบุตัวตน ---
const salt = 'testsalt';
const csv = C.researchCSV(rows, cfg, salt, pts, 'ม.1/1');
ok(!/9000\d/.test(csv.replace(/S[0-9A-F]{8}/g, '')), 'CSV วิจัยไม่มีรหัสนักเรียนจริง');
ok(/^รหัสแทนตัวตน,/.test(csv) && !/ชื่อ|นามสกุล/.test(csv.split('\r\n')[0]), 'หัวตารางไม่มีชื่อ');
ok(C.pseudonym('90000', salt) === C.pseudonym('90000', salt) && C.pseudonym('90000', salt) !== C.pseudonym('90000', 'other'), 'รหัสแทนตัวตนคงที่ต่อเกลือ และเปลี่ยนเมื่อเกลือเปลี่ยน');
ok(/^S[0-9A-F]{8}$/.test(C.pseudonym('90000', salt)), 'รูปแบบรหัส');
ok(C.toCSV(['a'], [['=HYPERLINK("x")'], ['-5'], ['@x']]).indexOf("'=HYPERLINK") > 0 && C.toCSV(['a'], [[-5]]).indexOf("'-5") < 0, 'กัน CSV injection แต่ตัวเลขติดลบจริงไม่ถูกแก้');
ok(C.summaryCSV(cmp, cfg, 'ม.1/1').split('\r\n').length >= 5, 'summary CSV');
ok(C.barChartBeforeAfter(cmp).indexOf('<svg') === 0 && C.barChartPctPeriods(pp, cfg).indexOf('<svg') === 0, 'SVG charts');
ok(C.barChartPctPeriods([], cfg).indexOf('ยังไม่มีข้อมูล') > 0, 'กราฟว่างบอกว่าไม่มีข้อมูล');

// --- แบบสอบถาม ---
const empty = C.scoreQuestionnaire(cfg, []); ok(empty.overall === null && empty.items.every(i => i.mean === null), 'ไม่มีผู้ตอบ → ไม่มีค่าเฉลี่ย');
const mk = v => { const o = {}; cfg.questionnaire.items.forEach(i => { o[i.id] = v; }); return { answers: o, comments: [] }; };
let sc = C.scoreQuestionnaire(cfg, [mk(5), mk(4), mk(3)]);
near(sc.overall.mean, 4, 1e-9, 'ค่าเฉลี่ยรวม'); ok(sc.overall.label === 'มาก' && sc.overall.met === true, 'แปลผล 4.00 = มาก (≥3.51)');
sc = C.scoreQuestionnaire(cfg, [mk(5), mk(5)]); ok(sc.overall.label === 'มากที่สุด', '5.00 = มากที่สุด');
sc = C.scoreQuestionnaire(cfg, [mk(2), mk(3)]); ok(sc.overall.label === 'น้อย' && sc.overall.met === false, '2.50 = น้อย (ช่วง 1.51-2.50) และไม่ผ่าน 3.51');
sc = C.scoreQuestionnaire(cfg, [mk(5), mk(9)]); ok(sc.invalid === 1 && sc.nValid === 1, 'คำตอบนอกช่วงถูกข้าม ไม่คิดคะแนน');
ok(C.likertLabel(1.2, cfg) === 'น้อยที่สุด' && C.likertLabel(2.0, cfg) === 'น้อย', 'ช่วงแปลผล');
ok(/ไม่ต้องใส่ชื่อ/.test(C.questionnaireText(cfg)), 'แบบสอบถามพิมพ์แจกไม่เก็บชื่อ');
ok(!/ชื่อ/.test(C.questionnaireCSV(cfg, [mk(5)]).split('\r\n')[0]), 'CSV คำตอบไม่มีคอลัมน์ชื่อ');

// --- หลักฐาน ---
const good = { title: 'แผน วก.5', pathways: ['outcome'], kind: 'doc', date: '2026-10-28', source: 'ครู' };
ok(C.validateItem(good, cfg).length === 0, 'หลักฐานครบ → ผ่าน');
ok(C.validateItem(Object.assign({}, good, { pathways: [] }), cfg).length === 1, 'ไม่มีเส้นทาง → ไม่ผ่าน (ต้อง ≥ 1)');
ok(C.validateItem(Object.assign({}, good, { pathways: ['nope'] }), cfg).length === 1, 'เส้นทางที่ไม่มีอยู่ → ไม่ผ่าน');
ok(C.validateItem(Object.assign({}, good, { date: '28/10/2026' }), cfg).length === 1, 'วันที่ผิดรูปแบบ → ไม่ผ่าน');
ok(C.validateItem(Object.assign({}, good, { source: ' ' }), cfg).length === 1 && C.validateItem(Object.assign({}, good, { title: '' }), cfg).length === 1, 'ต้องมีแหล่งที่มาและชื่อ');
ok(C.normalizeItem(good, cfg).alignment === 'โครงการพัฒนาวิชาการของโรงเรียน', 'ป้ายสอดคล้องตั้งต้น (เป็นกลาง รอครูยืนยันชื่อทางการ)');
ok(C.normalizeItem(good, C.mergeConfig(D, { alignmentLabel: 'ป้ายอื่น' })).alignment === 'ป้ายอื่น', 'ป้ายสอดคล้องตั้งค่าได้');
let board = C.buildBoard(cfg, []);
ok(board.length === 5 && board.every(b => b.collected === 0 && b.missing.length === b.total), 'ไม่มีหลักฐาน → ทุกเส้นทางขาดทั้งหมด');
board = C.buildBoard(cfg, [C.normalizeItem(good, cfg)]);
ok(board[0].checklist.filter(c => c.ok).map(c => c.id).join() === 'o_plans', 'หลักฐานชนิดเอกสาร → ติ๊ก o_plans (ตามชนิด) ส่วนอื่นยังขาด');
const auto = C.normalizeItem(Object.assign({}, good, { kind: 'doc', pathways: ['mentoring'], auto: true }), cfg);
ok(C.buildBoard(cfg, [auto])[4].collected === 0, 'รายการอัตโนมัติที่ไม่ระบุข้อตรวจ ไม่ถูกนับเป็นหลักฐาน');
ok(C.buildBoard(cfg, [Object.assign({}, auto, { checklist: 'm_log' })])[4].collected === 1, 'รายการอัตโนมัติที่ระบุข้อตรวจ นับได้');
const multi = C.normalizeItem(Object.assign({}, good, { pathways: ['outcome', 'innovation', 'research'] }), cfg);
ok([0, 1, 2].every(i => C.buildBoard(cfg, [multi])[i].items.length === 1), 'หลักฐานชิ้นเดียวผูกได้หลายเส้นทาง');
ok(/^วันที่,ชื่อหลักฐาน/.test(C.evidenceCSV([multi], cfg)), 'evidence CSV');
ok(C.boardMarkdown(cfg, C.buildBoard(cfg, []), 'research').indexOf('วิจัย') > 0, 'board markdown ต่อเส้นทาง');

// --- เอกสารนวัตกรรม: ไม่มีข้อมูล = ไม่มีตัวเลขผลลัพธ์ ---
const dossEmpty = C.buildDossier({ cfg, outcome: C.compare([], cfg, C.pickPoints([], cfg, 2)), className: 'ม.1/1', questionnaire: C.scoreQuestionnaire(cfg, []), items: [], today: '2026-10-28' });
ok(/\[ครูระบุ:/.test(dossEmpty) && /\[ยังไม่มีข้อมูล:/.test(dossEmpty), 'ช่องว่าง = ตัวแทน');
ok(!/\| (K|P|A|รวม) \|/.test(dossEmpty) && !/ก่อน \d/.test(dossEmpty) && !/ค่าเฉลี่ยรวม \d/.test(dossEmpty), 'ไม่มีข้อมูล → ไม่มีตารางผล/ตัวเลขผลลัพธ์');
const dossData = C.buildDossier({ cfg, outcome: cmp, className: 'ม.1/1', questionnaire: sc, items: [multi], today: '2026-10-28' });
ok(/\| K \| 6 \|/.test(dossData) && /ผลต่าง/.test(dossData), 'มีข้อมูล → ตารางผลจากข้อมูลจริง');
ok(C.markdownToHtml(dossData).indexOf('<table>') > 0 && C.markdownToHtml('# <b>x</b>').indexOf('&lt;b&gt;') > 0, 'HTML escape');
ok(/ฉบับร่าง/.test(C.consentDraft(cfg)) && /PDPA/.test(C.consentDraft(cfg)) && /\[ครูระบุ:/.test(C.consentDraft(cfg)), 'ร่างหนังสือยินยอมระบุว่าเป็นร่าง + PDPA + ช่องให้ครูกรอก');
ok(/Cohen/.test(C.methodNote(cfg, cmp)) && !/\d\.\d\d\d/.test(C.methodNote(cfg, null)), 'method note ไม่มีตัวเลขผลวิจัย');
ok(cfg.designs.length >= 5 && C.designMarkdown(cfg).indexOf('R&D') > 0, 'รูปแบบวิจัย ≥ 5');

// --- ZIP: เปิดด้วย python zipfile ได้ และเนื้อหาครบ ---
const zip = C.zipStore([{ name: 'a_ไทย.txt', content: 'สวัสดี' }, { name: 'b.csv', content: C.withBOM(csv) }]);
const f = path.join(os.tmpdir(), 'ev_core_test.zip'); fs.writeFileSync(f, Buffer.from(zip));
const py = cp.spawnSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("|".join(sorted(z.namelist())));print(z.read("a_ไทย.txt").decode("utf8"))', f], { encoding: 'utf8' });
if (py.status === 0) { ok(/a_ไทย.txt\|b.csv/.test(py.stdout) && /สวัสดี/.test(py.stdout), 'ZIP เปิดได้ (zipfile.testzip ผ่าน)'); } else console.log('  (ข้าม zip test: ไม่มี python3)');
ok(C.crc32(Array.from(Buffer.from('123456789'))) === 0xCBF43926, 'CRC32 test vector');
ok(C.pathwayReport(cfg, C.buildBoard(cfg, [])).split('## ').length === 6, 'pathway report ครบ 5 เส้นทาง');
console.log(`test_evidence_core: ${n} checks OK`);
