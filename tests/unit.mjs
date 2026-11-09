// Node unit tests (no dependencies): node tests/unit.mjs
import { Track } from '../src/track/track.js';
import { classic } from '../src/track/tracks/classic.js';
import { World, magnetPull, PHYSICS } from '../src/physics/engine.js';
import { scoreAnswer, streakMultiplier } from '../src/game/scoring.js';
import { QuestionDeck } from '../src/questions/engine.js';
import { BANK } from '../src/questions/bank.js';
import { Match } from '../src/game/match.js';
import { rng } from '../src/util/rng.js';
import { autoMagnet } from '../src/game/autodrive.js';
import { LocalTransport } from '../src/net/transport.js';
import { Room } from '../src/net/room.js';
import { Matchmaker } from '../src/net/matchmaking.js';
import { NetSession } from '../src/net/session.js';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  ✗', name); } };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const tick = () => new Promise(r => setTimeout(r, 0));
const track = new Track(classic);

// ---------- physics: the numbers on the poster must hold
ok(near(PHYSICS.mass * PHYSICS.g, 0.5), 'car weight is 0.5 N');
ok(near(PHYSICS.muSmooth * 0.5, 0.1), 'smooth friction 0.1 N');
ok(near(PHYSICS.muSand * 0.5, 0.3, 1e-9), 'sandpaper friction 0.3 N');
ok(magnetPull(0.03) > 0.35 && magnetPull(0.03) < 0.45, 'pull ≈0.4 N at 3 cm');
ok(magnetPull(0.07) < 0.1, 'pull below smooth friction at 7 cm');
ok(magnetPull(0.02) > magnetPull(0.04) * 2, 'pull falls off steeply with distance');
const start = track.checkpointPose(0);
const sandTrack = new Track(classic); sandTrack.surfaceAt = () => 'sand';
const still = (dist, surface) => { const w = new World(surface === 'sand' ? sandTrack : track); const c = w.addCar('a', start); const p = track.pointAt(start.s + dist); w.setMagnet('a', { x: p.x, y: p.y, active: true }); w.update(0.5); return c.speed; };
ok(still(0.07) === 0, 'car stays still when pull < static friction (7 cm, smooth)');
ok(still(0.05) > 0, 'car moves when pull > friction (5 cm, smooth)');
ok(still(0.05, 'sand') === 0, 'same 5 cm pull cannot beat sandpaper');
ok(still(0.03, 'sand') > 0, 'closer magnet beats sandpaper (3 cm)');
{ // attraction only: car always moves toward the magnet
  const w = new World(track); const c = w.addCar('a', start); const p = track.pointAt(start.s + 0.04);
  w.setMagnet('a', { x: p.x, y: p.y, active: true }); const d0 = Math.hypot(p.x - c.x, p.y - c.y); w.update(0.1);
  ok(Math.hypot(p.x - c.x, p.y - c.y) < d0, 'magnet only attracts');
}
{ // screening: a steel plate between magnet and car cuts the pull
  const pl = track.plates()[0]; const w = new World(track); const pose = track.pointAt(pl.s - 0.02);
  const c = w.addCar('a', { ...pose, s: pl.s - 0.02 }); const mid = { x: (pl.a.x + pl.b.x) / 2, y: (pl.a.y + pl.b.y) / 2 };
  const m = { x: mid.x + (mid.x - c.x), y: mid.y + (mid.y - c.y), active: true }; w.setMagnet('a', m); w.update(1 / 60);
  ok(c.blocked && near(c.pullN, magnetPull(Math.hypot(m.x - c.x, m.y - c.y)) * PHYSICS.screenFactor, 0.02), 'steel plate screens the field');
}
{ const w = new World(track); const c = w.addCar('a', start); const p = track.pointAt(start.s + 0.008); w.setMagnet('a', { x: p.x, y: p.y, active: true }); w.update(1 / 60); ok(c.stuck, 'car sticks when the magnet is too close'); }

