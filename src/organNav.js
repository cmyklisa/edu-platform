// 器官導航：點按鈕讓相機平滑移動到對應器官，不切場景。
// 所有器官共存於同一個 Three.js scene。

import * as THREE from 'three';

const DEFAULT_DURATION = 0.7;   // 秒

export class OrganNavigator {
  constructor({ camera, controls, defaultPos, defaultTarget }) {
    this.camera = camera;
    this.controls = controls;
    // 直接保留 reference（不 clone）—— 這樣即使 fitCameraToObject 在之後才跑、
    // 更新了 defaultCameraPos / defaultTarget，nav reset 仍會用到新值。
    this.defaultPos = defaultPos;
    this.defaultTarget = defaultTarget;
    this.tween = null;
    this.activeOrganId = null;
  }

  focusOn({ center, distance, onArrive }) {
    // 沿目前 camera→target 方向，把 camera 推到距離 center 為 distance 的位置
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.25, 1);
    dir.normalize();
    const newPos = center.clone().add(dir.multiplyScalar(distance));
    this._startTween(newPos, center, onArrive);
  }

  reset() {
    this.activeOrganId = null;
    this._startTween(this.defaultPos.clone(), this.defaultTarget.clone());
  }

  _startTween(endPos, endTarget, onArrive) {
    this.tween = {
      startPos: this.camera.position.clone(),
      endPos,
      startTarget: this.controls.target.clone(),
      endTarget,
      t: 0,
      duration: DEFAULT_DURATION,
      onArrive: onArrive ?? null,
    };
  }

  update(dt) {
    if (!this.tween) return;
    this.tween.t += dt / this.tween.duration;
    const done = this.tween.t >= 1;
    const t = done ? 1 : this.tween.t;
    const ease = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);  // smoothstep
    this.camera.position.lerpVectors(this.tween.startPos, this.tween.endPos, ease);
    this.controls.target.lerpVectors(this.tween.startTarget, this.tween.endTarget, ease);
    this.controls.update();
    if (done) {
      this.tween.onArrive?.();
      this.tween = null;
    }
  }
}

// ── UI ───────────────────────────────────────────────────────────────────
export function buildOrganNavBar(container, navigator, organs, opts = {}) {
  const getFitTarget = opts.getFitTarget;   // optional：點全景時用「目前可見內容」算框景目標
  container.innerHTML = `
    <header class="organ-nav-header draggable-handle">
      <h2>器官導航</h2>
    </header>
    <div class="organ-nav-body">
      ${organs.map(o => `
        <button class="organ-nav-btn" data-organ="${o.id}" type="button"
                title="${o.label}">${o.label}</button>
      `).join('')}
      <button class="organ-nav-btn organ-nav-reset" data-organ="__reset" type="button"
              title="回到全景">全景</button>
    </div>
  `;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-organ]');
    if (!btn) return;
    if (btn.dataset.organ === '__reset') {
      // 清掉所有 nav 強制顯示的器官
      for (const o of organs) o.onLeave?.();
      // 全景：依目前可見圖層重新計算 bbox 來框景；找不到 fallback 用 default
      const fit = getFitTarget?.();
      if (fit) {
        navigator.focusOn(fit);
      } else {
        navigator.reset();
      }
      navigator.activeOrganId = null;
      // visual active state
      for (const b of container.querySelectorAll('.organ-nav-btn')) b.classList.remove('active');
      return;
    }
    const organ = organs.find(o => o.id === btn.dataset.organ);
    if (!organ) return;
    organ.onFocus?.();
    const target = organ.getTarget();
    if (target) {
      navigator.activeOrganId = organ.id;
      navigator.focusOn(target);
    }
    for (const b of container.querySelectorAll('.organ-nav-btn')) {
      b.classList.toggle('active', b === btn);
    }
  });
}
