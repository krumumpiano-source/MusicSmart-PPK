import os
import sys
import re
import docx
from docxcompose.composer import Composer

sys.stdout.reconfigure(encoding='utf-8')

base = r'D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'
media_dir = os.path.join(base, 'สื่อการสอน')
eval_dir = os.path.join(base, 'เครื่องมือวัดผล')
test_dir = os.path.join(base, 'แบบทดสอบและพิมพ์เขียว')
supp_dir = os.path.join(base, 'เอกสารประกอบ')

units_data = {
    1: {
        'title': 'พื้นฐานคาลิมบ้า',
        'plans': [1, 2, 3, 4],
        'eval_ids': [1, 3],
        'test_fn': 'แบบทดสอบท้ายหน่วย_หน่วยที่_1_พื้นฐานคาลิมบ้า.docx',
        'supp_fns': ['เอกสารวิชาการ_กรอบแนวคิดการจัดการเรียนรู้_T_PACE_Framework.docx']
    },
    2: {
        'title': 'ปฏิบัติรวมวงคาลิมบ้า',
        'plans': [5, 6, 7, 8, 9, 10, 11],
        'eval_ids': [2, 4, 3],
        'test_fn': 'แบบทดสอบท้ายหน่วย_หน่วยที่_2_ปฏิบัติรวมวงคาลิมบ้า.docx',
        'supp_fns': ['วก7_รายงานการวิจัยในชั้นเรียนอย่างย่อ_ศ21101.docx', 'หนังสือยินยอมการคุ้มครองข้อมูลส่วนบุคคล_PDPA_Consent_Form.docx']
    },
    3: {
        'title': 'รอบรู้วงดนตรีและวัฒนธรรม',
        'plans': [12, 13, 14, 15],
        'eval_ids': [5, 8],
        'test_fn': 'แบบทดสอบท้ายหน่วย_หน่วยที่_3_รอบรู้วงดนตรีและวัฒนธรรม.docx',
        'supp_fns': ['หนังสือยินยอมการคุ้มครองข้อมูลส่วนบุคคล_PDPA_Consent_Form.docx']
    },
    4: {
        'title': 'สุนทรียภาพแห่งการฟัง',
        'plans': [16, 17, 18],
        'eval_ids': [6, 7, 8],
        'test_fn': 'แบบทดสอบท้ายหน่วย_หน่วยที่_4_สุนทรียภาพแห่งการฟัง.docx',
        'supp_fns': ['เอกสารวิชาการ_กรอบแนวคิดการจัดการเรียนรู้_T_PACE_Framework.docx']
    }
}

def add_divider_page(doc, title="ภาคผนวก", subtitle="", items=None):
    doc.add_page_break()
    p = doc.add_paragraph()
    p.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(title)
    r.bold = True
    r.font.size = docx.shared.Pt(26)
    r.font.color.rgb = docx.shared.RGBColor(0x1A, 0x36, 0x5D)
    
    if subtitle:
        p_sub = doc.add_paragraph()
        p_sub.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
        r_sub = p_sub.add_run(subtitle)
        r_sub.font.size = docx.shared.Pt(16)
        r_sub.bold = True
        r_sub.font.color.rgb = docx.shared.RGBColor(0x2B, 0x6C, 0xB0)
        
    p_c = doc.add_paragraph()
    p_c.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
    r_c = p_c.add_run("รายวิชา ดนตรี 1 (ศ21101) ชั้นมัธยมศึกษาปีที่ 1 ภาคเรียนที่ 1 โรงเรียนพะเยาพิทยาคม")
    r_c.font.size = docx.shared.Pt(13)
    r_c.font.color.rgb = docx.shared.RGBColor(0x71, 0x80, 0x96)
    
    p_sep = doc.add_paragraph()
    p_sep.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
    r_sep = p_sep.add_run("―" * 45)
    r_sep.font.color.rgb = docx.shared.RGBColor(0xCB, 0xD5, 0xE0)
    
    if items:
        p_hdr = doc.add_paragraph()
        p_hdr.paragraph_format.left_indent = docx.shared.Inches(0.8)
        r_hdr = p_hdr.add_run("สารบัญเอกสารแนบท้ายประจำหน่วย (ภาคผนวก):")
        r_hdr.bold = True
        r_hdr.font.size = docx.shared.Pt(14)
        
        for it in items:
            p_it = doc.add_paragraph()
            p_it.paragraph_format.left_indent = docx.shared.Inches(1.1)
            r_b = p_it.add_run("• ")
            r_b.bold = True
            r_b.font.color.rgb = docx.shared.RGBColor(0x2B, 0x6C, 0xB0)
            r_t = p_it.add_run(it)
            r_t.font.size = docx.shared.Pt(12)
            
    p_sep2 = doc.add_paragraph()
    p_sep2.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
    r_sep2 = p_sep2.add_run("―" * 45)
    r_sep2.font.color.rgb = docx.shared.RGBColor(0xCB, 0xD5, 0xE0)
    doc.add_page_break()

