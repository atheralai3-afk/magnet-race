import { config } from './config.js';
import { Track } from './track/track.js';
import { classic } from './track/tracks/classic.js';
import { Match } from './game/match.js';
import { Renderer } from './render/canvas.js';
import { makeTransport, isOnline } from './net/transport.js';
import { Room, PLAYER_COLORS } from './net/room.js';
import { Matchmaker } from './net/matchmaking.js';
import { NetSession } from './net/session.js';
import { randomSeed } from './util/rng.js';
import { clear } from './ui/dom.js';
import { homeScreen, passSetupScreen, nameScreen, lobbyScreen, searchingScreen, Hud, questionSheet, resultsSheet } from './ui/screens.js';

const canvas = document.getElementById('game'), ui = document.getElementById('ui');
const track = new Track(classic);
const renderer = new Renderer(canvas, track);
const clientId = (() => { let id = sessionStorage.getItem('mr.id'); if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('mr.id', id); } return id; })();
const online = isOnline(config);
const LAPS = Math.max(1, Math.min(5, +new URLSearchParams(location.search).get('laps') || 3)); // ?laps=1 for quick demos

const app = {
  match: null, session: null, hud: null, sheet: null, screen: null, raf: 0, last: 0, inputIds: new Set(), physicsView: true,
  magnet: { x: 0, y: 0, active: false },
};
addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ screens
function show(el) { clear(ui); app.screen = el; if (el) ui.append(el); }
function home() {
  stopGame();
  show(homeScreen({ online,
    onSolo: () => startLocal([{ id: 'p1', name: localStorage.getItem('mr.name') || 'You', color: PLAYER_COLORS[0] }]),
    onPass: () => show(passSetupScreen({ onStart: startLocal, onBack: home })),
    onCreateRoom: () => show(nameScreen({ title: 'Create Private Room', sub: 'You will get a code to share with friends.', cta: 'Create room', onGo: n => openRoom({ name: n, isHost: true }), onBack: home })),
    onJoinRoom: code => show(nameScreen({ title: 'Join ' + code, sub: 'Enter your name to join the room.', cta: 'Join room', onGo: n => openRoom({ name: n, code }), onBack: home })),
    onDuel: () => show(nameScreen({ title: 'Public Duel', sub: 'A 1v1 race against a random player. Most points wins.', cta: 'Find a match', onGo: findDuel, onBack: home })),
  }));
  renderIdle();
}
function renderIdle() {
  const demo = new Match({ players: [{ id: 'demo', name: '', color: '#FF3B30' }], track, seed: 1 });
  renderer.physicsView = false; renderer.draw(demo.snapshot(), { ids: [] }); renderer.physicsView = app.physicsView;
}

// ------------------------------------------------------------------ local games
function startLocal(players) {
  stopGame();
  app.match = new Match({ mode: 'turns', players, track, laps: LAPS, seed: randomSeed() });
  app.inputIds = new Set(players.map(p => p.id)); app.local = true;
  app.match.start();
  beginRace();
}

// ------------------------------------------------------------------ online games
async function openRoom({ name, code, isHost }) {
  try {
    const transport = await makeTransport(config, clientId);
    const room = await new Room(transport, { name, code, isHost }).open();
    const screen = lobbyScreen(room, { onStart: () => room.start(), onLeave: () => { room.leave(); home(); }, onReady: r => room.setReady(r) });
    show(screen);
    room.onChange(() => { if (room.started) { room.leave(); startNet(transport, room.code, room.started); } else screen.rerender(); });
  } catch (e) { console.error(e); alert('Could not connect: ' + e.message); home(); }
}
async function findDuel(name) {
  try {
    const transport = await makeTransport(config, clientId);
    const mm = new Matchmaker(transport, { name });
    const screen = searchingScreen({ onCancel: () => { mm.cancel(); home(); } }); show(screen);
    const m = await mm.find({ onStatus: n => screen.setStatus(n) });
    startNet(transport, m.code, m);
  } catch (e) { console.error(e); alert(e.message === 'timeout' ? 'Nobody joined within a minute. Try again later.' : 'Could not connect: ' + e.message); home(); }
}
async function startNet(transport, code, start) {
  stopGame();
  app.session = new NetSession(transport, { code, start, track });
  app.match = await app.session.open();
  app.inputIds = new Set([clientId]); app.local = false;
  beginRace();
}

