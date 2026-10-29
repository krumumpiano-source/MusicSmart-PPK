-- ห้องสอบกลางภาค/ปลายภาค: ข้อสอบและเฉลยอยู่บนเซิร์ฟเวอร์เท่านั้น
CREATE TABLE IF NOT EXISTS exam_bank (
  kind TEXT NOT NULL,
  q_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  question TEXT NOT NULL,
  choices TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  src_period TEXT,
  src_objective TEXT,
  difficulty TEXT,
  status TEXT,
  PRIMARY KEY (kind, q_id)
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  session_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  class_name TEXT NOT NULL,
  open_ms INTEGER NOT NULL,
  close_ms INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  closed_ms INTEGER,
  created_ms INTEGER NOT NULL,
  max_points INTEGER NOT NULL,
  items INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_class ON exam_sessions (class_name, created_ms);

CREATE TABLE IF NOT EXISTS exam_attempts (
  attempt_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  class_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  no INTEGER,
  attempt_no INTEGER NOT NULL,
  started_ms INTEGER NOT NULL,
  deadline_ms INTEGER NOT NULL,
  submitted_ms INTEGER,
  status TEXT NOT NULL,
  order_json TEXT NOT NULL,
  correct INTEGER,
  items INTEGER NOT NULL,
  points REAL,
  level INTEGER,
  late INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_session ON exam_attempts (session_id, student_id);

CREATE TABLE IF NOT EXISTS exam_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  extra INTEGER NOT NULL,
  granted_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exam_grants ON exam_grants (session_id, student_id);
