// 神經脈衝動畫：在指定 mesh 上以 sin 波驅動 emissive 強度，加上位置相關的 phase
// 製造「電訊號沿著神經幹流動」的視覺。
// 每幀 update() 寫 material.emissiveIntensity；LayerManager 看到
// userData.isNerveAnimated 會跳過 emissive 操作。

import * as THREE from 'three';

const PULSE_COLOR_DEFAULT = 0x66ddff;   // 電青色
const SPEED_DEFAULT = 3.2;              // 時間頻率
const POS_SCALE_DEFAULT = 6.0;          // 位置相關 phase 變化（單位：phase per world unit）

export class NervePulseController {
  constructor({ pulseColor = PULSE_COLOR_DEFAULT, speed = SPEED_DEFAULT } = {}) {
    this.pulseColor = new THREE.Color(pulseColor);
    this.speed = speed;
    this.targets = [];
    this.time = 0;
  }

  // 註冊一個 group 內所有 mesh 為脈衝目標。phaseAxis 控制脈衝沿哪個軸流動：
  //   'y'（預設）→ 從上到下；'x' → 左右；'length' → 沿世界 Y 等距
  registerGroup(group, { phaseAxis = 'y', posScale = POS_SCALE_DEFAULT } = {}) {
    if (!group) return 0;
    let count = 0;
    const tmp = new THREE.Vector3();
    group.updateMatrixWorld(true);
    group.traverse(o => {
      if (!o.isMesh || !o.material) return;
      o.getWorldPosition(tmp);
      let phase;
      if (phaseAxis === 'y') phase = tmp.y * posScale;
      else if (phaseAxis === 'x') phase = tmp.x * posScale;
      else phase = (tmp.x + tmp.y + tmp.z) * posScale;

      // 把 emissive 預設成脈衝色，後面 update 只調 intensity
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        m.emissive.copy(this.pulseColor);
        m.emissiveIntensity = 0;
      }
      o.userData.isNerveAnimated = true;
      this.targets.push({ mesh: o, phase });
      count++;
    });
    return count;
  }

  update(dt) {
    if (!this.targets.length) return;
    this.time += dt;
    const t = this.time * this.speed;
    for (const { mesh, phase } of this.targets) {
      const wave = Math.sin(t + phase);
      // 0..1 範圍，主要在波峰時亮起
      const intensity = 0.10 + 0.55 * Math.max(0, wave);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity;
      }
    }
  }
}
