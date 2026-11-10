# Magnet Race

**Play it: https://magnet-race.vercel.app**

A physics racing game: pull a steel car around the track with a magnet (your finger or mouse), without ever touching it. Answer physics cards on the way to score points. Made for a Cambridge IGCSE/AS physics project.

## Play
- **Solo**: time trial, 3 laps.
- **Pass & Play**: 2–4 players on one device, taking turns.
- **vs Bots**: race 1–3 computer players (Easy / Normal / Hard) that roll, steer, do pit stops and answer cards.
- **Private room / Public duel**: online play over Supabase Realtime (switched on).

Press on the track to put the magnet down, move it to pull the car, and lift it to drop the magnet.
- The car only moves when the magnet's pull is bigger than friction (0.10 N on smooth track, 0.30 N on sandpaper).
- If the magnet gets too close (2 cm), the car sticks to it and your turn ends.
- Steel plates screen the magnet's field, so the pull gets much weaker behind them.
- Blue ⚡ zones are **Charge Pit Stops**: rub the balloon on the wool to charge it, then hold it over the paper. Each piece you lift = +2 s.
- Coloured `?` zones are question cards: green = easy (1 pt), orange = medium (2), red = hard (3; a wrong answer also loses your next turn).
- Streaks multiply points (×1.5 at 3 right in a row, ×2 at 5). Answering within 5 s gives +1, and the first player to finish all laps gets +5. The player with the most points wins.

## Also in the game
- **Physics Lab** (Lab tab): one strip, one magnet, one car. Change magnet strength, gap, μ and mass, add a steel shield, and watch pull vs friction decide whether the car moves. It uses the same physics as the race.
- **Physics view** in the race: live field lines plus force arrows in newtons, and a readout of pull, friction, speed and gap.
- Daily challenge and stats saved on this device, sounds (with a mute button), vibration on phones, and installable as an app (Add to Home Screen) that works offline.

## One-file version
`python3 tools/build-single.py` packs everything into `dist/magnet-race.html`: a single file you can double-click, email or put on a USB stick. Solo, Pass & Play, Lab and Pit Stop all work offline.

## Run locally
ES modules don't load from `file://`, so serve the folder:
```
python3 -m http.server 8000      # then open http://localhost:8000
```

## Online play (private rooms + public duels)
1. Create a free project at supabase.com.
2. Go to Settings → API and copy the Project URL and the `anon` public key into `src/config.js`.

That's it: rooms and duels use Supabase Realtime (broadcast + presence), with no database tables needed. Leave the config empty and the game runs offline only.

## Deploy (GitHub Pages)
Push to GitHub → Settings → Pages → Deploy from branch → `main` / root. There's no build step.

## Tests
```
node tests/unit.mjs          # physics, track, scoring, questions, pit stop, full matches, networking (43 checks)
node tests/e2e.cjs           # plays a whole Pass & Play game in headless Chrome
LAPS=1 node tests/e2e.cjs --video
```

## Code map
| Folder | What |
|---|---|
| `src/physics/engine.js` | Fixed-step (120 Hz) simulation: magnetic pull, static and kinetic friction, screening, sticking |
| `src/track/` | Closed spline track, arc-length sampling, projection, fall-off, zones, checkpoints |
| `src/game/match.js` | Event-sourced game state machine (turns + duel), shared by offline and online play |
| `src/game/scoring.js`, `powerups.js` | Points, streaks, bonuses, power-ups |
| `src/questions/` | 35-question bank (10 easy / 10 medium / 15 hard) with checkable answers |
| `src/net/` | Transport (Supabase or in-memory), rooms, matchmaking, networked session |
| `src/render/canvas.js` | Canvas renderer with the Physics view (field lines + force arrows in N) |
| `src/ui/` | Liquid Glass screens (`screens.js`), Physics Lab (`lab.js`), Charge Pit Stop (`pitstop.js`), springs and motion (`motion.js`), sounds (`sound.js`), icons and topic art (`art.js`) |
| `src/game/profile.js` | Stats and daily challenges saved on the device |
| `sw.js`, `manifest.webmanifest` | Offline support + installable app. After adding files run `python3 tools/gen-sw.py` |
| `design/` | Approved designs for phase 2 (Liquid Glass UI) |
