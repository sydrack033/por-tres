// Torneios brasileiros via SportScore (sportscore.com.br), o gestor usado pela Liga Brasileira
// e por vários clubes de SC. A "API" deles (jogos.sportscore.com.br/api) devolve pedaços de HTML
// prontos para embutir em site de clube; aqui transformamos isso em JSON.
// Não é documentada: pode mudar sem aviso. Cache para não ficar batendo neles.

const BASE = 'https://jogos.sportscore.com.br/api';
const TTL_MS = 2 * 60_000;
const CABECALHOS = { 'User-Agent': 'PadelAgora/0.1 (prototipo)', Accept: 'text/html' };

// Situações do filtro "sit" da timeline
export const SITUACAO = { aberto: 1, confirmado: 2, iniciado: 3, emAnalise: 9, finalizado: 10 };

// HTML vencido ainda serve se o SportScore falhar; depois disso some do cache guardado
const GUARDA_VENCIDO = 2 * 24 * 60 * 60_000;

const cache = new Map(); // url -> { expira, valor, promessa }
let feitas = 0;

// O robô do site guarda o cache de uma execução para a outra (scripts/gerar-site.js)
export function carregarCacheSportScore(guardado = {}) {
  for (const [url, item] of Object.entries(guardado)) cache.set(url, item);
}

export function cacheSportScoreParaGuardar() {
  return Object.fromEntries(
    [...cache]
      .filter(([, item]) => item.valor && item.expira > Date.now() - GUARDA_VENCIDO)
      .map(([url, { expira, valor }]) => [url, { expira, valor }]),
  );
}

export const chamadasSportScore = () => feitas;

async function buscarHtml(url, ttl = TTL_MS) {
  const item = cache.get(url);
  if (item?.valor && item.expira > Date.now()) return item.valor;
  if (item?.promessa) return item.promessa;
  feitas++;
  const promessa = fetch(url, { headers: CABECALHOS })
    .then(async (resp) => {
      if (!resp.ok) throw Object.assign(new Error(`SportScore ${resp.status}`), { status: 502 });
      const valor = await resp.text();
      cache.set(url, { valor, expira: Date.now() + ttl });
      return valor;
    })
    .catch((erro) => {
      // falhou: devolve o último HTML bom, se houver
      if (item?.valor) {
        cache.set(url, { ...item, promessa: null });
        return item.valor;
      }
      cache.delete(url);
      throw erro;
    });
  cache.set(url, { ...item, promessa });
  return promessa;
}

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

function texto(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e] ?? e)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function opcoesDoSelect(html, nome) {
  const select = html.match(new RegExp(`<select[^>]*name="${nome}"[^>]*>([\\s\\S]*?)</select>`));
  if (!select) return [];
  return [...select[1].matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)].map(([, valor, rotulo]) => ({
    valor,
    rotulo: texto(rotulo),
  }));
}

