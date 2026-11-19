import os
import sys
import re
import docx

sys.stdout.reconfigure(encoding='utf-8')

base = r'D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'

units = {
    1: {'title': 'พื้นฐานคาลิมบ้า', 'plans': range(1, 5)},
    2: {'title': 'ปฏิบัติรวมวงคาลิมบ้า', 'plans': range(5, 12)},
    3: {'title': 'รอบรู้วงดนตรีและวัฒนธรรม', 'plans': range(12, 16)},
    4: {'title': 'สุนทรียภาพแห่งการฟัง', 'plans': range(16, 19)}
}

def get_unit_info(plan_num):
    for u_num, data in units.items():
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

# -------------------------------------------------------------
# STEP 4: Update สื่อการสอน (18 files)
# -------------------------------------------------------------
print("--- Updating สื่อการสอน (18 files) ---")
media_dir = os.path.join(base, 'สื่อการสอน')
for f in sorted(os.listdir(media_dir)):
    if not f.endswith('.docx') or f.startswith('~$'):
        continue
    m = re.search(r'ผ(\d+)', f)
    if not m:
        continue
    p_num = int(m.group(1))
    u_num, u_title = get_unit_info(p_num)
    p_topic = plan_topics[p_num]
    
    fp = os.path.join(media_dir, f)
    doc = docx.Document(fp)
    
    p0_text = doc.paragraphs[0].text.strip()
    match_act = re.search(r':\s*(.*)$', p0_text)
    act_name = match_act.group(1).strip() if match_act else p0_text
    # If act_name starts with activity prefix, keep it clean
    
    # Check student info from existing paragraphs
    student_info = ""
    for p in doc.paragraphs[1:4]:
        t = p.text.strip()
        if any(kw in t for kw in ['ชื่อ:', 'ชื่อกลุ่ม:', 'ชื่อวง:', 'ชื่อ-สกุล', 'เพลงที่บรรเลง:']):
            student_info = t
            break
            
    if not student_info:
        student_info = "โรงเรียนพะเยาพิทยาคม  |  ชื่อ-สกุล: _________________________________________ เลขที่: _____ ห้อง: ม.1/_____"

    doc.paragraphs[0].text = f"สื่อการเรียนรู้ประกอบแผนการจัดการเรียนรู้ที่ {p_num}: {p_topic}"
    doc.paragraphs[1].text = f"หน่วยการเรียนรู้ที่ {u_num}: {u_title} | รายวิชา ดนตรี 1 (ศ21101) ชั้นมัธยมศึกษาปีที่ 1 ภาคเรียนที่ 1"
    
    # If doc has at least 3 paragraphs, put act_name + student_info in P2/P3
    if len(doc.paragraphs) > 2:
        # Check if P2 was empty or had student info
        if doc.paragraphs[2].text.strip() == "" or any(kw in doc.paragraphs[2].text for kw in ['วิชา:', 'ชื่อ', 'ภารกิจ', 'คำชี้แจง', '🎵', 'เพลง']):
            # Let's format P2 as: กิจกรรมหลัก: act_name
            # And P3 as student_info
            doc.paragraphs[2].text = f"กิจกรรมหลัก: {act_name}  |  {student_info}"
        else:
            doc.paragraphs[2].text = f"กิจกรรมหลัก: {act_name}  |  {student_info}\n{doc.paragraphs[2].text}"
            
    doc.save(fp)
    print(f"Updated media doc {p_num:02d}: {f}")

print("Media docs updated successfully.")

# -------------------------------------------------------------
# STEP 5: Update คู่มือการสอนสำหรับครู วก5 (18 files)
# -------------------------------------------------------------
print("\n--- Updating คู่มือการสอนสำหรับครู วก5 (18 files) ---")
tm_dir = os.path.join(base, 'คู่มือการสอนสำหรับครู', 'คู่มือครู ม.1 ดนตรี1 ศ21101', 'วก5')
for f in sorted(os.listdir(tm_dir)):
    if not f.endswith('.docx') or f.startswith('~$'):
        continue
    m = re.search(r'แผนที่_(\d+)', f)
    if not m:
        continue
    p_num = int(m.group(1))
    u_num, u_title = get_unit_info(p_num)
    p_topic = plan_topics[p_num]
    
    fp = os.path.join(tm_dir, f)
    doc = docx.Document(fp)
    
    doc.paragraphs[0].text = "คู่มือครูประจำแผนการจัดการเรียนรู้ (สอดคล้องตามแบบ วก.5)"
    doc.paragraphs[1].text = f"คู่มือการสอนสำหรับครู: แผนการจัดการเรียนรู้ที่ {p_num} เรื่อง {p_topic}"
    doc.paragraphs[2].text = (
        f"กลุ่มสาระการเรียนรู้ ศิลปะ (ดนตรี) ระดับมัธยมศึกษาตอนต้น โรงเรียนพะเยาพิทยาคม\n"
        f"รายวิชา ดนตรี 1 รหัสวิชา ศ21101 ชั้นมัธยมศึกษาปีที่ 1 | ภาคเรียนที่ 1 ปีการศึกษา 2569 | หน่วยการเรียนรู้ที่ {u_num}: {u_title}\n"
        f"เรื่อง {p_topic}          เวลา 50 นาที (1 คาบเรียน)"
    )
    
    doc.save(fp)
    print(f"Updated teacher manual {p_num:02d}: {f}")

print("\nAll steps completed successfully!")
