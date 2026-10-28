"""
PHASE 3: Patch วก.5 keyword alignment (14 แผนที่ขาด keywords เชิงบริบท)
แก้แบบ Context-Aware ไม่ใช่แค่แปะคำ:
  - หน่วย 2: แผน 05-11 เพิ่มการอ้างอิง Mini-Recital และ สอดประสาน ในบริบทที่เหมาะสม
  - หน่วย 3: แผน 12-15 เพิ่ม Podcast/วัฒนธรรม/Audio ในบริบทที่เหมาะสม
  - หน่วย 4: แผน 16-17 เพิ่ม Playlist ในบริบทที่เหมาะสม
  - Goal Setting: แผน 02, 04 เพิ่ม Goal Setting ในขั้น E
หมายเหตุ: ไม่เขียนทับไฟล์ (แก้ in-place เพราะไฟล์เหล่านี้คือ "วก5_คศ4_InventAndTransform" ซึ่งเป็นเวอร์ชัน คศ.4 แล้ว)
"""
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn

ZWS = chr(0x200B)

def clean(t):
    for z in [chr(0x200B), chr(0x200C), chr(0x200D)]: t = t.replace(z, '')
    return t.strip()

def zws(t): return ZWS.join(list(t))

def set_font(run, size=16):
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(size)
    r = run._element
    r.rPr.rFonts.set(qn('w:eastAsia'), 'TH Sarabun New')
    r.rPr.rFonts.set(qn('w:cs'), 'TH Sarabun New')

def patch_para(doc, search_fragment, new_text):
    """Replace paragraph containing search_fragment with new_text."""
    for para in doc.paragraphs:
        t = clean(para.text)
        if search_fragment in t:
            for run in para.runs:
                run.text = ''
            if para.runs:
                para.runs[0].text = zws(new_text)
                set_font(para.runs[0])
            else:
                r = para.add_run(zws(new_text))
                set_font(r)
            return True
    return False

