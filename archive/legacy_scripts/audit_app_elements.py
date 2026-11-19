import re
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

with open('app/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

tabs = re.findall(r'data-tab=["\']([^"\']+)["\']', html)
onclicks = re.findall(r'onclick=["\']([^"\']+)["\']', html)
modals = re.findall(r'id=["\'](modal-[^"\']+)["\']', html)

print(f"Tabs ({len(set(tabs))}): {sorted(list(set(tabs)))}")
print(f"Modals ({len(set(modals))}): {sorted(list(set(modals)))}")
print(f"Total onclick attributes: {len(onclicks)}")

# Check for duplicate IDs
ids = re.findall(r'id=["\']([^"\']+)["\']', html)
seen = set()
duplicates = set()
for i in ids:
    if i in seen:
        duplicates.add(i)
    seen.add(i)

tab_panes = re.findall(r'id=[\'"](tab-content-[^\'"]+)[\'"]', html)
nav_tabs = re.findall(r'switchTab\([\'"]([^\'"]+)[\'"]\)', html)
print(f"Tab Panes ({len(tab_panes)}): {tab_panes}")
print(f"SwitchTab calls ({len(set(nav_tabs))}): {sorted(list(set(nav_tabs)))}")

