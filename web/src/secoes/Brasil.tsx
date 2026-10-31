// Aba Brasil: torneios do SportScore (Liga Brasileira, circuitos de clube...).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, Search, Star, Trophy, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Aviso, CabecalhoTorneio, Canais, Carregando, ColunaHora, LinhaDupla, NomeJogador, nomeCurto, PlayerYouTube, registrar, type InfoHora } from '@/components/partes';
import { MenuAcoes, Seguir } from '@/components/acoes';
import { inicioBr } from '@/lib/compartilhar';
import { irPara, linkDaRota } from '@/lib/rota';
import { chaveTorneio, useSeguindo } from '@/lib/seguindo';
import { useDados, type Canal, type JogoBr, type TorneioBr, type TorneioBrDetalhe } from '@/lib/dados';
import { API_LIGADA, MINIMO_BUSCA, useAtrasado, useBuscaSportScore, useTorneioExterno, type TorneioExterno } from '@/lib/api';
import { diaLongo, periodo, rotuloDia, semAcento } from '@/lib/formato';
import { cn } from '@/lib/utils';

const STATUS_TORNEIO = { live: 'Em andamento', pending: 'Em breve', finished: 'Encerrado' } as const;

function SeloStatus({ status }: { status: TorneioBr['status'] }) {
  return (
    <Badge
      variant="outline"
      className={cn(status === 'live' && 'border-vivo/40 bg-vivo/10 text-vivo', status === 'finished' && 'text-muted-foreground')}
    >
      {STATUS_TORNEIO[status]}
    </Badge>
  );
}

function Links({ links }: { links: TorneioBr['links'] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          {l.nome}
          <ExternalLink className="size-3" />
        </a>
      ))}
    </div>
  );
}

// Busca da lista: nome, cidade e local, sem acento nem maiúscula
function filtrarTorneios(lista: TorneioBr[], busca: string) {
  const termo = semAcento(busca).trim();
  if (!termo) return lista;
  return lista.filter((t) => [t.nome, t.tituloFonte, t.cidade, t.local].some((c) => c && semAcento(c).includes(termo)));
}

