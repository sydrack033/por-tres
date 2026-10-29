// Abas do circuito mundial (Premier Padel + FIP): agenda, resultados, calendário e ranking.
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Aviso, Bandeira, CabecalhoTorneio, Canais, Carregando, ColunaHora, LinhaDupla, type InfoHora,
} from '@/components/partes';
import { useDados, type Agenda, type Jogo, type LinhaRanking, type Resultados, type Torneio } from '@/lib/dados';
import { diaISO, diaMes, horaBR, horarioMadriParaData, periodo, rotuloDia } from '@/lib/formato';

export type Categoria = 'todos' | 'men' | 'women';

const RODADAS: Record<number, string> = { 0: 'Fase de grupos', 1: 'Final', 2: 'Semifinal', 4: 'Quartas', 8: 'Oitavas', 16: 'Rodada de 32', 32: 'Rodada de 64' };
const CATEGORIAS = { men: 'Masculino', women: 'Feminino' } as const;
const ENCERRADO = ['finished', 'ended', 'retired', 'walkover'];

function infoHora(j: Jogo): InfoHora {
  if (j.status === 'live') return { tipo: 'vivo', hora: '' };
  if (ENCERRADO.includes(j.status)) return { tipo: 'fim', hora: 'Fim', dia: rotuloDia(j.data) };
  const quando = horarioMadriParaData(j.horarioMadri);
  const rotulo = j.rotuloHorario?.toLowerCase() ?? '';
  if (quando) {
    const nota = rotulo.startsWith('not before') ? 'não antes' : rotulo.startsWith('estimated') ? 'previsto' : undefined;
    return { tipo: 'agendado', hora: horaBR(quando), dia: rotuloDia(diaISO(quando)), nota };
  }
  if (rotulo.startsWith('followed')) return { tipo: 'agendado', hora: '—', dia: rotuloDia(j.data), nota: 'na sequência' };
  return { tipo: 'indefinido', hora: '—', dia: rotuloDia(j.data), nota: 'a definir' };
}

function LinhaJogo({ jogo: j }: { jogo: Jogo }) {
  const aindaVai = j.status === 'scheduled' || j.status === 'live';
  const nomes = (d: Jogo['dupla1']) => d.map((p) => (
    <>
      <Bandeira pais={p.pais} />
      <span className="truncate">{p.nome}</span>
    </>
  ));
  const sets = (lado: 'team_1' | 'team_2') => (j.placar ?? []).map((s) => s[lado]);
  return (
    <div className="flex gap-3 px-4 py-3 sm:gap-4">
      <ColunaHora info={infoHora(j)} />
      <div className="min-w-0 flex-1 space-y-1">
        <LinhaDupla nomes={nomes(j.dupla1)} sets={sets('team_1')} venceu={j.vencedor === 'team_1'} cabeca={j.cabecas?.team_1} />
        <LinhaDupla nomes={nomes(j.dupla2)} sets={sets('team_2')} venceu={j.vencedor === 'team_2'} cabeca={j.cabecas?.team_2} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span>{[RODADAS[j.rodada] ?? j.nomeRodada, CATEGORIAS[j.categoria], j.quadra].filter(Boolean).join(' · ')}</span>
          {aindaVai && <Canais canais={j.ondeAssistir} />}
          {!aindaVai && j.duracao && <span>{j.duracao}</span>}
        </div>
      </div>
    </div>
  );
}

function agruparPorTorneio(jogos: Jogo[]) {
  const grupos = new Map<number, { torneio: Torneio; jogos: Jogo[] }>();
  for (const j of jogos) {
    if (!grupos.has(j.torneio.id)) grupos.set(j.torneio.id, { torneio: j.torneio, jogos: [] });
    grupos.get(j.torneio.id)!.jogos.push(j);
  }
  return [...grupos.values()];
}

const semDupla = (j: Jogo) => !j.dupla1.length && !j.dupla2.length;

// Rodadas futuras ainda sem dupla viram uma linha só: "Depois: Semifinal sex., 30/10 · Final sáb., 31/10"
function RodadasFuturas({ jogos }: { jogos: Jogo[] }) {
  const vistas = new Map<string, Jogo>();
  for (const j of jogos) vistas.set(`${j.rodada}|${j.data}`, vistas.get(`${j.rodada}|${j.data}`) ?? j);
  const itens = [...vistas.values()].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
  if (!itens.length) return null;
  return (
    <p className="px-1 pt-2 text-xs text-muted-foreground">
      Depois: {itens.map((j) => `${RODADAS[j.rodada] ?? j.nomeRodada} ${j.data ? rotuloDia(j.data).toLowerCase() : 'a definir'}`).join(' · ')}
    </p>
  );
}

