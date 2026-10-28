# Classroom 5-Group Pod View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a synchronized 5-group seating pod view across Classroom Cockpit for Attendance, Rubric Scoring, and Submissions based on modulo 5 grouping `((no - 1) % 5) + 1`.

**Architecture:** Add centralized grouping functions in `App` (`getStudentGroup`, `groupStudentsByPod`). Store persistent `rosterViewMode` ('group' | 'list') in `App.state` and `localStorage`. Update Tab 2 (Attendance) to render 5 group pod cards with live group stats and `มาครบทั้งกลุ่ม` quick-check button. Update Tab 3 (Assessment/Rubrics) to render 5 group pod cards with `batchScoreGroup` buttons (`[ ให้ 3 ทั้งกลุ่ม ]`, `[ ให้ 2 ทั้งกลุ่ม ]`, `[ ให้ 1 ทั้งกลุ่ม ]`) with automatic protection for absent students. Update Tab 4 (Submissions) with group filter pills. Add responsive CSS for group pods.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3, localStorage, existing Store & Cockpit architecture.

## Global Constraints
- Spec: `docs/superpowers/specs/2026-10-27-classroom-group-view-attendance-scoring-design.md`
- No breaking changes to existing data structures (`Store.saveSession` schema remains identical).
- Group formula: `((no - 1) % 5) + 1` for 1-indexed roll numbers.
- Persistent view mode key: `musicsmart_roster_view_mode`.
- Absent and withdrawn students MUST be protected from accidental group scoring.

---

### Task 1: Core Grouping Helpers & View Mode State in `app/js/app.js`

**Files:**
- Modify: `app/js/app.js`
- Test: `tests/test_group_logic.js`

**Interfaces:**
- Produces:
  - `App.getStudentGroup(student)` -> `1 | 2 | 3 | 4 | 5`
  - `App.groupStudentsByPod(students)` -> `{ 1: Student[], 2: Student[], 3: Student[], 4: Student[], 5: Student[] }`
  - `App.setRosterViewMode(mode)` -> updates `App.state.rosterViewMode`, saves to `localStorage`, re-renders active tab

- [x] **Step 1: Create unit test for modulo 5 grouping logic**
  Create `tests/test_group_logic.js` to test roll numbers 1..40 mapping to groups 1..5.
- [x] **Step 2: Run test with node to verify expected results**
  Run `node tests/test_group_logic.js`.
- [x] **Step 3: Implement grouping methods & state initialization in `app/js/app.js`**
  Add `rosterViewMode` to `App.state`, add `getStudentGroup`, `groupStudentsByPod`, and `setRosterViewMode`.
- [x] **Step 4: Commit changes**
  Commit with message: `feat: add student grouping helpers and view mode state to App`.

---

### Task 2: Responsive CSS Styles for Group Pods in `app/css/styles.css`

**Files:**
- Modify: `app/css/styles.css`

**Interfaces:**
- Produces CSS classes:
  - `.view-mode-toggle-bar`, `.pill-switch`, `.btn-pill-switch`, `.btn-pill-switch.active`
  - `.group-pods-container` (responsive grid)
  - `.group-pod-card`, `.group-pod-header`, `.group-pod-title`, `.group-pod-badge`, `.group-pod-body`
  - `.btn-group-action`, `.group-batch-scoring-bar`

- [x] **Step 1: Add CSS rules for view mode switcher toggle**
  Clean segmented control styling matching existing PPK navy / blue theme.
- [x] **Step 2: Add CSS rules for 5-group pods grid and cards**
  Grid with `repeat(auto-fit, minmax(320px, 1fr))` for tablet/desktop and full-width on mobile.
- [x] **Step 3: Add CSS for group header buttons and badges**
  Buttons for `มาครบทั้งกลุ่ม` and group score chips (`3`, `2`, `1`).
- [x] **Step 4: Commit changes**
  Commit with message: `style: add responsive styles for classroom group pods and view switcher`.

---

### Task 3: Tab 2 (Attendance) Group Pod View & Quick Check

**Files:**
- Modify: `app/index.html`
- Modify: `app/js/app.js`

