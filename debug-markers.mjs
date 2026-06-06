import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
await page.waitForTimeout(2000);

// Focus on brain
await page.evaluate(() => {
  document.querySelector('.organ-nav-btn[data-organ="brain"]')?.click();
});
await page.waitForTimeout(1200);

// Hide skin so brain is visible
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('skin', 'hidden');
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/markers-default.png' });

// Trigger hover on amygdala marker via mouse move
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
await page.mouse.move(amy.x, amy.y);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/markers-hover.png' });

// Click → select
await page.mouse.click(amy.x, amy.y);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/markers-selected.png' });

const stats = await page.evaluate(() => {
  const edu = window.__edu;
  const visibleCount = [...edu.markerMap.values()].filter(m =>
    m.userData.isMarker !== false && m.material && m.material.opacity > 0
  ).length;
  return {
    selectedId: edu.layerManager.selectedStructureId,
    visibleMarkers: visibleCount,
    totalMarkers: edu.markerMap.size,
  };
});
console.log(JSON.stringify(stats, null, 2));

await browser.close();
