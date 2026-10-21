/**
 * ============================================================================
 * MusicSmart PPK - Google Apps Script Backend (Serverless Dual-Save Engine)
 * ระบบคลาวด์รับข้อมูลการสอน บันทึกหลังสอน (วก.5) งานนักเรียน และคะแนนอัตโนมัติ
 * โรงเรียนพะเยาพิทยาคม • กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)
 * ============================================================================
 * 
 * วิธีการติดตั้ง (ครั้งเดียว 1 นาที):
 * 1. เปิด Google Sheet เปล่าขึ้นมา 1 ไฟล์ ตั้งชื่อว่า "MusicSmart_Data_PPK"
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) -> "Apps Script"
 * 3. ลบโค้ดเดิมทั้งหมดในนั้น แล้ววางโค้ดไฟล์นี้ลงไปทั้งหมด
 * 4. กดปุ่มบันทึก (ไอคอนแผ่นดิสก์ 💾)
 * 5. กดปุ่มสีน้ำเงินด้านขวาบน "ทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้ใหม่" (New deployment)
 *    - เลือกประเภท: "เว็บแอป" (Web app)
 *    - คำอธิบาย: "MusicSmart Sync v1"
 *    - ดำเนินการในฐานะ: "ฉัน" (Me)
 *    - ผู้มีสิทธิ์เข้าถึง: "ทุกคน" (Anyone) **สำคัญมาก ต้องเลือก Anyone**
 * 6. กด "ทำให้ใช้งานได้" (Deploy) และให้สิทธิ์อนุญาตเข้าถึง Google Sheet
 * 7. คัดลอก "URL เว็บแอป" (ขึ้นต้นด้วย https://script.google.com/macros/s/.../exec)
 *    นำไปวางในหน้าต่าง "ซิงค์คู่ Google Sheets" ของระบบ MusicSmart
 * 8. ความปลอดภัย (จำเป็น): ไปที่ ⚙️ การตั้งค่าโปรเจกต์ (Project Settings) -> คุณสมบัติของสคริปต์
 *    (Script Properties) -> เพิ่ม SYNC_TOKEN = ข้อความสุ่มยาว ๆ (เช่น 32 ตัวอักษรขึ้นไป)
 *    แล้วนำค่าเดียวกันไปใส่ช่อง "รหัสซิงค์ (Sync Token)" ในหน้าต่างซิงค์ของ MusicSmart
 *    คำขอที่ไม่มี token ถูกต้องจะถูกปฏิเสธ (unauthorized) ทุกครั้ง
 *    หลังแก้โค้ดทุกครั้ง: Deploy -> Manage deployments -> แก้ไข -> Version: New version
 * 9. ระบบเข้าสู่ระบบนักเรียน: ครูกดปุ่ม "อัปโหลดรายชื่อขึ้น Google Sheet" (จัดการผู้ใช้ > นักเรียน)
 *    1 ครั้งต่อภาคเรียน ระบบจะสร้างชีต "นักเรียน_Students_Auth" เก็บรายชื่อและ PIN แบบแฮช (SHA-256 + salt)
 *    นักเรียนใช้ action studentLookup / studentSetPin / studentLogin ได้โดยไม่ต้องมี token
 *    แต่จะได้ข้อมูลเฉพาะของตัวเองเท่านั้น (รหัส ชื่อ ห้อง) ไม่มีทางดึงรายชื่อทั้งหมดได้
 * ============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // รอ Lock สูงสุด 20 วินาทีเพื่อป้องกันการเขียนข้อมูลชนกันพร้อมกัน
  lock.tryLock(20000);
  try {
    var rawText = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawText);

    // 0a. ระบบเข้าสู่ระบบของนักเรียน (ไม่ใช้ SYNC_TOKEN แต่เปิดเผยเฉพาะข้อมูลของนักเรียนคนนั้น)
    if (payload && STUDENT_PUBLIC_ACTIONS.indexOf(payload.action) !== -1) {
      return jsonOut(handleStudentPublicAction(SpreadsheetApp.getActiveSpreadsheet(), payload));
    }

    // 0. ตรวจสอบรหัสซิงค์ (SYNC_TOKEN ใน Script Properties)
    var expectedToken = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (!expectedToken || !payload || payload.token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: expectedToken ? 'unauthorized' : 'unauthorized: SYNC_TOKEN not configured in Script Properties'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var action = payload.action || 'sync';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ตรวจสอบการเชื่อมต่อ (Ping Test)
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'เชื่อมต่อ Google Sheet สำเร็จ: ' + ss.getName(),
        serverTime: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1b. ครูอัปโหลดรายชื่อนักเรียน / รีเซ็ต PIN / ดูสถานะ PIN (ต้องมี token)
    if (action === 'upload_roster') return jsonOut(uploadStudentRoster(ss, payload.students || [], !!payload.replace));
    if (action === 'reset_student_pin') return jsonOut(resetStudentPinServer(ss, payload.studentId));
    if (action === 'student_pin_status') return jsonOut(studentPinStatus(ss));

    // 2. การซิงค์แบบเป็นกลุ่ม (Batch Sync จาก Outbox)
    if (action === 'batch_sync') {
      var items = payload.items || [];
      var processedCount = 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it && it.type) {
          processSyncItem(ss, it);
          processedCount++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        processed: processedCount,
        syncedAt: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. การซิงค์รายการเดี่ยวแบบทันที (Realtime Single Sync)
    var result = processSyncItem(ss, payload);
    return ContentService.createTextOutput(JSON.stringify({
      status: (result && result.success) ? 'success' : 'error',
      type: payload.type,
      syncedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    appName: 'MusicSmart Google Sheets Sync Service',
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ประมวลผลและแยกข้อมูลลง Sheet แต่ละประเภทอัตโนมัติ
 */
