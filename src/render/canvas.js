import { PHYSICS } from '../physics/engine.js';

const COLORS = { bg1: '#2A6BFF', bg2: '#5B2DD8', bg3: '#14123A', board: '#1A2443', board2: '#111A33', kerbR: '#FF3B30', asphalt: '#3A3F4B', asphalt2: '#4A505E', sand: '#D9B36E', steel: '#C9CED8', field: '#9E9CFF', pull: '#34C759', fric: '#FF9F0A' };
const ZONE_COLOR = { easy: '#34C759', medium: '#FF9500', hard: '#FF3B30' };

export class Renderer {
  constructor(canvas, track) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.track = track;
    this.physicsView = true; this.dpr = 1; this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr)); this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.w = r.width; this.h = r.height;
    const b = this.track.board, pad = 18;
    this.scale = Math.min((this.w - pad * 2) / b.w, (this.h - pad * 2) / b.h);
    this.ox = (this.w - b.w * this.scale) / 2 - b.x * this.scale; this.oy = (this.h - b.h * this.scale) / 2 - b.y * this.scale;
    this._buildPaths();
  }
  X(x) { return this.ox + x * this.scale; } Y(y) { return this.oy + y * this.scale; } S(m) { return m * this.scale; }
  toWorld(clientX, clientY) { const r = this.canvas.getBoundingClientRect(); return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale }; }
  _buildPaths() {
    const sp = this.track.spline, p = new Path2D();
    for (let i = 0; i < sp.count; i += 2) { const x = this.X(sp.xs[i]), y = this.Y(sp.ys[i]); i ? p.lineTo(x, y) : p.moveTo(x, y); }
    p.closePath(); this.trackPath = p;
    this.sandPaths = this.track.zonesOfType('sand').map(z => this._subPath(z.s, z.len));
  }
  _subPath(s0, len) {
    const p = new Path2D(); const n = Math.max(2, Math.round(len / 0.004));
    for (let i = 0; i <= n; i++) { const q = this.track.pointAt(s0 + len * i / n); i ? p.lineTo(this.X(q.x), this.Y(q.y)) : p.moveTo(this.X(q.x), this.Y(q.y)); }
    return p;
  }
  draw(snap, local) {
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._background(); this._board(); this._track(); this._zones(); this._flags();
    const localIds = new Set(local.ids || []);
    for (const P of snap.players) if (!localIds.has(P.id) && P.magnet?.active) this._magnet(P.magnet, P.color, 0.45);
    for (const P of snap.players) this._car(P, snap.currentId === P.id || snap.mode === 'duel');
    for (const P of snap.players) {
      const m = P.magnet; if (!m?.active || !localIds.has(P.id)) continue;
      if (this.physicsView) this._fieldAndForces(P);
      this._magnet(m, P.color, 1);
    }
  }
  _background() {
    const c = this.ctx, g = c.createRadialGradient(this.w * .3, this.h * .2, 10, this.w * .3, this.h * .2, Math.max(this.w, this.h));
    g.addColorStop(0, COLORS.bg1); g.addColorStop(.45, COLORS.bg2); g.addColorStop(1, COLORS.bg3);
    c.fillStyle = g; c.fillRect(0, 0, this.w, this.h);
  }
  _board() {
    const c = this.ctx, b = this.track.board, x = this.X(b.x), y = this.Y(b.y), w = this.S(b.w), h = this.S(b.h), r = this.S(0.028);
    c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, COLORS.board); g.addColorStop(1, COLORS.board2);
    c.fillStyle = g; this._rr(x, y, w, h, r); c.fill(); c.restore();
    c.save(); this._rr(x, y, w, h, r); c.clip(); c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    const step = this.S(0.024); for (let gx = x; gx < x + w; gx += step) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
    for (let gy = y; gy < y + h; gy += step) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
    c.restore(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; this._rr(x, y, w, h, r); c.stroke();
  }
  _track() {
    const c = this.ctx, lane = this.S(this.track.laneWidth), kerb = this.S(0.008);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); c.translate(0, this.S(0.004)); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = lane + kerb * 2 + 4; c.stroke(this.trackPath); c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = lane + kerb * 2; c.stroke(this.trackPath);
    c.lineCap = 'butt'; c.strokeStyle = COLORS.kerbR; c.setLineDash([this.S(0.011), this.S(0.011)]); c.stroke(this.trackPath); c.setLineDash([]); c.lineCap = 'round';
    c.strokeStyle = COLORS.asphalt; c.lineWidth = lane; c.stroke(this.trackPath);
    c.strokeStyle = COLORS.asphalt2; c.lineWidth = lane * .8; c.stroke(this.trackPath);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.setLineDash([this.S(0.013), this.S(0.011)]); c.stroke(this.trackPath); c.setLineDash([]);
    // start line
    const q = this.track.checkpointPose(0), hw = lane / 2, t = this.S(0.004);
    c.save(); c.translate(this.X(q.x), this.Y(q.y)); c.rotate(q.angle);
    const n = 8, sq = lane / n; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(-t + j * t, -hw + i * sq, t, sq); }
    c.restore();
  }
  _zones() {
    const c = this.ctx, lane = this.S(this.track.laneWidth);
    for (const p of this.sandPaths) { c.strokeStyle = COLORS.sand; c.lineWidth = lane * .8; c.lineCap = 'butt'; c.stroke(p); c.strokeStyle = 'rgba(120,80,30,.35)'; c.lineWidth = lane * .8; c.setLineDash([2, 6]); c.stroke(p); c.setLineDash([]); c.lineCap = 'round'; }
    for (const pl of this.track.plates()) {
      c.save(); c.lineCap = 'butt'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = this.S(0.012); c.beginPath(); c.moveTo(this.X(pl.a.x) + 3, this.Y(pl.a.y) + 4); c.lineTo(this.X(pl.b.x) + 3, this.Y(pl.b.y) + 4); c.stroke();
      const g = c.createLinearGradient(this.X(pl.a.x), this.Y(pl.a.y), this.X(pl.b.x), this.Y(pl.b.y)); g.addColorStop(0, '#F2F3F7'); g.addColorStop(.5, '#AEB4BF'); g.addColorStop(1, '#7C8492');
      c.strokeStyle = g; c.lineWidth = this.S(0.012); c.beginPath(); c.moveTo(this.X(pl.a.x), this.Y(pl.a.y)); c.lineTo(this.X(pl.b.x), this.Y(pl.b.y)); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(this.X(pl.a.x) - pl.tx * 4, this.Y(pl.a.y) - pl.ty * 4); c.lineTo(this.X(pl.b.x) - pl.tx * 4, this.Y(pl.b.y) - pl.ty * 4); c.stroke(); c.restore();
    }
    for (const z of this.track.zones) {
      if (z.type !== 'card' && z.type !== 'fuel') continue;
      const q = this.track.pointAt(z.s), x = this.X(q.x), y = this.Y(q.y), col = z.type === 'fuel' ? '#0A84FF' : ZONE_COLOR[z.difficulty];
      c.fillStyle = col + '2E'; c.beginPath(); c.arc(x, y, this.S(0.017), 0, 7); c.fill();
      c.fillStyle = col + '55'; c.beginPath(); c.arc(x, y, this.S(0.012), 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, this.S(0.0085), 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = `800 ${this.S(0.011)}px Inter, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(z.type === 'fuel' ? '⚡' : '?', x, y + 1);
    }
  }
  _flags() {
    const c = this.ctx;
    this.track.checkpoints.forEach((s, i) => {
      const q = this.track.pointAt(s), off = this.track.halfLane + 0.016, x = this.X(q.x - q.nx * off), y = this.Y(q.y - q.ny * off), h = this.S(0.02);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 1, y + 1, 4, 2, 0, 0, 7); c.fill();
      c.strokeStyle = '#E5E5EA'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke();
      c.fillStyle = COLORS.kerbR; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + h * .65, y - h * .78); c.lineTo(x, y - h * .56); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.font = `700 ${this.S(0.007)}px Inter, system-ui`; c.textAlign = 'center'; c.fillText(String(i + 1), x + h * .3, y - h * .62);
    });
  }
  _car(P, active) {
    const car = P.car, c = this.ctx, L = this.S(0.031), W = this.S(0.016);
    c.save(); c.translate(this.X(car.x), this.Y(car.y)); c.rotate(car.heading); if (!active) c.globalAlpha = .9;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(2, 3, L * .5, W * .6, 0, 0, 7); c.fill();
    c.fillStyle = '#111'; [[-L * .42, -W * .62], [-L * .42, W * .3], [L * .2, -W * .62], [L * .2, W * .3]].forEach(([x, y]) => this._rrFill(x, y, L * .16, W * .32, 2));
    c.fillStyle = P.color; this._rr(-L / 2, -W / 2, L, W, W * .3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; this._rr(-L / 2, -W / 2, L, W / 2, W * .3); c.fill();
    c.fillStyle = '#9FD3FF'; this._rrFill(L * .05, -W * .36, L * .18, W * .72, 2); this._rrFill(-L * .34, -W * .32, L * .14, W * .64, 2);
    c.fillStyle = 'rgba(0,0,0,.25)'; this._rrFill(-L * .16, -W * .36, L * .14, W * .72, 2);
    if (car.frozen > 0) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(0, 0, L * .7, 0, 7); c.stroke(); }
    c.restore();
    // name tag
    if (!P.name) return;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.font = `600 ${this.S(0.008)}px Inter, system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText(P.name).width + 10; this._rr(this.X(car.x) - tw / 2, this.Y(car.y) - this.S(0.03), tw, this.S(0.011), 6); c.fill();
    c.fillStyle = '#fff'; c.fillText(P.name, this.X(car.x), this.Y(car.y) - this.S(0.0245));
  }
  _magnet(m, color, alpha) {
    const c = this.ctx, x = this.X(m.x), y = this.Y(m.y), r = this.S(0.022);
    c.save(); c.globalAlpha = alpha;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 2.2); g.addColorStop(0, 'rgba(158,156,255,.35)'); g.addColorStop(1, 'rgba(158,156,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
    // horseshoe
    const s = r * .9; c.lineWidth = s * .42; c.lineCap = 'butt';
    c.strokeStyle = '#FF3B30'; c.beginPath(); c.arc(x, y - s * .1, s * .55, Math.PI, Math.PI * 1.5); c.stroke();
    c.strokeStyle = '#0A84FF'; c.beginPath(); c.arc(x, y - s * .1, s * .55, Math.PI * 1.5, Math.PI * 2); c.stroke();
    c.strokeStyle = '#FF3B30'; c.beginPath(); c.moveTo(x - s * .55, y - s * .1); c.lineTo(x - s * .55, y + s * .45); c.stroke();
    c.strokeStyle = '#0A84FF'; c.beginPath(); c.moveTo(x + s * .55, y - s * .1); c.lineTo(x + s * .55, y + s * .45); c.stroke();
    c.fillStyle = '#D1D1D6'; c.fillRect(x - s * .55 - s * .21, y + s * .45, s * .42, s * .2); c.fillRect(x + s * .55 - s * .21, y + s * .45, s * .42, s * .2);
    // stick radius ring
    c.strokeStyle = 'rgba(255,59,48,.55)'; c.setLineDash([3, 4]); c.lineWidth = 1; c.beginPath(); c.arc(x, y, this.S(PHYSICS.stickDist), 0, 7); c.stroke();
    c.restore();
  }
  _fieldAndForces(P) {
    const c = this.ctx, car = P.car, m = P.magnet;
    const cx = this.X(car.x), cy = this.Y(car.y), mx = this.X(m.x), my = this.Y(m.y);
    const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    c.save(); c.setLineDash([5, 5]); c.lineWidth = 1.5;
    for (const k of [-2, -1, 0, 1, 2]) {
      c.strokeStyle = COLORS.field; c.globalAlpha = car.blocked ? .25 : .75 - Math.abs(k) * .13;
      const bow = k * d * .22; c.beginPath(); c.moveTo(cx + ux * 10, cy + uy * 10);
      c.quadraticCurveTo((cx + mx) / 2 + nx * bow, (cy + my) / 2 + ny * bow, mx - ux * this.S(0.02), my - uy * this.S(0.02)); c.stroke();
    }
    c.restore();
    const kN = this.S(0.09); // px per newton
    const pull = Math.min(car.pullN, 0.8), fric = car.frictionN;
    if (pull > 0.005) this._arrow(cx, cy, cx + ux * pull * kN, cy + uy * pull * kN, COLORS.pull, `Pull ${car.pullN.toFixed(2)} N${car.blocked ? ' · screened' : ''}`, -1);
    if (fric > 0.005) { const sp = car.speed > 1e-3 ? [-car.vx / car.speed, -car.vy / car.speed] : [-ux, -uy]; this._arrow(cx, cy, cx + sp[0] * fric * kN, cy + sp[1] * fric * kN, COLORS.fric, `Friction ${fric.toFixed(2)} N`, 1); }
  }
  _arrow(x1, y1, x2, y2, color, label, side) {
    const c = this.ctx, a = Math.atan2(y2 - y1, x2 - x1), hl = 9;
    c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 4; c.lineCap = 'round'; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 4;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * hl * .6, y2 - Math.sin(a) * hl * .6); c.stroke();
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(a - .5) * hl, y2 - Math.sin(a - .5) * hl); c.lineTo(x2 - Math.cos(a + .5) * hl, y2 - Math.sin(a + .5) * hl); c.closePath(); c.fill();
    c.shadowBlur = 0; c.font = `700 12px Inter, system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText(label).width + 14, lx = (x1 + x2) / 2 + -Math.sin(a) * 16 * side, ly = (y1 + y2) / 2 + Math.cos(a) * 16 * side;
    c.fillStyle = 'rgba(20,18,58,.75)'; this._rr(lx - tw / 2, ly - 10, tw, 20, 10); c.fill(); c.fillStyle = color; c.fillText(label, lx, ly + .5); c.restore();
  }
  _rr(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  _rrFill(x, y, w, h, r) { this._rr(x, y, w, h, r); this.ctx.fill(); }
}
