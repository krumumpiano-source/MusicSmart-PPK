-- วันกำหนดส่งงานรายคาบ (ครูตั้ง, นักเรียนดู)
CREATE TABLE IF NOT EXISTS due_dates (
  class_name TEXT NOT NULL,
  period INTEGER NOT NULL,
  due_at TEXT,
  title TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_name, period)
);

-- การแจ้งเตือน/คำแนะนำจากครูถึงนักเรียนรายคน (แทน Notices ของ Google Sheet)
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_name TEXT,
  ref TEXT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  score REAL,
  teacher TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notices_student ON notices (student_id, created_at);

-- คลังเก็บรายการซิงค์ของครูที่ยังไม่มีตารางเฉพาะ (เช่น บันทึกต่าง ๆ) — เก็บไว้ก่อนเพื่อไม่ให้ข้อมูลหาย
CREATE TABLE IF NOT EXISTS sync_archive (
  item_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  received_at TEXT NOT NULL,
  received_by TEXT
);
