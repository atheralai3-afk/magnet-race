// Seeded PRNG (mulberry32) so networked games can replay the same dice and card draws.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[next.int(arr.length)];
  next.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = next.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return next;
}
export const randomSeed = () => (Math.random() * 2 ** 32) >>> 0;
export const roomCode = (r = Math.random) => 'MAG-' + String(1000 + Math.floor(r() * 9000));
