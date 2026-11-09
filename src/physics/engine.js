import { segmentsIntersect } from '../track/track.js';

// All SI units. Positions in metres, forces in newtons, mass in kg.
export const PHYSICS = {
  g: 10,
  mass: 0.05,          // 50 g steel car  -> weight 0.5 N
  muSmooth: 0.2,       // smooth board    -> friction 0.10 N
  muSand: 0.6,         // sandpaper       -> friction 0.30 N
  magnetK: 4.2e-4,     // pull = K / (d^2 + soften^2)   ~0.40 N at 3 cm, ~0.11 N at 6 cm
  soften: 0.012,       // keeps the force finite near the magnet (magnet is held just above the board)
  forceCap: 1.2,
  stickDist: 0.02,     // closer than this the car jumps onto the magnet -> turn over
  screenFactor: 0.15,  // fraction of the pull that gets past a steel plate
  rolling: 1.6,        // rolling/air resistance, N per (m/s): keeps a toy-car pace (~0.15 m/s with the magnet 4 cm ahead)
  dt: 1 / 120,
  maxSpeed: 1.5,
};

export function magnetPull(d, p = PHYSICS) {
  return Math.min(p.forceCap, p.magnetK / (d * d + p.soften * p.soften));
}

export function makeCar(id, pose) {
  return {
    id, x: pose.x, y: pose.y, vx: 0, vy: 0, heading: pose.angle ?? 0,
    s: pose.s ?? 0, lat: 0, hint: -1, surface: 'smooth', frozen: 0,
    // telemetry (updated every step)
    pullN: 0, frictionN: 0, resultantN: 0, speed: 0, dist: Infinity, blocked: false, stuck: false, off: false,
  };
}

export class World {
  constructor(track, params = {}) {
    this.track = track;
    this.p = { ...PHYSICS, ...params };
    this.cars = new Map();
    this.magnets = new Map(); // carId -> {x,y,active}
    this.mods = new Map();    // carId -> {skipSand:boolean}
    this.acc = 0;
    this.time = 0;
  }
  addCar(id, pose) { const c = makeCar(id, pose); this.placeOnTrack(c); this.cars.set(id, c); return c; }
  placeOnTrack(c) { const pr = this.track.project(c.x, c.y, c.hint); c.s = pr.s; c.lat = pr.lat; c.hint = pr.index; return pr; }
  setMagnet(id, m) { this.magnets.set(id, m); }
  respawn(c, pose) {
    c.x = pose.x; c.y = pose.y; c.vx = c.vy = 0; c.heading = pose.angle; c.hint = -1; c.stuck = false; c.off = false;
    this.placeOnTrack(c);
  }
  plateBetween(car, m) {
    const a = { x: car.x, y: car.y }, b = { x: m.x, y: m.y };
    for (const pl of this.track.plates()) if (segmentsIntersect(a, b, pl.a, pl.b)) return true;
    return false;
  }
  // advance the world by `elapsed` seconds in fixed steps; returns per-car step results merged
  update(elapsed, filter = null) {
    const dt = this.p.dt;
    this.acc += Math.min(elapsed, 0.1);
    const out = [];
    while (this.acc >= dt) {
      this.acc -= dt; this.time += dt;
      for (const c of this.cars.values()) if (!filter || filter(c.id)) out.push(this.stepCar(c, dt));
    }
    return out;
  }
  stepCar(c, dt) {
    const p = this.p, m = this.magnets.get(c.id);
    const prevS = c.s;
    const blocked = !!(m && m.active && c.frozen <= 0 && this.plateBetween(c, m));
    const mods = this.mods.get(c.id) || {};
    c.surface = this.track.surfaceAt(c.s);
    const mu = c.surface === 'sand' && !mods.skipSand ? p.muSand : p.muSmooth;
    if (integrate(c, m, mu, blocked, p, dt)) c.stuck = true;
    const pr = this.placeOnTrack(c);
    c.off = this.track.isOffTrack(pr.lat);
    return { car: c, prevS, s: c.s };
  }
}

// Advances one car by dt under the magnet's pull, friction and rolling resistance.
// Shared by the race (World) and the Physics Lab so both obey exactly the same physics.
// Returns true if the car got close enough to jump onto the magnet.
export function integrate(c, m, mu, blocked, p, dt) {
  let fx = 0, fy = 0, pull = 0, d = Infinity, stuck = false;
  if (c.frozen > 0) { c.frozen = Math.max(0, c.frozen - dt); c.vx = c.vy = 0; }
  else if (m && m.active) {
    const dx = m.x - c.x, dy = m.y - c.y; d = Math.hypot(dx, dy);
    pull = magnetPull(d, p) * (blocked ? p.screenFactor : 1);
    if (d > 1e-6) { fx = pull * dx / d; fy = pull * dy / d; }
    if (d < p.stickDist && !blocked) stuck = true;
  }
  const N = p.mass * p.g, fr = mu * N;
  let speed = Math.hypot(c.vx, c.vy), resultant = 0;
  if (c.frozen > 0) { /* held */ }
  else if (speed < 1e-4) {
    if (pull > fr) { // static friction beaten -> starts moving along the pull
      resultant = pull - fr;
      c.vx += (fx / pull) * resultant / p.mass * dt; c.vy += (fy / pull) * resultant / p.mass * dt;
    } else { c.vx = c.vy = 0; }
  } else {
    const ux = c.vx / speed, uy = c.vy / speed;
    // kinetic friction + rolling resistance oppose the velocity
    const rx = fx - fr * ux - p.rolling * c.vx, ry = fy - fr * uy - p.rolling * c.vy;
    resultant = Math.hypot(rx, ry);
    const nvx = c.vx + rx / p.mass * dt, nvy = c.vy + ry / p.mass * dt;
    // friction cannot reverse the motion by itself
    if (nvx * ux + nvy * uy < 0 && pull <= fr) { c.vx = c.vy = 0; } else { c.vx = nvx; c.vy = nvy; }
  }
  speed = Math.hypot(c.vx, c.vy);
  if (speed > p.maxSpeed) { c.vx *= p.maxSpeed / speed; c.vy *= p.maxSpeed / speed; speed = p.maxSpeed; }
  c.x += c.vx * dt; c.y += c.vy * dt;
  if (speed > 0.02) c.heading = Math.atan2(c.vy, c.vx);
  else if (pull > 0 && d < Infinity) c.heading += angleDiff(c.heading, Math.atan2(fy, fx)) * 0.1;
  c.pullN = pull; c.frictionN = speed > 1e-4 || pull > fr ? fr : Math.min(pull, fr); c.resultantN = resultant;
  c.speed = speed; c.dist = d; c.blocked = blocked; c.accel = resultant / p.mass;
  return stuck;
}

export function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
