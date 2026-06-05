# 資產來源與授權標註

本專案的解剖 3D 幾何資料來自下列開放資料集。任何散布的衍生模型/網格必須依其授權條款延續使用。

## 模型來源

### Z-Anatomy
- 網站：https://www.z-anatomy.com/
- Repo：https://github.com/Z-Anatomy/Models-of-human-anatomy
- 授權：**CC BY-SA 4.0**
- 用途：神經系統、腦部結構、分層解剖（皮膚 / 肌肉 / 骨骼 / 血管 / 神經 / 內臟）
- 命名規範：Terminologia Anatomica

### BodyParts3D
- Repo：https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
- 原始機構：The Database Center for Life Science (DBCLS)
- 授權：**CC BY-SA 2.1 Japan**
- 標註：BodyParts3D, © The Database Center for Life Science, licensed under CC BY-SA 2.1 Japan
- 用途：補充特定器官（如心臟）

## 散布條款

由於 Z-Anatomy 與 BodyParts3D 皆為 **CC BY-SA**：

- 任何由其衍生（修改、簡化、轉檔、重新拓樸）的模型，**散布時必須以相同的 CC BY-SA 授權**釋出。
- 必須提供來源標註（attribution）。
- 必須註明修改內容（例如：decimated、re-meshed、re-grouped）。

## 程式碼

本專案的 JavaScript / HTML / CSS 程式碼以 MIT 授權釋出，與模型資產的授權分離（程式碼非模型衍生品）。

## 目前狀態

### `public/models/brain.glb`
- **來源**：Z-Anatomy（CC BY-SA 4.0）`Startup.blend` 的 `Brain` collection（含 cerebrum、cerebellum、brainstem 全展開的子 collection）
- **衍生工具**：`scripts/export.py`（Blender 5.1，headless）
- **修改**：
  - 以遞迴方式從 `bpy.data.collections['Brain']` 收集 mesh 物件
  - 超過 200 polygons 的 mesh 套用 Decimate modifier（ratio 0.5）後 apply
  - glTF Y-up 轉換，Draco 壓縮（位置 14、法線 10、UV 12 量化）
  - 結果：257 mesh，482k polygons，1.4 MB（GLB 二進位）

### `public/models/heart.glb`
- **來源**：Z-Anatomy（CC BY-SA 4.0）`Startup.blend` 的 `Heart` collection
- **衍生工具**：同上
- **修改**：
  - 全部 17 個 mesh 都套用 Decimate ratio 0.5（小型結構也減）
  - Y-up + Draco
  - 結果：17 mesh，28.5k polygons，212 KB

### `public/models/viscera.glb`
- **來源**：Z-Anatomy（CC BY-SA 4.0）`Startup.blend` 中以下器官 mesh：
  Lungs（5 葉）、Liver、Kidney（雙側）、Stomach、Duodenum/Jejunum、Colon/Vermiform appendix、Spleen、Pancreas、Suprarenal gland（雙側）
- **衍生工具**：`scripts/export_viscera.py`（Blender 5.1，headless）
- **修改**：
  - 以 object-name 白名單過濾 mesh（排除動脈、靜脈、淋巴結等非器官結構）
  - Curve 物件（如 Jejunum）以 depsgraph 烘成 mesh
  - 重新命名為 `organ_<id>__NN` 便於前端 structureId 對應
  - Decimate ratio 0.4 後 apply
  - Y-up + Draco
  - 結果：20 unique mesh，~21k polygons，0.36 MB

### `scripts/export.py` 與 `scripts/inspect_blend.py`
- 衍生自 Z-Anatomy 上游資料，本身為使用 Blender Python API 的描述性程式碼
- 以 MIT 授權釋出（與本 repo 程式碼相同），但其產出（上述 GLB）採 CC BY-SA 4.0

### 散布時必附的歸屬聲明
若您散布上述衍生 GLB，請保留以下文字（或顯示在 UI 中，本 repo 已在頁尾顯示）：
> Anatomical models derived from Z-Anatomy by Gauthier Kervyn & Marcin Zielinski,
> Z-Anatomy itself derived from BodyParts3D © The Database Center for Life Science.
> Both upstream and this derivative are licensed under CC BY-SA 4.0.
> Modifications: collection extraction, decimation (Blender Decimate Collapse), glTF Y-up + Draco compression.

### 尚未匯入的部分
- 皮膚 / 肌肉 / 骨骼 / 血管圖層：目前仍使用 procedural schematic 殼（非衍生資產）
- BodyParts3D 心臟原始 OBJ：未直接使用（已透過 Z-Anatomy 的整合版包進 `Heart` collection）
