// 程序化肌肉纖維 bump map：垂直走向的細線條 + 雜訊，模擬肌肉束紋路。
// 套到 MeshStandardMaterial.bumpMap，再以 bumpScale 控制凹凸強度。

import * as THREE from 'three';

export function createMuscleBumpMap({ size = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 底色：中灰（bumpMap：灰=持平、黑=凹、白=凸）
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // 主要肌纖維走向：垂直細線，數量多、有 jitter
  const fibers = 1400;
  for (let i = 0; i < fibers; i++) {
    const x = Math.random() * size;
    const y0 = Math.random() * size;
    const len = 30 + Math.random() * 140;
    const w = 0.5 + Math.random() * 1.3;
    const brightness = 90 + Math.random() * 90;
    const grayA = brightness | 0;
    ctx.strokeStyle = `rgba(${grayA},${grayA},${grayA},${0.45 + Math.random() * 0.35})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    const jitterX = (Math.random() - 0.5) * 6;
    ctx.moveTo(x, y0);
    ctx.lineTo(x + jitterX, y0 + len);
    ctx.stroke();
  }

  // 細密雜訊點：模擬肌纖維表面細節
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i]     = Math.max(0, Math.min(255, d[i]     + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  // 橫向結締組織：間隔較疏的橫紋（肌節分隔感）
  const bands = 30;
  for (let i = 0; i < bands; i++) {
    const y = (i / bands) * size + Math.random() * 8;
    const alpha = 0.10 + Math.random() * 0.10;
    ctx.strokeStyle = `rgba(60,60,60,${alpha})`;
    ctx.lineWidth = 0.7 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);   // 垂直密一點，水平稍鬆
  tex.anisotropy = 4;
  return tex;
}
