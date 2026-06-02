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
    const isPlaceholder = !s.meshName; // 無真實 mesh → 標記為示意位置
    container.innerHTML = `
      <header class="info-panel-header">
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
