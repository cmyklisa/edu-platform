// View tab：把「模型整體縮放」+「爆炸視圖」兩個 slider 合在一起。
// 縮放：直接 setScalar 在 modelRoot.scale 上，slider 範圍 50%~150%。
// 爆炸：呼叫 ExplodeController.setAmount。

export function buildViewPanel(container, {
  explodeCtrl,
  modelScaler,
}) {
  function render() {
    const ePct = Math.round((explodeCtrl?.amount ?? 0) * 100);
    const sPct = Math.round(modelScaler.getScalePercent());
    container.innerHTML = `
      <div class="view-section">
        <label class="view-slider">
          <span class="view-slider-label">模型大小</span>
          <input type="range" data-slider="scale"
                 min="${modelScaler.minPercent}" max="${modelScaler.maxPercent}" step="5"
                 value="${sPct}" />
          <span class="view-value" data-value="scale">${sPct}%</span>
        </label>
        <div class="view-row">
          <button class="view-reset" data-reset="scale" type="button">縮放歸位</button>
          <span class="view-hint-inline">調整人體模型在螢幕上的大小</span>
        </div>
      </div>

      <div class="view-section">
        <label class="view-slider">
          <span class="view-slider-label">爆炸分離</span>
          <input type="range" data-slider="explode"
                 min="0" max="100" step="1" value="${ePct}" />
          <span class="view-value" data-value="explode">${ePct}%</span>
        </label>
        <div class="view-row">
          <button class="view-reset" data-reset="explode" type="button">分離歸零</button>
          <span class="view-hint-inline">把各腦區沿中心向外推開</span>
        </div>
      </div>
    `;
  }

  container.addEventListener('input', (e) => {
    const sl = e.target.closest('input[type="range"]');
    if (!sl) return;
    const pct = parseInt(sl.value, 10);
    if (sl.dataset.slider === 'scale') {
      modelScaler.setScalePercent(pct);
    } else if (sl.dataset.slider === 'explode' && explodeCtrl) {
      explodeCtrl.setAmount(pct / 100);
    }
    const valEl = container.querySelector(`[data-value="${sl.dataset.slider}"]`);
    if (valEl) valEl.textContent = `${pct}%`;
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-reset]');
    if (!btn) return;
    if (btn.dataset.reset === 'scale') {
      modelScaler.setScalePercent(100);
    } else if (btn.dataset.reset === 'explode' && explodeCtrl) {
      explodeCtrl.setAmount(0);
    }
    // refresh slider + value
    const sliderKey = btn.dataset.reset;
    const input = container.querySelector(`input[data-slider="${sliderKey}"]`);
    const val = container.querySelector(`[data-value="${sliderKey}"]`);
    const pct = sliderKey === 'scale'
      ? modelScaler.getScalePercent()
      : Math.round((explodeCtrl?.amount ?? 0) * 100);
    if (input) input.value = pct;
    if (val) val.textContent = `${pct}%`;
  });

  render();
}
