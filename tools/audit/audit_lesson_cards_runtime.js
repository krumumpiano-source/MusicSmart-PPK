// ตรวจ "การ์ดคาบที่ครู/นักเรียนเห็นจริงในแอป" (Store.getLesson หลัง _projectWk5) เทียบ วก.5 (WK5_PLANS) ครบ 20 คาบ
// ใช้: node tools/audit/audit_lesson_cards_runtime.js [http://localhost:8894] [out.md]   (ต้องมี server เปิดอยู่)
// ต่างจาก audit_lesson_cards.js ซึ่งตรวจไฟล์ lessons.js ดิบ (legacy) ที่ M1 ไม่ได้ใช้แสดงผลแล้ว
const fs = require('fs');
const pw = require(process.env.PW_PATH || '/workspace/bt/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://localhost:8894', OUT = process.argv[3] || '/tmp/lesson_cards_after.md';
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
  const rows = await p.evaluate(() => {
    const norm = s => String(s || '').replace(/[\s\u200b]+/g, '');
    const nm = m => norm(String(m).replace(/\((doc|app|link|image|tool|video|rubric|interactive|app_module)\)\s*$/i, ''));
    const out = [];
    for (let n = 1; n <= 20; n++) {
      const l = Store.getLesson('M1', n), w = WK5_PLANS.M1[n], d = [];
      const act = w.activities || {}; const ws = ['intro', 'teach', 'wrap'].filter(k => act[k] && (act[k].title || (act[k].items || []).length));
      if (norm(l.topic) !== norm(w.topic)) d.push('หัวข้อ');
      if (l.unit_no !== w.unit_no || norm(l.unit_name) !== norm(w.unit_name)) d.push('หน่วย');
      ['k', 'p', 'a'].forEach(x => { if (norm(l.kpa[x]) !== norm([].concat(w.objectives[x] || []).join(' '))) d.push('KPA-' + x.toUpperCase()); });
      const ls = l.steps.map(s => s.duration).join('/'), wsm = ws.map(k => Number(act[k].minutes) || 0).join('/');
      if (ls !== wsm) d.push('นาทีขั้น ' + ls + '≠' + wsm);
      l.steps.forEach((s, i) => { const a = act[ws[i]]; if (norm(s.desc) !== norm((a.items || []).join('\n'))) d.push('ข้อความขั้น ' + (i + 1)); if (norm(s.phase).indexOf(norm(a.title)) !== 0) d.push('ชื่อขั้น ' + (i + 1)); });
      const tot = l.steps.reduce((s, x) => s + x.duration, 0); if (tot !== l.duration_min) d.push('นาทีรวม');
      if (l.assessment.max_score !== (Number(w.score_total) || 0)) d.push('คะแนน');
      const wm = (w.media || []).map(nm), lm = (l.media || []).map(m => nm(m.title));
      const extra = lm.filter(t => wm.indexOf(t) < 0), miss = (w.media || []).filter(m => lm.indexOf(nm(m)) < 0);
      if (extra.length) d.push('สื่อเกิน ' + extra.length);
      out.push({ n, topic: l.topic, mins: ls + '=' + tot, k: !d.some(x => /KPA-K/.test(x)), p: !d.some(x => /KPA-P/.test(x)), a: !d.some(x => /KPA-A/.test(x)), score: l.assessment.max_score, media: (l.media || []).length, wkMedia: (w.media || []).length, noCard: miss, diffs: d, aids: (l.aids || []).join('|'), tips: !!l.mentor_tips });
    }
    return out;
  });
  // หัวข้อรวมเวลาใน DOM (ครู)
  const heads = [];
  for (const n of [1, 9, 11, 17, 18, 20]) {
    const h = await p.evaluate(n => { App.state.grade = 'M1'; App.state.selectedPeriod = n; App.renderLesson ? App.renderLesson() : App.selectPeriod(n); var e = document.getElementById('steps-total-label'); return e ? e.textContent : null; }, n).catch(() => null);
    heads.push(n + ':' + h);
  }
  let md = '| คาบ | หัวข้อ (จาก วก.5) | นาทีขั้น=รวม | K | P | A | คะแนน | สื่อบนการ์ด/วก.5 | ความต่างจาก วก.5 |\n|---|---|---|---|---|---|---|---|---|\n';
  let bad = 0;
  rows.forEach(r => { if (r.diffs.length) bad++; md += `| ${r.n} | ${r.topic} | ${r.mins} | ${r.k ? '✓' : '✗'} | ${r.p ? '✓' : '✗'} | ${r.a ? '✓' : '✗'} | ${r.score} | ${r.media}/${r.wkMedia}${r.noCard.length ? ' (ไม่มีการ์ด: ' + r.noCard.join('; ') + ')' : ''} | ${r.diffs.join(', ') || 'ตรง'}${r.aids ? ' · aids=' + r.aids : ''} |\n`; });
  fs.writeFileSync(OUT, md); console.log(md); console.log('หัวข้อรวมเวลา:', heads.join('  ')); console.log('คาบที่ไม่ตรง:', bad, '· JS errors:', errs.length ? errs.join('|') : 0);
  await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
