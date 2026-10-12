// Service Worker موقت — خودش رو unregister می‌کنه
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => {
            return Promise.all(names.map(n => caches.delete(n)));
        }).then(() => self.registration.unregister())
    );
});
