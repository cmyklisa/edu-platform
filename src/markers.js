// 解剖結構的示意標記（小發光球）。
// 第③階段所有結構都用 marker（佔位模式）。
// 階段⑥（資產管線）真實 mesh 進來後，淺層結構（皮質葉）改用 mesh 選取，深部核仍保留 marker。

import * as THREE from 'three';
import { SYSTEM_COLORS } from './structures.js';

// limbic + brainstem 預設為「深部」(座標在腦內部)，除非結構自行覆寫 deepMarker。
// 視覺上 deep / 非 deep 都採 depthTest:false，永遠浮在最上層，避免被腦表或殼擋住。
// 兩者的差別只在不透明度與大小：deep 略小略透，提示「這是腦內示意位置」。
const DEEP_SYSTEMS = new Set(['limbic', 'brainstem']);

const BASE_RADIUS = 0.022;       // 顯示尺寸（小巧）
const HIT_PROXY_MULT = 2.5;      // 隱形碰撞球倍率（觸控容易點到）
const SELECT_SCALE = 2.4;        // 點選後放大倍率
const SELECT_COLOR = 0xffeb87;   // 點選後變金黃
const HOVER_SCALE  = 1.6;

export function createMarkers(structures) {
  const group = new THREE.Group();
  group.name = 'structure_markers';
  const markerMap = new Map();

  for (const s of structures) {
    if (!s.markerPosition) continue;

    const isDeep = (s.deepMarker !== undefined)
      ? s.deepMarker
      : DEEP_SYSTEMS.has(s.system);

    const color = SYSTEM_COLORS[s.system] ?? 0xffffff;

    const radius = isDeep ? BASE_RADIUS * 0.80 : BASE_RADIUS;
    const geo = new THREE.SphereGeometry(radius, 20, 14);
    // 用 MeshBasicMaterial（不依賴光照）+ depthTest:false 確保任何條件下都看得到。
    // 預設 opacity = 0（看不見，但 raycaster 仍能 hit 用於 hover/click 選取）。
    // updateMarkerVisuals 會在 hover / selected / highlight set / 通路 active 時把
    // 對應 marker 改成可見。
    const baseOpacity = isDeep ? 0.85 : 1.0;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,    // 不被 ACES tone mapping 壓暗
    });
    mat.userData._baseOpacity = baseOpacity;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.fromArray(s.markerPosition);
    mesh.userData.structureId = s.id;
    mesh.userData.structureIds = new Set([s.id]);
    mesh.userData.isMarker = true;
    mesh.userData.isDeep = isDeep;
    mesh.userData.kind = s.kind ?? 'structure';
    mesh.renderOrder = 999;
    mesh.name = `marker:${s.id}`;

    // ── 隱形 hit proxy：放大的 sphere 提供寬鬆觸控區（material.visible=false 不渲染，
    //    但 raycaster 仍會 hit）。掛在 mesh 上，跟著選取縮放走。
    const hitGeo = new THREE.SphereGeometry(radius * HIT_PROXY_MULT, 8, 6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.userData.structureId = s.id;
    hitMesh.userData.structureIds = new Set([s.id]);
    hitMesh.userData.isMarker = true;
    hitMesh.userData.isPickProxy = true;
    hitMesh.name = `pick:${s.id}`;
    mesh.add(hitMesh);

    // kind === 'external' / 'organ' 預設隱藏；只在通路播放時顯示。
    if (s.kind === 'external' || s.kind === 'organ') {
      mesh.visible = false;
    }

    group.add(mesh);
    markerMap.set(s.id, mesh);
  }

  return { group, markerMap };
}

export function updateMarkerVisuals(markerMap, { selectedId, hoveredId, highlightSet }) {
  const hl = highlightSet ?? null;
  for (const [id, mesh] of markerMap) {
    // 真實 mesh wrapper（isMarker === false）：scale/color 不適用，跳過
    if (mesh.userData.isMarker === false) continue;
    // Skip chain markers when a pathway is active — PathwayPlayer.update owns their scale (pulse).
    if (hl && hl.has(id) && id !== selectedId) continue;
    const mat = mesh.material;
    if (!mat) continue;
    if (mat.userData._origColor === undefined) {
      mat.userData._origColor = mat.color.getHex();
    }
    const baseOpacity = mat.userData._baseOpacity ?? 1.0;
    const inHighlight = hl && hl.has(id);
    let scale = 1;
    let opacity = 0;
    if (id === selectedId) {
      scale = SELECT_SCALE;
      opacity = baseOpacity;
      mat.color.setHex(SELECT_COLOR);
    } else {
      mat.color.setHex(mat.userData._origColor);
      if (id === hoveredId) { scale = HOVER_SCALE; opacity = baseOpacity; }
      else if (inHighlight)  { scale = 1.3;            opacity = baseOpacity; }
    }
    mat.opacity = opacity;
    mesh.scale.setScalar(scale);
  }
}
