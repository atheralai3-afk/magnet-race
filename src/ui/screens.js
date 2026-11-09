import { h, clear } from './dom.js';
import { art, icon } from './art.js';
import { enhance, tabLens, tween } from './motion.js';
import { POWERUPS } from '../game/powerups.js';
import { PLAYER_COLORS } from '../net/room.js';

const PTS = { easy: 1, medium: 2, hard: 3 };
const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const PU_GRAD = { fuel: 'linear-gradient(135deg,#64D2FF,#0A84FF)', skip: 'linear-gradient(135deg,#FFC04D,#FF9500)', dice: 'linear-gradient(135deg,#BF5AF2,#5E5CE6)', steal: 'linear-gradient(135deg,#FF7A70,#FF3B30)' };
const raw = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const ic = (name, size) => raw(icon(name, size));
const tileArt = (topic, level, size) => h('div.tile', raw(art(topic, level, size)));
const initial = (n) => (n || '?').trim()[0]?.toUpperCase() || '?';
const avatar = (name, color, cls = '') => h('div.avatar' + cls, { style: { background: `linear-gradient(135deg, ${color}, ${shade(color)})` } }, initial(name));
function shade(hex) { const n = parseInt(hex.slice(1), 16), f = .72; return `rgb(${(n >> 16 & 255) * f | 0},${(n >> 8 & 255) * f | 0},${(n & 255) * f | 0})`; }
const btn = (cls, iconName, t1, t2, props = {}) => h('button.btn' + cls, props, iconName ? h('div.ic', ic(iconName, 28)) : null, h('div.txt', h('div.t1', t1), t2 ? h('div.t2', t2) : null), cls.includes('.sm') ? null : h('div.chev', ic('chev')));

// ------------------------------------------------------------------ sheets
export function openSheet(content, { onClose, dismissible = true, menu = true, cls = '' } = {}) {
  const sheetEl = h('div.glass.sheet' + cls, content);
  const dim = h('div.dim', sheetEl);
  let closed = false;
  const close = (silent) => {
    if (closed) return; closed = true; dim.classList.add('out');
    if (!document.querySelector('.dim:not(.out)')) document.body.classList.remove('sheet-open');
    setTimeout(() => dim.remove(), 300); if (!silent) onClose?.();
  };
  if (dismissible) {
    dim.addEventListener('pointerdown', e => { if (e.target === dim) close(); });
    sheetEl.prepend(h('button.btn.round.clear.x', { 'aria-label': 'Close', onclick: () => close() }, ic('x', 20)));
  }
  if (menu) document.body.classList.add('sheet-open');
  document.getElementById('ui').append(dim);
  enhance(sheetEl);
  dim.close = close; dim.sheet = sheetEl;
  return dim;
}

