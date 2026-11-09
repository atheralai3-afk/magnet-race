import { h, clear, ICON } from './dom.js';
import { PLAYER_COLORS } from '../net/room.js';
import { POWERUPS } from '../game/powerups.js';

const DIFF_PTS = { easy: 1, medium: 2, hard: 3 };

export function homeScreen({ online, onSolo, onPass, onCreateRoom, onJoinRoom, onDuel, onLab }) {
  let code = '';
  const joinBtn = h('button.btn.sm', { onclick: () => onJoinRoom(code) }, h('span.t1', 'Join'));
  return h('div.screen', h('div.glass.card',
    h('div.row', { style: { gap: '18px' } }, h('div', { style: { fontSize: '54px' } }, ICON.magnet),
      h('div', h('h1.disp', 'Magnet Race'), h('div.sub', 'Pull your car with physics. Answer to score.'))),
    h('div.stack',
      h('button.btn.green', { onclick: onDuel, disabled: !online }, h('div.ic', ICON.duel), h('div', h('div.t1', 'Public Duel'), h('div.t2', online ? 'Get matched with a random player · 1v1' : 'Needs online setup (see note below)'))),
      h('button.btn.blue', { onclick: onCreateRoom, disabled: !online }, h('div.ic', ICON.lock), h('div', h('div.t1', 'Create Private Room'), h('div.t2', 'Invite up to 3 friends with a code'))),
      h('div.row', h('input.field', { placeholder: 'Enter room code · MAG-1234', disabled: !online, oninput: e => { code = e.target.value.trim().toUpperCase(); joinBtn.disabled = !/^MAG-\d{4}$/.test(code); } }), joinBtn),
      h('div.row', h('button.btn', { onclick: onSolo, style: { flex: 1 } }, h('div.ic', ICON.flag), h('div', h('div.t1', 'Solo'), h('div.t2', 'Time trial · 3 laps'))),
        h('button.btn', { onclick: onPass, style: { flex: 1 } }, h('div.ic', ICON.users), h('div', h('div.t1', 'Pass & Play'), h('div.t2', '2–4 players · one device')))),
    ),
    online ? null : h('div.note', 'Online play is off: add your Supabase URL and anon key in ', h('code', 'src/config.js'), ' to turn on private rooms and public duels. Solo and Pass & Play work everywhere.'),
  ));
}

export function passSetupScreen({ onStart, onBack }) {
  let count = 2; const names = ['', '', '', ''];
  const grid = h('div.names');
  const render = () => { clear(grid); for (let i = 0; i < count; i++) grid.append(h('input.field', { placeholder: `Player ${i + 1}`, value: names[i], oninput: e => names[i] = e.target.value })); };
  const seg = h('div.seg', [2, 3, 4].map(n => h('button', { className: n === count ? 'on' : '', onclick: e => { count = n; [...seg.children].forEach(b => b.classList.toggle('on', +b.textContent === n)); render(); } }, String(n))));
  render();
  return h('div.screen', h('div.glass.card',
    h('h2.disp', 'Pass & Play'), h('div.sub', 'Take turns on one device. Hand it over when your turn ends.'),
    h('div.stack', h('div.row', h('span', { style: { fontWeight: 600 } }, 'Players'), seg), grid,
      h('button.btn.green', { onclick: () => onStart(Array.from({ length: count }, (_, i) => ({ id: 'p' + (i + 1), name: names[i].trim() || `Player ${i + 1}`, color: PLAYER_COLORS[i] }))) }, h('div.ic', ICON.flag), h('div', h('div.t1', 'Start race'), h('div.t2', '3 laps · most points wins'))),
      h('button.btn.sm', { onclick: onBack }, h('span.t1', ICON.back + ' Back')))));
}

export function nameScreen({ title, sub, cta, onGo, onBack }) {
  let name = ''; try { name = localStorage.getItem('mr.name') || ''; } catch {}
  const input = h('input.field', { placeholder: 'Your name', value: name, maxLength: 14, oninput: e => name = e.target.value });
  return h('div.screen', h('div.glass.card', h('h2.disp', title), h('div.sub', sub),
    h('div.stack', input, h('button.btn.green', { onclick: () => { const n = name.trim() || 'Player'; try { localStorage.setItem('mr.name', n); } catch {} onGo(n); } }, h('div.ic', ICON.duel), h('div', h('div.t1', cta))),
      h('button.btn.sm', { onclick: onBack }, h('span.t1', ICON.back + ' Back')))));
}

