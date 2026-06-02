// 解剖結構的示意標記（小發光球）。
// 第③階段所有結構都用 marker（佔位模式）。
// 階段⑥（資產管線）真實 mesh 進來後，淺層結構（皮質葉）改用 mesh 選取，深部核仍保留 marker。

import * as THREE from 'three';
import { SYSTEM_COLORS } from './structures.js';

// limbic + brainstem 預設為「深部」(座標在腦內部)，除非結構自行覆寫 deepMarker。
// 視覺上 deep / 非 deep 都採 depthTest:false，永遠浮在最上層，避免被腦表或殼擋住。
// 兩者的差別只在不透明度與大小：deep 略小略透，提示「這是腦內示意位置」。
const DEEP_SYSTEMS = new Set(['limbic', 'brainstem']);

const BASE_RADIUS = 0.06;

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
    // 之後可換回 MeshStandardMaterial 加細節，但先保證能看到。
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isDeep ? 0.85 : 1.0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,    // 不被 ACES tone mapping 壓暗
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.fromArray(s.markerPosition);
    mesh.userData.structureId = s.id;
    mesh.userData.isMarker = true;
    mesh.userData.isDeep = isDeep;
    mesh.userData.kind = s.kind ?? 'structure';
    mesh.renderOrder = 999;
    mesh.name = `marker:${s.id}`;

    // kind === 'external' / 'organ' 屬於通路專用節點（威脅、心臟…），
    // 預設隱藏，只在所屬通路播放時由 PathwayPlayer 切換顯示。
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
    // Skip chain markers when a pathway is active — PathwayPlayer.update owns their scale (pulse).
    if (hl && hl.has(id) && id !== selectedId) continue;
    let scale = 1;
    if (id === selectedId) scale = 1.55;
    else if (id === hoveredId) scale = 1.25;
    mesh.scale.setScalar(scale);
  }
}
