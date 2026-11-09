import { config } from './config.js';
import { Track } from './track/track.js';
import { classic } from './track/tracks/classic.js';
import { World } from './physics/engine.js';
import { Match } from './game/match.js';
import { autoMagnet } from './game/autodrive.js';
import { profile, setName, todaysChallenge, statsFromLog, recordGame } from './game/profile.js';
import { Renderer } from './render/canvas.js';
import { makeTransport, isOnline } from './net/transport.js';
import { Room, PLAYER_COLORS } from './net/room.js';
import { Matchmaker } from './net/matchmaking.js';
import { NetSession } from './net/session.js';
import { randomSeed } from './util/rng.js';
import { h, clear } from './ui/dom.js';
import { icon } from './ui/art.js';
import { sound, haptic } from './ui/sound.js';
import { homeScreen, tabBar, passSetupSheet, nameSheet, confirmSheet, rulesSheet, lobbySheet, searchingSheet, questionSheet, resultsSheet, Hud } from './ui/screens.js';
import { pitStopSheet } from './ui/pitstop.js';
import { labScreen } from './ui/lab.js';

const canvas = document.getElementById('game'), ui = document.getElementById('ui');
const track = new Track(classic);
const renderer = new Renderer(canvas, track);
const online = isOnline(config);
const LAPS = Math.max(1, Math.min(5, +new URLSearchParams(location.search).get('laps') || 3)); // ?laps=1 for quick demos
const clientId = (() => { let id = null; try { id = sessionStorage.getItem('mr.id'); } catch {} if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('mr.id', id); } catch {} } return id; })();

const app = {
  state: 'menu', match: null, session: null, hud: null, q: null, pit: null, raf: 0, last: 0,
  inputIds: new Set(), local: true, physicsView: true, magnet: { x: 0, y: 0, active: false },
  lastNames: [], tab: 'play',
};
addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ menu background: two cars racing on their own
const demo = (() => {
  const world = new World(track);
  const cars = [
    { id: 'd1', name: '', color: '#FF3B30', lead: 0.038 },
    { id: 'd2', name: '', color: '#0A84FF', lead: 0.035 },
  ];
  cars.forEach((c, i) => { const pose = track.checkpointPose(i * 2); world.addCar(c.id, pose); });
  return {
    step(dt) {
      for (const c of cars) {
        const car = world.cars.get(c.id);
        if (car.off || car.stuck) world.respawn(car, track.checkpointPose(Math.floor(track.wrap(car.s) / track.length * 4)));
        world.setMagnet(c.id, autoMagnet(track, car, { lead: c.lead }));
      }
      world.update(dt);
    },
    snap() { return { mode: 'duel', currentId: null, players: cars.map(c => ({ ...c, car: world.cars.get(c.id), magnet: null })) }; },
  };
})();
function menuLoop(now) {
  if (app.state === 'race') return;
  const dt = Math.min(0.05, (now - app.last) / 1000); app.last = now;
  if (!document.hidden) { try { demo.step(dt); renderer.draw(demo.snap(), { ids: [] }); } catch (e) { console.warn(e); } }
  app.raf = requestAnimationFrame(menuLoop);
}

// ------------------------------------------------------------------ toasts outside the race
function menuToast(text, ms = 2600) {
  let box = ui.querySelector('.menu-toasts'); if (!box) { box = h('div.menu-toasts'); ui.append(box); }
  const el = h('div.glass.pill.toast', text); box.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms);
}

