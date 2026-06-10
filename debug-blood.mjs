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

// Hide muscle/skin/etc so vessel + dots are clearly visible
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['brain','nerve','sympathetic','viscera','muscle','bone','skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('vessel', 'visible');
  // Turn on blood flow
  if (window.__edu.bloodFlow) window.__edu.bloodFlow.setEnabled(true);
});
await page.waitForTimeout(1500);

// Full body — see flow pattern across all vessels
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -1.0, 0);
  camera.position.set(0, -0.7, 4.5);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/blood-full.png' });

// Closeup: heart/upper torso vessels (arch of aorta, major arteries)
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(-0.1, -1.2, 0);
  camera.position.set(-0.1, -1.2, 1.4);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/blood-heart.png' });

// Closeup: abdomen vessels
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -1.6, 0);
  camera.position.set(0, -1.4, 1.1);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/blood-abdomen.png' });

// Closeup: side view of arm/torso arteries
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0.6, -1.2, 0);
  camera.position.set(2.2, -1.0, 0.8);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/blood-arm.png' });

// Two frames at close-up showing motion
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -1.3, 0);
  camera.position.set(0, -1.1, 1.0);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/blood-motion-1.png' });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/blood-motion-2.png' });

await browser.close();
