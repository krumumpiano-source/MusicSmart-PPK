# Sidebar Navigation & Interface Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the cluttered horizontal header into a clean, collapsible sidebar navigation with role-adaptive menus for teachers and students, eliminating visual clutter and redundant buttons.

**Architecture:** A modern slim sticky topbar paired with a collapsible responsive sidebar (expanded 250px / collapsed 68px on desktop, off-canvas drawer on mobile <1024px). Student views are decluttered with redundant tools removed from the lesson workspace and organized into 4 primary views. State persistence is handled via `localStorage`.

**Tech Stack:** Vanilla JavaScript (ES5/ES6 compatible), CSS3 Flexbox/Grid with CSS variables, Semantic HTML5.

## Global Constraints
- Target files: `app/index.html`, `app/css/styles.css`, `app/js/app.js`.
- Preserve all existing modal triggers, callbacks, and data attributes (e.g., `data-tool="metronome"`, `data-tool="kalimba"`).
- Maintain legacy browser compatibility (guarded by `ms-legacy-guard`).
- Sidebar collapsed state must persist across sessions via `localStorage.getItem('ms_sidebar_collapsed')`.
- Mobile/Tablet (<1024px) drawer must close automatically on item selection or overlay click.

---

### Task 1: Add HTML Structure for Universal Slim Header and Collapsible Sidebar

**Files:**
- Modify: `app/index.html`

**Interfaces:**
- Produces: 
  - `#btn-sidebar-toggle`: Button to toggle sidebar drawer / collapse.
  - `#app-sidebar`: Main `<aside>` navigation container.
  - `#sidebar-teacher-menu`: 4-group categorized menu for teachers.
  - `#sidebar-student-menu`: 4-item clean navigation for students.
  - `#sidebar-overlay`: Backdrop for mobile off-canvas drawer.
  - `#btn-sidebar-collapse`: Toggle button inside sidebar footer for icon-only collapse.

- [ ] **Step 1: Inspect and update `.app-header` in `app/index.html`**
  Add `#btn-sidebar-toggle` at the start of `.brand-section`. Remove the overcrowded buttons from `#teacher-actions-group` (which will be moved to the sidebar) while preserving the user profile chip, logout button, role selector pill, and cloud sync indicator.

- [ ] **Step 2: Insert the `<aside id="app-sidebar">` and `#sidebar-overlay` elements**
  Add the sidebar immediately following `.app-header`. Include the 4 structured groups for teachers (การสอนประจำวัน, เครื่องมือดนตรีดิจิทัล, งานวิชาการ & วิจัย, จัดการระบบ) and the simplified student menu, with exact icons, labels, and `onclick` handlers matching the design spec.

- [ ] **Step 3: Remove duplicate music tool buttons from `view-student`**
  In `.student-workspace-card .workspace-header`, remove the redundant inline buttons for Metronome, Kalimba, and Music Aids (which now live cleanly in the sidebar and bottom navigation), decluttering the student lesson view.

- [ ] **Step 4: Verify HTML syntax and element IDs**
  Run a syntax check or regex check to ensure all tags are closed properly and IDs match existing JS selectors.

- [ ] **Step 5: Commit HTML changes**
  `git commit -m "feat(nav): add sidebar and slim header structure in index.html"`

---

### Task 2: Implement Comprehensive CSS Styling for Sidebar, Slim Header, and Responsive Breakpoints

**Files:**
- Modify: `app/css/styles.css`

**Interfaces:**
- Consumes: `#app-sidebar`, `#sidebar-overlay`, `.app-header`, `.main-wrapper`, `.sidebar-nav-item`, `.sidebar-collapsed`.
- Produces: Responsive styling for desktop (>=1024px fixed sidebar & collapsed mode) and mobile (<1024px off-canvas drawer).

- [ ] **Step 1: Define CSS variables and base layout transitions**
  Define `--sidebar-width: 250px; --sidebar-collapsed-width: 68px; --header-height: 56px;` in `:root`. Ensure `.main-wrapper` smoothly transitions its `margin-left`.

