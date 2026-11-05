# Design Document: Sidebar Navigation & Interface Redesign (MusicSmart T-PACE)

**Date:** 2026-11-05  
**Topic:** Sidebar Navigation Redesign for Teachers & Students  
**Status:** Approved by User, Ready for Implementation Planning  
**Target Files:** `app/index.html`, `app/css/styles.css`, `app/js/app.js`

---

## 1. Context & Problem Statement

### 1.1 The Core Problem
The current header in `app/index.html` suffers from severe horizontal clutter and cognitive overload:
- **Teacher View**: More than 10 action buttons are crammed in a single row alongside branding, semester selector, and subject tabs. Secondary administrative tools (e.g. Google Sheets sync, curriculum hub, admin settings) compete equally with daily in-class tools (dashboard, pull work, cockpit). Several buttons are duplicated both on the header and inside a 13-item popover menu.
- **Student View**: Multiple banners, profile bars, and redundant music tool buttons (metronome, virtual kalimba, notation aids appear in both header and lesson workspace) push core lesson content and task submissions below the fold, creating a confusing experience on mobile devices and tablets.
- **Mobile Experience**: Header elements wrap awkwardly, collapse into stacked rows, and conflict with the existing mobile bottom bar.

### 1.2 The Solution
Transition from the overloaded horizontal header to a modern **Collapsible Responsive Sidebar** architecture with role-adaptive views:
1. **Slim Top Header**: Retains only essential global context: Toggle sidebar button (`☰`), School/App branding, Course/Semester selector, Cloud sync status, User profile chip, and Logout.
2. **Teacher Collapsible Sidebar**: Organizes all teacher functions into 4 clear vertical groups (Active Teaching, Music Tools, Academic & CAR, Settings & Admin). Allows instant collapsing to full-screen width for live classroom instruction (Cockpit mode).
3. **Student Focused Layout**:
   - **Desktop**: Clean minimal sidebar with only 4 core tasks (Lessons, Assignments, Music Studio, My Grades).
   - **Mobile / Tablet**: Pure single-focus view without a bulky sidebar, powered by an intuitive 4-tab Bottom Navigation bar tailored for thumb navigation.
   - Elimination of redundant buttons across the student workspace.

---

## 2. Information Architecture & Navigation Structure

### 2.1 Universal Slim Header (`.app-header`)
- **Left**:
  - Sidebar Toggle Button (`#btn-sidebar-toggle`) with animated hamburger/close icon.
  - School Crest / Logo (`#app-crest-badge`) + Brand Title ("MusicSmart").
  - Role Switcher Pill (`#role-selector-pill`) for verified teachers.
- **Center**:
  - Course Switcher Tabs (`#header-course-nav`) and Semester Indicator (`#btn-semester-trigger`).
- **Right**:
  - Cloud Sync Status Dot (`#cloud-sync-indicator`).
  - Active User Profile Chip (`#instructor-chip` / `#auth-user-badge`).
  - Minimal Logout Button.

---

### 2.2 Teacher Sidebar (`#app-sidebar` in Teacher Mode)
Width: `250px` (Expanded) / `68px` (Collapsed Icon Rail) / `0px` (Hidden on mobile until toggled).

#### Group 1: ⚡ การสอนประจำวัน (Active Teaching)
- 🏠 **หน้าแรก & ห้องเรียน** (`App.showDashboard()`) - Classroom cards (ม.1/1 - ม.1/8)
- ⏱️ **ห้องสอนสด (Cockpit)** (`App.showCockpit()`) - T-PACE timer, attendance, skills assessment, reflection
- 📥 **ดึงงานนักเรียน** (`TeacherPull.pull()`) - Pull submissions & quiz results
- 📅 **ตารางสอนประจำสัปดาห์** (`App.openTimetableModal()`) - Weekly teaching schedule

#### Group 2: 🎵 เครื่องมือดนตรีดิจิทัล (Music Studio)
- 🥁 **เมโทรนอมเคาะจังหวะ** (`Metronome.open()`) - BPM & visual beat tracker
- 🎹 **ห้องซ้อมคาลิมบ้า (Virtual)** (`VirtualKalimba.openModal()`) - 17-key interactive simulator
- 🎺 **สำรวจวงดนตรีเสมือนจริง** (`App.openEnsemble('thai')`) - Thai, Folk & Western ensemble timbre
- 🎼 **สื่อโน้ตสากล & ผังคาลิมบ้า** (`App.openMusicAidsModal()`) - Stave notation, treble clef, round songs