function processSyncItem(ss, item) {
  var type = item.type;
  var data = item.data || {};
  var now = new Date();
  var timestamp = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");

  // --------------------------------------------------------------------------
  // A. บันทึกหลังสอน วก.5 (Session Logs)
  // --------------------------------------------------------------------------
  if (type === 'session_log') {
    var sheet = getOrCreateSheet(ss, "วก5_บันทึกหลังสอน", [
      "วันเวลาที่บันทึก", "ห้องเรียน", "คาบที่", "ผู้สอน", "บทบาท",
      "นร.มา", "นร.ขาด", "นร.ลา", "สรุปผลการจัดกิจกรรม (Outcomes)",
      "ปัญหาและอุปสรรค (Problems)", "แนวทางแก้ไข (Solutions)", "ส่งต่อคาบถัดไป (Handover)", "รหัสอ้างอิง"
    ]);

    var attSummary = data.attendanceSummary || {};
    var refl = data.reflection || {};
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.period || "",
      data.instructorName || (data.instructor ? data.instructor.name : ""),
      data.instructorRole || (data.instructor ? data.instructor.role : ""),
      attSummary.present !== undefined ? attSummary.present : (data.presentCount || ""),
      attSummary.absent !== undefined ? attSummary.absent : (data.absentCount || ""),
      attSummary.leave !== undefined ? attSummary.leave : (data.leaveCount || ""),
      refl.outcomes || refl.learningOutcome || data.teachingSummary || "",
      refl.problems || data.problemIssues || "",
      refl.solutions || refl.suggestions || data.solutions || "",
      data.handoverNote || "",
      (data.className || "") + "_P" + (data.period || "")
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // B. งานนักเรียน / การวิจารณ์ดนตรี Feldman (Submissions & File/Video Uploads)
  // --------------------------------------------------------------------------
  if (type === 'submission') {
    var fileUrl = data.url || "";

    // หากมีการแนบไฟล์หรือคลิป (Base64) ให้อัปโหลดลง Google Drive ของครูอัตโนมัติ
    if (data.fileBase64 && data.fileName) {
      try {
        var folderName = "MusicSmart_Student_Uploads";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

        var base64Content = data.fileBase64.indexOf(',') > -1 
          ? data.fileBase64.split(',')[1] 
          : data.fileBase64;
        var decoded = Utilities.base64Decode(base64Content);
        var safeFileName = "[" + (data.className || "PPK") + "_" + (data.studentId || "std") + "] " + data.fileName;
        var blob = Utilities.newBlob(decoded, data.mimeType || "application/octet-stream", safeFileName);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var driveLink = file.getUrl();
        fileUrl = fileUrl ? (fileUrl + " | " + driveLink) : driveLink;
      } catch (fErr) {
        fileUrl = fileUrl ? (fileUrl + " (Drive: " + fErr.toString() + ")") : ("Drive: " + fErr.toString());
      }
    }

    var sheet = getOrCreateSheet(ss, "งานนักเรียน_Submissions", [
      "วันเวลาที่ส่ง", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ประเภทงาน", "หัวข้องาน/เพลง", "เนื้อหาการส่งงาน (4 ขั้น Feldman)", "ลิงก์ไฟล์แนบ/คลิป (Google Drive/URL)", "คะแนน", "ข้อเสนอแนะครู"
    ]);
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.period || "",
      data.studentId || "",
      data.studentName || "",
      data.submissionType || "งานนักเรียน",
      data.songTitle || data.title || "",
      data.content || "",
      fileUrl,
      data.score !== undefined ? data.score : "",
      data.feedback || data.teacherFeedback || ""
    ]);
    return { type: type, success: true, fileUrl: fileUrl };
  }

  // --------------------------------------------------------------------------
  // C. คะแนนแบบทดสอบท้ายหน่วย (Quiz Results)
  // --------------------------------------------------------------------------
  if (type === 'quiz_result') {
    var sheet = getOrCreateSheet(ss, "คะแนนแบบทดสอบ_Quiz", [
      "วันเวลาที่ทำแบบทดสอบ", "หน่วยที่", "ชื่อหน่วยการเรียนรู้", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ห้องเรียน", "เลขที่", "คะแนนที่ได้", "คะแนนเต็ม", "ร้อยละ (%)", "เวลาที่ใช้ (วินาที)"
    ]);
    sheet.appendRow([
      timestamp,
      data.unitNo || "",
      data.unitTitle || "",
      data.studentId || "",
      data.studentName || "",
      data.studentClass || "",
      data.studentNo || "",
      data.score !== undefined ? data.score : "",
      data.totalQuestions || 20,
      data.percentage !== undefined ? data.percentage + "%" : "",
      data.timeSpentSeconds || 0
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // D. ประเมินรูบริกปฏิบัติคาลิมบ้า 4 ด้าน (Rubrics)
  // --------------------------------------------------------------------------
  if (type === 'rubric') {
    var sheet = getOrCreateSheet(ss, "คะแนนรูบริก_Rubrics", [
      "วันเวลาที่ประเมิน", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "ชื่อ-สกุล",
      "1. ท่าทางวิธีจับ (เต็ม 4)", "2. จังหวะ (เต็ม 4)", "3. คุณภาพเสียง (เต็ม 4)", "4. เทคนิคปฏิบัติ (เต็ม 4)",
      "คะแนนรวมดิบ (เต็ม 16)", "คะแนนแปลงมาตรฐาน (เต็ม 5)"
    ]);
    var b = data.breakdown || {};
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.period || "",
      data.studentId || "",
      data.studentName || "",
      b.posture !== undefined ? b.posture : "",
      b.rhythm !== undefined ? b.rhythm : "",
      b.tone !== undefined ? b.tone : "",
      b.technique !== undefined ? b.technique : "",
      data.sum !== undefined ? data.sum : "",
      data.scaledScore !== undefined ? data.scaledScore : ""
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // E. การเช็คชื่อเข้าเรียน (Attendance)
  // --------------------------------------------------------------------------
  if (type === 'attendance') {
    var sheet = getOrCreateSheet(ss, "การเช็คชื่อ_Attendance", [
      "วันเวลา", "ห้องเรียน", "คาบที่", "รหัสนักเรียน", "เลขที่", "ชื่อ-สกุล", "สถานะเข้าเรียน"
    ]);
    var records = data.records || [];
    var rows = [];
    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      rows.push([
        timestamp,
        data.className || "",
        data.period || "",
        r.studentId || "",
        r.no || "",
        r.name || "",
        r.status || "มา"
      ]);
    }
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return { type: type, success: true, count: rows.length };
  }

  // --------------------------------------------------------------------------
  // F. การมอบหมายคาบสอน & คำแนะนำนิเทศ นศ.ฝึกสอน (Schedule Assignment & Mentoring)
  // --------------------------------------------------------------------------
  if (type === 'assignment') {
    var sheet = getOrCreateSheet(ss, "ตารางสอน_นิเทศฝึกสอน", [
      "วันเวลาที่บันทึก", "วันในสัปดาห์", "คาบที่", "ห้องเรียน", "ผู้สอนที่รับมอบหมาย",
      "รูปแบบการสอน", "ครูพี่เลี้ยง", "คำแนะนำจากครูพี่เลี้ยง (Pedagogical Advice)",
      "วิธีการสอนแนะนำ (T-PACE Process)", "จุดสังเกตการนิเทศ", "บันทึกสะท้อนผล นศ.ฝึกสอน"
    ]);
    sheet.appendRow([
      timestamp,
      data.day || "",
      data.periodNo || "",
      data.className || "",
      data.teacherName || "",
      data.assignRole || "",
      data.mentorName || "",
      data.mentorAdvice || "",
      data.teachingMethod || "",
      data.focusPoints || "",
      data.traineeFeedback || ""
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // G. คะแนนวิจัยชั้นเรียน CAR (Pre-test / Post-test / Formative)
  // --------------------------------------------------------------------------
  if (type === 'research_car') {
    var sheet = getOrCreateSheet(ss, "วิจัยCAR_PrePost", [
      "วันเวลา", "ห้องเรียน", "รหัสนักเรียน", "ชื่อ-สกุล",
      "ก่อนเรียน (Pre-Test)", "หลังเรียน (Post-Test)", "ระหว่างทาง (Formative)", "ผลพัฒนา (Gain)"
    ]);
    sheet.appendRow([
      timestamp,
      data.className || "",
      data.studentId || "",
      data.studentName || "",
      data.pre !== undefined ? data.pre : "",
      data.post !== undefined ? data.post : "",
      data.formative !== undefined ? data.formative : "",
      data.gain !== undefined ? data.gain : ""
    ]);
    return { type: type, success: true };
  }

  // --------------------------------------------------------------------------
  // H. แผนการสอนและหลักสูตรที่ครูปรับแต่ง (Customized Curriculum & Lesson Plans)
  // --------------------------------------------------------------------------
  if (type === 'curriculum_lesson') {
    var sheet = getOrCreateSheet(ss, "แผนการสอน_Curriculum", [
      "วันเวลาที่แก้ไข", "ระดับชั้น", "คาบที่", "ชื่อหน่วยการเรียนรู้", "หัวข้อบทเรียน",
      "จุดประสงค์ KPA", "เวลาสอน (นาที)", "ขั้นตอน 5 ขั้น T-PACE", "จำนวนสื่อการสอน", "ผู้แก้ไข/ครูผู้สอน"
    ]);
    sheet.appendRow([
      timestamp,
      data.grade || "",
      data.period || "",
      data.unitName || data.unit_name || "",
      data.topic || "",
      data.kpaSummary || "",
      data.durationMin || data.duration_min || 50,
      data.stepsSummary || "",
      data.mediaCount !== undefined ? data.mediaCount : "",
      data.updatedBy || ""
    ]);
    return { type: type, success: true };
  }

  return { type: type, success: false, reason: "unknown_type" };
}

/**
 * ผู้ช่วยค้นหาหรือสร้าง Sheet ใหม่พร้อมจัดรูปแบบส่วนหัวอัตโนมัติ
 */
function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a"); // Dark slate navy
      headerRange.setFontColor("#f8fafc");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      for (var col = 1; col <= headers.length; col++) {
        sheet.setColumnWidth(col, 160);
      }
    }
  }
  return sheet;
}

/* ============================================================================
 * ระบบเข้าสู่ระบบนักเรียน (Student Auth) — รหัสนักเรียน + PIN 6 หลัก
 * ============================================================================ */
var STUDENT_PUBLIC_ACTIONS = ['studentLookup', 'studentSetPin', 'studentLogin'];
var STUDENT_AUTH_SHEET = 'นักเรียน_Students_Auth';
var STUDENT_AUTH_HEADERS = ['student_id', 'prefix', 'first_name', 'last_name', 'nickname', 'class', 'no',
  'salt', 'pin_hash', 'failed_count', 'locked_until', 'pin_set_at', 'last_login'];
var STUDENT_MAX_FAILS = 5;
var STUDENT_LOCK_MINUTES = 15;
var STUDENT_GLOBAL_PER_MINUTE = 300; // กันการสุ่มเดารหัสจำนวนมาก (ทั้งระบบ ต่อ 1 นาที)

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function toHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function getPinPepper_() {
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('PIN_PEPPER');
  if (!pepper) {
    pepper = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('PIN_PEPPER', pepper);
  }
  return pepper;
}

function hashPin_(studentId, pin, salt) {
  var value = salt + ':' + studentId + ':' + pin + ':' + getPinPepper_();
  var h = '';
  for (var i = 0; i < 100; i++) {
    h = toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + value, Utilities.Charset.UTF_8));
  }
  return h;
}

