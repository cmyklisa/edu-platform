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

> 第①階段尚未匯入真實解剖幾何，畫面顯示的是 procedural 佔位模型（純算法生成，非衍生資產），不受上述 CC BY-SA 約束。真實資產接入後本檔將更新對應檔案清單與其修改說明。
