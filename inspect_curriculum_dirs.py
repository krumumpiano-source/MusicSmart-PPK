import os
import sys
import docx

sys.stdout.reconfigure(encoding='utf-8')

base = r'D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'

dirs = [
    'วก3',
    'วก4',
    'วก5',
    'คู่มือการสอนสำหรับครู',
    'สื่อการสอน',
    'เครื่องมือวัดผล',
    'เอกสารประกอบ',
    'แบบทดสอบและพิมพ์เขียว',
    'แผนการสอนพร้อมใช้',
    'แผนไฟล์เก่า'
]

print("================ DIRECTORIES AND FILES ================")
for d in dirs:
    p = os.path.join(base, d)
    print(f"\n📁 [{d}]")
    if not os.path.exists(p):
        print("  (NOT FOUND)")
        continue
    for root, subdirs, files in os.walk(p):
        rel = os.path.relpath(root, p)
        prefix = f"  [{rel}] " if rel != '.' else "  "
        for f in files:
            print(f"{prefix}{f}")
