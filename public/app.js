// Front do Pádel Agora: busca os dados e desenha as abas.
// Dois modos: "servidor" (server.js local, rotas /dados/*) e "estatico" (GitHub Pages,
// arquivos dados/*.json gerados por scripts/gerar-site.js a cada 15 minutos).
const FUSO_BR = 'America/Sao_Paulo';
const ATUALIZA_AGENDA_MS = 2 * 60_000;
const ESTATICO = document.querySelector('meta[name="modo-dados"]')?.content === 'estatico';

// caminho lógico ('/ranking', 'women') -> URL do modo atual
function endereco(caminho, valor) {
  if (ESTATICO) return `dados${caminho}${valor ? `-${valor}` : ''}.json`;
  const parametro = { '/ranking': 'categoria', '/br/torneio': 'id' }[caminho];
  return `/dados${caminho}${valor ? `?${parametro}=${encodeURIComponent(valor)}` : ''}`;
}

const NIVEIS = {
  major: 'Major', p1: 'P1', p2: 'P2', finals: 'Finals',
  fip_platinum: 'FIP Platinum', fip_gold: 'FIP Gold',
};
const RODADAS = { 0: 'Fase de grupos', 1: 'Final', 2: 'Semifinal', 4: 'Quartas', 8: 'Oitavas', 16: 'Rodada de 32', 32: 'Rodada de 64' };
const STATUS = {
  scheduled: 'Agendado', live: 'Ao vivo', ended: 'Encerrado', finished: 'Encerrado',
  retired: 'Abandono', walkover: 'W.O.', bye: 'Bye', not_played: 'Não disputado',
  pending: 'Em breve', cancelled: 'Cancelado', postponed: 'Adiado',
};
const CATEGORIAS = { men: 'Masculino', women: 'Feminino' };

const estado = {
  aba: 'agenda', categoria: 'todos', cache: {}, timer: null,
  br: { torneio: null, categoria: '', status: 'todos', busca: '' },
};
const $conteudo = document.getElementById('conteudo');
const $filtros = document.getElementById('filtros');
const $atualizado = document.getElementById('atualizado');

// ---------- utilidades ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Imagem e não emoji: o Windows não desenha bandeira em emoji
function bandeira(pais) {
  if (!/^[A-Za-z]{2}$/.test(pais ?? '')) return '';
  const cc = pais.toLowerCase();
  return `<img class="bandeira" src="https://flagcdn.com/20x15/${cc}.png" srcset="https://flagcdn.com/40x30/${cc}.png 2x" width="20" height="15" alt="${cc.toUpperCase()}" loading="lazy">`;
}

// Diferença (ms) entre o relógio de um fuso e o UTC num dado instante
function deslocamentoFuso(fuso, instante) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instante).map((p) => [p.type, p.value]),
  );
  const comoUtc = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second);
  return comoUtc - instante;
}

// A API manda horário de Madri; sem fuso explícito, interpreta como Europe/Madrid
function horarioMadriParaData(texto) {
  if (!texto) return null;
  if (/([zZ]|[+-]\d\d:?\d\d)$/.test(texto)) return new Date(texto);
  const m = texto.match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?/);
  if (!m) return null;
  const palpite = Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6] ?? 0);
  return new Date(palpite - deslocamentoFuso('Europe/Madrid', palpite));
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BR, hour: '2-digit', minute: '2-digit' });
const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BR, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' });

const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BR }).format(d);
const dataSemFuso = (iso) => new Date(iso + 'T12:00:00Z');

function textoHorario(jogo) {
  if (jogo.status === 'live') return 'Em quadra agora';
  const quando = horarioMadriParaData(jogo.horarioMadri);
  if (quando) {
    const hoje = diaISO(new Date()) === diaISO(quando);
    const rotulo = jogo.rotuloHorario?.toLowerCase() ?? '';
    const prefixo = rotulo.startsWith('not before') ? 'não antes de ' : rotulo.startsWith('estimated') ? '~' : '';
    return `${prefixo}${hoje ? fmtHora.format(quando) : fmtDiaHora.format(quando)} <small>Brasília</small>`;
  }
  if (jogo.rotuloHorario?.toLowerCase().startsWith('followed')) return 'Na sequência';
  if (jogo.data) return `${fmtDia.format(dataSemFuso(jogo.data))} <small>horário a definir</small>`;
  return '<small>Horário a definir</small>';
}

