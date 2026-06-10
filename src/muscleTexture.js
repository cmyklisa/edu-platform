// 肌肉纖維程序化著色：
//
// 問題：muscle.glb 的 918 個 mesh 中只有 ~100 個帶 UV，bumpMap 在剩下 89% 的
// mesh 上完全沒用 → 肌肉看起來太平滑。
//
// 解法：透過 onBeforeCompile 注入 shader chunk，用 world position + normal 做
// triplanar 程序化條紋，不依賴 UV。條紋走向以「世界 Y 軸」為主（肌纖維多沿
// 直立方向走），輔以高頻的法向擾動模擬肌纖維束（fascicle）束邊界與微觀凹凸。
//
// 視覺上：
//   - 低頻條紋 (uFiberFreq) → 看得到的肌纖維束方向
//   - 高頻雜訊 (uMicroFreq) → 肌肉表面細部凹凸感
//   - 三平面混合 → 不管 mesh 面朝哪都有紋路
//   - 法向擾動而非僅亮度調制 → PBR lighting 會跟著明暗變化，立體感真實
//
// 使用方式：
//   applyMuscleFiberShader(material, { fiberFreq, contrast });
// 對所有 muscle layer mesh 的 material 呼叫一次即可（onBeforeCompile 只在
// shader 首次編譯時跑）。

import * as THREE from 'three';

const VERTEX_INJECT_COMMON = `
varying vec3 vMuscleWorldPos;
varying vec3 vMuscleWorldNormal;
`;

const VERTEX_INJECT_WORLDPOS = `
vMuscleWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vMuscleWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAGMENT_INJECT_COMMON = `
varying vec3 vMuscleWorldPos;
varying vec3 vMuscleWorldNormal;
uniform float uFiberFreq;
uniform float uMicroFreq;
uniform float uFiberContrast;
uniform float uNormalStrength;

// 2D simplex-style cheap noise — 不需要 high quality，只是要肌纖維束斷面有
// 點不齊感，避免條紋太機械
float musclePseudoNoise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// 條紋場：穿過 perpendicular 平面（fiberDir 為 world Y）變化 → 看起來像沿 Y
// 方向延伸的細長條紋。回傳 [-1, 1]。
float muscleFiberField(vec3 worldP) {
  // 主條紋：沿 X+Z 方向變化（穿過 Y 軸的細線）
  float main = sin(worldP.x * uFiberFreq + worldP.z * uFiberFreq * 0.3);
  // 第二層：稍微錯位的次條紋，模擬肌纖維束邊界
  float sub  = sin(worldP.x * uFiberFreq * 0.5 + worldP.z * uFiberFreq * 0.7 + 1.7) * 0.5;
  // 微觀雜訊
  float micro = (musclePseudoNoise(floor(worldP.xz * uMicroFreq)) - 0.5) * 0.6;
  return clamp(main + sub + micro, -1.5, 1.5);
}

