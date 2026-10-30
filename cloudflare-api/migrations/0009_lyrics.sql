-- เนื้อร้องใต้โน้ต + โหวตเนื้อร้องในกลุ่ม (คาบ 8-10) : ย้ายจากต้นแบบ Apps Script มาอยู่บน D1
CREATE TABLE IF NOT EXISTS lyric_drafts (
  class_name TEXT NOT NULL,
  song_key   TEXT NOT NULL,
  student_id TEXT NOT NULL,
  cells      TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_name, song_key, student_id)
);

CREATE TABLE IF NOT EXISTS lyric_votes (
  class_name TEXT NOT NULL,
  song_key   TEXT NOT NULL,
  voter_id   TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_name, song_key, voter_id)
);

CREATE TABLE IF NOT EXISTS lyric_settings (
  class_name TEXT NOT NULL,
  song_key   TEXT NOT NULL,
  json       TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_name, song_key)
);
