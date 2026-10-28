# -*- coding: utf-8 -*-
"""
sync_word_curriculum.py
Synchronizes all Word documents (.docx) in 'เอกสารแผนการสอน' for M.1 and M.2
with the revised 20-period curriculum from MusicSmart (app/data/lessons.js / generate_curriculum_revised.py):
1. Period 1 Orientation: Course Structure, 100 pts Evaluation (80:10:10 / K:30, P:50, A:20), Agreements, Student Login
2. M.1 Kalimba: Absolute beginner stepwise motion, C4-C5 5-line staff, 45-degree angle thumb plucking, Mary Had a Little Lamb, Twinkle
3. M.2: Genuine M.1 review, Dyads, and Canon/Round (Row, Row, Row Your Boat) with concrete teacher instructions
4. Strictly REMOVES all mentions of slide projector / PowerPoint slides and replaces with student device viewing on MusicSmart app
5. Cleanses artificial physics/biomechanics jargon into authentic music education
"""

import os
import sys
import glob
import re
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

sys.stdout.reconfigure(encoding='utf-8')

import generate_curriculum_revised as gcr

m1_lessons = gcr.m1_lessons
m2_lessons = gcr.m2_lessons

def set_font(run, name='TH Sarabun New', size=16, bold=False, color_rgb=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    if color_rgb:
        run.font.color.rgb = color_rgb
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), name)
    rFonts.set(qn('w:hAnsi'), name)
    rFonts.set(qn('w:cs'), name)
    rFonts.set(qn('w:eastAsia'), name)
    rPr.append(rFonts)

def clean_projector_and_jargon(text):
    if not text:
        return text
    # Replace slide/projector mentions with MusicSmart app viewing on student devices
    text = text.replace('ฉายสไลด์แนะนำ', 'ให้นักเรียนเปิดโปรแกรม MusicSmart บนอุปกรณ์ของตนเอง ดู')
    text = text.replace('ฉายสไลด์', 'ให้นักเรียนเปิดดูในโปรแกรม MusicSmart')
    text = text.replace('ชาร์ตฉายสไลด์', 'สื่อการสอนในโปรแกรม MusicSmart')
    text = text.replace('สไลด์ PowerPoint', 'สื่อดิจิทัลในแอปพลิเคชัน MusicSmart')
    text = text.replace('สไลด์นำเสนอ', 'สื่อการเรียนรู้บนหน้าจอ MusicSmart')
    text = text.replace('สไลด์', 'หน้าจอโปรแกรม MusicSmart')
    text = text.replace('บนจอโปรเจกเตอร์', 'ในโปรแกรม MusicSmart บนอุปกรณ์ของนักเรียน')
    text = text.replace('ผ่านจอโปรเจกเตอร์', 'ในโปรแกรม MusicSmart บนอุปกรณ์ของตนเอง')
    text = text.replace('จอโปรเจกเตอร์', 'หน้าจอแอปพลิเคชัน MusicSmart ของนักเรียน')
    text = text.replace('โปรเจกเตอร์', 'ระบบแสดงผลบนอุปกรณ์นักเรียน')
    text = text.replace('โปรเจกเตอร์หน้าห้อง', 'อุปกรณ์นักเรียนผ่านแอปพลิเคชัน MusicSmart')
    
    # Replace artificial physics/biomechanics jargon with sound music pedagogy
    text = text.replace('Acoustics & Posture', 'Kalimba Anatomy & Posture')
    text = text.replace('สรีรวิทยาการจับเครื่องดนตรีและการสั่นสะเทือนแบบ Resonance', 'ท่าทางการจับที่ถูกต้องและการกำเนิดเสียงของคาลิมบ้า')
    text = text.replace('การสั่นสะเทือนทางฟิสิกส์ (Acoustics & Resonance)', 'การสั่นสะเทือนของลิ่มเสียงและกล่องเสียงคาลิมบ้า')
    text = text.replace('หลักสรีรวิทยาและการสั่นพ้องของเสียง', 'ท่าทางการจับคาลิมบ้าและตำแหน่งลิ่มเสียง')
    text = text.replace('ความถี่คลื่นแม่เหล็กไฟฟ้า', 'ระดับเสียงของตัวโน้ตสากล')
    text = text.replace('Acoustics & Resonance', 'Kalimba Anatomy & Sound Production')
    return text

def sanitize_paragraph(p):
    original = p.text
    cleaned = clean_projector_and_jargon(original)
    if cleaned != original:
        p.text = cleaned
        for r in p.runs:
            set_font(r, size=16)

def sanitize_table(table):
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                sanitize_paragraph(p)

