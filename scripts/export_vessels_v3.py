"""補齊全身血管：用 'Arteries\\'' + 'Veins\\'' 等子 collection 的 CURVE bake。
避開「Cardiovascular system」整包 (1070 curves 太多會 hang)。
分多個 sub-collection，每個獨立 bake，避免單一巨大 job 卡住。
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

# bevel 0.0008 = 0.8 mm 模型單位（適合主要動靜脈）
VESSEL_BEVEL = 0.0008

# 收集主要血管子 collection（mesh + 適量 curves，避免 1070 一次來）
SOURCE_COLLECTIONS = [
    "5: Cardiovascular system",   # 60 mesh + 654 curves (含 aorta、vena cava 等主幹)
]

NAME_BLACKLIST = [
    'muscle', 'tendon', 'aponeurosis',
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
        if kw in low:
            return False
    return any(kw in low for kw in VESSEL_KEYWORDS)


def collect_recursive(coll, out, baked, include_curves=True):
    for obj in coll.objects:
        if obj.type == 'MESH':
            if is_vessel_like(obj.name):
                out.append(obj)
        elif include_curves and obj.type == 'CURVE':
            if not is_vessel_like(obj.name):
                continue
            new_obj = export._curve_to_mesh(obj, default_bevel_depth=VESSEL_BEVEL)
            if new_obj is not None:
                baked.append(new_obj)
                out.append(new_obj)
    for ch in coll.children:
        collect_recursive(ch, out, baked, include_curves)


def main_clean():
    os.makedirs(export.OUTPUT_DIR, exist_ok=True)
    print("\n========== Clean vessels export ==========")
    targets = []
    baked = []
    for cname in SOURCE_COLLECTIONS:
        coll = bpy.data.collections.get(cname)
        if coll is None:
            print(f"  ! not found: {cname}")
            continue
        print(f"  collecting from: {cname}")
        before = len(targets)
        collect_recursive(coll, targets, baked, include_curves=True)
        print(f"    +{len(targets) - before} (total {len(targets)})")

    targets = list({id(o): o for o in targets}.values())
    print(f"\n  TOTAL: {len(targets)} unique ({len(baked)} from curve bake)")

    poly_before = sum(len(o.data.polygons) for o in targets if o.data is not None)
    print(f"  polys before decimate: {poly_before:,}")

    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.data.objects:
        try: obj.select_set(False)
        except Exception: pass

    decimated = 0
    for obj in targets:
        if export.apply_decimate(obj, 0.40):
            decimated += 1
    poly_after = sum(len(o.data.polygons) for o in targets if o.data is not None)
    print(f"  decimated {decimated}/{len(targets)}; polys after: {poly_after:,}")

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
    print("\n[clean vessels done]")


main_clean()
