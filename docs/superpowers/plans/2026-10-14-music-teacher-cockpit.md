# Teacher's Classroom Cockpit (MusicSmart PPK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, offline-first Web Application for Kru Pongsatorn Pothikaew (ครูประจำวิชา) and his student teacher (ครูฝึกสอน) at Phayaophitthayakhom School to manage live classroom teaching, 20 Kalimba lesson plans, one-tap attendance for 16 classes, rubric scoring, post-lesson reflection, teacher handover notes, and export to Excel/วก.5/วก.7.

**Architecture:** Single Page Application (SPA) / PWA with modular Vanilla JavaScript (ES6), modern CSS (touch-first for iPad/Mobile and desktop), and a robust Local-First Storage Engine (LocalStorage & JSON backup/restore).

**Tech Stack:** HTML5, Modern CSS, Vanilla ES6 JavaScript, SheetJS (XLSX CDN/Standalone) for Excel export, Python for validation test scripts.

## Global Constraints
- Target Users: คุณครูพงศธร โพธิแก้ว (ครูประจำวิชา) & คุณครูฝึกสอน
- School & Subject: โรงเรียนพะเยาพิทยาคม, วิชาดนตรี 1 (ศ21101 คาลิมบ้า 20 คาบ) และ วิชาดนตรี 2 (ศ21102)
- Total Classes: 16 ห้อง (ม.1/1 - ม.1/7, 1/14 และ ม.2/1 - ม.2/7, 2/14) รวมกว่า 600 คน
- Touch Targets: ปุ่มทุกปุ่มต้องมีขนาดอย่างน้อย 44x44px รองรับการแตะบน iPad/แท็บเล็ต/มือถือ
- Zero External Server Requirement: ต้องทำงานแบบออฟไลน์ได้ 100%

---

### Task 1: นักเรียน 16 ห้องเรียน Data Module (`app/data/students.js`)

**Files:**
- Create: `app/data/students.js`
- Test: `tests/test_students.py`

**Interfaces:**
- Produces: `STUDENTS_DATA` object where keys are class names (`"ม.1/1"`, `"ม.1/2"`, ..., `"ม.2/14"`) and values are arrays of student objects:
  ```typescript
  interface Student {
    id: string;
    student_id: string;
    prefix: string;
    first_name: string;
    last_name: string;
    nickname: string;
    class: string;
    no: number;
  }
  ```

- [ ] **Step 1: Write test script to verify all 16 classes and student count**

```python
# tests/test_students.py
import re
import json

def test_students():
    with open("app/data/students.js", "r", encoding="utf-8") as f:
        content = f.read()
    
    # Extract JSON-like content
    match = re.search(r'const STUDENTS_DATA = ({.*?});\s*if', content, re.DOTALL)
    assert match is not None, "STUDENTS_DATA not found"
    
    data = json.loads(match.group(1))
    expected_classes = [
        "ม.1/1", "ม.1/2", "ม.1/3", "ม.1/4", "ม.1/5", "ม.1/6", "ม.1/7", "ม.1/14",
        "ม.2/1", "ม.2/2", "ม.2/3", "ม.2/4", "ม.2/5", "ม.2/6", "ม.2/7", "ม.2/14"
    ]
    for c in expected_classes:
        assert c in data, f"Missing class {c}"
        if "14" in c:
            assert len(data[c]) == 25, f"Class {c} expected 25 students, got {len(data[c])}"
        else:
            assert len(data[c]) == 40, f"Class {c} expected 40 students, got {len(data[c])}"
    
    print("ALL 16 CLASSES AND 610 STUDENTS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_students()
```

- [ ] **Step 2: Run test to verify it fails before file creation**

Run: `python tests/test_students.py`
Expected: FAIL (FileNotFoundError)

- [ ] **Step 3: Create `app/data/students.js` with complete parsed MIS data**

Parse all 16 class rosters provided by Teacher Pongsatorn from PPK-Mis and write `app/data/students.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python tests/test_students.py`
Expected: `ALL 16 CLASSES AND 610 STUDENTS VERIFIED SUCCESSFULLY!`

---

### Task 2: แผนการสอน 20 คาบและคำแนะนำครูประจำวิชา (`app/data/lessons.js`)

**Files:**
- Create: `app/data/lessons.js`
- Test: `tests/test_lessons.py`

**Interfaces:**
- Produces: `LESSONS_DATA` containing 20 periods for M.1 (ศ21101 คาลิมบ้า) and template for M.2:
  ```typescript
  interface Lesson {
    lesson_id: string;
    grade: string;
    period: number;
    unit_no: number;
    unit_name: string;
    topic: string;
    kpa: { k: string; p: string; a: string };
    mentor_tips: string;
    duration_min: number;
    steps: Array<{ phase: string; duration: number; desc: string }>;
    media: Array<{ title: string; url?: string; type: string }>;
    assessment: {
      has_score: boolean;
      max_score: number;
      type: 'individual' | 'group' | 'none';
      rubrics: Array<{ score: number; label: string; desc: string }>;
    };
  }
  ```

- [ ] **Step 1: Write test script for lesson plans**

