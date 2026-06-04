import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createPlaceholderBrain } from './placeholderBrain.js';
import {
  createSkinShell, createMuscleShell, createBoneShell, createVesselTubes,
  createSkinShellAroundBbox, createMuscleShellAroundBbox,
} from './placeholderShells.js';
import { LayerManager } from './layers.js';
import { buildToolsPanel } from './toolsPanel.js';
import { structuresList, SYSTEM_COLORS } from './structures.js';
import { colorizeBrain } from './colorize.js';
import { tagBrainMeshes } from './structureMeshMap.js';
import { createMarkers, updateMarkerVisuals } from './markers.js';
import { SelectionController } from './selection.js';
import { buildInfoPanel, buildTooltip } from './infoPanel.js';
import { PathwayPlayer } from './pathwayPlayer.js';
import { ClippingController } from './clipping.js';
import { createOrientationEyes } from './orientationCue.js';
import { createSkinTexture, findOrbitalCenters } from './skinTexture.js';
import { NervePulseController } from './nervePulse.js';
import { ExplodeController, buildExplodePanel } from './explode.js';
import { OrganNavigator, buildOrganNavBar } from './organNav.js';
import { createHeartVessels } from './heartVessels.js';
import { QuizController, buildQuizToggle } from './quiz.js';
import { makeDraggable } from './draggable.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');
const toolsPanelEl       = document.getElementById('tools-panel');
const organNavEl         = document.getElementById('organ-nav');
const infoPanelEl        = document.getElementById('info-panel');
const tooltipEl          = document.getElementById('tooltip');
const pathwayDescPanelEl = document.getElementById('pathway-desc-panel');
const explodePanelEl     = document.getElementById('explode-panel');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  40, window.innerWidth / window.innerHeight, 0.05, 100
);
camera.position.set(0, 0.35, 3.4);

// ── Lighting ─────────────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0xc9d6ff, 0x202840, 0.55));
const keyLight  = new THREE.DirectionalLight(0xffffff, 1.35);  keyLight.position.set(2.5, 3, 2.5);  scene.add(keyLight);
const rimLight  = new THREE.DirectionalLight(0x88aaff, 0.65);  rimLight.position.set(-3, 1.2, -2);  scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xffd9c0, 0.35);  fillLight.position.set(0, -2, 2);    scene.add(fillLight);

// ── Controls ─────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.9;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.7;
controls.minDistance = 1.2;
controls.maxDistance = 8;
controls.target.set(0, 0, 0);
controls.update();

const defaultCameraPos = camera.position.clone();
const defaultTarget = controls.target.clone();

// ── Model + Layers ───────────────────────────────────────────────────────
const modelRoot = new THREE.Group();
scene.add(modelRoot);

const layerManager = new LayerManager();
layerManager.addAllTo(modelRoot);

// 用 BASE_URL 處理 GitHub Pages 部署路徑（dev: '/', prod: '/edu-platform/'）
const BASE = import.meta.env.BASE_URL;
const REAL_MODEL_URL    = `${BASE}models/brain.glb`;
const REAL_SKULL_URL    = `${BASE}models/skull.glb`;        // 頭骨（保留 fallback）
const REAL_SKELETON_URL = `${BASE}models/skeleton.glb`;     // 全身骨骼（含顱骨）
const REAL_VESSELS_URL  = `${BASE}models/vessels.glb`;
const REAL_HEART_URL    = `${BASE}models/heart.glb`;
const REAL_SPINAL_URL   = `${BASE}models/spinal.glb`;
const REAL_MUSCLES_URL  = `${BASE}models/muscles.glb`;
const REAL_SKIN_URL     = `${BASE}models/skin.glb`;
const REAL_NERVES_URL   = `${BASE}models/nerves.glb`;
const REAL_SYMP_URL     = `${BASE}models/sympathetic.glb`;
const REAL_CN_URL       = `${BASE}models/cranial-nerves.glb`;  // 12 對腦神經

// 共享 Draco loader — 多個 GLB 載入只下載一次 decoder wasm
const _shared_draco = new DRACOLoader();
_shared_draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

