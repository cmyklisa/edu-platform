import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(1500);

// Focus on brain
await page.evaluate(() => {
  document.querySelector('.organ-nav-btn[data-organ="brain"]')?.click();
});
await page.waitForTimeout(1200);

await page.screenshot({ path: '/tmp/align-brain-default.png' });

// Show bone, hide others except brain
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('skin',   'hidden');
  lm.setState('muscle', 'hidden');
  lm.setState('vessel', 'hidden');
  lm.setState('bone',   'visible');
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-brain-skull.png' });

// Now show skin too to check eyes
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('skin', 'visible');
  lm.setState('bone', 'hidden');
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/align-brain-skin.png' });

// Get measurements
const diag = await page.evaluate(() => {
  const edu = window.__edu;
  const THREE_Vec3 = edu.controls.target.constructor;
  // Try to get bbox of brain (real)
  let real = null;
  edu.layerManager.getGroup('nerve').children.forEach(c => {
    if (!real && c.children && c.children.length > 5) real = c;
  });
  // bone bbox
  const boneGrp = edu.layerManager.getGroup('bone');
  const skinGrp = edu.layerManager.getGroup('skin');

  boneGrp.updateMatrixWorld(true);
  skinGrp.updateMatrixWorld(true);

  function bbox(group) {
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    let n = 0;
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
      n++;
    });
    return { min, max, n, size: [max[0]-min[0], max[1]-min[1], max[2]-min[2]] };
  }

  return {
    brainBbox: real ? bbox(real) : null,
    boneBbox: bbox(boneGrp),
    skinBbox: bbox(skinGrp),
    modelScale: edu.modelRoot.scale.toArray(),
    markersCount: edu.markerMap.size,
  };
});
console.log('=== Alignment diag ===');
console.log(JSON.stringify(diag, null, 2));

// Marker density: count markers visible from default camera + their screen separation
const markerPositions = await page.evaluate(() => {
  const edu = window.__edu;
  const out = [];
  for (const [id, m] of edu.markerMap) {
    if (m.userData.isMarker === false) continue;
    if (!m.visible) continue;
    m.updateMatrixWorld(true);
    const v = new (edu.controls.target.constructor)();
    m.getWorldPosition(v);
    v.project(edu.camera);
    out.push({
      id,
      sx: (v.x + 1) * 0.5 * window.innerWidth,
      sy: (1 - v.y) * 0.5 * window.innerHeight,
      world: m.position.toArray(),
    });
  }
  return out;
});
console.log('\n=== Marker screen positions ===');
console.log(JSON.stringify(markerPositions, null, 2));

await browser.close();
