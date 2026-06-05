import { chromium } from 'playwright-chromium';

const URL = 'http://localhost:5174/edu-platform/';
const browser = await chromium.launch();

// ── Desktop screenshot ───────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/edu-desktop-initial.png', fullPage: false });

  // Click View tab
  await page.evaluate(() => {
    const btn = document.querySelector('.tools-tab[data-tab="view"]');
    btn?.click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/edu-desktop-view-tab.png' });

  // Drag scale slider to 60%
  const scaleSlider = await page.$('input[data-slider="scale"]');
  if (scaleSlider) {
    await scaleSlider.evaluate(el => { el.value = 60; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/edu-desktop-scale-60.png' });

    // Back to 150
    await scaleSlider.evaluate(el => { el.value = 150; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/edu-desktop-scale-150.png' });

    // Reset
    await scaleSlider.evaluate(el => { el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true })); });
  }

  // Drag explode slider
  const explSlider = await page.$('input[data-slider="explode"]');
  if (explSlider) {
    await explSlider.evaluate(el => { el.value = 80; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/edu-desktop-explode-80.png' });
    await explSlider.evaluate(el => { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  }

  // Switch to layer tab, turn on viscera, switch to view tab again
  await page.evaluate(() => {
    document.querySelector('.tools-tab[data-tab="layer"]')?.click();
  });
  await page.waitForTimeout(200);

  // Find viscera row and click its "顯示" button
  const visceraDone = await page.evaluate(() => {
    const li = document.querySelector('li[data-layer="viscera"]');
    if (!li) return { error: 'no viscera row' };
    const btn = li.querySelector('button[data-state="visible"]');
    if (!btn) return { error: 'no visible button' };
    btn.click();
    return { ok: true };
  });
  console.log('viscera toggle:', visceraDone);
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/edu-desktop-viscera-on.png' });

  // Diagnostics: viscera layer count + organ tag stats
  const diag = await page.evaluate(() => {
    const edu = window.__edu;
    if (!edu) return { error: 'no __edu' };
    const visc = edu.layerManager.getGroup('viscera');
    let viscMeshes = 0;
    const organTags = {};
    visc.traverse(o => {
      if (!o.isMesh) return;
      viscMeshes++;
      const sid = o.userData.structureId;
      if (sid) organTags[sid] = (organTags[sid] || 0) + 1;
    });
    return {
      layerCount: edu.layerManager.getAll().map(l => ({ id: l.id, state: l.state, n: l.group.children.length })),
      viscMeshes,
      organTags,
      modelScale: edu.modelRoot.scale.toArray(),
    };
  });
  console.log('\n=== Diag ===');
  console.log(JSON.stringify(diag, null, 2));

  // Print only relevant logs
  const filtered = logs.filter(l =>
    /viscera|organ|skin|nerve|VISCERA|tagged|loaded|error|warn/i.test(l)
  );
  console.log('\n=== Console (filtered) ===');
  console.log(filtered.join('\n'));

  await ctx.close();
}

// ── Mobile screenshot ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__edu, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/edu-mobile-initial.png', fullPage: false });

  // Tap an amygdala marker → info panel
  const result = await page.evaluate(() => {
    const edu = window.__edu;
    const m = edu?.markerMap.get('amygdala');
    if (!m) return null;
    m.updateMatrixWorld(true);
    const v = m.position.clone();
    m.getWorldPosition(v);
    v.project(edu.camera);
    return {
      x: (v.x + 1) * 0.5 * window.innerWidth,
      y: (1 - v.y) * 0.5 * window.innerHeight,
    };
  });
  if (result) {
    await page.touchscreen.tap(result.x, result.y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/edu-mobile-info-open.png' });
  }

  // Click 視圖 tab on mobile
  await page.evaluate(() => {
    document.querySelector('.tools-tab[data-tab="view"]')?.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/edu-mobile-view-tab.png' });

  await ctx.close();
}

await browser.close();
console.log('\nDone.');
