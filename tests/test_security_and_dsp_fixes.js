// Tests for Phase 0 & Phase 1 security, performance, and DSP fixes
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 1. Tuner DSP tests: McLeod NSDF pitch detection (accuracy, zero NaN, speed)
const Tuner = require('../app/js/tuner.js');

function makeSine(freq, sampleRate, len) {
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    buf[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

function makeHarmonicTone(freq, sampleRate, len) {
  // Rich harmonic tone with strong 2nd & 3rd harmonics (tests fundamental locking vs octave error)
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    buf[i] = 0.55 * Math.sin(2 * Math.PI * freq * t)
      + 0.45 * Math.sin(2 * Math.PI * freq * 2.0 * t)
      + 0.20 * Math.sin(2 * Math.PI * freq * 3.0 * t);
  }
  return buf;
}

const SR = 48000;
const targets = [261.63, 440.0, 1318.51];
for (const target of targets) {
  for (const sig of [makeSine(target, SR, 2048), makeHarmonicTone(target, SR, 2048)]) {
    const detected = Tuner.detectPitch(sig, SR);
    assert(Number.isFinite(detected) && detected > 0, `expected valid pitch for ${target} Hz, got ${detected}`);
    const cents = Math.abs(1200 * Math.log2(detected / target));
    assert(cents <= 5, `pitch accuracy within +-5 cents for ${target} Hz (got ${detected.toFixed(2)} Hz, ${cents.toFixed(2)} cents)`);
  }
}

// Silence and noise must return -1 and never NaN
assert.strictEqual(Tuner.detectPitch(new Float32Array(2048), SR), -1, 'silence returns -1');
const deterministicNoise = new Float32Array(2048);
let seed = 1337;
for (let i = 0; i < deterministicNoise.length; i++) {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  deterministicNoise[i] = ((seed / 0xffffffff) * 2 - 1) * 0.4;
}
const noiseOut = Tuner.detectPitch(deterministicNoise, SR);
assert(!Number.isNaN(noiseOut), 'noise never produces NaN');
assert.strictEqual(noiseOut, -1, 'white noise returns -1');

// Speed check: 20 frames must complete quickly
const benchSig = makeHarmonicTone(440.0, SR, 2048);
const tStart = Date.now();
for (let i = 0; i < 20; i++) Tuner.detectPitch(benchSig, SR);
const elapsed = Date.now() - tStart;
assert(elapsed < 200, `20 pitch frames should run fast (took ${elapsed} ms)`);

// 2. index.html fixes: no synchronous academic_docs.js, Recording.open uses studentPeriod/selectedPeriod
const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
assert(!/<script[^>]+data\/academic_docs\.js/.test(html), 'index.html must lazy-load academic_docs.js instead of blocking startup');
assert(!/App\.state\.period\b/.test(html), 'index.html must not reference nonexistent App.state.period');
assert(/App\.state\.studentPeriod\s*\|\|\s*App\.state\.selectedPeriod/.test(html), 'Recording.open must pass studentPeriod || selectedPeriod');

// 3. Service Worker does not precache 4.56 MB academic_docs.js
const sw = fs.readFileSync(path.join(ROOT, 'app/sw.js'), 'utf8');
assert(!/academic_docs\.js/.test(sw), 'sw.js must not precache academic_docs.js');

// 4. Zero X-Admin-App auth bypass remnants
const cloudApiSrc = fs.readFileSync(path.join(ROOT, 'app/js/cloud-api.js'), 'utf8');
const workerSrc = fs.readFileSync(path.join(ROOT, 'cloudflare-api/src/index.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'app/js/app.js'), 'utf8');
assert(!/X-Admin-App/.test(cloudApiSrc), 'cloud-api.js must not send X-Admin-App');
assert(!/X-Admin-App/.test(workerSrc), 'cloudflare-api/src/index.js must not check X-Admin-App');
assert(!/\?app=musicsmart/.test(appSrc), 'app.js must not use ?app=musicsmart anonymous bypass');

console.log('test_security_and_dsp_fixes: ALL CHECKS PASSED (20 frames in ' + elapsed + ' ms)');

// 5. Phase 2 & 3 checks: strip_quiz_answers, lazy GAS template, AudioEngine, UiDialogs, repo hygiene
const os = require('os');
const vm = require('vm');
const { stripQuizFile } = require('../tools/build/strip_quiz_answers');

// 5a. strip_quiz_answers on temporary copy leaves source untouched
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-quiz-'));
try {
  const srcQuizPath = path.join(ROOT, 'app/data/quizzes.js');
  const tmpQuizPath = path.join(tmpDir, 'quizzes.js');
  fs.copyFileSync(srcQuizPath, tmpQuizPath);
  const stripRes = stripQuizFile(tmpQuizPath);
  assert(stripRes.questions === 40 && stripRes.units === 4, 'stripQuizFile counts all 40 questions');
  const strippedSrc = fs.readFileSync(tmpQuizPath, 'utf8');
  assert(!/"correct"\s*:/.test(strippedSrc), 'stripped quizzes.js removes all correct keys');
  assert(!/"explanation"\s*:/.test(strippedSrc), 'stripped quizzes.js removes all explanation keys');
  assert(strippedSrc.includes('QUIZZES_ANSWERS_STRIPPED = true'), 'stripped quizzes.js sets flag');
  const origQuizSrc = fs.readFileSync(srcQuizPath, 'utf8');
  assert(/"correct"\s*:/.test(origQuizSrc), 'source app/data/quizzes.js retains answer keys');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// 5b. GAS template split from app/js/google-sheet-sync.js
const syncJsPath = path.join(ROOT, 'app/js/google-sheet-sync.js');
const gasTplPath = path.join(ROOT, 'app/data/gas_template.js');
assert(fs.statSync(syncJsPath).size < 50 * 1024, 'google-sheet-sync.js is compact (< 50 KB) without inline 174 KB GAS template');
assert(fs.existsSync(gasTplPath) && fs.statSync(gasTplPath).size > 100 * 1024, 'gas_template.js holds extracted GAS template');
const GoogleSheetSync = require('../app/js/google-sheet-sync.js');
const realGas = fs.readFileSync(path.join(ROOT, 'google_apps_script.js'), 'utf8');
const gasVerMatch = /var GAS_VERSION = '([^']+)';/.exec(realGas);
assert(gasVerMatch && GoogleSheetSync.expectedGasVersion() === gasVerMatch[1], 'expectedGasVersion matches google_apps_script.js');
assert(GoogleSheetSync.APPS_SCRIPT_CODE.includes("var GAS_VERSION = '"), 'GoogleSheetSync.APPS_SCRIPT_CODE getter resolves in Node');

// 5c. AudioEngine singleton & recreation if closed
let createdCount = 0;
class FakeAudioContext {
  constructor() { createdCount++; this.state = 'suspended'; this.resumeCalls = 0; }
  resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
}
const aeCtx = { window: { AudioContext: FakeAudioContext }, globalThis: {}, module: { exports: {} } };
aeCtx.globalThis = aeCtx.window;
vm.createContext(aeCtx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js/audio-engine.js'), 'utf8'), aeCtx);
const AE = aeCtx.window.AudioEngine;
const c1 = AE.getContext();
const c2 = AE.getContext();
assert(c1 === c2 && createdCount === 1, 'AudioEngine.getContext returns singleton instance');
c1.state = 'closed';
const c3 = AE.getContext();
assert(c3 !== c1 && createdCount === 2, 'AudioEngine.getContext recreates only if closed');

// 5d. UiDialogs exports & non-throwing notify
const UiDialogs = require('../app/js/ui-dialogs.js');
assert(typeof UiDialogs.toast === 'function' && typeof UiDialogs.enhanceAccessibility === 'function', 'UiDialogs exports toast and enhanceAccessibility');

// 5e. Repo hygiene: dead Postgres SQL archived & root clean
assert(!fs.existsSync(path.join(ROOT, 'app/data/schema_postgres_supabase.sql')), 'dead Postgres SQL moved out of app/data/');
assert(fs.existsSync(path.join(ROOT, 'docs/archive/schema_postgres_supabase.sql')), 'Postgres SQL archived in docs/archive/');
const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isFile());
assert(rootFiles.length <= 15, `repo root stays clean (<= 15 files, got ${rootFiles.length})`);

console.log('test_security_and_dsp_fixes (extended Phase 2+3): ALL CHECKS PASSED');
