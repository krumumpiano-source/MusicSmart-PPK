# -*- coding: utf-8 -*-
"""
Master Upgrade Script for Grade 7 Music Curriculum (ศ21101)
Elevating วก.3, วก.4, วก.5, and Markdown Master Plan to Senior Expert (คศ.4 - คิดค้นและปรับเปลี่ยน)
"""
import os, sys, glob, re
sys.stdout.reconfigure(encoding='utf-8')
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.oxml.ns import qn
from pythainlp.tokenize import word_tokenize

from plans_data_korsor4 import PLANS_DATA

ZWSP = '\u200B'
BASE_DIR = r"d:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101"

def zwsp(text):
    if not text:
        return ""
    cleaned = text.replace(ZWSP, '')
    tokens = word_tokenize(cleaned, engine='newmm')
    return ZWSP.join(tokens)

def set_font(run, size=16, bold=False, color=None, fn="TH Sarabun New"):
    run.font.name = fn
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)
    r = run._element
    rPr = r.get_or_add_rPr()
    rf = rPr.get_or_add_rFonts()
    for a in ('ascii', 'hAnsi', 'cs', 'eastAsia'):
        rf.set(qn(f'w:{a}'), fn)

def set_para_text(p, text, size=16, bold=False):
    p.text = ''
    run = p.add_run(zwsp(text))
    set_font(run, size=size, bold=bold)
    return p

def set_cell_text(cell, text, size=14, bold=False):
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(zwsp(text))
    set_font(run, size=size, bold=bold)
    return p

# -------------------------------------------------------------
# 1. UPGRADE วก.3 (โครงสร้างรายวิชา)
# -------------------------------------------------------------
WK3_COURSE_DESC_P1 = (
    "       ศึกษาและวิเคราะห์โครงสร้างระบบสัญกรณ์ดนตรีเปรียบเทียบสากล-ไทย บันไดเสียง C Major และสัญกรณ์ตาราง 8 ห้องเพลง "
    "กลไกสวนศาสตร์ขั้นสูง (Advanced Acoustics) ของเครื่องดนตรีคาลิมบ้า 17 คีย์ อันประกอบด้วยความถี่ธรรมชาติ (Natural Frequency) "
    "โหมดการสั่นพ้องของลิ้นโลหะ (Resonance Modes) และการแผ่กระจายของคลื่นเสียงผ่านกล่องกำทอน (Acoustic Cavity Projection) "
    "วิเคราะห์ความสัมพันธ์ของอัตราจังหวะ 4/4 และความแม่นยำเชิงเวลาของมิติความเร็ว (Metronomic Temporal Precision) ศึกษาวิวัฒนาการ "
    "โครงสร้างสุนทรียศาสตร์ และการจัดหมวดหมู่วงดนตรีไทย ดนตรีพื้นบ้าน 4 ภาค และวงดนตรีสากล ตลอดจนการประยุกต์ใช้กรอบแนวคิด"
    "สุนทรียวิจารณ์เชิงวิชาการตามระเบียบวิธีของเฟลด์แมน (Feldman's Method of Art Criticism) เพื่อวิพากษ์คุณค่า อิทธิพล และอัตลักษณ์"
    "ดนตรีที่มีผลต่อพลวัตทางสังคม วัฒนธรรมท้องถิ่นพะเยา และความเป็นมนุษย์ที่สมบูรณ์"
)

WK3_COURSE_DESC_P2 = (
    "       โดยบูรณาการนวัตกรรมการจัดการเรียนรู้เชิงรุก \"Adaptive T-PACE Learning Ecosystem\" ผ่านแพลตฟอร์มการประมวลผลดนตรีอัจฉริยะ "
    "\"MusicSmart\" ที่ขับเคลื่อนด้วยเทคโนโลยี Web Audio Signal Processing ปฏิบัติการจัดสรีรวิทยาของระนาบข้อนิ้ว (Kinematic Hand Posture) "
    "ฝึกฝนทักษะการดีดลิ่มโลหะแบบอิสระ การเคลื่อนนิ้วเชิงอนุกรมขั้นคู่เสียง (Root-Pedal, Harmonic 3rd/4th Intervals, and Linear Sequences) "
    "สอดคล้องกับจังหวะเคาะความเร็วแบบปรับเหมาะอัตโนมัติ (Dynamic Difficulty Adjustment: DDA) ฝึกการประพันธ์คำร้องเชิงกวีนิพนธ์ร่วมสมัย"
    "ผสานฉันทลักษณ์ไทยลงบนทำนองหลัก การบรรเลงและขับร้องประสานเสียงด้วยเทคนิค Polyphonic Control การวิเคราะห์ข้อมูลสถิติการเรียนรู้"
    "ผ่านระบบ Cloud-Based Data Analytics และการจำลองสัมมนากลุ่มดิจิทัลเพื่อนำเสนอแคมเปญดนตรีขับเคลื่อนสังคมท้องถิ่น"
)

