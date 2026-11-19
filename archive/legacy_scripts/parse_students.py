import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import re
import json

def main():
    with open('raw_user_input.txt', 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    classes_data = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.isdigit() and 1 <= int(line) <= 40:
            if i + 1 < len(lines) and re.match(r'^\d{5}$', lines[i+1]):
                row_no = int(line)
                student_id = lines[i+1]
                full_name = lines[i+2]
                last_name = lines[i+3]
                
                val_next = lines[i+4]
                if re.match(r'^ม\.\d+/\d+$', val_next):
                    nickname = '-'
                    class_name = val_next
                    student_num = int(lines[i+5])
                    i += 6
                else:
                    nickname = val_next
                    class_name = lines[i+5]
                    student_num = int(lines[i+6])
                    i += 7
                
                prefix = ''
                first_name = full_name
                for p in ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว']:
                    if full_name.startswith(p):
                        prefix = p
                        first_name = full_name[len(p):]
                        break
                
                if class_name not in classes_data:
                    classes_data[class_name] = []
                
                if not any(s['student_id'] == student_id for s in classes_data[class_name]):
                    classes_data[class_name].append({
                        'id': f"{class_name}_{student_num}",
                        'student_id': student_id,
                        'prefix': prefix,
                        'first_name': first_name,
                        'last_name': last_name,
                        'nickname': nickname,
                        'class': class_name,
                        'no': student_num
                    })
                continue
        i += 1

    os.makedirs(os.path.join("app", "data"), exist_ok=True)
    js_content = "// Generated Student Roster Data for Phayaophitthayakhom School\n"
    js_content += "const STUDENTS_DATA = " + json.dumps(classes_data, ensure_ascii=False, indent=2) + ";\n\n"
    js_content += "if (typeof module !== 'undefined' && module.exports) {\n  module.exports = STUDENTS_DATA;\n}\n"
    
    with open(os.path.join("app", "data", "students.js"), "w", encoding="utf-8") as f:
        f.write(js_content)
    print("SUCCESS: Written app/data/students.js")

if __name__ == '__main__':
    main()
