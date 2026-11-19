// Lyric Studio routes (shared logic imported from app/js/lyric-core.js)

import LyricCore from '../../../app/js/lyric-core.js';
import {
  HttpError,
  bad,
  nowIso,
  reqStr
} from '../utils.js';

const LYRIC_SONGS = {
  ode_to_joy: { cellCount: 30, maxLen: 12 },
  joy_to_the_world: { cellCount: 8, maxLen: 40 }
};

const LYRIC_VOTE_MSG = {
  locked: 'ครูล็อกผลแล้ว',
  not_voting: 'ยังไม่เปิด/ปิดโหวตแล้ว',
  bad_target: 'โหวตได้เฉพาะเนื้อของเพื่อนในกลุ่มที่มีเนื้อแล้ว',
  self_not_allowed: 'ตอนนี้โหวตให้ตัวเองไม่ได้',
  bad_mode: 'โหมดนี้ไม่ต้องโหวต',
  not_member: 'โหวตได้เฉพาะในกลุ่มของตัวเอง'
};

const LYRIC_PATCH_KEYS = ['mode', 'phase', 'locked', 'selfVote', 'selfVoteConfirmed', 'showTally', 'seats'];

function lyricSong(key) {
  const k = String(key || '');
  const s = LYRIC_SONGS[k];
  if (!s) throw new HttpError(404, 'bad_song', 'ไม่พบเพลงนี้');
  return { key: k, cellCount: s.cellCount, maxLen: s.maxLen };
}

function lyricMember(r) {
  const label = String(r.nickname || r.first_name || r.student_id || '').slice(0, 20);
  const name = `${r.prefix || ''}${r.first_name || ''} ${r.last_name || ''}`.trim();
  return { studentId: String(r.student_id), label, no: Number(r.no) || 0, group: LyricCore.groupOf(r.no), name };
}