export function lobbyScreen(room, { onStart, onLeave, onReady }) {
  const wrap = h('div.screen');
  const render = () => {
    clear(wrap);
    const me = room.players.find(p => p.id === room.me);
    wrap.append(h('div.glass.card',
      h('h2.disp', 'Private Room'), h('div.sub', 'Share the code. Up to 4 players.'),
      h('div.code', [...room.code].map(ch => ch === '-' ? h('i') : h('span', ch))),
      h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.sm', { onclick: () => navigator.clipboard?.writeText(location.href.split('#')[0] + '#' + room.code).catch(() => {}) }, h('span.t1', ICON.copy + ' Copy link'))),
      h('div.plist', room.players.map(p => h('div.prow', h('div.avatar', { style: { background: p.color } }, p.name[0].toUpperCase()), h('span', { style: { fontWeight: 700 } }, p.name, p.id === room.me ? ' (you)' : ''),
        h('span.tag', p.host ? 'Host' : p.ready ? 'Ready' : 'Not ready'))),
        ...Array.from({ length: Math.max(0, 4 - room.players.length) }, () => h('div.prow', { style: { opacity: .5, border: '1px dashed rgba(255,255,255,.3)', background: 'none' } }, h('span', 'Waiting for player…')))),
      h('div.stack',
        h('div.row', h('span', { style: { fontWeight: 600 } }, 'Laps'), h('div.seg', [1, 3, 5].map(n => h('button', { className: room.settings.laps === n ? 'on' : '', disabled: !room.isHost, onclick: () => room.setSettings({ laps: n }) }, String(n))))),
        room.isHost ? h('button.btn.green', { disabled: !room.canStart, onclick: onStart }, h('div.ic', ICON.flag), h('div', h('div.t1', 'Start race'), h('div.t2', room.canStart ? `${room.players.length} player${room.players.length > 1 ? 's' : ''} ready` : 'Waiting for everyone to be ready')))
          : h('button.btn.blue', { onclick: () => onReady(!me?.ready) }, h('div.ic', '✅'), h('div', h('div.t1', me?.ready ? 'Ready!' : 'Tap when ready'), h('div.t2', 'The host starts the race'))),
        h('button.btn.sm', { onclick: onLeave }, h('span.t1', ICON.back + ' Leave')))));
  };
  render(); wrap.rerender = render; return wrap;
}

export function searchingScreen({ onCancel }) {
  const status = h('div.sub', 'Looking for an opponent…');
  const el = h('div.screen', h('div.glass.card', { style: { textAlign: 'center' } }, h('div', { style: { fontSize: '54px' } }, ICON.duel), h('h2.disp', 'Finding an opponent'), status,
    h('div.stack', h('button.btn.sm', { onclick: onCancel, style: { alignSelf: 'center' } }, h('span.t1', 'Cancel')))));
  el.setStatus = (n) => status.textContent = n > 1 ? `${n} players in queue — pairing…` : 'Waiting for another player…';
  return el;
}

