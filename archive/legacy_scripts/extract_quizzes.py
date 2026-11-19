import json
import re

# Load the extracted full curriculum JSON
with open('m1_full_curriculum_extracted.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

test_files = data.get('tests', [])
print(f"Total test files: {len(test_files)}")

unit_tests = []

for tf in test_files:
    fname = tf['filename']
    if 'ท้ายหน่วย' not in fname:
        continue
    
    # Identify unit number
    unit_match = re.search(r'หน่วยที่_(\d+)', fname)
    unit_no = int(unit_match.group(1)) if unit_match else 0
    
    UNIT_TITLES = {
        1: 'พื้นฐานคาลิมบ้าและทักษะการปฏิบัติเบื้องต้น',
        2: 'โน้ตและบทเพลงสร้างสรรค์',
        3: 'ดนตรีข้ามวัฒนธรรมและการสื่อสารร่วมสมัย',
        4: 'สุนทรียภาพและการสะท้อนคิดทางดนตรี'
    }
    title = tf.get('title', '') or UNIT_TITLES.get(unit_no, f'หน่วยการเรียนรู้ที่ {unit_no}')
    paragraphs = tf.get('paragraphs', [])
    tables = tf.get('tables', [])
    
    # Parse answer table
    answers_map = {}
    if tables and len(tables) > 0:
        table_rows = tables[0]
        # Header is row 0: ['ข้อที่', 'คำตอบ', 'ระดับพฤติกรรม (Bloom)', 'คำอธิบายเหตุผลทางวิชาการ']
        for row in table_rows[1:]:
            if len(row) >= 4:
                q_num = row[0].strip()
                ans = row[1].strip()
                bloom = row[2].strip()
                exp = row[3].strip()
                answers_map[q_num] = {
                    'correct': ans,
                    'bloom': bloom,
                    'explanation': exp
                }
    
    # Parse questions from paragraphs
    questions = []
    current_q = None
    
    for p in paragraphs:
        p_clean = p.strip()
        q_start = re.match(r'ข้อที่\s*(\d+)[\.:]\s*(.+)', p_clean)
        if q_start:
            if current_q:
                questions.append(current_q)
            q_num = q_start.group(1)
            q_text = q_start.group(2)
            ans_info = answers_map.get(q_num, {'correct': '', 'bloom': '', 'explanation': ''})
            current_q = {
                'id': f"U{unit_no}-Q{int(q_num):02d}",
                'no': int(q_num),
                'question': q_text,
                'choices': [],
                'correct': ans_info['correct'],
                'bloom': ans_info['bloom'],
                'explanation': ans_info['explanation']
            }
            continue
        
        choice_match = re.match(r'^([ก-ง])[\.:]\s*(.+)', p_clean)
        if choice_match and current_q:
            c_key = choice_match.group(1)
            c_text = choice_match.group(2)
            current_q['choices'].append({
                'key': c_key,
                'text': c_text
            })
            
    if current_q:
        questions.append(current_q)
        
    unit_tests.append({
        'unit_no': unit_no,
        'title': title,
        'filename': fname,
        'total_questions': len(questions),
        'questions': questions
    })

# Sort by unit_no
unit_tests.sort(key=lambda u: u['unit_no'])
print(f"Processed {len(unit_tests)} unit tests with question counts:")
for u in unit_tests:
    print(f"Unit {u['unit_no']}: {u['total_questions']} questions")

js_content = "// ==========================================================================\n"
js_content += "// Phayaophitthayakhom School - Test Blueprint & Unit Quizzes (คลังข้อสอบ 40 ข้อ)\n"
js_content += "// กลุ่มสาระการเรียนรู้ศิลปะ (สาระดนตรี) วิชา ศ21101 ดนตรี 1 ชั้น ม.1\n"
js_content += "// ==========================================================================\n\n"
js_content += "const QUIZZES_DATA = " + json.dumps({'units': unit_tests}, ensure_ascii=False, indent=2) + ";\n\n"
js_content += "if (typeof module !== 'undefined' && module.exports) {\n"
js_content += "  module.exports = QUIZZES_DATA;\n"
js_content += "}\n"

with open('app/data/quizzes.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Wrote quizzes.js successfully ({len(js_content)} chars)")
