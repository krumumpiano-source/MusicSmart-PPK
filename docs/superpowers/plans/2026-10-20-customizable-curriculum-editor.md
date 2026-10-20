# Customizable Curriculum & Lesson Plan Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ครูสามารถปรับแต่งแก้ไขแผนการสอน 40 คาบ (ม.1 และ ม.2) ได้อย่างอิสระ 100% พร้อมระบบ Overlay ปลอดภัย คืนค่ามาตรฐานโรงเรียนได้ นาฬิกา T-PACE ปรับเวลาอัตโนมัติ และซิงค์ขึ้น Google Sheets

**Architecture:** สถาปัตยกรรม Overlay Pattern: `LESSONS_DATA` ใน `app/data/lessons.js` เป็นฐานข้อมูลหลักที่ไม่ถูกเขียนทับ ข้อมูลที่ครูปรับแต่งจะถูกเก็บใน `localStorage.ppk_custom_lessons` และผสาน (Merge) ผ่าน `Store.getLesson()` อัตโนมัติ พร้อมส่งซิงค์คู่ขนานขึ้น Google Sheets (แท็บ `แผนการสอน_Curriculum`)

**Tech Stack:** Vanilla JavaScript (ES6+), Local-First LocalStorage, HTML5/CSS3 Responsive Modals, Google Apps Script Serverless Backend

## Global Constraints
- ห้ามเขียนทับหรือลบ `LESSONS_DATA` ใน `app/data/lessons.js` โดยตรง ต้องคงสถานะ Base Plan ที่สะอาดและดึงคืนค่าได้เสมอ
- ทุกการแก้ไขเวลาใน 5 ขั้นตอน T-PACE ต้องส่งผลให้นาฬิกานับถอยหลังในห้องเรียน (Cockpit Digital Timer) คำนวณและปรับเวลานับถอยหลังโดยอัตโนมัติ
- ปฏิบัติตามมาตรฐาน WCAG 2.1 AA และรองรับการทำงานทั้งบน Desktop และ Mobile/Tablet
- รักษาความเข้ากันได้กับชุดทดสอบ E2E Suite `test_e2e_suite.js` (ต้องผ่าน 100% ทุกขั้นตอน)

---

### Task 1: Store Layer - Custom Lessons Overlay & CRUD API

**Files:**
- Modify: `app/data/store.js:315-335`
- Test: `test_e2e_suite.js`

**Interfaces:**
- Consumes: `LESSONS_DATA` from `app/data/lessons.js`
- Produces: 
  - `Store.getCustomLessons(grade)`
  - `Store.saveCustomLesson(grade, period, customData)`
  - `Store.resetCustomLesson(grade, period)`
  - `Store.resetAllCustomLessons()`
  - `Store.getLesson(grade, period)` (Overlay merge)

- [ ] **Step 1: Write the failing tests in `test_e2e_suite.js`**
Add Phase 9 tests for Custom Lessons Store API in `test_e2e_suite.js`:
```javascript
// Test Store.saveCustomLesson and Store.getLesson overlay
const testCustom = {
  topic: 'บทเรียนทดสอบการปรับแต่งพิเศษ',
  kpa: { k: 'ทดสอบ K', p: 'ทดสอบ P', a: 'ทดสอบ A' },
  duration_min: 60
};
Store.saveCustomLesson('M1', 1, testCustom);
const merged = Store.getLesson('M1', 1);
assert.strictEqual(merged.topic, 'บทเรียนทดสอบการปรับแต่งพิเศษ');
assert.strictEqual(merged.period, 1);
assert.strictEqual(merged.isCustomized, true);

// Test resetCustomLesson
Store.resetCustomLesson('M1', 1);
const restored = Store.getLesson('M1', 1);
assert.strictEqual(restored.isCustomized, undefined);
assert.notStrictEqual(restored.topic, 'บทเรียนทดสอบการปรับแต่งพิเศษ');
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node test_e2e_suite.js`
Expected: FAIL with `Store.saveCustomLesson is not a function`

