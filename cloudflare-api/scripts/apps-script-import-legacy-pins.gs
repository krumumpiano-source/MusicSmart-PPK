// ใช้ครั้งเดียวเพื่อย้ายแฮช PIN เดิมจากชีต "นักเรียน_Students_Auth" ไปยัง Cloudflare (D1)
// วิธีใช้: วางไฟล์นี้ในโปรเจกต์ Apps Script ของชีต แล้วรันฟังก์ชัน importLegacyPinsToD1 หนึ่งครั้ง
// ต้องตั้ง Script Property ชื่อ IMPORT_TOKEN ก่อน (ค่าอยู่ในไฟล์ D:\secret\import_token.txt)
// หลังนำเข้าเสร็จ ให้ลบไฟล์นี้และ IMPORT_TOKEN ออกจากโปรเจกต์

var LEGACY_IMPORT_URL = 'https://musicsmart-api.krumum-piano.workers.dev/api/admin/import-legacy-pins';
var LEGACY_IMPORT_SHEET = 'นักเรียน_Students_Auth';
var LEGACY_IMPORT_BATCH = 100;

function importLegacyPinsToD1() {
  var token = PropertiesService.getScriptProperties().getProperty('IMPORT_TOKEN');
  if (!token) throw new Error('ยังไม่ได้ตั้ง IMPORT_TOKEN ใน Script Properties');

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LEGACY_IMPORT_SHEET);
  if (!sh) throw new Error('ไม่พบชีต ' + LEGACY_IMPORT_SHEET);

  var values = sh.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var iSid = header.indexOf('student_id');
  var iSalt = header.indexOf('salt');
  var iHash = header.indexOf('pin_hash');
  if (iSid < 0 || iSalt < 0 || iHash < 0) throw new Error('ไม่พบคอลัมน์ student_id / salt / pin_hash');

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var sid = String(values[r][iSid]).replace(/\s+/g, '');
    var salt = String(values[r][iSalt]).trim();
    var hash = String(values[r][iHash]).trim().toLowerCase();
    if (!sid || !salt || !hash) continue; // ยังไม่มี PIN
    rows.push({ student_id: sid, salt: salt, pin_hash: hash });
  }

  var totals = { updated: 0, skipped: 0, invalid: 0 };
  for (var i = 0; i < rows.length; i += LEGACY_IMPORT_BATCH) {
    var res = UrlFetchApp.fetch(LEGACY_IMPORT_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Import-Token': token },
      payload: JSON.stringify({ rows: rows.slice(i, i + LEGACY_IMPORT_BATCH) }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      throw new Error('นำเข้าไม่สำเร็จ HTTP ' + res.getResponseCode() + ': ' + res.getContentText());
    }
    var j = JSON.parse(res.getContentText());
    totals.updated += j.updated;
    totals.skipped += j.skipped;
    totals.invalid += j.invalid;
  }
  Logger.log('นำเข้าเสร็จ: ' + JSON.stringify(totals) + ' (พบ ' + rows.length + ' แถวที่มี PIN)');
  return totals;
}