function CampoBusca({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder="Procura um torneio, cidade ou clube"
        aria-label="Procurar torneio"
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onMudar('')}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

// Torneios que casam com a busca no SportScore mas não estão na lista do site
function OutrosTorneios({
  torneios,
  carregando,
  onAbrir,
}: {
  torneios: TorneioExterno[] | undefined;
  carregando: boolean;
  onAbrir: (t: TorneioExterno) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="px-1">
        <h2 className="font-display text-lg font-bold tracking-tight">Outros torneios no SportScore</h2>
        <p className="text-xs text-muted-foreground">Fora da nossa lista: os jogos vêm na hora do SportScore.</p>
      </div>
      {carregando ? (
        <Carregando linhas={2} />
      ) : !torneios?.length ? (
        <p className="px-1 text-sm text-muted-foreground">Nada além da lista no SportScore com esse nome.</p>
      ) : (
        <Card className="gap-0 divide-y overflow-hidden py-0">
          {torneios.map((t) => (
            <div key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium leading-snug">{t.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {[t.organizador, !t.temTabela && 'Tabela ainda não publicada'].filter(Boolean).join(' · ')}
                </p>
              </div>
              {t.temTabela ? (
                <Button size="sm" variant="outline" className="w-fit shrink-0" onClick={() => onAbrir(t)}>
                  Ver jogos <ChevronRight />
                </Button>
              ) : (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex w-fit shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Ver no SportScore <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

function ListaTorneiosBr({
  busca,
  onBusca,
  onAbrir,
  onAbrirExterno,
}: {
  busca: string;
  onBusca: (v: string) => void;
  onAbrir: (id: number) => void;
  onAbrirExterno: (t: TorneioExterno) => void;
}) {
  const { data, isPending, error } = useDados<TorneioBr[]>('/br/torneios', undefined, { aoVivo: true });
  const seguindo = useSeguindo();
  // Só busca no SportScore (e só conta no Umami) quando a pessoa para de digitar
  const termo = useAtrasado(busca.trim());
  const externa = useBuscaSportScore(termo);
  const buscaExterna = API_LIGADA && termo.length >= MINIMO_BUSCA;

  const filtrados = useMemo(() => filtrarTorneios(data ?? [], busca), [data, busca]);
  const deFora = useMemo(() => {
    const conhecidos = new Set((data ?? []).map((t) => t.id));
    return externa.data?.filter((t) => !conhecidos.has(t.id));
  }, [data, externa.data]);

  // Umami: o que o pessoal procura e quanto achou (para o dono decidir o que incluir na lista)
  const registrado = useRef('');
  useEffect(() => {
    if (!termo || !data || termo === registrado.current) return;
    if (buscaExterna && externa.isFetching) return; // espera o SportScore para contar
    registrado.current = termo;
    registrar('busca-br', { termo, naLista: filtrarTorneios(data, termo).length, noSportScore: buscaExterna ? (deFora?.length ?? 0) : 0 });
  }, [termo, data, buscaExterna, externa.isFetching, deFora]);

  const digitado = busca.trim();
  // Erro na API: a seção some sem aviso; a busca na lista segue funcionando
  const mostrarExterna = API_LIGADA && digitado.length >= MINIMO_BUSCA && !(digitado === termo && externa.isError);
  return (
    <div className="space-y-4">
      <CampoBusca valor={busca} onMudar={onBusca} />
      {isPending ? (
        <Carregando linhas={4} />
      ) : error ? (
        <Aviso tipo="erro">Não consegui carregar os torneios: {error.message}</Aviso>
      ) : !data.length && !digitado ? (
        <Aviso>Nenhum torneio cadastrado.</Aviso>
      ) : digitado && !filtrados.length ? (
        <Aviso>Nenhum torneio da lista com “{digitado}”.</Aviso>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtrados.map((t) => (
            <Card
              key={t.id}
              className={cn('gap-3 px-5 py-4', t.destaque && 'border-primary/50 ring-1 ring-primary/30')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold leading-tight tracking-tight">{t.nome}</h3>
                  <p className="text-sm text-muted-foreground">{[t.cidade, t.local].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <SeloStatus status={t.status} />
                  <Seguir
                    tipo="torneio"
                    rotulo={t.nome}
                    ativo={seguindo.segueTorneio(chaveTorneio('br', t.id))}
                    onAlternar={() => seguindo.alternarTorneio(chaveTorneio('br', t.id))}
                  />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{periodo(t.inicio, t.fim)}</span>
                {t.premio && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Trophy className="size-3.5" /> {t.premio}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {t.publicado
                    ? `${t.totalJogos} jogos${t.jogos.finished ? ` · ${t.jogos.finished} encerrados` : ''}`
                    : 'Tabela ainda não publicada'}
                </span>
                {t.jogos.live > 0 && <span className="font-medium text-vivo">{t.jogos.live} em quadra</span>}
              </div>
              <Links links={t.links} />
              {t.publicado && (
                <Button size="sm" className="w-fit" onClick={() => onAbrir(t.id)}>
                  Ver jogos <ChevronRight />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
      {API_LIGADA && digitado && digitado.length < MINIMO_BUSCA && (
        <p className="px-1 text-xs text-muted-foreground">Digita {MINIMO_BUSCA} letras ou mais para procurar também no SportScore.</p>
      )}
      {mostrarExterna && (
        <OutrosTorneios torneios={deFora} carregando={digitado !== termo || externa.isFetching} onAbrir={onAbrirExterno} />
      )}
      <p className="px-1 text-xs text-muted-foreground">
        Jogos e resultados vêm do SportScore, o sistema que os organizadores usam. Horários são os do clube.
      </p>
    </div>
  );
}

function infoHoraBr(j: JogoBr): InfoHora {
  if (j.status === 'live') return { tipo: 'vivo', hora: '', nota: j.inicio ? `desde ${j.inicio}` : undefined };
  if (j.status === 'finished') return { tipo: 'fim', hora: 'Fim', dia: rotuloDia(j.data) };
  if (j.hora) return { tipo: 'agendado', hora: j.hora, dia: rotuloDia(j.data) };
  return { tipo: 'indefinido', hora: '—', dia: rotuloDia(j.data), nota: 'a definir' };
}

function Destacar({ nome, busca }: { nome: string; busca: string }) {
  const termo = semAcento(busca).trim();
  if (!termo || !semAcento(nome).includes(termo)) return <NomeJogador nome={nome} sobrenome="ultimo" />;
  return <mark className="truncate rounded bg-bola px-0.5 text-black">{nome}</mark>;
}

// Link de um jogo: a tela do torneio já filtrada na categoria, com o jogo destacado
export const linkJogoBr = (torneioId: number, j: JogoBr) =>
  linkDaRota({ aba: 'brasil', torneio: torneioId, categoria: j.categoria ?? undefined, jogo: j.id });

// Mensagem do "Mandar no grupo"
function textoJogoBr(j: JogoBr, torneio: string) {
  const dupla = (d: JogoBr['dupla1']) => d.jogadores.map((n) => nomeCurto(n, 'ultimo')).join(' / ') || 'A definir';
  const placar = j.dupla1.sets.map((s, i) => `${s}-${j.dupla2.sets[i] ?? ''}`).join(' ');
  const onde = j.quadra ? `Quadra ${j.quadra}` : j.clube;
  const situacao =
    j.status === 'finished'
      ? `Resultado: ${placar}`
      : j.status === 'live'
        ? `Em quadra agora${onde ? ` · ${onde}` : ''}`
        : j.hora
          ? `${rotuloDia(j.data)} às ${j.hora}${onde ? ` · ${onde}` : ''}`
          : 'Horário a definir';
  return `🎾 ${torneio}${j.categoria ? ` · ${j.categoria}` : ''}${j.chave ? ` (chave ${j.chave})` : ''}\n${dupla(j.dupla1)} x ${dupla(j.dupla2)}\n${situacao}`;
}

// Evento de agenda de um jogo que ainda vai acontecer e já tem horário
export function agendaJogoBr(j: JogoBr, torneioId: number, torneio: string, local?: string | null) {
  const inicio = j.status === 'scheduled' ? inicioBr(j.data, j.hora) : null;
  if (!inicio) return null;
  const dupla = (d: JogoBr['dupla1']) => d.jogadores.map((n) => nomeCurto(n, 'ultimo')).join('/');
  return {
    id: `br-${torneioId}-${j.id}`,
    inicio,
    titulo: `${dupla(j.dupla1)} x ${dupla(j.dupla2)}${j.categoria ? ` · ${j.categoria}` : ''}`,
    local: [j.quadra ? `Quadra ${j.quadra}` : null, j.clube ?? local].filter(Boolean).join(' · '),
    descricao: textoJogoBr(j, torneio),
    link: linkJogoBr(torneioId, j),
  };
}

export function LinhaJogoBr({
  jogo: j, busca = '', canais = [], torneio = '', torneioId, local, destaque, ancora = true,
}: {
  jogo: JogoBr;
  busca?: string;
  canais?: Canal[];
  torneio?: string;
  torneioId: number;
  local?: string | null;
  destaque?: boolean; // veio por link direto: acende a linha
  ancora?: boolean; // false no "Teu próximo jogo": o link direto rola até a linha da lista, não até o cartão
}) {
  const seguindo = useSeguindo();
  const nomes = (d: JogoBr['dupla1']) => d.jogadores.map((n) => <Destacar nome={n} busca={busca} />);
  const estrela = (d: JogoBr['dupla1']) =>
    d.jogadores.length > 0 && (
      <Seguir
        tipo="dupla"
        rotulo={d.jogadores.join(' / ')}
        ativo={seguindo.segueDupla(d.jogadores)}
        onAlternar={() => seguindo.alternarDupla(d.jogadores)}
        className="-ml-1.5 -mr-1"
      />
    );
  const aindaVai = j.status === 'scheduled' || j.status === 'live';
  const agenda = agendaJogoBr(j, torneioId, torneio, local);
  return (
    <div
      id={ancora ? `jogo-br-${torneioId}-${j.id}` : undefined}
      className={cn('flex scroll-mt-40 gap-3 px-4 py-3 transition-colors duration-1000 sm:gap-4', destaque && 'bg-bola/15')}
    >
      <ColunaHora info={infoHoraBr(j)} />
      <div className="min-w-0 flex-1 space-y-1">
        <LinhaDupla nomes={nomes(j.dupla1)} sets={j.dupla1.sets} venceu={j.vencedor === 1} antes={estrela(j.dupla1)} />
        <LinhaDupla nomes={nomes(j.dupla2)} sets={j.dupla2.sets} venceu={j.vencedor === 2} antes={estrela(j.dupla2)} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span>{[j.categoria, j.chave && `Chave ${j.chave}`, j.quadra ? `Quadra ${j.quadra}` : j.clube].filter(Boolean).join(' · ')}</span>
          <span className="ml-auto flex items-center gap-2">
            {aindaVai && canais.length > 0 ? <Canais canais={canais} torneio={torneio} /> : <span>{[j.duracao, `Jogo ${j.id}`].filter(Boolean).join(' · ')}</span>}
            <MenuAcoes
              tipo="jogo"
              texto={textoJogoBr(j, torneio)}
              link={linkJogoBr(torneioId, j)}
              agenda={agenda ? [agenda] : undefined}
              arquivoAgenda={`jogo-${torneio}`}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

type FiltroStatus = 'todos' | 'meus' | JogoBr['status'];
const FILTROS: [FiltroStatus, string][] = [['todos', 'Todos'], ['live', 'Em quadra'], ['scheduled', 'Próximos'], ['finished', 'Encerrados'], ['meus', 'Meus']];

const nomesDoJogo = (j: JogoBr) => [...j.dupla1.jogadores, ...j.dupla2.jogadores];
const ordemJogo = (a: JogoBr, b: JogoBr) =>
  (a.data ?? '').localeCompare(b.data ?? '') || (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id, undefined, { numeric: true });

// Destaca o jogo que veio por link direto: rola até ele e acende a linha por uns segundos
function useDestaque(alvo: string | undefined, pronto: boolean) {
  const [aceso, setAceso] = useState(alvo);
  useEffect(() => {
    if (!alvo || !pronto) return;
    const el = document.getElementById(alvo);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setAceso(alvo);
    const t = setTimeout(() => setAceso(undefined), 4000);
    return () => clearTimeout(t);
  }, [alvo, pronto]);
  return aceso;
}

// externo: torneio de fora da lista (achado na busca ou aberto por link); os dados vêm na hora pelo Worker (api/)
function TorneioBrView({
  id, externo, categoriaInicial, jogoInicial, onVoltar,
}: {
  id: number;
  externo?: TorneioExterno;
  categoriaInicial?: string;
  jogoInicial?: string;
  onVoltar: () => void;
}) {
  const daLista = useDados<TorneioBrDetalhe>('/br/torneio', String(id), { aoVivo: true, ativo: !externo });
  const deFora = useTorneioExterno(id, { ativo: !!externo });
  const { data, isPending, error } = externo ? deFora : daLista;
  const seguindo = useSeguindo();
  const [categoria, setCategoriaLocal] = useState(categoriaInicial ?? 'todas');
  const [status, setStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');
  const aceso = useDestaque(jogoInicial && `jogo-br-${id}-${jogoInicial}`, !!data);

  // a categoria escolhida vai para o endereço: o link compartilhado já abre nela
  const setCategoria = (c: string) => {
    setCategoriaLocal(c);
    irPara({ aba: 'brasil', torneio: id, categoria: c === 'todas' ? undefined : c });
  };

  // (sem useMemo: são poucas centenas de jogos e o "seguindo" muda a cada estrela)
  const jogos = data?.jogos ?? [];
  const meusJogos = jogos.filter((j) => seguindo.jogoMeu(chaveTorneio('br', id), nomesDoJogo(j)));
  const termo = semAcento(busca).trim();
  const filtrados = (status === 'meus' ? meusJogos : jogos)
    .filter((j) => categoria === 'todas' || j.categoria === categoria)
    .filter((j) => status === 'todos' || status === 'meus' || j.status === status)
    .filter((j) => !termo || nomesDoJogo(j).some((n) => semAcento(n).includes(termo)))
    .sort(ordemJogo);
  const porDia = [...filtrados.reduce((g, j) => g.set(j.data ?? '', [...(g.get(j.data ?? '') ?? []), j]), new Map<string, JogoBr[]>())];

  // Teu próximo jogo: o primeiro em quadra ou por vir de quem a pessoa segue (jogadores, não o torneio todo)
  const proximo = jogos.filter((j) => j.status !== 'finished' && nomesDoJogo(j).some(seguindo.segueJogador)).sort(ordemJogo)[0];

  const voltar = (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={onVoltar}>
      <ArrowLeft /> Torneios no Brasil
    </Button>
  );
  if (isPending) return <div className="space-y-3">{voltar}<Carregando /></div>;
  if (error) return <div className="space-y-3">{voltar}<Aviso tipo="erro">Não consegui carregar o torneio: {error.message}</Aviso></div>;

  const t = data.torneio;
  const local = [t.cidade, t.local].filter(Boolean).join(' · ');
  const conta = { todos: data.jogos.length, live: t.jogos.live, scheduled: t.jogos.scheduled, finished: t.jogos.finished, meus: meusJogos.length };
  const cat = categoria === 'todas' ? undefined : categoria;
  // Agenda: os jogos que estão na tela (filtros aplicados) e ainda vão acontecer com horário
  const agenda = filtrados.map((j) => agendaJogoBr(j, id, t.nome, local)).filter((e) => e !== null);
  const filtrado = status !== 'todos' || !!cat || !!termo;
  const textoTorneio = `🎾 ${t.nome}${cat ? ` · ${cat}` : ''}\n${[local, periodo(t.inicio, t.fim)].filter(Boolean).join(' · ')}\nTabela, resultados e quem está em quadra:`;
  return (
    <div className="space-y-4">
      {voltar}
      <div className="space-y-2">
        <CabecalhoTorneio
          nome={t.nome}
          pais="BR"
          local={local}
          inicio={t.inicio}
          fim={t.fim}
          extra={
            <span className="flex items-center gap-1">
              <SeloStatus status={t.status} />
              <Seguir
                tipo="torneio"
                rotulo={t.nome}
                ativo={seguindo.segueTorneio(chaveTorneio('br', id))}
                onAlternar={() => seguindo.alternarTorneio(chaveTorneio('br', id))}
              />
              <MenuAcoes
                tipo={cat ? 'categoria' : 'torneio'}
                texto={textoTorneio}
                link={linkDaRota({ aba: 'brasil', torneio: id, categoria: cat })}
                agenda={agenda}
                arquivoAgenda={`${t.nome}${cat ? `-${cat}` : ''}`}
                rotuloAgenda={`Adicionar ${agenda.length === 1 ? 'o jogo' : `${agenda.length} jogos`}${filtrado ? ' filtrados' : ''} à agenda`}
              />
            </span>
          }
        />
        <Links links={externo ? [{ nome: 'Tabela no SportScore', url: externo.url }] : t.links} />
        <Canais canais={t.ondeAssistir} torneio={t.nome} />
        {externo && (
          <p className="text-xs text-muted-foreground">Este torneio não está na nossa lista: os jogos foram buscados agora no SportScore.</p>
        )}
      </div>

      {t.status !== 'finished' && <PlayerYouTube canais={t.ondeAssistir} torneio={t.nome} />}

      {proximo && (
        <section className="space-y-1.5">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-primary">Teu próximo jogo</h3>
          <Card className="gap-0 overflow-hidden border-primary/40 py-0">
            <LinhaJogoBr jogo={proximo} canais={t.ondeAssistir} torneio={t.nome} torneioId={id} local={local} ancora={false} />
          </Card>
        </section>
      )}

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <div className="relative md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procura teu nome ou da tua dupla" className="pl-9" />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {data.categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToggleGroup type="single" variant="outline" size="sm" value={status} onValueChange={(v) => v && setStatus(v as FiltroStatus)} className="flex-wrap">
          {FILTROS.map(([v, r]) => (
            <ToggleGroupItem key={v} value={v} className="px-3">
              {v === 'meus' && <Star className="size-3.5" />}
              {r} <span className="text-muted-foreground">{conta[v]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!t.publicado ? (
        <Aviso>Tabela de jogos ainda não publicada.</Aviso>
      ) : status === 'meus' && !meusJogos.length ? (
        <Aviso>Toca na ☆ ao lado de uma dupla (a tua, por exemplo) para seguir. Os jogos dela aparecem aqui e no “Teu próximo jogo”.</Aviso>
      ) : porDia.length === 0 ? (
        <Aviso>Nenhum jogo com esses filtros.</Aviso>
      ) : (
        porDia.map(([dia, jogos]) => (
          <section key={dia}>
            <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dia ? diaLongo(dia) : 'Sem data'} · {jogos.length} {jogos.length === 1 ? 'jogo' : 'jogos'}
            </h3>
            <Card className="gap-0 divide-y overflow-hidden py-0">
              {jogos.map((j) => (
                <LinhaJogoBr
                  key={j.id}
                  jogo={j}
                  busca={busca}
                  canais={t.ondeAssistir}
                  torneio={t.nome}
                  torneioId={id}
                  local={local}
                  destaque={aceso === `jogo-br-${id}-${j.id}`}
                />
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

// O torneio aberto vem do endereço (#/brasil/519): link direto e o Voltar do celular funcionam.
// torneio/categoria/jogo: o que a rota pediu
export function AbaBrasil({ torneio, categoria, jogo }: { torneio?: number; categoria?: string; jogo?: string }) {
  const { data: lista, isPending } = useDados<TorneioBr[]>('/br/torneios', undefined, { aoVivo: true });
  // a busca fica aqui para continuar preenchida quando a pessoa volta do torneio
  const [busca, setBusca] = useState('');
  // o que a busca achou fora da lista (tem o título e o link certo do SportScore)
  const [externos, setExternos] = useState<Record<number, TorneioExterno>>({});

  useEffect(() => {
    window.scrollTo({ top: 0 }); // (com chaves: o scrollTo novo devolve Promise, e o React a trataria como limpeza)
  }, [torneio]);

  const abrir = (id: number | null) => irPara(id ? { aba: 'brasil', torneio: id } : { aba: 'brasil' }, { empilhar: !!id });
  const abrirExterno = (t: TorneioExterno) => {
    registrar('torneio-externo-aberto', { id: t.id, titulo: t.titulo });
    setExternos((e) => ({ ...e, [t.id]: t }));
    abrir(t.id);
  };
  // O botão sempre leva à lista de torneios (o Voltar do celular continua seguindo o histórico)
  const voltar = () => irPara({ aba: 'brasil' });

  if (!torneio) {
    return <ListaTorneiosBr busca={busca} onBusca={setBusca} onAbrir={abrir} onAbrirExterno={abrirExterno} />;
  }
  if (isPending) return <Carregando />;
  // Fora da lista (link de torneio achado na busca): vem pela API, se ela estiver ligada
  const naLista = lista?.some((t) => t.id === torneio);
  const externo = naLista
    ? undefined
    : (externos[torneio] ?? { id: torneio, titulo: '', organizador: null, temTabela: true, url: `https://www.sportscore.com.br/timeline/${torneio}/` });
  if (!naLista && !API_LIGADA) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={() => abrir(null)}>
          <ArrowLeft /> Torneios no Brasil
        </Button>
        <Aviso>Esse torneio não está na nossa lista.</Aviso>
      </div>
    );
  }
  return (
    <TorneioBrView
      key={torneio}
      id={torneio}
      externo={externo}
      categoriaInicial={categoria}
      jogoInicial={jogo}
      onVoltar={voltar}
    />
  );
}