// ------------------------------------------------------------------ home
export function homeScreen({ online, prof, challenge, onSolo, onPass, onCreateRoom, onJoin, onDuel, onEditName }) {
  let code = '';
  const join = h('button.btn.sm.clear', { disabled: true, onclick: () => onJoin(code) }, h('div.txt', h('div.t1', 'Join')));
  const codeField = h('input.field.code', { placeholder: 'Room code', disabled: !online, maxLength: 8, 'aria-label': 'Room code',
    oninput: e => { let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (/^\d/.test(v)) v = 'MAG' + v; if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3, 7); e.target.value = v; code = v; join.disabled = !/^MAG-\d{4}$/.test(v); },
    onkeydown: e => { if (e.key === 'Enter' && !join.disabled) join.click(); } });
  const acc = prof.answered ? Math.round(prof.right / prof.answered * 100) : 0;
  const statEls = [['games', prof.games, 'Races'], ['best', prof.best, 'Best score'], ['acc', acc, 'Accuracy %'], ['laps', prof.laps, 'Laps driven']].map(([k, v, l]) => { const b = h('b', '0'); setTimeout(() => tween(b, 0, v, 900), 250); return h('div.stat', b, h('span', l)); });
  const bar = h('i' + (challenge.done ? '.done' : ''));
  setTimeout(() => bar.style.width = Math.max(4, challenge.progress * 100) + '%', 60);
  const wrap = h('div.menu-wrap',
    h('div.topbar',
      h('div.glass.pill.brand.mag', tileArt('Magnetism', 'easy', 40), 'Magnet Race'),
      h('button.glass.pill.me.mag', { onclick: onEditName, 'aria-label': 'Edit your name' }, avatar(prof.name || 'You', PLAYER_COLORS[0]), h('div', h('div.nm', prof.name || 'Set your name'), h('div.st', prof.games ? `Best ${prof.best} pts · ${prof.wins} win${prof.wins === 1 ? '' : 's'}` : 'Tap to edit')))),
    h('div.home-grid',
      h('div.glass.main-card.tilt',
        h('div.hero', tileArt('Magnetism', 'easy', 104), h('div', h('h1', 'Magnet Race'), h('p', 'Pull your car with physics. Answer to score.'))),
        h('div.actions',
          btn('.green', 'duel', 'Public Duel', online ? 'Get matched with a random player · 1v1' : 'Online play is off · see the note', { onclick: onDuel, disabled: !online }),
          btn('.blue', 'lock', 'Create Private Room', 'Invite up to 3 friends with a code', { onclick: onCreateRoom, disabled: !online }),
          h('div.row', { style: { gap: '12px' } }, codeField, join),
          h('div.row', { style: { gap: '12px' } },
            h('button.btn.clear', { onclick: onSolo, style: { flex: 1 } }, h('div.ic.s', ic('flag', 22)), h('div.txt', h('div.t1', { style: { fontSize: '18px' } }, 'Solo'), h('div.t2', 'Practice race'))),
            h('button.btn.clear', { onclick: onPass, style: { flex: 1 } }, h('div.ic.s', ic('users', 22)), h('div.txt', h('div.t1', { style: { fontSize: '18px' } }, 'Pass & Play'), h('div.t2', '2–4 on one device')))),
        )),
      h('div.side',
        h('div.glass.panel.tilt',
          h('div.lbl', ic('globe', 18), 'Online play'),
          h('div.big', online ? 'On' : 'Off'),
          h('div.row', { style: { gap: '8px', marginTop: '8px' } }, h('span.dot' + (online ? '' : '.off')), h('span.sub', { style: { fontSize: '14px' } }, online ? 'Rooms and duels ready' : 'Add Supabase keys to turn on'))),
        h('div.glass.panel.tilt',
          h('div.lbl', ic('flame', 18), challenge.done ? 'Daily challenge · done!' : 'Daily challenge'),
          h('div.mid', challenge.text),
          h('div.bar', bar),
          h('div.sub', { style: { fontSize: '13px', marginTop: '8px' } }, `${Math.min(challenge.best, challenge.target)} / ${challenge.target}`)),
        h('div.glass.panel.wide.tilt',
          h('div.lbl', ic('stats', 18), 'Your stats'),
          h('div.stats', statEls),
          online ? null : h('div.note', 'Solo and Pass & Play work anywhere. To turn on rooms and duels, paste a free Supabase project URL and anon key into ', h('code', 'src/config.js'), '.')),
      )));
  return enhance(wrap);
}

export function tabBar(onSelect) {
  const bar = h('nav.glass.pill.tabbar', { 'aria-label': 'Sections' },
    [['play', 'home', 'Play'], ['lab', 'flask', 'Lab'], ['rules', 'book', 'Rules']].map(([k, i, t], n) => h('button.tab' + (n ? '' : '.on'), { 'data-tab': k }, ic(i, 22), h('span', t))));
  bar.lens = tabLens(bar, onSelect);
  return bar;
}

// ------------------------------------------------------------------ sheets: setup, name, rules, confirm
export function passSetupSheet({ names = [], onStart, onClose }) {
  let count = Math.max(2, names.length || 2); const vals = [...names];
  const grid = h('div.pgrid');
  const render = () => { clear(grid); for (let i = 0; i < count; i++) grid.append(h('div.pin', { style: { animationDelay: i * 50 + 'ms' } }, avatar(vals[i] || `P${i + 1}`, PLAYER_COLORS[i]), h('input.field', { placeholder: `Player ${i + 1}`, value: vals[i] || '', maxLength: 14, oninput: e => vals[i] = e.target.value }))); };
  const seg = h('div.seg', [2, 3, 4].map(n => h('button', { className: n === count ? 'on' : '', onclick: () => { count = n; [...seg.children].forEach(b => b.classList.toggle('on', +b.textContent === n)); render(); } }, String(n))));
  render();
  const d = openSheet([h('h2', 'Pass & Play'), h('div.lead', 'Take turns on one device. Hand it over when your turn ends.'),
    h('div.row', { style: { marginTop: '22px', gap: '14px' } }, h('b', 'Players'), seg), grid,
    h('div.foot', h('span.sub', { style: { fontSize: '14px' } }, '3 laps · most points wins'), btn('.green.sm', 'flag', 'Start race', null, { onclick: () => { d.close(true); onStart(Array.from({ length: count }, (_, i) => ({ id: 'p' + (i + 1), name: (vals[i] || '').trim() || `Player ${i + 1}`, color: PLAYER_COLORS[i] }))); } }))], { onClose });
  return d;
}

