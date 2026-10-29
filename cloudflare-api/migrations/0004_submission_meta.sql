-- เก็บชื่อชิ้นงาน ข้อความจากนักเรียน และประเภทการส่ง (เพิ่มคอลัมน์อย่างเดียว ไม่แก้ข้อมูลเดิม)
ALTER TABLE submissions ADD COLUMN title TEXT;
ALTER TABLE submissions ADD COLUMN note TEXT;
ALTER TABLE submissions ADD COLUMN submission_type TEXT;