function cleanId_(v) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ''); }

function getStudentSheet_(ss) { return getOrCreateSheet(ss, STUDENT_AUTH_SHEET, STUDENT_AUTH_HEADERS); }

function findStudentRow_(sheet, studentId) {
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (cleanId_(values[r][0]) === studentId) {
      var o = { row: r + 1 };
      for (var c = 0; c < STUDENT_AUTH_HEADERS.length; c++) o[STUDENT_AUTH_HEADERS[c]] = values[r][c];
      return o;
    }
  }
  return null;
}

function writeStudentRow_(sheet, rec) {
  var row = STUDENT_AUTH_HEADERS.map(function (h) { return rec[h] === undefined ? '' : rec[h]; });
  sheet.getRange(rec.row, 1, 1, row.length).setValues([row]);
}

function maskName_(name) {
  var s = String(name || '');
  return s ? s.charAt(0) + '•••' : '•••';
}

function publicProfile_(rec) {
  return {
    studentId: cleanId_(rec.student_id),
    name: String(rec.prefix || '') + String(rec.first_name || '') + ' ' + String(rec.last_name || ''),
    nickname: String(rec.nickname || ''),
    studentClass: String(rec['class'] || ''),
    no: rec.no
  };
}

function globalStudentThrottle_() {
  var cache = CacheService.getScriptCache();
  var key = 'stu_rate_' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n <= STUDENT_GLOBAL_PER_MINUTE;
}