**Interfaces:**
- Consumes: `App.groupStudentsByPod`, `App.state.rosterViewMode`
- Produces:
  - `App.setGroupPresent(groupId)` -> sets all active, non-withdrawn students in group `groupId` to `'present'`
  - Updated `App.renderAttendanceTab()` supporting both `'group'` and `'list'` modes

- [x] **Step 1: Add View Switcher bar in `tab-content-attendance` of `app/index.html`**
  Add the segmented buttons `[ 👥 แยก 5 กลุ่มที่นั่ง ]` and `[ 📋 เรียงเลขที่ 1-40 ]`.
- [x] **Step 2: Implement `App.setGroupPresent(groupId)` in `app/js/app.js`**
  Update state attendance for all students where `App.getStudentGroup(s) === groupId`.
- [x] **Step 3: Update `renderAttendanceTab()` to render Group Pods when `rosterViewMode === 'group'`**
  Render 5 group pod cards. Each card contains group title, attendance count `มา X/Y`, `มาครบทั้งกลุ่ม` button, and student chips.
- [x] **Step 4: Keep existing flat list rendering when `rosterViewMode === 'list'`**
  Ensure backward compatibility with list mode.
- [x] **Step 5: Verify in browser and commit**
  Commit with message: `feat: implement 5-group pod view and quick check for classroom attendance`.

---

### Task 4: Tab 3 (Assessment & Rubrics) Group Pod View & Group Batch Scoring

**Files:**
- Modify: `app/index.html`
- Modify: `app/js/app.js`

**Interfaces:**
- Consumes: `App.groupStudentsByPod`, `App.state.rosterViewMode`, `App.state.attendance`
- Produces:
  - `App.batchScoreGroup(groupId, score)` -> scores all present, non-withdrawn students in group `groupId`
  - Updated `App.renderAssessmentTab()` supporting both `'group'` and `'list'` modes

- [x] **Step 1: Add View Switcher bar in `tab-content-assessment` of `app/index.html`**
  Add synchronized view switcher buttons.
- [x] **Step 2: Implement `App.batchScoreGroup(groupId, score)` in `app/js/app.js`**
  Filter students by group. Exclude students who are withdrawn or marked `absent`. Assign score. Re-render.
- [x] **Step 3: Update `renderAssessmentTab()` to render Group Pods when `rosterViewMode === 'group'`**
  Render 5 group pod cards with group batch scoring buttons `[ ให้ 3 ทั้งกลุ่ม ]`, `[ ให้ 2 ทั้งกลุ่ม ]`, `[ ให้ 1 ทั้งกลุ่ม ]`.
- [x] **Step 4: Keep existing flat list rendering when `rosterViewMode === 'list'`**
  Ensure list mode continues to work smoothly.
- [x] **Step 5: Verify in browser and commit**
  Commit with message: `feat: implement 5-group pod view and batch scoring for rubric assessment`.

---

### Task 5: Tab 4 (Submissions) Group Filtering

**Files:**
- Modify: `app/index.html`
- Modify: `app/js/app.js`

**Interfaces:**
- Produces:
  - `App.state.submissionsGroupFilter` ('all' | 1 | 2 | 3 | 4 | 5)
  - `App.setSubmissionsGroupFilter(group)`
  - Updated `App.renderSubmissionsTab()` to apply group filtering

- [x] **Step 1: Add Group Filter pills in `app/index.html` inside `tab-content-submissions`**
  Add pills for `ทั้งหมด`, `กลุ่ม 1`, `กลุ่ม 2`, `กลุ่ม 3`, `กลุ่ม 4`, `กลุ่ม 5`.
- [x] **Step 2: Update `renderSubmissionsTab()` to filter by group**
  Filter submissions according to student group.
- [x] **Step 3: Commit changes**
  Commit with message: `feat: add group filter pills to submissions tab`.

---

### Task 6: Comprehensive Verification & Test Pass

**Files:**
- Test: `tests/verify_group_features.js`

- [x] **Step 1: Write verification script to test all grouping calculations and session saving**
  Verify group assignment for all 40 students across classes.
- [x] **Step 2: Run verification script**
  Run `node tests/verify_group_features.js`.
- [x] **Step 3: Test UI in browser**
  Navigate to Cockpit, toggle view mode, test attendance marking, test group scoring, verify session save.
- [x] **Step 4: Final commit and summary**
  Commit all changes and report to user.
