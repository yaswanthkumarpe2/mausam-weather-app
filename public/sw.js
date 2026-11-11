// Keeps the app shell available offline. Network first, so a new version is used
// as soon as it's reachable. Forecasts are saved by the app itself (see store.js).
const CACHE = 'mausam-shell-v2';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'css/app.css',
  'js/achievements.js',
  'js/api.js',
  'js/astro.js',
  'js/cards.js',
  'js/charts.js',
  'js/climate.js',
  'js/demo.js',
  'js/farm.js',
  'js/format.js',
  'js/health.js',
  'js/i18n-features.js',
  'js/i18n.js',
  'js/icons.js',
  'js/insights.js',
  'js/lifestyle.js',
  'js/main.js',
  'js/personas.js',
  'js/screen-community.js',
  'js/screen-farm.js',
  'js/screen-health.js',
  'js/screen-map.js',
  'js/screen-parts.js',
  'js/screen-plan.js',
  'js/share.js',
  'js/sheets.js',
  'js/sky.js',
  'js/store.js',
  'js/trip.js',
  'js/voice.js',
  'js/weather-codes.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request, { ignoreSearch: true })) ?? Response.error()),
  );
});
