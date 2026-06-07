import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(2000);

// Hide everything except muscle
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['nerve', 'sympathetic', 'viscera', 'vessel', 'bone', 'skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('muscle', 'visible');
  // Front view zoomed on head
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 1.6);
  controls.update();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/muscle-alone.png' });

// Inspect muscle material color
const muscleInfo = await page.evaluate(() => {
  const edu = window.__edu;
  const g = edu.layerManager.getGroup('muscle');
  const out = [];
  g.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      out.push({
        name: o.name,
        color: m.color ? '#' + m.color.getHexString() : null,
        opacity: m.opacity,
        hasMap: !!m.map,
        emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
        roughness: m.roughness,
        side: m.side,
      });
    }
  });
  return out;
});
console.log(JSON.stringify(muscleInfo, null, 2));

await browser.close();
