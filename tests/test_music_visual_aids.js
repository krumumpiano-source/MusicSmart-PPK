// Test Suite: Music Visual Aids Modal - Kalimba & 5-Line Staff Bridge & Rhythm Lab
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
assert(html.includes('id="pane-aids-songs"'), 'Songs pane must exist in modal');
assert(html.includes('id="pane-aids-rhythm"'), 'Rhythm pane must exist in modal');

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

// 6. Tab 3 (Songs Pane) Authentic Classroom Player (User Request: "หน้านี้ซ้ำซ็อนกับหน้าที่มีคาลิมบ้า ถ้าจะมีหน้านนี้ก็ควรเหมือนหน้าที่ใช้เรียนครับ")
assert(appJs.includes('renderAidsSongs('), 'App must define renderAidsSongs');
assert(appJs.includes('KalimbaMedia.mountPeriod(mountEl, \'M1\', cur'), 'renderAidsSongs must mount full classroom player with KalimbaMedia.mountPeriod');
assert(appJs.includes('this._aidsHost.widget.stop()'), 'closeMusicAidsModal and switchTab must stop active widget audio');

// 7. Tab 4: Interactive Rhythm Lab & Note Value Visualizer (User Request: "หาวิธีทำให้หน้านี้มีปนะโยชน์ต่อการเรียนรู้ให่มากที่สุุดและใช้งานได้จริง")
const rhythmPaneStart = html.indexOf('id="pane-aids-rhythm"');
assert(rhythmPaneStart > 0, 'Rhythm pane must exist in index.html');
const rhythmPaneHTML = html.slice(rhythmPaneStart);

// 7.1 Master Header & Global Tempo Controls
assert(rhythmPaneHTML.includes('class="aids-rhythm-banner"'), 'Must have rhythm banner');
assert(rhythmPaneHTML.includes('id="rhythm-tempo-slider"'), 'Must have tempo slider');
assert(rhythmPaneHTML.includes('id="rhythm-tempo-val"'), 'Must have tempo label');
assert(rhythmPaneHTML.includes('onclick="App.stopRhythmAudio()"'), 'Must have stop rhythm audio button');

// 7.2 Section 1: 4 Note & Rest Laboratory Cards with audio and pulse bars
const noteTypes = ['whole', 'half', 'quarter', 'eighth'];
noteTypes.forEach(type => {
  assert(rhythmPaneHTML.includes(`id="card-rhythm-${type}"`), `Must have rhythm card for ${type}`);
  assert(rhythmPaneHTML.includes(`id="pulse-${type}"`), `Must have pulse bar for ${type}`);
  assert(rhythmPaneHTML.includes(`App.playRhythmDuration('${type}', 'sound')`), `Must have sound button for ${type}`);
  assert(rhythmPaneHTML.includes(`App.playRhythmDuration('${type}', 'rest')`), `Must have rest button for ${type}`);
});

// Rest SVGs
assert(rhythmPaneHTML.includes('class="rhythm-rest-svg"'), 'Must render rest graphics');

// 7.3 Section 2: 4/4 Measure Subdivision Tree
assert(rhythmPaneHTML.includes('id="subdiv-row-1"'), 'Must have whole note subdivision row');
assert(rhythmPaneHTML.includes('id="subdiv-row-2"'), 'Must have half note subdivision row');
assert(rhythmPaneHTML.includes('id="subdiv-row-4"'), 'Must have quarter note subdivision row');
assert(rhythmPaneHTML.includes('id="subdiv-row-8"'), 'Must have eighth note subdivision row');
[1, 2, 4, 8].forEach(subdiv => {
  assert(rhythmPaneHTML.includes(`App.playMeasureSubdivision(${subdiv})`), `Must have play button for subdivision ${subdiv}`);
});

// 7.4 Section 3: Curriculum Rhythm Pattern Trainer & Interactive Tap Along
assert(rhythmPaneHTML.includes('id="rhythm-pattern-pills"'), 'Must have pattern selector pills');
['walk', 'half', 'tri_up', 'tri_down', 'syncopated'].forEach(pat => {
  assert(rhythmPaneHTML.includes(`App.selectRhythmPattern('${pat}', this)`), `Must have pill for pattern ${pat}`);
});
for (let i = 1; i <= 4; i++) {
  assert(rhythmPaneHTML.includes(`id="arena-light-${i}"`), `Must have arena light for beat ${i}`);
}
assert(rhythmPaneHTML.includes('onclick="App.playRhythmPatternDemo()"'), 'Must have play pattern demo button');
assert(rhythmPaneHTML.includes('onclick="App.startRhythmTapTrainer()"'), 'Must have start tap trainer button');
assert(rhythmPaneHTML.includes('id="btn-rhythm-tap"'), 'Must have interactive tap target button');
assert(rhythmPaneHTML.includes('onclick="App.onRhythmUserTap()"'), 'Tap button must invoke onRhythmUserTap');

// 7.5 Section 4: Practical Kalimba Playing Guide for Rhythm
assert(rhythmPaneHTML.includes('class="rhythm-tips-grid"'), 'Must have practical kalimba tips grid');

// 7.6 CSS Styles verification
assert(css.includes('.aids-rhythm-banner'), 'CSS must define .aids-rhythm-banner');
assert(css.includes('.rhythm-card'), 'CSS must define .rhythm-card');
assert(css.includes('.pulse-dot.active'), 'CSS must define .pulse-dot.active');
assert(css.includes('.subdiv-block.active-glow'), 'CSS must define .subdiv-block.active-glow');
assert(css.includes('.btn-tap-target.hit-perfect'), 'CSS must define .btn-tap-target.hit-perfect');

// 7.7 JavaScript Engine Implementation
assert(appJs.includes('playRhythmDuration(type, mode)'), 'App must define playRhythmDuration');
assert(appJs.includes('playMeasureSubdivision(subdiv)'), 'App must define playMeasureSubdivision');
assert(appJs.includes('selectRhythmPattern(key, btnEl)'), 'App must define selectRhythmPattern');
assert(appJs.includes('playRhythmPatternDemo()'), 'App must define playRhythmPatternDemo');
assert(appJs.includes('startRhythmTapTrainer()'), 'App must define startRhythmTapTrainer');
assert(appJs.includes('onRhythmUserTap()'), 'App must define onRhythmUserTap');
assert(appJs.includes('stopRhythmAudio()'), 'App must define stopRhythmAudio');
assert(appJs.includes('this.stopRhythmAudio()'), 'closeMusicAidsModal and switchMusicAidsTab must stop active rhythm audio');
assert(appJs.includes('App.onRhythmUserTap()'), 'Global keydown must support Spacebar for rhythm tapping');

console.log('✅ ALL Music Visual Aids (Kalimba, Staff, Authentic Player & Rhythm Lab) tests passed successfully!');
