// Per-device profile: name, lifetime stats, today's challenge. Stored in localStorage (guarded).
const KEY = 'mr.profile.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} };

const DEFAULT = { name: '', games: 0, wins: 0, best: 0, right: 0, answered: 0, laps: 0, challenges: {} };
export function profile() { return { ...DEFAULT, ...read() }; }
export function setName(name) { const p = profile(); p.name = name; write(p); return p; }

export const CHALLENGES = [
  { id: 'score15', text: 'Score 15+ points in one race', metric: 'score', target: 15 },
  { id: 'streak5', text: 'Answer 5 cards in a row correctly', metric: 'maxStreak', target: 5 },
  { id: 'clean', text: 'Finish a race without falling off', metric: 'clean', target: 1 },
  { id: 'hard3', text: 'Get 3 hard cards right in one race', metric: 'hardRight', target: 3 },
  { id: 'power2', text: 'Use 2 power-ups in one race', metric: 'powerups', target: 2 },
  { id: 'pit6', text: 'Earn 6 s at one Charge Pit Stop', metric: 'pitBest', target: 6 },
  { id: 'speed4', text: 'Earn 4 speed bonuses in one race', metric: 'speedBonuses', target: 4 },
];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export function todaysChallenge() {
  const d = new Date(), idx = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5) % CHALLENGES.length;
  const c = CHALLENGES[idx], p = profile(), rec = p.challenges[dayKey()] || { best: 0, done: false };
  return { ...c, best: rec.best, done: rec.done, progress: Math.min(1, rec.best / c.target) };
}

// Stats for one player from a finished match log
export function statsFromLog(log, playerId, finishedPlayers) {
  const s = { score: 0, maxStreak: 0, clean: 0, hardRight: 0, powerups: 0, pitBest: 0, speedBonuses: 0, right: 0, answered: 0, fell: 0, laps: 0 };
  for (const e of log) {
    if (e.playerId !== playerId) continue;
    if (e.type === 'answer') { s.answered++; if (e.correct) { s.right++; s.maxStreak = Math.max(s.maxStreak, e.streak); if (e.difficulty === 'hard') s.hardRight++; if (e.speed) s.speedBonuses++; } }
    if (e.type === 'powerup') s.powerups++;
    if (e.type === 'fuel') s.pitBest = Math.max(s.pitBest, e.add);
    if (e.type === 'fell') s.fell++;
    if (e.type === 'lap') s.laps = e.lap;
  }
  s.clean = finishedPlayers.has(playerId) && s.fell === 0 ? 1 : 0;
  return s;
}

// Record a finished game for the local players. Returns {challengeDone:boolean}
export function recordGame({ log, localIds, ranking, finished }) {
  const p = profile(), c = todaysChallenge(), key = dayKey();
  const rec = p.challenges[key] || { best: 0, done: false }; const wasDone = rec.done;
  p.games++;
  for (const id of localIds) {
    const s = statsFromLog(log, id, finished), r = ranking.find(x => x.id === id);
    s.score = r?.score ?? 0;
    p.best = Math.max(p.best, s.score); p.right += s.right; p.answered += s.answered; p.laps += s.laps;
    rec.best = Math.max(rec.best, s[c.metric] || 0);
  }
  if (ranking.length > 1 && localIds.length === 1 && ranking[0].id === localIds[0]) p.wins++;
  rec.done = rec.best >= c.target;
  // keep only the last 14 days
  p.challenges = Object.fromEntries(Object.entries({ ...p.challenges, [key]: rec }).slice(-14));
  write(p);
  return { challengeDone: rec.done && !wasDone, challenge: c };
}
