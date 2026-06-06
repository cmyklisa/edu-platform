import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(1500);

// Focus on brain
await page.evaluate(() => {
  document.querySelector('.organ-nav-btn[data-organ="brain"]')?.click();
});
await page.waitForTimeout(1200);

// Side view: rotate camera around y-axis
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  const target = controls.target;
  const rad = camera.position.distanceTo(target);
  camera.position.set(target.x + rad, target.y + 0.1, target.z);
  controls.update();
});
await page.waitForTimeout(300);

// Show skull semi-transparent + brain
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('skin',   'hidden');
  lm.setState('muscle', 'hidden');
  lm.setState('vessel', 'hidden');
  lm.setState('bone',   'fade');
  lm.setState('nerve',  'visible');
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-side-brain-skull.png' });

// More zoomed side view to clearly see brain inside skull
await page.evaluate(() => {
  const { camera, controls, modelRoot } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(2, 0, 0);
  controls.update();
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/align-side-zoom.png' });

// Front view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 2);
  controls.update();
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/align-front-zoom.png' });

// Hide markers + eyes + nerves; only brain (real) and skull
await page.evaluate(() => {
  const edu = window.__edu;
  // hide markers
  for (const m of edu.markerMap.values()) m.visible = false;
  // hide orientation eyes
  edu.scene.traverse(o => {
    if (o.name === 'orientation_eyes' || o.userData.isOrientationEye) o.visible = false;
  });
  // hide cranial nerves, sympathetic, etc in nerve layer; keep only the real brain
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (c.children && c.children.length > 5) {
      c.visible = true;  // brain root (real)
    } else {
      c.visible = false; // markers group / cn / spinal etc
    }
  });
  edu.layerManager.setState('bone', 'fade');
});
await page.waitForTimeout(400);

// Side view of brain inside skull
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(1.6, 0.1, 0);
  controls.update();
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/align-brain-only-side.png' });

await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 1.6);
  controls.update();
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/align-brain-only-front.png' });

// Also check brain wireframe outline
await page.evaluate(() => {
  const edu = window.__edu;
  let real = null;
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (!real && c.children && c.children.length > 5) real = c;
  });
  if (real) {
    console.log('brain.position', JSON.stringify(real.position.toArray()));
    console.log('brain.scale', JSON.stringify(real.scale.toArray()));
  }
});

// Top view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  const target = controls.target;
  const rad = camera.position.distanceTo(target);
  camera.position.set(target.x, target.y + rad, target.z + 0.001);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-top-brain-skull.png' });

// Print key positions: brain center, skull bbox center
const info = await page.evaluate(() => {
  const edu = window.__edu;
  let real = null;
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (!real && c.children && c.children.length > 5) real = c;
  });
  function meshBbox(group) {
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    group.updateMatrixWorld(true);
    group.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox?.();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const m = o.matrixWorld.elements;
      for (const cx of [bb.min.x, bb.max.x])
      for (const cy of [bb.min.y, bb.max.y])
      for (const cz of [bb.min.z, bb.max.z]) {
        const x = m[0]*cx + m[4]*cy + m[8]*cz + m[12];
        const y = m[1]*cx + m[5]*cy + m[9]*cz + m[13];
        const z = m[2]*cx + m[6]*cy + m[10]*cz + m[14];
        if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
      }
    });
    return { min, max, size: [max[0]-min[0], max[1]-min[1], max[2]-min[2]],
             center: [(min[0]+max[0])/2, (min[1]+max[1])/2, (min[2]+max[2])/2] };
  }
  const brainB = real ? meshBbox(real) : null;
  const boneB  = meshBbox(edu.layerManager.getGroup('bone'));
  // Try to filter skull-only from bone by taking top part
  let skullMinY = brainB ? brainB.min[1] - 0.2 : -1;
  let skullMax = -Infinity, skullMin = Infinity;
  // crude: assume skull = topmost 25% of bone
  return {
    brainBbox: brainB,
    boneBbox: boneB,
    headTopGuess: brainB ? brainB.max[1] : null,
  };
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
