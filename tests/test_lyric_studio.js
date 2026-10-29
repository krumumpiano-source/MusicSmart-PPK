// เนื้อร้องใต้โน้ต + โหวตในกลุ่ม: ตรรกะ (lyric-core) + ต้นแบบ Apps Script (tools/prototype) บน fake GAS — ข้อมูลสังเคราะห์เท่านั้น
const { PIN_A, PIN_B } = require('./lib/test_pins');
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { loadGas } = require('./fake_gas');
const { attach, SONGS } = require('../tools/prototype/attach_studio.js');
const LC = require('../app/js/lyric-core.js');
const ROOT = path.join(__dirname, '..');
const T = 'teacher-token';
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

// ---- โน้ตจริงจากข้อมูลเดิมของแอป ----
const ctx = { }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/data/kalimba_media.js'), 'utf8') + ';this.K=KALIMBA_MEDIA', ctx);
const K = ctx.K;
const p8 = LC.songsForPeriod(8, K), p9 = LC.songsForPeriod(9, K), p10 = LC.songsForPeriod(10, K);
eq(p8.map(s => s.key), ['ode_to_joy', 'joy_to_the_world'], 'คาบ 8 มีทั้งสองเพลง');
eq(p9.map(s => s.key), ['ode_to_joy']); eq(p10.map(s => s.key), ['joy_to_the_world']);
eq(LC.songsForPeriod(7, K).length, 0, 'คาบอื่นไม่มีช่องเนื้อร้อง'); eq(LC.songsForPeriod(11, K).length, 0);
const ode = p9[0], joy = p10[0];
eq(ode.cellCount, 30, 'Ode: 1 ช่อง ต่อ 1 โน้ต (30 โน้ต)'); eq(ode.phrases.length, 4, 'Ode 4 วรรค (วก.5)'); eq(ode.phrases.map(x => x.length), [8, 7, 8, 7]);
eq(joy.cellCount, 8, 'Joy: 8 โน้ต = 8 วรรค (วก.5 คาบ 10)'); eq(joy.phrases.length, 8);
eq({ cellCount: ode.cellCount, maxLen: ode.maxLen }, SONGS.ode_to_joy, 'ค่าคงที่ฝั่งเซิร์ฟเวอร์ตรงกับโน้ตจริง');
eq({ cellCount: joy.cellCount, maxLen: joy.maxLen }, SONGS.joy_to_the_world);
ok(ode.notes.every(x => x.pitch && x.d > 0), 'ทุกโน้ตมีระดับเสียงและความยาวจากข้อมูลจริง');
// ไม่มีเนื้อเพลงตัวอย่างที่แต่งเองฝังในโค้ดหลัก

// ---- ทำความสะอาด/จำกัดความยาว ----
eq(LC.sanitizeCell('  a\u0000b<c>  d ', 12), 'a b c d');
eq(Array.from(LC.sanitizeCell('ก'.repeat(50), 12)).length, 12, 'ตัดที่ maxLen');
const s1 = LC.sanitizeCells(['x'].concat(new Array(40).fill('y')), ode); ok(s1.extra, 'ส่งเกินจำนวนโน้ต → ตรวจพบ'); eq(s1.cells.length, 30);
eq(LC.sanitizeCells(['a'], joy).cells.length, 8, 'เติมให้ครบจำนวนช่อง');
eq([1, 5, 6, 40, 41].map(LC.groupOf), [1, 5, 1, 5, 1], 'กลุ่ม = ((เลขที่-1)%5)+1 เหมือน App.getStudentGroup');

