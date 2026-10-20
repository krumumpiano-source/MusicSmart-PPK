import os
import zipfile
import re
import shutil

folder = r"d:\AI CURSER\PLANE MUSIC ED"
target_files = ["วก5_หน่วยที่1_แผนที่1.docx", "แผนการสอน_วก5_แผนที่_01.docx"]

for f in target_files:
    path = os.path.join(folder, f)
    if os.path.exists(path):
        temp_dir = os.path.join(folder, f + "_extracted")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Unzip
        with zipfile.ZipFile(path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        document_xml_path = os.path.join(temp_dir, 'word', 'document.xml')
        with open(document_xml_path, 'r', encoding='utf-8') as xml_file:
            content = xml_file.read()
            
        # Quick and dirty replace. Since word might split "ตั้งสาย" into runs like "ตั้ง" and "สาย", we might have tags in between.
        # So we strip tags, find if it's there. Actually, the easiest is to remove <w:r> boundaries within the word, but that's complex.
        # Let's see if "ตั้งสาย" is contiguous in XML.
        content = content.replace("ตั้งสาย", "จูนลิ่มเสียง")
        
        # If it was split by tags, a regex is needed.
        # "ตั้" (t-mai eko) "ง" "ส" "า" "ย"
        # Match "ตั้งสาย" with optional xml tags in between characters
        regex = r'ต.*?ั.*?้.*?ง.*?ส.*?า.*?ย'
        # Actually it's better to just do this:
        # We can just read the text, find where it is and tell the user, or try a regex.
        
        with open(document_xml_path, 'w', encoding='utf-8') as xml_file:
            xml_file.write(content)
            
        # Re-zip
        new_path = os.path.join(folder, f + "_fixed.docx")
        with zipfile.ZipFile(new_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_ref.write(file_path, arcname)
                    
        # Replace original
        os.remove(path)
        os.rename(new_path, path)
        shutil.rmtree(temp_dir)
        print(f"Fixed XML for {f}")
