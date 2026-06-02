# 神經系統互動 3D 教學工具

網頁版互動 3D 神經系統教學介面。介面與內容為繁體中文，技術名詞（three.js、glTF 等）保留英文。

## 階段進度

- [x] **① 旋轉縮放** — 載入大腦模型（目前為 procedural 佔位），OrbitControls 操作。
- [x] **② 分層剝離** — 皮膚 / 肌肉 / 骨骼 / 血管 / 神經系統，三態切換（顯示 / 淡出 / 隱藏）+ bulk。
- [x] **③ 點選 → 資訊面板** — 中文名 / 拉丁名 / 中文功能說明；深部核標記永遠可見、淺層 marker 推到表面外。
- [x] **④ 功能通路高亮 + 動畫** — `pathways.json` 驅動，整條鏈高亮 + 光點沿 CatmullRomCurve3 流動。
- [x] **⑤ 剖面切片** — 三軸 clipping plane（矢狀 X / 冠狀 Z / 水平 Y），標記與通路覆蓋不受切影響。
- [x] **⑥ 真實 glTF 資產管線（核心）** — Z-Anatomy `Brain` + `Heart` collection 經 headless Blender + Decimate + Draco 匯出，`scripts/export.py` 可重跑。Markers 已依真實腦座標（mesh 重心）重新校準。
- [ ] **⑥ 延伸**：皮膚/肌肉/骨骼/血管圖層仍 procedural；mesh-name → structure-id 對應未做（目前點選只能透過 marker）；heart.glb 已備好但未接入通路動畫。

## 執行方式

```bash
npm install
npm run dev
```

dev server 預設跑在 http://localhost:5173。

### 操作
- 拖曳：旋轉 / 滾輪：縮放 / 右鍵：平移
- 點結構標記 → 跳資訊；點通路按鈕 → 播放
- `R` 重設視角 / `Esc` 取消選取或停通路
- 所有面板（分層剝離 / 功能通路 / 通路說明 / 剖面切片）header 可拖、可收合（▾/▸）

## 目錄結構

```
.
├── index.html
├── package.json
├── pathways.json              # 功能通路定義（資料驅動）
├── structures.json            # 解剖結構：中文名/拉丁名/功能/座標（資料驅動）
├── src/
│   ├── main.js                # 場景、相機、生命週期
│   ├── layers.js              # 5 層分層管理 + 高亮/淡化邏輯 + UI
│   ├── markers.js             # 結構標記（小發光球）
│   ├── selection.js           # raycaster 點選/懸停
│   ├── infoPanel.js           # 資訊面板 + tooltip
│   ├── pathways.js            # 通路索引
│   ├── pathwayPlayer.js       # 曲線 tube + 光點動畫
│   ├── pathwayPanel.js        # 通路按鈕面板 + 說明面板
│   ├── clipping.js            # 三軸剖面 + UI
│   ├── draggable.js           # 共用拖曳工具（event delegation）
│   ├── structures.js          # 結構索引 + 系統顏色
│   ├── placeholderBrain.js    # procedural 佔位大腦
│   ├── placeholderShells.js   # 佔位 schematic 殼（skin/muscle/bone/vessel）
│   └── style.css
├── public/
│   └── models/                # 後續放真實 glTF / GLB 資產
├── debug-screenshot.mjs       # playwright headless 驗證工具
├── LICENSE                    # 程式碼 MIT
└── CREDITS.md                 # 模型資產的 CC BY-SA 來源標註
```

## 模型資產（階段⑥）

真實解剖幾何來自：

- **Z-Anatomy** — https://www.z-anatomy.com/  （CC BY-SA 4.0）
- **BodyParts3D** — © The Database Center for Life Science（CC BY-SA 2.1 Japan，已內含於 Z-Anatomy）

實際匯入流程（已實作於 `scripts/`）：

```bash
# 一次性下載 Z-Anatomy.zip 並解壓
curl -L -o external/Z-Anatomy.zip \
  https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/Z-Anatomy.zip
unzip external/Z-Anatomy.zip -d external/

# 列出 collection 結構（debug 用）
/Applications/Blender.app/Contents/MacOS/Blender --background \
  external/Z-Anatomy/Startup.blend --python scripts/inspect_blend.py

# 匯出 brain.glb + heart.glb 到 /tmp/edu-export
/Applications/Blender.app/Contents/MacOS/Blender --background \
  external/Z-Anatomy/Startup.blend --python scripts/export.py

# 複製到 public/models/
cp /tmp/edu-export/brain.glb public/models/
cp /tmp/edu-export/heart.glb public/models/
```

`main.js` 的 `tryLoadRealModel` 會自動偵測 `public/models/brain.glb`，存在就載入並取代 procedural 佔位；
不存在則回退到 procedural 殼（前 5 階段的開發模式仍可運作）。

> 若要回到 placeholder 模式：刪除 `public/models/brain.glb` 即可。

### Marker 校準腳本
`debug-screenshot.mjs` 會在執行階段把 `public/models/brain.glb` 內所有 mesh 名稱與世界座標重心
（套用 main.js 的 scale/center 之後）dump 到 `/tmp/brain-landmarks.json`，
用來判定 `structures.json` 中 markerPosition 該擺哪。

## 除錯

`debug-screenshot.mjs` 用 playwright headless 跑：

```bash
node debug-screenshot.mjs
```

會在 `/tmp/` 產生多張 screenshot（idle、剖面三軸、通路播放等），並印出場景診斷（marker 數量、可見性鏈、material 設定）。

執行階段把場景關鍵物件掛到 `window.__edu`：`scene / modelRoot / layerManager / markerMap / pathwayPlayer / clipping`，方便在 DevTools console 查。

## 授權

本專案程式碼以 MIT 授權釋出，詳見 [`LICENSE`](./LICENSE)。
解剖模型衍生資產（接入後）依上游授權，採 **CC BY-SA**；請見 [`CREDITS.md`](./CREDITS.md)。