function periodo(inicio, fim) {
  return `${fmtDiaCurto.format(dataSemFuso(inicio))} – ${fmtDiaCurto.format(dataSemFuso(fim))}`;
}

// ---------- pedaços de tela ----------

function htmlCanais(canais) {
  if (!canais?.length) return '<span class="local">Transmissão não informada</span>';
  return `<div class="canais">${canais
    .map((c) => `<a class="canal ${c.tipo === 'grátis' ? 'gratis' : ''}" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.tipo)}">${esc(c.nome)}</a>`)
    .join('')}</div>`;
}

function htmlDupla(jogadores, cabeca, sets, lado, venceu) {
  const nomes = jogadores.length
    ? jogadores.map((j) => `<div>${bandeira(j.pais)} ${esc(j.nome)}</div>`).join('')
    : '<div class="a-definir">A definir</div>';
  const placar = (sets ?? []).map((s) => `<span>${esc(s[lado])}</span>`).join('');
  return `<div class="dupla ${venceu ? 'venceu' : ''}">
    <span class="cabeca">${cabeca ? esc(cabeca) : ''}</span>
    <div class="nomes">${nomes}</div>
    <div class="sets">${placar}</div>
  </div>`;
}

function htmlJogo(j, { mostrarTorneio = false } = {}) {
  const vivo = j.status === 'live';
  const rodada = RODADAS[j.rodada] ?? j.nomeRodada ?? '';
  const quadra = j.quadra ? ` · ${esc(j.quadra)}` : '';
  return `<article class="jogo ${vivo ? 'vivo' : ''}">
    <div class="jogo-topo">
      <span>${esc(CATEGORIAS[j.categoria] ?? '')} · ${esc(rodada)}${quadra}${mostrarTorneio ? ` · ${esc(j.torneio.cidade)}` : ''}</span>
      <span class="status ${vivo ? 'vivo' : ''}">${esc(STATUS[j.status] ?? j.status)}</span>
    </div>
    ${htmlDupla(j.dupla1, j.cabecas?.team_1, j.placar, 'team_1', j.vencedor === 'team_1')}
    ${htmlDupla(j.dupla2, j.cabecas?.team_2, j.placar, 'team_2', j.vencedor === 'team_2')}
    <div class="jogo-rodape">
      <span class="horario">${j.status === 'scheduled' || vivo ? textoHorario(j) : j.duracao ? `Duração ${esc(j.duracao)}` : ''}</span>
      ${j.status === 'scheduled' || vivo ? htmlCanais(j.ondeAssistir) : ''}
    </div>
  </article>`;
}

function htmlCabTorneio(t) {
  return `<div class="torneio-cab">
    <h3>${esc(t.nome)}</h3>
    ${t.nivel ? `<span class="nivel">${esc(NIVEIS[t.nivel] ?? t.nivel)}</span>` : ''}
    <span class="local">${bandeira(t.pais)} ${esc(t.cidade)}${t.inicio ? ` · ${periodo(t.inicio, t.fim)}` : ''}</span>
  </div>`;
}

function htmlCartaoTorneio(t) {
  return `<article class="cartao-torneio ${t.status === 'live' ? 'vivo' : ''}">
    <div class="torneio-cab" style="margin:0">
      <h3>${esc(t.nome)}</h3>
      <span class="nivel">${esc(NIVEIS[t.nivel] ?? t.nivel)}</span>
    </div>
    <div class="datas">${periodo(t.inicio, t.fim)} <span class="status ${t.status === 'live' ? 'vivo' : ''}">· ${esc(STATUS[t.status] ?? t.status)}</span></div>
    <div class="local">${bandeira(t.pais)} ${esc(t.cidade)}${t.local ? ` · ${esc(t.local)}` : ''}</div>
    ${htmlCanais(t.ondeAssistir)}
  </article>`;
}

const filtrarCategoria = (jogos) => (estado.categoria === 'todos' ? jogos : jogos.filter((j) => j.categoria === estado.categoria));

function agruparPorTorneio(jogos) {
  const grupos = new Map();
  for (const j of jogos) {
    if (!grupos.has(j.torneio.id)) grupos.set(j.torneio.id, { torneio: j.torneio, jogos: [] });
    grupos.get(j.torneio.id).jogos.push(j);
  }
  return [...grupos.values()];
}

// ---------- abas ----------

function ordemAgenda(a, b) {
  const peso = { live: 0, scheduled: 1 };
  const pa = peso[a.status] ?? 2;
  const pb = peso[b.status] ?? 2;
  if (pa !== pb) return pa - pb;
  const ta = horarioMadriParaData(a.horarioMadri)?.getTime() ?? Infinity;
  const tb = horarioMadriParaData(b.horarioMadri)?.getTime() ?? Infinity;
  return ta - tb || (a.ordemQuadra ?? 99) - (b.ordemQuadra ?? 99);
}

// Rodadas futuras sem dupla definida viram uma linha ("Semifinal: sex., 30 de out.")
function htmlRodadasFuturas(jogos) {
  const vistas = new Map();
  for (const j of jogos) {
    const chave = `${j.rodada}|${j.data}`;
    if (!vistas.has(chave)) vistas.set(chave, j);
  }
  const itens = [...vistas.values()]
    .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))
    .map((j) => `${esc(RODADAS[j.rodada] ?? j.nomeRodada)}: ${j.data ? fmtDia.format(dataSemFuso(j.data)) : 'a definir'}`);
  return itens.length ? `<p class="local futuras">Depois: ${itens.join(' · ')}</p>` : '';
}

function desenharAgenda(d) {
  const todos = filtrarCategoria(d.jogos).sort(ordemAgenda);
  const semDupla = (j) => !j.dupla1.length && !j.dupla2.length;
  let html = '';
  if (todos.length) {
    for (const g of agruparPorTorneio(todos)) {
      const definidos = g.jogos.filter((j) => !semDupla(j));
      html += htmlCabTorneio(g.torneio)
        + `<div class="grade">${definidos.map((j) => htmlJogo(j)).join('')}</div>`
        + htmlRodadasFuturas(g.jogos.filter(semDupla));
    }
  } else {
    html += `<div class="vazio">Nenhum jogo do circuito principal hoje${estado.categoria !== 'todos' ? ' nessa categoria' : ''}.</div>`;
  }
  if (d.proximosTorneios.length) {
    html += `<h2 class="secao">Próximos torneios</h2><div class="grade">${d.proximosTorneios.map(htmlCartaoTorneio).join('')}</div>`;
  }
  return html;
}

function desenharResultados(d) {
  const jogos = filtrarCategoria(d.jogos);
  if (!jogos.length) return '<div class="vazio">Sem resultados recentes.</div>';
  return agruparPorTorneio(jogos)
    .map((g) => htmlCabTorneio(g.torneio) + `<div class="grade">${g.jogos.map((j) => htmlJogo(j)).join('')}</div>`)
    .join('');
}

function desenharCalendario(lista) {
  if (!lista.length) return '<div class="vazio">Nenhum torneio no calendário.</div>';
  return `<div class="grade">${lista.map(htmlCartaoTorneio).join('')}</div>`;
}

function desenharRanking(linhas) {
  if (!linhas.length) return '<div class="vazio">Ranking indisponível.</div>';
  const seta = (v) => (typeof v !== 'number' || v === 0 ? '–' : v > 0 ? `<span class="sobe">▲ ${v}</span>` : `<span class="desce">▼ ${-v}</span>`);
  const pontos = (p) => (typeof p === 'number' ? p.toLocaleString('pt-BR') : '—');
  return `<table class="ranking">
    <thead><tr><th>#</th><th>Jogador(a)</th><th class="num">Pontos</th><th class="num">Semana</th></tr></thead>
    <tbody>${linhas
      .map((r) => `<tr><td>${esc(r.posicao)}</td><td>${bandeira(r.pais)} ${esc(r.nome)}</td><td class="num">${pontos(r.pontos)}</td><td class="num">${seta(r.variacao)}</td></tr>`)
      .join('')}</tbody>
  </table>`;
}

// ---------- Brasil (SportScore) ----------

const STATUS_BR = { live: 'Em andamento', pending: 'Em breve', finished: 'Encerrado' };
const FILTROS_STATUS = [['todos', 'Todos'], ['live', 'Em quadra'], ['scheduled', 'Próximos'], ['finished', 'Encerrados']];
const fmtDiaBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' });

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function periodoBr(t) {
  if (!t.inicio) return 'Datas a confirmar';
  return t.inicio === t.fim ? fmtDiaCurto.format(dataSemFuso(t.inicio)) : periodo(t.inicio, t.fim);
}

function htmlLinks(links) {
  return links?.length
    ? `<div class="canais">${links.map((l) => `<a class="canal" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nome)}</a>`).join('')}</div>`
    : '';
}

function htmlCartaoBr(t) {
  const resumo = !t.publicado
    ? 'Tabela de jogos ainda não publicada'
    : `${t.totalJogos} jogos${t.jogos.finished ? ` · ${t.jogos.finished} encerrados` : ''}${t.jogos.live ? ` · <strong class="status vivo">${t.jogos.live} em quadra</strong>` : ''}`;
  return `<article class="cartao-torneio ${t.status === 'live' ? 'vivo' : ''} ${t.destaque ? 'destaque' : ''}">
    <div class="torneio-cab" style="margin:0">
      <h3>${esc(t.nome)}</h3>
      ${t.premio ? `<span class="nivel">${esc(t.premio)}</span>` : ''}
    </div>
    <div class="datas">${periodoBr(t)} <span class="status ${t.status === 'live' ? 'vivo' : ''}">· ${esc(STATUS_BR[t.status])}</span></div>
    <div class="local">${[t.cidade, t.local].filter(Boolean).map(esc).join(' · ')}</div>
    <div class="local">${resumo}</div>
    ${htmlLinks(t.links)}
    ${t.publicado ? `<button type="button" class="botao-primario" data-br-id="${t.id}">Ver jogos →</button>` : ''}
  </article>`;
}

function desenharBrLista(lista) {
  if (!lista.length) return '<div class="vazio">Nenhum torneio cadastrado em data/torneios-br.json.</div>';
  return `<h2 class="secao">Torneios no Brasil</h2>
    <div class="grade">${lista.map(htmlCartaoBr).join('')}</div>
    <p class="nota">Jogos e resultados vêm do SportScore, o sistema que os organizadores usam. Horários são os do clube.</p>`;
}

function marcar(nome) {
  const termo = semAcento(estado.br.busca).trim();
  if (!termo || !semAcento(nome).includes(termo)) return esc(nome);
  return `<mark>${esc(nome)}</mark>`;
}

function htmlDuplaBr(dupla, adversaria, venceu) {
  const nomes = dupla.jogadores.length
    ? dupla.jogadores.map((n) => `<div>${marcar(n)}</div>`).join('')
    : '<div class="a-definir">A definir</div>';
  return `<div class="dupla ${venceu ? 'venceu' : ''}">
    <span class="cabeca"></span>
    <div class="nomes">${nomes}</div>
    <div class="sets">${dupla.sets.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
  </div>`;
}

function htmlJogoBr(j) {
  const vivo = j.status === 'live';
  const onde = [j.categoria, j.chave && `Chave ${j.chave}`, j.clube, j.quadra && `Quadra ${j.quadra}`].filter(Boolean).map(esc).join(' · ');
  const rotuloStatus = { live: 'Em quadra', scheduled: 'Agendado', finished: 'Encerrado' }[j.status];
  const rodape = j.status === 'finished'
    ? [j.inicio && `Começou ${esc(j.inicio)}`, j.duracao && esc(j.duracao)].filter(Boolean).join(' · ')
    : `${esc(j.hora ?? 'Horário a definir')}`;
  return `<article class="jogo ${vivo ? 'vivo' : ''}">
    <div class="jogo-topo"><span>${onde}</span><span class="status ${vivo ? 'vivo' : ''}">${rotuloStatus}</span></div>
    ${htmlDuplaBr(j.dupla1, j.dupla2, j.vencedor === 1)}
    ${htmlDuplaBr(j.dupla2, j.dupla1, j.vencedor === 2)}
    <div class="jogo-rodape"><span class="horario">${rodape}</span><small class="local">Jogo ${esc(j.id)}</small></div>
  </article>`;
}

function filtrarJogosBr(jogos) {
  const termo = semAcento(estado.br.busca).trim();
  return jogos.filter((j) =>
    (!estado.br.categoria || j.categoria === estado.br.categoria)
    && (estado.br.status === 'todos' || j.status === estado.br.status)
    && (!termo || [...j.dupla1.jogadores, ...j.dupla2.jogadores].some((n) => semAcento(n).includes(termo))));
}

function htmlListaBr(d) {
  const jogos = filtrarJogosBr(d.jogos).sort((a, b) =>
    (a.data ?? '').localeCompare(b.data ?? '') || (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id, undefined, { numeric: true }));
  if (!jogos.length) return '<div class="vazio">Nenhum jogo com esses filtros.</div>';
  const porDia = new Map();
  for (const j of jogos) {
    if (!porDia.has(j.data)) porDia.set(j.data, []);
    porDia.get(j.data).push(j);
  }
  return [...porDia.entries()]
    .map(([dia, lista]) => `<h2 class="secao">${dia ? fmtDiaBr.format(dataSemFuso(dia)) : 'Sem data'} · ${lista.length} jogos</h2>
      <div class="grade">${lista.map(htmlJogoBr).join('')}</div>`)
    .join('');
}

function desenharBrTorneio(d) {
  const t = d.torneio;
  const conta = { todos: d.jogos.length, live: 0, scheduled: 0, finished: 0 };
  d.jogos.forEach((j) => conta[j.status]++);
  return `<button type="button" class="voltar" data-br-voltar>← Torneios no Brasil</button>
    ${htmlCabTorneio({ nome: t.nome, nivel: null, pais: 'BR', cidade: [t.cidade, t.local].filter(Boolean).join(' · '), inicio: t.inicio, fim: t.fim })}
    ${t.tituloFonte && t.tituloFonte !== t.nome ? `<p class="local">No SportScore: ${esc(t.tituloFonte)}</p>` : ''}
    ${htmlLinks(t.links)}
    <div class="filtros-br">
      <select data-br-categoria aria-label="Categoria">
        <option value="">Todas as categorias</option>
        ${d.categorias.map((c) => `<option ${c === estado.br.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <div class="chips">${FILTROS_STATUS.map(([v, r]) => `<button type="button" data-br-status="${v}" aria-pressed="${estado.br.status === v}">${r} <small>${conta[v]}</small></button>`).join('')}</div>
      <input type="search" data-br-busca placeholder="Procura teu nome ou da tua dupla" value="${esc(estado.br.busca)}">
    </div>
    <div id="lista-br">${htmlListaBr(d)}</div>`;
}

const ABAS = {
  agenda: { url: () => endereco('/agenda'), desenhar: desenharAgenda, filtro: 'todos' },
  resultados: { url: () => endereco('/resultados'), desenhar: desenharResultados, filtro: 'todos' },
  calendario: { url: () => endereco('/torneios'), desenhar: desenharCalendario, filtro: null },
  ranking: {
    url: () => endereco('/ranking', estado.categoria === 'women' ? 'women' : 'men'),
    desenhar: desenharRanking,
    filtro: 'sem-todos',
  },
  brasil: {
    url: () => (estado.br.torneio ? endereco('/br/torneio', estado.br.torneio) : endereco('/br/torneios')),
    desenhar: (d) => (estado.br.torneio ? desenharBrTorneio(d) : desenharBrLista(d)),
    filtro: null,
  },
};

// ---------- fluxo ----------

async function buscar(url) {
  // no-cache: o Pages guarda os JSON por 10 min; assim o navegador sempre confere se mudou
  const resp = await fetch(url, { cache: 'no-cache' });
  const corpo = await resp.json();
  if (!resp.ok) throw new Error(corpo.erro ?? `Erro ${resp.status}`);
  return corpo;
}

function ajustarFiltros() {
  const tipo = ABAS[estado.aba].filtro;
  $filtros.querySelector('[data-cat="todos"]').hidden = tipo !== 'todos';
  $filtros.querySelectorAll('[data-cat="men"],[data-cat="women"]').forEach((b) => (b.hidden = tipo === null));
  if (tipo === 'sem-todos' && estado.categoria === 'todos') estado.categoria = 'men';
  $filtros.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === estado.categoria)));
}

