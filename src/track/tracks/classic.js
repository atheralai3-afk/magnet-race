// Classic track. Board 0.61 m x 0.35 m (1 px of the concept art = 0.5 mm).
const PX = 1 / 2000;
const pts = [[300, 250], [700, 175], [1100, 215], [1265, 420], [1130, 665], [820, 610], [640, 735], [320, 700], [195, 470]];

export const classic = {
  id: 'classic',
  name: 'Classic',
  board: { x: 110 * PX, y: 110 * PX, w: 1220 * PX, h: 700 * PX },
  points: pts.map(([x, y]) => [x * PX, y * PX]),
  laneWidth: 0.05,
  checkpoints: 4,
  // s values are fractions of the lap length
  zones: [
    { type: 'card', s: 0.07, difficulty: 'easy' },
    { type: 'sand', s: 0.14, len: 0.06, fractions: false }, // len in metres
    { type: 'card', s: 0.26, difficulty: 'medium' },
    { type: 'plate', s: 0.33, side: 1 },
    { type: 'fuel', s: 0.40 },
    { type: 'sand', s: 0.46, len: 0.055 },
    { type: 'card', s: 0.58, difficulty: 'hard' },
    { type: 'fuel', s: 0.64 },
    { type: 'plate', s: 0.71, side: -1 },
    { type: 'card', s: 0.82, difficulty: 'easy' },
    { type: 'card', s: 0.90, difficulty: 'medium' },
  ],
};