function handleStudentPublicAction(ss, payload) {
  if (!globalStudentThrottle_()) {
    return { status: 'error', code: 'rate_limited', message: 'มีการเข้าสู่ระบบจำนวนมาก กรุณารอสักครู่แล้วลองใหม่' };
  }
  var studentId = cleanId_(payload.studentId);
  if (!/^\d{4,10}$/.test(studentId)) return { status: 'error', code: 'bad_id', message: 'รูปแบบรหัสนักเรียนไม่ถูกต้อง' };
  var sheet = getStudentSheet_(ss);
  var rec = findStudentRow_(sheet, studentId);
  if (!rec) return { status: 'error', code: 'not_found', message: 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาแจ้งคุณครู' };
  var hasPin = !!rec.pin_hash;
  var now = Date.now();
  var lockedUntil = Number(rec.locked_until || 0);

  if (payload.action === 'studentLookup') {
    // เปิดเผยเพียงห้องเรียนและอักษรตัวแรกของชื่อ เพื่อให้นักเรียนยืนยันตัวเอง
    return { status: 'success', exists: true, hasPin: hasPin, studentClass: String(rec['class'] || ''),
      maskedName: maskName_(rec.first_name), locked: lockedUntil > now };
  }

  var pin = String(payload.pin || '');
  if (!/^\d{6}$/.test(pin)) return { status: 'error', code: 'bad_pin', message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก' };

  if (payload.action === 'studentSetPin') {
    if (hasPin) return { status: 'error', code: 'pin_exists', message: 'รหัสนี้ตั้ง PIN แล้ว หากลืม PIN กรุณาให้คุณครูรีเซ็ต' };
    rec.salt = Utilities.getUuid();
    rec.pin_hash = hashPin_(studentId, pin, rec.salt);
    rec.failed_count = 0;
    rec.locked_until = '';
    rec.pin_set_at = new Date().toISOString();
    rec.last_login = rec.pin_set_at;
    writeStudentRow_(sheet, rec);
    return { status: 'success', profile: publicProfile_(rec) };
  }

  // studentLogin
  if (lockedUntil > now) {
    return { status: 'error', code: 'locked', message: 'ใส่ PIN ผิดหลายครั้ง ระบบล็อกชั่วคราว ' + STUDENT_LOCK_MINUTES + ' นาที' };
  }
  if (!hasPin) return { status: 'error', code: 'needs_pin', message: 'ยังไม่ได้ตั้ง PIN กรุณาตั้ง PIN ก่อน' };
  if (hashPin_(studentId, pin, String(rec.salt)) !== String(rec.pin_hash)) {
    rec.failed_count = Number(rec.failed_count || 0) + 1;
    var left = STUDENT_MAX_FAILS - rec.failed_count;
    if (rec.failed_count >= STUDENT_MAX_FAILS) {
      rec.locked_until = now + STUDENT_LOCK_MINUTES * 60000;
      rec.failed_count = 0;
      left = 0;
    }
    writeStudentRow_(sheet, rec);
    return { status: 'error', code: 'wrong_pin', attemptsLeft: left,
      message: left > 0 ? 'PIN ไม่ถูกต้อง (เหลืออีก ' + left + ' ครั้ง)' : 'ใส่ PIN ผิดหลายครั้ง ระบบล็อกชั่วคราว ' + STUDENT_LOCK_MINUTES + ' นาที' };
  }
  rec.failed_count = 0;
  rec.locked_until = '';
  rec.last_login = new Date().toISOString();
  writeStudentRow_(sheet, rec);
  return { status: 'success', profile: publicProfile_(rec) };
}

/** ครูอัปโหลด/อัปเดตรายชื่อ (เก็บ PIN เดิมไว้) replace=true จะลบรหัสที่ไม่อยู่ในรายชื่อใหม่ */
function uploadStudentRoster(ss, students, replace) {
  var sheet = getStudentSheet_(ss);
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var r = 1; r < values.length; r++) index[cleanId_(values[r][0])] = r;
  var seen = {}, added = 0, updated = 0;
  for (var i = 0; i < students.length; i++) {
    var s = students[i] || {};
    var id = cleanId_(s.student_id);
    if (!/^\d{4,10}$/.test(id) || seen[id]) continue;
    seen[id] = true;
    var base = [id, s.prefix || '', s.first_name || '', s.last_name || '', s.nickname || '', s['class'] || '', s.no || ''];
    if (index[id] !== undefined) {
      var row = values[index[id]];
      for (var c = 0; c < base.length; c++) row[c] = base[c];
      updated++;
    } else {
      var newRow = base.concat(['', '', 0, '', '', '']);
      index[id] = values.length;
      values.push(newRow);
      added++;
    }
  }
  var removed = 0;
  if (replace) {
    var kept = [values[0]];
    for (var k = 1; k < values.length; k++) {
      if (seen[cleanId_(values[k][0])]) kept.push(values[k]); else removed++;
    }
    values = kept;
  }
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, STUDENT_AUTH_HEADERS.length).setValues(values.map(function (row) {
    var out = [];
    for (var c = 0; c < STUDENT_AUTH_HEADERS.length; c++) out.push(row[c] === undefined ? '' : row[c]);
    return out;
  }));
  return { status: 'success', added: added, updated: updated, removed: removed, total: values.length - 1 };
}

function resetStudentPinServer(ss, studentId) {
  var id = cleanId_(studentId);
  var sheet = getStudentSheet_(ss);
  var rec = findStudentRow_(sheet, id);
  if (!rec) return { status: 'error', code: 'not_found', message: 'ไม่พบรหัสนักเรียนนี้ในชีต' };
  rec.salt = ''; rec.pin_hash = ''; rec.failed_count = 0; rec.locked_until = ''; rec.pin_set_at = '';
  writeStudentRow_(sheet, rec);
  return { status: 'success', studentId: id };
}

function studentPinStatus(ss) {
  var values = getStudentSheet_(ss).getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    list.push({ studentId: cleanId_(values[r][0]), hasPin: !!values[r][8], locked: Number(values[r][10] || 0) > Date.now() });
  }
  return { status: 'success', students: list };
}
