-- ขอรีเซ็ต PIN ผ่านครู: นักเรียน/นศ.ฝึกสอนส่งคำขอ → ครูยืนยันแล้วได้รหัส 6 หลัก (เก็บเป็นแฮชเท่านั้น) → ผู้ใช้ตั้ง PIN ใหม่เอง
CREATE TABLE IF NOT EXISTS pin_reset_requests (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL,            -- 'student' | 'intern'
  subject    TEXT NOT NULL,            -- รหัสนักเรียน / รหัส นศ.
  status     TEXT NOT NULL,            -- pending | approved | used | rejected | burned | superseded
  code_hash  TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_ms INTEGER NOT NULL,
  expires_ms INTEGER,                  -- ตั้งตอนครูอนุมัติ
  decided_ms INTEGER,
  used_ms    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pin_reset_subject ON pin_reset_requests (role, subject, status);
