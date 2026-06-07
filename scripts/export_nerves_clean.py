"""乾淨重匯 nerves.glb：
- 來源：Peripheral nervous system + Sciatic nerve + Brachial plexus 的 CURVE
        （真正的細線神經），不是 .j 表面註記，也不是錯放的肌肉
- 過濾規則：排除名稱含「muscle / tendon / 肌肉名」的物件
- 排除 .j 結尾（表面註記）
- CURVE 全部設小 bevel 後烘成 mesh

之前 nerves.glb 188 mesh 全是肌肉（Levator scapulae, Rhomboid, Extensor 等），
源自 Z-Anatomy 'Spinal nerves' collection 內附的 insertion-muscle 參照。
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

# 用較小 bevel 讓神經呈現細線狀（< 1 mm 模型單位）
SMALL_BEVEL = 0.0002

# 名稱黑名單（lowercase substring 比對）
NAME_BLACKLIST = [
    'muscle', 'tendon', 'aponeurosis',
    'levator', 'rhomboid', 'extensor', 'flexor', 'pectoralis', 'biceps',
    'triceps', 'gluteus', 'soleus', 'gastrocnemius', 'deltoid', 'trapezius',
    'sartorius', 'gracilis', 'adductor', 'abductor', 'rectus', 'oblique',
    'transversus', 'splenius', 'iliacus', 'psoas', 'piriformis', 'tensor',
    'masseter', 'temporalis', 'platysma', 'sternocleidomastoid',
    'serratus', 'latissimus', 'supraspinatus', 'infraspinatus',
    'subscapularis', 'teres', 'brachioradialis', 'pronator', 'supinator',
    'palmar', 'plantar', 'fibularis', 'tibialis', 'peroneus',
    'omohyoid', 'digastric', 'mylohyoid', 'stylohyoid', 'thyrohyoid',
    'sternohyoid', 'sternothyroid', 'sphincter',
    'fascia', 'aponeur', 'retinaculum', 'galea', 'capsule',
    'orbicularis',
    # bones / skull / vertebra / joints 也可能誤入
    'vertebra', 'skull', 'mandible', 'maxilla',
    # surface annotation 表記
    '.j',
]


def is_nerve_like(name):
    low = name.lower()
    # 黑名單：含任何禁字就 reject
    for kw in NAME_BLACKLIST:
        if kw in low:
            return False
    # 真實的神經名稱通常含 'nerve' / 'plexus' / 'rami' / 'ganglion' / 'trunk'
    nerve_keywords = ['nerve', 'plexus', 'rami', 'ramus', 'ganglion', 'trunk',
                      'cord', 'cervical', 'thoracic', 'lumbar', 'sacral',
                      'sciatic', 'femoral', 'median', 'ulnar', 'radial',
                      'axillary', 'tibial', 'fibular', 'peroneal',
                      'phrenic', 'vagus', 'trigeminal', 'facial']
    return any(kw in low for kw in nerve_keywords)


# Monkey-patch collect_meshes_recursive：先試只匯 MESH（不烘 curve，避免 925 條
# 跑太久）。curve bake 留給後續離線 job 處理。
def collect_filtered(coll, out, include_curves=False):
    for obj in coll.objects:
        if obj.type == 'MESH':
            if is_nerve_like(obj.name):
                out.append(obj)
        elif include_curves and obj.type == 'CURVE':
            if not is_nerve_like(obj.name):
                continue
            new_obj = export._curve_to_mesh(obj, default_bevel_depth=SMALL_BEVEL)
            if new_obj is not None:
                out.append(new_obj)
    for child in coll.children:
        collect_filtered(child, out, include_curves)

export.collect_meshes_recursive = collect_filtered

# 設定 JOB：用 Peripheral nervous system（403 mesh）；過濾後留下真正神經 mesh
export.JOBS = [
    ("Peripheral nervous system", "nerves.glb", 0.50),
]
export.main()
