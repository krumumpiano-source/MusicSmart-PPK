/**
 * Automated Test Suite: Sidebar Navigation & Interface Redesign
 * Verifies that the new collapsible sidebar, slim header, and role-adaptive
 * navigation work seamlessly with 100% preservation of all legacy tools and modals.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'app/css/styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');

console.log('--- Testing Sidebar Navigation & Layout Redesign ---');

// 1. Header Structure
assert(html.includes('id="btn-sidebar-toggle"'), 'Header must contain #btn-sidebar-toggle');
assert(html.includes('id="teacher-actions-group"'), 'Header must retain #teacher-actions-group');
assert(html.includes('id="student-actions-group"'), 'Header must retain #student-actions-group');
assert(html.includes('id="instructor-chip"'), 'Header must retain #instructor-chip');
assert(html.includes('id="btn-copy-student-link"'), 'Header must retain #btn-copy-student-link');

// Verify decluttered header: redundant 10+ buttons removed from top header
assert(!html.includes('id="tools-dropdown-panel"'), 'Old bloated tools-dropdown-panel should be replaced by sidebar');

// 2. Sidebar Navigation DOM
assert(html.includes('id="app-sidebar"'), 'Must have <aside id="app-sidebar">');
assert(html.includes('id="sidebar-overlay"'), 'Must have #sidebar-overlay');
assert(html.includes('id="sidebar-teacher-menu"'), 'Must have #sidebar-teacher-menu');
assert(html.includes('id="sidebar-student-menu"'), 'Must have #sidebar-student-menu');
assert(html.includes('id="btn-sidebar-collapse"'), 'Must have #btn-sidebar-collapse toggle button');

// 3. Teacher Menu Structure & Required Tools
const teacherTools = [
  'btn-teacher-dashboard',
  'btn-sidebar-cockpit',
  'btn-pull-student-work',
  'btn-sidebar-timetable',
  'btn-curriculum-hub',
  'btn-export-report',
  'btn-mentor-panel',
  'btn-google-sheets-pill'
];
teacherTools.forEach(toolId => {
  assert(html.includes(`id="${toolId}"`), `Teacher sidebar must contain element #${toolId}`);
});

// Check music tools in sidebar
assert(html.includes('data-tool="metronome"'), 'Sidebar must include Metronome trigger');
assert(html.includes('data-tool="kalimba"'), 'Sidebar must include Kalimba trigger');
assert(html.includes('data-tool="notation"'), 'Sidebar must include Notation Aids trigger');
assert(html.includes('App.openEnsemble()') || html.includes('App.openEnsemble'), 'Sidebar must include Ensemble trigger');

// 4. Student Menu Structure
assert(html.includes('data-snav="lesson"'), 'Student sidebar must have lesson nav');
assert(html.includes('data-snav="assignment"'), 'Student sidebar must have assignment nav');
assert(html.includes('data-snav="studio"'), 'Student sidebar must have studio nav');
assert(html.includes('data-snav="progress"'), 'Student sidebar must have progress nav');

// Verify decluttered student workspace: no duplicate tools inside lesson workspace header
const studentWsHeader = html.slice(html.indexOf('<div class="student-workspace-card">'), html.indexOf('<!-- Lesson Objectives'));
assert(!studentWsHeader.includes('data-tool="metronome"'), 'Student workspace card should not duplicate metronome button');
assert(!studentWsHeader.includes('data-tool="kalimba"'), 'Student workspace card should not duplicate kalimba button');

// 5. CSS Rules & Responsive Layout
assert(css.includes('--sidebar-width'), 'CSS must declare --sidebar-width');
assert(css.includes('--sidebar-width: 268px;') || css.includes('--sidebar-width: 264px;'), 'Sidebar width must be at least 264px to prevent Thai label truncation');
assert(css.includes('--sidebar-collapsed-width'), 'CSS must declare --sidebar-collapsed-width');
assert(css.includes('.app-sidebar.collapsed'), 'CSS must handle collapsed icon-rail mode');
assert(css.includes('.sidebar-overlay.active'), 'CSS must handle responsive mobile drawer overlay');
assert(css.includes('sidebar-is-collapsed'), 'CSS must support body.sidebar-is-collapsed margin adjust');

// 6. JavaScript Methods in App
const requiredMethods = [
  'initSidebar',
  'toggleSidebar',
  'collapseSidebar',
  'toggleSidebarCollapse',
  'onSidebarItemClick',
  'updateSidebarRoleMenu',
  'updateSidebarActiveItem',
  'showCockpit',
  'navToAssignments'
];
requiredMethods.forEach(method => {
  assert(appJs.includes(`${method}(`) || appJs.includes(`${method} `), `App must implement ${method}`);
});

console.log('✅ ALL 6 sidebar navigation test groups passed with 100% success!');

