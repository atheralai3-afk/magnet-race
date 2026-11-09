// Apple-style motion: springs, magnetic buttons, glass tilt + sheen, press ripple, liquid tab lens.
// Call enhance(root) after building DOM; it wires every .mag / .tilt / [data-ripple] inside.

const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

class Spring {
  constructor(k = 320, d = 24) { this.k = k; this.d = d; this.x = {}; this.v = {}; this.t = {}; }
  set(key, val, init) { this.t[key] = val; if (!(key in this.x)) { this.x[key] = init ?? val; this.v[key] = 0; } }
  kick(key, vel) { this.v[key] = (this.v[key] || 0) + vel; }
  step(dt) {
    let moving = false;
    for (const k in this.t) {
      const f = -this.k * (this.x[k] - this.t[k]) - this.d * this.v[k];
      this.v[k] += f * dt; this.x[k] += this.v[k] * dt;
      if (Math.abs(this.v[k]) > 1e-3 || Math.abs(this.x[k] - this.t[k]) > 1e-3) moving = true;
      else { this.x[k] = this.t[k]; this.v[k] = 0; }
    }
    return moving;
  }
}

const live = new Set();
let last = 0, running = false;
function loop(now) {
  const dt = Math.min(0.032, (now - last) / 1000 || 0.016); last = now;
  for (const s of live) {
    if (!s.el.isConnected) { live.delete(s); continue; }
    const moving = s.step(dt / 2) | s.step(dt / 2);
    s.apply(s.x);
    if (!moving && !s.hot) live.delete(s);
  }
  if (live.size) requestAnimationFrame(loop); else running = false;
}
function wake(s) { live.add(s); if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
export function spring(el, apply, k, d) { const s = new Spring(k, d); s.el = el; s.apply = apply; s.wake = () => wake(s); return s; }

function magnetic(el) {
  if (el._mag) return; el._mag = true;
  const s = spring(el, x => { el.style.transform = `translate(${x.tx}px,${x.ty}px) perspective(800px) rotateX(${x.rx}deg) rotateY(${x.ry}deg) scale(${x.sc})`; }, 380, 22);
  ['tx', 'ty', 'rx', 'ry'].forEach(k => s.set(k, 0)); s.set('sc', 1);
  let down = false, hover = false;
  const big = () => el.offsetWidth > 260;
  el.addEventListener('pointermove', e => {
    if (el.disabled) return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    el.style.setProperty('--hx', (px + .5) * 100 + '%'); el.style.setProperty('--hy', (py + .5) * 100 + '%');
    if (reduce || e.pointerType !== 'mouse') return;
    const b = big(); s.set('tx', px * (b ? 10 : 7)); s.set('ty', py * (b ? 5 : 7) - 2); s.set('ry', px * (b ? 4 : 9)); s.set('rx', -py * (b ? 6 : 9));
    s.set('sc', down ? .95 : 1.025); s.wake();
  });
  el.addEventListener('pointerenter', e => { if (el.disabled || e.pointerType !== 'mouse') return; hover = true; s.set('sc', 1.025); s.wake(); });
  el.addEventListener('pointerleave', () => { hover = down = false; ['tx', 'ty', 'rx', 'ry'].forEach(k => s.set(k, 0)); s.set('sc', 1); s.wake(); });
  el.addEventListener('pointerdown', e => {
    if (el.disabled) return; down = true; s.set('sc', .94); s.wake();
    if (el.hasAttribute('data-ripple') || el.classList.contains('btn')) ripple(el, e);
  });
  const up = () => { if (!down) return; down = false; s.kick('sc', 2.5); s.set('sc', hover ? 1.025 : 1); s.wake(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

function ripple(el, e) {
  const r = el.getBoundingClientRect(), z = r.width / (el.offsetWidth || r.width) || 1;
  const rp = document.createElement('span'); rp.className = 'ripple';
  rp.style.left = (e.clientX - r.left) / z + 'px'; rp.style.top = (e.clientY - r.top) / z + 'px';
  el.appendChild(rp); setTimeout(() => rp.remove(), 750);
}

function tilt(el) {
  if (el._tilt) return; el._tilt = true;
  const s = spring(el, x => { el.style.transform = `perspective(1400px) rotateX(${x.rx}deg) rotateY(${x.ry}deg)`; }, 180, 20);
  s.set('rx', 0); s.set('ry', 0);
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    el.style.setProperty('--hx', (px + .5) * 100 + '%'); el.style.setProperty('--hy', (py + .5) * 100 + '%');
    if (reduce || e.pointerType !== 'mouse') return;
    s.set('ry', px * 3); s.set('rx', -py * 3); s.wake();
  });
  el.addEventListener('pointerleave', () => { s.set('rx', 0); s.set('ry', 0); s.wake(); });
}

export function enhance(root) {
  root.querySelectorAll('.mag, .btn').forEach(magnetic);
  root.querySelectorAll('.tilt').forEach(tilt);
  root.querySelectorAll('.mag, .btn, .tilt').forEach(el => { if (!el.querySelector(':scope > .sheen')) { const s = document.createElement('span'); s.className = 'sheen'; el.append(s); } });
  return root;
}

// Liquid glass lens that glides between tabs and stretches while it moves.
export function tabLens(bar, onSelect) {
  const lens = document.createElement('div'); lens.className = 'lens'; bar.prepend(lens);
  const tabs = [...bar.querySelectorAll('.tab')];
  let active = tabs.find(t => t.classList.contains('on')) || tabs[0];
  const s = spring(lens, x => { lens.style.left = x.l + 'px'; lens.style.width = x.w + 'px'; const st = 1 + Math.min(Math.abs(s.v.l || 0) / 2600, .14); lens.style.transform = `scale(${st * x.p},${(2 - st) * (2 - x.p)})`; }, 300, 22);
  s.hot = false;
  const place = (t, init) => { s.set('l', t.offsetLeft, init ? t.offsetLeft : undefined); s.set('w', t.offsetWidth, init ? t.offsetWidth : undefined); s.wake(); };
  s.set('p', 1);
  requestAnimationFrame(() => place(active, true));
  tabs.forEach(t => {
    t.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') place(t); });
    t.addEventListener('pointerdown', () => { s.set('p', 1.08); s.wake(); });
    t.addEventListener('click', () => { s.set('p', 1); active.classList.remove('on'); active = t; t.classList.add('on'); place(t); onSelect?.(t.dataset.tab); });
  });
  bar.addEventListener('pointerleave', () => { s.set('p', 1); place(active); });
  addEventListener('resize', () => place(active, true));
  return { select: (name) => { const t = tabs.find(x => x.dataset.tab === name); if (t) { active.classList.remove('on'); active = t; t.classList.add('on'); place(t); } } };
}

// Count-up number tween
export function tween(el, from, to, ms = 700, fmt = v => Math.round(v).toLocaleString('en-US')) {
  if (reduce) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  (function f(now) { const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(f); })(t0);
}

export const pointerFine = fine;
