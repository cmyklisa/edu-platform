import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.setDefaultTimeout(200000);
page.setDefaultNavigationTimeout(200000);
page.on('console', m => process.stderr.write(`[console:${m.type()}] ${m.text()}\n`));
page.on('pageerror', e => process.stderr.write(`[pageerror] ${e.message}\n`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__edu, null, { timeout: 200000 });
await page.waitForTimeout(2000);

const names = await page.evaluate(() => {
  const g = window.__edu.layerManager.getGroup('muscle');
  const meshNames = [];
  g.traverse(o => {
    if (o.isMesh && o.name) meshNames.push(o.name);
  });
  return meshNames;
});
console.log(JSON.stringify({ total: names.length, names }, null, 2));
await browser.close();
