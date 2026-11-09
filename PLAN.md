# Magnet Race — online game build plan

Read this first. It hands the build over between models.
Phase 1 (hard core) is built on **Fable**. Phase 2 (UI/polish/deploy) is built on **Opus**.

## What the game is
A physics racing game for a Cambridge IGCSE/AS school project (presentation **12 Jan**).
Players move a steel car around a track **without touching it**, by pulling it with a magnet
(the pointer/finger). Attraction only, never repulsion. Answering physics questions scores points.
The **winner is the player with the most points**; finishing 3 laps first earns a lap bonus.

## Hard constraints of this workspace
- **No npm/pip installs** (network off for the shell). Build with **vanilla JS ES modules, no build step,
  no dependencies**. It must run by opening `index.html` and on GitHub Pages as-is.
- Libraries only via CDN at runtime in the browser (e.g. `https://esm.sh/@supabase/supabase-js@2`).
- Test locally with headless Chrome + Playwright at `/opt/npm-tools/node_modules/playwright`
  (`executablePath: '/usr/bin/google-chrome'`). ffmpeg exists for recording demo videos.
- GitHub: the user must attach/name a repo (use the add_repo tool). Hosting = GitHub Pages.
- Online play needs a free realtime service: **Supabase** (Realtime broadcast + presence). The user
  creates the project and gives `SUPABASE_URL` + public anon key → `src/config.js`.
  The game must still fully work offline (solo + pass-and-play) when no config is set.

## Folder layout (target)
```
index.html            app shell, loads src/main.js as module
src/
  main.js             boot, router between screens
  config.js           Supabase URL/key (empty = offline only)
  physics/            engine.js (fixed-step sim), magnet.js, friction.js, screening.js
  track/              track.js (spline, sampling, on-track test), tracks/classic.js
  game/               state.js (state machine), scoring.js, turns.js, powerups.js
  questions/          bank.js (from design/questions_source.json + answer keys), engine.js
  net/                room.js (private rooms), matchmaking.js (public duel), sync.js
  render/             canvas.js (track, cars, field lines, force arrows), effects.js
  ui/                 screens (home, room, race HUD, question sheet, results), glass.css
assets/               icons/art (reuse design/ios_art.py output as inline SVG)
```

