import docx
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pythainlp.tokenize import word_tokenize
from docx.oxml.ns import qn
import os

def insert_zwsp(text):
    if not text: return text
    words = word_tokenize(text, engine='newmm')
    return '\u200b'.join(words)

doc = docx.Document()

# Set margins
sections = doc.sections
for section in sections:
    section.top_margin = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(2.54)
    section.right_margin = Cm(2.54)

# Set default font
style = doc.styles['Normal']
font = style.font
font.name = 'TH Sarabun New'
font.size = Pt(16)
r = font._element.rPr.rFonts
r.set(qn('w:eastAsia'), 'TH Sarabun New')
r.set(qn('w:cs'), 'TH Sarabun New')

def add_para(text, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT):
    p = doc.add_paragraph()
    p.alignment = align
    run = p.add_run(insert_zwsp(text))
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(16)
    run.bold = bold
    r = run._element.rPr.rFonts
    if r is not None:
        r.set(qn('w:eastAsia'), 'TH Sarabun New')
        r.set(qn('w:cs'), 'TH Sarabun New')
    return p

# Header
add_para("คำอธิบายรายวิชา", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_para("รหัสวิชา ศ21102 ชื่อวิชา ดนตรี 2 กลุ่มสาระการเรียนรู้ ศิลปะ")
add_para("ชั้นมัธยมศึกษาปีที่ 2 ภาคเรียนที่ 2 เวลา 20 ชั่วโมง จำนวน 0.5 หน่วยกิต")
add_para("")

# Course Description
add_para("คำอธิบายรายวิชา", bold=True)
desc_k = "ศึกษาและปฏิบัติเกี่ยวกับการอ่าน เขียน และร้องโน้ตสากลที่มีเครื่องหมายแปลงเสียง เพื่อความเข้าใจในเรื่องของเสียงประสาน พัฒนาเทคนิคการบรรเลงคาลิมบ้าเดี่ยวและรวมวงรูปแบบเพลงวน (Round/Canon) การประเมินพัฒนาการทักษะดนตรีของตนเอง เปรียบเทียบการใช้องค์ประกอบดนตรีต่างวัฒนธรรม วิเคราะห์อารมณ์เพลงและอิทธิพลของดนตรีที่มีต่อสังคมและวัฒนธรรม รวมถึงประวัติศาสตร์ดนตรีในประเทศและต่างประเทศ"
add_para("     " + desc_k)

desc_p = "โดยใช้การออกแบบการจัดการเรียนรู้แบบอิงมาตรฐาน (Backward Design) ด้วยรูปแบบนวัตกรรม T-PACE Framework (Technology–Performance–Active–Creative–Evaluation) ควบคู่กับระบบนิเวศการเรียนรู้ดิจิทัล (Digital Learning Ecosystem) ผ่านแอปพลิเคชัน MusicSmart ที่สนับสนุนการประเมินแบบ Real-time Peer Review และการเก็บข้อมูลเชิงประจักษ์เพื่อการวิจัยในชั้นเรียน (Classroom Action Research: CAR)"
add_para("     " + desc_p)

desc_a = "เพื่อให้ผู้เรียนเกิดสุนทรียภาพ เห็นคุณค่าของดนตรี สามารถวิจารณ์และเผยแพร่ผลงานดนตรีอย่างสร้างสรรค์ (ผ่าน Digital Portfolio และ Mini-Recital) ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ"
add_para("     " + desc_a)
add_para("")

# Indicators
add_para("รหัสตัวชี้วัด", bold=True)
indicators = [
    "ศ 2.1 ม.2/1, ม.2/2, ม.2/3, ม.2/4, ม.2/5, ม.2/6, ม.2/7",
    "ศ 2.2 ม.2/1, ม.2/2"
]
for ind in indicators:
    add_para("     " + ind)
add_para("รวมทั้งหมด 9 ตัวชี้วัด", bold=True)
doc.add_page_break()

# Course Structure
add_para("โครงสร้างรายวิชา ดนตรี 2 (รหัสวิชา ศ21102)", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_para("")

table = doc.add_table(rows=1, cols=6)
table.style = 'Table Grid'
hdr_cells = table.rows[0].cells
headers = ["ลำดับที่", "ชื่อหน่วยการเรียนรู้", "มาตรฐาน/ตัวชี้วัด", "สาระสำคัญ / ภาระงานรวบยอด", "เวลา(ชั่วโมง)", "น้ำหนักคะแนน"]
for i, header in enumerate(headers):
    run = hdr_cells[i].paragraphs[0].add_run(insert_zwsp(header))
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(16)
    run.bold = True
    hdr_cells[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

data = [
    ("1", "ทฤษฎีเสียงประสานและโน้ตแปลงเสียง", "ศ 2.1 ม.2/2, 2/4", "การสร้างความรู้ด้วยตนเอง (Constructivism) ในการอ่าน เขียน และร้อง (Sight-Singing) โน้ตสากลที่มีเครื่องหมายแปลงเสียงเพื่อเป็นพื้นฐานการฟังเสียงประสาน\nภาระงานรวบยอด: Digital Portfolio (แบบฝึกหัดการร้อง)", "4", "20"),
    ("2", "ปฏิบัติรวมวงคาลิมบ้า (Round)", "ศ 2.1 ม.2/3, 2/4", "การบรรเลงเครื่องดนตรีรวมวงแบบสอดประสาน (Round/Canon) ผ่านกระบวนการ Peer Coaching พร้อมประเมินการปฏิบัติของตนเอง\nภาระงานรวบยอด: Mini-Recital (คาลิมบ้าแบบ Round) + Peer Critique", "7", "20"),
    ("3", "องค์ประกอบดนตรีข้ามวัฒนธรรม", "ศ 2.1 ม.2/1, 2/5,\n2/6, 2/7", "การวิเคราะห์และเปรียบเทียบการใช้องค์ประกอบดนตรีจากวัฒนธรรมต่างกัน\nภาระงานรวบยอด: Digital Audio Guide / Podcast", "4", "20"),
    ("4", "ดนตรีในประวัติศาสตร์และวัฒนธรรม", "ศ 2.2 ม.2/1, 2/2", "การบูรณาการบริบททางสังคม อิทธิพลของวัฒนธรรมและประวัติศาสตร์ที่มีต่อรูปแบบดนตรี\nภาระงานรวบยอด: Digital Playlist Curation + บทวิจารณ์", "3", "20"),
    ("", "สอบกลางภาค", "ทดสอบหน่วยที่ 1-2", "", "1", "10"),
    ("", "สอบปลายภาค", "ทดสอบหน่วยที่ 3-4", "", "1", "10"),
    ("", "รวม", "รวม 9 ตัวชี้วัด", "", "20", "100")
]

for row_data in data:
    row_cells = table.add_row().cells
    for i, item in enumerate(row_data):
        p = row_cells[i].paragraphs[0]
        run = p.add_run(insert_zwsp(item))
        run.font.name = 'TH Sarabun New'
        run.font.size = Pt(16)
        if i in [0, 4, 5]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_page_break()

add_para("ตารางวิเคราะห์การวัดและประเมินผล (K-P-A)", bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
add_para("")

kpa_table = doc.add_table(rows=2, cols=5)
kpa_table.style = 'Table Grid'
# Merge cells for header
for i, h in enumerate(["หน่วยการเรียนรู้", "คะแนนระหว่างเรียน", "", "", "คะแนนรวม"]):
    if h:
        kpa_table.cell(0, i).text = insert_zwsp(h)

kpa_table.cell(0, 1).merge(kpa_table.cell(0, 3))
sub_headers = ["", "K", "P", "A", ""]
for i, sh in enumerate(sub_headers):
    if sh:
        kpa_table.cell(1, i).text = sh

# Format headers
for row in kpa_table.rows:
    for cell in row.cells:
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.font.name = 'TH Sarabun New'
                run.font.size = Pt(16)
                run.bold = True

kpa_data = [
    ("หน่วยที่ 1", "5", "10", "5", "20"),
    ("หน่วยที่ 2", "5", "10", "5", "20"),
    ("หน่วยที่ 3", "8", "7", "5", "20"),
    ("หน่วยที่ 4", "8", "7", "5", "20")
]

for row_data in kpa_data:
    row_cells = kpa_table.add_row().cells
    for i, item in enumerate(row_data):
        p = row_cells[i].paragraphs[0]
        run = p.add_run(insert_zwsp(item))
        run.font.name = 'TH Sarabun New'
        run.font.size = Pt(16)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

add_para("")
add_para("หลักการออกแบบหลักสูตรและการจัดการเรียนรู้ (Curriculum Design Principles)", bold=True)
add_para("1. Backward Design: ออกแบบจากเป้าหมายและหลักฐานการเรียนรู้ก่อน ตามด้วยการวางแผนกิจกรรม")
add_para("2. T-PACE Framework: นวัตกรรมกรอบการสอนดนตรีที่บูรณาการ Technology–Performance–Active–Creative–Evaluation")
add_para("3. Digital Learning Ecosystem: MusicSmart App ทำหน้าที่เป็น Co-Pilot ให้ Feedback Real-time และเก็บ Data สำหรับ CAR")
add_para("4. Constructivism & SDL: นักเรียนสร้างองค์ความรู้ด้วยตนเอง (Construct Knowledge) และกำกับการเรียนรู้ส่วนบุคคล (Self-Directed Learning)")

output_path = os.path.join(os.getcwd(), 'โครงสร้างรายวิชา_วก3_ดนตรีม2_สมบูรณ์.docx')
doc.save(output_path)
print("Document generated successfully at:", output_path)
