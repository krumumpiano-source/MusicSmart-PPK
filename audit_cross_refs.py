# -*- coding: utf-8 -*-
import os, sys, glob, re, docx

sys.stdout.reconfigure(encoding='utf-8')

base = 'เอกสารแผนการสอน/ม.1 ดนตรี1 ศ21101'
wk3_path = f'{base}/วก3/วก3_โครงสร้างรายวิชา_ศ21101_ดนตรี1.docx'
wk4_paths = sorted(glob.glob(f'{base}/วก4/*.docx'))
wk5_paths = sorted(glob.glob(f'{base}/วก5/*.docx'))

media_files = set(os.listdir(f'{base}/แผนไฟล์เก่า/สื่อการสอน'))
tool_files = set(os.listdir(f'{base}/แผนไฟล์เก่า/เครื่องมือวัดผล'))
test_files = set(os.listdir(f'{base}/แบบทดสอบและพิมพ์เขียว'))
supp_files = set(os.listdir(f'{base}/แผนไฟล์เก่า/เอกสารประกอบ'))

all_disk_files = media_files | tool_files | test_files | supp_files

print("================================================================================")
print("1. ตรวจสอบไฟล์อ้างอิงที่มีอยู่จริงในระบบ (PHYSICAL FILES ON DISK)")
print("================================================================================")
print(f"สื่อการสอน (ใบงาน/ใบกิจกรรม): {len(media_files)} ไฟล์")
print(f"เครื่องมือวัดและประเมินผล:    {len(tool_files)} ไฟล์")
print(f"แบบทดสอบท้ายหน่วย & Blueprint: {len(test_files)} ไฟล์")
print(f"เอกสารประกอบวิชาการ (วก7/PDPA/T-PACE): {len(supp_files)} ไฟล์")
doc3 = docx.Document(wk3_path)
text3 = '\n'.join([p.text for p in doc3.paragraphs] + [c.text for t in doc3.tables for r in t.rows for c in r.cells])

print("2. ตรวจสอบความสอดคล้องระหว่าง วก.3 (โครงสร้างรายวิชา) และ วก.4 (หน่วยการเรียนรู้)")
print("================================================================================")
u_names_wk3 = {
    1: 'พื้นฐานคาลิมบ้า',
    2: 'ปฏิบัติรวมวงคาลิมบ้า',
    3: 'รอบรู้วงดนตรีและวัฒนธรรม',
    4: 'สุนทรียภาพแห่งการฟัง'
}

wk4_units = {}
for p in wk4_paths:
    doc = docx.Document(p)
    fn = os.path.basename(p)
    m = re.search(r'หน่วยการเรียนรู้ที่_(\d+)_(.+)\.docx', fn)
    if m:
        u_num = int(m.group(1))
        u_title = m.group(2)
        wk4_units[u_num] = {'file': fn, 'title': u_title, 'doc': doc}
        match_title = (u_title == u_names_wk3.get(u_num))
        print(f"หน่วยที่ {u_num}: '{u_title}' | ตรงกับ วก.3: {'ถูกต้อง 100%' if match_title else 'ไม่ตรงกัน!'}")

print("\n================================================================================")
print("3. ตรวจสอบความสอดคล้องระหว่าง วก.4 และ แผน วก.5 ทั้ง 18 แผน")
print("================================================================================")
wk5_plans = {}
for p in wk5_paths:
    doc = docx.Document(p)
    fn = os.path.basename(p)
    m = re.search(r'แผนที่_(\d+)\.docx', fn)
    if not m: continue
    p_num = int(m.group(1))
    
    full_txt = '\n'.join([para.text for para in doc.paragraphs] + [c.text for t in doc.tables for r in t.rows for c in r.cells])
    
    # check unit
    u_match = re.search(r'หน่วยการเรียนรู้ที่\s*(\d+)', full_txt)
    u_num = int(u_match.group(1)) if u_match else None
    
    # check title
    t_match = re.search(r'เรื่อง\s*([^\n\t]+?)(?:\s*เวลา|\s*ชั้น|\s*$)', full_txt)
    p_title = t_match.group(1).strip() if t_match else 'UNKNOWN'
    
    # regex for exact cited filenames
    found_media = set(re.findall(r'สื่อ_น\d+_ผ\d+_[a-zA-Z0-9ก-๙_]+\.docx', full_txt))
    found_tools = set(re.findall(r'เครื่องมือวัดผล_ฉบับที่_\d+_[a-zA-Z0-9ก-๙_\-]+\.docx', full_txt))
    found_tests = set(re.findall(r'แบบทดสอบท้ายหน่วย_หน่วยที่_\d+_[a-zA-Z0-9ก-๙_]+\.docx', full_txt))
    found_bp = set(re.findall(r'พิมพ์เขียวข้อสอบ_[a-zA-Z0-9ก-๙_]+\.docx', full_txt))
    found_supp = set(re.findall(r'(?:วก7_[a-zA-Z0-9ก-๙_]+\.docx|หนังสือยินยอม[a-zA-Z0-9ก-๙_]+\.docx|เอกสารวิชาการ_[a-zA-Z0-9ก-๙_]+\.docx)', full_txt))
    
    # also check if any "สื่อ_" or "เครื่องมือ" or "วก" is cited without .docx or broken
    raw_media_citations = re.findall(r'สื่อ_น\d+_ผ\d+_[^\s\)\],]+', full_txt)
    raw_tool_citations = re.findall(r'เครื่องมือวัดผล_ฉบับที่_\d+_[^\s\)\],]+', full_txt)
    
    all_refs = found_media | found_tools | found_tests | found_bp | found_supp
    missing_on_disk = [f for f in all_refs if f not in all_disk_files]
    
    # Also check if raw citations missed .docx
    non_docx_media = [r for r in raw_media_citations if not r.endswith('.docx')]
    non_docx_tools = [r for r in raw_tool_citations if not r.endswith('.docx')]
    
    wk5_plans[p_num] = {
        'file': fn,
        'unit': u_num,
        'title': p_title,
        'media': found_media,
        'tools': found_tools,
        'tests': found_tests,
        'bp': found_bp,
        'supp': found_supp,
        'missing': missing_on_disk,
        'non_docx': non_docx_media + non_docx_tools,
        'full_txt': full_txt
    }

