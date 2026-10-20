# -*- coding: utf-8 -*-
import os, sys, glob, re, docx
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

sys.stdout.reconfigure(encoding='utf-8')

base = 'เอกสารแผนการสอน/ม.1 ดนตรี1 ศ21101'
kru_base = os.path.join(base, 'คู่มือการสอนสำหรับครู', 'คู่มือครู ม.1 ดนตรี1 ศ21101')
wk4_base = os.path.join(base, 'วก4')
wk5_base = os.path.join(base, 'วก5')

units_info = {
    1: {'title': 'พื้นฐานคาลิมบ้า', 'plans': range(1, 5)},
    2: {'title': 'ปฏิบัติรวมวงคาลิมบ้า', 'plans': range(5, 12)},
    3: {'title': 'รอบรู้วงดนตรีและวัฒนธรรม', 'plans': range(12, 16)},
    4: {'title': 'สุนทรียภาพแห่งการฟัง', 'plans': range(16, 19)}
}

def get_unit_info(plan_num):
    for u_num, data in units_info.items():
        if plan_num in data['plans']:
            return u_num, data['title']
    return 1, 'พื้นฐานคาลิมบ้า'

plan_topics = {
    1: 'กายวิภาคและการก้องกังวาน (Acoustics & Posture)',
    2: 'รหัสนามธรรมสู่ระบบเสียงและการขับร้อง (Tab, 5-Line Staff & Solfege Singing)',
    3: 'จังหวะ ทิศทางเสียง และการขับร้องบันไดเสียง (C Major Scale, Singing & Metronome)',
    4: 'การบรรเลงเดี่ยวเชิงประยุกต์และการขับร้องประกอบ (Solo Performance, Singing & Care)',
    5: 'พลวัตของการรวมวง (Ensemble Dynamics)',
    6: 'นวัตกรรมเครื่องประกอบจังหวะ (Rhythm Invention & Upcycling)',
    7: 'การกำกับตนเองในการซ้อมกลุ่มย่อย (Sectional Rehearsal 1)',
    8: 'การกำกับตนเองในการซ้อมกลุ่มย่อย (Sectional Rehearsal 2 & Tempo Mastery)',
    9: 'สมดุลแห่งเสียง (Balance & Run-through)',
    10: 'Mini-Recital: ประเมินเพื่อพัฒนา ตอนที่ 1 (กลุ่ม 1-4)',
    11: 'Mini-Recital: ประเมินเพื่อพัฒนา ตอนที่ 2 (กลุ่ม 5-8 และสรุปบทเรียน)',
    12: 'การจัดกลุ่มเสียงวงดนตรีไทย (Thai Ensemble Classification)',
    13: 'สุนทรียะและวิวัฒนาการดนตรีสากล (Western Ensemble & Evolution)',
    14: 'การสื่อสารข้ามวัฒนธรรม (Cross-Cultural Scriptwriting)',
    15: 'นวัตกรรมสื่อเสียง (Podcast Production & Digital Audio Guide)',
    16: 'ถอดรหัสอารมณ์เพลง (Music & Emotion Analytics)',
    17: "สุนทรียศาสตร์และการวิจารณ์ (Feldman's Art Criticism Method)",
    18: 'การรังสรรค์เพลย์ลิสต์ส่วนบุคคล (Digital Playlist Curation & Reflection)'
}

def set_font(run, size=16, bold=False, color_rgb=None):
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(size)
    run.bold = bold
    if color_rgb:
        run.font.color.rgb = color_rgb
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), 'TH Sarabun New')
    rFonts.set(qn('w:hAnsi'), 'TH Sarabun New')
    rFonts.set(qn('w:cs'), 'TH Sarabun New')
    rFonts.set(qn('w:eastAsia'), 'TH Sarabun New')
    rPr.append(rFonts)

