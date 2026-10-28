'use strict';
// สื่อเสียง/วิดีโอรายคาบ: manifest, builder, ตัวเล่น, ความเข้ากันได้มือถือเก่า
global.window = global;
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, d) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } }

const B = require(path.join(ROOT, 'tools/curriculum/build_period_media.js'));
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/curriculum/period_media_source.json'), 'utf8'));
check('source: ทุกช่องมี id/period/kind/label/docRef', src.slots.every(s => s.id && s.period && /^(audio|video)$/.test(s.kind) && s.label && /^วก\.5 คาบ \d+/.test(s.docRef)));
check('source: id ไม่ซ้ำ', new Set(src.slots.map(s => s.id)).size === src.slots.length);
check('source: id ขึ้นต้นด้วย pN_ ตรงเลขคาบ', src.slots.every(s => s.id.indexOf('p' + s.period + '_') === 0));
check('source: ไม่มีลิงก์/ที่มาที่แต่งเอง', !/https?:\/\//.test(JSON.stringify(src.slots)) && src.slots.every(s => !s.url && !s.credit));
check('source: P12 มี 3 เสียงปริศนา', src.slots.filter(s => s.period === 12).length === 3);
check('source: ข้อสอบ P11/P20 ไม่โชว์นักเรียน', src.slots.filter(s => s.exam).every(s => s.studentVisible === false) && src.slots.filter(s => s.exam).length === 2);

// scratch app dir
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm_'));
function put(rel, content) { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); }
let r = B.build(tmp);
check('build เปล่า: ทุกช่อง missing', Object.keys(r.data.slots).every(p => r.data.slots[p].every(s => s.status === 'missing' && !s.file && !s.url)));
put('media/m1/p12/p12_mystery_pipat.MP3', 'x');
put('media/m1/p12/p12_mystery_kruangsai.txt', 'x');       // นามสกุลไม่รับ
put('media/m1/p12/extra_clip.ogg', 'x');                   // ไฟล์เพิ่ม
put('media/m1/p12/meta.json', JSON.stringify({ p12_mystery_mahori: { url: 'https://example.org/a', credit: 'ทดสอบ' }, p12_mystery_pipat: { credit: 'ครู' } }));
put('media/m1/p15/p15_conductor_clip.mp3', 'x');           // ชนิดผิด (ต้องเป็นวิดีโอ)
put('media/m1/p16/meta.json', JSON.stringify({ p16_lanna_sor: { url: 'http://bad' } }));
r = B.build(tmp);
const p12 = r.data.slots[12];
check('จับไฟล์ตามชื่อ ไม่สนตัวพิมพ์', p12[0].status === 'file' && p12[0].file === 'media/m1/p12/p12_mystery_pipat.MP3');
check('นามสกุลที่ไม่รับ = ยัง missing', p12[1].status === 'missing');
check('url https ใน meta.json = link', p12[2].status === 'link' && p12[2].url === 'https://example.org/a' && p12[2].credit === 'ทดสอบ');
check('credit จาก meta', p12[0].credit === 'ครู');
check('ไฟล์เพิ่มเติมขึ้นใน extras', r.data.extras[12] && r.data.extras[12].length === 1 && r.data.extras[12][0].kind === 'audio');
check('ชนิดไฟล์ผิด (mp3 ในช่องวิดีโอ) ไม่นับ', r.data.slots[15][0].status === 'missing');
check('url ไม่ใช่ https ถูกปฏิเสธ + แจ้งปัญหา', r.data.slots[16][0].status === 'missing' && r.problems.some(x => /https/.test(x)));
check('README ของ builder กล่าวถึงทุก id ในคาบ', src.slots.filter(s => s.period === 12).every(s => B.readme(src, 12, src.slots.filter(x => x.period === 12)).indexOf(s.id) !== -1));

// manifest ใน app/data
const mf = fs.readFileSync(path.join(ROOT, 'app/data/media_manifest.js'), 'utf8');
check('media_manifest.js มี marker GENERATED', /GENERATED FILE/.test(mf));
delete require.cache[require.resolve(path.join(ROOT, 'app/data/media_manifest.js'))];
const M = require(path.join(ROOT, 'app/data/media_manifest.js'));
check('manifest ตรงจำนวนช่องกับ source', Object.keys(M.slots).reduce((a, p) => a + M.slots[p].length, 0) === src.slots.length);
check('โฟลเดอร์คาบ + README มีให้ครู', src.slots.every(s => fs.existsSync(path.join(ROOT, 'app/media/m1/p' + (s.period < 10 ? '0' : '') + s.period + '/README.txt'))));

