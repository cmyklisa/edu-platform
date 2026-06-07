"""只重新匯出 muscles.glb（全身肌肉）與 vessels.glb（含 curve→mesh bake）。
共用 export.py 的函式，但只跑這兩個 job 省時。

用法：
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    external/Z-Anatomy/Startup.blend --python scripts/export_muscles_vessels.py
"""
import os
import sys
import bpy

# 把 scripts/ 加進 path 才能 import export.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # type: ignore

# 改 JOBS：只剩肌肉+血管
export.JOBS = [
    ("4: Muscular system",    "muscles.glb", 0.20),
    ("Cardiovascular system", "vessels.glb", 0.50),
]

# 重跑 main
export.main()
