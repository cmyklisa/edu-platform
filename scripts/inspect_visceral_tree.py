"""遞迴展開 '8: Visceral systems' 完整樹狀。"""
import bpy
import sys

def walk(coll, depth=0):
    n_meshes = sum(1 for o in coll.objects if o.type == 'MESH')
    n_curves = sum(1 for o in coll.objects if o.type == 'CURVE')
    n_total = len(coll.objects)
    indent = '  ' * depth
    print(f"{indent}- {coll.name}  (mesh={n_meshes}, curve={n_curves}, total={n_total})")
    for ch in coll.children:
        walk(ch, depth + 1)


visc = bpy.data.collections.get('8: Visceral systems')
if visc:
    walk(visc)
sys.exit(0)
