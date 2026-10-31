// API pública do Por Três para a busca da aba Brasil. Só GET, só leitura:
//   /br/buscar?q=termo  -> torneios do SportScore cujo título ou local casam com o termo
//                          [{ id, titulo, organizador, temTabela, url }]
//   /br/torneio?id=497  -> o torneio montado na hora, no MESMO formato de dados/br/torneio-<id>.json
// O parser é o mesmo do gerador do site (src/sportscore.js + src/brasil.js); o wrangler empacota.
// Quem tira da resposta os torneios que já estão na lista (data/torneios-br.json) é o front.
import { buscarTorneiosSportScore } from '../../src/sportscore.js';
import { buscarBr, detalheBr } from '../../src/brasil.js';

// Quanto cada resposta vale. Igual ao torneio "acontecendo hoje" do robô; busca muda pouco.
const TTL_TORNEIO = 3 * 60;
const TTL_BUSCA = 10 * 60;
// Até 5 páginas da listagem (50 torneios) por busca, uma de cada vez
const PAGINAS_BUSCA = 5;

// Quem pode chamar do navegador: o site e qualquer porta do localhost (dev, wrangler, serve...)
function origemLiberada(origem) {
  if (!origem) return null;
  if (origem === 'https://portres.com.br' || origem === 'https://www.portres.com.br') return origem;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) return origem;
  return null;
}

function comCors(resposta, origem) {
  const r = new Response(resposta.body, resposta);
  const liberada = origemLiberada(origem);
  if (liberada) r.headers.set('Access-Control-Allow-Origin', liberada);
  r.headers.set('Vary', 'Origin');
  return r;
}

function json(corpo, { status = 200, ttl = 0 } = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // o navegador e o cache do Cloudflare guardam pelo mesmo prazo; erro não guarda
      'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-store',
    },
  });
}

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function rotaBuscar(url) {
  const termo = (url.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ');
  if (termo.length < 3 || termo.length > 60) return json({ erro: 'Informe ?q= com 3 a 60 letras' }, { status: 400 });
  const torneios = await buscarTorneiosSportScore(termo, { paginas: PAGINAS_BUSCA, ttl: TTL_BUSCA * 1000 });
  return json(torneios, { ttl: TTL_BUSCA });
}

async function rotaTorneio(url) {
  const id = url.searchParams.get('id') ?? '';
  if (!/^\d{1,6}$/.test(id)) return json({ erro: 'Informe ?id= com o número do torneio no SportScore' }, { status: 400 });
  // Torneio de fora da lista: sem nome, cidade nem datas cadastrados, vale o que vier da fonte
  const cfg = { sportscore: Number(id) };
  return json(detalheBr(cfg, await buscarBr(cfg, TTL_TORNEIO * 1000)), { ttl: TTL_TORNEIO });
}

const ROTAS = { '/br/buscar': rotaBuscar, '/br/torneio': rotaTorneio };

// Chave do cache: só o que muda a resposta (busca sem acento/maiúscula, para "Pallas" e "pallas" caírem juntas)
function chaveCache(url) {
  const chave = new URL(url.pathname, url.origin);
  if (url.pathname === '/br/buscar') chave.searchParams.set('q', semAcento((url.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ')));
  else chave.searchParams.set('id', url.searchParams.get('id') ?? '');
  return new Request(chave.toString());
}

export default {
  async fetch(pedido, _env, ctx) {
    const url = new URL(pedido.url);
    const origem = pedido.headers.get('Origin');

    if (pedido.method === 'OPTIONS') {
      const r = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
      return comCors(r, origem);
    }
    if (pedido.method !== 'GET') return comCors(json({ erro: 'Só GET' }, { status: 405 }), origem);

    const rota = ROTAS[url.pathname];
    if (!rota) return comCors(json({ erro: 'Rota não existe. Use /br/buscar?q= ou /br/torneio?id=' }, { status: 404 }), origem);

    // Cache API do Workers: a mesma resposta serve todo mundo até vencer.
    // (Em *.workers.dev ela não guarda nada; aí vale o cache em memória do src/sportscore.js.)
    const cache = caches.default;
    const chave = chaveCache(url);
    const guardada = await cache.match(chave);
    if (guardada) return comCors(guardada, origem);

    let resposta;
    try {
      resposta = await rota(url);
    } catch (erro) {
      console.error(`[api] ${url.pathname}${url.search}:`, erro.message);
      resposta = json({ erro: `SportScore não respondeu: ${erro.message}` }, { status: 502 });
    }
    if (resposta.ok) ctx.waitUntil(cache.put(chave, resposta.clone()));
    return comCors(resposta, origem);
  },
};
