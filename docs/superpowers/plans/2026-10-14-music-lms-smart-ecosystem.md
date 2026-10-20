# Music LMS Smart Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Music LMS from a classroom management tool into an intelligent, interactive music learning ecosystem supporting real-time audio tuning, online testing from the 40-item Blueprint, 4-level rubrics, Feldman music criticism, CAR research statistics for วPA (คศ.4), and official A4 printing.

**Architecture:** Modular Vanilla JavaScript + Web Audio API architecture. Core capabilities are split into focused modules (`tuner.js`, `audio-tools.js`, `quizzes.js`, `quiz-engine.js`, `rubric-matrix.js`, `car-analytics.js`, `official-forms.js`) that hook into the existing `Store` and `App` controller without breaking backward compatibility or data persistence.

**Tech Stack:** HTML5, CSS3 (Modern Glassmorphism & Vanilla CSS), Vanilla JavaScript (ES6+), Web Audio API (Microphone Pitch Detection & Oscillator Synthesis), LocalStorage Data Engine.

## Global Constraints

- Preserve all existing student data (610 students, 16 classes) and existing lesson plans (20 periods for M1 & M2).
- Pure client-side zero-dependency execution (works standalone on offline static servers / localhost / GitHub Pages).
- Strictly adhere to Phayaophitthayakhom School curriculum standards (ศ 2.1, ศ 2.2), T-PACE Framework, and Teacher Evaluation (วPA คศ.4).
- Beautiful, high-contrast, clean UI matching the established design system tokens (`--ppk-navy`, `--ppk-blue`, `--ppk-amber`, `--ppk-rose`, etc.).

---

### Task 1: Web Audio Chromatic & Kalimba 17-Key Tuner

**Files:**
- Create: `app/js/tuner.js`
- Modify: `app/index.html` (add tuner modal & cockpit tuner widget)
- Modify: `app/css/styles.css` (tuner gauge, needle, cents indicator, 17-key map styling)
- Test: In browser with microphone input / synthesized audio simulation

**Interfaces:**
- Consumes: `AudioContext`, `navigator.mediaDevices.getUserMedia`, `App.state`
- Produces: `Tuner.init()`, `Tuner.start()`, `Tuner.stop()`, `Tuner.detectPitch(buffer)`

- [x] **Step 1: Create `app/js/tuner.js` with Pitch Detection Algorithm**
Implement autocorrelation-based pitch detection optimized for Kalimba frequency range (C4 261.63Hz to E6 1318.51Hz) with note mapping for 17 standard Kalimba tines (1=C4, 2=D4, 3=E4, 4=F4, 5=G4, 6=A4, 7=B4, 1°=C5 ... 3°°=E6).

- [x] **Step 2: Add Tuner UI modal and Cockpit quick button in `app/index.html`**
Add `#modal-tuner` with needle gauge, frequency readout in Hz, deviation in cents ($\pm 50$), and interactive 17-tine visual keyboard.
Add button `🎵 เครื่องตั้งเสียง Tuner` to Header and Classroom Cockpit toolbars.

- [x] **Step 3: Add CSS for Tuner in `app/css/styles.css`**
Add `.tuner-gauge-container`, `.tuner-needle`, `.tuner-note-display`, `.tuner-cents-badge`, and `.kalimba-tines-layout`.

- [x] **Step 4: Verify Tuner in browser via `browser_subagent`**
Verify microphone permission request, needle movement, tine highlighting, and tone generation fallback.

---

### Task 2: Interactive Metronome & Drone Ear Training Audio Engine

**Files:**
- Create: `app/js/audio-tools.js`
- Modify: `app/index.html` (add metronome & drone bar in Cockpit)
- Modify: `app/css/styles.css` (metronome pulse animation, tempo tap, time signature selector)

**Interfaces:**
- Consumes: `AudioContext`
- Produces: `AudioTools.playDrone(noteName)`, `AudioTools.stopDrone()`, `AudioTools.startMetronome(bpm, beatsPerMeasure)`, `AudioTools.stopMetronome()`

