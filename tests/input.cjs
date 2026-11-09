// Regression test with REAL pointer input (no autopilot): rolling shows the dice, pressing on the track
// lowers the magnet, and dragging it pulls the car. usage: node tests/input.cjs [url]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const url = process.argv[2] || 'file://' + require('path').resolve(__dirname, '../dist/magnet-race.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let fail = 0; const ok = (c, n) => { console.log((c ? '✓ ' : '✗ ') + n); if (!c) fail++; };
  for (const [vp, touch] of [[{ width: 1280, height: 760 }, false], [{ width: 844, height: 390 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForTimeout(1000);
    await p.click('text=Solo'); await p.waitForTimeout(600); await p.click('text=Roll the dice'); await p.waitForTimeout(1000);
    const dice = await p.evaluate(() => { const ds = [...document.querySelectorAll('.bigdice .die')]; const ev = window.__mr.match.log.find(e => e.type === 'dice'); return { shown: ds.length === 2 && ds.every(d => d.getBoundingClientRect().width > 30 && d.querySelector('i.on').getBoundingClientRect().width > 5), pips: ds.map(d => d.querySelectorAll('i.on').length), a: ev.a, b: ev.b }; });
    ok(dice.shown && dice.pips[0] === dice.a && dice.pips[1] === dice.b, `${vp.width}px: dice shown with the right pips (${dice.a} + ${dice.b})`);
    const pt = await p.evaluate(() => { const m = window.__mr.match, c = m.car(m.current.id), T = window.__mr.track, R = window.__mr.renderer; const q = T.pointAt(c.s + 0.035); return { x: R.X(q.x), y: R.Y(q.y) }; });
    const startS = await p.evaluate(() => window.__mr.match.car('p1').s);
    if (touch) {
      const cdp = await ctx.newCDPSession(p); const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await tp('touchStart', pt.x, pt.y); await p.waitForTimeout(150);
      ok(await p.evaluate(() => window.__mr.app.magnet.active), `${vp.width}px: pressing the track lowers the magnet (touch)`);
      for (let i = 0; i < 40; i++) { const q = await p.evaluate(() => { const m = window.__mr.match, c = m.car('p1'), T = window.__mr.track, R = window.__mr.renderer; const q = T.pointAt(c.s + 0.035); return { x: R.X(q.x), y: R.Y(q.y) }; }); await tp('touchMove', q.x, q.y); await p.waitForTimeout(40); }
      await tp('touchEnd');
    } else {
      await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.waitForTimeout(150);
      ok(await p.evaluate(() => window.__mr.app.magnet.active), `${vp.width}px: pressing the track lowers the magnet (mouse)`);
      for (let i = 0; i < 40; i++) { const q = await p.evaluate(() => { const m = window.__mr.match, c = m.car('p1'), T = window.__mr.track, R = window.__mr.renderer; const q = T.pointAt(c.s + 0.035); return { x: R.X(q.x), y: R.Y(q.y) }; }); await p.mouse.move(q.x, q.y); await p.waitForTimeout(40); }
      await p.mouse.up();
    }
    const st = await p.evaluate(s0 => { const m = window.__mr.match, T = window.__mr.track; return { moved: T.forward(s0, m.car('p1').s), started: m.turn?.started ?? true, dice: document.querySelectorAll('.bigdice').length }; }, startS);
    ok(st.moved > 0.03, `${vp.width}px: dragging the magnet pulls the car (${(st.moved * 100).toFixed(1)} cm)`);
    ok(st.started && st.dice === 0, `${vp.width}px: timer started and dice box cleared once driving`);
    ok(!errs.length, `${vp.width}px: no page errors ${errs.join(' ')}`);
    await ctx.close();
  }
  await b.close(); process.exit(fail ? 1 : 0);
})();
