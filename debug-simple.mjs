import { chromium } from 'playwright-chromium';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[err] ${e.message}`));
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'networkidle' });
try {
  await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
} catch {
  console.log(logs.slice(-30).join('\n'));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/simple.png' });
console.log('OK, default screenshot saved');
console.log(logs.filter(l => /(err|warn|brain|eye|marker|aligned)/i.test(l)).join('\n'));
await browser.close();
