/* studio_gas_proto.js — ต้นแบบฝั่ง Apps Script ของ เนื้อร้องใต้โน้ต + โหวตเนื้อร้องในกลุ่ม
 * ใช้ในโหมดพรีวิวในเครื่องเท่านั้น (tools/local_server.js → fake GAS) — ยังไม่ deploy จริง และไม่แก้ google_apps_script.js
 * เขียนเป็น ES5 และใช้เฉพาะ API ของชีตที่ fake_gas มี (getDataRange/getRange.setValues/appendRow) เพื่อให้ย้ายไปวางใน Apps Script ได้
 * (เมื่อวางจริง: เพิ่มไฟล์ lyric-core.js ในโปรเจกต์ Apps Script ด้วย และต่อ action ใน doPost — ดูรายงาน)
 *
 * deps: { getSheet(name, headers), verify(token)->{rec}|{error}, isTeacherToken(token), roster(className)->[rec], now()->ms, songs:{key:{cellCount,maxLen}} } */
var LC_ = (typeof LyricCore !== 'undefined') ? LyricCore : require('../../app/js/lyric-core.js');

var STUDIO_ACTIONS_STUDENT = ['studentLyricGet', 'studentLyricSave', 'studentLyricVote'];
var STUDIO_ACTIONS_TEACHER = ['lyric_teacher_overview', 'lyric_teacher_set', 'lyric_teacher_pick'];
var STUDIO_SHEETS = {
  drafts: { name: 'LyricDrafts', headers: ['class', 'song_key', 'student_id', 'cells_json', 'updated_at'] },
  votes: { name: 'LyricVotes', headers: ['class', 'song_key', 'voter_id', 'target_id', 'updated_at'] },
  settings: { name: 'LyricSettings', headers: ['class', 'song_key', 'json', 'updated_at'] }
};

