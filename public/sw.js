/**
 * Succesly Admin — Service Worker
 *
 * Strategy:
 *  - Static assets (JS/CSS with Vite content hash): cache-first (immutable)
 *  - Google Fonts:                                  cache-first (long-lived)
 *  - Navigation (HTML/SPA routes):                  network-first → cached index.html
 *  - API requests:                                  network-only (never cache)
 *
 * Update: bump CACHE_VERSION when deploying a breaking change to force clients
 * to re-fetch all assets.
 */

const CACHE_VERSION   = 'v1';
const STATIC_CACHE    = `np-admin-static-${CACHE_VERSION}`;
const FONT_CACHE      = `np-admin-fonts-${CACHE_VERSION}`;

// API hostnames to never cache (add your actual API domains here)
const API_ORIGINS = [
  // 'api.yourplatform.com',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Pre-cache the app shell entry point
      cache.addAll(['/'])
    ).catch(() => { /* gracefully handle if offline during install */ })
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Take control of all open tabs immediately
  self.clients.claim();

  // Remove old cache versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== FONT_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests entirely (POST, PUT, DELETE etc.)
  if (request.method !== 'GET') return;

  // Skip API origins (always fresh from server)
  if (API_ORIGINS.includes(url.hostname)) return;

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) return;

  // ── Google Fonts: cache-first ─────────────────────────────────────────────
  if (
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── Vite-hashed static assets: cache-first (immutable filenames) ──────────
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.woff2') ||
     url.pathname.endsWith('.woff') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.jpg') ||
     url.pathname.endsWith('.jpeg') ||
     url.pathname.endsWith('.svg') ||
     url.pathname.endsWith('.ico') ||
     url.pathname.endsWith('.webp'))
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── Navigation requests (SPA): network-first, offline fallback ────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML for offline use
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          // Offline: serve cached page or cached index.html (SPA fallback)
          const cached = await caches.match(request);
          return cached || caches.match('/') || new Response(
            '<h1>You are offline</h1><p>Please check your connection and try again.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }
});
