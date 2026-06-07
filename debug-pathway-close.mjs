import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 120000 });
await page.waitForTimeout(2000);

// Hide everything for clarity
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['nerve','sympathetic','viscera','vessel','bone','muscle','skin']) {
    lm.setState(id, 'hidden');
  }
});

// Play sympathetic descending
await page.evaluate(() => {
  document.querySelector('.tools-tab[data-tab="pathway"]')?.click();
  document.querySelector('.pathway-btn[data-pathway="sympathetic-descending"]')?.click();
});
await page.waitForTimeout(800);

// Zoom out to see whole pathway head to abdomen
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -0.7, 0);
  camera.position.set(0, -0.7, 3.5);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/path-close-symp.png' });

// Different camera angle
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  camera.position.set(3, -0.5, 1.5);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/path-close-symp-side.png' });

await browser.close();
