import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__edu, { timeout: 120000 });
await page.waitForTimeout(2000);

// Hide skin/muscle/bone for clearer view
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['nerve','sympathetic','viscera','vessel','bone','muscle','skin']) lm.setState(id, 'hidden');
});

// Launch scenario
await page.evaluate(() => {
  document.querySelector('.scenario-launch-btn')?.click();
});
await page.waitForTimeout(800);

// Set camera to view brain to chest
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -0.7, 0);
  camera.position.set(0, -0.5, 3.5);
  controls.update();
});

// Wave 1 — perception
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/sc-1-perception.png' });

// Wave 2 — mobilization
await page.evaluate(() => document.querySelector('.scenario-wave[data-wave="1"]')?.click());
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/sc-2-mobilization.png' });

// Wave 3 — rational
await page.evaluate(() => document.querySelector('.scenario-wave[data-wave="2"]')?.click());
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/sc-3-rational.png' });

// Wave 4 — freeze
await page.evaluate(() => document.querySelector('.scenario-wave[data-wave="3"]')?.click());
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/sc-4-freeze.png' });

// Wave 5 — recovery
await page.evaluate(() => document.querySelector('.scenario-wave[data-wave="4"]')?.click());
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/sc-5-recovery.png' });

await browser.close();
