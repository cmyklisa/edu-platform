"""把 Z-Anatomy Startup.blend 內指定的 collection 匯出成 glTF (GLB + Draco)。

採用 explicit 樹狀走訪：
  for each target collection -> recursively collect mesh objects -> select them
然後用 use_selection=True 匯出，不依賴 view layer 的 exclude 機制
（Z-Anatomy 在 scene master collection 直屬一堆物件，exclude 蓋不到，會誤匯出）。

用法：
  blender --background external/Z-Anatomy/Startup.blend --python scripts/export.py
輸出：
  /tmp/edu-export/anatomy.glb
"""
import os
import sys
import bpy

# 每個 export job：(collection_name, output_filename, decimate_ratio)
# 拆成多個檔的好處：brain.glb 一定載入；heart.glb 只在通路啟動時 lazy-load。
JOBS = [
    ("Brain",                 "brain.glb",   0.5),
    ("Heart",                 "heart.glb",   0.5),
    ("Cranium",               "skull.glb",   0.35),   # 顱骨（含下顎），mesh 多所以多 decimate
    ("Cardiovascular system", "vessels.glb", 0.5),    # 全身血管系統（無細分頭部）
    ("Spinal cord",           "spinal.glb",  0.5),    # 脊髓本體（Z-Anatomy 只有約 2 mesh）
    ("Muscles of head",       "muscles.glb", 0.45),   # 頭部肌肉
    ("Regions of head",       "skin.glb",    0.5),    # 頭部表面區塊（拼成 face mask）
    ("Spinal nerves",         "nerves.glb",  0.25),   # 周邊神經（含交感纖維），從脊髓延伸
    # 交感神經幹（Sympathetic trunk）+ 胸腰段自主神經，沿脊髓兩側分布
    (["Sympathetic trunk", "Thoracolumbar part of autonomic division"],
                              "sympathetic.glb", 0.5),
    # 全身骨骼（含顱骨）— 大檔，多 decimate 控制大小
    ("Skeletal system",       "skeleton.glb", 0.20),
    # 12 對腦神經（從腦幹延伸出去：嗅、視、動眼、滑車、三叉、外展、顏面、前庭蝸、舌咽、迷走、副、舌下）
    ("Cranial nerves",        "cranial-nerves.glb", 0.5),
]

MIN_POLYS_TO_DECIMATE = 200
OUTPUT_DIR = "/tmp/edu-export"


def collect_meshes_recursive(coll, out, include_curves=True):
    """收集 MESH。如果 include_curves，把 CURVE 透過 depsgraph 評估後轉成新 mesh
    （Z-Anatomy 的神經幹是有 bevel 的 curve，視覺上是細管，必須轉成 mesh 才能匯出 glTF）。
    """
    for obj in coll.objects:
        if obj.type == 'MESH':
            out.append(obj)
        elif include_curves and obj.type == 'CURVE':
            new_obj = _curve_to_mesh(obj)
            if new_obj is not None:
                out.append(new_obj)
    for child in coll.children:
        collect_meshes_recursive(child, out, include_curves)


def _curve_to_mesh(curve_obj):
    """把單一 CURVE 物件（含 bevel）烘成新的 MESH 物件，連進當前 scene。失敗回 None。"""
    try:
        deps = bpy.context.evaluated_depsgraph_get()
        eval_obj = curve_obj.evaluated_get(deps)
        mesh_data = bpy.data.meshes.new_from_object(eval_obj)
        if mesh_data is None or len(mesh_data.vertices) == 0:
            if mesh_data is not None:
                bpy.data.meshes.remove(mesh_data)
            return None
        new_obj = bpy.data.objects.new(curve_obj.name + '_baked', mesh_data)
        new_obj.matrix_world = curve_obj.matrix_world.copy()
        bpy.context.scene.collection.objects.link(new_obj)
        return new_obj
    except Exception as e:
        print(f"  ! curve→mesh failed for '{curve_obj.name}': {e}")
        return None


def apply_decimate(obj, ratio):
    if len(obj.data.polygons) < MIN_POLYS_TO_DECIMATE:
        return False
    bpy.context.view_layer.objects.active = obj
    # apply requires the object to be selected and active
    was_selected = obj.select_get()
    obj.select_set(True)
    try:
        mod = obj.modifiers.new(name="decimate_export", type='DECIMATE')
        mod.ratio = ratio
        mod.decimate_type = 'COLLAPSE'
        bpy.ops.object.modifier_apply(modifier=mod.name)
        return True
    except Exception as e:
        print(f"  ! decimate failed on '{obj.name}': {e}")
        return False
    finally:
        obj.select_set(was_selected)


def export_one(coll_spec, filename, decimate_ratio):
    """coll_spec 可以是單一 collection name，或是 list of names（合併到同一 GLB）。"""
    out_path = os.path.join(OUTPUT_DIR, filename)
    coll_names = coll_spec if isinstance(coll_spec, (list, tuple)) else [coll_spec]
    label = " + ".join(coll_names)
    print(f"\n========== Export job: {label} → {filename} ==========")

    # Collect target meshes from one or more collections
    targets = []
    for name in coll_names:
        coll = bpy.data.collections.get(name)
        if coll is None:
            print(f"  ✗ collection '{name}' not found, skipping")
            continue
        collect_meshes_recursive(coll, targets)
    targets = list({o.name: o for o in targets}.values())
    print(f"  collected {len(targets)} unique meshes")
    poly_before = sum(len(o.data.polygons) for o in targets)
    print(f"  polys before decimate: {poly_before:,}")

    # Deselect everything
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.data.objects:
        try: obj.select_set(False)
        except Exception: pass

    # Decimate (idempotent across jobs because each job uses different ratio per call,
    # but applied modifiers stick; rerun changes mesh further — accept that, jobs run once)
    decimated = 0
    for obj in targets:
        if apply_decimate(obj, decimate_ratio):
            decimated += 1
    poly_after = sum(len(o.data.polygons) for o in targets)
    print(f"  decimated {decimated} of {len(targets)} (rest under {MIN_POLYS_TO_DECIMATE} polys)")
    print(f"  polys after  decimate: {poly_after:,}  ({100 * (1 - poly_after / max(1, poly_before)):.1f}% reduction)")

    # Select targets only
    bpy.ops.object.select_all(action='DESELECT')
    n_sel = 0
    for obj in targets:
        try:
            obj.select_set(True)
            n_sel += 1
        except Exception:
            pass
    print(f"  selected {n_sel} meshes")

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
    print(f"  ✓ {out_path}  →  {size / 1024 / 1024:.2f} MB")
    return out_path


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for coll_name, filename, ratio in JOBS:
        export_one(coll_name, filename, ratio)
    print("\n[all done]")


main()