export function nameSheet({ title, sub, cta, name = '', onGo, onClose }) {
  const input = h('input.field', { placeholder: 'Your name', value: name, maxLength: 14, onkeydown: e => { if (e.key === 'Enter') go(); } });
  const go = () => { const n = input.value.trim(); if (!n) { input.classList.add('bad'); setTimeout(() => input.classList.remove('bad'), 500); return; } d.close(true); onGo(n); };
  const d = openSheet([h('h2', title), h('div.lead', sub), h('div.row', { style: { marginTop: '22px', gap: '12px' } }, input, btn('.green.sm', null, cta, null, { onclick: go }))], { onClose, cls: '' });
  d.sheet.style.width = 'min(560px, 100%)'; setTimeout(() => input.focus(), 80);
  return d;
}

export function confirmSheet({ title, text, yes = 'Leave', no = 'Stay', onYes, menu = false }) {
  const d = openSheet([h('h2', title), h('div.lead', text), h('div.foot', btn('.clear.sm', null, no, null, { onclick: () => d.close() }), btn('.red.sm', null, yes, null, { onclick: () => { d.close(true); onYes(); } }))], { menu });
  d.sheet.style.width = 'min(480px, 100%)'; return d;
}

export function rulesSheet({ onClose }) {
  const R = [
    ['Magnetism', 'easy', 'Pull, never push', 'Press on the track to lower the magnet. It induces magnetism in the steel car, so it only ever attracts.'],
    ['Forces & friction', 'medium', 'Beat friction', 'The car moves only when the pull is bigger than friction: 0.10 N on the smooth track, 0.30 N on sandpaper.'],
    ['Magnetic screening', 'hard', 'Steel shields', 'Steel plates soak up the field. Behind them the pull drops to 15%, so steer around them.'],
    ['Attraction & repulsion', 'easy', "Don't get too close", 'If the car touches the magnet it sticks and your turn ends, so keep the magnet moving. Off the edge? Back to the last flag.'],
    ['Static charge', 'blue', 'Charge Pit Stop', 'Blue ⚡ zones: rub the balloon to charge it, then lift paper fuel. Each piece = +2 s.'],
    ['Electromagnetism', 'orange', 'Cards & points', 'Green = 1 pt, orange = 2, red = 3. Streaks give ×1.5 then ×2, answers under 5 s +1, first to finish +5.'],
  ];
  return openSheet([h('h2', 'How to play'), h('div.lead', 'Roll two dice: the total × 3 is how many seconds you get to drive. Most points wins.'),
    h('div.rules', R.map(([t, l, b, p]) => h('div.rule', tileArt(t, l === 'orange' ? 'medium' : l, 56), h('div', h('b', b), h('p', p)))))], { onClose });
}

