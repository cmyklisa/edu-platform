// 將面板做成可拖曳：以 event delegation 方式運作，
// 這樣面板內容（含 header）即使被 innerHTML 重畫，拖曳依然有效。
// 拖曳把手以 .draggable-handle CSS class 標記；點按鈕不算拖曳起點。

export function makeDraggable(panel, { handleSelector = '.draggable-handle' } = {}) {
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const handle = e.target.closest(handleSelector);
    if (!handle || !panel.contains(handle)) return;
    if (e.target.closest('button, input, textarea, a')) return;  // 按鈕等不算拖曳
    dragging = true;
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop  = rect.top;
    // 鎖死用 left/top 定位，去掉 right/bottom
    panel.style.left   = `${startLeft}px`;
    panel.style.top    = `${startTop}px`;
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    panel.classList.add('is-dragging');
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = panel.offsetWidth;
    const left = Math.max(2, Math.min(window.innerWidth  - Math.min(80, w), startLeft + dx));
    const top  = Math.max(2, Math.min(window.innerHeight - 40, startTop  + dy));
    panel.style.left = `${left}px`;
    panel.style.top  = `${top}px`;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
  };

  // pointerdown delegated through the panel (handles innerHTML re-renders).
  panel.addEventListener('pointerdown', onDown);
  // move/up on document so we don't lose events when pointer leaves the panel.
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup',   onUp);
  document.addEventListener('pointercancel', onUp);

  return () => {
    panel.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup',   onUp);
    document.removeEventListener('pointercancel', onUp);
  };
}
