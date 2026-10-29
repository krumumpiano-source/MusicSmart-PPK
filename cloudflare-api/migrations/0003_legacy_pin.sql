-- MusicSmart PPK • D1 migration 0003: รองรับ PIN เดิมจาก Google Sheet (ย้ายแฮชมาใช้ต่อ)
-- pin_scheme: NULL = สูตรใหม่ hmac-sha256-v1 (ค่าปกติ) | 'gas-sha256x100' = แฮชเดิมจาก GAS ที่ยังไม่ได้อัปเกรด
-- pin_salt:   salt ของแฮชเดิม (ใช้เฉพาะเมื่อ pin_scheme = 'gas-sha256x100')
ALTER TABLE students ADD COLUMN pin_scheme TEXT;
ALTER TABLE students ADD COLUMN pin_salt TEXT;
