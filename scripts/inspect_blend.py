"""列出 Z-Anatomy Startup.blend 中所有 collection 與物件數量。
找出需要的腦相關 collection 名稱，供 export.py 使用。
用法：
  blender --background external/Z-Anatomy/Startup.blend --python scripts/inspect_blend.py
"""
import bpy
import sys


def walk(coll, depth=0):
    n_objs = len(coll.objects)
    n_children = len(coll.children)
    indent = "  " * depth
    print(f"{indent}- {coll.name}  (objects={n_objs}, sub_collections={n_children})")
    for child in coll.children:
        walk(child, depth + 1)


def main():
    print("\n========== SCENES ==========")
    for scene in bpy.data.scenes:
        print(f"\nScene: {scene.name}")
        print(f"  total objects in scene: {len(scene.objects)}")
        print(f"  master collection:")
        walk(scene.collection, depth=2)

    # Also look at top-level data collections (might exist as orphans):
    print("\n========== bpy.data.collections (all) ==========")
    for c in bpy.data.collections:
        print(f"- {c.name}  (objects={len(c.objects)})")

    # Search for likely brain-related collections by keyword
    keywords = [
        "brain", "cerebrum", "cerebellum", "telencephalon", "diencephalon",
        "mesencephalon", "pons", "medulla", "spinal", "nervous", "encephalon",
        "amygdala", "hippocampus", "thalamus", "hypothalamus",
        "frontal", "parietal", "temporal", "occipital",
        "lobus", "cortex", "heart", "cor", "skull", "skin",
    ]
    print("\n========== Keyword matches in collection names ==========")
    matches = []
    for c in bpy.data.collections:
        cname_lower = c.name.lower()
        for kw in keywords:
            if kw in cname_lower:
                matches.append((kw, c.name, len(c.objects)))
                break
    for kw, name, n in matches[:80]:
        print(f"  [{kw:14s}] {name}  ({n} objs)")
    print(f"\n  total keyword matches: {len(matches)}")

    # Total object count summary
    print(f"\n========== Totals ==========")
    print(f"  total collections: {len(bpy.data.collections)}")
    print(f"  total mesh objects in bpy.data.objects: {sum(1 for o in bpy.data.objects if o.type == 'MESH')}")
    print(f"  total scenes: {len(bpy.data.scenes)}")

    sys.exit(0)


main()
