import docx
from docx.shared import Pt, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pythainlp.tokenize import word_tokenize
import os
from docx.oxml.ns import qn

def insert_zwsp(text):
    if not text: return text
    words = word_tokenize(text, engine='newmm')
    return '\u200b'.join(words)

doc = docx.Document()

# Set margins to narrow
sections = doc.sections
for section in sections:
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.5)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)

# Default font
style = doc.styles['Normal']
font = style.font
font.name = 'TH Sarabun New'
font.size = Pt(16)

def add_p(text, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, size=16):
    p = doc.add_paragraph()
    p.alignment = align
    run = p.add_run(insert_zwsp(text))
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(size)
    run.bold = bold
    return p

# --- PAGE 1 ---
add_p("งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม", align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("คำอธิบายรายวิชา", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("รหัสวิชา ศ21101 ชื่อวิชา ดนตรี 1 กลุ่มสาระการเรียนรู้ ศิลปะ")
add_p("ชั้นมัธยมศึกษาปีที่ 1 ภาคเรียนที่ 1 เวลา 20 ชั่วโมง จำนวน 0.5 หน่วยกิต")
add_p("-" * 80)
add_p("คำอธิบายรายวิชา", bold=True)
add_p("    ศึกษาเกี่ยวกับการอ่าน เขียน และร้องโน้ตสากลเบื้องต้น การเปรียบเทียบเสียงร้องและเสียงของเครื่องดนตรีต่างวัฒนธรรม การวิเคราะห์จัดประเภทของวงดนตรีไทยและสากล อธิบายบทบาทความสัมพันธ์และอิทธิพลของดนตรีที่มีต่อสังคมไทย รวมถึงระบุความหลากหลายขององค์ประกอบดนตรีในวัฒนธรรมต่างกัน")
add_p("    โดยใช้กระบวนการจัดการเรียนรู้เชิงรุก (Active Learning) ด้วยรูปแบบ T-PACE Framework ควบคู่กับการใช้เทคโนโลยีแอปพลิเคชัน การฝึกปฏิบัติร้องเพลงและบรรเลงเครื่องดนตรีคาลิมบ้า การวิเคราะห์ การวิพากษ์วิจารณ์ และการทำงานกลุ่ม")
add_p("    เพื่อให้ผู้เรียนเกิดสุนทรียภาพ เห็นคุณค่าของดนตรี สามารถแสดงความคิดเห็นต่ออารมณ์เพลง เปรียบเทียบความรู้สึกในการฟัง นำเสนอและวิจารณ์เพลงที่ชื่นชอบ ใช้เกณฑ์ประเมินคุณภาพงานดนตรีได้อย่างสร้างสรรค์ ตลอดจนนำไปประยุกต์ใช้ในชีวิตประจำวัน ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ")
add_p("")
add_p("รหัสตัวชี้วัด", bold=True)
add_p("    ศ 2.1 ม.1/1, ม.1/2, ม.1/3, ม.1/4, ม.1/5, ม.1/6, ม.1/7, ม.1/8, ม.1/9")
add_p("    ศ 2.2 ม.1/1, ม.1/2")
add_p("รวมทั้งหมด 11 ตัวชี้วัด", bold=True)

# --- PAGE 2 ---
doc.add_page_break()
add_p("ตารางการวิเคราะห์หลักสูตร", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("รายวิชา ดนตรี 1 รหัสวิชา ศ21101", align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("ระดับชั้นมัธยมศึกษาปีที่ 1 กลุ่มสาระการเรียนรู้ ศิลปะ", align=WD_ALIGN_PARAGRAPH.CENTER)

table1 = doc.add_table(rows=1, cols=2)
table1.style = 'Table Grid'
hdr_cells = table1.rows[0].cells
hdr_cells[0].text = insert_zwsp("มาตรฐานการเรียนรู้/ตัวชี้วัด")
hdr_cells[1].text = insert_zwsp("สาระการเรียนรู้")
for cell in hdr_cells: cell.paragraphs[0].runs[0].font.bold = True

data1 = [
    ("ศ 2.1 ม.1/1 อ่าน เขียน ร้องโน้ตไทย และสากล", "เครื่องหมายและสัญลักษณ์ทางดนตรี (โน้ตสากล)"),
    ("ศ 2.1 ม.1/2 เปรียบเทียบเสียงร้องและเครื่องดนตรีที่มาจากวัฒนธรรมต่างกัน", "เสียงร้องและเสียงของเครื่องดนตรีในวัฒนธรรมต่าง ๆ"),
    ("ศ 2.1 ม.1/3 ร้องเพลงและใช้เครื่องดนตรีบรรเลงประกอบ", "การร้องเพลงและการเล่นเครื่องดนตรีคาลิมบ้า"),
    ("ศ 2.1 ม.1/4 จัดประเภทวงดนตรีไทยและสากล", "วงดนตรีพื้นเมือง วงดนตรีไทย วงดนตรีสากล"),
    ("ศ 2.1 ม.1/5-1/8 วิจารณ์ ประเมิน อารมณ์เพลง", "การประเมินอารมณ์เพลงและการวิจารณ์ดนตรี"),
    ("ศ 2.1 ม.1/9 ใช้และบำรุงรักษาเครื่องดนตรี", "การบำรุงรักษาเครื่องดนตรี"),
    ("ศ 2.2 ม.1/1-1/2 อิทธิพลและองค์ประกอบดนตรีในสังคม", "บทบาทและองค์ประกอบของดนตรีในสังคม")
]
for r in data1:
    row = table1.add_row().cells
    row[0].text = insert_zwsp(r[0])
    row[1].text = insert_zwsp(r[1])

# --- PAGE 3 ---
doc.add_page_break()
add_p("ตารางวิเคราะห์หน่วยการเรียนรู้กับมาตรฐานการเรียนรู้และตัวชี้วัดชั้นปี", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
table2 = doc.add_table(rows=2, cols=3)
table2.style = 'Table Grid'
table2.cell(0,0).merge(table2.cell(1,0))
table2.cell(0,0).text = "หน่วยการเรียนรู้"
table2.cell(0,1).text = "มาตรฐาน ศ 2.1"
table2.cell(0,2).text = "มาตรฐาน ศ 2.2"
table2.cell(1,1).text = "ตัวชี้วัด 1, 2, 3, 4, 5, 6, 7, 8, 9"
table2.cell(1,2).text = "ตัวชี้วัด 1, 2"

data2 = [
    ("หน่วยที่ 1 พื้นฐานคาลิมบ้า", "✔ (1, 9)", ""),
    ("หน่วยที่ 2 ปฏิบัติรวมวงคาลิมบา", "✔ (3)", ""),
    ("หน่วยที่ 3 รอบรู้วงดนตรีและวัฒนธรรม", "✔ (2, 4)", "✔ (1, 2)"),
    ("หน่วยที่ 4 สุนทรียภาพแห่งการฟัง", "✔ (5, 6, 7, 8)", "")
]
for r in data2:
    row = table2.add_row().cells
    row[0].text = insert_zwsp(r[0])
    row[1].text = r[1]
    row[2].text = r[2]

# --- PAGE 4 ---
doc.add_page_break()
add_p("ผังมโนทัศน์หน่วยการเรียนรู้", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("รหัสวิชา ศ21101 ชื่อรายวิชา ดนตรี 1 ชั้นมัธยมศึกษาปีที่ 1", align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("\n\n[ หน่วยที่ 1: พื้นฐานคาลิมบ้า ]             [ หน่วยที่ 2: ปฏิบัติรวมวงคาลิมบา ]\n\n\n", align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("<< รายวิชา ดนตรี 1 >>", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=20)
add_p("\n\n\n[ หน่วยที่ 3: รอบรู้วงดนตรีและวัฒนธรรม ]        [ หน่วยที่ 4: สุนทรียภาพแห่งการฟัง ]", align=WD_ALIGN_PARAGRAPH.CENTER)

# --- PAGE 5 ---
doc.add_page_break()
add_p("โครงสร้างรายวิชา ดนตรี 1", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
table3 = doc.add_table(rows=1, cols=6)
table3.style = 'Table Grid'
hdr = ["ลำดับ", "ชื่อหน่วย", "มาตรฐาน/ตัวชี้วัด", "สาระสำคัญ", "เวลา", "คะแนน"]
for i, h in enumerate(hdr): table3.rows[0].cells[i].text = insert_zwsp(h)
data3 = [
    ("1", "พื้นฐานคาลิมบ้า", "ศ 2.1 ม.1/1, 9", "การอ่านโน้ตสากลเบื้องต้น และการดูแลรักษาคาลิมบ้า", "4", "20"),
    ("2", "ปฏิบัติรวมวงคาลิมบา", "ศ 2.1 ม.1/3", "การเล่นรวมวงในบทเพลงที่หลากหลาย", "7", "20"),
    ("3", "รอบรู้วงดนตรีและวัฒนธรรม", "ศ 2.1 ม.1/2, 4\nศ 2.2 ม.1/1, 2", "จัดประเภทวงดนตรีและอิทธิพลดนตรีต่อสังคม", "4", "20"),
    ("4", "สุนทรียภาพแห่งการฟัง", "ศ 2.1 ม.1/5-8", "การวิจารณ์เพลง และประเมินคุณภาพงานดนตรี", "3", "20"),
    ("", "สอบกลางภาค", "ทดสอบหน่วย 1-2", "-", "1", "10"),
    ("", "สอบปลายภาค", "ทดสอบหน่วย 3-4", "-", "1", "10"),
    ("", "รวม", "", "", "20", "100")
]
for r in data3:
    row = table3.add_row().cells
    for i in range(6): row[i].text = insert_zwsp(r[i])

# --- PAGE 6 ---
doc.add_page_break()
add_p("โครงสร้างการวัดผลประเมินผล", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("อัตราส่วนคะแนน ระหว่างภาค 80 : ปลายภาค 20", align=WD_ALIGN_PARAGRAPH.CENTER)
add_p("อัตราส่วนคะแนน K: 30  P: 50  A: 20", align=WD_ALIGN_PARAGRAPH.CENTER)
table4 = doc.add_table(rows=2, cols=8)
table4.style = 'Table Grid'
t4h1 = ["หน่วยการเรียนรู้", "คะแนนก่อนและหลังกลางภาค", "", "", "", "กลางภาค", "ปลายภาค", "รวม"]
for i, h in enumerate(t4h1): table4.cell(0, i).text = insert_zwsp(h)
t4h2 = ["", "K", "P", "A", "รวม", "(K/P)", "(K/P)", ""]
for i, h in enumerate(t4h2): table4.cell(1, i).text = insert_zwsp(h)
table4.cell(0,1).merge(table4.cell(0,4))
table4.cell(0,0).merge(table4.cell(1,0))

data4 = [
    ("หน่วยที่ 1", "5", "10", "5", "20", "10", "-", "30"),
    ("หน่วยที่ 2", "5", "10", "5", "20", "10", "-", "30"),
    ("หน่วยที่ 3", "10", "5", "5", "20", "-", "10", "30"),
    ("หน่วยที่ 4", "10", "5", "5", "20", "-", "10", "30"),
    ("รวม", "30", "30", "20", "80", "20", "20", "100")
]
for r in data4:
    row = table4.add_row().cells
    for i in range(8): row[i].text = insert_zwsp(r[i])

output_path = os.path.join(os.getcwd(), 'โครงสร้างรายวิชา_วก3_ดนตรีม1_สมบูรณ์.docx')
doc.save(output_path)
