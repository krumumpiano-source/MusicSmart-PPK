// ค่าที่เผยแพร่ได้ (ไม่ใช่ความลับ). ใส่ URL เว็บแอป Apps Script ที่นี่ เพื่อให้นักเรียนทุกเครื่อง
// ตรวจรหัส/PIN กับเซิร์ฟเวอร์ได้โดยไม่ต้องตั้งค่าเอง (หรือส่งลิงก์ที่มี &api=... ให้นักเรียนแทน)
// ห้ามใส่ SYNC_TOKEN หรือรายชื่อนักเรียนในไฟล์นี้
const MUSICSMART_PUBLIC_API_URL = 'https://script.google.com/macros/s/AKfycbyLV0usn_sVdXVB3so7MkUN3WdahIpdizqUMdOXuqF7AQBCTAGcnNB8EZh2NwzcNa5Xdw/exec';

// โหมด Cloudflare (Worker + D1): true = ใช้ระบบใหม่ทั้งหมด (ล็อกอิน ส่งงาน แบบทดสอบ ห้องสอบ นศ.ฝึกสอน เนื้อร้อง รีเซ็ต PIN)
// ถ้าพบปัญหา ตั้งกลับเป็น false เพื่อใช้ระบบเดิม (GAS) ทันที
var MUSICSMART_USE_CLOUD = true;
