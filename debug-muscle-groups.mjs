import { chromium } from 'playwright-chromium';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(200000);
page.setDefaultNavigationTimeout(200000);
const logs = [];
page.on('console', m => { const s = `[${m.type()}] ${m.text()}`; logs.push(s); process.stderr.write(s + '\n'); });
page.on('pageerror', e => { const s = `[pageerror] ${e.message}`; logs.push(s); process.stderr.write(s + '\n'); });
await page.goto('http://localhost:5173/edu-platform/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__edu, null, { timeout: 200000 });
await page.waitForTimeout(2500);

// Hide everything except muscle
await page.evaluate(() => {
  const lm = window.__edu.layerManager;
  for (const id of ['brain','nerve','sympathetic','viscera','vessel','bone','skin']) {
    lm.setState(id, 'hidden');
  }
  lm.setState('muscle', 'visible');
});
await page.waitForTimeout(500);

// stats per group
const stats = await page.evaluate(() => {
  const g = window.__edu.layerManager.getGroup('muscle');
  const counts = {};
  const colors = {};
  let total = 0;
  let withId = 0;
  g.traverse(o => {
    if (!o.isMesh) return;
    total++;
    const sid = o.userData.structureId;
    if (sid) {
      withId++;
      counts[sid] = (counts[sid]||0)+1;
      if (!colors[sid] && o.material) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        colors[sid] = '#' + m.color.getHexString();
      }
    } else {
      counts['__unmatched'] = (counts['__unmatched']||0)+1;
    }
  });
  return { total, withId, counts, colors };
});
console.log('=== muscle group stats ===');
console.log(JSON.stringify(stats, null, 2));

// Sample materials of pec / latissimus / quads to verify emissive/toneMapped
const matSamples = await page.evaluate(() => {
  const g = window.__edu.layerManager.getGroup('muscle');
  const want = new Set(['pectoralis-major', 'latissimus-dorsi', 'quadriceps', 'trapezius', 'calf-muscles']);
  const out = {};
  g.traverse(o => {
    if (!o.isMesh) return;
    const sid = o.userData.structureId;
    if (!sid || !want.has(sid) || out[sid]) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    out[sid] = {
      name: o.name,
      color: '#' + m.color.getHexString(),
      emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
      emissiveIntensity: m.emissiveIntensity,
      toneMapped: m.toneMapped,
      bumpMap: !!m.bumpMap,
      bumpScale: m.bumpScale,
      roughness: m.roughness,
      type: m.type,
    };
  });
  return out;
});
console.log('=== material samples ===');
console.log(JSON.stringify(matSamples, null, 2));

// Full body shot via fit-to-visible
async function fit() {
  await page.evaluate(() => {
    const edu = window.__edu;
    edu.modelRoot.updateMatrixWorld(true);
    const THREE = edu.scene.constructor === Object ? null : null;
    const box = new edu.markersGroup.constructor();  // placeholder — use scene Box3 via Box3 constructor
  });
}

// Use the existing "全景" (fit) button
await page.click('button[data-organ="__fit__"]').catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/muscle-fit-front.png' });

// Re-check material state AFTER fit (in case layerManager mutation reset emissive)
const matAfterFit = await page.evaluate(() => {
  const g = window.__edu.layerManager.getGroup('muscle');
  const want = new Set(['pectoralis-major', 'latissimus-dorsi', 'trapezius']);
  const out = {};
  g.traverse(o => {
    if (!o.isMesh) return;
    const sid = o.userData.structureId;
    if (!sid || !want.has(sid) || out[sid]) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    out[sid] = {
      color: '#' + m.color.getHexString(),
      emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
      emissiveIntensity: m.emissiveIntensity,
      toneMapped: m.toneMapped,
      opacity: m.opacity,
      transparent: m.transparent,
      _origEmissive: m.userData._origEmissive?.toString(16),
    };
  });
  return out;
});
console.log('=== material state after fit ===');
console.log(JSON.stringify(matAfterFit, null, 2));

