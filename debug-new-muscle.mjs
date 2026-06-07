import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => !!window.__edu, { timeout: 300000 }); }
catch { console.log(logs.slice(-15).join('\n')); await browser.close(); process.exit(1); }
await page.waitForTimeout(2000);

// Only muscle visible
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['brain','nerve','sympathetic','viscera','vessel','bone','skin']) lm.setState(id, 'hidden');
  lm.setState('muscle', 'visible');
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/new-muscle-only.png' });

const stats = await page.evaluate(() => {
  const g = window.__edu.layerManager.getGroup('muscle');
  let n = 0; let bbox = { min: [Infinity,Infinity,Infinity], max: [-Infinity,-Infinity,-Infinity] };
  g.traverse(o => {
    if (!o.isMesh) return;
    n++;
    o.geometry?.computeBoundingBox?.();
    const bb = o.geometry?.boundingBox;
    if (!bb) return;
    const m = o.matrixWorld.elements;
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      const x = m[0]*cx + m[4]*cy + m[8]*cz + m[12];
      const y = m[1]*cx + m[5]*cy + m[9]*cz + m[13];
      const z = m[2]*cx + m[6]*cy + m[10]*cz + m[14];
      if (x < bbox.min[0]) bbox.min[0] = x; if (y < bbox.min[1]) bbox.min[1] = y; if (z < bbox.min[2]) bbox.min[2] = z;
      if (x > bbox.max[0]) bbox.max[0] = x; if (y > bbox.max[1]) bbox.max[1] = y; if (z > bbox.max[2]) bbox.max[2] = z;
    }
  });
  return { meshes: n, bbox };
});
console.log('Muscle stats:', JSON.stringify(stats));
console.log(logs.filter(l => /muscle|perf merge/i.test(l)).slice(0, 3).join('\n'));
await browser.close();
