// 血流動畫控制器：動脈紅光點往外流、靜脈藍光點往回心臟。
// 跟 NervePulseController 概念相同：
//   - 每條血管 mesh 註冊一個「相位 phase」（與「距心臟距離」相關）
//   - update 每幀依時間 + phase 算 emissive intensity 寫進 material
//   - 動脈相位 = +distance（同個距離的血管 phase 相同 → 波從近心臟先亮，遠處後亮 → 看起來往外流）
//   - 靜脈相位 = -distance（反過來 → 看起來往心臟匯流）
//
// 同時在每條血管 mesh 上掛一個方向 cone 箭頭（紅 / 藍），固定不動，給「方向感」。

import * as THREE from 'three';

const SPEED_DEFAULT = 2.8;
const ARTERY_COLOR  = 0xff5555;   // 動脈紅
const VEIN_COLOR    = 0x4aa6ff;   // 靜脈藍

const ARTERY_PATTERNS = [
  'artery', 'arteries', 'aorta', 'aortic',
  'trunk',   // brachiocephalic trunk / coeliac trunk / pulmonary trunk 都是動脈
  'arch',    // palmar arch / arch of aorta
  'coronary',
];
const VEIN_PATTERNS = [
  'vein', 'veins', 'venous',
  'cava',    // vena cava
  'azygos',
  'sinus',   // venous sinus
];

export function classifyVessel(name) {
  if (!name) return 'other';
  const low = name.toLowerCase();
  for (const p of VEIN_PATTERNS)   if (low.includes(p)) return 'vein';
  for (const p of ARTERY_PATTERNS) if (low.includes(p)) return 'artery';
  return 'other';
}

const TMP_V = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TMP_Q = new THREE.Quaternion();

export class BloodFlowController {
  constructor({ heartPos, speed = SPEED_DEFAULT } = {}) {
    this.heartPos = heartPos ? heartPos.clone() : new THREE.Vector3();
    this.speed = speed;
    this.arteries = [];   // [{ mesh, phase, arrow }]
    this.veins    = [];
    this.others   = [];
    this.time     = 0;
    this.enabled  = false;
    this._cleared = true;
    this.listeners = new Set();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) {
      this._writeIntensity(0);
      this._setArrowVisibility(false);
    } else {
      this._setArrowVisibility(true);
    }
    this._cleared = !this.enabled;
    for (const fn of this.listeners) fn(this);
  }
  toggle() { this.setEnabled(!this.enabled); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** 把 vessel layer group 內所有 mesh 註冊；同時為每條血管產生方向箭頭 mesh
   *  並加到 arrowParent group。 */
  registerVesselGroup(group, arrowParent) {
    if (!group) return { artery: 0, vein: 0, other: 0 };
    group.updateMatrixWorld(true);

    const arrowGeo = new THREE.ConeGeometry(0.018, 0.05, 10);
    arrowGeo.translate(0, 0.025, 0);
    this._arrowGeo = arrowGeo;

    // 用一條 mesh 中心位置算「距心臟距離」+「相對於心臟的方向向量」
    group.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const cat = classifyVessel(o.name);
      o.userData.vesselCategory = cat;

      // mesh world centroid (用 boundingSphere center 比 bbox 穩)
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const localCenter = o.geometry.boundingSphere?.center ?? new THREE.Vector3();
      o.localToWorld(TMP_V.copy(localCenter));
      const worldCenter = TMP_V.clone();
      const dir = worldCenter.clone().sub(this.heartPos);
      const dist = dir.length();

      // Phase：動脈 +d、靜脈 -d → 看起來相反方向流動
      const phase = (cat === 'artery') ? dist * 6.0 : -dist * 6.0;

      // 著色：動脈紅、靜脈藍、其他保留原色
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        if (cat === 'artery')      m.color.setHex(ARTERY_COLOR);
        else if (cat === 'vein')   m.color.setHex(VEIN_COLOR);
        // emissive 預設黑，update 時才寫
        m.emissive.copy(cat === 'artery'
          ? new THREE.Color(0xff7070)
          : cat === 'vein'   ? new THREE.Color(0x6bb6ff)
                             : new THREE.Color(0xffffff));
        m.emissiveIntensity = 0;
      }

      // 方向箭頭：朝離心臟更遠（動脈外推）或更近（靜脈回流）的方向
      // arrowParent 在 scene root 下，arrow.position 用世界座標
      if (cat === 'artery' || cat === 'vein') {
        const arrowMat = new THREE.MeshBasicMaterial({
          color: cat === 'artery' ? ARTERY_COLOR : VEIN_COLOR,
          transparent: true,
          opacity: 0.85,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.copy(worldCenter);
        // 方向：動脈遠離心臟、靜脈靠近心臟
        const flowDir = (cat === 'artery')
          ? dir.clone().normalize()
          : dir.clone().normalize().negate();
        if (flowDir.lengthSq() < 1e-6) flowDir.set(0, 1, 0);
        TMP_Q.setFromUnitVectors(Y_AXIS, flowDir);
        arrow.quaternion.copy(TMP_Q);
        arrow.userData.isOverlay = true;
        arrow.visible = false;
        arrow.renderOrder = 999;
        arrowParent.add(arrow);

        if (cat === 'artery') this.arteries.push({ mesh: o, phase, arrow });
        else                  this.veins.push({ mesh: o, phase, arrow });
      } else {
        this.others.push({ mesh: o, phase });
      }
    });
    return { artery: this.arteries.length, vein: this.veins.length, other: this.others.length };
  }

  _writeIntensity(intensity) {
    for (const arr of [this.arteries, this.veins, this.others]) {
      for (const { mesh } of arr) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity;
        }
      }
    }
  }

  _setArrowVisibility(v) {
    for (const arr of [this.arteries, this.veins]) {
      for (const { arrow } of arr) arrow.visible = v;
    }
  }

  update(dt) {
    if (!this.enabled) {
      if (!this._cleared) {
        this._writeIntensity(0);
        this._cleared = true;
      }
      return;
    }
    this._cleared = false;
    this.time += dt;
    const t = this.time * this.speed;
    // 動脈：phase = +dist → 波先到近心臟血管，再到遠處 → 視覺上「從心臟流出」
    // 靜脈：phase = -dist → 反過來「從遠處流回心臟」
    for (const arr of [this.arteries, this.veins]) {
      for (const { mesh, phase } of arr) {
        const wave = Math.sin(t - phase);   // -phase 讓波 propagate 方向跟 dist 增加方向一致
        const intensity = 0.05 + 0.60 * Math.max(0, wave);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity;
        }
      }
    }
  }
}
