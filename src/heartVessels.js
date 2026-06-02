// 心臟到大腦的主要血管（簡化的主動脈弓 + 雙側頸動脈），用 TubeGeometry 程序化。
// 視覺目的：讓 heart wrapper 與 brain base 之間有可見的連接，學習者一眼看到「下游器官」。
// 通路高亮：tag structureIds 含 'heart' 與 'medulla'，這兩者都在恐懼通路 highlightSet 中 →
// LayerManager 會給 emissive 黃光。
//
// 不設 userData.structureId（primary）→ 不會被 raycaster 當點選候選，避免點到血管。

import * as THREE from 'three';

export function createHeartVessels({ heartPosition, brainBox }) {
  const group = new THREE.Group();
  group.name = 'heart_brain_vessels';

  // 心臟頂端（heart wrapper 中心 + 一點偏上）
  const heartTop = heartPosition.clone();
  heartTop.y += 0.18;
  // 大腦底端（腦幹下緣再往下推一點，避免穿進腦）
  const brainBase = new THREE.Vector3(0, brainBox.min.y + 0.02, 0);

  // 兩條頸動脈：從心臟頂部上升、稍微外擴再內收進入腦底
  for (const xOff of [-0.08, 0.08]) {
    const midY = (heartTop.y + brainBase.y) * 0.5;
    const p1 = heartTop.clone();
    const p2 = new THREE.Vector3(xOff * 0.45, midY + 0.08, heartTop.z * 0.5);
    const p3 = new THREE.Vector3(xOff * 0.30, midY - 0.05, 0);
    const p4 = new THREE.Vector3(xOff * 0.10, brainBase.y, 0);

    const curve = new THREE.CatmullRomCurve3([p1, p2, p3, p4], false, 'catmullrom', 0.4);
    const geo = new THREE.TubeGeometry(curve, 60, 0.018, 10, false);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb83242,
      roughness: 0.4,
      metalness: 0.10,
      side: THREE.DoubleSide,
    });
    const tube = new THREE.Mesh(geo, mat);
    tube.name = `vessel_carotid_${xOff > 0 ? 'r' : 'l'}`;
    // 高亮 only：放 structureIds 但不設 structureId（不被 raycaster 當點選候選）
    tube.userData.structureIds = new Set(['heart', 'medulla']);
    tube.userData.isVesselTube = true;
    group.add(tube);
  }

  // 心臟到主動脈弓的短粗主幹（visible at heart top）
  const aortaStart = heartPosition.clone();
  aortaStart.y += 0.05;
  const aortaPoints = [
    aortaStart,
    aortaStart.clone().setY(aortaStart.y + 0.10).setZ(aortaStart.z + 0.05),
    heartTop,
  ];
  const aortaCurve = new THREE.CatmullRomCurve3(aortaPoints, false, 'catmullrom', 0.4);
  const aortaGeo = new THREE.TubeGeometry(aortaCurve, 30, 0.028, 12, false);
  const aortaMat = new THREE.MeshStandardMaterial({
    color: 0xa92836, roughness: 0.4, metalness: 0.10, side: THREE.DoubleSide,
  });
  const aorta = new THREE.Mesh(aortaGeo, aortaMat);
  aorta.name = 'vessel_aorta';
  aorta.userData.structureIds = new Set(['heart']);
  aorta.userData.isVesselTube = true;
  group.add(aorta);

  return group;
}
