// 情境模式 UI：側邊時間軸 + 暫停/播放 + 波次說明。
// 沒啟動情境時面板隱藏；啟動後右下角浮出來、可拖曳。

import { scenariosList } from './scenarios.js';

export function buildScenarioPanel(container, scenarioPlayer) {
  function render() {
    if (!scenarioPlayer.isActive()) {
      container.classList.remove('visible');
      container.setAttribute('hidden', '');
      return;
    }
    const sc = scenarioPlayer.scenario;
    const prog = scenarioPlayer.getProgress();
    if (!prog) return;
    const { waveIndex, paused, wave } = prog;

    const waveItems = sc.waves.map((w, i) => {
      const active = i === waveIndex;
      const done   = i < waveIndex;
      const cls = active ? 'active' : (done ? 'done' : '');
      const hex = `#${w.color.toString(16).padStart(6, '0')}`;
      return `
        <li class="scenario-wave ${cls}" data-wave="${i}">
          <span class="scenario-wave-dot" style="background:${hex}"></span>
          <span class="scenario-wave-title">${w.title}</span>
          <span class="scenario-wave-sub">${w.subtitle}</span>
        </li>
      `;
    }).join('');

    container.innerHTML = `
      <header class="scenario-header draggable-handle">
        <div class="scenario-titles">
          <h2>${sc.name}</h2>
          <span class="scenario-sub">${wave.title} · ${wave.subtitle}</span>
        </div>
        <div class="scenario-actions">
          <button class="scenario-toggle" type="button" title="${paused ? '繼續' : '暫停'}">
            ${paused ? '▶' : '❚❚'}
          </button>
          <button class="scenario-stop" type="button" title="結束情境">✕</button>
        </div>
      </header>
      <div class="scenario-body">
        <ul class="scenario-waves" role="list">${waveItems}</ul>
        <div class="scenario-progress">
          <div class="scenario-progress-bar" style="width:${(prog.waveT * 100).toFixed(1)}%"></div>
        </div>
        <p class="scenario-desc">${wave.description}</p>
      </div>
    `;
    container.classList.add('visible');
    container.removeAttribute('hidden');
  }

  container.addEventListener('click', (e) => {
    if (e.target.closest('.scenario-toggle')) {
      scenarioPlayer.togglePause();
      return;
    }
    if (e.target.closest('.scenario-stop')) {
      scenarioPlayer.stop();
      return;
    }
    const wave = e.target.closest('.scenario-wave');
    if (wave) {
      const idx = parseInt(wave.dataset.wave, 10);
      scenarioPlayer.seekTo(idx);
      return;
    }
  });

  scenarioPlayer.onChange(render);
  render();
}

// Topbar 內的啟動按鈕（一次只演一個情境，目前唯一情境是 danger-response）
export function buildScenarioToggle(container, scenarioPlayer) {
  const scenario = scenariosList[0];

  function render() {
    const active = scenarioPlayer.isActive();
    container.innerHTML = `
      <button class="scenario-launch-btn ${active ? 'active' : ''}" type="button">
        ${active ? '✕ 結束情境' : '🌀 啟動情境模式'}
      </button>
    `;
    container.querySelector('.scenario-launch-btn').addEventListener('click', () => {
      if (scenarioPlayer.isActive()) scenarioPlayer.stop();
      else scenarioPlayer.play(scenario);
    });
  }

  scenarioPlayer.onChange(render);
  render();
}
