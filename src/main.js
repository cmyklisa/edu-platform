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
import { createMarkers, updateMarkerVisuals } from './markers.js';
import { SelectionController } from './selection.js';
import { buildInfoPanel, buildTooltip } from './infoPanel.js';
import { PathwayPlayer } from './pathwayPlayer.js';
import { buildPathwayPanel } from './pathwayPanel.js';
import { ClippingController, buildClippingPanel } from './clipping.js';
import { makeDraggable } from './draggable.js';

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');
const layerPanelEl       = document.getElementById('layer-panel');
const infoPanelEl        = document.getElementById('info-panel');
const tooltipEl          = document.getElementById('tooltip');
const pathwayPanelEl     = document.getElementById('pathway-panel');
const pathwayDescPanelEl = document.getElementById('pathway-desc-panel');
const clipPanelEl        = document.getElementById('clip-panel');

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
const REAL_MODEL_URL = `${import.meta.env.BASE_URL}models/brain.glb`;

async function tryLoadRealModel(url) {
  // Vite dev server SPA-fallbacks unknown URLs to index.html (HTTP 200),
  // so HEAD-status alone is not enough — also check Content-Type.
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return null;
    const ct = (head.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/json')) return null;
  } catch { return null; }

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => { console.warn('[edu-platform] real model load failed, falling back:', err); resolve(null); }
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
    if (size > 0) {
      const targetSize = 1.4;
      const scaleFactor = targetSize / size;
      real.scale.setScalar(scaleFactor);
      // scaled bbox 中心會跑到 scale × center 的世界座標，因此把 root 位置設為 -scaleFactor × center
      real.position.copy(center.multiplyScalar(-scaleFactor));
    }
    // 依 mesh 名稱關鍵字分區，套上對應顏色（前/後/側葉、小腦、腦幹、邊緣系統各一色）
    colorizeBrain(real, SYSTEM_COLORS);
    layerManager.registerMesh('nerve', real);
    console.info('[edu-platform] loaded real anatomy:',
      '#meshes=', countMeshes(real),
      'origSize=', size.toFixed(3));
  } else {
    layerManager.registerMesh('skin',   createSkinShell());
    layerManager.registerMesh('muscle', createMuscleShell());
    layerManager.registerMesh('bone',   createBoneShell());
    layerManager.registerMesh('vessel', createVesselTubes());
    layerManager.registerMesh('nerve',  createPlaceholderBrain());
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

  window.__edu = { scene, modelRoot, layerManager, markerMap, markersGroup, structuresList, pathwayPlayer, clipping, camera, controls };
  console.info('[edu-platform] markers created:', markerMap.size);

  fitCameraToObject(modelRoot);
  hideLoading();
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
