import os

files = [
    'generate_wk3_exact.py',
    'generate_wk4_unit1.py',
    'generate_wk4_units234.py'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace("SMART Music Model", "T-PACE Framework")
    content = content.replace("SMART Model", "T-PACE Framework")
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
print("done")