// ---- ต้นแบบ Apps Script ----
const gas = attach(loadGas({ SYNC_TOKEN: T }), { syncToken: T });
const call = b => gas.call(b);
const CLS = 'ม.1/1', CLS2 = 'ม.1/2';
const roster = [];
for (let i = 1; i <= 40; i++) roster.push({ student_id: String(91000 + i), prefix: 'ด.ช.', first_name: 'สมมติ' + i, last_name: 'ทดสอบ', nickname: 'น' + i, class: CLS, no: i });
roster.push({ student_id: '92001', prefix: 'ด.ช.', first_name: 'ห้องอื่น', last_name: 'ทดสอบ', nickname: 'อื่น', class: CLS2, no: 1 });
eq(call({ action: 'upload_roster', token: T, students: roster, replace: true }).status, 'success');
const tok = {}; const login = id => (tok[id] = tok[id] || call({ action: 'studentSetPin', studentId: id, pin: PIN_A }).sessionToken);
['91001', '91006', '91011', '91016', '91021', '91026', '91031', '91036', '91002', '92001'].forEach(login);
ok(tok['91001'] && tok['92001']);
const S = (id, o) => call(Object.assign({ sessionToken: tok[id] }, o));
const cellsOf = (c, fill) => new Array(c).fill(0).map((_, i) => fill + i);
// เพื่อนร่วมกลุ่ม 1 (เลขที่ 1,6,11,...,36) = 8 คน
const g1 = ['91001', '91006', '91011', '91016', '91021', '91026', '91031', '91036'];

// ไม่มีโทเค็น/ปลอม/โทเค็นครู → ใช้ไม่ได้
eq(call({ action: 'studentLyricGet', songKey: 'ode_to_joy' }).code, 'bad_session');
eq(call({ action: 'studentLyricGet', sessionToken: 'a.b', songKey: 'ode_to_joy' }).code, 'bad_session');
eq(call({ action: 'lyric_teacher_overview', token: 'wrong', className: CLS, songKey: 'ode_to_joy' }).message, 'unauthorized');
eq(S('91001', { action: 'studentLyricGet', songKey: 'nope' }).code, 'bad_song');

// ค่าเริ่มต้น
let g = S('91001', { action: 'studentLyricGet', songKey: 'ode_to_joy' });
eq(g.group, 1); eq(g.memberCount, 8); eq(g.settings.mode, 'draft_vote'); eq(g.settings.phase, 'writing'); eq(g.settings.selfVote, false, 'ค่าเริ่มต้น: โหวตตัวเองไม่ได้'); eq(g.settings.selfVoteConfirmed, true, 'ครูตัดสินแล้ว ไม่มีป้ายรอยืนยัน');
eq(S('91001', { action: 'studentLyricGet', songKey: 'joy_to_the_world' }).settings.mode, 'one_per_note', 'Joy ค่าเริ่มต้นตาม วก.5: 1 คนต่อ 1 โน้ต');

