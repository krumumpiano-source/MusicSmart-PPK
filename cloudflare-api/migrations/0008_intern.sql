-- นักศึกษาฝึกประสบการณ์วิชาชีพครู: บัญชี / คะแนนรออนุมัติ / บันทึกหลังสอน / ผลนิเทศ
CREATE TABLE IF NOT EXISTS interns (
  intern_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  classes TEXT NOT NULL DEFAULT '',
  pin_hash TEXT,
  pin_set_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'approved',
  university TEXT,
  faculty TEXT,
  major TEXT,
  phone TEXT,
  email TEXT,
  term TEXT,
  academic_year INTEGER,
  preferred_classes TEXT,
  mentor_name TEXT,
  registered_at TEXT,
  decided_at TEXT,
  reject_reason TEXT
);

CREATE TABLE IF NOT EXISTS intern_approvals (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  intern_id TEXT NOT NULL,
  intern_name TEXT,
  class_name TEXT NOT NULL,
  period INTEGER NOT NULL,
  student_id TEXT NOT NULL,
  score REAL NOT NULL,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TEXT,
  client_id TEXT NOT NULL,
  UNIQUE (intern_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_intern_approvals_status ON intern_approvals (status, created_at);

CREATE TABLE IF NOT EXISTS intern_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  intern_id TEXT NOT NULL,
  intern_name TEXT,
  class_name TEXT NOT NULL,
  period INTEGER NOT NULL,
  result TEXT,
  problems TEXT,
  solutions TEXT,
  client_id TEXT NOT NULL,
  UNIQUE (intern_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_intern_logs_intern ON intern_logs (intern_id, created_at);

CREATE TABLE IF NOT EXISTS intern_supervisions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  intern_id TEXT NOT NULL,
  class_name TEXT,
  period INTEGER,
  ratings TEXT NOT NULL,
  total INTEGER NOT NULL,
  comments TEXT,
  mentor TEXT
);
CREATE INDEX IF NOT EXISTS idx_intern_supervisions_intern ON intern_supervisions (intern_id, created_at);
