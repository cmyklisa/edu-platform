// 資訊面板與 hover tooltip。

import { structureRegistry, SYSTEM_LABEL } from './structures.js';

export function buildInfoPanel(container, { onClose } = {}) {
  function render(id) {
    if (!id) {
      container.classList.remove('visible');
      return;
    }
    const s = structureRegistry.get(id);
    if (!s) {
      container.classList.remove('visible');
      return;
    }
    // 「示意位置」標籤：適用於無真實 mesh 的深部核（marker 是發光球）。
    // 肌肉系統有真實 GLB mesh（每個肌肉群 tag 自 muscleGroups.js），不該被標示意。
    const isPlaceholder = !s.meshName && s.system !== 'muscle';
    const diseases = Array.isArray(s.diseases_zh) ? s.diseases_zh : null;
    container.innerHTML = `
      <header class="info-panel-header draggable-handle">
        <div class="info-titles">
          <h2>${s.name_zh}</h2>
          <p class="latin">${s.name_la}</p>
        </div>
        <button class="info-close" aria-label="關閉" type="button">✕</button>
      </header>
      <div class="info-meta">
        <span class="system-tag system-${s.system}">${SYSTEM_LABEL[s.system] ?? s.system}</span>
        ${isPlaceholder ? '<span class="placeholder-tag">示意位置</span>' : ''}
      </div>
      <p class="info-function">${s.function_zh}</p>
      ${diseases ? `
        <div class="info-diseases">
          <h3>相關疾病</h3>
          <ul>${diseases.map(d => `<li>${d}</li>`).join('')}</ul>
        </div>
      ` : ''}
    `;
    container.classList.add('visible');
  }

  container.addEventListener('click', (e) => {
    if (e.target.closest('.info-close')) onClose?.();
  });

  return { render };
}

export function buildTooltip(tooltipEl) {
  function show(id, event) {
    if (!id || !event) { hide(); return; }
    const s = structureRegistry.get(id);
    if (!s) { hide(); return; }
    tooltipEl.textContent = s.name_zh;
    tooltipEl.style.left = `${event.clientX}px`;
    tooltipEl.style.top  = `${event.clientY}px`;
    tooltipEl.removeAttribute('hidden');
  }
  function hide() { tooltipEl.setAttribute('hidden', ''); }
  return { show, hide };
}