// ------------------------------------------------------------------ online lobby + matchmaking
export function lobbySheet(room, { onStart, onLeave, onReady, onCopy }) {
  const body = h('div');
  const d = openSheet(body, { onClose: onLeave });
  let firstRender = true;
  const render = () => {
    clear(body);
    const me = room.players.find(p => p.id === room.me);
    body.append(h('h2', 'Private Room'), h('div.lead', 'Share the code. Up to 4 players.'),
      h('div.codebig', [...room.code].map((ch, i) => ch === '-' ? h('i', '–') : h('span.glass', { style: firstRender ? { animationDelay: i * 60 + 'ms' } : { animation: 'none' } }, ch))),
      h('div.row', { style: { justifyContent: 'center', gap: '12px' } }, btn('.clear.sm', 'copy', 'Copy link', null, { onclick: onCopy })),
      h('div.sect', `Players · ${room.players.length} / 4`),
      h('div.pcards',
        room.players.map(p => h('div.glass.pcard', { style: { animation: 'none' } }, avatar(p.name, p.color), h('div.nm', p.name + (p.id === room.me ? ' (you)' : '')), h('span.badge.' + (p.host ? 'host' : p.ready ? 'ready' : 'wait'), p.host ? 'Host' : p.ready ? 'Ready' : 'Not ready'))),
        Array.from({ length: Math.max(0, 4 - room.players.length) }, () => h('div.pcard.empty', '+ Waiting for player…'))),
      h('div.sect', 'Race settings'),
      h('div.settings', h('div', h('label', 'Laps'), h('div.seg', [1, 3, 5].map(n => h('button', { className: room.settings.laps === n ? 'on' : '', disabled: !room.isHost, onclick: () => room.setSettings({ laps: n }) }, String(n)))))),
      h('div.foot', h('span.sub', { style: { fontSize: '14px' } }, room.isHost ? (room.canStart ? 'Everyone is ready' : 'Waiting for everyone to be ready') : 'The host starts the race'),
        room.isHost ? btn('.green.sm', 'flag', 'Start race', null, { onclick: onStart, disabled: !room.canStart })
          : btn((me?.ready ? '.green' : '.blue') + '.sm', 'check', me?.ready ? 'Ready!' : 'Tap when ready', null, { onclick: () => onReady(!me?.ready) })));
    enhance(body); firstRender = false;
  };
  render(); d.rerender = render; return d;
}

export function searchingSheet({ me, onCancel }) {
  const title = h('h2', 'Finding an opponent…'), sub = h('div.lead', 'Matching you with another player'), timer = h('b', '0:00');
  const them = avatar('?', PLAYER_COLORS[1], '.them');
  const box = h('div', { style: { textAlign: 'center' } }, title, sub, h('div.radar', h('i'), h('i'), h('i'), avatar(me, PLAYER_COLORS[0], '.me'), them, h('div.vs', 'VS')), h('div.glass.pill', { style: { display: 'inline-block', padding: '9px 18px', marginTop: '8px' } }, timer));
  const d = openSheet(box, { onClose: onCancel }); d.sheet.style.width = 'min(560px, 100%)';
  const t0 = Date.now(); const iv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
  d.status = (n) => { sub.textContent = n > 1 ? `${n} players in the queue — pairing…` : 'Waiting for another player to join…'; };
  d.found = (name) => { clearInterval(iv); them.textContent = initial(name); d.sheet.classList.add('found'); title.textContent = 'Opponent found!'; sub.textContent = `${name} — get ready…`; };
  const close = d.close; d.close = (s) => { clearInterval(iv); close(s); };
  return d;
}

