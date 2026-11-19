-- Exam anti-cheat telemetry + server-side answer draft recovery (no browser storage needed)
ALTER TABLE exam_attempts ADD COLUMN tab_switches INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exam_attempts ADD COLUMN draft_answers TEXT;