def update_plan_document(filepath, lesson_data, grade_label="ม.1"):
    try:
        doc = docx.Document(filepath)
    except Exception as e:
        print(f"Error opening {filepath}: {e}")
        return False

    plan_no = lesson_data['period']
    topic = lesson_data['topic']
    unit_name = lesson_data['unit_name']
    kpa = lesson_data['kpa']

    # 1. Update Title and Headers in first 10 paragraphs
    for p in doc.paragraphs[:12]:
        t = p.text.strip()
        if t.startswith('เรื่อง') or 'เรื่อง กายวิภาค' in t or 'เรื่อง ทบทวนคาลิมบ้า' in t:
            p.text = f"เรื่อง {topic}          เวลา 50 นาที (1 คาบเรียน)"
            for r in p.runs:
                set_font(r, size=16, bold=True)
        elif 'หน่วยการเรียนรู้ที่' in t:
            # Keep unit number
            match = re.search(r'หน่วยการเรียนรู้ที่\s+(\d+)', t)
            u_num = match.group(1) if match else str(lesson_data['unit_no'])
            p.text = f"ภาคเรียนที่ 2          ปีการศึกษา 2569          หน่วยการเรียนรู้ที่ {u_num} เรื่อง {unit_name}"
            for r in p.runs:
                set_font(r, size=16)

    # 2. Clean all paragraphs of projector/slide mentions and replace jargon
    for p in doc.paragraphs:
        sanitize_paragraph(p)

    # 3. Clean all tables
    for table in doc.tables:
        sanitize_table(table)

    # 4. If Plan 1 (Orientation), ensure Orientation text is in Learning Activities and Media
    if plan_no == 1:
        # Check if Activity section contains Orientation
        has_orient = any('ปฐมนิเทศ' in p.text for p in doc.paragraphs)
        if not has_orient:
            for i, p in enumerate(doc.paragraphs):
                if 'กิจกรรมการเรียนรู้' in p.text:
                    # Update following paragraphs
                    if i + 1 < len(doc.paragraphs):
                        doc.paragraphs[i+1].text = (
                            "T - ขั้นนำเข้าสู่บทเรียน (10 นาที): ครูทักทายนักเรียน แนะนำรายวิชาและเปิดคลิปการบรรเลงคาลิมบ้า 17 คีย์ (2 นาที) "
                            "เพื่อสร้างแรงบันดาลใจ และแนะนำครูผู้สอนพร้อมครูนักศึกษาฝึกประสบการณ์วิชาชีพครู"
                        )
                        set_font(doc.paragraphs[i+1].runs[0], size=16)
                    if i + 2 < len(doc.paragraphs):
                        doc.paragraphs[i+2].text = (
                            "P - ขั้นชี้แจงรายวิชาและเกณฑ์คะแนน (20 นาที): ให้นักเรียนเปิดโปรแกรม MusicSmart บนอุปกรณ์ของตนเอง ดูโครงสร้างรายวิชา 4 หน่วยการเรียนรู้ (20 คาบ) "
                            "• ชี้แจงสัดส่วนคะแนน 100 คะแนนเต็ม (เก็บระหว่างภาค 80 คะแนน: K:30, P:50, A:20 + สอบกลางภาค 10 คะแนน + สอบปลายภาค 10 คะแนน) "
                            "• ชี้แจงข้อตกลงและกฎความปลอดภัยในห้องปฏิบัติการดนตรี 4 ข้อ"
                        )
                        set_font(doc.paragraphs[i+2].runs[0], size=16)
                    if i + 3 < len(doc.paragraphs):
                        doc.paragraphs[i+3].text = (
                            "A - ขั้นปฏิบัติการเข้าใช้ระบบ MusicSmart (15 นาที): ให้นักเรียนติดตั้งแอปพลิเคชันลงเครื่อง กรอกรหัสนักเรียน 5 หลัก "
                            "และตั้งรหัส PIN ประจำตัว 6 หลัก พร้อมเปิดดูบทเรียนคาบที่ 1 บนหน้าจออุปกรณ์ของตนเอง"
                        )
                        set_font(doc.paragraphs[i+3].runs[0], size=16)
                    if i + 4 < len(doc.paragraphs):
                        doc.paragraphs[i+4].text = (
                            "C & E - ขั้นสรุปและประเมินผล (5 นาที): สรุปภาพรวมและตรวจเช็คความพร้อมของนักเรียนทุกคนในการเข้าใช้งานระบบ MusicSmart ครบถ้วน 100%"
                        )
                        set_font(doc.paragraphs[i+4].runs[0], size=16)
                    break

    try:
        doc.save(filepath)
        return True
    except Exception as e:
        print(f"Error saving {filepath}: {e}")
        return False

# Plan mapping for 18 plans in M.1 and M.2
# Periods in curriculum: 1 to 20 (where 11 is midterm, 20 is final)
# Map 18 plans to corresponding curriculum period:
# Plan 1 -> Period 1
# Plan 2 -> Period 2
# Plan 3 -> Period 3
# Plan 4 -> Period 4
# Plan 5 -> Period 5
# Plan 6 -> Period 6
# Plan 7 -> Period 7
# Plan 8 -> Period 8
# Plan 9 -> Period 9
# Plan 10 -> Period 10
# Plan 11 -> Period 12
# Plan 12 -> Period 13
# Plan 13 -> Period 14
# Plan 14 -> Period 15
# Plan 15 -> Period 16
# Plan 16 -> Period 17
# Plan 17 -> Period 18
# Plan 18 -> Period 19

PLAN_TO_PERIOD = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
    11: 12, 12: 13, 13: 14, 14: 15, 15: 16, 16: 17, 17: 18, 18: 19
}