- [x] **Step 1: Create `app/js/audio-tools.js`**
Implement accurate Web Audio lookahead scheduler for Metronome (40-208 BPM, accents on beat 1) and continuous sine oscillator for Ear Training drone pitch (Solfege reference).

- [x] **Step 2: Embed Audio Tools bar into Cockpit header in `app/index.html`**
Add quick Metronome toggle (`▶ 100 BPM`), tap tempo button, and drone dropdown (`โด (C4) - ที (B4)`) directly accessible to the teacher during rehearsals.

- [x] **Step 3: Test Metronome audio and visual pulse in browser**
Run test on `http://localhost:8080/` and verify pulse indicator beats on time.

---

### Task 3: Interactive Blueprint 40 Online Testing & Unit Quizzes

**Files:**
- Create: `app/data/quizzes.js`
- Create: `app/js/quiz-engine.js`
- Modify: `app/index.html` (add Student Test Portal & Teacher Test Review modal)
- Modify: `app/js/app.js` (link quiz scores to student gradebook under K score)

**Interfaces:**
- Consumes: Test Blueprint 40 items from `academic_docs.js`
- Produces: `QuizEngine.startQuiz(unitNo, studentId)`, `QuizEngine.submitQuiz(answers)`, `QuizEngine.getStudentScores(studentId)`

- [x] **Step 1: Extract and structure Blueprint 40 questions in `app/data/quizzes.js`**
Format Unit 1–4 tests (10 questions each, total 40 questions) with prompt, 4 choices, correct answer key, Bloom's cognitive level, and indicator mapping (ศ 2.1 / ศ 2.2).

- [x] **Step 2: Implement `app/js/quiz-engine.js`**
Build interactive quiz taking UI for students: timer, question stepper, instant feedback mode (optional), auto-grading, and saving scores to `Store.saveQuizScore(studentId, unitNo, score)`.

- [x] **Step 3: Connect Quiz Scores to Teacher Gradebook in `app.js`**
Ensure that when a student finishes Unit 1 Test, their score is automatically factored into the K score column for Unit 1 in Cockpit and Student Status.

- [x] **Step 4: Test Quiz taking and auto-grading in browser**
Take test in Student mode, verify correct score calculation and display in Teacher Cockpit.

---

### Task 4: Interactive Matrix Rubric Scoring for Cockpit (ระดับ คศ.4)

**Files:**
- Create: `app/js/rubric-matrix.js`
- Modify: `app/js/app.js` (`renderAssessmentTab()`)
- Modify: `app/css/styles.css` (rubric matrix table, quality level chips)

**Interfaces:**
- Consumes: 8 Assessment Rubrics from `academic_docs.js`
- Produces: `RubricMatrix.renderMatrix(lessonPeriod, studentId)`, `RubricMatrix.selectLevel(criterionId, level)`

- [x] **Step 1: Create `app/js/rubric-matrix.js`**
Map official rubric descriptors across 4 quality levels:
  - 4 = ดีมาก (Exemplary)
  - 3 = ดี (Proficient)
  - 2 = พอใช้ (Developing)
  - 1 = ปรับปรุง (Beginning)
Calculate weighted P (5 pts) and K/A (5 pts) scores dynamically based on clicked cells.

- [x] **Step 2: Integrate Rubric Matrix into Cockpit Tab 3 in `app.js`**
Replace plain score input with the interactive matrix for the selected student, showing descriptor text when hovered or tapped.

- [x] **Step 3: Test Rubric scoring in Cockpit via `browser_subagent`**
Verify scoring changes update the student's period score and persist in `Store`.

---

### Task 5: Feldman 4-Step Music Criticism Workspace

**Files:**
- Create: `app/js/feldman-criticism.js`
- Modify: `app/index.html` (Student Portal tab for Music Criticism)
- Modify: `app/css/styles.css` (guided step cards, audio player embed)

