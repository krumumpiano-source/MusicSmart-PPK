/* t50u — ตารางสื่อ × คาบ (ม.1): คลิกทุกปุ่มสื่อในหน้านักเรียนจริง (headless Chrome, 360px) แล้วบันทึกว่าเปิดอะไร
 * ใช้: node tools/audit/media_matrix.js [outDir]   (ต้องมีเซิร์ฟเวอร์ static ที่ BASE; ตั้ง BASE=http://localhost:8893 ; ต้องมี playwright-core + Chrome)
 * ผล: <outDir>/media_matrix.json + .md + ภาพหน้าจอ */
'use strict';
const { PIN_A } = require('../../tests/lib/test_pins');
const fs = require('fs'), path = require('path');
const pw = (function () { try { return require('playwright-core'); } catch (e) { return require(process.env.PW_CORE || '/workspace/bt/node_modules/playwright-core'); } })();
const BASE = process.env.BASE || 'http://localhost:8893';
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'scratch', 'media_matrix');
fs.mkdirSync(OUT, { recursive: true });
const BANNED = /ร่างโดยระบบ|รอครูยืนยัน|วก\.5 ไม่ระบุ|ยังไม่ได้ตรวจ|Do-Re-Mi|TODO|undefined|NaN|\[object/;
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  p.on('dialog', d => d.dismiss());
  await p.addInitScript(() => { window.open = function () { window.__opened = Array.prototype.slice.call(arguments); return null; }; });
  await p.goto(BASE + '/index.html'); await p.waitForTimeout(1500);
  await p.evaluate((pin) => { Store.registerStudentPin('90001', pin); document.getElementById('modal-auth-login').classList.remove('active'); App.switchRole('student', false); }, PIN_A);
  const rows = [];
  for (let per = 1; per <= 20; per++) {
    await p.evaluate(n => App.selectStudentPeriod(n), per);
    const n = await p.evaluate(() => document.querySelectorAll('#student-lesson-text .mv-item, #view-student .mv-item').length);
    const items = await p.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#view-student .mv-item'), (e, i) => ({ i: i, txt: e.innerText.replace(/\s+/g, ' ').trim().slice(0, 120), open: !!e.querySelector('.mv-open'), onclick: (e.querySelector('.mv-open') || {}).getAttribute ? e.querySelector('.mv-open').getAttribute('onclick') : '' })));
    for (const it of items) {
      const rec = { period: per, label: it.txt, openable: it.open, result: '', pass: true, notes: [] };
      if (it.open) {
        await p.evaluate(() => { window.__opened = null; });
        await p.evaluate(i => { var e = document.querySelectorAll('#view-student .mv-item')[i]; e.querySelector('.mv-open').click(); }, it.i);
        await p.waitForTimeout(500);
        const st = await p.evaluate(() => {
          var best = null;
          document.querySelectorAll('body *').forEach(function (e) {
            var cs = getComputedStyle(e); if (cs.position !== 'fixed' || e.id === 'mobile-bottom-nav' || e.classList.contains('km-kbd') || e.classList.contains('app-header')) return;
            var r = e.getBoundingClientRect(); if (r.width < 200 || r.height < 120 || !e.offsetParent && cs.position !== 'fixed') return;
            if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
            var t = e.innerText || ''; if (t.length > 15 && (!best || t.length > best.t.length)) best = { t: t.replace(/\s+/g, ' ').trim(), sw: e.scrollWidth, cw: e.clientWidth };
          });
          return { opened: window.__opened, modal: best, docW: document.documentElement.scrollWidth };
        });
        if (st.opened) rec.result = 'external:' + st.opened[0];
        else if (st.modal) { rec.result = st.modal.t.slice(0, 90); if (BANNED.test(st.modal.t)) { rec.pass = false; rec.notes.push('banned text'); } if (st.modal.sw > st.modal.cw + 2) { rec.pass = false; rec.notes.push('modal h-overflow ' + st.modal.sw + '>' + st.modal.cw); } }
        else { rec.pass = false; rec.result = '(ไม่มีอะไรเปิด)'; }
        const kv = await p.evaluate(() => { var sel = document.getElementById('kalimba-song-select'); var m = document.getElementById('modal-virtual-kalimba'); if (!sel || !m || !m.classList.contains('active')) return null; var o = sel.options[sel.selectedIndex]; return { value: sel.value, text: o ? o.text : '', n: sel.options.length, periods: Array.prototype.map.call(sel.querySelectorAll('optgroup'), g => g.label.replace(/\D+/g, ' ').trim().split(' ')[0]) }; });
        if (kv) { const url = (it.onclick.match(/open\('([^']+)'/) || [])[1]; const exp = (await p.evaluate(u => (MEDIA_ROUTES.lookup('M1', u) || {}).item, url)); rec.result = 'คาลิมบ้า: เลือก "' + kv.text + '" (' + kv.value + ') · รายการ ' + kv.n + ' เพลง คาบ ' + kv.periods.join(','); if (exp && kv.value.split('|')[1] !== exp) { rec.pass = false; rec.notes.push('คาดว่า ' + exp + ' แต่เลือก ' + kv.value); } if (kv.periods.some(x => +x > per)) { rec.pass = false; rec.notes.push('มีเพลงคาบอนาคตให้นักเรียนเห็น'); } }
        if (st.docW > 362) { rec.pass = false; rec.notes.push('page overflow ' + st.docW); }
        const f = 'p' + per + '_m' + it.i + '.png'; await p.screenshot({ path: path.join(OUT, f) }); rec.shot = f;
        await p.evaluate(() => { try { StudentPanels.close(); } catch (e) {} document.querySelectorAll('.modal-overlay.active,.modal.active').forEach(m => m.classList.remove('active')); document.querySelectorAll('[id$="-modal"],[id^="km-"][id$="modal"]').forEach(m => { if (getComputedStyle(m).position === 'fixed') m.remove(); }); });
      } else { rec.result = /ยังไม่มีสื่อ/.test(it.txt) ? 'แจ้ง "ยังไม่มีสื่อ" ตรง ๆ' : (/📦|ซอง|ผ้า/.test(it.txt) ? 'ของจริง (checklist)' : 'ข้อความ'); }
      rows.push(rec);
    }
  }
  fs.writeFileSync(path.join(OUT, 'media_matrix.json'), JSON.stringify(rows, null, 1));
  const md = ['| คาบ | สื่อ (ป้ายปุ่ม) | เปิดได้ | ผลที่เปิด | ผ่าน |', '|---|---|---|---|---|'];
  rows.forEach(r => md.push('| ' + r.period + ' | ' + r.label.replace(/\|/g, '/').slice(0, 70) + ' | ' + (r.openable ? 'ใช่' : 'ไม่') + ' | ' + r.result.replace(/\|/g, '/').slice(0, 70) + ' | ' + (r.pass ? '✅' : '❌ ' + r.notes.join(',')) + ' |'));
  fs.writeFileSync(path.join(OUT, 'media_matrix.md'), md.join('\n') + '\n');
  console.log('rows', rows.length, 'fail', rows.filter(r => !r.pass).length);
  await b.close();
})();
