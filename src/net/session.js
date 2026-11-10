import { Match } from '../game/match.js';

const CAR_HZ = 15;        // car updates per second while the car is moving
const IDLE_HZ = 2;        // heartbeat while the car is still
const WAIT_MS = 15000;    // how long to wait for everyone to arrive in the game channel
const EXTRAPOLATE = 0.25; // seconds a remote car keeps coasting on its last velocity

// Runs one Match over a channel. Each client owns its own player: it simulates that car,
// emits that player's events, and mirrors everyone else's events.
export class NetSession {
  constructor(transport, { code, start, track, onEnd, waitMs = WAIT_MS }) {
    this.transport = transport; this.code = code; this.start = start; this.track = track; this.me = transport.clientId; this.onEnd = onEnd; this.waitMs = waitMs;
    this.isHost = start.players[0]?.id === this.me || start.host === this.me;
    this.inbox = []; this.lastCar = new Map(); this.seen = new Set();
  }
  async open({ onWaiting } = {}) {
    const { seed, players, settings, mode } = this.start;
    this.match = new Match({ mode: mode || 'turns', players, track: this.track, laps: settings?.laps ?? 3, seed, localIds: [this.me] });
    this.ch = await this.transport.join('game:' + this.code);
    // messages that arrive before our own match has started are queued, then applied in order
    const receive = ev => { if (this.ready) this._apply(ev); else this.inbox.push(ev); };
    this.ch.on('ev', receive);
    this.ch.on('car', receive);
    let arrived = null;
    const allHere = new Promise(r => { arrived = r; });
    this.ch.onPresence(list => {
      const here = new Set(list.map(p => p.key));
      for (const k of here) this.seen.add(k);
      if (players.every(p => this.seen.has(p.id))) arrived();
      if (!this.ready) return;
      // a player counts as gone only after we have actually seen them in the game channel
      for (const id of this.match.order) if (!here.has(id) && this.seen.has(id) && id !== this.me && this.match.player(id) && !this.match.player(id).left) {
        if (this.isHost || this.match.mode === 'duel') this.match.playerLeft(id);
      }
    });
    await this.ch.track({ name: players.find(p => p.id === this.me)?.name, joinedAt: Date.now() });
    // wait (briefly) until everybody has joined, so nobody misses the first dice roll
    if (players.length > 1 && !players.every(p => this.seen.has(p.id))) {
      onWaiting?.(players.filter(p => !this.seen.has(p.id)).map(p => p.name));
      await Promise.race([allHere, new Promise(r => setTimeout(r, this.waitMs))]);
    }
    const missing = players.filter(p => p.id !== this.me && !this.seen.has(p.id));
    if (players.length > 1 && missing.length === players.length - 1) { this.close(); throw new Error(mode === 'duel' ? 'opponent' : 'nobody'); }
    this.match.start(); this.match.drain(); // 'start' is applied locally by everyone from the same payload
    this.ready = true; this.carAcc = 0; this.idleAcc = 0;
    for (const ev of this.inbox.splice(0)) this._apply(ev);
    if (this.isHost || this.match.mode === 'duel') for (const p of missing) this.match.playerLeft(p.id);
    return this.match;
  }
  _apply(ev) {
    if (ev.type === 'car') this.lastCar.set(ev.playerId, performance.now());
    this.match.applyEvent(ev);
  }
  // call every frame; returns the events for the UI
  update(dt) {
    const m = this.match, evs = m.update(dt);
    for (const ev of evs) if (ev.origin === 'local' && ev.type !== 'start') { const { origin, ...wire } = ev; this.ch.send('ev', wire); }
    // remote cars: coast on their last known velocity between updates so they move smoothly
    const now = performance.now();
    for (const [id, t] of this.lastCar) {
      if (id === this.me || (now - t) / 1000 > EXTRAPOLATE) continue;
      const c = m.car(id); if (!c) continue;
      c.x += c.vx * dt; c.y += c.vy * dt; m.world.placeOnTrack(c);
    }
    const active = m.mode === 'duel' || (m.turn && m.turn.playerId === this.me);
    if (active && m.phase !== 'over') {
      const c = m.car(this.me), moving = c && (Math.abs(c.vx) + Math.abs(c.vy) > 1e-4 || m.world.magnets.get(this.me)?.active);
      this.carAcc += dt;
      if (this.carAcc >= 1 / (moving ? CAR_HZ : IDLE_HZ)) { this.carAcc = 0; this.ch.send('car', m.carMessage(this.me)); }
    }
    return evs;
  }
  roll() { return this.match.roll(); } // the dice event is broadcast by the next update()
  answer(v) { return this.match.answer(v); }
  pitDone(n) { return this.match.pitDone(n); }
  usePowerup(kind) { return this.match.usePowerup(this.me, kind); }
  setMagnet(mag) { this.match.setMagnet(this.me, mag); }
  close() { this.ch?.leave(); }
}
