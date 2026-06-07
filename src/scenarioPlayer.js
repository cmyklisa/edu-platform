// 情境模式播放器：分波次自動演示，每波可同時演多條 pathways。
// 跟單通路 PathwayPlayer 並存（單通路面板照樣可用）；場景情境啟動時會把單通路 stop 掉。
//
// API:
//   play(scenario)        從第一波開始
//   pause() / resume()
//   seekTo(waveIndex)     跳到指定波（暫停狀態）
//   stop()                清空所有 tube/arrow/dot
//   update(dt)            每 frame 呼叫
//   onChange(fn)          UI hook（波次切換、暫停狀態、目前播放時間）

import * as THREE from 'three';

const TUBE_RADIUS  = 0.014;
const DOT_RADIUS   = 0.060;
const SPEED        = 0.35;
const ARROW_COUNT  = 5;
const ARROW_LEN    = 0.080;
const ARROW_RADIUS = 0.032;
const DOT_LEN      = 0.10;
const DOT_RAD      = 0.045;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TMP_Q  = new THREE.Quaternion();

// 一條 pathway 的所有 render 物件（tube + arrows + dot + curve）打包
class PathwayInstance {
  constructor(curve, color, group) {
    this.curve = curve;
    this.color = color;
    this.group = group;
    this.t = 0;
    this._build();
  }

  _build() {
    // Tube
    const tubeGeo = new THREE.TubeGeometry(this.curve, 96, TUBE_RADIUS, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.62,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.tube = new THREE.Mesh(tubeGeo, tubeMat);
    this.tube.renderOrder = 998;
    this.tube.userData.isOverlay = true;
    this.group.add(this.tube);

    // Arrows
    const arrowGeo = new THREE.ConeGeometry(ARROW_RADIUS, ARROW_LEN, 12);
    arrowGeo.translate(0, ARROW_LEN * 0.5, 0);
    this.arrows = [];
    for (let i = 0; i < ARROW_COUNT; i++) {
      const u = (i + 0.5) / ARROW_COUNT;
      const pos = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u).normalize();
      const arrowMat = new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.copy(pos);
      TMP_Q.setFromUnitVectors(Y_AXIS, tan);
      arrow.quaternion.copy(TMP_Q);
      arrow.renderOrder = 999;
      arrow.userData.isOverlay = true;
      this.group.add(arrow);
      this.arrows.push(arrow);
    }
    this._arrowGeo = arrowGeo;

    // Flowing arrow-shaped dot (cone)，比 arrows 大一點點，明亮純白
    const dotGeo = new THREE.ConeGeometry(DOT_RAD, DOT_LEN, 14);
    dotGeo.translate(0, DOT_LEN * 0.5, 0);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.dot = new THREE.Mesh(dotGeo, dotMat);
    this.dot.renderOrder = 1000;
    this.dot.userData.isOverlay = true;
    this.group.add(this.dot);
  }

  update(dt) {
    if (!this.dot) return;
    this.t = (this.t + dt * SPEED) % 1;
    const u = this.t;
    this.dot.position.copy(this.curve.getPointAt(u));
    const tan = this.curve.getTangentAt(u).normalize();
    TMP_Q.setFromUnitVectors(Y_AXIS, tan);
    this.dot.quaternion.copy(TMP_Q);

    // Soft pulse on tube + arrows opacity (脈動感)
    const tNow = performance.now() * 0.003;
    const pulse = 0.55 + 0.20 * Math.sin(tNow);
    if (this.tube?.material) this.tube.material.opacity = pulse;
    for (const a of this.arrows) {
      if (a.material) a.material.opacity = 0.7 + 0.25 * Math.sin(tNow + 1.2);
    }
  }

  dispose() {
    this.tube?.geometry.dispose();
    this.tube?.material.dispose();
    this.group.remove(this.tube);
    this._arrowGeo?.dispose();
    for (const a of this.arrows) {
      a.material?.dispose();
      this.group.remove(a);
    }
    this.dot?.geometry.dispose();
    this.dot?.material.dispose();
    this.group.remove(this.dot);
    this.tube = null;
    this.dot = null;
    this.arrows = [];
  }
}

