// ต่อ studio_gas_proto เข้ากับ Apps Script จำลอง (tests/fake_gas.js) — ใช้ใน tools/local_server.js และเทสต์
// หมายเหตุ: ตอน deploy จริงไม่ใช้ไฟล์นี้ — ต่อ action ใน doPost ของ google_apps_script.js แทน (ดูรายงาน)
const { createStudioProto } = require('./studio_gas_proto.js');

// โครงเพลงที่เซิร์ฟเวอร์ต้องรู้ (จำนวนช่อง/ความยาวสูงสุด) — เทสต์ตรวจว่าตรงกับโน้ตจริงใน KALIMBA_MEDIA
const SONGS = { ode_to_joy: { cellCount: 30, maxLen: 12 }, joy_to_the_world: { cellCount: 8, maxLen: 40 } };

function attach(gas, opts) {
  const ctx = gas.ctx, ss = ctx.SpreadsheetApp.getActiveSpreadsheet();
  let clock = null;
  const proto = createStudioProto({
    getSheet: (name, headers) => ctx.getOrCreateSheet(ss, name, headers),
    verify: token => ctx.verifySessionToken_(ss, token),
    isTeacherToken: t => !!t && t === opts.syncToken,
    roster: className => {
      const v = ctx.getStudentSheet_(ss).getDataRange().getValues(), H = ctx.STUDENT_AUTH_HEADERS, out = [];
      for (let r = 1; r < v.length; r++) { const o = {}; H.forEach((h, c) => { o[h] = v[r][c]; }); if (String(o['class']) === className) out.push(o); }
      return out;
    },
    now: () => (clock !== null ? clock : Date.now()),
    songs: SONGS
  });
  const orig = gas.callRaw;
  gas.callRaw = text => {
    let p = null; try { p = JSON.parse(text); } catch (e) { /* ปล่อยให้ GAS จริงตอบ */ }
    if (p && proto.handles(p.action)) return proto.handle(p);
    return orig(text);
  };
  gas.call = body => gas.callRaw(JSON.stringify(body));
  gas.studio = proto;
  gas.studioSetNow = ms => { clock = ms === null ? null : Number(ms); };
  return gas;
}
module.exports = { attach, SONGS };
