"""找出 Z-Anatomy 內臟器官對應的 collection 名稱。
用法：
  /Applications/Blender.app/Contents/MacOS/Blender --background external/Z-Anatomy/Startup.blend --python scripts/find_viscera.py
"""
import bpy
import sys

# 想找的器官（中英對照）
ORGAN_KEYWORDS = [
    'lung', 'pulmon',                            # 肺
    'liver', 'hepar', 'hepat',                   # 肝
    'kidney', 'ren', 'nephr',                    # 腎
    'stomach', 'gaster',                         # 胃
    'small_intestine', 'small intestine',        # 小腸
    'jejunum', 'ileum', 'duodenum',              # 小腸分段
    'large_intestine', 'large intestine',        # 大腸
    'colon', 'caecum', 'cecum', 'rectum',        # 大腸分段
    'spleen', 'lien', 'splen',                   # 脾
    'pancreas',                                  # 胰
    'adrenal', 'suprarenal',                     # 腎上腺
    'viscera', 'visceral', 'digestive',          # 內臟、消化
    'gland', 'urinary', 'thymus',                # 其他可能
    'gallbladder', 'biliary',                    # 膽囊
    'oesophagus', 'esophagus',                   # 食道
]


def main():
    print("\n========== Collection names (alphabetical) ==========")
    names = sorted(c.name for c in bpy.data.collections)
    for n in names:
        print(f"  - {n}")

    print("\n========== Keyword matches in collection names ==========")
    for c in sorted(bpy.data.collections, key=lambda x: x.name):
        lower = c.name.lower()
        for kw in ORGAN_KEYWORDS:
            if kw in lower:
                # Count meshes recursively
                count = 0
                def walk(coll):
                    nonlocal count
                    for o in coll.objects:
                        if o.type in ('MESH', 'CURVE'):
                            count += 1
                    for ch in coll.children:
                        walk(ch)
                walk(c)
                print(f"  [{kw:18s}] {c.name}  (recursive {count} mesh/curve)")
                break

    # Also list object names (not collections) matching keywords — useful if organs sit in
    # a generic "Viscera" collection without per-organ sub-collection.
    print("\n========== Mesh object names matching organ keywords ==========")
    hits = {}
    for obj in bpy.data.objects:
        if obj.type not in ('MESH', 'CURVE'):
            continue
        lower = obj.name.lower()
        for kw in ORGAN_KEYWORDS:
            if kw in lower:
                hits.setdefault(kw, []).append(obj.name)
                break
    for kw in ORGAN_KEYWORDS:
        if kw in hits:
            print(f"\n  [{kw}]: {len(hits[kw])} objects")
            for n in hits[kw][:8]:
                print(f"     {n}")
            if len(hits[kw]) > 8:
                print(f"     ... +{len(hits[kw]) - 8} more")

    sys.exit(0)


main()
