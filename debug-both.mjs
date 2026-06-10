import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.setDefaultTimeout(200000);
page.setDefaultNavigationTimeout(200000);
page.on('pageerror', e => process.stderr.write(`[pageerror] ${e.message}\n`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__edu, null, { timeout: 200000 });
await page.waitForTimeout(2500);

// Default view: only muscle visible, show fiber
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['brain','nerve','sympathetic','viscera','vessel','bone','skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('muscle', 'visible');
});
await page.waitForTimeout(700);

// Front torso closeup to see fiber stripes
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -1.2, 0);
  camera.position.set(0, -0.9, 1.8);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/final-muscle-fiber-front.png' });

// Click a muscle to see info panel + selection
const clickPec = await page.evaluate(() => {
  const edu = window.__edu;
  const g = edu.layerManager.getGroup('muscle');
  let target = null;
  g.traverse(o => {
    if (target) return;
    if (o.isMesh && o.userData.structureId === 'pectoralis-major') target = o;
  });
  if (!target) return null;
  target.updateMatrixWorld(true);
  if (!target.geometry.boundingSphere) target.geometry.computeBoundingSphere();
  const local = target.geometry.boundingSphere.center.clone();
  const world = target.localToWorld(local);
  const proj = world.clone().project(edu.camera);
  const w = window.innerWidth, h = window.innerHeight;
  return { x: (proj.x + 1) * 0.5 * w, y: (1 - proj.y) * 0.5 * h };
});
if (clickPec) {
  await page.mouse.move(clickPec.x, clickPec.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: '/tmp/final-pec-click.png' });

// Cancel selection, switch to blood flow
await page.evaluate(() => {
  const edu = window.__edu;
  if (edu.layerManager.setSelection) edu.layerManager.setSelection(null);
});
await page.waitForTimeout(400);

await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['brain','nerve','sympathetic','viscera','muscle','bone','skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('vessel', 'visible');
  if (window.__edu.bloodFlow) window.__edu.bloodFlow.setEnabled(true);
});
await page.waitForTimeout(1200);

// Heart closeup with comet trails
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(-0.1, -1.2, 0);
  camera.position.set(-0.1, -1.2, 1.6);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/final-blood-heart.png' });

// Full body with everything (muscle + blood)
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('muscle', 'fade');
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, -1.0, 0);
  camera.position.set(0, -0.7, 5.0);
  camera.lookAt(controls.target);
  controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/final-combined.png' });

await browser.close();