WK3_COURSE_DESC_P3 = (
    "       เพื่อให้ผู้เรียนเกิดสมรรถนะการรู้คิดขั้นสูงทางดนตรี (Higher-Order Musical Cognition) มีทักษะการปฏิบัติเครื่องดนตรีที่มีความเที่ยงตรง"
    "ทางสวนศาสตร์ มีสมรรถนะการกำกับตนเอง (Self-Regulated Learning) ใฝ่เรียนรู้ มุ่งมั่นในการพัฒนาทักษะ มีวินัยทางจังหวะ ตระหนักและเห็นคุณค่า"
    "ในมรดกทางวัฒนธรรมดนตรีท้องถิ่นและสากล สามารถเชื่อมโยงคุณค่าดนตรีสู่การพัฒนาจิตตปัญญา คุณภาพชีวิต และปฏิบัติตนตามหลักปรัชญา"
    "เศรษฐกิจพอเพียงและหลักวิถีพุทธอย่างยั่งยืน"
)

WK3_TABLE3_CONCEPTS = {
    1: "การเรียนรู้สัญกรณ์ดนตรีสากลและโน้ตไทย 8 ห้องเพลง กลไกสวนศาสตร์ขั้นสูงของคาลิมบ้า 17 คีย์ สรีรวิทยาการวางระนาบข้อนิ้ว และการฝึกปฏิบัติสเกล C Major ขั้นคู่เสียง และโน้ตอนุกรมด้วยระบบปรับความเร็วอัตโนมัติ (DDA) ผ่าน MusicSmart Web Audio Signal Processing",
    2: "การบรรเลงบทเพลงมาตรฐานสากล Ode to Joy ด้วยเทคนิค Polyphonic Control การประพันธ์คำร้องภาษาไทยผสานฉันทลักษณ์และวรรณยุกต์ตรงทำนองหลัก การขับร้องประกอบการบรรเลง และการวัดผลกลางภาคผ่านระบบสอบดิจิทัล Real-time Cloud Analytics",
    4: "การจัดประเภทวงดนตรีไทยและวงดนตรีสากลในมิติด้านสวนศาสตร์ วิวัฒนาการ และหน้าที่ทางสังคมวัฒนธรรม ผ่านกระบวนการ Universal Baseline ควบคู่กับระบบสัมมนากลุ่มดิจิทัล 5 กลุ่ม 8 บทบาท และ Digital Cross-Learning Log บน MusicSmart",
    5: "การเปรียบเทียบเสียงร้องและเครื่องดนตรีต่างวัฒนธรรม การประยุกต์ระเบียบวิธีสุนทรียวิจารณ์ 4 ขั้นตอนของ Feldman บนระบบดิจิทัล การจัดทำแคมเปญดนตรีพัฒนาสังคมท้องถิ่น 5 มิติ และการประเมินรวบยอดปลายภาคด้วยระบบสอบอัจฉริยะ"
}

def update_wk3():
    path = os.path.join(BASE_DIR, "วก3_โครงสร้างรายวิชา_ศ21101_ดนตรี1_20คาบ.docx")
    print(f"Updating วก.3: {path}")
    doc = docx.Document(path)
    
    # Update Paragraphs 4, 5, 6 (Course Description)
    set_para_text(doc.paragraphs[4], WK3_COURSE_DESC_P1, size=16)
    set_para_text(doc.paragraphs[5], WK3_COURSE_DESC_P2, size=16)
    set_para_text(doc.paragraphs[6], WK3_COURSE_DESC_P3, size=16)
    
    # Update Table 3 (Course Structure)
    t3 = doc.tables[3]
    for row_idx, concept_text in WK3_TABLE3_CONCEPTS.items():
        set_cell_text(t3.rows[row_idx].cells[3], concept_text, size=14)
        
    doc.save(path)
    print("✓ วก.3 upgraded successfully.")

