# Design Spec: Classroom 5-Group Pod View for Attendance, Rubric Scoring, and Submissions

- **Date:** 2026-10-27
- **Project:** MusicSmart - Phayao Pittayakhom School (ศ21101 / ศ22101)
- **Status:** Approved by User, Ready for Planning

---

## 1. Overview & Problem Statement

In Music and Performing Arts Active Learning classrooms (e.g., Kalimba, Ensemble, Cooperative Learning), classes of ~40 students sit in 5 distinct seating pods/tables of 8 students each. The teacher assigns groups using a count-off / modulo 5 pattern:
- **Group 1:** Roll numbers 1, 6, 11, 16, 21, 26, 31, 36
- **Group 2:** Roll numbers 2, 7, 12, 17, 22, 27, 32, 37
- **Group 3:** Roll numbers 3, 8, 13, 18, 23, 28, 33, 38
- **Group 4:** Roll numbers 4, 9, 14, 19, 24, 29, 34, 39
- **Group 5:** Roll numbers 5, 10, 15, 20, 25, 30, 35, 40

Previously, the Cockpit UI displayed all students in a single linear list (Roll 1 to 40). When taking attendance or grading ensemble performance, teachers had to scan back and forth across 40 rows to find members of a specific table, taking excessive class time.

### Objectives
1. Provide an intuitive **View Switcher Toggle** in the Classroom Cockpit to switch between:
   - `👥 มุมมองตามกลุ่ม (5 กลุ่มที่นั่ง)` (Group Pod View)
   - `📋 มุมมองเรียงตามเลขที่ (1–40)` (Sequential Roll Number View)
2. **Synchronized & Persistent Preference:** Switching the view updates both Tab 2 (Attendance) and Tab 3 (Rubric Scoring) consistently, and persists the choice across sessions via `localStorage`.
3. **Tab 2 (Attendance):**
   - Default all students to "มา" (Present).
   - Display 5 Group Pod cards matching room seating.
   - Header action for each group: `มาครบทั้งกลุ่ม` (Quick Check).
   - Support "Exception-Only Marking": Teacher or group leader quickly taps only absent/late/leave students. Entire class roll call completed in < 15 seconds.
4. **Tab 3 (Assessment & Rubric Scoring):**
   - Display 5 Group Pod cards with group members.
   - Group batch scoring header buttons: `[ ให้ 3 ทั้งกลุ่ม ]`, `[ ให้ 2 ทั้งกลุ่ม ]`, `[ ให้ 1 ทั้งกลุ่ม ]`.
   - Automatic guard: Students marked `absent` or `withdrawn` are protected from accidental group scoring.
   - Individual overrides and Rubric Matrix (4-level rubric) buttons remain fully accessible.
5. **Tab 4 (Submissions & Feedback Loop):**
   - Add Group Filter buttons `[ทั้งหมด] [กลุ่ม 1] [กลุ่ม 2] [กลุ่ม 3] [กลุ่ม 4] [กลุ่ม 5]` to inspect submissions by group.

---

## 2. Algorithmic Grouping Specification

Given a student record `s` with roll number `s.no` (integer 1..N):
$$\text{groupId} = ((\text{s.no} - 1) \bmod 5) + 1$$

This pure mathematical function yields values `1, 2, 3, 4, 5`.
For any class size (whether 38, 40, or 42 students), the formula cleanly distributes students into 5 groups without hardcoded arrays.

Helper function in `App`:
```javascript
getStudentGroup(student) {
  const no = parseInt(student.no, 10);
  if (isNaN(no) || no < 1) return 1;
  return ((no - 1) % 5) + 1;
}
```

---

## 3. UI/UX Architecture & Layout

### 3.1 View Switcher Component
Rendered at the top of Tab 2 (Attendance) and Tab 3 (Assessment):
```html
<div class="view-mode-toggle-group">
  <span class="view-mode-label">มุมมองแสดงผล:</span>
  <div class="pill-switch">
    <button id="btn-view-mode-group" class="btn-pill-switch active" onclick="App.setRosterViewMode('group')">
      👥 แยก 5 กลุ่มที่นั่ง
    </button>
    <button id="btn-view-mode-list" class="btn-pill-switch" onclick="App.setRosterViewMode('list')">
      📋 เรียงเลขที่ 1-40
    </button>
  </div>
</div>
```

State Management:
- `App.state.rosterViewMode = localStorage.getItem('musicsmart_roster_view_mode') || 'group';`
- Calling `App.setRosterViewMode(mode)`:
  - Updates `App.state.rosterViewMode`.
  - Saves to `localStorage.setItem('musicsmart_roster_view_mode', mode)`.
  - Re-renders current active tab (`renderCurrentTab()`).
  - Updates active classes on toggle buttons across both Tab 2 and Tab 3.

---