// พิมพ์ได้ ไม่เกินจำนวนโน้ต
let r = S('91001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'ก') }); eq(r.status, 'success'); eq(r.filled, 30);
r = S('91001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(31, 'ก') }); eq(r.code, 'too_many_cells', 'เกินจำนวนโน้ต → ปฏิเสธ');
r = S('91001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: ['ย'.repeat(99)] }); eq(Array.from(r.cells[0]).length, 12, 'ตัดความยาวต่อช่องฝั่งเซิร์ฟเวอร์');
r = S('91001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'ก') });
// ข้ามกลุ่ม: นักเรียนอื่นเขียน แล้วตรวจไม่รั่ว
g1.slice(1, 5).forEach((id, i) => { login(id); S(id, { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'ข' + (i + 1) + '_') }); });
login('91002'); S('91002', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'กลุ่ม2ลับ') });
login('92001'); S('92001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'ห้องอื่นลับ') });
g = S('91001', { action: 'studentLyricGet', songKey: 'ode_to_joy' });
eq(g.candidates, undefined, 'ช่วงแต่ง: ไม่เห็นเนื้อของเพื่อน'); eq(g.savedCount, 5); eq(g.myCells.length, 30);
let blob = JSON.stringify(g); ok(!/กลุ่ม2ลับ|ห้องอื่นลับ|91002|92001/.test(blob), 'ไม่รั่วข้ามกลุ่ม/ข้ามห้อง (ช่วงแต่ง)');

// โหวต: ยังไม่เปิด → ไม่ได้
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91006' }).code, 'not_voting');
// ครูเปิดโหวต → แก้เนื้อไม่ได้แล้ว
eq(call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { phase: 'voting' } }).settings.phase, 'voting');
eq(S('91001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'ก') }).code, 'not_writing');
g = S('91001', { action: 'studentLyricGet', songKey: 'ode_to_joy' });
eq(g.candidates.map(c => c.studentId).sort(), ['91001', '91006', '91011', '91016', '91021'], 'เห็นเฉพาะเนื้อสมาชิกกลุ่มตัวเองที่มีเนื้อแล้ว');
ok(g.candidates.every(c => c.votes === undefined), 'ระหว่างโหวตไม่โชว์คะแนน (ค่าเริ่มต้น)');
blob = JSON.stringify(g); ok(!/กลุ่ม2ลับ|ห้องอื่นลับ|91002|92001/.test(blob), 'ไม่รั่วข้ามกลุ่ม (ช่วงโหวต)');
// โหวตตัวเองไม่ได้ (ค่าเริ่มต้น); โหวตคนนอกกลุ่ม/คนไม่มีเนื้อไม่ได้
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91001' }).code, 'self_not_allowed');
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91002' }).code, 'bad_target', 'ข้ามกลุ่มไม่ได้');
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '92001' }).code, 'bad_target');
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91031' }).code, 'bad_target', 'คนที่ยังไม่มีเนื้อ โหวตไม่ได้');
// 1 เสียงต่อคน เปลี่ยนใจได้ก่อนล็อก
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91006' }).myVote, '91006');
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91011' }).myVote, '91011', 'เปลี่ยนใจได้');
let ov = call({ action: 'lyric_teacher_overview', token: T, className: CLS, songKey: 'ode_to_joy' });
let G1 = ov.groups.find(x => x.group === 1);
eq(G1.voters.filter(v => v.voterId === '91001').length, 1, '1 เสียงต่อคน (ไม่ทับซ้อน)'); eq(G1.result.total, 1);
eq(G1.result.tally['91011'], 1); eq(G1.result.tally['91006'], 0);
['91006', '91011', '91016', '91021'].forEach(id => { login(id); });
S('91006', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91011' });
S('91011', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91016' });
S('91016', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91011' });
ov = call({ action: 'lyric_teacher_overview', token: T, className: CLS, songKey: 'ode_to_joy' }); G1 = ov.groups.find(x => x.group === 1);
eq(G1.result.tally['91011'], 3); eq(G1.result.total, 4); eq(G1.result.status, 'voting'); eq(G1.result.winnerId, '', 'ยังไม่ปิดโหวต → ยังไม่ประกาศผู้ชนะ');
ok(G1.voters.length === 4 && G1.voters[0].voter, 'ครูเห็นรายชื่อผู้โหวต');
eq(ov.groups.map(x => x.group).sort(), [1, 2, 3, 4, 5], 'ครูเห็นทุกกลุ่มของห้อง');
// ห้องอื่นแยกกัน
ok(!JSON.stringify(ov).includes('92001'), 'ห้องอื่นไม่ปนในภาพรวมห้องนี้');

// ปิดโหวต → แสดงคะแนน (นักเรียนเห็นแค่จำนวน ไม่เห็นผู้โหวต)
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { phase: 'closed' } });
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91016' }).code, 'not_voting', 'ปิดโหวตแล้วโหวตไม่ได้');
g = S('91001', { action: 'studentLyricGet', songKey: 'ode_to_joy' });
eq(g.tallyVisible, true); eq(g.candidates.find(c => c.studentId === '91011').votes, 3); eq(g.result.winnerId, '91011'); eq(g.result.status, 'winner');
blob = JSON.stringify(g); ok(!/voter|voterId/.test(blob), 'นักเรียนไม่เห็นรายชื่อผู้โหวต');
eq(g.myVote, '91011', 'เห็นแค่โหวตของตัวเอง');

// เสมอ → ครูตัดสิน
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { phase: 'voting' } });
S('91021', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91016' });
S('91006', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91016' });   // 91016 = 3 (91011,91021,91006)
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { phase: 'closed' } });
ov = call({ action: 'lyric_teacher_overview', token: T, className: CLS, songKey: 'ode_to_joy' }); G1 = ov.groups.find(x => x.group === 1);
eq(G1.result.tally['91011'], 2); eq(G1.result.tally['91016'], 3, 'เปลี่ยนใจแล้วนับล่าสุด');
S('91011', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91016' }); // ปิดแล้วต้องไม่นับ
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { phase: 'voting' } });
S('91016', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91011' });   // 91011: 91001,91016 =2 ; 91016: 91011,91021,91006=3
S('91021', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91011' });
login('91026'); eq(S('91026', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91016' }).status, 'success', 'สมาชิกที่ยังไม่มีเนื้อก็โหวตได้');   // 91011 = 3, 91016 = 3 → เสมอ
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { phase: 'closed' } });
ov = call({ action: 'lyric_teacher_overview', token: T, className: CLS, songKey: 'ode_to_joy' }); G1 = ov.groups.find(x => x.group === 1);
eq(G1.result.tie, true, 'คะแนนเสมอ'); eq(G1.result.status, 'tie_waiting'); eq(G1.result.winnerId, '');
g = S('91001', { action: 'studentLyricGet', songKey: 'ode_to_joy' }); eq(g.result.status, 'tie_waiting', 'นักเรียนเห็นว่ารอครูตัดสิน');
eq(call({ action: 'lyric_teacher_pick', token: T, className: CLS, songKey: 'ode_to_joy', group: 1, studentId: '91002' }).code, 'bad_target', 'เลือกได้เฉพาะสมาชิกกลุ่มนั้น');
eq(call({ action: 'lyric_teacher_pick', token: T, className: CLS, songKey: 'ode_to_joy', group: 1, studentId: '91016' }).status, 'success');
ov = call({ action: 'lyric_teacher_overview', token: T, className: CLS, songKey: 'ode_to_joy' }); G1 = ov.groups.find(x => x.group === 1);
eq(G1.result.winnerId, '91016'); eq(G1.result.status, 'tie_decided');

// ครูล็อกผล → โหวต/แก้ไม่ได้
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { locked: true } });
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91006' }).code, 'locked');
eq(S('91001', { action: 'studentLyricSave', songKey: 'ode_to_joy', cells: cellsOf(30, 'ก') }).code, 'locked');
ov = call({ action: 'lyric_teacher_overview', token: T, className: CLS, songKey: 'ode_to_joy' }); eq(ov.settings.locked, true); eq(ov.settings.phase, 'closed');
eq(ov.groups.find(x => x.group === 1).result.winnerId, '91016', 'ผลหลังล็อกไม่เปลี่ยน');

