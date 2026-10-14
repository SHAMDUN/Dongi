const CACHE_VERSION = 'v14.0.0';
const CACHE_NAME = 'hesabyar-' + CACHE_VERSION;
const RUNTIME_CACHE = 'hesabyar-runtime-' + CACHE_VERSION;
const CDN_CACHE = 'hesabyar-cdn-' + CACHE_VERSION;

const urlsToCache = [
    '/Dongi/',
    '/Dongi/index.html',
    '/Dongi/manifest.json',
    '/Dongi/icon-192.png',
    '/Dongi/icon-512.png',
    '/Dongi/favicon.ico'
];

const CDN_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'code.jquery.com'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.startsWith('hesabyar-') && 
                        cacheName !== CACHE_NAME && 
                        cacheName !== RUNTIME_CACHE && 
                        cacheName !== CDN_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

function isCdnRequest(url) {
    return CDN_HOSTS.some(host => url.hostname.includes(host));
}

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (event.request.method !== 'GET') return;
    if (url.pathname.includes('/api/')) return;
    
    if (isCdnRequest(url)) {
        event.respondWith(
            caches.open(CDN_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);
                    
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
    
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/Dongi/index.html');
                    }
                    throw err;
                });
            });
        })
    );
});