- [ ] **Step 3: Implement Custom Lessons methods in `app/data/store.js`**
Update `getLesson` and add CRUD methods in `app/data/store.js`:
```javascript
  // --- Lessons Data with Overlay Customization Layer ---
  getCustomLessons(grade = 'M1') {
    const all = this.load('ppk_custom_lessons', {}) || {};
    return all[grade] || {};
  },

  saveCustomLesson(grade, period, customData) {
    const all = this.load('ppk_custom_lessons', {}) || {};
    if (!all[grade]) all[grade] = {};
    const p = Number(period);
    all[grade][p] = {
      ...(all[grade][p] || {}),
      ...customData,
      updatedAt: new Date().toISOString(),
      isCustomized: true
    };
    this.save('ppk_custom_lessons', all);
    if (this._lessonIndex) this._lessonIndex.clear();
    
    // Sync to Google Sheets if available
    if (typeof GoogleSheetSync !== 'undefined' && typeof GoogleSheetSync.syncCurriculumLesson === 'function') {
      try {
        GoogleSheetSync.syncCurriculumLesson(grade, p, all[grade][p]);
      } catch (e) {}
    }
    return this.getLesson(grade, p);
  },

  resetCustomLesson(grade, period) {
    const all = this.load('ppk_custom_lessons', {}) || {};
    const p = Number(period);
    if (all[grade] && all[grade][p]) {
      delete all[grade][p];
      this.save('ppk_custom_lessons', all);
      if (this._lessonIndex) this._lessonIndex.clear();
      return true;
    }
    return false;
  },

  resetAllCustomLessons() {
    this.save('ppk_custom_lessons', {});
    if (this._lessonIndex) this._lessonIndex.clear();
    return true;
  },

  getLesson(grade, period) {
    if (typeof LESSONS_DATA === 'undefined' || !LESSONS_DATA[grade]) return null;
    const p = Number(period);
    const base = (LESSONS_DATA[grade] || []).find(l => Number(l.period) === p);
    if (!base) return null;

    const custom = this.getCustomLessons(grade)[p];
    if (!custom) return base;

    return {
      ...base,
      ...custom,
      kpa: { ...(base.kpa || {}), ...(custom.kpa || {}) },
      steps: custom.steps || base.steps,
      media: custom.media || base.media,
      assessment: { ...(base.assessment || {}), ...(custom.assessment || {}) },
      isCustomized: true
    };
  },
```

- [ ] **Step 4: Run test to verify it passes**
Run: `node test_e2e_suite.js`
Expected: PASS

- [ ] **Step 5: Commit Task 1**
```powershell
git commit -am "feat(store): add custom lesson overlay data layer and CRUD API"
```

---

### Task 2: Google Sheets Sync Backend & Client Extension

**Files:**
- Modify: `app/js/google-sheet-sync.js`
- Modify: `google_apps_script.js`
- Test: `test_e2e_suite.js`

**Interfaces:**
- Consumes: `Store.getCustomLessons`
- Produces: `GoogleSheetSync.syncCurriculumLesson(grade, period, lessonData)` and Apps Script `curriculum_lesson` processor

- [ ] **Step 1: Write unit test in `test_e2e_suite.js`**
Verify `GoogleSheetSync.syncCurriculumLesson` enqueues item into outbox:
```javascript
const qItem = GoogleSheetSync.syncCurriculumLesson('M1', 1, { topic: 'ทดสอบซิงค์แผน' });
assert.strictEqual(qItem.type, 'curriculum_lesson');
assert.strictEqual(qItem.data.grade, 'M1');
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node test_e2e_suite.js`
Expected: FAIL with `syncCurriculumLesson is not a function`

