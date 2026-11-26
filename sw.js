// Service Worker: "primero la red, luego la caché".
// - Con internet: carga la versión más reciente y la guarda en caché (la app se actualiza sola).
// - Sin internet (o conexión muy lenta): usa la copia guardada.
// Si cambias algún archivo, sube el número de VERSION para limpiar cachés viejas.
const VERSION = 'inventario-taller-v4';
const NUCLEO = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const ESPERA_RED_MS = 4000; // si la red tarda más, se usa la caché

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(NUCLEO.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function redConTiempo(request) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ESPERA_RED_MS);
    fetch(request, { cache: 'no-cache' }).then(
      (resp) => { clearTimeout(t); resolve(resp); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    redConTiempo(req)
      .then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((enCache) => {
          if (enCache) return enCache;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
        })
      )
  );
});
