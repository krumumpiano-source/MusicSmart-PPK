# MusicSmart • แผนแม่บทการปรับปรุงระบบและยกระดับเป็นสื่อการเรียนรู้เชิงโต้ตอบ (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับปรุงเว็บแอปพลิเคชัน MusicSmart โดยตัดระบบตั้งสาย (Tuner/Pitch Detection) ออก คงเหลือเฉพาะระบบจังหวะ (Precision Metronome & Rhythm Tracker), เว้นว่างส่วนวิจัยในชั้นเรียน (CAR/วก.7) ไว้ตามสภาพจริง, ยกระดับแอปพลิเคชันให้เป็นสื่อการเรียนการสอนในตัวมันเอง (Interactive Learning Medium) ครบทั้ง 4 หน่วย (เน้น Ensemble Explorer สำหรับวงไทยและสากล), เพิ่มระบบออกฟอร์ม วก.3, วก.4, วก.5 ให้ตรงตามมาตรฐานโรงเรียนพะเยาพิทยาคม และขจัดฮาร์ดโค้ดโดยคงรักษาข้อมูลเดิมไว้ครบถ้วน 100% (Zero Data Loss)

**Architecture:** Client-side Progressive Web App (PWA) Vanilla JavaScript (ES6+), Web Audio API สำหรับระบบ Metronome & Virtual Timbre, HTML5 Canvas / SVG สำหรับแผนผังวงและกราฟอารมณ์เพลง 2 มิติ, Local-first Storage (LocalStorage + Store.js) สำหรับการบันทึกคะแนนและรูบริก, สถาปัตยกรรมแบบไม่มีการฮาร์ดโค้ด (Zero Hardcoding) โดยดึงข้อมูลจาก `Store`, `LESSONS_DATA` และ `ACADEMIC_DOCS_BY_GRADE`

**Tech Stack:** HTML5, Vanilla JavaScript, CSS3 Design System, Web Audio API, Service Worker (PWA Offline-First)

---

## Global Constraints

- **ความปลอดภัยของข้อมูล (Zero Data Loss):** ห้ามลบ แก้ไข หรือทำลายฐานข้อมูลนักเรียน (`app/data/students.js`), โครงสร้างบทเรียน (`app/data/lessons.js`), คลังข้อสอบ (`app/data/quizzes.js`), หรือเอกสารหลักสูตรทั้ง 79 ไฟล์ของ ม.1 และ ม.2
- **ขจัดฮาร์ดโค้ด (Zero Hardcoding):** ค่าสถิติ, ข้อมูลครู, ข้อมูลโรงเรียน, คะแนน และเกณฑ์รูบริก ต้องดึงผ่าน `Store.getAppSettings()`, `Store.getInstructor()`, `Store.getStudentRubric()` หรือคำนวณจากข้อมูลจริงในเซสชันเท่านั้น
- **มาตรฐานฟอร์มราชการ:** แบบฟอร์ม วก.3, วก.4, วก.5 ต้องสอดคล้องกับระเบียบและเทมเพลตทางการของกลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม
- **การจัดการอุปกรณ์:** อิงจำนวนคาลิมบ้า 40 เครื่อง (1 เครื่องต่อนักเรียน 1 คน แบบ 1:1) ในทุกกิจกรรม
- **การประเมินทักษะ:** ยึดความแม่นยำของจังหวะ (Rhythm / Timing / Beat Accuracy) โดยไม่วัดค่าความถี่เสียง (Pitch / Hz)
- **การวิจัยในชั้นเรียน:** ให้เว้นว่าง (Blank Action Plan) รอการบันทึกผลจริงหลังการสอน ห้ามใส่ข้อมูลผลการวิจัยล่วงหน้า

---

### Task 1: ถอดระบบตั้งสาย (Tuner / Pitch Detection) และปรับปรุงระบบจังหวะเมโทรนอม (Precision Rhythm Engine)

**Files:**
- Modify: `app/index.html` (ซ่อน/ลบปุ่มและโมดัล Tuner ปรับเมนูแถบเครื่องมือให้เด่นชัดที่ เมโทรนอม)
- Modify: `app/js/audio-tools.js` (ปรับปรุง Metronome ให้มี Visual Pulse แถบไฟ 4 จังหวะ และ Tempo Presets 60, 70, 80 BPM)
- Modify: `app/js/student-practice.js` (ตัดการเรียกใช้ Tuner ในหน้าฝึกซ้อมของนักเรียนออก ให้เหลือเมโทรนอมและการนับห้องเพลง)