// ---------- track
ok(track.length > 1 && track.length < 2, 'lap length ~1.4 m');
ok(track.checkpoints.length === 4, '4 checkpoint flags');
ok(track.crossedForward(track.length - 0.01, 0.01, 0) && !track.crossedForward(0.01, track.length - 0.01, 0), 'start line crossing direction');
{ const p = track.pointAt(0.3); const pr = track.project(p.x + p.nx * 0.01, p.y + p.ny * 0.01); ok(near(pr.s, 0.3, 0.003) && near(pr.lat, 0.01, 0.001), 'projection gives s and lateral offset'); }
ok(track.isOffTrack(track.halfLane + 0.02) && !track.isOffTrack(track.halfLane - 0.005), 'fall-off detection');

// ---------- scoring
ok(scoreAnswer({ difficulty: 'easy', correct: true, seconds: 10 }).total === 1, 'easy = 1');
ok(scoreAnswer({ difficulty: 'hard', correct: true, seconds: 10 }).total === 3, 'hard = 3');
ok(scoreAnswer({ difficulty: 'medium', correct: true, seconds: 2, streakBefore: 2 }).total === 4, 'medium, streak ×1.5, speed +1 = 4');
ok(streakMultiplier(5) === 2 && streakMultiplier(3) === 1.5 && streakMultiplier(2) === 1, 'streak multipliers');
ok(scoreAnswer({ difficulty: 'hard', correct: false }).skipNext, 'wrong hard = lose next turn');

// ---------- questions
ok(BANK.filter(q => q.d === 'easy').length === 10 && BANK.filter(q => q.d === 'medium').length === 10 && BANK.filter(q => q.d === 'hard').length === 15, '10/10/15 questions');
ok(BANK.every(q => q.type === 'num' ? Number.isFinite(q.answer) : q.o[q.a] != null), 'every question has a checkable answer');
{ const deck = new QuestionDeck(rng(5)); const seen = new Set(); for (let i = 0; i < 10; i++) seen.add(deck.draw('easy').id); ok(seen.size === 10, 'no repeats until the pile is used up'); }
{ const deck = new QuestionDeck(rng(9)); for (let i = 0; i < 15; i++) { const v = deck.draw('hard'); const l = deck.live.get(v.drawId); const r = deck.check(v.drawId, v.type === 'num' ? l.q.answer * 1.01 : l.correctIndex); if (!r.correct) { ok(false, 'answer check ' + v.id); break; } } ok(true, 'answer checking (±2% numeric)'); }

// ---------- full matches
function autoplay(m, ids, { lead = 0.035, wrong = () => false } = {}) {
  for (let f = 0; f < 120 * 1800 && m.phase !== 'over'; f++) {
    if (m.phase === 'roll') m.roll();
    if (m.phase === 'pitstop') { m.pitDone(3); m.player(m.current.id).needRelease = false; continue; }
    const live = m.mode === 'duel' ? ids : [m.current?.id];
    for (const id of live) {
      if (!id || m.player(id).finished) continue;
      if (m.questions.has(id)) { const v = m.questions.get(id).view, l = m.deck.live.get(v.drawId); m.answer(wrong() ? -1 : v.type === 'num' ? l.q.answer : l.correctIndex); continue; }
      if (m.player(id).needRelease) { m.setMagnet(id, { x: 0, y: 0, active: false }); continue; }
      m.setMagnet(id, autoMagnet(track, m.car(id)));
    }
    m.update(1 / 120);
  }
  return m;
}
{ // Charge Pit Stop: a fuel zone pauses the turn, then each paper piece adds 2 s
  const m = new Match({ players: [{ id: 'a', name: 'A' }], track, laps: 1, seed: 2 }); m.start(); m.roll();
  const fz = track.zonesOfType('fuel')[0], c = m.car('a'), p0 = track.pointAt(fz.s - 0.004);
  Object.assign(c, { x: p0.x, y: p0.y }); m.world.placeOnTrack(c); Object.assign(m.player('a'), { cp: 2, lastCp: 1 });
  const p1 = track.pointAt(fz.s + 0.035); m.setMagnet('a', { x: p1.x, y: p1.y, active: true });
  for (let i = 0; i < 240 && m.phase !== 'pitstop'; i++) m.update(1 / 120);
  ok(m.phase === 'pitstop', 'fuel zone opens the Charge Pit Stop');
  const tp = m.turn.timeLeft; m.update(1); ok(m.turn.timeLeft === tp, 'timer pauses during the pit stop');
  const ev = m.pitDone(3); ok(ev && ev.add === 6 && m.phase === 'turn' && Math.abs(m.turn.timeLeft - tp - 6) < 1e-9, '3 paper pieces = +6 s');
  ok(m.pitDone(3) === null, 'pit stop can only be cashed in once'); }
{ const m = new Match({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], track, laps: 2, seed: 11 }); m.start(); let k = 0; autoplay(m, [], { wrong: () => ++k % 4 === 0 });
  ok(m.phase === 'over', '3-player turn game reaches the end'); ok(m.ranking[0].score >= m.ranking[1].score, 'ranking sorted by points');
  ok(m.log.some(e => e.type === 'lap' && e.bonus === 5), 'first finisher gets the lap bonus'); }
{ const m = new Match({ mode: 'duel', players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], track, laps: 1, seed: 4 }); m.start(); autoplay(m, ['a', 'b']); ok(m.phase === 'over', 'duel ends'); }

