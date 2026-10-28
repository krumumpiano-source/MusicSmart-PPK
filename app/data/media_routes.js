/* ตารางประกาศเส้นทางสื่อ (label → สิ่งที่ปุ่มเปิดจริง) ของ ม.1
 * กฎ: ทุกรายการสื่อในคาบ (lessons.js → media[]) ต้องมีแถวที่นี่ — ไม่มีเส้นทางสำรอง/โมดอลกลาง
 * tests/test_media_routes.js ตรวจว่าทุก url ใน LESSONS_DATA.M1 มีแถว และ route อยู่ในชุดที่ระบบรองรับ
 * cls: digital (เปิดในแอป) | document (เอกสาร: ไม่มีไฟล์ → แจ้ง "ยังไม่มีสื่อ" ตรง ๆ) | equipment (ของจริงที่ต้องเตรียม)
 *      | teacher (เฉพาะครู) | external (ลิงก์ภายนอก) | activity (กิจกรรม)
 * route: guide | syllabus | acoustics | anatomy | metronome | practice | scale_chart | criteria | ensemble | timbre | feldman
 *        | exam_info | influence5 | equipment | teacher_only | missing | external
 * kw: คำที่ต้องอยู่ในชื่อสื่อ (ใช้ยืนยันว่าป้ายปุ่มตรงกับ route)
 */
(function (root) {
  var R = {
    M1: {
      'academic/media/musicsmart_guide.pdf':            { cls: 'digital',   route: 'guide',      kw: ['คู่มือ'] },
      'academic/wk3/course_syllabus.docx':              { cls: 'digital',   route: 'syllabus',   kw: ['โครงสร้างรายวิชา'] },
      'academic/media/kalimba_acoustics.png':           { cls: 'digital',   route: 'acoustics',  kw: ['Acoustics'] },
      'academic/media/kalimba_anatomy_posture.png':     { cls: 'digital',   route: 'anatomy',    kw: ['ส่วนประกอบ', 'ท่าทางการจับถือ'] },
      'academic/media/cleaning_kit.png':                { cls: 'equipment', route: 'equipment',  kw: ['ซองผ้า'], items: ['ซองผ้าสำหรับเก็บคาลิมบ้า', 'ผ้านุ่มไมโครไฟเบอร์'] },
      'academic/media/musicsmart_metronome.png':        { cls: 'digital',   route: 'metronome',  kw: ['Metronome'] },
      'https://soundcorset.com':                        { cls: 'external',  route: 'external',   kw: ['Soundcorset'] },
      'academic/media/smart_practice_c_major.png':      { cls: 'digital',   route: 'practice',   kw: ['Smart Practice', 'C Major'], item: 'p3_c_major', metronome: true },
      'academic/media/c_major_scale_chart.pdf':         { cls: 'digital',   route: 'scale_chart', kw: ['ตารางเปรียบเทียบ', 'C Major'] },
      'academic/media/exercise_interval_root_do.pdf':   { cls: 'digital',   route: 'practice',   kw: ['แบบฝึกหัด', 'รูทคงที่'], item: 'p4_root_do_pairs' },
      'academic/media/exercise_interval_3rds.pdf':      { cls: 'digital',   route: 'practice',   kw: ['แบบฝึกหัด', '3'], item: 'p5_moving_3rds' },
      'academic/media/exercise_interval_4ths.pdf':      { cls: 'digital',   route: 'practice',   kw: ['แบบฝึกหัด', '4'], item: 'p6_moving_4ths' },
      'academic/media/exercise_sequence_3notes.pdf':    { cls: 'digital',   route: 'practice',   kw: ['แบบฝึกหัด', 'โน้ตอนุกรม'], item: 'p7_pattern_1' },
      'academic/media/sheet_ode_to_joy_doremi.pdf':     { cls: 'digital',   route: 'practice',   kw: ['โน้ตเพลง'], item: 'p8_ode_to_joy' },
      'academic/media/rubric_ode_to_joy.pdf':           { cls: 'digital',   route: 'criteria',   kw: ['แบบประเมิน'] },
      'academic/media/rubric_doremi.pdf':               { cls: 'digital',   route: 'criteria',   kw: ['แบบประเมิน'] },
      'academic/media/musicsmart_midterm_exam.png':     { cls: 'digital',   route: 'exam_info',  kw: ['ระบบสอบดิจิทัล'] },
      'academic/media/teacher_approval_dashboard.png':  { cls: 'teacher',   route: 'teacher_only', kw: ['Teacher Approval Dashboard'] },
      'academic/wk3/midterm_blueprint.docx':            { cls: 'teacher',   route: 'missing', kw: ['พิมพ์เขียวข้อสอบ'] },
      'ensemble/thai':                                  { cls: 'digital',   route: 'ensemble',   kw: ['Ensemble Explorer'], ensemble: 'thai' },
      'rubric/thai_ensemble':                           { cls: 'digital',   route: 'criteria',   kw: ['Rubric'] },
      'ensemble/western':                               { cls: 'digital',   route: 'ensemble',   kw: ['Ensemble Explorer'], ensemble: 'western' },
      'rubric/western_ensemble':                        { cls: 'digital',   route: 'criteria',   kw: ['Rubric'] },
      'app/interactive/timbre_feldman.html':            { cls: 'digital',   route: 'timbre',     kw: ['Timbre', 'Feldman'] },
      'academic/media/feldman_worksheet.pdf':           { cls: 'digital',   route: 'feldman',    kw: ['Feldman'] },
      'influence/five_dimensions':                      { cls: 'digital',   route: 'influence5', kw: ['แผนภาพ 5 มิติ'] },
      'academic/media/rubric_music_influence.pdf':      { cls: 'digital',   route: 'criteria',   kw: ['เกณฑ์การประเมิน'] },
      'academic/media/musicsmart_final_exam.png':       { cls: 'digital',   route: 'exam_info',  kw: ['ระบบสอบดิจิทัล'] },
      'academic/media/teacher_final_approval.png':      { cls: 'teacher',   route: 'teacher_only', kw: ['Teacher Approval Dashboard'] },
      'academic/wk3/final_blueprint.docx':              { cls: 'teacher',   route: 'missing', kw: ['พิมพ์เขียวข้อสอบ'] },
      'academic/media/knowledge_hub.png':               { cls: 'document',  route: 'missing',    kw: ['คลังความรู้'] }
    }
  };
  var ROUTES = ['guide', 'syllabus', 'acoustics', 'anatomy', 'metronome', 'practice', 'scale_chart', 'criteria', 'ensemble', 'timbre',
    'feldman', 'influence5', 'exam_info', 'equipment', 'teacher_only', 'missing', 'external'];
  var API = { M1: R.M1, ROUTES: ROUTES, lookup: function (grade, url) { var g = R[grade || 'M1'] || {}; return g[String(url || '')] || null; } };
  root.MEDIA_ROUTES = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
