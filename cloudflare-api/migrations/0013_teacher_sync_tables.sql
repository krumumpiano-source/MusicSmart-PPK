-- 0013: Real tables for rubrics and custom curriculum lessons (closing sync_archive write-only black hole)

CREATE TABLE IF NOT EXISTS rubrics (
  student_id  TEXT NOT NULL,
  period      INTEGER NOT NULL,
  class_name  TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (student_id, period)
);

CREATE INDEX IF NOT EXISTS idx_rubrics_class_period ON rubrics(class_name, period);

CREATE TABLE IF NOT EXISTS curriculum_lessons (
  grade       TEXT NOT NULL,
  period      INTEGER NOT NULL,
  data        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (grade, period)
);
