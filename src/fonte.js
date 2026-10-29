// De onde vêm os dados: a Padel API (com token) ou o arquivo de demonstração.
// As duas fontes têm a mesma cara: torneios(), jogosDoTorneio(), ranking().
import { readFile } from 'node:fs/promises';

const BASE = 'https://padelapi.org/api';

// Plano free: 10 req/min. Fica uma folga.
const LIMITE_POR_MINUTO = 9;

const TTL = {
  torneios: 30 * 60_000,
  jogos: 3 * 60_000,
  ranking: 6 * 60 * 60_000,
};

export function criarFonte(token) {
  return token ? fonteApi(token) : fonteDemo();
}

function fonteApi(token) {
  const cache = new Map(); // chave -> { expira, valor, promessa }
  const chamadas = []; // horários das últimas chamadas, para o limitador

  async function aguardarVaga() {
    for (;;) {
      const agora = Date.now();
      while (chamadas.length && agora - chamadas[0] > 60_000) chamadas.shift();
      if (chamadas.length < LIMITE_POR_MINUTO) {
        chamadas.push(agora);
        return;
      }
      await new Promise((ok) => setTimeout(ok, 60_000 - (agora - chamadas[0]) + 50));
    }
  }

  async function chamar(caminho, params) {
    const url = new URL(BASE + caminho);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    let resp;
    // 429 = estourou o limite por minuto (às vezes por outra máquina usando o mesmo token):
    // espera o minuto virar e tenta de novo, até 2 vezes
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      await aguardarVaga();
      resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (resp.status !== 429 || tentativa === 2) break;
      const espera = (Number(resp.headers.get('retry-after')) || 61) * 1000;
      await new Promise((ok) => setTimeout(ok, espera));
    }
    if (!resp.ok) {
      const corpo = await resp.json().catch(() => ({}));
      const erro = new Error(`Padel API ${resp.status}: ${corpo.message ?? resp.statusText}`);
      erro.status = resp.status === 401 ? 401 : 502;
      throw erro;
    }
    const json = await resp.json();
    return json.data ?? [];
  }

  // Cache com reaproveitamento da chamada em andamento; se a API falhar,
  // devolve o último valor bom em vez de derrubar a página.
  async function comCache(tipo, caminho, params) {
    const chave = caminho + JSON.stringify(params ?? {});
    const item = cache.get(chave);
    if (item?.valor && item.expira > Date.now()) return item.valor;
    if (item?.promessa) return item.promessa;
    const promessa = chamar(caminho, params)
      .then((valor) => {
        cache.set(chave, { valor, expira: Date.now() + TTL[tipo] });
        return valor;
      })
      .catch((erro) => {
        if (item?.valor) {
          cache.set(chave, { ...item, promessa: null });
          return item.valor;
        }
        cache.delete(chave);
        throw erro;
      });
    cache.set(chave, { ...item, promessa });
    return promessa;
  }

  return {
    modo: 'api',
    torneios: (params) => comCache('torneios', '/tournaments', params),
    jogosDoTorneio: (id, params) => comCache('jogos', `/tournaments/${encodeURIComponent(id)}/matches`, params),
    ranking: (params) => comCache('ranking', '/rankings', params),
  };
}

// O demo.json foi escrito para o dia "referencia"; as datas andam junto com o
// calendário para o exemplo sempre parecer atual.
const CAMPOS_DATA = ['start_date', 'end_date', 'played_at', 'scheduled_at', 'started_time', 'date'];

function deslocarDatas(no, dias) {
  if (Array.isArray(no)) return no.forEach((x) => deslocarDatas(x, dias));
  if (!no || typeof no !== 'object') return;
  for (const [k, v] of Object.entries(no)) {
    if (CAMPOS_DATA.includes(k) && typeof v === 'string') {
      const d = new Date(v.slice(0, 10) + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + dias);
      no[k] = d.toISOString().slice(0, 10) + v.slice(10);
    } else {
      deslocarDatas(v, dias);
    }
  }
}

function fonteDemo() {
  let dados;
  const carregar = async () => {
    if (!dados) {
      dados = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url), 'utf8'));
      const hoje = Date.parse(new Date().toISOString().slice(0, 10));
      deslocarDatas(dados, Math.round((hoje - Date.parse(dados.referencia)) / 86_400_000));
    }
    return dados;
  };

  const ordenar = (lista, campo, ordem) => {
    if (!campo) return lista;
    const sinal = ordem === 'desc' ? -1 : 1;
    return [...lista].sort((a, b) => {
      const va = a[campo] ?? '';
      const vb = b[campo] ?? '';
      return va < vb ? -sinal : va > vb ? sinal : 0;
    });
  };

  return {
    modo: 'demo',
    async torneios({ after_date, before_date, level, sort_by, order_by, per_page = 15 } = {}) {
      const { torneios } = await carregar();
      const niveis = level ? level.split(',') : null;
      const filtrados = torneios.filter(
        (t) =>
          (!after_date || t.end_date >= after_date) &&
          (!before_date || t.start_date <= before_date) &&
          (!niveis || niveis.includes(t.level)),
      );
      return ordenar(filtrados, sort_by, order_by).slice(0, per_page);
    },
    async jogosDoTorneio(id, { sort_by, order_by, per_page = 15 } = {}) {
      const { jogos } = await carregar();
      return ordenar(jogos[String(id)] ?? [], sort_by, order_by).slice(0, per_page);
    },
    async ranking({ category = 'men', per_page = 15 } = {}) {
      const { ranking } = await carregar();
      return (ranking[category] ?? []).slice(0, per_page);
    },
  };
}
