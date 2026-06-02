// 爆炸視圖：把腦各區依其重心方向向外平移。
// slider 0 = 原位，1 = 最大爆炸距離。標記不參與爆炸（保留原位作為錨點）。

import * as THREE from 'three';

const MAX_OFFSET_WORLD = 0.55;   // 全爆炸時各區外推距離（世界座標單位）

export class ExplodeController {
  constructor({ root, brainCenter }) {
    this.root = root;
    this.brainCenter = brainCenter?.clone() ?? new THREE.Vector3();
    this.amount = 0;
    this.regions = null;
    this.listeners = new Set();
  }

  build() {
    // 先更新 world matrix 才能取得正確 bbox
    this.root.updateMatrixWorld(true);

    // 依 userData.region 分組 brain mesh
    const groups = {};
    this.root.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.isMarker || o.userData.isOverlay) return;
      const region = o.userData.region;
      if (!region) return;
      if (!groups[region]) groups[region] = [];
      groups[region].push(o);
    });

    const tmpBox = new THREE.Box3();
    const meshBox = new THREE.Box3();
    this.regions = {};
    for (const [region, meshes] of Object.entries(groups)) {
      tmpBox.makeEmpty();
      for (const m of meshes) {
        meshBox.setFromObject(m);
        tmpBox.union(meshBox);
      }
      const centroid = tmpBox.getCenter(new THREE.Vector3());
      const dir = centroid.clone().sub(this.brainCenter);
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);   // safety
      dir.normalize().multiplyScalar(MAX_OFFSET_WORLD);

      const meshInfo = meshes.map(m => {
        const wpos = new THREE.Vector3();
        m.getWorldPosition(wpos);
        return { mesh: m, origWorld: wpos };
      });

      this.regions[region] = { meshInfo, worldOffset: dir };
    }
  }

  setAmount(t) {
    if (!this.regions) return;
    this.amount = Math.max(0, Math.min(1, t));
    const tmp = new THREE.Vector3();
    for (const region of Object.values(this.regions)) {
      for (const { mesh, origWorld } of region.meshInfo) {
        tmp.copy(origWorld).addScaledVector(region.worldOffset, this.amount);
        // 轉成 parent space
        if (mesh.parent) mesh.parent.worldToLocal(tmp);
        mesh.position.copy(tmp);
      }
    }
    for (const fn of this.listeners) fn();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

// ── UI（附在現有 clip-panel 下方的小區塊）─────────────────────────────────
export function buildExplodePanel(container, controller) {
  function render() {
    container.innerHTML = `
      <header class="explode-panel-header draggable-handle">
        <h2>爆炸視圖</h2>
        <button class="explode-collapse" aria-label="收合爆炸面板">▾</button>
      </header>
      <div class="explode-body">
        <label class="explode-slider">
          <span class="explode-slider-label">分離度</span>
          <input type="range" min="0" max="100" value="${Math.round(controller.amount * 100)}" />
          <span class="explode-value">${Math.round(controller.amount * 100)}%</span>
        </label>
        <button class="explode-reset" type="button">歸零</button>
        <p class="explode-hint">把各腦區沿中心向外分開，看每塊的立體形狀與相對位置。</p>
      </div>
    `;
  }

  container.addEventListener('input', (e) => {
    if (e.target.matches('input[type="range"]')) {
      const pct = parseInt(e.target.value, 10);
      controller.setAmount(pct / 100);
      const valEl = container.querySelector('.explode-value');
      if (valEl) valEl.textContent = `${pct}%`;
    }
  });

  container.addEventListener('click', (e) => {
    if (e.target.closest('.explode-reset')) {
      controller.setAmount(0);
      const input = container.querySelector('input[type="range"]');
      const val = container.querySelector('.explode-value');
      if (input) input.value = '0';
      if (val) val.textContent = '0%';
      return;
    }
    const collapse = e.target.closest('.explode-collapse');
    if (collapse) {
      container.classList.toggle('collapsed');
      collapse.textContent = container.classList.contains('collapsed') ? '▸' : '▾';
    }
  });

  render();
}
