import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5174/edu-platform/', { waitUntil: 'networkidle' });
try {
  await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
} catch {
  console.log('=== TIMEOUT, logs so far ===');
  console.log(logs.join('\n'));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(500);

const names = await page.evaluate(() => {
  const edu = window.__edu;
  if (!edu) return null;
  const visc = edu.layerManager.getGroup('viscera');
  const out = [];
  visc.traverse(o => {
    if (o.isMesh) out.push(o.name);
  });
  return out;
});

console.log('viscera mesh names:');
for (const n of names) console.log('  ' + n);
console.log('total:', names.length);

await browser.close();
