// Aba Brasil: torneios do SportScore (Liga Brasileira, circuitos de clube...).
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, Search, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Aviso, CabecalhoTorneio, Carregando, ColunaHora, LinhaDupla, type InfoHora } from '@/components/partes';
import { useDados, type JogoBr, type TorneioBr, type TorneioBrDetalhe } from '@/lib/dados';
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

function ListaTorneiosBr({ onAbrir }: { onAbrir: (id: number) => void }) {
  const { data, isPending, error } = useDados<TorneioBr[]>('/br/torneios', undefined, { aoVivo: true });
  if (isPending) return <Carregando linhas={4} />;
  if (error) return <Aviso tipo="erro">Não consegui carregar os torneios: {error.message}</Aviso>;
  if (!data.length) return <Aviso>Nenhum torneio cadastrado.</Aviso>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((t) => (
          <Card
            key={t.id}
            className={cn('gap-3 px-5 py-4', t.destaque && 'border-primary/50 ring-1 ring-primary/30')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold leading-tight tracking-tight">{t.nome}</h3>
                <p className="text-sm text-muted-foreground">{[t.cidade, t.local].filter(Boolean).join(' · ')}</p>
              </div>
              <SeloStatus status={t.status} />
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
  if (!termo || !semAcento(nome).includes(termo)) return <span className="truncate">{nome}</span>;
  return <mark className="truncate rounded bg-bola px-0.5 text-black">{nome}</mark>;
}

function LinhaJogoBr({ jogo: j, busca }: { jogo: JogoBr; busca: string }) {
  const nomes = (d: JogoBr['dupla1']) => d.jogadores.map((n) => <Destacar nome={n} busca={busca} />);
  return (
    <div className="flex gap-3 px-4 py-3 sm:gap-4">
      <ColunaHora info={infoHoraBr(j)} />
      <div className="min-w-0 flex-1 space-y-1">
        <LinhaDupla nomes={nomes(j.dupla1)} sets={j.dupla1.sets} venceu={j.vencedor === 1} />
        <LinhaDupla nomes={nomes(j.dupla2)} sets={j.dupla2.sets} venceu={j.vencedor === 2} />
        <div className="flex flex-wrap justify-between gap-x-3 pt-1 text-xs text-muted-foreground">
          <span>{[j.categoria, j.chave && `Chave ${j.chave}`, j.quadra ? `Quadra ${j.quadra}` : j.clube].filter(Boolean).join(' · ')}</span>
          <span>{[j.duracao, `Jogo ${j.id}`].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
    </div>
  );
}

type FiltroStatus = 'todos' | JogoBr['status'];
const FILTROS: [FiltroStatus, string][] = [['todos', 'Todos'], ['live', 'Em quadra'], ['scheduled', 'Próximos'], ['finished', 'Encerrados']];

function TorneioBrView({ id, onVoltar }: { id: number; onVoltar: () => void }) {
  const { data, isPending, error } = useDados<TorneioBrDetalhe>('/br/torneio', String(id), { aoVivo: true });
  const [categoria, setCategoria] = useState('todas');
  const [status, setStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');

  const porDia = useMemo(() => {
    if (!data) return [];
    const termo = semAcento(busca).trim();
    const jogos = data.jogos
      .filter((j) => categoria === 'todas' || j.categoria === categoria)
      .filter((j) => status === 'todos' || j.status === status)
      .filter((j) => !termo || [...j.dupla1.jogadores, ...j.dupla2.jogadores].some((n) => semAcento(n).includes(termo)))
      .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '') || (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id, undefined, { numeric: true }));
    const grupos = new Map<string, JogoBr[]>();
    for (const j of jogos) grupos.set(j.data ?? '', [...(grupos.get(j.data ?? '') ?? []), j]);
    return [...grupos.entries()];
  }, [data, categoria, status, busca]);

  const voltar = (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={onVoltar}>
      <ArrowLeft /> Torneios no Brasil
    </Button>
  );
  if (isPending) return <div className="space-y-3">{voltar}<Carregando /></div>;
  if (error) return <div className="space-y-3">{voltar}<Aviso tipo="erro">Não consegui carregar o torneio: {error.message}</Aviso></div>;

  const t = data.torneio;
  const conta = { todos: data.jogos.length, live: t.jogos.live, scheduled: t.jogos.scheduled, finished: t.jogos.finished };
  return (
    <div className="space-y-4">
      {voltar}
      <div className="space-y-2">
        <CabecalhoTorneio nome={t.nome} pais="BR" local={[t.cidade, t.local].filter(Boolean).join(' · ')} inicio={t.inicio} fim={t.fim} extra={<SeloStatus status={t.status} />} />
        <Links links={t.links} />
      </div>

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
              {r} <span className="text-muted-foreground">{conta[v]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {porDia.length === 0 ? (
        <Aviso>Nenhum jogo com esses filtros.</Aviso>
      ) : (
        porDia.map(([dia, jogos]) => (
          <section key={dia}>
            <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dia ? diaLongo(dia) : 'Sem data'} · {jogos.length} {jogos.length === 1 ? 'jogo' : 'jogos'}
            </h3>
            <Card className="gap-0 divide-y overflow-hidden py-0">
              {jogos.map((j) => <LinhaJogoBr key={j.id} jogo={j} busca={busca} />)}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

export function AbaBrasil() {
  const [aberto, setAberto] = useState<number | null>(null);
  const abrir = (id: number | null) => {
    setAberto(id);
    window.scrollTo({ top: 0 });
  };
  return aberto ? <TorneioBrView id={aberto} onVoltar={() => abrir(null)} /> : <ListaTorneiosBr onAbrir={abrir} />;
}
