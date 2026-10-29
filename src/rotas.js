// Monta os dados de cada rota /dados/*. Usado pelo servidor local (server.js) e pelo
// gerador do site estático (scripts/gerar-site.js), então os dois mostram exatamente a mesma coisa.
import { readFile } from 'node:fs/promises';
import { criarFonte } from './fonte.js';
import { canaisPara, carregarRegrasTransmissao } from './transmissao.js';
import { torneioSportScore } from './sportscore.js';

// Níveis que interessam: circuito Premier Padel + FIP mais forte
const NIVEIS_PRINCIPAIS = ['major', 'p1', 'p2', 'finals', 'fip_platinum', 'fip_gold'];
const NIVEIS_PREMIER = ['major', 'p1', 'p2', 'finals'];

// "Hoje" no Brasil: em UTC, depois das 21h de Brasília já seria amanhã
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function resumoTorneio(t) {
  return {
    id: t.id,
    nome: t.name,
    nivel: t.level,
    cidade: t.location,
    pais: t.country,
    fuso: t.timezone,
    status: t.status,
    inicio: t.start_date,
    fim: t.end_date,
    url: t.url,
    foto: t.photo_url,
    local: t.venue?.name ?? null,
  };
}

// Plano free devolve "hidden_free_plan" no lugar de alguns campos
const livre = (v) => (v === 'hidden_free_plan' ? null : v ?? null);

// Bye e jogo não disputado não interessam a ninguém
const disputado = (m) => !['bye', 'not_played'].includes(m.status);

function montarJogo(m, torneio, regras) {
  return {
    id: m.id,
    categoria: m.category,
    rodada: m.round,
    nomeRodada: m.round_name,
    status: m.status,
    dupla1: (m.players?.team_1 ?? []).map((p) => ({ nome: p.name, pais: p.nationality })),
    dupla2: (m.players?.team_2 ?? []).map((p) => ({ nome: p.name, pais: p.nationality })),
    cabecas: m.seeds ?? null,
    placar: m.score ?? null,
    vencedor: m.winner ?? null,
    data: m.played_at,
    horarioMadri: livre(m.scheduled_at),
    horarioInicioMadri: livre(m.started_time),
    rotuloHorario: livre(m.schedule_label),
    quadra: m.court ?? null,
    ordemQuadra: m.court_order ?? null,
    duracao: livre(m.duration),
    torneio: resumoTorneio(torneio),
    ondeAssistir: canaisPara(regras, torneio, m.round),
  };
}

// ---------- torneios brasileiros (SportScore) ----------

export async function torneiosBrConfigurados() {
  const arquivo = new URL('../data/torneios-br.json', import.meta.url);
  return JSON.parse(await readFile(arquivo, 'utf8')).torneios;
}

function contarStatus(jogos) {
  const conta = { live: 0, scheduled: 0, finished: 0 };
  for (const j of jogos) conta[j.status] = (conta[j.status] ?? 0) + 1;
  return conta;
}

function statusDoTorneio(cfg, dados) {
  const hoje = hojeISO();
  const contagem = contarStatus(dados.jogos);
  if (contagem.live) return 'live';
  if (cfg.fim && cfg.fim < hoje) return 'finished';
  if (cfg.inicio && cfg.inicio <= hoje) return 'live';
  if (dados.jogos.length && !contagem.scheduled) return 'finished';
  return 'pending';
}

function resumoBr(cfg, dados) {
  return {
    id: cfg.sportscore,
    nome: cfg.nome || dados.titulo,
    tituloFonte: dados.titulo,
    cidade: cfg.cidade,
    local: cfg.local ?? dados.clubes.map((c) => c.rotulo).join(', '),
    inicio: cfg.inicio ?? dados.datas[0]?.valor ?? null,
    fim: cfg.fim ?? dados.datas.at(-1)?.valor ?? null,
    destaque: !!cfg.destaque,
    premio: cfg.premio ?? null,
    links: cfg.links ?? [],
    ondeAssistir: cfg.ondeAssistir ?? [],
    publicado: dados.publicado,
    status: statusDoTorneio(cfg, dados),
    jogos: contarStatus(dados.jogos),
    totalJogos: dados.jogos.length,
  };
}

