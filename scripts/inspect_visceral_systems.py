"""遍歷 '8: Visceral systems' 集合，看裡面有什麼。"""
import bpy
import sys

def walk(coll, depth=0):
    n = len(coll.objects)
    n_meshes = sum(1 for o in coll.objects if o.type == 'MESH')
    n_curves = sum(1 for o in coll.objects if o.type == 'CURVE')
    print(f"{'  ' * depth}- {coll.name}  (objs={n}, meshes={n_meshes}, curves={n_curves})")
    for ch in coll.children:
        walk(ch, depth + 1)


def main():
    visc = bpy.data.collections.get('8: Visceral systems')
    if not visc:
        print("Not found")
        sys.exit(1)
    walk(visc)

    # Also Brain coll
    print("\n----- Brain master -----")
    for cname in ['7: Nervous system & Sense organs', 'Brain', 'Heart']:
        c = bpy.data.collections.get(cname)
        if c:
            print(f"\n=== {cname} ===")
            walk(c)
    sys.exit(0)


main()
