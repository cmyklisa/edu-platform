import { chromium } from 'playwright-chromium';

const URL = 'https://cmyklisa.github.io/edu-platform/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[err] ${e.message}`));
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
console.log('HTTP', resp.status());
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/edu-live.png' });
const meshCount = await page.evaluate(() => window.__edu?.markerMap?.size);
console.log('markers loaded:', meshCount);
console.log('---console:');
for (const l of logs) console.log(l);
await browser.close();
