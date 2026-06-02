// 通路面板（按鈕） + 通路說明面板（描述）。
// 拆成兩個獨立面板，都可拖曳/收合。

import { pathwaysList } from './pathways.js';

export function buildPathwayPanel(container, descContainer, player) {
  function renderButtons() {
    const activeId = player.active?.id ?? null;
    container.innerHTML = `
      <header class="pathway-panel-header draggable-handle">
        <h2>功能通路</h2>
        <button class="pathway-collapse" aria-label="收合通路面板">▾</button>
      </header>
      <ul class="pathway-list">
        ${pathwaysList.map(p => `
          <li>
            <button class="pathway-btn ${activeId === p.id ? 'active' : ''}"
                    data-pathway="${p.id}"
                    type="button">
              <span class="pathway-icon">${activeId === p.id ? '■' : '▶'}</span>
              <span class="pathway-name">${p.name}</span>
            </button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function renderDesc() {
    const p = player.active;
    if (!p) {
      descContainer.classList.remove('visible');
      descContainer.setAttribute('hidden', '');
      return;
    }
    descContainer.innerHTML = `
      <header class="pathway-desc-header draggable-handle">
        <div class="pathway-desc-titles">
          <h2>通路說明 · ${p.name}</h2>
        </div>
        <button class="pathway-desc-collapse" aria-label="收合說明">▾</button>
      </header>
      <div class="pathway-desc-body">
        <p class="pathway-desc">${p.description}</p>
        <p class="pathway-desc-nodes">
          ${p.nodes.map(id => `<code>${id}</code>`).join(' → ')}
        </p>
      </div>
    `;
    descContainer.classList.add('visible');
    descContainer.removeAttribute('hidden');
  }

  // ── Pathway-button panel events ──
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pathway]');
    if (btn) {
      const id = btn.dataset.pathway;
      if (player.active?.id === id) player.stop();
      else {
        const p = pathwaysList.find(x => x.id === id);
        if (p) player.play(p);
      }
      return;
    }
    const collapse = e.target.closest('.pathway-collapse');
    if (collapse) {
      container.classList.toggle('collapsed');
      collapse.textContent = container.classList.contains('collapsed') ? '▸' : '▾';
    }
  });

  // ── Description panel events (collapse) ──
  descContainer.addEventListener('click', (e) => {
    const collapse = e.target.closest('.pathway-desc-collapse');
    if (collapse) {
      descContainer.classList.toggle('collapsed');
      collapse.textContent = descContainer.classList.contains('collapsed') ? '▸' : '▾';
    }
  });

  player.onChange = () => {
    renderButtons();
    renderDesc();
  };
  renderButtons();
  renderDesc();
}
