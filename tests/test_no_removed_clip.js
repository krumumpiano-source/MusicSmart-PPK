/* t73u: คลิป/สารคดีคาบ 18 เดิมของ วก.5 หาไม่ได้จริง → t76u: ครูไม่เอาการเล่ากรณีศึกษา แทนด้วย "ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม (กลุ่มละ 1 มิติ) สมาชิกมีหน้าที่แตกต่างกัน 8 บทบาท" + แผนภาพ 5 มิติในแอป
 * เทสต์นี้ยืนยันว่าชื่อคลิปเดิม/ไฟล์/ช่องสื่อเดิมไม่เหลืออยู่ในไฟล์ใดของโปรเจกต์ (ไม่รวม scratch/ = ที่สำรองไฟล์เดิมโดยตั้งใจ, node_modules, .git)
 * ข้อความเดิมประกอบจากท่อนสั้น ๆ เพื่อไม่ให้เทสต์นี้เองเก็บชื่อเต็มไว้ */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(n, c, x) { if (c) pass++; else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } }
const T = ['พลังแห่ง', 'ดนตรี: จากการบำบัด'].join('');
const BAN2 = [['ครู', 'เล่า'].join(''), ['จับคู่', 'เล่า'].join('')]; // t76u: ถ้อยคำที่ครูไม่เอา (ท่อนสั้นเพื่อไม่ให้เทสต์เก็บคำเต็มไว้)
const BAD = [T, BAN2[0], BAN2[1], ['คลิป', 'สาร', 'คดี'].join(''), ['คลิป', 'กรณี', 'ศึกษา'].join(''), ['music_influence', '_cases'].join(''), ['p18_case', '_clip'].join(''), ['กรณีศึกษาจาก', 'คลิป'].join('')];
const SKIP = new Set(['scratch', 'node_modules', '.git', 'logs']);
const EXT = /\.(js|json|html|css|md|py|txt|ps1|bat|csv|webmanifest|gs)$/i;
const hits = [];
(function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (SKIP.has(e.name) || /^backup_/.test(e.name)) return;
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    if (!EXT.test(e.name) || fs.statSync(f).size > 6e6) return;
    const t = fs.readFileSync(f, 'utf8').replace(/\u200b/g, '');
    BAD.forEach(b => { if (t.indexOf(b) >= 0) hits.push(path.relative(ROOT, f) + ' ⟵ ' + b); });
  });
})(ROOT);
check('ไม่มีชื่อ/ไฟล์/ช่องสื่อของคลิปคาบ 18 เดิมเหลือในไฟล์ใด (รวม sw.js, wk5_plans, academic_docs, manifest, routes)', hits.length === 0, hits.slice(0, 5).join(' | '));
// ไฟล์/ช่องที่ต้องหายไป
check('โฟลเดอร์ p18 ไม่มีไฟล์สื่อ/ช่องบังคับ (README เป็นข้อความทั่วไปของคาบที่ไม่มีช่อง)', !fs.existsSync(path.join(ROOT, 'app/media/m1/p18')) || fs.readdirSync(path.join(ROOT, 'app/media/m1/p18')).every(f => /^README\./i.test(f)) && !/ช่องสื่อที่ต้อง|คลิป/.test(fs.readFileSync(path.join(ROOT, 'app/media/m1/p18/README.txt'), 'utf8').replace('วิดีโอ mp4', '')));
const man = fs.readFileSync(path.join(ROOT, 'app/data/media_manifest.js'), 'utf8');
check('media_manifest ไม่มีช่องคาบ 18', !/"period":\s*18\b/.test(man));
// กิจกรรมใหม่ต้องมาจาก วก.5 (ที่แก้แล้ว) และสื่อ P18 ต้องมีจริง
const W = new Function(fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8') + ';return WK5_PLANS;')().M1[18];
const flat = JSON.stringify(W);
const intro = W.activities.intro.items.join(' '), teach = W.activities.teach.items.join(' ');
check('วก.5 คาบ 18: ขั้นนำ = ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม (กลุ่มละ 1 มิติ) สมาชิกมีหน้าที่แตกต่างกัน', /ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม/.test(intro) && /รับผิดชอบ 1 มิติ/.test(intro) && /หน้าที่แตกต่างกัน/.test(intro), intro.slice(0, 120));
check('วก.5 คาบ 18: ขั้นสอน แบ่งกลุ่มละ 1 มิติไม่ซ้ำ + 8 บทบาทตาม วก.5', /กลุ่มละ 1 มิติไม่ซ้ำกัน/.test(teach) && /แบ่ง 8 บทบาท: ผู้อำนวยการแคมเปญ/.test(teach) && /โฆษกสรุปผล/.test(teach));
check('วก.5 คาบ 18: จุดประสงค์ P = ศึกษาค้นคว้าตามมิติของกลุ่ม', /ศึกษาค้นคว้าอิทธิพลของดนตรีตามมิติที่กลุ่มรับผิดชอบ/.test(W.objectives.p.join(' ')));
const ban = BAN2.filter(b => flat.indexOf(b) >= 0);
check('วก.5 คาบ 18: ไม่มีถ้อยคำที่ครูไม่เอา', ban.length === 0, ban.join(','));
// คาบ 17/19 ต้องสอดคล้อง: ไม่อ้างกิจกรรมเก่า, คาบ 19 นำเสนองานกลุ่ม 8 คนตามบทบาท
const P17 = JSON.stringify(new Function(fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8') + ';return WK5_PLANS;')().M1[17]), P19 = JSON.stringify(new Function(fs.readFileSync(path.join(ROOT, 'app/data/wk5_plans.js'), 'utf8') + ';return WK5_PLANS;')().M1[19]);
check('คาบ 17/19: ไม่มีถ้อยคำที่ครูไม่เอา และไม่อ้างคลิป', BAN2.every(b => P17.indexOf(b) < 0 && P19.indexOf(b) < 0) && !/คลิป(สาร|กรณี)/.test(P17 + P19));
check('คาบ 19: นำเสนองานกลุ่ม 8 คนตามบทบาท (ต่อเนื่องจากคาบ 18)', /8 คน/.test(P19) && /บทบาท/.test(P19));
// lessons.js คาบ 18 (ไฟล์เดิม) สอดคล้อง: บทบาท 8 ข้อความตรง วก.5
const LS = fs.readFileSync(path.join(ROOT, 'app/data/lessons.js'), 'utf8');
check('lessons.js คาบ 18: ใช้ 8 บทบาทตาม วก.5 และมอบหมายงานค้นคว้ากลุ่ม', /ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม/.test(LS) && /ผู้อำนวยการแคมเปญ, นักวิจัยชุมชน/.test(LS));
check('วก.5 คาบ 18: สื่อ = แผนภาพ 5 มิติในแอป', (W.media || []).some(m => /แผนภาพ 5 มิติ/.test(m)) && !(W.media || []).some(m => /\(video\)/.test(m)));
check('วก.5 คาบ 18: จุดประสงค์ P ไม่อ้างคลิป', !/จากคลิป/.test(W.objectives.p.join(' ')));
const ks = new Function('var module={exports:{}};' + fs.readFileSync(path.join(ROOT, 'app/data/kalimba_media.js'), 'utf8') + ';return typeof KALIMBA_MEDIA!=="undefined"?KALIMBA_MEDIA:module.exports;')();
const st = (ks.mediaStatus && ks.mediaStatus.M1 && ks.mediaStatus.M1[18]) || [];
check('kalimba_media: สื่อคาบ 18 ไม่มีสถานะไฟล์หาย', st.every(s => !/missing/.test(JSON.stringify(s))), JSON.stringify(st).slice(0, 200));
// ค่าน้ำหนัก/คะแนนคาบ 18 เดิมไม่เปลี่ยน (ไม่เก็บคะแนน)
check('คาบ 18 ยังไม่เก็บคะแนน (score_total = 0)', Number(W.score_total || 0) === 0);
console.log('no removed clip: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
