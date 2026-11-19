import os

# 1. Update generate_wk3_exact.py
with open('generate_wk3_exact.py', 'r', encoding='utf-8') as f:
    c3 = f.read()
# Replace the scoring in the units list
c3 = c3.replace("'คะแนน': 20", "'คะแนน': '20\\n(K=5, P=10, A=5)'")
with open('generate_wk3_exact.py', 'w', encoding='utf-8') as f:
    f.write(c3)

# 2. Update generate_wk4_unit1.py
with open('generate_wk4_unit1.py', 'r', encoding='utf-8') as f:
    c4u1 = f.read()
c4u1 = c4u1.replace('add_p("   เวลา 4 ชั่วโมง  คะแนน 20 คะแนน")', 'add_p("   เวลา 4 ชั่วโมง  คะแนน 20 คะแนน (แบ่งเป็น K=5, P=10, A=5)")')
with open('generate_wk4_unit1.py', 'w', encoding='utf-8') as f:
    f.write(c4u1)

# 3. Update generate_wk4_units234.py
with open('generate_wk4_units234.py', 'r', encoding='utf-8') as f:
    c4u2 = f.read()
c4u2 = c4u2.replace('add_p(f"   เวลา {hours} ชั่วโมง  คะแนน 20 คะแนน")', 'add_p(f"   เวลา {hours} ชั่วโมง  คะแนน 20 คะแนน (แบ่งเป็น K=5, P=10, A=5)")')
c4u2 = c4u2.replace('"ขั้นนำ: ชวนคิดเรื่องพะเยา\\nขั้นสอน: บันทึกเสียง Podcast\\nขั้นสรุป: นำเสนอผ่านแอป"', '"ขั้นนำ: ชวนคิดเรื่องพะเยา\\nขั้นสอน: บูรณาการทำ Podcast ผ่านฟีเจอร์อัดเสียงในแอป (ลดภาระงาน)\\nขั้นสรุป: นำเสนอผ่านแอป"')
c4u2 = c4u2.replace('"ขั้นนำ: แนะนำเกณฑ์\\nขั้นสอน: ฝึกวิจารณ์\\nขั้นสรุป: แลกเปลี่ยน"', '"ขั้นนำ: แนะนำเกณฑ์สุนทรียภาพ\\nขั้นสอน: จัดทำ Playlist เพลงแบบ Real-time บนแอปในชั่วโมงเรียน\\nขั้นสรุป: แลกเปลี่ยนวิจารณ์"')
with open('generate_wk4_units234.py', 'w', encoding='utf-8') as f:
    f.write(c4u2)

# 4. Update generate_wk5_u1_p1.py
with open('generate_wk5_u1_p1.py', 'r', encoding='utf-8') as f:
    c5 = f.read()
c5 = c5.replace('add_p("   4. ครูสาธิตวิธีการจับเครื่องที่ถูกต้อง และการใช้ค้อนจูนเสียงคู่กับฟีเจอร์ Tuner ในแอปพลิเคชัน")',
                'add_p("   4. นักเรียนศึกษาการจับเครื่องและจูนเสียงจาก Interactive 3D Model บน MusicSmart App โดยครูเป็นโค้ช (Facilitator) ปรับสรีระรายบุคคล")')
c5 = c5.replace('add_p("   1. ครูบรรเลงเปียโนหรือเปิดคลิปเสียงคาลิมบ้าผ่าน MusicSmart App ให้นักเรียนฟัง")',
                'add_p("   1. นักเรียนรับชมคลิปสาธิตการเล่นระดับมืออาชีพผ่าน MusicSmart App เพื่อร่วมกันวิเคราะห์การเกิดเสียง (Inquiry-based)")')
with open('generate_wk5_u1_p1.py', 'w', encoding='utf-8') as f:
    f.write(c5)

print("done")