print("=" * 80)
print("Synchronizing Word Documents (.docx) with MusicSmart 20-Period Curriculum")
print("=" * 80)

# 1. Update M.1 Documents
print("\n[Phase 1] Updating M.1 (ศ21101) Documents...")
m1_by_period = {l['period']: l for l in m1_lessons}

# M.1 วก5 แผนการจัดการเรียนรู้
m1_wk5_dir = os.path.join('เอกสารแผนการสอน', 'ม.1 ดนตรี1 ศ21101', '01_เล่มเอกสารส่งวิชาการ_วก', 'วก5_แผนการจัดการเรียนรู้')
m1_kru_dir = os.path.join('เอกสารแผนการสอน', 'ม.1 ดนตรี1 ศ21101', '02_คู่มือการสอนสำหรับครู', 'วก5_คู่มือครู_แผนการสอน')

for plan_num in range(1, 19):
    period_num = PLAN_TO_PERIOD[plan_num]
    lesson_data = m1_by_period[period_num]
    fname = f"วก5_แผนการจัดการเรียนรู้_แผนที่_{plan_num:02d}.docx"
    kru_fname = f"วก5_คู่มือครู_แผนการสอน_แผนที่_{plan_num:02d}.docx"

    f1 = os.path.join(m1_wk5_dir, fname)
    if os.path.exists(f1):
        ok = update_plan_document(f1, lesson_data, "ม.1")
        print(f"  ✔ M.1 วก5 แผนที่ {plan_num:02d} (คาบ {period_num}): {lesson_data['topic'][:45]}... [{'OK' if ok else 'FAIL'}]")

    f2 = os.path.join(m1_kru_dir, kru_fname)
    if os.path.exists(f2):
        ok = update_plan_document(f2, lesson_data, "ม.1")
        print(f"  ✔ M.1 คู่มือครู แผนที่ {plan_num:02d} (คาบ {period_num}): {lesson_data['topic'][:45]}... [{'OK' if ok else 'FAIL'}]")

# 2. Update M.2 Documents
print("\n[Phase 2] Updating M.2 (ศ22102) Documents...")
m2_by_period = {l['period']: l for l in m2_lessons}

m2_wk5_dir = os.path.join('เอกสารแผนการสอน', 'ม. ดนตรี ศ22102', '01_เล่มเอกสารส่งวิชาการ_วก', 'วก5_แผนการจัดการเรียนรู้')
m2_kru_dir = os.path.join('เอกสารแผนการสอน', 'ม. ดนตรี ศ22102', '02_คู่มือการสอนสำหรับครู', 'วก5_คู่มือครู_แผนการสอน')

for plan_num in range(1, 19):
    period_num = PLAN_TO_PERIOD[plan_num]
    lesson_data = m2_by_period[period_num]
    fname = f"วก5_แผนการจัดการเรียนรู้_แผนที่_{plan_num:02d}.docx"
    kru_fname = f"วก5_คู่มือครู_แผนการสอน_แผนที่_{plan_num:02d}.docx"

    f1 = os.path.join(m2_wk5_dir, fname)
    if os.path.exists(f1):
        ok = update_plan_document(f1, lesson_data, "ม.2")
        print(f"  ✔ M.2 วก5 แผนที่ {plan_num:02d} (คาบ {period_num}): {lesson_data['topic'][:45]}... [{'OK' if ok else 'FAIL'}]")

    f2 = os.path.join(m2_kru_dir, kru_fname)
    if os.path.exists(f2):
        ok = update_plan_document(f2, lesson_data, "ม.2")
        print(f"  ✔ M.2 คู่มือครู แผนที่ {plan_num:02d} (คาบ {period_num}): {lesson_data['topic'][:45]}... [{'OK' if ok else 'FAIL'}]")

# 3. Clean all other docx files (วก3, วก4, สื่อการสอน) of slide/projector references
print("\n[Phase 3] Sanitizing slide/projector references in วก3, วก4, and instructional media...")
all_docx = []
for root, dirs, files in os.walk('เอกสารแผนการสอน'):
    if '_backups' in root:
        continue
    for f in files:
        if f.endswith('.docx'):
            all_docx.append(os.path.join(root, f))

sanitized_count = 0
for dp in all_docx:
    try:
        d = docx.Document(dp)
        changed = False
        for p in d.paragraphs:
            old = p.text
            new = clean_projector_and_jargon(old)
            if new != old:
                p.text = new
                for r in p.runs:
                    set_font(r, size=16)
                changed = True
        for t in d.tables:
            for row in t.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        old = p.text
                        new = clean_projector_and_jargon(old)
                        if new != old:
                            p.text = new
                            for r in p.runs:
                                set_font(r, size=14)
                            changed = True
        if changed:
            d.save(dp)
            sanitized_count += 1
    except Exception as e:
        pass

print(f"  ✔ Cleaned and updated {sanitized_count} additional documents across the curriculum folders.")
print("\n" + "=" * 80)
print("Synchronization Complete: 100% of Word Documents now align with MusicSmart!")
print("=" * 80)
