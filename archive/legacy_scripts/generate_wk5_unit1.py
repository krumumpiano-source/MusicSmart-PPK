import os
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

def insert_zws(text):
    return '\u200B'.join(list(text))

def set_font(run):
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(16)
    r = run._element
    r.rPr.rFonts.set(qn('w:eastAsia'), 'TH Sarabun New')
    r.rPr.rFonts.set(qn('w:cs'), 'TH Sarabun New')

def create_plan(plan_data, filename):
    doc = Document()
    
    style = doc.styles['Normal']
    font = style.font
    font.name = 'TH Sarabun New'
    font.size = Pt(16)
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'TH Sarabun New')
    
    def add_p(text, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        run = p.add_run(insert_zws(text))
        run.bold = bold
        set_font(run)
        return p

    # Header Box
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run(" วก.5 ")
    run.bold = True
    set_font(run)
    
    add_p(f"แผนการจัดการเรียนรู้ที่ {plan_data['plan_num']}", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    add_p(f"กลุ่มสาระการเรียนรู้ ศิลปะ (ดนตรี)          ระดับมัธยมศึกษาตอนต้น          โรงเรียนพะเยาพิทยาคม")
    add_p(f"รายวิชา ดนตรี 1 (คาลิมบ้า)          รหัสวิชา ศ21101          ชั้นมัธยมศึกษาปีที่ 1")
    add_p(f"ภาคเรียนที่ 1          ปีการศึกษา 2569          หน่วยการเรียนรู้ที่ {plan_data['unit_num']}")
    add_p(f"เรื่อง {plan_data['title']}          เวลา 1 ชั่วโมง")
    add_p(f"สอนวันที่....... เดือน....................... พ.ศ. ........          ผู้สอน นาย/นาง................................")
    
    doc.add_paragraph().add_run("_" * 90)

    add_p("มาตรฐานการเรียนรู้และตัวชี้วัด", bold=True)
    add_p("   " + plan_data['indicator'])
    
    add_p("สาระสำคัญ", bold=True)
    add_p("   " + plan_data['core_concept'])
    
    add_p("สาระการเรียนรู้", bold=True)
    add_p("   " + plan_data['learning_content'])
    
    add_p("จุดประสงค์การเรียนรู้", bold=True)
    add_p("   1. ด้านความรู้ (K)", bold=True)
    add_p("      1.1 " + plan_data['obj_k'])
    add_p("   2. ด้านทักษะกระบวนการ (P)", bold=True)
    add_p("      2.1 " + plan_data['obj_p'])
    add_p("   3. ด้านคุณลักษณะอันพึงประสงค์ (A)", bold=True)
    add_p("      3.1 " + plan_data['obj_a'])
    
    add_p("สมรรถนะสำคัญของผู้เรียน", bold=True)
    add_p("   1.1 ความสามารถในการสื่อสาร\n   1.2 ความสามารถในการคิด\n   1.3 ความสามารถในการใช้เทคโนโลยี")
    
    add_p("ชิ้นงาน/ภาระงาน", bold=True)
    for task in plan_data['tasks']:
        add_p(f"   - {task}")
    
    add_p("กิจกรรมการเรียนรู้ (รูปแบบ T-PACE Framework ควบคู่กับ Web Application)", bold=True)
    add_p("   ขั้นนำเข้าสู่บทเรียน (10 นาที)", bold=True)
    for step in plan_data['act_intro']:
        add_p("   " + step)
    add_p("   ขั้นสอน (30 นาที)", bold=True)
    for step in plan_data['act_teach']:
        add_p("   " + step)
    add_p("   ขั้นสรุปบทเรียน (10 นาที)", bold=True)
    for step in plan_data['act_conclude']:
        add_p("   " + step)
        
    add_p("สื่อ / แหล่งเรียนรู้", bold=True)
    for media in plan_data['media']:
        add_p(f"   - {media}")
        
    add_p("การวัดและประเมินผล", bold=True)
    add_p("   1. ด้านความรู้ (K): ประเมินจาก " + plan_data['eval_k'])
    add_p("   2. ด้านทักษะกระบวนการ (P): ประเมินจาก " + plan_data['eval_p'])
    add_p("   3. ด้านคุณลักษณะ (A): ประเมินจาก " + plan_data['eval_a'])
    
    add_p("เครื่องมือวัด", bold=True)
    add_p("   1. แบบบันทึกคะแนนปฏิบัติ (Rubrics) บน MusicSmart App\n   2. แบบสังเกตพฤติกรรม")
    
    add_p("เกณฑ์การประเมิน (Rubrics)", bold=True)
    table = doc.add_table(rows=1, cols=6)
    table.style = 'Table Grid'
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = insert_zws('ประเด็นการประเมิน')
    hdr_cells[1].text = insert_zws('น้ำหนักคะแนน')
    hdr_cells[2].text = insert_zws('4 (ดีเยี่ยม)')
    hdr_cells[3].text = insert_zws('3 (ดี)')
    hdr_cells[4].text = insert_zws('2 (พอใช้)')
    hdr_cells[5].text = insert_zws('1 (ปรับปรุง)')
    for cell in hdr_cells:
        for p in cell.paragraphs:
            for r in p.runs:
                set_font(r)
                
    row_cells = table.add_row().cells
    row_cells[0].text = insert_zws('ทักษะปฏิบัติ')
    row_cells[1].text = insert_zws('10')
    row_cells[2].text = insert_zws(plan_data['rubric_4'])
    row_cells[3].text = insert_zws('ปฏิบัติได้ดี มีข้อผิดพลาดเล็กน้อย')
    row_cells[4].text = insert_zws('ปฏิบัติได้ปานกลาง ต้องได้รับคำแนะนำ')
    row_cells[5].text = insert_zws('ปฏิบัติไม่ได้ ต้องดูแลใกล้ชิด')
    for cell in row_cells:
        for p in cell.paragraphs:
            for r in p.runs:
                set_font(r)

    add_p("เกณฑ์การตัดสิน", bold=True)
    add_p("   ระดับ 4 หมายถึง มีระดับคุณภาพดีเยี่ยม\n   ระดับ 3 หมายถึง มีระดับคุณภาพดี\n   ระดับ 2 หมายถึง มีระดับคุณภาพพอใช้\n   ระดับ 1 หมายถึง มีระดับคุณภาพปรับปรุง")
    add_p("เกณฑ์การผ่าน          ได้ระดับ 3 ขึ้นไป ร้อยละ 60 ถือว่าประสบผลสำเร็จ", bold=True)
    
    doc.add_page_break()
    
    add_p(f"บันทึกผลหลังการสอน แผนการจัดการเรียนรู้ที่ {plan_data['plan_num']}", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_p("ผลการเรียนรู้ของนักเรียน", bold=True)
    add_p("....................................................................................................................................................")
    add_p("ปัญหาที่เกิดขึ้นระหว่างการจัดการเรียนรู้", bold=True)
    add_p("....................................................................................................................................................")
    add_p("แนวทางการแก้ปัญหาหรือปรับปรุงแผนครั้งต่อไป (Action plan / CAR)", bold=True)
    add_p("....................................................................................................................................................")
    
    add_p("ลงชื่อ ....................................................... ครูผู้สอน", align=WD_ALIGN_PARAGRAPH.RIGHT)
    add_p("(.......................................................)        ", align=WD_ALIGN_PARAGRAPH.RIGHT)
    
    add_p("ความคิดเห็นของฝ่ายบริหาร", bold=True)
    add_p("....................................................................................................................................................")
    add_p("ลงชื่อ ....................................................... หัวหน้ากลุ่มสาระฯ / ผู้อำนวยการ", align=WD_ALIGN_PARAGRAPH.RIGHT)
    
    doc.save(filename)

plans = [
    {
        'plan_num': 1,
        'unit_num': 1,
        'title': 'รู้จักและดูแลคาลิมบ้า',
        'indicator': 'ศ 2.1 ม.1/9 ใช้และบำรุงรักษาเครื่องดนตรีอย่างระมัดระวังและปลอดภัย',
        'core_concept': 'การเข้าใจส่วนประกอบและการดูแลรักษาเครื่องดนตรี เป็นพื้นฐานสำคัญในการปฏิบัติเครื่องดนตรีให้เกิดความไพเราะ',
        'learning_content': 'ส่วนประกอบ วิธีการจับ และการดูแลรักษาเครื่องคาลิมบ้า (Kalimba)',
        'obj_k': 'อธิบายและวิเคราะห์วิธีดูแลรักษาเครื่องดนตรีได้อย่างถูกต้อง',
        'obj_p': 'ปฏิบัติการจับเครื่องดนตรีและใช้แอปจูนเสียงตั้งสายได้แม่นยำ',
        'obj_a': 'เห็นคุณค่าและรับผิดชอบต่อเครื่องดนตรีของตน',
        'tasks': ['การสาธิตการจับเครื่อง', 'บันทึกคลิปวิดีโอปฏิบัติเดี่ยว (Digital Portfolio)'],
        'act_intro': [
            'T - Technology Integration (บูรณาการเทคโนโลยีสื่อ)',
            '1. นักเรียนรับชมคลิปสาธิตการเล่นระดับมืออาชีพผ่าน MusicSmart App เพื่อร่วมกันวิเคราะห์การเกิดเสียง (Inquiry-based)'
        ],
        'act_teach': [
            'P - Performance Practice (ฝึกปฏิบัติเชิงรุก)',
            '2. นักเรียนศึกษาการจับเครื่องจาก Interactive 3D Model บน MusicSmart App โดยครูเป็นโค้ช (Facilitator) ปรับสรีระรายบุคคล',
            'A - Active Collaboration (ร่วมมือเรียนรู้)',
            '3. นักเรียนจับคู่ (Peer Coaching) เพื่อผลัดกันฟังและเช็คความถูกต้องของการจับเครื่องและตั้งสาย'
        ],
        'act_conclude': [
            'E - Evaluation & Evolve (ประเมินและวิจัยพัฒนา)',
            '4. นักเรียนประเมินตนเองและเพื่อน (Peer Review) ผ่าน MusicSmart App จากนั้นครูใช้ระบบ Data Analytics ในแอป เพื่อให้ Feedback รายบุคคล ข้อมูลส่งต่อทำ CAR'
        ],
        'media': ['เครื่องดนตรีคาลิมบ้า', 'แอปพลิเคชัน MusicSmart', 'สมาร์ทโฟน/แท็บเล็ต'],
        'eval_k': 'การอธิบายและตอบคำถาม',
        'eval_p': 'การจับเครื่องและการใช้แอปตั้งสาย',
        'eval_a': 'แบบสังเกตพฤติกรรม',
        'rubric_4': 'จับเครื่องมั่นคง วางนิ้วถูกต้องตามหลักสรีระ 100% และใช้แอปจูนเสียงได้แม่นยำด้วยตนเอง'
    },
    {
        'plan_num': 2,
        'unit_num': 1,
        'title': 'การอ่านโน้ตและแท็บ (Tab) คาลิมบ้า',
        'indicator': 'ศ 2.1 ม.1/1 อ่าน เขียน ร้องโน้ตไทย และโน้ตสากล',
        'core_concept': 'สัญลักษณ์ทางดนตรีและการแปลงสัญลักษณ์เป็นระบบตัวเลข (Tab) ช่วยให้การเรียนรู้เครื่องดนตรีรวดเร็วและเป็นสากล',
        'learning_content': 'โน้ตสากลเบื้องต้น (C D E F G A B) และการประยุกต์ใช้ระบบ Tab แบบตัวเลข (1-7)',
        'obj_k': 'อธิบายและแปลงสัญลักษณ์โน้ตสากลเป็นระบบตัวเลขได้อย่างถูกต้อง',
        'obj_p': 'ระบุตำแหน่งลิ่มเสียงบนคาลิมบ้าตามสัญลักษณ์โน้ตได้อย่างแม่นยำ',
        'obj_a': 'มีความมุ่งมั่นและอดทนในการฝึกอ่านสัญลักษณ์ทางดนตรี',
        'tasks': ['การทำแบบฝึกหัดอ่านแท็บดนตรีบนแอป', 'การเล่นจับคู่สัญลักษณ์บนคาลิมบ้า'],
        'act_intro': [
            'T - Technology Integration',
            '1. นักเรียนเล่นเกมจับคู่ตัวอักษรและตัวเลขโน้ตผ่าน Interactive Quiz ใน MusicSmart App เพื่อกระตุ้นความทรงจำ'
        ],
        'act_teach': [
            'P - Performance Practice',
            '2. นักเรียนใช้ฟีเจอร์ "Tab Simulator" ในแอป เพื่อฝึกกดลิ่มเสียงจำลองเทียบกับโน้ตสากล (มีระบบ Differentiated สำหรับคนอ่อนให้เล่นช้าลง)',
            'C - Creative/Cultural Connection',
            '3. นักเรียนทดลองเขียนแท็บ (Tab) เพลงที่ตัวเองชอบสั้นๆ 1 ท่อน'
        ],
        'act_conclude': [
            'E - Evaluation & Evolve',
            '4. ระบบแอปพลิเคชันคำนวณความแม่นยำในการอ่านโน้ตและแสดงผล Feedback ทันที (Real-time Analytics)'
        ],
        'media': ['แอปพลิเคชัน MusicSmart (Tab Simulator)', 'แบบฝึกทักษะการอ่านโน้ต'],
        'eval_k': 'คะแนนจาก Interactive Quiz',
        'eval_p': 'ความแม่นยำในการกดตำแหน่งเสียง',
        'eval_a': 'การส่งงานตรงเวลาและความพยายาม',
        'rubric_4': 'แปลงโน้ตสากลเป็นตัวเลข และกดตำแหน่งลิ่มบนคาลิมบ้าได้ถูกต้อง 100% โดยไม่ลังเล'
    },
    {
        'plan_num': 3,
        'unit_num': 1,
        'title': 'ปฏิบัติไล่สเกล C Major',
        'indicator': 'ศ 2.1 ม.1/3 ร้องเพลงและใช้เครื่องดนตรีบรรเลงประกอบการร้องเพลง',
        'core_concept': 'การไล่สเกลอย่างสม่ำเสมอ เป็นรากฐานสำคัญของการพัฒนากล้ามเนื้อมัดเล็กและสัมผัสทางเสียง',
        'learning_content': 'การไล่สเกล C Major ขาขึ้นและขาลง ด้วยนิ้วโป้งซ้ายและขวาแบบสลับ',
        'obj_k': 'วิเคราะห์รูปแบบการสลับนิ้วซ้ายขวาในสเกล C Major ได้',
        'obj_p': 'ปฏิบัติการไล่สเกล C Major ด้วยจังหวะที่สม่ำเสมอตาม Metronome',
        'obj_a': 'มีระเบียบวินัยในการฝึกซ้อมอย่างต่อเนื่อง',
        'tasks': ['บันทึกคลิปวิดีโอการไล่สเกล (Digital Portfolio)'],
        'act_intro': [
            'T - Technology Integration',
            '1. เปิด Metronome ใน MusicSmart App ให้นักเรียนปรบมือตามจังหวะช้า-เร็ว เพื่อปรับระบบประสาทรับรู้จังหวะ'
        ],
        'act_teach': [
            'P - Performance Practice',
            '2. นักเรียนปฏิบัติตามฟีเจอร์ "Scale Guide" บนแอป ซึ่งจะแสดงไฟกะพริบตามจังหวะที่ต้องดีดซ้าย-ขวา',
            'A - Active Collaboration',
            '3. นักเรียนจับคู่ (Peer Coaching) ผลัดกันฟังจังหวะของเพื่อน ว่าดีดได้สม่ำเสมอหรือไม่ พร้อมให้คำแนะนำ'
        ],
        'act_conclude': [
            'E - Evaluation & Evolve',
            '4. นักเรียนอัดคลิปการไล่สเกลสั้นๆ ส่งเข้าระบบ และรับ Constructive Feedback จากครูผ่านระบบแอป'
        ],
        'media': ['เครื่องดนตรีคาลิมบ้า', 'MusicSmart App (Metronome & Scale Guide)'],
        'eval_k': 'การวิเคราะห์จังหวะ',
        'eval_p': 'ทักษะการไล่สเกลและความแม่นยำของจังหวะ',
        'eval_a': 'วินัยในการฝึกซ้อมคู่',
        'rubric_4': 'ดีดสลับซ้ายขวาได้คล่องแคล่ว น้ำหนักเสียงสม่ำเสมอ ตรงตามจังหวะ Metronome 100%'
    },
    {
        'plan_num': 4,
        'unit_num': 1,
        'title': 'ปฏิบัติเพลงเดี่ยว (เพลงสั้นระดับง่าย)',
        'indicator': 'ศ 2.1 ม.1/3 ร้องเพลงและใช้เครื่องดนตรีบรรเลงประกอบการร้องเพลง',
        'core_concept': 'การนำสเกลมาเรียงร้อยเป็นทำนอง คือหัวใจของการบรรเลงดนตรีที่สร้างสุนทรียภาพ',
        'learning_content': 'การบรรเลงเพลงสั้นระดับพื้นฐาน (เช่น Twinkle Twinkle Little Star)',
        'obj_k': 'วิเคราะห์โครงสร้างทำนองและจังหวะของเพลงสั้นได้',
        'obj_p': 'แสดงทักษะการปฏิบัติคาลิมบ้าบรรเลงเพลงสั้นได้อย่างแม่นยำตามหลักสรีรวิทยา',
        'obj_a': 'เกิดความภาคภูมิใจในผลงานการบรรเลงของตนเอง',
        'tasks': ['บันทึกคลิปวิดีโอปฏิบัติเดี่ยว (Digital Portfolio) พร้อมเขียนวิเคราะห์ข้อบกพร่อง'],
        'act_intro': [
            'T - Technology Integration',
            '1. ครูเปิดตัวอย่างคลิปเด็กต่างชาติเล่นเพลงสั้นบนคาลิมบ้า เพื่อสร้างแรงบันดาลใจ'
        ],
        'act_teach': [
            'P - Performance Practice',
            '2. นักเรียนใช้ระบบ Differentiated ในแอป เลือกความเร็วของ Backing Track ตามระดับความสามารถของตนเอง (ช้า/ปานกลาง/เร็ว)',
            'C - Creative Connection',
            '3. นักเรียนทดลองเปลี่ยนจังหวะการดีดโน้ตตัวสุดท้ายของท่อน เพื่อสร้างเอกลักษณ์ของตัวเอง'
        ],
        'act_conclude': [
            'E - Evaluation & Evolve',
            '4. นักเรียนประเมินตนเองและเพื่อน (Peer Review) ผ่านแอป และบันทึกคลิปส่งเป็น Digital Portfolio'
        ],
        'media': ['แอป MusicSmart (Backing Track)', 'คาลิมบ้า'],
        'eval_k': 'การวิเคราะห์โครงสร้างเพลง',
        'eval_p': 'การบรรเลงเพลงสั้นอย่างแม่นยำและลื่นไหล',
        'eval_a': 'ความรับผิดชอบและความภาคภูมิใจ',
        'rubric_4': 'บรรเลงได้ถูกต้องครบถ้วน จังหวะแม่นยำ โน้ตชัดเจน ไม่สะดุด และมีสุนทรียภาพทางเสียง'
    }
]

for plan in plans:
    filename = f"แผนการสอน_วก5_แผนที่_{plan['plan_num']:02d}.docx"
    create_plan(plan, filename)

print("Generated Unit 1 Plans 1-4 successfully.")