function parseCells(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function lyricLoad(env, className, key) {
  const [mem, dr, vo, se] = await Promise.all([
    env.DB.prepare("SELECT student_id, no, prefix, first_name, last_name, nickname FROM students WHERE class_name = ? AND status = 'active' ORDER BY no").bind(className).all(),
    env.DB.prepare('SELECT student_id, cells FROM lyric_drafts WHERE class_name = ? AND song_key = ?').bind(className, key).all(),
    env.DB.prepare('SELECT voter_id, target_id FROM lyric_votes WHERE class_name = ? AND song_key = ?').bind(className, key).all(),
    env.DB.prepare('SELECT json FROM lyric_settings WHERE class_name = ? AND song_key = ?').bind(className, key).first()
  ]);
  const drafts = {};
  for (const r of dr.results) drafts[String(r.student_id)] = parseCells(r.cells);
  const votes = {};
  for (const r of vo.results) votes[String(r.voter_id)] = String(r.target_id);
  let raw = {};
  if (se) {
    try {
      raw = JSON.parse(se.json);
    } catch {
      raw = {};
    }
  }
  return { members: mem.results.map(lyricMember), drafts, votes, settings: LyricCore.normSettings(raw, key) };
}

function lyricResolve(data, song, groupNo) {
  const members = data.members.filter((m) => m.group === groupNo).sort((a, b) => a.no - b.no);
  const d = {};
  const v = {};
  for (const m of members) {
    if (data.drafts[m.studentId]) d[m.studentId] = data.drafts[m.studentId];
    if (data.votes[m.studentId]) v[m.studentId] = data.votes[m.studentId];
  }
  const res = LyricCore.resolveGroup({ settings: data.settings, members, drafts: d, votes: v, groupNo, song });
  return { members, res };
}

async function lyricPutSettings(env, className, key, st) {
  await env.DB.prepare(
    `INSERT INTO lyric_settings (class_name, song_key, json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (class_name, song_key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
  ).bind(className, key, JSON.stringify(st), nowIso()).run();
}

async function lyricWho(env, auth, key) {
  const song = lyricSong(key);
  const s = await env.DB.prepare('SELECT class_name FROM students WHERE student_id = ? AND status = ?').bind(auth.sid, 'active').first();
  if (!s) throw new HttpError(403, 'forbidden', 'ไม่พบบัญชีนักเรียน');
  const data = await lyricLoad(env, s.class_name, song.key);
  const me = data.members.find((m) => m.studentId === auth.sid);
  if (!me) throw new HttpError(403, 'forbidden', 'ไม่พบบัญชีนักเรียน');
  return { song, className: s.class_name, data, me };
}

export async function studentLyricGet(env, auth, url) {
  const { song, data, me } = await lyricWho(env, auth, url.searchParams.get('song'));
  const st = data.settings;
  const g = lyricResolve(data, song, me.group);
  const res = g.res;
  const seat = LyricCore.seatOf(g.members, me.studentId, st.seats, song.cellCount);
  const out = {
    songKey: song.key, cellCount: song.cellCount, maxLen: song.maxLen,
    settings: { mode: st.mode, phase: st.phase, locked: st.locked, selfVote: st.selfVote, selfVoteConfirmed: st.selfVoteConfirmed },
    group: me.group, seat, memberCount: g.members.length, me: { studentId: me.studentId, label: me.label },
    myCells: data.drafts[me.studentId] || [], myVote: data.votes[me.studentId] || '', canEdit: LyricCore.canEdit(st),
    savedCount: g.members.filter((m) => !LyricCore.isEmptyCells(data.drafts[m.studentId])).length
  };
  if (st.mode === 'one_per_note') {
    out.parts = res.parts.map((x) => ({ index: x.index, seat: x.seat, label: x.label, text: x.text, mine: x.studentId === me.studentId }));
    out.complete = res.complete;
    out.extraMembers = res.extraMembers;
    out.canEdit = out.canEdit && seat >= 1 && seat <= song.cellCount;
  } else if (st.phase !== 'writing') {
    const showTally = st.locked || st.showTally === 'always' || (st.showTally === 'afterClose' && st.phase === 'closed');
    out.tallyVisible = showTally;
    out.candidates = res.candidates.map((c) => {
      const o = { studentId: c.studentId, label: c.label, cells: c.cells, isMe: c.studentId === me.studentId };
      if (showTally) o.votes = c.votes;
      return o;
    });
    if (st.phase === 'closed' || st.locked) out.result = { status: res.status, winnerId: res.winnerId, tie: res.tie, leaders: showTally ? res.leaders : [] };
  }
  return out;
}

export async function studentLyricSave(env, auth, b) {
  const { song, className, data, me } = await lyricWho(env, auth, b.songKey);
  const st = data.settings;
  if (st.locked) throw new HttpError(409, 'locked', 'ครูล็อกผลแล้ว แก้ไขไม่ได้');
  if (st.phase !== 'writing') throw new HttpError(409, 'not_writing', 'ปิดรับการแก้เนื้อแล้ว (เข้าสู่ช่วงโหวต)');
  const s = LyricCore.sanitizeCells(b.cells, song);
  if (s.extra) throw new HttpError(400, 'too_many_cells', `ช่องเนื้อร้องมีได้ไม่เกิน ${song.cellCount} ช่อง`);
  let cells = s.cells;
  if (st.mode === 'one_per_note') {
    const group = data.members.filter((m) => m.group === me.group);
    const seat = LyricCore.seatOf(group, me.studentId, st.seats, song.cellCount);
    if (seat < 1 || seat > song.cellCount) throw new HttpError(409, 'no_seat', 'ยังไม่มีวรรคที่รับผิดชอบ — แจ้งครู');
    cells = cells.map((c, i) => (i === seat - 1 ? c : ''));
  }
  await env.DB.prepare(
    `INSERT INTO lyric_drafts (class_name, song_key, student_id, cells, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (class_name, song_key, student_id) DO UPDATE SET cells = excluded.cells, updated_at = excluded.updated_at`
  ).bind(className, song.key, me.studentId, JSON.stringify(cells), nowIso()).run();
  return { saved: true, filled: LyricCore.filledCount(cells), cells };
}

export async function studentLyricVote(env, auth, b) {
  const { song, className, data, me } = await lyricWho(env, auth, b.songKey);
  const target = String(b.targetId || '');
  const tm = data.members.find((m) => m.studentId === target && m.group === me.group);
  const err = LyricCore.voteError({
    settings: data.settings, voterId: me.studentId, targetId: target, voterIsMember: true,
    targetIsCandidate: !!tm && !LyricCore.isEmptyCells(data.drafts[target])
  });
  if (err) throw new HttpError(409, err, LYRIC_VOTE_MSG[err] || err);
  await env.DB.prepare(
    `INSERT INTO lyric_votes (class_name, song_key, voter_id, target_id, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (class_name, song_key, voter_id) DO UPDATE SET target_id = excluded.target_id, updated_at = excluded.updated_at`
  ).bind(className, song.key, me.studentId, target, nowIso()).run();
  return { myVote: target };
}

export async function teacherLyricOverview(env, url) {
  const className = reqStr(url.searchParams.get('class') || '', 'class', 60);
  const song = lyricSong(url.searchParams.get('song'));
  const data = await lyricLoad(env, className, song.key);
  const groups = [];
  for (let g = 1; g <= LyricCore.GROUPS; g++) {
    const r = lyricResolve(data, song, g);
    if (!r.members.length) continue;
    const ids = new Set(r.members.map((m) => m.studentId));
    const byId = new Map(r.members.map((m) => [m.studentId, m]));
    const voters = [];
    for (const [vid, tid] of Object.entries(data.votes)) {
      if (!ids.has(vid)) continue;
      voters.push({ voter: byId.get(vid).label, voterId: vid, target: byId.get(tid)?.label ?? '?', targetId: tid });
    }
    const sm = LyricCore.seatMap(r.members, data.settings.seats, song.cellCount);
    groups.push({
      group: g,
      members: r.members.map((m) => ({ studentId: m.studentId, label: m.label, name: m.name, no: m.no, seat: sm[m.studentId] || 0, saved: !LyricCore.isEmptyCells(data.drafts[m.studentId]) })),
      result: r.res, voters
    });
  }
  return { songKey: song.key, cellCount: song.cellCount, settings: data.settings, groups };
}

export async function teacherLyricSet(env, b) {
  const className = reqStr(b.className, 'className', 60);
  const song = lyricSong(b.songKey);
  const row = await env.DB.prepare('SELECT json FROM lyric_settings WHERE class_name = ? AND song_key = ?').bind(className, song.key).first();
  let raw = {};
  try {
    raw = row ? JSON.parse(row.json) : {};
  } catch {
    raw = {};
  }
  const cur = LyricCore.normSettings(raw, song.key);
  const patch = b.patch && typeof b.patch === 'object' ? b.patch : {};
  let nx = JSON.parse(JSON.stringify(cur));
  for (const k of LYRIC_PATCH_KEYS) if (k in patch) nx[k] = patch[k];
  nx = LyricCore.normSettings(nx, song.key);
  nx.chosen = cur.chosen;
  if (nx.locked && !cur.locked) nx.lockedAt = nowIso();
  await lyricPutSettings(env, className, song.key, nx);
  return { settings: nx };
}

export async function teacherLyricPick(env, b) {
  const className = reqStr(b.className, 'className', 60);
  const song = lyricSong(b.songKey);
  const g = parseInt(b.group, 10);
  if (!(g >= 1 && g <= LyricCore.GROUPS)) throw bad('กลุ่มไม่ถูกต้อง');
  const data = await lyricLoad(env, className, song.key);
  const r = lyricResolve(data, song, g);
  const sid = String(b.studentId || '');
  if (sid && !r.res.candidates.some((c) => c.studentId === sid)) throw new HttpError(409, 'bad_target', 'เลือกได้เฉพาะเนื้อของสมาชิกกลุ่มนี้ที่มีเนื้อแล้ว');
  const st = data.settings;
  if (sid) st.chosen[String(g)] = sid;
  else delete st.chosen[String(g)];
  await lyricPutSettings(env, className, song.key, st);
  return { chosen: st.chosen };
}
