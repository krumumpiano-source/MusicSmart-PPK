/* period-media.js — ES5 · ตัวเล่น/ตัวบอกสถานะ "สื่อเสียง-วิดีโอรายคาบ" ตาม วก.5 (ไฟล์วางที่ app/media/m1/pNN/)
 * - มีไฟล์ → เล่นได้ (audio/video controls) · มีลิงก์ใน meta.json → ปุ่มเปิดลิงก์ · ไม่มี → ป้าย "ยังไม่มีไฟล์ — รอครู" (ไม่แต่งเสียง/ที่มาเอง)
 * - ข้อมูลมาจาก data/media_manifest.js (สร้างโดย tools/curriculum/build_period_media.js) */
(function (root) {
  'use strict';
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function man() { return root.PERIOD_MEDIA || null; }
  function slotsOf(period) { var m = man(); return (m && m.slots && m.slots[String(period)]) || []; }
  function extrasOf(period) { var m = man(); return (m && m.extras && m.extras[String(period)]) || []; }
  function pad(p) { p = String(p); return p.length < 2 ? '0' + p : p; }
  function pathHint(slot) { var m = man(); return 'app/' + (m ? m.root : 'media/m1') + '/p' + pad(slot.period) + '/' + slot.id + '.' + (slot.kind === 'video' ? 'mp4' : 'mp3'); }
  function creditLine(c) { return '<div style="font-size:12px;color:#546e7a;">ที่มา/สิทธิ์ใช้งาน: ' + (c ? esc(c) : '<i>ครูยังไม่ระบุ</i>') + '</div>'; }

  function playerHTML(slot) {
    var tag = slot.kind === 'video' ? 'video' : 'audio';
    return '<' + tag + ' controls preload="none" ' + (tag === 'video' ? 'playsinline style="max-width:100%;"' : 'style="width:100%;"') + ' data-pm-player="1" src="' + esc(slot.file) + '">เบราว์เซอร์นี้เล่นไฟล์ไม่ได้</' + tag + '>';
  }
  function slotHTML(slot, role) {
    var h = '<div class="pm-slot" style="border:1px solid #cfd8dc;border-radius:8px;padding:8px 10px;margin:6px 0;background:#fff;">';
    h += '<div style="font-weight:700;font-size:14px;">' + (slot.kind === 'video' ? '🎬 ' : '🔊 ') + esc(slot.label) + '</div>';
    if (slot.status === 'file') h += playerHTML(slot) + creditLine(slot.credit);
    else if (slot.status === 'link') h += '<div><a href="' + esc(slot.url) + '" target="_blank" rel="noopener" style="display:inline-block;padding:8px 12px;background:#1565c0;color:#fff;border-radius:6px;text-decoration:none;">▶ เปิดลิงก์ (ต้องมีอินเทอร์เน็ต)</a></div>' + creditLine(slot.credit);
    else if (role === 'teacher') h += '<div style="background:#fff8e1;color:#795548;padding:6px 8px;border-radius:6px;font-size:13px;margin-top:4px;" data-pm-todo="1">☐ ต้องเตรียม (นักเรียนยังไม่เห็นรายการนี้จนกว่าจะมีไฟล์) — วางไฟล์ชื่อ <b>' + esc(slot.id) + '.' + (slot.kind === 'video' ? 'mp4' : 'mp3') + '</b> ใน <code>' + esc(pathHint(slot).replace(/[^/]+$/, '')) + '</code> (หรือใส่ลิงก์ใน meta.json) แล้ว build/deploy' + (slot.exam ? '<br/>ข้อสอบ: ต้องมีตัวเล่นเสียงในระบบสอบด้วย (ตอนนี้ยังไม่ถูกเชื่อม)' : '') + '<br/><span style="font-size:12px;">ตาม ' + esc(slot.docRef) + '</span></div>';
    // นักเรียนไม่เห็นสื่อที่ไม่มีไฟล์จริง (mountHTML ข้ามช่อง missing ให้แล้ว) — ไม่แสดง placeholder ใด ๆ
    return h + '</div>';
  }
  /** html ของสื่อเสียง/วิดีโอในคาบ; '' ถ้าไม่มีช่องและไม่มีไฟล์เพิ่มเติม */
  function mountHTML(gradeKey, period, ctx) {
    var role = (ctx && ctx.role) || 'student', list = slotsOf(period), ex = extrasOf(period), i, h = '', shown = [], have = 0;
    for (i = 0; i < list.length; i++) {
      if (role !== 'teacher' && (list[i].studentVisible === false || list[i].status === 'missing')) continue;
      shown.push(list[i]); if (list[i].status !== 'missing') have++;
    }
    if (!shown.length && !ex.length) return '';
    h += '<div class="pm-box" data-pm="1" style="margin:10px 0;padding:8px 10px;border-left:4px solid #00897b;background:#f1f8f6;border-radius:6px;">';
    h += '<div style="font-weight:700;margin-bottom:4px;">🎧 สื่อเสียง/คลิปประจำคาบ' + (role === 'teacher' ? ' <span style="font-weight:400;font-size:12px;color:#546e7a;">(มี ' + have + ' จาก ' + shown.length + ' ช่องตาม วก.5)</span>' : '') + '</div>';
    for (i = 0; i < shown.length; i++) h += slotHTML(shown[i], role);
    for (i = 0; i < ex.length; i++) h += '<div class="pm-slot" style="border:1px solid #cfd8dc;border-radius:8px;padding:8px 10px;margin:6px 0;background:#fff;"><div style="font-weight:700;font-size:14px;">' + (ex[i].kind === 'video' ? '🎬 ' : '🔊 ') + esc(ex[i].title) + '</div>' + playerHTML(ex[i]) + creditLine(ex[i].credit) + '</div>';
    return h + '</div>';
  }
  /** ผูกพฤติกรรม: เล่นทีละไฟล์, ถ้าไฟล์เล่นไม่ได้ให้ขึ้นข้อความแทนกล่องว่าง */
  function mountAll(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll || rootEl._pmBound) return;
    rootEl._pmBound = true;
    rootEl.addEventListener('play', function (e) {
      var ps = rootEl.querySelectorAll('[data-pm-player]'), i;
      for (i = 0; i < ps.length; i++) if (ps[i] !== e.target && !ps[i].paused) { try { ps[i].pause(); } catch (x) {} }
    }, true);
    rootEl.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-pm-player') && t.parentNode) {
        var d = root.document.createElement('div');
        d.style.cssText = 'background:#ffebee;color:#b71c1c;padding:6px 8px;border-radius:6px;font-size:13px;margin-top:4px;';
        d.appendChild(root.document.createTextNode('เล่นไฟล์นี้ไม่ได้ (ไม่พบไฟล์หรือรูปแบบไม่รองรับ) — แจ้งครู'));
        t.parentNode.replaceChild(d, t);
      }
    }, true);
  }
  /** สรุปรายคาบ (สำหรับหน้าครู/รายงาน) */
  function summary() {
    var m = man(), out = [], p;
    if (!m) return out;
    for (p in m.slots) if (Object.prototype.hasOwnProperty.call(m.slots, p)) {
      var l = m.slots[p], have = 0, i;
      for (i = 0; i < l.length; i++) if (l[i].status !== 'missing') have++;
      out.push({ period: Number(p), total: l.length, have: have, missing: l.length - have });
    }
    out.sort(function (a, b) { return a.period - b.period; });
    return out;
  }
  var API = { mountHTML: mountHTML, mountAll: mountAll, slotsOf: slotsOf, summary: summary, pathHint: pathHint };
  root.PeriodMedia = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
