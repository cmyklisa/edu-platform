// 效能優化：把不可點擊的圖層 mesh 依 material 合併成單一 BufferGeometry，
// 大幅減少 draw call。會破壞 per-mesh 點選，所以**只能對無 structureId 的圖層使用**
// （skin / muscle / bone / vessel）。
//
// 也提供確保 frustum culling 正常工作的 helper（computeBoundingSphere）。

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// glTF 載入後常見的 attribute 集合差異會讓 mergeGeometries 失敗。把所有 geometry
// 對齊到「只有 position / normal / uv」三組 attribute，缺的補預設值。
function normalizeAttributes(g, refKeys) {
  for (const key of refKeys) {
    if (g.getAttribute(key)) continue;
    const count = g.attributes.position?.count ?? 0;
    if (count === 0) return false;
    if (key === 'normal') {
      g.computeVertexNormals();
    } else if (key === 'uv') {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
  }
  // 移除合併不需要、且常造成 vertex 數不一致的 attribute（如 tangent、color）。
  for (const k of Object.keys(g.attributes)) {
    if (!refKeys.includes(k)) g.deleteAttribute(k);
  }
  return true;
}

/** 視覺等值的 material 用同一個 key 分組（color + opacity + side + texture）。 */
function materialBucketKey(m) {
  const c = m.color?.getHex?.() ?? 0;
  const op = (m.opacity ?? 1).toFixed(3);
  const tr = m.transparent ? 1 : 0;
  const sd = m.side ?? 0;
  const tex = m.map ? `tex:${m.map.uuid}` : 'no-tex';
  const dw = m.depthWrite ? 1 : 0;
  return `${c}|${op}|${tr}|${sd}|${tex}|${dw}`;
}

/** 把視覺等值的 mesh 合併為單一 mesh，並改成共用同一個 material 實例。
 *  回傳合併後新 mesh 的數量。 */
export function mergeStaticLayer(layerGroup, { name = 'merged' } = {}) {
  if (!layerGroup || !layerGroup.isObject3D) return 0;

  // Collect: per visual-material → list of meshes
  const buckets = new Map();
  layerGroup.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.material) return;
    if (o.userData.isMarker || o.userData.isOverlay) return;
    if (o.userData.structureId) return; // 保留可點 mesh
    if (Array.isArray(o.material)) return; // 多 material mesh 不合併（太複雜，量少）
    const key = materialBucketKey(o.material);
    if (!buckets.has(key)) buckets.set(key, { material: o.material, items: [] });
    buckets.get(key).items.push(o);
  });

  if (buckets.size === 0) return 0;

  const refKeys = ['position', 'normal', 'uv'];

  // 收集所有要被移除的舊 mesh
  const toRemove = new Set();
  // 收集要新增的 merged mesh
  const merged = [];

  for (const { material, items } of buckets.values()) {
    if (items.length <= 1) continue; // 單一 mesh 沒得合併
    const geos = [];
    for (const mesh of items) {
      mesh.updateMatrixWorld(true);
      let g = mesh.geometry.clone();
      if (!normalizeAttributes(g, refKeys)) {
        g.dispose();
        continue;
      }
      // index 對齊（mergeGeometries 要求所有 geometry 都有 index 或都沒有）
      if (g.index) g = g.toNonIndexed();
      // Apply world transform → local space of new merged mesh (放在 layerGroup 下)
      g.applyMatrix4(mesh.matrixWorld);
      geos.push(g);
      toRemove.add(mesh);
    }
    if (geos.length === 0) continue;
    const mergedGeo = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!mergedGeo) continue;
    mergedGeo.computeBoundingSphere();
    mergedGeo.computeBoundingBox();
    // 反向 transform 到 layerGroup local（layerGroup 通常 identity，但保險起見）
    layerGroup.updateMatrixWorld(true);
    if (!layerGroup.matrixWorld.elements.every((v, i) => v === (i % 5 === 0 ? 1 : 0))) {
      mergedGeo.applyMatrix4(new THREE.Matrix4().copy(layerGroup.matrixWorld).invert());
    }
    const m = new THREE.Mesh(mergedGeo, material);
    m.name = `merged:${name}:${material.uuid.slice(0, 8)}`;
    m.frustumCulled = true;
    merged.push(m);
  }

  // 把舊 mesh 從 parent 移除（不能在 traverse 中改）
  for (const mesh of toRemove) {
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose();
  }
  for (const m of merged) layerGroup.add(m);
  return merged.length;
}

/** 確保所有 mesh 都有 bounding sphere 與 frustumCulled = true。 */
export function ensureFrustumCulling(root) {
  let n = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    o.frustumCulled = true;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    n++;
  });
  return n;
}

/** 對「靜態圖層」鎖住 matrix 自動更新，省每幀 CPU。 */
export function freezeStaticLayer(layerGroup) {
  layerGroup.traverse(o => {
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
}
