# -*- coding: utf-8 -*-
"""
Upgrade Markdown Master Plan with Korsor 4 Details for all 20 Lessons
"""
import os, sys, re
sys.stdout.reconfigure(encoding='utf-8')
from plans_data_korsor4 import PLANS_DATA

MD_PATH = r"d:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101\แผนการจัดการเรียนรู้_ศ21101_ดนตรี1_ม1_20คาบ.md"

def upgrade_markdown_plans():
    with open(MD_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by ### คาบที่
    pattern = r'(### คาบที่ (\d+):[^\n]+)'
    splits = list(re.finditer(pattern, content))
    
    new_sections = []
    prev_end = 0
    
    for i, m in enumerate(splits):
        p_num = int(m.group(2))
        start_pos = m.start()
        end_pos = splits[i+1].start() if i + 1 < len(splits) else len(content)
        
        # Add content between previous match and this match
        if start_pos > prev_end:
            new_sections.append(content[prev_end:start_pos])
            
        plan_block = content[start_pos:end_pos]
        
        if p_num in PLANS_DATA:
            p_data = PLANS_DATA[p_num]
            
            # Format upgraded teaching steps
            intro_text = " ".join([re.sub(r'^\d+\.\s*', '', s) for s in p_data['act_intro']])
            teach_text = " ".join([re.sub(r'^\d+\.\s*', '', s) for s in p_data['act_teach']])
            conclude_text = " ".join([re.sub(r'^\d+\.\s*', '', s) for s in p_data['act_conclude']])
            
            upgraded_steps = (
                f"- **ขั้นตอนการจัดกิจกรรมการเรียนรู้ (Active Learning: Adaptive T-PACE):**\n"
                f"  1. **ขั้นนำเข้าสู่บทเรียนและวินิจฉัยความพร้อม [T - Trigger & Diagnostic Auditory Challenge] (10 นาที):** {intro_text}\n"
                f"  2. **ขั้นสอนและฝึกปฏิบัติการปรับเหมาะ [P - Precision Practice & Adaptive Coaching] (30 นาที):** {teach_text}\n"
                f"  3. **ขั้นสรุปบทเรียนและสะท้อนคิด [E - Cognitive Debriefing & Algorithmic Empowerment] (10 นาที):** {conclude_text}\n"
            )
            
            # Extract Media section from original block if exists
            media_match = re.search(r'(- \*\*สื่อ / แหล่งเรียนรู้:\*\*.*?\n)(?=- \*\*|\n---|###|\Z)', plan_block, re.DOTALL)
            media_text = media_match.group(1).strip() if media_match else "- **สื่อ / แหล่งเรียนรู้:**\n  - แพลตฟอร์มดิจิทัลเพื่อการเรียนรู้ MusicSmart (แอปพลิเคชัน)\n  - เครื่องดนตรีคาลิมบ้า 17 คีย์และอุปกรณ์ดูแลรักษา"
            
            # Format upgraded rubrics
            rk = p_data['rubrics']['k']
            rp = p_data['rubrics']['p']
            ra = p_data['rubrics']['a']
            rcomp = p_data['rubrics']['comp']
            
            tools_lines = [l.strip() for l in p_data['eval_tools'].splitlines() if l.strip()]
            t_k = tools_lines[0] if len(tools_lines) > 0 else "แบบทดสอบดิจิทัลในแอป MusicSmart"
            t_p = tools_lines[1] if len(tools_lines) > 1 else "ระบบบันทึกคะแนนปฏิบัติอัตโนมัติบน MusicSmart"
            t_a = tools_lines[2] if len(tools_lines) > 2 else "แบบสังเกตพฤติกรรมและการกำกับตนเอง"
            
            upgraded_eval_and_rubrics = (
                f"{media_text}\n"
                f"- **เครื่องมือวัดและประเมินผล:**\n"
                f"  - **ด้านความรู้ (K):** {t_k}\n"
                f"  - **ด้านทักษะกระบวนการ (P):** {t_p}\n"
                f"  - **ด้านคุณลักษณะและสมรรถนะ (A):** {t_a}\n"
                f"- **เกณฑ์การให้คะแนน (Multi-Dimensional Competency Rubrics):**\n"
                f"  - **ระดับ 4 (ดีเยี่ยม - เชี่ยวชาญ):** K: {rk[0]} | P: {rp[0]} | A: {ra[0]} | สมรรถนะ: {rcomp[0]}\n"
                f"  - **ระดับ 3 (ดี):** K: {rk[1]} | P: {rp[1]} | A: {ra[1]} | สมรรถนะ: {rcomp[1]}\n"
                f"  - **ระดับ 2 (พอใช้):** K: {rk[2]} | P: {rp[2]} | A: {ra[2]} | สมรรถนะ: {rcomp[2]}\n"
                f"  - **ระดับ 1 (ปรับปรุง):** K: {rk[3]} | P: {rp[3]} | A: {ra[3]} | สมรรถนะ: {rcomp[3]}\n"
                f"- **บันทึกผลหลังการสอน (เว้นว่างไว้สำหรับครูบันทึกหลังการสอนจริงผ่านระบบแอปพลิเคชัน MusicSmart):**\n"
                f"  - **1. ผลการเรียนรู้ของนักเรียน (K-P-A):** ....................................................................................................................................\n"
                f"  - **2. ปัญหาและอุปสรรคที่ค้นพบ:** ....................................................................................................................................\n"
                f"  - **3. แนวทางแก้ไข / CAR / วง PLC ทางวิชาชีพ:** ....................................................................................................................................\n\n"
                f"---\n\n"
            )
            
            # Find the header + KPA + Teacher notes portion of plan_block (up to ขั้นตอนการจัดกิจกรรมการเรียนรู้)
            step_match = re.search(r'- \*\*ขั้นตอนการจัดกิจกรรมการเรียนรู้', plan_block)
            if step_match:
                plan_header_part = plan_block[:step_match.start()]
                upgraded_plan_block = plan_header_part + upgraded_steps + upgraded_eval_and_rubrics
                new_sections.append(upgraded_plan_block)
            else:
                new_sections.append(plan_block)
        else:
            new_sections.append(plan_block)
            
        prev_end = end_pos
        
    if prev_end < len(content):
        new_sections.append(content[prev_end:])
        
    full_upgraded_content = "".join(new_sections)
    
    with open(MD_PATH, 'w', encoding='utf-8') as f:
        f.write(full_upgraded_content)
        
    print(f"✓ All 20 lessons in {MD_PATH} successfully updated to Korsor 4 standard.")

if __name__ == "__main__":
    upgrade_markdown_plans()