async function tryLoadRealModel(url) {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return null;
    const ct = (head.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/json')) return null;
  } catch { return null; }

  const loader = new GLTFLoader();
  loader.setDRACOLoader(_shared_draco);
  // 加 15s timeout，避免單一 GLB 卡住整個 init flow
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn(`[edu-platform] timeout loading ${url}, falling back`);
      resolve(null);
    }, 15000);
    loader.load(
      url,
      (gltf) => { if (!done) { done = true; clearTimeout(t); resolve(gltf.scene); } },
      undefined,
      (err) => {
        if (done) return;
        done = true; clearTimeout(t);
        console.warn(`[edu-platform] failed loading ${url}:`, err?.message || err);
        resolve(null);
      }
    );
  });
}

let markerMap = new Map();

async function loadAnatomy() {
  // For Phase 2/3 we always use the placeholder layer set + markers for all structures.
  // When real Z-Anatomy GLB exists, this is where we'd extract per-layer meshes by node name
  // and route them to the right layerManager bucket; cortical lobes would then become
  // selectable as real meshes (still keeping markers for deep nuclei).
  const real = await tryLoadRealModel(REAL_MODEL_URL);
  if (real) {
    // 真實 Z-Anatomy 模型：以解剖座標出現，先 scale 再以 scaled bbox center 來抵消位移
    const box = new THREE.Box3().setFromObject(real);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    let scaleFactor = 1;
    if (size > 0) {
      const targetSize = 1.4;
      scaleFactor = targetSize / size;
      real.scale.setScalar(scaleFactor);
      real.position.copy(center.clone().multiplyScalar(-scaleFactor));
    }
    colorizeBrain(real, SYSTEM_COLORS);
    tagBrainMeshes(real);
    real.userData.isBrainMesh = true;  // 給 NervePulse 跳過用
    layerManager.registerMesh('nerve', real);
    console.info('[edu-platform] loaded real anatomy:',
      '#meshes=', countMeshes(real),
      'origSize=', size.toFixed(3));

    // ── 對齊載入其他 Z-Anatomy 圖層（同 scale + center）
    // 骨骼：優先載全身 skeleton.glb（含顱骨）；不存在時 fallback 用 skull.glb
    const skeletonLoaded = await loadAlignedLayer(REAL_SKELETON_URL, 'bone',
      { scaleFactor, center, color: 0xece1c6, opacity: 0.92 });
    if (!skeletonLoaded) {
      await loadAlignedLayer(REAL_SKULL_URL, 'bone',
        { scaleFactor, center, color: 0xece1c6, opacity: 0.92 });
    }
    await loadAlignedLayer(REAL_VESSELS_URL, 'vessel', { scaleFactor, center, color: 0xff5a4a, opacity: 1 });
    await loadAlignedLayer(REAL_SPINAL_URL,  'nerve',  { scaleFactor, center, color: 0xf3e08a, opacity: 1 });
    // 周邊神經網絡（脊神經，含交感+體感）— 在 nerve layer
    await loadAlignedLayer(REAL_NERVES_URL,  'nerve',  { scaleFactor, center, color: 0xf8d758, opacity: 0.95 });
    // 交感神經幹（autonomic chain，沿脊髓兩側）— 獨立 sympathetic layer，預設隱藏
    await loadAlignedLayer(REAL_SYMP_URL,    'sympathetic', { scaleFactor, center, color: 0xa6e7ff, opacity: 1 });
    // 12 對腦神經（含視神經、迷走神經…）— 在 nerve layer
    const cnGroup = await loadAlignedLayer(REAL_CN_URL,  'nerve', { scaleFactor, center, color: 0xa0e8a0, opacity: 1 });
    // 對腦神經 mesh 做 structureId tag（依名稱關鍵字），讓點選能跳對應資訊面板
    if (cnGroup) tagBrainMeshes(cnGroup);
    await loadAlignedLayer(REAL_MUSCLES_URL, 'muscle', { scaleFactor, center, color: 0xc14a40, opacity: 0.95 });
    await loadAlignedLayer(REAL_SKIN_URL,    'skin',   { scaleFactor, center, color: 0xe8b59a, opacity: 1 });
    // 把程序化皮膚紋路套到所有 skin material（雜訊 + 色斑 + 毛孔）
    const skinTex = createSkinTexture();
    layerManager.getGroup('skin').traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.map = skinTex;
        m.roughness = 0.85;
        m.needsUpdate = true;
      }
    });

    // ── bbox 分兩種：純 brain（給眼球用）vs 含 skull 的（給 skin/muscle 殼用）
    real.updateMatrixWorld(true);
    const brainOnlyBox = new THREE.Box3().setFromObject(real);
    const headBox = brainOnlyBox.clone();
    const boneGroup = layerManager.getGroup('bone');
    if (boneGroup.children.length) {
      boneGroup.updateMatrixWorld(true);
      headBox.union(new THREE.Box3().setFromObject(boneGroup));
    }
    window.__brainBbox = brainOnlyBox;  // 純腦，眼球位置依據
    window.__headBbox  = headBox;       // 腦 + 顱骨，skin/muscle 殼依據

    // skin / muscle：真實 GLB 載入成功就用，否則回退到 procedural shell（防雙層）
    if (layerManager.getGroup('skin').children.length === 0) {
      layerManager.registerMesh('skin', createSkinShellAroundBbox(headBox, { buffer: 1.10 }));
    }
    if (layerManager.getGroup('muscle').children.length === 0) {
      layerManager.registerMesh('muscle', createMuscleShellAroundBbox(headBox, { buffer: 1.04 }));
    }
  } else {
    layerManager.registerMesh('skin',   createSkinShell());
    layerManager.registerMesh('muscle', createMuscleShell());
    layerManager.registerMesh('bone',   createBoneShell());
    layerManager.registerMesh('vessel', createVesselTubes());
    layerManager.registerMesh('nerve',  createPlaceholderBrain());
  }
  // skin / muscle 在 real 分支內已用對齊版本（createSkinShellAroundBbox）註冊

  // Structure markers (deep nuclei + cortical lobes in placeholder mode).
  // Markers belong to the 'nerve' layer so they hide when nerve is hidden,
  // but LayerManager skips opacity changes for markers (they stay legible during fade).
  const { group: markersGroup, markerMap: mm } = createMarkers(structuresList);
  for (const [k, v] of mm) markerMap.set(k, v);  // mutate, do NOT reassign
  layerManager.registerMesh('nerve', markersGroup);

  // ── 真實 heart 模型：取代心臟 sphere marker ──
  // 位置與原 marker 一致（-0.10, -0.85, 0.10），就在腦下方。
  // 加進 vessel layer → LayerManager 高亮邏輯能對它套 emissive 黃光。
  if (real) {
    const heartTargetSize = 0.55;
    // 胸腔位置：在腦下方更遠處（解剖上心臟在頸下、胸骨後方）
    const heartPos = new THREE.Vector3(-0.12, -1.50, 0.05);
    const heartWrapper = await loadOrganMesh(REAL_HEART_URL, 'heart', {
      targetSize: heartTargetSize,
      position: heartPos,
      color: 0xc4243a,
      opacity: 1,
    });
    if (heartWrapper) {
      // 放進 nerve layer（預設 visible）
      layerManager.registerMesh('nerve', heartWrapper);
      // 心臟改為常駐顯示：拿掉 kind='organ' 讓 PathwayPlayer.stop 不會自動隱藏；
      // 並把 visible 設 true（loadOrganMesh 預設 false 給單純 pathway-only 器官用）
      heartWrapper.visible = true;
      delete heartWrapper.userData.kind;
      // 把原本的 sphere marker 從 markers group 移走、改 markerMap 指向 wrapper。
      const sphereMarker = markerMap.get('heart');
      if (sphereMarker) sphereMarker.parent?.remove(sphereMarker);
      markerMap.set('heart', heartWrapper);
      console.info('[edu-platform] real heart attached, replacing sphere marker');

      // ── 主要血管：心-腦連接管 ──
      const vesselsGroup = createHeartVessels({
        heartPosition: heartPos,
        brainBox: window.__brainBbox ?? new THREE.Box3().setFromObject(real),
      });
      layerManager.registerMesh('nerve', vesselsGroup);
      console.info('[edu-platform] heart-brain vessels created:', vesselsGroup.children.length);
    }
  }

  // Pathway player（先建好；UI 之後在 toolsPanel 內 render）
  pathwayPlayer = new PathwayPlayer({
    scene, layerManager, markerMap,
    getSelectedId: () => selection.selectedId,
  });

  // Clipping
  const clipBbox = computeAnatomyBbox(modelRoot);
  clipping = new ClippingController({
    renderer, scene,
    getBoundingBox: () => clipBbox,
  });
  clipping.applyToMaterials();

  // 方向參考眼球：優先用 skin 的眶區算左右眼世界座標
  if (real) {
    const skinGroup = layerManager.getGroup('skin');
    const orbital = skinGroup.children.length ? findOrbitalCenters(skinGroup) : null;
    if (orbital) {
      orbital.left.z  -= 0.04;  // 往內塞進眼眶 (~1 cm)
      orbital.right.z -= 0.04;
      const eyeRadius = Math.max(0.025, orbital.left.distanceTo(orbital.right) * 0.14);
      scene.add(createOrientationEyes({
        leftPos: orbital.left, rightPos: orbital.right, radius: eyeRadius,
      }));
      console.info('[edu-platform] eyes aligned to orbital region',
        'L=', orbital.left.toArray().map(v => +v.toFixed(3)),
        'R=', orbital.right.toArray().map(v => +v.toFixed(3)));
    } else if (window.__brainBbox) {
      scene.add(createOrientationEyes(window.__brainBbox));
    }
  }

  // Explode
  const brainCenter = clipBbox.getCenter(new THREE.Vector3());
  explodeCtrl = new ExplodeController({ root: modelRoot, brainCenter });
  explodeCtrl.build();

  // ── 整合面板：分層 / 通路 / 剖面 三個 tab ──
  buildToolsPanel(toolsPanelEl, {
    layerManager,
    pathwayPlayer,
    pathwayDescContainer: pathwayDescPanelEl,
    clipping,
  });
  makeDraggable(toolsPanelEl);
  makeDraggable(pathwayDescPanelEl);

  // Explode 仍獨立浮動（slider drag 不適合 tab 切換）
  buildExplodePanel(explodePanelEl, explodeCtrl);
  makeDraggable(explodePanelEl);

  // ── 器官導航：相機平滑移動到指定器官 ──
  organNav = new OrganNavigator({
    camera, controls,
    defaultPos: defaultCameraPos,
    defaultTarget: defaultTarget,
  });
  const organs = [
    {
      id: 'brain',
      label: '大腦',
      getTarget: () => {
        const bbox = window.__brainBbox;
        if (!bbox) return null;
        return {
          center: bbox.getCenter(new THREE.Vector3()),
          distance: bbox.getSize(new THREE.Vector3()).length() * 1.3,
        };
      },
    },
    {
      id: 'heart',
      label: '心臟',
      getTarget: () => {
        const h = markerMap.get('heart');
        if (!h) return null;
        // 心臟下移到胸腔，相機要拉遠一點才框得到
        return { center: h.position.clone(), distance: 1.7 };
      },
    },
    {
      id: 'spinal-cord',
      label: '脊髓',
      getTarget: () => {
        // 優先用真實 spinal.glb 的 bbox（在 nerve layer 內）
        const nerveGroup = layerManager.getGroup('nerve');
        const spinalBox = new THREE.Box3();
        const tmpBox = new THREE.Box3();
        nerveGroup.traverse(o => {
          if (!o.isMesh || !o.name) return;
          const n = o.name.toLowerCase();
          // 'spinal cord' 或 'cord_of_spinal' 等，排除 spinal nerve / 周邊神經
          if ((n.includes('spinal_cord') || n.includes('cord_of_spinal'))
              && !n.includes('nerve')) {
            tmpBox.setFromObject(o);
            spinalBox.union(tmpBox);
          }
        });
        if (!spinalBox.isEmpty()) {
          return {
            center: spinalBox.getCenter(new THREE.Vector3()),
            distance: spinalBox.getSize(new THREE.Vector3()).length() * 1.6,
          };
        }
        // Fallback：marker 位置
        const m = markerMap.get('spinal-cord');
        if (!m) return null;
        return { center: m.position.clone(), distance: 1.2 };
      },
    },
  ];
  buildOrganNavBar(organNavEl, organNav, organs);
  makeDraggable(organNavEl);

  // 神經脈衝動畫：只註冊交感神經（其他圖層平常不閃爍，只有選取/通路時才高亮）。
  // 預設 enabled = false，等使用者按頂端「啟動交感神經」按鈕。
  if (real) {
    nervePulse.registerGroup(layerManager.getGroup('sympathetic'), { phaseAxis: 'y', posScale: 8 });
    console.info('[edu-platform] nerve pulse targets (sympathetic only):', nervePulse.targets.length);
  }

  // 「啟動交感神經」按鈕（topbar 內）：toggle 脈衝動畫，並自動把 sympathetic 層切顯示
  const sympBtn = document.getElementById('symp-pulse-toggle');
  if (sympBtn) {
    const refresh = () => {
      sympBtn.classList.toggle('active', nervePulse.enabled);
      sympBtn.textContent = nervePulse.enabled ? '⚡ 停止脈衝' : '⚡ 啟動交感神經';
    };
    sympBtn.addEventListener('click', () => {
      const next = !nervePulse.enabled;
      nervePulse.setEnabled(next);
      // 啟動時若交感神經層被隱藏，順便切顯示，否則看不到動畫
      if (next && layerManager.get('sympathetic').state === 'hidden') {
        layerManager.setState('sympathetic', 'visible');
      }
      refresh();
    });
    nervePulse.onChange(refresh);
    refresh();
  }

  window.__edu = { scene, modelRoot, layerManager, markerMap, markersGroup, structuresList, pathwayPlayer, clipping, explodeCtrl, organNav, nervePulse, quiz, camera, controls };
  console.info('[edu-platform] markers created:', markerMap.size);

  fitCameraToObject(modelRoot);
  hideLoading();
}