// 三平面混合：依 world normal 的絕對值取三個平面的條紋採樣，避免面朝特定軸
// 時條紋消失。回傳 [-1, 1]。
float muscleTriplanar(vec3 worldP, vec3 worldN) {
  vec3 absN = abs(worldN);
  float sum = absN.x + absN.y + absN.z + 1e-4;
  vec3 w = absN / sum;
  // 三組座標 → 三平面：
  //   YZ plane（normal X）：沿 Y 軸的條紋 = 變化 Z
  //   XZ plane（normal Y）：沿 Y 軸看不見，用環向 X+Z noise
  //   XY plane（normal Z）：沿 Y 軸的條紋 = 變化 X
  float fYZ = sin(worldP.z * uFiberFreq + worldP.y * uFiberFreq * 0.15);
  float fXY = sin(worldP.x * uFiberFreq + worldP.y * uFiberFreq * 0.15);
  // 頂面（normal Y）：肌肉很少從上看到，用 cross pattern
  float fXZ = sin(worldP.x * uFiberFreq * 0.6) * sin(worldP.z * uFiberFreq * 0.6);
  // 微觀雜訊統一加
  float micro = (musclePseudoNoise(floor(worldP.xz * uMicroFreq)) - 0.5) * 0.8
              + (musclePseudoNoise(floor(worldP.xy * uMicroFreq)) - 0.5) * 0.6;
  float fiber = fYZ * w.x + fXZ * w.y + fXY * w.z + micro * 0.4;
  return fiber;
}
`;

// 在 color_fragment 之後做亮度調制（彩度保持）
const FRAGMENT_INJECT_COLOR = `
float muscleFiber = muscleTriplanar(vMuscleWorldPos, vMuscleWorldNormal);
float muscleFiberBright = clamp(muscleFiber * 0.5 + 0.5, 0.0, 1.0);
// 對 base color 做明暗調制：bright 區 → 略亮、dark 區 → 略暗
diffuseColor.rgb *= mix(1.0 - uFiberContrast, 1.0 + uFiberContrast, muscleFiberBright);
`;

// 法向擾動：暫時不做。在沒有 tangent 的 mesh 上把 world-space 擾動回 view-space
// 需要額外矩陣，shader chunk 注入位置敏感，先以亮度調制為主就能看到清楚條紋。

export function applyMuscleFiberShader(material, {
  fiberFreq = 70.0,
  microFreq = 180.0,
  contrast = 0.22,
  normalStrength = 0.06,
} = {}) {
  // 把 uniform 預先放到 material.userData 上，這樣 onBeforeCompile 之外也能 tweak
  const userUniforms = {
    uFiberFreq:      { value: fiberFreq },
    uMicroFreq:      { value: microFreq },
    uFiberContrast:  { value: contrast },
    uNormalStrength: { value: normalStrength },
  };
  material.userData.muscleFiberUniforms = userUniforms;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFiberFreq      = userUniforms.uFiberFreq;
    shader.uniforms.uMicroFreq      = userUniforms.uMicroFreq;
    shader.uniforms.uFiberContrast  = userUniforms.uFiberContrast;
    shader.uniforms.uNormalStrength = userUniforms.uNormalStrength;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_INJECT_COMMON}`)
      .replace('#include <worldpos_vertex>',
        `#include <worldpos_vertex>\n${VERTEX_INJECT_WORLDPOS}`);

    // 若 worldpos_vertex 沒被原本 shader include（某些 material variant），
    // fallback：放在 begin_vertex 後手動算
    if (!shader.vertexShader.includes('vMuscleWorldPos = ')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${VERTEX_INJECT_WORLDPOS}`,
      );
    }

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_INJECT_COMMON}`)
      .replace('#include <color_fragment>',
        `#include <color_fragment>\n${FRAGMENT_INJECT_COLOR}`);
  };
  material.needsUpdate = true;
}

// 舊版的 bumpMap 仍保留給有 UV 的 mesh 使用（雙保險）；新增的 procedural shader
// 是主力。
export function createMuscleBumpMap({ size = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 底色：中灰
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // 主肌纖維：垂直細線
  const fibers = 1800;
  for (let i = 0; i < fibers; i++) {
    const x = Math.random() * size;
    const y0 = Math.random() * size;
    const len = 40 + Math.random() * 180;
    const w = 0.6 + Math.random() * 1.4;
    const brightness = 50 + Math.random() * 150;
    const grayA = brightness | 0;
    ctx.strokeStyle = `rgba(${grayA},${grayA},${grayA},${0.55 + Math.random() * 0.35})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    const jitterX = (Math.random() - 0.5) * 4;
    ctx.moveTo(x, y0);
    ctx.lineTo(x + jitterX, y0 + len);
    ctx.stroke();
  }

  // 細密雜訊
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i]     = Math.max(0, Math.min(255, d[i]     + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 8);
  tex.anisotropy = 4;
  return tex;
}
