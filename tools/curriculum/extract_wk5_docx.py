#!/usr/bin/env python3
"""Extract the ม.1 วก.5 per-period plans (20 .docx) into tools/curriculum/wk5_m1_docx.json.

The JSON has the same shape as the `wk5` entries of app/data/academic_docs.js
({period, filename, paragraphs[], tables[][]}) so build_wk5_data.js can parse it with the same parser.
Text is copied verbatim (zero-width spaces removed); nothing is invented.

Usage: python tools/curriculum/extract_wk5_docx.py [source_dir]
Requires: python-docx
"""
import glob, json, os, re, sys
import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def _m1_dir():
    base = os.path.join(ROOT, 'เอกสารแผนการสอน')
    c = sorted(glob.glob(os.path.join(base, 'ม.1 ดนตรี1 *')))
    return c[0] if c else os.path.join(base, 'ม.1 ดนตรี1')  # ไม่ผูกกับรหัสวิชาในชื่อโฟลเดอร์


DEFAULT_SRC = os.path.join(_m1_dir(), 'วก5_แผนรายคาบ_20คาบ')
OUT = os.path.join(os.path.dirname(__file__), 'wk5_m1_docx.json')
ZW = re.compile('[\u200b\u200c\u200d\ufeff]')


def clean(s):
    return ZW.sub('', s).replace('\xa0', ' ')


def extract(path):
    d = docx.Document(path)
    paras, tables = [], []
    in_log = False
    for el in d.element.body.iterchildren():
        tag = el.tag.split('}')[1]
        if tag == 'p':
            for line in clean(Paragraph(el, d).text).split('\n'):
                line = line.rstrip()
                if line.strip():
                    paras.append(line)
        elif tag == 'tbl':
            rows = []
            for r in Table(el, d).rows:
                cells, prev = [], None
                for c in r.cells:
                    if c._tc is prev:
                        continue
                    prev = c._tc
                    cells.append(clean(c.text))
                rows.append(cells)
            tables.append(rows)
    return paras, tables


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    files = sorted(glob.glob(os.path.join(src, '*.docx')))
    if not files:
        sys.exit('no .docx found in ' + src)
    plans = []
    for f in files:
        name = os.path.basename(f)
        m = re.search(r'ที่_(\d+)_', name)
        if not m:
            sys.exit('cannot read period from ' + name)
        paras, tables = extract(f)
        plans.append({'period': int(m.group(1)), 'filename': name, 'paragraphs': paras, 'tables': tables})
    plans.sort(key=lambda p: p['period'])
    with open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump({'grade': 'M1', 'source_dir': os.path.relpath(src, ROOT).replace(os.sep, '/'), 'plans': plans}, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print('wrote', OUT, len(plans), 'plans')


if __name__ == '__main__':
    main()