// 載入「器官」型 mesh（不依腦 align，自己決定目標 size + 放置位置）。
// 回傳一個 wrapper Group：wrapper.position = position（給通路曲線用），
// 內部 mesh 已置中且 scale 到 targetSize，並 tag structureId 供高亮使用。
async function loadOrganMesh(url, structureId, { targetSize, position, color, opacity = 1 }) {
  const obj = await tryLoadRealModel(url);
  if (!obj) return null;

  // Auto scale to targetSize
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const sizeLen = box.getSize(new THREE.Vector3()).length();
  if (sizeLen > 0) obj.scale.setScalar(targetSize / sizeLen);

  // Re-compute bbox after scale → center inside wrapper
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.sub(c);

  // Material 統一染色 + side DoubleSide（剖面切開不空心）
  obj.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const cloneOne = (m) => {
      const c = m.clone();
      if (color !== undefined) c.color.setHex(color);
      if (c.map)         c.map = null;
      if (c.emissiveMap) c.emissiveMap = null;
      if (c.emissive)    c.emissive.setHex(0x000000);
      c.side = 2;
      c.transparent = opacity < 1;
      c.opacity = opacity;
      c.needsUpdate = true;
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(cloneOne) : cloneOne(o.material);
    o.userData.structureId = structureId;
    o.userData.structureIds = new Set([structureId]);
  });

  // Wrapper 放在指定位置（通路曲線會用 wrapper.position）
  const wrapper = new THREE.Group();
  wrapper.name = `organ:${structureId}`;
  wrapper.position.copy(position);
  wrapper.add(obj);
  wrapper.userData.structureId = structureId;
  wrapper.userData.structureIds = new Set([structureId]);
  wrapper.userData.kind = 'organ';
  wrapper.userData.isMarker = false;   // 明確標記：不是 sphere marker，updateMarkerVisuals 應跳過
  wrapper.userData.isOrgan = true;
  wrapper.visible = false;             // 預設隱藏，通路播放時 PathwayPlayer 會切顯
  return wrapper;
}

