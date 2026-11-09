import { Spline } from './spline.js';

// Zone types:
//  sand  {s, len}            higher friction strip
//  plate {s, side}           steel sheet across 65% of the lane from one edge (screening)
//  card  {s, difficulty}     question zone
//  fuel  {s}                 +time pickup
// Checkpoints (flags) are evenly spaced unless given.

export class Track {
  constructor(def) {
    this.def = def;
    this.spline = new Spline(def.points, def.samplesPerSeg || 160);
    this.length = this.spline.length;
    this.laneWidth = def.laneWidth ?? 0.06;
    this.halfLane = this.laneWidth / 2;
    this.fallTolerance = def.fallTolerance ?? 0.008;
    this.carRadius = def.carRadius ?? 0.012; // trigger radius for zones
    this.zones = def.zones.map(z => ({ ...z, s: this._abs(z.s), len: z.len ?? 0 }));
    const nCp = def.checkpoints ?? 4;
    this.checkpoints = (def.checkpointS ?? Array.from({ length: nCp }, (_, i) => i / nCp)).map(v => this._abs(v));
    const sp = this.spline; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < sp.count; i++) { x0 = Math.min(x0, sp.xs[i]); x1 = Math.max(x1, sp.xs[i]); y0 = Math.min(y0, sp.ys[i]); y1 = Math.max(y1, sp.ys[i]); }
    const mg = this.halfLane + 0.035; // room for kerbs and flags
    this.board = { x: x0 - mg, y: y0 - mg, w: x1 - x0 + mg * 2, h: y1 - y0 + mg * 2 };
    this._plates = this.zones.filter(z => z.type === 'plate').map(z => this.plateSegment(z));
  }
  _abs(v) { return v <= 1 && this.def.fractions !== false ? v * this.length : v; }
  pointAt(s) { return this.spline.pointAt(s); }
  project(x, y, hint) { return this.spline.project(x, y, hint); }
  wrap(s) { return this.spline.wrap(s); }
  // forward distance from a to b along the loop (0..L)
  forward(a, b) { return this.wrap(b - a); }
  // did we cross s0 moving from prev to cur (forward)?
  crossedForward(prev, cur, s0) {
    const moved = this.wrap(cur - prev);
    if (moved === 0 || moved > this.length / 2) return false; // no move, or moved backwards
    const d = this.wrap(s0 - prev);
    return d > 0 && d <= moved;
  }
  crossedBackward(prev, cur, s0) {
    const moved = this.wrap(prev - cur);
    if (moved === 0 || moved > this.length / 2) return false;
    const d = this.wrap(prev - s0);
    return d >= 0 && d < moved;
  }
  isOffTrack(lat) { return Math.abs(lat) > this.halfLane + this.fallTolerance; }
  surfaceAt(s) {
    for (const z of this.zones) if (z.type === 'sand' && this._within(s, z.s, z.len)) return 'sand';
    return 'smooth';
  }
  _within(s, start, len) { const d = this.wrap(s - start); return d >= 0 && d <= len; }
  zonesOfType(type) { return this.zones.filter(z => z.type === type); }
  plateSegment(z) {
    const p = this.pointAt(z.s), side = z.side ?? 1, cover = z.cover ?? 0.65;
    const edge = this.halfLane + 0.004;
    const a = { x: p.x + p.nx * edge * side, y: p.y + p.ny * edge * side };
    const inner = edge - this.laneWidth * cover;
    const b = { x: p.x + p.nx * inner * side, y: p.y + p.ny * inner * side };
    return { a, b, s: z.s, side, nx: p.nx, ny: p.ny, tx: p.tx, ty: p.ty, x: p.x, y: p.y };
  }
  plates() { return this._plates; }
  checkpointPose(i) { const s = this.checkpoints[i % this.checkpoints.length]; return { s, ...this.pointAt(s) }; }
}

export function segmentsIntersect(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-12) return false;
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
