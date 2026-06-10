import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.setDefaultTimeout(200000);
page.setDefaultNavigationTimeout(200000);
page.on('console', m => process.stderr.write(`[${m.type()}] ${m.text()}\n`));
page.on('pageerror', e => process.stderr.write(`[pageerror] ${e.message}\n`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__edu, null, { timeout: 200000 });
await page.waitForTimeout(2500);

await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['brain','nerve','sympathetic','viscera','vessel','bone','skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('muscle', 'visible');
});
await page.waitForTimeout(500);

// Closeup: zoom into chest/abs region to see fiber detail
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -0.85, 0);
  camera.position.set(0.3, -0.7, 1.4);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/fiber-torso-closeup.png' });

// Closeup: upper arm (biceps/triceps)
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0.55, -1.2, 0);
  camera.position.set(0.55, -1.2, 1.2);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/fiber-arm-closeup.png' });

// Closeup: face / facial muscles
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0.05, 0);
  camera.position.set(0, 0.05, 0.9);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/fiber-face-closeup.png' });

// Full body for reference
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -1.0, 0);
  camera.position.set(0, -0.7, 4.5);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/fiber-fullbody.png' });

await browser.close();