// ------------------------------------------------------------------ home + tabs
function home() {
  stopGame();
  app.state = 'menu'; document.body.classList.add('menu'); document.body.classList.remove('racing', 'sheet-open');
  clear(ui);
  app.content = h('div.content'); ui.append(app.content);
  const bar = tabBar(tab => showTab(tab)); ui.append(bar); app.bar = bar;
  showTab('play');
  cancelAnimationFrame(app.raf); app.last = performance.now(); app.raf = requestAnimationFrame(menuLoop);
}
function showTab(tab) {
  if (tab === 'rules') { rulesSheet({ onClose: () => app.bar.lens.select(app.tab) }); return; }
  app.tab = tab; clear(app.content);
  if (tab === 'lab') { app.content.append(labScreen()); return; }
  const prof = profile();
  app.content.append(homeScreen({
    online, prof, challenge: todaysChallenge(),
    onSolo: () => startLocal([{ id: 'p1', name: prof.name || 'You', color: PLAYER_COLORS[0] }]),
    onPass: () => passSetupSheet({ names: app.lastNames, onStart: players => { app.lastNames = players.map(p => p.name); startLocal(players); } }),
    onCreateRoom: () => withName(n => openRoom({ name: n, isHost: true })),
    onJoin: code => withName(n => openRoom({ name: n, code })),
    onDuel: () => withName(findDuel),
    onEditName: () => nameSheet({ title: 'Your name', sub: 'Shown on your car and to other players.', cta: 'Save', name: prof.name, onGo: n => { setName(n); showTab('play'); } }),
  }));
}
function withName(go) {
  const n = profile().name;
  if (n) return go(n);
  nameSheet({ title: 'What should we call you?', sub: 'Other players will see this name on your car.', cta: 'Continue', onGo: name => { setName(name); go(name); } });
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
  let room = null, lobby = null;
  try {
    const transport = await makeTransport(config, clientId);
    room = await new Room(transport, { name, code, isHost }).open();
    await new Promise(r => setTimeout(r, 300));
    if (room.full) { room.leave(); menuToast('That room is full (4 players).'); return; }
    lobby = lobbySheet(room, {
      onStart: () => room.start(),
      onLeave: () => { room.leave(); },
      onReady: r => room.setReady(r),
      onCopy: () => { const url = location.href.split('#')[0] + '#' + room.code; (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => menuToast('Link copied — send it to your friends'), () => menuToast('Room code: ' + room.code)); },
    });
    room.onChange(() => {
      if (room.started) { lobby.close(true); room.leave(); startNet(transport, room.code, room.started); }
      else lobby.rerender();
    });
  } catch (e) { console.error(e); lobby?.close(true); room?.leave(); menuToast('Could not connect to the game server.'); }
}
async function findDuel(name) {
  let cancelled = false, mm = null;
  const search = searchingSheet({ me: name, onCancel: () => { cancelled = true; mm?.cancel(); } });
  try {
    const transport = await makeTransport(config, clientId);
    mm = new Matchmaker(transport, { name, rank: profile().best });
    const m = await mm.find({ timeout: 90000, onStatus: n => search.status(n) });
    if (cancelled) return;
    const other = m.players.find(p => p.id !== clientId);
    search.found(other?.name || 'Opponent'); sound.correct();
    setTimeout(() => { search.close(true); startNet(transport, m.code, m); }, 1600);
  } catch (e) {
    if (cancelled) return;
    search.close(true);
    menuToast(e.message === 'timeout' ? 'Nobody else is searching right now. Try again soon!' : 'Could not connect to the game server.', 3600);
  }
}
async function startNet(transport, code, start) {
  stopGame();
  app.session = new NetSession(transport, { code, start, track });
  app.match = await app.session.open();
  app.inputIds = new Set([clientId]); app.local = false;
  beginRace();
}

