import { chromium } from 'playwright-chromium';

const URL = 'http://localhost:5174/edu-platform/';
const browser = await chromium.launch();

// Mobile viewport
// 用桌面瀏覽器但 viewport 設手機尺寸 → 觸發 mobile CSS 但不被 isMobile 拖慢載入
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
try {
  await page.waitForFunction(() => !!window.__edu, { timeout: 180000 });
} catch {
  console.log('=== TIMEOUT ===');
  console.log(logs.slice(-10).join('\n'));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1000);

await page.screenshot({ path: '/tmp/edu-mobile-collapsed.png' });

// Expand tools-panel
await page.evaluate(() => {
  document.querySelector('.tools-collapse')?.click();
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/edu-mobile-expanded.png' });

// Open view tab
await page.evaluate(() => {
  document.querySelector('.tools-tab[data-tab="view"]')?.click();
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/edu-mobile-view.png' });

// Drag scale to 60%
await page.evaluate(() => {
  const sl = document.querySelector('input[data-slider="scale"]');
  if (sl) {
    sl.value = 60;
    sl.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/edu-mobile-scaled.png' });

// Layer tab → enable viscera
await page.evaluate(() => {
  document.querySelector('.tools-tab[data-tab="layer"]')?.click();
});
await page.waitForTimeout(200);
await page.evaluate(() => {
  document.querySelector('li[data-layer="viscera"] button[data-state="visible"]')?.click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/edu-mobile-viscera.png' });

// Tap a viscera mesh (try liver area) to test info panel selection
const result = await page.evaluate(() => {
  const edu = window.__edu;
  // Find liver mesh
  let liverMesh = null;
  edu.layerManager.getGroup('viscera').traverse(o => {
    if (o.isMesh && o.userData.structureId === 'liver') liverMesh = liverMesh || o;
  });
  if (!liverMesh) return null;
  liverMesh.updateMatrixWorld(true);
  const c = liverMesh.geometry.boundingSphere?.center?.clone() ?? new (liverMesh.position.constructor)();
  liverMesh.localToWorld(c);
  c.project(edu.camera);
  return {
    x: (c.x + 1) * 0.5 * window.innerWidth,
    y: (1 - c.y) * 0.5 * window.innerHeight,
  };
});
console.log('liver tap:', result);
if (result) {
  await page.touchscreen.tap(result.x, result.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/edu-mobile-liver-info.png' });
}

// Diag
const diag = await page.evaluate(() => {
  const edu = window.__edu;
  return {
    modelScale: edu.modelRoot.scale.toArray(),
    panels: {
      tools: !!document.querySelector('.tools-panel'),
      toolsCollapsed: document.querySelector('.tools-panel.collapsed') !== null,
      organNav: !!document.querySelector('.organ-nav'),
      infoVisible: document.querySelector('.info-panel.visible') !== null,
    },
    visceraVisible: edu.layerManager.get('viscera').state,
  };
});
console.log('\n=== Diag ===');
console.log(JSON.stringify(diag, null, 2));

await browser.close();
console.log('\nDone.');