# -------------------------------------------------------------
# 2. UPGRADE วก.4 (4 UNITS)
# -------------------------------------------------------------
WK4_UNITS = {
    1: {
        'concept': (
            "การเรียนรู้ระบบสัญกรณ์ดนตรีสากลและโน้ตไทย 8 ห้องเพลง ผสานหลักสวนศาสตร์เชิงลึก (Advanced Acoustics) "
            "และกลไกการสั่นพ้องของคาลิมบ้า 17 คีย์ สรีรวิทยาการวางระนาบข้อนิ้ว (Kinematic Hand Posture) อัตราจังหวะ 4/4 "
            "และความแม่นยำเชิงเวลา ผ่านนวัตกรรม \"Adaptive T-PACE Learning Ecosystem\" ร่วมกับระบบประมวลผลคลื่นเสียงสด "
            "(Web Audio Signal Processing) บนแอปพลิเคชัน MusicSmart ฝึกฝนสเกล C Major ขั้นคู่เสียง และโน้ตอนุกรมด้วยระบบปรับความเร็วอัตโนมัติ "
            "(Dynamic Difficulty Adjustment: DDA) ที่ตอบสนองต่อสมรรถนะกล้ามเนิ้อมัดเล็กและสะท้อนข้อมูลย้อนกลับทันที (Instant Formative Feedback)"
        ),
        'tpace': (
            "การจัดกิจกรรมการเรียนรู้ในหน่วยนี้ใช้กระบวนการจัดการเรียนรู้เชิงรุก (Active Learning) บูรณาการโมเดลนวัตกรรม Adaptive T-PACE: "
            "1) T - Trigger & Diagnostic Challenge กระตุ้นโสตประสาท วินิจฉัยความพร้อม และทดสอบจังหวะจำลอง "
            "2) P - Precision Practice & Sensorimotor Calibration ฝึกปฏิบัติแม่นยำรายบุคคลโดยมีอัลกอริทึมจับค่าความคลาดเคลื่อนทางเวลา (Temporal Latency) "
            "3) A - Adaptive Application & Telemetry Tracking ซ้อมกับแบบฝึกโน้ตวิ่งและวิเคราะห์ความเพี้ยนเสียงผ่าน Web Audio API "
            "4) C - Collaboration & Peer Calibration แลกเปลี่ยนการสังเกตสรีระและสะท้อนผลผ่าน Visual Dashboard และ "
            "5) E - Evaluation & Metacognitive Empowerment วิเคราะห์ข้อมูลเส้นทางการเรียนรู้ (Learning Trajectory) เสริมพลังใจ และสะท้อนคิดกำกับตนเอง"
        )
    },
    2: {
        'concept': (
            "การบรรเลงบทเพลงมาตรฐานสากล (Ode to Joy) ด้วยเทคนิค Polyphonic Control และการจัดระเบียบนิ้วขั้นสูง ควบคู่กับการประยุกต์ฉันทลักษณ์"
            "วรรณศิลป์ไทยสู่การประพันธ์เนื้อร้องสร้างสรรค์ที่สอดคล้องกับทำนองหลัก (Pitch-Tone Prosody Synchronization) ขับร้องประกอบการบรรเลง "
            "และการวัดผลประเมินผลกลางภาคผ่านระบบดิจิทัล MusicSmart ที่ประมวลผลสรุปคะแนน Real-time สู่ฐานข้อมูล Cloud Analytics พร้อมแดชบอร์ดครู"
            "เพื่อการวินิจฉัยและอนุมัติสอบซ่อม"
        ),
        'tpace': (
            "การจัดกิจกรรมการเรียนรู้บูรณาการโมเดล Adaptive T-PACE เน้นการคิดสร้างสรรค์ขั้นสูง (Higher-Order Creativity): "
            "1) T - Trigger & Musical Insight จุดประกายด้วยบริบททางประวัติศาสตร์และอารมณ์เพลง "
            "2) P - Polyphonic Practice ฝึกทักษะสองระนาบ (Bimodal Coordination) บรรเลงพร้อมขับร้อง "
            "3) A - Algorithmic Prosody Verification ตรวจสอบความสอดคล้องของวรรณยุกต์กับระดับเสียงทำนองในแอป "
            "4) C - Creative Group Co-creation ประพันธ์เนื้อเพลง 8 วรรคและผสานเสียงรวมกลุ่ม "
            "5) E - Exam Analytics & Growth Mindset วิเคราะห์สมรรถนะกลางภาคผ่านระบบประเมินผลอัจฉริยะ"
        )
    },
    3: {
        'concept': (
            "การวิเคราะห์จัดประเภทวงดนตรีไทย (ปี่พาทย์ เครื่องสาย มโหรี และดนตรีพื้นบ้าน 4 ภาค) และวงดนตรีสากล (Orchestra, Wind Band, "
            "Chamber, Jazz, Pop-Rock) ในมิติด้านสวนศาสตร์ วิวัฒนาการ และหน้าที่ทางสังคมวัฒนธรรม ผ่านกระบวนการ Universal Baseline "
            "ร่วมกับนวัตกรรม Digital Cross-Learning Log และ Knowledge Hub บน MusicSmart เพื่อให้ผู้เรียนสังเคราะห์ความเชื่อมโยงของระบบเครื่องดนตรี"
            "ต่างวัฒนธรรมได้อย่างเป็นระบบ"
        ),
        'tpace': (
            "การจัดกิจกรรมการเรียนรู้แบบ Active Seminar บนแพลตฟอร์มดิจิทัล: "
            "1) T - Acoustic & Timbre Trigger จำแนกเอกลักษณ์เนื้อเสียงและคลื่นความถี่ของเครื่องดนตรีต่างประเภท "
            "2) P - Participatory Baseline การสร้างฐานความรู้สากลร่วมกันทั้งชั้นเรียน "
            "3) A - Application of Interactive Seating Chart ออกแบบและจัดวางผังวงดนตรีตามหลักสวนศาสตร์บนแอป "
            "4) C - Collaborative 8-Role Seminar การสัมมนาดิจิทัลแบบเจาะลึก 5 กลุ่ม 8 บทบาทไม่ซ้ำซ้อน "
            "5) E - Ecosystem Cross-Synthesis การสังเคราะห์และเชื่อมโยงมโนทัศน์ร่วมผ่านระบบประเมินเพื่อนแบบทันที"
        )
    },
    4: {
        'concept': (
            "การวิเคราะห์เปรียบเทียบสำเนียงเสียงร้องและเสียงเครื่องดนตรีต่างวัฒนธรรมตามองค์ประกอบดนตรี การประยุกต์ใช้ระเบียบวิธีสุนทรียวิจารณ์"
            "เชิงวิชาการตามกรอบ 4 ขั้นตอนของเฟลด์แมน (Feldman's Method: Description, Analysis, Interpretation, Judgement) บนระบบดิจิทัล "
            "การศึกษาและนำเสนอแคมเปญอิทธิพลของดนตรีต่อบุคคล สังคม และท้องถิ่นพะเยา 5 มิติ ตลอดจนการสอบวัดผลสัมฤทธิ์ปลายภาคเรียนผ่านระบบ"
            "ทดสอบดิจิทัล MusicSmart ที่วิเคราะห์ความรอบรู้และโสตทักษะอย่างครอบคลุมและเที่ยงธรรม"
        ),
        'tpace': (
            "การจัดกิจกรรมการเรียนรู้เพื่อสร้างสมรรถนะการคิดขั้นสูงและจิตสำนึกพลเมือง: "
            "1) T - Cultural Clash Trigger วิเคราะห์ความแตกต่างทางโสตทัศน์ของเสียงดนตรีต่างวัฒนธรรม "
            "2) P - Professional Criticism Practice ฝึกการวิจารณ์อิงข้อมูลตามกระบวนการเฟลด์แมน 4 ช่อง "
            "3) A - Applied Social Action ออกแบบแคมเปญดนตรีแก้ปัญหาและขับเคลื่อนสังคมกว๊านพะเยา "
            "4) C - Community Showcase การนำเสนอแคมเปญสาธารณะและการประเมินความคุ้มค่าทางสังคม "
            "5) E - Exemplary Holistic Evaluation การประเมินรวบยอดปลายภาคและสะท้อนคิดการเรียนรู้ตลอดชีวิต"
        )
    }
}

