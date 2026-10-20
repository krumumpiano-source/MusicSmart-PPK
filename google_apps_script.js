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
 * ============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // รอ Lock สูงสุด 20 วินาทีเพื่อป้องกันการเขียนข้อมูลชนกันพร้อมกัน
  lock.tryLock(20000);
  try {
    var rawText = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawText);
    var action = payload.action || 'sync';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ตรวจสอบการเชื่อมต่อ (Ping Test)
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'เชื่อมต่อ Google Sheet สำเร็จ: ' + ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        serverTime: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

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
      status: 'success',
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    appName: 'MusicSmart Google Sheets Sync Service',
    sheetName: ss.getName(),
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