for p_num in range(1, 19):
    data = wk5_plans.get(p_num)
    if not data:
        print(f"แผนที่ {p_num:02d}: ไม่พบไฟล์!")
        continue
    status = "สมบูรณ์ (100% Match)" if not data['missing'] and not data['non_docx'] else "มีข้อสังเกต"
    print(f"แผนที่ {p_num:02d} (หน่วย {data['unit']}): {data['title'][:40]} | สถานะ: {status}")
    if data['missing']:
        print(f"   [!] อ้างอิงไฟล์ที่ไม่มีบนดิสก์: {data['missing']}")
    if data['non_docx']:
        print(f"   [!] พบการอ้างอิงไม่ระบุนามสกุล .docx หรือเว้นวรรคขาด: {data['non_docx']}")

print("\n================================================================================")
print("4. ตรวจสอบการอ้างอิงข้ามใน วก.4 (Table 0 / ภาคผนวก / สื่อ / เครื่องมือ)")
print("================================================================================")
for u_num, u_data in wk4_units.items():
    doc = u_data['doc']
    txt = '\n'.join([p.text for p in doc.paragraphs] + [c.text for t in doc.tables for r in t.rows for c in r.cells])
    
    found_media = set(re.findall(r'สื่อ_น\d+_ผ\d+_[a-zA-Z0-9ก-๙_]+\.docx', txt))
    found_tools = set(re.findall(r'เครื่องมือวัดผล_ฉบับที่_\d+_[a-zA-Z0-9ก-๙_\-]+\.docx', txt))
    found_tests = set(re.findall(r'แบบทดสอบท้ายหน่วย_หน่วยที่_\d+_[a-zA-Z0-9ก-๙_]+\.docx', txt))
    found_bp = set(re.findall(r'พิมพ์เขียวข้อสอบ_[a-zA-Z0-9ก-๙_]+\.docx', txt))
    found_supp = set(re.findall(r'(?:วก7_[a-zA-Z0-9ก-๙_]+\.docx|หนังสือยินยอม[a-zA-Z0-9ก-๙_]+\.docx|เอกสารวิชาการ_[a-zA-Z0-9ก-๙_]+\.docx)', txt))
    
    all_refs = found_media | found_tools | found_tests | found_bp | found_supp
    missing_on_disk = [f for f in all_refs if f not in all_disk_files]
    
    print(f"วก.4 หน่วยที่ {u_num} ({u_data['title']}):")
    print(f"   - อ้างอิงสื่อการสอน: {len(found_media)} ไฟล์")
    print(f"   - อ้างอิงเครื่องมือวัดผล: {len(found_tools)} ไฟล์")
    print(f"   - อ้างอิงแบบทดสอบ/พิมพ์เขียว: {len(found_tests) + len(found_bp)} ไฟล์")
    print(f"   - อ้างอิงเอกสารประกอบ (วก.7/PDPA/T-PACE): {len(found_supp)} ไฟล์")
    if missing_on_disk:
        print(f"   [!] ไฟล์ที่ไม่พบบนดิสก์: {missing_on_disk}")
    else:
        print("   -> ทุกไฟล์ที่อ้างอิงมีอยู่จริงบนระบบ 100%")

print("\n================================================================================")
print("5. ตรวจสอบชื่อตัวชี้วัด (Indicators) และมาตรฐานการเรียนรู้ ระหว่าง วก3 ↔ วก4 ↔ วก5")
print("================================================================================")
# Check standard indicators
ind_list = [
    'ศ 2.1 ม.1/1', 'ศ 2.1 ม.1/2', 'ศ 2.1 ม.1/3', 'ศ 2.1 ม.1/4',
    'ศ 2.1 ม.1/5', 'ศ 2.1 ม.1/6', 'ศ 2.1 ม.1/7', 'ศ 2.1 ม.1/8', 'ศ 2.1 ม.1/9',
    'ศ 2.2 ม.1/1', 'ศ 2.2 ม.1/2'
]
for ind in ind_list:
    in_3 = ind in text3
    in_4 = any(ind in '\n'.join([p.text for p in u['doc'].paragraphs] + [c.text for t in u['doc'].tables for r in t.rows for c in r.cells]) for u in wk4_units.values())
    in_5 = any(ind in p['full_txt'] for p in wk5_plans.values())
    print(f"ตัวชี้วัด {ind:15s} | วก.3: {'✔' if in_3 else '✖'} | วก.4: {'✔' if in_4 else '✖'} | วก.5: {'✔' if in_5 else '✖'}")

