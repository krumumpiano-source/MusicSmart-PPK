/* lyric-studio.js — ES5 · "เนื้อร้องใต้โน้ต" + โหวตเนื้อร้องในกลุ่ม (คาบ 8–10) ทั้งมุมมองนักเรียนและครู
 * - โน้ตมาจาก KALIMBA_MEDIA (ผ่าน LyricCore.songsForPeriod) — ไม่แต่งทำนองเอง
 * - ข้อมูลเก็บที่ Apps Script ของครู (โหมดพรีวิวในเครื่อง = Apps Script จำลอง) ใช้รหัสนักเรียน/PIN เดิม ไม่มีล็อกอินใหม่
 * - นักเรียนเห็นเฉพาะกลุ่มตัวเอง และไม่เห็นรายชื่อผู้โหวต */
(function (root) {
  'use strict';
  var LC = root.LyricCore;
  var CSS = '' +
    '.ls-wrap{margin:14px 0;padding:14px;border:1.5px solid #c7d2fe;border-radius:12px;background:#f8faff;color:#0f172a;line-height:1.55}' +
    '.ls-wrap *{box-sizing:border-box}.ls-h{margin:0 0 6px;font-size:1.05rem;font-weight:800;color:#312e81}' +
    '.ls-lead{margin:0 0 10px;font-size:.9rem;color:#334155}.ls-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
    '.ls-chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:700;background:#e0e7ff;color:#3730a3}' +
    '.ls-chip.g{background:#dcfce7;color:#166534}.ls-chip.n{background:#e2e8f0;color:#334155}.ls-chip.r{background:#fee2e2;color:#991b1b}' +
    '.ls-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.ls-tab{min-height:44px;padding:8px 14px;border-radius:10px;border:1.5px solid #a5b4fc;background:#fff;color:#3730a3;font-weight:700;cursor:pointer;font-size:.9rem}' +
    '.ls-tab[aria-pressed=true]{background:#4338ca;color:#fff;border-color:#4338ca}' +
    '.ls-phrase{margin:0 0 10px;padding:6px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.ls-ph-t{margin:0 0 6px;font-size:.8rem;font-weight:800;color:#475569}' +
    '.ls-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:6px}' +
    '.ls-cell{display:flex;flex-direction:column;gap:3px;min-width:0}' +
    '.ls-note{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:3px 6px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;font-size:.78rem;color:#312e81;font-weight:700}' +
    '.ls-dur{display:block;height:4px;border-radius:2px;background:#6366f1;margin-top:2px}' +
    '.ls-in{width:100%;min-height:44px;padding:6px 8px;font-size:16px;border:1.5px solid #94a3b8;border-radius:8px;background:#fff;color:#0f172a;font-family:inherit}' +
    '.ls-in:focus{outline:3px solid #818cf8;outline-offset:1px;border-color:#4338ca}.ls-in[readonly]{background:#f1f5f9;color:#334155}' +
    '.ls-line{display:flex;gap:8px;align-items:center;margin:0 0 6px}.ls-line .ls-note{flex:0 0 78px}.ls-line .ls-in{flex:1;min-width:0}' +
    '.ls-txt{display:block;min-height:44px;padding:9px 8px;font-size:.95rem;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;overflow-wrap:anywhere}.ls-txt.e{color:#94a3b8}' +
    '.ls-btn{min-height:44px;padding:8px 16px;border-radius:10px;border:0;background:#4338ca;color:#fff;font-weight:800;font-size:.95rem;cursor:pointer}' +
    '.ls-btn.s{background:#fff;color:#3730a3;border:1.5px solid #a5b4fc}.ls-btn:disabled{opacity:.55;cursor:not-allowed}.ls-btn.ok{background:#15803d}' +
    '.ls-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.ls-count{font-size:.85rem;color:#475569}' +
    '.ls-msg{margin:8px 0;padding:8px 10px;border-radius:8px;font-size:.88rem;background:#e0e7ff;color:#312e81}.ls-msg.ok{background:#dcfce7;color:#166534}.ls-msg.err{background:#fee2e2;color:#991b1b}' +
    '.ls-cand{margin:0 0 12px;padding:10px;border:1.5px solid #cbd5e1;border-radius:12px;background:#fff}.ls-cand.me{border-color:#a5b4fc}.ls-cand.win{border-color:#16a34a;background:#f0fdf4}.ls-cand.mine-vote{border-color:#4338ca;box-shadow:0 0 0 2px #c7d2fe}' +
    '.ls-cand-h{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 6px;font-weight:800}' +
    '.ls-lines{margin:0;padding:0;list-style:none}.ls-lines li{padding:4px 0;border-top:1px dashed #e2e8f0;font-size:.92rem;overflow-wrap:anywhere}.ls-lines li:first-child{border-top:0}' +
    '.ls-t table{width:100%;border-collapse:collapse;font-size:.85rem}.ls-t th,.ls-t td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}' +
    '.ls-g{margin:0 0 12px;padding:10px;border:1.5px solid #cbd5e1;border-radius:12px;background:#fff}.ls-bar{display:block;height:8px;border-radius:4px;background:#6366f1}' +
    '.ls-seats{margin:6px 0}.ls-seat{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:4px 0;font-size:14px}.ls-seat .ls-sel{max-width:100%}.ls-ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}.ls-sel{min-height:40px;padding:4px 8px;font-size:15px;border-radius:8px;border:1.5px solid #94a3b8;background:#fff}' +
    '@media (max-width:420px){.ls-wrap{padding:10px}.ls-line{flex-wrap:wrap}.ls-line .ls-note{flex:0 0 auto}.ls-line .ls-in{flex:1 1 100%}}' +
    '@media (prefers-reduced-motion:reduce){.ls-wrap *{transition:none!important;animation:none!important}}';

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ensureCss() { if (typeof document === 'undefined' || document.getElementById('ls-style')) return; var s = document.createElement('style'); s.id = 'ls-style'; s.textContent = CSS; document.head.appendChild(s); }
  function songsFor(period) { return LC.songsForPeriod(period, root.KALIMBA_MEDIA, 'M1'); }
  function hasPeriod(period) { return !!root.KALIMBA_MEDIA && LC.hasStudioPeriod(period, root.KALIMBA_MEDIA, 'M1'); }
  function pitchTxt(n) { return String(n.pitch || '').replace(/[0-9]/g, function (d) { return d; }); }
  function noteChip(n) {
    return '<span class="ls-note" title="โน้ตตัวที่ ' + (n.i + 1) + ' · ยาว ' + n.d + ' จังหวะ"><span>' + esc(n.th || pitchTxt(n)) + ' <span style="font-weight:400">' + esc(pitchTxt(n)) + '</span></span><span class="ls-dur" style="width:' + Math.max(10, Math.min(40, n.d * 12)) + 'px" aria-hidden="true"></span></span>';
  }
  function lineText(song, ph, cells) { var t = [], j; for (j = 0; j < ph.length; j++) t.push(cells[ph[j].i] || '·'); return t.join(' '); }
  function phaseLabel(s) { return s.locked ? 'ครูล็อกผลแล้ว' : s.phase === 'writing' ? 'ช่วงแต่งเนื้อ' : s.phase === 'voting' ? 'ช่วงโหวต' : 'ปิดโหวตแล้ว'; }
  function chip(cls, t) { return '<span class="ls-chip ' + cls + '">' + esc(t) + '</span>'; }
  function titleOf(song) { return String(song.title || song.key).replace(/\s*\(.*$/, ''); }

  /* ---------- การเรียก Apps Script ---------- */
  function studentPost(body) {
    var u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null;
    if (typeof StudentAuth === 'undefined' || !StudentAuth.isServerMode || !StudentAuth.isServerMode()) return Promise.resolve({ status: 'error', code: 'no_server' });
    if (!u || !u.sessionToken || (u.sessionExp && Number(u.sessionExp) <= Date.now())) return Promise.resolve({ status: 'error', code: 'no_session' });
    body.sessionToken = u.sessionToken;
    return StudentAuth._post(body).catch(function () { return { status: 'error', code: 'network' }; });
  }
  function teacherPost(body) {
    if (typeof GoogleSheetSync === 'undefined') return Promise.resolve({ status: 'error', code: 'no_server' });
    var cfg = GoogleSheetSync.getConfig();
    if (!cfg.webAppUrl || !cfg.syncToken) return Promise.resolve({ status: 'error', code: 'no_server' });
    return GoogleSheetSync.postJSON(cfg.webAppUrl, body).catch(function () { return { status: 'error', code: 'network' }; });
  }
  function errText(r) {
    var c = r && r.code;
    if (c === 'no_session') return 'ต้องเข้าสู่ระบบด้วยรหัสนักเรียนและ PIN ก่อน จึงจะแต่งเนื้อร้องของกลุ่มได้';
    if (c === 'no_server') return 'ยังไม่ได้เชื่อมต่อระบบของครู จึงใช้ช่องเนื้อร้องของกลุ่มไม่ได้ในตอนนี้';
    if (c === 'network') return 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
    if (r && r.message && c && c !== 'unauthorized') return r.message;
    return 'ระบบเนื้อร้องของกลุ่มยังไม่พร้อมใช้งาน (ครูต้องเปิดใช้ระบบก่อน) — ลองใหม่ภายหลัง';
  }

  /* ---------- นักเรียน ---------- */
  function draftKey(st) { var u = (typeof Store !== 'undefined' && Store.getCurrentUser) ? Store.getCurrentUser() : null; return 'ls_draft_' + ((u && u.studentId) || '') + '_' + st.key; }
  function loadLocal(st) { try { var v = JSON.parse(localStorage.getItem(draftKey(st)) || 'null'); return LC.isEmptyCells(v) ? null : v; } catch (e) { return null; } }
  function saveLocal(st) { try { localStorage.setItem(draftKey(st), JSON.stringify(st.cells)); } catch (e) { /* ignore */ } }

  function mountStudent(host, period) {
    ensureCss();
    var songs = songsFor(period);
    if (!host || !songs.length) { if (host) host.innerHTML = ''; return; }
    var st = { host: host, period: period, songs: songs, key: songs[0].key, data: null, cells: [], msg: null, busy: false, err: null };
    host._ls = st;
    host.addEventListener('click', function (e) { onStudentClick(st, e); });
    host.addEventListener('input', function (e) { onStudentInput(st, e); });
    studentLoad(st, true);
  }
  function song(st) { for (var i = 0; i < st.songs.length; i++) if (st.songs[i].key === st.key) return st.songs[i]; return st.songs[0]; }
  function studentLoad(st, fresh) {
    st.err = null; st.host.innerHTML = '<div class="ls-wrap" aria-busy="true"><p class="ls-h">🎤 เนื้อร้องใต้โน้ต</p><p class="ls-lead">กำลังโหลด…</p></div>';
    studentPost({ action: 'studentLyricGet', songKey: st.key }).then(function (r) {
      if (st.host._ls !== st) return;
      if (!r || r.status !== 'success') { st.err = r; st.data = null; return studentRender(st); }
      st.data = r;
      var s = song(st), cur = (fresh || !st.cells.length) ? null : st.cells;
      var cells = LC.sanitizeCells(r.myCells, s).cells;
      if (LC.isEmptyCells(cells) && r.canEdit) { var loc = loadLocal(st); if (loc) cells = LC.sanitizeCells(loc, s).cells; }
      st.cells = (cur && r.canEdit) ? cur : cells;
      studentRender(st);
    });
  }
  function studentRender(st) {
    var d = st.data, s = song(st), h = '<div class="ls-wrap" data-ls="student" data-song="' + esc(st.key) + '">';
    h += '<p class="ls-h">🎤 เนื้อร้องใต้โน้ต · ' + esc(titleOf(s)) + '</p>';
    if (st.songs.length > 1) {
      h += '<div class="ls-tabs" role="group" aria-label="เลือกเพลง">';
      st.songs.forEach(function (x) { h += '<button type="button" class="ls-tab" data-act="song" data-key="' + esc(x.key) + '" aria-pressed="' + (x.key === st.key) + '">' + esc(titleOf(x)) + '</button>'; });
      h += '</div>';
    }
    if (!d) {
      h += '<p class="ls-msg">' + esc(errText(st.err)) + '</p><div class="ls-row"><button type="button" class="ls-btn s" data-act="retry">ลองใหม่</button></div></div>';
      st.host.innerHTML = h; return;
    }
    var set = d.settings, mode = set.mode, isVote = mode === 'draft_vote';
    h += '<div class="ls-chips">' + chip('', 'กลุ่ม ' + d.group) + chip(set.locked ? 'n' : set.phase === 'voting' ? 'g' : '', phaseLabel(set)) + chip('n', 'ในกลุ่ม ' + d.memberCount + ' คน');
    if (isVote) h += chip('n', set.selfVote ? 'โหวตตัวเองได้' : 'โหวตตัวเองไม่ได้');
    h += '</div>';
    if (mode === 'one_per_note') {
      h += '<p class="ls-lead">' + (d.seat >= 1 && d.seat <= s.cellCount ? 'แต่ละคนแต่งเนื้อ <strong>1 วรรค (1 โน้ต)</strong> — คุณรับผิดชอบ <strong>วรรคที่ ' + d.seat + '</strong> พิมพ์ได้ไม่เกิน ' + s.maxLen + ' ตัวอักษร แล้วกดบันทึก เนื้อทั้งเพลงของกลุ่มคือวรรคของทุกคนรวมกัน' : 'ยังไม่มีวรรคที่คุณรับผิดชอบ — แจ้งครู') + '</p>';
      h += oneNoteHTML(st, s, d);
    } else if (set.phase === 'writing') {
      h += '<p class="ls-lead">พิมพ์เนื้อร้อง <strong>ใต้โน้ตแต่ละตัว</strong> (ช่องละไม่เกิน ' + s.maxLen + ' ตัวอักษร) แล้วกดบันทึก — เมื่อครูเปิดโหวต เพื่อนในกลุ่มจะเลือกว่าเนื้อของใครเป็นเนื้อของกลุ่ม · บันทึกแล้วแก้ได้จนกว่าครูจะเปิดโหวต</p>';
      h += editGridHTML(st, s, !d.canEdit);
    } else {
      h += voteHTML(st, s, d);
    }
    if (d.canEdit) h += '<div class="ls-row"><button type="button" class="ls-btn" data-act="save"' + (st.busy ? ' disabled' : '') + '>💾 บันทึกเนื้อร้อง</button><span class="ls-count" id="ls-count" aria-live="polite">' + countText(st, s) + '</span></div>';
    if (st.msg) h += '<div class="ls-msg ' + (st.msg.k || '') + '" role="status" aria-live="polite">' + esc(st.msg.t) + '</div>';
    h += '</div>';
    st.host.innerHTML = h;
  }
  function countText(st, s) { var n = LC.filledCount(st.cells); return 'กรอกแล้ว ' + n + '/' + s.cellCount + ' ช่อง'; }
  function editGridHTML(st, s, ro) {
    var h = '';
    s.phrases.forEach(function (ph, pi) {
      h += '<div class="ls-phrase"><p class="ls-ph-t">วรรคที่ ' + (pi + 1) + ' · ' + ph.length + ' โน้ต</p>';
      if (s.unit === 'phrase') {
        h += ph.map(function (n) { return '<div class="ls-line">' + noteChip(n) + inputHTML(st, n.i, s, ro) + '</div>'; }).join('');
      } else {
        h += '<div class="ls-grid">' + ph.map(function (n) { return '<label class="ls-cell">' + noteChip(n) + inputHTML(st, n.i, s, ro) + '</label>'; }).join('') + '</div>';
      }
      h += '</div>';
    });
    return h;
  }
  function inputHTML(st, i, s, ro) {
    return '<input class="ls-in" type="text" inputmode="text" autocomplete="off" data-cell="' + i + '" maxlength="' + s.maxLen + '" value="' + esc(st.cells[i] || '') + '"' + (ro ? ' readonly' : '') +
      ' aria-label="เนื้อร้องใต้โน้ตตัวที่ ' + (i + 1) + '" placeholder="พิมพ์">';
  }
  function oneNoteHTML(st, s, d) {
    var h = '';
    d.parts.forEach(function (p) {
      var pi = p.index, ph = s.phrases[pi] || [s.notes[pi]];
      h += '<div class="ls-phrase"><p class="ls-ph-t">วรรคที่ ' + p.seat + (p.label ? ' · ' + esc(p.label) : '') + (p.mine ? ' (ของฉัน)' : '') + '</p><div class="ls-line">' + noteChip(ph[0]) +
        (p.mine ? inputHTML(st, pi, s, !d.canEdit) : '<span class="ls-txt' + (p.text ? '' : ' e') + '">' + (p.text ? esc(p.text) : 'ยังไม่ได้ส่ง') + '</span>') + '</div></div>';
    });
    h += d.complete ? '<p class="ls-msg ok">เนื้อร้องครบทุกวรรคแล้ว</p>' : '';
    if (d.extraMembers > 0) h += '<p class="ls-msg">กลุ่มมีสมาชิกมากกว่าจำนวนวรรค — ครูจะกำหนดวรรคให้สมาชิกที่เกิน</p>';
    return h;
  }
  function voteHTML(st, s, d) {
    var set = d.settings, h = '', cands = d.candidates || [], closed = set.phase === 'closed' || set.locked, res = d.result;
    h += '<p class="ls-lead">' + (closed ? 'ปิดโหวตแล้ว' : 'เลือกเนื้อร้องที่ชอบที่สุดของกลุ่ม <strong>ได้คนละ 1 เสียง</strong>' + (set.locked ? '' : ' (เปลี่ยนใจได้จนกว่าครูจะปิดโหวต)') + ' · ไม่แสดงว่าใครโหวตให้ใคร') + '</p>';
    if (closed && res) {
      if (res.status === 'tie_waiting') h += '<p class="ls-msg">คะแนนเสมอกัน — รอครูตัดสิน</p>';
      else if (res.status === 'no_votes') h += '<p class="ls-msg">ยังไม่มีคะแนนโหวต — รอครู</p>';
      else if (res.winnerId) h += '<p class="ls-msg ok">🏆 เนื้อร้องของกลุ่มคือเนื้อของ ' + esc(labelOf(cands, res.winnerId)) + (res.status === 'teacher_picked' || res.status === 'tie_decided' ? ' (ครูเลือก)' : '') + (set.locked ? '' : ' · รอครูล็อกผล') + '</p>';
    }
    if (!cands.length) h += '<p class="ls-msg">ยังไม่มีเพื่อนในกลุ่มบันทึกเนื้อร้อง</p>';
    cands.forEach(function (c) {
      var mine = d.myVote === c.studentId, win = res && res.winnerId === c.studentId && closed, blockSelf = c.isMe && !set.selfVote;
      h += '<div class="ls-cand' + (c.isMe ? ' me' : '') + (win ? ' win' : '') + (mine ? ' mine-vote' : '') + '"><div class="ls-cand-h"><span>เนื้อของ ' + esc(c.label) + (c.isMe ? ' (ฉัน)' : '') + (win ? ' 🏆' : '') + '</span>' +
        (c.votes !== undefined ? '<span class="ls-chip">' + c.votes + ' เสียง</span>' : '') + '</div>' + candLinesHTML(s, c.cells);
      if (!closed) {
        h += '<div class="ls-row"><button type="button" class="ls-btn' + (mine ? ' ok' : ' s') + '" data-act="vote" data-id="' + esc(c.studentId) + '"' + (blockSelf || st.busy ? ' disabled' : '') + '>' + (mine ? '✓ โหวตเนื้อนี้แล้ว' : 'โหวตเนื้อนี้') + '</button>' + (blockSelf ? '<span class="ls-count">โหวตเนื้อของตัวเองไม่ได้</span>' : '') + '</div>';
      } else if (mine) h += '<p class="ls-count">เสียงของฉัน ✓</p>';
      h += '</div>';
    });
    if (!set.locked && !closed && !d.myVote && cands.length) h += '<p class="ls-count">คุณยังไม่ได้โหวต</p>';
    return h;
  }
  function labelOf(c, id) { for (var i = 0; i < c.length; i++) if (c[i].studentId === id) return c[i].label; return ''; }
  function candLinesHTML(s, cells) {
    return '<ol class="ls-lines">' + s.phrases.map(function (ph, i) { return '<li><strong>วรรค ' + (i + 1) + ':</strong> ' + esc(lineText(s, ph, cells || [])) + '</li>'; }).join('') + '</ol>';
  }
  function onStudentInput(st, e) {
    var t = e.target; if (!t || t.getAttribute('data-cell') === null) return;
    var i = parseInt(t.getAttribute('data-cell'), 10), s = song(st);
    st.cells[i] = LC.sanitizeCell(t.value, s.maxLen); saveLocal(st);
    var c = st.host.querySelector('#ls-count'); if (c) c.textContent = countText(st, s);
  }
  function onStudentClick(st, e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b || !st.host.contains(b)) return;
    var act = b.getAttribute('data-act');
    if (act === 'song') { st.key = b.getAttribute('data-key'); st.cells = []; st.msg = null; return studentLoad(st, true); }
    if (act === 'retry') return studentLoad(st, true);
    if (st.busy) return;
    if (act === 'save') {
      st.busy = true; st.msg = { t: 'กำลังบันทึก…' }; studentRender(st);
      studentPost({ action: 'studentLyricSave', songKey: st.key, cells: st.cells }).then(function (r) {
        st.busy = false;
        st.msg = r && r.status === 'success' ? { k: 'ok', t: 'บันทึกแล้ว ✓ (กรอก ' + r.filled + ' ช่อง)' } : { k: 'err', t: errText(r) };
        if (r && r.status === 'success') { st.cells = LC.sanitizeCells(r.cells, song(st)).cells; try { localStorage.removeItem(draftKey(st)); } catch (x) { /* */ } }
        studentLoad2(st);
      });
    } else if (act === 'vote') {
      st.busy = true; st.msg = null; studentRender(st);
      studentPost({ action: 'studentLyricVote', songKey: st.key, targetId: b.getAttribute('data-id') }).then(function (r) {
        st.busy = false; st.msg = r && r.status === 'success' ? { k: 'ok', t: 'บันทึกการโหวตแล้ว ✓' } : { k: 'err', t: errText(r) };
        studentLoad2(st);
      });
    }
  }
  function studentLoad2(st) {     // โหลดซ้ำโดยคงข้อความผลลัพธ์ล่าสุดไว้
    var keep = st.msg;
    studentPost({ action: 'studentLyricGet', songKey: st.key }).then(function (r) {
      if (st.host._ls !== st) return;
      if (r && r.status === 'success') st.data = r;
      st.msg = keep; studentRender(st);
    });
  }

  /* ---------- ครู ---------- */
  function mountTeacher(host, period, className) {
    ensureCss();
    var songs = songsFor(period);
    if (!host || !songs.length) { if (host) host.innerHTML = ''; return; }
    var st = { host: host, period: period, className: className, songs: songs, key: songs[0].key, data: null, msg: null };
    host._lt = st;
    host.addEventListener('click', function (e) { onTeacherClick(st, e); });
    host.addEventListener('change', function (e) { onTeacherChange(st, e); });
    teacherLoad(st);
  }
  function teacherLoad(st) {
    teacherPost({ action: 'lyric_teacher_overview', className: st.className, songKey: st.key }).then(function (r) {
      if (st.host._lt !== st) return;
      st.data = r && r.status === 'success' ? r : null; st.err = st.data ? null : r; teacherRender(st);
    });
  }
  function teacherRender(st) {
    var d = st.data, s = song(st), h = '<div class="ls-wrap" data-ls="teacher" data-song="' + esc(st.key) + '"><p class="ls-h">🎤 เนื้อร้องใต้โน้ต + โหวตกลุ่ม (ครู) · ห้อง ' + esc(st.className || '-') + '</p>';
    if (st.songs.length > 1) {
      h += '<div class="ls-tabs" role="group" aria-label="เลือกเพลง">';
      st.songs.forEach(function (x) { h += '<button type="button" class="ls-tab" data-act="song" data-key="' + esc(x.key) + '" aria-pressed="' + (x.key === st.key) + '">' + esc(titleOf(x)) + '</button>'; });
      h += '</div>';
    }
    if (!d) { h += '<p class="ls-msg">' + esc(st.err && st.err.code === 'no_server' ? 'ยังไม่ได้เชื่อมต่อ Apps Script (ตั้งค่าในหน้าซิงค์) จึงดูผลเนื้อร้อง/โหวตของนักเรียนไม่ได้' : errText(st.err)) + '</p><div class="ls-row"><button type="button" class="ls-btn s" data-act="refresh">โหลดใหม่</button></div></div>'; st.host.innerHTML = h; return; }
    var set = d.settings;
    h += '<p class="ls-lead">โครงเนื้อร้อง: ' + (s.unit === 'syllable' ? 'ช่องละ 1 พยางค์ต่อ 1 โน้ต (' + s.cellCount + ' ช่อง · 4 วรรค)' : '1 โน้ต = 1 วรรค (' + s.cellCount + ' วรรค)') + ' · ตีความจาก วก.5 — โปรดยืนยัน</p>';
    h += '<div class="ls-chips">' + chip(set.locked ? 'n' : set.phase === 'voting' ? 'g' : '', phaseLabel(set)) + chip('n', set.mode === 'one_per_note' ? 'โหมด: 1 คน 1 โน้ต (ตาม วก.5 คาบ 10)' : 'โหมด: ทุกคนแต่งแล้วโหวต') + '</div>';
    h += '<div class="ls-ctl"><label>โหมด <select class="ls-sel" data-set="mode"><option value="draft_vote"' + (set.mode === 'draft_vote' ? ' selected' : '') + '>ทุกคนแต่งทั้งเพลง แล้วโหวต</option><option value="one_per_note"' + (set.mode === 'one_per_note' ? ' selected' : '') + '>1 คน 1 โน้ต/วรรค (ไม่โหวต)</option></select></label></div>';
    if (set.mode === 'draft_vote') {
      h += '<div class="ls-ctl">' +
        '<button type="button" class="ls-btn' + (set.phase === 'writing' && !set.locked ? '' : ' s') + '" data-act="phase" data-v="writing"' + (set.locked ? ' disabled' : '') + '>✏️ ช่วงแต่ง</button>' +
        '<button type="button" class="ls-btn' + (set.phase === 'voting' && !set.locked ? ' ok' : ' s') + '" data-act="phase" data-v="voting"' + (set.locked ? ' disabled' : '') + '>🗳️ เปิดโหวต</button>' +
        '<button type="button" class="ls-btn' + (set.phase === 'closed' && !set.locked ? '' : ' s') + '" data-act="phase" data-v="closed"' + (set.locked ? ' disabled' : '') + '>⏹ ปิดโหวต</button>' +
        '<button type="button" class="ls-btn s" data-act="lock" data-v="' + (set.locked ? '0' : '1') + '">' + (set.locked ? '🔓 ปลดล็อกผล' : '🔒 ล็อกผล') + '</button></div>';
      h += '<div class="ls-ctl"><label><input type="checkbox" data-set="selfVote"' + (set.selfVote ? ' checked' : '') + (set.locked ? ' disabled' : '') + '> ให้โหวตเนื้อของตัวเองได้</label> ' + chip('n', 'ครูกำหนด: ค่าเริ่มต้นห้ามโหวตตัวเอง') + '</div>';
      h += '<div class="ls-ctl"><label>นักเรียนเห็นคะแนน <select class="ls-sel" data-set="showTally"><option value="afterClose"' + (set.showTally === 'afterClose' ? ' selected' : '') + '>หลังปิดโหวต</option><option value="always"' + (set.showTally === 'always' ? ' selected' : '') + '>ระหว่างโหวตด้วย</option><option value="never"' + (set.showTally === 'never' ? ' selected' : '') + '>ไม่แสดง (จนกว่าล็อกผล)</option></select></label></div>';
    } else {
      h += '<div class="ls-ctl"><button type="button" class="ls-btn s" data-act="lock" data-v="' + (set.locked ? '0' : '1') + '">' + (set.locked ? '🔓 ปลดล็อกผล' : '🔒 ล็อกผล') + '</button></div>';
    }
    if (st.msg) h += '<div class="ls-msg ' + (st.msg.k || '') + '" role="status">' + esc(st.msg.t) + '</div>';
    d.groups.forEach(function (g) { h += teacherGroupHTML(st, s, set, g); });
    h += '<div class="ls-row"><button type="button" class="ls-btn s" data-act="refresh">🔄 โหลดผลล่าสุด</button></div></div>';
    st.host.innerHTML = h;
  }
  function teacherGroupHTML(st, s, set, g) {
    var r = g.result, h = '<div class="ls-g" data-group="' + g.group + '"><div class="ls-cand-h"><span>กลุ่ม ' + g.group + ' · สมาชิก ' + g.members.length + ' คน</span><span class="ls-chip n">' + statusTxt(r) + '</span></div>';
    h += '<p class="ls-count">บันทึกเนื้อแล้ว: ' + g.members.filter(function (m) { return m.saved; }).length + '/' + g.members.length + ' · ' + g.members.map(function (m) { return esc(m.label) + (m.saved ? ' ✓' : ' –'); }).join(', ') + '</p>';
    if (r.mode === 'one_per_note') {
      if (g.members.length > s.cellCount) {
        h += '<div class="ls-seats"><p class="ls-msg">กลุ่มนี้มีสมาชิก ' + g.members.length + ' คน เกิน ' + s.cellCount + ' วรรค — ครูกำหนดวรรคให้สมาชิกแต่ละคน (ไม่ซ้ำกัน) · ถ้าเปลี่ยนวรรค นักเรียนต้องกดบันทึกเนื้อใหม่ที่วรรคใหม่</p>' +
          g.members.map(function (m) {
            var opts = '<option value="0"' + (!m.seat ? ' selected' : '') + '>ไม่ได้วรรค (ไม่มีวรรครับผิดชอบ)</option>', k;
            for (k = 1; k <= s.cellCount; k++) opts += '<option value="' + k + '"' + (m.seat === k ? ' selected' : '') + '>วรรคที่ ' + k + '</option>';
            return '<label class="ls-seat">' + esc(m.label) + ' <select class="ls-sel" data-seat="' + esc(m.studentId) + '" data-g="' + g.group + '"' + (set.locked ? ' disabled' : '') + '>' + opts + '</select></label>';
          }).join('') + '</div>';
      }
      h += '<ol class="ls-lines">' + r.parts.map(function (p) { return '<li><strong>วรรค ' + p.seat + (p.label ? ' (' + esc(p.label) + ')' : '') + ':</strong> ' + (p.text ? esc(p.text) : '<span style="color:#94a3b8">ยังไม่ส่ง</span>') + '</li>'; }).join('') + '</ol>';
    } else {
      var max = 1; r.candidates.forEach(function (c) { if (c.votes > max) max = c.votes; });
      r.candidates.forEach(function (c) {
        var win = r.winnerId === c.studentId;
        h += '<div class="ls-cand' + (win ? ' win' : '') + '"><div class="ls-cand-h"><span>เนื้อของ ' + esc(c.label) + (win ? ' 🏆' : '') + '</span><span class="ls-chip">' + c.votes + ' เสียง</span></div>' +
          '<span class="ls-bar" style="width:' + Math.round(100 * c.votes / max) + '%" aria-hidden="true"></span>' +
          '<details><summary>ดูเนื้อร้อง (' + c.filled + '/' + s.cellCount + ' ช่อง)</summary>' + candLinesHTML(s, c.cells) + '</details>' +
          '<div class="ls-row"><button type="button" class="ls-btn s" data-act="pick" data-g="' + g.group + '" data-id="' + esc(c.studentId) + '"' + (set.locked ? ' disabled' : '') + '>' + (win && r.chosenByTeacher ? '✓ ครูเลือกแล้ว' : 'ครูเลือกเนื้อนี้ (ตัดสิน/สำรอง)') + '</button></div></div>';
      });
      if (r.chosenByTeacher && !set.locked) h += '<div class="ls-row"><button type="button" class="ls-btn s" data-act="pick" data-g="' + g.group + '" data-id="">ล้างการเลือกของครู</button></div>';
      if (g.voters.length) h += '<details class="ls-t"><summary>ผู้โหวต (ครูเห็นคนเดียว · ' + g.voters.length + ' คน)</summary><table><thead><tr><th>ผู้โหวต</th><th>โหวตให้</th></tr></thead><tbody>' +
        g.voters.map(function (v) { return '<tr><td>' + esc(v.voter) + '</td><td>' + esc(v.target) + '</td></tr>'; }).join('') + '</tbody></table></details>';
    }
    return h + '</div>';
  }
  function statusTxt(r) {
    return { writing: 'กำลังแต่ง', voting: 'กำลังโหวต', no_votes: 'ปิดโหวต · ไม่มีคะแนน', tie_waiting: 'คะแนนเสมอ · รอครูตัดสิน', winner: 'มีผู้ชนะ', teacher_picked: 'ครูเลือกแล้ว', tie_decided: 'เสมอ → ครูตัดสินแล้ว', complete: 'ครบทุกวรรค', locked: 'ล็อกแล้ว' }[r.status] || r.status;
  }
  function tSet(st, patch, okMsg) {
    teacherPost({ action: 'lyric_teacher_set', className: st.className, songKey: st.key, patch: patch }).then(function (r) {
      st.msg = r && r.status === 'success' ? { k: 'ok', t: okMsg } : { k: 'err', t: errText(r) }; teacherLoad(st);
    });
  }
  function onTeacherChange(st, e) {
    var t = e.target, k = t && t.getAttribute && t.getAttribute('data-set');
    if (!k && t && t.getAttribute && t.getAttribute('data-seat') !== null) return onSeatChange(st, t);
    if (!k) return;
    var p = {}; p[k] = t.type === 'checkbox' ? t.checked : t.value;
    tSet(st, p, 'บันทึกการตั้งค่าแล้ว');
  }
  /** ครูกำหนดวรรคให้สมาชิก (กลุ่มเกิน 8 คน): ส่งชุด seats ทั้งหมดของห้อง/เพลงนี้ แล้ววรรคที่เหลือเติมตามลำดับเลขที่ */
  function onSeatChange(st, t) {
    var sid = t.getAttribute('data-seat'), v = parseInt(t.value, 10) || 0, g = parseInt(t.getAttribute('data-g'), 10), seats = {}, k, grp = null;
    (st.data.groups || []).forEach(function (x) { if (x.group === g) grp = x; });
    if (!grp) return;
    // เก็บวรรคที่กำหนดไว้ของทุกกลุ่ม แล้วเขียนทับเฉพาะกลุ่มนี้ด้วยค่าที่เห็นบนหน้าจอ
    for (k in (st.data.settings.seats || {})) seats[k] = st.data.settings.seats[k];
    grp.members.forEach(function (m) { delete seats[String(m.studentId)]; if (m.seat) seats[String(m.studentId)] = m.seat; });
    delete seats[sid]; if (v) seats[sid] = v;
    var dup = grp.members.some(function (m) { return String(m.studentId) !== sid && seats[String(m.studentId)] === v && v; });
    if (dup) { st.msg = { k: 'err', t: 'วรรคที่ ' + v + ' มีสมาชิกอื่นรับผิดชอบอยู่แล้ว — เลือกวรรคอื่นหรือเปลี่ยนของคนนั้นก่อน' }; return teacherLoad(st); }
    tSet(st, { seats: seats }, 'บันทึกการกำหนดวรรคแล้ว');
  }
  function onTeacherClick(st, e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b || !st.host.contains(b)) return;
    var a = b.getAttribute('data-act');
    if (a === 'song') { st.key = b.getAttribute('data-key'); st.msg = null; return teacherLoad(st); }
    if (a === 'refresh') { st.msg = null; return teacherLoad(st); }
    if (a === 'phase') return tSet(st, { phase: b.getAttribute('data-v') }, 'เปลี่ยนช่วงแล้ว');
    if (a === 'lock') return tSet(st, { locked: b.getAttribute('data-v') === '1' }, b.getAttribute('data-v') === '1' ? 'ล็อกผลแล้ว' : 'ปลดล็อกแล้ว');
    if (a === 'pick') {
      teacherPost({ action: 'lyric_teacher_pick', className: st.className, songKey: st.key, group: b.getAttribute('data-g'), studentId: b.getAttribute('data-id') }).then(function (r) {
        st.msg = r && r.status === 'success' ? { k: 'ok', t: 'บันทึกการตัดสินของครูแล้ว' } : { k: 'err', t: errText(r) }; teacherLoad(st);
      });
    }
  }

  root.LyricStudio = { hasPeriod: hasPeriod, mountStudent: mountStudent, mountTeacher: mountTeacher, _esc: esc };
})(typeof window !== 'undefined' ? window : this);