export class ScenarioPlayer {
  constructor({ scene, layerManager, markerMap, pathwayPlayer }) {
    this.scene = scene;
    this.layerManager = layerManager;
    this.markerMap = markerMap;
    this.pathwayPlayer = pathwayPlayer;  // 停掉舊單通路

    this.scenario = null;
    this.waveIndex = -1;
    this.elapsed = 0;
    this.paused = false;
    this.instances = [];
    this.listeners = new Set();

    this.group = new THREE.Group();
    this.group.name = 'scenario_overlay';
    scene.add(this.group);
  }

  isActive() { return !!this.scenario; }

  play(scenario) {
    this.stop();
    if (this.pathwayPlayer?.active) this.pathwayPlayer.stop();
    this.scenario = scenario;
    this.waveIndex = 0;
    this.elapsed = 0;
    this.paused = false;
    this._activateWave(0);
    this._notify();
  }

  pause() {
    if (!this.scenario) return;
    this.paused = true;
    this._notify();
  }

  resume() {
    if (!this.scenario) return;
    this.paused = false;
    this._notify();
  }

  togglePause() {
    if (!this.scenario) return;
    this.paused = !this.paused;
    this._notify();
  }

  seekTo(waveIndex) {
    if (!this.scenario) return;
    const idx = Math.max(0, Math.min(this.scenario.waves.length - 1, waveIndex));
    this.elapsed = 0;
    this.waveIndex = idx;
    this.paused = true;   // seek → 暫停在該波
    this._activateWave(idx);
    this._notify();
  }

  stop() {
    this._clearInstances();
    if (this.scenario) {
      this.layerManager.setHighlightSet(new Set());
      // 把為 pathway 顯示出來的 external/organ markers 隱回去
      for (const [, m] of this.markerMap) {
        if (!m.material) continue;
        if (m.userData.isMarker === false) continue;
        m.material.opacity = 0;
        m.scale.setScalar(1);
      }
    }
    this.scenario = null;
    this.waveIndex = -1;
    this.elapsed = 0;
    this.paused = false;
    this._notify();
  }

  _activateWave(idx) {
    this._clearInstances();
    const wave = this.scenario.waves[idx];
    if (!wave) return;

    // 顯示這波的 marker（external/organ 也強制顯示）
    const allNodes = new Set();
    for (const p of wave.pathways) for (const n of p.nodes) allNodes.add(n);

    this.layerManager.setHighlightSet(allNodes);

    // 把所有 chain markers 顯示
    for (const id of allNodes) {
      const m = this.markerMap.get(id);
      if (!m) continue;
      m.visible = true;
      if (m.material && m.userData.isMarker !== false) {
        m.material.opacity = m.material.userData._baseOpacity ?? 1.0;
      }
    }

    // 為每條 pathway 建一個 instance（同色 = wave.color）
    for (const p of wave.pathways) {
      const points = [];
      for (const id of p.nodes) {
        const m = this.markerMap.get(id);
        if (!m) {
          console.warn(`[scenario "${this.scenario.id}" wave "${wave.id}"] missing marker "${id}"`);
          continue;
        }
        points.push(m.position.clone());
      }
      if (points.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.4);
      const inst = new PathwayInstance(curve, wave.color, this.group);
      this.instances.push(inst);
    }
  }

  _clearInstances() {
    for (const inst of this.instances) inst.dispose();
    this.instances = [];
  }

  update(dt) {
    if (!this.scenario) return;
    // Clamp dt 避免 tab 切回 / 第一幀 clock 拖過頭，一口氣跳過幾波
    const safeDt = Math.min(dt, 0.05);
    for (const inst of this.instances) inst.update(safeDt);
    if (this.paused) return;
    this.elapsed += safeDt;
    const wave = this.scenario.waves[this.waveIndex];
    if (!wave) return;
    if (this.elapsed >= wave.duration) {
      // Next wave or loop end
      if (this.waveIndex + 1 < this.scenario.waves.length) {
        this.waveIndex++;
        this.elapsed = 0;
        this._activateWave(this.waveIndex);
        this._notify();
      } else {
        // 演完最後一波 → 停在最後一波並暫停
        this.paused = true;
        this._notify();
      }
    }
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _notify() { for (const fn of this.listeners) fn(); }

  getProgress() {
    if (!this.scenario) return null;
    const wave = this.scenario.waves[this.waveIndex];
    if (!wave) return null;
    return {
      waveIndex: this.waveIndex,
      waveCount: this.scenario.waves.length,
      elapsed: this.elapsed,
      duration: wave.duration,
      waveT: Math.min(1, this.elapsed / wave.duration),
      paused: this.paused,
      wave,
    };
  }
}
