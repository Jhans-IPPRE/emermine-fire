/* EmerMine Fire — Service Worker: permite abrir la app sin señal. */
const CACHE = 'emermine-v1.1.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.svg', 'logo.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // las llamadas al servidor (POST) no se tocan
  const url = new URL(req.url);
  if (/(^|\.)(script|drive|docs)\.google\.com$|googleusercontent\.com$/.test(url.hostname)) return;   // Apps Script / Drive siempre en red (las fuentes sí se guardan)
  // Red primero para la app (para recibir actualizaciones); si no hay señal, usar la copia guardada.
  // Con señal débil, si la red no responde en 4 s se usa la copia guardada.
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  const cached = () => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => cached().then(finish), 4000);
    net.then(r => { clearTimeout(t); finish(r); })
       .catch(() => { clearTimeout(t); cached().then(r => r ? finish(r) : finish(Response.error())); });
  }));
});