**Interfaces:**
- Produces: `AudioTools.startMetronome(bpm, beatsPerMeasure)`, `AudioTools.stopMetronome()`, `AudioTools.setBpm(bpm)`
- Deprecates: `Tuner.startListening()`, `Tuner.evaluateIncomingPitch()`

- [ ] **Step 1: ปรับปรุง `app/js/audio-tools.js` ให้รองรับ Visual Beat Pulse แอนิเมชันและปุ่มลัดความเร็ว 60, 70, 80 BPM**
  - เพิ่มเมธอดสำหรับส่ง Callback แจ้งเตือนจังหวะตก (Downbeat) สู่ UI
  - เพิ่มค่าตั้งต้นความเร็วสำหรับ 3-Tier Mastery (Bronze=60, Silver=70, Gold=80 BPM)
- [ ] **Step 2: ปรับปรุง `app/index.html`**
  - นำปุ่มเรียกใช้ `modal-tuner` ออกจากแถบเครื่องมือหลัก (Header Bar) และเมนูเครื่องมือวิชาการ
  - ปรับปุ่มให้เปิดหน้าต่าง **"🥁 ระบบคุมจังหวะและเมโทรนอม (Precision Metronome Studio)"** โดยตรง
  - ซ่อนหรือลบการผูกเหตุการณ์ไมโครโฟนตรวจจับความถี่ (Hz / Cent)
- [ ] **Step 3: ปรับปรุง `app/js/student-practice.js`**
  - ลบปุ่ม "🎙️ จูนเนอร์โครมาติก" ในโมดัลฝึกซ้อมของนักเรียน
  - เพิ่มตัวแสดงผลจังหวะเมโทรนอมขนาดใหญ่พร้อมปุ่มแตะกำหนดจังหวะ (Tap Tempo)
- [ ] **Step 4: ทดสอบการทำงานของ Metronome ในเบราว์เซอร์**
  - ตรวจสอบว่าไม่มีคำเตือน error เกี่ยวกับไมโครโฟนหรือ Tuner
  - ตรวจสอบเสียงคลิกจังหวะและแถบไฟกระพริบทำงานตรงจังหวะอย่างราบรื่น

---

### Task 2: เคลียร์ส่วนวิจัยในชั้นเรียน (CAR / วก.7) ให้เป็นช่องว่างตามแบบฟอร์ม วก.5 จริง

**Files:**
- Modify: `app/js/official-forms.js` (`buildWK5HTML`)
- Modify: `app/js/car-analytics.js` (ปรับให้เป็นสถานะเตรียมการวิจัย ไม่แสดงผลสถิติสมมุติ)
- Modify: `app/index.html` (ปรับข้อความเมนูวิจัยในชั้นเรียน)

**Interfaces:**
- Consumes: `Store.getSession(className, period)`
- Produces: `OfficialForms.buildWK5HTML(className, period)` (แบบฟอร์ม วก.5 ที่มี Action Plan แบบเปิดว่างสำหรับครูบันทึกจริง)

- [ ] **Step 1: ปรับแก้ `buildWK5HTML` ใน `app/js/official-forms.js`**
  - นำกล่องข้อความ "🛡️ การปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)" และ "3. แนวทางการแก้ไข พัฒนา หรือการวิจัยในชั้นเรียน (CAR)" เดิมออก
  - เปลี่ยนเป็นหัวข้อมาตรฐานของโรงเรียนพะเยาพิทยาคม 3 หัวข้อ:
    1. *ผลการเรียนรู้ของนักเรียน*
    2. *ปัญหาที่เกิดขึ้นในระหว่างการจัดการเรียนรู้*
    3. *แนวทางการแก้ปัญหาหรือปรับปรุงแผนการจัดการเรียนรู้ครั้งต่อไป (Action plan)*
  - หากยังไม่มีการบันทึก ให้แสดงเป็นเส้นประว่าง (เช่น `....................................................................................`) พร้อมสำหรับการพิมพ์ด้วยลายมือ หรือเปิดให้พิมพ์ข้อความจริง
