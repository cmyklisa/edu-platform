import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createPlaceholderBrain } from './placeholderBrain.js';
import {
  createSkinShell, createMuscleShell, createBoneShell, createVesselTubes,
} from './placeholderShells.js';
import { LayerManager, buildLayerPanel } from './layers.js';
import { structuresList, SYSTEM_COLORS } from './structures.js';
import { colorizeBrain } from './colorize.js';
import { tagBrainMeshes } from './structureMeshMap.js';
import { createMarkers, updateMarkerVisuals } from './markers.js';
import { SelectionController } from './selection.js';
import { buildInfoPanel, buildTooltip } from './infoPanel.js';
import { PathwayPlayer } from './pathwayPlayer.js';
import { buildPathwayPanel } from './pathwayPanel.js';
import { ClippingController, buildClippingPanel } from './clipping.js';
import { createOrientationEyes } from './orientationCue.js';
import { ExplodeController, buildExplodePanel } from './explode.js';
import { makeDraggable } from './draggable.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');
const layerPanelEl       = document.getElementById('layer-panel');
const infoPanelEl        = document.getElementById('info-panel');
const tooltipEl          = document.getElementById('tooltip');
const pathwayPanelEl     = document.getElementById('pathway-panel');
const pathwayDescPanelEl = document.getElementById('pathway-desc-panel');
const clipPanelEl        = document.getElementById('clip-panel');
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
const REAL_SKULL_URL    = `${BASE}models/skull.glb`;
const REAL_VESSELS_URL  = `${BASE}models/vessels.glb`;

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
    layerManager.registerMesh('nerve', real);
    console.info('[edu-platform] loaded real anatomy:',
      '#meshes=', countMeshes(real),
      'origSize=', size.toFixed(3));

    // ── 對齊載入其它 Z-Anatomy 圖層（用同一 scale 與 center，這樣它們在原始
    //    解剖空間裡的位置關係會被保留）
    await loadAlignedLayer(REAL_SKULL_URL,   'bone',   { scaleFactor, center, color: 0xece1c6, opacity: 0.92 });
    await loadAlignedLayer(REAL_VESSELS_URL, 'vessel', { scaleFactor, center, color: 0xd23a3a, opacity: 1 });
  } else {
    layerManager.registerMesh('skin',   createSkinShell());
    layerManager.registerMesh('muscle', createMuscleShell());
    layerManager.registerMesh('bone',   createBoneShell());
    layerManager.registerMesh('vessel', createVesselTubes());
    layerManager.registerMesh('nerve',  createPlaceholderBrain());
  }
  // 即使有真實腦：Z-Anatomy 沒有 skin 模型，保留 procedural 皮膚殼當示意
  if (real) {
    layerManager.registerMesh('skin', createSkinShell());
  }

  // Structure markers (deep nuclei + cortical lobes in placeholder mode).
  // Markers belong to the 'nerve' layer so they hide when nerve is hidden,
  // but LayerManager skips opacity changes for markers (they stay legible during fade).
  const { group: markersGroup, markerMap: mm } = createMarkers(structuresList);
  for (const [k, v] of mm) markerMap.set(k, v);  // mutate, do NOT reassign
  layerManager.registerMesh('nerve', markersGroup);

  buildPathwayStack();

  // Compute clipping bbox once (excludes markers / overlay).
  const clipBbox = computeAnatomyBbox(modelRoot);
  clipping = new ClippingController({
    renderer, scene,
    getBoundingBox: () => clipBbox,
  });
  clipping.applyToMaterials();
  buildClippingPanel(clipPanelEl, clipping);
  makeDraggable(clipPanelEl);

  // 方向參考眼球（依腦 bbox 估算位置；標 isOverlay 不被剖面/淡化影響）
  if (real) {
    const eyes = createOrientationEyes(clipBbox);
    scene.add(eyes);
  }

  // 爆炸視圖
  const brainCenter = clipBbox.getCenter(new THREE.Vector3());
  explodeCtrl = new ExplodeController({ root: modelRoot, brainCenter });
  explodeCtrl.build();
  buildExplodePanel(explodePanelEl, explodeCtrl);
  makeDraggable(explodePanelEl);

  window.__edu = { scene, modelRoot, layerManager, markerMap, markersGroup, structuresList, pathwayPlayer, clipping, explodeCtrl, camera, controls };
  console.info('[edu-platform] markers created:', markerMap.size);

  fitCameraToObject(modelRoot);
  hideLoading();
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
  // Force-refresh all world matrices in the subtree. Necessary because we may have
  // mutated transforms (scale/position on the loaded GLB root) since the last render,
  // and Box3.setFromObject(mesh) does not propagate parent updates by itself.
  object.updateMatrixWorld(true);

  // Bbox excludes markers (they sit at extreme positions for external/organ nodes
  // like 威脅 and 心臟; we don't want them blowing up the framing). Uses traverseVisible
  // so currently-hidden meshes are ignored too.
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

  const dist = size * 1.4;
  const dir = new THREE.Vector3(0, 0.25, 1).normalize();
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

// ── UI: Layer panel ──────────────────────────────────────────────────────
buildLayerPanel(layerPanelEl, layerManager);
makeDraggable(layerPanelEl);

// ── Selection + Info panel + Tooltip ─────────────────────────────────────
const infoPanel = buildInfoPanel(infoPanelEl, {
  onClose: () => selection.select(null),
});
const tooltip = buildTooltip(tooltipEl);

const selection = new SelectionController({
  canvas, camera, scene,
  onSelectChange: (id) => {
    layerManager.setSelection(id);
    updateMarkerVisuals(markerMap, {
      selectedId: id,
      hoveredId: selection.hoveredId,
      highlightSet: layerManager.highlightSet,
    });
    infoPanel.render(id);
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

// ── Pathway player + Clipping (initialized after anatomy loads) ─────────
let pathwayPlayer = null;
let clipping = null;
let explodeCtrl = null;
function buildPathwayStack() {
  pathwayPlayer = new PathwayPlayer({
    scene,
    layerManager,
    markerMap,
    getSelectedId: () => selection.selectedId,
  });
  buildPathwayPanel(pathwayPanelEl, pathwayDescPanelEl, pathwayPlayer);
  // Drag handles after first render so headers exist.
  makeDraggable(pathwayPanelEl);
  makeDraggable(pathwayDescPanelEl);
  if (window.__edu) window.__edu.pathwayPlayer = pathwayPlayer;
}

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
  if (pathwayPlayer) pathwayPlayer.update(dt);
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