export function criarRotas(token) {
  const fonte = criarFonte(token);

  async function torneiosAtuaisEFuturos() {
    const lista = await fonte.torneios({
      after_date: hojeISO(),
      level: NIVEIS_PRINCIPAIS.join(','),
      sort_by: 'start_date',
      order_by: 'asc',
      per_page: 30,
    });
    return lista.filter((t) => t.status !== 'cancelled');
  }

  async function rotaTorneios() {
    const regras = await carregarRegrasTransmissao();
    const lista = await torneiosAtuaisEFuturos();
    return lista.map((t) => ({ ...resumoTorneio(t), ondeAssistir: canaisPara(regras, t, null) }));
  }

  async function rotaAgenda() {
    const regras = await carregarRegrasTransmissao();
    const torneios = await torneiosAtuaisEFuturos();
    const emAndamento = torneios.filter((t) => t.status === 'live' && NIVEIS_PREMIER.includes(t.level));
    const jogos = [];
    for (const t of emAndamento.slice(0, 2)) {
      const partidas = await fonte.jogosDoTorneio(t.id, { sort_by: 'played_at', order_by: 'desc', per_page: 50 });
      for (const m of partidas.filter(disputado)) {
        if (['scheduled', 'live'].includes(m.status) || m.played_at === hojeISO()) {
          jogos.push(montarJogo(m, t, regras));
        }
      }
    }
    const proximos = torneios.filter((t) => t.status === 'pending').slice(0, 3);
    return {
      emAndamento: emAndamento.map(resumoTorneio),
      proximosTorneios: proximos.map((t) => ({ ...resumoTorneio(t), ondeAssistir: canaisPara(regras, t, null) })),
      jogos,
    };
  }

  async function rotaResultados() {
    const regras = await carregarRegrasTransmissao();
    const recentes = await fonte.torneios({
      before_date: hojeISO(),
      level: NIVEIS_PREMIER.join(','),
      sort_by: 'start_date',
      order_by: 'desc',
      per_page: 4,
    });
    const alvo = recentes.filter((t) => ['live', 'finished'].includes(t.status)).slice(0, 2);
    const jogos = [];
    for (const t of alvo) {
      // ordenado por rodada: final, semis, quartas... cabe numa página só
      const partidas = await fonte.jogosDoTorneio(t.id, { sort_by: 'round', order_by: 'asc', per_page: 50 });
      for (const m of partidas.filter(disputado)) {
        if (m.winner) jogos.push(montarJogo(m, t, regras));
      }
    }
    return { torneios: alvo.map(resumoTorneio), jogos };
  }

  async function rotaRanking(url) {
    const categoria = url.searchParams.get('categoria') === 'women' ? 'women' : 'men';
    const linhas = await fonte.ranking({ type: 'official', category: categoria, per_page: 50 });
    return linhas.map((r) => ({
      posicao: r.ranking,
      variacao: r.ranking_diff,
      nome: r.name,
      pais: r.nationality,
      pontos: r.points,
      data: r.date,
    }));
  }

  async function rotaBrTorneios() {
    const lista = await torneiosBrConfigurados();
    const resultados = await Promise.allSettled(lista.map((cfg) => torneioSportScore(cfg.sportscore)));
    return lista
      .map((cfg, i) => {
        const r = resultados[i];
        if (r.status === 'rejected') return { ...resumoBr(cfg, { titulo: null, publicado: false, clubes: [], datas: [], jogos: [] }), erro: r.reason.message };
        return resumoBr(cfg, r.value);
      })
      .sort((a, b) => {
        const ordem = { live: 0, pending: 1, finished: 2 };
        return b.destaque - a.destaque || ordem[a.status] - ordem[b.status] || (a.inicio ?? '').localeCompare(b.inicio ?? '');
      });
  }

  async function rotaBrTorneio(url) {
    const id = url.searchParams.get('id');
    if (!/^\d{1,6}$/.test(id ?? '')) throw Object.assign(new Error('Informe ?id= com o número do torneio no SportScore'), { status: 400 });
    const cfg = (await torneiosBrConfigurados()).find((t) => String(t.sportscore) === id) ?? { sportscore: Number(id) };
    const dados = await torneioSportScore(id, { anoReferencia: cfg.inicio ? Number(cfg.inicio.slice(0, 4)) : undefined });
    const clubeUnico = dados.clubes.length === 1 ? dados.clubes[0].rotulo : null;
    return {
      torneio: resumoBr(cfg, dados),
      categorias: dados.categorias.map((c) => c.rotulo),
      jogos: dados.jogos.map((j) => ({
        id: j.id,
        data: j.data,
        hora: j.hora,
        inicio: j.inicio,
        clube: j.clube ?? clubeUnico,
        quadra: j.quadra,
        categoria: j.categoria,
        chave: j.chave,
        duracao: j.duracao,
        status: j.status,
        vencedor: j.vencedor,
        dupla1: j.duplas[0],
        dupla2: j.duplas[1],
      })),
    };
  }

  return {
    modo: fonte.modo,
    rotas: {
      '/dados/br/torneios': rotaBrTorneios,
      '/dados/br/torneio': rotaBrTorneio,
      '/dados/status': async () => ({ modo: fonte.modo, hoje: hojeISO() }),
      '/dados/torneios': rotaTorneios,
      '/dados/agenda': rotaAgenda,
      '/dados/resultados': rotaResultados,
      '/dados/ranking': rotaRanking,
    },
  };
}
