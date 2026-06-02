"""列出 Z-Anatomy 中疑似「系統層」的 collection 與規模。"""
import bpy

KEYWORDS = [
    'skin', 'integument', 'cutaneous',
    'skeletal', 'bone', 'cranium', 'skull',
    'muscul', 'muscle',
    'vascular', 'arter', 'venous', 'vein', 'cardiov', 'circulat', 'vessel',
    'nervous',  # for sanity
]

print("\n========== Collections matching system-level keywords ==========")
matches = []
for c in bpy.data.collections:
    name = c.name
    lower = name.lower()
    # Count total mesh objects recursively under this collection
    def count_recursive(coll):
        n = sum(1 for o in coll.objects if o.type == 'MESH')
        for sub in coll.children:
            n += count_recursive(sub)
        return n
    for kw in KEYWORDS:
        if kw in lower:
            total = count_recursive(c)
            matches.append((kw, name, len(c.objects), total))
            break

# Sort by total mesh count
matches.sort(key=lambda x: -x[3])
for kw, name, direct, total in matches[:40]:
    print(f"  [{kw:12s}] {name:60s}  direct={direct:4d}  recursive={total:5d}")
