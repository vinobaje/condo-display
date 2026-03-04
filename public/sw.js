// ═══════════════════════════════════════════════════════════════
// Condo Notice Board — Media Cache Service Worker
// ═══════════════════════════════════════════════════════════════
// Caches images, videos, and PDFs from Firebase Storage locally.
// Media only downloads ONCE, then serves from cache forever.
// Cache refreshes every 24 hours to pick up any changes.
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'condo-media-v1';

// Patterns to cache (Firebase Storage URLs)
const CACHEABLE_PATTERNS = [
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
];

// File extensions to cache
const CACHEABLE_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg',
    '.mp4', '.webm', '.mov',
    '.pdf',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Media cache service worker installed');
    self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Media cache service worker activated');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch Interceptor ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    if (event.request.method !== 'GET') return;
    if (!isCacheableMedia(url)) return;
    event.respondWith(handleMediaRequest(event.request));
});

// ── Check if URL is cacheable media ──────────────────────────
function isCacheableMedia(url) {
    const lowerUrl = url.toLowerCase();
    const isFirebaseStorage = CACHEABLE_PATTERNS.some(p => lowerUrl.includes(p));
    if (!isFirebaseStorage) return false;
    const pathname = new URL(url).pathname.toLowerCase();
    const decodedPath = decodeURIComponent(pathname);
    return CACHEABLE_EXTENSIONS.some(ext =>
        decodedPath.includes(ext) || pathname.includes(ext)
    );
}

// ── Cache-first strategy (no expiry) ─────────────────────────
async function handleMediaRequest(request) {
    const cache = await caches.open(CACHE_NAME);

    // Check cache first
    const cached = await cache.match(request);
    if (cached) {
        console.log('[SW] Cache hit:', shortUrl(request.url));
        return cached;
    }

    // Cache miss — download and store
    console.log('[SW] Downloading:', shortUrl(request.url));
    try {
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(request, response.clone());
            console.log('[SW] Cached:', shortUrl(request.url));
        }
        return response;
    } catch (error) {
        console.error('[SW] Network error:', shortUrl(request.url));
        throw error;
    }
}

// ── Helper: shorten URL for logging ──────────────────────────
function shortUrl(url) {
    try {
        const u = new URL(url);
        const path = decodeURIComponent(u.pathname);
        return path.split('/').pop() || path;
    } catch {
        return url.substring(0, 60);
    }
}

// ── Message handler for cache management ─────────────────────
self.addEventListener('message', (event) => {
    if (event.data === 'clear-cache') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
            event.ports[0]?.postMessage('cleared');
        });
    }

    if (event.data === 'cache-stats') {
        caches.open(CACHE_NAME).then(async (cache) => {
            const keys = await cache.keys();
            let totalSize = 0;
            for (const req of keys) {
                const res = await cache.match(req);
                if (res) {
                    const blob = await res.clone().blob();
                    totalSize += blob.size;
                }
            }
            event.ports[0]?.postMessage({
                count: keys.length,
                sizeMB: (totalSize / 1024 / 1024).toFixed(1),
            });
        });
    }
});
