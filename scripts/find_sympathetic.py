import bpy

def cr(co):
    n = sum(1 for o in co.objects if o.type == 'MESH')
    for sub in co.children: n += cr(sub)
    return n

KW = ['sympath', 'parasympath', 'autonomic', 'splanchnic', 'ganglion', 'plexus',
      'vagus', 'phrenic', 'sympathetic_trunk']

print("=== Autonomic / sympathetic collections (rec > 0) ===")
matches = []
for c in bpy.data.collections:
    n = c.name.lower()
    for k in KW:
        if k in n:
            r = cr(c)
            if r > 0:
                matches.append((k, c.name, r))
            break
matches.sort(key=lambda x: -x[2])
for k, n, r in matches[:40]:
    print(f"  [{k:14s}] {n:60s} rec={r}")

print("\n=== Peripheral nervous system contents ===")
pns = bpy.data.collections.get('Peripheral nervous system')
if pns:
    for sub in pns.children:
        print(f"  {sub.name:60s} rec={cr(sub)}")
