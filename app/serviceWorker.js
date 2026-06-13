const CACHE_NAME = 'causerie-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/app/app.js',
  '/app/antiDeadEnd.js',
  '/app/config.js',
  '/app/debrief.js',
  '/app/learnerModel.js',
  '/app/orchestrator.js',
  '/app/scenarios.js',
  '/app/speechLayer.js',
  '/app/storage.js',
  '/app/telemetry.js',
  '/app/utils.js'
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
