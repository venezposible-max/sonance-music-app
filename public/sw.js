// Sonance Service Worker v8 - Background Audio Edition
// ============================================================

const CACHE_NAME = 'sonance-music-v8';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.png',
    '/favicon.ico',
    '/apple-touch-icon.png'
];

// --- INSTALL: Cache static assets ---
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Sonance SW v7...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting()) // Activate immediately
    );
});

// --- ACTIVATE: Clear old caches ---
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Sonance SW v7...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim()) // Take control of all pages immediately
    );
});

// --- FETCH: Serve from cache or network ---
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept audio streams or API calls - let them flow freely
    if (
        url.pathname.includes('/api/') ||
        url.pathname.includes('/stream') ||
        event.request.headers.get('range') // Audio range requests - critical for streaming!
    ) {
        return; // Bypass SW completely for audio
    }

    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Only cache successful responses for static assets
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return response;
            }).catch(() => {
                // If offline and no cache, return the main index
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

// --- MESSAGE: Handle commands from the app ---
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Keepalive ping from the app to keep SW alive during background playback
    if (event.data && event.data.type === 'AUDIO_KEEPALIVE') {
        console.log('[SW] Audio keepalive received - staying awake');
        // Respond to let the app know we're alive
        event.source?.postMessage({ type: 'SW_ALIVE', timestamp: Date.now() });
    }
});

// --- BACKGROUNDSYNC: Recover from network drops ---
self.addEventListener('sync', (event) => {
    if (event.tag === 'audio-sync') {
        console.log('[SW] Background sync: audio-sync triggered');
    }
});
