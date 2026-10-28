# -*- coding: utf-8 -*-
"""
สร้างและจัดเตรียมเอกสารส่งวิชาการ 2/2569 โรงเรียนพะเยาพิทยาคม
ตามแบบฟอร์มทางการ วก.3, วก.4, วก.5 และหน้าปกรวม ครบถ้วน 100%
ปรับขนาดบรรทัดและระยะห่างให้จำนวนหน้าตรงตามต้นฉบับเป๊ะๆ:
  - 01_ไฟล์หน้าปกรวม: 1 หน้า
  - 02_วก3_โครงสร้างรายวิชา: 6 หน้า
  - 03_วก4_หน่วยการเรียนรู้ที่_2: 4 หน้า (3 หน้าแนวตั้ง + 1 หน้าแนวนอน)
  - 04_วก5_แผนการจัดการเรียนรู้_แผนที่_02: 4 หน้า
"""
import os
import sys
import math
import docx
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION, WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont
import win32com.client

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = r"D:\AI CURSER\PLANE MUSIC ED"
LOGO_PATH = os.path.join(BASE_DIR, "เอกสารแผนการสอน", "picppk04.jpg")
TARGET_DIR = os.path.join(BASE_DIR, "เอกสารแผนการสอน", "ส่งวิชาการ 2 2569")
SCRATCH_DIR = r"C:\Users\krumu\.gemini\antigravity-ide\brain\4bb97365-78b2-4abd-8f83-868bf9e60d37\scratch"

os.makedirs(TARGET_DIR, exist_ok=True)
os.makedirs(SCRATCH_DIR, exist_ok=True)

FONT_REGULAR = r"C:\Users\krumu\AppData\Local\Microsoft\Windows\Fonts\THSarabunNew.ttf"
FONT_BOLD = r"C:\Users\krumu\AppData\Local\Microsoft\Windows\Fonts\THSarabunNew Bold.ttf"

# ==============================================================================
# Helper functions
# ==============================================================================
def set_run_font(run, size=15, bold=False, italic=False, color_rgb=None):
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb
    rPr = run._element.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    for attr in ['w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia']:
        rFonts.set(qn(attr), 'TH Sarabun New')
    rPr.append(rFonts)

def add_p(container, text="", size=15, bold=False, italic=False,
          align=WD_ALIGN_PARAGRAPH.LEFT, space_before=0, space_after=1.5,
          line_spacing=1.05, color_rgb=None):
    p = container.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    if text:
        r = p.add_run(text)
        set_run_font(r, size=size, bold=bold, italic=italic, color_rgb=color_rgb)
    return p

def add_wk_badge(doc, text="วก.3"):
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.RIGHT
    table.autofit = False
    
    c0 = table.rows[0].cells[0]
    c1 = table.rows[0].cells[1]
    c0.width = Cm(15.0)
    c1.width = Cm(2.0)
    
    c0.paragraphs[0].text = ""
    p0 = c0.paragraphs[0]
    p0.paragraph_format.space_before = Pt(0)
    p0.paragraph_format.space_after = Pt(0)
    
    p1 = c1.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_before = Pt(1)
    p1.paragraph_format.space_after = Pt(1)
    p1.paragraph_format.line_spacing = 1.0
    r = p1.add_run(text)
    set_run_font(r, size=15, bold=True)
    
    tcPr = c1._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for b_name in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{b_name}')
        b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), '6')
        b.set(qn('w:space'), '0')
        b.set(qn('w:color'), '000000')
        tcBorders.append(b)
    tcPr.append(tcBorders)

def setup_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    top = OxmlElement('w:top')
    top.set(qn('w:val'), 'single')
    top.set(qn('w:sz'), '6')
    top.set(qn('w:space'), '3')
    top.set(qn('w:color'), '000000')
    pBdr.append(top)
    pPr.append(pBdr)
    
    r_txt = p.add_run("งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ โรงเรียนพะเยาพิทยาคม ")
    set_run_font(r_txt, size=11, bold=False)
    
    if os.path.exists(LOGO_PATH):
        r_img = p.add_run()
        r_img.add_picture(LOGO_PATH, height=Cm(0.50))

def format_cell(cell, text="", size=12.5, bold=False, italic=False,
                align=WD_ALIGN_PARAGRAPH.LEFT, bg_hex=None, space_before=1, space_after=1):
    cell.text = ""
    lines = text.split('\n')
    for idx, line in enumerate(lines):
        p = cell.paragraphs[0] if idx == 0 else cell.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.05
        if line:
            r = p.add_run(line)
            set_run_font(r, size=size, bold=bold, italic=italic)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    if bg_hex:
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), bg_hex)
        tcPr.append(shd)

def setup_base_doc(orientation='portrait'):
    doc = docx.Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(1.6)
    sec.bottom_margin = Cm(1.6)
    sec.left_margin = Cm(2.0)
    sec.right_margin = Cm(2.0)
    if orientation == 'landscape':
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width = Cm(29.7)
        sec.page_height = Cm(21.0)
    else:
        sec.orientation = WD_ORIENT.PORTRAIT
        sec.page_width = Cm(21.0)
        sec.page_height = Cm(29.7)
    
    setup_footer(sec)
    
    style = doc.styles['Normal']
    style.font.name = 'TH Sarabun New'
    style.font.size = Pt(15)
    return doc

# ==============================================================================
# วาดผังมโนทัศน์ (Concept Map)
# ==============================================================================
def draw_concept_map():
    out_path = os.path.join(SCRATCH_DIR, "concept_map.png")
    font_title = ImageFont.truetype(FONT_BOLD, 34)
    font_body = ImageFont.truetype(FONT_REGULAR, 26)
    font_bold = ImageFont.truetype(FONT_BOLD, 28)

    W, H = 1600, 1050
    img = Image.new('RGB', (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    def draw_box(draw, xy, text, title):
        x0, y0, x1, y1 = xy
        draw.rounded_rectangle([x0, y0, x1, y1], radius=12, outline=(0, 0, 0), width=3, fill=(253, 253, 254))
        bbox_t = draw.textbbox((0, 0), title, font=font_bold)
        tw, th = bbox_t[2] - bbox_t[0], bbox_t[3] - bbox_t[1]
        draw.text((x0 + (x1 - x0 - tw) / 2, y0 + 16), title, font=font_bold, fill=(0, 0, 0))
        
        lines = text.split('\n')
        cur_y = y0 + 20 + th + 10
        for line in lines:
            bbox_l = draw.textbbox((0, 0), line, font=font_body)
            lw, lh = bbox_l[2] - bbox_l[0], bbox_l[3] - bbox_l[1]
            draw.text((x0 + (x1 - x0 - lw) / 2, cur_y), line, font=font_body, fill=(40, 40, 40))
            cur_y += lh + 6

    def draw_polygon_arrow(draw, start, end, shaft_w=20, head_w=46, head_len=36):
        x0, y0 = start
        x1, y1 = end
        dx = x1 - x0
        dy = y1 - y0
        dist = math.hypot(dx, dy)
        if dist == 0: return
        ux = dx / dist
        uy = dy / dist
        px = -uy
        py = ux
        hx = x1 - ux * head_len
        hy = y1 - uy * head_len
        points = [
            (x0 + px * (shaft_w / 2), y0 + py * (shaft_w / 2)),
            (hx + px * (shaft_w / 2), hy + py * (shaft_w / 2)),
            (hx + px * (head_w / 2), hy + py * (head_w / 2)),
            (x1, y1),
            (hx - px * (head_w / 2), hy - py * (head_w / 2)),
            (hx - px * (shaft_w / 2), hy - py * (shaft_w / 2)),
            (x0 - px * (shaft_w / 2), y0 - py * (shaft_w / 2)),
        ]
        draw.polygon(points, fill=(255, 255, 255), outline=(0, 0, 0))

    b1 = [80, 80, 680, 290]
    b2 = [920, 80, 1520, 290]
    b3 = [80, 760, 680, 970]
    b4 = [920, 760, 1520, 970]

    draw_box(draw, b1, 'ทบทวนคาลิมบ้าและเสียงประสาน\nเวลา 4 คาบ (20 คะแนน)', 'หน่วยที่ 1')
    draw_box(draw, b2, 'ปฏิบัติรวมวงคาลิมบ้าเพลงวน\nเวลา 7 คาบ (20 คะแนน)', 'หน่วยที่ 2')
    draw_box(draw, b3, 'รอบรู้ดนตรีข้ามวัฒนธรรมและอาชีพดนตรี\nเวลา 4 คาบ (20 คะแนน)', 'หน่วยที่ 3')
    draw_box(draw, b4, 'ดนตรีกับสังคมและการวิจารณ์เชิงประจักษ์\nเวลา 3 คาบ (20 คะแนน)', 'หน่วยที่ 4')

    cx, cy, r = W // 2, H // 2, 195
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 0, 0), width=4, fill=(255, 255, 255))
    draw.ellipse([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], outline=(0, 0, 0), width=2)

    c_title = "ชื่อรายวิชา"
    c_sub = "ดนตรี 2 (ศ22102)"
    c_desc = "ชั้นมัธยมศึกษาปีที่ 2\nเวลา 20 ชั่วโมง (0.5 หน่วยกิต)"

    b_t = draw.textbbox((0, 0), c_title, font=font_title)
    draw.text((cx - (b_t[2] - b_t[0]) / 2, cy - 80), c_title, font=font_title, fill=(0, 0, 0))

    b_s = draw.textbbox((0, 0), c_sub, font=font_bold)
    draw.text((cx - (b_s[2] - b_s[0]) / 2, cy - 30), c_sub, font=font_bold, fill=(0, 51, 102))

    for i, l in enumerate(c_desc.split('\n')):
        b = draw.textbbox((0, 0), l, font=font_body)
        draw.text((cx - (b[2] - b[0]) / 2, cy + 20 + i * 34), l, font=font_body, fill=(70, 70, 70))

    draw_polygon_arrow(draw, (cx - 145, cy - 125), (680, 260))
    draw_polygon_arrow(draw, (cx + 145, cy - 125), (920, 260))
    draw_polygon_arrow(draw, (cx - 145, cy + 125), (680, 780))
    draw_polygon_arrow(draw, (cx + 145, cy + 125), (920, 780))

    img.save(out_path)
    return out_path

