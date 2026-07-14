const CACHE_VERSION = 'larlarpick-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const appScope = new URL(self.registration.scope);
const scopePath = appScope.pathname.replace(/\/$/, '');
const scopedUrl = (path) => `${scopePath}${path}`;

const PRECACHE_URLS = [
  scopedUrl('/'),
  scopedUrl('/manifest.webmanifest'),
  scopedUrl('/pwa-icon.svg'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('larlarpick-pwa-') && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const isAdminPath = (pathname) => pathname === scopedUrl('/admin') || pathname.startsWith(scopedUrl('/admin/'));

const isPrivatePath = (pathname) => [
  scopedUrl('/checkout'),
  scopedUrl('/orders'),
  scopedUrl('/profile'),
  scopedUrl('/chat'),
].some((path) => pathname === path || pathname.startsWith(`${path}/`));

const isStaticAsset = (pathname) => [
  scopedUrl('/build/'),
  scopedUrl('/storage/'),
].some((path) => pathname.startsWith(path)) || pathname === scopedUrl('/pwa-icon.svg');

const offlineResponse = () => new Response(
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{margin:0;font-family:Arial,sans-serif;background:#f5fbf8;color:#172033;display:grid;min-height:100vh;place-items:center;padding:24px}.panel{max-width:420px;background:#fff;border:1px solid #dbe7e2;border-radius:8px;padding:24px;box-shadow:0 14px 40px rgba(15,23,42,.08)}h1{font-size:24px;margin:0 0 8px}p{margin:0;color:#64748b;line-height:1.5}</style></head><body><main class="panel"><h1>You are offline</h1><p>Please reconnect to continue shopping. Recently opened public pages may still be available from your browser cache.</p></main></body></html>',
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isAdminPath(url.pathname)) {
    return;
  }

  if (request.mode === 'navigate') {
    if (isPrivatePath(url.pathname)) {
      event.respondWith(fetch(request).catch(offlineResponse));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(scopedUrl('/')) || offlineResponse()))
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        return response;
      }))
    );
  }
});