#### Group 3: 📁 งานวิชาการ & วิจัย (Academic & CAR)
- 📚 **คลังแผนการสอน 40 คาบ** (`App.openCurriculumHubModal()`) - M.1 and M.2 lesson plans & units
- 📝 **คลังแบบทดสอบ** (`QuizEngine.openQuizModal(1)`) - Formative & summative question banks
- 🖨️ **รายงาน & ปพ.5 / วก.5** (`OfficialForms.openModal()`) - Official export & printable A4 forms
- 📈 **วิจัยในชั้นเรียน CAR** (`CARAnalytics.openModal()`) - T-test statistics, E1/E2 formulas
- 🏅 **ศูนย์หลักฐาน คศ.4** (`EvidenceHub.open()`) - PA portfolio & professional evidence hub

#### Group 4: ⚙️ ระบบและผู้ใช้งาน (Settings & Admin)
- 👩‍🎓 **นักศึกษาฝึกสอน / นิเทศ** (`MentorPanel.open()`) - Intern supervision & portfolio approval
- 🔄 **ซิงค์คู่ Google Sheets** (`GoogleSheetSync.openModal()`) - Dual-save local + cloud sheets
- 👥 **จัดการผู้ใช้ & รีเซ็ต PIN** (`App.openUserManagementModal('admin')`) - Admin accounts & PIN reset queue
- 📖 **จัดการรายวิชา** (`App.openSubjectsModal()`) - Course codes & room configuration
- 🔧 **ตั้งค่านวัตกรรม T-PACE** (`App.openSettingsModal()`) - School settings & ecosystem parameters

---

### 2.3 Student Layout (`#app-sidebar` in Student Mode & Mobile Views)

#### Desktop Student Sidebar:
1. 📖 **บทเรียน (Lessons)** (`App.navToLessons()`) - 20-period curriculum & learning objectives
2. ✍️ **ภารกิจ & ส่งงาน (Assignments)** (`App.navToAssignments()`) - In-page text answers, video/audio clips, quizzes
3. 🎹 **ห้องซ้อมดนตรี (Music Studio)** (`VirtualKalimba.openModal()`) - Integrated Kalimba & Metronome tools
4. 🏆 **คะแนน & ความก้าวหน้า (My Progress)** (`StudentProgress.open()`) - Attendance rate, formative scores, badges

#### Mobile Bottom Navigation Bar (`#mobile-bottom-nav`):
- 📖 **บทเรียน** (Lesson content)
- ✍️ **ส่งงาน** (Jump straight to submission form / task)
- 🎹 **ห้องซ้อม** (Direct trigger to Virtual Kalimba & Metronome)
- 🏆 **คะแนน** (Progress & attendance modal/view)

#### Student Clutter Elimination:
- Remove redundant duplicate buttons (Metronome/Kalimba/Notation) from the workspace header in `view-student`.
- Consolidate PWA banner into a sleek, dismissible bottom snackbar or non-intrusive prompt.
- Streamline the student profile header to emphasize name, class, room, and assignment status clearly.

---

## 3. UI/UX Specifications & Styling

### 3.1 Layout Dimensions & Breakpoints
- **Desktop (>= 1024px)**:
  - Sidebar default width: `250px`
  - Sidebar collapsed width: `68px` (Icon-only with tooltips)
  - Main workspace: `margin-left` transitions smoothly (`250px` -> `68px` -> `0px`).
  - Cockpit Full-Screen Mode: When entering Cockpit or on user toggle, sidebar can auto-collapse to grant 100% width for teaching projection.
- **Tablet / Mobile (< 1024px)**:
  - Sidebar acts as an off-canvas drawer (`transform: translateX(-100%)`).
  - Drawer overlay backdrop with blur: `backdrop-filter: blur(4px); background: rgba(15, 23, 42, 0.45);`.
  - Hamburger toggle smoothly slides drawer in/out (`transform: translateX(0)`).
  - Mobile bottom nav bar is pinned at bottom with `env(safe-area-inset-bottom)` support.

