// 大腦旁的方向參考物：兩顆眼球。
// 預期傳入的是純 brain bbox（不含 skull/skin），這樣眼睛才會落在前額葉下方、向前。
// 標 isOverlay 不被剖面切、不被選取淡化。

import * as THREE from 'three';

export function createOrientationEyes(brainBbox) {
  const center = brainBbox.getCenter(new THREE.Vector3());
  const size = brainBbox.getSize(new THREE.Vector3());
  const max = brainBbox.max;

  // 解剖位置：
  //   - z：腦前緣 (max.z) 再往前一點（眼窩在頭骨前壁），約 size.z 的 10% 外推
  //   - y：在前額葉下方、視丘上方 — 略低於腦中心（眼眶位於前顱底）
  //   - x：在腦寬度內側（眼睛不會比腦寬），約 size.x × 0.22
  const eyeZ = max.z + size.z * 0.10;
  const eyeY = center.y - size.y * 0.18;
  const eyeOffsetX = size.x * 0.22;
  // 眼球半徑：以較短邊為基準，約 5%（成人 brain ≈ 14cm、eyeball ≈ 2.4cm，比例 ~6:1）
  const eyeRadius = Math.min(size.x, size.y, size.z) * 0.055;

  const group = new THREE.Group();
  group.name = 'orientation_eyes';
  group.userData.isOverlay = true;

  for (const dx of [-eyeOffsetX, eyeOffsetX]) {
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.35, metalness: 0.05,
      })
    );
    sclera.position.set(center.x + dx, eyeY, eyeZ);
    sclera.userData.isOverlay = true;

    // 虹膜面朝 +Z（與腦前緣朝向一致），protrude 出 sclera 前緣
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
  }

  return group;
}
