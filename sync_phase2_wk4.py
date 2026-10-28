"""
PHASE 2: อัปเกรด วก.4 (ทั้ง 4 หน่วย) ให้สอดคล้องกับ วก.5 คศ.4
สิ่งที่เพิ่ม/แก้ไข:
  - อัปเกรดคำกริยา K-P-A ในตารางแผนการสอนให้ใช้ Higher-Order Thinking
  - เพิ่ม Constructivism + Self-Directed Learning markers ในช่องกิจกรรม
  - Sync ภาระงานรวบยอดให้ตรงกับ วก.5 คศ.4
  - เพิ่ม Backward Design / Essential Question ในหน่วย 2, 3, 4 ที่ยังขาด
"""
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from copy import deepcopy
import glob

ZWS = chr(0x200B)

def clean(t):
    for z in [chr(0x200B), chr(0x200C), chr(0x200D)]: t = t.replace(z, '')
    return t.strip()

def zws(t):
    return ZWS.join(list(t))

def set_font(run, bold=False, size=15):
    run.font.name = 'TH Sarabun New'
    run.font.size = Pt(size)
    run.bold = bold
    r = run._element
    r.rPr.rFonts.set(qn('w:eastAsia'), 'TH Sarabun New')
    r.rPr.rFonts.set(qn('w:cs'), 'TH Sarabun New')

def replace_para_text(para, new_text, bold=False, size=15):
    for run in para.runs:
        run.text = ''
    if para.runs:
        para.runs[0].text = zws(new_text)
        set_font(para.runs[0], bold=bold, size=size)
    else:
        r = para.add_run(zws(new_text))
        set_font(r, bold=bold, size=size)

