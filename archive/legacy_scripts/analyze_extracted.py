import json
import sys

with open("m1_full_curriculum_extracted.json", "r", encoding="utf-8") as f:
    data = json.load(f)

output_lines = []

output_lines.append("=== วก3 (โครงสร้างรายวิชา ศ21101) ===")
if data.get("wk3"):
    output_lines.append(f"จำนวนย่อหน้า: {len(data['wk3']['paragraphs'])}, จำนวนตาราง: {len(data['wk3']['tables'])}")
    output_lines.append("หัวข้อสำคัญ:")
    for p in data["wk3"]["paragraphs"][:8]:
        output_lines.append(f"  • {p}")

output_lines.append("\n=== วก4 (หน่วยการเรียนรู้ 4 หน่วย) ===")
for u in data.get("wk4", []):
    output_lines.append(f"  📁 {u['filename']} (ย่อหน้า: {len(u['paragraphs'])}, ตาราง: {len(u['tables'])})")
    first_title = u['paragraphs'][1] if len(u['paragraphs']) > 1 else u['filename']
    output_lines.append(f"     -> {first_title}")

output_lines.append(f"\n=== วก5 (แผนการจัดการเรียนรู้ {len(data.get('wk5', []))} แผน) ===")
for p in data.get("wk5", []):
    topic = "ไม่ระบุเรื่อง"
    for line in p["paragraphs"][:12]:
        if "เรื่อง" in line:
            topic = line
            break
    output_lines.append(f"  • {p['filename']}: {topic}")

output_lines.append(f"\n=== สื่อการสอนและใบกิจกรรม ({len(data.get('media', []))} ฉบับ) ===")
for m in data.get("media", []):
    output_lines.append(f"  • {m['filename']}")

output_lines.append(f"\n=== เครื่องมือวัดและประเมินผล ({len(data.get('eval', []))} ฉบับ) ===")
for e in data.get("eval", []):
    output_lines.append(f"  • {e['filename']}")

output_lines.append(f"\n=== เอกสารประกอบ ({len(data.get('supp', []))} ฉบับ) ===")
for s in data.get("supp", []):
    output_lines.append(f"  • {s['filename']}")

output_lines.append(f"\n=== แบบทดสอบและพิมพ์เขียว ({len(data.get('tests', []))} ฉบับ) ===")
for t in data.get("tests", []):
    output_lines.append(f"  • {t['filename']}")

with open("scratch_analysis_report.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

print("Analysis report saved to scratch_analysis_report.txt")
