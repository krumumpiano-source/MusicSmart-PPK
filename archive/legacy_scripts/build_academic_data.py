import json
import os
import re

with open("m1_full_curriculum_extracted.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

# Helper to clean text
def clean_txt(s):
    if not s:
        return ""
    # remove zero-width spaces or weird separator spaces
    s = s.replace("\u200b", "").replace("\ufeff", "")
    return re.sub(r"\s+", " ", s).strip()

academic_data = {
    "wk3": {
        "title": "วก.3 โครงสร้างรายวิชา ศ21101 ดนตรี 1",
        "code": "ศ21101",
        "name": "ดนตรี 1",
        "grade": "มัธยมศึกษาปีที่ 1",
        "term": "ภาคเรียนที่ 2",
        "periods": 20,
        "credits": 0.5,
        "paragraphs": [clean_txt(p) for p in raw["wk3"]["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in raw["wk3"]["tables"]]
    },
    "wk4": [],
    "wk5": [],
    "manuals": [],
    "media": [],
    "eval": [],
    "supp": [],
    "tests": []
}

# 1. Process วก4
for u in raw.get("wk4", []):
    fn = u["filename"]
    unit_match = re.search(r"หน่วยการเรียนรู้ที่_(\d+)_(.+)\.docx", fn)
    unit_no = int(unit_match.group(1)) if unit_match else len(academic_data["wk4"]) + 1
    unit_name = unit_match.group(2).replace("_", " ") if unit_match else fn
    academic_data["wk4"].append({
        "id": f"unit_{unit_no}",
        "filename": fn,
        "unit_no": unit_no,
        "unit_name": unit_name,
        "paragraphs": [clean_txt(p) for p in u["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in u["tables"]]
    })

# 2. Process วก5
for p in raw.get("wk5", []):
    fn = p["filename"]
    p_match = re.search(r"แผนที่_(\d+)", fn)
    p_num = int(p_match.group(1)) if p_match else len(academic_data["wk5"]) + 1
    
    topic = f"แผนการจัดการเรียนรู้ที่ {p_num}"
    for line in p["paragraphs"][:10]:
        cleaned = clean_txt(line)
        if cleaned.startswith("เรื่อง"):
            topic = re.sub(r"^เรื่อง\s*", "", cleaned).strip()
            if "เวลา" in topic:
                topic = topic.split("เวลา")[0].strip()
            break
            
    academic_data["wk5"].append({
        "period": p_num,
        "filename": fn,
        "topic": topic,
        "paragraphs": [clean_txt(para) for para in p["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in p["tables"]]
    })

# 2.5 Process คู่มือการสอนสำหรับครู (22 เล่ม)
for idx, m in enumerate(raw.get("manuals", [])):
    fn = m["filename"]
    title = fn.replace(".docx", "").replace("_", " ")
    academic_data["manuals"].append({
        "idx": idx,
        "filename": fn,
        "title": title,
        "paragraphs": [clean_txt(p) for p in m["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in m["tables"]]
    })

# 3. Process สื่อการสอน
for m in raw.get("media", []):
    fn = m["filename"]
    m_match = re.search(r"ผ(\d+)_(.+)\.docx", fn)
    p_num = int(m_match.group(1)) if m_match else len(academic_data["media"]) + 1
    title = m_match.group(2).replace("_", " ") if m_match else fn
    academic_data["media"].append({
        "period": p_num,
        "filename": fn,
        "title": title,
        "paragraphs": [clean_txt(p) for p in m["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in m["tables"]]
    })

# 4. Process เครื่องมือวัดผล
for idx, e in enumerate(raw.get("eval", [])):
    fn = e["filename"]
    num_match = re.search(r"ฉบับที่_(\d+)_(.+)\.docx", fn)
    doc_no = int(num_match.group(1)) if num_match else idx + 1
    title = num_match.group(2).replace("_", " ") if num_match else fn
    academic_data["eval"].append({
        "doc_no": doc_no,
        "filename": fn,
        "title": title,
        "paragraphs": [clean_txt(p) for p in e["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in e["tables"]]
    })

# 5. Process เอกสารประกอบ
for s in raw.get("supp", []):
    fn = s["filename"]
    title = fn.replace(".docx", "").replace("_", " ")
    academic_data["supp"].append({
        "filename": fn,
        "title": title,
        "paragraphs": [clean_txt(p) for p in s["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in s["tables"]]
    })

# 6. Process แบบทดสอบ
for t in raw.get("tests", []):
    fn = t["filename"]
    title = fn.replace(".docx", "").replace("_", " ")
    academic_data["tests"].append({
        "filename": fn,
        "title": title,
        "paragraphs": [clean_txt(p) for p in t["paragraphs"]],
        "tables": [[[clean_txt(c) for c in row] for row in tbl] for tbl in t["tables"]]
    })

# Output academic_docs.js
js_content = "// ==========================================================================\n"
js_content += "// Phayaophitthayakhom School - Academic Documents Knowledge Base (วก. 1-7)\n"
js_content += "// สาระการเรียนรู้ศิลปะ (ดนตรี 1 ศ21101) ชั้นมัธยมศึกษาปีที่ 1 (Active Learning & วPA คศ.4)\n"
js_content += "// ==========================================================================\n\n"
js_content += "const ACADEMIC_DOCS = " + json.dumps(academic_data, ensure_ascii=False, indent=2) + ";\n\n"
js_content += "if (typeof module !== 'undefined' && module.exports) {\n"
js_content += "  module.exports = ACADEMIC_DOCS;\n"
js_content += "}\n"

with open("app/data/academic_docs.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"app/data/academic_docs.js generated successfully! Size: {os.path.getsize('app/data/academic_docs.js'):,} bytes")
