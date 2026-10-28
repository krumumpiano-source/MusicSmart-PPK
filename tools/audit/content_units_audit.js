#!/usr/bin/env node
/* ตรวจ "วงดนตรีไทย/วงดนตรีสากล/การฟังเพลง" (หน่วย 3-4 คาบ 12-20) ว่าใช้เรียน-สอนได้จริงหรือไม่ — วิเคราะห์จากโค้ด/ข้อมูลแบบ static
 * ใช้: node tools/audit/content_units_audit.js [รากโปรเจกต์] [--json ไฟล์.json] [--md ไฟล์.md]
 * ตรวจ: (1) ไฟล์ JS/CSS ทุกไฟล์: อยู่ใน index.html? อยู่ใน sw.js precache? (2) สื่อทุกชิ้นที่ lessons/วก.5 อ้าง มีไฟล์จริงไหม
 *       (3) คำสำคัญของฟีเจอร์ในโค้ด (4) เสียงในข้อสอบ/ระบบสอบ (5) ช่องสื่อใน media_manifest
 * เป็นการตรวจโค้ด ไม่ใช่การทดสอบใช้งานจริงบนเครื่องนักเรียน */
'use strict';
const fs = require('fs'), path = require('path');
const loadVars = require('./_load_vars.js');
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const rootArg = args.filter((a, i) => a[0] !== '-' && args[i - 1] !== '--json' && args[i - 1] !== '--md')[0];
const ROOT = path.resolve(rootArg || path.join(__dirname, '..', '..'));
const APP = path.join(ROOT, 'app');
const rd = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } };
const exists = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
const out = { root: ROOT, findings: [], periods: {} };
const add = (sev, area, msg) => out.findings.push({ sev, area, msg }); // sev: FAIL | WARN | OK | INFO

if (!fs.existsSync(APP)) { console.error('ไม่พบโฟลเดอร์ app ใน ' + ROOT); process.exit(2); }

