// Raycaster + 點選/懸停控制。
// 點到帶 userData.structureId 的物件 → 觸發選取。
// 點到空白 → 取消選取。同一個再點一次 → 取消選取。

import * as THREE from 'three';

const DRAG_THRESHOLD = 6; // px：超過視為拖曳，不算 click

export class SelectionController {
  constructor({ canvas, camera, scene, onSelectChange, onHoverChange }) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;
    this.onSelectChange = onSelectChange;
    this.onHoverChange = onHoverChange;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.selectedId = null;
    this.hoveredId = null;

    this._downX = 0; this._downY = 0;
    this._lastEvent = null;

    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointerup',   this._onUp);
    canvas.addEventListener('pointerleave', this._onLeave);
  }

  dispose() {
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointerup',   this._onUp);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
  }

  _setPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _collectCandidates() {
    // 只接收有 primary structureId 的 mesh — structureIds-only（如血管）不算點選候選
    const out = [];
    const walk = (obj) => {
      if (!obj.visible) return;
      if (obj.isMesh && obj.userData.structureId) out.push(obj);
      for (const c of obj.children) walk(c);
    };
    walk(this.scene);
    return out;
  }

  _pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this._collectCandidates(), false);
    if (hits.length === 0) return null;
    // 優先選 marker（深部 marker 在腦內部，但 hit proxy 在外圍；總是讓 marker 贏）
    const markerHit = hits.find(h => h.object.userData.isMarker);
    if (markerHit) return markerHit.object;
    return hits[0].object;
  }

  _onMove = (e) => {
    this._setPointer(e);
    this._lastEvent = e;
    const hit = this._pick();
    const id = hit?.userData.structureId ?? null;
    if (id !== this.hoveredId) {
      this.hoveredId = id;
      this.canvas.style.cursor = id ? 'pointer' : '';
      this.onHoverChange?.(id, e);
    } else if (id) {
      // same id but new pointer position → still notify so tooltip moves
      this.onHoverChange?.(id, e);
    }
  };

  _onDown = (e) => {
    if (e.button !== 0) return;
    this._downX = e.clientX;
    this._downY = e.clientY;
  };

  _onUp = (e) => {
    if (e.button !== 0) return;
    const dx = e.clientX - this._downX;
    const dy = e.clientY - this._downY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) return; // 是拖曳，不算點選
    this._setPointer(e);
    const hit = this._pick();
    const id = hit?.userData.structureId ?? null;
    this.select(id);
  };

  _onLeave = () => {
    if (this.hoveredId) {
      this.hoveredId = null;
      this.canvas.style.cursor = '';
      this.onHoverChange?.(null, null);
    }
  };

  select(id) {
    const next = (id === this.selectedId) ? null : id;
    if (next === this.selectedId) return;
    this.selectedId = next;
    this.onSelectChange?.(this.selectedId);
  }
}