**Interfaces:**
- Consumes: Unit 4 Lesson Plans (Periods 15-18)
- Produces: `FeldmanCriticism.renderForm(period, studentId)`, `FeldmanCriticism.saveDraft()`, `FeldmanCriticism.submit()`

- [x] **Step 1: Create guided 4-step form in `app/js/feldman-criticism.js`**
Provide structured guiding questions for each phase:
  1. Description (บรรยายองค์ประกอบที่ได้ยิน)
  2. Formal Analysis (วิเคราะห์จังหวะ ทำนอง สีสันเสียง)
  3. Interpretation (ตีความอารมณ์ความรู้สึกและเจตนาของผู้ประพันธ์)
  4. Evaluation (ประเมินคุณค่าและความประทับใจ)

- [x] **Step 2: Connect Feldman submissions to Teacher Assessment Tab**
Allow teachers to review student critiques with the 8th official rubric ("แบบประเมินการวิจารณ์ดนตรีตามแนวทาง Feldman").

---

### Task 6: CAR Research Analytics Engine (วก.7 & วPA)

**Files:**
- Create: `app/js/car-analytics.js`
- Modify: `app/index.html` (add CAR Research Dashboard modal/view)
- Modify: `app/css/styles.css` (research summary cards, data tables, distribution bar chart)

**Interfaces:**
- Consumes: Pre-test scores, Post-test scores, Attendance, Period Rubric scores
- Produces: `CARAnalytics.computeStats(classGroup)`, `CARAnalytics.exportReportWord()`

- [x] **Step 1: Build statistical calculation engine in `app/js/car-analytics.js`**
Implement formulas:
  - Mean ($\bar{X}$) and Standard Deviation ($S.D.$)
  - Dependent $t$-test ($t = \frac{\sum D}{\sqrt{\frac{n\sum D^2 - (\sum D)^2}{n-1}}}$)
  - Normalized Gain: $\langle g \rangle = \frac{\%Post - \%Pre}{100 - \%Pre}$
  - Efficiency of Process/Product ($E_1/E_2$)

- [x] **Step 2: Render CAR Research Dashboard in `app/index.html`**
Display comparative charts, gain score classification (High $>0.7$, Medium $0.3-0.7$, Low $<0.3$), and formatted tables matching the วก.7 proposal.

- [x] **Step 3: Add Export to CSV & Word Table format**
Allow 1-click download of research findings ready to paste into thesis or วPA submissions.

---

### Task 7: PDPA Media Consent Tracking & One-Click Official Forms Generator

**Files:**
- Create: `app/js/official-forms.js`
- Modify: `app/index.html` (Print modal for ปพ.5 and บันทึกหลังแผน วก.5)
- Modify: `app/css/styles.css` (print stylesheets `@media print` with exact A4 page breaks)

**Interfaces:**
- Consumes: Student status, attendance logs, scores, and PDPA consent flags
- Produces: `OfficialForms.printPPK5(className)`, `OfficialForms.printWK5Summary(period, className)`

- [x] **Step 1: Implement PDPA consent toggle in Student Status Modal**
Add checkbox "ผู้ปกครองยินยอมบันทึกภาพ/วิดีโอเพื่อการศึกษาและวิจัย (PDPA Consent)" with badge in attendance and student cards.

- [x] **Step 2: Create A4-formatted print layouts in `app/js/official-forms.js`**
Build official templates:
  - แบบรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.5) ฉบับสมบูรณ์
  - แบบบันทึกผลหลังการจัดการเรียนรู้ วก.5 (จำนวนนักเรียนที่ผ่าน/ไม่ผ่าน, ปัญหาที่พบ, แนวทางแก้ไข, ลายเซ็นครูผู้สอน)

- [x] **Step 3: Verify Print layout in browser print preview**
Ensure margins, fonts (Sarabun/Inter), and page breaks match standard Thai government school A4 requirements.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-14-music-lms-smart-ecosystem.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach would you like to take?**
