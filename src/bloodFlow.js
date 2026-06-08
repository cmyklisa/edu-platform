// 血流動畫控制器：每條血管掛一個 cone「光點」沿血管中軸流動。
// - 動脈：紅光點，方向 = 心臟→末梢
// - 靜脈：藍光點，方向 = 末梢→心臟
// - 不再用 emissive 整條 pulse（會被誤認為「沒有移動」）
// - 從 baked tube mesh 的 vertex sequence 抽出 Catmull-Rom curve，沿曲線把
//   光點 dot 拖過去；每條血管有不同初始 t 讓整體看起來像持續流動而非同步動

import * as THREE from 'three';

const ARTERY_COLOR  = 0xff5555;
const VEIN_COLOR    = 0x4aa6ff;
const ARTERY_GLOW   = 0xff8a8a;
const VEIN_GLOW     = 0x8fc6ff;

const SPEED         = 0.30;       // 每秒走過的 t 比例 (0..1)
const DOT_RADIUS    = 0.020;
const DOT_LENGTH    = 0.060;

const CURVE_SAMPLES = 18;         // 每條血管採樣點數

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TMP_V  = new THREE.Vector3();
const TMP_Q  = new THREE.Quaternion();

const ARTERY_PATTERNS = [
  'artery', 'arteries', 'aorta', 'aortic',
  'trunk', 'arch', 'coronary',
];
const VEIN_PATTERNS = [
  'vein', 'veins', 'venous', 'cava', 'azygos', 'sinus',
];

export function classifyVessel(name) {
  if (!name) return 'other';
  const low = name.toLowerCase();
  for (const p of VEIN_PATTERNS)   if (low.includes(p)) return 'vein';
  for (const p of ARTERY_PATTERNS) if (low.includes(p)) return 'artery';
  return 'other';
}

// 從 baked tube mesh 抽 polyline (world coords)：均勻取 N 個 vertex，靠
// CatmullRomCurve3 把 zigzag 抹平。
function extractCurve(mesh, samples = CURVE_SAMPLES) {
  const pos = mesh.geometry.attributes.position;
  if (!pos || pos.count < 8) return null;
  mesh.updateMatrixWorld(true);

  // 取得每個 sample vertex，依 i*stride 採
  const points = [];
  const stride = Math.max(1, Math.floor((pos.count - 1) / (samples - 1)));
  for (let i = 0; i < samples; i++) {
    const idx = Math.min(pos.count - 1, i * stride);
    TMP_V.fromBufferAttribute(pos, idx).applyMatrix4(mesh.matrixWorld);
    points.push(TMP_V.clone());
  }
  // 把連在一起且距離極小的重複點去掉，避免 CatmullRom 失敗
  const dedupe = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].distanceTo(dedupe[dedupe.length - 1]) > 1e-4) {
      dedupe.push(points[i]);
    }
  }
  if (dedupe.length < 2) return null;

  return new THREE.CatmullRomCurve3(dedupe, false, 'centripetal', 0.5);
}

export class BloodFlowController {
  constructor({ heartPos, speed = SPEED } = {}) {
    this.heartPos = heartPos ? heartPos.clone() : new THREE.Vector3();
    this.speed = speed;
    this.arteries = [];   // [{ curve, dot, t }]
    this.veins = [];
    this.dotGroup = null;
    this._dotGeo = null;
    this.enabled = false;
    this.listeners = new Set();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (this.dotGroup) this.dotGroup.visible = this.enabled;
    for (const fn of this.listeners) fn(this);
  }
  toggle() { this.setEnabled(!this.enabled); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** vesselGroup = layerManager.getGroup('vessel')，dotParent 通常是 scene root */
  registerVesselGroup(vesselGroup, dotParent) {
    if (!vesselGroup) return { artery: 0, vein: 0, other: 0 };
    vesselGroup.updateMatrixWorld(true);

    // 共用 dot geometry（cone，base 在 origin，tip 往 +Y）
    const geo = new THREE.ConeGeometry(DOT_RADIUS, DOT_LENGTH, 10);
    geo.translate(0, DOT_LENGTH * 0.5, 0);
    this._dotGeo = geo;

    // 所有 dot 放一個 group，方便整體開關
    this.dotGroup = new THREE.Group();
    this.dotGroup.name = 'blood_flow_dots';
    this.dotGroup.visible = false;
    dotParent.add(this.dotGroup);

    let other = 0;
    vesselGroup.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const cat = classifyVessel(o.name);
      o.userData.vesselCategory = cat;

      // 著色血管本體
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (cat === 'artery')      m.color.setHex(ARTERY_COLOR);
        else if (cat === 'vein')   m.color.setHex(VEIN_COLOR);
        m.needsUpdate = true;
      }

      if (cat !== 'artery' && cat !== 'vein') { other++; return; }

      // 抽 curve（world coords）
      let curve = extractCurve(o);
      if (!curve) return;

      // 判斷方向：動脈要從心臟近端流向遠端，靜脈反之
      const p0 = curve.getPointAt(0);
      const p1 = curve.getPointAt(1);
      const d0 = p0.distanceTo(this.heartPos);
      const dN = p1.distanceTo(this.heartPos);
      const flipNeeded =
        (cat === 'artery' && d0 > dN) ||   // 動脈：t=0 應該是近心臟
        (cat === 'vein'   && d0 < dN);     // 靜脈：t=0 應該是遠心臟
      if (flipNeeded) {
        curve = new THREE.CatmullRomCurve3(
          [...curve.points].reverse(), false, 'centripetal', 0.5,
        );
      }

      // 建一個 dot
      const dotMat = new THREE.MeshBasicMaterial({
        color: cat === 'artery' ? ARTERY_GLOW : VEIN_GLOW,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const dot = new THREE.Mesh(geo, dotMat);
      dot.userData.isOverlay = true;
      dot.renderOrder = 999;
      this.dotGroup.add(dot);

      // 隨機初始 t → 各血管不同步，看起來像持續流動而非整齊
      const item = { curve, dot, t: Math.random() };
      if (cat === 'artery') this.arteries.push(item);
      else                  this.veins.push(item);
    });

    return { artery: this.arteries.length, vein: this.veins.length, other };
  }

  update(dt) {
    if (!this.enabled) return;
    const advance = dt * this.speed;
    for (const arr of [this.arteries, this.veins]) {
      for (const v of arr) {
        v.t = (v.t + advance) % 1.0;
        const p = v.curve.getPointAt(v.t);
        const tan = v.curve.getTangentAt(v.t);
        v.dot.position.copy(p);
        TMP_Q.setFromUnitVectors(Y_AXIS, tan);
        v.dot.quaternion.copy(TMP_Q);
      }
    }
  }
}
