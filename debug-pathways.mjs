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
await page.waitForTimeout(2500);

// Hide bone/muscle/skin so we see the brain + body nerves clearly
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['skin','muscle','bone','vessel']) lm.setState(id, 'hidden');
});
await page.waitForTimeout(300);

// Click pathway tab
await page.evaluate(() => {
  document.querySelector('.tools-tab[data-tab="pathway"]')?.click();
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/pathways-tab.png' });

// Play sympathetic descending pathway
await page.evaluate(() => {
  document.querySelector('.pathway-btn[data-pathway="sympathetic-descending"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/pathway-symp-desc.png' });

// Inspect: arrows count + colors
const info = await page.evaluate(() => {
  const player = window.__edu.pathwayPlayer;
  return {
    activePathway: player.active?.id,
    arrowCount: player.arrows?.length,
    arrowColors: player.arrows?.slice(0, 2).map(a => '#' + a.material.color.getHexString()),
    tubeColor: player.tube ? '#' + player.tube.material.color.getHexString() : null,
  };
});
console.log('symp-desc:', JSON.stringify(info));

// Vagus afferent
await page.evaluate(() => {
  document.querySelector('.pathway-btn[data-pathway="vagus-afferent"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/pathway-vagus.png' });

const info2 = await page.evaluate(() => {
  const player = window.__edu.pathwayPlayer;
  return {
    activePathway: player.active?.id,
    arrowCount: player.arrows?.length,
    tubeColor: player.tube ? '#' + player.tube.material.color.getHexString() : null,
  };
});
console.log('vagus:', JSON.stringify(info2));

// Pain pathway
await page.evaluate(() => {
  document.querySelector('.pathway-btn[data-pathway="spinothalamic-pain"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/pathway-pain.png' });

// Parasymp
await page.evaluate(() => {
  document.querySelector('.pathway-btn[data-pathway="parasympathetic-descending"]')?.click();
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/pathway-parasymp.png' });

console.log(logs.filter(l => /(err|warn|pathway)/i.test(l)).join('\n'));
await browser.close();
