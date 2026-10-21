// MusicSmart PWA Service Worker
// Bump APP_VERSION on every release (deploy workflow also stamps the commit SHA here)
const APP_VERSION = 'v26';
const CACHE_NAME = 'musicsmart-' + APP_VERSION;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './data/lessons.js',
  './data/academic_docs.js',
  './data/quizzes.js',
  './data/store.js',
  './data/public-config.js',
  './js/google-sheet-sync.js',
  './js/student-auth.js',
  './js/pwa-install.js',
  './js/student-submit.js',
  './js/server-quiz.js',
  './js/teacher-tools.js',
  './js/intern.js',
  './js/student-practice.js',
  './js/app.js',
  './js/tuner.js',
  './js/audio-tools.js',
  './js/quiz-engine.js',
  './js/rubric-matrix.js',
  './js/official-forms.js',
  './js/car-analytics.js',
  './js/feldman-criticism.js',
  './js/virtual-kalimba.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/ppk_crest.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell & offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// แตะการแจ้งเตือนกำหนดส่ง → เปิด/โฟกัสแอป
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow('./') : null;
  }));
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests with http/https scheme
  if (!event.request || event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Never cache the roster file or cross-origin API calls
  if (event.request.url.includes('/data/students') || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // 1. Try matching exact request or ignoring query search params
        const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
        if (cachedResponse) return cachedResponse;

        // 2. If it is a page navigation or text/html request, return cached index.html
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          const indexCached = await caches.match('./index.html') || await caches.match('./');
          if (indexCached) return indexCached;
        }

        // 3. Always return a valid Response object to prevent "TypeError: Failed to convert value to 'Response'"
        return new Response('Not found (offline or missing resource)', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