// ------------------------------------------------------------------ in-race HUD
export class Hud {
  constructor(root, { onRoll, onPowerup, onToggleView, onQuit, physicsView }) {
    this.root = root; this.cb = { onRoll, onPowerup, onToggleView, onQuit };
    this.top = h('div.glass.pill.hud.top'); this.left = h('div.glass.hud.left'); this.right = h('div.glass.hud.right');
    this.bl = h('div.glass.hud.bl'); this.toasts = h('div.toasts'); this.centerBox = null;
    this.viewSwitch = h('div.switch' + (physicsView ? '.on' : ''));
    this.br = h('div.glass.hud.br', h('div', h('div', { style: { fontWeight: 700 } }, 'Physics view'), h('div.sub', { style: { fontSize: '12px' } }, 'Forces & field lines')), this.viewSwitch);
    this.br.onclick = () => { this.viewSwitch.classList.toggle('on'); onToggleView(this.viewSwitch.classList.contains('on')); };
    this.quit = h('button.glass.pill', { style: { position: 'absolute', left: '14px', top: '14px', padding: '8px 14px', fontWeight: 700, fontSize: '13px' }, onclick: onQuit }, ICON.back + ' Quit');
    root.append(this.top, this.left, this.right, this.bl, this.br, this.toasts, this.quit);
    this.badges = new Map(); this.lastSig = '';
  }
  update(snap, localIds, inputId) {
    // top: players
    const sig = snap.players.map(p => `${p.id}:${p.score}:${p.lap}:${p.id === snap.currentId}`).join('|');
    if (sig !== this.lastSig) {
      this.lastSig = sig; clear(this.top);
      snap.players.forEach((p, i) => {
        if (i) this.top.append(h('span.sub', { style: { fontSize: '12px', fontWeight: 800 } }, 'VS'));
        this.top.append(h('div.pbadge' + (p.id === snap.currentId || snap.mode === 'duel' ? '.on' : ''), h('div.avatar', { style: { background: p.color, width: '32px', height: '32px', fontSize: '14px' } }, p.name[0].toUpperCase()),
          h('div', h('div.nm', p.name + (p.finished ? ' 🏁' : '')), h('div.sc', String(p.score)), h('div.lp', `Lap ${Math.min(p.lap + 1, snap.laps)}/${snap.laps}${p.streak >= 3 ? ` · 🔥×${p.streak >= 5 ? 2 : 1.5}` : ''}`))));
      });
    }
    // left: telemetry for the player being controlled
    const P = snap.players.find(p => p.id === inputId) || snap.players[0];
    const c = P.car;
    this.left.replaceChildren(h('div.sub', { style: { fontSize: '11px', fontWeight: 700, letterSpacing: '.08em' } }, 'LIVE PHYSICS'),
      h('div', { style: { fontSize: '14px', marginTop: '4px', lineHeight: 1.6 } },
        h('div', `Pull: `, h('b', { style: { color: '#7DFF9E' } }, c.pullN.toFixed(2) + ' N'), c.blocked ? h('span.sub', ' (screened)') : ''),
        h('div', `Friction: `, h('b', { style: { color: '#FFC46B' } }, c.frictionN.toFixed(2) + ' N'), h('span.sub', c.surface === 'sand' ? ' sandpaper μ=0.6' : ' smooth μ=0.2')),
        h('div', `Speed: `, h('b', (c.speed * 100).toFixed(0) + ' cm/s')),
        h('div', `Gap: `, h('b', c.dist < 1 ? (c.dist * 100).toFixed(1) + ' cm' : '—'))));
    // right: timer / dice
    const t = snap.turn;
    if (snap.mode === 'turns') {
      const left = t ? Math.max(0, t.timeLeft) : 0, frac = t ? left / t.timeTotal : 0, R = 30, C = 2 * Math.PI * R;
      const color = frac > .5 ? '#34C759' : frac > .25 ? '#FF9F0A' : '#FF3B30';
      this.right.replaceChildren(
        h('div.ring', h('svg', { viewBox: '0 0 72 72', html: `<circle cx="36" cy="36" r="${R}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="7"/><circle cx="36" cy="36" r="${R}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}"/>` }), h('div.v', t ? Math.ceil(left) + 's' : '—')),
        h('div', h('div.sub', { style: { fontSize: '11px', fontWeight: 700, letterSpacing: '.08em' } }, t ? (t.started ? 'TIME LEFT' : 'TOUCH TO START') : 'ROLL TO START'),
          h('div.dice', { style: { marginTop: '6px' } }, h('div.die', t ? t.a : '?'), h('div.die', t ? t.b : '?')),
          h('div.sub', { style: { fontSize: '12px', marginTop: '4px' } }, t ? `${t.a}+${t.b} = ${t.a + t.b} × 3${t.timeTotal > (t.a + t.b) * 3 ? ' +' : ''} s` : '')));
    } else this.right.replaceChildren(h('div', h('div.sub', { style: { fontSize: '11px', fontWeight: 700, letterSpacing: '.08em' } }, 'DUEL'), h('div', { style: { fontWeight: 800, fontSize: '20px' } }, `${snap.laps} laps`)));
    // bottom-left: power-ups of the controlled player
    const pus = P.powerups, psig = P.id + ':' + pus.join(',') + ':' + snap.phase;
    if (psig !== this.lastPsig) {
      this.lastPsig = psig; clear(this.bl);
      if (!pus.length) this.bl.append(h('div.sub', { style: { padding: '8px 12px', fontSize: '13px' } }, 'No power-ups yet — answer medium & hard cards to earn them'));
      pus.forEach((k, i) => { const d = POWERUPS[k]; this.bl.append(h('button.pu', { title: d.desc, onclick: () => this.cb.onPowerup(k) }, h('div.ic', ICON[d.icon]), d.name)); });
    }
  }
  toast(text, ms = 2200) { const el = h('div.glass.pill.toast', text); this.toasts.append(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms); }
  center(content) { this.clearCenter(); this.centerBox = h('div.glass.center', content); this.root.append(this.centerBox); }
  clearCenter() { this.centerBox?.remove(); this.centerBox = null; }
  rollPrompt(P, handover) {
    this.center([h('div.sub', handover ? 'Pass the device to' : 'Your turn'), h('h2.disp', { style: { color: P.color } }, P.name),
      h('button.btn.green', { style: { marginTop: '14px', width: 'auto', padding: '14px 26px' }, onclick: () => this.cb.onRoll() }, h('div.ic', ICON.dice), h('div', h('div.t1', 'Roll the dice'), h('div.t2', 'total × 3 seconds to race')))]);
  }
  destroy() { [this.top, this.left, this.right, this.bl, this.br, this.toasts, this.quit, this.centerBox].forEach(e => e?.remove()); }
}

