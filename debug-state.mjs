import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(2000);

// Set skin & bone hidden
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('bone', 'hidden');
  lm.setState('skin', 'hidden');
  lm.setState('muscle', 'hidden');
});
await page.waitForTimeout(400);

const stats = await page.evaluate(() => {
  const edu = window.__edu;
  return {
    states: edu.layerManager.getAll().map(l => ({
      id: l.id,
      state: l.state,
      groupVisible: l.group.visible,
      children: l.group.children.length,
      meshCount: (() => {
        let n = 0; l.group.traverse(o => { if (o.isMesh) n++; }); return n;
      })(),
    })),
  };
});
console.log(JSON.stringify(stats, null, 2));

// Zoomed front view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 1.6);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/state-test.png' });

await browser.close();
