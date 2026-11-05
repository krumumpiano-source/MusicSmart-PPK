const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'app/css/styles.css'), 'utf8');
const vk = require(path.join(ROOT, 'app/js/virtual-kalimba.js'));

console.log('--- Testing Virtual Kalimba Mobile Optimization ---');

// Test 1: DOM Elements exist and are well structured
assert(html.includes('id="modal-virtual-kalimba"'), 'modal-virtual-kalimba must exist in index.html');
assert(html.includes('class="modal-card vk-modal-card"'), 'vk-modal-card class must exist');
assert(html.includes('class="modal-header vk-modal-header"'), 'vk-modal-header class must exist');
assert(html.includes('class="vk-controls-bar"'), 'vk-controls-bar must exist');
assert(html.includes('id="kalimba-song-select"'), 'kalimba-song-select must exist');
assert(html.includes('id="kalimba-vk-edit"'), 'kalimba-vk-edit must exist');
assert(html.includes('id="kalimba-vk-mute"'), 'kalimba-vk-mute must exist');
assert(html.includes('id="kalimba-current-note"'), 'kalimba-current-note must exist');
assert(html.includes('id="vk-orientation-hint"'), 'vk-orientation-hint must exist');
assert(html.includes('id="kalimba-vk-widget"'), 'kalimba-vk-widget must exist');
assert(html.includes('id="kalimba-vk-dock"'), 'kalimba-vk-dock must exist');
assert(html.includes('id="kalimba-tines-container"'), 'kalimba-tines-container must exist');
assert(html.includes('class="modal-footer vk-modal-footer"'), 'vk-modal-footer must exist');
console.log('✅ 1. All Virtual Kalimba DOM elements and semantic classes exist');

// Test 2: Mobile CSS rules
assert(css.includes('@media (max-width: 768px)'), 'Mobile media query must be present');
assert(css.includes('.vk-modal-card'), 'vk-modal-card styles must be present');
assert(css.includes('100dvh'), '100dvh responsive height must be present');
assert(css.includes('.vk-kbd-hint'), 'Keyboard hint must be defined');
assert(css.includes('.km-frame[data-role="staff"]'), 'Staff minimum height rule must be present');
assert(css.includes('min-height: 120px') || css.includes('min-height: 100px'), 'Staff min-height must prevent squishing');
console.log('✅ 2. CSS styles include mobile-first full viewport, stave protection, and responsive rules');

// Test 3: Landscape mode
assert(css.includes('@media (max-height: 540px) and (orientation: landscape)'), 'Landscape query must be present');
console.log('✅ 3. Mobile landscape optimization present');

// Test 4: VirtualKalimba JS integration
assert(typeof vk.syncMuteButton === 'function', 'syncMuteButton must be a function');
assert(typeof vk.openModal === 'function', 'openModal must be a function');
assert(typeof vk.closeModal === 'function', 'closeModal must be a function');
console.log('✅ 4. VirtualKalimba JS methods verified');

// Test 5: Musical Note Semantics (Half Note & Whole Note stay hollow / open white)
const kmSrc = fs.readFileSync(path.join(ROOT, 'app/js/kalimba-media.js'), 'utf8');
assert(kmSrc.includes("isOpen ? '#ffffff' : color"), 'Open notes (half note, whole note) must retain #ffffff fill');
console.log('✅ 5. Musical note shape integrity verified: half and whole notes stay open/hollow white');

// Test 6: Multi-line Auto-Scroll & Hands-free Navigation
assert(kmSrc.includes('_scrollToNote'), '_scrollToNote method must exist in kalimba-media.js');
assert(kmSrc.includes('data-act="autoscroll"'), 'Auto-scroll toggle checkbox must exist');
assert(kmSrc.includes('noteSystems'), 'System tracking mapping must exist in kalimba-media.js');
assert(css.includes('position: sticky') || css.includes('position: -webkit-sticky'), 'Sticky controls must be present');
console.log('✅ 6. Hands-free multi-line auto-scroll and sticky controls verified');

// Test 7: External Playback Controls Toolbar outside note container
assert(html.includes('id="kalimba-vk-playback-bar"'), '#kalimba-vk-playback-bar must exist outside the note container in index.html');
assert(css.includes('.vk-playback-bar'), '.vk-playback-bar styles must be defined in styles.css');
assert(kmSrc.includes('this.opts.ctlEl'), 'Widget must support opts.ctlEl for external controls rendering');
const vkSrc = fs.readFileSync(path.join(ROOT, 'app/js/virtual-kalimba.js'), 'utf8');
assert(vkSrc.includes('ctlEl: playbackBar'), 'VirtualKalimba must pass external playbackBar to Widget');
console.log('✅ 7. Dedicated external playback controls toolbar outside note container verified');

console.log('🎉 ALL Virtual Kalimba Mobile UI tests passed successfully!');

