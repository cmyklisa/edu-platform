"""檢查 Z-Anatomy 神經相關 collection，找出真正的「細線神經」。"""
import bpy
import sys

def count(coll):
    n = curves = 0
    for o in coll.objects:
        if o.type == 'MESH': n += 1
        elif o.type == 'CURVE': curves += 1
    for ch in coll.children:
        m, c = count(ch); n += m; curves += c
    return n, curves


def list_objects(coll, out, depth=0):
    for o in coll.objects:
        if o.type in ('MESH', 'CURVE'):
            out.append(('  ' * depth) + f'[{o.type}] {o.name}')
    for ch in coll.children:
        out.append(('  ' * depth) + f'(sub: {ch.name})')
        list_objects(ch, out, depth + 1)


# 神經相關 collection 全掃
print("=== Collections with 'nerv' or 'autonom' in name ===")
hits = []
for c in bpy.data.collections:
    low = c.name.lower()
    if 'nerv' in low or 'autonom' in low or 'plexus' in low or 'rami' in low or 'ganglion' in low:
        n, cu = count(c)
        hits.append((c.name, n, cu))
for name, n, cu in sorted(hits, key=lambda x: -(x[1] + x[2]))[:40]:
    print(f"  {name:55s} mesh={n:4d} cv={cu:4d}")

# 詳細展開 "Spinal nerves"
print("\n=== 'Spinal nerves' (current nerves.glb source) ===")
sn = bpy.data.collections.get('Spinal nerves')
if sn:
    n, cu = count(sn)
    print(f"  total: mesh={n}, curves={cu}, sub_colls={len(sn.children)}")
    items = []
    list_objects(sn, items)
    print(f"  first 30 items:")
    for it in items[:30]:
        print('   ', it)

# 詳細展開 "Peripheral nervous system" 如果存在
for cname in ['Peripheral nervous system', 'Peripheral nerves',
              '7: Nervous system & Sense organs', 'Nervous system',
              'Automatic division of peripheral nervous system',
              'Autonomic nervous system']:
    c = bpy.data.collections.get(cname)
    if not c: continue
    n, cu = count(c)
    print(f"\n=== {cname} ===")
    print(f"  total: mesh={n}, curves={cu}, sub_colls={len(c.children)}")
    items = []
    list_objects(c, items)
    print(f"  first 20 items:")
    for it in items[:20]:
        print('   ', it)

# 取樣：找出名稱帶 'nerve' 的所有 MESH，看是否真的是 nerve 形狀
print("\n=== Mesh objects with 'nerve' or 'plexus' in name ===")
matches = []
for obj in bpy.data.objects:
    if obj.type != 'MESH': continue
    low = obj.name.lower()
    if 'nerve' in low or 'plexus' in low or 'rami' in low:
        matches.append(obj.name)
print(f"  total: {len(matches)}")
for n in matches[:30]:
    print(f"    {n}")
if len(matches) > 30: print(f"    ... +{len(matches) - 30} more")

# 名稱帶 'muscle' 的物件 — 確認 muscle 沒誤進 nerve collection
print("\n=== Mesh objects with 'muscle' in name that are inside 'Spinal nerves' ===")
if sn:
    leaks = []
    def walk(c):
        for o in c.objects:
            if o.type != 'MESH': continue
            if 'muscle' in o.name.lower():
                leaks.append(o.name)
        for ch in c.children:
            walk(ch)
    walk(sn)
    print(f"  muscle in Spinal nerves: {len(leaks)}")
    for n in leaks[:10]:
        print(f"    LEAK: {n}")

sys.exit(0)
