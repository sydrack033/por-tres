// Resumo e jogos de um torneio brasileiro (SportScore) no formato que o front lê.
// Só lógica, sem disco nem Node: usado pelas rotas do servidor/gerador (src/rotas.js) e pelo
// Worker da busca (api/), que monta o torneio "de fora da lista" na hora com cfg = { sportscore: id }.
import { torneioSportScore } from './sportscore.js';

// "Hoje" no Brasil: em UTC, depois das 21h de Brasília já seria amanhã
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

// Torneio acontecendo hoje: confere a cada execução do robô. Fora disso, bem menos, para não
// ficar batendo no SportScore (sem data cadastrada conta como "ainda vai começar").
export function ttlBr(cfg) {
  const hoje = hojeISO();
  if (cfg.fim && cfg.fim < hoje) return 12 * 60 * 60_000;
  if (!cfg.inicio || cfg.inicio > hoje) return 60 * 60_000;
  return 3 * 60_000;
}

// ttl: quem chama pode forçar (o Worker usa sempre 3 minutos, igual ao cache dele)
export const buscarBr = (cfg, ttl = ttlBr(cfg)) =>
  torneioSportScore(cfg.sportscore, { anoReferencia: cfg.inicio ? Number(cfg.inicio.slice(0, 4)) : undefined, ttl });

export function contarStatus(jogos) {
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

export function resumoBr(cfg, dados) {
  return {
    id: cfg.sportscore,
    nome: cfg.nome || dados.titulo,
    tituloFonte: dados.titulo,
    cidade: cfg.cidade ?? null,
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

export function jogosBr(dados) {
  const clubeUnico = dados.clubes.length === 1 ? dados.clubes[0].rotulo : null;
  return dados.jogos.map((j) => ({
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
  }));
}

// O que vai em dados/br/torneio-<id>.json (e no /br/torneio do Worker)
export function detalheBr(cfg, dados) {
  return {
    torneio: resumoBr(cfg, dados),
    categorias: dados.categorias.map((c) => c.rotulo),
    jogos: jogosBr(dados),
  };
}
