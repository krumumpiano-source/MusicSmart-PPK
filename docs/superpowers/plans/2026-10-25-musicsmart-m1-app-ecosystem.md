# MusicSmart M.1 Digital Learning Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive, high-engagement digital learning and assessment ecosystem for Grade 7 Music (ศ21101 ดนตรี 1) at Phayaophitthayakhom School, featuring an interactive practice studio with microphone pitch/rhythm detection, a creative lyric studio with anti-plagiarism guards, an ensemble explorer, and a rapid teacher cockpit for 40-student classrooms.

**Architecture:** Client-side Progressive Web App (PWA) built on modern Web standards, utilizing the Web Audio API for synthetic kalimba timbre and precision metronome scheduling (70-75 BPM), Autocorrelation for microphone pitch/rhythm detection, LocalStorage/IndexedDB for offline-first persistence, and a high-efficiency assessment UI featuring Preset All-Pass and Group-to-Individual Cascade scoring.

**Tech Stack:** HTML5, Vanilla JavaScript (ES6+ Modules), Vanilla CSS Design System, Web Audio API, Service Worker (PWA Offline-First), PyThaiNLP / Word Break Utilities.

## Global Constraints

- Must fully align with the official 20-period curriculum, 4 units, and 100-point total score (K:30, P:50, A:20) of ศ21101 ดนตรี 1.
- Instrument classifications must strictly adhere to Thai 4 categories (ดีด, สี, ตี, เป่า) and Western 5 categories (สาย, เป่าลมไม้, เป่าทองเหลือง, ลิ่มนิ้ว, กระทบ).
- Practice studio must enforce the Golden Rule: "Chant Solfege notes and clap rhythm before playing".
- Song repertoire is strictly Song 1 (*Ode to Joy* - 5 notes C to G) and Song 2 (*Do-Re-Mi* - 8 notes C4 to C5).
- All student tools must work seamlessly offline on mobile browsers (iOS Safari, Android Chrome).
- Teacher cockpit must allow grading a class of 40 students within 2-3 minutes.

---

### Task 1: Precision Web Audio Metronome & Synthetic Kalimba Timbre

**Files:**
- Modify: `app/js/audio-tools.js`
- Modify: `app/js/virtual-kalimba.js`
- Test: `scratch/test_audio_engine.js`

**Interfaces:**
- Produces: `AudioTools.startMetronome(bpm, onTickCallback)`, `AudioTools.stopMetronome()`, `AudioTools.playKalimbaNote(noteName, duration)`, `AudioTools.setGuideMuted(isMuted)`

- [ ] **Step 1: Write test script for metronome lookahead scheduler and kalimba pitch frequencies**
- [ ] **Step 2: Implement precision lookahead scheduler (70-75 BPM) using `audioContext.currentTime` in `app/js/audio-tools.js`**
- [ ] **Step 3: Implement realistic synthetic kalimba physical modeling (sine/triangle oscillator + exponential decay filter + bell harmonic shimmer) in `app/js/virtual-kalimba.js`**
- [ ] **Step 4: Implement Guide Audio Mute toggle (`AudioTools.setGuideMuted(bool)`)**
- [ ] **Step 5: Run tests and verify zero-drift timing at 70 and 75 BPM**

---

### Task 2: Smart Practice Studio UI & Synchronized Dual-Notation Playhead

**Files:**
- Modify: `app/js/student-practice.js`
- Modify: `app/index.html`
- Modify: `app/css/style.css`

**Interfaces:**
- Consumes: `AudioTools.startMetronome`, `AudioTools.playKalimbaNote`
- Produces: `StudentPractice.loadSong(songId)`, `StudentPractice.togglePlay()`, `StudentPractice.onBeatTick(beatIndex)`