- [ ] **Step 2: ปรับปรุง `app/js/car-analytics.js`**
  - ปรับโหมดรายงานวิจัยให้แสดงเป็น **"โครงร่างและเครื่องมือวิจัยเชิงปฏิบัติการในชั้นเรียน (CAR Framework)"**
  - ไม่แสดงผลคะแนน $t$-test หรือ Effect Size จำลองล่วงหน้า
  - เพิ่มป้ายกำกับชัดเจน: `📌 สถานะ: รอการจัดการเรียนการสอนจริงและบันทึกคะแนนเพื่อประมวลผล`
- [ ] **Step 3: ตรวจสอบการแสดงผลหน้าพิมพ์ วก.5**
  - ตรวจสอบว่าข้อความระบุผลวิจัยล่วงหน้าถูกตัดออก 100%

---

### Task 3: ยกระดับแอปเป็นสื่อการสอนเรื่อง "วงดนตรีไทย สากล และพื้นบ้าน" (Interactive Ensemble Explorer) ในหน่วยที่ 3

**Files:**
- Create/Modify: `app/js/ensemble-explorer.js` (โมดูลแสดงผังวงดนตรีและเครื่องดนตรี)
- Modify: `app/index.html` (เพิ่ม Modal ห้องสำรวจวงดนตรีเสมือนจริง)
- Modify: `app/css/style.css` (สไตล์ผังที่นั่งวงดนตรี Seating Chart & Stem Mixer)

**Interfaces:**
- Produces: `EnsembleExplorer.open()`, `EnsembleExplorer.selectEnsemble(type)`, `EnsembleExplorer.playInstrumentSample(name)`

- [ ] **Step 1: สร้างฐานข้อมูลโครงสร้างวงดนตรีใน `app/js/ensemble-explorer.js`**
  - **วงดนตรีไทย:** วงปี่พาทย์ไม้แข็ง, วงปี่พาทย์ไม้นวม, วงปี่พาทย์มอญ, วงเครื่องสายวงเล็ก, วงเครื่องสายเครื่องคู่, วงมโหรี
  - **วงดนตรีพื้นบ้าน 4 ภาค:** สะล้อซอซึง (เหนือ/พะเยา), โปงลาง (อีสาน), กลองยาว (กลาง), รองเง็ง (ใต้)
  - **วงดนตรีสากล:** Symphony Orchestra, Concert Band, String Quartet, Jazz Big Band, Pop-Rock Band
  - ข้อมูลประกอบด้วย: ผังตำแหน่งที่นั่ง (Seating Chart), เครื่องดนตรีนำ, เครื่องดนตรีตาม, เครื่องประกอบจังหวะ และคำอธิบายสีสันของเสียง (Timbre)
- [ ] **Step 2: สร้างหน้าจอ Interactive UI ใน `app/index.html`**
  - แท็บเลือกประเภทวง: 🇹🇭 วงดนตรีไทย | 🌾 วงดนตรีพื้นบ้าน | 🎻 วงดนตรีสากล
  - หน้าผังที่นั่งจำลอง (Visual Seating Chart) ที่คลิกแต่ละเครื่องดนตรีแล้วแสดงบทบาทหน้าที่และรูปภาพ/สัญลักษณ์
  - ระบบฟังเสียงจำลองเครื่องดนตรีแต่ละชิ้น (เช่น ระนาดเอก, ฆ้องวงใหญ่, ขลุ่ยเพียงออ, ซอด้วง, ซออู้, ไวโอลิน, เชลโล, ทรัมเป็ต)
- [ ] **Step 3: สร้างมินิเกม Blind Audio Quiz ใน `app/js/ensemble-explorer.js`**
  - สุ่มเล่นตัวอย่างเสียง แล้วให้นักเรียนทายชื่อวงดนตรี เพื่อใช้เป็นกิจกรรม active learning ในคาบที่ 12–13
- [ ] **Step 4: เชื่อมโยงปุ่มเข้าสู่ Ensemble Explorer ในหน้าแผนการสอนคาบที่ 12–15**
  - เมื่อครูหรือนักเรียนเปิดดูคาบที่ 12, 13, 14, 15 จะมีปุ่มเด่น **"🎺 เปิดสื่อการสอน: ห้องสำรวจวงดนตรีเสมือนจริง"** ให้คลิกเข้าใช้งานได้ทันที

