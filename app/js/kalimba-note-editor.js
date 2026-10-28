/* kalimba-note-editor.js — ES5 · หน้าจอครูใส่/แก้โน้ตเพลงและแบบฝึกคาลิมบ้า (พรีวิวบรรทัด 5 เส้น + เล่น + ไฮไลต์)
 * ต้องโหลดหลัง kalimba-media.js และ kalimba-notes.js · ไม่ใช้ flex gap/aspect-ratio (มือถือเก่า)
 * เรียก: KalimbaNoteEditor.open({ gradeKey:'M1', period:8 })   — เฉพาะบทบาทครูเท่านั้น (ผู้เรียกต้องตรวจสิทธิ์) */
(function (root) {
  'use strict';
  var DUR_LABEL = [[4, '4 — ตัวกลม'], [3, '3 — ขาวมีจุด'], [2, '2 — ตัวขาว'], [1.5, '1.5 — ตัวดำมีจุด'], [1, '1 — ตัวดำ'], [0.75, '0.75 — เขบ็ต 1 ชั้นมีจุด'], [0.5, '0.5 — เขบ็ต 1 ชั้น'], [0.25, '0.25 — เขบ็ต 2 ชั้น']];
  var METERS = ['2/4', '3/4', '4/4', '6/8', '2/2'];
  var KIND_LABEL = [['song', 'เพลง'], ['exercise', 'แบบฝึก']];
  var ASC = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6'];
  var seq = 0, state = null;

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function KN() { return root.KalimbaNotes; }
  function tines() { var m = root.KALIMBA_MEDIA; return (m && m.tines && m.tines.length) ? m.tines : KN().DEFAULT_TINES; }

  /** ส่วนที่ทดสอบได้โดยไม่ต้องมี DOM: ตรวจ+บันทึกจากค่าฟอร์ม */
  function draftToItem(d) {
    var sc = KN().parseScore(d.scoreText, { tines: tines() });
    var raw = { id: d.id, period: d.period, grade: d.gradeKey || 'M1', title: d.title, kind: d.kind, meter: d.meter,
      bpm: { start: Number(d.bpm), target: d.target ? Number(d.target) : undefined }, notes: sc.notes, note: d.note, source: d.source };
    var v = KN().validateItem(raw, tines());
    v.parseErrors = sc.errors;
    if (!sc.notes.length) { v.ok = false; v.errors = v.errors.concat(['ต้องมีโน้ตอย่างน้อย 1 ตัวก่อนบันทึก']); }
    if (sc.errors.length) { v.ok = false; v.errors = sc.errors.concat(v.errors); }
    return v;
  }
  function saveDraft(d) {
    var v = draftToItem(d);
    if (!v.ok) return v;
    var r = KN().setItem(v.item, tines());
    r.parseErrors = []; return r;
  }
  function download(name, text, mime) {
    try {
      var blob = new root.Blob([text], { type: mime || 'application/json' });
      if (root.navigator && root.navigator.msSaveBlob) { root.navigator.msSaveBlob(blob, name); return true; }
      var a = root.document.createElement('a');
      a.href = root.URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
      root.document.body.appendChild(a); a.click();
      setTimeout(function () { try { root.URL.revokeObjectURL(a.href); root.document.body.removeChild(a); } catch (e) {} }, 500);
      return true;
    } catch (e) { return false; }
  }

  var styled = false;
  function injectStyle() {
    if (styled || !root.document) return; styled = true;
    var st = root.document.createElement('style');
    st.appendChild(root.document.createTextNode(
      '#kne-ov{position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.55);overflow:auto;-webkit-overflow-scrolling:touch;}' +
      '#kne-box{background:#fff;margin:10px auto;max-width:760px;border-radius:12px;padding:12px 14px 16px;font-size:14px;color:#263238;}' +
      '#kne-box h3{margin:0 0 8px;font-size:17px;}#kne-box label{display:block;margin:8px 0 2px;font-weight:700;font-size:13px;}' +
      '#kne-box input[type=text],#kne-box input[type=number],#kne-box select,#kne-box textarea{width:100%;box-sizing:border-box;padding:7px 8px;font-size:15px;border:1px solid #90a4ae;border-radius:6px;}' +
      '#kne-box textarea{min-height:90px;font-family:monospace;}' +
      '.kne-row{margin:0 -4px;}.kne-col{display:inline-block;vertical-align:top;box-sizing:border-box;padding:0 4px;width:50%;}' +
      '.kne-k{display:inline-block;margin:2px 3px 2px 0;padding:6px 7px;min-width:40px;text-align:center;border:1px solid #78909c;border-radius:6px;background:#eceff1;font-size:13px;cursor:pointer;}' +
      '.kne-b{display:inline-block;margin:6px 6px 0 0;padding:9px 14px;border:0;border-radius:8px;background:#1565c0;color:#fff;font-size:14px;cursor:pointer;}' +
      '.kne-b.kne-g{background:#546e7a;}.kne-b.kne-r{background:#c62828;}.kne-b.kne-ok{background:#2e7d32;}' +
      '.kne-msg{margin:6px 0;padding:6px 8px;border-radius:6px;font-size:13px;}.kne-err{background:#ffebee;color:#b71c1c;}.kne-warn{background:#fff8e1;color:#795548;}.kne-good{background:#e8f5e9;color:#1b5e20;}' +
      '.kne-info{font-size:12px;color:#546e7a;margin:4px 0;}'));
    root.document.getElementsByTagName('head')[0].appendChild(st);
  }

  function itemsOf(gradeKey, period) { return root.KalimbaMedia ? root.KalimbaMedia.getItems(gradeKey, period) : []; }

  function options(arr, sel) { var o = '', i; for (i = 0; i < arr.length; i++) o += '<option value="' + esc(arr[i][0]) + '"' + (String(arr[i][0]) === String(sel) ? ' selected' : '') + '>' + esc(arr[i][1]) + '</option>'; return o; }

  function open(opts) {
    if (!root.document || !KN()) return null;
    injectStyle(); close();
    opts = opts || {};
    state = { gradeKey: opts.gradeKey || 'M1', period: Number(opts.period) || 8, itemId: opts.itemId || null, widget: null, timer: null, defD: 1 };
    var ov = root.document.createElement('div'); ov.id = 'kne-ov'; state.ov = ov;
    root.document.body.appendChild(ov);
    ov.onclick = onClick; ov.onchange = onChange; ov.oninput = onInput;
    draw(); return state;
  }
  function close() {
    if (state && state.widget) { try { state.widget.destroy(); } catch (e) {} }
    var o = root.document && root.document.getElementById('kne-ov');
    if (o && o.parentNode) o.parentNode.removeChild(o);
    state = null;
  }
  function currentItem() {
    var items = itemsOf(state.gradeKey, state.period), i;
    for (i = 0; i < items.length; i++) if (items[i].id === state.itemId) return items[i];
    return null;
  }
  function draw() {
    var s = state, items = itemsOf(s.gradeKey, s.period), cur = currentItem(), i, h = '', sel = '';
    if (!cur && s.itemId !== '__new__' && items.length) { cur = items[0]; s.itemId = cur.id; }
    if (!cur) s.itemId = '__new__';
    sel += '<option value="__new__"' + (s.itemId === '__new__' ? ' selected' : '') + '>➕ เพิ่มรายการใหม่ในคาบนี้</option>';
    for (i = 0; i < items.length; i++) sel += '<option value="' + esc(items[i].id) + '"' + (items[i].id === s.itemId ? ' selected' : '') + '>' + esc(items[i].title) + (items[i].status === 'missing' ? ' — (ยังไม่มีโน้ต)' : '') + (items[i].teacherNotes ? ' ✓ครูใส่' : '') + '</option>';
    var isNew = s.itemId === '__new__';
    var id = isNew ? ('t_p' + s.period + '_' + (new Date().getTime().toString(36))) : cur.id;
    var title = isNew ? '' : cur.title, kind = isNew ? 'song' : (cur.kind === 'exercise' ? 'exercise' : 'song');
    var meter = isNew ? '4/4' : (cur.meter || '4/4'), bpm = isNew ? 60 : ((cur.bpm && cur.bpm.start) || 60), target = (!isNew && cur.bpm && cur.bpm.target) || '';
    var score = isNew ? '' : KN().toScore(cur.notes || []);
    var note = '';
    var local = !isNew && KN().get(cur.id);
    if (local && local.note) note = local.note;
    s.defD = 1;
    h += '<div id="kne-box"><h3>✏️ ใส่/แก้โน้ต — คาบ ' + s.period + '</h3>';
    h += '<div class="kne-info">โน้ตที่บันทึกที่นี่เก็บบนเครื่องนี้ (และอยู่ในไฟล์สำรอง/ซิงก์ข้อมูลครู) · <b>นักเรียนจะเห็นเมื่อ "ส่งออก JSON" ไปวางที่ tools/curriculum/kalimba_notes_teacher.json แล้ว build + deploy</b> · ระบบไม่เดาโน้ตให้</div>';
    h += '<label>รายการ</label><select data-kne="item">' + sel + '</select>';
    if (!isNew && cur && cur.unverified) h += '<div class="kne-msg kne-warn">โน้ตชุดนี้มาจากไลบรารีเดิมของแอป ยังไม่ได้รับการยืนยันจากครู — ตรวจแล้วกด "บันทึก" เพื่อยืนยัน หรือแก้ไขก่อนบันทึก</div>';
    if (!isNew && cur && cur.status === 'missing') h += '<div class="kne-msg kne-warn">' + esc(cur.missing || KN().EMPTY_MSG) + '</div>';
    h += '<div class="kne-row"><div class="kne-col"><label>ชื่อรายการ</label><input type="text" data-kne="title" value="' + esc(title) + '"/></div>' +
      '<div class="kne-col"><label>ประเภท</label><select data-kne="kind">' + options(KIND_LABEL, kind) + '</select></div></div>';
    h += '<div class="kne-row"><div class="kne-col"><label>อัตราจังหวะ</label><select data-kne="meter">' + options((function () { var a = [], j, f = false; for (j = 0; j < METERS.length; j++) { a.push([METERS[j], METERS[j]]); if (METERS[j] === meter) f = true; } if (!f) a.push([meter, meter]); return a; })(), meter) + '</select></div>' +
      '<div class="kne-col"><label>BPM เริ่มต้น (30–200)</label><input type="number" data-kne="bpm" min="30" max="200" value="' + esc(bpm) + '"/></div></div>';
    h += '<div class="kne-row"><div class="kne-col"><label>BPM เป้าหมาย (ไม่บังคับ)</label><input type="number" data-kne="target" min="30" max="200" value="' + esc(target) + '"/></div>' +
      '<div class="kne-col"><label>หมายเหตุครู (ไม่บังคับ)</label><input type="text" data-kne="note" value="' + esc(note) + '"/></div></div>';
    h += '<label>โน้ต (พิมพ์ หรือกดปุ่มลิ่มด้านล่าง)</label><textarea data-kne="score" placeholder="ตัวอย่าง: ด ร ม:2 พัก ซ+ม:1.5 | ดํ:0.5">' + esc(score) + '</textarea>';
    h += '<div class="kne-info">เขียน <b>ด ร ม ฟ ซ ล ท</b> (ใส่ ํ ต่ออ็อกเทฟ เช่น ดํ) หรือ C4 D4 …; <b>:ตัวเลข</b> = ความยาวเป็นจังหวะ (ค่าเริ่มต้น 1); <b>พัก</b> = ตัวพัก; <b>ซ+ม</b> = ดีดพร้อมกัน; <b>|</b> ขีดห้อง (ไม่มีผล)</div>';
    h += '<label>ความยาวที่ใช้เมื่อกดปุ่ม</label><select data-kne="dur">' + options(DUR_LABEL, 1) + '</select>';
    h += '<div style="margin-top:6px;">';
    for (i = 0; i < ASC.length; i++) {
      var tn = KN().thaiOf(ASC[i]); h += '<span class="kne-k" role="button" tabindex="0" data-kne-key="' + ASC[i] + '">' + esc(tn) + '<br/><small>' + ASC[i] + '</small></span>';
    }
    h += '<span class="kne-k" role="button" tabindex="0" data-kne-key="พัก">พัก</span><span class="kne-k" role="button" tabindex="0" data-kne-act="undo">⌫ ลบตัวท้าย</span><span class="kne-k" role="button" tabindex="0" data-kne-act="clear">ล้างทั้งหมด</span></div>';
    h += '<div data-kne-role="msgs"></div>';
    h += '<label>พรีวิว (เล่น/หยุด/ปรับ BPM ได้)</label><div data-kne-role="preview"></div>';
    h += '<div><button type="button" class="kne-b kne-ok" data-kne-act="save">💾 บันทึกโน้ตนี้</button>' +
      '<button type="button" class="kne-b kne-r" data-kne-act="revert">↩ ลบการแก้ของครู (กลับค่าเดิม)</button>' +
      '<button type="button" class="kne-b kne-g" data-kne-act="export">⬇ ส่งออก JSON</button>' +
      '<button type="button" class="kne-b kne-g" data-kne-act="import">⬆ นำเข้า JSON</button>' +
      '<button type="button" class="kne-b kne-g" data-kne-act="close">ปิด</button></div>';
    h += '<div data-kne-role="io"></div><input type="hidden" data-kne="id" value="' + esc(id) + '"/></div>';
    s.ov.innerHTML = h;
    refresh();
  }
  function val(name) { var e = state.ov.querySelector('[data-kne="' + name + '"]'); return e ? e.value : ''; }
  function draft() {
    return { id: val('id'), period: state.period, gradeKey: state.gradeKey, title: val('title'), kind: val('kind'), meter: val('meter'), bpm: val('bpm'), target: val('target'), note: val('note'), scoreText: val('score') };
  }
  function msg(cls, txt) { return '<div class="kne-msg ' + cls + '">' + txt + '</div>'; }
  function refresh() {
    if (!state) return;
    var d = draft(), v = draftToItem(d), box = state.ov.querySelector('[data-kne-role="msgs"]'), h = '', i, notes = v.item.notes || [], beats = 0, bpb;
    for (i = 0; i < notes.length; i++) beats += notes[i].d;
    bpb = KN().beatsPerBar(d.meter);
    for (i = 0; i < v.errors.length; i++) h += msg('kne-err', '✗ ' + esc(v.errors[i]));
    for (i = 0; i < v.warnings.length; i++) h += msg('kne-warn', '! ' + esc(v.warnings[i]));
    h += msg(v.ok ? 'kne-good' : 'kne-warn', 'โน้ต ' + notes.length + ' ตัว · รวม ' + beats + ' จังหวะ · ≈ ' + (Math.round(beats / bpb * 100) / 100) + ' ห้อง (' + esc(d.meter) + ')');
    box.innerHTML = h;
    var host = state.ov.querySelector('[data-kne-role="preview"]');
    if (state.widget) { try { state.widget.destroy(); } catch (e) {} state.widget = null; }
    if (root.KalimbaMedia && notes.length && !v.parseErrors.length) {
      var it = { id: v.item.id || 'preview', title: v.item.title || '(พรีวิว)', kind: v.item.kind, meter: v.item.meter, notes: notes, bpm: { start: v.item.bpm.start, min: 30, max: 200 }, status: 'ok' };
      state.widget = new root.KalimbaMedia.Widget(host, it, { role: 'teacher' });
    } else host.innerHTML = '<div class="kne-info">พรีวิวจะแสดงเมื่อมีโน้ตที่ถูกต้องอย่างน้อย 1 ตัว</div>';
  }
  function onInput(e) { e = e || root.event; var t = e.target || e.srcElement; if (!state || !t || !t.getAttribute || !t.getAttribute('data-kne')) return; if (t.getAttribute('data-kne') === 'item' || t.getAttribute('data-kne') === 'dur') return; clearTimeout(state.timer); state.timer = setTimeout(refresh, 350); }
  function onChange(e) {
    e = e || root.event; var t = e.target || e.srcElement; if (!state || !t || !t.getAttribute) return;
    var k = t.getAttribute('data-kne');
    if (k === 'item') { state.itemId = t.value; draw(); }
    else if (k === 'dur') { state.defD = Number(t.value) || 1; }
    else if (k) refresh();
  }
  function append(tok) {
    var ta = state.ov.querySelector('[data-kne="score"]'), d = Number(val('dur')) || 1, cur = ta.value.replace(/\s+$/, '');
    ta.value = (cur ? cur + ' ' : '') + tok + (d !== 1 ? ':' + d : ''); refresh();
  }
  function onClick(e) {
    e = e || root.event; var t = e.target || e.srcElement;
    while (t && t !== state.ov && !(t.getAttribute && (t.getAttribute('data-kne-key') || t.getAttribute('data-kne-act')))) t = t.parentNode;
    if (!t || t === state.ov) return;
    var key = t.getAttribute('data-kne-key'), act = t.getAttribute('data-kne-act');
    if (key) { append(key === 'พัก' ? 'พัก' : KN().thaiOf(key)); return; }
    var ta = state.ov.querySelector('[data-kne="score"]');
    if (act === 'close') close();
    else if (act === 'clear') { ta.value = ''; refresh(); }
    else if (act === 'undo') { ta.value = ta.value.replace(/\s+$/, '').replace(/\s*\S+$/, ''); refresh(); }
    else if (act === 'save') {
      var r = saveDraft(draft()), box = state.ov.querySelector('[data-kne-role="io"]');
      if (r.ok) { state.itemId = r.item.id; box.innerHTML = msg('kne-good', '✓ บันทึกแล้ว — รายการนี้ใช้โน้ตของครู (กด "ส่งออก JSON" เพื่อสำรอง/เผยแพร่ให้นักเรียน)'); fireChanged(); refresh(); }
      else box.innerHTML = msg('kne-err', 'บันทึกไม่ได้: ' + esc(r.errors.join(' / ')));
    }
    else if (act === 'revert') {
      var id = val('id'), box2 = state.ov.querySelector('[data-kne-role="io"]');
      if (KN().removeItem(id)) { box2.innerHTML = msg('kne-good', 'ลบการแก้ของครูแล้ว — กลับไปใช้ค่าเดิมของระบบ'); fireChanged(); draw(); }
      else box2.innerHTML = msg('kne-warn', 'รายการนี้ยังไม่เคยมีการแก้ไขของครู');
    }
    else if (act === 'export') {
      var txt = KN().exportJSON(), io = state.ov.querySelector('[data-kne-role="io"]');
      var name = 'kalimba_notes_teacher_' + new Date().toISOString().slice(0, 10) + '.json';
      var ok = download(name, txt);
      io.innerHTML = msg(ok ? 'kne-good' : 'kne-warn', (ok ? 'ดาวน์โหลดแล้ว: ' + esc(name) + ' · ' : '') + 'ถ้าไม่ดาวน์โหลด ให้คัดลอกข้อความด้านล่าง') + '<textarea readonly style="min-height:120px;">' + esc(txt) + '</textarea>';
    }
    else if (act === 'import') {
      var io2 = state.ov.querySelector('[data-kne-role="io"]');
      io2.innerHTML = '<label>เลือกไฟล์ JSON ที่ส่งออกไว้ หรือวางข้อความ</label><input type="file" accept=".json,application/json" data-kne-file="1"/>' +
        '<textarea data-kne="paste" placeholder="วาง JSON ที่นี่"></textarea><button type="button" class="kne-b" data-kne-act="doimport">นำเข้า</button>';
      var fi = io2.querySelector('[data-kne-file]');
      fi.onchange = function () {
        var f = fi.files && fi.files[0]; if (!f || !root.FileReader) return;
        var rd = new root.FileReader(); rd.onload = function () { io2.querySelector('[data-kne="paste"]').value = String(rd.result || ''); }; rd.readAsText(f);
      };
    }
    else if (act === 'doimport') {
      var p = state.ov.querySelector('[data-kne="paste"]'), io3 = state.ov.querySelector('[data-kne-role="io"]');
      var res = KN().importJSON(p ? p.value : '', tines()), h = '';
      if (res.error) h = msg('kne-err', esc(res.error));
      else {
        h = msg('kne-good', 'นำเข้าแล้ว: เพิ่ม ' + res.added + ' · อัปเดต ' + res.updated + ' · ข้าม ' + res.rejected.length);
        for (var i = 0; i < res.rejected.length; i++) h += msg('kne-err', esc(res.rejected[i].id) + ': ' + esc(res.rejected[i].errors.join(' / ')));
        fireChanged();
      }
      io3.innerHTML = h;
    }
  }
  function fireChanged() { try { if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('ppk-kalimba-notes-changed')); } catch (e) {} }

  var API = { open: open, close: close, draftToItem: draftToItem, saveDraft: saveDraft, ASC: ASC };
  root.KalimbaNoteEditor = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