def add_unit_teacher_guide(doc, u_num, u_title, plan_list):
    # Check if section already exists
    for p in doc.paragraphs:
        if "หมวดที่ 4: คู่มือปฏิบัติการจัดการเรียนรู้" in p.text:
            return

    p_h1 = doc.add_paragraph()
    r_h1 = p_h1.add_run(f"หมวดที่ 4: คู่มือปฏิบัติการจัดการเรียนรู้ สื่อการสอน และระบบการวัดประเมินผลระดับหน่วยการเรียนรู้ที่ {u_num}: {u_title}")
    r_h1.bold = True
    r_h1.font.size = docx.shared.Pt(14)
    r_h1.font.color.rgb = docx.shared.RGBColor(0x1A, 0x36, 0x5D)

    # 4.1 Unit Progression
    p_41 = doc.add_paragraph()
    r_41 = p_41.add_run("4.1 การบริหารเวลาและแผนผังความก้าวหน้าของหน่วยการเรียนรู้ (Unit Progression Blueprint):")
    r_41.bold = True
    r_41.font.size = docx.shared.Pt(12)

    plan_str = ", ".join(f"แผนที่ {p}" for p in plan_list)
    doc.add_paragraph(
        f"หน่วยการเรียนรู้ที่ {u_num}: {u_title} ประกอบด้วย {plan_str} ออกแบบการเรียนรู้ตามวงจร T-PACE Framework และระบบนิเวศดิจิทัล MusicSmart "
        "โดยเน้นพัฒนาการจากระดับพื้นฐานสู่การประยุกต์ใช้และการสร้างสรรค์ผลงาน ครูควรควบคุมจังหวะเวลา (Pacing) ในแต่ละคาบให้กระชับ เพื่อให้นักเรียนมีเวลาลงมือปฏิบัติไม่น้อยกว่าร้อยละ 70 ของเวลาเรียน"
    )

    # 4.2 Media Management
    p_42 = doc.add_paragraph()
    r_42 = p_42.add_run("4.2 ยุทธศาสตร์การบริหารจัดการสื่อการเรียนรู้และแผนสำรอง (Unit Media Deployment & Plan B Strategy):")
    r_42.bold = True
    r_42.font.size = docx.shared.Pt(12)

    doc.add_paragraph(
        "1. การเตรียมสื่อและใบกิจกรรม: เอกสารใบกิจกรรมประจำทุกแผนได้ถูกรวบรวมไว้ใน ภาคผนวก ก ของเอกสารฉบับนี้อย่างครบถ้วน ครูสามารถพิมพ์ฉบับกระดาษ (Hardcopy) สำรองไว้ประจำโต๊ะเรียนทุกครั้ง\n"
        "2. การบูรณาการเทคโนโลยีกับเครื่องดนตรีกายภาพ: นักเรียนใช้แอป MusicSmart เป็นเครื่องมือช่วยซ้อม แต่จุดเน้นหลักคือการสัมผัสเครื่องดนตรีจริง (Acoustic Resonance) และการทำงานร่วมกับบัดดี้\n"
        "3. แผนสำรอง Plan B: หากพบปัญหาทางเทคนิค ให้เปลี่ยนมาใช้สื่อกระดาษและเครื่องประกอบจังหวะรีไซเคิลทันทีตามแนวทางที่ระบุในแต่ละแผน"
    )

    # 4.3 Assessment & Rubrics
    p_43 = doc.add_paragraph()
    r_43 = p_43.add_run("4.3 ระบบการวัดประเมินผล เกณฑ์รูบริก และการคำนวณคะแนนตามโครงสร้าง วก.3:")
    r_43.bold = True
    r_43.font.size = docx.shared.Pt(12)

    doc.add_paragraph(
        "1. เครื่องมือวัดผลประจำหน่วย: รวบรวมไว้ใน ภาคผนวก ข ซึ่งประกอบด้วยเกณฑ์รูบริกประเมินทักษะปฏิบัติ (P) และแบบสังเกตคุณลักษณะอันพึงประสงค์ (A)\n"
        "2. การตัดเกรดและการคำนวณคะแนน: หน่วยนี้มีคะแนนเต็ม 20 คะแนน (คะแนนด้านความรู้ K 5-8 คะแนน, ทักษะกระบวนการ P 7-10 คะแนน, คุณลักษณะ A 5 คะแนน) ตามโครงสร้าง วก.3 "
        "ครูบันทึกคะแนนลงในแอป MusicSmart เพื่อประมวลผลตัดเกรดอัตโนมัติ\n"
        "3. การสอบวัดผลสัมฤทธิ์ท้ายหน่วย: ใช้แบบทดสอบปรนัย 10 ข้อ (แนบใน ภาคผนวก ค) ซึ่งสร้างขึ้นตามพิมพ์เขียวข้อสอบ (Test Blueprint) ผ่านการตรวจสอบความเที่ยงตรงเชิงเนื้อหา IOC >= 0.67 ทุกข้อ"
    )

    # 4.4 CAR & PDPA
    p_44 = doc.add_paragraph()
    r_44 = p_44.add_run("4.4 การบริหารจัดการเอกสารประกอบและการวิจัยในชั้นเรียน (CAR & PDPA Protocol):")
    r_44.bold = True
    r_44.font.size = docx.shared.Pt(12)

    doc.add_paragraph(
        "1. ความคุ้มครองข้อมูลส่วนบุคคล (PDPA): ในกิจกรรมรวมวง Mini-Recital และการบันทึกเสียง Podcast ครูต้องจัดเก็บหนังสือยินยอม (PDPA Consent Form ในภาคผนวก ง) ให้ครบถ้วน 100%\n"
        "2. การต่อยอดสู่งานวิจัยในชั้นเรียน (CAR วก.7) ระดับ คศ.4: ครูนำผลสัมฤทธิ์และผลการประเมินทักษะดนตรีจากหน่วยนี้ไปวิเคราะห์เพื่อจัดทำรายงานวิจัยในชั้นเรียนอย่างย่อ (วก.7) "
        "เพื่อใช้เป็นหลักฐานเชิงประจักษ์ในการประเมินวิทยฐานะครูเชี่ยวชาญ (คศ.4) ตามเกณฑ์ วPA ของ ก.ค.ศ."
    )

