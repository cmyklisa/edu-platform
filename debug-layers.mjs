import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[err] ${e.message}`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => !!window.__edu, { timeout: 120000 }); } catch { console.log(logs.slice(-20).join("\\n")); await browser.close(); process.exit(1); }
await page.waitForTimeout(2500);

const stats = await page.evaluate(() => {
  const edu = window.__edu;
  return edu.layerManager.getAll().map(l => {
    let n = 0; l.group.traverse(o => { if (o.isMesh) n++; });
    return { id: l.id, label: l.label, state: l.state, meshes: n };
  });
});
console.log('=== Layers ===');
console.log(JSON.stringify(stats, null, 2));

// Front zoom
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0.05, 1.6);
  controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/layers-default.png' });

// Brain only
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['nerve','sympathetic','viscera','vessel','bone','muscle','skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('brain', 'visible');
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/layers-brain-only.png' });

// Nerve only (peripheral)
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('brain', 'hidden');
  lm.setState('nerve', 'visible');
  const { camera, controls } = window.__edu;
  controls.target.set(0, -0.5, 0);
  camera.position.set(0, -0.5, 3);
  controls.update();
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/layers-nerve-only.png' });

// Muscle only
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  lm.setState('nerve', 'hidden');
  lm.setState('muscle', 'visible');
  const { camera, controls } = window.__edu;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 1.6);
  controls.update();
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/layers-muscle-only.png' });

console.log(logs.filter(l => /eye/i.test(l)).slice(0,3).join('\n'));
await browser.close();