print("================================================================================")
print("1. อัปเดต คู่มือครู วก.4 (4 หน่วยการเรียนรู้)")
print("================================================================================")
for u in range(1, 5):
    files = glob.glob(f'{kru_base}/วก4/คู่มือครู_วก4_หน่วยการเรียนรู้ที่_{u}_*.docx')
    if not files: continue
    fp = files[0]
    doc = docx.Document(fp)
    
    # Update score tables
    score_updated = False
    for t in doc.tables:
        has_score = any('การสอบวัดผลกลางภาค' in c.text or 'การสอบวัดผลกลางภาคและปลายภาค' in c.text for r in t.rows for c in r.cells)
        if has_score:
            for r in t.rows:
                if 'การสอบวัดผลกลางภาคและปลายภาค' in r.cells[0].text or 'การสอบวัดผลกลางภาค' in r.cells[0].text:
                    r.cells[0].text = 'การสอบวัดผลกลางภาค (10 คะแนน)'
                    r.cells[1].text = 'แบบทดสอบปรนัย (K) + แบบประเมินทักษะปฏิบัติเดี่ยวคาลิมบ้า (P)'
                    r.cells[2].text = 'ข้อสอบปรนัย 10 ข้อ (ข้อละ 0.2 คะแนน) = 2 คะแนน (K) + สอบปฏิบัติเดี่ยวและอ่านโน้ต = 8 คะแนน (P)'
                    r.cells[3].text = '10 คะแนน\n(K: 2, P: 8)'
                    break
            has_final = any('การสอบวัดผลปลายภาค' in r.cells[0].text for r in t.rows)
            if not has_final:
                r_final = t.add_row()
                r_final.cells[0].text = 'การสอบวัดผลปลายภาค (10 คะแนน)'
                r_final.cells[1].text = 'แบบทดสอบปรนัย (K) + แบบประเมินการแสดงรวมวง/สุนทรียภาพ (P)'
                r_final.cells[2].text = 'ข้อสอบปรนัย 10 ข้อ (ข้อละ 0.2 คะแนน) = 2 คะแนน (K) + สอบปฏิบัติรวมวง/พอร์ตโฟลิโอ = 8 คะแนน (P)'
                r_final.cells[3].text = '10 คะแนน\n(K: 2, P: 8)'
            has_sum = any('สรุปผลรวมทั้งภาคเรียน' in r.cells[0].text for r in t.rows)
            if not has_sum:
                r_sum = t.add_row()
                r_sum.cells[0].text = 'สรุปผลรวมทั้งภาคเรียน'
                r_sum.cells[1].text = 'การวัดผลประเมินผลตามสภาพจริง (Authentic Assessment)'
                r_sum.cells[2].text = 'ระหว่างภาค (K: 26, P: 34, A: 20) + กลางภาค (K: 2, P: 8) + ปลายภาค (K: 2, P: 8)'
                r_sum.cells[3].text = '100 คะแนนเต็ม\n(K: 30, P: 50, A: 20)'
            for r in t.rows:
                for c in r.cells:
                    for p in c.paragraphs:
                        for run in p.runs:
                            set_font(run, 13)
            score_updated = True
            
    # Update Unit 1 Thai notes
    if u == 1:
        for p in doc.paragraphs:
            if 'การอ่าน เขียน และขับร้องโน้ตสากลบนบรรทัด 5 เส้น' in p.text:
                p.text = '- การอ่าน เขียน และขับร้องโน้ตไทย (ระบบ ด-ร-ม-ฟ-ซ-ล-ท) ควบคู่กับโน้ตสากลบนบรรทัด 5 เส้น (Treble Clef C4-D6) และการเชื่อมโยงสู่ระบบ Kalimba Tablature 17 คีย์'
                for r in p.runs: set_font(r, 16)
                
    doc.save(fp)
    print(f"✅ อัปเดต คู่มือครู วก4 หน่วยที่ {u} เรียบร้อย (สัดส่วนคะแนน K:30, P:50, A:20 และโน้ตไทย)")

