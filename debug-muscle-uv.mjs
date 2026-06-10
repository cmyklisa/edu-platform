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

const info = await page.evaluate(() => {
  const g = window.__edu.layerManager.getGroup('muscle');
  let totalMesh = 0;
  let withUV = 0;
  let withNormal = 0;
  const samples = [];
  g.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    totalMesh++;
    const attrs = o.geometry.attributes;
    const hasUV = !!attrs.uv;
    const hasNormal = !!attrs.normal;
    if (hasUV) withUV++;
    if (hasNormal) withNormal++;
    if (samples.length < 5) {
      samples.push({
        name: o.name,
        attrs: Object.keys(attrs),
        uvSample: hasUV ? Array.from(attrs.uv.array.slice(0, 12)).map(v => +v.toFixed(3)) : null,
        vertCount: attrs.position?.count,
      });
    }
  });
  return { totalMesh, withUV, withNormal, samples };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
