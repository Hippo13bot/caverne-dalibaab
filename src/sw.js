// Service worker : l'app fonctionne hors-ligne (chantier, sous-sol, tournage sans réseau)
const CACHE = 'caverne-alibaab-v5';
const SHELL = [
  './','index.html','styles.css','app.js','qr.js','main.js','preload.js',
  'mascotte.gif','mascotte-logo.gif','manifest.webmanifest',
  'icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png',
  'vendor/html5-qrcode.min.js'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