// "30/10" -> "2026-10-30". Sem ano na fonte: usa o ano de referência e vira o ano se a data "voltar" muito.
function dataISO(ddmm, anoReferencia) {
  const [d, m] = ddmm.split('/').map(Number);
  const hoje = new Date();
  let ano = anoReferencia ?? hoje.getFullYear();
  if (!anoReferencia && m < hoje.getMonth() + 1 - 6) ano += 1;
  return `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Linha de info, em dois formatos:
//   "30/10 Sex 14:00 - Central Padel - Quadra: \n4ª Masculina - Chave: C\nID: 8-9"
//   "02/10 Sex 18:00 -  - Quadra:  - Início: 18:05\n6ª masculina - Chave: A - Tempo: 20min\nID: 1-1"
function lerInfo(info, anoReferencia) {
  const [linha1 = '', linha2 = '', linha3 = ''] = texto(info).split('\n').map((l) => l.trim());
  const quando = linha1.match(/^(\d{2}\/\d{2})\s+(\S+)\s+(\d{2}:\d{2})/);
  const pedacos = linha1.split(/\s+-\s+/).map((p) => p.trim());
  const rotulado = (rotulo, linha) => linha.match(new RegExp(`${rotulo}:\\s*([^-]*?)\\s*(?:-|$)`))?.[1]?.trim() || null;
  const clube = pedacos[1] && !pedacos[1].includes(':') ? pedacos[1] : null;
  return {
    id: linha3.match(/ID:\s*([\w-]+)/)?.[1] ?? null,
    data: quando ? dataISO(quando[1], anoReferencia) : null,
    hora: quando?.[3] ?? null,
    inicio: rotulado('Início', linha1),
    clube,
    quadra: rotulado('Quadra', linha1),
    categoria: linha2.split(/\s+-\s+/)[0]?.trim() || null,
    chave: rotulado('Chave', linha2),
    duracao: rotulado('Tempo', linha2),
  };
}

function lerJogos(html, anoReferencia) {
  return html
    .split(/<div class="box-placar">/)
    .slice(1)
    .map((bloco) => {
      const info = bloco.match(/<div class="placar-info[^"]*">\s*<div>([\s\S]*?)<\/div>/)?.[1] ?? '';
      const duplas = [...bloco.matchAll(/<div class="result-item[^"]*">\s*<div>([\s\S]*?)<\/div>\s*<ul>([\s\S]*?)<\/ul>/g)].map(
        ([, nomes, sets]) => ({
          jogadores: texto(nomes).split(/\s*\/\s*/).filter(Boolean),
          sets: [...sets.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, s]) => texto(s)),
        }),
      );
      return { ...lerInfo(info, anoReferencia), duplas };
    })
    .filter((j) => j.id && j.duplas.length === 2);
}

// Quem ganhou: mais sets vencidos (cada <li> é o placar de games daquele set)
function vencedor(d1, d2) {
  if (!d1.sets.length || d1.sets.length !== d2.sets.length) return null;
  let a = 0;
  let b = 0;
  d1.sets.forEach((s, i) => {
    const g1 = parseInt(s, 10);
    const g2 = parseInt(d2.sets[i], 10);
    if (g1 > g2) a++;
    else if (g2 > g1) b++;
  });
  return a === b ? null : a > b ? 1 : 2;
}

const urlTimeline = (id, sit = '') => `${BASE}/timeline/?id=${encodeURIComponent(id)}&cat=&club=&data=&sit=${sit}`;

// ttl: quanto tempo a resposta vale (torneio acontecendo hoje vence rápido; ver rotas.js)
export async function torneioSportScore(id, { anoReferencia, ttl } = {}) {
  // Duas chamadas: todos os jogos + só os iniciados (a lista não marca quem está em quadra)
  const [html, htmlIniciados] = await Promise.all([
    buscarHtml(urlTimeline(id), ttl),
    buscarHtml(urlTimeline(id, SITUACAO.iniciado), ttl),
  ]);
  // Torneio com inscrição aberta e tabela ainda não gerada responde "Evento não encontrado."
  if (!html.includes('pdl-title')) {
    return { id: Number(id), titulo: null, publicado: false, categorias: [], clubes: [], datas: [], jogos: [] };
  }
  const emQuadra = new Set(lerJogos(htmlIniciados, anoReferencia).map((j) => j.id));
  const jogos = lerJogos(html, anoReferencia).map((j) => {
    const [d1, d2] = j.duplas;
    const ganhou = vencedor(d1, d2);
    const status = emQuadra.has(j.id) ? 'live' : ganhou ? 'finished' : d1.sets.length ? 'live' : 'scheduled';
    return { ...j, status, vencedor: ganhou };
  });
  return {
    id: Number(id),
    titulo: texto(html.match(/<h3 class="pdl-title">([\s\S]*?)<\/h3>/)?.[1] ?? ''),
    publicado: true,
    categorias: opcoesDoSelect(html, 'cbo_cat'),
    clubes: opcoesDoSelect(html, 'cbo_clube'),
    datas: opcoesDoSelect(html, 'cbo_data'),
    jogos,
  };
}