async function loadAlignedLayer(url, layerId, { scaleFactor, center, color, opacity = 1 }) {
  const obj = await tryLoadRealModel(url);
  if (!obj) return null;
  obj.scale.setScalar(scaleFactor);
  obj.position.copy(center.clone().multiplyScalar(-scaleFactor));
  // 統一染色（取代 GLB 內可能殘存的 baseColor texture），方便對應 layer 識別
  obj.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const cloneOne = (m) => {
      const c = m.clone();
      if (color !== undefined) c.color.setHex(color);
      if (c.map) c.map = null;
      if (c.emissiveMap) c.emissiveMap = null;
      if (c.emissive) c.emissive.setHex(0x000000);
      c.side = 2;                  // DoubleSide：剖面切開不空心
      c.transparent = opacity < 1;
      c.opacity = opacity;
      c.needsUpdate = true;
      return c;
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(cloneOne)
      : cloneOne(o.material);
  });
  layerManager.registerMesh(layerId, obj);
  console.info(`[edu-platform] loaded ${layerId} layer:`, url, '#meshes=', countMeshes(obj));
  return obj;
}

function countMeshes(root) {
  let n = 0;
  root.traverse(o => { if (o.isMesh) n++; });
  return n;
}

function computeAnatomyBbox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  root.traverseVisible(o => {
    if (!o.isMesh) return;
    if (o.userData.isMarker || o.userData.isOverlay) return;
    meshBox.setFromObject(o);
    box.union(meshBox);
  });
  return box;
}