function createStudioProto(deps) {
  var NOW = function () { return deps.now ? deps.now() : new Date().getTime(); };
  function iso(ms) { return new Date(ms).toISOString(); }
  function fail(code, message) { return { status: 'error', code: code, message: message }; }
  function tbl(def) {
    var sh = deps.getSheet(def.name, def.headers);
    function all() {
      var v = sh.getDataRange().getValues(), out = [], r, c, o;
      for (r = 1; r < v.length; r++) { o = { _row: r + 1 }; for (c = 0; c < def.headers.length; c++) o[def.headers[c]] = v[r][c]; out.push(o); }
      return out;
    }
    function toRow(o) { var row = [], c; for (c = 0; c < def.headers.length; c++) row.push(o[def.headers[c]] === undefined ? '' : o[def.headers[c]]); return row; }
    return { all: all, append: function (o) { sh.appendRow(toRow(o)); }, write: function (rowNo, o) { sh.getRange(rowNo, 1, 1, def.headers.length).setValues([toRow(o)]); } };
  }
  function upsert(def, match, obj) {
    var t = tbl(def), rows = t.all(), i, ok;
    for (i = 0; i < rows.length; i++) { ok = true; for (var k in match) if (String(rows[i][k]) !== String(match[k])) ok = false; if (ok) { var merged = {}; for (var h in rows[i]) merged[h] = rows[i][h]; for (var m in obj) merged[m] = obj[m]; t.write(rows[i]._row, merged); return; } }
    var n = {}; for (var a in match) n[a] = match[a]; for (var b in obj) n[b] = obj[b]; t.append(n);
  }
  function labelOf(rec) { return String(rec.nickname || rec.first_name || rec.student_id || '').slice(0, 20); }
  function memberOf(rec) { return { studentId: String(rec.student_id), label: labelOf(rec), no: Number(rec.no) || 0, group: LC_.groupOf(rec.no), name: String((rec.prefix || '') + (rec.first_name || '') + ' ' + (rec.last_name || '')).replace(/^\s+|\s+$/g, '') }; }
  function groupMembers(className, groupNo) {
    var out = [], r = deps.roster(className), i, m;
    for (i = 0; i < r.length; i++) { m = memberOf(r[i]); if (m.group === groupNo) out.push(m); }
    return out.sort(function (a, b) { return a.no - b.no; });
  }
  function songCfg(key) { var s = deps.songs && deps.songs[key]; return s ? { key: key, cellCount: s.cellCount, maxLen: s.maxLen } : null; }
  function getSettings(className, key) {
    var rows = tbl(STUDIO_SHEETS.settings).all(), i, raw = {};
    for (i = 0; i < rows.length; i++) if (String(rows[i]['class']) === className && String(rows[i].song_key) === key) { try { raw = JSON.parse(rows[i].json); } catch (e) { raw = {}; } }
    return LC_.normSettings(raw, key);
  }
  function putSettings(className, key, s) { upsert(STUDIO_SHEETS.settings, { 'class': className, song_key: key }, { json: JSON.stringify(s), updated_at: iso(NOW()) }); }
  function classDrafts(className, key) {
    var rows = tbl(STUDIO_SHEETS.drafts).all(), out = {}, i, c;
    for (i = 0; i < rows.length; i++) if (String(rows[i]['class']) === className && String(rows[i].song_key) === key) { try { c = JSON.parse(rows[i].cells_json); } catch (e) { c = []; } out[String(rows[i].student_id)] = c; }
    return out;
  }
  function classVotes(className, key) {
    var rows = tbl(STUDIO_SHEETS.votes).all(), out = {}, i;
    for (i = 0; i < rows.length; i++) if (String(rows[i]['class']) === className && String(rows[i].song_key) === key) out[String(rows[i].voter_id)] = String(rows[i].target_id);
    return out;
  }
  function resolveFor(className, key, groupNo, settings, drafts, votes) {
    var members = groupMembers(className, groupNo), d = {}, v = {}, i;
    for (i = 0; i < members.length; i++) { if (drafts[members[i].studentId]) d[members[i].studentId] = drafts[members[i].studentId]; if (votes[members[i].studentId]) v[members[i].studentId] = votes[members[i].studentId]; }
    return { members: members, res: LC_.resolveGroup({ settings: settings, members: members, drafts: d, votes: v, groupNo: groupNo, song: songCfg(key) }) };
  }
  function whoStudent(p) {
    var v = deps.verify(p.sessionToken);
    if (v.error) return { err: fail(v.error, 'เข้าสู่ระบบใหม่อีกครั้ง') };
    return { rec: v.rec, className: String(v.rec['class']), me: memberOf(v.rec) };
  }
  function bad(p) { if (!deps.isTeacherToken(p.token)) return fail('unauthorized', 'unauthorized'); return null; }

  /* ---------------- นักเรียน: เนื้อร้อง ---------------- */
  function studentLyricGet(p) {
    var w = whoStudent(p); if (w.err) return w.err;
    var key = String(p.songKey || ''), song = songCfg(key); if (!song) return fail('bad_song', 'ไม่พบเพลงนี้');
    var st = getSettings(w.className, key), drafts = classDrafts(w.className, key), votes = classVotes(w.className, key);
    var g = resolveFor(w.className, key, w.me.group, st, drafts, votes), res = g.res, seat = LC_.seatOf(g.members, w.me.studentId, st.seats, song.cellCount);
    var out = { status: 'success', songKey: key, cellCount: song.cellCount, maxLen: song.maxLen,
      settings: { mode: st.mode, phase: st.phase, locked: st.locked, selfVote: st.selfVote, selfVoteConfirmed: st.selfVoteConfirmed },
      group: w.me.group, seat: seat, memberCount: g.members.length, me: { studentId: w.me.studentId, label: w.me.label },
      myCells: drafts[w.me.studentId] || [], myVote: votes[w.me.studentId] || '', canEdit: LC_.canEdit(st), savedCount: 0 };
    var i; for (i = 0; i < g.members.length; i++) if (!LC_.isEmptyCells(drafts[g.members[i].studentId])) out.savedCount++;
    if (st.mode === 'one_per_note') {
      out.parts = res.parts.map(function (x) { return { index: x.index, seat: x.seat, label: x.label, text: x.text, mine: x.studentId === w.me.studentId }; });
      out.complete = res.complete; out.extraMembers = res.extraMembers;
      out.canEdit = out.canEdit && seat >= 1 && seat <= song.cellCount;
    } else if (st.phase !== 'writing') {
      var showTally = st.locked || st.showTally === 'always' || (st.showTally === 'afterClose' && st.phase === 'closed');
      out.tallyVisible = showTally;
      out.candidates = res.candidates.map(function (c) { var o = { studentId: c.studentId, label: c.label, cells: c.cells, isMe: c.studentId === w.me.studentId }; if (showTally) o.votes = c.votes; return o; });
      if (st.phase === 'closed' || st.locked) out.result = { status: res.status, winnerId: res.winnerId, tie: res.tie, leaders: showTally ? res.leaders : [] };
    }
    return out;
  }
  function studentLyricSave(p) {
    var w = whoStudent(p); if (w.err) return w.err;
    var key = String(p.songKey || ''), song = songCfg(key); if (!song) return fail('bad_song', 'ไม่พบเพลงนี้');
    var st = getSettings(w.className, key);
    if (st.locked) return fail('locked', 'ครูล็อกผลแล้ว แก้ไขไม่ได้');
    if (st.phase !== 'writing') return fail('not_writing', 'ปิดรับการแก้เนื้อแล้ว (เข้าสู่ช่วงโหวต)');
    var s = LC_.sanitizeCells(p.cells, song);
    if (s.extra) return fail('too_many_cells', 'ช่องเนื้อร้องมีได้ไม่เกิน ' + song.cellCount + ' ช่อง');
    var cells = s.cells;
    if (st.mode === 'one_per_note') {
      var seat = LC_.seatOf(groupMembers(w.className, w.me.group), w.me.studentId, st.seats, song.cellCount), only = [], i;
      if (seat < 1 || seat > song.cellCount) return fail('no_seat', 'ยังไม่มีวรรคที่รับผิดชอบ — แจ้งครู');
      for (i = 0; i < song.cellCount; i++) only.push(i === seat - 1 ? cells[i] : '');
      cells = only;
    }
    upsert(STUDIO_SHEETS.drafts, { 'class': w.className, song_key: key, student_id: w.me.studentId }, { cells_json: JSON.stringify(cells), updated_at: iso(NOW()) });
    return { status: 'success', saved: true, filled: LC_.filledCount(cells), cells: cells };
  }
  function studentLyricVote(p) {
    var w = whoStudent(p); if (w.err) return w.err;
    var key = String(p.songKey || ''), song = songCfg(key); if (!song) return fail('bad_song', 'ไม่พบเพลงนี้');
    var st = getSettings(w.className, key), drafts = classDrafts(w.className, key), members = groupMembers(w.className, w.me.group), target = String(p.targetId || ''), i, isMember = false, isCand = false;
    for (i = 0; i < members.length; i++) { if (members[i].studentId === target) { isMember = true; isCand = !LC_.isEmptyCells(drafts[target]); } }
    var err = LC_.voteError({ settings: st, voterId: w.me.studentId, targetId: target, voterIsMember: true, targetIsCandidate: isMember && isCand });
    if (err) return fail(err, { locked: 'ครูล็อกผลแล้ว', not_voting: 'ยังไม่เปิด/ปิดโหวตแล้ว', bad_target: 'โหวตได้เฉพาะเนื้อของเพื่อนในกลุ่มที่มีเนื้อแล้ว', self_not_allowed: 'ตอนนี้โหวตให้ตัวเองไม่ได้', bad_mode: 'โหมดนี้ไม่ต้องโหวต' }[err] || err);
    upsert(STUDIO_SHEETS.votes, { 'class': w.className, song_key: key, voter_id: w.me.studentId }, { target_id: target, updated_at: iso(NOW()) });
    return { status: 'success', myVote: target };
  }

  /* ---------------- ครู: เนื้อร้อง ---------------- */
  function lyricOverview(p) {
    var e = bad(p); if (e) return e;
    var className = String(p.className || ''), key = String(p.songKey || ''), song = songCfg(key); if (!song) return fail('bad_song', 'ไม่พบเพลงนี้');
    var st = getSettings(className, key), drafts = classDrafts(className, key), votes = classVotes(className, key), out = [], g, res;
    for (g = 1; g <= LC_.GROUPS; g++) {
      res = resolveFor(className, key, g, st, drafts, votes);
      if (!res.members.length) continue;
      var voters = []; for (var vid in votes) { var vm = null; for (var i = 0; i < res.members.length; i++) if (res.members[i].studentId === vid) vm = res.members[i]; if (vm) { var tm = null; for (var j = 0; j < res.members.length; j++) if (res.members[j].studentId === votes[vid]) tm = res.members[j]; voters.push({ voter: vm.label, voterId: vid, target: tm ? tm.label : '?', targetId: votes[vid] }); } }
      var sm = LC_.seatMap(res.members, st.seats, song.cellCount);
      out.push({ group: g, members: res.members.map(function (m) { return { studentId: m.studentId, label: m.label, name: m.name, no: m.no, seat: sm[String(m.studentId)] || 0, saved: !LC_.isEmptyCells(drafts[m.studentId]) }; }), result: res.res, voters: voters });
    }
    return { status: 'success', songKey: key, cellCount: song.cellCount, settings: st, groups: out };
  }
  function lyricSet(p) {
    var e = bad(p); if (e) return e;
    var className = String(p.className || ''), key = String(p.songKey || ''); if (!songCfg(key)) return fail('bad_song', 'ไม่พบเพลงนี้');
    var cur = getSettings(className, key), patch = p.patch || {}, nx = JSON.parse(JSON.stringify(cur)), k, allowed = ['mode', 'phase', 'locked', 'selfVote', 'selfVoteConfirmed', 'showTally', 'seats'];
    for (k in patch) if (allowed.indexOf(k) >= 0) nx[k] = patch[k];
    nx = LC_.normSettings(nx, key); nx.chosen = cur.chosen;
    if (nx.locked && !cur.locked) nx.lockedAt = iso(NOW());
    putSettings(className, key, nx);
    return { status: 'success', settings: nx };
  }
  function lyricPick(p) {
    var e = bad(p); if (e) return e;
    var className = String(p.className || ''), key = String(p.songKey || ''), g = parseInt(p.group, 10); if (!songCfg(key) || !(g >= 1 && g <= LC_.GROUPS)) return fail('bad_request', 'ข้อมูลไม่ถูกต้อง');
    var st = getSettings(className, key), drafts = classDrafts(className, key), r = resolveFor(className, key, g, st, drafts, classVotes(className, key)), sid = String(p.studentId || ''), ok = false, i;
    for (i = 0; i < r.res.candidates.length; i++) if (r.res.candidates[i].studentId === sid) ok = true;
    if (sid && !ok) return fail('bad_target', 'เลือกได้เฉพาะเนื้อของสมาชิกกลุ่มนี้ที่มีเนื้อแล้ว');
    if (sid) st.chosen[String(g)] = sid; else delete st.chosen[String(g)];
    putSettings(className, key, st);
    return { status: 'success', chosen: st.chosen };
  }

  function handle(p) {
    switch (p && p.action) {
      case 'studentLyricGet': return studentLyricGet(p);
      case 'studentLyricSave': return studentLyricSave(p);
      case 'studentLyricVote': return studentLyricVote(p);
      case 'lyric_teacher_overview': return lyricOverview(p);
      case 'lyric_teacher_set': return lyricSet(p);
      case 'lyric_teacher_pick': return lyricPick(p);
    }
    return null;
  }
  return { handle: handle, handles: function (a) { return STUDIO_ACTIONS_STUDENT.indexOf(a) >= 0 || STUDIO_ACTIONS_TEACHER.indexOf(a) >= 0; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { createStudioProto: createStudioProto, STUDIO_ACTIONS_STUDENT: STUDIO_ACTIONS_STUDENT, STUDIO_ACTIONS_TEACHER: STUDIO_ACTIONS_TEACHER, STUDIO_SHEETS: STUDIO_SHEETS };