- [ ] **Step 2: Style `.app-sidebar` and navigation items**
  Add styles for:
  - `.app-sidebar`: Sticky below header or full height, surface background, subtle border, smooth width transition.
  - `.sidebar-nav-group` & `.sidebar-group-title`: Clean typography, uppercase, muted color.
  - `.sidebar-nav-item`: Pill/tile styling, flex layout, hover effects, active indicator.
  - `.sidebar-collapse-toggle`: Footer toggle with rotating chevron icon.

- [ ] **Step 3: Implement `.sidebar-collapsed` (Icon-Rail) mode**
  When `#app-sidebar` has `.collapsed`:
  - Width shrinks to `68px`.
  - Item labels hide (`opacity: 0; width: 0; display: none;`).
  - Icons are centered with tooltips on hover.
  - `.main-wrapper` adjusts `margin-left: var(--sidebar-collapsed-width);`.

- [ ] **Step 4: Implement responsive mobile/tablet drawer (<1024px)**
  - Sidebar defaults to `position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); z-index: 1000;`.
  - When `.sidebar-open`, `transform: translateX(0);` with box shadow.
  - `.sidebar-overlay` with backdrop blur and fade transition.
  - `.main-wrapper` margin remains `0`.
  - Bottom navigation bar stays anchored for students with safe area padding.

- [ ] **Step 5: Verify CSS rendering and transitions**
  Verify there are no layout shifts or broken z-indexes with existing modals (modals must remain above sidebar).

- [ ] **Step 6: Commit CSS changes**
  `git commit -m "style(nav): add styles for collapsible sidebar, slim header, and responsive drawer"`

---

### Task 3: Implement JavaScript Sidebar Logic and View Synchronization in `app/js/app.js`

**Files:**
- Modify: `app/js/app.js`

**Interfaces:**
- Produces:
  - `App.initSidebar()`: Initializes sidebar state from `localStorage` and binds event listeners.
  - `App.toggleSidebar(forceState)`: Toggles mobile drawer or desktop collapse.
  - `App.collapseSidebar(isCollapsed)`: Explicit collapse toggle with `localStorage` persistence.
  - `App.updateSidebarActiveItem(viewName)`: Syncs active menu highlight when switching views.
  - `App.navToAssignments()` & `App.navToLessons()`: Student navigation shortcuts.

- [ ] **Step 1: Add sidebar state management functions to `App`**
  Implement `initSidebar`, `toggleSidebar`, `collapseSidebar`, and keyboard shortcut (`Ctrl + B` or `Cmd + B` to toggle collapse).

- [ ] **Step 2: Sync role switching with sidebar visibility**
  Update `App.switchRole(role)` to show `#sidebar-teacher-menu` when role is `teacher`, and `#sidebar-student-menu` when role is `student`.

- [ ] **Step 3: Update view change functions to sync sidebar active state**
  In `App.showDashboard()`, `App.showCockpit()`, `App.renderStudentPortal()`, update the active item highlight in the sidebar. Automatically auto-collapse sidebar when entering Cockpit mode on medium screens for optimal teaching space.

- [ ] **Step 4: Hook into `App.init()` on startup**
  Ensure `App.initSidebar()` is invoked during application bootstrap.

- [ ] **Step 5: Commit JavaScript changes**
  `git commit -m "feat(nav): implement sidebar state management, persistence, and role sync in app.js"`

---

### Task 4: Automated Verification & Manual Sanity Testing

**Files:**
- Test / Verify: `tests/test_sidebar_navigation.js` (create if needed or run verification script)

- [ ] **Step 1: Write an automated verification script to validate sidebar DOM and callbacks**
  Verify that all 15+ tool triggers (Metronome, Kalimba, CAR, Google Sheets, etc.) have functional bindings and elements exist in DOM.

- [ ] **Step 2: Execute verification script and run existing test suite**
  Run `node tests/test_local_server.js` or custom verification script to ensure zero runtime regressions.

- [ ] **Step 3: Test responsive viewport states**
  Verify behavior on Desktop (>=1024px), Tablet (768px-1023px), and Mobile (<768px).

- [ ] **Step 4: Commit any test scripts and wrap up verification**
  `git commit -m "test(nav): verify sidebar navigation elements and functionality"`

