"""把 Z-Anatomy 內臟器官（除心臟外）匯出成 viscera.glb。
心臟已用 heart.glb 提供，這支腳本負責肺/肝/腎/胃/小腸/大腸/脾/胰/腎上腺。

策略：用 explicit object-name whitelist（Z-Anatomy 大量內臟 mesh 不在 per-organ collection 內，
而是直接掛在 scene master，所以用 name pattern 比 collection 可靠）。

用法：
  /Applications/Blender.app/Contents/MacOS/Blender --background external/Z-Anatomy/Startup.blend \
    --python scripts/export_viscera.py
輸出：
  /tmp/edu-export/viscera.glb
"""
import os
import sys
import bpy

OUTPUT_DIR = "/tmp/edu-export"
DECIMATE_RATIO = 0.40    # 內臟 mesh 細節較細，降低 mesh 大小
MIN_POLYS_TO_DECIMATE = 200

# 每個器官對應的 object-name 白名單與黑名單關鍵字（lowercase 比對）。
# include = 必須含其中之一；exclude = 含其中之一就跳過。
ORGAN_FILTERS = {
    'lung': dict(
        include=['lung'],
        exclude=['node', 'artery', 'vein', 'pleura', 'bronchus', 'bronchi',
                 'trunk', 'plexus', 'recess', 'impression', 'pulmonary',
                 'apex of', 'base of', 'border of', 'hilum of', 'fissure',
                 'notch', 'surface of', 'segment of', 'segmental', 'lingula',
                 'cardiac'],
    ),
    'liver': dict(
        include=['liver'],
        exclude=['node', 'artery', 'vein', 'duct', 'plexus', 'fissure',
                 'recess', 'flexure', 'impression', 'border of', 'surface of',
                 'tuberosity', 'appendix', 'bare area', 'segment of', 'part of',
                 'division of', 'lobe of liver', 'porta hepatis'],
    ),
    'kidney': dict(
        include=['kidney'],
        exclude=['node', 'artery', 'vein', 'plexus', 'lobe', 'pole', 'border',
                 'sinus', 'hilum', 'surface', 'impression', 'fossa',
                 'pyramid', 'papilla', 'pelvis of kidney', 'cortex',
                 'major calic', 'minor calic', 'capsule', 'cribriform',
                 'medulla of', 'fascia', 'intrarenal', 'arteries'],
    ),
    'stomach': dict(
        include=['stomach'],
        exclude=['node', 'artery', 'vein', 'plexus', 'wall', 'curvature',
                 'fundus', 'cardia', 'pylor', 'body of', 'mucosa', 'serosa',
                 'omentum', 'mesogastr', 'orifice', 'impression', 'bed',
                 'gastric'],
    ),
    'small-intestine': dict(
        include=['small intestine', 'duodenum', 'jejunum', 'ileum'],
        exclude=['node', 'artery', 'vein', 'plexus', 'mucosa', 'muscular',
                 'mesentery', 'mesogastr', 'orifice', 'flexure', 'ascending',
                 'descending', 'horizontal', 'paraduodenal', 'duodenojejunal',
                 'fold of', 'recess', 'major papilla', 'minor papilla',
                 'ampulla', 'suspensory', 'iliacus', 'ileocaecal', 'sphincter'],
    ),
    'large-intestine': dict(
        include=['colon', 'caecum', 'rectum', 'vermiform appendix',
                 'large intestine'],
        exclude=['node', 'artery', 'vein', 'plexus', 'mucosa', 'muscular',
                 'mesocolon', 'mesentery', 'flexure', 'haustr', 'taenia',
                 'orifice', 'ileal', 'caecal', 'pericolic', 'paracolic',
                 'sigmoid mesocolon', 'foramen caecum', 'rectovesical',
                 'rectoutérine', 'recto-uterine', 'rectovaginal',
                 'rectus', 'rectal column', 'anal canal', 'lateral flexure',
                 'pericardial', 'pericardium', 'frontal bone'],
    ),
    'spleen': dict(
        include=['spleen'],
        exclude=['node', 'artery', 'vein', 'plexus', 'splenius', 'pulp',
                 'splenic flexure', 'colic flexure', 'impression', 'border',
                 'extremity', 'hilum', 'surface', 'splenorenal', 'gastrosplen',
                 'lienorenal'],
    ),
    'pancreas': dict(
        include=['pancreas'],
        exclude=['node', 'artery', 'vein', 'plexus', 'duct', 'head of',
                 'body of', 'neck of', 'tail of', 'border', 'surface',
                 'pancreaticoduodenal', 'impression', 'process', 'notch'],
    ),
    'adrenal-gland': dict(
        include=['suprarenal'],
        exclude=['node', 'artery', 'vein', 'plexus', 'border', 'surface',
                 'hilum', 'impression', 'fossa'],
    ),
}