function fitCameraToObject(object) {
  object.updateMatrixWorld(true);

  // 框景到全身可見 mesh（從頭到腳全部看得到）
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  object.traverseVisible(o => {
    if (o.isMesh && !o.userData.isMarker) {
      meshBox.setFromObject(o);
      box.union(meshBox);
    }
  });
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());

  controls.target.copy(center);
  defaultTarget.copy(center);

  // 從頭到腳框景；視線稍微水平（dir.y 偏小）+ 距離加大，避免被裁切到
  const dist = size * 1.9;
  const dir = new THREE.Vector3(0, 0.05, 1).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
  defaultCameraPos.copy(camera.position);

  camera.near = Math.max(0.01, size / 200);
  camera.far  = size * 50;
  camera.updateProjectionMatrix();
  controls.update();
}

function hideLoading() {
  loadingEl.classList.add('hidden');
  setTimeout(() => { loadingEl.style.display = 'none'; }, 500);
}

// ── Selection + Info panel + Tooltip ─────────────────────────────────────
const infoPanel = buildInfoPanel(infoPanelEl, {
  onClose: () => selection.select(null),
});
const tooltip = buildTooltip(tooltipEl);

// Quiz controller 共用 infoPanelEl 容器
const quiz = new QuizController(infoPanelEl);
buildQuizToggle(document.getElementById('quiz-toggle-slot'), quiz);