---

### Task 4: ยกระดับแอปเป็นสื่อการสอนในหน่วยที่ 1, 2, และ 4 (Visual Metronome, Rehearsal Cue Map, Feldman Criticism)

**Files:**
- Modify: `app/js/app.js` (เชื่อมโยงปุ่มสื่อประจำคาบเรียน)
- Modify: `app/js/feldman-criticism.js` (กระดานวิจารณ์ดนตรี 4 ขั้นตามทฤษฎีเฟลด์แมน)
- Modify: `app/index.html` (เพิ่ม Canvas สำหรับ 2D Emotion Mapping ในคาบที่ 16)

**Interfaces:**
- Produces: `App.openEmotionCanvas()`, `FeldmanCriticism.openGuidanceModal()`

- [ ] **Step 1: หน่วยที่ 1 & 2 — แผนผังคิววาทยกรและเมโทรนอมภาพ (Rehearsal Cue Map)**
  - เพิ่มหน้าจอช่วยซ้อมรวมวงในคาบที่ 5–9: แสดงตัวนับห้องเพลง (Bar Counter 1–16) พร้อมไฟสัญญาณบอกคิวกลุ่ม 1 (Melody), กลุ่ม 2 (Dyad Harmony), กลุ่ม 3 (Percussion)
- [ ] **Step 2: หน่วยที่ 4 (คาบ 16) — กระดานพล็อตกราฟอารมณ์เพลง 2 มิติ (2D Emotion Coordinate Canvas)**
  - สร้าง Interactive Canvas 2 มิติ แกนตั้ง Arousal (สงบ $\leftrightarrow$ ตื่นเต้น) และแกนนอน Valence (เศร้า $\leftrightarrow$ มีความสุข)
  - ให้นักเรียนคลิกวางหมุดอารมณ์เพลงที่ได้ยิน พร้อมอ่านค่าพิกัดอารมณ์ทางดนตรี
