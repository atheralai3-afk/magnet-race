import { BANK } from './bank.js';

// Draws questions without repeats per difficulty, shuffles options, checks answers.
export class QuestionDeck {
  constructor(rnd, bank = BANK) {
    this.rnd = rnd; this.bank = bank;
    this.piles = { easy: [], medium: [], hard: [] };
    this.live = new Map(); // drawId -> {q, correctIndex, startedAt}
    this.n = 0;
  }
  _refill(d) { this.piles[d] = this.rnd.shuffle(this.bank.filter(q => q.d === d)); }
  draw(difficulty, now = 0) {
    if (!this.piles[difficulty].length) this._refill(difficulty);
    const q = this.piles[difficulty].pop();
    const drawId = ++this.n;
    let view;
    if (q.type === 'num') {
      view = { drawId, id: q.id, difficulty, topic: q.t, text: q.q, type: 'num', unit: q.unit };
      this.live.set(drawId, { q, startedAt: now });
    } else {
      const order = this.rnd.shuffle(q.o.map((_, i) => i));
      view = { drawId, id: q.id, difficulty, topic: q.t, text: q.q, type: 'mcq', options: order.map(i => q.o[i]) };
      this.live.set(drawId, { q, correctIndex: order.indexOf(q.a), startedAt: now });
    }
    return view;
  }
  // value: option index (mcq) or number/string (num)
  check(drawId, value, now = 0) {
    const l = this.live.get(drawId);
    if (!l) return null;
    this.live.delete(drawId);
    let correct;
    if (l.q.type === 'num') {
      const v = parseFloat(String(value).replace(',', '.'));
      const tol = Math.max(0.02 * Math.abs(l.q.answer), 0.005);
      correct = Number.isFinite(v) && Math.abs(v - l.q.answer) <= tol;
    } else correct = Number(value) === l.correctIndex;
    return { correct, correctIndex: l.correctIndex, correctAnswer: l.q.type === 'num' ? `${l.q.answer} ${l.q.unit}` : l.q.o[l.q.a], why: l.q.why, seconds: now - l.startedAt };
  }
}
