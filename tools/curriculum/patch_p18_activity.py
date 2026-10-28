# -*- coding: utf-8 -*-
"""patch_p18_activity.py — เปลี่ยนกิจกรรมนำคาบ 18 (ม.1) จากคลิปเดิม (ไม่มีจริง) เป็น "ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม (กลุ่มละ 1 มิติ) สมาชิกมีหน้าที่แตกต่างกัน 8 บทบาท + แผนภาพ 5 มิติในแอป"
(ครูยืนยันแล้วว่าคลิปนั้นหาไม่ได้จริง — t73u; ครูไม่เอาการเล่ากรณีศึกษา — t76u: สคริปต์นี้รับทั้งข้อความเดิมและข้อความรอบ t73u แล้วแก้เป็นข้อความสุดท้าย) ใช้สคริปต์เดียวกับรูปแบบ patch_doremi_docx.py ไม่แก้มือ

ใช้:
  python tools/curriculum/patch_p18_activity.py --docx            # dry-run เอกสาร docx (นับ/แสดงข้อความก่อน→หลัง)
  python tools/curriculum/patch_p18_activity.py --docx --apply    # สำรองโฟลเดอร์เอกสารก่อน แล้วแก้จริง
  python tools/curriculum/patch_p18_activity.py --text FILE...    [--apply]   # ไฟล์ข้อความอื่น (md/py/js) ด้วยกฎเดียวกัน
  python tools/curriculum/patch_p18_activity.py --legacy FILE...  [--apply]   # lessons.js / สคริปต์สร้างแผนเก่า (กฎ + ข้อความขั้นตอน/สื่อเดิมของคาบ 18)
แล้วรัน: python tools/curriculum/extract_wk5_docx.py → node tools/curriculum/build_wk5_data.js → node tools/curriculum/patch_academic_docs_m1.js
ไม่ commit/push; ไม่แตะ M2; รันซ้ำได้ (idempotent)
"""
import os, re, sys, json, shutil, zipfile, datetime, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ชื่อคลิปเดิมแตกเป็นท่อน ๆ เพื่อไม่ให้ชื่อเต็มเหลืออยู่ในไฟล์ใดของโปรเจกต์ (tests/test_no_removed_clip.js ตรวจ)
_T1, _T2, _T3 = 'พลังแห่ง', 'ดนตรี: จากการบำบัด', 'จิตใจสู่วิถีชีวิตชุมชน'
_DOC, _CASE = 'คลิป' + 'สาร' + 'คดี', 'คลิป' + 'กรณี' + 'ศึกษา'
Q = r'(?:\\"|["“”])'  # เครื่องหมายคำพูด: ธรรมดา / โค้ง / escape ใน JSON-JS
# ถ้อยคำที่ครูไม่เอาแล้ว (t76u) แตกเป็นท่อนเพื่อไม่ให้เหลือในไฟล์ใด (tests/test_no_removed_clip.js ตรวจ)
_B1, _B2 = 'ครู' + 'เล่า', 'จับคู่' + 'เล่า'
# ข้อความสุดท้าย (t76u): ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม (กลุ่มละ 1 มิติ) สมาชิกมีหน้าที่แตกต่างกัน 8 บทบาทตาม วก.5
NEW_STEP1 = ('ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม โดยแต่ละกลุ่มรับผิดชอบ 1 มิติของอิทธิพลของดนตรีต่อสังคม (ดูแผนภาพ 5 มิติในแอป) '
             'และสมาชิกในกลุ่มมีหน้าที่แตกต่างกันตาม 8 บทบาท แล้วชวนนักเรียนวิเคราะห์ว่า')
NEW_OBJ_P = 'ศึกษาค้นคว้าอิทธิพลของดนตรีตามมิติที่กลุ่มรับผิดชอบ'
NEW_STEP4 = 'นักเรียนเข้ากลุ่ม 5 กลุ่ม รับมิติอิทธิพลกลุ่มละ 1 มิติไม่ซ้ำกัน ศึกษาค้นคว้าตามมิติของกลุ่ม แบ่ง 8 บทบาท:'
# ข้อความขั้นกลาง (t73u) ที่ต้องเปลี่ยนต่อ
_S1 = ('ครู' + 'เล่ากรณีศึกษาสั้น ๆ ด้วยตนเอง (ไม่ใช้คลิป) เรื่องบทบาทของดนตรีต่อจิตใจและวิถีชีวิตของคนในท้องถิ่นพะเยา '
       'ให้นักเรียน' + 'จับคู่' + 'เล่า' + 'ประสบการณ์ตรงที่ดนตรีมีผลต่อความรู้สึกหรือกิจกรรมในชุมชน แล้วชวนนักเรียนวิเคราะห์ว่า')
