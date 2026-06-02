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

    // Glowing tube
    const tubeGeo = new THREE.TubeGeometry(this.curve, 120, TUBE_RADIUS, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: TUBE_COLOR,
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
    this.curve = null;
    this.active = null;
    this.t = 0;

    // Reset chain marker scales + hide external/organ markers
    for (const [id, m] of this.markerMap) {
      const struct = structureRegistry.get(id);
      if (struct?.kind === 'external' || struct?.kind === 'organ') {
        m.visible = false;
      }
      m.scale.setScalar(1);
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

    // Pulse the chain markers (but let the currently selected one stay bigger)
    const selId = this.getSelectedId();
    const pulse = CHAIN_PULSE_BASE + CHAIN_PULSE_AMP * Math.sin(tNow);
    for (const id of this.active.nodes) {
      const m = this.markerMap.get(id);
      if (!m) continue;
      const scale = (id === selId) ? 1.55 : pulse;
      m.scale.setScalar(scale);
    }
  }
}
