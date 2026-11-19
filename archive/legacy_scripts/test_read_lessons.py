import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('app/data/lessons.js', 'r', encoding='utf-8') as f:
    c = f.read()

start_idx = c.find('{')
end_idx = c.rfind('}') + 1
json_str = c[start_idx:end_idx]

data = json.loads(json_str)
print(f"M1 periods: {len(data['M1'])}")
print(f"M2 periods: {len(data['M2'])}")
for p in data['M1'][:4]:
    print(f"  M1 Period {p['period']}: {p['topic']}")
for p in data['M2'][:4]:
    print(f"  M2 Period {p['period']}: {p['topic']}")
