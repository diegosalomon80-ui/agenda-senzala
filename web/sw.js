/* Service worker: guarda só a "casca" do app (arquivos deste site).
 * Respostas da API e do login do Google (outras origens) nunca passam por aqui. */
var CACHE = 'casca-v1';
var ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'js/config.js', 'js/regras.js', 'js/sessao.js', 'js/api.js', 'js/app.js',
  'icons/icone-192.png', 'icons/icone-512.png', 'icons/icone-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Rede primeiro (pega atualizações), cache como reserva. Só GET da própria origem.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (resp) {
    if (resp.ok) {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copia); });
    }
    return resp;
  }).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match('index.html'); });
  }));
});
