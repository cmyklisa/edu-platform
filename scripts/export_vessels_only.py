"""只重新匯出 vessels.glb，但用較小 bevel + 較強 decimate 避免檔案爆肥。
原始 Cardiovascular system = 22 mesh + 1070 curves；curve 烘成 mesh 後容易破 10 MB。
這支腳本：bevel 細、解析度低、ratio 0.30，目標 < 3 MB。
"""
import os
import sys
import bpy

print("[wrapper] __file__:", __file__)
print("[wrapper] cwd:", os.getcwd())
script_dir = os.path.dirname(os.path.abspath(__file__))
print("[wrapper] inserting:", script_dir)
sys.path.insert(0, script_dir)
print("[wrapper] sys.path[:3]:", sys.path[:3])
import export  # type: ignore
print("[wrapper] import OK")

# 改寫 _curve_to_mesh 用更小的 bevel
_orig_c2m = export._curve_to_mesh
def _smaller(curve_obj, default_bevel_depth=0.0003):
    return _orig_c2m(curve_obj, default_bevel_depth=default_bevel_depth)
export._curve_to_mesh = _smaller

# Only do vessels with aggressive decimation
export.JOBS = [
    ("Cardiovascular system", "vessels.glb", 0.30),
]
export.main()