- [ ] **Step 1: Build dual-notation canvas in `app/index.html` (Western 5-line staff above, Thai 8-bar table with Solfege below)**
- [ ] **Step 2: Add song definitions for Scales (C Major 4-2-1), Intervals (Root, 3rd, 4th, Sequence), *Ode to Joy*, and *Do-Re-Mi* in `app/js/student-practice.js`**
- [ ] **Step 3: Implement animated Playhead line smoothly jumping to active note head on each beat tick**
- [ ] **Step 4: Connect Mute Toggle button (🔊 Guide Mode vs 🔇 Solo Practice Mode) with visual indicator**
- [ ] **Step 5: Test playhead synchronization with 70 BPM metronome in browser**

---

### Task 3: Real-Time Microphone Pitch & Rhythm Detector (Mic Evaluator)

**Files:**
- Modify: `app/js/tuner.js`
- Modify: `app/js/student-practice.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: `navigator.mediaDevices.getUserMedia`
- Produces: `Tuner.startListening(callback)`, `StudentPractice.evaluateIncomingNote(detectedPitch, detectedTime)`

- [ ] **Step 1: Implement normalized autocorrelation algorithm in `app/js/tuner.js` tuned for Kalimba fundamental frequencies (260 Hz to 530 Hz)**
- [ ] **Step 2: Implement Onset / Transient detection to capture the exact strike time of the tine**
- [ ] **Step 3: Compare detected pitch and timestamp against the expected score note with ±120ms window**
- [ ] **Step 4: Render real-time visual hit markers over the note in `student-practice.js`: 🟢 Perfect, 🟡 Early/Late, 🔴 Wrong Key, ⚪ Miss**
- [ ] **Step 5: Log session practice score (accuracy %) to student's LocalStorage practice history**

---

### Task 4: Lyric Studio with Syllable-Note Mapping & Anti-Plagiarism Gate

**Files:**
- Modify: `app/js/student-submit.js`
- Modify: `app/index.html`
- Modify: `app/css/style.css`

**Interfaces:**
- Produces: `StudentSubmit.saveDraftLyrics(songId, syllables)`, `StudentSubmit.submitGroupLyrics(groupId, songId)`, `StudentSubmit.checkPlagiarism(text)`

- [ ] **Step 1: Create Syllable-Note Mapping UI under *Ode to Joy* (16 bars) and *Do-Re-Mi* (16 bars) with per-note text input fields**
- [ ] **Step 2: Add auto-counter validating that syllables match rhythmic notes without overflowing**
- [ ] **Step 3: Implement Blind Submission Gate: lock peer gallery view until current group's status is 'SUBMITTED'**
- [ ] **Step 4: Implement text similarity checker (Jaccard token comparison) rejecting lyrics with >70% overlap with existing submissions**
- [ ] **Step 5: Enable peer viewing gallery with playback and inspiration like button (❤️) upon successful submission**

---

### Task 5: Interactive Ensemble Explorer (Thai, Regional Folk & Western Ensembles)

**Files:**
- Modify: `app/js/audio-tools.js`
- Modify: `app/index.html`
- Modify: `app/css/style.css`

**Interfaces:**
- Produces: `EnsembleExplorer.renderEnsemble(ensembleFamily, ensembleType)`, `EnsembleExplorer.setTier(tierLevel)`, `EnsembleExplorer.soloInstrument(id)`

- [ ] **Step 1: Build Thai & Folk Ensembles Explorer: วงปี่พาทย์ (ไม้แข็ง, ไม้นวม, มอญ), วงเครื่องสาย (วงเล็ก, เครื่องคู่, ผสม), วงมโหรี, และวงพื้นบ้าน 4 ภาค (สะล้อซอซึงล้านนา, โปงลางอีสาน, กลองยาว, รองเง็ง)**
- [ ] **Step 2: Build Western Ensembles Explorer: Symphony Orchestra, Concert & Marching Band, Chamber Music (String Quartet), Jazz & Big Band, และ Pop-Rock Band (สตริงคอมโบ)**
- [ ] **Step 3: Render Virtual Seating Charts showing exact stage positions and roles: เครื่องนำ, เครื่องตาม, เครื่องจังหวะ (สำหรับวงไทย) และ Strings, Woodwinds, Brass, Percussion (สำหรับวงสากล)**
- [ ] **Step 4: Implement Spatial Acoustic Mixer with Solo / Mute controls for comparative Timbre and balance study**
- [ ] **Step 5: Verify all ensemble structures align 100% with Indicator ศ 2.1 ม.1/4 (การจัดประเภทของวงดนตรีไทยและวงดนตรีที่มาจากวัฒนธรรมต่างๆ)**

---

### Task 6: Duplicate URL Guard & Feldman 4-Step Music Criticism Canvas

**Files:**
- Modify: `app/js/feldman-criticism.js`
- Modify: `app/index.html`

**Interfaces:**
- Produces: `FeldmanCriticism.validateSongUrl(url, studentId, classRoom)`, `FeldmanCriticism.saveReview(studentId, reviewData)`

- [ ] **Step 1: Implement duplicate YouTube/Spotify URL detector verifying no 2 students in the same class (40 students) select identical songs**
- [ ] **Step 2: Build structured 4-step Feldman Canvas UI: Description, Analysis, Interpretation, Judgement**
- [ ] **Step 3: Add concise sentence validator and word count helper ensuring focused, substantive criticism**
- [ ] **Step 4: Implement teacher review cards showing submitted links and 4-step breakdown**
- [ ] **Step 5: Test submission flow with duplicate URL rejection scenario**

---

### Task 7: Scalable Rapid Cockpit Assessment UI (Preset All-Pass & Group Cascade)

**Files:**
- Modify: `app/js/rubric-matrix.js`
- Modify: `app/js/teacher-tools.js`
- Modify: `app/index.html`

**Interfaces:**
- Produces: `RubricMatrix.loadClassMatrix(classId, period)`, `RubricMatrix.oneTapOverride(studentId, newLevel)`, `RubricMatrix.cascadeGroupScore(groupId, baseScore, roleModifiers)`

- [ ] **Step 1: Implement Preset All-Pass: auto-fill student grid with Level 3 (Good / ผ่านเกณฑ์) upon opening class modal**
- [ ] **Step 2: Implement One-Tap Override: clicking a student cell cycles Level 3 ➡️ Level 4 (🟢 ดีเยี่ยม) ➡️ Level 2 (🟡 พอใช้) ➡️ Level 1 (🔴 ปรับปรุง)**
- [ ] **Step 3: Implement Group Cascade Scoring: grading the 5 groups automatically cascades base score to all 8 members**
- [ ] **Step 4: Add Role Modifier (+1 / 0 / -1) quick-toggle buttons next to each of the 8 assigned student roles**
- [ ] **Step 5: Verify full grading of 40 students finishes in under 3 minutes**

---

### Task 8: Holistic Synthesis, Automated Grading & Digital ปพ.5 Export

**Files:**
- Modify: `app/js/quiz-engine.js`
- Modify: `app/js/car-analytics.js`
- Modify: `app/js/official-forms.js`

**Interfaces:**
- Consumes: `Store.getAllScores(classId)`
- Produces: `GradeEngine.computeFinalSummary(studentId)`, `OfficialForms.exportDigitalPhorPhor5(classId)`

- [ ] **Step 1: Wire 20-question digital quiz engine for Period 11 (Midterm) and Period 20 (Final) with instant automated scoring (10 pts each)**
- [ ] **Step 2: Build composite calculation ledger summing Unit 1 (20) + Unit 2 (20) + Midterm (10) + Unit 3 (20) + Unit 4 (20) + Final (10) = 100 points**
- [ ] **Step 3: Implement automatic translation of score telemetry into 8 Desirable Characteristics and Reading/Thinking/Writing rubrics (Levels 3, 2, 1, 0)**
- [ ] **Step 4: Compute standard MoE 8-tier grade conversion (0, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0)**
- [ ] **Step 5: Generate Phayaophitthayakhom School standard ปพ.5 summary sheet downloadable as Excel / print-ready PDF**
