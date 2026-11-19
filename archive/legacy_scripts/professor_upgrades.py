import os

# 1. Update generate_wk3_exact.py
with open('generate_wk3_exact.py', 'r', encoding='utf-8') as f:
    c3 = f.read()

c3 = c3.replace('"สอบปฏิบัติเพลงสั้น"', '"บันทึกคลิปวิดีโอปฏิบัติเดี่ยว (Digital Portfolio)"')
c3 = c3.replace('"สอบปฏิบัติรวมวงเพลงท้องถิ่น"', '"การจัดแสดงดนตรีรวมวงขนาดย่อม (Mini-Recital)"')
c3 = c3.replace('"การนำเสนอหน้าชั้นเรียน"', '"เขียนบทวิจารณ์ดนตรีและจัดทำ Digital Playlist"')

with open('generate_wk3_exact.py', 'w', encoding='utf-8') as f:
    f.write(c3)

# 2. Update generate_wk4_unit1.py
with open('generate_wk4_unit1.py', 'r', encoding='utf-8') as f:
    c4u1 = f.read()

c4u1 = c4u1.replace('"สอบปฏิบัติเพลงสั้น"', '"บันทึกคลิปวิดีโอปฏิบัติเดี่ยว (Digital Portfolio) พร้อมเขียนวิเคราะห์ข้อบกพร่องตนเองผ่านแอป MusicSmart"')
c4u1 = c4u1.replace('"K: อ่านโน้ตได้\\nP: เล่นสเกลได้\\nA: สนุกสนาน"', '"K: อธิบายหลักการอ่านโน้ต\\nP: ปฏิบัติสเกลอย่างแม่นยำ\\nA: สนุกสนาน"')
c4u1 = c4u1.replace('"K: จำโน้ตได้\\nP: เล่นเพลงสั้นได้\\nA: ภูมิใจ"', '"K: วิเคราะห์โครงสร้างเพลง\\nP: แสดงทักษะตามหลักสรีรวิทยา\\nA: ภูมิใจในผลงาน"')

with open('generate_wk4_unit1.py', 'w', encoding='utf-8') as f:
    f.write(c4u1)

# 3. Update generate_wk4_units234.py
with open('generate_wk4_units234.py', 'r', encoding='utf-8') as f:
    c4u2 = f.read()

# Unit 2 modifications
old_u2_concept = '"การบรรเลงเครื่องดนตรีรวมวงต้องอาศัยทักษะความสามัคคี และส่งเสริมศิลปวัฒนธรรมท้องถิ่น"'
new_u2_concept = '"การบรรเลงเครื่องดนตรีรวมวงเพลงท้องถิ่น เป็นการถ่ายทอดอารมณ์เพลงเบื้องต้น ก่อนนำไปสู่การวิเคราะห์รากเหง้าทางประวัติศาสตร์ ต้องอาศัยทักษะความสามัคคี"'
c4u2 = c4u2.replace(old_u2_concept, new_u2_concept)
c4u2 = c4u2.replace('"สอบปฏิบัติรวมวงเพลงท้องถิ่น"', '"การจัดแสดงดนตรีรวมวงขนาดย่อม (Mini-Recital) เพลงพื้นบ้านพะเยาประยุกต์ พร้อมรับการวิพากษ์ (Peer Critique)"')
c4u2 = c4u2.replace('"K: รู้หน้าที่\\nP: เล่นเข้าจังหวะ\\nA: สามัคคี"', '"K: วิเคราะห์หน้าที่ในวง\\nP: ปฏิบัติรวมวงและสอดประสานได้อย่างแม่นยำ\\nA: สามัคคี"')

# Unit 4 modifications
c4u2 = c4u2.replace('"การนำเสนอหน้าชั้นเรียน"', '"การเขียนบทวิจารณ์ดนตรีเชิงสุนทรียศาสตร์ และจัดทำ Digital Playlist เผยแพร่บนแอป MusicSmart"')
c4u2 = c4u2.replace('"K: บอกอารมณ์เพลง\\nP: วาดภาพสื่ออารมณ์\\nA: สุนทรียะ"', '"K: วิเคราะห์และตีความอารมณ์เพลง\\nP: ถ่ายทอดอารมณ์เพลงผ่านศิลปะ\\nA: สุนทรียะ"')
c4u2 = c4u2.replace('"K: รู้หลักวิจารณ์\\nP: วิจารณ์เพลงได้\\nA: ยอมรับความเห็นต่าง"', '"K: อธิบายหลักสุนทรียศาสตร์\\nP: ประเมินคุณภาพงานดนตรี\\nA: ยอมรับความเห็นต่าง"')

with open('generate_wk4_units234.py', 'w', encoding='utf-8') as f:
    f.write(c4u2)

print("done")
