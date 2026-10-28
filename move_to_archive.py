import os
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')

base = r'D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101'
archive_dir = os.path.join(base, 'แผนไฟล์เก่า')

folders_to_move = ['เครื่องมือวัดผล', 'เอกสารประกอบ', 'สื่อการสอน']

print("====================================================================")
print("MOVING ORIGINAL STANDALONE FOLDERS TO 'แผนไฟล์เก่า'")
print("====================================================================")

for folder_name in folders_to_move:
    src = os.path.join(base, folder_name)
    dst = os.path.join(archive_dir, folder_name)
    
    if os.path.exists(src):
        if os.path.exists(dst):
            print(f"Warning: Destination {dst} already exists. Merging/overwriting files...")
            for item in os.listdir(src):
                s_item = os.path.join(src, item)
                d_item = os.path.join(dst, item)
                if os.path.exists(d_item):
                    if os.path.isdir(d_item):
                        shutil.rmtree(d_item)
                    else:
                        os.remove(d_item)
                shutil.move(s_item, d_item)
            os.rmdir(src)
            print(f"✅ Merged and moved {folder_name} to {dst}")
        else:
            shutil.move(src, dst)
            print(f"✅ Moved {folder_name} to {dst}")
    else:
        print(f"Note: Source {src} does not exist or already moved.")

print("\nAll specified folders moved successfully to แผนไฟล์เก่า.")