function ListaPorTorneio({ jogos }: { jogos: Jogo[] }) {
  return (
    <div className="space-y-6">
      {agruparPorTorneio(jogos).map(({ torneio: t, jogos: lista }) => {
        const definidos = lista.filter((j) => !semDupla(j));
        return (
          <section key={t.id}>
            <CabecalhoTorneio nome={t.nome} nivel={t.nivel} pais={t.pais} local={t.cidade} inicio={t.inicio} fim={t.fim} />
            {definidos.length > 0 && (
              <Card className="gap-0 divide-y overflow-hidden py-0">
                {definidos.map((j) => <LinhaJogo key={j.id} jogo={j} />)}
              </Card>
            )}
            <RodadasFuturas jogos={lista.filter(semDupla)} />
          </section>
        );
      })}
    </div>
  );
}

const filtrar = (jogos: Jogo[], categoria: Categoria) => (categoria === 'todos' ? jogos : jogos.filter((j) => j.categoria === categoria));

function ordemAgenda(a: Jogo, b: Jogo) {
  const peso = (j: Jogo) => (j.status === 'live' ? 0 : j.status === 'scheduled' ? 1 : 2);
  const tempo = (j: Jogo) => horarioMadriParaData(j.horarioMadri)?.getTime() ?? Infinity;
  return peso(a) - peso(b) || tempo(a) - tempo(b) || (a.ordemQuadra ?? 99) - (b.ordemQuadra ?? 99);
}

export function AbaAgenda({ categoria }: { categoria: Categoria }) {
  const { data, isPending, error } = useDados<Agenda>('/agenda', undefined, { aoVivo: true });
  if (isPending) return <Carregando />;
  if (error) return <Aviso tipo="erro">Não consegui carregar a agenda: {error.message}</Aviso>;
  const jogos = filtrar(data.jogos, categoria).sort(ordemAgenda);
  return (
    <div className="space-y-8">
      {jogos.length ? <ListaPorTorneio jogos={jogos} /> : <Aviso>Nenhum jogo do circuito principal hoje.</Aviso>}
      {data.proximosTorneios.length > 0 && (
        <section>
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximos torneios</h2>
          <ListaTorneios torneios={data.proximosTorneios} />
        </section>
      )}
    </div>
  );
}

export function AbaResultados({ categoria }: { categoria: Categoria }) {
  const { data, isPending, error } = useDados<Resultados>('/resultados');
  if (isPending) return <Carregando />;
  if (error) return <Aviso tipo="erro">Não consegui carregar os resultados: {error.message}</Aviso>;
  const jogos = filtrar(data.jogos, categoria);
  return jogos.length ? <ListaPorTorneio jogos={jogos} /> : <Aviso>Sem resultados recentes.</Aviso>;
}

function ListaTorneios({ torneios }: { torneios: Torneio[] }) {
  return (
    <Card className="gap-0 divide-y overflow-hidden py-0">
      {torneios.map((t) => (
        <div key={t.id} className="flex gap-3 px-4 py-3 sm:gap-4">
          <div className="flex w-14 shrink-0 flex-col pt-0.5 sm:w-16">
            <span className="font-display text-[17px] font-semibold leading-none">{diaMes(t.inicio)}</span>
            <span className="text-[11px] text-muted-foreground">até {diaMes(t.fim)}</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.nome}</span>
              {t.status === 'live' && <Badge className="bg-vivo/15 text-vivo hover:bg-vivo/15">Em andamento</Badge>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Bandeira pais={t.pais} />
                {[t.cidade, t.local].filter(Boolean).join(' · ')} · {periodo(t.inicio, t.fim)}
              </span>
              <Canais canais={t.ondeAssistir ?? []} />
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

export function AbaCalendario() {
  const { data, isPending, error } = useDados<Torneio[]>('/torneios');
  if (isPending) return <Carregando />;
  if (error) return <Aviso tipo="erro">Não consegui carregar o calendário: {error.message}</Aviso>;
  return data.length ? <ListaTorneios torneios={data} /> : <Aviso>Nenhum torneio no calendário.</Aviso>;
}

export function AbaRanking({ categoria }: { categoria: 'men' | 'women' }) {
  const { data, isPending, error } = useDados<LinhaRanking[]>('/ranking', categoria);
  if (isPending) return <Carregando linhas={8} />;
  if (error) return <Aviso tipo="erro">Não consegui carregar o ranking: {error.message}</Aviso>;
  return (
    <Card className="gap-0 divide-y overflow-hidden py-0">
      {data.map((r) => {
        const v = typeof r.variacao === 'number' ? r.variacao : 0;
        return (
          <div key={`${r.posicao}-${r.nome}`} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-8 font-display text-lg font-semibold tabular-nums text-muted-foreground">{r.posicao}</span>
            <Bandeira pais={r.pais} />
            <span className="min-w-0 flex-1 truncate">{r.nome}</span>
            <span className="font-display tabular-nums">
              {typeof r.pontos === 'number' ? r.pontos.toLocaleString('pt-BR') : '—'}
            </span>
            <span className="flex w-10 items-center justify-end gap-0.5 text-xs tabular-nums">
              {v > 0 ? <><ArrowUp className="size-3 text-primary" />{v}</> : v < 0 ? <><ArrowDown className="size-3 text-vivo" />{-v}</> : <Minus className="size-3 text-muted-foreground" />}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
