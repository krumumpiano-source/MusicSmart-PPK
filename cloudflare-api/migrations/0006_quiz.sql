-- คลังข้อสอบรายหน่วย (มีเฉลย อยู่บนเซิร์ฟเวอร์เท่านั้น)
CREATE TABLE IF NOT EXISTS quiz_bank (
  unit_no INTEGER NOT NULL,
  q_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  title TEXT,
  question TEXT NOT NULL,
  choices TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  bloom TEXT,
  PRIMARY KEY (unit_no, q_id)
);

-- ผลการทำแบบทดสอบ (ตรวจบนเซิร์ฟเวอร์) — client_id กันการส่งซ้ำจากคิวออฟไลน์
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_name TEXT,
  client_id TEXT NOT NULL,
  unit_no INTEGER NOT NULL,
  practice INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  time_spent INTEGER,
  answers TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (student_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts (student_id, unit_no);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_class ON quiz_attempts (class_name, created_at);

-- สิทธิ์ทำแบบทดสอบเพิ่ม (สอบซ่อม) ที่ครูให้รายคน
CREATE TABLE IF NOT EXISTS quiz_grants (
  student_id TEXT NOT NULL,
  unit_no INTEGER NOT NULL,
  extra INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, unit_no)
);
