// 大腦旁的方向參考物：兩顆眼球。
// 支援兩種建構方式：
//   1) createOrientationEyes(brainBbox) — 從 brain bbox 估算位置（fallback）
//   2) createOrientationEyes({ leftPos, rightPos, radius }) — 用已知位置（如 skin 眶區）
// 都標 isOverlay 不被剖面切、不被選取淡化。

import * as THREE from 'three';

export function createOrientationEyes(spec) {
  if (spec && spec.leftPos && spec.rightPos) {
    return _eyesAtPositions(spec.leftPos, spec.rightPos, spec.radius);
  }
  return _eyesFromBbox(spec);
}

function _eyesFromBbox(brainBbox) {
  const center = brainBbox.getCenter(new THREE.Vector3());
  const size = brainBbox.getSize(new THREE.Vector3());
  const max = brainBbox.max;
  const eyeZ = max.z + size.z * 0.10;
  const eyeY = center.y - size.y * 0.18;
  const eyeOffsetX = size.x * 0.22;
  const radius = Math.min(size.x, size.y, size.z) * 0.055;
  const left  = new THREE.Vector3(center.x - eyeOffsetX, eyeY, eyeZ);
  const right = new THREE.Vector3(center.x + eyeOffsetX, eyeY, eyeZ);
  return _eyesAtPositions(left, right, radius);
}

function _eyesAtPositions(left, right, radius) {
  const r = radius ?? Math.max(0.025, left.distanceTo(right) * 0.18);
  const group = new THREE.Group();
  group.name = 'orientation_eyes';
  group.userData.isOverlay = true;
  for (const p of [left, right]) {
    group.add(_makeEyeball(p, r));
  }
  return group;
}

function _makeEyeball(worldPos, radius) {
  const sclera = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.35, metalness: 0.05,
    })
  );
  sclera.position.copy(worldPos);
  sclera.userData.isOverlay = true;

  // 虹膜面朝 +Z（與腦前緣朝向一致）
  const iris = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.55, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x3a5a8a, toneMapped: false })
  );
  iris.position.set(0, 0, radius * 0.78);
  iris.userData.isOverlay = true;
  sclera.add(iris);

  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.25, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x080d18, toneMapped: false })
  );
  pupil.position.set(0, 0, radius * 0.20);
  pupil.userData.isOverlay = true;
  iris.add(pupil);

  return sclera;
}
