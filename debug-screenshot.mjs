import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const consoleLogs = [];
page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => consoleLogs.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.screenshot({ path: '/tmp/edu-idle.png' });

// Sagittal (X) at 50%
await page.click('button[data-axis="x"]');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/edu-clip-x50.png' });

// Slider to 75%
const slider = await page.$('.clip-slider input[type="range"]');
await slider.evaluate((el) => { el.value = 75; el.dispatchEvent(new Event('input', {bubbles:true})); });
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/edu-clip-x75.png' });

// Coronal (Z) at 50%
await page.click('button[data-axis="z"]');
await slider.evaluate((el) => { el.value = 50; el.dispatchEvent(new Event('input', {bubbles:true})); });
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/edu-clip-z50.png' });

// Combined: turn off clip, then play fear pathway
await page.click('button[data-axis="off"]');
await page.waitForTimeout(200);
await page.click('button[data-pathway="fear-freeze"]');
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/edu-pathway-fear.png' });

// Now enable Y clipping at 50% with pathway active — markers/tube should NOT be clipped
await page.click('button[data-axis="y"]');
await slider.evaluate((el) => { el.value = 50; el.dispatchEvent(new Event('input', {bubbles:true})); });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/edu-clip-y50-pathway.png' });

// Drag the desc panel to a new spot (simulate user moving it)
const descHandle = await page.$('#pathway-desc-panel .pathway-desc-header');
const box = await descHandle.boundingBox();
await page.mouse.move(box.x + 50, box.y + 12);
await page.mouse.down();
await page.mouse.move(box.x - 300, box.y + 200, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/edu-desc-dragged.png' });

// Collapse the desc panel
await page.click('.pathway-desc-collapse');
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/edu-desc-collapsed.png' });

// Drag the layer panel down a bit
const layerHandle = await page.$('#layer-panel .layer-panel-header');
const lb = await layerHandle.boundingBox();
await page.mouse.move(lb.x + 100, lb.y + 12);
await page.mouse.down();
await page.mouse.move(lb.x + 100, lb.y + 200, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/edu-layer-dragged.png' });

const diag = await page.evaluate(() => {
  return {
    layerPanelRect: document.getElementById('layer-panel').getBoundingClientRect(),
    pathwayPanelRect: document.getElementById('pathway-panel').getBoundingClientRect(),
    descPanelRect: document.getElementById('pathway-desc-panel').getBoundingClientRect(),
    descCollapsed: document.getElementById('pathway-desc-panel').classList.contains('collapsed'),
    descHidden: document.getElementById('pathway-desc-panel').hasAttribute('hidden'),
  };
});

console.log('=== Console logs ===');
console.log(consoleLogs.join('\n'));
console.log('\n=== Diagnostics ===');
console.log(JSON.stringify(diag, null, 2));

await browser.close();
