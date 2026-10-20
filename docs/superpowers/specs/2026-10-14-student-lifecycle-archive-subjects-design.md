# Design Specification: Student Lifecycle, Multi-Term Archive & Dynamic Subject Management

**System:** MusicSmart PPK — Teacher's Classroom Cockpit  
**Target User:** คุณครูพงศธร โพธิแก้ว (ครูประจำวิชา) & คุณครูฝึกสอน, โรงเรียนพะเยาพิทยาคม  
**Date:** 2026-10-14  
**Status:** Approved by User  

---

## 1. Overview & Objectives

This specification covers three essential academic administration extensions for MusicSmart PPK:
1. **Student Withdrawal & Transfer System (ระบบนักเรียนจำหน่ายออก/ย้ายสถานศึกษากลางคัน):**
   - Track status changes (`active`, `withdrawn`, `transferred`) with transfer dates and notes.
   - Prevent withdrawn students from polluting absent/remedial counters.
   - Generate official printable/exportable grade handover transcripts (ใบสรุปผลการเรียนและคะแนนส่งต่อ) with attendance percentage, accumulated scores, and signature sections.
2. **Multi-Term Archive & Semester Lifecycle (ระบบคลังข้อมูลเทอม / ย้อนหลัง / ขึ้นเทอมใหม่):**
   - Support multiple academic terms (e.g., ภาคเรียนที่ 1/2569, ภาคเรียนที่ 2/2569).
   - Allow teachers to archive current term data in the background, download term-specific `.json` backups, and view historical terms in read-only mode.
   - Support resetting progress to start a clean new semester (0/20 periods) without losing past data.
3. **Dynamic Subject Management (ระบบจัดการรายวิชาหน้าโปรแกรม):**
   - Add, edit, or hide/remove subjects (e.g., ศ21101 คาลิมบ้า ม.1, ศ21102 ดนตรีสากล ม.2, ศ31101 ดนตรีสากล ม.4) directly from the UI without modifying source code.
   - Dynamically render course switch buttons on the cockpit header.

---

## 2. Architecture & Data Model

### 2.1 Storage Keys & State Schemas

In `app/data/store.js`, new/updated storage keys:

```javascript
const STORAGE_KEYS = {
  INSTRUCTOR: 'ppk_instructor_profile',
  PROGRESS: 'ppk_class_progress',
  SESSIONS: 'ppk_session_logs',
  TIMETABLE: 'ppk_weekly_timetable',
  HOLIDAYS: 'ppk_holiday_logs',
  
  // New keys:
  STUDENT_STATUS: 'ppk_student_status',      // student_id -> { status, date, reason, note }
  SEMESTERS: 'ppk_semesters_meta',           // current semester and archived terms list
  SUBJECTS: 'ppk_subjects_list'              // dynamic subjects list
};
```

#### A. Student Status Schema (`ppk_student_status`)
```typescript
interface StudentStatusRecord {
  status: 'active' | 'withdrawn' | 'transferred';
  date: string;       // e.g. "14 ต.ค. 2569"
  reason: string;     // e.g. "ย้ายตามผู้ปกครอง", "ลาออกไปประกอบอาชีพ"
  note: string;       // Additional notes
  updatedBy: string;  // Instructor name
}
```

#### B. Semesters & Term Archive Schema (`ppk_semesters_meta`)
```typescript
interface SemesterMeta {
  activeSemesterId: string; // e.g. "2569_1"
  activeSemesterLabel: string; // "ภาคเรียนที่ 1 ปีการศึกษา 2569"
  archives: {
    [semesterId: string]: {
      id: string;
      label: string;
      year: string;
      term: string;
      archivedAt: string;
      data: {
        progress: Record<string, any>;
        sessions: Record<string, any>;
        timetable: any;
        holidays: any[];
        studentStatus: Record<string, StudentStatusRecord>;
      }
    }
  }
}
```

#### C. Subjects Schema (`ppk_subjects_list`)
```typescript
interface SubjectItem {
  id: string;        // e.g. "M1", "M2", "M4_BAND"
  code: string;      // e.g. "ศ21101", "ศ21102", "ศ31101"
  name: string;      // e.g. "ดนตรี (คาลิมบ้า)", "ดนตรีสากล"
  grade: string;     // e.g. "ม.1", "ม.2", "ม.4"
  periods: number;   // e.g. 20
  active: boolean;   // true / false
}
```

---

## 3. UI/UX Specifications

### 3.1 Student Withdrawal & Handover Transcript

1. **Class Roster & Attendance Integration:**
   - In the Classroom Cockpit (Tab 1, Tab 2, Tab 3), every student row shows a status badge or action:
     - `active`: Normal badge (no special tag).
     - `withdrawn` / `transferred`: Gray/amber badge `[จำหน่ายออก]` or `[ย้ายสถานศึกษา]`.
   - Withdrawn students:
     - Attendance chips are disabled or marked as inactive.
     - They do **not** increase the "ขาดเรียน" count and do **not** appear in the "รอสอบซ่อม" remedial list.
     - Their past earned scores are preserved and frozen.