// ------------------------------------------------------------------ question sheet
export function questionSheet(view, { streak = 0, onAnswer }) {
  const d = view.difficulty;
  const speedFill = h('i'), speedLbl = h('div.speedlbl', 'Answer within 5 s for a +1 speed bonus');
  const body = h('div');
  const mult = streak + 1 >= 5 ? 2 : streak + 1 >= 3 ? 1.5 : 1;
  const content = [
    h('div.qhead', tileArt(view.topic, d, 58), h('div.chips', h('span.chip.' + d, `${LEVEL_NAME[d]} · ${PTS[d]} pt${PTS[d] > 1 ? 's' : ''}`), h('span.chip', view.topic)),
      mult > 1 ? h('div.qstreak', ic('flame', 20), `×${mult}`) : null),
    h('div.speedbar', speedFill), speedLbl,
    h('div.qtext', view.text), body];
  const dim = openSheet(content, { dismissible: false, menu: false });
  let answered = false;
  const t0 = performance.now(); let raf;
  (function tick(now) { const p = Math.max(0, 1 - (now - t0) / 5000); speedFill.style.transform = `scaleX(${p})`; if (p <= 0) { speedFill.style.background = 'rgba(255,255,255,.35)'; speedLbl.textContent = 'No speed bonus — take your time'; } else if (!answered) raf = requestAnimationFrame(tick); })(t0);
  const finish = (v) => { if (answered) return; answered = true; cancelAnimationFrame(raf); onAnswer(v); };
  if (view.type === 'mcq') {
    const opts = view.options.map((o, i) => h('button.opt', { onclick: () => finish(i) }, h('span.lt', 'ABCD'[i]), h('span', o), h('span.tick', ic('check', 26))));
    body.append(h('div.opts', opts));
    dim.result = (ev) => opts.forEach((b, i) => { b.disabled = true; if (i === ev.correctIndex) b.classList.add('ok'); else if (i === +ev.value) b.classList.add('bad'); else b.classList.add('fade'); });
    document.addEventListener('keydown', function key(e) { if (!dim.isConnected) return document.removeEventListener('keydown', key); const i = 'abcd'.indexOf(e.key.toLowerCase()); if (i >= 0 && i < opts.length) opts[i].click(); });
  } else {
    const input = h('input.field', { type: 'text', inputMode: 'decimal', placeholder: 'Your answer', 'aria-label': 'Your answer', onkeydown: e => { if (e.key === 'Enter') submit(); } });
    const submit = () => { if (!input.value.trim()) { input.classList.add('bad'); setTimeout(() => input.classList.remove('bad'), 500); return; } finish(input.value); };
    const go = btn('.blue.sm', null, 'Check', null, { onclick: submit });
    body.append(h('div.numrow', input, h('span.unit', view.unit), go)); enhance(body); setTimeout(() => input.focus(), 120);
    dim.result = (ev) => { input.disabled = true; go.disabled = true; input.classList.add(ev.correct ? 'ok' : 'bad'); };
  }
  dim.explain = (ev) => {
    const chips = ev.correct
      ? [h('span.chip', `Correct +${ev.base}`), ev.mult > 1 ? h('span.chip', `Streak ×${ev.mult} → +${Math.round(ev.base * ev.mult)}`) : null, ev.speed ? h('span.chip', 'Speed bonus +1') : null, h('span.chip.ok', `Total +${ev.points}`), ev.powerup ? h('span.chip.gift', `Power-up: ${POWERUPS[ev.powerup].name}`) : null]
      : [h('span.chip.bad', 'Wrong · turn over'), ev.skipNext ? h('span.chip', 'Hard card: you miss your next turn') : null];
    body.append(h('div.breakdown', chips.filter(Boolean).map((c, i) => { c.style.animationDelay = i * 90 + 'ms'; return c; })), h('div.explain', h('b', ev.correct ? 'Why: ' : `Answer: ${ev.correctAnswer}. `), ev.why));
  };
  return dim;
}

// ------------------------------------------------------------------ results
export function resultsSheet(snap, ranking, stats, { onAgain, onHome, challengeDone }) {
  const byId = new Map(snap.players.map(p => [p.id, p]));
  const winner = byId.get(ranking[0].id), solo = ranking.length === 1;
  confetti();
  const d = openSheet([
    h('div', { style: { textAlign: 'center' } }, h('div.tile', { style: { display: 'inline-block' } }, raw(art('Magnetism', 'easy', 84))),
      h('h2', { style: { marginTop: '10px' } }, solo ? `${ranking[0].score} points!` : `${winner.name} wins!`),
      h('div.lead', solo ? `${ranking[0].lap} lap${ranking[0].lap === 1 ? '' : 's'} · ${stats[ranking[0].id]?.right ?? 0} of ${stats[ranking[0].id]?.answered ?? 0} cards right` : 'Most points wins — laps break a tie')),
    challengeDone ? h('div.explain', { style: { textAlign: 'center', background: 'rgba(52,199,89,.28)' } }, h('b', 'Daily challenge complete! '), challengeDone.text) : null,
    solo ? null : h('div.podium', ranking.map((r, i) => { const p = byId.get(r.id), s = stats[r.id] || {}; return h('div.prow' + (i ? '' : '.first'), { style: { animationDelay: 150 + i * 90 + 'ms' } }, h('span.pos', String(i + 1)), avatar(p.name, p.color), h('div.info', h('b', p.name + (p.left ? ' (left)' : '')), h('span', `${r.lap} lap${r.lap === 1 ? '' : 's'} · ${s.right ?? 0}/${s.answered ?? 0} cards · best streak ${s.maxStreak ?? 0}`)), h('span.pts', `${r.score}`)); })),
    h('div.foot', { style: { justifyContent: 'center' } }, onAgain ? btn('.green.sm', 'play', 'Play again', null, { onclick: () => { d.close(true); onAgain(); } }) : null, btn('.clear.sm', 'home', 'Home', null, { onclick: () => { d.close(true); onHome(); } }))],
    { dismissible: false, menu: false });
  d.sheet.style.width = 'min(620px, 100%)';
  return d;
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('div.confetti'), cols = ['#34C759', '#FF9500', '#FF3B30', '#0A84FF', '#FFD60A', '#BF5AF2', '#fff'];
  for (let i = 0; i < 110; i++) box.append(h('i', { style: { left: Math.random() * 100 + '%', background: cols[i % cols.length], animationDuration: 2.2 + Math.random() * 2.2 + 's', animationDelay: Math.random() * .7 + 's', transform: `rotate(${Math.random() * 360}deg)`, width: 6 + Math.random() * 7 + 'px' } }));
  document.getElementById('ui').append(box); setTimeout(() => box.remove(), 5600);
}

