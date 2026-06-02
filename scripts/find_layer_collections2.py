import bpy

def cr(co):
    n = sum(1 for o in co.objects if o.type == 'MESH')
    for sub in co.children: n += cr(sub)
    return n

print("--- SKIN ---")
for kw in ['skin','integument','cutan','dermis','subcutaneous','superficial_fascia']:
    for c in bpy.data.collections:
        if kw in c.name.lower():
            print(f'[{kw:14s}] {c.name:50s} direct={len(c.objects):4d} rec={cr(c):5d}')

print("--- VASCULAR ---")
seen = set()
for kw in ['vascular','arteri','vein','vessel','circulat','cardiov','carotid','jugular','aorta']:
    for c in bpy.data.collections:
        if kw in c.name.lower() and c.name not in seen:
            print(f'[{kw:10s}] {c.name:60s} direct={len(c.objects):4d} rec={cr(c):5d}')
            seen.add(c.name)

print("--- HEAD ---")
for c in bpy.data.collections:
    n = c.name.lower()
    if ('head' in n or 'neck' in n or 'cervic' in n) and 'cell' not in n:
        rec = cr(c)
        if rec > 30:
            print(f'  {c.name:60s} direct={len(c.objects):4d} rec={rec:5d}')

print("--- Top-level scene collection children ---")
for c in bpy.context.scene.collection.children:
    print(f'  ROOT: {c.name:50s} children={len(c.children):3d} direct={len(c.objects):4d}')
