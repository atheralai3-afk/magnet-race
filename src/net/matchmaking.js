import { PLAYER_COLORS } from './room.js';
import { randomSeed } from '../util/rng.js';

// Public duel queue: everyone waiting sits on one channel. Players are paired by join time;
// the earlier player of each pair is the host and sends the `match` message to the other.
export class Matchmaker {
  constructor(transport, { name, rank = 0 }) { this.transport = transport; this.name = name; this.rank = rank; this.me = transport.clientId; this.joinedAt = Date.now(); }
  async find({ timeout = 60000, onStatus } = {}) {
    const ch = this.ch = await this.transport.join('mm:duel');
    return new Promise(async (resolve, reject) => {
      let done = false;
      const finish = (m) => { if (done) return; done = true; clearTimeout(tm); ch.leave(); resolve(m); };
      const tm = setTimeout(() => { if (!done) { done = true; ch.leave(); reject(new Error('timeout')); } }, timeout);
      ch.on('match', m => { if (m.guest === this.me) finish({ ...m, isHost: false }); });
      ch.onPresence(list => {
        onStatus?.(list.length);
        const sorted = list.slice().sort((a, b) => a.joinedAt - b.joinedAt || (a.key < b.key ? -1 : 1));
        const i = sorted.findIndex(p => p.key === this.me);
        if (i < 0 || i % 2 !== 0 || !sorted[i + 1]) return; // I am a host only if I am first of a complete pair
        const guest = sorted[i + 1];
        const m = { code: 'DUEL-' + Math.random().toString(36).slice(2, 8).toUpperCase(), seed: randomSeed(), host: this.me, guest: guest.key,
          players: [{ id: this.me, name: this.name, color: PLAYER_COLORS[0] }, { id: guest.key, name: guest.name, color: PLAYER_COLORS[1] }], mode: 'duel', settings: { laps: 3 } };
        ch.send('match', m);
        setTimeout(() => finish({ ...m, isHost: true }), 50);
      });
      await ch.track({ name: this.name, rank: this.rank, joinedAt: this.joinedAt });
    });
  }
  cancel() { this.ch?.leave(); }
}
