// Test Suite: Screen Wake Lock Manager (ป้องกันหน้าจอดับขณะใช้งานเมโทรนอมหรือคาลิมบ้า)
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'app/sw.js'), 'utf8');
const wakeLockJs = fs.readFileSync(path.join(ROOT, 'app/js/wake-lock.js'), 'utf8');
const vkJs = fs.readFileSync(path.join(ROOT, 'app/js/virtual-kalimba.js'), 'utf8');
const kmJs = fs.readFileSync(path.join(ROOT, 'app/js/kalimba-media.js'), 'utf8');
const atJs = fs.readFileSync(path.join(ROOT, 'app/js/audio-tools.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
const tunerJs = fs.readFileSync(path.join(ROOT, 'app/js/tuner.js'), 'utf8');

console.log('--- Testing Screen Wake Lock Implementation ---');

// 1. Module Logic & Multi-Reason Reference Counting
const ScreenWakeLock = require(path.join(ROOT, 'app/js/wake-lock.js'));
assert(typeof ScreenWakeLock.isSupported === 'function', 'ScreenWakeLock must expose isSupported()');
assert(typeof ScreenWakeLock.isActive === 'function', 'ScreenWakeLock must expose isActive()');
assert(typeof ScreenWakeLock.getActiveReasons === 'function', 'ScreenWakeLock must expose getActiveReasons()');
assert(typeof ScreenWakeLock.request === 'function', 'ScreenWakeLock must expose request()');
assert(typeof ScreenWakeLock.release === 'function', 'ScreenWakeLock must expose release()');
assert(typeof ScreenWakeLock.releaseAll === 'function', 'ScreenWakeLock must expose releaseAll()');

// Initial state
ScreenWakeLock.releaseAll();
assert.strictEqual(ScreenWakeLock.isActive(), false, 'Initially not active');
assert.strictEqual(ScreenWakeLock.getActiveReasons().length, 0, 'No active reasons initially');

// Acquire reason 1: virtual-kalimba
ScreenWakeLock.request('virtual-kalimba');
assert.strictEqual(ScreenWakeLock.isActive(), true, 'Active after virtual-kalimba request');
assert(ScreenWakeLock.getActiveReasons().includes('virtual-kalimba'), 'Reasons must include virtual-kalimba');

// Acquire reason 2: audio-tools-metronome
ScreenWakeLock.request('audio-tools-metronome');
assert.strictEqual(ScreenWakeLock.isActive(), true, 'Still active with 2 reasons');
assert.strictEqual(ScreenWakeLock.getActiveReasons().length, 2, 'Must have 2 reasons');

// Release reason 1: should stay active because reason 2 is still active
ScreenWakeLock.release('virtual-kalimba');
assert.strictEqual(ScreenWakeLock.isActive(), true, 'Must stay active while metronome is still running');
assert.strictEqual(ScreenWakeLock.getActiveReasons().includes('virtual-kalimba'), false, 'virtual-kalimba released');
assert.strictEqual(ScreenWakeLock.getActiveReasons().includes('audio-tools-metronome'), true, 'audio-tools-metronome still active');

// Release reason 2: should become inactive
ScreenWakeLock.release('audio-tools-metronome');
assert.strictEqual(ScreenWakeLock.isActive(), false, 'Inactive after all reasons released');

// Test releaseAll
ScreenWakeLock.request('test-1');
ScreenWakeLock.request('test-2');
assert.strictEqual(ScreenWakeLock.isActive(), true);
ScreenWakeLock.releaseAll();
assert.strictEqual(ScreenWakeLock.isActive(), false);

// 2. HTML and PWA Cache Assets
assert(html.includes('js/wake-lock.js'), 'app/index.html must load js/wake-lock.js');
assert(html.includes('id="vk-wake-lock-badge"'), 'Virtual Kalimba modal must have #vk-wake-lock-badge');
assert(html.includes('id="aids-wake-lock-badge"'), 'Music Visual Aids modal must have #aids-wake-lock-badge');
assert(sw.includes("'./js/wake-lock.js'"), 'app/sw.js must cache ./js/wake-lock.js');

// 3. Virtual Kalimba Integration
assert(vkJs.includes("ScreenWakeLock.request('virtual-kalimba')"), 'VirtualKalimba.openModal must request wake lock');
assert(vkJs.includes("ScreenWakeLock.release('virtual-kalimba')"), 'VirtualKalimba.closeModal must release wake lock');

// 4. KalimbaMedia (Widget & Transport) Integration
assert(kmJs.includes("root.ScreenWakeLock.request('kalimba-media')"), 'KalimbaMedia transport must request wake lock when playing');
assert(kmJs.includes("root.ScreenWakeLock.release('kalimba-media')"), 'KalimbaMedia transport must release wake lock when stopped');

// 5. Standalone Metronome & Audio Tools Integration
assert(atJs.includes("ScreenWakeLock.request('audio-tools-metronome')"), 'AudioTools.startMetronome must request wake lock');
assert(atJs.includes("ScreenWakeLock.release('audio-tools-metronome')"), 'AudioTools.stopMetronome must release wake lock');
assert(atJs.includes("ScreenWakeLock.request('audio-tools-drone')"), 'AudioTools.playDrone must request wake lock');
assert(atJs.includes("ScreenWakeLock.release('audio-tools-drone')"), 'AudioTools.stopDrone must release wake lock');

// 6. Music Visual Aids & Rhythm Lab Integration
assert(appJs.includes("ScreenWakeLock.request('music-visual-aids')"), 'App.openMusicAidsModal must request wake lock');
assert(appJs.includes("ScreenWakeLock.release('music-visual-aids')"), 'App.closeMusicAidsModal must release wake lock');
assert(appJs.includes("ScreenWakeLock.request('rhythm-trainer')"), 'App.startRhythmTapTrainer must request wake lock');
assert(appJs.includes("ScreenWakeLock.release('rhythm-trainer')"), 'App.stopRhythmAudio must release wake lock');

// 7. Tuner Integration
assert(tunerJs.includes("ScreenWakeLock.request('tuner')"), 'Tuner.startListening must request wake lock');
assert(tunerJs.includes("ScreenWakeLock.release('tuner')"), 'Tuner.stopListening must release wake lock');

console.log('✅ ALL Screen Wake Lock tests passed successfully!');

