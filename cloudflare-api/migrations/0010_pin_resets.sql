-- คำขอรีเซ็ต PIN (นักเรียน / นศ.ฝึกสอน) ที่ครูอนุมัติในแอป โดยไม่ใช้อีเมล
-- ครูได้รหัสยืนยัน 6 หลัก (แสดงครั้งเดียว เก็บเป็นแฮชเท่านั้น) แล้วแจ้งผู้ใช้ ผู้ใช้ตั้ง PIN ใหม่เอง
CREATE TABLE IF NOT EXISTS pin_reset_requests (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL,              -- 'student' | 'intern'
  subject    TEXT NOT NULL,              -- รหัสนักเรียน / รหัส นศ.
  status     TEXT NOT NULL,              -- pending | approved | used | rejected | burned | superseded
  code_hash  TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_ms INTEGER NOT NULL,
  decided_ms INTEGER,
  expires_ms INTEGER,
  used_ms    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pin_reset_subject ON pin_reset_requests (role, subject, status);