def assemble_unit_document(target_path, u_num, is_teacher_manual=False):
    u_info = units_data[u_num]
    u_title = u_info['title']
    plan_list = u_info['plans']
    
    master_doc = docx.Document(target_path)
    
    if is_teacher_manual:
        add_unit_teacher_guide(master_doc, u_num, u_title, plan_list)
        
    has_appendix = any("สารบัญเอกสารแนบท้ายประจำหน่วย (ภาคผนวก)" in p.text for p in master_doc.paragraphs)
    if has_appendix:
        print(f"Skipping {os.path.basename(target_path)}: Appendix already assembled.")
        return
        
    # Gather media for plans in this unit
    unit_media_files = []
    for p in plan_list:
        prefix = f"ผ{p:02d}"
        for f in sorted(os.listdir(media_dir)):
            if prefix in f and f.endswith('.docx') and not f.startswith('~$'):
                unit_media_files.append((os.path.join(media_dir, f), f))
                break
                
    # Gather evaluation tools for this unit
    unit_eval_files = []
    for t_id in u_info['eval_ids']:
        prefix = f"ฉบับที่_{t_id}_"
        for f in sorted(os.listdir(eval_dir)):
            if prefix in f and f.endswith('.docx') and not f.startswith('~$'):
                unit_eval_files.append((os.path.join(eval_dir, f), f))
                break
                
    # Unit test and blueprint
    unit_test_files = []
    t_path = os.path.join(test_dir, u_info['test_fn'])
    if os.path.exists(t_path):
        unit_test_files.append((t_path, u_info['test_fn']))
    bp_path = os.path.join(test_dir, 'พิมพ์เขียวข้อสอบ_Test_Blueprint_ศ21101_ดนตรี1.docx')
    if os.path.exists(bp_path):
        unit_test_files.append((bp_path, 'พิมพ์เขียวข้อสอบ_Test_Blueprint_ศ21101_ดนตรี1.docx'))
        
    # Supplementary files
    unit_supp_files = []
    for sfn in u_info['supp_fns']:
        sp = os.path.join(supp_dir, sfn)
        if os.path.exists(sp):
            unit_supp_files.append((sp, sfn))
            
    # Build Table of Contents for Appendix
    toc_items = []
    if unit_media_files:
        m_list = ", ".join(f"แผน {p}" for p in plan_list)
        toc_items.append(f"ภาคผนวก ก: ชุดสื่อการจัดการเรียนรู้และใบกิจกรรมประจำหน่วย ({m_list} รวม {len(unit_media_files)} ชุด)")
    if unit_eval_files:
        e_list = ", ".join(f"ฉบับที่ {eid}" for eid in u_info['eval_ids'])
        toc_items.append(f"ภาคผนวก ข: ชุดเครื่องมือวัดและประเมินผลประจำหน่วย ({e_list} รวม {len(unit_eval_files)} ฉบับ)")
    if unit_test_files:
        toc_items.append(f"ภาคผนวก ค: แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียนท้ายหน่วยที่ {u_num} และพิมพ์เขียวข้อสอบ (10 ข้อ)")
    if unit_supp_files:
        s_list = ", ".join(fn for _, fn in unit_supp_files)
        toc_items.append(f"ภาคผนวก ง: เอกสารประกอบการจัดการเรียนรู้ ({s_list})")
        
    # Add Master Appendix Divider
    add_divider_page(
        master_doc,
        title="ภาคผนวก",
        subtitle=f"หน่วยการเรียนรู้ที่ {u_num}: {u_title}",
        items=toc_items
    )
    
    composer = Composer(master_doc)
    
    # Append Media
    for mp, mfn in unit_media_files:
        composer.append(docx.Document(mp))
        
    # Append Eval Tools
    for ep, efn in unit_eval_files:
        composer.append(docx.Document(ep))
        
    # Append Unit Test & Blueprint
    for tp, tfn in unit_test_files:
        composer.append(docx.Document(tp))
        
    # Append Supplementary Docs
    for sp, sfn in unit_supp_files:
        composer.append(docx.Document(sp))
        
    composer.save(target_path)
    print(f"✅ Successfully assembled: {os.path.basename(target_path)}")