# ==============================================================================
# 1. ไฟล์หน้าปกรวม (Cover Page) - ฟิตพอดี 1 หน้า 100%
# ==============================================================================
def build_cover_doc():
    doc = docx.Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(1.5)
    sec.bottom_margin = Cm(1.5)
    sec.left_margin = Cm(1.8)
    sec.right_margin = Cm(1.8)
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = t.rows[0].cells[0]
    cell.width = Cm(17.4)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for b_name in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{b_name}')
        b.set(qn('w:val'), 'double')
        b.set(qn('w:sz'), '18')
        b.set(qn('w:space'), '8')
        b.set(qn('w:color'), '0F2C59')
        tcBorders.append(b)
    tcPr.append(tcBorders)
    
    cp = cell.paragraphs[0]
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cp.paragraph_format.space_before = Pt(4)
    cp.paragraph_format.space_after = Pt(2)
    
    if os.path.exists(LOGO_PATH):
        r_img = cp.add_run()
        r_img.add_picture(LOGO_PATH, height=Cm(2.8))
    
    add_p(cell, "โรงเรียนพะเยาพิทยาคม", size=22, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=1, color_rgb=RGBColor(0x0F, 0x2C, 0x59))
    add_p(cell, "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาพะเยา", size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(cell, "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    p_div = cell.add_paragraph()
    p_div.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_div.paragraph_format.space_before = Pt(2)
    p_div.paragraph_format.space_after = Pt(6)
    r_line = p_div.add_run("―" * 38)
    set_run_font(r_line, size=13, bold=True, color_rgb=RGBColor(0xD0, 0x8A, 0x3E))
    
    add_p(cell, "เอกสารหลักสูตรและการจัดการเรียนรู้", size=25, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=1, color_rgb=RGBColor(0x0F, 0x2C, 0x59))
    add_p(cell, "ภาคเรียนที่ 2 ปีการศึกษา 2569", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=8, color_rgb=RGBColor(0x9E, 0x2A, 0x2B))
    
    t_inner = cell.add_table(rows=1, cols=1)
    t_inner.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_in = t_inner.rows[0].cells[0]
    c_in.width = Cm(15.2)
    
    tcPr_in = c_in._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F4F6F9')
    tcPr_in.append(shd)
    
    b_in = OxmlElement('w:tcBorders')
    for b_name in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{b_name}')
        b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), '6')
        b.set(qn('w:space'), '4')
        b.set(qn('w:color'), 'B0C4DE')
        b_in.append(b)
    tcPr_in.append(b_in)
    
    add_p(c_in, "กลุ่มสาระการเรียนรู้ศิลปะ", size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=3, space_after=1)
    add_p(c_in, "รายวิชา ดนตรี 2   รหัสวิชา ศ22102", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1, color_rgb=RGBColor(0x0F, 0x2C, 0x59))
    add_p(c_in, "ระดับชั้นมัธยมศึกษาปีที่ 2   เวลา 20 ชั่วโมง (0.5 หน่วยกิต)", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    add_p(c_in, "รายการเอกสารที่นำส่งกลุ่มบริหารวิชาการ:", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=1)
    add_p(c_in, "  ๑. โครงสร้างหลักสูตรรายวิชา (Course Curriculum) (แบบ วก.3)", size=14.5, bold=False, space_before=0, space_after=1)
    add_p(c_in, "  ๒. หน่วยการเรียนรู้ตามหลักสูตรรายวิชา (Unit Plan) หน่วยที่ 2 (แบบ วก.4)", size=14.5, bold=False, space_before=0, space_after=1)
    add_p(c_in, "  ๓. แผนการจัดการเรียนรู้รายชั่วโมง (Lesson Plan) แผนที่ 2 (แบบ วก.5)", size=14.5, bold=False, space_before=0, space_after=4)
    
    add_p(cell, "จัดทำโดย", size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8, space_after=1)
    add_p(cell, "นายพงศธร โพธิแก้ว", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1, color_rgb=RGBColor(0x0F, 0x2C, 0x59))
    add_p(cell, "ตำแหน่ง ครู   กลุ่มสาระการเรียนรู้ศิลปะ", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=8)
    
    add_p(cell, "งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=1)
    add_p(cell, "โรงเรียนพะเยาพิทยาคม", size=17, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4, color_rgb=RGBColor(0x0F, 0x2C, 0x59))
    
    out_docx = os.path.join(TARGET_DIR, "01_ไฟล์หน้าปกรวม_ส่งงานวิชาการ_2_2569_ศ22102_ดนตรี2.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 2. โครงสร้างหลักสูตรรายวิชา (วก.3) - ฟิตพอดี 6 หน้า 100%
# ==============================================================================
def build_wk3_doc():
    doc = setup_base_doc(orientation='portrait')
    
    # ----- หน้าที่ 1: คำอธิบายรายวิชา -----
    add_wk_badge(doc, "วก.3")
    add_p(doc, "คำอธิบายรายวิชา", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=2)
    add_p(doc, "รหัสวิชา ศ22102   ชื่อวิชา ดนตรี 2   กลุ่มสาระการเรียนรู้ ศิลปะ", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ชั้นมัธยมศึกษาปีที่ 2   ภาคเรียนที่ 2   เวลา 20 ชั่วโมง   จำนวน 0.5 หน่วยกิต", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    add_p(doc, "คำอธิบายรายวิชา", size=15, bold=True, space_before=2, space_after=2)
    
    para_k = (
        "        ศึกษาและทบทวนพื้นฐานสรีรศาสตร์และการบรรเลงคาลิมบ้าในบันไดเสียง C Major จากชั้นมัธยมศึกษาปีที่ 1 "
        "เพื่อต่อยอดสู่เทคนิคการดีดคู่เสียงประสาน (Dyads ขั้นคู่ 3, 5) การรูดคอร์ด 3 เสียง (Triad Glissando) "
        "และการเกาโน้ตกระจายคอร์ด (Arpeggio Accompaniment) ในคีย์ C Major ประกอบการขับร้องเดี่ยวและรวมวงรูปแบบเพลงวนสอดประสาน "
        "(Canon / Round) ศึกษาทฤษฎีการอ่าน เขียน และร้องโน้ตไทยและโน้ตสากลที่มีเครื่องหมายแปลงเสียง (Sharp #, Flat b, Natural ♮) "
        "ผ่านผังลิ่มเสียงและใบงานถอดรหัสโน้ตพร้อมหลักการย้ายคีย์เพลง (Transposition) มาสู่คีย์ C Major ระบุปัจจัยสำคัญที่มีอิทธิพลต่อการสร้างสรรค์งานดนตรี "
        "เปรียบเทียบการใช้องค์ประกอบดนตรีที่มาจากวัฒนธรรมต่างกัน ระบุอาชีพต่างๆ ที่เกี่ยวข้องกับดนตรีและบทบาทของดนตรีในธุรกิจบันเทิง "
        "บรรยายบทบาทและความสัมพันธ์ของดนตรีต่อสังคมและวัฒนธรรมในยุคสมัยต่างๆ ตลอดจนปัจจัยที่มีอิทธิพลต่อการเปลี่ยนแปลงของดนตรีในสังคม"
    )
    add_p(doc, para_k, size=14, space_before=0, space_after=3, line_spacing=1.03)
    
    para_p = (
        "        โดยใช้กระบวนการจัดการเรียนรู้เชิงรุก (Active Learning) ตามกรอบแนวคิดนวัตกรรม T-PACE Framework "
        "(Trigger & Tuning – Practice & Precision – Active Collaboration/Analysis – Creative Challenge – Evaluation & Reflection) "
        "ที่ยืดหยุ่นตามธรรมชาติภาระงานดนตรี (3 Instructional Modes) และขับเคลื่อนด้วยกลไกการเรียนรู้ปรับเหมาะ 3 ระดับ "
        "(3-Tier Adaptive Mastery Loop: Bronze–Silver–Gold) ควบคู่กับระบบนิเวศการเรียนรู้ดิจิทัลผ่านแอปพลิเคชัน MusicSmart "
        "และการวิจัยปฏิบัติการในชั้นเรียน (Classroom Action Research: CAR)"
    )
    add_p(doc, para_p, size=14, space_before=0, space_after=3, line_spacing=1.03)
    
    para_a = (
        "        เพื่อให้ผู้เรียนเกิดสุนทรียภาพ เห็นคุณค่าของดนตรี สามารถบรรยายอารมณ์ของเพลงและความรู้สึกที่มีต่อบทเพลงที่ฟังอย่างมีหลักฐานเชิงประจักษ์ "
        "ประเมินพัฒนาการทักษะทางดนตรีของตนเองหลังจากการฝึกปฏิบัติได้อย่างเป็นระบบ นำความรู้ทางดนตรีไปประยุกต์ใช้สร้างสรรค์ประโยชน์ต่อสังคมและชีวิตประจำวัน "
        "ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ"
    )
    add_p(doc, para_a, size=14, space_before=0, space_after=4, line_spacing=1.03)
    
    add_p(doc, "รหัสตัวชี้วัด", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "ศ 2.1 ม.2/1, ม.2/2, ม.2/3, ม.2/4, ม.2/5, ม.2/6, ม.2/7\nศ 2.2 ม.2/1, ม.2/2", size=14, space_before=0, space_after=1, line_spacing=1.03)
    add_p(doc, "รวมทั้งหมด 9 ตัวชี้วัด", size=15, bold=True, space_before=1, space_after=4)
    
    notes_p1 = (
        "(ถ้าเป็นรายวิชาเพิ่มเติม ให้เปลี่ยนจาก มาตรฐานและตัวชี้วัด เป็น สาระและผลการเรียนรู้ หรือเฉพาะผลการเรียนรู้\n"
        "คำอธิบายรายวิชา ควรมีทั้ง K P และ A แบ่งเป็นย่อหน้าให้ชัดเจน\n"
        "สำหรับด้านคุณลักษณะอันพึงประสงค์ ให้เขียนข้อความเพิ่มเติมว่า “ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ”\n"
        "วิชา 0.5 หน่วยกิต เวลาเรียน 20 ชั่วโมง แบ่งเป็น 1 ชั่วโมงต่อสัปดาห์ | วิชา 1.0 หน่วยกิต เวลาเรียน 40 ชั่วโมง แบ่งเป็น 2 ชั่วโมงต่อสัปดาห์\n"
        "วิชา 1.5 หน่วยกิต เวลาเรียน 60 ชั่วโมง แบ่งเป็น 3 ชั่วโมงต่อสัปดาห์ | วิชา 2.0 หน่วยกิต เวลาเรียน 80 ชั่วโมง แบ่งเป็น 4 ชั่วโมงต่อสัปดาห์)"
    )
    add_p(doc, notes_p1, size=11, italic=True, color_rgb=RGBColor(0xC0, 0x00, 0x00), space_before=2, space_after=0, line_spacing=1.0)
    
    # ----- หน้าที่ 2: ตารางการวิเคราะห์หลักสูตร -----
    doc.add_page_break()
    add_p(doc, "ตารางการวิเคราะห์หลักสูตร", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "รายวิชา ดนตรี 2   รหัสวิชา ศ22102", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ระดับชั้นมัธยมศึกษาปีที่ 2   กลุ่มสาระการเรียนรู้ ศิลปะ", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    t_cur = doc.add_table(rows=1, cols=2)
    t_cur.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_cur.style = 'Table Grid'
    t_cur.rows[0].cells[0].width = Cm(5.8)
    t_cur.rows[0].cells[1].width = Cm(11.2)
    format_cell(t_cur.rows[0].cells[0], "มาตรฐานการเรียนรู้/ตัวชี้วัด", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    format_cell(t_cur.rows[0].cells[1], "สาระการเรียนรู้", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    cur_data = [
        ("ศ 2.1 ม.2/1 เปรียบเทียบการใช้องค์ประกอบดนตรีที่มาจากวัฒนธรรมต่างกัน",
         "การเปรียบเทียบระบบเสียง จังหวะ ทำนอง พื้นผิว และสีสันเสียง ระหว่างดนตรีพื้นบ้านล้านนา/ไทย กับดนตรีสากล"),
        ("ศ 2.1 ม.2/2 อ่าน เขียน ร้องโน้ตไทยและโน้ตสากลที่มีเครื่องหมายแปลงเสียง",
         "สัญลักษณ์เครื่องหมายแปลงเสียง (#, b, ♮) การอ่าน/เขียน/ร้องโน้ต และการย้ายคีย์เพลง (Transposition) สู่คีย์ C"),
        ("ศ 2.1 ม.2/3 ระบุปัจจัยสำคัญที่มีอิทธิพลต่อการสร้างสรรค์งานดนตรี",
         "การวิเคราะห์ปัจจัยด้านแรงบันดาลใจ วัฒนธรรม เทคโนโลยี และเครื่องดนตรี ในการเรียบเรียงบทเพลงรวมวง"),
        ("ศ 2.1 ม.2/4 ร้องเพลงและเล่นดนตรีเดี่ยวและรวมวง",
         "การบรรเลงคาลิมบ้าคีย์ C เทคนิคคู่เสียงประสาน (Dyads) คอร์ด 3 เสียง การเกาคอร์ด และการรวมวงเพลงวน (Canon)"),
        ("ศ 2.1 ม.2/5 บรรยายอารมณ์ของเพลงและความรู้สึกที่มีต่อบทเพลงที่ฟัง",
         "การวิเคราะห์และบรรยายอารมณ์เพลงเชิงประจักษ์ด้วยกราฟพิกัดอารมณ์ 2 มิติ (2D Emotion Grid: Valence vs. Arousal)"),
        ("ศ 2.1 ม.2/6 ประเมินพัฒนาการทักษะทางดนตรีของตนเองหลังการฝึกปฏิบัติ",
         "การประเมินทักษะการขับร้องและบรรเลงดนตรีของตนเองและเพื่อนอย่างเป็นระบบ และการตั้งเป้าหมายพัฒนาตนเอง"),
        ("ศ 2.1 ม.2/7 ระบุอาชีพที่เกี่ยวข้องกับดนตรีและบทบาทในธุรกิจบันเทิง",
         "สายอาชีพดนตรี (Producer, Sound Designer, Performer) และบทบาทของดนตรีในอุตสาหกรรมบันเทิงและสื่อดิจิทัล"),
        ("ศ 2.2 ม.2/1 บรรยายบทบาทและความสัมพันธ์ของดนตรีต่อสังคมวัฒนธรรม",
         "บทบาทและคุณค่าของดนตรีในมิติประวัติศาสตร์ สังคม และพิธีกรรม ความเชื่อมโยงกับวิถีชีวิตในแต่ละยุคสมัย"),
        ("ศ 2.2 ม.2/2 ระบุปัจจัยที่มีอิทธิพลต่อการเปลี่ยนแปลงของดนตรีในสังคม",
         "ปัจจัยด้านเทคโนโลยี ยุคสมัย ค่านิยม และสื่อสังคมออนไลน์ที่มีอิทธิพลต่อวิวัฒนาการและการเปลี่ยนแปลงทางดนตรี"),
    ]
    for c0, c1 in cur_data:
        row = t_cur.add_row().cells
        row[0].width = Cm(5.8)
        row[1].width = Cm(11.2)
        format_cell(row[0], c0, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=1, space_after=1)
        format_cell(row[1], c1, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=1, space_after=1)
    
    add_p(doc, "(ถ้าเป็นรายวิชาเพิ่มเติม ให้เปลี่ยนจาก มาตรฐานและตัวชี้วัด เป็น ผลการเรียนรู้)", size=11, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, color_rgb=RGBColor(0xC0, 0x00, 0x00), space_before=3, space_after=0)
    
    # ----- หน้าที่ 3: ตารางวิเคราะห์หน่วยการเรียนรู้กับตัวชี้วัด -----
    doc.add_page_break()
    add_p(doc, "ตารางวิเคราะห์หน่วยการเรียนรู้กับมาตรฐานการเรียนรู้และตัวชี้วัดชั้นปี", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "รหัสวิชา ศ22102   ชื่อวิชา ดนตรี 2", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "กลุ่มสาระการเรียนรู้ ศิลปะ", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    t_mat = doc.add_table(rows=2, cols=10)
    t_mat.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_mat.style = 'Table Grid'
    
    t_mat.cell(0, 0).merge(t_mat.cell(1, 0))
    format_cell(t_mat.cell(0, 0), "มาตรฐานการเรียนรู้และตัวชี้วัด\nหน่วยการเรียนรู้", size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    t_mat.cell(0, 0).width = Cm(6.2)
    
    for c_i in range(1, 8):
        t_mat.cell(0, 1).merge(t_mat.cell(0, c_i))
    format_cell(t_mat.cell(0, 1), "มาตรฐาน ศ 2.1", size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    t_mat.cell(0, 8).merge(t_mat.cell(0, 9))
    format_cell(t_mat.cell(0, 8), "มาตรฐาน ศ 2.2", size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    for i in range(1, 8):
        format_cell(t_mat.cell(1, i), str(i), size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="EDF2F7")
        t_mat.cell(1, i).width = Cm(1.2)
    for i in range(1, 3):
        format_cell(t_mat.cell(1, 7 + i), str(i), size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="EDF2F7")
        t_mat.cell(1, 7 + i).width = Cm(1.2)
    
    matrix_rows = [
        ("หน่วยการเรียนรู้ที่ 1\nชื่อหน่วย ทบทวนคาลิมบ้าและเสียงประสาน",
         ["", "✔", "", "✔", "", "✔", "", "", ""]),
        ("หน่วยการเรียนรู้ที่ 2\nชื่อหน่วย ปฏิบัติรวมวงคาลิมบ้าเพลงวน",
         ["", "", "✔", "✔", "", "✔", "", "", ""]),
        ("หน่วยการเรียนรู้ที่ 3\nชื่อหน่วย รอบรู้ดนตรีข้ามวัฒนธรรมและอาชีพดนตรี",
         ["✔", "", "✔", "", "", "", "✔", "", ""]),
        ("หน่วยการเรียนรู้ที่ 4\nชื่อหน่วย ดนตรีกับสังคมและการวิจารณ์เชิงประจักษ์",
         ["", "", "", "", "✔", "✔", "", "✔", "✔"]),
    ]
    for u_title, checks in matrix_rows:
        row = t_mat.add_row().cells
        row[0].width = Cm(6.2)
        format_cell(row[0], u_title, size=12.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=3, space_after=3)
        for idx, chk in enumerate(checks):
            row[idx + 1].width = Cm(1.2)
            format_cell(row[idx + 1], chk, size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    note_mat = (
        "(ให้ทำเครื่องหมาย ✔ ลงในช่องว่าง\n"
        "สำหรับเลข 1, 2, 3, 4, 5 ในแนวนอน หมายถึง หมายเลขตัวชี้วัดในมาตรฐานนั้น\n"
        "และในรายวิชาเพิ่มเติมให้ใช้ผลการเรียนรู้แทน)"
    )
    add_p(doc, note_mat, size=11, italic=True, color_rgb=RGBColor(0xC0, 0x00, 0x00), space_before=4, space_after=0)
    
    # ----- หน้าที่ 4: ผังมโนทัศน์หน่วยการเรียนรู้ -----
    doc.add_page_break()
    add_p(doc, "ผังมโนทัศน์หน่วยการเรียนรู้", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "รหัสวิชา ศ22102   ชื่อรายวิชา ดนตรี 2   ชั้นมัธยมศึกษาปีที่ 2", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "(เขียนชื่อรายวิชาและชื่อหน่วยการเรียนรู้ลงในผังมโนทัศน์)", size=12, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, color_rgb=RGBColor(0xC0, 0x00, 0x00), space_before=0, space_after=6)
    
    c_map_img = draw_concept_map()
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(2)
    p_img.paragraph_format.space_after = Pt(2)
    r_c_map = p_img.add_run()
    r_c_map.add_picture(c_map_img, width=Cm(16.0))
    
    # ----- หน้าที่ 5: โครงสร้างรายวิชา -----
    doc.add_page_break()
    add_p(doc, "โครงสร้างรายวิชา ศ22102   ชื่อวิชา ดนตรี 2", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "ชั้นมัธยมศึกษาปีที่ 2   เวลา 20 ชั่วโมง   จำนวน 0.5 หน่วยกิต", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    t_str = doc.add_table(rows=1, cols=6)
    t_str.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_str.style = 'Table Grid'
    headers_str = ["ลำดับที่", "ชื่อหน่วยการเรียนรู้", "มาตรฐานการเรียนรู้/ตัวชี้วัด", "สาระสำคัญ", "เวลา\n(ชั่วโมง)", "น้ำหนักคะแนน\n(คะแนน)"]
    widths_str = [Cm(1.2), Cm(3.3), Cm(3.2), Cm(6.2), Cm(1.5), Cm(1.6)]
    for i, h in enumerate(headers_str):
        cell = t_str.rows[0].cells[i]
        cell.width = widths_str[i]
        format_cell(cell, h, size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    str_rows = [
        ("1", "ทบทวนคาลิมบ้าและเสียงประสาน", "ศ 2.1 ม.2/2, 4, 6",
         "ทบทวนสรีรศาสตร์และสเกล C Major ต่อยอดสู่คู่เสียงประสาน (Dyads ขั้นคู่ 3, 5) คอร์ด 3 เสียง การเกาคอร์ด Arpeggio ประกอบการร้อง และบทเรียนโน้ตแปลงเสียง (#, b, ♮)",
         "4", "20"),
        ("2", "ปฏิบัติรวมวงคาลิมบ้าเพลงวน", "ศ 2.1 ม.2/3, 4, 6",
         "บรรเลงคาลิมบ้าคีย์ C รวมวงเพลงวนสอดประสาน (Canon) วิเคราะห์ปัจจัยการสร้างสรรค์ การจัดวางพาร์ท ซ้อมกลุ่มย่อย (Sectional Rehearsal) และแสดง Mini-Recital",
         "7", "20"),
        ("3", "รอบรู้ดนตรีข้ามวัฒนธรรมและอาชีพดนตรี", "ศ 2.1 ม.2/1, 3, 7",
         "เปรียบเทียบองค์ประกอบดนตรีข้ามวัฒนธรรม (ล้านนา/ไทย vs สากล) สำรวจสายอาชีพดนตรี ธุรกิจบันเทิง และผลิตสื่อเสียง Flipped Podcast พร้อม Jingle คาลิมบ้า",
         "4", "20"),
        ("4", "ดนตรีกับสังคมและการวิจารณ์เชิงประจักษ์", "ศ 2.1 ม.2/5, 6\nศ 2.2 ม.2/1, 2",
         "บทบาทความสัมพันธ์ของดนตรีต่อสังคม ปัจจัยการเปลี่ยนแปลงทางดนตรี วิเคราะห์อารมณ์เพลงด้วยกราฟ 2D Emotion Grid และการสร้างสรรค์เพลย์ลิสต์เพื่อสังคม",
         "3", "20"),
        ("", "กลางภาค", "-", "หน่วยที่ 1 จำนวน 5 คะแนน\nหน่วยที่ 2 จำนวน 5 คะแนน", "1", "10"),
        ("", "ปลายภาค", "-", "หน่วยที่ 3 จำนวน 5 คะแนน\nหน่วยที่ 4 จำนวน 5 คะแนน", "1", "10"),
        ("", "รวม", "", "", "20", "100"),
    ]
    for r_idx, (col0, col1, col2, col3, col4, col5) in enumerate(str_rows):
        row = t_str.add_row().cells
        for i in range(6):
            row[i].width = widths_str[i]
        is_total = (r_idx == len(str_rows) - 1)
        format_cell(row[0], col0, size=11.5, bold=is_total, align=WD_ALIGN_PARAGRAPH.CENTER)
        format_cell(row[1], col1, size=11.5, bold=is_total or (col1 in ['กลางภาค', 'ปลายภาค']), align=WD_ALIGN_PARAGRAPH.LEFT)
        format_cell(row[2], col2, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER)
        format_cell(row[3], col3, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT)
        format_cell(row[4], col4, size=11.5, bold=is_total, align=WD_ALIGN_PARAGRAPH.CENTER)
        format_cell(row[5], col5, size=11.5, bold=is_total, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="EDF2F7" if is_total else None)
    
    note_str = (
        "(ช่องมาตรฐาน/ตัวชี้วัด ให้เขียน รหัสตัวชี้วัดและคำอธิบายตัวชี้วัดนั้นๆ\n"
        "ช่องเวลา รวมแล้วต้องได้ 20, 40 หรือ 60 ชั่วโมง ตามหน่วยกิต ช่องน้ำหนักคะแนน รวมแล้วต้องได้ 100 คะแนน และเวลากับน้ำหนักคะแนนต้องสอดคล้องกัน\n"
        "หน่วยไหนใช้หลายมาตรฐานกับตัวชี้วัด ให้เพิ่มเฉพาะช่องมาตรฐานกับตัวชี้วัดเท่านั้น)"
    )
    add_p(doc, note_str, size=11, italic=True, color_rgb=RGBColor(0xC0, 0x00, 0x00), space_before=2, space_after=0)
    
    # ----- หน้าที่ 6: โครงสร้างการวัดผลประเมินผล -----
    doc.add_page_break()
    add_p(doc, "โครงสร้างการวัดผลประเมินผล", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "รายวิชา ดนตรี 2   ชื่อวิชา ดนตรี 2   ชั้นมัธยมศึกษาปีที่ 2   เวลา 20 ชั่วโมง", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "อัตราส่วนคะแนน ระหว่างภาค 80 : ปลายภาค 20", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "อัตราส่วนคะแนน K: 30   P: 50   A: 20", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    t_ev = doc.add_table(rows=2, cols=8)
    t_ev.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_ev.style = 'Table Grid'
    
    t_ev.cell(0, 0).merge(t_ev.cell(1, 0))
    format_cell(t_ev.cell(0, 0), "หน่วยการเรียนรู้", size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    t_ev.cell(0, 0).width = Cm(4.8)
    
    t_ev.cell(0, 1).merge(t_ev.cell(0, 4))
    format_cell(t_ev.cell(0, 1), "คะแนนก่อนกลางภาคและหลังกลางภาค", size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    t_ev.cell(0, 5).merge(t_ev.cell(1, 5))
    format_cell(t_ev.cell(0, 5), "คะแนน\nกลางภาค\n(K/P)", size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    t_ev.cell(0, 5).width = Cm(1.8)
    
    t_ev.cell(0, 6).merge(t_ev.cell(1, 6))
    format_cell(t_ev.cell(0, 6), "คะแนน\nปลายภาค\n(K/P)", size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    t_ev.cell(0, 6).width = Cm(1.8)
    
    t_ev.cell(0, 7).merge(t_ev.cell(1, 7))
    format_cell(t_ev.cell(0, 7), "รวม", size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    t_ev.cell(0, 7).width = Cm(1.6)
    
    sub_ev = ["", "K", "P", "A", "รวม"]
    for i in range(1, 5):
        format_cell(t_ev.cell(1, i), sub_ev[i], size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="EDF2F7")
        t_ev.cell(1, i).width = Cm(1.4)
    
    ev_data = [
        ("หน่วยการเรียนรู้ 1", "5", "10", "5", "20", "5", "-", "25"),
        ("หน่วยการเรียนรู้ 2", "5", "10", "5", "20", "5", "-", "25"),
        ("หน่วยการเรียนรู้ 3", "8", "7", "5", "20", "-", "5", "25"),
        ("หน่วยการเรียนรู้ 4", "8", "7", "5", "20", "-", "5", "25"),
        ("รวม", "26", "34", "20", "80", "10", "10", "100"),
    ]
    for r_idx, row_vals in enumerate(ev_data):
        row = t_ev.add_row().cells
        is_tot = (r_idx == len(ev_data) - 1)
        for c_idx, val in enumerate(row_vals):
            al = WD_ALIGN_PARAGRAPH.LEFT if (c_idx == 0 and not is_tot) else WD_ALIGN_PARAGRAPH.CENTER
            bg = "EDF2F7" if is_tot else None
            format_cell(row[c_idx], val, size=12, bold=is_tot, align=al, bg_hex=bg, space_before=1, space_after=1)
    
    row_sub = t_ev.add_row().cells
    for i in range(1, 6):
        row_sub[0].merge(row_sub[i])
    format_cell(row_sub[0], "รวมระหว่างภาค = 80", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="E2E8F0")
    format_cell(row_sub[6], "ปลายภาค = 20", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="E2E8F0")
    format_cell(row_sub[7], "100", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="E2E8F0")
    
    notes_ev = (
        "- อัตราส่วนคะแนนระหว่างภาค : ปลายภาค เช่น 80 : 20 รวมกันแล้วได้ 100 คะแนน\n"
        "  ตามระเบียบการวัดและประเมินผลของโรงเรียน กำหนดให้ ทุกรายวิชาต้องใช้ปลายภาค 20 คะแนน\n"
        "- อัตราส่วนคะแนน K : 30   P : 50   A : 20   รวมกันแล้วต้องได้ 100 คะแนน\n"
        "- ถ้ากลางภาคหรือปลายภาค มีการประเมิน P ด้วย ให้เพิ่มคอลัมน์ในช่องนั้น\n"
        "- ตามระเบียบการวัดและประเมินผลของโรงเรียน กำหนดให้ คะแนนคุณลักษณะอันพึงประสงค์ (A) มีน้ำหนักคะแนน 20 คะแนน"
    )
    add_p(doc, notes_ev, size=11, italic=True, color_rgb=RGBColor(0xC0, 0x00, 0x00), space_before=3, space_after=0)
    
    out_docx = os.path.join(TARGET_DIR, "02_วก3_โครงสร้างรายวิชา_ศ22102_ดนตรี2.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 3. หน่วยการเรียนรู้ตามหลักสูตรรายวิชา (วก.4) - ฟิตพอดี 4 หน้า 100%
# ==============================================================================
def build_wk4_doc():
    doc = setup_base_doc(orientation='portrait')
    
    # ----- หน้าที่ 1 -----
    add_wk_badge(doc, "วก.4")
    add_p(doc, "หน่วยการเรียนรู้ที่ 2", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "ชื่อหน่วย ปฏิบัติรวมวงคาลิมบ้าเพลงวน   รหัสวิชา ศ22102   ชื่อรายวิชา ดนตรี 2", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ชั้นมัธยมศึกษาปีที่ 2   ภาคเรียนที่ 2   เวลา 7 ชั่วโมง", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "กลุ่มสาระการเรียนรู้ ศิลปะ   โรงเรียนพะเยาพิทยาคม", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    p_line = doc.add_paragraph()
    p_line.paragraph_format.space_before = Pt(0)
    p_line.paragraph_format.space_after = Pt(4)
    pPr = p_line._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '000000')
    pBdr.append(bottom)
    pPr.append(pBdr)
    
    add_p(doc, "1. มาตรฐานการเรียนรู้/ตัวชี้วัด/ผลการเรียนรู้", size=15, bold=True, space_before=1, space_after=1)
    add_p(doc, "มาตรฐานการเรียนรู้", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        มาตรฐาน ศ 2.1 เข้าใจและแสดงออกทางดนตรีอย่างสร้างสรรค์ วิเคราะห์ วิพากษ์วิจารณ์คุณค่าดนตรี ถ่ายทอดความรู้สึก ความคิดต่อดนตรีอย่างอิสระ ชื่นชม และประยุกต์ใช้ในชีวิตประจำวัน", size=14, space_before=0, space_after=2, line_spacing=1.03)
    
    add_p(doc, "ตัวชี้วัด", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        ศ 2.1 ม.2/3 ระบุปัจจัยสำคัญที่มีอิทธิพลต่อการสร้างสรรค์งานดนตรี", size=14, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.2/4 ร้องเพลงและเล่นดนตรีเดี่ยวและรวมวง", size=14, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.2/6 ประเมินพัฒนาการทักษะทางดนตรีของตนเองหลังจากการฝึกปฏิบัติ", size=14, space_before=0, space_after=4)
    
    add_p(doc, "2. สาระสำคัญ/ความคิดรวบยอด", size=15, bold=True, space_before=2, space_after=1)
    u2_core = (
        "        การบรรเลงคาลิมบ้า (คีย์ C Major) และขับร้องรวมวงรูปแบบเพลงวนสอดประสาน (Canon / Round) "
        "การวิเคราะห์ปัจจัยสำคัญที่มีอิทธิพลต่อการสร้างสรรค์งานดนตรีเพื่อออกแบบผังการเรียบเรียงเพลงรวมวง 3 พาร์ท "
        "(Melody Canon + Arpeggio Chords + Rhythm) ผ่านกระบวนการฝึกซ้อมกลุ่มย่อย (Sectional Rehearsal: การวางตำแหน่ง "
        "การฟังจุดเข้าเพลง และสมดุลเสียง Dynamic Balancing) และการแสดง Chamber Mini-Recital "
        "พร้อมทั้งประเมินพัฒนาการทักษะดนตรีของตนเองหลังการฝึกปฏิบัติได้อย่างเป็นระบบ"
    )
    add_p(doc, u2_core, size=14, space_before=0, space_after=4, line_spacing=1.03)
    
    add_p(doc, "3. สาระการเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "3.1 สาระการเรียนรู้แกนกลาง", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        3.1.1 ธรรมชาติของเพลงวน (Round / Canon) และการบรรเลงสอดประสาน (Polyphonic Interlocking) ในคีย์ C Major", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.2 ปัจจัยที่มีอิทธิพลต่อการสร้างสรรค์งานดนตรีและการออกแบบผังการเรียบเรียงเพลงรวมวง 3 พาร์ท", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.3 การฝึกซ้อมรวมวงกลุ่มย่อยตามพาร์ท (Sectional Rehearsal: จุดเข้าเพลง และสมดุลเสียง Dynamic Balancing)", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.4 การแสดงดนตรีรวมวง Chamber Mini-Recital และการประเมินพัฒนาการทักษะดนตรีตนเองและเพื่อน", size=14, space_before=0, space_after=2)
    
    add_p(doc, "3.2 สาระการเรียนรู้ท้องถิ่น (ถ้ามี)", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        3.2.1 การประยุกต์ใช้โครงสร้างทำนองวนแบบดนตรีพื้นบ้านล้านนาร่วมกับการบรรเลงคาลิมบ้าสมัยใหม่", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.2.2 การบูรณาการบริบทศิลปวัฒนธรรมเมืองพะเยาสู่การสร้างสรรค์ผลงานดนตรีรวมวง", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 2 -----
    doc.add_page_break()
    add_p(doc, "4. สมรรถนะสำคัญของผู้เรียน", size=15, bold=True, space_before=1, space_after=1)
    add_p(doc, "        4.1 ความสามารถในการสื่อสาร (การสื่อสารส่งสัญญาณทางดนตรีและการให้ข้อเสนอแนะเพื่อน)", size=14, space_before=0, space_after=1)
    add_p(doc, "        4.2 ความสามารถในการคิด (การคิดวิเคราะห์ปัจจัยการสร้างสรรค์และการประเมินสุนทรียภาพ)", size=14, space_before=0, space_after=1)
    add_p(doc, "        4.3 ความสามารถในการแก้ปัญหา (การแก้ปัญหาเทคนิคเสียงเหลื่อมและจังหวะหลุดในการรวมวง)", size=14, space_before=0, space_after=1)
    add_p(doc, "        4.4 ความสามารถในการใช้ทักษะชีวิต (การทำงานร่วมกันเป็นทีมในบทบาทนักดนตรีรวมวง)", size=14, space_before=0, space_after=1)
    add_p(doc, "        4.5 ความสามารถในการใช้เทคโนโลยี (การใช้แอปพลิเคชัน MusicSmart บันทึกและวิเคราะห์เสียง)", size=14, space_before=0, space_after=4)
    
    add_p(doc, "5. คุณลักษณะอันพึงประสงค์", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        5.1 ซื่อสัตย์สุจริต (การประเมินผลตามสภาพจริง)", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.2 มีวินัย (การตรงต่อเวลาและการควบคุมความเงียบตามสัญญาณ Cut-off)", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.3 ใฝ่เรียนรู้ (การฝึกซ้อมเพื่อพัฒนาตนเองสู่ระดับ Gold)", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.4 มุ่งมั่นในการทำงาน (ความพยายามบรรเลงเพลงวนให้ประสานลงตัว)", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.5 มีจิตสาธารณะ (การแบ่งปันเครื่องดนตรีและดูแลรักษาทรัพย์สินส่วนรวม)", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.6 ปฏิบัติตนตามหลักปรัชญาของเศรษฐกิจพอเพียงและหลักวิถีพุทธ", size=14, space_before=0, space_after=4)
    
    add_p(doc, "6. ชิ้นงาน/ภาระงาน", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "6.1 ชิ้นงาน/ภาระงานระหว่างจัดกิจกรรมการเรียนรู้", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        6.1.1 แผนผังการจัดวางพาร์ทและคิวเข้าเพลงรวมวงคาลิมบ้า (Arrangement Score Sheet)", size=14, space_before=0, space_after=1)
    add_p(doc, "        6.1.2 แบบบันทึกการฝึกซ้อม Sectional Rehearsal Log และ Dynamic Balancing Checklist", size=14, space_before=0, space_after=1)
    add_p(doc, "        6.1.3 วิดีโอบันทึกการซ้อมย่อยรอบ Slow-Tempo 60 BPM และ Fast-Tempo 75 BPM", size=14, space_before=0, space_after=2)
    
    add_p(doc, "6.2 ชิ้นงาน/ภาระงานรวบยอด", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        6.2.1 การแสดงสดรวมวง Chamber Mini-Recital (เพลงวนคาลิมบ้าประสานเสียงคีย์ C Major)", size=14, space_before=0, space_after=1)
    add_p(doc, "        6.2.2 รายงานการประเมินพัฒนาการทักษะดนตรีตนเองและเพื่อน (Peer Review) ผ่านระบบ MusicSmart", size=14, space_before=0, space_after=4)
    
    add_p(doc, "7. การวัดและประเมินผล", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "7.1 การวัดและประเมินผลระหว่างจัดกิจกรรมการเรียนรู้", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        7.1.1 ตรวจแบบบันทึกการจัดวางพาร์ทและคิวเข้าเพลง (ด้านความรู้ K)", size=14, space_before=0, space_after=1)
    add_p(doc, "        7.1.2 ประเมินทักษะการซ้อมย่อยและสมดุลเสียงผ่านเกณฑ์รูบริกแบบ Rubric Checklist (ด้านทักษะ P)", size=14, space_before=0, space_after=1)
    add_p(doc, "        7.1.3 สังเกตพฤติกรรมการทำงานกลุ่ม วินัย และความร่วมมือ (ด้านคุณลักษณะ A)", size=14, space_before=0, space_after=2)
    
    add_p(doc, "7.2 การวัดและประเมินผลเมื่อสิ้นสุดกิจกรรมการเรียนรู้", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        7.2.1 ประเมินการแสดงรวมวง Chamber Mini-Recital ตามเกณฑ์รูบริก 4 ระดับ (K, P, A)", size=14, space_before=0, space_after=1)
    add_p(doc, "        7.2.2 แบบทดสอบท้ายหน่วยการเรียนรู้ที่ 2 จำนวน 10 ข้อ (K)", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 3 -----
    doc.add_page_break()
    add_p(doc, "8. กิจกรรมการเรียนรู้", size=15, bold=True, space_before=1, space_after=2)
    act_desc = (
        "        การจัดกิจกรรมการเรียนรู้ใช้กระบวนการจัดการเรียนรู้เชิงรุก (Active Learning) ตามกรอบแนวคิด T-PACE Framework "
        "และวงจรการเรียนรู้ปรับเหมาะ 3 ระดับ (3-Tier Mastery Loop: Bronze-Silver-Gold) จำนวน 7 ชั่วโมง (แผนการจัดการเรียนรู้ที่ 5 - 11) ดังนี้\n"
        "        1. ขั้นกระตุ้นคิดและเทียบเสียง (Trigger & Tuning: T): ครูเปิดสื่อโสตทัศน์เพลงวนต้นแบบ กระตุ้นความสนใจด้วยคำถามท้าทาย "
        "และนำนักเรียนเทียบเสียงลิ่มคาลิมบ้าคีย์ C อย่างแม่นยำ\n"
        "        2. ขั้นฝึกฝนและสร้างความแม่นยำ (Practice & Precision: P): นักเรียนแยกซ้อมพาร์ททำนองวน (Canon 1, 2) "
        "และพาร์ทคอร์ดกระจาย (Arpeggio) ไต่ระดับความเร็วด้วยเมโทรนอมดิจิทัล 60 -> 70 -> 75 BPM\n"
        "        3. ขั้นปฏิบัติการกลุ่มและวิเคราะห์เชิงรุก (Active Collaboration / Analysis: A): ซ้อมรวมวงกลุ่มย่อย (Sectional Rehearsal) "
        "สลับบทบาทเป็นผู้บรรเลงและผู้ฟังตรวจเช็คสมดุลเสียง (Dynamic Balancing)\n"
        "        4. ขั้นท้าทายและสร้างสรรค์ (Creative Challenge: C): ออกแบบท่อนนำ (Intro) และท่อนจบ (Outro) เสริม "
        "และเตรียมเวทีสำหรับการแสดง Chamber Mini-Recital\n"
        "        5. ขั้นประเมินผลและสะท้อนคิด (Evaluation & Reflection: E): บรรเลงรวมวงจริงหน้าชั้นเรียน "
        "ประเมินผลร่วมกันผ่าน Digital Peer Review บน MusicSmart App และถอดบทเรียนพัฒนาตนเอง"
    )
    add_p(doc, act_desc, size=14, space_before=0, space_after=6, line_spacing=1.04)
    
    add_p(doc, "9. สื่อ/แหล่งการเรียนรู้", size=15, bold=True, space_before=2, space_after=2)
    add_p(doc, "        9.1 เครื่องดนตรีคาลิมบ้า 17 คีย์ (C Major) จำนวน 40 เครื่อง พร้อมค้อนจูนเสียงและผ้าเช็ดไมโครไฟเบอร์", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.2 แพลตฟอร์มดิจิทัลเพื่อการเรียนรู้ MusicSmart (ระบบเมโทรนอมดิจิทัล, Digital Scoreboard, Module 02)", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.3 โน้ตเพลงวนสอดประสาน (Canon Sheet Music) คีย์ C Major และผังการจัดวางพาร์ท", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.4 ใบกิจกรรมและแบบบันทึกการซ้อมกลุ่มย่อย (ผ05, ผ06, ผ07, ผ08, ผ09, ผ10, ผ11)", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.5 ห้องปฏิบัติการดนตรีและเวทีแสดงจำลอง Mini-Stage โรงเรียนพะเยาพิทยาคม", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 4 (Landscape Table) - ฟิตพอดี 1 หน้าแผ่นแนวนอนตามต้นฉบับเป๊ะๆ -----
    sec_land = doc.add_section(WD_SECTION.NEW_PAGE)
    sec_land.orientation = WD_ORIENT.LANDSCAPE
    sec_land.page_width = Cm(29.7)
    sec_land.page_height = Cm(21.0)
    sec_land.top_margin = Cm(1.5)
    sec_land.bottom_margin = Cm(1.5)
    sec_land.left_margin = Cm(1.5)
    sec_land.right_margin = Cm(1.5)
    # sec_land is linked to previous section by default, so it automatically inherits the footer cleanly without duplication
    
    add_p(doc, "หน่วยการเรียนรู้ที่ 2 เรื่อง ปฏิบัติรวมวงคาลิมบ้าเพลงวน", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "แผนการจัดการเรียนรู้ที่ 2 (แผนที่ 6) เรื่อง การจัดวางพาร์ทและคิวเข้าเพลงรวมวง เวลา 1 ชั่วโมง", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    t_plans = doc.add_table(rows=2, cols=7)
    t_plans.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_plans.style = 'Table Grid'
    h_plans = [
        "จุดประสงค์\nการเรียนรู้", "ชิ้นงาน/\nภาระงาน", "วิธีสอนและกิจกรรม",
        "กลวิธีการสอน", "สื่อ/แหล่งเรียนรู้", "วิธีวัดประเมินผล", "เครื่องมือวัดประเมินผล"
    ]
    w_plans = [Cm(4.0), Cm(3.2), Cm(6.5), Cm(3.2), Cm(3.2), Cm(3.1), Cm(3.5)]
    for i, h in enumerate(h_plans):
        cell = t_plans.rows[0].cells[i]
        cell.width = w_plans[i]
        format_cell(cell, h, size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2", space_before=2, space_after=2)
    
    # Row 1: Single representative lesson plan matching template layout perfectly!
    r1 = t_plans.rows[1].cells
    for i in range(7):
        r1[i].width = w_plans[i]
    
    c_kpa = (
        "K : วิเคราะห์ปัจจัยสำคัญที่มีอิทธิพลต่อการสร้างสรรค์และจัดวางพาร์ทเพลงวนได้ถูกต้อง\n\n"
        "P : ออกแบบผังการเรียบเรียงเพลงรวมวง 3 พาร์ท และส่งสัญญาณคิวเข้าเพลงได้แม่นยำ\n\n"
        "A : แสดงความรับผิดชอบในการทำงานกลุ่ม ยอมรับฟังความคิดเห็นของเพื่อนร่วมวง"
    )
    c_task = (
        "ผังการจัดวางพาร์ทและคิวเข้าเพลงรวมวงคาลิมบ้า 3 พาร์ท (ผ06)\n\n"
        "บันทึกการทดลองส่งสัญญาณคิวเข้าเพลงร่วมกับกลุ่ม"
    )
    c_act = (
        "ขั้นนำ\n"
        "ชมคลิปการแสดงดนตรีรวมวงเปรียบเทียบวงที่เข้าเพลงพร้อมเพรียงกับวงที่จังหวะเหลื่อม\n\n"
        "ขั้นสอน\n"
        "1. ครูอธิบายการจัดวางบทบาท 3 พาร์ท (Canon นำ, Canon ตาม, Chords)\n"
        "2. นักเรียนแบ่งกลุ่มย่อย 5-6 คน ออกแบบผังคิวเข้าเพลงลงในใบงาน ผ06\n"
        "3. ฝึกซ้อมส่งสัญญาณนับเคาะเข้าเพลงและจับคู่พาร์ทร่วมกัน\n\n"
        "ขั้นสรุป\n"
        "แต่ละกลุ่มนำเสนอผังคิวเข้าเพลงหน้าชั้นเรียน ครูและเพื่อนให้ข้อเสนอแนะ"
    )
    c_strat = (
        "การจัดการเรียนรู้เชิงรุก (Active Learning)\n\n"
        "T-PACE Framework (Mode B)\n\n"
        "กระบวนการกลุ่มร่วมมือ (Collaborative Learning)"
    )
    c_media = (
        "1. คาลิมบ้า 17 คีย์ (C Major)\n\n"
        "2. MusicSmart App Module 02\n\n"
        "3. ตัวอย่างโน้ตเพลงวน 3 พาร์ท\n\n"
        "4. ใบกิจกรรม ผ06"
    )
    c_eval = (
        "1. ตรวจความถูกต้องของผังคิวเข้าเพลงในใบกิจกรรม ผ06 (K)\n\n"
        "2. ประเมินทักษะการออกแบบและส่งสัญญาณคิวเข้าเพลง (P)\n\n"
        "3. สังเกตการมีส่วนร่วมและความรับผิดชอบในกลุ่ม (A)"
    )
    c_tool = (
        "1. แบบตรวจใบกิจกรรม ผ06\n\n"
        "2. แบบประเมินทักษะการจัดวางบทบาทดนตรีรวมวง\n\n"
        "3. แบบสังเกตพฤติกรรมการทำงานกลุ่ม"
    )
    
    format_cell(r1[0], c_kpa, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[1], c_task, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[2], c_act, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[3], c_strat, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[4], c_media, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[5], c_eval, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[6], c_tool, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    
    out_docx = os.path.join(TARGET_DIR, "03_วก4_หน่วยการเรียนรู้ที่_2_ปฏิบัติรวมวงคาลิมบ้าเพลงวน.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 4. แผนการจัดการเรียนรู้รายชั่วโมง (วก.5) - ฟิตพอดี 4 หน้า 100%
# ==============================================================================
def build_wk5_doc():
    doc = setup_base_doc(orientation='portrait')
    sec = doc.sections[0]
    sec.top_margin = Cm(1.0)
    sec.bottom_margin = Cm(1.0)
    sec.left_margin = Cm(2.0)
    sec.right_margin = Cm(2.0)
    
    # ----- หน้าที่ 1 -----
    add_wk_badge(doc, "วก.5")
    add_p(doc, "แผนการจัดการเรียนรู้ที่ 2", size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "กลุ่มสาระการเรียนรู้ ศิลปะ   ระดับมัธยมศึกษาตอนต้น   โรงเรียนพะเยาพิทยาคม", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "รายวิชา ดนตรี 2   รหัสวิชา ศ22102   ชั้นมัธยมศึกษาปีที่ 2", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ภาคเรียนที่ 2   ปีการศึกษา 2569   หน่วยการเรียนรู้ที่ 1", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "เรื่อง บทเรียนเครื่องหมายแปลงเสียงและการย้ายคีย์เพลงสู่คีย์ C   เวลา 1 ชั่วโมง", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "สอนวันที่........ เดือน........................... พ.ศ. ............   ผู้สอน นายพงศธร โพธิแก้ว", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    
    p_line = doc.add_paragraph()
    p_line.paragraph_format.space_before = Pt(0)
    p_line.paragraph_format.space_after = Pt(2)
    pPr = p_line._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '000000')
    pBdr.append(bottom)
    pPr.append(pBdr)
    
    add_p(doc, "มาตรฐานการเรียนรู้และตัวชี้วัด", size=14, bold=True, space_before=1, space_after=1)
    add_p(doc, "        มาตรฐาน ศ 2.1 เข้าใจและแสดงออกทางดนตรีอย่างสร้างสรรค์ วิเคราะห์ วิพากษ์วิจารณ์คุณค่าดนตรี ถ่ายทอดความรู้สึก ความคิดต่อดนตรีอย่างอิสระ ชื่นชม และประยุกต์ใช้ในชีวิตประจำวัน", size=13, space_before=0, space_after=1, line_spacing=1.0)
    add_p(doc, "        ศ 2.1 ม.2/2 อ่าน เขียน ร้องโน้ตไทยและโน้ตสากลที่มีเครื่องหมายแปลงเสียง", size=13, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.2/6 ประเมินพัฒนาการทักษะทางดนตรีของตนเองหลังจากการฝึกปฏิบัติ", size=13, space_before=0, space_after=2)
    
    add_p(doc, "สาระสำคัญ", size=14, bold=True, space_before=1, space_after=1)
    core_w5 = (
        "        เครื่องหมายแปลงเสียง (Accidentals: ชาร์ป #, แฟลต b, เนเจอรัล ♮) เป็นสัญลักษณ์สากลที่กำหนดการเปลี่ยนระดับเสียงของตัวโน้ตขึ้นหรือลงทีละครั้งละครึ่งเสียง "
        "(Semitone) ซึ่งมีความสำคัญต่อการอ่าน เขียน และขับร้องบทเพลงอย่างถูกต้อง เมื่อนำมาประยุกต์ใช้กับเครื่องดนตรีคาลิมบ้ามาตรฐานที่มีคีย์เสียง C Major ตามธรรมชาติ "
        "การย้ายคีย์เพลง (Transposition) จึงเป็นทักษะสำคัญที่ช่วยให้นักเรียนสามารถปรับเปลี่ยนบทเพลงที่มีเครื่องหมายแปลงเสียงให้อยู่ในคีย์ที่สามารถบรรเลงได้จริง โดยไม่สูญเสียโครงสร้างทำนองเดิม"
    )
    add_p(doc, core_w5, size=13, space_before=0, space_after=2, line_spacing=1.0)
    
    add_p(doc, "สาระการเรียนรู้", size=14, bold=True, space_before=1, space_after=1)
    add_p(doc, "        1. ความหมายและสัญลักษณ์ของเครื่องหมายแปลงเสียง: ชาร์ป (Sharp #), แฟลต (Flat b), และเนเจอรัล (Natural ♮) ในโน้ตสากลและโน้ตไทย", size=13, space_before=0, space_after=1)
    add_p(doc, "        2. การอ่าน เขียน และร้องเทียบระดับเสียงครึ่งขั้น (Semitone) บนผังลิ่มคีย์บอร์ดจำลอง", size=13, space_before=0, space_after=1)
    add_p(doc, "        3. หลักการย้ายคีย์เพลง (Transposition) จากคีย์ที่มีเครื่องหมายแปลงเสียงให้กลับมาอยู่ในคีย์ C Major เพื่อบรรเลงบนคาลิมบ้า", size=13, space_before=0, space_after=2)
    
    add_p(doc, "จุดประสงค์การเรียนรู้", size=14, bold=True, space_before=1, space_after=1)
    add_p(doc, "1. ด้านความรู้", size=13.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        1.1 อธิบายความหมายและหน้าที่ของเครื่องหมายแปลงเสียง (Sharp #, Flat b, Natural ♮) ในโน้ตสากลและโน้ตไทย รวมถึงหลักการย้ายคีย์เพลงสู่คีย์ C Major ได้อย่างถูกต้อง", size=13, space_before=0, space_after=1)
    add_p(doc, "2. ด้านทักษะกระบวนการ", size=13.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        2.1 อ่าน เขียน ร้องโน้ตที่มีเครื่องหมายแปลงเสียงผ่านผังลิ่มคีย์บอร์ดจำลอง และทำชิ้นงานถอดรหัสย้ายคีย์เพลงที่มี #/b ให้เป็นโน้ตคีย์ C Major สำหรับคาลิมบ้าได้ถูกต้อง", size=13, space_before=0, space_after=1)
    add_p(doc, "3. ด้านคุณลักษณะอันพึงประสงค์", size=13.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        3.1 มีความใฝ่เรียนรู้และมุ่งมั่นในการแก้โจทย์ถอดรหัสโน้ตดนตรีร่วมกับคู่บัดดี้ด้วยความรอบคอบ ปฏิบัติตนตามหลักปรัชญาของเศรษฐกิจพอเพียงและหลักวิถีพุทธ", size=13, space_before=0, space_after=2)
    
    add_p(doc, "สมรรถนะสำคัญของผู้เรียน", size=13.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        1.1 ความสามารถในการสื่อสาร: การอ่าน เขียน ร้องโน้ตสัญลักษณ์ดนตรีสากลและโน้ตไทย", size=13, space_before=0, space_after=1)
    add_p(doc, "        1.2 ความสามารถในการคิดและการแก้ปัญหา: การคำนวณขั้นคู่เสียงและการย้ายคีย์เพลงสู่คีย์ C", size=13, space_before=0, space_after=0)
    
    # ----- หน้าที่ 2 -----
    doc.add_page_break()
    add_p(doc, "ชิ้นงาน/ภาระงาน", size=15, bold=True, space_before=1, space_after=1)
    add_p(doc, "        ใบงานบทเรียนเครื่องหมายแปลงเสียง (#, b, ♮) และการย้ายคีย์เพลงสู่คีย์ C Major (ผ02) พร้อมแบบบันทึกการประเมินคู่บัดดี้ (Buddy Peer Check)", size=14, space_before=0, space_after=4)
    
    add_p(doc, "กิจกรรมการเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "ขั้นนำเข้าสู่บทเรียน (10 นาที)", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        1. ครูเล่นโน้ต F และ F# บนเปียโนหรือเปิดแอปเปรียบเทียบเสียง ให้นักเรียนฟังความแตกต่างของระดับเสียงครึ่งขั้น และตั้งประเด็นคำถาม: 'ถ้านักเรียนมีคาลิมบ้าที่ไม่มีลิ่มดำ แล้วต้องการเล่นเพลงที่มีโน้ต F# เราจะแก้ปัญหานี้อย่างไร?'", size=14, space_before=0, space_after=2, line_spacing=1.03)
    add_p(doc, "        2. ครูนำเสนอผังลิ่มคีย์บอร์ดเปรียบเทียบกับลิ่มคาลิมบ้า 17 คีย์ และแนะนำเครื่องหมายแปลงเสียง 3 ชนิด: Sharp (#), Flat (b), Natural (♮)", size=14, space_before=0, space_after=3)
    
    add_p(doc, "ขั้นสอน (30 นาที)", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        3. ครูอธิบายและสาธิตการอ่าน เขียน ร้องโน้ตที่มีเครื่องหมายแปลงเสียง โดยใช้ผังภาพลิ่มเปียโนและ Solfege (โด เร มี ฟา ซอล ลา ที โด)", size=14, space_before=0, space_after=2)
    add_p(doc, "        4. นักเรียนจับคู่บัดดี้ (Learning Buddy) ศึกษาใบความรู้และฝึกทำใบงานถอดรหัสเครื่องหมายแปลงเสียง (ผ02) โดยใช้หลักการย้ายคีย์เพลง (Transposition) ปรับโน้ตเพลงจากคีย์ G Major (มี F#) และคีย์ F Major (มี Bb) ลงมาเป็นบันไดเสียง C Major", size=14, space_before=0, space_after=2, line_spacing=1.03)
    add_p(doc, "        5. นักเรียนสลับบทบาทกันร้องโน้ตและดีดตรวจสอบเสียงบนคาลิมบ้าคีย์ C โดยคู่บัดดี้ช่วยฟังความถูกต้องของระดับเสียงและจังหวะตามเกณฑ์ 3-Tier Mastery Loop", size=14, space_before=0, space_after=3)
    
    add_p(doc, "ขั้นสรุปบทเรียน (10 นาที)", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        6. ครูและนักเรียนร่วมกันสรุปหลักการสำคัญ: เครื่องหมายแปลงเสียงทำให้ระดับเสียงเปลี่ยนไป แต่เราสามารถถ่ายทอดอารมณ์เพลงเดิมได้ด้วยการย้ายคีย์เพลงมาสู่คีย์ C Major เพื่อบรรเลงบนคาลิมบ้าได้อย่างสมบูรณ์", size=14, space_before=0, space_after=2, line_spacing=1.03)
    add_p(doc, "        7. นักเรียนส่งใบงาน ผ02 และบันทึกคะแนนประเมินตนเองลงในแอปพลิเคชัน MusicSmart", size=14, space_before=0, space_after=4)
    
    add_p(doc, "สื่อ / แหล่งเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        1. แพลตฟอร์มดิจิทัลเพื่อการเรียนรู้ MusicSmart (โมดูลบทเรียนเครื่องหมายแปลงเสียงและผังคีย์บอร์ดจำลอง)", size=14, space_before=0, space_after=1)
    add_p(doc, "        2. เครื่องดนตรีคาลิมบ้า 17 คีย์ (C Major) พร้อมค้อนจูนเสียงและผ้าเช็ดไมโครไฟเบอร์", size=14, space_before=0, space_after=1)
    add_p(doc, "        3. ใบงานกิจกรรม ผ02: ถอดรหัสเครื่องหมายแปลงเสียงและการย้ายคีย์เพลงสู่คีย์ C Major", size=14, space_before=0, space_after=4)
    
    add_p(doc, "การวัดและประเมินผล", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        1. ด้านความรู้: ตรวจความถูกต้องของใบงานถอดรหัสเครื่องหมายแปลงเสียง (ผ02)", size=14, space_before=0, space_after=1)
    add_p(doc, "        2. ด้านทักษะกระบวนการ: ประเมินการอ่าน เขียน ร้องโน้ต และทักษะการย้ายคีย์เพลง", size=14, space_before=0, space_after=1)
    add_p(doc, "        3. ด้านคุณลักษณะอันพึงประสงค์: สังเกตพฤติกรรมความมุ่งมั่น ใฝ่เรียนรู้ และการมีวินัยในการทำงานกลุ่มบัดดี้", size=14, space_before=0, space_after=4)
    
    add_p(doc, "เครื่องมือวัด", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        1. แบบตรวจใบงานถอดรหัสเครื่องหมายแปลงเสียงและย้ายคีย์เพลง (ผ02)", size=14, space_before=0, space_after=1)
    add_p(doc, "        2. แบบประเมินทักษะดนตรีและรูบริกการอ่าน เขียน ร้องโน้ต (Rubric Scale 1-4)", size=14, space_before=0, space_after=1)
    add_p(doc, "        3. แบบสังเกตพฤติกรรมคุณลักษณะอันพึงประสงค์", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 3: เกณฑ์การประเมิน -----
    doc.add_page_break()
    add_p(doc, "เกณฑ์การประเมิน", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=4)
    
    t_rub = doc.add_table(rows=1, cols=6)
    t_rub.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_rub.style = 'Table Grid'
    h_rub = ["ประเด็นการประเมิน", "น้ำหนัก\nคะแนน", "ระดับคุณภาพ\n4", "ระดับคุณภาพ\n3", "ระดับคุณภาพ\n2", "ระดับคุณภาพ\n1"]
    w_rub = [Cm(5.0), Cm(1.6), Cm(2.6), Cm(2.6), Cm(2.6), Cm(2.6)]
    for i, h in enumerate(h_rub):
        cell = t_rub.rows[0].cells[i]
        cell.width = w_rub[i]
        format_cell(cell, h, size=12.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    rub_data = [
        ("1. ด้านความรู้ (K)\nความเข้าใจเครื่องหมายแปลงเสียงและการย้ายคีย์",
         "1",
         "อธิบายความหมาย ชนิด (#, b, ♮) และหลักการย้ายคีย์สู่คีย์ C ได้ถูกต้องสมบูรณ์ 100%",
         "อธิบายความหมายและหลักการย้ายคีย์เพลงสู่คีย์ C ได้ถูกต้องเป็นส่วนใหญ่ (80-99%)",
         "อธิบายความหมายและหลักการย้ายคีย์ได้บางส่วน มีข้อผิดพลาดเล็กน้อย (60-79%)",
         "ไม่สามารถอธิบายได้ หรือเข้าใจคลาดเคลื่อน ต้องได้รับคำแนะนำช่วยเหลือ (<60%)"),
        ("2. ด้านทักษะ (P)\nการอ่าน เขียน ร้องโน้ต และถอดรหัสเพลง",
         "2",
         "อ่าน เขียน ร้องโน้ตแปลงเสียง และถอดรหัสย้ายคีย์สู่คีย์ C ในใบงาน ผ02 ถูกต้องแม่นยำครบถ้วน",
         "อ่าน เขียน ร้องโน้ต และถอดรหัสย้ายคีย์ได้ถูกต้อง มีข้อผิดพลาดไม่เกิน 1 จุด",
         "อ่าน เขียน ร้องโน้ต และถอดรหัสย้ายคีย์ได้พอใช้ มีข้อผิดพลาด 2-3 จุด แต่แก้ไขได้",
         "ไม่สามารถถอดรหัสหรือย้ายคีย์เพลงได้ มีข้อผิดพลาดเกินกึ่งหนึ่ง"),
        ("3. ด้านคุณลักษณะ (A)\nความใฝ่เรียนรู้ วินัย และมุ่งมั่นทำงาน",
         "1",
         "ตั้งใจเรียนรู้ ซักถาม ร่วมมือกับคู่บัดดี้อย่างกระตือรือร้น และส่งงานตรงเวลาเรียบร้อย",
         "ให้ความร่วมมือในการทำงานกลุ่ม ปฏิบัติกิจกรรมตามขั้นตอน และส่งงานตรงเวลา",
         "ร่วมทำกิจกรรมเมื่อครูเตือน ขาดความรอบคอบในบางขั้นตอน ส่งงานช้าเล็กน้อย",
         "ไม่ให้ความร่วมมือ ไม่ตั้งใจทำกิจกรรม และไม่ส่งงานตามเวลาที่กำหนด"),
    ]
    for row_vals in rub_data:
        row = t_rub.add_row().cells
        for i in range(6):
            row[i].width = w_rub[i]
            al = WD_ALIGN_PARAGRAPH.LEFT if i != 1 else WD_ALIGN_PARAGRAPH.CENTER
            format_cell(row[i], row_vals[i], size=11, bold=False, align=al, space_before=1, space_after=1)
    
    add_p(doc, "เกณฑ์การตัดสิน", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=6, space_after=1)
    add_p(doc, "ระดับ 4  หมายถึง  มีระดับคุณภาพดีเยี่ยม", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ระดับ 3  หมายถึง  มีระดับคุณภาพดี", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ระดับ 2  หมายถึง  มีระดับคุณภาพพอใช้", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ระดับ 1  หมายถึง  มีระดับคุณภาพปรับปรุง", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    add_p(doc, "เกณฑ์การผ่าน    ได้ระดับ 3 ขึ้นไป ร้อยละ 60 ถือว่าประสบผลสำเร็จในการสอน", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=0)
    
    # ----- หน้าที่ 4: บันทึกผลหลังการสอน -----
    doc.add_page_break()
    add_p(doc, "บันทึกผลหลังการสอน แผนการจัดการเรียนรู้ที่ 2", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "รายวิชา ดนตรี 2   รหัส ศ22102   ชั้นมัธยมศึกษาปีที่ 2   ภาคเรียนที่ 2   ปีการศึกษา 2569", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "เรื่อง บทเรียนเครื่องหมายแปลงเสียงและการย้ายคีย์เพลงสู่คีย์ C   เวลา 1 ชั่วโมง", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    add_p(doc, "ผลการเรียนรู้ของนักเรียน", size=15, bold=True, space_before=2, space_after=1)
    for _ in range(4):
        add_p(doc, "." * 115, size=13, space_before=0, space_after=1)
    
    add_p(doc, "ปัญหาที่เกิดขึ้นในระหว่างการจัดการเรียนรู้", size=15, bold=True, space_before=4, space_after=1)
    for _ in range(4):
        add_p(doc, "." * 115, size=13, space_before=0, space_after=1)
    
    add_p(doc, "แนวทางการแก้ปัญหาหรือปรับปรุงแผนการจัดการเรียนรู้ครั้งต่อไป (Action plan)", size=15, bold=True, space_before=4, space_after=1)
    for _ in range(4):
        add_p(doc, "." * 115, size=13, space_before=0, space_after=1)
    
    add_p(doc, "ลงชื่อ ....................................................... ครูผู้สอน", size=14.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=4, space_after=1)
    add_p(doc, "(นายพงศธร โพธิแก้ว)", size=14.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=0, space_after=1)
    add_p(doc, "ตำแหน่ง ครู", size=13.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=0, space_after=1)
    add_p(doc, "............/............../..............", size=13.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=0, space_after=4)
    
    add_p(doc, "ความคิดเห็นของฝ่ายบริหาร", size=15, bold=True, space_before=2, space_after=1)
    for _ in range(2):
        add_p(doc, "." * 115, size=13, space_before=0, space_after=1)
    
    add_p(doc, "ลงชื่อ .......................................................", size=14.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=4, space_after=1)
    add_p(doc, "(.......................................................)", size=14.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=0, space_after=1)
    add_p(doc, "............/............../..............", size=13.5, align=WD_ALIGN_PARAGRAPH.RIGHT, space_before=0, space_after=0)
    
    out_docx = os.path.join(TARGET_DIR, "04_วก5_แผนการจัดการเรียนรู้_แผนที่_02.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 5. แปลง DOCX เป็น PDF
# ==============================================================================
def convert_docx_to_pdf(docx_path, pdf_path):
    word = win32com.client.Dispatch('Word.Application')
    word.Visible = False
    try:
        in_p = os.path.abspath(docx_path)
        out_p = os.path.abspath(pdf_path)
        doc = word.Documents.Open(in_p)
        doc.SaveAs(out_p, FileFormat=17) # 17 = wdFormatPDF
        doc.Close()
        print(f"Successfully converted to PDF: {pdf_path}")
    except Exception as e:
        print(f"Error converting {docx_path} to PDF: {e}")
    finally:
        word.Quit()

def main():
    print("=== เริ่มการสร้างเอกสารวิชาการ 2/2569 (เวอร์ชันปรับแต่งระยะหน้า 100%) ===")
    
    # 1. หน้าปกรวม (1 หน้า)
    print("\n1. กำลังสร้าง หน้าปกรวม...")
    cover_docx = build_cover_doc()
    cover_pdf = os.path.join(TARGET_DIR, "01_ไฟล์หน้าปกรวม_ส่งงานวิชาการ_2_2569_ศ22102_ดนตรี2.pdf")
    convert_docx_to_pdf(cover_docx, cover_pdf)
    if os.path.exists(cover_docx):
        os.remove(cover_docx)
        print("ลบไฟล์ .docx หน้าปกรวม คงเหลือเฉพาะไฟล์ .pdf ตามข้อกำหนดเรียบร้อย")
    
    # 2. วก.3 (6 หน้า)
    print("\n2. กำลังสร้าง โครงสร้างหลักสูตรรายวิชา (วก.3)...")
    wk3_docx = build_wk3_doc()
    wk3_pdf = os.path.join(TARGET_DIR, "02_วก3_โครงสร้างรายวิชา_ศ22102_ดนตรี2.pdf")
    convert_docx_to_pdf(wk3_docx, wk3_pdf)
    
    # 3. วก.4 (4 หน้า)
    print("\n3. กำลังสร้าง หน่วยการเรียนรู้ตามหลักสูตรรายวิชา (วก.4 หน่วยที่ 2)...")
    wk4_docx = build_wk4_doc()
    wk4_pdf = os.path.join(TARGET_DIR, "03_วก4_หน่วยการเรียนรู้ที่_2_ปฏิบัติรวมวงคาลิมบ้าเพลงวน.pdf")
    convert_docx_to_pdf(wk4_docx, wk4_pdf)
    
    # 4. วก.5 (4 หน้า)
    print("\n4. กำลังสร้าง แผนการจัดการเรียนรู้รายชั่วโมง (วก.5 แผนที่ 02)...")
    wk5_docx = build_wk5_doc()
    wk5_pdf = os.path.join(TARGET_DIR, "04_วก5_แผนการจัดการเรียนรู้_แผนที่_02.pdf")
    convert_docx_to_pdf(wk5_docx, wk5_pdf)
    if os.path.exists(wk5_docx):
        os.remove(wk5_docx)
        print("ลบไฟล์ .docx วก.5 คงเหลือเฉพาะไฟล์ .pdf ตามข้อกำหนดเรียบร้อย")

    print("\n=== การสร้างเอกสารและแปลงไฟล์ PDF เสร็จสมบูรณ์ทุกรายการ! ===")

if __name__ == '__main__':
    main()