// Rotate to back via OrbitControls: directly set camera position
await page.evaluate(() => {
  const { camera, controls, modelRoot } = window.__edu;
  modelRoot.updateMatrixWorld(true);
  // Compute current target = controls.target, distance, then rotate camera around target
  const tgt = controls.target.clone();
  const offset = camera.position.clone().sub(tgt);
  const dist = offset.length();
  // 180 degree rotation around y axis
  camera.position.set(tgt.x, tgt.y + offset.y, tgt.z - (camera.position.z - tgt.z));
  // simpler: place camera behind target by `dist`
  camera.position.set(tgt.x, tgt.y, tgt.z - dist);
  camera.lookAt(tgt);
  controls.update();
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/muscle-fit-back.png' });

// Side
await page.evaluate(() => {
  const { camera, controls } = window.__edu;
  const tgt = controls.target.clone();
  const dist = camera.position.distanceTo(tgt);
  camera.position.set(tgt.x + dist, tgt.y, tgt.z);
  camera.lookAt(tgt);
  controls.update();
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/muscle-fit-side.png' });

// Click test: find pectoralis-major mesh, project center to screen, click
const clickAt = await page.evaluate(() => {
  const edu = window.__edu;
  // Restore front view
  edu.controls.target.set(0, -0.7, 0);
  edu.camera.position.set(0, -0.4, 4.5);
  edu.camera.lookAt(edu.controls.target);
  edu.controls.update();
  edu.modelRoot.updateMatrixWorld(true);
  const g = edu.layerManager.getGroup('muscle');
  let target = null;
  g.traverse(o => {
    if (target) return;
    if (o.isMesh && o.userData.structureId === 'pectoralis-major') target = o;
  });
  if (!target) return null;
  target.updateMatrixWorld(true);
  if (!target.geometry.boundingSphere) target.geometry.computeBoundingSphere();
  const localCenter = target.geometry.boundingSphere.center.clone();
  const worldCenter = target.localToWorld(localCenter);
  const proj = worldCenter.clone();
  proj.project(edu.camera);
  const w = window.innerWidth, h = window.innerHeight;
  return {
    name: target.name,
    world: [worldCenter.x, worldCenter.y, worldCenter.z],
    x: (proj.x + 1) * 0.5 * w,
    y: (1 - proj.y) * 0.5 * h,
  };
});
console.log('click pec at:', clickAt);
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/muscle-fit-frontpec.png' });

if (clickAt) {
  await page.mouse.move(clickAt.x, clickAt.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: '/tmp/muscle-click-pec.png' });

// Read info panel text
const infoText = await page.evaluate(() => {
  const el = document.getElementById('info-panel');
  return { visible: el?.classList.contains('visible'), text: el?.textContent?.trim()?.slice(0, 600) };
});
console.log('info panel after pec click:', JSON.stringify(infoText, null, 2));

// Click a different muscle (calf back of leg) — switch to back view first
const clickCalf = await page.evaluate(() => {
  const edu = window.__edu;
  // back view
  edu.controls.target.set(0, -0.7, 0);
  edu.camera.position.set(0, -0.4, -4.5);
  edu.camera.lookAt(edu.controls.target);
  edu.controls.update();
  edu.modelRoot.updateMatrixWorld(true);
  // clear selection
  if (window.__edu.selection) window.__edu.selection.select(null);
  const g = edu.layerManager.getGroup('muscle');
  let target = null;
  g.traverse(o => {
    if (target) return;
    if (o.isMesh && o.userData.structureId === 'calf-muscles') target = o;
  });
  if (!target) return null;
  target.updateMatrixWorld(true);
  if (!target.geometry.boundingSphere) target.geometry.computeBoundingSphere();
  const local = target.geometry.boundingSphere.center.clone();
  const world = target.localToWorld(local);
  const proj = world.clone().project(edu.camera);
  const w = window.innerWidth, h = window.innerHeight;
  return {
    name: target.name,
    world: [world.x, world.y, world.z],
    x: (proj.x + 1) * 0.5 * w,
    y: (1 - proj.y) * 0.5 * h,
  };
});
console.log('click calf at:', clickCalf);
await page.waitForTimeout(500);

if (clickCalf) {
  await page.mouse.move(clickCalf.x, clickCalf.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(500);
}
await page.screenshot({ path: '/tmp/muscle-click-calf.png' });

const infoCalf = await page.evaluate(() => {
  const el = document.getElementById('info-panel');
  return { visible: el?.classList.contains('visible'), text: el?.textContent?.trim()?.slice(0, 600) };
});
console.log('info panel after calf click:', JSON.stringify(infoCalf, null, 2));

await browser.close();
