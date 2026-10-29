// Service worker do Por Três: deixa o app abrir sem internet mostrando os últimos dados.
//  - página (index.html) e dados (JSON): rede primeiro; sem rede, a última cópia salva
//  - assets/ (JS, CSS, fontes com hash no nome) e ícones: cache primeiro, nunca mudam
//  - bandeiras (flagcdn): cache, atualizando por trás
const VERSAO = 'v2'; // v2: logo novo (ícones com o mesmo nome)
const CACHE_APP = `app-${VERSAO}`;
const CACHE_DADOS = `dados-${VERSAO}`;
const CACHE_EXTERNO = `externo-${VERSAO}`;

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_APP).then((cache) => cache.addAll(['./', './manifest.webmanifest', './icons/icon-192.png'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => !n.endsWith(`-${VERSAO}`)).map((n) => caches.delete(n))),
    ),
  );
  self.clients.claim();
});

async function redePrimeiro(pedido, nomeCache, chave = pedido) {
  const cache = await caches.open(nomeCache);
  try {
    const resposta = await fetch(pedido);
    if (resposta.ok) cache.put(chave, resposta.clone());
    return resposta;
  } catch {
    const salvo = await cache.match(chave, { ignoreSearch: true });
    if (salvo) return salvo;
    throw new Error('sem rede e sem cópia salva');
  }
}

async function cachePrimeiro(pedido, nomeCache) {
  const cache = await caches.open(nomeCache);
  const salvo = await cache.match(pedido);
  if (salvo) return salvo;
  const resposta = await fetch(pedido);
  if (resposta.ok) cache.put(pedido, resposta.clone());
  return resposta;
}

async function atualizaPorTras(pedido, nomeCache) {
  const cache = await caches.open(nomeCache);
  const salvo = await cache.match(pedido);
  const buscando = fetch(pedido)
    .then((resposta) => {
      if (resposta.ok || resposta.type === 'opaque') cache.put(pedido, resposta.clone());
      return resposta;
    })
    .catch(() => salvo);
  return salvo ?? buscando;
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'flagcdn.com') evento.respondWith(atualizaPorTras(pedido, CACHE_EXTERNO));
    return; // analytics e o resto: direto, sem cache
  }

  if (pedido.mode === 'navigate') {
    // qualquer navegação usa a mesma página do app
    evento.respondWith(redePrimeiro(pedido, CACHE_APP, new URL('./', self.registration.scope).href));
    return;
  }
  if (url.pathname.includes('/dados/') || url.pathname.endsWith('.json')) {
    evento.respondWith(redePrimeiro(pedido, CACHE_DADOS));
    return;
  }
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    evento.respondWith(cachePrimeiro(pedido, CACHE_APP));
  }
});
