import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(2000);

// Make brain meshes red & ALWAYS-ON-TOP (depthTest false) so we see them through skull
await page.evaluate(() => {
  const edu = window.__edu;
  let real = null;
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (!real && c.children && c.children.length > 5) real = c;
  });
  if (!real) return null;
  real.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.color.setHex(0xff3030);
      m.emissive?.setHex(0x440000);
      m.opacity = 1;
      m.transparent = false;
      m.needsUpdate = true;
    }
  });
  // Skull translucent
  edu.layerManager.setState('bone', 'fade');
  edu.layerManager.setState('skin', 'hidden');
  edu.layerManager.setState('muscle', 'hidden');
  edu.layerManager.setState('vessel', 'hidden');
  // hide cn nerves (also nerve layer)
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (c.name?.includes('Scene') && c.children?.length > 5 && c === real) {
      // brain — leave visible
    } else if (c.name?.includes('marker')) {
      c.visible = false;
    } else if (c !== real) {
      // other nerve content (CN, nerves, spinal, sympathetic) — hide for clarity
      c.visible = false;
    }
  });
});

// Front view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 2);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-red-brain-front.png' });

// Side view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  camera.position.set(2, 0, 0.01);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-red-brain-side.png' });

// Top view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  camera.position.set(0, 2, 0.01);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-red-brain-top.png' });

// Compute skull-only bbox (top portion of bone where y > some threshold)
const skullInfo = await page.evaluate(() => {
  const edu = window.__edu;
  const bone = edu.layerManager.getGroup('bone');
  bone.updateMatrixWorld(true);
  let real = null;
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (!real && c.children && c.children.length > 5) real = c;
  });
  // Brain bbox
  real.updateMatrixWorld(true);
  let bMin = [Infinity,Infinity,Infinity], bMax=[-Infinity,-Infinity,-Infinity];
  real.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox?.();
    const bb = o.geometry.boundingBox;
    const m = o.matrixWorld.elements;
    for (const cx of [bb.min.x, bb.max.x])
    for (const cy of [bb.min.y, bb.max.y])
    for (const cz of [bb.min.z, bb.max.z]) {
      const x = m[0]*cx + m[4]*cy + m[8]*cz + m[12];
      const y = m[1]*cx + m[5]*cy + m[9]*cz + m[13];
      const z = m[2]*cx + m[6]*cy + m[10]*cz + m[14];
      if (x < bMin[0]) bMin[0]=x; if (y < bMin[1]) bMin[1]=y; if (z < bMin[2]) bMin[2]=z;
      if (x > bMax[0]) bMax[0]=x; if (y > bMax[1]) bMax[1]=y; if (z > bMax[2]) bMax[2]=z;
    }
  });
  // Skull = top portion of bone (y > -0.5, head region)
  // Iterate VERTICES of merged bone to filter
  let skMin = [Infinity,Infinity,Infinity], skMax=[-Infinity,-Infinity,-Infinity];
  let nVerts = 0;
  bone.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    const m = o.matrixWorld.elements;
    for (let i = 0; i < pos.count; i++) {
      const cx = pos.getX(i), cy = pos.getY(i), cz = pos.getZ(i);
      const x = m[0]*cx + m[4]*cy + m[8]*cz + m[12];
      const y = m[1]*cx + m[5]*cy + m[9]*cz + m[13];
      const z = m[2]*cx + m[6]*cy + m[10]*cz + m[14];
      if (y < -0.6) continue; // skip non-head bones
      nVerts++;
      if (x < skMin[0]) skMin[0]=x; if (y < skMin[1]) skMin[1]=y; if (z < skMin[2]) skMin[2]=z;
      if (x > skMax[0]) skMax[0]=x; if (y > skMax[1]) skMax[1]=y; if (z > skMax[2]) skMax[2]=z;
    }
  });
  return {
    brain: { min: bMin, max: bMax,
      center: bMin.map((v,i) => (v + bMax[i]) / 2),
      size: bMin.map((v,i) => bMax[i] - v) },
    skullRegion: { min: skMin, max: skMax,
      center: skMin.map((v,i) => (v + skMax[i]) / 2),
      size: skMin.map((v,i) => skMax[i] - v),
      nVerts },
  };
});
console.log('=== Brain vs Skull region bboxes ===');
console.log(JSON.stringify(skullInfo, null, 2));

await browser.close();