// ---------- networking over the in-memory transport
{
  const tA = new LocalTransport('A'), tB = new LocalTransport('B');
  const rA = await new Room(tA, { name: 'Alice', isHost: true }).open(); await tick();
  const rB = await new Room(tB, { code: rA.code, name: 'Bob' }).open(); await tick(); await tick();
  ok(rA.players.length === 2 && rA.isHost && !rB.isHost, 'room presence + host');
  ok(!rA.canStart, 'cannot start until everyone is ready'); await rB.setReady(true); await tick(); await tick(); ok(rA.canStart, 'can start when ready');
  rA.setSettings({ laps: 1 }); await tick(); ok(rB.settings.laps === 1, 'settings sync');
  const s = rA.start(); await tick();
  const sA = new NetSession(tA, { code: rA.code, start: s, track }), sB = new NetSession(tB, { code: rA.code, start: rB.started, track });
  const mA = await sA.open(), mB = await sB.open(); await tick();
  for (let f = 0; f < 60 * 600 && mA.phase !== 'over'; f++) {
    for (const [ss, m, id] of [[sA, mA, 'A'], [sB, mB, 'B']]) {
      if (m.phase === 'roll' && m.current.id === id) ss.roll();
      if (m.phase === 'pitstop' && m.current.id === id) { ss.pitDone(2); ss.setMagnet({ x: 0, y: 0, active: false }); }
      if (m.phase === 'question' && m.question) { const v = m.question.view, l = m.deck.live.get(v.drawId); ss.answer(v.type === 'num' ? l.q.answer : l.correctIndex); }
      if (m.phase === 'turn' && m.current.id === id) ss.setMagnet(autoMagnet(track, m.car(id)));
      ss.update(1 / 60);
    }
    await tick();
  }
  const sum = m => m.snapshot().players.map(p => p.score + '/' + p.lap).join(',');
  ok(mA.phase === 'over' && mB.phase === 'over', 'networked room game finishes on both clients'); ok(sum(mA) === sum(mB), 'both clients agree on scores and laps');
  // leaving
  sB.close(); await tick(); await tick(); ok(mA.player('B').left, 'host notices a player leaving');
}
{
  const t1 = new LocalTransport('P1'), t2 = new LocalTransport('P2');
  const [a, b] = await Promise.all([new Matchmaker(t1, { name: 'One' }).find({ timeout: 2000 }), new Matchmaker(t2, { name: 'Two' }).find({ timeout: 2000 })]);
  ok(a.code === b.code && a.isHost !== b.isHost && a.mode === 'duel', 'public duel matchmaking pairs two players');
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
