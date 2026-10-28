/* สื่อประจำคาบ (ม.1): ตัวเปิดสื่อตามตาราง MEDIA_ROUTES — ป้ายปุ่ม = สิ่งที่เปิดจริง ไม่มีโมดอลสำรองกลาง
 * วิว: acoustics (ความยาวลิ่ม–ความถี่) | anatomy (ส่วนประกอบ/ท่าจับ: ภาพประกอบ) | scale_chart (ตารางสเกล C Major)
 *      criteria (เกณฑ์ประเมินจาก วก.5) | exam_info | equipment (เช็กลิสต์) | practice (เปิดคาลิมบ้าจำลองตรงแบบฝึก)
 * ES5 เพื่อมือถือเก่า ไม่ใช้ฟอนต์พิเศษ (รูปวาดเป็น SVG) */
(function (root) {
  'use strict';
  var GRADE = 'M1';
  /** อ่านตัวแปรส่วนกลาง รวมถึง const/let ระดับสคริปต์ (ไม่ใช่คุณสมบัติของ window) */
  function G(n) {
    if (root[n] !== undefined) return root[n];
    try { return (0, eval)('typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined'); } catch (e) { return undefined; }
  }
  var timers = [];
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function KM() { return G('KalimbaMedia'); }
  function clearTimers() { while (timers.length) { root.clearInterval(timers.pop()); } }
  function panel(title, html) {
    clearTimers();
    if (G('StudentPanels')) G('StudentPanels').show(title, html, clearTimers);
  }
  function lessonMedia(period, url) {
    try {
      var l = G('Store') && G('Store').getLesson ? G('Store').getLesson(GRADE, period) : null;
      var arr = (l && (l.media || l.media_links)) || [];
      for (var i = 0; i < arr.length; i++) if (String(arr[i].url) === String(url)) return arr[i];
    } catch (e) {}
    return null;
  }
  function isStaff() {
    try { var u = G('Store') && G('Store').getCurrentUser ? G('Store').getCurrentUser() : null; var r = u ? u.role : ''; return r === 'teacher' || r === 'intern'; } catch (e) { return false; }
  }
  function userId() { try { var u = G('Store').getCurrentUser(); return (u && (u.id || u.studentId)) || 'anon'; } catch (e) { return 'anon'; } }

  /* ---------- ข้อมูลพื้นฐานจากข้อมูลจริง ---------- */
  function tines() { return (G('KALIMBA_MEDIA') && G('KALIMBA_MEDIA').tines) || []; }
  function tineHeights() { // สูตรเดียวกับผังลิ่มในแอป: ลิ่มกลางยาวสุด สั้นลงตามระยะห่างจากกลาง (ภาพประกอบ ไม่ใช่ค่าวัดจริง)
    var G = KM().TINE_GEOM, n = tines().length, mid = (n - 1) / 2, step = n > 1 ? (G.maxH - G.minH) / mid : 0, out = {}, i;
    for (i = 0; i < n; i++) out[tines()[i]] = G.maxH - Math.abs(i - mid) * step;
    return out;
  }
  function hz(note) { return KM().freqOf(note); }
  function fmtHz(f) { return (Math.round(f * 10) / 10).toFixed(1); }

  /* ---------- 1) Acoustics ---------- */
  function wavePath(f, phase, W, H) {
    var cycles = f * 0.02, pts = [], i, N = 160, y;
    for (i = 0; i <= N; i++) { y = H / 2 - Math.sin(2 * Math.PI * (cycles * i / N) + phase) * (H / 2 - 6); pts.push((i * W / N).toFixed(1) + ',' + y.toFixed(1)); }
    return 'M' + pts.join(' L');
  }
  function acousticsHTML() {
    var t = tines(), order = t.slice().sort(function (a, b) { return hz(a) - hz(b); });
    var hs = tineHeights(), G = KM().TINE_GEOM, maxH = G.maxH;
    var rows = order.map(function (n) {
      var pos = t.indexOf(n) + 1;
      return '<tr data-note="' + n + '" class="mv-row"><td>' + esc(KM().thaiLabel(n)) + ' <small>(' + n + ')</small></td><td>' + fmtHz(hz(n)) + ' Hz</td><td>ลิ่มที่ ' + pos + ' จากซ้าย</td>' +
        '<td><div style="background:#e2e8f0;border-radius:4px;height:10px;"><div style="background:#0284c7;height:10px;border-radius:4px;width:' + Math.round(hs[n] / maxH * 100) + '%;"></div></div></td></tr>';
    }).join('');
    return '<div id="mv-acoustics" class="mv-wrap">' +
      '<p class="mv-lead">ลิ้นโลหะ (ลิ่ม) ที่ยาวกว่าจะสั่นช้ากว่า → เสียงทุ้มต่ำกว่า ลิ้นที่สั้นกว่าสั่นเร็วกว่า → เสียงแหลมกว่า (หลักสวนศาสตร์เบื้องต้น คาบที่ 2) แตะลิ่มเพื่อฟังเสียงและดูการสั่น</p>' +
      '<div id="mv-ac-mute" class="mv-mute"></div>' +
      '<div class="mv-tines" style="position:relative;width:100%;max-width:440px;margin:0 auto;padding-bottom:' + (G.H / G.W * 100).toFixed(2) + '%;"><div id="mv-ac-tines" style="position:absolute;left:0;top:0;right:0;bottom:0;"></div></div>' +
      '<div class="mv-card" id="mv-ac-info" aria-live="polite">แตะลิ่มด้านบนเพื่อเลือกโน้ต</div>' +
      '<div class="mv-two"><div class="mv-card"><div class="mv-cap">การสั่นของลิ่ม (ภาพขยายให้ช้าลงเพื่อให้มองเห็น)</div><svg id="mv-ac-bar" viewBox="0 0 200 170" style="width:100%;max-width:240px;height:auto;display:block;margin:0 auto;" role="img" aria-label="ภาพลิ่มโลหะสั่น"></svg></div>' +
      '<div class="mv-card"><div class="mv-cap">คลื่นเสียง ช่วงเวลา 20 มิลลิวินาที (จำนวนรอบคำนวณจากความถี่)</div><svg id="mv-ac-wave" viewBox="0 0 240 90" style="width:100%;height:auto;display:block;background:#f8fafc;border-radius:6px;" role="img" aria-label="คลื่นเสียง"></svg></div></div>' +
      '<div class="mv-table-wrap"><table class="mv-table"><caption>ความถี่เสียงของลิ่มทั้ง ' + t.length + ' ลิ่ม เรียงจากต่ำไปสูง (ระบบเสียง A4 = 440 Hz)</caption><thead><tr><th>โน้ต</th><th>ความถี่</th><th>ตำแหน่งบนเครื่อง</th><th>ความยาวลิ่มตามผังในแอป*</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="mv-foot">* ความยาวลิ่มในภาพเป็นภาพประกอบตามผังของแอป (กลางยาวสุด สั้นลงทางซ้าย-ขวา) ไม่ใช่ค่าที่วัดจากเครื่องจริง · ค่า Hz คำนวณจากชื่อโน้ตในระบบเสียงปกติ (A4 = 440 Hz)</p></div>';
  }
  function acousticsMount() {
    var host = root.document.getElementById('mv-ac-tines'); if (!host) return;
    host.innerHTML = KM().renderTineSVG(tines(), 'mva');
    var infoEl = root.document.getElementById('mv-ac-info'), barEl = root.document.getElementById('mv-ac-bar'), waveEl = root.document.getElementById('mv-ac-wave');
    var muteEl = root.document.getElementById('mv-ac-mute');
    var state = { note: null, t0: 0 }, hs = tineHeights(), maxH = KM().TINE_GEOM.maxH;
    function paintMute() {
      var m = KM().isMuted();
      muteEl.innerHTML = '<label class="mv-chk"><input type="checkbox" id="mv-ac-mutebox"' + (m ? ' checked' : '') + '> ปิดเสียงคาลิมบ้า (ภาพยังเคลื่อนไหวตามปกติ)</label>';
      root.document.getElementById('mv-ac-mutebox').onchange = function () { KM().setMuted(this.checked); };
    }
    paintMute();
    root.addEventListener('ppk-kalimba-mute-changed', paintMute);
    function pick(n) {
      state.note = n; state.t0 = (new Date()).getTime();
      var f = hz(n), i, els = host.querySelectorAll('.kt');
      for (i = 0; i < els.length; i++) els[i].setAttribute('fill', els[i].getAttribute('data-note') === n ? KM().COLORS.tineCur : KM().COLORS.tineIdle);
      var rows = root.document.querySelectorAll('#mv-acoustics .mv-row');
      for (i = 0; i < rows.length; i++) rows[i].className = 'mv-row' + (rows[i].getAttribute('data-note') === n ? ' mv-on' : '');
      var played = KM().previewNote(n, 1.2);
      infoEl.innerHTML = '<strong>' + esc(KM().thaiLabel(n)) + ' (' + n + ')</strong> · ความถี่ <strong>' + fmtHz(f) + ' Hz</strong> = สั่น ' + Math.round(f) + ' รอบต่อวินาที · 1 รอบใช้เวลา ' + (1000 / f).toFixed(2) + ' มิลลิวินาที' +
        (played ? '' : '<br><span style="color:#475569;">โหมดปิดเสียงคาลิมบ้าเปิดอยู่ — จึงไม่มีเสียง (ภาพยังทำงาน)</span>');
    }
    host.addEventListener('click', function (ev) { var n = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-note'); if (n) pick(n); });
    var trs = root.document.querySelectorAll('#mv-acoustics .mv-row'), k;
    for (k = 0; k < trs.length; k++) trs[k].onclick = (function (tr) { return function () { pick(tr.getAttribute('data-note')); }; })(trs[k]);
    pick(tines()[Math.floor(tines().length / 2)] || 'C4');
    timers.push(root.setInterval(function () {
      if (!root.document.getElementById('mv-ac-wave')) { clearTimers(); return; }
      var n = state.note; if (!n) return;
      var t = ((new Date()).getTime() - state.t0) / 1000, f = hz(n);
      waveEl.innerHTML = '<line x1="0" y1="45" x2="240" y2="45" stroke="#cbd5e1" stroke-width="1"/><path d="' + wavePath(f, -2 * Math.PI * 40 * t, 240, 90) + '" fill="none" stroke="#0284c7" stroke-width="2"/>';
      // ลิ่มที่สั่น: ความยาวตามผังในแอป, ความเร็วภาพ 2 รอบ/วินาที (ไม่ใช่ความถี่จริง), แอมพลิจูดลดลงทีละน้อยหลังดีด
      var len = 20 + (hs[n] / maxH) * 120, amp = 14 * Math.exp(-t / 2.2) * Math.sin(2 * Math.PI * 2 * t);
      if (t > 8) { state.t0 = (new Date()).getTime(); }
      barEl.innerHTML = '<rect x="20" y="146" width="160" height="14" rx="4" fill="#8d6e63"/><path d="M100 146 Q ' + (100 + amp * 0.35).toFixed(1) + ' ' + (146 - len / 2).toFixed(1) + ' ' + (100 + amp).toFixed(1) + ' ' + (146 - len).toFixed(1) + '" fill="none" stroke="#546e7a" stroke-width="9" stroke-linecap="round"/>' +
        '<text x="100" y="14" font-size="11" text-anchor="middle" fill="#334155">ลิ่ม ' + esc(n) + ' · สั่นจริง ' + Math.round(f) + ' รอบ/วินาที</text>';
    }, 60));
  }

  /* ---------- 2) ส่วนประกอบ + ท่าจับ (ภาพประกอบ) ---------- */
  function anatomyHTML() {
    var parts = [
      ['1', 'ตัวเครื่อง/กล่องเสียง (Resonance Box)', 'กล่องไม้กลวงขยายเสียงจากลิ่ม — พลังงานการสั่นส่งผ่านหย่องเข้าสู่กล่องเสียง'],
      ['2', 'ลิ่มโลหะ ' + tines().length + ' ลิ่ม (ลิ้นโลหะ)', 'ส่วนที่สั่นให้เกิดเสียง ลิ่มยาวเสียงทุ้ม ลิ่มสั้นเสียงแหลม'],
      ['3', 'หย่อง (สะพานรองลิ่ม)', 'ส่งการสั่นจากลิ่มสู่กล่องเสียง'],
      ['4', 'ปลายลิ่ม', 'จุดที่นิ้วโป้งสะกิดให้ลิ่มสั่น (พิมพ์ชื่อโน้ตไว้ที่ปลายลิ่มในแอป)'],
      ['5', 'ช่องเสียงด้านหลัง (Sound Hole)', 'เปิด/ปิดด้วยนิ้วมือเพื่อเปลี่ยนความก้องของเสียง']
    ];
    var svgParts = '<svg viewBox="0 0 300 250" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;" role="img" aria-label="ภาพประกอบ ส่วนประกอบของคาลิมบ้า">' +
      '<rect x="0" y="0" width="300" height="250" fill="#f8fafc"/>' +
      '<rect x="40" y="70" width="220" height="150" rx="14" fill="#d7b98e" stroke="#8d6e63" stroke-width="3"/>' +
      '<rect x="70" y="118" width="160" height="9" rx="3" fill="#78909c"/>' +
      '<rect x="64" y="132" width="172" height="7" rx="3" fill="#8d6e63"/>' +
      (function () { var s = '', i, x, h; for (i = 0; i < 9; i++) { x = 78 + i * 18; h = 70 - Math.abs(i - 4) * 7; s += '<rect x="' + x + '" y="' + (128 - h + 6) + '" width="10" height="' + h + '" rx="3" fill="#b0bec5" stroke="#78909c"/>'; } return s; })() +
      '<ellipse cx="150" cy="185" rx="26" ry="16" fill="#5d4037"/>' +
      '<g font-size="13" font-weight="bold" fill="#1e293b"><circle cx="44" cy="150" r="11" fill="#fff" stroke="#1e293b"/><text x="44" y="155" text-anchor="middle">1</text>' +
      '<circle cx="150" cy="38" r="11" fill="#fff" stroke="#1e293b"/><text x="150" y="43" text-anchor="middle">2</text><line x1="150" y1="49" x2="150" y2="68" stroke="#1e293b"/>' +
      '<circle cx="262" cy="130" r="11" fill="#fff" stroke="#1e293b"/><text x="262" y="135" text-anchor="middle">3</text>' +
      '<circle cx="262" cy="86" r="11" fill="#fff" stroke="#1e293b"/><text x="262" y="91" text-anchor="middle">4</text>' +
      '<circle cx="150" cy="228" r="11" fill="#fff" stroke="#1e293b"/><text x="150" y="233" text-anchor="middle">5</text></g>' +
      '<text x="296" y="12" font-size="9" text-anchor="end" fill="#64748b">ภาพประกอบ</text></svg>';
    var svgGrip = '<svg viewBox="0 0 300 220" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;" role="img" aria-label="ภาพประกอบ ท่าจับคาลิมบ้าด้วยสองมือ นิ้วโป้งทำมุม 45 องศา">' +
      '<rect x="0" y="0" width="300" height="220" fill="#f8fafc"/>' +
      '<rect x="60" y="60" width="180" height="120" rx="12" fill="#d7b98e" stroke="#8d6e63" stroke-width="3"/>' +
      (function () { var s = '', i, x, h; for (i = 0; i < 9; i++) { x = 100 + i * 12; h = 60 - Math.abs(i - 4) * 6; s += '<rect x="' + x + '" y="' + (112 - h) + '" width="8" height="' + h + '" rx="2" fill="#b0bec5" stroke="#78909c"/>'; } return s; })() +
      '<g fill="#f4c7a1" stroke="#a1664a" stroke-width="2"><ellipse cx="48" cy="150" rx="30" ry="36"/><ellipse cx="252" cy="150" rx="30" ry="36"/>' +
      '<g transform="rotate(45 78 92)"><rect x="70" y="40" width="16" height="62" rx="8"/></g><g transform="rotate(-45 222 92)"><rect x="214" y="40" width="16" height="62" rx="8"/></g></g>' +
      '<path d="M96 108 A 22 22 0 0 0 114 86" fill="none" stroke="#dc2626" stroke-width="2"/><text x="118" y="78" font-size="12" font-weight="bold" fill="#dc2626">45°</text>' +
      '<text x="296" y="12" font-size="9" text-anchor="end" fill="#64748b">ภาพประกอบ</text></svg>';
    return '<div class="mv-wrap"><h4 class="mv-h">ส่วนประกอบของคาลิมบ้า ' + tines().length + ' คีย์</h4>' + svgParts +
      '<div class="mv-table-wrap"><table class="mv-table"><thead><tr><th>#</th><th>ส่วน</th><th>หน้าที่</th></tr></thead><tbody>' +
      parts.map(function (p) { return '<tr><td>' + p[0] + '</td><td>' + esc(p[1]) + '</td><td>' + esc(p[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h4 class="mv-h">ท่าจับถือ</h4>' + svgGrip +
      '<ol class="mv-steps"><li>จับเครื่องด้วย <strong>สองมือ</strong> ให้ตัวเครื่องมั่นคง ข้อมือผ่อนคลาย</li><li>วางนิ้วโป้งทั้งสองข้างบนปลายลิ่ม โดย<strong>นิ้วโป้งทำมุม 45 องศา</strong>กับลิ่มโลหะ</li><li>ใช้ปลายเล็บสะกิดลิ่มเบา ๆ ให้เสียงใสกังวาน ไม่เกร็งนิ้ว</li></ol>' +
      '<p class="mv-foot">ภาพทั้งสองเป็นภาพประกอบที่วาดขึ้นในแอป เพื่ออธิบายตำแหน่งและมุมนิ้ว ไม่ใช่ภาพถ่ายเครื่องจริง · มุม 45 องศาและวิธีสะกิดตามแผนการสอนคาบที่ 2</p></div>';
  }

  /* ---------- 3) ตารางสเกล C Major ---------- */
  var SOL = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti', 'do'];
  var THAI_NAME = ['โด', 'เร', 'มี', 'ฟา', 'ซอล', 'ลา', 'ที', 'โด'];
  function staffPos(note) {
    var p = KM().parsePitch(note), n = p.dia - (4 * 7 + 2); // E4 = เส้นที่ 1 (dia ของ E4 = 30)
    if (n < 0) {
      if (n % 2 === 0) return 'เส้นน้อยใต้บรรทัด' + (n === -2 ? '' : ' ' + (-n / 2));
      return 'ช่องใต้เส้นที่ 1';
    }
    if (n % 2 === 0) return 'เส้นที่ ' + (n / 2 + 1);
    return 'ช่องที่ ' + ((n + 1) / 2);
  }
  function scaleNotes() {
    var sol = (G('KALIMBA_MEDIA') && G('KALIMBA_MEDIA').solfege) || {};
    var keys = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท', 'ดํ'];
    return keys.map(function (k, i) { var note = sol[k]; return { thai: k, note: note, letter: note ? note.replace(/\d/, '') : '', sol: SOL[i], thaiName: THAI_NAME[i], tine: tines().indexOf(note) + 1, staff: note ? staffPos(note) : '' }; });
  }
  function noteGlyph(open, stem) {
    return '<svg viewBox="0 0 24 34" width="22" height="30" aria-hidden="true"><ellipse cx="9" cy="26" rx="6.5" ry="4.6" transform="rotate(-20 9 26)" fill="' + (open ? '#fff' : '#111') + '" stroke="#111" stroke-width="1.8"/>' + (stem ? '<line x1="15" y1="25" x2="15" y2="4" stroke="#111" stroke-width="1.8"/>' : '') + '</svg>';
  }
  function scaleChartHTML() {
    var sc = scaleNotes();
    var rows = sc.map(function (r, i) {
      return '<tr class="mv-row" data-i="' + i + '" tabindex="0" role="button" aria-label="เล่นโน้ต ' + esc(r.note) + '"><td>' + (i + 1) + '</td><td><strong>' + esc(r.letter) + '</strong> <small>(' + esc(r.note) + ')</small></td><td>' + r.sol + '</td><td>' + esc(r.thaiName) + ' (' + esc(r.thai) + ')</td><td>ลิ่มที่ ' + r.tine + '</td><td>' + esc(r.staff) + '</td></tr>';
    }).join('');
    var grid = sc.map(function (r, i) {
      return '<div class="mv-bar"><div class="mv-barno">ห้อง ' + (i + 1) + '</div><div class="mv-beats"><span>' + esc(r.thai) + '</span><span>–</span><span>–</span><span>–</span></div></div>';
    }).join('');
    var vals = [
      ['ตัวกลม', 'Whole note', 4, '1 – – –', noteGlyph(true, false)],
      ['ตัวขาว', 'Half note', 2, '1 –', noteGlyph(true, true)],
      ['ตัวดำ', 'Quarter note', 1, '1', noteGlyph(false, true)]
    ];
    return '<div class="mv-wrap" id="mv-scale"><p class="mv-lead">สเกล C Major ขึ้น: แตะแถวในตารางเพื่อฟังเสียง ดูโน้ตบนบรรทัด 5 เส้น และลิ่มที่ต้องดีด</p>' +
      '<div id="mv-sc-mute" class="mv-mute"></div>' +
      '<div class="mv-card"><div id="mv-sc-staff" style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;"></div>' +
      '<div class="mv-tines" style="position:relative;width:100%;max-width:440px;margin:0.5rem auto 0;padding-bottom:' + (KM().TINE_GEOM.H / KM().TINE_GEOM.W * 100).toFixed(2) + '%;"><div id="mv-sc-tines" style="position:absolute;left:0;top:0;right:0;bottom:0;"></div></div></div>' +
      '<div class="mv-table-wrap"><table class="mv-table"><caption>สเกล C Major (โน้ตสากล · โซลเฟจ · โน้ตไทย · ตำแหน่งบนคาลิมบ้าและบรรทัด 5 เส้น)</caption><thead><tr><th>ที่</th><th>โน้ตสากล</th><th>โซลเฟจ</th><th>โน้ตไทย</th><th>ตำแหน่งลิ่ม</th><th>บนบรรทัด 5 เส้น</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h4 class="mv-h">ตารางเพลง 8 ห้อง (1 ห้อง = 4 จังหวะ ตามอัตรา 4/4)</h4><div class="mv-grid8">' + grid + '</div>' +
      '<p class="mv-foot">ตัวอย่างนี้ลงโน้ตสเกลขึ้นห้องละ 1 ตัว (ตัวแรกของห้อง แล้วค้างเสียงต่อ)</p>' +
      '<div class="mv-table-wrap"><table class="mv-table"><caption>ค่าตัวโน้ตพื้นฐานในอัตรา 4/4</caption><thead><tr><th>รูป</th><th>ชื่อ</th><th>จำนวนจังหวะ</th><th>นับ</th></tr></thead><tbody>' +
      vals.map(function (v) { return '<tr><td>' + v[4] + '</td><td>' + v[0] + ' <small>(' + v[1] + ')</small></td><td>' + v[2] + ' จังหวะ</td><td>' + v[3] + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function scaleChartMount() {
    var sc = scaleNotes(), K = KM();
    var notes = sc.map(function (r) { return { p: [r.note], d: 1, th: r.thai }; });
    var st = K.renderStaffSVG(notes, '4/4', 'mvsc');
    var staffEl = root.document.getElementById('mv-sc-staff'); staffEl.innerHTML = '<div style="position:relative;width:100%;min-width:440px;padding-bottom:' + (st.height / st.width * 100).toFixed(2) + '%;">' + st.svg + '</div>';
    root.document.getElementById('mv-sc-tines').innerHTML = K.renderTineSVG(tines(), 'mvt');
    var muteEl = root.document.getElementById('mv-sc-mute');
    function paintMute() { muteEl.innerHTML = '<label class="mv-chk"><input type="checkbox" id="mv-sc-mutebox"' + (K.isMuted() ? ' checked' : '') + '> ปิดเสียงคาลิมบ้า (ยังเห็นตำแหน่งบนบรรทัดและลิ่ม)</label>'; root.document.getElementById('mv-sc-mutebox').onchange = function () { K.setMuted(this.checked); }; }
    paintMute(); root.addEventListener('ppk-kalimba-mute-changed', paintMute);
    var cur = -1, trs = root.document.querySelectorAll('#mv-scale .mv-row'), i;
    function pick(ix) {
      var j, els = root.document.querySelectorAll('#mv-sc-tines .kt');
      if (cur >= 0) K.Widget.prototype._noteColor.call({ staffIds: st.ids }, cur, K.COLORS.idle, false);
      cur = ix;
      K.Widget.prototype._noteColor.call({ staffIds: st.ids }, ix, K.COLORS.cur, true);
      for (j = 0; j < els.length; j++) els[j].setAttribute('fill', els[j].getAttribute('data-note') === sc[ix].note ? K.COLORS.tineCur : K.COLORS.tineIdle);
      for (j = 0; j < trs.length; j++) trs[j].className = 'mv-row' + (j === ix ? ' mv-on' : '');
      K.previewNote(sc[ix].note, 0.9);
    }
    for (i = 0; i < trs.length; i++) {
      trs[i].onclick = (function (ix) { return function () { pick(ix); }; })(i);
      trs[i].onkeydown = (function (ix) { return function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(ix); } }; })(i);
    }
  }

  /* ---------- 4) เกณฑ์ประเมินจาก วก.5 ---------- */
  function criteriaHTML(period) {
    var W = G('WK5_PLANS') && G('WK5_PLANS')[GRADE] && (G('WK5_PLANS')[GRADE][period] || G('WK5_PLANS')[GRADE][String(period)]);
    var rub = W && W.rubric;
    if (!rub || !rub.length) return '<div class="mv-wrap"><p>ยังไม่มีสื่อ: คาบนี้ยังไม่มีเกณฑ์ประเมินใน วก.5</p></div>';
    var rows = rub.map(function (r) {
      return '<tr><th scope="row">' + esc(r.label) + '<div class="mv-w">น้ำหนัก ' + esc(r.weight) + ' คะแนน</div></th>' +
        ['4', '3', '2', '1'].map(function (k) { return '<td>' + esc((r.levels || {})[k] || '-') + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="mv-wrap"><p class="mv-lead">เกณฑ์ที่ครูใช้ประเมินในคาบที่ ' + period + ' (ระดับ 4 = ดีมาก … 1 = ปรับปรุง)' + (W.score_total ? ' · คะแนนเต็มคาบนี้ ' + esc(W.score_total) + ' คะแนน' : '') + '</p>' +
      '<div class="mv-table-wrap"><table class="mv-table mv-crit"><thead><tr><th>ด้านที่ประเมิน</th><th>ระดับ 4</th><th>ระดับ 3</th><th>ระดับ 2</th><th>ระดับ 1</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ---------- 5) ห้องสอบ (ข้อมูลสำหรับนักเรียน) ---------- */
  function examInfoHTML(period) {
    var pol = G('PeriodPolicy') && G('PeriodPolicy').get ? G('PeriodPolicy').get(GRADE, period) : null;
    var kind = pol && pol.exam === 'midterm' ? 'กลางภาค' : (pol && pol.exam === 'final' ? 'ปลายภาค' : '');
    return '<div class="mv-wrap"><p class="mv-lead">ระบบสอบดิจิทัล' + (kind ? esc(kind) : '') + ': ข้อสอบจะปรากฏในหน้าคาบนี้เมื่อ<strong>ครูเปิดห้องสอบ</strong>ให้ห้องของคุณเท่านั้น ก่อนถึงเวลานั้นยังเปิดดูหรือทำข้อสอบไม่ได้</p>' +
      '<ul class="mv-steps"><li>เข้าสอบด้วยบัญชีของตนเอง</li><li>ทำภายในเวลาที่ครูกำหนด</li><li>ส่งคำตอบแล้ว ครูจะเป็นผู้ประกาศผล</li></ul></div>';
  }

  /* ---------- 6) อุปกรณ์ที่ต้องเตรียม (ของจริง ไม่มีปุ่มเปิด) ---------- */
  function equipKey(period, i) { return 'ppk_equip_' + userId() + '_' + period + '_' + i; }
  function equipHTML(route, period) {
    var items = route.items || [];
    return '<div class="mv-equip"><div class="mv-equip-h">🧰 อุปกรณ์ที่ต้องเตรียม</div>' + items.map(function (t, i) {
      var on = false; try { on = root.localStorage.getItem(equipKey(period, i)) === '1'; } catch (e) {}
      return '<label class="mv-chk mv-equip-i"><input type="checkbox" onchange="MediaViews.tick(' + period + ',' + i + ',this.checked)"' + (on ? ' checked' : '') + '> ' + esc(t) + '</label>';
    }).join('') + '<div class="mv-foot" style="margin:4px 0 0;">นำมาในคาบนี้ — ติ๊ก "เตรียมแล้ว" เพื่อช่วยจำ (ไม่ส่งครูและไม่มีคะแนน)</div></div>';
  }

  /* ---------- 5) แผนภาพ 5 มิติอิทธิพลของดนตรีต่อสังคม (คาบ 18: แทนคลิปที่ไม่มีจริง; ภาพประกอบสร้างในแอป) ---------- */
  function influenceDims(period) {
    var W = G('WK5_PLANS') && G('WK5_PLANS')[GRADE] && (G('WK5_PLANS')[GRADE][period] || G('WK5_PLANS')[GRADE][String(period)]);
    var items = (W && W.activities && W.activities.teach && W.activities.teach.items) || [], i, m;
    for (i = 0; i < items.length; i++) {
      m = /5 มิติ\s*:\s*(1\)[\s\S]*?)(?:\s+นักเรียน|$)/.exec(String(items[i]));
      if (m) return m[1].split(/\s*\d\)\s*/).filter(function (x) { return x && x.replace(/\s+/g, ''); }).map(function (x) { return x.replace(/^\s+|\s+$/g, ''); });
    }
    return [];
  }
  /* ---------- งานศึกษาค้นคว้าตามกลุ่ม (คาบ 18, t76u): มิติ + บทบาท อ่านจาก วก.5 ล้วน ๆ ---------- */
  function groupRoles(period) {
    var W = G('WK5_PLANS') && G('WK5_PLANS')[GRADE] && (G('WK5_PLANS')[GRADE][period] || G('WK5_PLANS')[GRADE][String(period)]);
    var items = (W && W.activities && W.activities.teach && W.activities.teach.items) || [], i, m;
    for (i = 0; i < items.length; i++) {
      m = /แบ่ง\s*\d+\s*บทบาท\s*:\s*([\s\S]+)$/.exec(String(items[i]));
      if (m) return m[1].split(/\s*,\s*/).map(function (x) { return x.replace(/^\s*และ\s*/, '').replace(/^\s+|\s+$/g, ''); }).filter(Boolean);
    }
    return [];
  }
  function groupCount(period) {
    var W = G('WK5_PLANS') && G('WK5_PLANS')[GRADE] && (G('WK5_PLANS')[GRADE][period] || G('WK5_PLANS')[GRADE][String(period)]);
    var items = (W && W.activities && W.activities.teach && W.activities.teach.items) || [], i, m;
    for (i = 0; i < items.length; i++) { m = /เข้ากลุ่ม\s*(\d+)\s*กลุ่ม/.exec(String(items[i])); if (m) return Number(m[1]); }
    return 0;
  }
  /** มีงานกลุ่มค้นคว้าตามมิติหรือไม่ — ต้องมีทั้งรายการมิติ, บทบาท และจำนวนกลุ่ม = จำนวนมิติ ใน วก.5 ของคาบนั้น */
  function hasGroupTask(period) {
    var d = influenceDims(period), r = groupRoles(period), n = groupCount(period);
    return d.length > 0 && r.length > 0 && n === d.length;
  }
  function gtKey(period) { return 'ms_groupTask_' + userId() + '_' + period; }
  function gtLoad(period) { try { return JSON.parse(root.localStorage.getItem(gtKey(period)) || '{}') || {}; } catch (e) { return {}; } }
  function gtSave(period, o) { try { root.localStorage.setItem(gtKey(period), JSON.stringify(o)); } catch (e) {} }
  function gtSummary(period, o) {
    var dims = influenceDims(period), roles = groupRoles(period), g = Number(o.g) || 0, r = Number(o.r) || 0;
    if (!g || !r || g > dims.length || r > roles.length) return null;
    return { g: g, dim: dims[g - 1], role: roles[r - 1] };
  }
  function groupTaskHTML(period) {
    var dims = influenceDims(period), roles = groupRoles(period), st = gtLoad(period), s = gtSummary(period, st), i;
    var og = '<option value="">— เลือกกลุ่ม —</option>', or = '<option value="">— เลือกหน้าที่ —</option>';
    for (i = 0; i < dims.length; i++) og += '<option value="' + (i + 1) + '"' + (Number(st.g) === i + 1 ? ' selected' : '') + '>กลุ่มที่ ' + (i + 1) + '</option>';
    for (i = 0; i < roles.length; i++) or += '<option value="' + (i + 1) + '"' + (Number(st.r) === i + 1 ? ' selected' : '') + '>' + esc(roles[i]) + '</option>';
    return '<div id="student-group-task" class="mv-wrap mv-gt" data-period="' + Number(period) + '">' +
      '<h4 class="mv-h" style="margin-top:0">👥 งานศึกษาค้นคว้าตามกลุ่ม · หน้าที่ของฉัน</h4>' +
      '<p class="mv-lead">ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม ' + dims.length + ' กลุ่ม แต่ละกลุ่มรับผิดชอบ 1 มิติของอิทธิพลของดนตรีต่อสังคม สมาชิกในกลุ่มมีหน้าที่แตกต่างกัน เลือกกลุ่มและหน้าที่ของตนเองตามที่ครูกำหนด</p>' +
      '<div class="mv-two"><label class="mv-gt-l">กลุ่มของฉัน<select id="gt-group" class="form-input" onchange="MediaViews.groupTaskChange(' + Number(period) + ')">' + og + '</select></label>' +
      '<label class="mv-gt-l">หน้าที่ของฉัน<select id="gt-role" class="form-input" onchange="MediaViews.groupTaskChange(' + Number(period) + ')">' + or + '</select></label></div>' +
      '<div id="gt-out" class="mv-card" aria-live="polite">' + groupTaskOutHTML(period, s) + '</div>' +
      '<p class="mv-foot">มิติ 5 ข้อและหน้าที่ 8 บทมาจากแผนการจัดการเรียนรู้คาบนี้ (วก.5) · การจับคู่ "กลุ่มที่ N = มิติที่ N" เป็นการเรียงตามลำดับ <strong>รอครูยืนยัน</strong> ถ้าครูประกาศต่างจากนี้ให้ยึดตามครู · ส่งผลการค้นคว้าเป็นข้อความหรือวางลิงก์ในช่องส่งงานด้านล่าง (ไม่ต้องแนบไฟล์)</p></div>';
  }
  function groupTaskOutHTML(period, s) {
    if (!s) return '<span style="color:#64748b">เลือกกลุ่มและหน้าที่ของตนเอง แล้วจะแสดงมิติที่กลุ่มต้องค้นคว้าและงานของคุณ</span>';
    return '<div><strong>กลุ่มที่ ' + s.g + '</strong> · มิติที่ต้องค้นคว้า: <strong>' + esc(s.dim) + '</strong></div>' +
      '<div>หน้าที่ของฉัน: <strong>' + esc(s.role) + '</strong></div>' +
      '<div style="margin-top:4px">งานที่ต้องค้นคว้า: ศึกษาค้นคว้าอิทธิพลของดนตรีด้านมิติ "' + esc(s.dim) + '" ที่มีต่อบุคคลและชุมชนท้องถิ่นพะเยา ตามหน้าที่ "' + esc(s.role) + '" แล้วสรุปเป็นข้อความหรือแนบลิงก์ ' +
      'เพื่อนำไปร่างวัตถุประสงค์ กิจกรรม และผลลัพธ์ที่คาดว่าจะเกิดต่อชุมชนพะเยาร่วมกับกลุ่ม</div>' +
      '<button type="button" class="btn-nav-action" style="margin-top:6px;min-height:44px" onclick="MediaViews.groupTaskFill(' + Number(period) + ')">✍️ ใส่หัวข้อกลุ่มของฉันลงช่องคำตอบ</button>';
  }
  function groupTeacherHTML(period) {
    if (!hasGroupTask(period)) return '';
    var dims = influenceDims(period), roles = groupRoles(period);
    return '<h4 class="mv-h">สำหรับครู: การมอบหมายงานกลุ่ม</h4><div class="mv-table-wrap"><table class="mv-table"><caption>กลุ่ม ↔ มิติที่ต้องค้นคว้า (จับคู่ตามลำดับ — รอครูยืนยัน)</caption><thead><tr><th>กลุ่ม</th><th>มิติ</th></tr></thead><tbody>' +
      dims.map(function (d, i) { return '<tr><td>กลุ่มที่ ' + (i + 1) + '</td><td>' + esc(d) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="mv-foot" style="margin-top:6px">หน้าที่ ' + roles.length + ' บทใน 1 กลุ่ม (ตาม วก.5): ' + roles.map(esc).join(' · ') + '</p>';
  }
  function influence5HTML(period) {
    var dims = influenceDims(period || 18);
    if (!dims.length) return '<div class="mv-wrap"><p>ยังไม่มีสื่อ: ไม่พบรายการ 5 มิติใน วก.5 ของคาบนี้</p></div>';
    var cx = 150, cy = 120, R = 82, svg = '', i, a, x, y, cols = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];
    for (i = 0; i < dims.length; i++) { a = -Math.PI / 2 + i * 2 * Math.PI / dims.length; x = cx + R * Math.cos(a); y = cy + R * Math.sin(a);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#94a3b8" stroke-width="2"/>' +
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="19" fill="' + cols[i % cols.length] + '"/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 6).toFixed(1) + '" font-size="17" font-weight="bold" text-anchor="middle" fill="#fff">' + (i + 1) + '</text>'; }
    svg = '<svg viewBox="0 0 300 240" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;" role="img" aria-label="ภาพประกอบ 5 มิติอิทธิพลของดนตรีต่อสังคม">' +
      '<rect x="0" y="0" width="300" height="240" fill="#f8fafc"/>' + svg +
      '<circle cx="' + cx + '" cy="' + cy + '" r="30" fill="#1e293b"/><text x="' + cx + '" y="' + (cy + 5) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#fff">ดนตรี</text>' +
      '<text x="296" y="12" font-size="9" text-anchor="end" fill="#64748b">ภาพประกอบ</text></svg>';
    return '<div id="mv-influence5" class="mv-wrap">' + svg +
      '<ol class="mv-list" style="margin:10px 0 0;padding-left:1.4rem;line-height:1.7;">' + dims.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ol>' +
      '<p class="mv-foot">ภาพประกอบสร้างในแอป ใช้ประกอบการสนทนา — ไม่ใช่ข้อมูลวิจัยหรือสถิติ · หัวข้อ 5 มิติมาจากแผนการจัดการเรียนรู้คาบนี้ (วก.5) · แต่ละกลุ่มรับ 1 มิติเพื่อศึกษาค้นคว้า (แผนภาพนี้ไม่มีคลิป)</p>' +
      (isStaff() ? groupTeacherHTML(period || 18) : '') + '</div>';
  }

  /* ---------- ตัวเปิดหลัก ---------- */
  var CHIP = { guide: 'เปิดในแอป', syllabus: 'เปิดในแอป', acoustics: 'ลองเล่นได้', anatomy: 'ดูภาพประกอบ', metronome: 'เปิดเมโทรนอม', practice: 'เปิดแบบฝึกเล่นได้',
    scale_chart: 'เปิดตาราง', criteria: 'ดูเกณฑ์', ensemble: 'เปิดห้องสำรวจ', timbre: 'เปิดกิจกรรมฟัง', feldman: 'เปิดแบบฟอร์ม', influence5: 'ดูแผนภาพ', exam_info: 'รายละเอียดการสอบ', teacher_only: 'เฉพาะครู', external: 'ต้องใช้อินเทอร์เน็ต' };
  var MediaViews = {
    GRADE: GRADE,
    routeOf: function (url) { return G('MEDIA_ROUTES') ? G('MEDIA_ROUTES').lookup(GRADE, url) : null; },
    // เครื่องมือที่ "คาบนี้" ใช้จริงตามสื่อใน วก.5 (ได้จากตารางเส้นทางสื่อ ไม่ฮาร์ดโค้ดช่วงคาบ): { ensemble: 'thai'|'western'|null, feldman: bool }
    periodTools: function (period) {
      var out = { ensemble: null, feldman: false };
      try {
        var l = G('Store') && G('Store').getLesson ? G('Store').getLesson(GRADE, period) : null;
        var arr = (l && (l.media || l.media_links)) || [];
        for (var i = 0; i < arr.length; i++) {
          var r = this.routeOf(arr[i].url);
          if (!r) continue;
          if (r.route === 'ensemble' && !out.ensemble) out.ensemble = r.ensemble || 'thai';
          if (r.route === 'feldman') out.feldman = true;
        }
      } catch (e) {}
      return out;
    },
    chipLabel: function (route) { return route ? (CHIP[route.route] || '') : ''; },
    open: function (url, period) {
      var r = this.routeOf(url), m = lessonMedia(period, url), title = (m && m.title) || 'สื่อประจำคาบ';
      if (!r) { panel(title, '<div class="mv-wrap"><p>ยังไม่มีสื่อสำหรับรายการนี้</p></div>'); return false; }
      switch (r.route) {
        case 'guide': case 'syllabus': if (G('App')) G('App').openStudentMediaDoc(url, title, GRADE, period); return true;
        case 'acoustics': panel(title, acousticsHTML()); acousticsMount(); return true;
        case 'anatomy': panel(title, anatomyHTML()); return true;
        case 'scale_chart': panel(title, scaleChartHTML()); scaleChartMount(); return true;
        case 'criteria': panel(title, criteriaHTML(period)); return true;
        case 'exam_info': panel(title, examInfoHTML(period)); return true;
        case 'influence5': panel(title, influence5HTML(period)); return true;
        case 'metronome': if (G('Metronome')) G('Metronome').open(); return true;
        case 'practice':
          if (G('StudentPanels')) G('StudentPanels').close();
          if (G('VirtualKalimba')) G('VirtualKalimba').openModal(r.item);
          return true;
        case 'ensemble': if (G('EnsembleExplorer')) G('EnsembleExplorer').openModal(r.ensemble, null, Number(period) || null); return true;
        case 'timbre': if (G('TimbreListening') && G('TimbreListening').openModal()) return true; if (G('FeldmanCriticism')) G('FeldmanCriticism').openModal(Number(period) || 16); return true;
        case 'feldman': if (G('FeldmanCriticism')) G('FeldmanCriticism').openModal(Number(period) || 17); return true;
        case 'teacher_only': {
          var el = root.document.getElementById('exam-admin-panel');
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        case 'external': root.open(url, '_blank', 'noopener'); return true;
        default: return false; // equipment / missing: ไม่มีปุ่มเปิด
      }
    },
    /** ระดับชั้นที่ยังไม่มีตารางเส้นทาง (ม.2): คงพฤติกรรมเดิมเฉพาะที่เปิดได้จริง ที่เหลือบอกตรง ๆ ว่ายังไม่มีสื่อ */
    _otherGradeRow: function (m, period, grade, role) {
      var url = String(m.url || ''), t = esc(m.title);
      var box = 'margin-bottom:0.5rem;padding:0.55rem 0.85rem;background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:6px;font-size:0.86rem;';
      var chip = function (txt) { return '<span style="font-size:0.76rem;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;white-space:nowrap;">' + txt + '</span>'; };
      var lnk = 'color:#0369a1;font-weight:600;';
      if (/^https?:\/\//.test(url)) return '<div class="mv-item" style="' + box + '"><a href="' + esc(url) + '" target="_blank" rel="noopener" style="' + lnk + '">🔗 ' + t + '</a></div>';
      if (/musicsmart_guide|course_syllabus/.test(url) || /metronome/.test(url)) return '<div class="mv-item" style="' + box + '"><a href="javascript:void(0)" onclick="App.openStudentMediaDoc(\'' + esc(url) + '\',\'' + t.replace(/&#39;/g, '') + '\',\'' + esc(grade) + '\',' + Number(period) + ')" style="' + lnk + '">📄 ' + t + '</a></div>';
      if (/^(ensemble\/|rubric\/)/.test(url) || /timbre_feldman/.test(url)) return '<div class="mv-item" style="' + box + '"><a href="javascript:void(0)" onclick="App.openLessonMediaRoute(\'' + esc(url) + '\',' + Number(period) + ')" style="' + lnk + '">🎼 ' + t + '</a></div>';
      if (role !== 'teacher') return ''; // นักเรียนไม่เห็นรายการที่ไม่มีสื่อจริง
      return '<div class="mv-item" style="' + box + '"><span style="font-weight:600;color:#0369a1;">📄 ' + t + '</span> ' + chip('☐ ต้องเตรียม (ยังไม่มีไฟล์/สื่อในแอป)') + '</div>';
    },
    tick: function (period, i, on) { try { root.localStorage.setItem(equipKey(period, i), on ? '1' : '0'); } catch (e) {} },
    /** HTML ของแถวสื่อ 1 รายการ; คืน '' สำหรับรายการเฉพาะครูเมื่อ role = student */
    rowHTML: function (m, period, role, grade) {
      var url = String(m.url || ''), r = this.routeOf(url), t = esc(m.title), staff = role === 'teacher';
      if (grade && grade !== GRADE) return this._otherGradeRow(m, period, grade, role);
      var box = 'margin-bottom:0.5rem;padding:0.55rem 0.85rem;background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:6px;font-size:0.86rem;';
      var chip = function (txt, bg, fg) { return '<span style="font-size:0.76rem;background:' + bg + ';color:' + fg + ';padding:2px 8px;border-radius:4px;white-space:nowrap;">' + txt + '</span>'; };
      // นักเรียนไม่เห็นสื่อที่ไม่มีไฟล์/เครื่องมือจริงในแอป (กฎ: ถ้าไม่มีจริง อย่าโชว์) — ครูเห็นเป็นรายการ "ต้องเตรียม"
      if ((!r || r.route === 'missing') && !staff) return '';
      if (!r) return '<div class="mv-item" style="' + box + '" data-mv-todo="1"><span style="font-weight:600;color:#0369a1;">📄 ' + t + '</span> ' + chip('☐ ต้องเตรียม: ยังไม่มีสื่อนี้ในแอป', '#fff8e1', '#795548') + '</div>';
      if (r.cls === 'teacher' && !staff) return '';
      if (r.route === 'equipment') return '<div class="mv-item" style="' + box + '"><div style="font-weight:600;color:#0369a1;margin-bottom:4px;">' + t + '</div>' + equipHTML(r, period) + '</div>';
      if (r.route === 'missing') return '<div class="mv-item" style="' + box + '" data-mv-todo="1"><span style="font-weight:600;color:#0369a1;">📄 ' + t + '</span> ' + chip('☐ ต้องเตรียม: ยังไม่มีไฟล์ในแอป (นักเรียนยังไม่เห็นรายการนี้)', '#fff8e1', '#795548') + '</div>';
      var ic = r.route === 'practice' || r.route === 'scale_chart' || r.route === 'acoustics' || r.route === 'anatomy' || r.route === 'influence5' ? '🎼' : '📄';
      return '<div class="mv-item" style="' + box + '"><a href="javascript:void(0)" class="mv-open" onclick="MediaViews.open(\'' + esc(url) + '\',' + Number(period) + ')" style="color:#0369a1;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;text-decoration:none;min-height:44px;"><span>' + ic + ' ' + t + '</span>' + chip(esc(CHIP[r.route] || 'เปิด'), '#e0f2fe', '#0369a1') + '</a></div>';
    },
    hasGroupTask: hasGroupTask,
    groupTaskHTML: groupTaskHTML,
    groupTaskChange: function (period) {
      var g = root.document.getElementById('gt-group'), r = root.document.getElementById('gt-role'), o = { g: g && g.value, r: r && r.value };
      gtSave(period, o);
      var out = root.document.getElementById('gt-out'); if (out) out.innerHTML = groupTaskOutHTML(period, gtSummary(period, o));
    },
    groupTaskFill: function (period) {
      var s = gtSummary(period, gtLoad(period)), ta = root.document.getElementById('student-submission-text'); if (!s || !ta) return;
      var head = '[กลุ่มที่ ' + s.g + ' · มิติ: ' + s.dim + ' · หน้าที่: ' + s.role + ']';
      if (ta.value.indexOf('[กลุ่มที่ ') === 0) ta.value = ta.value.replace(/^\[กลุ่มที่ [^\]]*\]\s*/, '');
      ta.value = head + '\n' + ta.value;
      try { ta.dispatchEvent(new root.Event('input', { bubbles: true })); } catch (e) {} ta.focus();
    },
    _internals: { groupRoles: groupRoles, groupCount: groupCount, groupTeacherHTML: groupTeacherHTML, influenceDims: influenceDims, acousticsHTML: acousticsHTML, anatomyHTML: anatomyHTML, scaleChartHTML: scaleChartHTML, criteriaHTML: criteriaHTML, influence5HTML: influence5HTML, examInfoHTML: examInfoHTML, scaleNotes: scaleNotes, staffPos: staffPos }
  };
  root.MediaViews = MediaViews;
  if (typeof module !== 'undefined' && module.exports) module.exports = MediaViews;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
