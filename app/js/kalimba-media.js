/* ============================================================================
 * kalimba-media.js — สื่อคาลิมบ้ารายคาบ: ผังลิ่ม 17 ลิ่ม + บรรทัด 5 เส้นสากล (SVG)
 *                    + เมโทรนอม WebAudio (lookahead) + ปุ่มเล่นที่ไฮไลต์พร้อมเสียง
 *
 * ข้อกำหนด (fix_report_4):
 *  - ข้อมูลโน้ตมาจาก app/data/kalimba_media.js (สร้างจาก tools/curriculum/kalimba_media_source.json)
 *    ไม่มี markup / โน้ตฮาร์ดโค้ดรายเพลงในไฟล์นี้
 *  - เขียนแบบ ES5 เท่านั้น เพื่อมือถือรุ่นเก่า: ไม่ใช้ optional chaining, ??, arrow, template literal,
 *    let/const/class/async, ไม่ใช้ CSS flex-gap / aspect-ratio / container query / :has
 *    (สัดส่วนภาพใช้เทคนิค padding-bottom + SVG viewBox; เลย์เอาต์ใช้ inline-block/float)
 *  - ทำงานออฟไลน์ (ไม่เรียกเครือข่าย)
 * ============================================================================ */
(function (root) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var THAI = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
  var OCT_MARK = '\u0E4D'; // ํ
  var COL = { idle: '#263238', cur: '#e65100', done: '#2e7d32', tineIdle: '#cfd8dc', tineCur: '#ff9800', tineDone: '#a5d6a7' };

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = a; return v < a ? a : (v > b ? b : v); }

  /* ---------- โมเดลโน้ต ---------- */
  function parsePitch(s) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(String(s || ''));
    if (!m) return null;
    var acc = m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0);
    var oct = parseInt(m[3], 10);
    return { name: String(s), letter: m[1], acc: acc, oct: oct,
      dia: oct * 7 + LETTERS[m[1]],
      midi: 12 * (oct + 1) + SEMI[m[1]] + acc };
  }
  function freqOf(s) {
    var p = parsePitch(s); if (!p) return 0;
    return 440 * Math.pow(2, (p.midi - 69) / 12);
  }
  /** ป้ายโน้ตไทย (ด ร ม … ; อ็อกเทฟ 5 = ดํ) — คำนวณจากชื่อโน้ต ไม่ใช่ตารางรายเพลง */
  function thaiLabel(s) {
    var p = parsePitch(s); if (!p) return '';
    var out = THAI[LETTERS[p.letter]];
    var up = p.oct - 4, i;
    for (i = 0; i < up; i++) out += OCT_MARK;
    return out;
  }
  /** ค่าความยาว (จังหวะ) → รูปตัวโน้ต */
  function durationShape(d) {
    d = Number(d);
    var table = [
      { d: 4, open: true, stem: false, flags: 0, dots: 0 },
      { d: 3, open: true, stem: true, flags: 0, dots: 1 },
      { d: 2, open: true, stem: true, flags: 0, dots: 0 },
      { d: 1.5, open: false, stem: true, flags: 0, dots: 1 },
      { d: 1, open: false, stem: true, flags: 0, dots: 0 },
      { d: 0.75, open: false, stem: true, flags: 1, dots: 1 },
      { d: 0.5, open: false, stem: true, flags: 1, dots: 0 },
      { d: 0.25, open: false, stem: true, flags: 2, dots: 0 }
    ];
    var i;
    for (i = 0; i < table.length; i++) if (Math.abs(table[i].d - d) < 1e-6) return table[i];
    return null;
  }
  function parseMeter(m) {
    var x = /^(\d+)\/(\d+)$/.exec(String(m || '4/4'));
    var n = x ? parseInt(x[1], 10) : 4, dn = x ? parseInt(x[2], 10) : 4;
    return { num: n, den: dn, beatsPerBar: n * 4 / dn };
  }
  /** เวลาเริ่มของแต่ละโน้ต (หน่วยจังหวะ) */
  function buildEvents(notes) {
    var ev = [], t = 0, i;
    for (i = 0; i < (notes || []).length; i++) {
      ev.push({ idx: i, start: t, dur: notes[i].d, pitches: notes[i].p });
      t += notes[i].d;
    }
    return ev;
  }

  /* ---------- เรขาคณิตบรรทัด 5 เส้น (pure) ---------- */
  var STAFF = { W: 600, S: 8, sysH: 116, top: 44, x0: 6, clefX: 10, tsX: 44, leftFirst: 62, left: 40, right: 590, minNote: 24, beatUnit: 24, pad: 14 };

  function staffY(dia, yTop) { // yTop = เส้นบนสุด (F5, dia 38); เส้นล่างสุด E4 (dia 30)
    var yBottom = yTop + 4 * STAFF.S;
    return yBottom - (dia - 30) * (STAFF.S / 2);
  }

  /** จัดห้องเพลงและตำแหน่งโน้ต → { systems:[{measures:[{x,w,notes:[idx]}]}], pos:[{idx,x,sys}] } */
  function layoutStaff(notes, meter) {
    var mt = parseMeter(meter);
    var measures = [], cur = { notes: [], beats: 0 }, i, widths;
    for (i = 0; i < notes.length; i++) {
      cur.notes.push(i); cur.beats += notes[i].d;
      if (cur.beats + 1e-9 >= mt.beatsPerBar) { measures.push(cur); cur = { notes: [], beats: 0 }; }
    }
    if (cur.notes.length) measures.push(cur);
    if (!measures.length) measures.push({ notes: [], beats: 0 });
    function mWidth(m) {
      var w = STAFF.pad * 2, k;
      for (k = 0; k < m.notes.length; k++) w += Math.max(STAFF.minNote, notes[m.notes[k]].d * STAFF.beatUnit);
      return Math.max(w, 60);
    }
    var systems = [], sys = null, avail, used, mw;
    for (i = 0; i < measures.length; i++) {
      mw = mWidth(measures[i]);
      if (!sys) { sys = { measures: [], used: 0, left: systems.length === 0 ? STAFF.leftFirst : STAFF.left }; systems.push(sys); }
      avail = STAFF.right - sys.left;
      if (sys.measures.length && sys.used + mw > avail) {
        sys = { measures: [], used: 0, left: STAFF.left }; systems.push(sys);
        avail = STAFF.right - sys.left;
      }
      sys.measures.push({ m: measures[i], w0: mw }); sys.used += mw;
    }
    var pos = [], si, mi, scale, x, mm, k2, nx, nw;
    for (si = 0; si < systems.length; si++) {
      sys = systems[si];
      avail = STAFF.right - sys.left;
      scale = (si < systems.length - 1 || sys.used > avail) ? avail / sys.used : Math.min(1.0, avail / sys.used);
      if (scale > 1.5) scale = 1.5;
      x = sys.left;
      for (mi = 0; mi < sys.measures.length; mi++) {
        mm = sys.measures[mi];
        mm.x = x; mm.w = mm.w0 * scale;
        nx = x + STAFF.pad * scale;
        for (k2 = 0; k2 < mm.m.notes.length; k2++) {
          nw = Math.max(STAFF.minNote, notes[mm.m.notes[k2]].d * STAFF.beatUnit) * scale;
          pos.push({ idx: mm.m.notes[k2], x: nx + nw / 2, sys: si });
          nx += nw;
        }
        x += mm.w;
      }
      sys.end = x;
    }
    return { systems: systems, pos: pos, meter: mt, height: systems.length * STAFF.sysH + 12 };
  }

  /** วาดบรรทัด 5 เส้น → { svg: string, ids: {idx:'id'}, height } ; id ใช้ prefix กันซ้ำเมื่อมีหลายวิดเจ็ต */
  function renderStaffSVG(notes, meter, prefix) {
    var lay = layoutStaff(notes || [], meter);
    var W = STAFF.W, H = lay.height, S = STAFF.S, out = [], si, k, p, mi, sys, mm, yTop, ids = {};
    out.push('<svg xmlns="' + SVGNS + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" ' +
      'style="position:absolute;left:0;top:0;width:100%;height:100%;" role="img" aria-label="โน้ตบรรทัด 5 เส้น">');
    out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>');
    for (si = 0; si < lay.systems.length; si++) {
      sys = lay.systems[si];
      yTop = si * STAFF.sysH + STAFF.top;
      for (k = 0; k < 5; k++) {
        out.push('<line x1="' + STAFF.x0 + '" y1="' + (yTop + k * S) + '" x2="' + sys.end + '" y2="' + (yTop + k * S) + '" stroke="#37474f" stroke-width="1"/>');
      }
      out.push('<line x1="' + STAFF.x0 + '" y1="' + yTop + '" x2="' + STAFF.x0 + '" y2="' + (yTop + 4 * S) + '" stroke="#37474f" stroke-width="1.4"/>');
      out.push(clefSVG(STAFF.clefX, yTop));
      if (si === 0) {
        // อัตราจังหวะ: ตัวเลขซ้อน (บน/ล่าง) อยู่กลางบรรทัด ห่างจากกุญแจและโน้ตตัวแรก
        out.push('<text class="ts" x="' + STAFF.tsX + '" y="' + (yTop + 2 * S - 1.5) + '" font-size="16" font-weight="bold" text-anchor="middle" font-family="Georgia,serif" fill="#263238">' + lay.meter.num + '</text>');
        out.push('<text class="ts" x="' + STAFF.tsX + '" y="' + (yTop + 4 * S - 1.5) + '" font-size="16" font-weight="bold" text-anchor="middle" font-family="Georgia,serif" fill="#263238">' + lay.meter.den + '</text>');
      }
      for (mi = 0; mi < sys.measures.length; mi++) {
        mm = sys.measures[mi];
        var bx = mm.x + mm.w, last = (si === lay.systems.length - 1 && mi === sys.measures.length - 1);
        out.push('<line x1="' + bx + '" y1="' + yTop + '" x2="' + bx + '" y2="' + (yTop + 4 * S) + '" stroke="#37474f" stroke-width="' + (last ? 1 : 1) + '"/>');
        if (last) out.push('<line x1="' + (bx + 3) + '" y1="' + yTop + '" x2="' + (bx + 3) + '" y2="' + (yTop + 4 * S) + '" stroke="#37474f" stroke-width="3"/>');
      }
    }
    for (k = 0; k < lay.pos.length; k++) {
      p = lay.pos[k];
      out.push(noteSVG(notes[p.idx], p.x, p.sys * STAFF.sysH + STAFF.top, prefix + '-n' + p.idx, p.idx));
      ids[p.idx] = prefix + '-n' + p.idx;
    }
    // บรรทัดนับจังหวะ (1 2 3 4): ตัวเลข = จังหวะที่โน้ตเริ่ม, "–" = ยังค้างเสียงต่อ (ตัวขาว 2 จังหวะ ตัวกลม 4 จังหวะ)
    var pidx = {}, cnt = ['<g class="kcnt" data-role="counts">'], sj, mj, nj, acc, nn, ds, lab2, yy;
    for (k = 0; k < lay.pos.length; k++) pidx[lay.pos[k].idx] = lay.pos[k];
    for (sj = 0; sj < lay.systems.length; sj++) {
      for (mj = 0; mj < lay.systems[sj].measures.length; mj++) {
        acc = 0;
        for (nj = 0; nj < lay.systems[sj].measures[mj].m.notes.length; nj++) {
          var ix = lay.systems[sj].measures[mj].m.notes[nj]; nn = notes[ix]; ds = Number(nn.d);
          if (nn.p && nn.p.length && pidx[ix] && Math.abs(acc - Math.round(acc)) < 1e-6) {
            lab2 = String(Math.round(acc) + 1);
            var extra = Math.max(0, Math.round(ds) - 1), q;
            for (q = 0; q < extra; q++) lab2 += ' –';
            yy = sj * STAFF.sysH + STAFF.top + 4 * S + 46;
            cnt.push('<text x="' + pidx[ix].x + '" y="' + yy + '" font-size="10" text-anchor="middle" fill="#1565c0" font-weight="bold">' + lab2 + '</text>');
          }
          acc += ds;
        }
      }
    }
    cnt.push('</g>');
    out.push(cnt.join(''));
    return finishStaff(out, notes, W, H, ids);
  }
  function finishStaff(out, notes, W, H, ids) {
    if (!notes || !notes.length) {
      out.push('<text x="' + (W / 2) + '" y="' + (STAFF.top + 2 * STAFF.S + 4) + '" font-size="13" text-anchor="middle" fill="#b71c1c">ยังไม่มีโน้ต – รอครูใส่</text>');
    }
    out.push('</svg>');
    return { svg: out.join(''), ids: ids, height: H, width: W };
  }

  /** กุญแจซอล (G clef) วาดด้วยเส้นโค้ง SVG — ไม่พึ่งฟอนต์ Unicode (มือถือเก่าไม่มี 𝄞)
   *  ขดวงรอบเส้นที่ 2 จากล่าง (เส้น G4) · หางอยู่ใต้บรรทัด · ห่วงบนสูงกว่าเส้นบนสุดประมาณ 1.5 ช่อง
   *  x = ขอบซ้ายของกล่องกุญแจ (กว้างราว 2.4 ช่องบรรทัด), yTop = เส้นบนสุด, S = ระยะห่างเส้น */
  function clefPath(x, yTop, S) {
    var k = S / 8, g = yTop + 3 * S, cx = x + 10 * k;
    function P(dx, dy) { return (cx + dx * k).toFixed(2) + ',' + (g + dy * k).toFixed(2); }
    return [
      'M' + P(-5.5, 15.5), 'C' + P(-5.5, 20.5) + ' ' + P(1.5, 21.5) + ' ' + P(1.8, 15),
      'L' + P(3.2, -24),
      'C' + P(3.6, -31) + ' ' + P(-0.5, -35) + ' ' + P(-3.2, -29),
      'C' + P(-6, -22) + ' ' + P(-5, -14) + ' ' + P(-2, -9),
      'C' + P(3, -3) + ' ' + P(9.5, -2) + ' ' + P(9, 4.5),
      'C' + P(8.5, 10.5) + ' ' + P(0, 12.5) + ' ' + P(-4.5, 7.5),
      'C' + P(-8.5, 3) + ' ' + P(-5.5, -4.5) + ' ' + P(1, -4.8),
      'C' + P(5.2, -5) + ' ' + P(6.6, -0.5) + ' ' + P(3.8, 2.2),
      'C' + P(2, 3.8) + ' ' + P(-1, 2.4) + ' ' + P(-0.6, 0.2)
    ].join(' ');
  }
  function clefSVG(x, yTop) {
    return '<path class="clef" d="' + clefPath(x, yTop, STAFF.S) + '" fill="none" stroke="#263238" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  /** ตัวพัก (rest) — วาดด้วยรูปทรงพื้นฐาน ไม่พึ่งฟอนต์ */
  function restSVG(note, cx, yTop, id, idx) {
    var S = STAFF.S, d = Number(note.d), c = COL.idle, g = '', dots = 0, y1 = yTop + S, y2 = yTop + 2 * S;
    if (d === 4) g = '<rect class="ks" x="' + (cx - 6) + '" y="' + y1 + '" width="12" height="' + (S / 2) + '" fill="' + c + '" stroke="' + c + '"/>';
    else if (d === 2 || d === 3) { g = '<rect class="ks" x="' + (cx - 6) + '" y="' + (y2 - S / 2) + '" width="12" height="' + (S / 2) + '" fill="' + c + '" stroke="' + c + '"/>'; if (d === 3) dots = 1; }
    else if (d === 1 || d === 1.5) { g = '<path class="ks" d="M' + (cx - 2) + ',' + (yTop + 6) + ' L' + (cx + 3) + ',' + (yTop + 13) + ' L' + (cx - 3) + ',' + (yTop + 20) + ' L' + (cx + 2) + ',' + (yTop + 27) + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round"/>'; if (d === 1.5) dots = 1; }
    else {
      var n = (d === 0.25) ? 2 : 1, k;
      for (k = 0; k < n; k++) g += '<circle class="ks" cx="' + (cx - 2 + k * 2) + '" cy="' + (yTop + 12 + k * 7) + '" r="2.2" fill="' + c + '" stroke="' + c + '"/>';
      g += '<path class="ks" d="M' + (cx + 3) + ',' + (yTop + 11) + ' L' + (cx - 3 + (n - 1) * 2) + ',' + (yTop + 12 + (n - 1) * 7 + 12) + '" fill="none" stroke="' + c + '" stroke-width="1.6"/>';
      if (d === 0.75) dots = 1;
    }
    if (dots) g += '<circle class="ks" cx="' + (cx + 10) + '" cy="' + (yTop + 15) + '" r="1.6" fill="' + c + '" stroke="' + c + '"/>';
    return '<g id="' + id + '" data-i="' + idx + '" data-rest="1">' + g + '</g><text x="' + cx + '" y="' + (yTop + 4 * S + 28) + '" font-size="9" text-anchor="middle" fill="#607d8b">พัก</text>';
  }

  /** สร้างกลุ่มโน้ตหนึ่งตัว/คอร์ด */
  function noteSVG(note, cx, yTop, id, idx) {
    var pitches = note.p || [], shape = durationShape(note.d) || durationShape(1);
    var S = STAFF.S, parts = [], i, pp, y, ys = [], dias = [], upStem, xs = [], ledger = [];
    for (i = 0; i < pitches.length; i++) {
      pp = parsePitch(pitches[i]); if (!pp) continue;
      dias.push(pp.dia); ys.push(staffY(pp.dia, yTop));
    }
    if (!dias.length) return pitches.length ? '<g id="' + id + '"></g>' : restSVG(note, cx, yTop, id, idx);
    var avg = 0; for (i = 0; i < dias.length; i++) avg += dias[i]; avg /= dias.length;
    upStem = avg < 34; // ต่ำกว่าเส้นกลาง (B4) ก้านขึ้น
    var order = dias.slice().sort(function (a, b) { return a - b; });
    var shift = {}; // โน้ตที่ห่างกัน 1 ขั้นในคอร์ดต้องเลื่อนหัวโน้ต
    for (i = 1; i < order.length; i++) if (order[i] - order[i - 1] === 1 && !shift[order[i - 1]]) shift[order[i]] = true;
    var topY = 1e9, botY = -1e9;
    for (i = 0; i < dias.length; i++) {
      y = ys[i];
      if (y < topY) topY = y; if (y > botY) botY = y;
      var dx = shift[dias[i]] ? 9 : 0;
      xs.push(cx + dx);
      parts.push('<ellipse class="kh" data-open="' + (shape.open ? 1 : 0) + '" cx="' + (cx + dx) + '" cy="' + y + '" rx="5.4" ry="3.9" transform="rotate(-20 ' + (cx + dx) + ' ' + y + ')" ' +
        'fill="' + (shape.open ? '#ffffff' : COL.idle) + '" stroke="' + COL.idle + '" stroke-width="1.4"/>');
      if (dias[i] <= 28 && dias[i] % 2 === 0) ledger.push(y); // เส้นน้อยล่าง (C4 …)
      if (dias[i] >= 40 && dias[i] % 2 === 0) ledger.push(y); // เส้นน้อยบน (A5 …)
      // เส้นน้อยของโน้ตที่อยู่ไกลกว่า ต้องมีทุกเส้นระหว่างทาง
    }
    var lg = '', ly, minD = order[0], maxD = order[order.length - 1], dd;
    for (dd = 28; dd >= minD; dd -= 2) { ly = staffY(dd, yTop); lg += '<line x1="' + (cx - 9) + '" y1="' + ly + '" x2="' + (cx + 9) + '" y2="' + ly + '" stroke="#37474f" stroke-width="1"/>'; }
    for (dd = 40; dd <= maxD; dd += 2) { ly = staffY(dd, yTop); lg += '<line x1="' + (cx - 9) + '" y1="' + ly + '" x2="' + (cx + 9) + '" y2="' + ly + '" stroke="#37474f" stroke-width="1"/>'; }
    var stem = '', sx, y1, y2;
    if (shape.stem) {
      if (upStem) { sx = cx + 5.0; y1 = botY; y2 = topY - 28; }
      else { sx = cx - 5.0; y1 = topY; y2 = botY + 28; }
      stem = '<line class="ks" x1="' + sx + '" y1="' + y1 + '" x2="' + sx + '" y2="' + y2 + '" stroke="' + COL.idle + '" stroke-width="1.4"/>';
      var f, fy;
      for (f = 0; f < shape.flags; f++) {
        fy = upStem ? (y2 + f * 6) : (y2 - f * 6);
        stem += '<path class="ks" d="M' + sx + ',' + fy + ' C' + (sx + 9) + ',' + (fy + (upStem ? 7 : -7)) + ' ' + (sx + 9) + ',' + (fy + (upStem ? 13 : -13)) + ' ' + (sx + 4) + ',' + (fy + (upStem ? 18 : -18)) + '" fill="none" stroke="' + COL.idle + '" stroke-width="1.6"/>';
      }
    }
    var dots = '', k;
    for (k = 0; k < shape.dots; k++) dots += '<circle class="ks" cx="' + (cx + 11 + k * 5) + '" cy="' + (ys[0] - ((dias[0] % 2 === 0) ? 3 : 0)) + '" r="1.6" fill="' + COL.idle + '"/>';
    var lab = '<text x="' + cx + '" y="' + (yTop + 4 * S + 28 + (botY > yTop + 4 * S + 14 ? 12 : 0)) + '" font-size="9" text-anchor="middle" fill="#607d8b">' + esc(note.th || thaiLabel(pitches[0])) + '</text>';
    return lg + '<g id="' + id + '" data-i="' + idx + '">' + parts.join('') + stem + dots + '</g>' + lab;
  }

  /* ---------- ผังลิ่มคาลิมบ้า 17 ลิ่ม ---------- */
  var TINE_GEOM = { W: 340, H: 150, tw: 18, colGap: 1.5, maxH: 138, minH: 62, x0: 3, y0: 6 };

  /** tines = รายชื่อโน้ตซ้าย→ขวา (จาก KALIMBA_MEDIA.tines); ลิ่มกลางยาวสุด สั้นลงเมื่อห่างจากกลาง
   *  ชื่อโน้ตพิมพ์ "บนปลายลิ่ม" (ในหัวลิ่ม): ชื่อไทย (ด ร ม…) ตัวใหญ่ + ตัวอักษรสากล (C4) ตัวเล็กใต้ชื่อไทย */
  function renderTineSVG(tines, prefix) {
    var G = TINE_GEOM, n = tines.length, mid = (n - 1) / 2, out = [], i, h, x, dist, step;
    step = n > 1 ? (G.maxH - G.minH) / mid : 0;
    var totalW = n * G.tw + (n - 1) * G.colGap, left = (G.W - totalW) / 2;
    out.push('<svg xmlns="' + SVGNS + '" viewBox="0 0 ' + G.W + ' ' + G.H + '" preserveAspectRatio="xMidYMid meet" ' +
      'style="position:absolute;left:0;top:0;width:100%;height:100%;" role="img" aria-label="ผังลิ่มคาลิมบ้า ' + n + ' ลิ่ม">');
    out.push('<rect x="0" y="0" width="' + G.W + '" height="' + G.H + '" rx="10" fill="#eceff1"/>');
    for (i = 0; i < n; i++) {
      dist = Math.abs(i - mid); h = G.maxH - dist * step; x = left + i * (G.tw + G.colGap);
      out.push('<rect id="' + prefix + '-t-' + tines[i] + '" class="kt" x="' + x + '" y="' + G.y0 + '" width="' + G.tw + '" height="' + h + '" rx="3" fill="' + COL.tineIdle + '" stroke="#78909c" stroke-width="1" data-note="' + tines[i] + '" style="cursor:pointer;"/>');
      out.push('<text class="kn" x="' + (x + G.tw / 2) + '" y="' + (G.y0 + 15) + '" font-size="11" text-anchor="middle" fill="#102027" font-weight="bold" style="pointer-events:none;">' + esc(thaiLabel(tines[i])) + '</text>');
      out.push('<text class="kn" x="' + (x + G.tw / 2) + '" y="' + (G.y0 + 26) + '" font-size="7.6" text-anchor="middle" fill="#37474f" font-weight="bold" style="pointer-events:none;">' + esc(tines[i]) + '</text>');
    }
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- เสียงสังเคราะห์ (ออฟไลน์) ---------- */
  function playTone(ctx, out, pitch, when, dur, vol) {
    var f = freqOf(pitch); if (!f) return;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    var rel = Math.min(Math.max(dur, 0.35), 1.6);
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.value = f; o2.frequency.value = f * 2;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.38 * vol, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, when + rel);
    o1.connect(g); o2.connect(g); g.connect(out);
    o1.start(when); o2.start(when);
    o1.stop(when + rel + 0.05); o2.stop(when + rel + 0.05);
  }
  function playClick(ctx, out, when, accent) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, when + 0.045);
    o.connect(g); g.connect(out);
    o.start(when); o.stop(when + 0.06);
  }

  /* ---------- Transport: ตารางเวลา lookahead (เมโทรนอม + โน้ต ใช้นาฬิกา AudioContext เดียวกัน) ---------- */
  function Transport(opts) {
    opts = opts || {};
    this.getCtx = opts.getCtx;               // ฟังก์ชันคืน AudioContext (สร้างเมื่อกดครั้งแรก)
    this.lookahead = opts.lookahead || 0.12; // วินาทีที่จองล่วงหน้า
    this.interval = opts.interval || 25;     // ms ของตัวจอง
    this.setTimer = opts.setTimer || function (fn, ms) { return root.setInterval(fn, ms); };
    this.clearTimer = opts.clearTimer || function (h) { root.clearInterval(h); };
    this.bpm = clamp(opts.bpm || 60, 20, 300);
    this.beatsPerBar = opts.beatsPerBar || 4;
    this.countIn = opts.countIn || 0;        // จำนวนจังหวะนับนำก่อนเริ่มโน้ต
    this.click = !!opts.click;               // เสียงเมโทรนอม
    this.events = [];
    this.state = 'stopped';
    this.onBeat = opts.onBeat || function () {};
    this.onNote = opts.onNote || function () {};
    this.onEnd = opts.onEnd || function () {};
    this.onState = opts.onState || function () {};
    this.queue = [];
    this.timer = null; this.uiTimer = null;
    this.anchorTime = 0; this.anchorBeat = 0; this.nextBeat = 0; this.nextEv = 0;
    this.pausedBeat = 0; this.out = null; this.endBeat = 0; this.volume = 1;
  }
  Transport.prototype.spb = function () { return 60 / this.bpm; };
  Transport.prototype.beatToTime = function (b) { return this.anchorTime + (b - this.anchorBeat) * this.spb(); };
  Transport.prototype.timeToBeat = function (t) { return this.anchorBeat + (t - this.anchorTime) / this.spb(); };
  Transport.prototype.setEvents = function (events) {
    this.events = events || [];
    var last = this.events.length ? this.events[this.events.length - 1] : null;
    this.endBeat = last ? last.start + last.dur : 0;
  };
  Transport.prototype._freshOut = function (ctx) {
    if (this.out) { try { this.out.disconnect(); } catch (e) {} }
    this.out = ctx.createGain(); this.out.gain.value = 1; this.out.connect(ctx.destination);
  };
  Transport.prototype.setBpm = function (bpm) {
    bpm = clamp(bpm, 20, 300);
    if (this.state === 'playing') {
      var ctx = this.getCtx(), now = ctx.currentTime, cur = this.timeToBeat(now);
      this.anchorBeat = cur; this.anchorTime = now;
    }
    this.bpm = bpm;
  };
  Transport.prototype.setClick = function (on) { this.click = !!on; };
  Transport.prototype._begin = function (fromBeat) {
    var ctx = this.getCtx(), i;
    if (ctx.resume) { try { ctx.resume(); } catch (e) {} }
    this._freshOut(ctx);
    this.anchorBeat = fromBeat; this.anchorTime = ctx.currentTime + 0.06;
    this.nextBeat = Math.ceil(fromBeat - 1e-9);
    this.nextEv = 0;
    for (i = 0; i < this.events.length; i++) { if (this.events[i].start >= fromBeat - 1e-9) break; }
    this.nextEv = i;
    this.queue = [];
    this._setState('playing');
    var self = this;
    this.timer = this.setTimer(function () { self.tick(); }, this.interval);
    this.uiTimer = this.setTimer(function () { self.pump(); }, 16);
    this.endQueued = false;
    this.tick();
  };
  Transport.prototype._setState = function (s) { this.state = s; this.onState(s); };
  Transport.prototype.start = function () {
    if (this.state === 'playing') return;
    if (this.state === 'paused') { this._begin(this.pausedBeat); return; }
    this._begin(-this.countIn);
  };
  Transport.prototype.pause = function () {
    if (this.state !== 'playing') return;
    var ctx = this.getCtx();
    this.pausedBeat = this.timeToBeat(ctx.currentTime);
    this._halt(ctx);
    this._setState('paused');
  };
  Transport.prototype._halt = function (ctx) {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
    if (this.uiTimer !== null) { this.clearTimer(this.uiTimer); this.uiTimer = null; }
    if (this.out) { try { this.out.disconnect(); } catch (e) {} this.out = null; }
    this.queue = [];
  };
  Transport.prototype.stop = function () {
    var was = this.state;
    if (was !== 'stopped') {
      var ctx = this.getCtx();
      this._halt(ctx);
    }
    this.pausedBeat = 0;
    this._setState('stopped');
    this.onNote(-1, 'reset');
  };
  Transport.prototype.restart = function () { this.stop(); this.start(); };
  /** จองเสียง/เหตุการณ์ภาพล่วงหน้าภายใน lookahead (เรียกจากตัวตั้งเวลา หรือเรียกตรง ๆ ในการทดสอบ) */
  Transport.prototype.tick = function () {
    if (this.state !== 'playing') return;
    var ctx = this.getCtx(), horizon = ctx.currentTime + this.lookahead, t, ev, bar, j, pitches;
    var guard = 0;
    while (guard++ < 256) {
      t = this.beatToTime(this.nextBeat);
      if (t >= horizon) break;
      bar = this.beatsPerBar;
      var inBar = ((this.nextBeat % bar) + bar) % bar;
      if (this.click && this.out) playClick(ctx, this.out, t, inBar === 0);
      this.queue.push({ time: t, kind: 'beat', beat: this.nextBeat, inBar: inBar, count: this.nextBeat < 0 });
      this.nextBeat++;
    }
    guard = 0;
    while (this.nextEv < this.events.length && guard++ < 256) {
      ev = this.events[this.nextEv];
      t = this.beatToTime(ev.start);
      if (t >= horizon) break;
      var dur = ev.dur * this.spb();
      if (this.out && !this.muteNotes) { for (j = 0; j < ev.pitches.length; j++) playTone(ctx, this.out, ev.pitches[j], t, dur, this.volume); }
      this.queue.push({ time: t, kind: 'on', idx: ev.idx });
      this.queue.push({ time: t + dur * 0.98, kind: 'off', idx: ev.idx });
      this.nextEv++;
    }
    this.queue.sort(function (a, b) { return a.time - b.time; });
    if (this.events.length && this.nextEv >= this.events.length && !this.endQueued) {
      this.endQueued = true;
      this.queue.push({ time: this.beatToTime(this.endBeat) + 0.05, kind: 'end' });
    }
    if (this.nextEv < this.events.length) this.endQueued = false;
  };
  /** ส่งเหตุการณ์ภาพที่ถึงเวลาแล้ว */
  Transport.prototype.pump = function () {
    if (this.state !== 'playing') return;
    var ctx = this.getCtx(), now = ctx.currentTime, q;
    while (this.queue.length && this.queue[0].time <= now + 0.002) {
      q = this.queue.shift();
      if (q.kind === 'beat') this.onBeat(q.beat, q.inBar, q.count);
      else if (q.kind === 'on') this.onNote(q.idx, 'on');
      else if (q.kind === 'off') this.onNote(q.idx, 'off');
      else if (q.kind === 'end') { this.endQueued = false; this.stop(); this.onEnd(); return; }
    }
  };

  /* ---------- วิดเจ็ตสื่อคาลิมบ้า ---------- */
  var uidSeq = 0, sharedCtx = null, styleDone = false;

  function getAudioContext() {
    if (sharedCtx) return sharedCtx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { sharedCtx = new AC(); } catch (e) { sharedCtx = null; }
    return sharedCtx;
  }
  function prefersReducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  /* ---------- โหมดปิดเสียงคาลิมบ้า (ฝึกกับเมโทรนอมเท่านั้น) — จำค่าต่อเครื่อง ---------- */
  var MUTE_KEY = 'ppk_kalimba_mute', muteMem = false, widgetsLive = [];
  function isMuted() {
    try { if (root.localStorage) return root.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    return muteMem;
  }
  function setMuted(on) {
    on = !!on; muteMem = on;
    try { if (root.localStorage) root.localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch (e) {}
    var i; for (i = 0; i < widgetsLive.length; i++) { try { widgetsLive[i]._syncMute(); } catch (e2) {} }
    try {
      if (root.document && root.document.createEvent && root.dispatchEvent) {
        var ev = root.document.createEvent('Event'); ev.initEvent('ppk-kalimba-mute-changed', false, false); root.dispatchEvent(ev);
      }
    } catch (e3) {}
    return on;
  }

  function injectStyle() {
    if (styleDone || !root.document) return; styleDone = true;
    var st = root.document.createElement('style');
    st.type = 'text/css';
    st.appendChild(root.document.createTextNode(
      '.km-box{background:#fff;border:1px solid #cfd8dc;border-radius:10px;padding:10px;margin:8px 0;font-family:inherit;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;overflow:hidden;}' +
      '.km-head{margin-bottom:6px;font-weight:700;color:#1e3a8a;line-height:1.4;}' +
      '.km-badge{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:9px;margin-left:4px;vertical-align:middle;}' +
      '.km-b-ok{background:#e8f5e9;color:#1b5e20;}.km-b-warn{background:#fff8e1;color:#8d6e00;}.km-b-bad{background:#ffebee;color:#b71c1c;}' +
      '.km-note{font-size:12px;line-height:1.5;margin:4px 0;padding:6px 8px;border-radius:6px;background:#fff8e1;color:#6d4c00;}' +
      '.km-missing{background:#ffebee;color:#b71c1c;font-weight:600;}' +
      '.km-frame{position:relative;width:100%;height:0;overflow:hidden;margin:6px 0;border-radius:8px;}' +
      '.km-ctl{margin-top:6px;text-align:left;}' +
      '.km-btn{display:inline-block;margin:0 6px 6px 0;padding:9px 13px;font-size:14px;border:1px solid #90a4ae;border-radius:8px;background:#f5f7fa;color:#263238;cursor:pointer;min-width:44px;text-align:center;-webkit-appearance:none;}' +
      '.km-btn.km-on{background:#1565c0;color:#fff;border-color:#0d47a1;}' +
      '.km-btn[disabled]{opacity:.45;cursor:default;}' +
      '.km-bpm{display:inline-block;margin:0 8px 6px 0;vertical-align:middle;}' +
      '.km-bpm input[type=range]{width:130px;vertical-align:middle;}' +
      '.km-dot{display:inline-block;width:16px;height:16px;margin:0 5px 0 0;border-radius:50%;background:#cfd8dc;vertical-align:middle;}' +
      '.km-dot.km-d-on{background:#ff9800;}.km-dot.km-d-acc{background:#e65100;}.km-dot.km-d-cnt{background:#42a5f5;}' +
      '.km-tabs{margin:4px 0;}.km-tab{display:inline-block;margin:0 6px 6px 0;padding:6px 10px;font-size:13px;border:1px solid #90a4ae;border-radius:14px;background:#fff;cursor:pointer;}' +
      '.km-tab.km-on{background:#e3f2fd;border-color:#1565c0;font-weight:700;}' +
      '.km-dev{margin:6px 0;padding:8px;border:1px dashed #1565c0;border-radius:8px;background:#f3f8ff;font-size:13px;}' +
      '.km-dev input{padding:6px 8px;font-size:15px;width:110px;border:1px solid #90a4ae;border-radius:6px;}' +
      '.km-dev .km-msg{display:block;margin-top:4px;font-size:12px;}' +
      '.km-tnotes{margin:6px 0;border:1px dashed #ffb300;border-radius:8px;padding:4px 8px;background:#fffdf3;font-size:13px;}.km-tnotes summary{cursor:pointer;font-weight:700;color:#8d6e00;}' +
      '.km-kbd{margin-top:8px;}' +
      '.km-mute{display:block;width:100%;margin:6px 0;padding:11px 12px;font-size:15px;font-weight:700;border:2px solid #1565c0;border-radius:10px;background:#e3f2fd;color:#0d47a1;cursor:pointer;text-align:left;-webkit-box-sizing:border-box;box-sizing:border-box;}' +
      '.km-mute.km-on{background:#b71c1c;border-color:#7f0000;color:#fff;}' +
      '.km-mutehint{font-size:12px;margin:0 0 6px;color:#546e7a;}' +
      '@media (max-width:700px){.km-kbd{position:-webkit-sticky;position:sticky;bottom:0;z-index:5;background:#fff;padding:6px 0 calc(6px + env(safe-area-inset-bottom,0px));margin-left:-10px;margin-right:-10px;padding-left:6px;padding-right:6px;border-top:2px solid #90a4ae;box-shadow:0 -4px 10px rgba(0,0,0,.12);}.km-ctl{margin-top:4px;}.km-btn{padding:10px 12px;min-height:44px;}}' +
      '.km-anim .km-dot{-webkit-transition:background .08s linear;transition:background .08s linear;}'
    ));
    root.document.getElementsByTagName('head')[0].appendChild(st);
  }

  function media() { return root.KALIMBA_MEDIA || null; }
  function getTines() {
    var m = media();
    return (m && m.tines && m.tines.length) ? m.tines : [];
  }
  function getItems(gradeKey, period) {
    var m = media();
    if (!m || !m.periods) { return (root.KalimbaNotes && root.KalimbaNotes.getItemsFor) ? root.KalimbaNotes.getItemsFor(gradeKey, period, []) : []; }
    var g = m.periods[gradeKey]; if (!g) return [];
    var base = g[String(period)] || [];
    // ชั้นโน้ตที่ครูใส่เอง (ถ้าโหลด kalimba-notes.js) ซ้อนทับ — ไม่แก้ข้อมูล generated
    if (root.KalimbaNotes && root.KalimbaNotes.getItemsFor) {
      try { return root.KalimbaNotes.getItemsFor(gradeKey, period, base); } catch (e) { return base; }
    }
    return base;
  }
  function hasKalimba(gradeKey, period) { return getItems(gradeKey, period).length > 0; }

  function Widget(el, item, opts) {
    injectStyle();
    this.el = el; this.item = item; this.opts = opts || {};
    this.uid = 'km' + (++uidSeq);
    this.reduced = this.opts.reducedMotion !== undefined ? !!this.opts.reducedMotion : prefersReducedMotion();
    this.notes = item.notes || [];
    var bpmCfg = item.bpm || {};
    this.bpmMin = bpmCfg.min || 30; this.bpmMax = bpmCfg.max || 200;
    this.bpm = clamp(bpmCfg.start || 60, this.bpmMin, this.bpmMax);
    this.meter = parseMeter(item.meter || '4/4');
    var self = this;
    this.transport = new Transport({
      getCtx: this.opts.getCtx || getAudioContext, bpm: this.bpm, beatsPerBar: this.meter.beatsPerBar,
      onBeat: function (b, inBar, count) { self._beat(b, inBar, count); },
      onNote: function (i, what) { self._noteState(i, what); },
      onEnd: function () {
        self._setStatus('จบแล้ว — กด ▶ เพื่อเล่นอีกครั้ง');
        if (self.mode === 'play' && typeof self.opts.onComplete === 'function') { try { self.opts.onComplete(self.item, self.bpm); } catch (e) {} }
      },
      onState: function (s) { self._syncButtons(s); }
    });
    this.transport.setEvents(buildEvents(this.notes));
    this.mode = 'idle'; // 'idle' | 'play' | 'metro'
    this.render();
    widgetsLive.push(this);
  }
  Widget.prototype.$ = function (sel) { return this.el.querySelector(sel); };
  Widget.prototype.render = function () {
    var it = this.item, n = this.notes.length, bad = it.status === 'missing', badges = '', notices = '', i;
    var teacher = this._isTeacher();
    // ข้อสังเกต/ร่าง/สมมติฐาน แสดงเฉพาะครู (พับไว้) — นักเรียนไม่เห็นคำเตือนเหล่านี้
    if (bad) badges += '<span class="km-badge km-b-bad">ยังไม่มีโน้ต – รอครูใส่</span>';
    else if (it.partial) badges += '<span class="km-badge km-b-warn">โน้ตบางส่วน — รอครูยืนยัน</span>';
    if (it.draft) badges += '<span class="km-badge km-b-warn">' + esc(it.draft) + '</span>';
    if (it.unverified) badges += '<span class="km-badge km-b-warn">โน้ตจากไลบรารีเดิมของแอป — รอครูยืนยัน</span>';
    if (it.teacherNotes) badges += '<span class="km-badge km-b-ok">โน้ตที่ครูใส่/ยืนยันแล้ว</span>';
    if (bad) notices += '<div class="km-note km-missing">⚠ ' + esc(it.missing || 'ยังไม่มีโน้ต') + '</div>';
    var gl = (it.gaps || []).concat(it.assumptions || []);
    for (i = 0; i < gl.length; i++) notices += '<div class="km-note">ℹ ' + esc(gl[i]) + '</div>';
    var kindBadge = it.kind === 'explore' ? '<span class="km-badge km-b-ok">สำรวจเสียง</span>' : '';
    var teacherBox = (teacher && (badges || notices)) ? '<details class="km-tnotes" data-role="tnotes"><summary>ข้อสังเกตสำหรับครู (ร่าง/สมมติฐานที่ต้องยืนยัน)</summary>' + badges + notices + '</details>' : '';
    if (!teacher && bad) notices = '<div class="km-note">ยังไม่มีโน้ตสำหรับแบบฝึกนี้</div>'; else notices = '';
    badges = kindBadge;
    var staff = renderStaffSVG(this.notes, it.meter || '4/4', this.uid);
    this.staffIds = staff.ids; this.staffInfo = staff;
    var dots = '', d; for (d = 0; d < this.meter.beatsPerBar; d++) dots += '<span class="km-dot" data-dot="' + d + '"></span>';
    var tines = getTines();
    var tineBlock = this.opts.tines === false ? '' :
      '<div class="km-kbd" data-role="kbd"><div class="km-frame" style="padding-bottom:' + (TINE_GEOM.H / TINE_GEOM.W * 100).toFixed(3) + '%;">' + renderTineSVG(tines, this.uid) + '</div></div>';
    this.el.innerHTML =
      '<div class="km-box' + (this.reduced ? '' : ' km-anim') + '" data-reduced="' + (this.reduced ? 1 : 0) + '">' +
      '<div class="km-head">🎼 ' + esc(it.title) + badges + '</div>' + notices + teacherBox +
      '<div class="km-frame" data-role="staff" style="padding-bottom:' + (staff.height / staff.width * 100).toFixed(3) + '%;">' + staff.svg + '</div>' +
      '<div class="km-ctl" data-role="ctl">' +
      '<button type="button" class="km-mute" data-act="mute" aria-pressed="false"></button>' +
      '<div class="km-mutehint" data-role="mutehint"></div>' +
      '<button type="button" class="km-btn" data-act="play"' + (n ? '' : ' disabled') + '>▶ เล่น</button>' +
      '<button type="button" class="km-btn" data-act="pause" disabled>⏸ พัก</button>' +
      '<button type="button" class="km-btn" data-act="stop">⏹ หยุด</button>' +
      '<button type="button" class="km-btn" data-act="restart"' + (n ? '' : ' disabled') + '>⟲ เริ่มใหม่</button>' +
      '<span class="km-bpm"><button type="button" class="km-btn" data-act="bpm-" aria-label="ลด BPM">−</button>' +
      '<input type="range" data-act="bpm" min="' + this.bpmMin + '" max="' + this.bpmMax + '" value="' + this.bpm + '" aria-label="ความเร็ว BPM"/>' +
      '<button type="button" class="km-btn" data-act="bpm+" aria-label="เพิ่ม BPM">+</button> ' +
      '<b data-role="bpmv">' + this.bpm + '</b> BPM</span>' +
      '<button type="button" class="km-btn" data-act="metro">🔔 เมโทรนอม</button>' +
      '<label style="display:inline-block;margin:0 10px 6px 0;font-size:13px;"><input type="checkbox" data-act="click" checked/> เสียงคลิกระหว่างเล่น</label>' +
      '<label style="display:inline-block;margin:0 10px 6px 0;font-size:13px;"><input type="checkbox" data-act="countin" checked/> นับนำ 1 ห้อง</label>' +
      '<label style="display:inline-block;margin:0 10px 6px 0;font-size:13px;"><input type="checkbox" data-act="counts" checked/> แสดงเลขนับจังหวะ</label>' +
      '<div style="margin:2px 0 4px;">' + dots + '<span data-role="status" style="font-size:12px;color:#546e7a;margin-left:6px;" aria-live="polite"></span></div>' +
      '</div>' + tineBlock + '</div>';
    var self = this;
    this.el.onclick = function (e) { self._click(e || root.event); };
    this.el.onchange = function (e) { self._change(e || root.event); };
    this.el.oninput = function (e) { self._change(e || root.event); };
    this._syncButtons('stopped');
    this._applyTransportOpts();
    this._syncMute();
  };
  Widget.prototype._applyTransportOpts = function () {
    var click = this.$('[data-act="click"]'), ci = this.$('[data-act="countin"]');
    var muted = isMuted();
    if (click) { if (muted) click.checked = true; click.disabled = muted; }
    this.transport.muteNotes = muted;
    this.transport.setClick(muted ? true : (click ? click.checked : true));
    this.transport.countIn = (ci && ci.checked) ? this.meter.beatsPerBar : 0;
  };
  Widget.prototype._isTeacher = function () {
    var r = this.opts && this.opts.role, A = root.App;
    if (r) return r === 'teacher' || r === 'intern';
    return !!(A && A.state && A.state.role === 'teacher');
  };
  Widget.prototype._syncMute = function () {
    var b = this.$('[data-act="mute"]'), h = this.$('[data-role="mutehint"]'), m = isMuted();
    if (b) {
      b.className = 'km-mute' + (m ? ' km-on' : '');
      b.setAttribute('aria-pressed', m ? 'true' : 'false');
      b.innerHTML = m ? '🔇 ปิดเสียงคาลิมบ้าอยู่ — ได้ยินเฉพาะเมโทรนอม (แตะเพื่อเปิดเสียง)' : '🔊 เปิดเสียงคาลิมบ้า — แตะเพื่อ "ปิดเสียงคาลิมบ้า (ฝึกกับเมโทรนอมเท่านั้น)"';
    }
    if (h) h.innerHTML = m ? 'โหมดฝึก: ไฟยังวิ่งตามโน้ตและลิ่มยังสว่าง แต่จะไม่มีเสียงคาลิมบ้า ให้เล่นตามบนคาลิมบ้าจริงโดยฟังจังหวะเมโทรนอม' : '';
    this._applyTransportOpts();
  };
  Widget.prototype.toggleMute = function () { setMuted(!isMuted()); };
  Widget.prototype._target = function (e) {
    var t = e.target || e.srcElement;
    while (t && t !== this.el && !(t.getAttribute && (t.getAttribute('data-act') || t.getAttribute('data-note')))) t = t.parentNode;
    return (t && t !== this.el) ? t : null;
  };
  Widget.prototype._click = function (e) {
    var t = this._target(e); if (!t) return;
    var act = t.getAttribute('data-act'), note = t.getAttribute('data-note');
    if (note) { this.tap(note); return; }
    if (act === 'mute') { this.toggleMute(); return; }
    if (act === 'play') this.play();
    else if (act === 'pause') this.pause();
    else if (act === 'stop') this.stop();
    else if (act === 'restart') this.restart();
    else if (act === 'bpm-') this.setBpm(this.bpm - 1);
    else if (act === 'bpm+') this.setBpm(this.bpm + 1);
    else if (act === 'metro') this.toggleMetronome();
  };
  Widget.prototype._change = function (e) {
    var t = this._target(e); if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'bpm') this.setBpm(t.value);
    else if (act === 'click' || act === 'countin') this._applyTransportOpts();
    else if (act === 'counts') { var cg = this.el.querySelector('.kcnt'); if (cg) cg.setAttribute('display', t.checked ? 'inline' : 'none'); }
  };
  Widget.prototype.setBpm = function (v) {
    this.bpm = clamp(Math.round(Number(v)), this.bpmMin, this.bpmMax);
    this.transport.setBpm(this.bpm);
    var s = this.$('[data-act="bpm"]'), o = this.$('[data-role="bpmv"]');
    if (s) s.value = this.bpm; if (o) o.innerHTML = this.bpm;
  };
  Widget.prototype._ensureCtx = function () {
    var c = (this.opts.getCtx || getAudioContext)();
    if (!c) { this._setStatus('เครื่องนี้ไม่รองรับเสียง (WebAudio) — ดูโน้ตและผังได้อย่างเดียว'); return null; }
    return c;
  };
  Widget.prototype.play = function () {
    if (!this.notes.length || !this._ensureCtx()) return;
    if (this.mode === 'metro') this.transport.stop();
    this.mode = 'play'; this._applyTransportOpts();
    this.transport.setEvents(buildEvents(this.notes));
    this._setStatus('กำลังเล่น…');
    this.transport.start();
  };
  Widget.prototype.pause = function () { this.transport.pause(); this._setStatus('พักไว้'); };
  Widget.prototype.stop = function () { this.transport.stop(); this.mode = 'idle'; this._setStatus(''); };
  Widget.prototype.restart = function () {
    if (!this.notes.length || !this._ensureCtx()) return;
    this.transport.stop(); this.mode = 'idle'; this.play();
  };
  Widget.prototype.toggleMetronome = function () {
    if (!this._ensureCtx()) return;
    if (this.transport.state === 'playing' && this.mode === 'play') { // ระหว่างเล่น: สลับเสียงคลิก
      var c = this.$('[data-act="click"]'); if (c) { c.checked = !c.checked; } this._applyTransportOpts(); return;
    }
    if (this.mode === 'metro' && this.transport.state === 'playing') { this.stop(); return; }
    this.transport.stop();
    this.mode = 'metro';
    this.transport.countIn = 0; this.transport.setClick(true);
    this.transport.setEvents([]);
    this._setStatus('เมโทรนอมทำงาน');
    this.transport.start();
  };
  Widget.prototype.tap = function (note) {
    if (!isMuted()) {
      var c = this._ensureCtx(); if (!c) return;
      if (c.resume) { try { c.resume(); } catch (e) {} }
      if (!this.tapOut) { this.tapOut = c.createGain(); this.tapOut.gain.value = 1; this.tapOut.connect(c.destination); }
      playTone(c, this.tapOut, note, c.currentTime + 0.01, 0.9, 1);
    }
    if (typeof this.opts.onTap === 'function') { try { this.opts.onTap(note, isMuted()); } catch (e4) {} }
    this._tineColor(note, COL.tineCur);
    var self = this;
    root.setTimeout(function () { self._tineColor(note, COL.tineIdle); }, 220);
  };
  Widget.prototype._tineColor = function (note, col) {
    var el = root.document.getElementById(this.uid + '-t-' + note);
    if (el) el.setAttribute('fill', col);
  };
  Widget.prototype._noteColor = function (idx, color, scale) {
    var g = root.document.getElementById(this.staffIds[idx]); if (!g) return;
    var kids = g.childNodes, i, k;
    for (i = 0; i < kids.length; i++) {
      k = kids[i]; if (!k.getAttribute) continue;
      if (k.getAttribute('class') === 'kh') {
        k.setAttribute('stroke', color);
        k.setAttribute('fill', k.getAttribute('data-open') === '1' ? (color === COL.idle ? '#ffffff' : color) : color);
        k.setAttribute('rx', scale ? '6.6' : '5.4'); k.setAttribute('ry', scale ? '4.8' : '3.9');
      } else if (k.getAttribute('class') === 'ks') {
        k.setAttribute('stroke', color); if (k.tagName === 'circle' || k.tagName === 'rect') k.setAttribute('fill', color);
      }
    }
  };
  Widget.prototype._noteState = function (idx, what) {
    var i, n, j, p;
    if (what === 'reset') {
      for (i = 0; i < this.notes.length; i++) { this._noteColor(i, COL.idle, false); n = this.notes[i]; for (j = 0; j < n.p.length; j++) this._tineColor(n.p[j], COL.tineIdle); }
      this._clearDots(); return;
    }
    if (idx < 0 || !this.notes[idx]) return;
    n = this.notes[idx];
    if (what === 'on') {
      this._noteColor(idx, COL.cur, !this.reduced);
      for (j = 0; j < n.p.length; j++) this._tineColor(n.p[j], COL.tineCur);
    } else if (what === 'off') {
      this._noteColor(idx, COL.done, false);
      for (j = 0; j < n.p.length; j++) this._tineColor(n.p[j], COL.tineDone);
    }
  };
  Widget.prototype._clearDots = function () {
    var dots = this.el.querySelectorAll('.km-dot'), i;
    for (i = 0; i < dots.length; i++) dots[i].className = 'km-dot';
  };
  Widget.prototype._beat = function (b, inBar, count) {
    var dots = this.el.querySelectorAll('.km-dot'), i;
    for (i = 0; i < dots.length; i++) dots[i].className = 'km-dot' + (i === inBar ? (count ? ' km-d-cnt' : (inBar === 0 ? ' km-d-acc' : ' km-d-on')) : '');
    if (count) this._setStatus('นับนำ…');
    else if (this.mode === 'play') this._setStatus('กำลังเล่น…');
  };
  Widget.prototype._setStatus = function (txt) { var s = this.$('[data-role="status"]'); if (s) s.innerHTML = esc(txt); };
  Widget.prototype._syncButtons = function (state) {
    var play = this.$('[data-act="play"]'), pause = this.$('[data-act="pause"]'), m = this.$('[data-act="metro"]');
    if (!play) return;
    var hasNotes = this.notes.length > 0;
    play.disabled = !hasNotes || (state === 'playing' && this.mode === 'play');
    pause.disabled = !(state === 'playing' && this.mode === 'play');
    if (state === 'paused') play.innerHTML = '▶ เล่นต่อ'; else play.innerHTML = '▶ เล่น';
    if (m) m.className = 'km-btn' + (this.mode === 'metro' && state === 'playing' ? ' km-on' : '');
    if (m) m.innerHTML = (this.mode === 'metro' && state === 'playing') ? '⏹ หยุดเมโทรนอม' : '🔔 เมโทรนอม';
  };
  Widget.prototype.destroy = function () {
    var wi = widgetsLive.indexOf ? widgetsLive.indexOf(this) : -1; if (wi >= 0) widgetsLive.splice(wi, 1);
    try { this.transport.stop(); } catch (e) {}
    this.el.innerHTML = ''; this.el.onclick = null; this.el.onchange = null; this.el.oninput = null;
  };

  /* ---------- ชุดสื่อรายคาบ (ตัวเลือกรายการ + ช่องหมายเลขเครื่อง) ---------- */
  function mountPeriod(el, gradeKey, period, opts) {
    injectStyle();
    opts = opts || {};
    var items = getItems(gradeKey, period), cur = 0, widget = null;
    if (!items.length) { el.innerHTML = ''; return null; }
    var host = { widget: null };
    var KP = root.KalimbaPractice;
    var isStudent = opts.role === 'student', isTeacher = opts.role === 'teacher';
    var pool = [], pi;
    for (pi = 0; pi < items.length; pi++) if (items[pi].testPool) pool.push(items[pi].id);
    var pctx = { className: opts.className, studentId: opts.studentId, period: Number(period) };
    function plogText() {
      return (KP && opts.studentId && isStudent) ? KP.summaryText(pctx, items[cur].id) : '';
    }
    function draw() {
      var i, tabs = '', tools = '';
      if (items.length > 1) {
        tabs = '<div class="km-tabs">';
        for (i = 0; i < items.length; i++) tabs += '<span class="km-tab' + (i === cur ? ' km-on' : '') + '" data-tab="' + i + '" role="button" tabindex="0">' + esc(items[i].title) + '</span>';
        tabs += '</div>';
      }
      var dev = '';
      if (isStudent && opts.deviceField !== false) dev = '<div class="km-dev" data-role="devbox"></div>';
      if (isTeacher && root.KalimbaNoteEditor) tools += '<button type="button" class="km-btn" data-kne-open="1">✏️ ใส่/แก้โน้ต</button> ';
      if (isTeacher && pool.length && KP) tools += '<button type="button" class="km-btn" data-kp-table="1">📋 ลวดลายสอบรายคน (คาบ ' + esc(period) + ')</button>';
      if (tools) tools = '<div class="km-tools" style="margin:4px 0;">' + tools + '</div><div data-role="p7tbl"></div>';
      var p7 = '';
      if (isStudent && pool.length && KP && opts.studentId) p7 = '<div class="km-note" data-role="p7">🎯 ข้อสอบปฏิบัติ: ครูจะให้เล่น <b>1 ลวดลายจาก ' + pool.length + ' ลวดลาย</b> (สุ่มให้แต่ละคน) · <span role="button" tabindex="0" data-kp-reveal="1" style="color:#1565c0;text-decoration:underline;cursor:pointer;">ดูลวดลายของฉัน</span></div>';
      el.innerHTML = dev + tools + p7 + tabs + '<div data-role="wbox"></div><div class="km-note" data-role="plog" style="display:' + (plogText() ? 'block' : 'none') + ';">' + esc(plogText()) + '</div>';
      var wb = el.querySelector('[data-role="wbox"]');
      if (widget) widget.destroy();
      var wopts = {}, k; for (k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) wopts[k] = opts[k];
      if (isStudent && KP && opts.studentId) wopts.onComplete = function (item, bpm) {
        KP.log(pctx, item.id, bpm);
        var pl = el.querySelector('[data-role="plog"]'); if (pl) { pl.style.display = 'block'; pl.innerHTML = esc(KP.summaryText(pctx, item.id)); }
      };
      widget = new Widget(wb, items[cur], wopts); host.widget = widget;
      if (dev && root.KalimbaDevices) root.KalimbaDevices.mountField(el.querySelector('[data-role="devbox"]'), {
        className: opts.className, period: period, studentId: opts.studentId
      });
    }
    function p7Table() {
      var box = el.querySelector('[data-role="p7tbl"]'); if (!box) return;
      var studs = KP.studentsOf(opts.className), rows = KP.p7Rows(opts.className, studs, pool, Number(period)), h, i;
      if (!rows.length) { box.innerHTML = '<div class="km-note">ไม่พบรายชื่อนักเรียนของห้อง ' + esc(opts.className || '(ไม่ระบุ)') + '</div>'; return; }
      h = '<div class="km-note"><b>ลวดลายสอบรายคน</b> — สุ่มแบบกำหนดแน่นอนจากรหัสนักเรียน (เครื่องนักเรียนและเครื่องครูได้ผลตรงกัน) · เกณฑ์คะแนนเดียวกันทุกลวดลาย · ครูให้คะแนนเอง<br/>' +
        '<span role="button" tabindex="0" data-kp-csv="1" style="color:#1565c0;text-decoration:underline;cursor:pointer;">⬇ ดาวน์โหลด CSV</span>' +
        '<table style="border-collapse:collapse;margin-top:6px;font-size:13px;"><tr><th style="border:1px solid #b0bec5;padding:3px 6px;">รหัส</th><th style="border:1px solid #b0bec5;padding:3px 6px;">ชื่อ</th><th style="border:1px solid #b0bec5;padding:3px 6px;">ลวดลายที่</th></tr>';
      for (i = 0; i < rows.length; i++) h += '<tr><td style="border:1px solid #b0bec5;padding:3px 6px;">' + esc(rows[i].studentId) + '</td><td style="border:1px solid #b0bec5;padding:3px 6px;">' + esc(rows[i].name) + '</td><td style="border:1px solid #b0bec5;padding:3px 6px;text-align:center;">' + esc(rows[i].patternNo) + '</td></tr>';
      box.innerHTML = h + '</table></div>';
      box._rows = rows;
    }
    el.onclick = function (e) {
      var ev = e || root.event, t = ev.target || ev.srcElement, a;
      while (t && t !== el && !(t.getAttribute && (t.getAttribute('data-tab') !== null || t.getAttribute('data-kne-open') || t.getAttribute('data-kp-table') || t.getAttribute('data-kp-reveal') || t.getAttribute('data-kp-csv')))) t = t.parentNode;
      if (!t || t === el || !t.getAttribute) return;
      if (t.getAttribute('data-tab') !== null) { cur = parseInt(t.getAttribute('data-tab'), 10) || 0; draw(); return; }
      if (t.getAttribute('data-kne-open')) { root.KalimbaNoteEditor.open({ gradeKey: gradeKey, period: Number(period), itemId: items[cur] && items[cur].id }); return; }
      if (t.getAttribute('data-kp-table')) { p7Table(); return; }
      if (t.getAttribute('data-kp-csv')) {
        var bx = el.querySelector('[data-role="p7tbl"]');
        if (bx && bx._rows && root.KalimbaNoteEditor) { try { var bl = new root.Blob([KP.p7CSV(bx._rows)], { type: 'text/csv;charset=utf-8' }), an = root.document.createElement('a'); an.href = root.URL.createObjectURL(bl); an.download = 'p7_patterns_' + (opts.className || 'class') + '.csv'; root.document.body.appendChild(an); an.click(); root.document.body.removeChild(an); } catch (x) {} }
        return;
      }
      if (t.getAttribute('data-kp-reveal')) {
        a = KP.assignPattern(pctx, pool);
        var box = el.querySelector('[data-role="p7"]');
        if (a && box) {
          var ti = ''; for (var q = 0; q < items.length; q++) if (items[q].id === a.itemId) { ti = items[q].title; cur = q; }
          box.innerHTML = '🎯 ข้อสอบปฏิบัติของฉัน: <b>' + esc(ti) + '</b> (ลวดลายที่ ' + (a.index + 1) + ' จาก ' + pool.length + ')';
          if (widget) { /* ให้แสดงลวดลายที่ได้ทันที */ var wb2 = el.querySelector('[data-role="wbox"]'); widget.destroy(); widget = new Widget(wb2, items[cur], opts); host.widget = widget; }
        }
      }
    };
    root.addEventListener && root.addEventListener('ppk-kalimba-notes-changed', function () { items = getItems(gradeKey, period); if (cur >= items.length) cur = 0; if (el.parentNode) draw(); });
    draw();
    return host;
  }
  /** วางใน HTML ของหน้า แล้วเรียก mountAll(root) หลังเขียน innerHTML */
  function mountHTML(gradeKey, period, opts) {
    if (!hasKalimba(gradeKey, period)) return '';
    opts = opts || {};
    return '<div class="km-mount" data-kgrade="' + esc(gradeKey) + '" data-kperiod="' + esc(period) + '" data-krole="' + esc(opts.role || 'teacher') + '"' +
      ' data-kclass="' + esc(opts.className || '') + '" data-kstudent="' + esc(opts.studentId || '') + '"></div>';
  }
  function mountAll(scope) {
    var nodes = (scope || root.document).querySelectorAll('.km-mount'), i, n, out = [];
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      out.push(mountPeriod(n, n.getAttribute('data-kgrade'), n.getAttribute('data-kperiod'), {
        role: n.getAttribute('data-krole'), className: n.getAttribute('data-kclass'), studentId: n.getAttribute('data-kstudent')
      }));
    }
    return out;
  }

  /** เล่นเสียงตัวอย่าง 1 โน้ต (สำหรับสื่ออื่น ๆ): คืน true ถ้ามีเสียงออก; โหมดปิดเสียงคาลิมบ้า = ไม่เล่น */
  var previewOut = null;
  function previewNote(pitch, dur) {
    if (isMuted()) return false;
    var c = getAudioContext(); if (!c) return false;
    if (c.resume) { try { c.resume(); } catch (e) {} }
    if (!previewOut) { previewOut = c.createGain(); previewOut.gain.value = 1; previewOut.connect(c.destination); }
    playTone(c, previewOut, pitch, c.currentTime + 0.01, dur || 0.9, 1);
    return true;
  }
  var API = {
    previewNote: previewNote,
    parsePitch: parsePitch, freqOf: freqOf, thaiLabel: thaiLabel, durationShape: durationShape, parseMeter: parseMeter,
    buildEvents: buildEvents, layoutStaff: layoutStaff, renderStaffSVG: renderStaffSVG, renderTineSVG: renderTineSVG,
    clefPath: clefPath, isMuted: isMuted, setMuted: setMuted, Transport: Transport, Widget: Widget, getItems: getItems, hasKalimba: hasKalimba,
    mountPeriod: mountPeriod, mountHTML: mountHTML, mountAll: mountAll, COLORS: COL, STAFF: STAFF, TINE_GEOM: TINE_GEOM
  };
  root.KalimbaMedia = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