async function mostrar({ silencioso = false } = {}) {
  const aba = ABAS[estado.aba];
  ajustarFiltros();
  const url = aba.url();
  if (!silencioso && !estado.cache[url]) $conteudo.innerHTML = '<div class="carregando">Carregando…</div>';
  if (estado.cache[url]) $conteudo.innerHTML = aba.desenhar(estado.cache[url]);
  try {
    const dados = await buscar(url);
    estado.cache[url] = dados;
    if (aba === ABAS[estado.aba] && url === ABAS[estado.aba].url()) {
      const lista = document.getElementById('lista-br');
      // atualização automática na tela de um torneio: só a lista, sem perder o que está digitado na busca
      if (silencioso && lista && estado.br.torneio) lista.innerHTML = htmlListaBr(dados);
      else $conteudo.innerHTML = aba.desenhar(dados);
      $atualizado.textContent = ESTATICO && estado.geradoEm
        ? `Dados de ${fmtHora.format(new Date(estado.geradoEm))}`
        : `Atualizado ${fmtHora.format(new Date())}`;
    }
  } catch (erro) {
    if (!estado.cache[url]) $conteudo.innerHTML = `<div class="erro">Não consegui carregar: ${esc(erro.message)}</div>`;
  }
}

document.querySelector('.abas').addEventListener('click', (e) => {
  const botao = e.target.closest('[data-aba]');
  if (!botao) return;
  estado.aba = botao.dataset.aba;
  document.querySelectorAll('.abas button').forEach((b) => b.setAttribute('aria-selected', String(b === botao)));
  mostrar();
});

