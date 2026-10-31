// Monta os dados de cada rota /dados/*. Usado pelo servidor local (server.js) e pelo
// gerador do site estático (scripts/gerar-site.js), então os dois mostram exatamente a mesma coisa.
import { readFile } from 'node:fs/promises';
import { criarFonte } from './fonte.js';
import { canaisPara, carregarRegrasTransmissao } from './transmissao.js';
import { cacheSportScoreParaGuardar, carregarCacheSportScore, chamadasSportScore } from './sportscore.js';
import { buscarBr, detalheBr, hojeISO, jogosBr, resumoBr } from './brasil.js';

export { hojeISO };

// Níveis que interessam: circuito Premier Padel + FIP mais forte
const NIVEIS_PRINCIPAIS = ['major', 'p1', 'p2', 'finals', 'fip_platinum', 'fip_gold'];
const NIVEIS_PREMIER = ['major', 'p1', 'p2', 'finals'];

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

// Janela da aba Jogos: dá para voltar uns dias (resultados) e avançar umas semanas (programação)
const JANELA_ANTES = 10;
const JANELA_DEPOIS = 21;

function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// guardado: o que cacheParaGuardar() devolveu na execução anterior do robô (opcional)
export function criarRotas(token, guardado = {}) {
  const fonte = criarFonte(token, guardado.padel);
  carregarCacheSportScore(guardado.sportscore);

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

  // Quanto valem os jogos de um torneio: o que já acabou quase não muda.
  // Um dia de folga no fim: a final nas Américas termina depois da meia-noite de Brasília.
  function tipoJogos(t) {
    const hoje = hojeISO();
    if (t.status === 'finished' || t.end_date < somaDias(hoje, -1)) return 'jogosEncerrados';
    if (t.status === 'live' || t.start_date <= hoje) return 'jogos';
    return 'jogosFuturos';
  }

  // Todos os jogos de um torneio (Major tem ~126: até 3 páginas de 50)
  async function todosOsJogos(t) {
    const tipo = tipoJogos(t);
    const lista = [];
    for (let page = 1; page <= 4; page++) {
      const parte = await fonte.jogosDoTorneio(t.id, { sort_by: 'played_at', order_by: 'asc', per_page: 50, page }, tipo);
      lista.push(...parte);
      if (parte.length < 50) break;
    }
    return lista.filter(disputado);
  }

  // Aba Jogos: tudo de uma janela de dias (mundial + Brasil); o front filtra pelo dia escolhido
  async function rotaJogos() {
    const regras = await carregarRegrasTransmissao();
    const hoje = hojeISO();
    const de = somaDias(hoje, -JANELA_ANTES);
    const ate = somaDias(hoje, JANELA_DEPOIS);

    const torneios = (await fonte.torneios({
      after_date: de,
      before_date: ate,
      level: NIVEIS_PREMIER.join(','),
      sort_by: 'start_date',
      order_by: 'asc',
      per_page: 15,
    })).filter((t) => t.status === 'live' || t.status === 'finished' || (t.status === 'pending' && t.start_date <= somaDias(hoje, 3)));

    const mundial = [];
    for (const t of torneios) {
      for (const m of await todosOsJogos(t)) mundial.push(montarJogo(m, t, regras));
    }

    const configurados = await torneiosBrConfigurados();
    const brasil = [];
    for (const cfg of configurados) {
      if ((cfg.fim && cfg.fim < de) || (cfg.inicio && cfg.inicio > ate)) continue;
      try {
        const dados = await buscarBr(cfg);
        if (dados.jogos.length) brasil.push({ torneio: resumoBr(cfg, dados), jogos: jogosBr(dados) });
      } catch (erro) {
        console.error(`[jogos] SportScore ${cfg.sportscore}:`, erro.message);
      }
    }
    return { hoje, de, ate, mundial, brasil };
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
    const resultados = await Promise.allSettled(lista.map((cfg) => buscarBr(cfg)));
    return lista
      .map((cfg, i) => {
        const r = resultados[i];
        if (r.status === 'rejected') return { ...resumoBr(cfg, { titulo: null, publicado: false, clubes: [], datas: [], jogos: [] }), erro: r.reason.message };
        return resumoBr(cfg, r.value);
      })
      .sort((a, b) => {
        const ordem = { live: 0, pending: 1, finished: 2 };
        // sem data ainda vai para o fim
        return b.destaque - a.destaque || ordem[a.status] - ordem[b.status] || (a.inicio ?? '9999').localeCompare(b.inicio ?? '9999');
      });
  }

  async function rotaBrTorneio(url) {
    const id = url.searchParams.get('id');
    if (!/^\d{1,6}$/.test(id ?? '')) throw Object.assign(new Error('Informe ?id= com o número do torneio no SportScore'), { status: 400 });
    const cfg = (await torneiosBrConfigurados()).find((t) => String(t.sportscore) === id) ?? { sportscore: Number(id) };
    return detalheBr(cfg, await buscarBr(cfg));
  }

  return {
    modo: fonte.modo,
    // o robô do site guarda isto até a próxima execução e conta o que gastou
    cacheParaGuardar: () => ({ padel: fonte.paraGuardar(), sportscore: cacheSportScoreParaGuardar() }),
    chamadas: () => ({ padel: fonte.chamadasFeitas(), sportscore: chamadasSportScore() }),
    rotas: {
      '/dados/jogos': rotaJogos,
      '/dados/br/torneios': rotaBrTorneios,
      '/dados/br/torneio': rotaBrTorneio,
      '/dados/status': async () => ({ modo: fonte.modo, hoje: hojeISO() }),
      '/dados/torneios': rotaTorneios,
      '/dados/ranking': rotaRanking,
    },
  };
}
