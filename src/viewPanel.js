// View tab：模型整體縮放 + 爆炸視圖 + 補光開關 + 亮度 slider。
// 縮放：直接 setScalar 在 modelRoot.scale 上。
// 爆炸：呼叫 ExplodeController.setAmount。
// 補光：左上方 DirectionalLight 開關 + 0~4 強度 slider。

export function buildViewPanel(container, {
  explodeCtrl,
  modelScaler,
  lightCtrl,
}) {
  function fmtPct(v) { return `${Math.round(v)}%`; }
  function fmtIntensity(v) { return v.toFixed(1); }

  function render() {
    const ePct = Math.round((explodeCtrl?.amount ?? 0) * 100);
    const sPct = Math.round(modelScaler.getScalePercent());
    const lightOn  = !!lightCtrl?.enabled;
    const intensity = lightCtrl?.getIntensity() ?? 0;
    const intensityPct = lightCtrl
      ? Math.round((intensity / lightCtrl.maxIntensity) * 100)
      : 0;

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

      ${lightCtrl ? `
      <div class="view-section">
        <div class="view-row" style="margin-bottom: 6px;">
          <button class="view-light-toggle ${lightOn ? 'active' : ''}" data-light-toggle type="button">
            ${lightOn ? '💡 補光開' : '💡 補光關'}
          </button>
          <span class="view-hint-inline">從左上方照亮模型細節</span>
        </div>
        <label class="view-slider ${lightOn ? '' : 'disabled'}">
          <span class="view-slider-label">亮度</span>
          <input type="range" data-slider="light"
                 min="0" max="100" step="5"
                 value="${intensityPct}" ${lightOn ? '' : 'disabled'} />
          <span class="view-value" data-value="light">${fmtIntensity(intensity)}</span>
        </label>
      </div>
      ` : ''}
    `;
  }

  container.addEventListener('input', (e) => {
    const sl = e.target.closest('input[type="range"]');
    if (!sl) return;
    const pct = parseInt(sl.value, 10);
    if (sl.dataset.slider === 'scale') {
      modelScaler.setScalePercent(pct);
      const valEl = container.querySelector('[data-value="scale"]');
      if (valEl) valEl.textContent = `${pct}%`;
    } else if (sl.dataset.slider === 'explode' && explodeCtrl) {
      explodeCtrl.setAmount(pct / 100);
      const valEl = container.querySelector('[data-value="explode"]');
      if (valEl) valEl.textContent = `${pct}%`;
    } else if (sl.dataset.slider === 'light' && lightCtrl) {
      const intensity = (pct / 100) * lightCtrl.maxIntensity;
      lightCtrl.setIntensity(intensity);
      const valEl = container.querySelector('[data-value="light"]');
      if (valEl) valEl.textContent = fmtIntensity(intensity);
    }
  });

  container.addEventListener('click', (e) => {
    const lightBtn = e.target.closest('[data-light-toggle]');
    if (lightBtn && lightCtrl) {
      lightCtrl.toggle();
      render();
      return;
    }
    const btn = e.target.closest('button[data-reset]');
    if (!btn) return;
    if (btn.dataset.reset === 'scale') {
      modelScaler.setScalePercent(100);
    } else if (btn.dataset.reset === 'explode' && explodeCtrl) {
      explodeCtrl.setAmount(0);
    }
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
