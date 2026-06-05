// 整合面板：分層 / 通路 / 剖面 三個 tab 共用一個外殼。
// 通路說明面板（pathway-desc）仍獨立浮動（內容會隨通路播放動態變化）。
// 爆炸視圖也獨立（用得少，且 slider drag 不適合在 tab 切換情境）。

import { buildLayerPanel } from './layers.js';
import { buildPathwayPanel } from './pathwayPanel.js';
import { buildClippingPanel } from './clipping.js';
import { buildViewPanel } from './viewPanel.js';

const TABS = [
  { id: 'layer',   label: '分層剝離' },
  { id: 'view',    label: '視圖控制' },
  { id: 'pathway', label: '功能通路' },
  { id: 'clip',    label: '剖面切片' },
];

export function buildToolsPanel(container, {
  layerManager, pathwayPlayer, pathwayDescContainer, clipping,
  explodeCtrl, modelScaler,
}) {
  let active = 'layer';

  function renderShell() {
    container.innerHTML = `
      <header class="tools-panel-header draggable-handle">
        <div class="tools-tabs" role="tablist">
          ${TABS.map(t => `
            <button class="tools-tab ${t.id === active ? 'active' : ''}"
                    data-tab="${t.id}"
                    role="tab"
                    aria-selected="${t.id === active}"
                    type="button">${t.label}</button>
          `).join('')}
        </div>
        <button class="tools-collapse" aria-label="收合面板" type="button">▾</button>
      </header>
      <div class="tools-body">
        ${TABS.map(t => `
          <section class="tools-pane ${t.id === active ? 'active' : ''}"
                   data-tabpane="${t.id}"
                   role="tabpanel"></section>
        `).join('')}
      </div>
    `;

    // Mount each pane's contents
    buildLayerPanel(
      container.querySelector('[data-tabpane="layer"]'),
      layerManager,
    );
    buildPathwayPanel(
      container.querySelector('[data-tabpane="pathway"]'),
      pathwayDescContainer,
      pathwayPlayer,
    );
    buildClippingPanel(
      container.querySelector('[data-tabpane="clip"]'),
      clipping,
    );
    buildViewPanel(
      container.querySelector('[data-tabpane="view"]'),
      { explodeCtrl, modelScaler },
    );
  }

  function setActive(tabId) {
    if (active === tabId) return;
    active = tabId;
    for (const btn of container.querySelectorAll('.tools-tab')) {
      const on = btn.dataset.tab === tabId;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on);
    }
    for (const pane of container.querySelectorAll('.tools-pane')) {
      pane.classList.toggle('active', pane.dataset.tabpane === tabId);
    }
  }

  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.tools-tab');
    if (tab) { setActive(tab.dataset.tab); return; }
    const collapse = e.target.closest('.tools-collapse');
    if (collapse) {
      container.classList.toggle('collapsed');
      collapse.textContent = container.classList.contains('collapsed') ? '▸' : '▾';
    }
  });

  renderShell();

  // 手機版預設收合，避免一打開就吃掉模型視野
  if (window.matchMedia('(max-width: 640px)').matches) {
    container.classList.add('collapsed');
    const cb = container.querySelector('.tools-collapse');
    if (cb) cb.textContent = '▸';
  }
}