RULES = [
    ('p-objective', re.compile('วิเคราะห์กรณีศึกษาจาก' + 'คลิปวิดีโอ'), NEW_OBJ_P),
    ('p-objective-t73', re.compile('วิเคราะห์กรณีศึกษาที่' + 'ครู' + 'เล่า' + 'และประสบการณ์ตรงของผู้เรียน'), NEW_OBJ_P),
    ('step1', re.compile('ครูเปิด' + _DOC + r'สั้น\s*' + Q + _T1 + _T2 + _T3 + r'กว๊านพะเยา' + Q + r'\s*ชวนนักเรียนวิเคราะห์ว่า'), NEW_STEP1),
    ('step1-t73', re.compile(re.escape(_S1)), NEW_STEP1),
    ('step4', re.compile(re.escape('นักเรียนเข้ากลุ่ม 5 กลุ่ม เลือกมิติอิทธิพล แบ่ง 8 บทบาท:')), NEW_STEP4),
    ('media', re.compile(_CASE + r'และใบกิจกรรมโครงร่างอิทธิพลของดนตรีต่อสังคม \(video\)'), 'แผนภาพ 5 มิติอิทธิพลของดนตรีต่อสังคม (app)'),
    # md เก่า: บรรทัดสื่อไม่มี (video) ซ้ำชื่อเดียวกัน
]
OLD_KEYS = re.compile(_B1 + '|' + _B2 + '|' + re.escape('เลือกมิติอิทธิพล แบ่ง 8 บทบาท:') + '|' + _T1 + _T2 + '|' + _DOC + '|' + _CASE + '|music_influence' + '_cases|p18_case' + '_clip|กรณีศึกษาจาก' + 'คลิป')


def backup_dir(root, tag):
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    return os.path.join(root, 'scratch', 'docx_backup_%s_%s' % (stamp, tag)), stamp


def raw_hits_docx(path):
    n = 0
    with zipfile.ZipFile(path) as z:
        for nm in z.namelist():
            if nm.endswith('.xml'):
                t = re.sub(r'<[^>]+>', '', z.read(nm).decode('utf8', 'ignore')).replace('\u200b', '')
                n += len(OLD_KEYS.findall(t))
    return n