def update_wk4():
    folder = os.path.join(BASE_DIR, "วก4_หน่วยการเรียนรู้_4หน่วย")
    unit_files = {
        1: "วก4_หน่วยการเรียนรู้ที่_1_พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า.docx",
        2: "วก4_หน่วยการเรียนรู้ที่_2_บทเพลงและการประพันธ์เนื้อร้องสร้างสรรค์.docx",
        3: "วก4_หน่วยการเรียนรู้ที่_3_วงดนตรีไทยและวงดนตรีสากล.docx",
        4: "วก4_หน่วยการเรียนรู้ที่_4_การวิเคราะห์วิจารณ์และอิทธิพลของดนตรีต่อสังคม.docx"
    }
    
    for u_idx, filename in unit_files.items():
        path = os.path.join(folder, filename)
        if not os.path.exists(path):
            print(f"Warning: {path} not found.")
            continue
        print(f"Updating วก.4 Unit {u_idx}: {filename}")
        doc = docx.Document(path)
        
        # 1. Update Core Concept
        for i, p in enumerate(doc.paragraphs):
            if "สาระสำคัญ/ความคิดรวบยอด" in p.text.replace(ZWSP, ''):
                if i + 1 < len(doc.paragraphs):
                    set_para_text(doc.paragraphs[i+1], "       " + WK4_UNITS[u_idx]['concept'], size=16)
                break
                
        # 2. Update Learning Activities description
        for i, p in enumerate(doc.paragraphs):
            if "Adaptive T-PACE" in p.text.replace(ZWSP, '') and "กิจกรรมการเรียนรู้" in p.text.replace(ZWSP, ''):
                if i + 1 < len(doc.paragraphs):
                    set_para_text(doc.paragraphs[i+1], "       " + WK4_UNITS[u_idx]['tpace'], size=16)
                break
                
        doc.save(path)
        print(f"✓ วก.4 Unit {u_idx} upgraded successfully.")