```python
# tests/test_lessons.py
import re
import json

def test_lessons():
    with open("app/data/lessons.js", "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r'const LESSONS_DATA = ({.*?});\s*if', content, re.DOTALL)
    assert match is not None, "LESSONS_DATA not found"
    data = json.loads(match.group(1))
    assert "M1" in data, "M1 lessons missing"
    assert len(data["M1"]) == 20, f"Expected 20 lessons for M1, got {len(data['M1'])}"
    for l in data["M1"]:
        assert "mentor_tips" in l, f"Lesson {l['period']} missing mentor_tips"
        assert "steps" in l and len(l["steps"]) >= 3, f"Lesson {l['period']} steps invalid"
    print("ALL 20 M1 LESSON PLANS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_lessons()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python tests/test_lessons.py`
Expected: FAIL

- [ ] **Step 3: Implement `app/data/lessons.js`**

Write all 20 lessons for Kalimba curriculum (Units 1-4) with step durations, mentor notes, and rubrics.

- [ ] **Step 4: Run test to verify it passes**

Run: `python tests/test_lessons.py`
Expected: `ALL 20 M1 LESSON PLANS VERIFIED SUCCESSFULLY!`

---

### Task 3: ระบบจัดเก็บข้อมูลและประวัติการสอน (`app/data/store.js`)

**Files:**
- Create: `app/data/store.js`
- Test: `tests/test_store.js` or Python mock test

**Interfaces:**
- Produces: `Store` singleton managing:
  - `getCurrentInstructor(): { role: 'ครูประจำวิชา' | 'ครูฝึกสอน', name: string }`
  - `setInstructor(role, name)`
  - `getClassProgress(className): { lastPeriod: number, lastInstructor: string, lastDate: string, lastHandover: string }`
  - `saveSession(sessionData)`
  - `getSession(className, period)`
  - `exportBackupJSON(): string`
  - `importBackupJSON(jsonStr): boolean`
  - `exportAttendanceScoreExcel(className)`

- [ ] **Step 1: Write unit test for Store logic**
- [ ] **Step 2: Run test and verify failure**
- [ ] **Step 3: Implement `app/data/store.js` with LocalStorage resilience and JSON export/import**
- [ ] **Step 4: Verify test passes**

---

### Task 4: การออกแบบ UI และสไตล์แบบ Modern Glassmorphism (`app/css/styles.css`)

**Files:**
- Create: `app/css/styles.css`

**Features:**
- Responsive layout (Mobile <640px, Tablet 768px-1024px, Desktop >1024px)
- Big touch targets (>= 48px) for live classroom tapping
- Status badges: Present (Green), Absent (Red), Leave (Yellow), Late (Orange), Activity (Sky Blue)
- Rubric score pills: 3 (Emerald), 2 (Cyan), 1 (Amber)
- Mentor's Golden Box for tips from Kru Pongsatorn
- Handover Message Banner with sticky prominent styling
- Countdown Timer card with play/pause/reset buttons

- [ ] **Step 1: Implement `app/css/styles.css` with Google Fonts (Prompt & Inter) and dark/light support**
- [ ] **Step 2: Verify CSS validity and linting**

---

### Task 5: หน้าจอหลักและโครงสร้างแอป (`app/index.html` & `app/js/app.js`)

**Files:**
- Create: `app/index.html`
- Create: `app/js/app.js`

**Features:**
- Header with Instructor Switcher (`[ ครูประจำวิชา: พงศธร โพธิแก้ว ]` / `[ ครูฝึกสอน ]`)
- Grade Level Switcher (`[ ม.1 (ศ21101 คาลิมบ้า) ]` / `[ ม.2 ]`)
- View 1: Classroom Grid & Handover Board
- View 2: Live Teaching Cockpit (Tab 1: Lesson & Timer, Tab 2: Attendance, Tab 3: Rubric Assessment)
- View 3: Post-Lesson Reflection & Handover Note Modal
- View 4: Export Hub (Excel, วก.5, วก.7)

- [ ] **Step 1: Create semantic HTML skeleton in `app/index.html`**
- [ ] **Step 2: Implement full interactive logic in `app/js/app.js`**
- [ ] **Step 3: Test countdown timer, one-tap attendance cycle, rubric point calculation, and reflection save**

---

### Task 6: ตรวจสอบและทดสอบระบบด้วย Browser Subagent (`tests/verify_app.py`)

**Files:**
- Modify/Verify: `app/*`
- Test: Run local server and test in browser

- [ ] **Step 1: Start local web server for testing**
- [ ] **Step 2: Open and interact with the application using browser subagent**
- [ ] **Step 3: Test flow: Select ม.1/1 -> Start Period 1 as ครูฝึกสอน -> Read Mentor Tips -> Start Timer -> Tap Attendance for Absent student -> Score Rubric -> End Session with Handover Note**
- [ ] **Step 4: Switch role to ครูประจำวิชา -> Check ม.1/1 card -> Verify Handover Note from ครูฝึกสอน is prominently visible!**
- [ ] **Step 5: Test Export Excel and วก.5 reflection**
