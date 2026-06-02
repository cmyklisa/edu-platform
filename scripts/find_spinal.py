import bpy

def cr(co):
    n = sum(1 for o in co.objects if o.type == 'MESH')
    for sub in co.children: n += cr(sub)
    return n

print("--- SPINAL (recursive count > 0) ---")
for c in bpy.data.collections:
    n = c.name.lower()
    if 'spinal' in n or 'medulla spinalis' in n or 'cord' in n:
        r = cr(c)
        if r > 0 or len(c.objects) > 0:
            print(f'  {c.name:60s} direct={len(c.objects):4d} rec={r:5d}')

print("\n--- Other CNS subsets ---")
for c in bpy.data.collections:
    n = c.name.lower()
    if any(k in n for k in ['gray matter','grey matter','white matter','funiculus','dorsal column','spinothalamic']):
        r = cr(c)
        if r > 0:
            print(f'  {c.name:60s} rec={r}')

print("\n--- inside 'Central nervous system' top-level children ---")
cns = bpy.data.collections.get('Central nervous system')
if cns:
    for sub in cns.children:
        print(f'  {sub.name:60s} direct={len(sub.objects):4d} rec={cr(sub):5d}')
