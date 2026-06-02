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

// Simulate clicking on the amygdala marker by projecting its world pos to screen pixels
const clickResult = await page.evaluate(() => {
  const edu = window.__edu;
  const marker = edu.markerMap.get('amygdala');
  if (!marker) return { error: 'no amygdala marker' };
  marker.updateMatrixWorld(true);
  const v = marker.position.clone();
  // marker is child of layer group → use getWorldPosition
  marker.getWorldPosition(v);
  v.project(edu.camera);
  const w = window.innerWidth, h = window.innerHeight;
  return {
    worldPos: marker.position.toArray(),
    screenX: (v.x + 1) * 0.5 * w,
    screenY: (1 - v.y) * 0.5 * h,
  };
});
console.log('amygdala marker screen pos:', clickResult);
if (clickResult.screenX !== undefined) {
  // pointerdown + up at the position
  await page.mouse.move(clickResult.screenX, clickResult.screenY);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: '/tmp/edu-clicked.png' });

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

// One-off: dump all real-anatomy mesh names + their world centroid + bounding box.
// Useful for retuning marker positions to match real-brain landmarks.
const landmarks = await page.evaluate(() => {
  const edu = window.__edu;
  if (!edu) return null;
  const THREE_VEC3 = edu.controls.target.constructor; // poor man's THREE.Vector3
  edu.scene.updateMatrixWorld(true);
  const out = [];
  edu.scene.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.isMarker || o.userData.isOverlay) return;
    if (!o.name) return;
    if (!o.geometry) return;
    o.geometry.computeBoundingBox?.();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    const m = o.matrixWorld.elements;
    const wx = m[0]*cx + m[4]*cy + m[8]*cz + m[12];
    const wy = m[1]*cx + m[5]*cy + m[9]*cz + m[13];
    const wz = m[2]*cx + m[6]*cy + m[10]*cz + m[14];
    out.push({ name: o.name, world: [wx, wy, wz] });
  });
  return out;
});

import { writeFile } from 'node:fs/promises';
await writeFile('/tmp/brain-landmarks.json', JSON.stringify(landmarks, null, 2));
console.log(`Wrote ${landmarks?.length ?? 0} landmarks → /tmp/brain-landmarks.json`);

const diag = await page.evaluate(() => {
  const THREE_ = window.__edu?.scene?.constructor;
  const edu = window.__edu;
  if (!edu) return { error: 'no __edu' };
  // Find the real anatomy group (it's in nerve layer)
  const nerve = edu.layerManager.getGroup('nerve');
  let realRoot = null;
  for (const c of nerve.children) {
    if (c.name?.startsWith('Scene') || c.children.length > 5) {
      realRoot = c;
      break;
    }
  }
  let realInfo = null;
  // Compute world bbox of the real anatomy after transforms
  let realBboxInfo = null;
  if (realRoot) {
    realRoot.updateMatrixWorld(true);
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    let meshCount = 0;
    realRoot.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      meshCount++;
      o.geometry.computeBoundingBox?.();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const m = o.matrixWorld.elements;
      // sample 8 corners
      for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
        const x = m[0]*cx + m[4]*cy + m[8]*cz + m[12];
        const y = m[1]*cx + m[5]*cy + m[9]*cz + m[13];
        const z = m[2]*cx + m[6]*cy + m[10]*cz + m[14];
        if (x < min.x) min.x = x; if (y < min.y) min.y = y; if (z < min.z) min.z = z;
        if (x > max.x) max.x = x; if (y > max.y) max.y = y; if (z > max.z) max.z = z;
      }
    });
    realBboxInfo = { min, max, meshCount,
      size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
      center: { x: (min.x+max.x)/2, y: (min.y+max.y)/2, z: (min.z+max.z)/2 },
    };
  }
  if (realRoot) {
    realInfo = {
      name: realRoot.name,
      position: realRoot.position.toArray(),
      scale: realRoot.scale.toArray(),
      childCount: realRoot.children.length,
    };
  }
  return {
    sceneChildCount: edu.scene.children.length,
    nerveChildren: nerve.children.length,
    nerveChildNames: nerve.children.map(c => c.name || c.type),
    realInfo,
    realBboxInfo,
    cameraPos: edu.camera ? edu.camera.position.toArray() : null,
    cameraTarget: edu.controls?.target.toArray(),
  };
});

console.log('=== Console logs ===');
console.log(consoleLogs.join('\n'));
console.log('\n=== Diagnostics ===');
console.log(JSON.stringify(diag, null, 2));

await browser.close();
