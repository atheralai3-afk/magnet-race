// Injected by the browser tests: plays like a careful player so the whole game loop can be
// exercised and recorded. Drives the magnet, rolls, answers cards and plays the pit stop.
window.__autopilot = function ({ wrongEvery = 0, answerDelay = 1300, rollDelay = 900, cursor = true } = {}) {
  window.__autoplay = true; // pit stops play themselves
  const mr = window.__mr, app = mr.app, T = mr.track, R = mr.renderer;
  let answered = 0, pending = null, rollAt = 0, cur = null;
  if (cursor) { cur = document.createElement('div'); cur.style.cssText = 'position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 0 3px rgba(0,0,0,.25),0 4px 10px rgba(0,0,0,.3);pointer-events:none;z-index:999;transition:left .12s,top .12s'; document.body.append(cur); }
  const at = (x, y) => { if (cur) { cur.style.left = x + 'px'; cur.style.top = y + 'px'; } };
  const lead = (c) => { const sand = T.surfaceAt(c.s) === 'sand' || T.surfaceAt(c.s + 0.02) === 'sand'; const L = (0.037 + Math.min(0.02, c.speed * 0.06)) * (sand ? 0.72 : 1); const p = T.pointAt(c.s + L); let ox = 0, oy = 0; for (const pl of T.plates()) if (T.forward(c.s, pl.s) < 0.08 || T.forward(pl.s, c.s) < 0.03) { ox = -pl.side * p.nx * 0.018; oy = -pl.side * p.ny * 0.018; } return { x: p.x + ox, y: p.y + oy }; };
  function step(now) {
    const m = mr.match;
    if (!m) return requestAnimationFrame(step);
    if (m.phase === 'over') { if (cur) cur.style.display = 'none'; return; }
    const qs = document.querySelector('.dim:not(.out) .opts, .dim:not(.out) .numrow');
    if (m.question && qs && !pending && app.q && app.q.drawId === m.question.view.drawId && !app.q._auto) {
      app.q._auto = true;
      const v = m.question.view, live = m.deck.live.get(v.drawId); answered++;
      const wrong = wrongEvery && answered % wrongEvery === 0;
      pending = setTimeout(() => {
        pending = null;
        if (v.type === 'num') { const inp = qs.querySelector('input'); inp.value = wrong ? '7' : String(live.q.answer); const b = qs.querySelector('.btn'); const r = b.getBoundingClientRect(); at(r.left + r.width / 2, r.top + r.height / 2); setTimeout(() => b.click(), 300); }
        else { const opts = qs.querySelectorAll('.opt'); const i = wrong ? (live.correctIndex + 1) % opts.length : live.correctIndex; const b = opts[i]; const r = b.getBoundingClientRect(); at(r.left + 60, r.top + r.height / 2); setTimeout(() => b.click(), 350); }
      }, answerDelay);
    }
    const rollBtn = [...document.querySelectorAll('.center .btn')].find(b => b.textContent.includes('Roll'));
    if (m.phase === 'roll' && rollBtn) { const r = rollBtn.getBoundingClientRect(); at(r.left + r.width / 2, r.top + r.height / 2); if (!rollAt) rollAt = now + rollDelay; if (now > rollAt) { rollAt = 0; rollBtn.click(); } }
    const busy = app.q || app.pit || document.querySelector('.dim:not(.out)');
    if (m.phase === 'turn' && !busy && m.current && app.inputIds.has(m.current.id)) {
      const c = m.car(m.current.id), p = lead(c);
      app.magnet = { x: p.x, y: p.y, active: true }; at(R.X(p.x), R.Y(p.y));
    } else if (m.phase !== 'turn') app.magnet = { ...app.magnet, active: false };
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};
