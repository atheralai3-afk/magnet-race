// Browser end-to-end test: plays a full Pass & Play game with the autopilot.
// usage: node tests/e2e.cjs [--video out.webm]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..');
(async () => {
  const video = process.argv.includes('--video');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(video ? { recordVideo: { dir: '/tmp/mrvid', size: { width: 1280, height: 800 } } } : {}) });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + root + '/index.html' + (process.env.LAPS ? '?laps=' + process.env.LAPS : '')); await page.waitForTimeout(1200);
  await page.click('text=Pass & Play'); await page.waitForTimeout(500);
  const inputs = await page.$$('.names input'); await inputs[0].fill('Aziz'); await inputs[1].fill('Malika');
  await page.waitForTimeout(400);
  await page.click('text=Start race'); await page.waitForTimeout(600);
  await page.addScriptTag({ path: path.join(__dirname, 'autopilot.js') });
  await page.evaluate(() => window.__autopilot({ wrongEvery: 5 }));
  const t0 = Date.now(); let shots = 0;
  while (Date.now() - t0 < 240000) {
    const st = await page.evaluate(() => ({ phase: window.__mr.match?.phase }));
    if (st.phase === 'over') break;
    if (!video && Date.now() - t0 > 6000 * (shots + 1) && shots < 3) await page.screenshot({ path: `/tmp/mr_shot${shots++}.png` });
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/mr_end.png' });
  const st = await page.evaluate(() => { const m = window.__mr.match; const types = {}; m.log.forEach(e => types[e.type] = (types[e.type] || 0) + 1); return { phase: m.phase, players: m.snapshot().players.map(p => ({ name: p.name, score: p.score, lap: p.lap })), events: types, seconds: Math.round(m.time) }; });
  console.log(JSON.stringify(st, null, 1));
  console.log('page errors:', errors.length ? errors : 'none');
  await ctx.close(); await browser.close();
  if (st.phase !== 'over' || errors.length) process.exit(1);
})();
