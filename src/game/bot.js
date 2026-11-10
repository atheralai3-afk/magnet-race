import { autoMagnet } from './autodrive.js';

// Computer players for "Play vs Bots". A bot does exactly what a person does through the same
// Match API: roll, hold the magnet ahead of its car, do the pit stop and answer cards.
export const BOT_LEVELS = {
  easy:   { label: 'Easy',   acc: { easy: 0.6,  medium: 0.4,  hard: 0.25 }, lead: 0.034, wobble: 0.010, think: [3, 6],   pit: [0, 2] },
  normal: { label: 'Normal', acc: { easy: 0.8,  medium: 0.6,  hard: 0.45 }, lead: 0.037, wobble: 0.005, think: [2, 4.5], pit: [1, 3] },
  hard:   { label: 'Hard',   acc: { easy: 0.95, medium: 0.85, hard: 0.7 },  lead: 0.040, wobble: 0,     think: [1.2, 3], pit: [2, 3] },
};
// named after the scientists the flashcards are about
export const BOT_NAMES = ['Faraday', 'Tesla', 'Curie', 'Ørsted', 'Maxwell', 'Ampère', 'Gilbert', 'Volta'];

export function makeBots(n, level, rnd = Math.random) {
  const pool = BOT_NAMES.slice(), out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'bot' + (i + 1), name: 'Bot ' + pool.splice(Math.floor(rnd() * pool.length), 1)[0], bot: level });
  return out;
}

export class BotBrain {
  // ids: the player ids this brain plays for; rnd: () => [0,1)
  constructor(match, ids, level = 'normal', rnd = Math.random) {
    this.m = match; this.ids = new Set(ids); this.L = BOT_LEVELS[level] || BOT_LEVELS.normal; this.rnd = rnd;
    this.wait = 0; this.key = null; this.t = 0; this.phaseOff = rnd() * 10;
  }
  has(id) { return this.ids.has(id); }
  // the bot whose move it is right now (turn-based races), or null
  get active() { const c = this.m.current; return c && this.ids.has(c.id) && !c.finished ? c.id : null; }
  _between([a, b]) { return a + this.rnd() * (b - a); }
  // wait `sec` once per situation `key`; returns true when it is time to act
  _after(key, sec) { if (this.key !== key) { this.key = key; this.wait = sec; } return this.wait <= 0; }

  update(dt) {
    const m = this.m; this.t += dt; this.wait -= dt;
    // a bot that owes the game an answer (also works when it is not the bot's turn, e.g. duels)
    for (const [id, q] of m.questions) if (this.ids.has(id)) return this._answer(id, q);
    const id = this.active; if (!id) return;
    const P = m.player(id), car = m.car(id);
    if (m.phase === 'roll') {
      if (!this._after('roll' + m.log.length, 1.1)) return;
      if (P.powerups.includes('dice')) m.usePowerup(id, 'dice');
      if (P.powerups.includes('steal')) m.usePowerup(id, 'steal');
      m.roll(); return;
    }
    if (m.phase === 'pitstop' && m.pit?.playerId === id) {
      m.setMagnet(id, { x: 0, y: 0, active: false });
      if (this._after('pit' + m.pit.zoneS, 2.6)) m.pitDone(Math.round(this._between(this.L.pit)));
      return;
    }
    if (m.phase !== 'turn' || !m.turn || m.turn.playerId !== id) return;
    // pause a moment after the dice so people can see the roll, and lift the magnet after a pit stop
    if (!m.turn.started && !this._after('go' + m.turn.seconds + ':' + m.log.length, 0.9)) return;
    if (P.needRelease) { m.setMagnet(id, { x: 0, y: 0, active: false }); return; }
    if (m.turn.started && P.powerups.includes('fuel') && m.turn.timeLeft < 4) m.usePowerup(id, 'fuel');
    const target = autoMagnet(m.track, car, { lead: this.L.lead });
    // easier bots wobble a little, so they sometimes clip a shield or drift wide like a person would
    if (this.L.wobble) {
      const p = m.track.pointAt(car.s), w = Math.sin(this.t * 1.7 + this.phaseOff) * this.L.wobble;
      target.x += p.nx * w; target.y += p.ny * w;
    }
    m.setMagnet(id, target);
  }

  _answer(id, q) {
    const m = this.m, v = q.view;
    m.setMagnet(id, { x: 0, y: 0, active: false });
    if (!this._after('q' + v.drawId, this._between(this.L.think))) return;
    const live = m.deck.live.get(v.drawId); if (!live) return;
    const right = this.rnd() < (this.L.acc[v.difficulty] ?? 0.5);
    let value;
    if (v.type === 'num') value = right ? live.q.answer : +(live.q.answer * (this.rnd() < 0.5 ? 0.5 : 2) + 1).toFixed(3);
    else if (right) value = live.correctIndex;
    else { const n = v.options.length, k = 1 + Math.floor(this.rnd() * (n - 1)); value = (live.correctIndex + k) % n; }
    m.answer(value);
  }
}
