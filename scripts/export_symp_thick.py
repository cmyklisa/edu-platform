"""讓交感神經幹明顯一點：bevel 從 0.0006 拉到 0.0020，tube 約 2 mm 模型單位。"""
import os, sys, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

# 用較大 bevel
_orig_c2m = export._curve_to_mesh
def _thick(curve_obj, default_bevel_depth=0.0020):
    return _orig_c2m(curve_obj, default_bevel_depth=default_bevel_depth)
export._curve_to_mesh = _thick

export.JOBS = [
    (["Sympathetic trunk", "Thoracolumbar part of autonomic division"],
     "sympathetic.glb", 0.5),
]
export.main()
