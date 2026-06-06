import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[err] ${e.message}`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(2000);

// Default screenshot
await page.screenshot({ path: '/tmp/final-default.png' });

// Brain only (head zoom)
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0.05, 1.6);
  controls.update();
  const lm = window.__edu.layerManager;
  lm.setState('skin',   'fade');
  lm.setState('bone',   'visible');
  lm.setState('muscle', 'hidden');
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/final-head-front.png' });

// Side view
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  camera.position.set(1.6, 0.05, 0.01);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/final-head-side.png' });

// Skull semi-transparent + brain visible
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('bone', 'fade');
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/final-brain-in-skull.png' });

// Hover on amygdala marker
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('bone',   'hidden');
  lm.setState('skin',   'hidden');
});
await page.waitForTimeout(300);
const amy = await page.evaluate(() => {
  const edu = window.__edu;
  const m = edu.markerMap.get('amygdala');
  m.updateMatrixWorld(true);
  const v = new (edu.controls.target.constructor)();
  m.getWorldPosition(v);
  v.project(edu.camera);
  return {
    x: (v.x + 1) * 0.5 * window.innerWidth,
    y: (1 - v.y) * 0.5 * window.innerHeight,
  };
});
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0.05, 1.6);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/final-brain-no-markers.png' });

await page.mouse.move(amy.x, amy.y);
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/final-marker-hover.png' });

await page.mouse.click(amy.x, amy.y);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/final-marker-selected.png' });

const visibleMarkers = await page.evaluate(() => {
  const edu = window.__edu;
  return [...edu.markerMap.values()].filter(m =>
    m.userData.isMarker !== false && m.material && m.material.opacity > 0
  ).length;
});
console.log('Visible markers after select:', visibleMarkers);
console.log('Eye position log:', logs.filter(l => /eye/i.test(l)).slice(0, 3).join('\n'));

await browser.close();