// ------------------------------------------------------------------ race
function beginRace() {
  app.state = 'race'; document.body.classList.remove('menu', 'sheet-open'); document.body.classList.add('racing');
  clear(ui);
  app.hud = new Hud(ui, {
    physicsView: app.physicsView, soundOn: !sound.muted,
    onRoll: () => { sound.click(); app.hud.clearCenter(); (app.session || app.match).roll(); },
    onPowerup: k => {
      const id = inputPlayerId();
      if (id && app.match.usePowerup(id, k)) { sound.pop(); return; }
      menuToastRace(k === 'steal' ? 'Nobody has points to steal yet' : k === 'dice' ? 'Use Double Dice before you roll' : 'You can use that on your turn');
    },
    onToggleView: v => { app.physicsView = v; renderer.physicsView = v; },
    onToggleSound: () => sound.toggle(),
    onQuit: () => confirmSheet({ title: 'Leave the race?', text: app.local ? 'This race will end and the scores will be lost.' : 'You will leave the online game. The others can keep racing.', yes: 'Leave', no: 'Keep racing', onYes: home }),
  });
  renderer.physicsView = app.physicsView; app.placedW = 0;
  ui.append(h('div.glass.pill.rotate-hint', { html: icon('rotate', 20) + '<span>Turn your phone sideways for a bigger track</span>' }));
  promptIfNeeded();
  cancelAnimationFrame(app.raf); app.last = performance.now(); app.raf = requestAnimationFrame(frame);
}
const menuToastRace = (t) => app.hud?.toast(t);
function stopGame() {
  cancelAnimationFrame(app.raf);
  app.session?.close(); app.session = null; app.match = null;
  app.hud?.destroy(); app.hud = null;
  app.q?.close(true); app.q = null; app.pit?.close(true); app.pit = null;
  app.magnet.active = false; sound.hum(0);
  ui.querySelectorAll('.dim').forEach(d => d.remove());
}
function inputPlayerId() {
  const m = app.match; if (!m) return null;
  if (m.mode === 'duel') return m.player(clientId) ? clientId : null;
  return m.current && app.inputIds.has(m.current.id) ? m.current.id : null;
}
function frame(now) {
  const m = app.match; if (!m || app.state !== 'race') return;
  app.raf = requestAnimationFrame(frame); // schedule first so an error can never stop the game
  const dt = Math.min(0.05, (now - app.last) / 1000); app.last = now;
  const id = inputPlayerId();
  const blocked = !!(app.q || app.pit || ui.querySelector('.dim:not(.out)'));
  if (blocked && app.magnet.active) app.magnet = { ...app.magnet, active: false };
  if (id) (app.session ? app.session.setMagnet(app.magnet) : m.setMagnet(id, app.magnet));
  const events = app.session ? app.session.update(dt) : m.update(dt);
  for (const ev of events) handleEvent(ev);
  if (!app.match) return; // the game ended inside an event handler
  const snap = m.snapshot();
  try { renderer.draw(snap, { ids: [...app.inputIds] }); } catch (e) { console.warn(e); renderer.resize(); }
  const shownId = id || snap.currentId || [...app.inputIds][0] || snap.players[0].id;
  app.hud.update(snap, shownId, track);
  if (renderer.w !== app.placedW || renderer.h !== app.placedH) { app.placedW = renderer.w; app.placedH = renderer.h; app.hud.place(renderer); }
  const car = id ? m.car(id) : null;
  sound.hum(app.magnet.active && car ? Math.min(1, car.pullN / 0.6) : 0);
}
function promptIfNeeded() {
  const m = app.match; if (!m || m.mode !== 'turns' || m.phase !== 'roll') return;
  const P = m.current;
  if (app.inputIds.has(P.id)) app.hud.rollPrompt(P, app.local && m.order.length > 1);
  else app.hud.waiting(P);
}
function handleEvent(ev) {
  const m = app.match, hud = app.hud, P = ev.playerId ? m.player(ev.playerId) : null, mine = !!P && app.inputIds.has(P.id);
  switch (ev.type) {
    case 'dice': sound.dice(); hud.showDice(ev, P, mine); break;
    case 'checkpoint': if (ev.index && mine) { sound.checkpoint(); hud.toast(`Flag ${ev.index + 1} — checkpoint saved`, 1400); } break;
    case 'lap': (ev.finished ? sound.fanfare : sound.lap)(); haptic(ev.finished ? [30, 40, 30, 40, 60] : 30);
      hud.toast(ev.finished ? `${P.name} finished the race!${ev.bonus ? ` +${ev.bonus} lap bonus` : ''}` : `${P.name}: lap ${ev.lap} complete`, 2800); break;
    case 'pitstop':
      if (mine) {
        app.magnet.active = false;
        app.pit = pitStopSheet({ onDone: n => { app.pit = null; (app.session || app.match)?.pitDone(n); } });
        if (window.__autoplay) setTimeout(() => app.pit?.autoplay(), 600);
      } else hud.toast(`${P.name} is at the Charge Pit Stop…`, 2600);
      break;
    case 'fuel': sound.fuel(); hud.toast(ev.add ? `+${ev.add} s fuel for ${P.name}` : `${P.name} got no fuel`, 2200); break;
    case 'fell': sound.fall(); haptic([60, 40, 60]); hud.toast(`${P.name} fell off the track — back to the last flag`, 2600); break;
    case 'stuck': sound.stick(); haptic(80); hud.toast(`${P.name}'s car jumped onto the magnet!`, 2600); break;
    case 'skipped': hud.toast(`${P.name} misses this turn (wrong hard card)`, 2800); break;
    case 'left': hud.toast(`${P.name} left the game`, 3000); break;
    case 'powerup': hud.toast(ev.kind === 'steal' ? `${P.name} stole 1 point from ${m.player(ev.fromId).name}!` : ev.kind === 'fuel' ? `${P.name} used Extra Fuel: +5 s` : ev.kind === 'skip' ? 'Sandpaper feels smooth for the rest of this turn' : 'Next roll counts double!', 2400); break;
    case 'question':
      if (mine) {
        app.magnet.active = false; sound.pop();
        app.q?.close(true);
        const q = app.q = questionSheet(ev.view, { streak: P.streak, onAnswer: v => (app.session || app.match).answer(v) });
        q.drawId = ev.view.drawId;
      } else hud.toast(`${P.name} is answering a ${ev.view.difficulty} card…`, 2600);
      break;
    case 'answer':
      if (mine && app.q) {
        const q = app.q; q.result(ev); q.explain(ev);
        (ev.correct ? sound.correct : sound.wrong)(); haptic(ev.correct ? 25 : [70, 50, 70]);
        setTimeout(() => { q.close(true); if (app.q === q) app.q = null; }, ev.correct ? 2700 : 3900);
      } else hud.toast(`${P.name} ${ev.correct ? `got it right: +${ev.points}` : 'got it wrong'}`, 2600);
      break;
    case 'turnEnd': {
      const why = { time: "Time's up", fell: 'Fell off the track', stuck: 'Car stuck to the magnet', wrong: 'Wrong answer', wrongHard: 'Wrong hard card', finished: 'Race finished', left: 'Player left' }[ev.reason] || 'Turn over';
      app.magnet.active = false;
      if (ev.next) { const N = m.player(ev.next); hud.toast(`${why} — ${N.name}'s turn`, 2400); setTimeout(promptIfNeeded, app.q ? 3900 : 500); }
      break; }
    case 'over': setTimeout(() => showResults(ev.ranking), 1100); break;
  }
}
function showResults(ranking) {
  const m = app.match; if (!m) return;
  const snap = m.snapshot();
  const finished = new Set(snap.players.filter(p => p.finished && !p.left).map(p => p.id));
  const stats = Object.fromEntries(snap.players.map(p => [p.id, statsFromLog(m.log, p.id, finished)]));
  const rec = recordGame({ log: m.log, localIds: [...app.inputIds], ranking, finished });
  const solo = ranking.length === 1, iWon = !solo && app.inputIds.has(ranking[0].id) && app.inputIds.size === 1;
  if (solo || iWon || app.local) sound.fanfare();
  app.q?.close(true); app.q = null;
  resultsSheet(snap, ranking, stats, {
    challengeDone: rec.challengeDone ? rec.challenge : null,
    onAgain: app.local ? () => startLocal(m.order.map(id => ({ id, name: m.player(id).name, color: m.player(id).color }))) : null,
    onHome: home,
  });
}

// ------------------------------------------------------------------ pointer = magnet
function setMag(e, active) { const w = renderer.toWorld(e.clientX, e.clientY); app.magnet = { x: w.x, y: w.y, active }; }
canvas.addEventListener('pointerdown', e => {
  if (app.state !== 'race' || app.q || app.pit || ui.querySelector('.dim:not(.out)')) return;
  canvas.setPointerCapture(e.pointerId); setMag(e, true);
});
canvas.addEventListener('pointermove', e => { if (app.state === 'race' && app.magnet.active) setMag(e, true); });
const lift = e => { if (app.state === 'race') setMag(e, false); };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('lostpointercapture', () => { app.magnet = { ...app.magnet, active: false }; });
addEventListener('keydown', e => { if (e.key === 'Escape' && app.state === 'race' && !ui.querySelector('.dim:not(.out)')) app.hud?.cb.onQuit(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { app.magnet.active = false; sound.hum(0); } app.last = performance.now(); });

// ------------------------------------------------------------------ boot
home();
const deep = location.hash.match(/^#(MAG-\d{4})$/);
if (deep && online) withName(n => openRoom({ name: n, code: deep[1] }));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// test hooks
window.__mr = { app, track, renderer, get match() { return app.match; } };
