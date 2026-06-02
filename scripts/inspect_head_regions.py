import bpy

for cname in ['Regions of head', 'Regions of face', 'Integument', 'Skin appendages']:
    c = bpy.data.collections.get(cname)
    if not c:
        print(f"NOT FOUND: {cname}")
        continue
    print(f"\n=== {cname} (direct meshes) ===")
    for o in list(c.objects)[:30]:
        if o.type == 'MESH':
            print(f"  {o.name:55s} polys={len(o.data.polygons)}")
    if c.children:
        print(f"  -- subcollections --")
        for sub in list(c.children)[:30]:
            n = sum(1 for o in sub.objects if o.type == 'MESH')
            print(f"     {sub.name:55s} direct_mesh={n}")