### 3.2 Tab 2: Attendance Group Pod View
Layout:
- Top summary bar: Present, Absent, Leave, Late, Withdrawn counts + "ตั้งเป็น 'มา' ทั้งหมด".
- Main container: `.group-pods-container` with CSS Grid (adaptive 1 to 3 columns depending on screen width).
- 5 Group Pod Cards (`.group-pod-card`):
  - **Pod Header:**
    - Title: `กลุ่มที่ {g}` (e.g., `กลุ่มที่ 1`)
    - Subtitle/Stat: `มา {p}/{total} คน` (highlighted badge)
    - Action: Button `มาครบทั้งกลุ่ม` (`App.setGroupPresent(g)`)
  - **Pod Body:**
    - List of 8 students belonging to group `g`.
    - Compact, touch-friendly rows:
      - `[No]` badge
      - Nickname chip + Full name
      - PDPA badge if consented
      - Attendance chip button (`.btn-att-chip`): cycling `present` -> `absent` -> `leave` -> `late` -> `activity`
      - Withdrawn / transferred student status handling

### 3.3 Tab 3: Rubric Scoring Group Pod View
Layout:
- Rubric banner + Full-class batch actions ("ให้ 3 ทุกคน", "ให้ 2 ทุกคน").
- Main container: `.group-pods-container`.
- 5 Group Pod Cards:
  - **Pod Header:**
    - Title: `กลุ่มที่ {g} ({count} คน)`
    - Group Batch Scoring Buttons:
      - `[ ให้ 3 ทั้งกลุ่ม ]` -> `App.batchScoreGroup(g, 3)`
      - `[ ให้ 2 ทั้งกลุ่ม ]` -> `App.batchScoreGroup(g, 2)`
      - `[ ให้ 1 ทั้งกลุ่ม ]` -> `App.batchScoreGroup(g, 1)`
  - **Pod Body:**
    - 8 students in group `g`.
    - Each student has:
      - `[No]` badge, Nickname chip, Full name.
      - Individual score buttons `3`, `2`, `1`.
      - `📊 รูบริก` button (opens RubricMatrix modal for multi-criteria assessment).
      - `🎯 สอบ` unit quiz button.
      - Absence protection: If student attendance is `absent`, card shows `(ขาดเรียน - รอสอบซ่อม)` with reduced opacity; batch group scoring will NOT assign scores to absent students unless individually clicked.

### 3.4 Tab 4: Submissions Filter by Group
Add group filter pills alongside existing status filter pills:
- Group pills: `กลุ่ม 1`, `กลุ่ม 2`, `กลุ่ม 3`, `กลุ่ม 4`, `กลุ่ม 5`.
- Submissions list filters both by submission status (pending, graded, etc.) and selected group.

---

## 4. Responsive CSS Styling

CSS additions in `app/css/styles.css`:
- `.view-mode-toggle-group`: Flexbox header with clear visual prominence.
- `.pill-switch`: Segmented pill control with active gradient (`var(--ppk-navy-dark)` / `var(--ppk-blue)`).
- `.group-pods-container`: Modern CSS grid `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;`.
- `.group-pod-card`: Card with crisp borders, subtle shadow, rounded corners (12px), background `var(--bg-surface)`.
- `.group-pod-header`: Distinct accent header bar with group badge and quick-action buttons.
- Mobile / Tablet responsiveness: Clean display on iPad, tablets, laptops, and large interactive touch boards.

---

## 5. Data Flow & Integrity

1. **No Schema Changes Required:** `Store.saveSession(className, period, sessionData)` saves attendance and scores indexed by `student_id`. Grouping is an intelligent visual projection of the existing student roster.
2. **Backward Compatibility:** All existing sessions, Google Sheet sync logs, official forms (ปพ.5, วก.5, วก.7), CAR reports, and student dashboards remain 100% compatible.
3. **Session Rehydration:** When switching periods or loading saved sessions, attendance states and scores rehydrate into both the Group View and List View seamlessly.

---

## 6. Verification & Test Plan

1. **Grouping Accuracy:**
   - Verify that Roll numbers 1, 6, 11, 16, 21, 26, 31, 36 render exclusively in Group 1.
   - Verify that Roll numbers 2, 7, 12, 17, 22, 27, 32, 37 render exclusively in Group 2.
   - Verify that Roll numbers 3, 8, 13, 18, 23, 28, 33, 38 render in Group 3.
   - Verify that Roll numbers 4, 9, 14, 19, 24, 29, 34, 39 render in Group 4.
   - Verify that Roll numbers 5, 10, 15, 20, 25, 30, 35, 40 render in Group 5.
2. **View Mode Switching:**
   - Click "📋 เรียงเลขที่ 1-40" -> verify list view renders accurately.
   - Click "👥 แยก 5 กลุ่มที่นั่ง" -> verify 5 group cards render with 8 students each.
   - Switch tabs between Tab 2 and Tab 3 -> verify view mode persists.
   - Reload page -> verify preference loaded from `localStorage`.
3. **Tab 2 (Attendance) Actions:**
   - Click `มาครบทั้งกลุ่ม` on Group 1 -> all 8 students become `present`.
   - Click chip on student #16 -> toggles to `absent`, summary counts update.
   - Save session -> verify session saved correctly to Store.
4. **Tab 3 (Assessment) Actions:**
   - Click `[ ให้ 3 ทั้งกลุ่ม ]` on Group 2 -> all 8 students get score 3.
   - Verify absent students in Group 1 are excluded from batch scoring.
   - Click individual score button (e.g. change #7 to 2) -> updates correctly.
5. **Tab 4 (Submissions) Filter:**
   - Filter by Group 1 -> only submissions from students in Group 1 are displayed.
