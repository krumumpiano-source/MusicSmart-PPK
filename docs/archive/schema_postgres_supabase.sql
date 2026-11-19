-- ============================================================================
-- MusicSmart LMS (Adaptive T-PACE & 3-Tier Mastery)
-- Production PostgreSQL / Supabase Schema (3NF) + Indexes + Row-Level Security
-- Phayaophitthayakhom School • กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี)
-- ============================================================================

-- 1. ตารางข้อมูลนักเรียน (Students)
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(10) PRIMARY KEY,
    class_name VARCHAR(15) NOT NULL,          -- เช่น 'ม.1/1', 'ม.2/4'
    grade_level VARCHAR(5) NOT NULL,          -- 'M1' หรือ 'M2'
    roll_no SMALLINT NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'withdrawn', 'transferred')),
    status_date VARCHAR(40),
    status_reason TEXT,
    pdpa_consent BOOLEAN NOT NULL DEFAULT FALSE,
    pin_hash VARCHAR(128),                    -- Salted SHA-256 / Argon2id Hash (ห้ามเก็บ Plaintext)
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    practice_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite Index สำหรับดึงรายชื่อนักเรียนรายห้องเรียงตามเลขที่อย่างรวดเร็ว
CREATE INDEX IF NOT EXISTS idx_students_class_roll ON students (class_name, roll_no);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students (grade_level, class_name);

-- 2. ตารางบันทึกการจัดกิจกรรมการเรียนรู้รายคาบ (Class Sessions & วก.5)
CREATE TABLE IF NOT EXISTS class_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id VARCHAR(10) NOT NULL,         -- เช่น '2569_2'
    class_name VARCHAR(15) NOT NULL,
    period_no SMALLINT NOT NULL CHECK (period_no BETWEEN 1 AND 20),
    taught_date DATE NOT NULL DEFAULT CURRENT_DATE,
    instructor_name VARCHAR(120) NOT NULL,
    instructor_role VARCHAR(50) NOT NULL,
    reflection_outcomes TEXT,
    reflection_problems TEXT,
    reflection_solutions TEXT,
    handover_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (semester_id, class_name, period_no)
);

CREATE INDEX IF NOT EXISTS idx_sessions_lookup ON class_sessions (semester_id, class_name, period_no);

-- 3. ตารางเวลาเรียนและคะแนนรายคาบ (Attendance & Formative Rubric Scores)
CREATE TABLE IF NOT EXISTS session_records (
    session_id UUID NOT NULL REFERENCES class_sessions(session_id) ON DELETE CASCADE,
    student_id VARCHAR(10) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    attendance VARCHAR(15) NOT NULL DEFAULT 'present'
        CHECK (attendance IN ('present', 'absent', 'leave', 'late', 'activity')),
    total_score NUMERIC(4,2) CHECK (total_score >= 0 AND total_score <= 10),
    rubric_breakdown JSONB,                   -- เก็บคะแนนย่อยแต่ละมิติ เช่น {"pitch": 3, "rhythm": 2}
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, student_id)
);

-- Partial Index สำหรับดึงรายการนักเรียนขาดเรียน/ค้างส่งงาน (Make-up Queue) ได้ในระดับมิลลิวินาที
CREATE INDEX IF NOT EXISTS idx_pending_makeups ON session_records (student_id, session_id)
WHERE attendance IN ('absent', 'leave') AND total_score IS NULL;

-- 4. ตารางการส่งงานและ Teacher Feedback Loop (Student Submissions & Feldman Criticism)
CREATE TABLE IF NOT EXISTS student_submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id VARCHAR(10) NOT NULL,
    class_name VARCHAR(15) NOT NULL,
    period_no SMALLINT NOT NULL CHECK (period_no BETWEEN 1 AND 20),
    student_id VARCHAR(10) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    submission_type VARCHAR(20) NOT NULL DEFAULT 'text',
    content TEXT,
    attachment_url TEXT,
    feldman_data JSONB,                       -- เก็บพิกัด Valence-Arousal 2D Grid และคำวิจารณ์ 4 ขั้นตอน
    teacher_feedback TEXT,
    feedback_score NUMERIC(4,2),
    feedback_by VARCHAR(120),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback_at TIMESTAMPTZ,
    UNIQUE (semester_id, class_name, period_no, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_class_period ON student_submissions (semester_id, class_name, period_no);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON student_submissions (student_id, semester_id);

-- 5. ตารางผลสอบวัดผลสัมฤทธิ์ท้ายหน่วยและคะแนนวิจัย CAR (Unit Quizzes & CAR Research Scores)
CREATE TABLE IF NOT EXISTS student_unit_assessments (
    semester_id VARCHAR(10) NOT NULL,
    student_id VARCHAR(10) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    unit_no SMALLINT NOT NULL CHECK (unit_no BETWEEN 1 AND 4),
    quiz_score NUMERIC(4,2) CHECK (quiz_score >= 0 AND quiz_score <= 20),
    pre_test_score NUMERIC(4,2),
    post_test_score NUMERIC(4,2),
    attempt_payload JSONB,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (semester_id, student_id, unit_no)
);

-- ============================================================================
-- Row-Level Security (RLS) เพื่อคุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. PDPA
-- ============================================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_unit_assessments ENABLE ROW LEVEL SECURITY;

-- นโยบายที่ 1: ครูผู้สอน (role = 'teacher') เข้าถึงและแก้ไขได้ทุกแถว
CREATE POLICY teacher_all_students ON students
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'role') = 'teacher');

CREATE POLICY teacher_all_sessions ON class_sessions
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'role') = 'teacher');

CREATE POLICY teacher_all_records ON session_records
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'role') = 'teacher');

CREATE POLICY teacher_all_submissions ON student_submissions
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'role') = 'teacher');

CREATE POLICY teacher_all_unit_assessments ON student_unit_assessments
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'role') = 'teacher');

-- นโยบายที่ 2: นักเรียนดูและส่งงานได้เฉพาะรหัสประจำตัวของตนเองเท่านั้น (ห้ามดูคะแนนเพื่อน)
CREATE POLICY student_read_own_profile ON students
    FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'student_id') = student_id);

CREATE POLICY student_read_own_records ON session_records
    FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'student_id') = student_id);

CREATE POLICY student_manage_own_submissions ON student_submissions
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'student_id') = student_id)
    WITH CHECK ((auth.jwt() ->> 'student_id') = student_id);

CREATE POLICY student_manage_own_unit_assessments ON student_unit_assessments
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'student_id') = student_id)
    WITH CHECK ((auth.jwt() ->> 'student_id') = student_id);
