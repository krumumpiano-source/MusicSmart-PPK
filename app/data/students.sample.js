// SAMPLE roster (fake people only). The public website ships THIS file as data/students.js.
// Real student rosters are imported per device (เมนู จัดการผู้ใช้ > นักเรียน > นำเข้ารายชื่อ)
// and stored only in that device's localStorage. Never commit or deploy real names.
const STUDENTS_IS_SAMPLE = true;
const STUDENTS_DATA = {
  "ม.1/1": [
    {
      "id": "ม.1/1_1",
      "student_id": "90001",
      "prefix": "เด็กชาย",
      "first_name": "ตัวอย่างหนึ่ง",
      "last_name": "ทดสอบระบบ",
      "nickname": "หนึ่ง",
      "class": "ม.1/1",
      "no": 1
    },
    {
      "id": "ม.1/1_2",
      "student_id": "90002",
      "prefix": "เด็กหญิง",
      "first_name": "ตัวอย่างสอง",
      "last_name": "ทดสอบระบบ",
      "nickname": "สอง",
      "class": "ม.1/1",
      "no": 2
    },
    {
      "id": "ม.1/1_3",
      "student_id": "90003",
      "prefix": "เด็กชาย",
      "first_name": "ตัวอย่างสาม",
      "last_name": "ทดสอบระบบ",
      "nickname": "สาม",
      "class": "ม.1/1",
      "no": 3
    }
  ]
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = STUDENTS_DATA;
}