// โหวตตัวเองได้เมื่อครูตั้ง (ห้องอื่น/เพลงอื่นไม่กระทบ)
call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'ode_to_joy', patch: { locked: false, phase: 'voting', selfVote: true, selfVoteConfirmed: true } });
eq(S('91001', { action: 'studentLyricVote', songKey: 'ode_to_joy', targetId: '91001' }).status, 'success', 'ครูอนุญาตโหวตตัวเอง');
eq(S('91001', { action: 'studentLyricGet', songKey: 'ode_to_joy' }).settings.selfVoteConfirmed, true);

// ---- Joy to the World: 1 คนต่อ 1 โน้ต (วก.5) ----
let j = S('91001', { action: 'studentLyricGet', songKey: 'joy_to_the_world' }); eq(j.seat, 1); eq(j.canEdit, true);
j = S('91006', { action: 'studentLyricGet', songKey: 'joy_to_the_world' }); eq(j.seat, 2);
r = S('91006', { action: 'studentLyricSave', songKey: 'joy_to_the_world', cells: cellsOf(8, 'วรรค') });
eq(r.cells.filter(Boolean).length, 1, 'เก็บเฉพาะวรรคของตัวเอง'); eq(r.cells[1], 'วรรค1'); eq(r.cells[0], '');
g1.forEach((id, i) => { login(id); S(id, { action: 'studentLyricSave', songKey: 'joy_to_the_world', cells: cellsOf(8, 'ว' + i + '_') }); });
j = S('91001', { action: 'studentLyricGet', songKey: 'joy_to_the_world' });
eq(j.complete, true, '8 คน 8 วรรค ครบ'); eq(j.parts.map(p => p.text), g1.map((id, i) => 'ว' + i + '_' + i)); eq(j.parts.filter(p => p.mine).length, 1);
eq(S('91001', { action: 'studentLyricVote', songKey: 'joy_to_the_world', targetId: '91006' }).code, 'bad_mode', 'โหมด 1 คนต่อ 1 โน้ตไม่มีโหวต');
// คนในกลุ่ม 2 (เลขที่ 2) ไม่เห็นวรรคของกลุ่ม 1
login('91002'); S('91002', { action: 'studentLyricSave', songKey: 'joy_to_the_world', cells: cellsOf(8, 'ลับ2_') });
j = S('91002', { action: 'studentLyricGet', songKey: 'joy_to_the_world' }); ok(!/ว0_|ว3_/.test(JSON.stringify(j)), 'ไม่รั่วข้ามกลุ่ม (Joy)');
// ครูสลับโหมดเป็นโหวตได้ (ตัวเลือกของครู)
eq(call({ action: 'lyric_teacher_set', token: T, className: CLS, songKey: 'joy_to_the_world', patch: { mode: 'draft_vote' } }).settings.mode, 'draft_vote');

