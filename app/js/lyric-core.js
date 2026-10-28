/* lyric-core.js — ES5 · ตรรกะล้วน (ไม่แตะ DOM/เครือข่าย) ของ "ช่องเนื้อร้องใต้โน้ต + โหวตเนื้อร้องของกลุ่ม"
 * ใช้ร่วมกันทั้งในเบราว์เซอร์ (นักเรียน/ครู) และ Apps Script จำลอง (tools/prototype) เพื่อให้กติกาตรงกัน
 * - โน้ตมาจาก KALIMBA_MEDIA (ข้อมูลเดิมของแอป) — ไม่แต่งทำนองเอง
 * - โครงเนื้อร้องตีความจาก วก.5 (ดู STRUCTURE_NOTE) — ครูยืนยัน */
(function (root) {
  'use strict';
  var LIMITS = { syllable: 12, phrase: 40, maxCells: 40 };
  var GROUPS = 5;
  var PHASES = ['writing', 'voting', 'closed'];
  var MODES = ['draft_vote', 'one_per_note'];
  var STRUCTURE_NOTE = 'วก.5 คาบ 8: แต่งเนื้อร้อง 4 วรรคแรกของ Ode to Joy (วรรคละ 2 ห้อง) · คาบ 10: Joy to the World 8 วรรค 1 คนต่อ 1 โน้ต';
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }

  function songKeyOf(id) {
    id = String(id || '');
    if (/ode_to_joy/.test(id)) return 'ode_to_joy';
    if (/joy_to_the_world/.test(id)) return 'joy_to_the_world';
    return null;
  }
  function beatsPerBar(meter) { var m = /^(\d+)\/(\d+)$/.exec(String(meter || '4/4')); return m ? Number(m[1]) * (4 / Number(m[2])) : 4; }

  /** เพลงของคาบนี้ที่ใช้แต่งเนื้อ (เฉพาะ Ode to Joy / Joy to the World ที่มีโน้ตจริงใน KALIMBA_MEDIA) */
  function songsForPeriod(period, media, gradeKey) {
    var K = media || root.KALIMBA_MEDIA, g = gradeKey || 'M1', out = [], list, i, s, key, notes, ph, cur, beats, bpb, n, j;
    list = K && K.periods && K.periods[g] && (K.periods[g][period] || K.periods[g][String(period)]);
    if (!isArr(list)) return out;
    for (i = 0; i < list.length; i++) {
      s = list[i]; key = songKeyOf(s.id);
      if (!key || s.kind !== 'song' || !isArr(s.notes) || !s.notes.length) continue;
      notes = []; for (j = 0; j < s.notes.length; j++) notes.push({ i: j, th: s.notes[j].th || '', pitch: (s.notes[j].p && s.notes[j].p[0]) || '', d: Number(s.notes[j].d) || 1 });
      ph = [];
      if (key === 'ode_to_joy') {            // วรรคละ 2 ห้อง
        bpb = beatsPerBar(s.meter) * 2; cur = []; beats = 0;
        for (j = 0; j < notes.length; j++) { cur.push(notes[j]); beats += notes[j].d; if (beats >= bpb - 1e-9) { ph.push(cur); cur = []; beats = 0; } }
        if (cur.length) ph.push(cur);
      } else { for (j = 0; j < notes.length; j++) ph.push([notes[j]]); }   // 1 โน้ต = 1 วรรค
      n = notes.length;
      out.push({ key: key, id: s.id, period: Number(period), title: s.title, meter: s.meter || '4/4', notes: notes, phrases: ph, cellCount: n,
        unit: key === 'ode_to_joy' ? 'syllable' : 'phrase', maxLen: key === 'ode_to_joy' ? LIMITS.syllable : LIMITS.phrase });
    }
    return out;
  }
  function hasStudioPeriod(period, media, gradeKey) { return songsForPeriod(period, media, gradeKey).length > 0; }

  /* ---------- เนื้อร้อง ---------- */
  function sanitizeCell(s, max) {
    s = String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    var a = Array.prototype.slice.call(s); if (a.length > max) s = a.slice(0, max).join('');
    return s;
  }
  /** ตัดให้ไม่เกินจำนวนโน้ต/ความยาว; คืน {cells, extra} — extra = true ถ้าผู้ส่งส่งเกินจำนวนช่อง */
  function sanitizeCells(cells, song) {
    var out = [], i, n = song.cellCount, extra = false;
    if (!isArr(cells)) cells = [];
    if (cells.length > n) { extra = cells.slice(n).some(function (x) { return String(x || '').replace(/\s+/g, '') !== ''; }); }
    for (i = 0; i < n; i++) out.push(sanitizeCell(cells[i], song.maxLen));
    return { cells: out, extra: extra };
  }
  function isEmptyCells(cells) { if (!isArr(cells)) return true; for (var i = 0; i < cells.length; i++) if (String(cells[i] || '') !== '') return false; return true; }
  function filledCount(cells) { var c = 0, i; if (!isArr(cells)) return 0; for (i = 0; i < cells.length; i++) if (String(cells[i] || '') !== '') c++; return c; }

  /* ---------- กลุ่ม ---------- */
  function groupOf(no) { var n = parseInt(no, 10); if (isNaN(n) || n < 1) return 1; return ((n - 1) % GROUPS) + 1; }
  /** ลำดับที่ในกลุ่ม (1..) เรียงตามเลขที่ — ใช้เป็น "ผู้รับผิดชอบโน้ต/วรรคที่ n" ในโหมด 1 คนต่อ 1 โน้ต
   *  seats (ไม่บังคับ) = { studentId: วรรคที่ครูกำหนด } — ใช้กับกลุ่มที่มีสมาชิกเกินจำนวนวรรค (ครูเป็นผู้กำหนด) */
  function seatMap(members, seats, cellCount) {
    var s = members.slice().sort(function (a, b) { return Number(a.no) - Number(b.no); }), map = {}, used = {}, i, sid, v;
    var n = cellCount > 0 ? cellCount : s.length;
    seats = seats && typeof seats === 'object' ? seats : {};
    for (i = 0; i < s.length; i++) {            // 1) ที่ครูกำหนดเอง (ซ้ำ → คนแรกตามเลขที่ได้)
      sid = String(s[i].studentId); v = parseInt(seats[sid], 10);
      if (v >= 1 && v <= n && !used[v]) { map[sid] = v; used[v] = true; }
    }
    var next = 1;
    for (i = 0; i < s.length; i++) {            // 2) ที่เหลือ: เติมให้คนที่ยังไม่มีวรรคตามลำดับเลขที่
      sid = String(s[i].studentId); if (map[sid]) continue;
      while (next <= n && used[next]) next++;
      if (next > n) { map[sid] = 0; continue; }
      map[sid] = next; used[next] = true;
    }
    return map;
  }
  function seatOf(members, studentId, seats, cellCount) {
    var m = seatMap(members, seats, cellCount); return m[String(studentId)] || 0;
  }
  function defaultSettings(songKey) {
    return { mode: songKey === 'joy_to_the_world' ? 'one_per_note' : 'draft_vote', phase: 'writing', locked: false, selfVote: false, selfVoteConfirmed: true,
      showTally: 'afterClose', chosen: {}, seats: {} };
  }
  function normSettings(raw, songKey) {
    var d = defaultSettings(songKey), r = raw || {}, k;
    if (MODES.indexOf(r.mode) >= 0) d.mode = r.mode;
    if (PHASES.indexOf(r.phase) >= 0) d.phase = r.phase;
    d.locked = !!r.locked; d.selfVote = !!r.selfVote; d.selfVoteConfirmed = true;   // ครูตัดสินแล้ว (28 ต.ค. 2569): ห้ามโหวตตัวเอง + แสดงคะแนนหลังปิดโหวต — ไม่มีสถานะ "รอยืนยัน" อีก
    if (r.showTally === 'always' || r.showTally === 'afterClose' || r.showTally === 'never') d.showTally = r.showTally;
    if (r.chosen && typeof r.chosen === 'object') for (k in r.chosen) if (Object.prototype.hasOwnProperty.call(r.chosen, k)) d.chosen[k] = String(r.chosen[k]);
    if (r.seats && typeof r.seats === 'object') for (k in r.seats) if (Object.prototype.hasOwnProperty.call(r.seats, k)) { var sv = parseInt(r.seats[k], 10); if (sv >= 1 && sv <= 99) d.seats[String(k)] = sv; }
    if (d.locked) d.phase = 'closed';
    return d;
  }

  /** ตรวจการโหวต — คืน null ถ้าโหวตได้ ไม่เช่นนั้นคืนรหัสเหตุผล */
  function voteError(o) {
    if (o.settings.mode !== 'draft_vote') return 'bad_mode';
    if (o.settings.locked) return 'locked';
    if (o.settings.phase !== 'voting') return 'not_voting';
    if (!o.voterIsMember) return 'not_member';
    if (!o.targetIsCandidate) return 'bad_target';
    if (String(o.voterId) === String(o.targetId) && !o.settings.selfVote) return 'self_not_allowed';
    return null;
  }
  function canEdit(settings) { return !settings.locked && settings.phase === 'writing'; }

  /** รวมผลของ 1 กลุ่ม
   *  o = { settings, members:[{studentId,label,no}], drafts:{sid:cells}, votes:{voterId:targetId}, groupNo, song } */
  function resolveGroup(o) {
    var st = o.settings, mem = o.members.slice().sort(function (a, b) { return Number(a.no) - Number(b.no); }), ids = {}, i, res;
    for (i = 0; i < mem.length; i++) ids[mem[i].studentId] = true;
    if (st.mode === 'one_per_note') {
      var parts = [], filled = 0, sm = seatMap(mem, st.seats, o.song.cellCount), holder = {}, assigned = 0;
      for (i = 0; i < mem.length; i++) if (sm[String(mem[i].studentId)]) { holder[sm[String(mem[i].studentId)]] = mem[i]; assigned++; }
      for (i = 0; i < o.song.cellCount; i++) {
        var m = holder[i + 1], c = m && o.drafts[m.studentId] ? String(o.drafts[m.studentId][i] || '') : '';
        if (c) filled++;
        parts.push({ index: i, seat: i + 1, studentId: m ? m.studentId : '', label: m ? m.label : '', text: c });
      }
      return { mode: 'one_per_note', groupNo: o.groupNo, parts: parts, filled: filled, complete: filled === o.song.cellCount, extraMembers: Math.max(0, mem.length - assigned),
        candidates: [], tally: {}, total: 0, leaders: [], tie: false, winnerId: '', status: st.locked ? 'locked' : (filled === o.song.cellCount ? 'complete' : 'writing') };
    }
    var cand = [], tally = {}, total = 0, voterTarget, v, t;
    for (i = 0; i < mem.length; i++) {
      var cells = o.drafts[mem[i].studentId];
      if (!isEmptyCells(cells)) { cand.push({ studentId: mem[i].studentId, label: mem[i].label, cells: cells, filled: filledCount(cells), votes: 0 }); tally[mem[i].studentId] = 0; }
    }
    for (v in o.votes) {
      if (!Object.prototype.hasOwnProperty.call(o.votes, v)) continue;
      t = o.votes[v];
      if (!ids[v] || !Object.prototype.hasOwnProperty.call(tally, t)) continue;
      if (v === t && !st.selfVote) continue;           // เปลี่ยนกติกาเป็นห้ามโหวตตัวเองภายหลัง → ไม่นับคะแนนตัวเอง
      tally[t]++; total++;
    }
    var max = 0; for (i = 0; i < cand.length; i++) { cand[i].votes = tally[cand[i].studentId]; if (cand[i].votes > max) max = cand[i].votes; }
    var leaders = []; if (max > 0) for (i = 0; i < cand.length; i++) if (cand[i].votes === max) leaders.push(cand[i].studentId);
    var chosen = st.chosen[String(o.groupNo)] || '', chosenOk = !!chosen && tally.hasOwnProperty(chosen);
    var tie = leaders.length > 1, winner = chosenOk ? chosen : ((st.phase === 'closed' && leaders.length === 1) ? leaders[0] : '');
    var status = st.phase === 'writing' ? 'writing' : (st.phase === 'voting' ? 'voting' : (winner ? (chosenOk && tie ? 'tie_decided' : (chosenOk ? 'teacher_picked' : 'winner')) : (tie ? 'tie_waiting' : 'no_votes')));
    return { mode: 'draft_vote', groupNo: o.groupNo, candidates: cand, tally: tally, total: total, leaders: leaders, tie: tie, winnerId: winner, chosenByTeacher: chosenOk, status: status };
  }

  var LyricCore = { LIMITS: LIMITS, GROUPS: GROUPS, PHASES: PHASES, MODES: MODES, STRUCTURE_NOTE: STRUCTURE_NOTE, songKeyOf: songKeyOf, songsForPeriod: songsForPeriod,
    hasStudioPeriod: hasStudioPeriod, sanitizeCell: sanitizeCell, sanitizeCells: sanitizeCells, isEmptyCells: isEmptyCells, filledCount: filledCount, groupOf: groupOf, seatOf: seatOf, seatMap: seatMap,
    defaultSettings: defaultSettings, normSettings: normSettings, voteError: voteError, canEdit: canEdit, resolveGroup: resolveGroup };
  root.LyricCore = LyricCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = LyricCore;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