# -------------------------------------------------------------
# 3. UPGRADE วก.5 (20 PLANS)
# -------------------------------------------------------------
def update_wk5():
    folder = os.path.join(BASE_DIR, "วก5_แผนรายคาบ_20คาบ")
    plan_files = sorted(glob.glob(os.path.join(folder, "*.docx")))
    print(f"Found {len(plan_files)} plan files in วก.5 folder.")
    
    for p_path in plan_files:
        fn = os.path.basename(p_path)
        # Extract plan number from filename (e.g., วก5_แผนการจัดการเรียนรู้ที่_03_...)
        match = re.search(r'ที่_(\d+)_', fn)
        if not match:
            continue
        plan_num = int(match.group(1))
        if plan_num not in PLANS_DATA:
            print(f"Warning: No data for plan {plan_num}")
            continue
            
        print(f"Upgrading วก.5 Plan {plan_num:02d}: {fn}")
        doc = docx.Document(p_path)
        p_data = PLANS_DATA[plan_num]
        
        # --- A. Update Teaching Steps ---
        # Find step headings
        idx_intro = -1
        idx_teach = -1
        idx_conclude = -1
        idx_media = -1
        idx_eval_tools = -1
        
        for i, p in enumerate(doc.paragraphs):
            t = p.text.replace(ZWSP, '')
            if "ขั้นนำเข้าสู่บทเรียน" in t and "[T" in t:
                idx_intro = i
            elif "ขั้นสอน" in t and "[P" in t:
                idx_teach = i
            elif "ขั้นสรุปบทเรียน" in t and "[E" in t:
                idx_conclude = i
            elif "สื่อ / แหล่งเรียนรู้" in t or "สื่อ  /  แหล่งเรียนรู้" in t:
                idx_media = i
            elif "เครื่องมือวัด" in t and idx_eval_tools == -1:
                idx_eval_tools = i
                
        # Update Intro steps
        if idx_intro != -1 and idx_teach != -1:
            intro_paras = [p for p in doc.paragraphs[idx_intro+1:idx_teach] if p.text.strip()]
            for step_i, step_text in enumerate(p_data['act_intro']):
                if step_i < len(intro_paras):
                    set_para_text(intro_paras[step_i], step_text, size=16)
                    
        # Update Teach steps
        if idx_teach != -1 and idx_conclude != -1:
            teach_paras = [p for p in doc.paragraphs[idx_teach+1:idx_conclude] if p.text.strip()]
            for step_i, step_text in enumerate(p_data['act_teach']):
                if step_i < len(teach_paras):
                    set_para_text(teach_paras[step_i], step_text, size=16)
                    
        # Update Conclude steps
        if idx_conclude != -1 and idx_media != -1:
            conclude_paras = [p for p in doc.paragraphs[idx_conclude+1:idx_media] if p.text.strip()]
            for step_i, step_text in enumerate(p_data['act_conclude']):
                if step_i < len(conclude_paras):
                    set_para_text(conclude_paras[step_i], step_text, size=16)
                    
        # Update Evaluation Tools
        if idx_eval_tools != -1 and idx_eval_tools + 1 < len(doc.paragraphs):
            set_para_text(doc.paragraphs[idx_eval_tools + 1], p_data['eval_tools'], size=16)
            
        # --- B. Update Rubrics Table (Table 0) ---
        t0 = doc.tables[0]
        # t0 has 5 rows: Header, Row 1 (K), Row 2 (P), Row 3 (A), Row 4 (Competency)
        # Columns: 0: Topic, 1: Weight, 2: Level 4, 3: Level 3, 4: Level 2, 5: Level 1
        if len(t0.rows) >= 5 and len(t0.columns) >= 6:
            r_k = p_data['rubrics']['k']
            r_p = p_data['rubrics']['p']
            r_a = p_data['rubrics']['a']
            r_comp = p_data['rubrics']['comp']
            
            for col_i in range(4): # col_i = 0 -> Level 4 (cell index 2), 1 -> Level 3 (cell index 3), ...
                set_cell_text(t0.rows[1].cells[col_i + 2], r_k[col_i], size=14)
                set_cell_text(t0.rows[2].cells[col_i + 2], r_p[col_i], size=14)
                set_cell_text(t0.rows[3].cells[col_i + 2], r_a[col_i], size=14)
                set_cell_text(t0.rows[4].cells[col_i + 2], r_comp[col_i], size=14)
                
        # --- C. Ensure Post-Lesson Section is Kept Blank With Dotted Lines ---
        # The user requested: "ยกเว้นส่วนบันทึกหลังสอนจริงๆแล้วต้องเว้นว่างไว้ เพราะแผนนี้ยังไม่ได้นำไปใช้จจริง การบันทึกหลังสอนเราจะให้ครูบันทึกหลังสอนจริิงๆในแอพครับ"
        # Verify that post-lesson section has clean dotted lines
        for p in doc.paragraphs:
            if "แนวทางการแก้ปัญหาหรือปรับปรุงแผน" in p.text.replace(ZWSP, ''):
                p.text = ''
                run = p.add_run(zwsp("แนวทางการแก้ปัญหาหรือปรับปรุงแผนการจัดการเรียนรู้ครั้งต่อไป (Action plan / วิจัย CAR / วงขับเคลื่อนทางวิชาชีพ PLC และการบันทึกข้อมูลผ่านแอป MusicSmart)"))
                set_font(run, size=16, bold=True)
                
        doc.save(p_path)
        print(f"✓ วก.5 Plan {plan_num:02d} upgraded successfully.")

