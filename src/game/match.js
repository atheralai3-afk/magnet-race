import { World } from '../physics/engine.js';
import { QuestionDeck } from '../questions/engine.js';
import { rng } from '../util/rng.js';
import { scoreAnswer, LAP_BONUS, rankPlayers } from './scoring.js';
import { rollPowerup } from './powerups.js';

export const PIT_SECONDS_PER_PIECE = 2;
export const DUEL_GRACE = 15;

// The match is event-sourced: every state change is an event. The client that "owns" a player
// produces events for that player (it runs the physics); other clients just apply them.
export class Match {
  constructor({ mode = 'turns', players, track, laps = 3, seed = 1, localIds = null, params = {} }) {
    this.mode = mode; this.track = track; this.laps = laps; this.seed = seed;
    this.localIds = localIds ? new Set(localIds) : null;
    this.rnd = rng(seed);
    this.deck = new QuestionDeck(rng(seed ^ 0x9e3779b9));
    this.world = new World(track, params);
    this.players = new Map(); this.order = [];
    players.forEach((p, i) => {
      const pose = { ...track.checkpointPose(0) };
      const P = { id: p.id, name: p.name, color: p.color || '#FF3B30', idx: i, score: 0, lap: 0, cp: 1, lastCp: 0, lapArmed: false,
        streak: 0, powerups: [], skipNext: false, doubleDice: false, finished: false, fuelTaken: new Set(), cardsTaken: new Set(), progress: 0, frozenUntil: 0, needRelease: false };
      this.players.set(p.id, P); this.order.push(p.id);
      const car = this.world.addCar(p.id, pose);
      // stagger cars at the start so they do not overlap
      const off = (i - (players.length - 1) / 2) * 0.014;
      car.x += pose.nx * off; car.y += pose.ny * off; this.world.placeOnTrack(car);
    });
    this.phase = 'lobby'; this.turnIdx = 0; this.turn = null; this.questions = new Map();
    this.time = 0; this.events = []; this.log = []; this.finalRound = false; this.firstFinisher = null; this.graceLeft = null;
  }
  // ---------- helpers
  owns(id) { return !this.localIds || this.localIds.has(id); }
  get current() { return this.mode === 'turns' ? this.players.get(this.order[this.turnIdx]) : null; }
  car(id) { return this.world.cars.get(id); }
  player(id) { return this.players.get(id); }
  _emit(ev) { ev.t = this.time; ev.origin = 'local'; this.events.push(ev); this.log.push(ev); this._apply(ev); return ev; }
  drain() { const e = this.events; this.events = []; return e; }
  applyEvent(ev) { if (ev.type === 'car') return this._remoteCar(ev); this.events.push(ev); this.log.push(ev); this._apply(ev); }
  get question() { for (const [id, q] of this.questions) if (this.owns(id)) return q; return null; }
  snapshot() {
    return { pit: this.pit, phase: this.phase, mode: this.mode, laps: this.laps, time: this.time, turn: this.turn, question: this.question, questions: this.questions, currentId: this.current?.id ?? null, ranking: this.ranking,
      players: this.order.map(id => { const P = this.players.get(id), c = this.car(id); return { ...P, powerups: P.powerups.slice(), car: c, magnet: this.world.magnets.get(id) || null }; }) };
  }
  // ---------- flow
  start() { this._emit({ type: 'start', order: this.order.slice() }); }
  roll() {
    if (this.mode !== 'turns' || this.phase !== 'roll') return null;
    const P = this.current, a = 1 + this.rnd.int(6), b = 1 + this.rnd.int(6);
    const doubled = P.doubleDice; const seconds = (a + b) * 3 * (doubled ? 2 : 1);
    return this._emit({ type: 'dice', playerId: P.id, a, b, seconds, doubled });
  }
  setMagnet(id, m) {
    const P = this.player(id); if (!P) return;
    if (P.needRelease) { if (!m.active) P.needRelease = false; this.world.setMagnet(id, { ...m, active: false }); return; }
    this.world.setMagnet(id, m);
    if (this.mode === 'turns' && this.turn && this.turn.playerId === id && this.phase === 'turn' && m.active && !this.turn.started) this._emit({ type: 'turnGo', playerId: id });
  }
  usePowerup(id, kind) {
    const P = this.player(id); if (!P) return false;
    const i = P.powerups.indexOf(kind); if (i < 0) return false;
    if (this.mode === 'turns' && (this.current?.id !== id || !['roll', 'turn'].includes(this.phase))) return false;
    if (kind === 'dice' && this.phase !== 'roll') return false;
    if (kind === 'steal') {
      const leader = rankPlayers([...this.players.values()].filter(p => p.id !== id && p.score > 0))[0];
      if (!leader) return false;
      this._emit({ type: 'powerup', playerId: id, kind, fromId: leader.id });
    } else this._emit({ type: 'powerup', playerId: id, kind });
    return true;
  }
  answer(value) {
    const q = this.question; if (!q || this.phase !== 'question' && this.mode === 'turns') return null;
    const P = this.player(q.playerId); if (!this.owns(P.id)) return null;
    const r = this.deck.check(q.view.drawId, value, this.time);
    const s = scoreAnswer({ difficulty: q.view.difficulty, correct: r.correct, seconds: r.seconds, streakBefore: P.streak });
    const powerup = r.correct ? rollPowerup(q.view.difficulty, this.rnd) : null;
    return this._emit({ type: 'answer', playerId: P.id, drawId: q.view.drawId, difficulty: q.view.difficulty, correct: r.correct, value, correctIndex: r.correctIndex,
      correctAnswer: r.correctAnswer, why: r.why, seconds: r.seconds, base: s.base, mult: s.mult, speed: s.speed, points: s.total, streak: s.streakAfter, skipNext: s.skipNext, powerup });
  }
  update(dt) {
    if (this.phase === 'lobby' || this.phase === 'over') return this.drain();
    this.time += dt;
    const sim = this.phase === 'turn' || this.mode === 'duel' && this.phase !== 'over';
    if (sim) {
      const filter = this.mode === 'turns' ? (id => this.phase === 'turn' && id === this.current?.id && this.owns(id)) : (id => this.owns(id) && !this.questions.has(id));
      for (const r of this.world.update(dt, filter)) this._afterStep(r);
    }
    if (this.mode === 'turns' && this.phase === 'turn' && this.turn?.started && this.owns(this.turn.playerId)) {
      this.turn.timeLeft -= dt;
      if (this.turn.timeLeft <= 0) { this.turn.timeLeft = 0; this._endTurn('time'); }
    }
    if (this.mode === 'duel' && this.graceLeft != null && this.phase !== 'over') { this.graceLeft -= dt; if (this.graceLeft <= 0) this._over(); }
    return this.drain();
  }
  _afterStep({ car, prevS, s }) {
    const P = this.player(car.id); if (!P || P.finished) return;
    if (this.phase === 'over') return;
    const T = this.track;
    P.progress = P.lap + T.wrap(s - T.checkpoints[0]) / T.length;
    // checkpoints & laps
    const nCp = T.checkpoints.length, want = T.checkpoints[P.cp];
    if (T.crossedForward(prevS, s, want)) {
      const idx = P.cp;
      this._emit({ type: 'checkpoint', playerId: P.id, index: idx });
      if (idx === 0 && P.lapArmed) this._emit({ type: 'lap', playerId: P.id, lap: P.lap + 1 });
      if (P.finished) return;
    } else {
      const back = (P.cp - 1 + nCp) % nCp;
      if (T.crossedBackward(prevS, s, T.checkpoints[back])) this._emit({ type: 'uncheck', playerId: P.id, index: back });
    }
    // fuel & cards
    for (const z of T.zones) {
      if (!T.crossedForward(prevS, s, z.s)) continue;
      if (z.type === 'fuel' && !P.fuelTaken.has(z.s) && this.mode === 'turns') { this._emit({ type: 'pitstop', playerId: P.id, zoneS: z.s }); return; }
      if (z.type === 'card' && !P.cardsTaken.has(z.s)) {
        const view = this.deck.draw(z.difficulty, this.time);
        this._emit({ type: 'question', playerId: P.id, zoneS: z.s, view });
        return;
      }
    }
    if (car.off) { this._emit({ type: 'fell', playerId: P.id, pose: this._respawnPose(P) }); if (this.mode === 'turns') this._endTurn('fell'); return; }
    if (car.stuck) { this._emit({ type: 'stuck', playerId: P.id }); if (this.mode === 'turns') this._endTurn('stuck'); }
  }
  _respawnPose(P) { const pose = this.track.checkpointPose(P.lastCp); return { x: pose.x, y: pose.y, angle: pose.angle, s: pose.s }; }
  _endTurn(reason) {
    const P = this.current; if (!P) return;
    const n = this.order.length; let next = null, idx = this.turnIdx, steps = 0;
    // two passes: a skipped player loses one turn, then becomes eligible again
    for (let k = 1; k <= 2 * n; k++) {
      const cand = this.players.get(this.order[(this.turnIdx + k) % n]);
      if (cand.finished) continue;
      if (cand.skipNext) { this._emit({ type: 'skipped', playerId: cand.id }); continue; }
      next = cand.id; idx = (this.turnIdx + k) % n; steps = k; break;
    }
    const allDone = [...this.players.values()].every(p => p.finished);
    const roundEnds = next != null && this.turnIdx + steps >= n; // the order wrapped past the first player
    const over = allDone || next == null || (this.finalRound && roundEnds);
    this._emit({ type: 'turnEnd', playerId: P.id, reason, next: over ? null : next, nextIdx: idx });
    if (over) this._over();
  }
  // Charge Pit Stop result: each paper piece lifted = +2 s
  pitDone(pieces) {
    if (this.phase !== 'pitstop' || !this.pit || !this.owns(this.pit.playerId)) return null;
    const n = Math.max(0, Math.min(3, pieces | 0));
    return this._emit({ type: 'fuel', playerId: this.pit.playerId, zoneS: this.pit.zoneS, add: n * PIT_SECONDS_PER_PIECE, pieces: n });
  }
  playerLeft(id) { const P = this.player(id); if (!P || P.left) return; this._emit({ type: 'left', playerId: id }); if (this.mode === 'turns' && this.current?.id === id && this.phase !== 'over') this._endTurn('left'); else if (this.mode === 'duel' && [...this.players.values()].every(p => p.finished)) this._over(); }
  _over() { this._emit({ type: 'over', ranking: rankPlayers([...this.players.values()]).map(p => ({ id: p.id, score: p.score, lap: p.lap })) }); }
  _remoteCar(ev) { const c = this.car(ev.playerId); if (!c || this.owns(ev.playerId)) return; Object.assign(c, { x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy, heading: ev.heading, pullN: ev.pullN ?? 0, frictionN: ev.frictionN ?? 0 }); this.world.placeOnTrack(c); if (ev.magnet) this.world.setMagnet(ev.playerId, ev.magnet); }
  carMessage(id) { const c = this.car(id), m = this.world.magnets.get(id); return { type: 'car', playerId: id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, heading: c.heading, pullN: c.pullN, frictionN: c.frictionN, magnet: m ? { x: m.x, y: m.y, active: m.active } : null }; }