// PeriodMedia
global.PERIOD_MEDIA = r.data;
delete require.cache[require.resolve(path.join(ROOT, 'app/js/period-media.js'))];
const PM = require(path.join(ROOT, 'app/js/period-media.js'));
const t12 = PM.mountHTML('M1', 12, { role: 'teacher' });
const s12 = PM.mountHTML('M1', 12, { role: 'student' });
check('ครู: มี audio player สำหรับไฟล์ที่มี', /<audio controls[^>]*src="media\/m1\/p12\/p12_mystery_pipat\.MP3"/.test(t12));
check('ครู: ช่องที่ขาดเป็นเช็กลิสต์ "ต้องเตรียม" บอกชื่อไฟล์ที่ต้องวาง', /p12_mystery_kruangsai\.mp3/.test(t12) && /data-pm-todo/.test(t12) && /ต้องเตรียม/.test(t12));
check('นักเรียน: ช่องที่ขาดไม่แสดงเลย (ไม่มี "รอครู"/"ยังไม่มีไฟล์"/พาธ)', !/รอครูอัปโหลด|ยังไม่มีไฟล์|ต้องเตรียม|kruangsai/.test(s12));
check('ทุกคาบ: นักเรียนไม่เห็น placeholder ของช่องที่ขาด/ชื่อคลิปที่ไม่มีไฟล์', Object.keys(global.PERIOD_MEDIA.slots).every(k => { const h = PM.mountHTML('M1', Number(k), { role: 'student' }); return !/รอครูอัปโหลด|ยังไม่มีไฟล์|ต้องเตรียม|data-pm-todo/.test(h) && global.PERIOD_MEDIA.slots[k].filter(x => x.status === 'missing').every(x => h.indexOf(x.label) < 0); }));
check('ลิงก์ภายนอกเปิดแท็บใหม่ noopener', /rel="noopener"/.test(s12) && /target="_blank"/.test(s12));
check('ไม่มีที่มา → บอกว่าครูยังไม่ระบุ', /ครูยังไม่ระบุ/.test(s12));
check('คาบที่ไม่มีช่อง = ว่าง', PM.mountHTML('M1', 1, { role: 'student' }) === '');
check('P11 นักเรียนไม่เห็นสื่อข้อสอบ', PM.mountHTML('M1', 11, { role: 'student' }) === '');
check('P11 ครูเห็นช่อง + หมายเหตุระบบสอบ', /ข้อสอบ: ต้องมีตัวเล่นเสียง/.test(PM.mountHTML('M1', 11, { role: 'teacher' })));
check('ป้องกัน XSS ใน credit', (function () { const d = JSON.parse(JSON.stringify(r.data)); d.slots[12][0].credit = '<img src=x onerror=1>'; global.PERIOD_MEDIA = d; const h = PM.mountHTML('M1', 12, { role: 'student' }); global.PERIOD_MEDIA = r.data; return h.indexOf('<img') === -1; })());
const sm = PM.summary();
check('summary นับ have/missing', sm.length === Object.keys(r.data.slots).length && sm.filter(x => x.period === 12)[0].have === 2 && sm.filter(x => x.period === 12)[0].missing === 1);

// compat (มือถือเก่า)
function stripC(t) { return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1'); }
const code = stripC(fs.readFileSync(path.join(ROOT, 'app/js/period-media.js'), 'utf8'));
[['?.', /\?\.[A-Za-z_\[(]/], ['??', /\?\?/], ['=>', /=>/], ['`', /`/], ['let/const', /(^|[^\w.$])(let|const)\s+[\w$\[{]/m], ['gap', /(^|[;{'"\s])gap\s*:/], ['flex/grid', /display\s*:\s*(flex|grid)/], ['includes/assign', /\.(includes|padStart)\(|Object\.(assign|entries|values)\(/]].forEach(b => check('มือถือเก่า: period-media.js ไม่มี ' + b[0], !b[1].test(code), (code.match(b[1]) || [''])[0]));
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
console.log('test_period_media: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
