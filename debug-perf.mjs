import { chromium } from 'playwright-chromium';

const URL = 'http://localhost:5173/edu-platform/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
try {
  await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
} catch {
  console.log(logs.slice(-15).join('\n'));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1500);

// Stats: render info per frame
const stats = await page.evaluate(() => {
  const edu = window.__edu;
  // Force one render to populate renderer.info
  const r = document.querySelector('canvas');
  // Three.js renderer is private; grab via __edu? Not exposed. Use scene traversal instead.
  let totalMeshes = 0;
  let visibleMeshes = 0;
  edu.scene.traverse(o => { if (o.isMesh) { totalMeshes++; if (o.visible) visibleMeshes++; } });

  const layerStats = {};
  for (const layer of edu.layerManager.getAll()) {
    let mc = 0;
    let vc = 0;
    let triCount = 0;
    layer.group.traverse(o => {
      if (o.isMesh) {
        mc++;
        if (o.visible) vc++;
        const g = o.geometry;
        if (g) {
          const idx = g.index;
          triCount += idx ? idx.count / 3 : (g.attributes.position?.count || 0) / 3;
        }
      }
    });
    layerStats[layer.id] = { state: layer.state, meshes: mc, visible: vc, triangles: Math.round(triCount) };
  }
  return { totalMeshes, visibleMeshes, layerStats };
});

console.log('=== Scene stats ===');
console.log(JSON.stringify(stats, null, 2));

// Test: toggle every layer visible and screenshot
await page.evaluate(() => {
  for (const id of ['vessel', 'bone', 'muscle', 'viscera']) {
    window.__edu.layerManager.setState(id, 'visible');
  }
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/edu-perf-all-on.png' });

// Test: fade skin
await page.evaluate(() => window.__edu.layerManager.setState('skin', 'fade'));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/edu-perf-skin-fade.png' });

// Test: hide bone
await page.evaluate(() => window.__edu.layerManager.setState('bone', 'hidden'));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/edu-perf-bone-hidden.png' });

// Test: click amygdala marker still works
const amy = await page.evaluate(() => {
  const edu = window.__edu;
  const m = edu.markerMap.get('amygdala');
  m.updateMatrixWorld(true);
  const v = m.position.clone();
  m.getWorldPosition(v);
  v.project(edu.camera);
  return {
    x: (v.x + 1) * 0.5 * window.innerWidth,
    y: (1 - v.y) * 0.5 * window.innerHeight,
  };
});
await page.mouse.click(amy.x, amy.y);
await page.waitForTimeout(500);
const sel = await page.evaluate(() => window.__edu.layerManager.selectedStructureId);
console.log('\nSelection after click:', sel);
await page.screenshot({ path: '/tmp/edu-perf-amy-click.png' });

// Console filter
const relevant = logs.filter(l =>
  /merge|perf|frustum|culling|tagged|error|warn/i.test(l)
);
console.log('\n=== Console (filtered) ===');
console.log(relevant.join('\n'));

await browser.close();