/* 1) ไฟล์ asset: index.html / sw.js */
const index = rd(path.join(APP, 'index.html')) || '', sw = rd(path.join(APP, 'sw.js')) || '';
const assets = [];
['js', 'css', 'data'].forEach(d => { const dir = path.join(APP, d); if (fs.existsSync(dir)) fs.readdirSync(dir).forEach(f => { if (/\.(js|css)$/.test(f) && !/\.sample\./.test(f)) assets.push(d + '/' + f); }); });
assets.forEach(a => {
  const inIndex = index.indexOf(a) !== -1, inSw = sw.indexOf(a) !== -1;
  const lazy = !inIndex;
  if (!inSw) add(inIndex ? 'FAIL' : 'WARN', 'cache', a + ' ' + (inIndex ? 'ถูกโหลดใน index.html แต่ไม่อยู่ใน sw.js precache → ออฟไลน์/เปิดครั้งแรกหลังอัปเดตอาจไม่ทำงาน' : 'ไม่อยู่ใน index.html และ sw.js (ไม่ได้ใช้ หรือโหลดแบบ lazy?)'));
  else if (lazy) add('WARN', 'cache', a + ' อยู่ใน sw.js แต่ไม่มี <script>/<link> ใน index.html (โหลดแบบ lazy? ตรวจว่ามีโค้ดโหลดจริง)');
});
const swAssetsMissing = [];
(sw.match(/['"]\.?\/?((?:js|css|data|icons|images|media)\/[^'"]+)['"]/g) || []).forEach(m => { const p = m.replace(/['"]/g, '').replace(/^\.\//, '').replace(/^\//, ''); if (/\.[a-z0-9]+$/i.test(p) && !exists(path.join(APP, p)) && !/\$\{/.test(p)) swAssetsMissing.push(p); });
swAssetsMissing.forEach(p => add('FAIL', 'cache', 'sw.js precache อ้างไฟล์ที่ไม่มี: ' + p + ' → cache.addAll ล้มทั้งชุด (ติดตั้ง SW ไม่ได้)'));
if (/ensemble-explorer/.test(index) || exists(path.join(APP, 'js/ensemble-explorer.js'))) {
  add(sw.indexOf('ensemble-explorer.js') !== -1 ? 'OK' : 'FAIL', 'cache', 'ensemble-explorer.js ' + (sw.indexOf('ensemble-explorer.js') !== -1 ? 'อยู่ใน sw.js' : 'ยังไม่อยู่ใน sw.js precache'));
} else add('INFO', 'ensemble', 'ไม่พบ ensemble-explorer.js ในโปรเจกต์นี้ (ถ้าเป็นโฟลเดอร์จริงควรมี)');

/* 2) ข้อมูล + สื่อที่อ้าง */
function tryLoad(rel, names) { try { return loadVars(path.join(APP, rel), names); } catch (e) { add('WARN', 'data', 'โหลด ' + rel + ' ไม่ได้: ' + e.message); return {}; } }
const L = (tryLoad('data/lessons.js', ['LESSONS_DATA']).LESSONS_DATA) || {};
const W = (tryLoad('data/wk5_plans.js', ['WK5_PLANS']).WK5_PLANS) || {};
const Q = (tryLoad('data/quizzes.js', ['QUIZZES_DATA']).QUIZZES_DATA) || {};
const MM = (tryLoad('data/media_manifest.js', ['PERIOD_MEDIA']).PERIOD_MEDIA) || null;
const lessons = (L.M1 || []).reduce((o, l) => { o[l.period] = l; return o; }, {});
const wk = (W.M1 || W['M1'] || {});
function mediaState(u) {
  if (!u) return 'no-url';
  if (/^https?:\/\//i.test(u)) return 'external';
  if (/^(ensemble|rubric)\//i.test(u.replace(/^\.?\//, '')) || /interactive\/timbre_feldman\.html$/i.test(u)) return 'IN_APP'; // เส้นทางเสมือนที่แอปเปิดเอง ไม่ใช่ไฟล์
  const rel = u.replace(/^\.?\//, '');
  if (exists(path.join(APP, rel))) return 'file';
  return exists(path.join(ROOT, rel)) ? 'NOT_DEPLOYED' : 'MISSING';
}
for (let p = 1; p <= 20; p++) {
  const row = out.periods[p] = { period: p, lesson: !!lessons[p], steps: 0, emptySteps: 0, media: [], wk5Media: 0, slots: null };
  const l = lessons[p];
  if (l) {
    row.steps = (l.steps || []).length;
    row.emptySteps = (l.steps || []).filter(s => !s || !String(s.desc || '').trim()).length;
    (l.media || []).forEach(m => row.media.push({ title: m.title, type: m.type, url: m.url || null, state: mediaState(m.url) }));
  }
  const w = wk[p] || wk[String(p)];
  if (w) { row.wk5Media = (w.media || []).length; row.wk5 = true; }
  if (MM && MM.slots && MM.slots[p]) row.slots = { total: MM.slots[p].length, have: MM.slots[p].filter(s => s.status !== 'missing').length };
  row.media.filter(m => m.state === 'NOT_DEPLOYED').forEach(m => add('FAIL', 'media', 'คาบ ' + p + ' ไฟล์ ' + m.url + ' อยู่นอก app/ (มีในโปรเจกต์แต่ไม่ถูก deploy ขึ้น GitHub Pages)'));
  row.media.filter(m => m.state === 'MISSING').forEach(m => { if (p >= 12 || /audio|video/.test(m.type) || /^academic\//.test(String(m.url))) add('WARN', 'media', 'คาบ ' + p + ' ไฟล์ที่ครูต้องส่ง (ยังไม่มีใน app/): ' + m.url + ' — แอปแสดงแผงสำรองแทน ไม่ปรุงเนื้อหา (' + m.title + ')'); });
}
if (!Object.keys(lessons).length) add('WARN', 'data', 'ไม่พบ LESSONS_DATA.M1');
if (!Object.keys(wk).length) add('WARN', 'data', 'ไม่พบ WK5_PLANS.M1 (โปรเจกต์นี้อาจยังไม่มี วก.5)');
if (!MM) add('WARN', 'media', 'ไม่พบ data/media_manifest.js — ยังไม่ได้ติดตั้งระบบวางไฟล์สื่อรายคาบ');
else Object.keys(MM.slots).forEach(p => MM.slots[p].filter(s => s.status === 'missing').forEach(s => add('WARN', 'media', 'คาบ ' + p + ' รอไฟล์: ' + s.id + ' — ' + s.label)));

/* 3) คำสำคัญของฟีเจอร์ (ค้นใน js/*.js + data/*.js) */
const code = {};
['js', 'data'].forEach(d => { const dir = path.join(APP, d); if (fs.existsSync(dir)) fs.readdirSync(dir).forEach(f => { if (/\.js$/.test(f) && !/^(students)\./.test(f)) code[d + '/' + f] = rd(path.join(dir, f)) || ''; }); });
const all = Object.keys(code).map(k => code[k]).join('\n');
const FEATURES = [
  ['Ensemble Explorer (ผังวง/บัตรเครื่องดนตรี)', /ensemble[-_ ]?explorer|EnsembleExplorer/i],
  ['บัตรเครื่องดนตรี (instrument cards)', /instrument[-_ ]?card|บัตรเครื่องดนตรี|InstrumentCard/i],
  ['Knowledge Hub / คลังความรู้', /knowledge[-_ ]?hub|KnowledgeHub|คลังความรู้/i],
  ['Group Canvas / มอบหมาย 8 บทบาท', /group[-_ ]?canvas|GroupCanvas|8 บทบาท|บทบาท 8/i],
  ['Cross-Learning Log', /cross[-_ ]?learning/i],
  ['Peer Assessment / ประเมินเพื่อน', /peer[-_ ]?assess|PeerAssess|ประเมินเพื่อน/i],
  ['Music Vault / คลังเพลง (ส่งลิงก์เพลงไม่ซ้ำ P16)', /music[-_ ]?vault|MusicVault|ลิงก์เพลง/i],
  ['Feldman form (บทวิจารณ์)', /feldman/i],
  ['Rubric Matrix (P13/15/17/19)', /rubric[-_ ]?matrix|RubricMatrix/i],
  ['Live Polling', /live[-_ ]?poll|LivePoll/i],
  ['ตัวเล่นเสียง (<audio / new Audio)', /<audio|new Audio\(|createElement\(['"]audio/i],
  ['Web Audio (ตัวอย่างเสียงสังเคราะห์)', /AudioContext/]
];
FEATURES.forEach(f => {
  const files = Object.keys(code).filter(k => f[1].test(code[k]));
  add(files.length ? 'OK' : 'WARN', 'feature', f[0] + ': ' + (files.length ? 'พบคำค้นใน ' + files.slice(0, 4).join(', ') + ' (ยังไม่ได้พิสูจน์ว่าใช้งานครบ)' : 'ไม่พบในโค้ด'));
});
/* 4) เสียงในข้อสอบ */
const quizAudioField = /["']?(audio|audioUrl|audio_url|sound|media)["']?\s*:/i.test(JSON.stringify(Q) ? rd(path.join(APP, 'data/quizzes.js')) || '' : '');
const engine = ['js/quiz-engine.js', 'js/server-quiz.js'].map(f => code[f] || '').join('\n');
const engineAudio = /<audio|new Audio\(|\.audio\b|audioUrl/i.test(engine);
add(quizAudioField ? 'OK' : 'WARN', 'exam', 'quizzes.js ' + (quizAudioField ? 'มีฟิลด์เสียงในข้อสอบ' : 'ไม่มีฟิลด์เสียง/คลิปในข้อสอบ → ข้อสอบฟังคลิป (วก.5 คาบ 11, 20) ยังทำไม่ได้'));
add(engineAudio ? 'OK' : 'WARN', 'exam', 'ระบบสอบ (quiz-engine/server-quiz) ' + (engineAudio ? 'มีโค้ดเล่นเสียง' : 'ไม่มีตัวเล่นเสียง'));
/* 5) สรุป */
const sev = { FAIL: 0, WARN: 0, OK: 0, INFO: 0 }; out.findings.forEach(f => sev[f.sev]++);
out.summary = sev;
const icon = { FAIL: '✗', WARN: '⚠', OK: '✓', INFO: '·' };
let md = '# ผลตรวจหน่วย 3–4 (วงดนตรีไทย/สากล/การฟัง) — static audit\n\nราก: ' + ROOT + '\n\n';
md += '| คาบ | บทเรียน | ขั้น (ว่าง) | สื่อใน lessons | สื่อที่ไฟล์หาย | ช่องสื่อ วก.5 (มี/ทั้งหมด) |\n|---|---|---|---|---|---|\n';
Object.keys(out.periods).forEach(p => { const r = out.periods[p]; md += '| ' + p + ' | ' + (r.lesson ? 'มี' : 'ไม่มี') + ' | ' + r.steps + ' (' + r.emptySteps + ') | ' + r.media.length + ' | ' + r.media.filter(m => m.state === 'MISSING').length + ' | ' + (r.slots ? r.slots.have + '/' + r.slots.total : '-') + ' |\n'; });
md += '\n## ข้อค้นพบ\n' + out.findings.map(f => '- ' + icon[f.sev] + ' [' + f.area + '] ' + f.msg).join('\n') + '\n\nสรุป: FAIL ' + sev.FAIL + ' · WARN ' + sev.WARN + ' · OK ' + sev.OK + '\n';
console.log(md);
if (flag('--json')) fs.writeFileSync(flag('--json'), JSON.stringify(out, null, 1), 'utf8');
if (flag('--md')) fs.writeFileSync(flag('--md'), md, 'utf8');
if (args.indexOf('--strict') !== -1 && sev.FAIL) process.exit(1);