## STATUS (9 Nov, late): PHASE 2 DONE ✅
Liquid Glass UI (home with tabs Play/Lab/Rules, lobby, duel search, race HUD, question sheet, results with confetti),
Charge Pit Stop mini-game (fuel zones, +2 s per paper piece), Physics Lab sandbox, sounds + haptics, daily challenges + local stats,
compact layouts for phones (portrait + sideways), PWA (manifest, icons, offline service worker). 43 unit checks + full browser game pass.
Left: deploy to GitHub Pages (needs the user's repo), test online play with real Supabase keys.

## PHASE 1 STATUS: DONE ✅
All 6 items below are built and tested (`node tests/unit.mjs` → 39 passed; `node tests/e2e.cjs` plays a full game).
Notes for phase 2:
- Online play is implemented but untested against a real Supabase project (no network here). Test it once the user gives keys.
- The current UI in `src/ui/` is a functional glass UI, not the final design. Phase 2 replaces/polishes it.
- Card zones are dense (5 per lap): consider tuning. `?laps=1` URL param is for quick demos.
- Medium/hard questions are now 3-option MCQ or numeric (answers in `src/questions/bank.js`).

## PHASE 1 — Fable (most necessary + hardest parts)
1. **Physics engine** (`src/physics/`) — fixed timestep 120 Hz, deterministic.
   - Car: mass 0.05 kg, weight 0.5 N (g = 10). Magnet = pointer position (hand held above board).
   - Magnetic pull on induced steel: always attractive, falls off steeply with distance
     (use F = k / (d² + d0²)^1.5-style dipole falloff, capped; tune so ~0.4 N at 3 cm, ~0.05 N at 10 cm).
   - Friction: static μs then kinetic μk; smooth track μ = 0.2 (0.10 N), sandpaper μ = 0.6 (0.30 N).
     Car only starts moving when pull > static friction — this MUST be visibly true (judges score physics accuracy).
   - Car "sticks to magnet" if distance < stick radius → ends turn (rule from the board game).
   - **Magnetic screening**: steel plates on the track reduce field behind them (segment–line-of-sight
     test between magnet and car; multiply force by ~0.15 when blocked).
   - Expose live values (pull N, friction N, resultant, velocity) for the Physics view arrows.
2. **Track system** (`src/track/`) — closed Catmull-Rom spline (points in design/track.py), lane width,
   arc-length sampling, nearest-point + signed lateral distance, **fall-off detection** (car centre leaves lane →
   respawn at last checkpoint flag with animation), lap counting via ordered checkpoints (anti-shortcut),
   zones along the path: sandpaper, steel plates, card zones (easy/medium/hard), fuel stops, 4 flags.
3. **Game state machine** (`src/game/`) — shared by all modes:
   `lobby → roll dice (sum×3 s) → turn running → [card zone → question] → turn end → next player … → results`.
   Turn ends on: time out, fall off, stick to magnet, wrong answer. Correct answer = continue.
   **Scoring**: easy 1, medium 2, hard 3; wrong hard = lose turn; streak ×1.5 at 3 right, ×2 at 5
   (multiplies base points); speed bonus +1 if answered < 5 s; first to finish 3 laps +5 lap bonus.
   Power-ups earned by difficulty: Extra Fuel (+5 s), Skip a Friction Patch, Double Dice, Steal 1 point.
4. **Question engine** (`src/questions/`) — online version needs checkable answers:
   easy = 4-option MCQ (given); medium/hard = convert to 3-option MCQ or numeric input using the
   `model_answer` in design/questions_source.json (numeric: accept ±2 %). Shuffle options, no repeats per game.
5. **Realtime multiplayer** (`src/net/`) — Supabase Realtime channels:
   - **Private room**: host creates code `MAG-1234`, up to 4 players, presence list, ready flags, host settings.
   - **Public duel**: matchmaking queue channel → pair 2 players → private duel channel.
   - Duels run **simultaneously** (both race at once); card-zone questions pop up per player;
     wrong answer = car frozen 1.5 s. Host-authoritative: host client validates scores/laps and broadcasts state;
     clients send inputs (magnet position) at 20 Hz, interpolate others.
   - Graceful disconnect handling + offline fallback.
6. **Minimum playable proof**: a working race (solo + pass-and-play) with real physics, questions and points,
   verified with a Playwright test and a short recorded video.

## PHASE 2 — Opus (UI, polish, deploy)
- Port the approved designs: `design/magnet-race-home.html` (interactive home: springs, magnetic buttons,
  liquid tab lens, sheets) and the 4 concept screens `design/*.png` (home, private room, race HUD, question).
  iOS **Liquid Glass** style: frosted glass, specular edges, springy motion, Apple system colours
  (easy #34C759, medium #FF9500, hard #FF3B30).
- Race HUD: score capsule, lap, streak, dice timer ring, power-up buttons, Physics view toggle
  (field lines + force arrows labelled in N).
- Charge Pit Stop mini-game (swipe to rub balloon, pick up paper bits), Physics Lab sandbox (sliders: magnet
  strength, μ, mass), results screen, sounds, haptics (`navigator.vibrate`), responsive/touch, PWA manifest.
- Leaderboard (Supabase table) — optional.
- README, GitHub Pages deploy, final demo video for the presentation.

## Assets already made (in `design/`)
- `magnet-race-home.html` — approved interactive home screen (user: "this is perfect").
- `Magnet Race online - 1..4 *.png` — approved concept screens.
- `glass.css` — glass styles. `track.py` — track points + car/flag/zone drawing. `ios_art.py` — topic illustrations.
- `questions_source.json` — 10 easy (MCQ with answers), 10 medium, 15 hard (oral; model answers present
  for the first 10 hard, the last 5 hard need answers written).