# --------------------------------------------------------------------------
# Execute Assembly for วก4 and คู่มือครู วก4
# --------------------------------------------------------------------------
print("====================================================================")
print("ASSEMBLING วก4 (4 Units)")
print("====================================================================")
wk4_dir = os.path.join(base, 'วก4')
for f in sorted(os.listdir(wk4_dir)):
    if f.endswith('.docx') and not f.startswith('~$'):
        m = re.search(r'หน่วยการเรียนรู้ที่_(\d+)', f)
        if m:
            u_num = int(m.group(1))
            assemble_unit_document(os.path.join(wk4_dir, f), u_num, is_teacher_manual=False)

print("\n====================================================================")
print("ASSEMBLING คู่มือการสอนสำหรับครู วก4 (4 Units)")
print("====================================================================")
tm_wk4_dir = os.path.join(base, 'คู่มือการสอนสำหรับครู', 'คู่มือครู ม.1 ดนตรี1 ศ21101', 'วก4')
for f in sorted(os.listdir(tm_wk4_dir)):
    if f.endswith('.docx') and not f.startswith('~$'):
        m = re.search(r'หน่วยการเรียนรู้ที่_(\d+)', f)
        if m:
            u_num = int(m.group(1))
            assemble_unit_document(os.path.join(tm_wk4_dir, f), u_num, is_teacher_manual=True)

print("\nAssembly of วก4 and คู่มือครู วก4 complete!")
