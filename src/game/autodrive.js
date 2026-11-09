// A careful "player": keeps the magnet a few cm ahead of the car, closer on sandpaper,
// and steers round steel shields. Drives the menu background and the automated tests.
export function autoMagnet(track, car, { lead = 0.037 } = {}) {
  const sand = track.surfaceAt(car.s) === 'sand' || track.surfaceAt(car.s + 0.02) === 'sand';
  const L = (lead + Math.min(0.02, car.speed * 0.06)) * (sand ? 0.72 : 1);
  const p = track.pointAt(car.s + L);
  let ox = 0, oy = 0;
  for (const pl of track.plates()) if (track.forward(car.s, pl.s) < 0.08 || track.forward(pl.s, car.s) < 0.03) { ox = -pl.side * p.nx * 0.018; oy = -pl.side * p.ny * 0.018; }
  return { x: p.x + ox, y: p.y + oy, active: true };
}