# -------------------------------------------------------------
# 4. UPGRADE MARKDOWN MASTER PLAN (แผนการจัดการเรียนรู้_ศ21101_ดนตรี1_ม1_20คาบ.md)
# -------------------------------------------------------------
def update_markdown():
    md_path = os.path.join(BASE_DIR, "แผนการจัดการเรียนรู้_ศ21101_ดนตรี1_ม1_20คาบ.md")
    print(f"Updating Markdown Master Plan: {md_path}")
    
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace Course Description
    old_p1_pattern = r"ศึกษาและทำความเข้าใจเกี่ยวกับระบบเครื่องหมายและสัญลักษณ์ทางดนตรี.*?และบทบาทอิทธิพลของดนตรีต่อบุคคลและสังคมท้องถิ่น"
    content = re.sub(old_p1_pattern, WK3_COURSE_DESC_P1.strip(), content, flags=re.DOTALL)
    
    old_p2_pattern = r"โดยใช้กระบวนการทางดนตรีและการจัดการเรียนรู้เชิงรุก.*?ตลอดจนการทำแบบทดสอบวัดผลสัมฤทธิ์และโสตทักษะในระบบดิจิทัล"
    content = re.sub(old_p2_pattern, WK3_COURSE_DESC_P2.strip(), content, flags=re.DOTALL)
    
    old_p3_pattern = r"เพื่อให้ผู้เรียนเกิดความรู้ ความเข้าใจ มีทักษะการปฏิบัติเครื่องดนตรีสากล.*?ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ"
    content = re.sub(old_p3_pattern, WK3_COURSE_DESC_P3.strip(), content, flags=re.DOTALL)
    
    # Save markdown
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("✓ Markdown Master Plan upgraded successfully.")

if __name__ == "__main__":
    print("=== STARTING MASTER KORSOR 4 UPGRADE ===")
    update_wk3()
    update_wk4()
    update_wk5()
    update_markdown()
    print("=== ALL CURRICULUM ASSETS UPGRADED SUCCESSFULLY TO KORSOR 4 ===")
