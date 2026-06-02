// 剖面切片：用 single clipping plane 把腦/殼切開，露出內部。
// Markers 與 pathway overlay 標記為 userData.isOverlay/isMarker，不被切。

import * as THREE from 'three';

const AXIS_NORMAL = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export const AXES = ['off', 'x', 'z', 'y'];
export const AXIS_LABEL = {
  off: '關閉',
  x:   '矢狀面 (X)',
  z:   '冠狀面 (Z)',
  y:   '水平面 (Y)',
};

export class ClippingController {
  constructor({ renderer, scene, getBoundingBox }) {
    this.renderer = renderer;
    this.scene = scene;
    this.getBoundingBox = getBoundingBox;

    renderer.localClippingEnabled = true;

    this.planes = [];                  // shared, mutated (not reassigned)
    this.activePlane = new THREE.Plane();

    this.axis = 'off';
    this.depth = 0.5;

    this.axisListeners = new Set();   // 軸切換才重畫 UI；slider 不重畫（會打斷拖動）
    this._materialsApplied = false;
  }

  applyToMaterials() {
    this.scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.isMarker) return;
      if (o.userData.isOverlay) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.clippingPlanes = this.planes;
        m.clipIntersection = false;
      }
    });
    this._materialsApplied = true;
  }

  setAxis(axis) {
    if (this.axis === axis) return;
    this.axis = axis;
    this._recompute();
    for (const fn of this.axisListeners) fn();
  }

  setDepth(t) {
    this.depth = Math.max(0, Math.min(1, t));
    if (this.axis !== 'off') this._recompute();
  }

  _recompute() {
    if (!this._materialsApplied) this.applyToMaterials();

    if (this.axis === 'off') {
      this.planes.length = 0;
      return;
    }

    const normal = AXIS_NORMAL[this.axis];
    this.activePlane.normal.copy(normal);

    const bbox = this.getBoundingBox();
    if (!bbox || bbox.isEmpty()) return;

    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    let halfSize, centerCoord;
    if (this.axis === 'x') { halfSize = size.x / 2; centerCoord = center.x; }
    if (this.axis === 'y') { halfSize = size.y / 2; centerCoord = center.y; }
    if (this.axis === 'z') { halfSize = size.z / 2; centerCoord = center.z; }

    // For normal=(1,0,0) clipping is "discard where x + constant < 0".
    // depth=0  → constant such that NOTHING is clipped (plane outside −extent)
    // depth=1  → constant such that EVERYTHING is clipped (plane outside +extent)
    // Linear: constant = halfSize*(1 − 2t) − centerCoord
    this.activePlane.constant = halfSize * (1 - 2 * this.depth) - centerCoord;

    this.planes.length = 0;
    this.planes.push(this.activePlane);
  }

  onAxisChange(fn) { this.axisListeners.add(fn); return () => this.axisListeners.delete(fn); }
}

// ── UI ───────────────────────────────────────────────────────────────────
export function buildClippingPanel(container, controller) {
  function renderShell() {
    container.innerHTML = `
      <header class="clip-panel-header draggable-handle">
        <h2>剖面切片</h2>
        <button class="clip-collapse" aria-label="收合剖面面板">▾</button>
      </header>
      <div class="clip-body">
        <div class="clip-axes" role="radiogroup" aria-label="剖面方向">
          ${AXES.map(a => `
            <button data-axis="${a}" class="${controller.axis === a ? 'active' : ''}" type="button">
              ${AXIS_LABEL[a]}
            </button>
          `).join('')}
        </div>
        <label class="clip-slider ${controller.axis === 'off' ? 'disabled' : ''}">
          <span class="clip-slider-label">切開深度</span>
          <input type="range" min="0" max="100" value="${Math.round(controller.depth * 100)}"
                 ${controller.axis === 'off' ? 'disabled' : ''} />
          <span class="clip-value">${Math.round(controller.depth * 100)}%</span>
        </label>
        <p class="clip-hint">
          ${controller.axis === 'off'
              ? '選擇一個剖面方向開始切片'
              : '標記與通路覆蓋不受剖面影響'}
        </p>
      </div>
    `;
  }

  container.addEventListener('click', (e) => {
    const axisBtn = e.target.closest('button[data-axis]');
    if (axisBtn) { controller.setAxis(axisBtn.dataset.axis); return; }
    const collapse = e.target.closest('.clip-collapse');
    if (collapse) {
      container.classList.toggle('collapsed');
      collapse.textContent = container.classList.contains('collapsed') ? '▸' : '▾';
    }
  });

  // Slider input does NOT trigger full re-render (would lose drag focus).
  container.addEventListener('input', (e) => {
    if (e.target.matches('input[type="range"]')) {
      const pct = parseInt(e.target.value, 10);
      controller.setDepth(pct / 100);
      const valEl = container.querySelector('.clip-value');
      if (valEl) valEl.textContent = `${pct}%`;
    }
  });

  controller.onAxisChange(renderShell);
  renderShell();
}
