export const POWERUPS = {
  fuel: { id: 'fuel', name: 'Extra Fuel', desc: '+5 seconds on your timer', icon: 'fuel' },
  skip: { id: 'skip', name: 'Skip Patch', desc: 'Sandpaper feels smooth for the rest of this turn', icon: 'skip' },
  dice: { id: 'dice', name: 'Double Dice', desc: 'Your next roll counts double', icon: 'dice' },
  steal: { id: 'steal', name: 'Steal 1 pt', desc: 'Take 1 point from the leader', icon: 'steal' },
};
export const POWERUP_IDS = Object.keys(POWERUPS);

// Earned by difficulty: medium 40%, hard always, easy never.
export function rollPowerup(difficulty, rnd) {
  if (difficulty === 'hard' || (difficulty === 'medium' && rnd() < 0.4)) return POWERUP_IDS[rnd.int(POWERUP_IDS.length)];
  return null;
}
