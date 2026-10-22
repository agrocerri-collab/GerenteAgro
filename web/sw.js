// AgroCR Campo — service worker
// Guarda o app no aparelho para abrir sem sinal.
// Ao mexer no app, suba o numero da VERSAO para o celular baixar de novo.

const VERSAO = "agrocr-v1";
const ARQUIVOS = [
  "./AgroCR.html",
  "./manifest.webmanifest",
  "./icone-192.png",
  "./icone-512.png",
  "./icone-maskable.png",
  "./vendor/react.js",
  "./vendor/react-dom.js",
  "./vendor/babel.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const ehPagina = e.request.mode === "navigate" || e.request.url.endsWith("AgroCR.html");

  if (ehPagina) {
    // pagina: tenta a rede primeiro (pega versao nova), cai no cache se estiver sem sinal
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put("./AgroCR.html", copia));
          return r;
        })
        .catch(() => caches.match("./AgroCR.html"))
    );
    return;
  }

  // resto (React, Babel, icones): cache primeiro, é sempre igual
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
