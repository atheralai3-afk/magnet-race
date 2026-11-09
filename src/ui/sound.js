// Synthesised UI sounds (Web Audio) — no files to load. Starts on the first user gesture.
let ctx = null, master = null, hum = null, muted = false;
try { muted = localStorage.getItem('mr.muted') === '1'; } catch {}

function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
  return ctx;
}
addEventListener('pointerdown', () => { const c = ac(); if (c && c.state === 'suspended') c.resume(); }, { capture: true });

function tone({ f = 440, f2 = null, type = 'sine', t = 0.15, v = 0.3, delay = 0, attack = 0.005 }) {
  const c = ac(); if (!c || muted) return;
  const o = c.createOscillator(), g = c.createGain(), now = c.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f, now); if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + attack); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + t + 0.02);
}
function noise({ t = 0.1, v = 0.2, delay = 0, hp = 1200 }) {
  const c = ac(); if (!c || muted) return;
  const len = Math.max(1, Math.floor(c.sampleRate * t)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), now = c.currentTime + delay;
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = v; s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(now);
}
let lastCrackle = 0;
export const sound = {
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('mr.muted', muted ? '1' : '0'); } catch {} if (master) master.gain.value = muted ? 0 : 0.5; if (muted) this.hum(0); return !muted; },
  click() { tone({ f: 900, f2: 600, t: 0.05, v: 0.12, type: 'triangle' }); },
  pop() { tone({ f: 420, f2: 840, t: 0.12, v: 0.2, type: 'sine' }); },
  dice() { for (let i = 0; i < 6; i++) noise({ t: 0.04, v: 0.25 - i * 0.03, delay: i * 0.07 + Math.random() * 0.03, hp: 1800 }); tone({ f: 660, t: 0.1, v: 0.12, delay: 0.5, type: 'triangle' }); },
  correct() { [659, 880, 1175].forEach((f, i) => tone({ f, t: 0.22, v: 0.2, delay: i * 0.08, type: 'triangle' })); },
  wrong() { tone({ f: 220, f2: 140, t: 0.35, v: 0.25, type: 'sawtooth' }); tone({ f: 233, f2: 150, t: 0.35, v: 0.12, type: 'square', delay: 0.02 }); },
  checkpoint() { tone({ f: 1046, t: 0.12, v: 0.12, type: 'sine' }); },
  lap() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, t: 0.18, v: 0.18, delay: i * 0.09, type: 'triangle' })); },
  fanfare() { [[523, 0], [659, .12], [784, .24], [1046, .36], [784, .56], [1046, .68]].forEach(([f, d]) => tone({ f, t: d === .68 ? 0.6 : 0.16, v: 0.2, delay: d, type: 'triangle' })); },
  fall() { tone({ f: 600, f2: 90, t: 0.55, v: 0.22, type: 'sine' }); },
  stick() { tone({ f: 180, t: 0.08, v: 0.3, type: 'square' }); noise({ t: 0.06, v: 0.3, hp: 600 }); },
  fuel() { [784, 988, 1318].forEach((f, i) => tone({ f, t: 0.14, v: 0.15, delay: i * 0.06, type: 'sine' })); },
  pickup() { tone({ f: 1200, f2: 2400, t: 0.12, v: 0.12, type: 'sine' }); },
  crackle(level) { const n = performance.now(); if (n - lastCrackle < 70) return; lastCrackle = n; noise({ t: 0.02, v: 0.05 + level * 0.15, hp: 3000 }); },
  // continuous magnet hum, louder with stronger pull
  hum(level) {
    const c = ac(); if (!c) return;
    if (!hum) { const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = 110; o2.frequency.value = 220; g.gain.value = 0; o.connect(g); o2.connect(g); g.connect(master); o.start(); o2.start(); hum = { o, o2, g }; }
    const v = muted ? 0 : Math.min(0.09, level * 0.12);
    hum.g.gain.setTargetAtTime(v, c.currentTime, 0.05); hum.o.frequency.setTargetAtTime(100 + level * 90, c.currentTime, 0.08); hum.o2.frequency.setTargetAtTime(200 + level * 180, c.currentTime, 0.08);
  },
};
export const haptic = (p) => { try { navigator.vibrate?.(p); } catch {} };
