// 大腦旁的方向參考物：兩顆眼球。
// 不掛在任何 layer 之下，標 isOverlay 不被剖面切、不被選取淡化。

import * as THREE from 'three';

export function createOrientationEyes(brainBbox) {
  // 眼睛位置依照腦的 bbox 估算（眼睛應該在前下方）
  const center = brainBbox.getCenter(new THREE.Vector3());
  const size = brainBbox.getSize(new THREE.Vector3());

  const eyeY = center.y - size.y * 0.20;          // 略低於中心
  const eyeZ = center.z + size.z * 0.55;          // 突出於前緣
  const eyeOffsetX = size.x * 0.20;
  const eyeRadius = Math.min(size.x, size.y, size.z) * 0.10;

  const group = new THREE.Group();
  group.name = 'orientation_eyes';
  group.userData.isOverlay = true;

  const eyes = [];
  for (const dx of [-eyeOffsetX, eyeOffsetX]) {
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.35, metalness: 0.05,
      })
    );
    sclera.position.set(center.x + dx, eyeY, eyeZ);
    sclera.userData.isOverlay = true;

    // 虹膜 + 瞳孔（朝向 +Z，與大腦同一前面方向）
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius * 0.55, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x3a5a8a, toneMapped: false })
    );
    iris.position.set(0, 0, eyeRadius * 0.78);
    iris.userData.isOverlay = true;
    sclera.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius * 0.25, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x080d18, toneMapped: false })
    );
    pupil.position.set(0, 0, eyeRadius * 0.20);
    pupil.userData.isOverlay = true;
    iris.add(pupil);

    group.add(sclera);
    eyes.push(sclera);
  }

  return group;
}
