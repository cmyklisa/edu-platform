"""列出 sympathetic 相關 collection 的 mesh 內容。"""
import bpy

def show_objs(coll, prefix='  '):
    for o in coll.objects:
        polys = ''
        if o.type == 'MESH' and o.data:
            polys = f' polys={len(o.data.polygons)}'
        elif o.type == 'CURVE':
            polys = ' [CURVE]'
        elif o.type == 'EMPTY':
            polys = ' [EMPTY]'
        print(f'{prefix}{o.name:55s}  type={o.type:6s}{polys}')

def cr(co):
    n = sum(1 for o in co.objects if o.type == 'MESH')
    for sub in co.children: n += cr(sub)
    return n

for cname in ['Sympathetic trunk', 'Thoracolumbar part of autonomic division',
              'Automatic division of peripheral nervous system',
              'Vagal part of autonomic division',
              'Visceral part of autonomic division']:
    print(f"\n=== {cname} ===")
    c = bpy.data.collections.get(cname)
    if not c:
        print('  NOT FOUND')
        continue
    print(f'  total mesh recursive = {cr(c)}')
    show_objs(c)
    for sub in c.children:
        print(f'  └─ {sub.name}  rec={cr(sub)}')
        show_objs(sub, '       ')
        for sub2 in sub.children:
            print(f'      └─ {sub2.name}  rec={cr(sub2)}')
