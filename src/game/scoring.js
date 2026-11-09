export const BASE_POINTS = { easy: 1, medium: 2, hard: 3 };
export const LAP_BONUS = 5;          // first player to finish all laps
export const SPEED_BONUS_SECONDS = 5; // answer faster than this -> +1
export const STREAK_STEPS = [[5, 2], [3, 1.5]]; // [streak length, multiplier]

export function streakMultiplier(streak) {
  for (const [n, m] of STREAK_STEPS) if (streak >= n) return m;
  return 1;
}

// Score one answer. streakBefore = consecutive correct answers before this one.
export function scoreAnswer({ difficulty, correct, seconds, streakBefore = 0 }) {
  if (!correct) return { base: 0, mult: 1, speed: 0, total: 0, streakAfter: 0, loseTurn: true, skipNext: difficulty === 'hard' };
  const streakAfter = streakBefore + 1;
  const base = BASE_POINTS[difficulty];
  const mult = streakMultiplier(streakAfter);
  const speed = seconds <= SPEED_BONUS_SECONDS ? 1 : 0;
  const total = Math.round(base * mult) + speed;
  return { base, mult, speed, total, streakAfter, loseTurn: false, skipNext: false };
}

export function rankPlayers(players) {
  return players.slice().sort((a, b) => b.score - a.score || b.lap - a.lap || b.progress - a.progress);
}