// ------------------------------------------------------------------ in-race HUD
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieFace(n) { const d = h('div.die.pips', Array.from({ length: 9 }, () => h('i'))); setPips(d, n); return d; }
function setPips(d, n) { [...d.children].forEach((p, i) => p.classList.toggle('on', PIPS[n].includes(i))); d.setAttribute('aria-label', 'Die showing ' + n); }

export class Hud {
  constructor(root, cb) {
    this.cb = cb;
    this.layer = h('div.layer');
    this.lap = h('div.glass.lapbox'); this.streakEl = h('div');
    this.tl = h('div.hud.hud-tl', h('button.btn.round.clear', { 'aria-label': 'Pause', onclick: cb.onQuit }, ic('pause', 18)), h('div', this.lap, this.streakEl));
    this.score = h('div.glass.pill.hud.score'); this.timer = h('div.glass.hud.timer'); this.phys = h('div.glass.hud.physbox');
    this.pus = h('div.glass.hud.powerups');
    this.viewSw = h('div.switch' + (cb.physicsView ? '.on' : ''));
    this.soundBtn = h('button.btn.round.clear', { 'aria-label': 'Sound', onclick: () => { const on = cb.onToggleSound(); this.soundBtn.replaceChildren(ic(on ? 'sound' : 'mute', 20)); enhance(this.soundBtn); } }, ic(cb.soundOn ? 'sound' : 'mute', 20));
    this.br = h('div.hud.hud-br', this.soundBtn, h('button.glass.toggle.mag', { onclick: () => { this.viewSw.classList.toggle('on'); const on = this.viewSw.classList.contains('on'); this.phys.style.display = on ? '' : 'none'; cb.onToggleView(on); } }, h('div.txt', h('div.t', 'Physics view'), h('div.s', 'Forces & field lines')), this.viewSw));
    this.ahead = h('div.glass.pill.hud.ahead', { style: { opacity: 0 } });
    this.toasts = h('div.toasts'); this.centerBox = null;
    this.layer.append(this.tl, this.score, this.timer, this.phys, this.pus, this.br, this.ahead, this.toasts);
    if (!cb.physicsView) this.phys.style.display = 'none';
    root.append(this.layer); enhance(this.layer);
    this.sig = {}; this.prevScores = new Map();
  }
  _once(key, sig, fn) { if (this.sig[key] !== sig) { this.sig[key] = sig; fn(); } }
  // keep the live-physics panel in the empty infield of the track so it never hides the cars
  place(renderer) {
    const x = renderer.X(0.165), y = renderer.Y(0.145), w = renderer.S(0.36), hgt = renderer.S(0.12);
    Object.assign(this.phys.style, { left: x + 'px', top: y + 'px', maxWidth: w + 'px' });
    this.phys.classList.toggle('tiny', hgt < 150);
  }
  update(snap, inputId, track) {
    const P = snap.players.find(p => p.id === inputId) || snap.players[0];
    this._once('lap', `${P.lap}:${snap.laps}:${P.streak}`, () => {
      this.lap.replaceChildren(h('div.k', 'LAP'), h('div.v', String(Math.min(P.lap + 1, snap.laps)), h('small', ` / ${snap.laps}`)));
      this.streakEl.replaceChildren(P.streak >= 3 ? h('div.glass.pill.streak', ic('flame', 18), `Streak ×${P.streak >= 5 ? 2 : 1.5}`) : '');
    });
    this._once('score', snap.players.map(p => `${p.id}:${p.score}:${p.id === snap.currentId}:${p.finished}`).join('|'), () => {
      clear(this.score);
      snap.players.forEach((p, i) => {
        if (i) this.score.append(h('span.vs', 'VS'));
        const before = this.prevScores.get(p.id); const gained = before != null && p.score > before ? p.score - before : 0; this.prevScores.set(p.id, p.score);
        this.score.append(h('div.pb' + (p.id === snap.currentId || (snap.mode === 'duel' && p.id === inputId) ? '.on' : ''), avatar(p.name, p.color),
          h('div', h('div.nm', p.name), h('div.sc', String(p.score), gained ? h('span.plus', `+${gained}`) : null, p.finished ? h('span.flag', '🏁') : null))));
      });
    });
    // timer
    const t = snap.turn;
    if (snap.mode === 'turns') {
      const left = t ? Math.max(0, t.timeLeft) : 0, frac = t ? Math.min(1, left / t.timeTotal) : 0, R = 33, C = 2 * Math.PI * R;
      const col = frac > .5 ? '#34C759' : frac > .25 ? '#FF9F0A' : '#FF3B30';
      this._once('timer', `${t ? Math.ceil(left * 4) : -1}:${t?.started}:${t?.a}:${t?.timeTotal}`, () => {
        this.timer.replaceChildren(
          h('div.ring' + (t && t.started && left < 5 ? '.low' : ''), raw(`<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="8"/><circle cx="40" cy="40" r="${R}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" style="transition:stroke-dasharray .25s linear"/></svg>`), h('div.v', t ? `${Math.ceil(left)}s` : '—')),
          h('div', h('div.k', !t ? 'ROLL TO START' : t.started ? (t.playerId === inputId ? 'YOUR TURN' : 'TIME LEFT') : 'TOUCH TO START'),
            h('div.dice', h('div.die', t ? t.a : '?'), h('div.die', t ? t.b : '?')), h('div.eq', t ? `${t.a} + ${t.b} = ${t.a + t.b} × 3 s${t.timeTotal > (t.a + t.b) * 3 * (t.doubled ? 2 : 1) ? ' + fuel' : ''}` : 'total × 3 seconds')));
      });
    } else this._once('timer', 'duel', () => this.timer.replaceChildren(h('div', h('div.k', 'PUBLIC DUEL'), h('div', { style: { fontWeight: 800, fontSize: '22px', marginTop: '2px' } }, `First to ${snap.laps} laps`), h('div.eq', 'Most points wins'))));
    // live physics
    if (this.viewSw.classList.contains('on')) {
      const c = P.car;
      this.phys.replaceChildren(h('div.k', 'LIVE PHYSICS'),
        h('div', 'Pull ', h('b', { style: { color: '#7DFF9E' } }, `${c.pullN.toFixed(2)} N`), c.blocked ? h('span.sub', ' · screened') : ''),
        h('div', 'Friction ', h('b', { style: { color: '#FFC46B' } }, `${c.frictionN.toFixed(2)} N`), h('span.sub', c.surface === 'sand' ? ' · sandpaper μ 0.6' : ' · smooth μ 0.2')),
        h('div', 'Speed ', h('b', `${(c.speed * 100).toFixed(0)} cm/s`), h('span.sub', '  Gap '), h('b', c.dist < 1 ? `${(c.dist * 100).toFixed(1)} cm` : '—')));
    }
    // power-ups
    const usable = snap.mode === 'duel' ? snap.phase !== 'over' : snap.currentId === P.id && ['roll', 'turn'].includes(snap.phase);
    this._once('pu', `${P.id}:${P.powerups.join(',')}:${usable}:${snap.phase}`, () => {
      const prev = this.lastPu || []; clear(this.pus);
      if (!P.powerups.length) this.pus.append(h('div.pu-empty', 'Power-ups appear here — earn them with medium & hard cards'));
      P.powerups.forEach((k, i) => { const d = POWERUPS[k]; const isNew = i >= prev.length; this.pus.append(h('button.pu' + (isNew && prev.length !== undefined && this.lastPu ? '.new' : ''), { title: d.desc, disabled: !usable || (k === 'dice' && snap.phase !== 'roll') || (k === 'fuel' && snap.mode === 'duel'), onclick: () => this.cb.onPowerup(k) }, h('div.ic', { style: { background: PU_GRAD[k] } }, ic(d.icon, 28)), d.name)); });
      this.lastPu = P.powerups.slice(); enhance(this.pus);
    });
    // next zone hint
    let hint = null;
    if (snap.phase === 'turn' || snap.mode === 'duel') {
      for (const z of track.zones) { const ahead = track.forward(P.car.s, z.s); if (ahead > 0.005 && ahead < 0.12 && (z.type === 'card' || z.type === 'fuel' || z.type === 'plate' || z.type === 'sand')) { if (!hint || ahead < hint.ahead) hint = { ...z, ahead }; } }
    }
    this._once('ahead', hint ? `${hint.type}:${hint.s}` : 'none', () => {
      if (!hint) { this.ahead.style.opacity = 0; return; }
      const [col, txt] = hint.type === 'card' ? [{ easy: '#34C759', medium: '#FF9500', hard: '#FF3B30' }[hint.difficulty], `Card zone ahead · ${LEVEL_NAME[hint.difficulty]}`] : hint.type === 'fuel' ? ['#0A84FF', 'Charge Pit Stop ahead'] : hint.type === 'plate' ? ['#AEB4BF', 'Steel shield ahead — steer round it'] : ['#D9B36E', 'Sandpaper ahead — bring the magnet closer'];
      this.ahead.replaceChildren(h('span.dot', { style: { background: col, boxShadow: `0 0 10px ${col}` } }), txt); this.ahead.style.opacity = 1;
    });
  }
  toast(text, ms = 2200) { const el = h('div.glass.pill.toast', text); this.toasts.append(el); while (this.toasts.children.length > 3) this.toasts.firstChild.remove(); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms); }
  center(children) { this.clearCenter(); this.centerBox = enhance(h('div.glass.center', children)); this.layer.append(this.centerBox); }
  clearCenter() { this.centerBox?.remove(); this.centerBox = null; }
  rollPrompt(P, handover) {
    this.center([avatar(P.name, P.color), h('div.sub', handover ? 'Pass the device to' : 'Your turn'), h('h2', P.name),
      btn('.green.sm', 'dice', 'Roll the dice', null, { onclick: () => this.cb.onRoll() }), h('div.sub', { style: { fontSize: '13px', marginTop: '10px' } }, 'The total × 3 is your driving time')]);
  }
  waiting(P) { this.center([avatar(P.name, P.color), h('div.sub', 'Waiting for'), h('h2', P.name), h('div.sub', { style: { fontSize: '13px', marginTop: '8px' } }, 'Watch their car move live')]); }
  // Real dice with pips: they shake for a moment, land on the rolled numbers, then the result stays on
  // screen until the player puts the magnet down (presses pass straight through this box to the track).
  showDice(ev, P, mine) {
    const d1 = dieFace(1), d2 = dieFace(1), eq = h('div.eqbig', { style: { opacity: 0, transition: 'opacity .3s' } }, `${ev.a} + ${ev.b} = ${ev.a + ev.b}`, ev.doubled ? ' × 2' : '', ' × 3 = ', h('b', `${ev.seconds} s`));
    this.center([h('div.sub', `${P.name} rolled`), h('div.bigdice', d1, d2), eq,
      mine ? h('div.press', { style: { opacity: 0, transition: 'opacity .3s' } }, 'Press the glowing ring in front of your car') : null]);
    const box = this.centerBox; box.classList.add('passive');
    d1.classList.add('rolling'); d2.classList.add('rolling');
    const spin = setInterval(() => { setPips(d1, 1 + Math.floor(Math.random() * 6)); setPips(d2, 1 + Math.floor(Math.random() * 6)); }, 90);
    setTimeout(() => {
      clearInterval(spin); setPips(d1, ev.a); setPips(d2, ev.b); d1.classList.remove('rolling'); d2.classList.remove('rolling');
      d1.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      d2.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 450, delay: 80, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      eq.style.opacity = 1; box.querySelector('.press')?.style.setProperty('opacity', 1);
    }, 750);
    this.diceBox = box;
    // someone else's roll: just show it for a moment
    if (!mine) setTimeout(() => { if (this.centerBox === box) this.clearCenter(); }, 2600);
    else setTimeout(() => { if (this.centerBox === box) this.clearCenter(); }, 12000);
  }
  // the driver touched the track: hide the dice
  turnStarted() { if (this.centerBox && this.centerBox === this.diceBox) this.clearCenter(); }
  destroy() { this.layer.remove(); }
}