const selection = new SelectionController({
  canvas, camera, scene,
  onSelectChange: (id) => {
    layerManager.setSelection(id);
    updateMarkerVisuals(markerMap, {
      selectedId: id,
      hoveredId: selection.hoveredId,
      highlightSet: layerManager.highlightSet,
    });
    if (quiz.enabled && id) {
      quiz.startQuestion(id);
    } else if (!quiz.enabled) {
      infoPanel.render(id);
    }
  },
  onHoverChange: (id, event) => {
    updateMarkerVisuals(markerMap, {
      selectedId: selection.selectedId,
      hoveredId: id,
      highlightSet: layerManager.highlightSet,
    });
    if (id && event) tooltip.show(id, event);
    else tooltip.hide();
  },
});

// ── Pathway player / Clipping / Explode 在 loadAnatomy 內初始化 ─────────
let pathwayPlayer = null;
let clipping = null;
let explodeCtrl = null;
let organNav = null;
const nervePulse = new NervePulseController();

// ESC: 取消選取；若已沒選取則停止通路
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (selection.selectedId) selection.select(null);
  else if (pathwayPlayer?.active) pathwayPlayer.stop();
});

// ── Resize ───────────────────────────────────────────────────────────────
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

// ── Keyboard: R 重設視角 ─────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    camera.position.copy(defaultCameraPos);
    controls.target.copy(defaultTarget);
    controls.update();
  }
});

// ── Render loop ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  if (organNav) organNav.update(dt);
  if (pathwayPlayer) pathwayPlayer.update(dt);
  nervePulse.update(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

loadAnatomy().catch((err) => {
  // Should not normally fire now — tryLoadRealModel swallows load errors and returns null.
  // Kept as a hard safety net for unforeseen errors in the placeholder path.
  console.error('[edu-platform] loadAnatomy crashed:', err);
  loadingEl.textContent = '場景初始化失敗，請重新整理。請開 DevTools console 看詳細錯誤。';
});

animate();
