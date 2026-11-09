// Offline support: serves the game from cache, refreshing it in the background.
const VERSION = 'mr-v4';
const SHELL = [
 "./",
 "favicon.ico",
 "icons/icon-180.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "index.html",
 "manifest.webmanifest",
 "src/config.js",
 "src/game/autodrive.js",
 "src/game/match.js",
 "src/game/powerups.js",
 "src/game/profile.js",
 "src/game/scoring.js",
 "src/main.js",
 "src/net/matchmaking.js",
 "src/net/room.js",
 "src/net/session.js",
 "src/net/transport.js",
 "src/physics/engine.js",
 "src/questions/bank.js",
 "src/questions/engine.js",
 "src/render/canvas.js",
 "src/track/spline.js",
 "src/track/track.js",
 "src/track/tracks/classic.js",
 "src/ui/art.js",
 "src/ui/dom.js",
 "src/ui/lab.js",
 "src/ui/motion.js",
 "src/ui/pitstop.js",
 "src/ui/screens.js",
 "src/ui/sound.js",
 "src/ui/style.css",
 "src/util/rng.js"
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // fonts, Supabase etc. go straight to the network
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