- [ ] **Step 3: หน่วยที่ 4 (คาบ 17) — กระดานวิจารณ์ดนตรี 4 ขั้นของเฟลด์แมน (Feldman's Canvas)**
  - ปรับปรุงให้มีเมนูชี้นำ (Guiding Prompts) ในแต่ละขั้น:
    1. *Description (บรรยายข้อเท็จจริง):* จังหวะ เครื่องดนตรี อัตราเร็ว
    2. *Analysis (วิเคราะห์ความสัมพันธ์):* การเรียบเรียง ความดัง-เบา (Dynamics)
    3. *Interpretation (ตีความหมาย):* อารมณ์ ความรู้สึก เรื่องราว
    4. *Evaluation (ประเมินคุณค่า):* คุณค่าทางสังคมและความประทับใจ
- [ ] **Step 4: เชื่อมโยงปุ่มเปิดสื่อประจำคาบในแถบด้านบนของหน้าเรียนรู้แต่ละคาบ**
  - คาบ 1-4: เมโทรนอม & แผนผังลิ่ม 17 คีย์
  - คาบ 5-11: แผนผังคิววาทยกร & รูบริกวิพากษ์เพื่อน (Peer Critique)
  - คาบ 12-15: ห้องสำรวจวงดนตรีเสมือนจริง (Ensemble Explorer)
  - คาบ 16-18: กราฟอารมณ์ 2 มิติ & ไกด์วิจารณ์เฟลด์แมน

---

### Task 5: ระบบออกเอกสารราชการ วก.3, วก.4 และ วก.5 ปราศจากฮาร์ดโค้ด (Official Forms Hub)

**Files:**
- Modify: `app/js/official-forms.js`
- Modify: `app/index.html` (เพิ่มปุ่มสลับแท็บ วก.3, วก.4, วก.5, ปพ.5)
- Modify: `app/css/style.css` (สไตล์เอกสารพิมพ์ A4 แบบราชการ TH Sarabun New)

**Interfaces:**
- Produces: `OfficialForms.buildWK3HTML(grade)`, `OfficialForms.buildWK4HTML(grade, unitNo)`, `OfficialForms.buildWK5HTML(className, period)`

- [ ] **Step 1: เพิ่มฟังก์ชัน `buildWK3HTML(grade)` ใน `official-forms.js`**
  - ดึงข้อมูลจาก `ACADEMIC_DOCS_BY_GRADE[grade].wk3`
  - สร้างเลย์เอาต์ทางการ: คำอธิบายรายวิชา, ตารางวิเคราะห์หลักสูตร, ตารางวิเคราะห์ มฐ./ตัวชี้วัด, ผังมโนทัศน์, โครงสร้างรายวิชา และตารางโครงสร้างวัดผล (K:30, P:50, A:20)
  - หัวกระดาษ: *งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม*
- [ ] **Step 2: เพิ่มฟังก์ชัน `buildWK4HTML(grade, unitNo)` ใน `official-forms.js`**
  - ดึงข้อมูลจาก `ACADEMIC_DOCS_BY_GRADE[grade].wk4`
  - สร้างเลย์เอาต์ครบ 8 หัวข้อตามแบบฟอร์ม วก.4 โรงเรียนพะเยาพิทยาคม (มฐ./ตัวชี้วัด, สาระสำคัญ, สาระการเรียนรู้, สมรรถนะ, คุณลักษณะอันพึงประสงค์, ชิ้นงาน/ภาระงาน, การวัดประเมินผล, การจัดกิจกรรมการเรียนรู้)
- [ ] **Step 3: ขจัดฮาร์ดโค้ดใน `buildWK5HTML`**
  - เลิกใช้ค่าตัวเลขสมมุติ `0.9` และ `0.88`
  - ตรวจสอบข้อมูลจาก `Store.getStudentRubric()` หรือ `session.attendance`:
    - หากมีข้อมูล: สรุปยอดนักเรียนที่ได้ระดับ 3 ขึ้นไปตามจริง
    - หากไม่มีข้อมูล (ยังไม่ได้สอน): แสดงขีดว่าง หรือ `—` เพื่อให้พิมพ์เป็นเอกสารเปล่าพร้อมใช้
- [ ] **Step 4: อัปเดตแท็บในโมดัลออกเอกสารราชการใน `app/index.html`**
  - เพิ่มปุ่ม: `[ วก.3 โครงสร้างรายวิชา ]` `[ วก.4 หน่วยการเรียนรู้ ]` `[ วก.5 บันทึกหลังสอน ]` `[ ปพ.5 บันทึกผลการเรียน ]`
  - รองรับการสลับเกรดระหว่าง **ม.1 (ศ21101)** และ **ม.2 (ศ22102)**

---

### Task 6: การตรวจสอบความสมบูรณ์และทดสอบระบบทั้งหมด (System Audit & Verification)

**Files:**
- Review: `app/data/lessons.js`, `app/data/academic_docs.js`, `app/data/students.js`
- Test: ตรวจสอบ syntax JS และรันเบราว์เซอร์ตรวจสอบ

- [ ] **Step 1: ตรวจสอบความถูกต้องของไวยากรณ์ JavaScript ทุกไฟล์ที่แก้ไข**
  - รันตรวจสอบไวยากรณ์ `node -c` กับทุกไฟล์ JavaScript ที่แก้ไข
- [ ] **Step 2: ตรวจสอบความสมบูรณ์ของข้อมูลเดิม (Zero Data Loss Audit)**
  - ตรวจนับจำนวนนักเรียนในทุกห้อง (ม.1/1 – ม.1/8) ต้องไม่สูญหาย
  - ตรวจนับจำนวนบทเรียน ม.1 (20 คาบ) และ ม.2 (20 คาบ) ต้องครบถ้วน
- [ ] **Step 3: ทดสอบการทำงานในเบราว์เซอร์**
  - เปิดแอป MusicSmart ตรวจสอบว่าไม่มี Console Error
  - ทดสอบเปิดโมดัล วก.3, วก.4, วก.5 และสั่งพิมพ์ตัวอย่าง A4
  - ทดสอบเปิด Ensemble Explorer และคลิกเลือกดูวงดนตรีไทยและสากล
  - ทดสอบการทำงานของ Metronome
- [ ] **Step 4: บันทึก Git Commit ด้วยข้อความมาตรฐาน**
