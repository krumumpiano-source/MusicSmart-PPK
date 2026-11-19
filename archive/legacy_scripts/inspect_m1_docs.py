import os
import sys
import json

root_dir = r"D:\AI CURSER\PLANE MUSIC ED\เอกสารแผนการสอน\ม.1 ดนตรี1 ศ21101"
tree = {}

for root, dirs, files in os.walk(root_dir):
    rel = os.path.relpath(root, root_dir)
    tree[rel] = [
        {"name": f, "ext": os.path.splitext(f)[1].lower(), "size": os.path.getsize(os.path.join(root, f))}
        for f in files
    ]

with open("scratch_inventory.json", "w", encoding="utf-8") as f:
    json.dump(tree, f, ensure_ascii=False, indent=2)

print("Inventory completed.")
for rel, files in sorted(tree.items()):
    print(f"\n📁 [{rel}] ({len(files)} files)")
    for item in files:
        print(f"   • {item['name']} ({item['size']:,} bytes)")
