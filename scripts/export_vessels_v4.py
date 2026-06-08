"""補齊全身血管 — v4：先把 Oesophagus 物件刪除 / 解 parent，避免 depsgraph
循環反覆 re-eval 拖慢每個 curve bake。然後用 '5: Cardiovascular system' bake
所有 curves 為 mesh。
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

VESSEL_BEVEL = 0.0008

# 解掉造成 depsgraph 循環的 Oesophagus modifier — 整個物件 unlink 最徹底
def break_depsgraph_cycle():
    removed = 0
    for name in ('Oesophagus', 'Oesophagus-profile'):
        obj = bpy.data.objects.get(name)
        if obj is None: continue
        # 全部 collection unlink
        for coll in list(obj.users_collection):
            coll.objects.unlink(obj)
        # 從 bpy.data.objects 移除
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    bpy.context.evaluated_depsgraph_get()
    print(f"  [cycle break] removed {removed} Oesophagus object(s)")

break_depsgraph_cycle()


NAME_BLACKLIST = [
    'muscle', 'tendon', 'aponeurosis',
    'oesophagus', 'esophagus',
    '.j',
]
VESSEL_KEYWORDS = [
    'artery', 'arteries', 'vein', 'veins', 'venous', 'aorta', 'aortic',
    'arch', 'trunk', 'cardiac', 'vascular', 'sinus',
    'carotid', 'subclavian', 'iliac', 'femoral', 'brachial',
    'renal', 'hepatic', 'portal', 'splenic', 'mesenteric',
    'cava', 'azygos', 'pulmonary', 'jugular', 'cephalic', 'basilic',
    'saphenous', 'popliteal', 'tibial', 'fibular', 'plantar',
    'radial', 'ulnar', 'palmar', 'digital', 'metacarpal', 'metatarsal',
    'thyrocervical', 'costocervical', 'thoracoacromial',
    'gastric', 'colic', 'rectal',
    'circle', 'cerebral',
]


def is_vessel_like(name):
    low = name.lower()
    for kw in NAME_BLACKLIST:
        if kw in low: return False
    return any(kw in low for kw in VESSEL_KEYWORDS)


def collect_recursive(coll, out, baked):
    for obj in coll.objects:
        if obj.type == 'MESH':
            if is_vessel_like(obj.name):
                out.append(obj)
        elif obj.type == 'CURVE':
            if not is_vessel_like(obj.name):
                continue
            new_obj = export._curve_to_mesh(obj, default_bevel_depth=VESSEL_BEVEL)
            if new_obj is not None:
                baked.append(new_obj)
                out.append(new_obj)
    for ch in coll.children:
        collect_recursive(ch, out, baked)


def main_clean():
    os.makedirs(export.OUTPUT_DIR, exist_ok=True)
    print("\n========== Clean vessels export v4 ==========")
    targets = []
    baked = []
    for cname in ["5: Cardiovascular system"]:
        coll = bpy.data.collections.get(cname)
        if coll is None: continue
        before = len(targets)
        print(f"  collecting from: {cname}")
        collect_recursive(coll, targets, baked)
        print(f"    +{len(targets) - before} (total {len(targets)})")
    targets = list({id(o): o for o in targets}.values())
    print(f"  TOTAL: {len(targets)} unique ({len(baked)} from curve bake)")

    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.data.objects:
        try: obj.select_set(False)
        except Exception: pass

    decimated = 0
    for obj in targets:
        if export.apply_decimate(obj, 0.40):
            decimated += 1
    print(f"  decimated {decimated}/{len(targets)}")

    bpy.ops.object.select_all(action='DESELECT')
    for obj in targets:
        try: obj.select_set(True)
        except Exception: pass

    out_path = os.path.join(export.OUTPUT_DIR, 'vessels.glb')
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        use_visible=False,
        export_apply=True,
        export_yup=True,
        export_extras=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    size = os.path.getsize(out_path)
    print(f"\n  ✓ {out_path}  →  {size / 1024 / 1024:.2f} MB")
    print("\n[clean vessels v4 done]")


main_clean()
