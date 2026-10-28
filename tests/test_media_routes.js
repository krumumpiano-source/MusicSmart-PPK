/* ป้ายสื่อ = เนื้อหาที่เปิดจริง: ทุกสื่อของ ม.1 ต้องมีเส้นทางประกาศไว้ (MEDIA_ROUTES) และสื่อสำคัญต้องมีเนื้อหาถูกต้อง */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
global.window = global;
const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/data/lessons.js'), 'utf8') + ';this.__L=LESSONS_DATA;', ctx);
const LESSONS = ctx.__L;
global.WK5_PLANS = new Function(fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8') + ';return WK5_PLANS;')();
global.KALIMBA_MEDIA = require(path.join(ROOT, 'app/data/kalimba_media.js'));
global.KalimbaMedia = require(path.join(ROOT, 'app/js/kalimba-media.js'));
const MR = require(path.join(ROOT, 'app/data/media_routes.js'));
global.MEDIA_ROUTES = MR;
global.PERIOD_POLICY = require(path.join(ROOT, 'app/data/period_policy.js'));
global.PeriodPolicy = require(path.join(ROOT, 'app/js/period-policy.js'));
const MV = require(path.join(ROOT, 'app/js/media-views.js'));
const M1 = Array.isArray(LESSONS.M1) ? LESSONS.M1 : Object.values(LESSONS.M1);
const kmItems = {}; Object.keys(KALIMBA_MEDIA.periods.M1).forEach(p => KALIMBA_MEDIA.periods.M1[p].forEach(i => { kmItems[i.id] = i; }));
const CLS = ['digital', 'document', 'equipment', 'teacher', 'external', 'activity'];

const seen = {}; let total = 0;
M1.forEach(l => (l.media || []).forEach(m => {
  total++;
  const r = MR.lookup('M1', m.url);
  check('คาบ ' + l.period + ' "' + m.title.slice(0, 40) + '…": มีเส้นทางประกาศ', !!r, m.url);
  if (!r) return;
  seen[m.url] = true;
  check('route "' + r.route + '" อยู่ในชุดที่รองรับ', MR.ROUTES.indexOf(r.route) >= 0);
  check('cls "' + r.cls + '" ถูกต้อง', CLS.indexOf(r.cls) >= 0);
  (r.kw || []).forEach(k => check('ป้ายคาบ ' + l.period + ' มีคำ "' + k + '" ที่ตรงกับ route ' + r.route, m.title.indexOf(k) >= 0, m.title));
  if (r.route === 'practice') {
    const it = kmItems[r.item];
    check('คาบ ' + l.period + ': ' + r.item + ' มีใน kalimba_media และเป็นคาบเดียวกัน', !!it && it.period === l.period, r.item);
  }
  if (r.route === 'criteria') check('คาบ ' + l.period + ': มี rubric ใน วก.5', !!(WK5_PLANS.M1[l.period] && WK5_PLANS.M1[l.period].rubric && WK5_PLANS.M1[l.period].rubric.length));
  if (r.route === 'equipment') check('อุปกรณ์มีรายการเช็กลิสต์', Array.isArray(r.items) && r.items.length >= 2);
}));
check('ตารางไม่มีแถวเกิน (ทุกแถวถูกใช้)', Object.keys(MR.M1).every(u => seen[u]), Object.keys(MR.M1).filter(u => !seen[u]).join(','));
check('นับสื่อ ม.1 = 31 รายการ', total === 31, String(total));

// ไม่มีโมดอลสำรองกลาง
const appjs = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
check('ไม่มีข้อความโมดอลสำรอง "ยังไม่ได้อัปโหลด"', appjs.indexOf('ยังไม่ได้อัปโหลด') < 0);
check('ไม่มี includes(\'smart_practice\') เปิดสื่อโน้ตรวม', appjs.indexOf("u.includes('smart_practice')") < 0);

// เนื้อหาสำคัญ
const I = MV._internals;
const sc = I.scaleNotes();
check('ตารางสเกล 8 โน้ต C D E F G A B C', sc.map(r => r.letter).join('') === 'CDEFGABC');
check('โซลเฟจ do re mi fa sol la ti do', sc.map(r => r.sol).join(' ') === 'do re mi fa sol la ti do');
check('โน้ตไทย ด ร ม ฟ ซ ล ท ดํ', sc.map(r => r.thai).join(' ') === 'ด ร ม ฟ ซ ล ท ดํ');
check('ตำแหน่งลิ่ม C4=9 (กลาง)', sc[0].tine === 9, String(sc[0].tine));
check('ตำแหน่งลิ่ม C5=5', sc[7].tine === 5, String(sc[7].tine));
check('C4 = เส้นน้อยใต้บรรทัด', /เส้นน้อย/.test(sc[0].staff), sc[0].staff);
check('E4 = เส้นที่ 1, G4 = เส้นที่ 2, B4 = เส้นที่ 3', sc[2].staff === 'เส้นที่ 1' && sc[4].staff === 'เส้นที่ 2' && sc[6].staff === 'เส้นที่ 3', sc.map(r => r.staff).join('|'));
check('F4 = ช่องที่ 1, A4 = ช่องที่ 2, C5 = ช่องที่ 3', sc[3].staff === 'ช่องที่ 1' && sc[5].staff === 'ช่องที่ 2' && sc[7].staff === 'ช่องที่ 3');
const ch = I.scaleChartHTML();
check('ตารางสเกลเป็น <table> จริง', /<table/.test(ch) && (ch.match(/class="mv-row"/g) || []).length === 8);
check('ตาราง 8 ห้อง × 4 จังหวะ', (ch.match(/class="mv-bar"/g) || []).length === 8 && /1 ห้อง = 4 จังหวะ/.test(ch));
check('ค่าตัวโน้ต: ตัวกลม 4 / ตัวขาว 2 / ตัวดำ 1 (ตรง วก.5 คาบ 3)', /ตัวกลม[\s\S]*?4 จังหวะ[\s\S]*ตัวขาว[\s\S]*?2 จังหวะ[\s\S]*ตัวดำ[\s\S]*?1 จังหวะ/.test(ch));
const ac = I.acousticsHTML();
check('acoustics: 17 แถวความถี่', (ac.match(/class="mv-row"/g) || []).length === 17);
check('acoustics: C4 = 261.6 Hz และ E6 = 1318.5 Hz', ac.indexOf('261.6 Hz') > 0 && ac.indexOf('1318.5 Hz') > 0);
check('acoustics: ลิ่มยาวเสียงทุ้ม ลิ่มสั้นเสียงแหลม ตามคาบ 2', /ยาวกว่า[\s\S]*ทุ้ม/.test(ac) && /สั้นกว่า[\s\S]*แหลม/.test(ac));
check('acoustics: บอกว่าความยาวในภาพเป็นภาพประกอบ ไม่ใช่ค่าวัด', /ภาพประกอบ[\s\S]*ไม่ใช่ค่า/.test(ac));
const an = I.anatomyHTML();
check('anatomy: ติดป้าย ภาพประกอบ + มุม 45 องศา + สองมือ', /ภาพประกอบ/.test(an) && /45 องศา/.test(an) && /สองมือ/.test(an));
// criteria ตรงกับ rubric ของ วก.5
[9, 10, 13, 15, 19].forEach(p => {
  const html = I.criteriaHTML(p), rub = WK5_PLANS.M1[p].rubric || [];
  check('criteria คาบ ' + p + ': ทุกด้านของ วก.5 อยู่ในตาราง', rub.length > 0 && rub.every(r => html.indexOf(r.label.replace(/&/g, '&amp;')) >= 0));
});
// แถวสื่อ
const teacherRow = MV.rowHTML({ title: 'x Teacher Approval Dashboard', url: 'academic/media/teacher_approval_dashboard.png' }, 11, 'student', 'M1');
check('นักเรียนไม่เห็นรายการเฉพาะครู', teacherRow === '');
const eq = MV.rowHTML({ title: 'ซองผ้า', url: 'academic/media/cleaning_kit.png' }, 2, 'student', 'M1');
check('อุปกรณ์จริง: เช็กลิสต์ ไม่มีลิงก์เปิด', /อุปกรณ์ที่ต้องเตรียม/.test(eq) && eq.indexOf('mv-open') < 0 && /checkbox/.test(eq));
const miss = MV.rowHTML({ title: 'คลังความรู้ (ทดสอบรายการที่ไม่มีไฟล์)', url: 'academic/media/knowledge_hub.png' }, 1, 'student', 'M1');
check('ไม่มีไฟล์จริง: นักเรียนไม่เห็นอะไรเลย (ไม่มโน ไม่มี placeholder)', miss === '');
const missT = MV.rowHTML({ title: 'คลังความรู้ (ทดสอบรายการที่ไม่มีไฟล์)', url: 'academic/media/knowledge_hub.png' }, 1, 'teacher', 'M1');
check('ไม่มีไฟล์จริง: ครูเห็นเช็กลิสต์ "ต้องเตรียม" ไม่มีปุ่มเปิด', /ต้องเตรียม/.test(missT) && missT.indexOf('mv-open') < 0 && /data-mv-todo/.test(missT));
// คาบ 18: แผนภาพ 5 มิติ (สร้างในแอป แทนคลิปเดิม) — ข้อความ 5 มิติต้องดึงจาก วก.5 ไม่ฮาร์ดโค้ด
const inf = I.influence5HTML(18), infDims = WK5_PLANS.M1[18].activities.teach.items.join(' ').match(/5 มิติ\s*:\s*(1\)[\s\S]*?)(?:\s+นักเรียน|$)/)[1].split(/\s*\d\)\s*/).filter(Boolean).map(s => s.trim());
check('influence5: แสดงครบทุกมิติตาม วก.5 (' + infDims.length + ')', infDims.length === 5 && infDims.every(d => inf.indexOf(d) >= 0));
check('influence5: ติดป้าย ภาพประกอบ + ไม่ใช่ข้อมูลวิจัย + ไม่มีคลิป', /ภาพประกอบ/.test(inf) && /ไม่ใช่ข้อมูลวิจัย/.test(inf) && /ไม่มีคลิป/.test(inf));
check('influence5: ไม่มีตัวเลขสถิติ/เปอร์เซ็นต์ที่ไม่มีที่มา', !/%|ร้อยละ/.test(inf.replace(/<svg[\s\S]*?<\/svg>/, '')));
const infRow = MV.rowHTML({ title: 'แผนภาพ 5 มิติอิทธิพลของดนตรีต่อสังคม', url: 'influence/five_dimensions' }, 18, 'student', 'M1');
check('influence5: นักเรียนเห็นปุ่มเปิด "ดูแผนภาพ"', /mv-open/.test(infRow) && /ดูแผนภาพ/.test(infRow));
check('influence5: ทุกคาบ P18 สื่อใน lessons.js มี route และไม่มีสื่อชนิด missing', M1.filter(l => l.period === 18)[0].media.every(m => { const r = MR.lookup('M1', m.url); return r && r.route !== 'missing'; }));
const sp = MV.rowHTML({ title: 'โมดูล Smart Practice Studio สเกล C Major', url: 'academic/media/smart_practice_c_major.png' }, 3, 'student', 'M1');
check('Smart Practice: ปุ่มเปิดแบบฝึกเล่นได้', /เปิดแบบฝึกเล่นได้/.test(sp));
const m2 = MV.rowHTML({ title: 'เอกสาร ม.2', url: 'academic/media/unknown.pdf' }, 3, 'student', 'M2');
check('ม.2 (ไม่มีตาราง): ไม่ทำให้พัง นักเรียนไม่เห็น placeholder', m2 === '');
console.log('media routes: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