### 3.2 Visual Styling & Theme Consistency
- **Sidebar Container**:
  - Background: Clean surface (`#ffffff`) or light slate tinted (`#f8fafc`), right border `1px solid var(--border-subtle, #e2e8f0)`.
  - Section headers: Small uppercase, `font-size: 0.72rem; font-weight: 700; color: #64748b; letter-spacing: 0.5px; padding: 0.75rem 1rem 0.25rem;`.
  - Nav items: `border-radius: 8px; padding: 0.5rem 0.75rem; margin: 2px 8px; font-weight: 500; font-size: 0.88rem; display: flex; align-items: center; gap: 0.75rem; color: #334155; transition: all 0.15s ease;`.
  - Active nav item: Background `var(--ppk-navy-light, #eff6ff)`, text `var(--ppk-navy, #1e3a8a)`, font weight `700`, left indicator accent border.
  - Hover: Subtle slate hover background (`#f1f5f9`).

### 3.3 State Persistence
- Save sidebar collapse preference (`ms_sidebar_collapsed: 'true' | 'false'`) in `localStorage`.
- Automatically remember user state across page reloads.

---

## 4. Technical Implementation & Files Affected

### 4.1 `app/index.html`
1. Re-structure top header:
   - Add `#btn-sidebar-toggle` with accessible SVG icon.
   - Clean up `#teacher-actions-group` by moving all tool buttons into the sidebar.
   - Clean up `#student-actions-group` by moving redundant tool buttons into the sidebar/bottom nav.
2. Insert `<aside id="app-sidebar" class="app-sidebar">`:
   - Render teacher navigation groups (`#sidebar-teacher-menu`).
   - Render student navigation items (`#sidebar-student-menu`).
   - Include bottom pin/collapse toggle button at the bottom of the sidebar.
3. Add backdrop element `<div id="sidebar-overlay" class="sidebar-overlay" onclick="App.toggleSidebar(false)"></div>`.
4. Update `main.main-wrapper` layout container to adapt to sidebar margins.
5. In `view-student`: Remove redundant music tool buttons from `.student-workspace-card .workspace-header`.

### 4.2 `app/css/styles.css`
1. Define CSS variables for sidebar widths: `--sidebar-width: 250px; --sidebar-collapsed-width: 68px;`.
2. Add comprehensive `.app-sidebar`, `.sidebar-nav-group`, `.sidebar-nav-item`, `.sidebar-nav-icon`, `.sidebar-nav-label` styles.
3. Add `.sidebar-collapsed` styles:
   - Tooltips on hover for icon-only mode.
   - Centered icons, labels hidden gracefully (`opacity: 0; width: 0; display: none;`).
4. Update media queries:
   - Responsive off-canvas sliding drawer for screens < 1024px.
   - Safe-area insets for mobile and tablets.
   - Proper z-index layering (Sidebar: z-index 50, Overlay: z-index 45, Header: z-index 40).
5. Clean up old header styles that forced wrapping or 10-button row squeezing.

### 4.3 `app/js/app.js`
1. Add sidebar state management:
   - `App.toggleSidebar(forceState)`
   - `App.collapseSidebar(isCollapsed)`
   - `App.initSidebar()` on app boot.
2. Synchronize active state with current route/view (`App.showDashboard()`, `App.showCockpit()`, `App.showStudentPortal()`).
3. Connect all existing modal and tool callbacks directly to sidebar buttons so zero functionality is lost.

---

## 5. Verification & Testing Checklist

- [ ] **Teacher Navigation Verification**:
  - Can access Dashboard, Cockpit, Pull Work, Timetable.
  - Can launch all Music Tools (Metronome, Kalimba, Ensemble, Notation).
  - Can open Academic & CAR tools (Curriculum Hub, Quizzes, Forms/Reports, CAR Analytics, Evidence Hub).
  - Can open System tools (Interns, Sheets Sync, Users/PINs, Subjects, Settings).
- [ ] **Student Navigation Verification**:
  - Can view lessons, read content, submit assignments (text, video/audio links, quizzes).
  - Can access Music Studio without cluttered duplicate buttons.
  - Can check attendance & grades.
- [ ] **Responsiveness & UX**:
  - Desktop: Sidebar expands and collapses smoothly; content area resizes without glitching.
  - Cockpit Mode: Can collapse sidebar for maximum classroom projection visibility.
  - Mobile (<1024px): Hamburger toggles drawer; clicking overlay or any menu item closes drawer; mobile bottom nav works seamlessly.
  - State persistence: Refreshing the browser remembers if the sidebar was collapsed.
  - Zero regression on existing features, audio players, or cloud syncing.

---