// ------------------------------------------------------------------ race loop
function beginRace() {
  show(null);
  app.hud = new Hud(ui, { physicsView: app.physicsView,
    onRoll: () => { app.hud.clearCenter(); (app.session || app.match).roll(); },
    onPowerup: k => { const id = inputPlayerId(); if (id && app.match.usePowerup(id, k)) app.hud.toast(`${k === 'fuel' ? '+5 s fuel' : k === 'skip' ? 'Sandpaper feels smooth this turn' : k === 'dice' ? 'Next roll counts double' : 'Stole 1 point!'}`); },
    onToggleView: v => { app.physicsView = v; renderer.physicsView = v; },
    onQuit: () => home(),
  });
  promptIfNeeded();
  app.last = performance.now();
  cancelAnimationFrame(app.raf); app.raf = requestAnimationFrame(frame);
}
function stopGame() { cancelAnimationFrame(app.raf); app.session?.close(); app.session = null; app.match = null; app.hud?.destroy(); app.hud = null; app.sheet?.remove(); app.sheet = null; app.magnet.active = false; }
function inputPlayerId() {
  const m = app.match; if (!m) return null;
  if (m.mode === 'duel') return clientId;
  return m.current && app.inputIds.has(m.current.id) ? m.current.id : null;
}
function frame(now) {
  const m = app.match; if (!m) return;
  const dt = Math.min(0.05, (now - app.last) / 1000); app.last = now;
  const id = inputPlayerId();
  if (id) (app.session ? app.session.setMagnet(app.magnet) : m.setMagnet(id, app.magnet));
  const events = app.session ? app.session.update(dt) : m.update(dt);
  for (const ev of events) handleEvent(ev);
  const snap = m.snapshot();
  renderer.draw(snap, { ids: [...app.inputIds] });
  app.hud.update(snap, app.inputIds, id || snap.currentId || snap.players[0].id);
  app.raf = requestAnimationFrame(frame);
}
function promptIfNeeded() {
  const m = app.match; if (!m || m.mode !== 'turns') return;
  if (m.phase === 'roll') {
    const P = m.current;
    if (app.inputIds.has(P.id)) app.hud.rollPrompt(P, app.local && m.order.length > 1);
    else app.hud.center([document.createTextNode(''), Object.assign(document.createElement('div'), { className: 'sub', textContent: 'Waiting for' }), Object.assign(document.createElement('h2'), { className: 'disp', textContent: P.name, style: `color:${P.color}` })]);
  }
}
const names = () => Object.fromEntries(app.match.order.map(id => [id, app.match.player(id)]));
function handleEvent(ev) {
  const m = app.match, hud = app.hud, P = ev.playerId ? m.player(ev.playerId) : null, mine = P && app.inputIds.has(P.id);
  switch (ev.type) {
    case 'dice': hud.clearCenter(); hud.toast(`${P.name} rolled ${ev.a} + ${ev.b} → ${ev.seconds} s${ev.doubled ? ' (double dice!)' : ''}`); if (mine) hud.toast('Press on the track to put the magnet down', 3000); break;
    case 'checkpoint': if (ev.index) hud.toast(`🚩 Flag ${ev.index + 1}`, 1200); break;
    case 'lap': hud.toast(ev.finished ? `🏁 ${P.name} finished!${ev.bonus ? ` +${ev.bonus} lap bonus` : ''}` : `${P.name}: lap ${ev.lap} done`, 2600); break;
    case 'fuel': hud.toast(`⛽ +${ev.add} s fuel`); break;
    case 'fell': hud.toast(`${P.name} fell off the track! Back to the last flag`, 2600); break;
    case 'stuck': hud.toast(`🧲 ${P.name}'s car stuck to the magnet!`, 2600); break;
    case 'skipped': hud.toast(`${P.name} skips a turn (wrong hard card)`, 2600); break;
    case 'left': hud.toast(`${P.name} left the game`, 3000); break;
    case 'powerup': if (ev.kind === 'steal') hud.toast(`${P.name} stole 1 point from ${m.player(ev.fromId).name}!`); break;
    case 'question':
      if (mine) { app.magnet.active = false; app.sheet?.remove(); app.sheet = questionSheet(ev.view, { onAnswer: v => (app.session ? app.session.answer(v) : m.answer(v)) }); ui.append(app.sheet); }
      else hud.toast(`${P.name} is answering a ${ev.view.difficulty} card…`, 2500);
      break;
    case 'answer':
      if (mine && app.sheet) { const s = app.sheet; s.showResult(ev); s.explain(ev); setTimeout(() => { s.remove(); if (app.sheet === s) app.sheet = null; }, ev.correct ? 2600 : 3600); }
      else hud.toast(`${P.name} ${ev.correct ? `answered right +${ev.points}` : 'got it wrong'}`, 2500);
      break;
    case 'turnEnd': {
      const why = { time: "Time's up", fell: 'Fell off', stuck: 'Stuck to the magnet', wrong: 'Wrong answer', wrongHard: 'Wrong hard card', finished: 'Finished the race', left: 'Left' }[ev.reason] || ev.reason;
      if (ev.next) { const N = m.player(ev.next); hud.toast(`${why} — ${N.name}'s turn`, 2400); setTimeout(promptIfNeeded, 300); }
      app.magnet.active = false; break; }
    case 'over': setTimeout(() => { app.sheet?.remove(); app.sheet = resultsSheet(m.snapshot(), ev.ranking, { onAgain: app.local ? () => startLocal(m.order.map(id => ({ id, name: m.player(id).name, color: m.player(id).color }))) : null, onHome: home }); ui.append(app.sheet); }, 900); break;
  }
}

// ------------------------------------------------------------------ pointer = magnet
function setMag(e, active) { const w = renderer.toWorld(e.clientX, e.clientY); app.magnet = { x: w.x, y: w.y, active }; }
canvas.addEventListener('pointerdown', e => { if (!app.match || app.sheet) return; canvas.setPointerCapture(e.pointerId); setMag(e, true); });
canvas.addEventListener('pointermove', e => { if (!app.match) return; setMag(e, app.magnet.active && (e.buttons & 1) === 1 || (e.pointerType === 'touch' && app.magnet.active)); });
const lift = e => { if (!app.match) return; setMag(e, false); };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift); canvas.addEventListener('lostpointercapture', () => { app.magnet.active = false; });

// deep link #MAG-1234
if (/^#MAG-\d{4}$/.test(location.hash) && online) show(nameScreen({ title: 'Join ' + location.hash.slice(1), sub: 'Enter your name to join the room.', cta: 'Join room', onGo: n => openRoom({ name: n, code: location.hash.slice(1) }), onBack: home }));
else home();

// expose for tests
window.__mr = { app, track, renderer, Match, get match() { return app.match; } };
