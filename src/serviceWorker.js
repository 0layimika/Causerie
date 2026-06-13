const CACHE_NAME = 'causerie-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/src/app.js',
  '/src/antiDeadEnd.js',
  '/src/config.js',
  '/src/debrief.js',
  '/src/learnerModel.js',
  '/src/orchestrator.js',
  '/src/scenarios.js',
  '/src/speechLayer.js',
  '/src/storage.js',
  '/src/telemetry.js',
  '/src/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((response) => response || caches.match('/'))));
});