2. **Student Status & Handover Dialog (`#modal-student-status`):**
   - Click student name or action icon:
     - Select status: `ปกติ`, `ย้ายสถานศึกษา (โอนย้าย)`, `จำหน่ายออก / ลาออก`
     - Enter date of status change & reason.
     - Button **"📄 ออกใบสรุปคะแนนส่งต่อ"**.
3. **Official Printable Handover Transcript (`#modal-student-transcript`):**
   - Styled for both screen and `@media print` (standard A4 layout):
     - **School Header:** ตราสัญลักษณ์ / โรงเรียนพะเยาพิทยาคม • กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)
     - **Student Profile:** ชื่อ-สกุล, รหัสนักเรียน, ชั้น/ห้อง, เลขที่, วันที่จำหน่าย
     - **Subject & Teachers:** รหัสวิชา, ชื่อวิชา, ครูประจำวิชา (คุณครูพงศธร โพธิแก้ว), ครูฝึกสอน
     - **Attendance Summary:** สถิติการเข้าเรียน (มา / ขาด / ลา / มาสาย / กิจกรรม), อัตราการเข้าเรียนร้อยละ
     - **Assessment Breakdown:** ตารางคะแนนเก็บสะสมแยกตามคาบและตัวชี้วัด (Score / Max Score)
     - **Total Score:** คะแนนรวมสะสมถึงปัจจุบัน
     - **Signatures:** ผู้ประเมิน (ครูผู้สอน), หัวหน้ากลุ่มสาระฯ, นายทะเบียน
   - Action buttons:
     - `🖨️ พิมพ์เอกสาร / บันทึกเป็น PDF`
     - `📊 ส่งออกเป็น Excel (.xlsx)`
     - `✖️ ปิดหน้าต่าง`

### 3.2 Semester Lifecycle & Archive Management

1. **Top Bar Indicator:**
   - Header displays current term: `ภาคเรียนที่ 1/2569` with button `🗄️ คลังเทอม & ขึ้นเทอมใหม่`.
2. **Semester Modal (`#modal-semester`):**
   - **Tab 1: ภาคเรียนปัจจุบัน (Current Term):**
     - Summary of active term, classes, sessions recorded.
     - Button: `💾 สำรองข้อมูลเฉพาะเทอมนี้ (.json)`
     - Button: `🚀 ปิดเทอมและเริ่มต้นเทอมใหม่ (Start New Term)`
   - **Tab 2: เริ่มต้นภาคเรียนใหม่ (Start New Term Flow):**
     - Form: Specify academic year (e.g., 2569), term (e.g., 2).
     - Confirmation modal warning that current data will be safely moved to archive.
     - On confirm: creates archive snapshot in `ppk_semesters_meta`, clears active progress & sessions to period 1 (0/20), updates active label.
   - **Tab 3: คลังประวัติเทอมย้อนหลัง (Historical Archive):**
     - List of archived terms with date, year, total records.
     - Action: `🔍 เปิดดูข้อมูลย้อนหลัง (Read-Only Mode)` with clear banner: *"กำลังดูข้อมูลประวัติย้อนหลัง ภาคเรียนที่ X/XXXX"*.
     - Action: `💾 ดาวน์โหลดไฟล์สำรองของเทอมนี้`.

### 3.3 Dynamic Subject Management

1. **Navigation:**
   - Button in top header / tools: `⚙️ จัดการรายวิชา`.
2. **Subject Manager Modal (`#modal-subjects`):**
   - Table of active and inactive courses.
   - Button: `➕ เพิ่มรายวิชาใหม่`
     - Code (e.g., `ศ31101`)
     - Name (e.g., `ดนตรีสากล`)
     - Grade level (ม.1 - ม.6)
     - Total periods (default 20)
   - Edit button: change course code or title.
   - Toggle active/inactive: hides or shows course in the main header tabs.
   - Top course switcher bar in cockpit (`#course-switcher`) dynamically generates buttons for all active subjects.

---

## 4. Verification & Testing Plan

1. **Student Status Test:**
   - Mark student M.1/1 #3 as "ย้ายสถานศึกษา" with date and reason.
   - Verify student row shows `[ย้ายสถานศึกษา]`, attendance counter excludes them, and remedial list excludes them.
   - Open Handover Transcript: verify student metadata, attendance stats, and score table format.
   - Test Excel export and print layout preview.
2. **Multi-Term Archive Test:**
   - Complete 1 period for M.1/1.
   - Trigger "Start New Term" for `ภาคเรียนที่ 2/2569`.
   - Verify M.1/1 resets to Period 1 (0/20).
   - Switch back to Archive `ภาคเรียนที่ 1/2569`: verify completed period 1 is intact and accessible.
   - Return to current term.
3. **Subject Management Test:**
   - Add new course `ศ31101 ดนตรีสากล ม.4 (20 คาบ)`.
   - Verify new tab appears in header.
   - Switch to new course, verify clean lesson structure / grade selection.
   - Edit course code/name and verify instant update.
