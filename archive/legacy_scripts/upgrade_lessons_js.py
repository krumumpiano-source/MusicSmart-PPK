import json
import re

with open("m1_full_curriculum_extracted.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

with open("app/data/academic_docs.js", "r", encoding="utf-8") as f:
    # extract JSON part
    js = f.read()
    json_str = js.split("const ACADEMIC_DOCS = ")[1].split(";\n\nif (typeof module")[0]
    academic_docs = json.loads(json_str)

# Map unit numbers to periods
# Unit 1: P01 - P04 (พื้นฐานคาลิมบ้า)
# Unit 2: P05 - P11 (ปฏิบัติรวมวงคาลิมบ้า)
# Unit 3: P12 - P15 (รอบรู้วงดนตรีและวัฒนธรรม)
# Unit 4: P16 - P18 (สุนทรียภาพแห่งการฟัง)
# Assessment: P19 - P20 (สอบปลายภาคและถอดบทเรียน)

m1_lessons = []

def extract_kpa(paragraphs):
    k, p, a = "", "", ""
    for i, para in enumerate(paragraphs):
        if "ด้านความรู้ (K)" in para and i + 1 < len(paragraphs) and paragraphs[i + 1].startswith("1.1"):
            k = re.sub(r"^1\.1\s*", "", paragraphs[i + 1]).strip()
        elif "ด้านทักษะกระบวนการ (P)" in para and i + 1 < len(paragraphs) and paragraphs[i + 1].startswith("2.1"):
            p = re.sub(r"^2\.1\s*", "", paragraphs[i + 1]).strip()
        elif "ด้านคุณลักษณะอันพึงประสงค์ (A)" in para and i + 1 < len(paragraphs) and paragraphs[i + 1].startswith("3.1"):
            a = re.sub(r"^3\.1\s*", "", paragraphs[i + 1]).strip()
    return {
        "k": k if k else "เข้าใจหลักการและองค์ประกอบทางดนตรีตามบทเรียน",
        "p": p if p else "ปฏิบัติทักษะทางดนตรีและกระบวนการตามลำดับขั้นตอน",
        "a": a if a else "มีความรับผิดชอบ มุ่งมั่น และร่วมมือในการเรียนรู้"
    }

def extract_steps(paragraphs):
    steps = []
    step_labels = {
        "T": "ขั้นที่ 1: T - Trigger & Tuning",
        "P": "ขั้นที่ 2: P - Practice & Precision (3-Tier Mastery)",
        "A": "ขั้นที่ 3: A - Active Collaboration & Analysis",
        "C": "ขั้นที่ 4: C - Creative Challenge (คิดค้นและสร้างสรรค์)",
        "E": "ขั้นที่ 5: E - Evaluation & Reflection"
    }
    for para in paragraphs:
        m = re.match(r"^([TPACE])\s*-\s*(\d+)\.\s*\((\d+)\s*นาที\)\s*(.+)$", para)
        if m:
            letter = m.group(1)
            dur = int(m.group(3))
            desc = m.group(4).strip()
            desc = re.sub(r"^\[[^\]]+\]\s*", "", desc).strip()
            steps.append({
                "phase": f"{step_labels.get(letter, letter)} ({dur} นาที)",
                "duration": dur,
                "desc": desc
            })
    if not steps:
        steps = [
            {"phase": "ขั้นที่ 1: T - Trigger & Tuning (6 นาที)", "duration": 6, "desc": "กระตุ้นความสนใจด้วยคำถามสืบเสาะและเทียบเสียงเครื่องดนตรี"},
            {"phase": "ขั้นที่ 2: P - Practice & Precision (18 นาที)", "duration": 18, "desc": "ฝึกทักษะตามวงจร 3-Tier Mastery Loop (Bronze / Silver / Gold)"},
            {"phase": "ขั้นที่ 3: A - Active Collaboration (10 นาที)", "duration": 10, "desc": "ปฏิบัติกิจกรรมกลุ่มและวินิจฉัยเสียงร่วมกับคู่บัดดี้"},
            {"phase": "ขั้นที่ 4: C - Creative Challenge (8 นาที)", "duration": 8, "desc": "ภารกิจคิดค้นและสร้างสรรค์ทางดนตรี"},
            {"phase": "ขั้นที่ 5: E - Evaluation & Reflection (8 นาที)", "duration": 8, "desc": "ประเมินผลรูบริก 3 มิติ (K-P-A) และสะท้อนคิดหลังเรียน"}
        ]
    return steps

def extract_mentor_tips(paragraphs):
    mode_txt = "Adaptive T-PACE Framework ควบคู่กับวงจร 3-Tier Mastery Loop (Bronze / Silver / Gold)"
    plan_b_txt = "เตรียมใบกิจกรรมฉบับกระดาษ (Hardcopy) และชุดส้อมเสียงมาตรฐานกรณีออฟไลน์"
    for para in paragraphs:
        if "Adaptive T-PACE Framework" in para and "Mode" in para:
            m = re.search(r"\[(Mode [^\]]+)\]", para)
            if m:
                mode_txt = f"รูปแบบ Adaptive T-PACE ({m.group(1)}) ร่วมกับวงจร 3-Tier Mastery Loop (Bronze / Silver / Gold)"
        elif para.startswith("4. Plan B"):
            plan_b_txt = para.split(":", 1)[1].strip() if ":" in para else para
    return f"💡 กลยุทธ์ระดับเชี่ยวชาญ (คศ.4): ใช้ {mode_txt} แบ่งบทบาทคู่บัดดี้ (Performer & Acoustic Coach) • แผนสำรอง (Plan B): {plan_b_txt}"

for p in academic_docs["wk5"]:
    p_num = p["period"]
    unit_no = 1
    unit_name = "พื้นฐานคาลิมบ้าและทักษะการปฏิบัติเบื้องต้น"
    if 5 <= p_num <= 11:
        unit_no = 2
        unit_name = "โน้ตและบทเพลงสร้างสรรค์"
    elif 12 <= p_num <= 15:
        unit_no = 3
        unit_name = "ดนตรีข้ามวัฒนธรรมและการสื่อสารร่วมสมัย"
    elif 16 <= p_num <= 18:
        unit_no = 4
        unit_name = "สุนทรียภาพและการสะท้อนคิดทางดนตรี"

    kpa = extract_kpa(p["paragraphs"])
    steps = extract_steps(p["paragraphs"])
    mentor_tips = extract_mentor_tips(p["paragraphs"])

    # Find matching media
    matching_media = next((m for m in academic_docs["media"] if m["period"] == p_num), None)
    media_items = [
        {
            "title": f"เอกสาร วก.5 แผนการจัดการเรียนรู้ที่ {p_num:02d} ({p['topic']})",
            "type": "doc",
            "url": f"academic/wk5/plan_{p_num:02d}.docx"
        }
    ]
    if matching_media:
        media_items.append({
            "title": f"ใบกิจกรรมประกอบแผน: {matching_media['title']}",
            "type": "worksheet",
            "url": f"academic/media/{matching_media['filename']}"
        })

    # Extract 3-Domain K-P-A rubrics from table 0 if present
    rubrics = []
    if p["tables"] and len(p["tables"]) > 0:
        tbl = p["tables"][0]
        for idx_r, row in enumerate(tbl[1:4]):
            if len(row) >= 4:
                aspect = row[0]
                weight = row[1] if len(row) >= 5 else ""
                desc4 = row[2] if len(row) >= 5 else row[1]
                label_str = f"{aspect} ({weight})" if weight else aspect
                rubrics.append({
                    "score": 3 - idx_r if idx_r < 3 else 1,
                    "label": label_str,
                    "desc": desc4
                })

    if not rubrics:
        rubrics = [
            {"score": 3, "label": "ดีเยี่ยม (ระดับ 4)", "desc": "ปฏิบัติตามทักษะดนตรีได้อย่างแม่นยำ ถูกต้องตามสรีระ และสะท้อนคิดอย่างมีวิจารณญาณ"},
            {"score": 2, "label": "ดี (ระดับ 3)", "desc": "ปฏิบัติตามทักษะดนตรีได้ถูกต้องเป็นส่วนใหญ่ และให้ความร่วมมือในการทำงานกลุ่ม"},
            {"score": 1, "label": "พอใช้ (ระดับ 2)", "desc": "ปฏิบัติตามทักษะดนตรีได้แต่ยังต้องมีครูหรือบัดดี้คอยชี้แนะเป็นระยะ"}
        ]

    m1_lessons.append({
        "lesson_id": f"M1-P{p_num:02d}",
        "grade": "M1",
        "period": p_num,
        "unit_no": unit_no,
        "unit_name": unit_name,
        "topic": p["topic"],
        "kpa": kpa,
        "mentor_tips": mentor_tips,
        "duration_min": 50,
        "steps": steps,
        "media": media_items,
        "assessment": {
            "has_score": True,
            "max_score": 3,
            "type": "rubric",
            "rubrics": rubrics[:3]
        }
    })

# Period 19: Final Exam
m1_lessons.append({
    "lesson_id": "M1-P19",
    "grade": "M1",
    "period": 19,
    "unit_no": 4,
    "unit_name": "การวัดและประเมินผลปลายภาคเรียน",
    "topic": "การสอบวัดผลสัมฤทธิ์ทางการเรียนปลายภาคเรียน (Final Examination)",
    "kpa": {
        "k": "ประมวลความรู้รวบยอดสาระดนตรีสากลและดนตรีไทยตามพิมพ์เขียวข้อสอบ (Test Blueprint)",
        "p": "ทำแบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน 40 ข้อ ครอบคลุมพุทธิพิสัยตาม Bloom's Taxonomy",
        "a": "มีความซื่อสัตย์สุจริต และตรงต่อเวลาในการสอบวัดผล"
    },
    "mentor_tips": "💡 ข้อแนะนำ: ตรวจเช็คความเรียบร้อยของกระดาษคำตอบ และอธิบายคำชี้แจงในการทำข้อสอบ 40 ข้อให้ชัดเจน",
    "duration_min": 50,
    "steps": [
        {"phase": "ขั้นเตรียมการ (10 นาที)", "duration": 10, "desc": "ชี้แจงระเบียบการสอบ กติกา และแจกข้อสอบปลายภาค"},
        {"phase": "ขั้นทำแบบทดสอบ (35 นาที)", "duration": 35, "desc": "นักเรียนทำแบบทดสอบวัดผลสัมฤทธิ์ทางการเรียนปลายภาคเรียน (10 คะแนน)"},
        {"phase": "ขั้นจัดเก็บ (5 นาที)", "duration": 5, "desc": "รวบรวมแบบทดสอบและกระดาษคำตอบ ตรวจนับจำนวนครบถ้วน"}
    ],
    "media": [
        {"title": "พิมพ์เขียวข้อสอบ Test Blueprint ศ21101 (40 ข้อ)", "type": "doc", "url": "academic/tests/Test_Blueprint.docx"}
    ],
    "assessment": {
        "has_score": True,
        "max_score": 10,
        "type": "exam",
        "rubrics": [
            {"score": 3, "label": "ดีเยี่ยม (8-10 คะแนน)", "desc": "ได้คะแนนสอบ 8 - 10 คะแนน (ร้อยละ 80 ขึ้นไป)"},
            {"score": 2, "label": "ดี (6-7 คะแนน)", "desc": "ได้คะแนนสอบ 6 - 7 คะแนน (ร้อยละ 60-79)"},
            {"score": 1, "label": "ผ่านเกณฑ์ขั้นต่ำ (5 คะแนน)", "desc": "ได้คะแนนสอบ 5 คะแนน (ร้อยละ 50-59)"}
        ]
    }
})

# Period 20: Reflection & Debrief
m1_lessons.append({
    "lesson_id": "M1-P20",
    "grade": "M1",
    "period": 20,
    "unit_no": 4,
    "unit_name": "การประเมินและสะท้อนคิดประมวลผลการเรียนรู้",
    "topic": "การสะท้อนคิด ถอดบทเรียนประมวลผลการเรียนรู้ และนำเสนอแฟ้มสะสมงานดิจิทัล",
    "kpa": {
        "k": "อธิบายพัฒนาการทางดนตรีและสมรรถนะที่ตนเองได้รับตลอดภาคเรียน",
        "p": "ประเมินตนเองและสะท้อนคิด (Self-Reflection & Metacognition) ผ่าน Music Portfolio",
        "a": "เห็นคุณค่า สุนทรียภาพแห่งเสียงดนตรี และภาคภูมิใจในผลงานของตนเองและเพื่อน"
    },
    "mentor_tips": "💡 ข้อแนะนำ: สร้างบรรยากาศที่อบอุ่นและส่งเสริม Growth Mindset ให้นักเรียนร่วมชื่นชมผลงานซึ่งกันและกัน",
    "duration_min": 50,
    "steps": [
        {"phase": "ขั้นนำ (10 นาที)", "duration": 10, "desc": "เปิดวิดีโอประมวลภาพบรรยากาศการเรียน Active Learning ตลอดทั้ง 20 คาบ"},
        {"phase": "ขั้นสะท้อนคิด (25 นาที)", "duration": 25, "desc": "นักเรียนเขียนบันทึกสะท้อนคิดตนเอง ถอดบทเรียน และร่วมวิพากษ์ชื่นชมผลงานกลุ่ม"},
        {"phase": "ขั้นสรุปผล (15 นาที)", "duration": 15, "desc": "ครูสรุปคะแนนเก็บสะสม แจ้งผลเวลาเรียน และปิดคอร์สอย่างสร้างสรรค์"}
    ],
    "media": [
        {"title": "แบบประเมินตนเองและถอดบทเรียนการเรียนรู้ดนตรี", "type": "doc", "url": "academic/media/reflection_sheet.docx"}
    ],
    "assessment": {
        "has_score": True,
        "max_score": 3,
        "type": "rubric",
        "rubrics": [
            {"score": 3, "label": "สะท้อนคิดลึกซึ้ง", "desc": "วิเคราะห์พัฒนาการของตนเองได้เป็นรูปธรรมและเชื่อมโยงสู่การเรียนรู้ในอนาคต"},
            {"score": 2, "label": "สะท้อนคิดได้ดี", "desc": "ระบุจุดเด่นและจุดที่ต้องพัฒนาของตนเองได้ชัดเจน"},
            {"score": 1, "label": "สะท้อนคิดพื้นฐาน", "desc": "เขียนบอกความรู้สึกทั่วไปเกี่ยวกับวิชาเรียน"}
        ]
    }
})

# Read existing lessons.js to keep M2 intact
with open("app/data/lessons.js", "r", encoding="utf-8") as f:
    orig = f.read()

# Replace LESSONS_DATA.M1 with m1_lessons
# We can find M2 by parsing or regex
m2_part = orig.split('"M2": [')[1]

new_lessons_js = "// ==========================================================================\n"
new_lessons_js += "// Generated Lesson Plans for Music Education (PPK)\n"
new_lessons_js += "// บูรณาการหลักสูตรจริง วก.3 - วก.5 โรงเรียนพะเยาพิทยาคม (T-PACE Active Learning)\n"
new_lessons_js += "// ==========================================================================\n\n"
new_lessons_js += "const LESSONS_DATA = {\n"
new_lessons_js += '  "M1": ' + json.dumps(m1_lessons, ensure_ascii=False, indent=4) + ",\n"
new_lessons_js += '  "M2": [' + m2_part

with open("app/data/lessons.js", "w", encoding="utf-8") as f:
    f.write(new_lessons_js)

print("app/data/lessons.js upgraded with all 20 official M1 lessons successfully!")
