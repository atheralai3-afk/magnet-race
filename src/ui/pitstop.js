import { h } from './dom.js';
import { openSheet } from './screens.js';
import { icon } from './art.js';
import { sound } from './sound.js';

// Charge Pit Stop: rub the balloon on the wool to charge it (electrons move wool -> balloon),
// then hold it over the paper. The charged balloon induces opposite charge on the near side of
// each neutral paper piece; when the attraction beats the paper's weight it jumps up and sticks.
const TIME = 12;          // seconds to play
const PIECES = 3;

export function pitStopSheet({ onDone }) {
  const canvas = h('canvas', { 'aria-label': 'Charge Pit Stop: drag the balloon' });
  const chargeFill = h('i'), chargePct = h('b', '0%'), countEl = h('div.glass.pill.pitcount', `Fuel 0 / ${PIECES}`), timeEl = h('b', `${TIME}s`);
  const doneBtn = h('button.btn.sm.clear', { onclick: () => finish() }, h('div.txt', h('div.t1', 'Done')));
  const tip = h('div.lead', 'Rub the balloon back and forth on the wool to charge it, then hold it just above the paper. Each piece you lift = +2 s.');
  const d = openSheet([h('div.row', { style: { gap: '14px' } }, h('div.ic', { style: { background: 'linear-gradient(135deg,#64D2FF,#0A84FF)' }, html: icon('bolt', 28) }), h('div', h('h2', 'Charge Pit Stop'), h('div.sub', { style: { fontSize: '14px', marginTop: '2px' } }, 'Static charge · ', timeEl, ' left'))),
    tip, h('div.pitstage', canvas),
    h('div.pithud', h('div.meter', h('div.k', h('span', 'Balloon charge'), chargePct), h('div.track', chargeFill)), countEl, doneBtn)],
    { dismissible: false, menu: false, cls: '.pit' });

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const S = { charge: 0, picked: 0, t: 0, over: false, balloon: { x: 0, y: 0 }, drag: null, rubbing: 0, sparks: [] };
  let pieces = [];
  function layout() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr;
    if (!pieces.length) {
      S.balloon = { x: W * .5, y: Math.max(H * .32, Math.min(58, W * .085) * 1.3 + 6) };
      pieces = Array.from({ length: PIECES }, (_, i) => ({ x: W * (.62 + i * .11), y: H - 34, r: (i - 1) * 12 * Math.PI / 180, state: 'rest', vx: 0, vy: 0, ox: 0, oy: 0 }));
    }
  }
  const cloth = () => ({ x: 22, y: H - 96, w: Math.min(W * .4, 300), h: 76 });
  const BR = () => Math.min(58, W * .085); // balloon radius x

  // ---------------- input
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => { if (S.over) return; canvas.setPointerCapture(e.pointerId); const p = pos(e); S.drag = { dx: S.balloon.x - p.x, dy: S.balloon.y - p.y }; if (Math.hypot(S.drag.dx, S.drag.dy) > 120) S.drag = { dx: 0, dy: 0 }; move(p); sound.click(); });
  canvas.addEventListener('pointermove', e => { if (S.drag) move(pos(e)); });
  const up = () => { S.drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function move(p) {
    const b = S.balloon, nx = Math.max(BR(), Math.min(W - BR(), p.x + S.drag.dx)), ny = Math.max(60, Math.min(H - 70, p.y + S.drag.dy));
    const c = cloth(), bottom = ny + BR() * 1.15;
    // rubbing = moving while the bottom of the balloon touches the wool
    if (bottom > c.y + 6 && nx > c.x && nx < c.x + c.w) { const dist = Math.hypot(nx - b.x, ny - b.y); S.charge = Math.min(1, S.charge + dist * 0.0016); S.rubbing = 0.25; if (Math.random() < dist * 0.02) S.sparks.push({ x: nx + (Math.random() - .5) * 40, y: c.y + 10, life: .4 }); }
    b.x = nx; b.y = ny;
  }

  // ---------------- simulation
  function step(dt) {
    if (S.over) return;
    S.t += dt; S.rubbing = Math.max(0, S.rubbing - dt);
    if (S.rubbing > 0) sound.crackle(S.charge);
    S.charge = Math.max(0, S.charge - dt * 0.015); // charge slowly leaks into the air
    const b = S.balloon, br = BR(), bottom = { x: b.x, y: b.y + br * 1.15 };
    for (const p of pieces) {
      if (p.state === 'rest') {
        const d = Math.hypot(p.x - bottom.x, p.y - bottom.y);
        p.near = d < 60 + 200 * S.charge ? 1 - d / (60 + 200 * S.charge) : 0;
        const pull = S.charge * 1.4 / Math.max(0.25, (d / 100) ** 2); // ~inverse square
        if (pull > 1 && S.charge > 0.12) { p.state = 'fly'; sound.pickup(); }
      } else if (p.state === 'fly') {
        const tx = bottom.x + (pieces.indexOf(p) - 1) * br * .55, ty = bottom.y - 8;
        const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
        p.vx += dx / dist * 2600 * dt; p.vy += dy / dist * 2600 * dt; p.vx *= .9; p.vy *= .9;
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6;
        if (dist < 14) { p.state = 'stuck'; p.ox = p.x - b.x; p.oy = p.y - b.y; S.picked++; S.charge = Math.max(0, S.charge - 0.1); countEl.textContent = `Fuel ${S.picked} / ${PIECES}`; countEl.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.34,1.56,.64,1)' }); sound.correct(); navigator.vibrate?.(20); if (S.picked >= PIECES) setTimeout(finish, 700); }
      } else { p.x = b.x + p.ox; p.y = b.y + p.oy; }
    }
    for (const s of S.sparks) s.life -= dt; S.sparks = S.sparks.filter(s => s.life > 0);
    const left = Math.max(0, TIME - S.t); timeEl.textContent = `${Math.ceil(left)}s`;
    chargeFill.style.width = S.charge * 100 + '%'; chargePct.textContent = Math.round(S.charge * 100) + '%';
    if (left <= 0) finish();
  }

  // ---------------- drawing
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // table
    const tg = ctx.createLinearGradient(0, H - 60, 0, H); tg.addColorStop(0, '#6B4A2E'); tg.addColorStop(1, '#4A321F');
    ctx.fillStyle = tg; ctx.fillRect(0, H - 44, W, 44); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, H - 44, W, 2);
    // wool cloth with + charges (it lost electrons)
    const c = cloth();
    ctx.save(); rr(c.x, c.y, c.w, c.h, 16); const cg = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h); cg.addColorStop(0, '#E5484D'); cg.addColorStop(1, '#B4232B'); ctx.fillStyle = cg; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; for (let x = c.x - c.h; x < c.x + c.w; x += 10) { ctx.beginPath(); ctx.moveTo(x, c.y + c.h); ctx.lineTo(x + c.h, c.y); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '600 13px Inter, system-ui'; ctx.textAlign = 'left'; ctx.fillText('Wool cloth', c.x + 12, c.y + 22);
    const plus = Math.round(S.charge * 10); ctx.font = '800 16px Inter, system-ui';
    for (let i = 0; i < plus; i++) ctx.fillText('+', c.x + 14 + (i % 5) * (c.w - 30) / 5, c.y + 46 + Math.floor(i / 5) * 18);
    // paper pieces with induced charge separation
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 13px Inter, system-ui'; ctx.textAlign = 'center';
    if (pieces.some(p => p.state === 'rest')) ctx.fillText('Paper fuel (neutral)', W * .73, H - 64);
    for (const p of pieces) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-15, -9, 32, 22);
      ctx.fillStyle = '#fff'; ctx.fillRect(-16, -11, 32, 22); ctx.strokeStyle = '#D1D1D6'; ctx.strokeRect(-16, -11, 32, 22);
      ctx.strokeStyle = '#C7C7CC'; ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(10, -3); ctx.moveTo(-10, 3); ctx.lineTo(4, 3); ctx.stroke();
      if (p.state !== 'rest' || p.near > 0.05) { // induced: + on the side near the balloon, - on the far side
        ctx.font = '800 11px Inter, system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = '#E5484D'; ctx.fillText('+ +', 0, -1 - 0); ctx.fillStyle = '#0A84FF'; ctx.fillText('– –', 0, 10);
      }
      ctx.restore();
    }
    // field hint between balloon and nearest paper
    const b = S.balloon, br = BR();
    for (const p of pieces) if (p.state === 'rest' && p.near > 0.05) { ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = `rgba(158,156,255,${p.near})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y + br * 1.15); ctx.lineTo(p.x, p.y - 10); ctx.stroke(); ctx.restore(); }
    // string + balloon
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.x, b.y + br * 1.25); ctx.bezierCurveTo(b.x - 14, b.y + br * 1.7, b.x + 14, b.y + br * 2, b.x, b.y + br * 2.4); ctx.stroke();
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    const g = ctx.createRadialGradient(b.x - br * .35, b.y - br * .45, br * .1, b.x, b.y, br * 1.3); g.addColorStop(0, '#8CCBFF'); g.addColorStop(.55, '#0A84FF'); g.addColorStop(1, '#0050B8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x, b.y, br, br * 1.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#0050B8'; ctx.beginPath(); ctx.moveTo(b.x - 6, b.y + br * 1.15); ctx.lineTo(b.x + 6, b.y + br * 1.15); ctx.lineTo(b.x + 3, b.y + br * 1.27); ctx.lineTo(b.x - 3, b.y + br * 1.27); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(b.x - br * .38, b.y - br * .45, br * .18, br * .3, -.5, 0, Math.PI * 2); ctx.fill();
    // electrons on the balloon
    const minus = Math.round(S.charge * 14); ctx.fillStyle = '#fff';
    for (let i = 0; i < minus; i++) { const a = i * 2.39996, rr2 = br * .62 * Math.sqrt((i + .5) / 14); ctx.fillRect(b.x + Math.cos(a) * rr2 - 6, b.y + Math.sin(a) * rr2 * 1.15 - 1.5, 12, 3); }
    if (S.charge > .02 && S.charge < .12 && S.t > 1) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '600 13px Inter, system-ui'; ctx.textAlign = 'center'; ctx.fillText('Keep rubbing…', b.x, b.y - br * 1.35); }
    for (const s of S.sparks) { ctx.fillStyle = `rgba(255,224,102,${s.life * 2.5})`; ctx.beginPath(); ctx.arc(s.x, s.y - (0.4 - s.life) * 60, 3, 0, 7); ctx.fill(); }
  }
  function rr(x, y, w, h2, r) { r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h2) / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  let last = performance.now(), raf;
  function loop(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; if (!W) layout(); step(dt); draw(); if (d.isConnected) raf = requestAnimationFrame(loop); }
  requestAnimationFrame(() => { layout(); raf = requestAnimationFrame(loop); });
  const onResize = () => { const ob = { ...S.balloon }; layout(); S.balloon = ob; };
  addEventListener('resize', onResize);

  function finish() {
    if (S.over) return; S.over = true; doneBtn.disabled = true;
    tip.textContent = S.picked ? `+${S.picked * 2} s! The charged balloon induced opposite charge on the near side of the paper, so attraction beat the paper's weight.` : 'No fuel this time. Rub harder: more electrons on the balloon = a stronger pull on the paper.';
    setTimeout(() => { removeEventListener('resize', onResize); cancelAnimationFrame(raf); d.close(true); onDone(S.picked); }, 1700);
  }

  // scripted play for tests and demo videos: rub, then visit each paper piece
  d.autoplay = () => {
    const plan = []; const c = () => cloth();
    plan.push(() => ({ x: c().x + c().w / 2, y: c().y - BR() * 1.15 + 26 }));
    for (let i = 0; i < 12; i++) plan.push(() => ({ x: c().x + 40 + (i % 2) * (c().w - 80), y: c().y - BR() * 1.15 + 26 }));
    for (const p of pieces) plan.push(() => ({ x: p.x, y: H * .45 }), () => ({ x: p.x, y: p.y - BR() * 1.6 }));
    let k = 0; S.drag = { dx: 0, dy: 0 };
    const iv = setInterval(() => {
      if (S.over || k >= plan.length * 14) { clearInterval(iv); S.drag = null; if (!S.over) finish(); return; }
      const target = plan[Math.floor(k / 14)](), b = S.balloon; move({ x: b.x + (target.x - b.x) * .28, y: b.y + (target.y - b.y) * .28 }); k++;
    }, 30);
  };
  return d;
}
