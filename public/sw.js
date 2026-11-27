self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || !event.request.url.startsWith(self.registration.scope)) return;
  // Serve the current build from the network so an update cannot mix old code and new model assets.
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b0a13"><title>FaceControl is offline</title>
<body style="background:#0b0a13;color:#f5f2ff;font:1rem system-ui;padding:2rem">
<h1>FaceControl is offline</h1><p>Reconnect to the internet and reopen FaceControl. Your saved scores stay in this browser.</p>
</body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
