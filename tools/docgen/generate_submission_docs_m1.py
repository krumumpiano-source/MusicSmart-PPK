"""
สร้างและจัดเตรียมเอกสารส่งวิชาการ 2/2569 โรงเรียนพะเยาพิทยาคม สำหรับชั้น ม.1 (ศ21101 ดนตรี 1)
ตรงตามตัวอย่างแบบฟอร์ม วก.3, วก.4, วก.5 และหน้าปกรวม 100%
- ฟอนต์: TH Sarabun New
- สัดส่วนตาราง เส้นขอบ และหัวกระดาษ/ท้ายกระดาษ พร้อมตราโรงเรียน picppk04
- จำนวนหน้าตรงตามต้นฉบับเป๊ะๆ:
  1. หน้าปกรวม (Cover): 1 หน้า (PDF)
  2. วก.3 (โครงสร้างรายวิชา): 6 หน้า (Word + PDF)
  3. วก.4 (หน่วยการเรียนรู้ที่ 2): 4 หน้า (Word + PDF) [หน้า 1-3 Portrait, หน้า 4 Landscape]
  4. วก.5 (แผนการจัดการเรียนรู้ที่ 2): 4 หน้า (PDF)
"""

import sys as _s
if '--legacy-force' not in _s.argv:
    _s.exit('สคริปต์เก่า (ฮาร์ดโค้ด ศ21101 / 2-2569 / LINE) — ห้ามรันซ้ำ: ใช้ tools/curriculum/patch_m1_docx.py แทน (หรือรันด้วย --legacy-force)')
import os
import sys
import glob
import docx
from docx.shared import Inches, Pt, Cm, RGBColor
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

# ------------------------------------------------------------------------------
# สไตล์และฟอนต์มาตรฐาน TH Sarabun New
# ------------------------------------------------------------------------------
def set_run_font(run, size=15, bold=False, italic=False, color_rgb=None):
    run.font.name = 'TH Sarabun New'
    run._r.get_or_add_rPr().append(OxmlElement('w:rFonts'))
    run._r.rPr.rFonts.set(qn('w:ascii'), 'TH Sarabun New')
    run._r.rPr.rFonts.set(qn('w:hAnsi'), 'TH Sarabun New')
    run._r.rPr.rFonts.set(qn('w:cs'), 'TH Sarabun New')
    run._r.rPr.rFonts.set(qn('w:eastAsia'), 'TH Sarabun New')
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb

def add_p(container, text="", size=15, bold=False, italic=False,
          align=WD_ALIGN_PARAGRAPH.LEFT, space_before=0, space_after=0,
          color_rgb=None, line_spacing=1.0):
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
    t_box = doc.add_table(rows=1, cols=1)
    t_box.alignment = WD_TABLE_ALIGNMENT.RIGHT
    t_box.autofit = False
    cell = t_box.rows[0].cells[0]
    cell.width = Cm(2.2)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run(text)
    set_run_font(r, size=15, bold=True)
    
    tcPr = cell._tc.get_or_add_tcPr()
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
    p.text = ""
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
        p.paragraph_format.line_spacing = 1.0
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
    if orientation == 'landscape':
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width = Cm(29.7)
        sec.page_height = Cm(21.0)
        sec.top_margin = Cm(1.5)
        sec.bottom_margin = Cm(1.5)
        sec.left_margin = Cm(1.5)
        sec.right_margin = Cm(1.5)
    else:
        sec.orientation = WD_ORIENT.PORTRAIT
        sec.page_width = Cm(21.0)
        sec.page_height = Cm(29.7)
        sec.top_margin = Cm(1.2)
        sec.bottom_margin = Cm(1.2)
        sec.left_margin = Cm(2.0)
        sec.right_margin = Cm(2.0)
        
    sec.header_distance = Cm(0.8)
    sec.footer_distance = Cm(0.8)
    setup_footer(sec)
    return doc

