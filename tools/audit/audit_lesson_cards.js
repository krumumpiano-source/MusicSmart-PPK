// ตรวจการ์ดเนื้อหาคาบ (LESSONS_DATA, legacy) เทียบกับ วก.5 (WK5_PLANS) ทีละบรรทัด — ใช้: node tools/audit/audit_lesson_cards.js [M1]
'use strict';
const path = require('path'); const ROOT = path.resolve(__dirname, '../..');
global.window = global;
const WK = require(path.join(ROOT, 'app/data/wk5_plans.js'));
const LD = require(path.join(ROOT, 'app/data/lessons.js')); const LESSONS = global.LESSONS_DATA || LD;
const grade = process.argv[2] || 'M1';
const norm = s => String(s || '').replace(/[\s\u200b]+/g, '').replace(/[“”"'‘’]/g, '').replace(/[,،]/g, '');
const joinK = a => norm((a || []).join(''));
function wk5Steps(p) {
  const out = []; const a = p.activities || {};
  ['intro', 'teach', 'wrap'].forEach(k => { if (a[k]) out.push({ k, title: a[k].title, minutes: a[k].minutes, items: a[k].items || [] }); });
  return out;
}
const rows = [];
for (let n = 1; n <= 20; n++) {
  const p = (WK[grade] || {})[n]; const l = (LESSONS.filter ? LESSONS : LESSONS[grade]).find(x => x.grade === grade && x.period === n);
  const diffs = [];
  if (!p || !l) { rows.push({ n, diffs: ['ไม่มีข้อมูล'] }); continue; }
  if (norm(l.topic) !== norm(p.topic)) diffs.push('หัวข้อ');
  if (l.unit_no !== p.unit_no || norm(l.unit_name) !== norm(p.unit_name)) diffs.push('หน่วย');
  ['k', 'p', 'a'].forEach(x => { if (norm(l.kpa && l.kpa[x]) !== joinK(p.objectives && p.objectives[x])) diffs.push('KPA-' + x.toUpperCase()); });
  const ws = wk5Steps(p);
  const wmin = ws.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  if (Number(l.duration_min) !== wmin) diffs.push(`นาทีรวม ${l.duration_min}≠${wmin}`);
  const lsteps = (l.steps || []).map(s => s.duration).join('/'); const wsteps = ws.map(s => s.minutes).join('/');
  if (lsteps !== wsteps) diffs.push(`นาทีขั้น ${lsteps}≠${wsteps}`);
  const wm = (p.media || []).map(m => norm(String(m).replace(/\((doc|app|link|image|tool|video|rubric|interactive|app_module)\)\s*$/i, '')));
  const lm = (l.media || []).map(m => norm(m.title));
  const extra = lm.filter(t => !wm.includes(t)).length; const miss = wm.filter(t => !lm.includes(t)).length;
  if (extra) diffs.push(`สื่อเกิน ${extra}`); if (miss) diffs.push(`สื่อขาด ${miss}`);
  if ((l.aids || []).length) diffs.push('aids=' + l.aids.join('|'));
  const lmax = l.assessment && l.assessment.max_score; if (Number(lmax) !== Number(p.score_total)) diffs.push(`คะแนน ${lmax}≠${p.score_total}`);
  rows.push({ n, diffs, lm: l.media.map(m => m.title), wm: p.media, lsteps, wsteps });
}
if (require.main === module) { rows.forEach(r => console.log('P' + r.n, r.diffs.join(' · ') || 'ตรง')); }
module.exports = { rows };
