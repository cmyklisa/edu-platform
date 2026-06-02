// 程序化皮膚紋路（CanvasTexture）：底色 + 多頻 RGB 雜訊 + 散佈毛孔點。
// 取代之前的純色皮膚，讓表面有真實質感。

import * as THREE from 'three';

export function createSkinTexture({ size = 512, baseColor = '#e8b59a' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 底色
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // 細粒度 RGB 雜訊（每像素）
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 28;
    d[i  ] = clamp(d[i]   + n);
    d[i+1] = clamp(d[i+1] + n * 0.75);
    d[i+2] = clamp(d[i+2] + n * 0.55);
  }
  ctx.putImageData(img, 0, 0);

  // 較大色斑（低頻變化，仿膚色不均、紅潤區）
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const h = 0.04 + Math.random() * 0.04;   // hue shift slight
    g.addColorStop(0, `hsla(${20 + Math.random()*20}, 50%, 55%, ${0.06 + Math.random() * 0.06})`);
    g.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // 散佈毛孔（深色小點）
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = 0.10 + Math.random() * 0.18;
    ctx.fillStyle = `rgba(60, 35, 25, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);   // 每個 mesh patch 都有足夠變化
  tex.anisotropy = 8;
  return tex;
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// 從 skin layer 內的「眶區」mesh 找出左右眼眶世界中心（給眼球定位用）。
export function findOrbitalCenters(skinGroup) {
  const lefts = [];
  const rights = [];
  const tmpBox = new THREE.Box3();
  skinGroup.updateMatrixWorld(true);
  skinGroup.traverse(o => {
    if (!o.isMesh || !o.name) return;
    const n = o.name.toLowerCase();
    // 'orbital' 但排除 brain 的 'orbital_part_of_inferior_frontal_gyrus' 那種
    if (!n.includes('orbital')) return;
    if (n.includes('frontal') || n.includes('inferior_frontal')) return;
    tmpBox.setFromObject(o);
    const c = tmpBox.getCenter(new THREE.Vector3());
    if (c.x > 0) rights.push(c);
    else if (c.x < 0) lefts.push(c);
  });
  if (!lefts.length || !rights.length) return null;
  const avg = arr => arr
    .reduce((acc, v) => acc.add(v), new THREE.Vector3())
    .divideScalar(arr.length);
  return { left: avg(lefts), right: avg(rights) };
}
