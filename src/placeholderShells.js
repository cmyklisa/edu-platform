// 佔位 schematic shells（皮膚 / 肌肉 / 骨骼 / 血管）。
// 第②階段為了把分層機制做起來，先用同心橢球殼 + 程序化血管，明顯是 schematic，不是真實解剖。
// 真實 Z-Anatomy / BodyParts3D 匯入後將取代這些。

import * as THREE from 'three';
import { fbm } from './placeholderBrain.js';

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeShell({ radii, color, segments = 32, surfaceNoise = 0.04, label }) {
  const geo = new THREE.IcosahedronGeometry(1, segments);
  const pos = geo.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    tmp.x *= radii.x;
    tmp.y *= radii.y;
    tmp.z *= radii.z;
    if (surfaceNoise > 0) {
      const n = fbm(tmp.x * 6, tmp.y * 6, tmp.z * 6);
      tmp.multiplyScalar(1 + (n - 0.5) * surfaceNoise);
    }
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.78, metalness: 0.02, side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = label;
  return mesh;
}

export function createSkinShell() {
  return makeShell({
    radii: { x: 0.95, y: 1.15, z: 0.98 },
    color: 0xf3c6a8, segments: 32, surfaceNoise: 0.02,
    label: 'placeholder_skin',
  });
}

export function createMuscleShell() {
  return makeShell({
    radii: { x: 0.88, y: 1.06, z: 0.91 },
    color: 0xb94a3e, segments: 24, surfaceNoise: 0.05,
    label: 'placeholder_muscle',
  });
}

// 給真實腦用：依 brain bbox 動態決定殼的大小（避免 hard-coded 半徑跟真實比例不符）
export function createSkinShellAroundBbox(bbox, { buffer = 1.18 } = {}) {
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const shell = makeShell({
    radii: { x: size.x * 0.5 * buffer,
             y: size.y * 0.5 * buffer,
             z: size.z * 0.5 * buffer },
    color: 0xf3c6a8, segments: 32, surfaceNoise: 0.02,
    label: 'skin_aligned',
  });
  shell.position.copy(center);
  return shell;
}

export function createMuscleShellAroundBbox(bbox, { buffer = 1.08 } = {}) {
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const shell = makeShell({
    radii: { x: size.x * 0.5 * buffer,
             y: size.y * 0.5 * buffer,
             z: size.z * 0.5 * buffer },
    color: 0xb94a3e, segments: 24, surfaceNoise: 0.05,
    label: 'muscle_aligned',
  });
  shell.position.copy(center);
  return shell;
}

export function createBoneShell() {
  return makeShell({
    radii: { x: 0.82, y: 1.00, z: 0.85 },
    color: 0xece1c6, segments: 24, surfaceNoise: 0.03,
    label: 'placeholder_skull',
  });
}

export function createVesselTubes() {
  const group = new THREE.Group();
  group.name = 'placeholder_vessels';
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd23a3a, roughness: 0.45, metalness: 0.1,
  });
  const rnd = mulberry32(42); // deterministic
  const seeds = [
    [-0.72, 0.55, 0.45], [0.72, 0.50, 0.50],
    [0, 0.90, -0.15], [-0.55, -0.20, -0.55],
    [0.50, -0.25, 0.55], [0.10, 0.85, 0.40],
  ];
  for (const seed of seeds) {
    const pts = [];
    let p = new THREE.Vector3(seed[0], seed[1], seed[2]);
    pts.push(p.clone());
    for (let i = 0; i < 9; i++) {
      const next = new THREE.Vector3(
        p.x + (rnd() - 0.5) * 0.28 - p.x * 0.08,
        p.y + (rnd() - 0.5) * 0.28 - p.y * 0.08,
        p.z + (rnd() - 0.5) * 0.28 - p.z * 0.08,
      );
      pts.push(next);
      p = next;
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 60, 0.012, 6, false);
    group.add(new THREE.Mesh(tubeGeo, mat));
  }
  return group;
}
