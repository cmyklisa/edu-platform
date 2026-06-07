"""乾淨匯出 cranial-nerves.glb：篩掉肌肉污染（masseter, orbicularis 等）。
保留：12 對腦神經 + neural ganglia。
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

NAME_BLACKLIST = [
    'muscle', 'tendon',
    'masseter', 'temporalis', 'platysma', 'sternocleidomastoid',
    'orbicularis', 'levator', 'levator palpebrae',  # eye/face muscles
    'mylohyoid', 'stylohyoid', 'sternohyoid', 'sphincter',
    'digastric', 'omohyoid', 'thyrohyoid',
    'pterygoid', 'mentalis', 'risorius', 'buccinator', 'zygomaticus',
    'auricularis', 'frontalis', 'occipitalis', 'procerus',
    'corrugator', 'depressor', 'tensor',
    'fascia', 'aponeur',
    '.j',
]
NERVE_KEYWORDS = [
    'nerve', 'plexus', 'rami', 'ramus', 'ganglion', 'ganglia',
    'olfactory', 'optic', 'oculomotor', 'trochlear', 'trigeminal',
    'abducens', 'facial', 'vestibulocochlear', 'cochlear', 'vestibular',
    'glossopharyngeal', 'vagus', 'accessory', 'hypoglossal',
    'ophthalmic', 'maxillary', 'mandibular',
    'chorda', 'tympani',
    'tract',  # optic tract, etc
]


def is_nerve_like(name):
    low = name.lower()
    for kw in NAME_BLACKLIST:
        if kw in low:
            return False
    return any(kw in low for kw in NERVE_KEYWORDS)


def collect_filtered_recursive(coll, out, include_curves=True):
    for obj in coll.objects:
        if obj.type == 'MESH':
            if is_nerve_like(obj.name):
                out.append(obj)
        elif include_curves and obj.type == 'CURVE':
            if not is_nerve_like(obj.name):
                continue
            new_obj = export._curve_to_mesh(obj, default_bevel_depth=0.0003)
            if new_obj is not None:
                out.append(new_obj)
    for child in coll.children:
        collect_filtered_recursive(child, out, include_curves)

export.collect_meshes_recursive = collect_filtered_recursive

export.JOBS = [
    ("Cranial nerves", "cranial-nerves.glb", 0.50),
]
export.main()