  // ---------- the reducer: all state changes live here so remote clients stay in sync
  _apply(ev) {
    const P = ev.playerId ? this.players.get(ev.playerId) : null, car = P ? this.car(P.id) : null;
    switch (ev.type) {
      case 'start': this.phase = this.mode === 'turns' ? 'roll' : 'turn'; this.turnIdx = 0; break;
      case 'dice': P.doubleDice = false; this.turn = { playerId: P.id, a: ev.a, b: ev.b, doubled: !!ev.doubled, seconds: ev.seconds, timeTotal: ev.seconds, timeLeft: ev.seconds, started: false, skipSand: false }; this.phase = 'turn'; this.world.mods.set(P.id, {}); break;
      case 'turnGo': if (this.turn) this.turn.started = true; break;
      case 'checkpoint': {
        const n = this.track.checkpoints.length; P.lastCp = ev.index; P.cp = (ev.index + 1) % n; if (ev.index === n - 1) P.lapArmed = true;
        break; }
      case 'uncheck': { const n = this.track.checkpoints.length; P.cp = ev.index; P.lastCp = (ev.index - 1 + n) % n; if (ev.index === 0) P.lapArmed = false; break; }
      case 'lap': {
        P.lap = ev.lap; P.lapArmed = false; P.fuelTaken.clear(); P.cardsTaken.clear();
        if (P.lap >= this.laps) { P.finished = true; const first = !this.firstFinisher; if (first) { this.firstFinisher = P.id; P.score += LAP_BONUS; }
          ev.finished = true; ev.bonus = first ? LAP_BONUS : 0; if (car) car.vx = car.vy = 0;
          if (this.mode === 'turns') this.finalRound = true;
          if (this.mode === 'duel' && this.graceLeft == null && ![...this.players.values()].every(p => p.finished)) this.graceLeft = DUEL_GRACE; }
        break; }
      case 'pitstop': P.fuelTaken.add(ev.zoneS); this.pit = { playerId: P.id, zoneS: ev.zoneS }; this.phase = 'pitstop'; if (car) car.vx = car.vy = 0; this.world.setMagnet(P.id, { x: 0, y: 0, active: false }); break;
      case 'fuel': P.fuelTaken.add(ev.zoneS); if (this.turn && this.turn.playerId === P.id) { this.turn.timeLeft += ev.add; this.turn.timeTotal += ev.add; } if (this.phase === 'pitstop') { this.phase = 'turn'; this.pit = null; P.needRelease = true; } break;
      case 'question': P.cardsTaken.add(ev.zoneS); this.questions.set(P.id, { playerId: P.id, view: ev.view, askedAt: ev.t }); if (this.mode === 'turns') this.phase = 'question'; else if (car) { car.vx = car.vy = 0; } break;
      case 'answer': {
        this.questions.delete(P.id);
        if (ev.correct) { P.streak = ev.streak; P.score += ev.points; if (ev.powerup) P.powerups.push(ev.powerup); }
        else { P.streak = 0; if (ev.skipNext) P.skipNext = true; }
        if (this.mode === 'turns') { this.phase = 'turn'; if (!ev.correct && this.owns(P.id)) this._endTurnDeferred = ev.skipNext ? 'wrongHard' : 'wrong'; }
        else if (!ev.correct && car) { car.frozen = 1.5; }
        break; }
      case 'fell': if (car) this.world.respawn(car, ev.pose); if (this.mode === 'duel' && car) { car.frozen = 1; P.needRelease = true; } break;
      case 'stuck': if (car) { car.stuck = false; car.vx = car.vy = 0; } if (this.mode === 'duel' && car) { car.frozen = 1.2; P.needRelease = true; } break;
      case 'powerup': {
        P.powerups.splice(P.powerups.indexOf(ev.kind), 1);
        if (ev.kind === 'fuel' && this.turn) { this.turn.timeLeft += 5; this.turn.timeTotal += 5; }
        if (ev.kind === 'skip') { this.world.mods.set(P.id, { skipSand: true }); if (this.turn) this.turn.skipSand = true; }
        if (ev.kind === 'dice') P.doubleDice = true;
        if (ev.kind === 'steal') { const from = this.players.get(ev.fromId); if (from && from.score > 0) { from.score -= 1; P.score += 1; } }
        break; }
      case 'skipped': P.skipNext = false; break;
      case 'turnEnd': { P.needRelease = false; if (car) { car.vx = car.vy = 0; car.stuck = false; } this.world.setMagnet(P.id, { x: 0, y: 0, active: false }); this.world.mods.set(P.id, {});
        this.turn = null; this.pit = null; this.questions.delete(P.id); if (ev.next != null) { this.turnIdx = ev.nextIdx; this.phase = 'roll'; } break; }
      case 'left': P.finished = true; P.left = true; if (car) { car.vx = car.vy = 0; } break;
      case 'over': this.phase = 'over'; this.ranking = ev.ranking; break;
    }
    // a wrong answer ends the turn after the answer event has been recorded
    if (this._endTurnDeferred) { const r = this._endTurnDeferred; this._endTurnDeferred = null; this._endTurn(r); }
    // finishing a lap during your own turn ends the turn
    if (ev.type === 'lap' && ev.finished && this.mode === 'turns' && this.owns(P.id) && this.phase === 'turn') this._endTurn('finished');
  }
}
