import { Match } from '../game/match.js';

const CAR_HZ = 20;

// Runs one Match over a channel. Each client owns its own player: it simulates that car,
// emits that player's events, and mirrors everyone else's events.
export class NetSession {
  constructor(transport, { code, start, track, onEnd }) {
    this.transport = transport; this.code = code; this.start = start; this.track = track; this.me = transport.clientId; this.onEnd = onEnd;
    this.isHost = start.players[0]?.id === this.me || start.host === this.me;
  }
  async open() {
    const { seed, players, settings, mode } = this.start;
    this.match = new Match({ mode: mode || 'turns', players, track: this.track, laps: settings?.laps ?? 3, seed, localIds: [this.me] });
    this.ch = await this.transport.join('game:' + this.code);
    this.ch.on('ev', ev => this.match.applyEvent(ev));
    this.ch.on('car', ev => this.match.applyEvent(ev));
    this.seen = new Set();
    this.ch.onPresence(list => {
      const here = new Set(list.map(p => p.key));
      for (const k of here) this.seen.add(k);
      if (!this.ready) return;
      // a player counts as gone only after we have actually seen them in the game channel
      for (const id of this.match.order) if (!here.has(id) && this.seen.has(id) && id !== this.me && this.match.player(id) && !this.match.player(id).left) {
        if (this.isHost || this.match.mode === 'duel') this.match.playerLeft(id);
      }
    });
    await this.ch.track({ name: players.find(p => p.id === this.me)?.name, joinedAt: Date.now() });
    this.match.start(); this.match.drain(); // 'start' is applied locally by everyone from the same payload
    this.ready = true; this.carAcc = 0;
    return this.match;
  }
  // call every frame; returns the events for the UI
  update(dt) {
    const m = this.match, evs = m.update(dt);
    for (const ev of evs) if (ev.origin === 'local' && ev.type !== 'start') { const { origin, ...wire } = ev; this.ch.send('ev', wire); }
    const active = m.mode === 'duel' || (m.turn && m.turn.playerId === this.me);
    if (active && m.phase !== 'over') { this.carAcc += dt; if (this.carAcc >= 1 / CAR_HZ) { this.carAcc = 0; this.ch.send('car', m.carMessage(this.me)); } }
    return evs;
  }
  roll() { return this.match.roll(); } // the dice event is broadcast by the next update()
  answer(v) { return this.match.answer(v); }
  pitDone(n) { return this.match.pitDone(n); }
  usePowerup(kind) { return this.match.usePowerup(this.me, kind); }
  setMagnet(mag) { this.match.setMagnet(this.me, mag); }
  close() { this.ch?.leave(); }
}
