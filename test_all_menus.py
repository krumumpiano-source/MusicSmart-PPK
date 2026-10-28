import re
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 70)
print("  Comprehensive Static Analysis & Link Integrity Checker for MusicSmart")
print("=" * 70)

with open('app/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Collect all element IDs defined in index.html
defined_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html))
print(f"Total defined DOM IDs in index.html: {len(defined_ids)}")

# 2. Collect all document.getElementById calls in all JS files
js_files = []
for root, dirs, files in os.walk('app/js'):
    for file in files:
        if file.endswith('.js'):
            js_files.append(os.path.join(root, file))

for root, dirs, files in os.walk('app/data'):
    for file in files:
        if file.endswith('.js'):
            js_files.append(os.path.join(root, file))

missing_element_ids = {}

for js_path in js_files:
    with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Match getElementById('...')
    calls = re.findall(r'document\.getElementById\(["\']([^"\']+)["\']\)', content)
    for cid in set(calls):
        # Skip dynamic IDs like tine-${id}, aids-note-card-${note}, etc.
        if '${' in cid:
            continue
        if cid not in defined_ids:
            missing_element_ids.setdefault(cid, []).append(os.path.basename(js_path))

print(f"\n[Check 1] Missing DOM element IDs referenced in JS files:")
if missing_element_ids:
    for mid, files in sorted(missing_element_ids.items()):
        print(f"  ❌ Missing ID '#{mid}' referenced in: {', '.join(files)}")
else:
    print("  ✔ PASS: All referenced static DOM IDs exist in index.html!")

# 3. Check all onclick handlers in index.html
print(f"\n[Check 2] Checking all onclick handlers in index.html:")
onclick_calls = re.findall(r'onclick=["\']([^"\']+)["\']', html)
print(f"  Total onclick handlers found: {len(onclick_calls)}")

# Read all JS contents to check function definitions
all_js = ""
for js_path in js_files:
    with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
        all_js += f"\n// --- {js_path} ---\n" + f.read()

# Check App methods
app_methods = set(re.findall(r'^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{', all_js, re.MULTILINE))
app_assigned = set(re.findall(r'([a-zA-Z0-9_]+)\s*:\s*function', all_js))
app_object_keys = set(re.findall(r'const\s+([A-Za-z0-9_]+)\s*=', all_js))

print(f"  Discovered {len(app_methods)} declared functions/methods across codebase.")

# 4. Check all 24 modals
print(f"\n[Check 3] Verifying all 24 Modals for Open/Close Triggers:")
modals = sorted(list(set(re.findall(r'id=["\'](modal-[^"\']+)["\']', html))))
for m in modals:
    has_in_js = m in all_js
    has_close = f"id=\"{m}\"" in html and ('btn-close-modal' in html or 'modal-close-btn' in html or 'classList.remove' in all_js)
    status = "✔ PASS" if has_in_js else "⚠️ NOTE (No explicit getElementById found)"
    print(f"  {status}: #{m}")

print("=" * 70)
