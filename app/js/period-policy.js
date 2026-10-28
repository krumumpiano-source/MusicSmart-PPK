// ==========================================================================
// PeriodPolicy — ตัดสินว่า "คาบนี้นักเรียนเห็นอะไร" จากข้อมูล วก.5 (WK5_PLANS) ไม่ใช้รายการคาบฝังในโค้ด
//   kind: 'exam' (สอบกลาง/ปลายภาค) | 'task' (มีชิ้นงาน/งานส่ง) | 'none' (ไม่มีงาน ไม่มีสอบ → ไม่แสดงกล่องส่งงาน/แบบทดสอบ)
// ใช้ได้ทั้งในเบราว์เซอร์และ node (tests) · ES5
// ==========================================================================
(function (root) {
  function flat(o) {
    if (typeof o === 'string') return o;
    if (o instanceof Array) { var a = [], i; for (i = 0; i < o.length; i++) a.push(flat(o[i])); return a.join(' '); }
    if (o && typeof o === 'object') { var s = [], k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) s.push(flat(o[k])); return s.join(' '); }
    return '';
  }
  function plans(gradeKey) {
    var W = root.WK5_PLANS || (typeof WK5_PLANS !== 'undefined' ? WK5_PLANS : null);
    return W && W[gradeKey] ? W[gradeKey] : null;
  }
  function policyTable(gradeKey) {
    var P = root.PERIOD_POLICY || (typeof PERIOD_POLICY !== 'undefined' ? PERIOD_POLICY : null);
    return P && P[gradeKey] ? P[gradeKey] : null;
  }
  var PeriodPolicy = {
    flat: flat,
    /** คืน null ถ้าไม่มีข้อมูล (เช่น ม.2) → UI ใช้พฤติกรรมเดิม */
    get: function (gradeKey, period) {
      var W = plans(gradeKey), T = policyTable(gradeKey), p = W && (W[period] || W[String(period)]);
      if (!W || !T || !p) return null;
      var topic = String(p.topic || '');
      var examKind = /สอบวัดผลกลางภาค/.test(topic) ? 'midterm' : (/สอบวัดผลปลายภาค/.test(topic) ? 'final' : null);
      var max = Number(p.score_total) || 0;
      var res = { period: Number(period), exam: examKind, scored: !examKind && max > 0, maxScore: max, task: null, practiceQuiz: null, kind: 'none', submitKinds: T.submitKinds || ['text', 'link'], fileUpload: !!T.fileUpload };
      var promptP = p.objectives && p.objectives.p && p.objectives.p[0] ? String(p.objectives.p[0]) : '';
      var extra = T.tasks && T.tasks[period];
      if (!examKind && (res.scored || extra)) {
        res.task = { scored: res.scored, maxScore: max, prompt: promptP, source: res.scored ? 'score_total' : (extra && extra.phrase) };
      }
      var pq = T.practiceQuiz && T.practiceQuiz[period];
      if (pq) res.practiceQuiz = { items: pq.items, unit: pq.unit, label: pq.label, source: pq.phrase };
      res.kind = examKind ? 'exam' : (res.task ? 'task' : 'none');
      return res;
    },
    /** เครื่องมือฝึกที่ "คาบนี้" ใช้จริง — คำนวณจาก วก.5 ล้วน ๆ (ไม่ฮาร์ดโค้ดเลขคาบ)
     *  kalimba/notation = คาบที่ วก.5 มีแบบฝึก/บทเพลงคาลิมบ้า (KalimbaMedia.hasKalimba ซึ่งสร้างจาก วก.5)
     *  metronome = คาบที่มีแบบฝึกคาลิมบ้า หรือ วก.5 (ขั้นกิจกรรม/สื่อ/เครื่องมือ) ระบุเมโทรนอมไว้
     *  คืน null ถ้าไม่มีข้อมูล วก.5 (UI ใช้พฤติกรรมเดิม) */
    tools: function (gradeKey, period) {
      var W = plans(gradeKey), p = W && (W[period] || W[String(period)]);
      if (!W || !p) return null;
      var kal = false;
      try { if (typeof KalimbaMedia !== 'undefined' && KalimbaMedia.hasKalimba) kal = !!KalimbaMedia.hasKalimba(gradeKey, Number(period)); } catch (e) {}
      var metro = kal || /เมโทรนอม|metronome/i.test(flat([p.activities, p.media, p.tools, p.topic]));
      return { kalimba: kal, notation: kal, metronome: metro };
    },
    /** ป้ายสถานะคะแนน/ชิ้นงาน ที่ถูกต้องตามชนิดคาบใน วก.5
     *  max = ข้อความข้างหัวข้อ · chip = ป้ายสถานะ (ว่าง = ไม่แสดง) */
    labels: function (gradeKey, period) {
      var pol = this.get(gradeKey, period), W = plans(gradeKey), p = W && (W[period] || W[String(period)]);
      if (!pol || !p) return null;
      var orient = /ปฐมนิเทศ/.test(String(p.topic || ''));
      if (pol.kind === 'exam') return { kind: 'exam', max: (pol.exam === 'midterm' ? 'สอบกลางภาค' : 'สอบปลายภาค') + ' ' + pol.maxScore + ' คะแนน (ทำในระบบสอบเมื่อครูเปิดสอบ)', chip: '' };
      if (pol.kind === 'task' && pol.scored) return { kind: 'scored', max: 'คะแนนเต็ม: ' + pol.maxScore + ' คะแนน', chip: 'submit' };
      if (pol.kind === 'task') {
        // วก.5 ระบุว่าคาบนี้ไม่เก็บคะแนนแต่นำงานที่ส่งไปประเมินรวมในคาบหลัง → แสดงตามที่ วก.5 เขียน (ไม่เดาเลขคาบ)
        var fwd = /ไม่เก็บคะแนน[\s\S]{0,160}?ประเมินรวมในคาบที่\s*(\d+)/.exec(flat(p));
        return { kind: 'unscored-task', max: 'งานมอบหมาย (ไม่เก็บคะแนนในคาบนี้' + (fwd ? ' — ครูนำไปประเมินรวมในคาบที่ ' + fwd[1] : '') + ')', chip: 'submit', evalPeriod: fwd ? Number(fwd[1]) : null };
      }
      return { kind: orient ? 'orientation' : 'none', max: orient ? 'ไม่เก็บคะแนน (ปฐมนิเทศ)' : 'ไม่เก็บคะแนน (ตาม วก.5)', chip: orient ? 'ปฐมนิเทศ (ไม่ต้องส่งชิ้นงาน)' : '' };
    },
    /** ข้อที่ วก.5 เขียนขัดกันเองในคาบเดียว — ให้ "ครูยืนยัน" ไม่เลือกให้เงียบ ๆ (แสดงเฉพาะมุมมองครู)
     *  ตรวจ: ตัวเลขสัดส่วนคะแนนในข้อความกิจกรรม "(4), (3), (3)" เทียบกับน้ำหนักรูบริก K/P/A ที่รวมเท่ากัน */
    conflicts: function (gradeKey, period) {
      var W = plans(gradeKey), p = W && (W[period] || W[String(period)]), out = [];
      if (!p || !p.weights || !(p.score_total > 0)) return out;
      var wv = [Number(p.weights.k) || 0, Number(p.weights.p) || 0, Number(p.weights.a) || 0];
      var items = [].concat((p.activities && p.activities.intro && p.activities.intro.items) || [], (p.activities && p.activities.teach && p.activities.teach.items) || [], (p.activities && p.activities.wrap && p.activities.wrap.items) || []);
      items.forEach(function (t) {
        var m = /รูบริก[^:：]*[:：]\s*(.+)$/.exec(String(t)); if (!m) return;
        var parts = [], re = /([^,()]+?)\s*\((\d+)\)/g, x, sum = 0;
        while ((x = re.exec(m[1]))) { parts.push({ name: x[1].replace(/^[\s,และ]+/, '').trim(), pts: Number(x[2]) }); sum += Number(x[2]); }
        if (parts.length < 2 || sum !== p.score_total) return;
        var a = parts.map(function (q) { return q.pts; }).sort().join(','), b = wv.slice().sort().join(',');
        if (a !== b) out.push({ kind: 'score_split', period: Number(period), activityText: String(t).replace(/^\d+\.\s*/, ''), activityParts: parts, rubricWeights: { k: wv[0], p: wv[1], a: wv[2] }, total: p.score_total });
      });
      return out;
    },
    /** สรุปทุกคาบ (ใช้ในรายงาน/เทสต์) */
    map: function (gradeKey, count) {
      var out = [], i; for (i = 1; i <= (count || 20); i++) out.push(this.get(gradeKey, i));
      return out;
    }
  };
  root.PeriodPolicy = PeriodPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = PeriodPolicy;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
