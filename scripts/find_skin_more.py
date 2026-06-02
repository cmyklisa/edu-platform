"""徹底搜尋 Z-Anatomy 中可能代表「頭部皮膚／表面」的 collection。"""
import bpy

def cr(co):
    n = sum(1 for o in co.objects if o.type == 'MESH')
    for sub in co.children: n += cr(sub)
    return n

KW = [
    'skin', 'integument', 'cutaneous', 'subcutaneous', 'dermis', 'epidermis',
    'face', 'facial', 'mask', 'envelope', 'surface', 'scalp',
    'soft tissue', 'soft_tissue', 'tegument', 'cover', 'outer',
    'head', 'cranial',
]

print("=== Collections with these keywords AND rec>0 ===")
seen = set()
matches = []
for c in bpy.data.collections:
    name_lower = c.name.lower()
    for k in KW:
        if k in name_lower and c.name not in seen:
            r = cr(c)
            if r > 0:
                matches.append((k, c.name, r))
            seen.add(c.name)
            break
matches.sort(key=lambda x: -x[2])
for k, n, r in matches[:30]:
    print(f"  [{k:14s}] {n:55s} rec={r}")

print("\n=== Scene top-level collections (root) ===")
for c in bpy.context.scene.collection.children:
    r = cr(c)
    print(f"  {c.name:60s} rec={r}")

print("\n=== Any single very large mesh ===")
# Look for whole-body outer mesh (might be unnamed or in 'Anatomical positions')
big = []
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data and len(obj.data.polygons) > 5000:
        # Top-10 by poly count
        big.append((len(obj.data.polygons), obj.name))
big.sort(reverse=True)
for n, name in big[:10]:
    print(f"  {n:7d}  {name}")
