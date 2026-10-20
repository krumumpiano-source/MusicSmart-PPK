# -*- coding: utf-8 -*-
import os
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

base_dir = r'เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'
backup_dir = r'เอกสารแผนการสอน\_backups'

print("=== STARTING REORGANIZATION ===")

# 1. Clean temp lock files
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.startswith('~$'):
            fp = os.path.join(root, f)
            try:
                os.remove(fp)
                print(f"Removed temp lock file: {f}")
            except Exception as e:
                print(f"Could not remove {f}: {e}")

# 2. Archive 'แผนไฟล์เก่า' to _backups
old_plans = os.path.join(base_dir, 'แผนไฟล์เก่า')
if os.path.exists(old_plans):
    dest_old = os.path.join(backup_dir, 'แผนไฟล์เก่า_archived_20261016')
    if os.path.exists(dest_old):
        shutil.rmtree(dest_old)
    shutil.move(old_plans, dest_old)
    print("Archived 'แผนไฟล์เก่า' to _backups/แผนไฟล์เก่า_archived_20261016")

# 3. Delete duplicate 'แผนการสอนพร้อมใช้'
dup_plans = os.path.join(base_dir, 'แผนการสอนพร้อมใช้')
if os.path.exists(dup_plans):
    shutil.rmtree(dup_plans)
    print("Removed redundant folder 'แผนการสอนพร้อมใช้'")

# 4. Prepare target directories
d1 = os.path.join(base_dir, '01_เล่มเอกสารส่งวิชาการ_วก')
d2 = os.path.join(base_dir, '02_คู่มือการสอนสำหรับครู')
d3 = os.path.join(base_dir, '03_ใบกิจกรรมและสื่อการสอน_แจกนักเรียน')
d4 = os.path.join(base_dir, '04_เครื่องมือวัดผลและข้อสอบ')

for d in [d1, d2, d3, d4]:
    os.makedirs(d, exist_ok=True)

# 4.1 Reorganize 01_เล่มเอกสารส่งวิชาการ_วก
src_wk3 = os.path.join(base_dir, 'วก3')
if os.path.exists(src_wk3):
    shutil.move(src_wk3, os.path.join(d1, 'วก3_โครงสร้างรายวิชา'))
    print("Moved วก3 -> 01/วก3_โครงสร้างรายวิชา")

src_wk4 = os.path.join(base_dir, 'วก4')
if os.path.exists(src_wk4):
    shutil.move(src_wk4, os.path.join(d1, 'วก4_หน่วยการเรียนรู้'))
    print("Moved วก4 -> 01/วก4_หน่วยการเรียนรู้")

src_wk5 = os.path.join(base_dir, 'วก5')
if os.path.exists(src_wk5):
    shutil.move(src_wk5, os.path.join(d1, 'วก5_แผนการจัดการเรียนรู้'))
    print("Moved วก5 -> 01/วก5_แผนการจัดการเรียนรู้")

# 4.2 Reorganize 02_คู่มือการสอนสำหรับครู
old_teacher_dir = os.path.join(base_dir, 'คู่มือการสอนสำหรับครู')
nested_teacher = os.path.join(old_teacher_dir, 'คู่มือครู ม.1 ดนตรี1 ศ21101')
if os.path.exists(nested_teacher):
    t_wk4 = os.path.join(nested_teacher, 'วก4')
    if os.path.exists(t_wk4):
        shutil.move(t_wk4, os.path.join(d2, 'วก4_คู่มือครู_หน่วยการเรียนรู้'))
        print("Moved คู่มือครู วก4 -> 02/วก4_คู่มือครู_หน่วยการเรียนรู้")
    t_wk5 = os.path.join(nested_teacher, 'วก5')
    if os.path.exists(t_wk5):
        shutil.move(t_wk5, os.path.join(d2, 'วก5_คู่มือครู_แผนการสอน'))
        print("Moved คู่มือครู วก5 -> 02/วก5_คู่มือครู_แผนการสอน")
    
    # remove old empty parent directory
    shutil.rmtree(old_teacher_dir)
    print("Removed nested old 'คู่มือการสอนสำหรับครู' folder")

# 4.3 Reorganize 03_ใบกิจกรรมและสื่อการสอน_แจกนักเรียน
src_media = os.path.join(base_dir, 'สื่อการสอน')
if os.path.exists(src_media):
    for f in os.listdir(src_media):
        shutil.move(os.path.join(src_media, f), os.path.join(d3, f))
    os.rmdir(src_media)
    print("Moved 18 media files -> 03_ใบกิจกรรมและสื่อการสอน_แจกนักเรียน")

# 4.4 Reorganize 04_เครื่องมือวัดผลและข้อสอบ
src_eval = os.path.join(base_dir, 'เครื่องมือวัดผล')
if os.path.exists(src_eval):
    shutil.move(src_eval, os.path.join(d4, 'แบบประเมินและรูบริก'))
    print("Moved เครื่องมือวัดผล -> 04/แบบประเมินและรูบริก")

src_test = os.path.join(base_dir, 'แบบทดสอบและพิมพ์เขียว')
if os.path.exists(src_test):
    shutil.move(src_test, os.path.join(d4, 'แบบทดสอบท้ายหน่วยและพิมพ์เขียว'))
    print("Moved แบบทดสอบและพิมพ์เขียว -> 04/แบบทดสอบท้ายหน่วยและพิมพ์เขียว")

src_docs = os.path.join(base_dir, 'เอกสารประกอบ')
if os.path.exists(src_docs):
    shutil.move(src_docs, os.path.join(d4, 'เอกสารประกอบ'))
    print("Moved เอกสารประกอบ -> 04/เอกสารประกอบ")

# 5. Clean scratch log files in เอกสารแผนการสอน root
root_p = 'เอกสารแผนการสอน'
scratch_files = ['all_dump.txt', 'current_check.txt', 'filelist.txt', 'review_current.txt', 'review_unit2.txt', 'review_units34.txt']
for sf in scratch_files:
    sfp = os.path.join(root_p, sf)
    if os.path.exists(sfp):
        os.remove(sfp)
        print(f"Removed scratch file: {sf}")

print("=== REORGANIZATION COMPLETED SUCCESSFULLY ===")