- [ ] **Step 3: Implement client method and Apps Script handler**
In `app/js/google-sheet-sync.js`:
```javascript
  syncCurriculumLesson(grade, period, lessonData) {
    const instructor = typeof Store !== 'undefined' ? Store.getInstructor() : {};
    return this.enqueue('curriculum_lesson', {
      grade,
      period: Number(period),
      topic: lessonData.topic || '',
      unitName: lessonData.unit_name || lessonData.unitName || '',
      kpaSummary: `K: ${lessonData.kpa?.k || '-'} | P: ${lessonData.kpa?.p || '-'} | A: ${lessonData.kpa?.a || '-'}`,
      durationMin: lessonData.duration_min || lessonData.durationMin || 50,
      stepsSummary: (lessonData.steps || []).map(s => `[${s.phase} (${s.duration}น.)] ${s.desc || ''}`).join('\n'),
      mediaCount: (lessonData.media || []).length,
      updatedBy: instructor.name || 'คุณครูผู้สอน',
      timestamp: new Date().toISOString()
    });
  },
```
In `google_apps_script.js`:
Add processor for `type === 'curriculum_lesson'` writing to sheet `แผนการสอน_Curriculum`.

- [ ] **Step 4: Run test to verify it passes**
Run: `node test_e2e_suite.js`
Expected: PASS

- [ ] **Step 5: Commit Task 2**
```powershell
git commit -am "feat(sync): add curriculum plan sync support to Google Sheets engine"
```

---

### Task 3: Dynamic T-PACE Timer Binding & Classroom Cockpit Integration

**Files:**
- Modify: `app/js/app.js:2306-2380` (renderLessonTab & getTpacePhases)
- Modify: `app/index.html` (Add edit button in Cockpit lesson tab)
- Test: `test_e2e_suite.js`

**Interfaces:**
- Consumes: `Store.getLesson(grade, period)`
- Produces: Reactive timer duration updates & `App.openLessonEditorModal(grade, period)`

- [ ] **Step 1: Write test for dynamic T-PACE timer duration resolution**
Test in `test_e2e_suite.js`:
Save custom lesson with modified step durations:
```javascript
Store.saveCustomLesson('M1', 2, {
  steps: [
    { phase: 'ขั้นนำเข้าสู่บทเรียน', duration: 15, desc: 'นำเข้าสู่บทเรียนแบบขยาย' },
    { phase: 'ขั้นสอน', duration: 25, desc: 'สอนปฏิบัติ' },
    { phase: 'ขั้นปฏิบัติ', duration: 10, desc: 'ฝึกรวมวง' }
  ]
});
const lesson2 = Store.getLesson('M1', 2);
const totalMins = lesson2.steps.reduce((acc, s) => acc + s.duration, 0);
assert.strictEqual(totalMins, 50);
Store.resetCustomLesson('M1', 2);
```

- [ ] **Step 2: Run test to verify it passes**
Run: `node test_e2e_suite.js`

- [ ] **Step 3: Add "✏️ ปรับแต่งแผนการสอนคาบนี้" button in `app/index.html`**
Inside Tab 1 (`#tab-cockpit-lesson`):
Add action header:
```html
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
  <span id="lesson-customized-badge" style="display: none; font-size: 0.76rem; background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 9999px; font-weight: 700;">✏️ แผนปรับแต่งเฉพาะ</span>
  <button type="button" class="btn-nav-action" style="background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; font-weight: 700; font-size: 0.82rem;" onclick="App.openCurrentLessonEditor()">
    ✏️ ปรับแต่งแผนการสอนคาบนี้
  </button>
</div>
```

- [ ] **Step 4: Update `renderLessonTab()` to show customization badge and bind button**
In `app/js/app.js`:
```javascript
  openCurrentLessonEditor() {
    this.openLessonEditorModal(this.state.grade, this.state.selectedPeriod);
  },
```

- [ ] **Step 5: Commit Task 3**
```powershell
git commit -am "feat(cockpit): integrate custom lesson badge, quick edit button, and dynamic timer binding"
```

---

### Task 4: Quick-Edit Modal UI in Cockpit & Real-time Live Reload

**Files:**
- Create/Modify: `app/index.html` (Modal `#modal-lesson-editor`)
- Modify: `app/js/app.js` (Modal open/save/reset methods, dynamic media rows)
- Test: `test_e2e_suite.js`

