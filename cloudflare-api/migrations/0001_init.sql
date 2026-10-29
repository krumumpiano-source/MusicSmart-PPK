-- MusicSmart PPK • D1 schema v1 (Cloudflare D1 / SQLite)
-- ใช้กับฐานข้อมูล musicsmart-db เท่านั้น ไม่มีการอ้างอิง Google Sheet / Supabase / R2

CREATE TABLE IF NOT EXISTS teachers (
  email        TEXT PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  auth_scheme  TEXT NOT NULL,          -- 'hmac-sha256-v1' (ตั้งค่าใหม่) | 'pbkdf2-sha256-legacy' (ยังไม่ย้าย)
  auth_hash    TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  student_id     TEXT PRIMARY KEY,     -- รหัสนักเรียน (ค่าเดียวกับที่ใช้ล็อกอิน)
  class_name     TEXT NOT NULL,        -- เช่น 'ม.1/1'
  no             INTEGER,
  prefix         TEXT NOT NULL DEFAULT '',
  first_name     TEXT NOT NULL DEFAULT '',
  last_name      TEXT NOT NULL DEFAULT '',
  nickname       TEXT NOT NULL DEFAULT '',
  pin_hash       TEXT,                 -- NULL = ยังไม่ได้ตั้ง PIN
  pin_updated_at TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students (class_name, no);

-- บันทึกคาบเรียน (การเช็คชื่อ คะแนนรายคน บันทึกหลังสอน แผนการสอนที่ผูกกับคาบ) เก็บเป็น JSON ต่อคาบ
CREATE TABLE IF NOT EXISTS sessions (
  session_key TEXT PRIMARY KEY,        -- คีย์เดียวกับ Store.getSessionKey() ในแอป
  class_name  TEXT NOT NULL,
  period      INTEGER,
  data        TEXT NOT NULL DEFAULT '{}',
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON sessions (class_name, period);

-- งานที่นักเรียนส่ง: ส่งเป็นลิงก์ (OneDrive / iCloud / Google Drive ส่วนตัว ฯลฯ) ไม่เก็บไฟล์วิดีโอบนระบบ
CREATE TABLE IF NOT EXISTS submissions (
  id             TEXT PRIMARY KEY,
  student_id     TEXT NOT NULL REFERENCES students (student_id),
  class_name     TEXT NOT NULL,
  period         INTEGER,
  assignment_key TEXT NOT NULL,
  group_no       INTEGER,
  clip_no        INTEGER,
  video_url      TEXT NOT NULL DEFAULT '',
  link_status    TEXT NOT NULL DEFAULT 'unchecked', -- unchecked | ok | invalid
  score          REAL,
  feedback       TEXT NOT NULL DEFAULT '',
  submitted_at   TEXT,
  updated_at     TEXT NOT NULL,
  UNIQUE (student_id, assignment_key, clip_no)
);
CREATE INDEX IF NOT EXISTS idx_submissions_class ON submissions (class_name, assignment_key);

-- งานวิจัย CAR: คะแนนก่อนเรียน/หลังเรียน/ระหว่างเรียนรายคน
CREATE TABLE IF NOT EXISTS research_scores (
  class_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  pre        REAL,
  post       REAL,
  formative  REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_name, student_id)
);

-- กันการส่งซ้ำ (idempotency) ของการ sync จากคิว offline ฝั่งแอป
CREATE TABLE IF NOT EXISTS sync_ops (
  op_id      TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- บันทึกการกระทำสำคัญ (ล็อกอิน เปลี่ยนรหัส แก้คะแนน) เพื่อตรวจย้อนหลังได้
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
