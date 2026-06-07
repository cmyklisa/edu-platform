"""快速版 vessel 重新匯出：用「5: Cardiovascular system」(60 mesh，3x 現在的 22)，
不烘 curves（curve bake 太慢 / 檔案爆肥）。

之後若要更多細節：手動在 Blender GUI 內把 curve.data.bevel_depth 預先設好再用
export.py 跑 include_curves=True，或改用 procedural vessel tubes（不從 Z-Anatomy）。
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

# Force include_curves=False
_orig_collect = export.collect_meshes_recursive
def _collect_no_curves(coll, out, include_curves=False):
    return _orig_collect(coll, out, include_curves=False)
export.collect_meshes_recursive = _collect_no_curves

export.JOBS = [
    ("5: Cardiovascular system", "vessels.glb", 0.40),
]
export.main()
