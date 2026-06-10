// 血流動畫控制器：每條血管沿中軸渲染一條「彗星拖尾」（漸層流動條），
// 讓使用者一眼看出血液流動方向。
//
// 設計：
//   - 動脈（紅光點）：方向 = 心臟 → 末梢
//   - 靜脈（藍光點）：方向 = 末梢 → 心臟
//   - 從 baked tube mesh 的 vertex sequence 抽出 Catmull-Rom curve 當中軸
//   - 每條血管掛 N 個 particle（1 個亮頭 + N-1 個漸暗拖尾），全部沿 curve 一起前進
//   - 頭部最大、最亮，朝向 curve 切線方向（cone）→ 視覺上「箭頭式」指流向
//   - 拖尾為小球，alpha 從頭到尾線性遞減 → 形成彗星拖尾
//   - 各血管 baseT 隨機 → 不同血管不同步，整體看起來像持續流動而非整齊動

import * as THREE from 'three';

const ARTERY_COLOR  = 0xff5555;
const VEIN_COLOR    = 0x4aa6ff;
const ARTERY_GLOW   = 0xff8a8a;
const VEIN_GLOW     = 0x9fd0ff;

const SPEED         = 0.22;       // 每秒走過的 t 比例 (0..1)

const HEAD_RADIUS   = 0.022;      // 頭部 cone 半徑（小一點，避免遠距聚成色塊）
const HEAD_LENGTH   = 0.085;      // 頭部 cone 長度（拉長 → 箭頭感更明顯）
const TAIL_RADIUS   = 0.013;      // 拖尾起始球半徑（比頭小）
const TAIL_MIN_SCALE = 0.25;      // 拖尾末端縮到首端的比例
const TAIL_COUNT    = 6;          // 拖尾粒子數（不含頭）
const TAIL_SPAN     = 0.16;       // 拖尾總長（curve 比例）
const HEAD_ALPHA    = 1.0;
const TAIL_ALPHA_MAX = 0.78;      // 拖尾首端 alpha
const TAIL_ALPHA_MIN = 0.06;      // 拖尾末端 alpha

const CURVE_SAMPLES = 32;         // 每條血管採樣點數
const FADE_EDGE     = 0.06;       // t 進入 [0, FADE]/[1-FADE, 1] 時整體 alpha 漸隱

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

  const points = [];
  const stride = Math.max(1, Math.floor((pos.count - 1) / (samples - 1)));
  for (let i = 0; i < samples; i++) {
    const idx = Math.min(pos.count - 1, i * stride);
    TMP_V.fromBufferAttribute(pos, idx).applyMatrix4(mesh.matrixWorld);
    points.push(TMP_V.clone());
  }
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
    this.arteries = [];   // [{ curve, head, tail, baseT, glowColor }]
    this.veins = [];
    this.dotGroup = null;
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

    // 共用幾何：頭部 cone（指向 +Y）+ 拖尾 sphere
    const headGeo = new THREE.ConeGeometry(HEAD_RADIUS, HEAD_LENGTH, 12);
    headGeo.translate(0, HEAD_LENGTH * 0.5, 0);
    const tailGeo = new THREE.SphereGeometry(TAIL_RADIUS, 10, 8);

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
        (cat === 'artery' && d0 > dN) ||
        (cat === 'vein'   && d0 < dN);
      if (flipNeeded) {
        curve = new THREE.CatmullRomCurve3(
          [...curve.points].reverse(), false, 'centripetal', 0.5,
        );
      }

      const glowColor = cat === 'artery' ? ARTERY_GLOW : VEIN_GLOW;

      // 頭部：cone 朝流向
      const headMat = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: HEAD_ALPHA,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.userData.isOverlay = true;
      head.renderOrder = 999;
      this.dotGroup.add(head);

      // 拖尾：N 個球，alpha 從近頭部 → 末端線性遞減；scale 同步縮小
      const tail = [];
      for (let i = 0; i < TAIL_COUNT; i++) {
        const tNorm = (i + 1) / TAIL_COUNT;  // 0..1，0 = 近頭、1 = 末端
        const alpha = TAIL_ALPHA_MAX * (1 - tNorm) + TAIL_ALPHA_MIN * tNorm;
        const scale = 1.0 * (1 - tNorm) + TAIL_MIN_SCALE * tNorm;
        const mat = new THREE.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: alpha,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const dot = new THREE.Mesh(tailGeo, mat);
        dot.scale.setScalar(scale);
        dot.userData.isOverlay = true;
        dot.userData._baseOpacity = alpha;  // 紀錄原始 alpha，邊界 fade 用
        dot.renderOrder = 998;
        this.dotGroup.add(dot);
        tail.push(dot);
      }
      head.userData._baseOpacity = HEAD_ALPHA;

      // 隨機 base offset → 各血管不同步
      const item = { curve, head, tail, baseT: Math.random(), glowColor };
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
        v.baseT = (v.baseT + advance) % 1.0;

        // 頭部：位置 + 朝向（沿切線）
        const tHead = v.baseT;
        const pHead = v.curve.getPointAt(tHead);
        const tanHead = v.curve.getTangentAt(tHead);
        v.head.position.copy(pHead);
        TMP_Q.setFromUnitVectors(Y_AXIS, tanHead);
        v.head.quaternion.copy(TMP_Q);
        // 邊界 fade：t 接近 0/1 時把整條彗星 alpha 拉到 0，掩蓋 wrap-around 視覺跳
        const headFade = Math.min(
          Math.min(1, tHead / FADE_EDGE),
          Math.min(1, (1 - tHead) / FADE_EDGE),
        );
        v.head.material.opacity = HEAD_ALPHA * headFade;

        // 拖尾：沿 curve 往回退
        for (let i = 0; i < v.tail.length; i++) {
          const offset = ((i + 1) / TAIL_COUNT) * TAIL_SPAN;
          let tDot = tHead - offset;
          if (tDot < 0) tDot += 1.0;
          const p = v.curve.getPointAt(tDot);
          v.tail[i].position.copy(p);
          // 邊界 fade
          const fade = Math.min(
            Math.min(1, tDot / FADE_EDGE),
            Math.min(1, (1 - tDot) / FADE_EDGE),
          );
          v.tail[i].material.opacity = v.tail[i].userData._baseOpacity * fade;
        }
      }
    }
  }
}