# =====================================================================
# PATCH MAP: {plan_num: [(search_fragment, new_text), ...]}
# =====================================================================
patches = {
    # หน่วย 1: เพิ่ม Goal Setting ที่ขาดใน E-step
    2: [
        ('ระบบวิเคราะห์ Note-reading speed ทันที',
         'E - 4. ระบบวิเคราะห์ Note-reading speed ทันที นักเรียนนำข้อมูลมาตั้งเป้าหมายส่วนบุคคล '
         '(Self-Directed Goal Setting) ว่าจะลดเวลาการอ่านโน้ตในแต่ละตำแหน่งลงกี่วินาที '
         'และบันทึก Action Plan ลงใน Dashboard เพื่อเตรียมความพร้อมสำหรับ Mini-Recital ในหน่วยที่ 2'),
    ],
    4: [
        ('บันทึกผลงานเป็น Digital Portfolio',
         'E - 4. บันทึกผลงานเป็น Digital Portfolio ลงในระบบ MusicSmart (Goal Setting) '
         'และเขียน Self-Reflection สั้นๆ วิเคราะห์ว่าท่อนใดที่ยังต้องพัฒนาก่อนเข้าสู่การแสดง Mini-Recital '
         'ในหน่วยการเรียนรู้ที่ 2 พร้อมวางแผน Action Plan ส่วนตัว'),
    ],

    # หน่วย 2: เพิ่ม context Mini-Recital + สอดประสาน
    5: [
        ('ประเมินความชัดเจนของหน้าที่ตนเอง',
         'E - 4. ประเมินความชัดเจนของหน้าที่ตนเอง (Self-Directed) และวางแผนการซ้อมสอดประสาน '
         'ร่วมกันในคาบต่อไป โดยตั้งเป้าหมายกลุ่มว่าจะพร้อม Mini-Recital ได้ภายในกี่คาบ'),
    ],
    6: [
        ('บันทึกผลการทดลองเรื่องคุณภาพเสียงของวัสดุ',
         'E - 4. บันทึกผลการทดลองเสียงของวัสดุแต่ละชนิดลงใน Digital Log (Self-Directed Goal Setting) '
         'เพื่อตัดสินใจเลือกเครื่องประกอบจังหวะที่สอดประสานกับเสียงคาลิมบ้าในวันแสดง Mini-Recital '
         'โดยให้เหตุผลเชิงอะคูสติกประกอบการตัดสินใจ'),
    ],
    7: [
        ('กดประเมินความสำเร็จของ Micro-goal ในแอป',
         'E - 4. กดประเมินความสำเร็จของ Micro-goal ในแอป และวางแผน Action Plan ว่าจะซ้อมสอดประสาน '
         'ส่วนใดเพิ่มเติมก่อน Mini-Recital โดยบันทึกจุดที่ต้อง Peer Coach เพื่อนให้ได้ในคาบถัดไป'),
    ],
    8: [
        ('อัดเสียงซ้อม ส่งเข้าระบบ AI',
         'E - 4. อัดเสียงซ้อมสอดประสานรวมวง ส่งเข้าระบบ AI ของแอปเพื่อเช็ค % ความตรงจังหวะ '
         'นำ Data มาตั้งเป้าหมายกลุ่ม (Group Goal Setting) ว่าจะลดความผิดพลาดลงเท่าไรก่อนซ้อม Mini-Recital ครั้งสุดท้าย'),
    ],
    9: [
        ('บันทึกระดับ Dynamic Map',
         'E - 4. บันทึก Dynamic Map ของวง (Goal Setting) ลงในแอป เพื่อใช้เป็นมาตรฐานสำหรับการบรรเลง '
         'สอดประสานในวัน Mini-Recital จริง และแต่ละคนบันทึกเป้าหมายส่วนตัวว่าจะควบคุมความดัง-เบาในช่วงใดเป็นพิเศษ'),
    ],
    10: [
        ('ผู้แสดงนำ Feedback จากเพื่อนและครู',
         'E - 4. ผู้แสดงนำ Feedback ที่ได้รับจาก Peer Critique ใน Mini-Recital มาสะท้อนคิด (Self-Reflection) '
         'และตั้งเป้าหมาย (Goal Setting) ว่าจะปรับปรุงการสอดประสานเสียงในกลุ่มอย่างไรในการแสดงครั้งถัดไป'),
    ],
    11: [
        ('ประกาศผล Data Analytics ภาพรวม',
         'E - 3. ประกาศผล Data Analytics ภาพรวมของห้อง และแต่ละคนเปิด Dashboard ตั้งเป้าหมาย '
         '(Self-Directed Goal Setting) ว่าจะพัฒนาทักษะการสอดประสานใน Mini-Recital ครั้งหน้าอย่างไร'),
    ],

    # หน่วย 3: เพิ่ม Podcast/วัฒนธรรม/Audio context
    12: [
        ('นักเรียนทำ Audio Quiz บนแอป',
         'E - 4. นักเรียนทำ Audio Quiz (ฟังเสียงจากวัฒนธรรมต่างๆ) บนแอป และนำผลคะแนนมาตั้งเป้าหมาย '
         '(Self-Directed Goal Setting) ว่าจะฝึกฟังเสียงเครื่องดนตรีวัฒนธรรมใดเพิ่มเติม '
         'เพื่อเตรียมพร้อมสำหรับการทำ Podcast สื่อสารข้ามวัฒนธรรมในคาบถัดไป'),
    ],
    13: [
        ('บันทึกข้อค้นพบลงใน Digital Portfolio',
         'E - 4. บันทึกข้อค้นพบเรื่องวิวัฒนาการดนตรีและความหลากหลายทางวัฒนธรรมลงใน Digital Portfolio '
         'และกำหนดเป้าหมาย (Self-Directed Goal Setting) ว่าจะสืบค้นดนตรียุคใดเพิ่มเติม '
         'พร้อมระบุแหล่ง Audio ที่จะนำไปใช้เป็นข้อมูลอ้างอิงใน Podcast ในคาบต่อไป'),
    ],
    15: [
        ('เผยแพร่ Podcast ลงระบบคลังความรู้',
         'E - 4. เผยแพร่ Podcast (Digital Audio Guide ที่บันทึกเสียง + BGM วัฒนธรรมดนตรี) '
         'ลงระบบคลัง MusicSmart Community นักเรียนดูยอดผู้ฟังและตั้งเป้าหมาย (Self-Directed Goal Setting) '
         'ว่าจะปรับปรุงคุณภาพ Audio หรือเนื้อหาเรื่องราวข้ามวัฒนธรรมในผลงานชิ้นต่อไปอย่างไร'),
    ],

    # หน่วย 4: เพิ่ม Playlist context
    16: [
        ('สรุปองค์ประกอบที่ทำให้อารมณ์เพลงเปลี่ยนไป',
         'E - 4. นักเรียนสรุปทฤษฎีกลไกทางอารมณ์ดนตรีลงในแอป และตั้งเป้าหมาย (Self-Directed Goal Setting) '
         'ว่าจะเลือกเพลงที่ให้อารมณ์แตกต่างออกไปไปฝึกฟัง เพื่อเตรียมคัดเลือกเพลงสำหรับ '
         'Digital Playlist Curation ในแผนที่ 18 ให้หลากหลายอารมณ์'),
    ],
    17: [
        ('ผู้ถูกวิจารณ์อ่านคำวิจารณ์ และให้คะแนนความสร้างสรรค์กลับ',
         'E - 4. ผู้ถูกวิจารณ์อ่านคำวิจารณ์และให้คะแนนความสร้างสรรค์กลับ (Feedback Loop 2 ทาง) '
         'จากนั้นแต่ละคนนำคำวิจารณ์ที่ดีที่สุดมาใช้เป็นเกณฑ์คัดเลือกเพลงสำหรับ Digital Playlist '
         'ในแผนที่ 18 พร้อมตั้งเป้าหมาย (Self-Directed Goal Setting) ว่า Playlist ของตนจะมี Theme ว่าอะไร'),
    ],
}

print('='*65)
print('  PHASE 3: Patch วก.5 keyword alignment (Context-Aware)')
print('='*65)

total_patched = 0
for plan_num, patch_list in patches.items():
    path = f'วก5_คศ4_InventAndTransform_แผนที่_{plan_num:02d}.docx'
    try:
        doc = Document(path)
        plan_patched = 0
        for search, new_text in patch_list:
            if patch_para(doc, search, new_text):
                plan_patched += 1
            else:
                print(f'  ⚠️  แผนที่ {plan_num:02d}: ไม่พบข้อความ [{search[:40]}...]')
        if plan_patched > 0:
            doc.save(path)
            total_patched += plan_patched
            print(f'  ✅ แผนที่ {plan_num:02d}: Patched {plan_patched} จุด → บันทึกแล้ว')
    except FileNotFoundError:
        print(f'  ❌ แผนที่ {plan_num:02d}: ไม่พบไฟล์ [{path}]')

print(f'\n✅ PHASE 3 COMPLETE: อัปเกรดรวม {total_patched} จุด ใน {len(patches)} แผน')
