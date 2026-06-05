"""列出指定 collection 內 mesh 數量與名稱前幾個，確認可匯出。"""
import bpy
import sys

TARGETS = [
    'Lungs', 'Liver', 'Kidney', 'Stomach', 'Small intestine',
    'Large intestine', 'Spleen', 'Pancreas', 'Suprarenal gland',
]

def count_meshes_recursive(coll):
    count = 0
    curves = 0
    for o in coll.objects:
        if o.type == 'MESH':
            count += 1
        elif o.type == 'CURVE':
            curves += 1
    for ch in coll.children:
        c, cu = count_meshes_recursive(ch)
        count += c
        curves += cu
    return count, curves


def list_meshes_recursive(coll, out, depth=0):
    for o in coll.objects:
        if o.type in ('MESH', 'CURVE'):
            out.append(('  ' * depth) + f'[{o.type}] ' + o.name)
    for ch in coll.children:
        out.append(('  ' * depth) + f'(sub: {ch.name})')
        list_meshes_recursive(ch, out, depth + 1)


def main():
    for name in TARGETS:
        coll = bpy.data.collections.get(name)
        if not coll:
            print(f"\n[NOT FOUND] {name}")
            continue
        meshes, curves = count_meshes_recursive(coll)
        print(f"\n== {name} == (meshes={meshes}, curves={curves}, sub_colls={len(coll.children)})")
        names_out = []
        list_meshes_recursive(coll, names_out)
        for n in names_out[:15]:
            print("  " + n)
        if len(names_out) > 15:
            print(f"  ... +{len(names_out) - 15} more")
    sys.exit(0)


main()