// ห้องอื่นแยกกัน: 92001 อยู่ ม.1/2 → การตั้งค่าของ ม.1/1 ไม่กระทบ
eq(S('92001', { action: 'studentLyricGet', songKey: 'ode_to_joy' }).settings.phase, 'writing', 'การตั้งค่าแยกตามห้อง');
eq(S('92001', { action: 'studentLyricGet', songKey: 'ode_to_joy' }).memberCount, 1);

// ---- t88: กติกาที่ครูตัดสินแล้ว + กลุ่มเกิน 8 คน ครูกำหนดวรรค ----
eq(LC.defaultSettings('ode_to_joy').selfVote, false, 'ครูตัดสิน: ห้ามโหวตตัวเอง'); eq(LC.defaultSettings('ode_to_joy').showTally, 'afterClose', 'ครูตัดสิน: แสดงคะแนนหลังปิดโหวต');
eq(LC.defaultSettings('ode_to_joy').selfVoteConfirmed, true, 'ไม่มีสถานะ "รอครูยืนยัน"'); eq(LC.normSettings({ selfVoteConfirmed: false }, 'ode_to_joy').selfVoteConfirmed, true);
eq(LC.defaultSettings('joy_to_the_world').mode, 'one_per_note', 'คาบ 10: 1 คนต่อ 1 โน้ต'); eq(LC.defaultSettings('ode_to_joy').mode, 'draft_vote', 'คาบ 8-9: แต่งแล้วโหวต');
const mem10 = []; for (let i = 0; i < 10; i++) mem10.push({ studentId: 'm' + i, no: i + 1 });
let sm = LC.seatMap(mem10, {}, 8); eq(Object.keys(sm).map(k => sm[k]), [1, 2, 3, 4, 5, 6, 7, 8, 0, 0], 'ไม่กำหนด → ตามลำดับเลขที่ ส่วนเกินไม่มีวรรค');
sm = LC.seatMap(mem10, { m9: 3, m8: 1 }, 8); eq(sm.m9, 3); eq(sm.m8, 1); eq(sm.m0, 2, 'วรรคที่เหลือเติมตามลำดับ'); eq(Object.keys(sm).filter(k => sm[k]).length, 8); eq(new Set(Object.keys(sm).map(k => sm[k]).filter(Boolean)).size, 8, 'ไม่มีวรรคซ้ำ');
sm = LC.seatMap(mem10, { m0: 2, m1: 2, m2: 99 }, 8); eq(sm.m0, 2, 'ซ้ำ → คนแรกตามเลขที่ได้'); ok(sm.m1 !== 2 && sm.m2 !== 99, 'วรรคซ้ำ/เกินช่วงถูกปฏิเสธ');
eq(LC.normSettings({ seats: { a: 3, b: 'x', c: 500 } }, 'joy_to_the_world').seats, { a: 3 }, 'seats ที่ไม่ถูกต้องถูกตัดทิ้ง');
{
  const gas3 = attach(loadGas({ SYNC_TOKEN: T }), { syncToken: T }), c3 = b => gas3.call(b), CL3 = 'ม.1/3', ro = [];
  for (let i = 1; i <= 46; i++) ro.push({ student_id: String(93000 + i), prefix: 'ด.ช.', first_name: 'สมมติ' + i, last_name: 'ทดสอบ', nickname: 'ก' + i, class: CL3, no: i });
  eq(c3({ action: 'upload_roster', token: T, students: ro, replace: true }).status, 'success');
  const tk = {}; const lg = id => (tk[id] = tk[id] || c3({ action: 'studentSetPin', studentId: id, pin: PIN_A }).sessionToken);
  const S3 = (id, o) => c3(Object.assign({ sessionToken: lg(id) }, o));
  const g1ids = []; for (let i = 1; i <= 46; i += 5) g1ids.push(String(93000 + i));    // 10 คนในกลุ่ม 1
  eq(g1ids.length, 10);
  let ov = c3({ action: 'lyric_teacher_overview', token: T, className: CL3, songKey: 'joy_to_the_world' });
  const m1 = ov.groups.find(x => x.group === 1).members; eq(m1.map(m => m.seat), [1, 2, 3, 4, 5, 6, 7, 8, 0, 0], 'ก่อนกำหนด: 2 คนท้ายไม่มีวรรค');
  r = S3(g1ids[9], { action: 'studentLyricSave', songKey: 'joy_to_the_world', cells: ['ก', '', '', '', '', '', '', ''] }); eq(r.code, 'no_seat', 'คนเกินยังไม่ได้วรรค → บันทึกไม่ได้');
  const seats = {}; seats[g1ids[9]] = 3; seats[g1ids[2]] = 0;
  r = c3({ action: 'lyric_teacher_set', token: T, className: CL3, songKey: 'joy_to_the_world', patch: { seats: { [g1ids[9]]: 3 } } }); eq(r.status, 'success'); eq(r.settings.seats[g1ids[9]], 3);
  eq(S3(g1ids[9], { action: 'studentLyricGet', songKey: 'joy_to_the_world' }).seat, 3, 'ครูกำหนดวรรค 3 ให้คนที่ 10');
  r = S3(g1ids[9], { action: 'studentLyricSave', songKey: 'joy_to_the_world', cells: ['', '', 'ข้อความคนที่10', '', '', '', '', ''] }); eq(r.status, 'success');
  ov = c3({ action: 'lyric_teacher_overview', token: T, className: CL3, songKey: 'joy_to_the_world' });
  const gr = ov.groups.find(x => x.group === 1); eq(gr.result.parts[2].text, 'ข้อความคนที่10', 'วรรคที่ 3 เป็นของคนที่ครูกำหนด'); eq(gr.members.filter(m => m.seat).length, 8);
  ok(new Set(gr.members.map(m => m.seat).filter(Boolean)).size === 8, 'ไม่มีวรรคซ้ำ'); eq(gr.members.map(m => m.seat), [1, 2, 4, 5, 6, 7, 8, 0, 0, 3], 'วรรคที่เหลือเติมตามลำดับ คนท้ายที่ไม่ได้วรรคมี 2 คน');
  eq(S3(g1ids[8], { action: 'studentLyricGet', songKey: 'joy_to_the_world' }).canEdit, false);
}

// ไฟล์: โค้ดต้นแบบไม่แตะ students.js / ไม่ใช้ Supabase/R2/Firebase/websocket
['app/js/lyric-core.js', 'tools/prototype/studio_gas_proto.js', 'tools/prototype/attach_studio.js'].forEach(f => {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(!/supabase|firebase|WebSocket|r2\.cloudflare|students\.js/i.test(t.replace(/ห้ามแตะ students\.js/g, '')), f + ' ไม่ใช้บริการภายนอก');
  ok(!/Math\.random/.test(t), f + ' ไม่ใช้ Math.random');
});
console.log('test_lyric_studio: ' + n + ' checks OK');