print("\n================================================================================")
print("2. อัปเดต คู่มือครู วก.5 (18 แผนการจัดการเรียนรู้)")
print("================================================================================")
# We will read the latest updated วก5 plan and create/update the teacher manual version
# ensuring it has all the expert improvements (Plan 10 rubric, Plan 2 Thai notes, step headings, CAR reflection logs)
# plus Section 7 (Teacher's Operational Manual)

for p_num in range(1, 19):
    wk5_fp = f'{wk5_base}/วก5_แผนการจัดการเรียนรู้_แผนที่_{p_num:02d}.docx'
    kru_fp = f'{kru_base}/วก5/คู่มือครู_วก5_แผนการจัดการเรียนรู้_แผนที่_{p_num:02d}.docx'
    
    if not os.path.exists(wk5_fp):
        print(f"❌ ไม่พบไฟล์ {wk5_fp}")
        continue
        
    u_num, u_title = get_unit_info(p_num)
    p_topic = plan_topics[p_num]
    
    # Load the updated master วก5 doc
    doc = docx.Document(wk5_fp)
    
    # Update header: P0, P1, P2
    # P0: คู่มือครูประจำแผนการจัดการเรียนรู้ (สอดคล้องตามแบบ วก.5)
    doc.paragraphs[0].text = "คู่มือครูประจำแผนการจัดการเรียนรู้ (สอดคล้องตามแบบ วก.5)"
    for r in doc.paragraphs[0].runs: set_font(r, 16, bold=True)
    
    # P1: คู่มือการสอนสำหรับครู: แผนการจัดการเรียนรู้ที่ X เรื่อง [ชื่อเรื่อง]
    doc.paragraphs[1].text = f"คู่มือการสอนสำหรับครู: แผนการจัดการเรียนรู้ที่ {p_num} เรื่อง {p_topic}"
    for r in doc.paragraphs[1].runs: set_font(r, 18, bold=True, color_rgb=RGBColor(0x1A, 0x36, 0x5D))
    
    # Ensure P4 has explicit unit title
    if len(doc.paragraphs) > 4:
        p4_text = doc.paragraphs[4].text
        if f'เรื่อง {u_title}' not in p4_text:
            doc.paragraphs[4].text = f"ภาคเรียนที่ 1          ปีการศึกษา 2569          หน่วยการเรียนรู้ที่ {u_num} เรื่อง {u_title}"
            for r in doc.paragraphs[4].runs: set_font(r, 16)
            
    # Check if Section 7 (หมวดที่ 7) is already in doc, if not, find the Annex divider and insert before it
    has_sec7 = any("หมวดที่ 7: คู่มือปฏิบัติการจัดการเรียนรู้" in p.text for p in doc.paragraphs)
    if not has_sec7:
        # Find index of paragraph "ภาคผนวก"
        annex_idx = None
        for i, p in enumerate(doc.paragraphs):
            if p.text.strip() == "ภาคผนวก" or "สารบัญเอกสารแนบท้าย" in p.text:
                annex_idx = i
                break
                
        # If annex found, we can insert Section 7 paragraphs before annex
        # In python-docx, inserting before a paragraph is done using p.insert_paragraph_before()
        if annex_idx is not None:
            target_p = doc.paragraphs[annex_idx]
            
            p_h1 = target_p.insert_paragraph_before()
            r_h1 = p_h1.add_run("หมวดที่ 7: คู่มือปฏิบัติการจัดการเรียนรู้ สื่อการสอน และเครื่องมือวัดผลสำหรับครู (Teacher's Operational Manual)")
            set_font(r_h1, 16, bold=True, color_rgb=RGBColor(0x1A, 0x36, 0x5D))
            
            # 7.1
            p_71 = target_p.insert_paragraph_before()
            r_71 = p_71.add_run("7.1 แนวทางปฏิบัติการใช้สื่อการเรียนรู้และใบกิจกรรมในชั้นเรียน:")
            set_font(r_71, 14, bold=True)
            
            p_71_1 = target_p.insert_paragraph_before()
            r_71_1 = p_71_1.add_run(
                f"1. วัตถุประสงค์ของสื่อหลักประจำแผน: สื่อการเรียนรู้และใบกิจกรรมประจำแผนที่ {p_num} ออกแบบมาเพื่อให้นักเรียนได้ลงมือปฏิบัติจริง (Hands-on Experience) "
                f"สอดคล้องกับหัวข้อเรื่อง {p_topic} โดยเน้นการสร้างองค์ความรู้ด้วยตนเองผ่านกระบวนการกลุ่มบัดดี้ (Buddy Coaching: 1 คนปฏิบัติ 1 คนสังเกตและให้ข้อเสนอแนะ)"
            )
            set_font(r_71_1, 16)
            
            p_71_2 = target_p.insert_paragraph_before()
            r_71_2 = p_71_2.add_run(
                "2. ขั้นตอนการจัดกิจกรรมและบทบาทครู: ครูชี้แจงกติกาและเป้าหมายย่อย (Micro-goal) ให้ชัดเจนก่อนแจกอุปกรณ์ เมื่อนักเรียนเริ่มทำกิจกรรม ครูเดินสังเกตเชิงรุก (Active Facilitation) "
                "กระตุ้นคำถามปลายเปิด (Scaffolding Questioning) แทนการบอกคำตอบโดยตรง เพื่อให้นักเรียนค้นพบระดับเสียงและทักษะด้วยตนเอง"
            )
            set_font(r_71_2, 16)
            
            p_71_3 = target_p.insert_paragraph_before()
            r_71_3 = p_71_3.add_run(
                "3. แผนสำรองกรณีฉุกเฉิน (Plan B Offline Protocol): หากระบบดิจิทัลหรือเครือข่ายขัดข้อง ให้ครูแจกใบกิจกรรมฉบับกระดาษ (Hardcopy) ที่แนบในภาคผนวก ก "
                "และใช้เครื่องมือเคาะจังหวะกายภาพ (ส้อมเสียง C-523.3Hz / Metronome เครื่องกล) ดำเนินการเรียนรู้ตามขั้นตอนเดิมได้ทันที 100% โดยไม่ทำให้กระบวนการเรียนรู้หยุดชะงัก"
            )
            set_font(r_71_3, 16)
            
            # 7.2
            p_72 = target_p.insert_paragraph_before()
            r_72 = p_72.add_run("7.2 แนวทางปฏิบัติการใช้เครื่องมือวัดและประเมินผล (Rubrics & Observation Protocol):")
            set_font(r_72, 14, bold=True)
            
            p_72_1 = target_p.insert_paragraph_before()
            r_72_1 = p_72_1.add_run(
                "1. การประเมินตามสภาพจริง (Authentic Assessment): ใช้เกณฑ์รูบริก (Rubrics) ที่แนบในภาคผนวก ข ในการประเมินทักษะกระบวนการ (P) และสังเกตคุณลักษณะอันพึงประสงค์ (A) "
                "โดยครูสังเกตพฤติกรรมเชิงประจักษ์อย่างต่อเนื่องตลอด 50 นาที ไม่ตัดสินเพียงผลงานสุดท้าย"
            )
            set_font(r_72_1, 16)
            
            p_72_2 = target_p.insert_paragraph_before()
            r_72_2 = p_72_2.add_run(
                "2. เกณฑ์การตัดสิน 4 ระดับคุณภาพ: ระดับ 4 (ดีเยี่ยม: ปฏิบัติได้ถูกต้องคล่องแคล่ว มีความคิดสร้างสรรค์ ช่วยเหลือเพื่อน), ระดับ 3 (ดี: ปฏิบัติได้ถูกต้องตามเกณฑ์มาตรฐาน), "
                "ระดับ 2 (พอใช้: ปฏิบัติตามคำแนะนำได้บางส่วน), และระดับ 1 (ปรับปรุง: ต้องได้รับการโค้ชชิ่งซ้ำ)"
            )
            set_font(r_72_2, 16)
            
            p_72_3 = target_p.insert_paragraph_before()
            r_72_3 = p_72_3.add_run(
                "3. การให้ข้อมูลย้อนกลับเพื่อพัฒนา (Formative Actionable Feedback): หลังเสร็จสิ้นกิจกรรม ครูให้ข้อมูลป้อนกลับทันทีแก่นักเรียนรายบุคคลหรือกลุ่มบัดดี้ "
                "ระบุจุดเด่น 1 ข้อ และจุดที่ต้องพัฒนาเพิ่มเติม 1 ข้อ พร้อมบันทึกคะแนนสะสมลงในระบบดิจิทัล MusicSmart เพื่อนำไปประมวลผลตามโครงสร้าง วก.3 (K:30, P:50, A:20)"
            )
            set_font(r_72_3, 16)
            
            # 7.3
            p_73 = target_p.insert_paragraph_before()
            r_73 = p_73.add_run("7.3 คำแนะนำการบริหารจัดการแบบทดสอบ เอกสารประกอบ และการวิจัยในชั้นเรียน (CAR):")
            set_font(r_73, 14, bold=True)
            
            p_73_1 = target_p.insert_paragraph_before()
            r_73_1 = p_73_1.add_run(
                "1. การบริหารแบบทดสอบและเฉลย: ในแผนที่มีการวัดผลสัมฤทธิ์ท้ายหน่วย ครูจัดห้องเรียนให้โปร่ง สุ่มสลับตัวเลือกและข้อสอบ (Randomization) เพื่อวัดความรู้ความเข้าใจที่แท้จริง "
                "และนำผลการสอบมาวิเคราะห์ความยากง่ายและอำนาจจำแนกเพื่อจัดกลุ่มสอนซ่อมเสริมแก่นักเรียนกลุ่มเสี่ยง"
            )
            set_font(r_73_1, 16)
            
            p_73_2 = target_p.insert_paragraph_before()
            r_73_2 = p_73_2.add_run(
                "2. การปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA): ในคาบที่มีการบันทึกภาพนิ่ง คลิปวิดีโอการแสดง หรือไฟล์เสียงพอดคาสต์เพื่อการเรียนการสอนและการประเมิน วPA "
                "ครูต้องจัดเก็บหนังสือยินยอม (PDPA Consent Form) จากผู้ปกครองและนักเรียนไว้เป็นหลักฐานทุกครั้ง"
            )
            set_font(r_73_2, 16)
            
            p_73_3 = target_p.insert_paragraph_before()
            r_73_3 = p_73_3.add_run(
                "3. การต่อยอดสู่การวิจัยในชั้นเรียน (CAR) ระดับ คศ.4: ครูนำบันทึกหลังสอนในหมวดที่ 6 และสถิติจาก Rubrics/แอป MusicSmart มาวิเคราะห์ปัญหาและสร้างนวัตกรรมแก้ปัญหาเชิงประจักษ์อย่างต่อเนื่อง "
                "สอดคล้องกับรายงานการวิจัยในชั้นเรียน วก.7 เพื่อเตรียมความพร้อมสำหรับประเมินเลื่อนวิทยฐานะเชี่ยวชาญ"
            )
            set_font(r_73_3, 16)
            
            target_p.insert_paragraph_before() # blank separator
            
    doc.save(kru_fp)
    print(f"✅ อัปเดต คู่มือครู วก5 แผนที่ {p_num:02d} ({p_topic[:35]}...) สำเร็จสมบูรณ์ 100%")

print("\n================================================================================")
print("การอัปเดตคู่มือครูทั้งหมดทั้ง วก.4 และ วก.5 เสร็จสิ้นสมบูรณ์ 100%!")
print("================================================================================")