# ------------------------------------------------------------------------------
# วาดผังมโนทัศน์ (Concept Map) ของ ม.1
# ------------------------------------------------------------------------------
def draw_concept_map_m1():
    out_path = os.path.join(SCRATCH_DIR, "concept_map_m1.png")
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
        import math
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

    draw_box(draw, b1, 'พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า\nเวลา 7 คาบ (20 คะแนน)', 'หน่วยที่ 1')
    draw_box(draw, b2, 'บทเพลงและการประพันธ์เนื้อร้องสร้างสรรค์\nเวลา 3 คาบ (20 คะแนน)', 'หน่วยที่ 2')
    draw_box(draw, b3, 'วงดนตรีไทยและวงดนตรีสากล\nเวลา 4 คาบ (20 คะแนน)', 'หน่วยที่ 3')
    draw_box(draw, b4, 'การวิเคราะห์วิจารณ์และอิทธิพลของดนตรีต่อสังคม\nเวลา 4 คาบ (20 คะแนน)', 'หน่วยที่ 4')

    cx, cy, r = W // 2, H // 2, 195
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 0, 0), width=4, fill=(255, 255, 255))
    draw.ellipse([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], outline=(0, 0, 0), width=2)

    c_title = "ชื่อรายวิชา"
    c_sub = "ดนตรี 1 (ศ21101)"
    c_desc = "ชั้นมัธยมศึกษาปีที่ 1\nเวลา 20 ชั่วโมง (0.5 หน่วยกิต)"

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
# 1. ไฟล์หน้าปกรวม (Cover Page) - ม.1
# ==============================================================================
def build_cover_doc_m1():
    doc = docx.Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.PORTRAIT
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.0)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.5)
    sec.right_margin = Cm(2.5)
    sec.header_distance = Cm(0)
    sec.footer_distance = Cm(0)
    
    pPr = sec._sectPr
    pgBorders = OxmlElement('w:pgBorders')
    pgBorders.set(qn('w:offsetFrom'), 'page')
    for b_name in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{b_name}')
        b.set(qn('w:val'), 'double')
        b.set(qn('w:sz'), '12')
        b.set(qn('w:space'), '24')
        b.set(qn('w:color'), '1A365D')
        pgBorders.append(b)
    pPr.append(pgBorders)
    
    p_logo = doc.add_paragraph()
    p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_logo.paragraph_format.space_before = Pt(8)
    p_logo.paragraph_format.space_after = Pt(12)
    if os.path.exists(LOGO_PATH):
        r_logo = p_logo.add_run()
        r_logo.add_picture(LOGO_PATH, height=Cm(3.2))
        
    add_p(doc, "โรงเรียนพะเยาพิทยาคม", size=24, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=3)
    add_p(doc, "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาพะเยา", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_p(doc, "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)
    
    p_div = doc.add_paragraph()
    p_div.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_div.paragraph_format.space_before = Pt(0)
    p_div.paragraph_format.space_after = Pt(16)
    pPr_div = p_div._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '18')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'D69E2E')
    pBdr.append(bottom)
    pPr_div.append(pBdr)
    
    add_p(doc, "เอกสารหลักสูตรและการจัดการเรียนรู้", size=26, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4, color_rgb=RGBColor(26, 54, 93))
    add_p(doc, "ภาคเรียนที่ 2 ปีการศึกษา 2569", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=16, color_rgb=RGBColor(155, 44, 44))
    
    t_box = doc.add_table(rows=1, cols=1)
    t_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_box.autofit = False
    cell_box = t_box.rows[0].cells[0]
    cell_box.width = Cm(15.5)
    
    tcPr = cell_box._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F0F4F8')
    tcPr.append(shd)
    
    tcBorders = OxmlElement('w:tcBorders')
    for b_name in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{b_name}')
        b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), '8')
        b.set(qn('w:space'), '0')
        b.set(qn('w:color'), 'CBD5E0')
        tcBorders.append(b)
    tcPr.append(tcBorders)
    
    add_p(cell_box, "กลุ่มสาระการเรียนรู้ศิลปะ", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=2)
    add_p(cell_box, "รายวิชา ดนตรี 1   รหัสวิชา ศ21101", size=21, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4, color_rgb=RGBColor(43, 108, 176))
    add_p(cell_box, "ระดับชั้นมัธยมศึกษาปีที่ 1   เวลา 20 ชั่วโมง (0.5 หน่วยกิต)", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)
    
    add_p(cell_box, "รายการเอกสารที่นำส่งกลุ่มบริหารวิชาการ:", size=16, bold=True, space_before=4, space_after=3)
    add_p(cell_box, "  ๑. โครงสร้างหลักสูตรรายวิชา (Course Curriculum) (แบบ วก.3)", size=15, space_after=2)
    add_p(cell_box, "  ๒. หน่วยการเรียนรู้ตามหลักสูตรรายวิชา (Unit Plan) หน่วยที่ 1 (แบบ วก.4)", size=15, space_after=2)
    add_p(cell_box, "  ๓. แผนการจัดการเรียนรู้รายชั่วโมง (Lesson Plan) หน่วยที่ 1 แผนที่ 2 (แบบ วก.5)", size=15, space_after=10)
    
    add_p(doc, "จัดทำโดย", size=17, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=20, space_after=2)
    add_p(doc, "นายพงศธร โพธิแก้ว", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, color_rgb=RGBColor(26, 54, 93))
    add_p(doc, "ตำแหน่ง ครู   กลุ่มสาระการเรียนรู้ศิลปะ", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)
    
    add_p(doc, "งานพัฒนาหลักสูตรและงานนิเทศพัฒนาบุคลากร กลุ่มบริหารวิชาการ", size=14.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_p(doc, "โรงเรียนพะเยาพิทยาคม", size=17, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    
    out_docx = os.path.join(TARGET_DIR, "01_ไฟล์หน้าปกรวม_ส่งงานวิชาการ_2_2569_ศ21101_ดนตรี1.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 2. โครงสร้างหลักสูตรรายวิชา (วก.3) - ม.1 (ฟิตพอดี 6 หน้า 100%)
# ==============================================================================
def build_wk3_doc_m1():
    doc = setup_base_doc(orientation='portrait')
    
    # ----- หน้าที่ 1: คำอธิบายรายวิชา -----
    add_wk_badge(doc, "วก.3")
    add_p(doc, "คำอธิบายรายวิชา", size=21, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=2)
    add_p(doc, "รหัสวิชา ศ21101   ชื่อวิชา ดนตรี 1   กลุ่มสาระการเรียนรู้ ศิลปะ", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ชั้นมัธยมศึกษาปีที่ 1   ภาคเรียนที่ 2   เวลา 20 ชั่วโมง   จำนวน 0.5 หน่วยกิต", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    add_p(doc, "คำอธิบายรายวิชา", size=16, bold=True, space_before=0, space_after=2)
    
    desc_k = (
        "        ศึกษาและวิเคราะห์โครงสร้างระบบสัญกรณ์ดนตรีเปรียบเทียบสากล-ไทย บันไดเสียง C Major และสัญกรณ์ตาราง 8 ห้องเพลง "
        "กลไกสวนศาสตร์ขั้นสูง (Advanced Acoustics) ของเครื่องดนตรีคาลิมบ้า 17 คีย์ อันประกอบด้วยความถี่ธรรมชาติ (Natural Frequency) "
        "โหมดการสั่นพ้องของลิ้นโลหะ (Resonance Modes) และการแผ่กระจายของคลื่นเสียงผ่านกล่องกำทอน (Acoustic Cavity Projection) "
        "วิเคราะห์ความสัมพันธ์ของอัตราจังหวะ 4/4 และความแม่นยำเชิงเวลาของมิติความเร็ว (Metronomic Temporal Precision) "
        "ศึกษาวิวัฒนาการ โครงสร้างสุนทรียศาสตร์ และการจัดหมวดหมู่วงดนตรีไทย ดนตรีพื้นบ้าน 4 ภาค และวงดนตรีสากล ตลอดจนการประยุกต์ใช้"
        "กรอบแนวคิดสุนทรียวิจารณ์เชิงวิชาการตามระเบียบวิธีของเฟลด์แมน (Feldman's Method of Art Criticism) เพื่อวิพากษ์คุณค่า อิทธิพล "
        "และอัตลักษณ์ดนตรีที่มีผลต่อพลวัตทางสังคม วัฒนธรรมท้องถิ่นพะเยา และความเป็นมนุษย์ที่สมบูรณ์"
    )
    add_p(doc, desc_k, size=13.5, space_before=0, space_after=4, line_spacing=1.03)
    
    desc_p = (
        "        โดยบูรณาการนวัตกรรมการจัดการเรียนรู้เชิงรุก 'Adaptive T-PACE Learning Ecosystem' ผ่านแพลตฟอร์มการประมวลผลดนตรีอัจฉริยะ "
        "'MusicSmart' ที่ขับเคลื่อนด้วยเทคโนโลยี Web Audio Signal Processing ปฏิบัติการจัดสรีรวิทยาของระนาบข้อนิ้ว (Kinematic Hand Posture) "
        "ฝึกฝนทักษะการดีดลิ่มโลหะแบบอิสระ การเคลื่อนนิ้วเชิงอนุกรมขั้นคู่เสียง (Root-Pedal, Harmonic 3rd/4th Intervals, and Linear Sequences) "
        "สอดคล้องกับจังหวะเคาะความเร็วแบบปรับเหมาะอัตโนมัติ (Dynamic Difficulty Adjustment: DDA) ฝึกการประพันธ์คำร้องเชิงกวีนิพนธ์ร่วมสมัย"
        "ผสานฉันทลักษณ์ไทยลงบนทำนองหลัก การบรรเลงและขับร้องประสานเสียงด้วยเทคนิค Polyphonic Control การวิเคราะห์ข้อมูลสถิติการเรียนรู้"
        "ผ่านระบบ Cloud-Based Data Analytics และการจำลองสัมมนากลุ่มดิจิทัลเพื่อนำเสนอแคมเปญดนตรีขับเคลื่อนสังคมท้องถิ่น"
    )
    add_p(doc, desc_p, size=13.5, space_before=0, space_after=4, line_spacing=1.03)
    
    desc_a = (
        "        เพื่อให้ผู้เรียนเกิดสมรรถนะการรู้คิดขั้นสูงทางดนตรี (Higher-Order Musical Cognition) มีทักษะการปฏิบัติเครื่องดนตรีที่มีความเที่ยงตรง"
        "ทางสวนศาสตร์ มีสมรรถนะการกำกับตนเอง (Self-Regulated Learning) ใฝ่เรียนรู้ มุ่งมั่นในการพัฒนาทักษะ มีวินัยทางจังหวะ ตระหนักและเห็นคุณค่า"
        "ในมรดกทางวัฒนธรรมดนตรีท้องถิ่นและสากล สามารถเชื่อมโยงคุณค่าดนตรีสู่การพัฒนาจิตตปัญญา คุณภาพชีวิต และปฏิบัติตนตามหลักปรัชญาของ"
        "เศรษฐกิจพอเพียงและหลักวิถีพุทธอย่างยั่งยืน"
    )
    add_p(doc, desc_a, size=13.5, space_before=0, space_after=6, line_spacing=1.03)
    
    add_p(doc, "รหัสตัวชี้วัด", size=15, bold=True, space_before=0, space_after=2)
    add_p(doc, "        ศ 2.1 ม.1/1,  ศ 2.1 ม.1/2,  ศ 2.1 ม.1/3,  ศ 2.1 ม.1/4,  ศ 2.1 ม.1/5", size=13.5, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.1/6,  ศ 2.1 ม.1/7,  ศ 2.1 ม.1/8,  ศ 2.1 ม.1/9", size=13.5, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.2 ม.1/1,  ศ 2.2 ม.1/2", size=13.5, space_before=0, space_after=2)
    add_p(doc, "รวมทั้งหมด 11 ตัวชี้วัด", size=14.5, bold=True, space_before=0, space_after=4)
    
    note_p1 = (
        "(วิชา 0.5 หน่วยกิต เวลาเรียน 20 ชั่วโมง แบ่งเป็น 1 ชั่วโมงต่อสัปดาห์\n"
        "คำอธิบายรายวิชา มีทั้ง K P และ A แบ่งเป็นย่อหน้าให้ชัดเจน\n"
        "สำหรับด้านคุณลักษณะอันพึงประสงค์ ให้เขียนข้อความเพิ่มเติมว่า 'ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ')"
    )
    add_p(doc, note_p1, size=11.5, italic=True, color_rgb=RGBColor(180, 0, 0), space_before=2, space_after=0)
    
    # ----- หน้าที่ 2: ตารางการวิเคราะห์หลักสูตร -----
    doc.add_page_break()
    add_p(doc, "ตารางการวิเคราะห์หลักสูตร", size=19, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "รายวิชา ดนตรี 1   รหัสวิชา ศ21101", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ระดับชั้นมัธยมศึกษาปีที่ 1   กลุ่มสาระการเรียนรู้ ศิลปะ", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    t_ana = doc.add_table(rows=1, cols=2)
    t_ana.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_ana.style = 'Table Grid'
    
    h0 = t_ana.rows[0].cells[0]
    h1 = t_ana.rows[0].cells[1]
    h0.width = Cm(7.5)
    h1.width = Cm(9.5)
    format_cell(h0, "มาตรฐานการเรียนรู้/ตัวชี้วัด", size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    format_cell(h1, "สาระการเรียนรู้แกนกลาง", size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    ana_data = [
        ("ศ 2.1 ม.1/1 อ่าน เขียน ร้องโน้ตไทย และโน้ตสากล\nศ 2.1 ม.1/9 ใช้และบำรุงรักษาเครื่องดนตรีอย่างระมัดระวังและรับผิดชอบ",
         "• เครื่องหมายและสัญลักษณ์ทางดนตรี (โน้ตไทยและสากล)\n• สวนศาสตร์และกายวิภาคศาสตร์เบื้องต้นของคาลิมบ้า\n• การดูแลรักษาเครื่องดนตรีเชิงป้องกัน"),
        ("ศ 2.1 ม.1/3 ร้องเพลงและใช้เครื่องดนตรีบรรเลงประกอบการร้อง เพลงโครงสร้างง่ายๆ\nศ 2.1 ม.1/8 นำเสนอแนวคิดในการพัฒนาการแสดงดนตรีของตนเอง",
         "• การขับร้องและบรรเลงบทเพลงมาตรฐานสากล (Ode to Joy)\n• การประพันธ์คำร้องภาษาไทย 8 วรรค ผสานฉันทลักษณ์\n• การประเมินตนเองและปรับปรุงผ่านระบบ MusicSmart"),
        ("ศ 2.1 ม.1/4 จัดประเภทของวงดนตรีไทยและวงดนตรีที่มาจากวัฒนธรรมต่างๆ",
         "• โครงสร้างและการจัดหมวดหมู่วงดนตรีไทยและพื้นบ้าน 4 ภาค\n• การจัดประเภทวงดนตรีสากล (Orchestra, Chamber, Band)\n• บทบาทหน้าที่ทางสังคมและวัฒนธรรมของวงดนตรี"),
        ("ศ 2.1 ม.1/2 เปรียบเทียบเสียงร้องและเสียงของเครื่องดนตรีที่มาจากวัฒนธรรมที่ต่างกัน\nศ 2.1 ม.1/5 อธิบายเหตุผลในการเลือกใช้องค์ประกอบดนตรีในการสร้างสรรค์งานศิลปะ\nศ 2.2 ม.1/1 อธิบายบทบาทความสัมพันธ์และอิทธิพลของดนตรีต่อสังคมไทย\nศ 2.2 ม.1/2 ระบุความหลากหลายขององค์ประกอบดนตรีในวัฒนธรรมต่างกัน",
         "• การเปรียบเทียบคุณลักษณะเสียงดนตรีต่างวัฒนธรรม\n• กรอบแนวคิดสุนทรียวิจารณ์ 4 ขั้นตอนของ Feldman\n• อิทธิพลของดนตรีต่อปัจเจกบุคคลและพลวัตทางสังคม\n• การออกแบบแคมเปญดนตรีพัฒนาชุมชนท้องถิ่นพะเยา"),
    ]
    for std_txt, cont_txt in ana_data:
        row = t_ana.add_row().cells
        row[0].width = Cm(7.5)
        row[1].width = Cm(9.5)
        format_cell(row[0], std_txt, size=11, bold=False, space_before=1, space_after=1)
        format_cell(row[1], cont_txt, size=11, bold=False, space_before=1, space_after=1)
        
    # ----- หน้าที่ 3: ตารางวิเคราะห์หน่วยการเรียนรู้กับมาตรฐานและตัวชี้วัด -----
    doc.add_page_break()
    add_p(doc, "ตารางวิเคราะห์หน่วยการเรียนรู้กับมาตรฐานการเรียนรู้และตัวชี้วัดชั้นปี", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "รหัสวิชา ศ21101   ชื่อวิชา ดนตรี 1   กลุ่มสาระการเรียนรู้ ศิลปะ", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    t_mat = doc.add_table(rows=2, cols=12)
    t_mat.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_mat.style = 'Table Grid'
    
    c_corner = t_mat.rows[0].cells[0]
    c_corner.merge(t_mat.rows[1].cells[0])
    c_corner.width = Cm(6.5)
    format_cell(c_corner, "มาตรฐานการเรียนรู้และ\nตัวชี้วัด\n\nหน่วยการเรียนรู้", size=11, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    c_m21 = t_mat.rows[0].cells[1]
    for i in range(2, 10):
        c_m21.merge(t_mat.rows[0].cells[i])
    format_cell(c_m21, "มาตรฐาน ศ 2.1", size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    c_m22 = t_mat.rows[0].cells[10]
    c_m22.merge(t_mat.rows[0].cells[11])
    format_cell(c_m22, "มาตรฐาน ศ 2.2", size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    sub_headers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "1", "2"]
    for idx, num in enumerate(sub_headers):
        cell = t_mat.rows[1].cells[idx + 1]
        cell.width = Cm(0.95)
        format_cell(cell, num, size=11, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="EAEEF7")
        
    matrix_units = [
        ("หน่วยการเรียนรู้ที่ 1\nพื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า",
         ["✓", "", "✓", "", "", "", "", "", "✓", "", ""]),
        ("หน่วยการเรียนรู้ที่ 2\nบทเพลงและการประพันธ์เนื้อร้องสร้างสรรค์",
         ["✓", "", "✓", "", "", "", "", "✓", "✓", "", ""]),
        ("หน่วยการเรียนรู้ที่ 3\nวงดนตรีไทยและวงดนตรีสากล",
         ["", "", "", "✓", "", "", "", "✓", "", "", ""]),
        ("หน่วยการเรียนรู้ที่ 4\nการวิเคราะห์วิจารณ์และอิทธิพลของดนตรีต่อสังคม",
         ["", "✓", "", "", "✓", "✓", "✓", "", "", "✓", "✓"]),
    ]
    for u_title, checks in matrix_units:
        row = t_mat.add_row().cells
        row[0].width = Cm(6.5)
        format_cell(row[0], u_title, size=11, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=1, space_after=1)
        for i, val in enumerate(checks):
            row[i + 1].width = Cm(0.95)
            format_cell(row[i + 1], val, size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
            
    note_p3 = (
        "(ให้ทำเครื่องหมาย ✓ ลงในช่องว่าง\n"
        "สำหรับเลข 1, 2, 3, ... ในแนวนอน หมายถึง หมายเลขตัวชี้วัดในมาตรฐานนั้น)"
    )
    add_p(doc, note_p3, size=11.5, italic=True, color_rgb=RGBColor(180, 0, 0), space_before=6, space_after=0)
    
    # ----- หน้าที่ 4: ผังมโนทัศน์หน่วยการเรียนรู้ -----
    doc.add_page_break()
    add_p(doc, "ผังมโนทัศน์หน่วยการเรียนรู้", size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "รหัสวิชา ศ21101   ชื่อรายวิชา ดนตรี 1   ชั้นมัธยมศึกษาปีที่ 1", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "(เขียนชื่อรายวิชาและชื่อหน่วยการเรียนรู้ลงในผังมโนทัศน์)", size=12.5, italic=True, color_rgb=RGBColor(180, 0, 0), align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=8)
    
    concept_map_img = draw_concept_map_m1()
    p_map = doc.add_paragraph()
    p_map.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_map.paragraph_format.space_before = Pt(0)
    p_map.paragraph_format.space_after = Pt(0)
    r_map = p_map.add_run()
    r_map.add_picture(concept_map_img, width=Cm(16.5))
    
    # ----- หน้าที่ 5: โครงสร้างรายวิชา -----
    doc.add_page_break()
    add_p(doc, "โครงสร้างรายวิชา ศ21101   ชื่อวิชา ดนตรี 1", size=19, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "ชั้นมัธยมศึกษาปีที่ 1   เวลา 20 ชั่วโมง   จำนวน 0.5 หน่วยกิต", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=4)
    
    t_cs = doc.add_table(rows=1, cols=6)
    t_cs.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_cs.style = 'Table Grid'
    h_cs = ["ลำดับ\nที่", "ชื่อหน่วยการเรียนรู้", "มาตรฐานการเรียนรู้/ตัวชี้วัด", "สาระสำคัญ", "เวลา\n(ชั่วโมง)", "น้ำหนักคะแนน\n(คะแนน)"]
    w_cs = [Cm(1.1), Cm(3.8), Cm(3.5), Cm(5.8), Cm(1.3), Cm(1.5)]
    for i, h in enumerate(h_cs):
        cell = t_cs.rows[0].cells[i]
        cell.width = w_cs[i]
        format_cell(cell, h, size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
        
    cs_data = [
        ("1", "พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า", "ศ 2.1 ม.1/1\nศ 2.1 ม.1/3\nศ 2.1 ม.1/9",
         "สัญกรณ์ดนตรีเปรียบเทียบสากล-ไทย สวนศาสตร์คาลิมบ้า 17 คีย์ และการฝึกเทคนิคดีดคู่เสียง", "7", "20"),
        ("2", "บทเพลงและการประพันธ์เนื้อร้องสร้างสรรค์", "ศ 2.1 ม.1/3\nศ 2.1 ม.1/8",
         "บรรเลงเพลง Ode to Joy ด้วย Polyphonic Control และประพันธ์คำร้องไทยผสานฉันทลักษณ์", "3", "20"),
        ("กลางภาค", "หน่วยที่ 1 จำนวน 10 คะแนน\nหน่วยที่ 2 จำนวน 10 คะแนน", "ศ 2.1 ม.1/1, ม.1/3,\nม.1/8, ม.1/9",
         "การสอบวัดผลกลางภาคเรียนผ่านระบบดิจิทัล MusicSmart 20 ข้อ (Real-time Cloud Analytics)", "-", "20"),
        ("3", "วงดนตรีไทยและวงดนตรีสากล", "ศ 2.1 ม.1/4\nศ 2.1 ม.1/8",
         "การจัดประเภทวงดนตรีไทยและสากลในมิติสวนศาสตร์ วิวัฒนาการ และสัมมนาดิจิทัล 5 กลุ่ม", "4", "10"),
        ("4", "การวิเคราะห์วิจารณ์และอิทธิพลของดนตรีต่อสังคม", "ศ 2.1 ม.1/2, ม.1/5-7\nศ 2.2 ม.1/1, ม.1/2",
         "เปรียบเทียบเสียงดนตรีต่างวัฒนธรรม ระเบียบวิธีวิจารณ์ 4 ขั้นตอนของ Feldman และแคมเปญดนตรี", "4", "10"),
        ("ปลายภาค", "หน่วยที่ 1 จำนวน 5 คะแนน\nหน่วยที่ 2 จำนวน 5 คะแนน\nหน่วยที่ 3 จำนวน 5 คะแนน\nหน่วยที่ 4 จำนวน 5 คะแนน", "ศ 2.1 ม.1/1-9\nศ 2.2 ม.1/1-2",
         "การสอบวัดผลปลายภาคเรียนผ่านระบบดิจิทัล MusicSmart ครอบคลุมสาระแกนกลาง 11 ตัวชี้วัด", "2", "20"),
    ]
    for row_vals in cs_data:
        row = t_cs.add_row().cells
        for i in range(6):
            row[i].width = w_cs[i]
            al = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 4, 5] else WD_ALIGN_PARAGRAPH.LEFT
            bold_val = True if row_vals[0] in ["กลางภาค", "ปลายภาค"] else False
            format_cell(row[i], row_vals[i], size=10.5, bold=bold_val, align=al, space_before=1, space_after=1)
            
    r_sum = t_cs.add_row().cells
    for i in range(6):
        r_sum[i].width = w_cs[i]
    format_cell(r_sum[0], "", size=11, bold=True)
    format_cell(r_sum[1], "รวม", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    format_cell(r_sum[2], "", size=11)
    format_cell(r_sum[3], "", size=11)
    format_cell(r_sum[4], "20", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    format_cell(r_sum[5], "100", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    note_p5 = (
        "(ช่องมาตรฐาน/ตัวชี้วัด ให้เขียน รหัสตัวชี้วัดและคำอธิบายตัวชี้วัดนั้นๆ\n"
        "ช่องเวลา รวมแล้วต้องได้ 20 ชั่วโมง ตามหน่วยกิต ช่องน้ำหนักคะแนน รวมแล้วต้องได้ 100 คะแนน และเวลากับน้ำหนักคะแนนต้องสอดคล้องกัน\n"
        "หน่วยไหนใช้หลายมาตรฐานกับตัวชี้วัด ให้เพิ่มเฉพาะช่องมาตรฐานกับตัวชี้วัดเท่านั้น)"
    )
    add_p(doc, note_p5, size=11, italic=True, color_rgb=RGBColor(180, 0, 0), space_before=4, space_after=0)
    
    # ----- หน้าที่ 6: โครงสร้างการวัดผลประเมินผล -----
    doc.add_page_break()
    add_p(doc, "โครงสร้างการวัดผลประเมินผล", size=19, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "รายวิชา ดนตรี 1   ชื่อวิชา ดนตรี 1   ชั้นมัธยมศึกษาปีที่ 1   เวลา 20 ชั่วโมง", size=15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=2)
    add_p(doc, "อัตราส่วนคะแนน ระหว่างภาค 80 : ปลายภาค 20", size=14.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "อัตราส่วนคะแนน   K: 30     P: 50     A: 20", size=14.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    t_ev = doc.add_table(rows=2, cols=8)
    t_ev.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_ev.style = 'Table Grid'
    
    c0 = t_ev.rows[0].cells[0]
    c0.merge(t_ev.rows[1].cells[0])
    c0.width = Cm(4.5)
    format_cell(c0, "หน่วยการเรียนรู้", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    c_bf = t_ev.rows[0].cells[1]
    for i in range(2, 5):
        c_bf.merge(t_ev.rows[0].cells[i])
    format_cell(c_bf, "คะแนนก่อนกลางภาคและหลังกลางภาค", size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    c_sub_kpa = ["K", "P", "A", "รวม"]
    for i, s in enumerate(c_sub_kpa):
        cell = t_ev.rows[1].cells[i + 1]
        cell.width = Cm(1.2)
        format_cell(cell, s, size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="EAEEF7")
        
    c_mid = t_ev.rows[0].cells[5]
    c_mid.merge(t_ev.rows[1].cells[5])
    c_mid.width = Cm(2.2)
    format_cell(c_mid, "คะแนน\nกลางภาค\n(K/P)", size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    c_fin = t_ev.rows[0].cells[6]
    c_fin.merge(t_ev.rows[1].cells[6])
    c_fin.width = Cm(2.2)
    format_cell(c_fin, "คะแนน\nปลายภาค\n(K)", size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    c_tot = t_ev.rows[0].cells[7]
    c_tot.merge(t_ev.rows[1].cells[7])
    c_tot.width = Cm(1.8)
    format_cell(c_tot, "รวม", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    ev_data = [
        ("หน่วยการเรียนรู้ที่ 1", "4", "12", "4", "20", "-", "-", "20"),
        ("หน่วยการเรียนรู้ที่ 2", "4", "12", "4", "20", "-", "-", "20"),
        ("กลางภาค", "-", "-", "-", "-", "20", "-", "20"),
        ("หน่วยการเรียนรู้ที่ 3", "2", "4", "4", "10", "-", "-", "10"),
        ("หน่วยการเรียนรู้ที่ 4", "2", "4", "4", "10", "-", "-", "10"),
    ]
    for row_vals in ev_data:
        row = t_ev.add_row().cells
        for i in range(8):
            format_cell(row[i], row_vals[i], size=11, bold=(row_vals[0]=="กลางภาค"), align=WD_ALIGN_PARAGRAPH.CENTER if i>0 else WD_ALIGN_PARAGRAPH.LEFT, space_before=1, space_after=1)
            
    r_sum2 = t_ev.add_row().cells
    sum_vals = ["รวม", "12", "32", "16", "60", "20", "20", "100"]
    for i in range(8):
        format_cell(r_sum2[i], sum_vals[i], size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="F2F2F2", space_before=1, space_after=1)
        
    r_comb = t_ev.add_row().cells
    c_comb0 = r_comb[0]
    for i in range(1, 6):
        c_comb0.merge(r_comb[i])
    format_cell(c_comb0, "รวมระหว่างภาค = 80", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="E2EFDA")
    
    format_cell(r_comb[6], "ปลายภาค = 20", size=11.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="FCE4D6")
    format_cell(r_comb[7], "100", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, bg_hex="D9E1F2")
    
    note_p6 = (
        "- อัตราส่วนคะแนนระหว่างภาค : ปลายภาค เช่น 80 : 20 รวมกันแล้วได้ 100 คะแนน\n"
        "  ตามระเบียบการวัดและประเมินผลของโรงเรียน กำหนดให้ ทุกรายวิชาต้องใช้ปลายภาค 20 คะแนน\n"
        "- อัตราส่วนคะแนน K : 30   P : 50   A : 20   รวมกันแล้วต้องได้ 100 คะแนน\n"
        "- ถ้ากลางภาคหรือปลายภาค มีการประเมิน P ด้วย ให้เพิ่มคอลัมน์ในช่องนั้น\n"
        "- ตามระเบียบการวัดและประเมินผลของโรงเรียน กำหนดให้ คะแนนคุณลักษณะอันพึงประสงค์ (A) มีน้ำหนักคะแนน 20 คะแนน"
    )
    add_p(doc, note_p6, size=11.5, italic=True, color_rgb=RGBColor(180, 0, 0), space_before=6, space_after=0)
    
    out_docx = os.path.join(TARGET_DIR, "02_วก3_โครงสร้างรายวิชา_ศ21101_ดนตรี1.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 3. หน่วยการเรียนรู้ตามหลักสูตรรายวิชา (วก.4) - หน่วยที่ 1 ม.1 (ฟิตพอดี 4 หน้า 100%)
# ==============================================================================
def build_wk4_doc_m1():
    doc = setup_base_doc(orientation='portrait')
    
    # ----- หน้าที่ 1 -----
    add_wk_badge(doc, "วก.4")
    add_p(doc, "หน่วยการเรียนรู้ที่ 1", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "ชื่อหน่วย พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า   รหัสวิชา ศ21101   ชื่อรายวิชา ดนตรี 1", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ชั้นมัธยมศึกษาปีที่ 1   ภาคเรียนที่ 2   เวลา 7 ชั่วโมง (คาบ 1 - 7)", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
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
    add_p(doc, "        ศ 2.1 ม.1/1 อ่าน เขียน ร้องโน้ตไทย และโน้ตสากล", size=14, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.1/3 ร้องเพลงและใช้เครื่องดนตรีบรรเลงประกอบการร้อง เพลงโครงสร้างง่ายๆ", size=14, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.1/9 ใช้และบำรุงรักษาเครื่องดนตรีอย่างระมัดระวังและรับผิดชอบ", size=14, space_before=0, space_after=4)
    
    add_p(doc, "2. สาระสำคัญ/ความคิดรวบยอด", size=15, bold=True, space_before=2, space_after=1)
    u1_core = (
        "        การเรียนรู้ระบบสัญกรณ์ดนตรีสากลและโน้ตไทย 8 ห้องเพลง ผสานหลักสวนศาสตร์เชิงลึก (Advanced Acoustics) "
        "และกลไกการสั่นพ้องของคาลิมบ้า 17 คีย์ สรีรวิทยาการวางระนาบข้อนิ้ว (Kinematic Hand Posture) อัตราจังหวะ 4/4 "
        "และความแม่นยำเชิงเวลา ผ่านนวัตกรรม 'Adaptive T-PACE Learning Ecosystem' ร่วมกับระบบประมวลผลคลื่นเสียงสด "
        "(Web Audio Signal Processing) บนแอปพลิเคชัน MusicSmart ฝึกฝนสเกล C Major ขั้นคู่เสียง และโน้ตอนุกรมด้วยระบบปรับความเร็วอัตโนมัติ "
        "(Dynamic Difficulty Adjustment: DDA) ที่ตอบสนองต่อสมรรถนะกล้ามเนิ้อมัดเล็กและสะท้อนข้อมูลย้อนกลับทันที"
    )
    add_p(doc, u1_core, size=14, space_before=0, space_after=4, line_spacing=1.03)
    
    add_p(doc, "3. สาระการเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "3.1 สาระการเรียนรู้แกนกลาง", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        3.1.1 ปฐมนิเทศรายวิชา ศ21101 การเข้ากลุ่ม LINE และการใช้งานแอปพลิเคชัน MusicSmart", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.2 สวนศาสตร์เบื้องต้นของคาลิมบ้า (การสั่นสะเทือน ความถี่เสียง) สรีระท่าทาง และการเก็บรักษา", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.3 อัตราจังหวะ 4/4 ค่าตัวโน้ต การใช้เมโทรนอม 70-75 BPM และแบบฝึกโน้ตวิ่งในแอป MusicSmart", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.4 แบบฝึกปฏิบัติขั้นคู่เสียงรูทคงที่ตัวโด (Root Pedal C)", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.5 แบบฝึกปฏิบัติขั้นคู่ 3 รูทเคลื่อนที่ (Moving Root 3rd)", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.6 แบบฝึกปฏิบัติขั้นคู่ 4 รูทเคลื่อนที่ (Moving Root 4th)", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.1.7 แบบฝึกปฏิบัติโน้ตอนุกรม 3 ตัว (3-Note Sequence)", size=14, space_before=0, space_after=2)
    add_p(doc, "3.2 สาระการเรียนรู้ท้องถิ่น", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        3.2.1 การเปรียบเทียบสำเนียงโน้ตสเกล C Major กับบันไดเสียงดนตรีพื้นบ้านล้านนาเมืองพะเยา", size=14, space_before=0, space_after=1)
    add_p(doc, "        3.2.2 การสร้างความตระหนักรู้ในการดูแลรักษาเครื่องดนตรีส่วนรวมของโรงเรียนพะเยาพิทยาคม", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 2 -----
    doc.add_page_break()
    add_p(doc, "4. สมรรถนะสำคัญของผู้เรียน", size=15, bold=True, space_before=1, space_after=1)
    add_p(doc, "        4.1 ความสามารถในการสื่อสาร: การสื่อสารผ่านสัญลักษณ์โน้ตและภาษาดนตรีสากล-ไทย", size=14, space_before=0, space_after=1)
    add_p(doc, "        4.2 ความสามารถในการคิด: การคิดวิเคราะห์สวนศาสตร์เสียงดนตรีและความสัมพันธ์เชิงตัวเลขของความถี่เสียง", size=14, space_before=0, space_after=1)
    add_p(doc, "        4.3 ความสามารถในการใช้เทคโนโลยี: การใช้งานแอปพลิเคชัน MusicSmart เมโทรนอมดิจิทัล และระบบประมวลผลเสียง", size=14, space_before=0, space_after=4)
    
    add_p(doc, "5. คุณลักษณะอันพึงประสงค์", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        5.1 มีวินัย: ปฏิบัติตามกฎกติกาห้องปฏิบัติการดนตรีและรักษาจังหวะอย่างแม่นยำ", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.2 ใฝ่เรียนรู้: มุ่งมั่นฝึกซ้อมทบทวนด้วยตนเองผ่านระบบ Smart Practice Studio", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.3 มุ่งมั่นในการทำงาน: ซ้อมจนเกิดความชำนาญตามเกณฑ์ ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ", size=14, space_before=0, space_after=1)
    add_p(doc, "        5.4 มีจิตสาธารณะ: ทะนุถนอม ดูแลรักษา และทำความสะอาดเครื่องดนตรีส่วนรวมอย่างประณีต", size=14, space_before=0, space_after=4)
    
    add_p(doc, "6. ชิ้นงาน/ภาระงาน", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "6.1 ชิ้นงาน/ภาระงานระหว่างจัดกิจกรรมการเรียนรู้", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        6.1.1 การเข้า LINE กลุ่มวิชาดนตรี และการลงทะเบียนเข้าใช้งานในแอปพลิเคชัน MusicSmart (ผ01)", size=14, space_before=0, space_after=1)
    add_p(doc, "        6.1.2 แบบบันทึกการสังเกตสรีระและการดีดสำรวจเสียงคาลิมบ้า 17 คีย์ (ผ02)", size=14, space_before=0, space_after=1)
    add_p(doc, "        6.1.3 การฝึกซ้อมกับเมโทรนอมและแบบฝึกหัดใน Smart Practice Studio", size=14, space_before=0, space_after=2)
    add_p(doc, "6.2 ชิ้นงาน/ภาระงานรวบยอด", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        6.2.1 บันทึกผลการปฏิบัติเดี่ยว 5 แบบฝึกหัด (คาบ 3-7) ในระบบดิจิทัล MusicSmart แบบฝึกหัดละ 4 คะแนน (รวม 20 คะแนน)", size=14, space_before=0, space_after=4)
    
    add_p(doc, "7. การวัดและประเมินผล", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "7.1 การวัดและประเมินผลระหว่างจัดกิจกรรมการเรียนรู้", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        7.1.1 สังเกตท่าทางการจับถือ การวางข้อนิ้ว และการดูแลรักษาเครื่องดนตรี (P, A)", size=14, space_before=0, space_after=1)
    add_p(doc, "        7.1.2 ตรวจสอบความเข้าใจเรื่องสวนศาสตร์ อัตราจังหวะ 4/4 และสัญลักษณ์โน้ต (K)", size=14, space_before=0, space_after=2)
    add_p(doc, "7.2 การวัดและประเมินผลเมื่อสิ้นสุดกิจกรรมการเรียนรู้", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        7.2.1 ประเมินทักษะปฏิบัติตาม Rubric Rating Scale ในแอปพลิเคชัน MusicSmart (รวม 20 คะแนน)", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 3 -----
    doc.add_page_break()
    add_p(doc, "8. กิจกรรมการเรียนรู้ (Active Learning Model: Adaptive T-PACE)", size=15, bold=True, space_before=1, space_after=1)
    act_desc = (
        "        การจัดการเรียนรู้ใช้รูปแบบ Active Learning บูรณาการโมเดล 'Adaptive T-PACE Learning Ecosystem' "
        "โดยแบ่งขั้นตอนการจัดกิจกรรมการเรียนรู้เชิงลึกออกเป็น 5 ขั้นตอน ดังนี้:\n\n"
        "        1. T - Trigger & Diagnostic Challenge: กระตุ้นโสตประสาท วินิจฉัยความพร้อม และทดสอบจังหวะจำลอง\n"
        "        2. P - Precision Practice & Sensorimotor Calibration: ฝึกปฏิบัติแม่นยำรายบุคคลโดยมีอัลกอริทึมจับค่าความคลาดเคลื่อนทางเวลา\n"
        "        3. A - Adaptive Application & Telemetry Tracking: ซ้อมกับแบบฝึกโน้ตวิ่งและวิเคราะห์ความเพี้ยนเสียงผ่าน Web Audio API\n"
        "        4. C - Collaboration & Peer Calibration: แลกเปลี่ยนการสังเกตสรีระและสะท้อนผลผ่าน Visual Dashboard\n"
        "        5. E - Evaluation & Metacognitive Empowerment: วิเคราะห์ข้อมูลเส้นทางการเรียนรู้ เสริมพลังใจ และสะท้อนคิดกำกับตนเอง\n\n"
        "ภาพรวมกิจกรรมรายคาบในหน่วยการเรียนรู้ที่ 1 (7 ชั่วโมง):\n"
        "    • คาบ 1: ปฐมนิเทศวิชา ศ21101 เข้า LINE กลุ่ม แนะนำเมนูและลงทะเบียนแอป MusicSmart\n"
        "    • คาบ 2: สวนศาสตร์เบื้องต้นของคาลิมบ้า สรีระท่าทาง ดีดอิสระ และการเช็ดเก็บรักษา\n"
        "    • คาบ 3: เมโทรนอม จังหวะ 4/4 แบบฝึกสเกล C Major โน้ตวิ่งในแอป MusicSmart (4 คะแนน)\n"
        "    • คาบ 4: แบบฝึกขั้นคู่เสียงรูทคงที่ตัวโด Root Pedal C (4 คะแนน)\n"
        "    • คาบ 5: แบบฝึกขั้นคู่ 3 รูทเคลื่อนที่ Moving Root 3rd (4 คะแนน)\n"
        "    • คาบ 6: แบบฝึกขั้นคู่ 4 รูทเคลื่อนที่ Moving Root 4th (4 คะแนน)\n"
        "    • คาบ 7: แบบฝึกโน้ตอนุกรม 3 ตัว 3-Note Sequence (4 คะแนน)"
    )
    add_p(doc, act_desc, size=13.5, space_before=0, space_after=4, line_spacing=1.03)
    
    add_p(doc, "9. สื่อ/แหล่งการเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        9.1 เครื่องดนตรีคาลิมบ้า 17 คีย์ (C Major) พร้อมซองผ้าและผ้านุ่มไมโครไฟเบอร์", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.2 แอปพลิเคชัน MusicSmart (โมดูล Smart Practice Studio, ระบบ Live Tuner, บันทึกคะแนน Cloud Analytics)", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.3 แผนภาพจำลองสวนศาสตร์ (Acoustics Chart) และแบบบันทึกกิจกรรม ผ01, ผ02", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.4 แอปพลิเคชันเมโทรนอมเสริม (Soundcorset, Metronome Beats)", size=14, space_before=0, space_after=2)
    add_p(doc, "        9.5 ห้องปฏิบัติการดนตรีและระบบเครือข่ายอินเทอร์เน็ต โรงเรียนพะเยาพิทยาคม", size=14, space_before=0, space_after=0)
    
    # ----- หน้าที่ 4 (Landscape Table) -----
    sec_land = doc.add_section(WD_SECTION.NEW_PAGE)
    sec_land.orientation = WD_ORIENT.LANDSCAPE
    sec_land.page_width = Cm(29.7)
    sec_land.page_height = Cm(21.0)
    sec_land.top_margin = Cm(1.5)
    sec_land.bottom_margin = Cm(1.5)
    sec_land.left_margin = Cm(1.5)
    sec_land.right_margin = Cm(1.5)
    
    add_p(doc, "หน่วยการเรียนรู้ที่ 1 เรื่อง พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า", size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=1, space_after=1)
    add_p(doc, "แผนการจัดการเรียนรู้ที่ 2 เรื่อง สวนศาสตร์และสรีระคาลิมบ้า เวลา 1 ชั่วโมง", size=15, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
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
        
    r1 = t_plans.rows[1].cells
    for i in range(7):
        r1[i].width = w_plans[i]
        
    c_kpa = (
        "K : อธิบายความสัมพันธ์ของความยาวลิ่มโลหะกับระดับความถี่เสียง และหลักการขยายเสียงของกล่องกำทอนได้ถูกต้อง\n\n"
        "P : จับถือคาลิมบ้าด้วยสรีระมุม 45 องศา ดีดลิ่มโลหะสำรวจเสียง C4-C5 ได้กังวานชัดเจน และดูแลรักษาเครื่องถูกวิธี\n\n"
        "A : มีวินัย ใฝ่เรียนรู้ มีความรับผิดชอบในการดูแลรักษาเครื่องดนตรีส่วนรวม ปฏิบัติตามหลักปรัชญาเศรษฐกิจพอเพียง"
    )
    c_task = (
        "แบบบันทึกการสังเกตสรีระและการดีดสำรวจเสียงคาลิมบ้า (ผ02)\n\n"
        "แบบประเมินคู่บัดดี้ (Peer Kinematic Checklist)"
    )
    c_act = (
        "ขั้นนำ (10 นาที)\n"
        "1. ครูเปรียบเทียบรูปคลื่นเสียง (Waveform) บนแอป MusicSmart จากการดีดเปิด-ปิด Sound Holes\n"
        "2. ตั้งคำถามกระตุ้นคิด: 'เหตุใดลิ่มยาวจึงเสียงต่ำกว่าลิ่มสั้น และมุมนิ้วส่งผลต่อคุณภาพเสียงอย่างไร?'\n\n"
        "ขั้นสอน (30 นาที)\n"
        "3. สาธิตหลักการสั่นสะเทือน ความถี่เสียง การจับถือมุม 45 องศา และการดีดแบบ Free Plucking\n"
        "4. นักเรียนทดลองดีดสำรวจเสียง C4-C5 เปิดฟังก์ชัน Live Tuner ในแอป MusicSmart ตรวจสอบความคมชัด\n"
        "5. นักเรียนจับคู่บัดดี้สังเกตท่าทางข้อมือ สะท้อนจุดเกร็ง ครูเดินตรวจปรับแก้รายบุคคล\n\n"
        "ขั้นสรุป (10 นาที)\n"
        "6. ครูและนักเรียนร่วมสรุปหลักสวนศาสตร์และการบำรุงรักษา: ใช้ผ้าไมโครไฟเบอร์เช็ดเหงื่อป้องกันสนิม จัดเก็บลงซอง\n"
        "7. ส่งแบบบันทึก ผ02 และบันทึกคะแนนสะท้อนตนเองลงในระบบ MusicSmart"
    )
    c_strat = (
        "การจัดการเรียนรู้เชิงรุก (Active Learning)\n\n"
        "Inquiry-based & Hands-on Practice\n\n"
        "กระบวนการคู่บัดดี้สะท้อนคิด (Peer Kinematic Calibration)"
    )
    c_media = (
        "1. คาลิมบ้า 17 คีย์ พร้อมค้อนจูนเสียงและผ้าเช็ดไมโครไฟเบอร์\n\n"
        "2. แอปพลิเคชัน MusicSmart (Live Tuner & Sound Wave)\n\n"
        "3. แผนภาพจำลองสวนศาสตร์ (Acoustics Chart)\n\n"
        "4. แบบบันทึกกิจกรรม ผ02"
    )
    c_eval = (
        "1. ตรวจแบบบันทึกกิจกรรม ผ02 (K)\n\n"
        "2. ประเมินทักษะการจับถือและสรีระการดีดสำรวจเสียง (P)\n\n"
        "3. สังเกตความรับผิดชอบในการดูแลรักษาเครื่องดนตรีและวินัย (A)"
    )
    c_tool = (
        "1. แบบตรวจกิจกรรม ผ02\n\n"
        "2. แบบประเมินทักษะการปฏิบัติและรูบริกสรีรวิทยาการดีด (Rubric Scale 1-4)\n\n"
        "3. แบบสังเกตพฤติกรรมคุณลักษณะอันพึงประสงค์"
    )
    
    format_cell(r1[0], c_kpa, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[1], c_task, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[2], c_act, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[3], c_strat, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[4], c_media, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[5], c_eval, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    format_cell(r1[6], c_tool, size=11.5, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_before=2, space_after=2)
    
    out_docx = os.path.join(TARGET_DIR, "03_วก4_หน่วยการเรียนรู้ที่_1_พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า.docx")
    doc.save(out_docx)
    return out_docx

# ==============================================================================
# 4. แผนการจัดการเรียนรู้รายชั่วโมง (วก.5) - แผนที่ 2 ม.1 (ฟิตพอดี 4 หน้า 100%)
# ==============================================================================
def build_wk5_doc_m1():
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
    add_p(doc, "รายวิชา ดนตรี 1   รหัสวิชา ศ21101   ชั้นมัธยมศึกษาปีที่ 1", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "ภาคเรียนที่ 2   ปีการศึกษา 2569   หน่วยการเรียนรู้ที่ 1", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "เรื่อง สวนศาสตร์และสรีระคาลิมบ้า   เวลา 1 ชั่วโมง", size=13.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
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
    add_p(doc, "        ศ 2.1 ม.1/1 อ่าน เขียน ร้องโน้ตไทย และโน้ตสากล", size=13, space_before=0, space_after=1)
    add_p(doc, "        ศ 2.1 ม.1/9 ใช้และบำรุงรักษาเครื่องดนตรีอย่างระมัดระวังและรับผิดชอบ", size=13, space_before=0, space_after=2)
    
    add_p(doc, "สาระสำคัญ", size=14, bold=True, space_before=1, space_after=1)
    core_w5 = (
        "        การกำเนิดเสียงของคาลิมบ้า (17 คีย์ C Major) เกิดจากการสั่นสะเทือนของลิ่มโลหะ (Metal Tines) ที่มีความยาวต่างกัน "
        "ส่งผ่านพลังงานกลสู่หย่องไม้และกล่องกำทอน (Resonance Box) เกิดการขยายเสียงตามหลักสวนศาสตร์ (Acoustics) "
        "การจัดสรีรวิทยาของข้อมือและนิ้วโป้ง (Kinematic Hand Posture) ในมุม 45 องศา และการดีดด้วยแรงสม่ำเสมอ "
        "ช่วยให้เกิดเสียงที่กังวานและแม่นยำ พร้อมทั้งการบำรุงรักษาเครื่องดนตรีเชิงป้องกันเพื่อยืดอายุการใช้งาน"
    )
    add_p(doc, core_w5, size=13, space_before=0, space_after=2, line_spacing=1.0)
    
    add_p(doc, "สาระการเรียนรู้", size=14, bold=True, space_before=1, space_after=1)
    add_p(doc, "        1. หลักการกำเนิดเสียง ความถี่เสียง (Frequency) และการสั่นพ้องของกล่องกำทอนคาลิมบ้า", size=13, space_before=0, space_after=1)
    add_p(doc, "        2. สรีรวิทยาการจับถือเครื่องดนตรี การวางข้อมือ และเทคนิคการดีดลิ่มโลหะด้วยนิ้วโป้ง (Free Plucking)", size=13, space_before=0, space_after=1)
    add_p(doc, "        3. การดูแลรักษา ทำความสะอาด และการป้องกันการเกิดสนิมบนลิ่มโลหะ", size=13, space_before=0, space_after=2)
    
    add_p(doc, "จุดประสงค์การเรียนรู้", size=14, bold=True, space_before=1, space_after=1)
    add_p(doc, "1. ด้านความรู้", size=13.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        1.1 อธิบายความสัมพันธ์ของความยาวลิ่มโลหะกับระดับความถี่เสียง และหลักการขยายเสียงของกล่องกำทอนได้ถูกต้อง", size=13, space_before=0, space_after=1)
    add_p(doc, "2. ด้านทักษะกระบวนการ", size=13.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        2.1 จับถือคาลิมบ้าด้วยสรีระที่ถูกต้อง ดีดลิ่มโลหะสำรวจเสียง C4-C5 ได้กังวานชัดเจน และดูแลรักษาเครื่องอย่างถูกวิธี", size=13, space_before=0, space_after=1)
    add_p(doc, "3. ด้านคุณลักษณะอันพึงประสงค์", size=13.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        3.1 มีวินัย ใฝ่เรียนรู้ และมีความรับผิดชอบในการดูแลรักษาทรัพย์สินของส่วนรวม ปฏิบัติตนตามหลักปรัชญาเศรษฐกิจพอเพียงและหลักวิถีพุทธ", size=13, space_before=0, space_after=2)
    
    add_p(doc, "สมรรถนะสำคัญของผู้เรียน", size=13.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        1.1 ความสามารถในการคิด: การวิเคราะห์ความสัมพันธ์เชิงเหตุผลระหว่างความยาวของวัตถุกับระดับเสียง", size=13, space_before=0, space_after=1)
    add_p(doc, "        1.2 ความสามารถในการใช้ทักษะชีวิต: การปรับสรีระร่างกายและการฝึกทักษะการปฏิบัติอย่างผ่อนคลาย", size=13, space_before=0, space_after=0)
    
    # ----- หน้าที่ 2 -----
    doc.add_page_break()
    add_p(doc, "ชิ้นงาน/ภาระงาน", size=15, bold=True, space_before=1, space_after=1)
    add_p(doc, "        แบบบันทึกการสังเกตสรีระและการดีดสำรวจเสียงคาลิมบ้า (ผ02) พร้อมแบบประเมินคู่บัดดี้ (Peer Kinematic Checklist)", size=14, space_before=0, space_after=4)
    
    add_p(doc, "กิจกรรมการเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "ขั้นนำเข้าสู่บทเรียน (10 นาที)", size=14.5, bold=True, space_before=0, space_after=1)
    add_p(doc, "        1. ครูนำคาลิมบ้า 17 คีย์ที่ดีดเปิดและปิดช่องเสียงด้านหลัง (Sound Holes) มาเปรียบเทียบรูปคลื่นเสียง (Waveform) บนหน้าจอแอป MusicSmart ให้นักเรียนสังเกตความแตกต่างของความกังวานและพลังงานเสียง", size=14, space_before=0, space_after=2, line_spacing=1.03)
    add_p(doc, "        2. ครูตั้งคำถามกระตุ้นความคิด: 'เหตุใดลิ่มโลหะที่ยาวกว่าจึงให้เสียงต่ำกว่าลิ่มที่สั้น และมุมนิ้วส่งผลต่อคุณภาพเสียงอย่างไร?'", size=14, space_before=0, space_after=3)
    
    add_p(doc, "ขั้นสอน (30 นาที)", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        3. ครูอธิบายหลักการสั่นสะเทือน ความถี่เสียง (Frequency) การถ่ายทอดแรงผ่านหย่องสู่กล่องเสียง และสาธิตการจับถือเครื่องมุม 45 องศา", size=14, space_before=0, space_after=2)
    add_p(doc, "        4. นักเรียนทดลองดีดสำรวจน้ำหนักนิ้วแบบ Free Plucking เปิดฟังก์ชัน Live Tuner ในแอป MusicSmart ตรวจสอบความคมชัดของเสียง และฝึกดีดไล่สเกล C4-C5 สลับซ้าย-ขวา", size=14, space_before=0, space_after=2, line_spacing=1.03)
    add_p(doc, "        5. นักเรียนจับคู่บัดดี้ (Peer Kinematic Calibration) สังเกตท่าทางข้อมือและมุมเล็บของเพื่อน สะท้อนจุดเกร็งของกล้ามเนื้อ และครูเดินตรวจปรับแก้รายบุคคล", size=14, space_before=0, space_after=3)
    
    add_p(doc, "ขั้นสรุปบทเรียน (10 นาที)", size=14.5, bold=True, space_before=1, space_after=1)
    add_p(doc, "        6. ครูและนักเรียนร่วมกันสรุปหลักสวนศาสตร์และการบำรุงรักษาเชิงป้องกัน: การใช้ผ้านุ่มไมโครไฟเบอร์เช็ดคราบเหงื่อเพื่อป้องกันสนิม และการจัดเก็บลงซองกันกระแทก", size=14, space_before=0, space_after=2, line_spacing=1.03)
    add_p(doc, "        7. นักเรียนส่งแบบบันทึก ผ02 และบันทึกคะแนนสะท้อนตนเองลงในระบบ MusicSmart", size=14, space_before=0, space_after=4)
    
    add_p(doc, "สื่อ / แหล่งเรียนรู้", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        1. เครื่องดนตรีคาลิมบ้า 17 คีย์ (C Major) พร้อมค้อนจูนเสียงและผ้าเช็ดไมโครไฟเบอร์", size=14, space_before=0, space_after=1)
    add_p(doc, "        2. แพลตฟอร์มดิจิทัลเพื่อการเรียนรู้ MusicSmart (โมดูลสรีระคาลิมบ้า และระบบ Live Tuner)", size=14, space_before=0, space_after=1)
    add_p(doc, "        3. ภาพจำลองสวนศาสตร์ (Acoustics) และแบบบันทึกกิจกรรม ผ02", size=14, space_before=0, space_after=4)
    
    add_p(doc, "การวัดและประเมินผล", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        1. ด้านความรู้: ตรวจความถูกต้องของแบบบันทึกความเข้าใจหลักสวนศาสตร์ (ผ02)", size=14, space_before=0, space_after=1)
    add_p(doc, "        2. ด้านทักษะกระบวนการ: ประเมินการจับถือและการดีดลิ่มโลหะคาลิมบ้าตามเกณฑ์สรีระ", size=14, space_before=0, space_after=1)
    add_p(doc, "        3. ด้านคุณลักษณะอันพึงประสงค์: สังเกตความรับผิดชอบในการดูแลรักษาเครื่องดนตรีและวินัยในการเรียน", size=14, space_before=0, space_after=4)
    
    add_p(doc, "เครื่องมือวัด", size=15, bold=True, space_before=2, space_after=1)
    add_p(doc, "        1. แบบตรวจกิจกรรม ผ02 เรื่อง สวนศาสตร์และสรีระคาลิมบ้า", size=14, space_before=0, space_after=1)
    add_p(doc, "        2. แบบประเมินทักษะการปฏิบัติและรูบริกสรีรวิทยาการดีด (Rubric Scale 1-4)", size=14, space_before=0, space_after=1)
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
        ("1. ด้านความรู้ (K)\nสวนศาสตร์และการกำเนิดเสียงคาลิมบ้า",
         "1",
         "อธิบายความสัมพันธ์ของความยาวลิ่มโลหะกับการกำเนิดความถี่เสียงได้ถูกต้องชัดเจน 100%",
         "อธิบายการเกิดเสียงและการขยายเสียงของกล่องกำทอนได้ถูกต้องเป็นส่วนใหญ่ (80-99%)",
         "อธิบายได้บางส่วนว่าลิ่มยาวเสียงทุ้ม ลิ่มสั้นเสียงแหลม แต่ระบุเหตุผลไม่สมบูรณ์ (60-79%)",
         "ไม่สามารถอธิบายกลไกการเกิดเสียงของเครื่องดนตรีได้ (<60%)"),
        ("2. ด้านทักษะ (P)\nการจับถือและสรีระการดีดลิ่มโลหะ",
         "2",
         "จับถือคาลิมบ้ามุม 45 องศา ข้อมือผ่อนคลาย ดีดด้วยเล็บได้เสียงกังวานแม่นยำทุกตัวโน้ต",
         "จับถือและดีดลิ่มโลหะได้ถูกต้อง เสียงคมชัด มีอาการเกร็งเล็กน้อยแต่ปรับแก้ได้",
         "จับถือเครื่องได้แต่มีอาการเกร็งข้อมือ ดีดโดนลิ่มข้างเคียง 1-2 ครั้ง",
         "จับเครื่องผิดสรีระ ดีดโดยใช้แรงกดมากเกินไป เสียงอู้อี้ไม่กังวาน"),
        ("3. ด้านคุณลักษณะ (A)\nความรับผิดชอบและการดูแลรักษา",
         "1",
         "ดูแลรักษาเครื่องดนตรี เช็ดทำความสะอาดหลังเล่น และจัดเก็บอย่างทะนุถนอมสม่ำเสมอ",
         "ดูแลรักษาเครื่องดนตรี เช็ดทำความสะอาดและจัดเก็บตามคำแนะนำของครู",
         "จัดเก็บเครื่องดนตรีเมื่อครูเตือน ขาดความรอบคอบในการเช็ดทำความสะอาด",
         "ไม่ดูแลรักษาเครื่องดนตรี วางทิ้งอย่างไม่ระมัดระวัง"),
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
    add_p(doc, "รายวิชา ดนตรี 1   รหัส ศ21101   ชั้นมัธยมศึกษาปีที่ 1   ภาคเรียนที่ 2   ปีการศึกษา 2569", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(doc, "เรื่อง สวนศาสตร์และสรีระคาลิมบ้า   เวลา 1 ชั่วโมง", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=6)
    
    add_p(doc, "ผลการเรียนรู้ของนักเรียน", size=15, bold=True, space_before=2, space_after=1)
    for _ in range(4):
        add_p(doc, "." * 220, size=13, space_before=0, space_after=1)
        
    add_p(doc, "ปัญหาที่เกิดขึ้นในระหว่างการจัดการเรียนรู้", size=15, bold=True, space_before=3, space_after=1)
    for _ in range(4):
        add_p(doc, "." * 220, size=13, space_before=0, space_after=1)
        
    add_p(doc, "แนวทางการแก้ปัญหาหรือปรับปรุงแผนการจัดการเรียนรู้ครั้งต่อไป (Action plan)", size=15, bold=True, space_before=3, space_after=1)
    for _ in range(4):
        add_p(doc, "." * 220, size=13, space_before=0, space_after=1)
        
    # ตารางลงชื่อครูผู้สอน (จัดกึ่งกลางใต้เส้นประแบบ 2 คอลัมน์ ไร้เส้นขอบ)
    t_sig1 = doc.add_table(rows=1, cols=2)
    t_sig1.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_sig1.autofit = False
    c0_tea = t_sig1.rows[0].cells[0]
    c1_tea = t_sig1.rows[0].cells[1]
    c0_tea.width = Cm(8.5)
    c1_tea.width = Cm(8.5)
    add_p(c1_tea, "ลงชื่อ ....................................................... ครูผู้สอน", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=1)
    add_p(c1_tea, "(นายพงศธร โพธิแก้ว)", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(c1_tea, "ตำแหน่ง ครู", size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(c1_tea, "............/............../..............", size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    
    add_p(doc, "ความคิดเห็นของฝ่ายบริหาร", size=15, bold=True, space_before=2, space_after=1)
    for _ in range(2):
        add_p(doc, "." * 220, size=13, space_before=0, space_after=1)
        
    # ตารางลงชื่อฝ่ายบริหาร (จัดกึ่งกลางใต้เส้นประแบบ 2 คอลัมน์ ไร้เส้นขอบ)
    t_sig2 = doc.add_table(rows=1, cols=2)
    t_sig2.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_sig2.autofit = False
    c0_adm = t_sig2.rows[0].cells[0]
    c1_adm = t_sig2.rows[0].cells[1]
    c0_adm.width = Cm(8.5)
    c1_adm.width = Cm(8.5)
    add_p(c1_adm, "ลงชื่อ .......................................................", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=2, space_after=1)
    add_p(c1_adm, "(.......................................................)", size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(c1_adm, "ตำแหน่ง .......................................................", size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=1)
    add_p(c1_adm, "............/............../..............", size=13, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=0, space_after=0)
    
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

def cleanup_old_files():
    print("กำลังทำความสะอาดไฟล์ ม.2 และไฟล์หน่วยเดิมในโฟลเดอร์ ส่งวิชาการ 2 2569...")
    for f in os.listdir(TARGET_DIR):
        if "ศ22102" in f or "ดนตรี2" in f or "หน่วยการเรียนรู้ที่_2" in f:
            fp = os.path.join(TARGET_DIR, f)
            try:
                os.remove(fp)
                print(f"  ลบไฟล์เก่า: {f}")
            except Exception as e:
                print(f"  ไม่สามารถลบ {f}: {e}")

def main():
    print("=== เริ่มการสร้างเอกสารวิชาการ 2/2569 สำหรับชั้น ม.1 (ศ21101 ดนตรี 1) ===")
    
    # 0. ลบไฟล์เดิมที่ไม่เกี่ยวข้อง
    cleanup_old_files()
    
    # 1. หน้าปกรวม (1 หน้า PDF)
    print("\n1. กำลังสร้าง หน้าปกรวม ม.1...")
    cover_docx = build_cover_doc_m1()
    cover_pdf = os.path.join(TARGET_DIR, "01_ไฟล์หน้าปกรวม_ส่งงานวิชาการ_2_2569_ศ21101_ดนตรี1.pdf")
    convert_docx_to_pdf(cover_docx, cover_pdf)
    if os.path.exists(cover_docx):
        os.remove(cover_docx)
        print("ลบไฟล์ .docx หน้าปกรวม คงเหลือเฉพาะไฟล์ .pdf ตามข้อกำหนดเรียบร้อย")
        
    # 2. โครงสร้างหลักสูตรรายวิชา วก.3 (Word + PDF)
    print("\n2. กำลังสร้าง โครงสร้างหลักสูตรรายวิชา (วก.3 ม.1)...")
    wk3_docx = build_wk3_doc_m1()
    wk3_pdf = os.path.join(TARGET_DIR, "02_วก3_โครงสร้างรายวิชา_ศ21101_ดนตรี1.pdf")
    convert_docx_to_pdf(wk3_docx, wk3_pdf)
    
    # 3. หน่วยการเรียนรู้ตามหลักสูตรรายวิชา วก.4 หน่วยที่ 1 (Word + PDF)
    print("\n3. กำลังสร้าง หน่วยการเรียนรู้ตามหลักสูตรรายวิชา (วก.4 หน่วยที่ 1 ม.1)...")
    wk4_docx = build_wk4_doc_m1()
    wk4_pdf = os.path.join(TARGET_DIR, "03_วก4_หน่วยการเรียนรู้ที่_1_พื้นฐานโน้ตและทักษะปฏิบัติคาลิมบ้า.pdf")
    convert_docx_to_pdf(wk4_docx, wk4_pdf)
    
    # 4. แผนการจัดการเรียนรู้รายชั่วโมง วก.5 แผนที่ 02 (1 ไฟล์ PDF)
    print("\n4. กำลังสร้าง แผนการจัดการเรียนรู้รายชั่วโมง (วก.5 หน่วยที่ 1 แผนที่ 02 ม.1)...")
    wk5_docx = build_wk5_doc_m1()
    wk5_pdf = os.path.join(TARGET_DIR, "04_วก5_แผนการจัดการเรียนรู้_แผนที่_02.pdf")
    convert_docx_to_pdf(wk5_docx, wk5_pdf)
    if os.path.exists(wk5_docx):
        os.remove(wk5_docx)
        print("ลบไฟล์ .docx วก.5 คงเหลือเฉพาะไฟล์ .pdf ตามข้อกำหนดเรียบร้อย")
        
    print("\n=== การสร้างเอกสาร ม.1 เสร็จสมบูรณ์ทุกรายการ! ===")

if __name__ == "__main__":
    main()
