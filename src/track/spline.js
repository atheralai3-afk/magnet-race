// Closed Catmull-Rom spline sampled by arc length. All units are metres.

export function sampleClosedSpline(points, samplesPerSeg = 160) {
  const n = points.length;
  const xs = [], ys = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      // Catmull-Rom basis (tension 0.5)
      const a0 = -0.5 * t3 + t2 - 0.5 * t, a1 = 1.5 * t3 - 2.5 * t2 + 1, a2 = -1.5 * t3 + 2 * t2 + 0.5 * t, a3 = 0.5 * t3 - 0.5 * t2;
      xs.push(a0 * p0[0] + a1 * p1[0] + a2 * p2[0] + a3 * p3[0]);
      ys.push(a0 * p0[1] + a1 * p1[1] + a2 * p2[1] + a3 * p3[1]);
    }
  }
  const m = xs.length;
  const cum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    cum[i + 1] = cum[i] + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
  }
  return { xs: Float64Array.from(xs), ys: Float64Array.from(ys), cum, length: cum[m], count: m };
}

export class Spline {
  constructor(points, samplesPerSeg) {
    const s = sampleClosedSpline(points, samplesPerSeg);
    Object.assign(this, s);
    // tangents (central differences)
    this.tx = new Float64Array(this.count); this.ty = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const a = (i - 1 + this.count) % this.count, b = (i + 1) % this.count;
      const dx = this.xs[b] - this.xs[a], dy = this.ys[b] - this.ys[a], l = Math.hypot(dx, dy) || 1;
      this.tx[i] = dx / l; this.ty[i] = dy / l;
    }
  }
  wrap(s) { const L = this.length; s %= L; return s < 0 ? s + L : s; }
  // index of the sample whose cum <= s
  indexAt(s) {
    s = this.wrap(s);
    let lo = 0, hi = this.count - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.cum[mid] <= s) lo = mid; else hi = mid - 1; }
    return lo;
  }
  pointAt(s) {
    s = this.wrap(s);
    const i = this.indexAt(s), j = (i + 1) % this.count;
    const seg = this.cum[i + 1] - this.cum[i] || 1e-9, u = (s - this.cum[i]) / seg;
    const x = this.xs[i] + (this.xs[j] - this.xs[i]) * u, y = this.ys[i] + (this.ys[j] - this.ys[i]) * u;
    const tx = this.tx[i] + (this.tx[j] - this.tx[i]) * u, ty = this.ty[i] + (this.ty[j] - this.ty[i]) * u;
    const l = Math.hypot(tx, ty) || 1;
    return { x, y, tx: tx / l, ty: ty / l, nx: -ty / l, ny: tx / l, angle: Math.atan2(ty, tx) };
  }
  // nearest point on the spline; `hint` is a previous sample index for a fast local search
  project(x, y, hint = -1) {
    let best = -1, bestD = Infinity;
    const scan = (from, to) => {
      for (let k = from; k <= to; k++) {
        const i = (k + this.count) % this.count;
        const d = (this.xs[i] - x) ** 2 + (this.ys[i] - y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    };
    if (hint >= 0) scan(hint - 60, hint + 60); else scan(0, this.count - 1);
    if (hint >= 0 && bestD > 0.03 * 0.03) { bestD = Infinity; scan(0, this.count - 1); }
    // refine between neighbours
    const i = best, j = (i + 1) % this.count;
    const ax = this.xs[i], ay = this.ys[i], bx = this.xs[j], by = this.ys[j];
    const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy || 1e-12;
    let u = ((x - ax) * vx + (y - ay) * vy) / vv; u = Math.max(0, Math.min(1, u));
    const px = ax + vx * u, py = ay + vy * u;
    const s = this.wrap(this.cum[i] + (this.cum[i + 1] - this.cum[i]) * u);
    const tx = this.tx[i], ty = this.ty[i];
    const lat = (x - px) * -ty + (y - py) * tx; // signed lateral offset (left +)
    return { s, lat, dist: Math.hypot(x - px, y - py), index: i, px, py, tx, ty };
  }
}
