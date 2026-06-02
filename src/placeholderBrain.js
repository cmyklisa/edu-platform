// 佔位大腦（procedural placeholder）
// 用兩個 IcosahedronGeometry 半球做粗略的腦形，加上 3D noise 位移做出腦溝的視覺暗示。
// 純粹用於第①階段先把互動外殼跑起來；真實解剖幾何之後從 Z-Anatomy / BodyParts3D 匯入。

import * as THREE from 'three';

// Classic 3D value noise — small, deterministic, no dependency.
function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smoothstep(xf), v = smoothstep(yf), w = smoothstep(zf);
  const c000 = hash(xi,   yi,   zi  );
  const c100 = hash(xi+1, yi,   zi  );
  const c010 = hash(xi,   yi+1, zi  );
  const c110 = hash(xi+1, yi+1, zi  );
  const c001 = hash(xi,   yi,   zi+1);
  const c101 = hash(xi+1, yi,   zi+1);
  const c011 = hash(xi,   yi+1, zi+1);
  const c111 = hash(xi+1, yi+1, zi+1);
  const x00 = c000 * (1-u) + c100 * u;
  const x10 = c010 * (1-u) + c110 * u;
  const x01 = c001 * (1-u) + c101 * u;
  const x11 = c011 * (1-u) + c111 * u;
  const y0 = x00 * (1-v) + x10 * v;
  const y1 = x01 * (1-v) + x11 * v;
  return y0 * (1-w) + y1 * w;
}
export function fbm(x, y, z) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * noise3(x * freq, y * freq, z * freq);
    freq *= 2.05;
    amp *= 0.5;
  }
  return v;
}

function makeHemisphere(side /* 'L' | 'R' */) {
  // High subdivision → smooth gyri/sulci approximation.
  const geo = new THREE.IcosahedronGeometry(0.55, 64);
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;
  const tmp = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);

    // Squash to ellipsoid (brain-ish: longer A-P, narrower L-R, shorter S-I a touch)
    tmp.x *= 1.05;
    tmp.y *= 0.95;
    tmp.z *= 1.25;

    // Sulci/gyri displacement
    const n1 = fbm(tmp.x * 3.5, tmp.y * 3.5, tmp.z * 3.5);
    const n2 = fbm(tmp.x * 9.0 + 5, tmp.y * 9.0, tmp.z * 9.0);
    const displacement = (n1 - 0.5) * 0.06 + (n2 - 0.5) * 0.025;

    // Push along normal
    const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
    tmp.x += nx * displacement;
    tmp.y += ny * displacement;
    tmp.z += nz * displacement;

    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8b9b3,
    roughness: 0.78,
    metalness: 0.02,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = `placeholder_hemisphere_${side}`;
  return mesh;
}

function makeCerebellum() {
  const geo = new THREE.IcosahedronGeometry(0.22, 24);
  const pos = geo.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    tmp.y *= 0.7;
    tmp.x *= 1.1;
    const n = fbm(tmp.x * 12, tmp.y * 12, tmp.z * 12);
    tmp.multiplyScalar(1 + (n - 0.5) * 0.06);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd49a93,
    roughness: 0.82,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'placeholder_cerebellum';
  return mesh;
}

function makeBrainstem() {
  const geo = new THREE.CylinderGeometry(0.07, 0.1, 0.32, 24, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9867f,
    roughness: 0.8,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'placeholder_brainstem';
  return mesh;
}

export function createPlaceholderBrain() {
  const group = new THREE.Group();
  group.name = 'placeholder_brain';

  const left = makeHemisphere('L');
  left.position.x = -0.035;
  const right = makeHemisphere('R');
  right.position.x = 0.035;
  right.scale.x *= -1; // mirror for slight asymmetry

  const cerebellum = makeCerebellum();
  cerebellum.position.set(0, -0.32, -0.42);

  const stem = makeBrainstem();
  stem.position.set(0, -0.5, -0.32);
  stem.rotation.x = 0.25;

  group.add(left, right, cerebellum, stem);
  return group;
}
