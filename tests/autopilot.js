// Injected into the page by the browser tests: drives the magnet like a careful player
// and answers cards, so the full game loop can be exercised and recorded.
window.__autopilot = function ({ wrongEvery = 0, answerDelay = 1400, rollDelay = 900, cursor = true } = {}) {
  const mr = window.__mr, app = mr.app, T = mr.track, R = mr.renderer;
  let answered = 0, pending = null, rollAt = 0, cur = null;
  if (cursor) { cur = document.createElement('div'); cur.style.cssText = 'position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 3px rgba(0,0,0,.25),0 4px 10px rgba(0,0,0,.3);pointer-events:none;z-index:99;transition:transform .12s'; document.body.append(cur); }
  function step(now) {
    const m = mr.match; if (!m) return requestAnimationFrame(step);
    const sheet = document.querySelector('.sheet');
    if (m.phase === 'over') { if (cur) cur.style.display = 'none'; return; }
    if (m.question && sheet && !pending) {
      const v = m.question.view, live = m.deck.live.get(v.drawId); answered++;
      const wrong = wrongEvery && answered % wrongEvery === 0;
      pending = setTimeout(() => {
        pending = null;
        if (v.type === 'num') { const inp = sheet.querySelector('input'); inp.value = wrong ? '7' : String(live.q.answer); sheet.querySelector('.btn').click(); }
        else { const opts = sheet.querySelectorAll('.opt'); const i = wrong ? (live.correctIndex + 1) % opts.length : live.correctIndex; const b = opts[i]; if (cur) { const r = b.getBoundingClientRect(); cur.style.left = r.left + 40 + 'px'; cur.style.top = r.top + r.height / 2 + 'px'; } setTimeout(() => b.click(), 350); }
      }, answerDelay);
    }
    const rollBtn = [...document.querySelectorAll('.center .btn')].find(b => b.textContent.includes('Roll'));
    if (m.phase === 'roll' && rollBtn) { if (!rollAt) rollAt = now + rollDelay; if (now > rollAt) { rollAt = 0; rollBtn.click(); } if (cur) { const r = rollBtn.getBoundingClientRect(); cur.style.left = r.left + r.width / 2 + 'px'; cur.style.top = r.top + r.height / 2 + 'px'; } }
    if (m.phase === 'turn' && !m.question && !document.querySelector('.dim')) {
      const c = m.car(m.current.id); const lead = 0.037 + Math.min(0.02, c.speed * 0.06);
      const p = T.pointAt(c.s + lead); let ox = 0, oy = 0;
      for (const pl of T.plates()) { if (T.forward(c.s, pl.s) < 0.08 || T.forward(pl.s, c.s) < 0.03) { ox = -pl.side * p.nx * 0.018; oy = -pl.side * p.ny * 0.018; } }
      const sand = T.surfaceAt(c.s) === 'sand' || T.surfaceAt(c.s + 0.02) === 'sand';
      const k = sand ? 0.72 : 1; // bring the magnet closer over sandpaper
      const q = T.pointAt(c.s + lead * k);
      app.magnet = { x: (sand ? q.x : p.x) + ox, y: (sand ? q.y : p.y) + oy, active: true };
      if (cur) { cur.style.left = R.X(app.magnet.x) + 'px'; cur.style.top = R.Y(app.magnet.y) + 'px'; }
    } else if (m.phase !== 'turn') app.magnet = { ...app.magnet, active: false };
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};