# Unit-specific upgrade data
unit_upgrades = {
    '1': {
        'essential_q': 'เสียงคาลิมบ้าที่ดีเกิดขึ้นได้อย่างไร? และนักเรียนสามารถสร้างความรู้เรื่องสรีรวิทยาดนตรีด้วยตนเองได้หรือไม่?',
        'constructivism_line': 'นักเรียนทดลองค้นพบด้วยตนเอง (Construct Knowledge) ก่อนครูยืนยันด้วย 3D Model บน MusicSmart App และตั้งเป้าหมายส่วนบุคคล (Self-Directed Goal Setting) ใน Digital Dashboard',
        'kpa_upgrades': {
            'แผน 1': ('อธิบายความสัมพันธ์ระหว่างสรีระกับการเกิดเสียง Resonance ได้', 'ประยุกต์ใช้หลักสรีรวิทยาเพื่อปรับสรีระและสอนเพื่อน (Peer Coaching)', 'รับผิดชอบต่อเครื่องดนตรีและกำกับการเรียนรู้ตนเอง'),
            'แผน 2': ('วิเคราะห์ตรรกะการสร้างสัญลักษณ์แทนเสียง', 'ประยุกต์สร้างสัญลักษณ์โน้ตด้วยตนเองก่อนเชื่อมโยงกับระบบสากล', 'มุ่งมั่นในการสร้างความเข้าใจด้วยตนเอง'),
            'แผน 3': ('วิเคราะห์ทิศทางเสียงและความสัมพันธ์กับกล้ามเนื้อนิ้ว', 'ควบคุมกล้ามเนื้อมัดเล็กและนำข้อมูล Metronome Analytics มาพัฒนาตนเอง', 'มีวินัยในการซ้อมและกำกับตนเอง'),
            'แผน 4': ('สังเคราะห์โครงสร้างทำนองและวิเคราะห์ท่อนยาก', 'ออกแบบกระบวนการซ้อมแก้ปัญหาด้วยตนเองและบันทึก Digital Portfolio', 'ภาคภูมิใจในผลงานและสะท้อนคิดการเรียนรู้'),
        },
        'capstone': 'Digital Portfolio (คลิปวิดีโอการบรรเลงเดี่ยว + Self-Reflection Note) และ Personal Goal Setting Dashboard บน MusicSmart App',
    },
    '2': {
        'essential_q': 'เสียงหลายชิ้นจะรวมเป็นหนึ่งเดียวได้อย่างไร? และกระบวนการวิจารณ์ช่วยยกระดับการแสดงได้จริงหรือ?',
        'constructivism_line': 'นักเรียนทดลองรวมวงแบบอิสระก่อน (Chaos → Construct) เพื่อค้นพบความสำคัญของการแบ่งหน้าที่ด้วยตนเอง และใช้ Peer Critique บน MusicSmart App เป็น Feedback Loop ในแต่ละคาบ',
        'kpa_upgrades': {
            'แผน 5': ('วิเคราะห์สัดส่วนและความสำคัญของแต่ละหน้าที่ในวง', 'ทดลองรวมวงอิสระ วิเคราะห์ปัญหา และออกแบบแผนแบ่งหน้าที่', 'เคารพสิทธิและฟังผู้อื่นในกลุ่ม'),
            'แผน 6': ('ออกแบบและวิเคราะห์รูปแบบจังหวะเชิงอะคูสติก', 'สร้างสรรค์เครื่องประกอบจังหวะจากวัสดุรอบตัวโดยมีเหตุผลทางวิทยาศาสตร์รองรับ', 'เห็นคุณค่าสิ่งของรอบตัวตามปรัชญาเศรษฐกิจพอเพียง'),
            'แผน 7': ('ระบุปัญหาเชิงเทคนิคและเสนอวิธีแก้ไขเชิงสร้างสรรค์', 'นำกระบวนการ Peer Coaching มาพัฒนาทักษะการซ้อมกลุ่ม', 'มีจิตอาสาและรับผิดชอบต่อความสำเร็จของกลุ่ม'),
            'แผน 8': ('วิเคราะห์ความคลาดเคลื่อนของจังหวะรวมและวางแผนแก้ไข', 'คิดค้นสัญลักษณ์การสื่อสารภายในวงและใช้ AI Feedback จากแอป', 'อดทนต่อความผิดพลาดและมุ่งมั่นพัฒนา'),
            'แผน 9': ('ประเมินสมดุลความดัง-เบา (Dynamic) ของวงด้วยข้อมูล Decibel Meter', 'ค้นหาจุดสมดุลเสียงของวงด้วยตนเองและสอดประสานกับสมาชิก', 'เคารพพื้นที่ทางเสียงของเพื่อน'),
            'แผน 10': ('สังเคราะห์เกณฑ์ประเมินคุณภาพการแสดง', 'บรรเลงรวมวงได้อย่างมีสุนทรียภาพและสอดประสานเป็นหนึ่งเดียว', 'กล้าแสดงออกและรับฟังคำวิจารณ์อย่างเปิดกว้าง'),
            'แผน 11': ('สังเคราะห์เกณฑ์ประเมินคุณภาพการแสดง', 'บรรเลงรวมวงสอดประสานได้ไพเราะและนำ Feedback ไปตั้ง Action Plan', 'ชื่นชมความสำเร็จของผู้อื่นและกำหนดเป้าหมายพัฒนาตนเองต่อ'),
        },
        'capstone': 'Mini-Recital (เพลงพื้นบ้านพะเยาประยุกต์รวมวง) + Peer Critique Real-time บน MusicSmart App + Group Action Plan Dashboard',
    },
    '3': {
        'essential_q': 'ดนตรีข้ามพรมแดนวัฒนธรรมได้อย่างไร? และเราจะเล่าเรื่องราวของเสียงนั้นให้โลกฟังด้วยเทคโนโลยีได้หรือไม่?',
        'constructivism_line': 'นักเรียนฟังเสียงและคิดค้นเกณฑ์จัดกลุ่มวงดนตรีด้วยตนเอง (Construct Knowledge) ก่อนที่ครูจะเฉลย และสร้าง Podcast โดยนำทักษะปฏิบัติจากหน่วย 1 มาบูรณาการเป็น Background Music ด้วยตนเอง (Self-Directed)',
        'kpa_upgrades': {
            'แผน 12-13: ประเภทวง': ('วิเคราะห์และสร้างเกณฑ์จัดกลุ่มวงดนตรีไทย-สากลด้วยตนเอง', 'จำแนกเสียงและเชื่อมโยงข้อมูลเพื่อสร้าง Mind Map ดิจิทัล', 'ตระหนักในมรดกวัฒนธรรมและเปิดรับความหลากหลาย'),
            'แผน 14: ดนตรีต่างวัฒนธรรม': ('สังเคราะห์ความเชื่อมโยงระหว่างวัฒนธรรมและเสียงดนตรี', 'ออกแบบและร่างสคริปต์ Podcast กำหนดกลุ่มเป้าหมายผู้ฟังด้วยตนเอง', 'เคารพความแตกต่างทางวัฒนธรรมและสื่อสารอย่างมีจริยธรรม'),
            'แผน 15: อิทธิพลดนตรีล้านนา': ('ประเมินผลกระทบของสื่อดนตรีดิจิทัลต่อสังคม', 'ผลิต Podcast ผสมเสียงคาลิมบ้าของตนเองเป็น BGM และเผยแพร่บน MusicSmart Community', 'ใช้เทคโนโลยีสื่อสารอย่างรับผิดชอบและสร้างสรรค์'),
        },
        'capstone': 'Digital Audio Guide / Podcast (เสียงบรรยาย + BGM คาลิมบ้าที่บรรเลงเอง) เผยแพร่บน MusicSmart Community',
    },
    '4': {
        'essential_q': 'ดนตรีพูดกับความรู้สึกของเราอย่างไร? และการจัด Playlist คือการนิยามตัวตนของเราผ่านเสียงได้จริงหรือ?',
        'constructivism_line': 'นักเรียนนำ Live Poll Data จากแอปมาสร้างสมมติฐานทางจิตวิทยาดนตรีด้วยตนเอง (Construct Knowledge) และสร้าง "เกณฑ์วิจารณ์ดนตรีฉบับห้องเรียน" ก่อนจะไปอ้างอิงมาตรฐานสากล',
        'kpa_upgrades': {
            'แผน 16: รับรู้อารมณ์เพลง': ('วิเคราะห์องค์ประกอบดนตรีที่ทำให้เกิดอารมณ์โดยอ้างอิงข้อมูล Live Poll', 'ใช้ข้อมูล Real-time สร้างสมมติฐานทางจิตวิทยาดนตรีและนำเสนอ', 'มีสุนทรียภาพละเมียดละไมและเปิดรับการฟังอย่างลึกซึ้ง'),
            'แผน 17: หลักการวิจารณ์': ('สังเคราะห์เกณฑ์วิจารณ์ดนตรีด้วยตนเองโดยใช้หลักสุนทรียศาสตร์', 'เขียนวิจารณ์ผลงานดนตรีของเพื่อนอย่างเฉียบคมและรับ Feedback 2 ทาง', 'ยอมรับความเห็นต่างทางศิลปะอย่างมีวุฒิภาวะ'),
            'แผน 18: นำเสนอเพลงชื่นชอบ': ('สังเคราะห์แนวคิด (Theme) ในการ Curate Digital Playlist', 'จัด Playlist สะท้อนอัตลักษณ์ส่วนตัว บูรณาการผลงานตนเอง และแชร์สู่ MusicSmart Community', 'ภาคภูมิใจในรสนิยมทางศิลปะและร่วมสร้าง Digital Community ของโรงเรียน'),
        },
        'capstone': 'Digital Playlist Curation (Theme พร้อมผลงานตนเอง 1 ชิ้น) + บทวิจารณ์ดนตรีเชิงสุนทรียศาสตร์ เผยแพร่บน MusicSmart Community',
    },
}