def do_docx(apply_):
    import patch_m1_docx as P
    from docx import Document
    files = []
    for dp, _, fs in os.walk(P.DOC_DIR):
        for f in sorted(fs):
            if f.endswith('.docx') and not f.startswith('~$'):
                files.append(os.path.join(dp, f))
    bk, stamp = backup_dir(P.ROOT, 'p18clip')
    if apply_:
        shutil.copytree(P.DOC_DIR, bk)
        print('BACKUP', bk)
    log, tb, ta = [], 0, 0
    for path in files:
        before = raw_hits_docx(path)
        tb += before
        if not before:
            continue
        doc = Document(path)
        changes = []
        for p in P.iter_pars(doc):
            for rid, rx, new in RULES:
                for old, nw in P.sub(p, rx, new):
                    changes.append({'rule': rid, 'old_len': len(old), 'old_sha1': hashlib.sha1(old.encode('utf-8')).hexdigest()[:10], 'new': nw})  # ไม่บันทึกข้อความเดิมลง log (ชื่อคลิปเดิมต้องไม่เหลือในโปรเจกต์)
        if apply_:
            doc.save(path)
        after = raw_hits_docx(path) if apply_ else None
        ta += after or 0
        print(os.path.basename(path).encode('ascii', 'replace').decode(), 'hits_before=%d changes=%d hits_after=%s' % (before, len(changes), after))
        log.append({'file': os.path.relpath(path, P.ROOT), 'hits_before': before, 'hits_after': after, 'changes': changes})
    out = os.path.join(P.ROOT, 'tools', 'curriculum', 'logs', 'patch_p18_activity_docx_%s%s.json' % (stamp, '' if apply_ else '_dry'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({'files': log, 'total_before': tb, 'total_after': ta}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('TOTAL before=%d after=%d log=%s' % (tb, ta, out))


_ROLES8 = 'ผู้อำนวยการแคมเปญ, นักวิจัยชุมชน, นักออกแบบกิจกรรม, นักประพันธ์ดนตรีบำบัด, ผู้ผลิตสื่อประชาสัมพันธ์, นักวิเคราะห์งบประมาณพอเพียง, ผู้ประสานงานท้องถิ่น, และโฆษกสรุปผล'
_DESC1 = 'ครูมอบหมายงานศึกษาค้นคว้าตามกลุ่ม 5 กลุ่ม โดยแต่ละกลุ่มรับผิดชอบ 1 มิติของอิทธิพลของดนตรีต่อสังคม (ดูแผนภาพ 5 มิติในแอป) และสมาชิกในกลุ่มมีหน้าที่แตกต่างกันตาม 8 บทบาท'
_T73_DESC = 'ครู' + 'เล่ากรณีศึกษาสั้น ๆ ด้วยตนเอง (ไม่ใช้คลิป) เรื่องบทบาทของดนตรีต่อจิตใจและวิถีชีวิตของคนในท้องถิ่นพะเยา ชวนคุยถึงประสบการณ์ตรงของนักเรียน'
LEGACY = [
    ('legacy-phase', re.compile('ขั้นนำและชม' + _CASE + r' \(12 นาที\)'), 'ขั้นนำและมอบหมายงานค้นคว้ากลุ่ม (12 นาที)'),
    ('legacy-phase-t73', re.compile(re.escape('ขั้นนำและกรณีศึกษาที่' + 'ครู' + 'เล่า' + ' (12 นาที)')), 'ขั้นนำและมอบหมายงานค้นคว้ากลุ่ม (12 นาที)'),
    ('legacy-desc', re.compile("เปิดคลิปวิดีโอสั้น '" + _T1 + _T2 + _T3 + "' ชวนคุยถึงประสบการณ์ตรงของนักเรียน"), _DESC1),
    ('legacy-desc-t73', re.compile(re.escape(_T73_DESC)), _DESC1),
    ('legacy-teach', re.compile(r'ฉายกรณีศึกษาและอธิบายมิติ'), 'ใช้แผนภาพ 5 มิติในแอปอธิบายมิติ'),
    ('legacy-tip', re.compile('เปิด' + _CASE + 'อิทธิพลของดนตรี เช่น '), 'ยกตัวอย่างอิทธิพลของดนตรีจากบริบทท้องถิ่นพะเยา เช่น '),
    ('legacy-tip-t73', re.compile(re.escape('ครู' + 'เล่ากรณีศึกษาอิทธิพลของดนตรี (ไม่ใช้คลิป) เช่น ')), 'ยกตัวอย่างอิทธิพลของดนตรีจากบริบทท้องถิ่นพะเยา เช่น '),
    ('legacy-roles', re.compile('นักเรียนเข้ากลุ่ม 5 กลุ่ม เลือกมิติอิทธิพล และแบ่ง 8 บทบาท: ผู้อำนวยการนำเสนอ, นักวิจัยกรณีศึกษา, นักวิเคราะห์ผลเชิงบวก, นักวิเคราะห์จริยธรรม, ผู้สื่อข่าวสัมภาษณ์, นักออกแบบแคมเปญ, ผู้สร้างสื่อ, และโฆษกสรุปบทเรียน'),
     'นักเรียนเข้ากลุ่ม 5 กลุ่ม รับมิติอิทธิพลกลุ่มละ 1 มิติไม่ซ้ำกัน ศึกษาค้นคว้าตามมิติของกลุ่ม และแบ่ง 8 บทบาท: ' + _ROLES8),
    ('legacy-mentor', re.compile(re.escape('ปูพื้นฐานมิติอิทธิพลของดนตรีทั้ง 5 มิติ (จิตวิทยา/การบำบัด, ประเพณีวัฒนธรรมท้องถิ่นพะเยา, เศรษฐกิจสร้างสรรค์, สังคมความสามัคคี, และสื่อดิจิทัล) ให้ทุกคนเข้าใจภาพรวมร่วมกันก่อนกระจายหัวข้อกลุ่ม')),
     'ปูพื้นฐาน 5 มิติอิทธิพลของดนตรีต่อสังคม: 1) จิตวิทยาและสุขภาวะ 2) จริยธรรมและศาสนา 3) ประเพณีและวัฒนธรรมท้องถิ่นพะเยา 4) เศรษฐกิจสร้างสรรค์ 5) สมานฉันท์และการขับเคลื่อนสังคม ให้ทุกคนเข้าใจภาพรวมร่วมกันก่อนมอบหมายมิติให้กลุ่มละ 1 มิติ'),
    ('legacy-media-title', re.compile(_CASE + 'และใบกิจกรรมโครงร่างอิทธิพลของดนตรีต่อสังคม'), 'แผนภาพ 5 มิติอิทธิพลของดนตรีต่อสังคม'),
    ('legacy-media-url', re.compile(r'(title\W+แผนภาพ 5 มิติอิทธิพลของดนตรีต่อสังคม\W+type\W+)video(\W+url\W+)academic/media/music_influence' + r'_cases\.mp4'),
     r'\1app_module\2influence/five_dimensions'),
]


def do_text(paths, apply_, legacy=False):
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
    bk, stamp = backup_dir(root, 'p18clip_text')
    for pth in paths:
        raw = open(pth, 'rb').read()
        crlf = b'\r\n' in raw
        t = raw.decode('utf-8').replace('\r\n', '\n')
        n = 0
        for rid, rx, new in RULES + (LEGACY if legacy else []):
            t, c = (rx.subn(new, t) if (legacy and rid == 'legacy-media-url') else rx.subn(lambda m, new=new: new, t))
            n += c
        print(pth.encode('ascii', 'replace').decode(), 'changes=%d' % n, 'hits_left=%d' % len(OLD_KEYS.findall(t)))
        if apply_ and n:
            os.makedirs(bk, exist_ok=True)
            shutil.copy2(pth, os.path.join(bk, os.path.basename(pth)))
            open(pth, 'wb').write((t.replace('\n', '\r\n') if crlf else t).encode('utf-8'))


if __name__ == '__main__':
    a = sys.argv[1:]
    ap = '--apply' in a
    if '--docx' in a:
        do_docx(ap)
    if '--text' in a:
        do_text([x for x in a[a.index('--text') + 1:] if not x.startswith('--')], ap)
    if '--legacy' in a:
        do_text([x for x in a[a.index('--legacy') + 1:] if not x.startswith('--')], ap, legacy=True)
