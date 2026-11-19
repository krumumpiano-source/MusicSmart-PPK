import os
import docx
import re

folder = r"d:\AI CURSER\PLANE MUSIC ED"
files = [f for f in os.listdir(folder) if (f.startswith("หน่วยการเรียนรู้_วก4_") or f.startswith("แผนการสอน_วก5_") or f.startswith("วก5_")) and f.endswith(".docx")]

def clean_text(t):
    return t.replace('\u200b', '').strip()

def extract_section(paragraphs, start_keywords, end_keywords=[]):
    in_section = False
    content = []
    for p in paragraphs:
        text = clean_text(p.text)
        if not text:
            continue
        
        # Check if we should start
        if not in_section:
            for kw in start_keywords:
                if text.startswith(kw):
                    in_section = True
                    content.append(text.replace(kw, '').strip())
                    break
        else:
            # Check if we should end
            should_end = False
            for kw in end_keywords:
                if text.startswith(kw):
                    should_end = True
                    break
            if re.match(r'^\d+\.', text) and not text.startswith('6.1') and not text.startswith('6.2') and not text.startswith('7.1') and not text.startswith('7.2'):
                should_end = True
                
            if should_end:
                break
            content.append(text)
    
    content = [c for c in content if len(c) > 0]
    return " ".join(content).strip()

table1_rows = []
table2_rows = []

for f in sorted(files):
    doc = docx.Document(os.path.join(folder, f))
    paragraphs = doc.paragraphs
    
    if "วก4" in f:
        unit_match = re.search(r'หน่วยที่(\d+)', f)
        unit = f"หน่วยที่ {unit_match.group(1)}" if unit_match else "หน่วย"
        
        # Extract workload
        workload = extract_section(paragraphs, ["6. ชิ้นงาน/ภาระงาน", "6.ชิ้นงาน/ภาระงาน", "6.ชิ้นงาน", "6. ภาระงาน"], ["7. การวัดและประเมินผล", "7.การวัด", "7."])
        if not workload: workload = "ไม่มีระบุ"
        table1_rows.append(f"| {f} | {unit} | {workload} |")
        
        # Extract evaluation
        evaluation = extract_section(paragraphs, ["7. การวัดและประเมินผล", "7.การวัดและประเมินผล"], ["8. กิจกรรมการเรียนรู้", "8.กิจกรรม", "8."])
        if not evaluation: evaluation = "ไม่มีระบุ"
        table2_rows.append(f"| {f} | {unit} | {evaluation} | ไม่มีระบุ | ไม่มีระบุ |")
        
    elif "วก5" in f:
        plan_match = re.search(r'แผนที่_?(\d+)', f)
        if plan_match:
            plan = f"แผนที่ {int(plan_match.group(1))}"
        else:
            plan = "แผน"
            
        workload_lines = []
        in_workload = False
        
        eval_lines = []
        in_eval = False
        
        tools_lines = []
        in_tools = False
        
        criteria_lines = []
        in_criteria = False
        
        for p in paragraphs:
            text = clean_text(p.text)
            if not text: continue
            
            # Start/End Workload
            if text == "ชิ้นงาน/ภาระงาน":
                in_workload = True
                in_eval = in_tools = in_criteria = False
                continue
            elif text.startswith("กิจกรรมการเรียนรู้"):
                in_workload = False
                
            # Start/End Eval
            if text == "การวัดและประเมินผล":
                in_eval = True
                in_workload = in_tools = in_criteria = False
                continue
            elif text == "เครื่องมือวัด":
                in_eval = False
                in_tools = True
                in_workload = in_criteria = False
                continue
            elif text.startswith("เกณฑ์การประเมิน"):
                in_tools = False
                in_criteria = False
                continue
            elif text.startswith("เกณฑ์การผ่าน") or text.startswith("เกณฑ์การตัดสิน"):
                in_criteria = True
                in_tools = in_eval = in_workload = False
                criteria_lines.append(text.replace("เกณฑ์การผ่าน", "").strip())
                continue
            elif text.startswith("บันทึกผลหลังการสอน") or text.startswith("ผลการเรียนรู้"):
                in_criteria = False
                
            if in_workload:
                workload_lines.append(text)
            if in_eval:
                eval_lines.append(text)
            if in_tools:
                tools_lines.append(text)
            if in_criteria and not text.startswith("เกณฑ์การผ่าน"):
                criteria_lines.append(text)
                
        w_str = " ".join(workload_lines).strip() if workload_lines else "ไม่มีระบุ"
        e_str = " ".join(eval_lines).strip() if eval_lines else "ไม่มีระบุ"
        t_str = " ".join(tools_lines).strip() if tools_lines else "ไม่มีระบุ"
        c_str = " ".join(criteria_lines).strip() if criteria_lines else "ไม่มีระบุ"
        
        # fix strings
        w_str = w_str.replace('|', ' ')
        e_str = e_str.replace('|', ' ')
        t_str = t_str.replace('|', ' ')
        c_str = c_str.replace('|', ' ')
        
        # Clean up possible leak of "เกณฑ์การผ่าน" into the end of criteria_lines
        if "บันทึกผลหลังการสอน" in c_str:
            c_str = c_str.split("บันทึกผลหลังการสอน")[0].strip()
        
        table1_rows.append(f"| {f} | {plan} | {w_str} |")
        table2_rows.append(f"| {f} | {plan} | {e_str} | {t_str} | {c_str} |")

with open(os.path.join(folder, "result_v2.md"), "w", encoding="utf-8") as out:
    out.write("### 1. ภาระงานและชิ้นงาน (Workload & Assignments)\n\n")
    out.write("| ชื่อไฟล์/รหัสอ้างอิง | หน่วยที่/แผนที่ | รายละเอียดภาระงาน/ชิ้นงาน |\n")
    out.write("|---|---|---|\n")
    for r in table1_rows:
        out.write(r + "\n")
        
    out.write("\n### 2. การวัดและประเมินผล (Measurement & Evaluation)\n\n")
    out.write("| ชื่อไฟล์/รหัสอ้างอิง | หน่วยที่/แผนที่ | วิธีการวัดผล | เครื่องมือที่ใช้ | เกณฑ์การผ่าน |\n")
    out.write("|---|---|---|---|---|\n")
    for r in table2_rows:
        out.write(r + "\n")
