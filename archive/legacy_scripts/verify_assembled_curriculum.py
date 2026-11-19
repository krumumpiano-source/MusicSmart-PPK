import os
import sys
import docx

sys.stdout.reconfigure(encoding='utf-8')

base = r'D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'

check_dirs = [
    ("วก4", os.path.join(base, "วก4"), 4, ["ภาคผนวก"]),
    ("วก5", os.path.join(base, "วก5"), 18, ["ภาคผนวก"]),
    ("แผนการสอนพร้อมใช้", os.path.join(base, "แผนการสอนพร้อมใช้"), 18, ["ภาคผนวก"]),
    ("คู่มือครู วก4", os.path.join(base, "คู่มือการสอนสำหรับครู", "คู่มือครู ม.1 ดนตรี1 ศ21101", "วก4"), 4, ["ภาคผนวก", "หมวดที่ 4:"]),
    ("คู่มือครู วก5", os.path.join(base, "คู่มือการสอนสำหรับครู", "คู่มือครู ม.1 ดนตรี1 ศ21101", "วก5"), 18, ["ภาคผนวก", "หมวดที่ 7:"])
]

total_files = 0
all_passed = True

print(f"{'โฟลเดอร์/หมวดหมู่':<25} | {'จำนวนไฟล์':<10} | {'ตรวจสอบเนื้อหา':<20} | {'สถานะ':<10}")
print("-" * 75)

for label, folder, expected_count, required_keywords in check_dirs:
    if not os.path.exists(folder):
        print(f"{label:<25} | {'NOT FOUND':<10} | {'-':<20} | ❌ FAILED")
        all_passed = False
        continue
    
    files = [f for f in sorted(os.listdir(folder)) if f.endswith('.docx') and not f.startswith('~$')]
    count = len(files)
    total_files += count
    
    folder_ok = (count == expected_count)
    keywords_ok = True
    sample_details = []
    
    for f in files:
        fpath = os.path.join(folder, f)
        try:
            doc = docx.Document(fpath)
            p_text = " ".join([p.text for p in doc.paragraphs])
            for kw in required_keywords:
                if kw not in p_text:
                    keywords_ok = False
                    print(f"  [MISSING KEYWORD] '{kw}' not found in {f}")
        except Exception as e:
            keywords_ok = False
            print(f"  [ERROR READING] {f}: {e}")
            
    status = "✅ PASS" if (folder_ok and keywords_ok) else "❌ FAIL"
    if not (folder_ok and keywords_ok):
        all_passed = False
        
    print(f"{label:<25} | {count}/{expected_count} ไฟล์  | ครบทุกคีย์เวิร์ด ({', '.join(required_keywords)}) | {status}")

print("-" * 75)
print(f"รวมเอกสารหลักที่ได้รับการตรวจสอบและประกอบสมบูรณ์ทั้งสิ้น: {total_files} ไฟล์")
if all_passed:
    print(">>> ตรวจสอบผ่าน 100% ทุกฉบับมีความสมบูรณ์ หน้าคั่นภาคผนวก และเนื้อหาครบถ้วน <<<")
else:
    print(">>> มีข้อผิดพลาดในบางเอกสาร กรุณาตรวจสอบ <<<")