src_files = sorted(glob.glob('หน่วยการเรียนรู้_วก4_หน่วยที่*.docx'))

for i, src_path in enumerate(src_files):
    unit_key = str(i + 1)
    upgrades = unit_upgrades.get(unit_key, {})
    dst_path = src_path.replace('หน่วยการเรียนรู้_วก4_', 'วก4_คศ4_InventAndTransform_หน่วยที่')
    dst_path = dst_path.replace('_สมบูรณ์.docx', '.docx')

    doc = Document(src_path)
    patched = []

    for para in doc.paragraphs:
        t = clean(para.text)

        # PATCH A: Add/upgrade Essential Question
        if 'คำถามสำคัญ' in t and 'Essential Question' not in t and upgrades.get('essential_q'):
            replace_para_text(para, f'2.2 คำถามสำคัญ (Essential Question): {upgrades["essential_q"]}', size=15)
            patched.append('Essential Question')

        # PATCH B: Add Constructivism/SDL line in กิจกรรม section
        if 'T-PACE Framework' in t and 'Constructivism' not in t and upgrades.get('constructivism_line'):
            replace_para_text(para, 
                f'การจัดการเรียนรู้เชิงรุก (Active Learning) ด้วยรูปแบบนวัตกรรม T-PACE Framework '
                f'ควบคู่กับ MusicSmart App โดยใช้หลัก Constructivism และ Self-Directed Learning: '
                f'{upgrades["constructivism_line"]}', size=15)
            patched.append('Constructivism/SDL')

        # PATCH C: Upgrade capstone/ภาระงาน
        if ('ชิ้นงาน' in t or 'ภาระงาน' in t) and ('Digital Portfolio' not in t and 'Mini-Recital' not in t and 'Podcast' not in t and 'Playlist' not in t) and upgrades.get('capstone'):
            # This is the header, add capstone in next para if exists
            pass

    # PATCH D: Upgrade KPA table in doc
    for tbl in doc.tables:
        hdr_cells = [clean(c.text) for c in tbl.rows[0].cells] if tbl.rows else []
        hdr_str = ' '.join(hdr_cells)
        if 'จุดประสงค์' in hdr_str or 'K,P,A' in hdr_str or ('แผนที่' in hdr_str and 'ชิ้นงาน' in hdr_str):
            for row in tbl.rows[1:]:
                cells = row.cells
                if len(cells) < 2: continue
                plan_label = clean(cells[0].text)
                # Find matching KPA upgrade
                for plan_key, (k_text, p_text, a_text) in upgrades.get('kpa_upgrades', {}).items():
                    if plan_key.split(':')[0].strip() in plan_label or plan_label in plan_key:
                        # Column 1 = KPA
                        kpa_cell = cells[1]
                        kpa_cell.paragraphs[0].clear()
                        r1 = kpa_cell.paragraphs[0].add_run(zws(f'K: {k_text}'))
                        set_font(r1, size=13)
                        p2 = kpa_cell.add_paragraph()
                        r2 = p2.add_run(zws(f'P: {p_text}'))
                        set_font(r2, size=13)
                        p3 = kpa_cell.add_paragraph()
                        r3 = p3.add_run(zws(f'A: {a_text}'))
                        set_font(r3, size=13)
                        patched.append(f'KPA-{plan_label[:20]}')
                        break

    # PATCH E: Add capstone task to ชิ้นงาน section
    for para in doc.paragraphs:
        t = clean(para.text)
        if t.startswith('6. ชิ้นงาน') or t.startswith('6.ชิ้นงาน'):
            # Find next paragraph and upgrade it
            idx = list(doc.paragraphs).index(para)
            if idx + 1 < len(doc.paragraphs):
                next_para = doc.paragraphs[idx + 1]
                nt = clean(next_para.text)
                if upgrades.get('capstone') and 'Digital Portfolio' not in nt and 'Mini-Recital' not in nt:
                    replace_para_text(next_para, upgrades['capstone'], size=15)
                    patched.append('Capstone Task')
            break

    doc.save(dst_path)
    print(f'✅ หน่วยที่ {unit_key}: บันทึก [{dst_path}] | Patches: {patched}')

print('\n✅ PHASE 2 COMPLETE: อัปเกรด วก4 ทั้ง 4 หน่วย')
print('ไฟล์ต้นฉบับทั้ง 4 ไม่ถูกเขียนทับ')
