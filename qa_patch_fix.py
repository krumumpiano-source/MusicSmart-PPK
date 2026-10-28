import os
from docx import Document
from docx.shared import Pt
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

def patch_plan_act_conclude(docx_path, new_conclude_step, output_path):
    """Read existing doc, find act_conclude section and append/replace E- step."""
    doc = Document(docx_path)
    
    # Find and replace the E- step in act_conclude
    for i, para in enumerate(doc.paragraphs):
        clean = para.text.replace('\u200B', '').strip()
        if clean.startswith('E -') and 'ขั้นสรุปบทเรียน' in ''.join(
            [p.text.replace('\u200B','') for p in doc.paragraphs[max(0,i-5):i]]):
            # Replace run text
            for run in para.runs:
                run.text = ''
            if para.runs:
                para.runs[0].text = insert_zws(new_conclude_step)
                set_font(para.runs[0])
            break
    
    doc.save(output_path)

# --- Surgical patches for plans 6, 13, 17 ---

# PLAN 6: Add concrete SDL - students log material choices as personal reference
def patch_plan6():
    path = "วก5_คศ4_InventAndTransform_แผนที่_06.docx"
    doc = Document(path)
    for i, para in enumerate(doc.paragraphs):
        clean = para.text.replace('\u200B', '').strip()
        if 'บันทึกผลการทดลองเรื่องคุณภาพเสียง' in clean:
            for run in para.runs:
                run.text = ''
            new_text = insert_zws('E - 4. นักเรียนบันทึกผลการทดลองเสียงของวัสดุแต่ละชนิดลงใน Digital Log ของตนเอง (Self-Directed Goal Setting) และเขียนเหตุผลว่าจะ "เลือกใช้วัสดุชนิดใดในวันสอบจริง และทำไม" เพื่อนำ Action Plan นี้ไปปรับปรุงชิ้นงาน')
            if para.runs:
                para.runs[0].text = new_text
                set_font(para.runs[0])
            else:
                run = para.add_run(new_text)
                set_font(run)
            break
    doc.save(path)
    print("Patched Plan 6")

# PLAN 13: Add SDL - students set personal research agenda
def patch_plan13():
    path = "วก5_คศ4_InventAndTransform_แผนที่_13.docx"
    doc = Document(path)
    for i, para in enumerate(doc.paragraphs):
        clean = para.text.replace('\u200B', '').strip()
        if 'บันทึกข้อค้นพบลงใน Digital Portfolio' in clean:
            for run in para.runs:
                run.text = ''
            new_text = insert_zws('E - 4. นักเรียนบันทึกข้อค้นพบลงใน Digital Portfolio และกำหนดเป้าหมายการเรียนรู้ส่วนตัว (Self-Directed) ว่าจะสืบค้นดนตรียุคใดเพิ่มเติมก่อนทำ Podcast ในคาบหน้า พร้อมระบุเหตุผลที่เลือก')
            if para.runs:
                para.runs[0].text = new_text
                set_font(para.runs[0])
            else:
                run = para.add_run(new_text)
                set_font(run)
            break
    doc.save(path)
    print("Patched Plan 13")

# PLAN 17: Add SDL - students set personal growth target from feedback
def patch_plan17():
    path = "วก5_คศ4_InventAndTransform_แผนที่_17.docx"
    doc = Document(path)
    for i, para in enumerate(doc.paragraphs):
        clean = para.text.replace('\u200B', '').strip()
        if 'ผู้ถูกวิจารณ์อ่านคำวิจารณ์' in clean:
            for run in para.runs:
                run.text = ''
            new_text = insert_zws('E - 4. ผู้ถูกวิจารณ์อ่านคำวิจารณ์ และให้คะแนนความสร้างสรรค์กลับ (Feedback Loop 2 ทาง) จากนั้นแต่ละคนนำคำวิจารณ์ที่ได้รับมาตั้งเป้าหมายพัฒนาผลงานชิ้นต่อไปของตนเองในแอป (Self-Directed Goal Setting) ว่าจะปรับปรุงจุดใดเป็นพิเศษ')
            if para.runs:
                para.runs[0].text = new_text
                set_font(para.runs[0])
            else:
                run = para.add_run(new_text)
                set_font(run)
            break
    doc.save(path)
    print("Patched Plan 17")

patch_plan6()
patch_plan13()
patch_plan17()
print("\nQA Patch Complete. Plans 6, 13, 17 updated in-place.")
