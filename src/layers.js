// 分層管理：5 個解剖系統的顯示/淡出/隱藏狀態。
// 設計成資料驅動，之後真實 Z-Anatomy 匯入後只要把 meshes 註冊到對應 layerId 即可。

import * as THREE from 'three';

export const LAYERS = [
  { id: 'skin',        label: '皮膚',     color: '#f3c6a8', defaultState: 'fade'    },
  { id: 'muscle',      label: '肌肉',     color: '#b94a3e', defaultState: 'hidden'  },
  { id: 'bone',        label: '骨骼',     color: '#ece1c6', defaultState: 'hidden'  },
  { id: 'vessel',      label: '血管',     color: '#d23a3a', defaultState: 'hidden'  },
  { id: 'nerve',       label: '神經系統', color: '#f0d870', defaultState: 'visible' },
  { id: 'sympathetic', label: '交感神經', color: '#66ddff', defaultState: 'hidden'  },
];

export const STATES = ['visible', 'fade', 'hidden'];
export const STATE_LABEL = { visible: '顯示', fade: '淡出', hidden: '隱藏' };

const FADE_OPACITY = 0.18;
const ISOLATE_DIM = 0.30;   // 選取時，其他非 marker 物件的相對透明度倍率

export class LayerManager {
  constructor() {
    this.layers = new Map();
    this.listeners = new Set();
    this.selectedStructureId = null;
    this.highlightSet = new Set(); // pathway 高亮節點集合
    for (const def of LAYERS) {
      const group = new THREE.Group();
      group.name = `layer:${def.id}`;
      this.layers.set(def.id, { ...def, state: def.defaultState, group });
    }
  }

  setSelection(structureId) {
    this.selectedStructureId = structureId ?? null;
    for (const id of this.layers.keys()) this._applyState(id);
    this._notify();
  }

  setHighlightSet(idSet) {
    this.highlightSet = idSet ?? new Set();
    for (const id of this.layers.keys()) this._applyState(id);
    this._notify();
  }

  getAll() { return Array.from(this.layers.values()); }
  get(id)  { return this.layers.get(id); }
  getGroup(id) { return this.layers.get(id).group; }

  addAllTo(parent) {
    for (const layer of this.layers.values()) parent.add(layer.group);
  }

  registerMesh(layerId, object) {
    this.layers.get(layerId).group.add(object);
    object.traverse(child => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat.userData._origCaptured) {
          mat.userData._origCaptured  = true;
          mat.userData._origOpacity   = mat.opacity;
          mat.userData._origTransparent = mat.transparent;
          mat.userData._origDepthWrite  = mat.depthWrite;
        }
      }
    });
    this._applyState(layerId);
  }

  setState(id, state) {
    if (!STATES.includes(state)) return;
    this.layers.get(id).state = state;
    this._applyState(id);
    this._notify();
  }

  setAll(state) {
    if (!STATES.includes(state)) return;
    for (const id of this.layers.keys()) {
      this.layers.get(id).state = state;
      this._applyState(id);
    }
    this._notify();
  }

  _applyState(id) {
    const layer = this.layers.get(id);
    const { state, group } = layer;
    group.visible = state !== 'hidden';

    const sel = this.selectedStructureId;
    const hl = this.highlightSet;
    const anyFocus = !!sel || hl.size > 0;

    group.traverse(child => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const isMarker = !!child.userData.isMarker;
      // 一個 mesh 可能 belongs-to 多個 structure（cortex orbital 同時是 prefrontal + frontal-lobe）
      const sids = child.userData.structureIds; // Set or undefined
      const isSelected    = !!(sel && sids && sids.has(sel));
      const isHighlighted = !!(sids && [...hl].some(id => sids.has(id)));
      const isFocused     = isSelected || isHighlighted;

      for (const mat of mats) {
        const origOpacity     = mat.userData._origOpacity ?? 1;
        const origTransparent = mat.userData._origTransparent ?? false;
        const origDepthWrite  = mat.userData._origDepthWrite ?? true;

        let opacity = origOpacity;
        let transparent = origTransparent;
        let depthWrite = origDepthWrite;

        if (!isMarker && state === 'fade') {
          opacity = FADE_OPACITY;
          transparent = true;
          depthWrite = false;
        }
        if (anyFocus && !isFocused) {
          opacity *= ISOLATE_DIM;
          transparent = true;
          depthWrite = false;
        }

        // ── focus 狀態（被選中 or 通路高亮）下，brain mesh 加溫黃 emissive 讓對應區域「發光」
        // 神經脈衝動畫的 mesh 跳過：emissive 完全交給 NervePulseController
        if (mat.emissive && !child.userData.isNerveAnimated) {
          if (mat.userData._origEmissive === undefined) {
            mat.userData._origEmissive = mat.emissive.getHex();
          }
          if (!isMarker && (isSelected || isHighlighted)) {
            mat.emissive.setHex(isSelected ? 0x665020 : 0x4a3814);
          } else {
            mat.emissive.setHex(mat.userData._origEmissive);
          }
        }

        mat.opacity = opacity;
        mat.transparent = transparent;
        mat.depthWrite = depthWrite;
      }
    });
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _notify() { for (const fn of this.listeners) fn(); }
}

// ── UI builder（body-only：外層 tabbed panel 提供 header / drag handle / collapse）
export function buildLayerPanel(container, manager) {
  container.innerHTML = `
    <ul class="layer-list">
      ${LAYERS.map(l => `
        <li data-layer="${l.id}">
          <span class="layer-dot" style="background:${l.color}"></span>
          <span class="layer-label">${l.label}</span>
          <div class="layer-states" role="radiogroup" aria-label="${l.label} 狀態">
            ${STATES.map(s => `<button data-state="${s}" role="radio" aria-checked="false">${STATE_LABEL[s]}</button>`).join('')}
          </div>
        </li>
      `).join('')}
    </ul>
    <div class="layer-bulk">
      <button data-bulk="visible">全部顯示</button>
      <button data-bulk="fade">全部淡出</button>
      <button data-bulk="hidden">全部隱藏</button>
    </div>
  `;

  function refresh() {
    for (const l of manager.getAll()) {
      const row = container.querySelector(`li[data-layer="${l.id}"]`);
      if (!row) continue;
      for (const btn of row.querySelectorAll('button[data-state]')) {
        const active = btn.dataset.state === l.state;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active);
      }
    }
  }

  container.addEventListener('click', (e) => {
    const stateBtn = e.target.closest('button[data-state]');
    if (stateBtn) {
      const layerId = stateBtn.closest('li').dataset.layer;
      manager.setState(layerId, stateBtn.dataset.state);
      return;
    }
    const bulkBtn = e.target.closest('button[data-bulk]');
    if (bulkBtn) { manager.setAll(bulkBtn.dataset.bulk); return; }
  });

  manager.onChange(refresh);
  refresh();
}
