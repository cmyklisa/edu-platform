"""進階版乾淨神經匯出：合併 Peripheral nervous system 的 MESH（過濾掉肌肉）
+ 主要神經幹的 CURVE bake（Sciatic, Brachial plexus, Cranial nerves）。

把多個子 collection 各自送進 export_one 後再用 gltf-pack 不太可行；
改成把多個 collection 合併到一個 fake collection 來一次 export。
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

SMALL_BEVEL = 0.0003   # 約 0.3 mm 模型單位

NAME_BLACKLIST = [
    'muscle', 'tendon', 'aponeurosis',
    'levator', 'rhomboid', 'extensor', 'flexor', 'pectoralis', 'biceps',
    'triceps', 'gluteus', 'soleus', 'gastrocnemius', 'deltoid', 'trapezius',
    'sartorius', 'gracilis', 'adductor', 'abductor', 'oblique',
    'transversus', 'splenius', 'iliacus', 'psoas', 'piriformis', 'tensor',
    'masseter', 'temporalis', 'platysma', 'sternocleidomastoid',
    'serratus', 'latissimus', 'supraspinatus', 'infraspinatus',
    'subscapularis', 'teres', 'brachioradialis', 'pronator', 'supinator',
    'palmar', 'fibularis', 'tibialis',
    'omohyoid', 'digastric', 'mylohyoid', 'stylohyoid',
    'sternohyoid', 'sphincter',
    'fascia', 'aponeur', 'retinaculum',
    'orbicularis',
    'vertebra', 'skull', 'mandible', 'maxilla',
    '.j',
]
NERVE_KEYWORDS = [
    'nerve', 'plexus', 'rami', 'ramus', 'ganglion', 'ganglia', 'trunk',
    'cord of', 'cervical', 'thoracic', 'lumbar', 'sacral',
    'sciatic', 'femoral', 'median', 'ulnar', 'radial', 'axillary',
    'tibial', 'fibular', 'peroneal', 'phrenic', 'vagus',
    'trigeminal', 'facial', 'optic', 'olfactory',
]


def is_nerve_like(name):
    low = name.lower()
    for kw in NAME_BLACKLIST:
        if kw in low:
            return False
    return any(kw in low for kw in NERVE_KEYWORDS)


def collect_filtered_recursive(coll, out, baked_curves, include_curves=True):
    for obj in coll.objects:
        if obj.type == 'MESH':
            if is_nerve_like(obj.name):
                out.append(obj)
        elif include_curves and obj.type == 'CURVE':
            if not is_nerve_like(obj.name):
                continue
            new_obj = export._curve_to_mesh(obj, default_bevel_depth=SMALL_BEVEL)
            if new_obj is not None:
                baked_curves.append(new_obj)
                out.append(new_obj)
    for child in coll.children:
        collect_filtered_recursive(child, out, baked_curves, include_curves)


# 來源 collection（主要神經幹）— 各自掃描，curve bake 集中起來算
SOURCE_COLLECTIONS = [
    'Sciatic nerve',         # 142 mesh + 72 curves (下肢)
    'Brachial plexus',       # 108 mesh + 136 curves (上肢)
    'Lumbosacral plexus',    # 171 mesh + 202 curves (骨盆/下肢)
    # 不放 'Peripheral nervous system' 整個（925 curves 太多會 hang）
]

def main_clean():
    os.makedirs(export.OUTPUT_DIR, exist_ok=True)
    print("\n========== Clean nerves export ==========")
    targets = []
    baked = []
    for cname in SOURCE_COLLECTIONS:
        coll = bpy.data.collections.get(cname)
        if coll is None:
            print(f"  ! collection '{cname}' not found")
            continue
        print(f"  collecting from: {cname}")
        before_n = len(targets)
        collect_filtered_recursive(coll, targets, baked, include_curves=True)
        print(f"    +{len(targets) - before_n} items so far (total {len(targets)})")
    targets = list({id(o): o for o in targets}.values())  # dedup by id
    print(f"\n  TOTAL: {len(targets)} unique items ({len(baked)} from curve bake)")

    poly_before = sum(len(o.data.polygons) for o in targets if o.data is not None)
    print(f"  polys before decimate: {poly_before:,}")

    # Deselect everything
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.data.objects:
        try: obj.select_set(False)
        except Exception: pass

    # Decimate（神經本身就薄，不過度 decimate）
    decimate_ratio = 0.6
    decimated = 0
    for obj in targets:
        if export.apply_decimate(obj, decimate_ratio):
            decimated += 1
    poly_after = sum(len(o.data.polygons) for o in targets if o.data is not None)
    print(f"  decimated {decimated}/{len(targets)}; polys after: {poly_after:,}")

    bpy.ops.object.select_all(action='DESELECT')
    for obj in targets:
        try: obj.select_set(True)
        except Exception: pass

    out_path = os.path.join(export.OUTPUT_DIR, 'nerves.glb')
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
    print("\n[clean nerves done]")


main_clean()