$filtros.addEventListener('click', (e) => {
  const botao = e.target.closest('[data-cat]');
  if (!botao) return;
  estado.categoria = botao.dataset.cat;
  mostrar();
});

// Aba Brasil: abrir torneio, voltar e filtros (refiltra o que já está em memória)
const dadosBrAtuais = () => estado.cache[ABAS.brasil.url()];
const refiltrarBr = () => {
  const d = dadosBrAtuais();
  const lista = document.getElementById('lista-br');
  if (d && lista) lista.innerHTML = htmlListaBr(d);
};

$conteudo.addEventListener('click', (e) => {
  const abrir = e.target.closest('[data-br-id]');
  if (abrir) {
    estado.br = { torneio: abrir.dataset.brId, categoria: '', status: 'todos', busca: '' };
    window.scrollTo({ top: 0 });
    return mostrar();
  }
  if (e.target.closest('[data-br-voltar]')) {
    estado.br.torneio = null;
    return mostrar();
  }
  const chip = e.target.closest('[data-br-status]');
  if (chip) {
    estado.br.status = chip.dataset.brStatus;
    document.querySelectorAll('[data-br-status]').forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
    refiltrarBr();
  }
});

$conteudo.addEventListener('input', (e) => {
  if (e.target.matches('[data-br-busca]')) {
    estado.br.busca = e.target.value;
    refiltrarBr();
  }
  if (e.target.matches('[data-br-categoria]')) {
    estado.br.categoria = e.target.value;
    refiltrarBr();
  }
});

// No Pages o status também diz de quando são os dados ("Dados de 21:15")
const atualizarStatus = () => buscar(endereco('/status')).then((s) => {
  estado.geradoEm = s.geradoEm ?? null;
  return s;
});

const statusPronto = atualizarStatus()
  .then((s) => {
    if (s.modo === 'demo') {
      const aviso = document.getElementById('aviso-modo');
      aviso.hidden = false;
      aviso.innerHTML = '<strong>Modo demonstração:</strong> dados fictícios. Coloque teu token da Padel API no arquivo <code>.env</code> e reinicie o servidor para ver os jogos de verdade.';
    }
  })
  .catch(() => {});

// No Pages espera o status para já mostrar "Dados de HH:MM" na primeira tela
if (ESTATICO) statusPronto.then(() => mostrar());
else mostrar();
estado.timer = setInterval(async () => {
  if (!['agenda', 'brasil'].includes(estado.aba)) return;
  if (ESTATICO) await atualizarStatus().catch(() => {});
  mostrar({ silencioso: true });
}, ATUALIZA_AGENDA_MS);