export function questionSheet(view, { onAnswer }) {
  const d = view.difficulty;
  const head = h('div.row', h('span.chip.' + d, `${d[0].toUpperCase() + d.slice(1)} · ${DIFF_PTS[d]} pt${DIFF_PTS[d] > 1 ? 's' : ''}`), h('span.chip', view.topic));
  const body = h('div');
  let answered = false;
  const sheet = h('div.glass.sheet', head, h('div.q', view.text), body);
  const dim = h('div.dim', sheet);
  const finish = (value) => { if (answered) return; answered = true; onAnswer(value); };
  if (view.type === 'mcq') {
    const opts = view.options.map((o, i) => h('button.opt', { onclick: () => finish(i) }, h('b', 'ABCD'[i]), o));
    body.append(h('div.opts', opts));
    dim.showResult = (ev) => { opts.forEach((b, i) => { b.disabled = true; if (i === ev.correctIndex) b.classList.add('ok'); else if (i === ev.value) b.classList.add('bad'); }); };
  } else {
    const input = h('input.field', { type: 'text', inputMode: 'decimal', placeholder: `Your answer in ${view.unit}`, onkeydown: e => { if (e.key === 'Enter') finish(input.value); } });
    const btn = h('button.btn.blue.sm', { onclick: () => finish(input.value) }, h('span.t1', 'Check'));
    body.append(h('div.row', input, btn)); setTimeout(() => input.focus(), 50);
    dim.showResult = (ev) => { input.disabled = true; btn.disabled = true; input.classList.add(ev.correct ? 'ok' : 'bad'); };
  }
  dim.explain = (ev) => {
    const chips = ev.correct ? [h('span.chip', `Correct +${ev.base}`), ev.mult > 1 ? h('span.chip', `Streak ×${ev.mult}`) : null, ev.speed ? h('span.chip', 'Speed bonus +1') : null, h('span.chip', { style: { background: '#34C759' } }, `Total +${ev.points}`), ev.powerup ? h('span.chip', { style: { background: '#5E5CE6' } }, `🎁 ${POWERUPS[ev.powerup].name}`) : null]
      : [h('span.chip', { style: { background: '#FF3B30' } }, 'Wrong · turn over'), ev.skipNext ? h('span.chip', 'Hard card: skip next turn') : null];
    body.append(h('div.chips', chips), h('div.explain', h('b', ev.correct ? '✓ ' : `Answer: ${ev.correctAnswer}. `), ev.why));
  };
  return dim;
}

export function resultsSheet(snap, ranking, { onAgain, onHome }) {
  const byId = new Map(snap.players.map(p => [p.id, p]));
  return h('div.dim', h('div.glass.sheet', { style: { textAlign: 'center' } }, h('div', { style: { fontSize: '48px' } }, ICON.trophy), h('h2.disp', `${byId.get(ranking[0].id).name} wins!`), h('div.sub', 'Most points wins — laps break ties'),
    h('div.rank', ranking.map((r, i) => { const p = byId.get(r.id); return h('div.rrow', h('span.pos', String(i + 1)), h('div.avatar', { style: { background: p.color } }, p.name[0].toUpperCase()), h('span', { style: { fontWeight: 700 } }, p.name), h('span.sub', `${r.lap} lap${r.lap === 1 ? '' : 's'}`), h('span.pts', `${r.score} pts`)); })),
    h('div.row', { style: { justifyContent: 'center', marginTop: '18px' } }, onAgain ? h('button.btn.green.sm', { onclick: onAgain }, h('span.t1', 'Play again')) : null, h('button.btn.sm', { onclick: onHome }, h('span.t1', 'Home')))));
}
