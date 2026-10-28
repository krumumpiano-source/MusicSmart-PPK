import os
import sys
import docx

sys.stdout.reconfigure(encoding='utf-8')
base = r'D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'

targets = [
    'เครื่องมือวัดผล',
    'เอกสารประกอบ',
    'แบบทดสอบและพิมพ์เขียว',
    'คู่มือการสอนสำหรับครู',
    'สื่อการสอน'
]

for target in targets:
    tpath = os.path.join(base, target)
    print(f"\n==========================================")
    print(f"📁 FOLDER: {target}")
    print(f"==========================================")
    for root, dirs, files in os.walk(tpath):
        rel = os.path.relpath(root, tpath)
        for f in files:
            if not f.endswith('.docx') or f.startswith('~$'):
                continue
            fp = os.path.join(root, f)
            rel_f = os.path.join(rel, f) if rel != '.' else f
            try:
                doc = docx.Document(fp)
                paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
                head = paras[:4] if paras else ["(EMPTY DOCUMENT)"]
                print(f"\nFile: {rel_f}")
                for h in head:
                    print(f"   Line: {h}")
            except Exception as e:
                print(f"\nFile: {rel_f} -> ERROR: {e}")
