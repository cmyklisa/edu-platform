// 通路播放器：建構整條鏈的曲線 tube、沿線移動的光點、節點脈動。
// 不在任何 layer 之下，掛在 scene root，固定 depthTest:false 永遠可見。

import * as THREE from 'three';
import { structureRegistry } from './structures.js';

const TUBE_COLOR  = 0xffd86a;  // 暖黃
const DOT_COLOR   = 0xffffff;
const TUBE_RADIUS = 0.014;
const DOT_RADIUS  = 0.045;
const SPEED       = 0.28;       // 每秒走過的 t 比例 (0..1)
const CHAIN_PULSE_BASE  = 1.30;
const CHAIN_PULSE_AMP   = 0.10;

const ARROW_COUNT       = 5;
const ARROW_LEN         = 0.075;
const ARROW_RADIUS      = 0.030;
const TMP_Y = new THREE.Vector3(0, 1, 0);
const TMP_Q = new THREE.Quaternion();

export class PathwayPlayer {
  constructor({ scene, layerManager, markerMap, getSelectedId }) {
    this.scene = scene;
    this.layerManager = layerManager;
    this.markerMap = markerMap;
    this.getSelectedId = getSelectedId ?? (() => null);

    this.active = null;     // active pathway object
    this.curve  = null;
    this.tube   = null;
    this.dot    = null;
    this.arrows = [];       // 方向箭頭 mesh 陣列
    this.t      = 0;

    this.group = new THREE.Group();
    this.group.name = 'pathway_overlay';
    scene.add(this.group);

    this.onChange = null;   // optional callback for UI refresh
  }

  isPlaying(pathwayId) {
    return this.active?.id === pathwayId;
  }

  play(pathway) {
    this.stop();

    // Resolve node positions; warn (don't crash) on missing nodes
    const points = [];
    for (const id of pathway.nodes) {
      const m = this.markerMap.get(id);
      if (!m) {
        console.warn(`[pathway "${pathway.id}"] missing marker for node "${id}" — skipped`);
        continue;
      }
      points.push(m.position.clone());
    }
    if (points.length < 2) {
      console.warn(`[pathway "${pathway.id}"] needs at least 2 resolvable nodes`);
      return;
    }

    // Reveal external/organ nodes that are part of this pathway
    for (const id of pathway.nodes) {
      const m = this.markerMap.get(id);
      if (m) m.visible = true;
    }

    this.active = pathway;

    // Smooth curve through nodes
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.4);

    // Tube + arrow 顏色：通路可自帶 color；沒給就用預設暖黃
    const tubeColor = pathway.color != null ? pathway.color : TUBE_COLOR;

    // Glowing tube
    const tubeGeo = new THREE.TubeGeometry(this.curve, 120, TUBE_RADIUS, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: tubeColor,
      transparent: true,
      opacity: 0.65,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.tube = new THREE.Mesh(tubeGeo, tubeMat);
    this.tube.renderOrder = 998;
    this.tube.name = `pathway_tube:${pathway.id}`;
    this.tube.userData.isOverlay = true;   // 不被剖面切到
    this.group.add(this.tube);

    // 沿線方向箭頭（cone）：固定位置標示流向
    const arrowGeo = new THREE.ConeGeometry(ARROW_RADIUS, ARROW_LEN, 12);
    // ConeGeometry 預設沿 +Y 軸朝上；移到尖端，方便對齊 tangent
    arrowGeo.translate(0, ARROW_LEN * 0.5, 0);
    for (let i = 0; i < ARROW_COUNT; i++) {
      const u = (i + 0.5) / ARROW_COUNT;
      const pos = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u).normalize();
      const arrowMat = new THREE.MeshBasicMaterial({
        color: tubeColor,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.copy(pos);
      TMP_Q.setFromUnitVectors(TMP_Y, tan);
      arrow.quaternion.copy(TMP_Q);
      arrow.renderOrder = 999;
      arrow.userData.isOverlay = true;
      arrow.name = `pathway_arrow:${pathway.id}:${i}`;
      this.group.add(arrow);
      this.arrows.push(arrow);
    }

    // Flowing dot
    const dotGeo = new THREE.SphereGeometry(DOT_RADIUS, 22, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: DOT_COLOR,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.dot = new THREE.Mesh(dotGeo, dotMat);
    this.dot.renderOrder = 1000;
    this.dot.name = `pathway_dot:${pathway.id}`;
    this.dot.userData.isOverlay = true;
    this.dot.position.copy(this.curve.getPoint(0));
    this.group.add(this.dot);

    this.t = 0;

    // Highlight the chain in LayerManager → 其餘自動淡化
    this.layerManager.setHighlightSet(new Set(pathway.nodes));

    this.onChange?.();
  }

  stop() {
    if (!this.active && !this.tube && !this.dot) {
      // even if no active, ensure cleanup (defensive)
    }

    const wasActive = this.active;

    if (this.tube) {
      this.tube.geometry.dispose();
      this.tube.material.dispose();
      this.group.remove(this.tube);
      this.tube = null;
    }
    if (this.dot) {
      this.dot.geometry.dispose();
      this.dot.material.dispose();
      this.group.remove(this.dot);
      this.dot = null;
    }
    // 共用 cone geometry：在第一個箭頭 dispose 即可，其餘材質個別 dispose
    if (this.arrows.length) {
      this.arrows[0].geometry?.dispose();
      for (const a of this.arrows) {
        a.material?.dispose();
        this.group.remove(a);
      }
      this.arrows = [];
    }
    this.curve = null;
    this.active = null;
    this.t = 0;

    // Reset chain marker scales + opacity + hide external/organ markers
    for (const [id, m] of this.markerMap) {
      const struct = structureRegistry.get(id);
      if (struct?.kind === 'external' || struct?.kind === 'organ') {
        m.visible = false;
      }
      m.scale.setScalar(1);
      if (m.material && m.userData.isMarker !== false) m.material.opacity = 0;
    }

    this.layerManager.setHighlightSet(new Set());

    if (wasActive) this.onChange?.();
  }

  update(dt) {
    if (!this.active || !this.curve || !this.dot) return;

    this.t = (this.t + dt * SPEED) % 1;

    // Use arc-length parameterized point for visually constant speed
    const u = this.t;
    const p = this.curve.getPointAt(u);
    this.dot.position.copy(p);

    // Soft pulse on dot scale
    const tNow = performance.now() * 0.004;
    const dotPulse = 1 + 0.18 * Math.sin(tNow * 2);
    this.dot.scale.setScalar(dotPulse);

    // Pulse the chain markers (but let the currently selected one stay bigger).
    // 跳過 isMarker===false 的 entry（真實 organ mesh），它有自己的尺寸，不能亂縮放
    const selId = this.getSelectedId();
    const pulse = CHAIN_PULSE_BASE + CHAIN_PULSE_AMP * Math.sin(tNow);
    for (const id of this.active.nodes) {
      const m = this.markerMap.get(id);
      if (!m) continue;
      if (m.userData.isMarker === false) continue;
      const scale = (id === selId) ? 1.55 : pulse;
      m.scale.setScalar(scale);
      // marker 預設 opacity=0，通路播放時 chain markers 強制可見
      if (m.material) m.material.opacity = m.material.userData._baseOpacity ?? 1.0;
    }
  }
}