def _curve_to_mesh(curve_obj):
    """烘 curve（含 bevel）成新的 MESH 物件，連進當前 scene。失敗回 None。"""
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


def find_targets():
    """For each organ, find matching MESH/CURVE objects (curves baked to mesh)."""
    result = {}
    for organ, filt in ORGAN_FILTERS.items():
        incl = [s.lower() for s in filt['include']]
        excl = [s.lower() for s in filt['exclude']]
        matches = []
        # Iterate a snapshot since curve→mesh adds new objects to bpy.data.objects
        snapshot = list(bpy.data.objects)
        for obj in snapshot:
            if obj.type not in ('MESH', 'CURVE'):
                continue
            low = obj.name.lower()
            # Skip surface-curve helpers (.j suffix on the object name)
            if obj.name.endswith('.j'):
                continue
            if not any(p in low for p in incl):
                continue
            if any(p in low for p in excl):
                continue
            if obj.type == 'CURVE':
                baked = _curve_to_mesh(obj)
                if baked is None:
                    continue
                matches.append(baked)
            else:
                matches.append(obj)
        result[organ] = matches
        names = [o.name for o in matches]
        print(f"\n== {organ} == ({len(matches)} meshes)")
        for n in names:
            print(f"  - {n}")
    return result


def apply_decimate(obj, ratio):
    if len(obj.data.polygons) < MIN_POLYS_TO_DECIMATE:
        return False
    bpy.context.view_layer.objects.active = obj
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


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    targets_by_organ = find_targets()

    # 把每個 mesh 直接 rename 成 organ-tag 前綴，並 reparent 到 scene collection 頂層
    # （避免 Blender gltf exporter 把 parent group 也一起拉進來，導致名稱被改成 Mesh_N）。
    all_targets = []
    seen = set()
    for organ, meshes in targets_by_organ.items():
        for i, obj in enumerate(meshes):
            if id(obj) in seen:
                continue
            seen.add(id(obj))
            # 解 parent，避免 export_apply 把 parent 一起拉
            try:
                if obj.parent is not None:
                    # Save world matrix, clear parent, restore
                    world = obj.matrix_world.copy()
                    obj.parent = None
                    obj.matrix_world = world
            except Exception as e:
                print(f"  ! unparent failed on '{obj.name}': {e}")
            # Mesh data 可能被多個 object 共用（Blender linked-data），複製成獨立 data
            # 才能安全 rename 並避免匯出時其他共用此 data 的 object 也被拉進來。
            if obj.data is not None and obj.data.users > 1:
                obj.data = obj.data.copy()
            new_name = f"organ_{organ}__{i:02d}"
            old_name = obj.name
            obj.name = new_name
            if obj.data is not None:
                obj.data.name = new_name
            print(f"  rename: '{old_name}' → '{obj.name}'  (data='{obj.data.name if obj.data else None}')")
            all_targets.append(obj)
    print(f"\nTotal unique target meshes: {len(all_targets)}")
    poly_before = sum(len(o.data.polygons) for o in all_targets)
    print(f"Polys before decimate: {poly_before:,}")

    # Object mode + deselect everything first
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.data.objects:
        try: obj.select_set(False)
        except Exception: pass

    # Decimate
    decimated = 0
    for obj in all_targets:
        if apply_decimate(obj, DECIMATE_RATIO):
            decimated += 1
    poly_after = sum(len(o.data.polygons) for o in all_targets)
    print(f"Decimated {decimated}/{len(all_targets)}; polys after: {poly_after:,}")

    bpy.ops.object.select_all(action='DESELECT')
    n_sel = 0
    for obj in all_targets:
        try:
            obj.select_set(True)
            n_sel += 1
        except Exception:
            pass
    print(f"Selected {n_sel} for export")

    out_path = os.path.join(OUTPUT_DIR, 'viscera.glb')
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
    print(f"\n✓ {out_path}  →  {size / 1024 / 1024:.2f} MB")


main()