**Interfaces:**
- Produces: 
  - `App.openLessonEditorModal(grade, period)`
  - `App.saveLessonEditorModal()`
  - `App.resetCurrentLessonModal()`
  - `App.addLessonMediaRow(title, url, type)`

- [ ] **Step 1: Write DOM check test in `test_e2e_suite.js`**
Verify `#modal-lesson-editor`, `#editor-lesson-topic`, `#editor-lesson-kpa-k`, etc. exist.

- [ ] **Step 2: Add `#modal-lesson-editor` structure in `app/index.html`**
Form controls for:
- Topic & Unit Name
- KPA (K, P, A) textareas
- 5 T-PACE steps (phase title, duration input, description)
- Dynamic Media Resource list (Add row / remove row)
- Mentor Tips textarea
- Action buttons: "💾 บันทึกแผนการสอน", "🔄 คืนค่ามาตรฐานโรงเรียน", "ปิด"

- [ ] **Step 3: Implement modal handler functions in `app/js/app.js`**
Implement:
`openLessonEditorModal(grade, period)`
`saveLessonEditorModal()`
`resetCurrentLessonModal()`
`renderEditorMediaRows(mediaList)`
`addEditorMediaRow(item)`
`removeEditorMediaRow(btn)`

- [ ] **Step 4: Run test to verify it passes**
Run: `node test_e2e_suite.js`

- [ ] **Step 5: Commit Task 4**
```powershell
git commit -am "feat(editor): implement lesson editor modal with step durations and media management"
```

---

### Task 5: Curriculum Hub (คลังแผนการสอน 40 คาบ) Overview Modal

**Files:**
- Modify: `app/index.html` (Header button & `#modal-curriculum-hub`)
- Modify: `app/js/app.js` (`App.openCurriculumHubModal()`, filter by M1/M2)
- Test: `test_e2e_suite.js`

**Interfaces:**
- Produces: `App.openCurriculumHubModal(grade)` & overview table of 20 periods with status chips

- [ ] **Step 1: Write DOM and functional test in `test_e2e_suite.js`**
Verify `#modal-curriculum-hub` and navigation button exist.

- [ ] **Step 2: Add header button & `#modal-curriculum-hub` in `app/index.html`**
Add `"📚 คลังแผนการสอน"` in top navigation.
Add Modal with:
- Grade tabs: ม.1 (ศ21101/ศ21102) vs ม.2 (ศ22101/ศ22102)
- Period list cards with Topic, KPA summary, and status badge ("แผนมาตรฐาน" vs "✏️ แผนปรับแต่ง")
- Quick "✏️ แก้ไข" button per card
- Global "🔄 คืนค่าแผนมาตรฐานทั้ง 40 คาบ" button

- [ ] **Step 3: Implement `openCurriculumHubModal` and card rendering in `app/js/app.js`**

- [ ] **Step 4: Run tests**
Run: `node test_e2e_suite.js`

- [ ] **Step 5: Commit Task 5**
```powershell
git commit -am "feat(curriculum): implement 40-period curriculum management hub"
```

---

### Task 6: Bump Cache Version, E2E Verification & GitHub Pages Deployment

**Files:**
- Modify: `app/sw.js` (Bump `CACHE_NAME` to `'musicsmart-v18'`)
- Modify: `app/index.html` (Bump script tags `?v=20261020_03`)
- Test: `test_e2e_suite.js`

- [ ] **Step 1: Bump cache versions**
Update `CACHE_NAME` in `app/sw.js` and `?v=` in `app/index.html`.

- [ ] **Step 2: Run full E2E test suite**
Run: `node test_e2e_suite.js`
Expected: 100% tests PASS (>= 75 tests).

- [ ] **Step 3: Commit and Push to `origin main`**
```powershell
git commit -am "chore(release): bump cache to v18 and deploy customizable curriculum editor to main"
git push origin main
```

- [ ] **Step 4: Verify in live browser via `browser_subagent`**
Verify modal opens, editing a period updates topic and T-PACE timer, and resetting restores base lesson.
