// Test Suite: Music Visual Aids Modal - Kalimba & 5-Line Staff Bridge
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'app/css/styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');

console.log('--- Testing Standard Music Notation & Kalimba Visualizer Integration ---');

// 1. Modal & Navigation Tabs
assert(html.includes('id="modal-music-visual-aids"'), 'Modal must exist in index.html');
assert(html.includes('id="pane-aids-staff"'), 'Staff pane must exist in modal');
assert(html.includes('id="pane-aids-kalimba"'), 'Kalimba pane must exist in modal');

// 2. Staff Pane Kalimba Soundboard (User Request: "หน้านี้ควรมีลิ่มคาลิมบ้าให้เห็นด้วย")
const staffPaneStart = html.indexOf('id="pane-aids-staff"');
const staffPaneEnd = html.indexOf('id="pane-aids-kalimba"');
assert(staffPaneStart > 0 && staffPaneEnd > staffPaneStart, 'Staff pane boundary valid');
const staffPaneHTML = html.slice(staffPaneStart, staffPaneEnd);

assert(staffPaneHTML.includes('class="aids-kalimba-board"'), 'Staff pane must include the 17-tine Kalimba visualizer board');
assert(staffPaneHTML.includes('class="aids-bridge-bar"'), 'Staff pane kalimba board must have metal bridge bar');
assert(staffPaneHTML.includes('class="aids-tines-row"'), 'Staff pane kalimba board must have tines row');

// Verify all 17 tines in staff pane
const TINES_17 = ['D6', 'B5', 'G5', 'E5', 'C5', 'A4', 'F4', 'D4', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'E6'];
TINES_17.forEach(note => {
  assert(staffPaneHTML.includes(`data-note="${note}"`), `Staff pane kalimba must have tine for note ${note}`);
});

// Center tine verification
assert(staffPaneHTML.includes('tine-center" data-note="C4"'), 'Center tine must be C4 with tine-center class');

// 3. SVG Staff Interactive Notes
const STAFF_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'];
STAFF_NOTES.forEach(note => {
  assert(staffPaneHTML.includes(`data-note="${note}"`), `SVG staff must have interactive note for ${note}`);
});

// 4. CSS Rules for Staff & Kalimba Interaction
assert(css.includes('.aids-kalimba-board'), 'CSS must define .aids-kalimba-board');
assert(css.includes('.aids-tine.active-hit'), 'CSS must define .aids-tine.active-hit');
assert(css.includes('.interactive-note.note-highlight'), 'CSS must define .interactive-note.note-highlight');

// 5. JavaScript playAidsNote Implementation
assert(appJs.includes('playAidsNote(note)'), 'App must define playAidsNote method');
assert(appJs.includes('VirtualKalimba.playNote(note)'), 'playAidsNote must invoke VirtualKalimba.playNote');
assert(appJs.includes('#svg-music-staff .interactive-note[data-note='), 'playAidsNote must highlight SVG staff note');
assert(appJs.includes('.aids-tine[data-note='), 'playAidsNote must highlight matching kalimba tines');

console.log('✅ ALL Music Visual Aids Kalimba & Staff tests passed successfully!');
