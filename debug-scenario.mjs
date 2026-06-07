import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[err] ${e.message}`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => !!window.__edu, { timeout: 120000 }); }
catch { console.log(logs.slice(-15).join('\n')); await browser.close(); process.exit(1); }
await page.waitForTimeout(2000);

// Hide everything except brain
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['nerve','sympathetic','viscera','vessel','bone','muscle','skin']) lm.setState(id, 'hidden');
});
await page.waitForTimeout(300);

// Launch scenario
await page.evaluate(() => {
  document.querySelector('.scenario-launch-btn')?.click();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/scenario-wave1.png' });

const w1 = await page.evaluate(() => {
  const sp = window.__edu.scenarioPlayer;
  return sp.getProgress();
});
console.log('wave1:', JSON.stringify(w1?.wave?.id), 'paused=', w1?.paused);

// Seek to wave 2
await page.evaluate(() => {
  document.querySelector('.scenario-wave[data-wave="1"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/scenario-wave2.png' });

const w2 = await page.evaluate(() => {
  const sp = window.__edu.scenarioPlayer;
  return { p: sp.getProgress(), instCount: sp.instances.length };
});
console.log('wave2:', JSON.stringify(w2.p?.wave?.id), 'pathways=', w2.instCount);

// Wave 3 - rational
await page.evaluate(() => {
  document.querySelector('.scenario-wave[data-wave="2"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/scenario-wave3.png' });

// Wave 4 - freeze
await page.evaluate(() => {
  document.querySelector('.scenario-wave[data-wave="3"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/scenario-wave4.png' });

// Wave 5 - recovery
await page.evaluate(() => {
  document.querySelector('.scenario-wave[data-wave="4"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/scenario-wave5.png' });

const w5 = await page.evaluate(() => {
  const sp = window.__edu.scenarioPlayer;
  return { p: sp.getProgress(), instCount: sp.instances.length };
});
console.log('wave5:', JSON.stringify(w5.p?.wave?.id), 'pathways=', w5.instCount);

console.log(logs.filter(l => /(err|warn|scenario|marker)/i.test(l)).join('\n'));
await browser.close();
