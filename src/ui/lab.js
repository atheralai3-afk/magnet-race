import { h } from './dom.js';
import { icon } from './art.js';
import { enhance } from './motion.js';
import { PHYSICS, magnetPull } from '../physics/engine.js';
import { sound } from './sound.js';

// Physics Lab: one straight strip, one magnet, one car. Change the variables and watch
// F_pull vs friction decide whether the car moves. Same physics functions as the game.
export function labScreen() {
  const P = { strength: 1, dist: 4.5, mu: 0.2, mass: 50, shield: false };
  const strip = h('canvas.strip'), graph = h('canvas.graph');
  const out = { pull: h('b'), fric: h('b'), res: h('b'), acc: h('b') };
  const verdict = h('div.verdict');
  const runBtn = h('button.btn.green.sm', { onclick: () => release() }, h('div.ic.s', { html: icon('play', 20) }), h('div.txt', h('div.t1', 'Release the car')));
  const resetBtn = h('button.btn.clear.sm', { onclick: () => reset() }, h('div.txt', h('div.t1', 'Reset')));
  const shieldSw = h('div.switch');
  const sliders = [
    slider('strength', 'Magnet strength', 0.5, 2, 0.05, v => `×${v.toFixed(2)}`),
    slider('dist', 'Starting gap', 1.5, 10, 0.1, v => `${v.toFixed(1)} cm`),
    slider('mu', 'Surface friction μ', 0.1, 0.8, 0.05, v => `${v.toFixed(2)} ${v >= 0.55 ? '(sandpaper)' : v <= 0.25 ? '(smooth)' : ''}`),
    slider('mass', 'Car mass', 20, 100, 5, v => `${v} g`),
  ];
  function slider(key, label, min, max, step, fmt) {
    const val = h('b', fmt(P[key]));
    const input = h('input', { type: 'range', min, max, step, value: P[key], 'aria-label': label, oninput: e => { P[key] = +e.target.value; val.textContent = fmt(P[key]); paint(e.target); reset(); } });
    const paint = (el) => el.style.setProperty('--p', ((el.value - min) / (max - min) * 100) + '%'); paint(input);
    return h('div.slider', h('div.k', h('span', label), val), input);
  }
  const wrap = h('div.menu-wrap',
    h('div.labhead', h('div', h('h1', 'Physics Lab'), h('div.sub', 'The same equations the game uses. Change one thing at a time.'))),
    h('div.lab',
      h('div.glass.stage', strip, graph, h('div.row', { style: { marginTop: '16px', gap: '12px', flexWrap: 'wrap' } }, runBtn, resetBtn, h('span.sub', { style: { fontSize: '13.5px' } }, 'Graph: pull (green) vs friction (orange). The car moves where green is above orange.'))),
      h('div.glass.ctl',
        h('h3', 'Variables'), sliders,
        h('button.row', { style: { marginTop: '18px', width: '100%', justifyContent: 'space-between' }, onclick: () => { P.shield = !P.shield; shieldSw.classList.toggle('on', P.shield); reset(); } }, h('span', { style: { fontWeight: 600 } }, 'Steel shield in the way'), shieldSw),
        h('div.readout', h('div', out.pull, h('span', 'Magnetic pull')), h('div', out.fric, h('span', 'Max friction μmg')), h('div', out.res, h('span', 'Resultant force')), h('div', out.acc, h('span', 'Acceleration F = ma'))),
        verdict)));
  enhance(wrap);

  const params = () => ({ ...PHYSICS, magnetK: PHYSICS.magnetK * P.strength });
  const pullAt = (dm) => magnetPull(dm, params()) * (P.shield ? PHYSICS.screenFactor : 1);
  const friction = () => P.mu * (P.mass / 1000) * PHYSICS.g;
  // car state along the strip (metres): magnet fixed at 0.16 m from the left edge of a 0.2 m strip
  const MAG_X = 0.165;
  let car = { x: MAG_X - P.dist / 100, v: 0, running: false, stuck: false };
  function reset() { car = { x: MAG_X - P.dist / 100, v: 0, running: false, stuck: false }; runBtn.disabled = false; update(); }
  function release() { if (car.stuck) reset(); car.running = true; runBtn.disabled = true; sound.click(); }
  function update() {
    const d = MAG_X - car.x, pull = pullAt(d), fr = friction(), m = P.mass / 1000;
    const moving = car.v > 1e-4 || pull > fr;
    const res = moving ? Math.max(0, pull - fr - PHYSICS.rolling * car.v) : 0;
    out.pull.textContent = `${pull.toFixed(3)} N`; out.fric.textContent = `${fr.toFixed(3)} N`; out.res.textContent = `${res.toFixed(3)} N`; out.acc.textContent = `${(res / m).toFixed(2)} m/s²`;
    if (car.stuck) { verdict.className = 'verdict stick'; verdict.textContent = `Stuck! Within ${PHYSICS.stickDist * 100} cm the pull (${pull.toFixed(2)} N) is far bigger than friction, so the car jumps onto the magnet.`; }
    else if (pull > fr) { verdict.className = 'verdict go'; verdict.textContent = `It moves: pull ${pull.toFixed(2)} N > friction ${fr.toFixed(2)} N. Resultant ${(pull - fr).toFixed(2)} N, so a = F/m = ${((pull - fr) / m).toFixed(1)} m/s².`; }
    else { verdict.className = 'verdict stop'; verdict.textContent = `It stays still: pull ${pull.toFixed(2)} N ≤ friction ${fr.toFixed(2)} N. ${P.shield ? 'The steel shield is screening the field. ' : ''}Move the magnet closer or reduce μ.`; }
  }
  // ------------- drawing
  const cx1 = strip.getContext('2d'), cx2 = graph.getContext('2d');
  function size(c) { const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); } return { w: r.width, h: r.height, dpr }; }
  function drawStrip() {
    const { w, h: H, dpr } = size(strip), c = cx1; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, H);
    const L = 0.2, sx = (x) => 24 + x / L * (w - 48), y = H * .62;
    // surface
    const sand = P.mu >= 0.45; c.fillStyle = sand ? '#C99E5C' : '#4A505E'; rr(c, 16, y - 24, w - 32, 48, 14); c.fill();
    if (sand) { c.fillStyle = 'rgba(120,80,30,.5)'; for (let i = 0; i < 120; i++) c.fillRect(20 + (i * 53 % (w - 40)), y - 20 + (i * 29 % 40), 2, 2); }
    // ruler
    c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 11px Inter, system-ui'; c.textAlign = 'center';
    for (let cm = 0; cm <= 20; cm++) { const x = sx(cm / 100); c.fillRect(x, y + 30, 1, cm % 5 ? 5 : 10); if (cm % 5 === 0) c.fillText(cm + ' cm', x, y + 54); }
    // shield
    if (P.shield) { const xs = sx(MAG_X - 0.008); const g = c.createLinearGradient(xs - 5, 0, xs + 5, 0); g.addColorStop(0, '#F2F3F7'); g.addColorStop(1, '#7C8492'); c.fillStyle = g; rr(c, xs - 5, y - 46, 10, 92, 4); c.fill(); }
    // magnet above the board
    const mx = sx(MAG_X); drawMagnet(c, mx, y - 70);
    c.save(); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,59,48,.6)'; c.beginPath(); c.moveTo(sx(MAG_X - PHYSICS.stickDist), y - 30); c.lineTo(sx(MAG_X - PHYSICS.stickDist), y + 26); c.stroke(); c.restore();
    // field lines from magnet to car
    const carX = sx(car.x), d = MAG_X - car.x, pull = pullAt(d), fr = friction();
    c.save(); c.setLineDash([5, 5]); c.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) { c.strokeStyle = `rgba(158,156,255,${(P.shield ? .25 : .7) - Math.abs(k) * .1})`; c.beginPath(); c.moveTo(mx, y - 52); c.quadraticCurveTo((mx + carX) / 2, y - 44 + k * 16, carX + 18, y - 4 + k * 3); c.stroke(); }
    c.restore();
    drawCar(c, carX, y);
    // force arrows (scaled 0.5 N = 120 px)
    const k = 240; arrow(c, carX + 22, y - 2, carX + 22 + Math.min(pull, 1) * k, y - 2, '#34C759', `Pull ${pull.toFixed(2)} N`, -1);
    const frShow = car.v > 1e-4 || pull > fr ? fr : Math.min(pull, fr);
    if (frShow > 0.002) arrow(c, carX - 22, y + 12, carX - 22 - frShow * k, y + 12, '#FF9F0A', `Friction ${frShow.toFixed(2)} N`, 1);
    c.fillStyle = 'rgba(255,255,255,.8)'; c.textAlign = 'left'; c.font = '700 13px Inter, system-ui'; c.fillText(`Gap ${(d * 100).toFixed(1)} cm · speed ${(car.v * 100).toFixed(0)} cm/s`, 22, 26);
  }
  function drawGraph() {
    const { w, h: H, dpr } = size(graph), c = cx2; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, H);
    const pad = { l: 54, r: 18, t: 18, b: 38 }, X = (cm) => pad.l + (cm - 1) / 9 * (w - pad.l - pad.r), maxF = 0.8, Y = (f) => H - pad.b - Math.min(f, maxF) / maxF * (H - pad.t - pad.b);
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.fillStyle = 'rgba(255,255,255,.65)'; c.font = '600 11px Inter, system-ui'; c.lineWidth = 1;
    for (let f = 0; f <= maxF + 1e-9; f += 0.2) { c.beginPath(); c.moveTo(pad.l, Y(f)); c.lineTo(w - pad.r, Y(f)); c.stroke(); c.textAlign = 'right'; c.fillText(f.toFixed(1) + ' N', pad.l - 8, Y(f) + 4); }
    const narrow = w < 520;
    for (let cm = 1; cm <= 10; cm++) { if (narrow && cm % 2) continue; c.textAlign = 'center'; c.fillText(cm + ' cm', X(cm), H - pad.b + 18); }
    c.textAlign = 'left'; c.fillText('distance from magnet →', pad.l, H - 4);
    // stick zone
    c.fillStyle = 'rgba(255,59,48,.16)'; c.fillRect(X(1), pad.t, X(PHYSICS.stickDist * 100) - X(1), H - pad.t - pad.b);
    // moving region shading
    const fr = friction(); c.fillStyle = 'rgba(52,199,89,.16)'; c.beginPath(); let started = false;
    for (let cm = 1; cm <= 10; cm += 0.05) { const f = pullAt(cm / 100); if (f > fr) { if (!started) { c.moveTo(X(cm), Y(fr)); started = true; } c.lineTo(X(cm), Y(f)); } }
    if (started) { let last = 1; for (let cm = 1; cm <= 10; cm += 0.05) if (pullAt(cm / 100) > fr) last = cm; c.lineTo(X(last), Y(fr)); c.closePath(); c.fill(); }
    // curves
    c.lineWidth = 3; c.strokeStyle = '#34C759'; c.beginPath(); for (let cm = 1; cm <= 10; cm += 0.05) { const p = [X(cm), Y(pullAt(cm / 100))]; cm === 1 ? c.moveTo(...p) : c.lineTo(...p); } c.stroke();
    c.strokeStyle = '#FF9F0A'; c.beginPath(); c.moveTo(X(1), Y(fr)); c.lineTo(X(10), Y(fr)); c.stroke();
    // marker at current gap
    const d = (MAG_X - car.x) * 100; if (d >= 1 && d <= 10) { const f = pullAt(d / 100); c.fillStyle = '#fff'; c.beginPath(); c.arc(X(d), Y(f), 6, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.setLineDash([3, 3]); c.lineWidth = 1; c.beginPath(); c.moveTo(X(d), Y(f)); c.lineTo(X(d), H - pad.b); c.stroke(); c.setLineDash([]); }
    // reach label
    let reach = null; for (let cm = 10; cm >= 1; cm -= 0.05) if (pullAt(cm / 100) > fr) { reach = cm; break; }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '700 13px Inter, system-ui'; c.textAlign = 'right';
    c.fillText(reach ? (narrow ? `Starts the car from ≤ ${reach.toFixed(1)} cm` : `The magnet can start the car from up to ${reach.toFixed(1)} cm away`) : 'Too weak: the car never moves', w - pad.r, pad.t + 14);
  }
  function drawMagnet(c, x, y) {
    c.save(); c.translate(x, y); const s = 22;
    c.lineWidth = 12; c.lineCap = 'butt';
    c.strokeStyle = '#FF3B30'; c.beginPath(); c.arc(0, 0, s, Math.PI, Math.PI * 1.5); c.stroke(); c.beginPath(); c.moveTo(-s, 0); c.lineTo(-s, 18); c.stroke();
    c.strokeStyle = '#0A84FF'; c.beginPath(); c.arc(0, 0, s, Math.PI * 1.5, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(s, 0); c.lineTo(s, 18); c.stroke();
    c.fillStyle = '#D1D1D6'; c.fillRect(-s - 6, 18, 12, 8); c.fillRect(s - 6, 18, 12, 8); c.restore();
  }
  function drawCar(c, x, y) {
    c.save(); c.translate(x, y); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(2, 16, 26, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(-12, 10, 6, 0, 7); c.arc(12, 10, 6, 0, 7); c.fill();
    const g = c.createLinearGradient(0, -14, 0, 8); g.addColorStop(0, '#FF6B5E'); g.addColorStop(1, '#C81E1E'); c.fillStyle = g; rr(c, -22, -10, 44, 18, 6); c.fill();
    c.fillStyle = '#9FD3FF'; rr(c, -8, -18, 18, 10, 4); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '700 9px Inter'; c.textAlign = 'center'; c.fillText(`${P.mass} g`, 0, 4); c.restore();
  }
  function arrow(c, x1, y1, x2, y2, col, label, side) {
    if (Math.abs(x2 - x1) < 3) return; const a = Math.atan2(y2 - y1, x2 - x1);
    c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * 6, y2); c.stroke();
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(a - .5) * 10, y2 - Math.sin(a - .5) * 10); c.lineTo(x2 - Math.cos(a + .5) * 10, y2 - Math.sin(a + .5) * 10); c.fill();
    c.font = '700 12px Inter, system-ui'; c.textAlign = 'center'; c.fillText(label, (x1 + x2) / 2, y1 + side * 20 + (side > 0 ? 6 : 0)); c.restore();
  }
  function rr(c, x, y, w, h2, r) { r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h2) / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h2, r); c.arcTo(x + w, y + h2, x, y + h2, r); c.arcTo(x, y + h2, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // ------------- loop
  let last = performance.now(), raf;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (car.running && !car.stuck) {
      const m = P.mass / 1000; for (let i = 0; i < 4; i++) {
        const d = MAG_X - car.x, pull = pullAt(d), fr = friction(), sdt = dt / 4;
        if (car.v < 1e-4 && pull <= fr) { car.v = 0; car.running = false; break; }
        car.v = Math.max(0, car.v + (pull - fr - PHYSICS.rolling * car.v) / m * sdt); car.x += car.v * sdt;
        if (MAG_X - car.x < PHYSICS.stickDist && !P.shield) { car.stuck = true; car.x = MAG_X - 0.012; car.v = 0; sound.stick(); break; }
        if (P.shield && MAG_X - car.x < 0.014) { car.x = MAG_X - 0.014; car.v = 0; car.running = false; break; }
      }
      update();
    }
    drawStrip(); drawGraph();
    if (wrap.isConnected) raf = requestAnimationFrame(loop);
  }
  requestAnimationFrame(t => { last = t; update(); raf = requestAnimationFrame(loop); });
  return wrap;
}
