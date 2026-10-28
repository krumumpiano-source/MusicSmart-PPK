# -*- coding: utf-8 -*-
"""แทน 'Do-Re-Mi' → 'Joy to the World' ใน วก.3/4/5 ของ ม.1 (ตามที่ครูอนุมัติ)
ใช้: python tools/curriculum/patch_doremi_docx.py            (dry-run: แค่นับ)
     python tools/curriculum/patch_doremi_docx.py --apply   (สำรองโฟลเดอร์ก่อน แล้วแก้จริง)
ไม่ commit/push และไม่ยุ่งกับไฟล์อื่น"""
import os, re, sys, json, shutil, zipfile, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import patch_m1_docx as P
from docx import Document

NEW = 'Joy to the World'
PATS = [
    (re.compile(r'Do\s*[-–]?\s*Re\s*[-–]?\s*Mi', re.I), NEW),
    (re.compile(r'โด\s*[-–]?\s*เร\s*[-–]?\s*มี'), NEW),
]
RAW = re.compile(r'Do\s*[-–]?\s*Re\s*[-–]?\s*Mi|โด\s*[-–]?\s*เร\s*[-–]?\s*มี', re.I)


def raw_hits(path):
    n = 0
    with zipfile.ZipFile(path) as z:
        for nm in z.namelist():
            if nm.endswith('.xml'):
                t = z.read(nm).decode('utf8', 'ignore')
                t = re.sub(r'<[^>]+>', '', t)
                n += len(RAW.findall(t))
    return n


def main():
    apply_ = '--apply' in sys.argv
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    files = []
    for dp, _, fs in os.walk(P.DOC_DIR):
        for f in sorted(fs):
            if f.endswith('.docx') and not f.startswith('~$'):
                files.append(os.path.join(dp, f))
    if apply_:
        bk = os.path.join(P.ROOT, 'scratch', 'docx_backup_' + stamp + '_doremi')
        shutil.copytree(P.DOC_DIR, bk)
        print('BACKUP', bk)
    log = []
    total_before = total_after = 0
    for path in files:
        before = raw_hits(path)
        total_before += before
        if not before:
            continue
        doc = Document(path)
        changes = []
        for p in P.iter_pars(doc):
            t = P.ntext(p)
            for rx, new in PATS:
                for old, nw in P.sub(p, rx, new):
                    changes.append({'where': t[:70], 'old': old, 'new': nw})
        if apply_:
            doc.save(path)
        after = raw_hits(path) if apply_ else None
        total_after += after or 0
        print(os.path.basename(path).encode('ascii', 'replace').decode(), 'raw_before=%d changes=%d raw_after=%s' % (before, len(changes), after))
        log.append({'file': os.path.relpath(path, P.ROOT), 'raw_before': before, 'raw_after': after, 'changes': changes})
    out = os.path.join(P.ROOT, 'tools', 'curriculum', 'logs', 'patch_doremi_docx_%s%s.json' % (stamp, '' if apply_ else '_dry'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({'files': log, 'total_before': total_before, 'total_after': total_after}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('TOTAL before=%d after=%d  log=%s' % (total_before, total_after, out))


if __name__ == '__main__':
    main()
