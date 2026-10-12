const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = 'hesabyar-' + CACHE_VERSION;
const RUNTIME_CACHE = 'hesabyar-runtime-' + CACHE_VERSION;
const CDN_CACHE = 'hesabyar-cdn-' + CACHE_VERSION;

// فایل‌های ضروری که باید همیشه کش بشن
const urlsToCache = [
    '/Dongi/',
    '/Dongi/index.html',
    '/Dongi/manifest.json',
    '/Dongi/icon-192.png',
    '/Dongi/icon-512.png',
    '/Dongi/favicon.ico'
];

// دامنه‌های CDN که کدشون باید کش بشه
const CDN_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'code.jquery.com'
];

// نصب: کش فایل‌های اصلی
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Installing cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// فعال‌سازی: پاک کردن کش‌های قدیمی + کنترل تب‌های باز
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.startsWith('hesabyar-') && 
                        cacheName !== CACHE_NAME && 
                        cacheName !== RUNTIME_CACHE && 
                        cacheName !== CDN_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// تشخیص اینکه درخواست از CDN هست یا نه
function isCdnRequest(url) {
    return CDN_HOSTS.some(host => url.hostname.includes(host));
}

// تشخیص درخواست API/داده (که نباید کش بشه)
function isDataRequest(url) {
    return url.pathname.includes('/api/') || 
           url.pathname.includes('/data/') ||
           url.search.includes('no-cache');
}

// استراتژی fetch
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // فقط GET رو مدیریت کن
    if (event.request.method !== 'GET') return;
    
    // درخواست‌های داده‌ای رو کش نکن
    if (isDataRequest(url)) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // درخواست‌های CDN: Stale-While-Revalidate
    // یعنی از کش بده، همزمان تو پس‌زمینه آپدیت کن
    if (isCdnRequest(url)) {
        event.respondWith(
            caches.open(CDN_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        // فقط پاسخ‌های موفق رو کش کن
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(err => {
                        console.log('[SW] CDN fetch failed:', err);
                        return cachedResponse; // اگه شبکه fail شد، از کش بده
                    });
                    
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
    
    // درخواست‌های داخلی سایت: Cache-First با Network Fallback
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // از کش بده، همزمان تو پس‌زمینه چک کن آپدیت هست یا نه
                    fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    }).catch(() => {});
                    return cachedResponse;
                }
                
                // اگه تو کش نبود، از شبکه بگیر
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    console.log('[SW] Fetch failed:', err);
                    // Fallback: اگه صفحه اصلی بود، index.html رو بده
                    if (event.request.mode === 'navigate') {
                        return caches.match('/Dongi/index.html');
                    }
                    throw err;
                });
            });
        })
    );
});

// پیام از سمت کلاینت (برای آپدیت دستی)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(names => 
                Promise.all(names.map(n => caches.delete(n)))
            ).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});
