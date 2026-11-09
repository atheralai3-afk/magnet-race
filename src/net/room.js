import { roomCode, randomSeed } from '../util/rng.js';

export const PLAYER_COLORS = ['#FF3B30', '#0A84FF', '#34C759', '#FF9500'];
export const MAX_PLAYERS = 4;

// A lobby on one channel. The host (earliest joiner) owns settings and starts the game.
// Everyone tracks presence {name, ready, joinedAt}; the host broadcasts `settings` and `start`.
export class Room {
  constructor(transport, { code, name, isHost }) {
    this.transport = transport; this.code = code || roomCode(); this.name = name; this.isHost = !!isHost;
    this.me = transport.clientId; this.settings = { laps: 3, difficulties: ['easy', 'medium', 'hard'], track: 'classic' };
    this.players = []; this.listeners = new Set(); this.started = null; this.joinedAt = Date.now();
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _changed() { for (const f of this.listeners) f(this); }
  async open() {
    this.ch = await this.transport.join('room:' + this.code);
    this.ch.onPresence(list => {
      const sorted = list.slice().sort((a, b) => a.joinedAt - b.joinedAt || (a.key < b.key ? -1 : 1));
      this.players = sorted.slice(0, MAX_PLAYERS).map((p, i) => ({ id: p.key, name: p.name, ready: !!p.ready, color: PLAYER_COLORS[i], host: i === 0 }));
      this.isHost = this.players[0]?.id === this.me;
      this.full = list.length > MAX_PLAYERS && !this.players.find(p => p.id === this.me);
      if (this.isHost) this.ch.send('settings', this.settings);
      this._changed();
    });
    this.ch.on('settings', s => { if (!this.isHost) { this.settings = s; this._changed(); } });
    this.ch.on('start', s => { this.started = s; this._changed(); });
    await this.ch.track({ name: this.name, ready: this.isHost, joinedAt: this.joinedAt });
    return this;
  }
  setReady(ready) { return this.ch.track({ name: this.name, ready, joinedAt: this.joinedAt }); }
  setSettings(patch) { if (!this.isHost) return; this.settings = { ...this.settings, ...patch }; this.ch.send('settings', this.settings); this._changed(); }
  get canStart() { return this.isHost && this.players.length >= 1 && this.players.every(p => p.ready || p.host); }
  start(extra = {}) {
    if (!this.canStart) return null;
    const s = { seed: randomSeed(), players: this.players.map(p => ({ id: p.id, name: p.name, color: p.color })), settings: this.settings, mode: 'turns', ...extra };
    this.ch.send('start', s); this.started = s; this._changed(); return s;
  }
  leave() { this.ch?.leave(); }
}
