// Aba Jogos (estilo SofaScore): escolhe o dia na faixa de datas ou no calendário e vê os jogos
// daquele dia separados por campeonato, cada um podendo recolher/expandir.
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Star } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Seguir } from '@/components/acoes';
import { inicioBr } from '@/lib/compartilhar';
import { irPara } from '@/lib/rota';
import { chaveTorneio, useSeguindo } from '@/lib/seguindo';
import { ptBR } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Aviso, Bandeira, Carregando } from '@/components/partes';
import { diaMundial, ENCERRADO, idJogoMundial, LinhaJogo, type Categoria } from '@/secoes/Mundial';
import { LinhaJogoBr } from '@/secoes/Brasil';
import { useDados, type Jogo, type JogoBr, type JogosPeriodo } from '@/lib/dados';
import { dataSemFuso, diaISO, diaLongo, horarioMadriParaData, periodo, rotuloDia } from '@/lib/formato';
import { cn } from '@/lib/utils';

// ---------- datas ----------

const somaDias = (iso: string, dias: number) => {
  const d = dataSemFuso(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
// o calendário trabalha com Date local (meia-noite); os dados, com "AAAA-MM-DD"
const isoParaLocal = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const localParaIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' });
const fmtNumero = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });

// ---------- filtros ----------

export type FiltroJogos = 'todos' | 'vivo' | 'proximos' | 'encerrados' | 'meus';
// "Meus" logo depois de Todos: no celular os últimos ficam para rolar de lado
const FILTROS: [FiltroJogos, string][] = [['todos', 'Todos'], ['meus', 'Meus'], ['vivo', 'Ao vivo'], ['proximos', 'Próximos'], ['encerrados', 'Encerrados']];
type Situacao = 'vivo' | 'proximos' | 'encerrados';

const situacaoMundial = (j: Jogo): Situacao => (j.status === 'live' ? 'vivo' : ENCERRADO.includes(j.status) ? 'encerrados' : 'proximos');
const situacaoBr = (j: JogoBr): Situacao => (j.status === 'live' ? 'vivo' : j.status === 'finished' ? 'encerrados' : 'proximos');

type Seguindo = ReturnType<typeof useSeguindo>;

// ---------- grupos (um por campeonato) ----------

type Grupo = {
  chave: string;
  nome: string;
  nivel?: string | null;
  pais?: string | null;
  local?: string | null;
  inicio?: string | null;
  fim?: string | null;
  peso: number;
  linhas: { id: string; vivo: boolean; ordem: number; elemento: React.ReactNode }[];
};

// ordem dos campeonatos: os maiores primeiro (o que tem jogo ao vivo sobe para o topo)
const PESO_NIVEL: Record<string, number> = { major: 0, finals: 1, p1: 2, p2: 3, fip_platinum: 4, fip_gold: 5 };

const generoBr = (categoria: string | null): Categoria =>
  /femin/i.test(categoria ?? '') ? 'women' : /mascul/i.test(categoria ?? '') ? 'men' : 'todos';

const nomesMundial = (j: Jogo) => [...j.dupla1, ...j.dupla2].map((p) => p.nome);
const nomesBr = (j: JogoBr) => [...j.dupla1.jogadores, ...j.dupla2.jogadores];

// O jogo que veio por link direto ganha um fundo por uns segundos
function LinhaMundial({ jogo, aceso }: { jogo: Jogo; aceso: boolean }) {
  return (
    <div id={`jogo-${idJogoMundial(jogo)}`} className={cn('scroll-mt-40 transition-colors duration-1000', aceso && 'bg-bola/15')}>
      <LinhaJogo jogo={jogo} />
    </div>
  );
}

function montarGrupos(
  dados: JogosPeriodo, dia: string, categoria: Categoria, filtro: FiltroJogos, seguindo: Seguindo, aceso?: string,
): Grupo[] {
  const grupos = new Map<string, Grupo>();
  const passa = (situacao: Situacao, meu: boolean) =>
    filtro === 'todos' || (filtro === 'meus' ? meu : situacao === filtro);

  for (const j of dados.mundial) {
    if (diaMundial(j) !== dia) continue;
    if (categoria !== 'todos' && j.categoria !== categoria) continue;
    if (!j.dupla1.length && !j.dupla2.length) continue; // rodada ainda sem dupla
    const t = j.torneio;
    const chave = chaveTorneio('m', t.id);
    if (!passa(situacaoMundial(j), seguindo.jogoMeu(chave, nomesMundial(j)))) continue;
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, nome: t.nome, nivel: t.nivel, pais: t.pais, local: t.cidade, inicio: t.inicio, fim: t.fim, peso: PESO_NIVEL[t.nivel] ?? 6, linhas: [] });
    }
    const vivo = j.status === 'live';
    const ordem = horarioMadriParaData(j.horarioMadri)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    grupos.get(chave)!.linhas.push({ id: String(j.id), vivo, ordem, elemento: <LinhaMundial jogo={j} aceso={aceso === idJogoMundial(j)} /> });
  }

  for (const { torneio: t, jogos } of dados.brasil) {
    const chave = chaveTorneio('br', t.id);
    const doDia = jogos.filter(
      (j: JogoBr) =>
        j.data === dia &&
        (categoria === 'todos' || generoBr(j.categoria) === categoria) &&
        passa(situacaoBr(j), seguindo.jogoMeu(chave, nomesBr(j))),
    );
    if (!doDia.length) continue;
    const local = [t.cidade, t.local].filter(Boolean).join(' · ');
    grupos.set(chave, {
      chave, nome: t.nome, pais: 'BR', local, inicio: t.inicio, fim: t.fim,
      peso: t.destaque ? 3.5 : 7,
      linhas: doDia.map((j) => ({
        id: j.id,
        vivo: j.status === 'live',
        ordem: j.hora ? Number(j.hora.replace(':', '')) : Number.MAX_SAFE_INTEGER,
        elemento: (
          <LinhaJogoBr
            jogo={j}
            canais={t.ondeAssistir}
            torneio={t.nome}
            torneioId={t.id}
            local={local}
            destaque={aceso === `br-${t.id}-${j.id}`}
          />
        ),
      })),
    });
  }

  const lista = [...grupos.values()];
  for (const g of lista) g.linhas.sort((a, b) => Number(b.vivo) - Number(a.vivo) || a.ordem - b.ordem);
  return lista.sort((a, b) => {
    const vivoA = a.linhas.some((l) => l.vivo);
    const vivoB = b.linhas.some((l) => l.vivo);
    return Number(vivoB) - Number(vivoA) || a.peso - b.peso || a.nome.localeCompare(b.nome);
  });
}

// ---------- recolher/expandir (fica salvo no navegador) ----------

const CHAVE_RECOLHIDOS = 'campeonatos-recolhidos';

function useRecolhidos() {
  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHAVE_RECOLHIDOS) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_RECOLHIDOS, JSON.stringify([...recolhidos])); } catch { /* sem armazenamento */ }
  }, [recolhidos]);
  const alternar = (chave: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  return { recolhidos, alternar, definir: setRecolhidos };
}

// ---------- telas ----------

function FaixaDatas({
  dia, hoje, diasComJogo, onEscolher, de, ate,
}: {
  dia: string;
  hoje: string;
  diasComJogo: Set<string>;
  onEscolher: (dia: string) => void;
  de: string;
  ate: string;
}) {
  const [aberto, setAberto] = useState(false);
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(dia, i - 3));
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1.5">
      <Button variant="ghost" size="icon" className="shrink-0" aria-label="Dia anterior" onClick={() => onEscolher(somaDias(dia, -1))}>
        <ChevronLeft />
      </Button>
      <div className="grid min-w-0 flex-1 grid-cols-5 gap-1 sm:grid-cols-7">
        {dias.map((d, i) => {
          const escolhido = d === dia;
          const temJogo = diasComJogo.has(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onEscolher(d)}
              className={cn(
                'relative flex flex-col items-center rounded-lg px-1 py-1.5 leading-tight transition-colors',
                (i === 0 || i === 6) && 'hidden sm:flex',
                escolhido ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              <span className={cn('text-[11px] uppercase', escolhido ? 'font-semibold' : 'text-muted-foreground')}>
                {d === hoje ? 'Hoje' : fmtSemana.format(dataSemFuso(d)).replace('.', '')}
              </span>
              <span className="font-display text-base font-semibold tabular-nums">{fmtNumero.format(dataSemFuso(d))}</span>
              <span className={cn('mt-0.5 size-1 rounded-full', temJogo ? (escolhido ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
      <Button variant="ghost" size="icon" className="shrink-0" aria-label="Próximo dia" onClick={() => onEscolher(somaDias(dia, 1))}>
        <ChevronRight />
      </Button>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0" aria-label="Escolher data no calendário">
            <CalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={isoParaLocal(dia)}
            defaultMonth={isoParaLocal(dia)}
            onSelect={(d) => {
              if (!d) return;
              onEscolher(localParaIso(d));
              setAberto(false);
            }}
            modifiers={{
              comJogo: [...diasComJogo].map(isoParaLocal),
              hoje: isoParaLocal(hoje),
            }}
            modifiersClassNames={{ comJogo: 'dia-com-jogo', hoje: 'dia-hoje' }}
            startMonth={isoParaLocal(de)}
            endMonth={isoParaLocal(ate)}
          />
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-primary align-middle" /> dias com jogo
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function GrupoCampeonato({ grupo, recolhido, onAlternar }: { grupo: Grupo; recolhido: boolean; onAlternar: () => void }) {
  const seguindo = useSeguindo();
  const aoVivo = grupo.linhas.filter((l) => l.vivo).length;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center bg-muted/40 pr-3 transition-colors hover:bg-muted/70">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={!recolhido}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 text-left"
      >
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', recolhido && '-rotate-90')} />
        <Bandeira pais={grupo.pais} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold leading-tight tracking-tight">{grupo.nome}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[grupo.local, (grupo.inicio || grupo.fim) && periodo(grupo.inicio, grupo.fim)].filter(Boolean).join(' · ')}
          </p>
        </div>
        {aoVivo > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-vivo/15 px-1.5 py-0.5 text-xs font-semibold text-vivo">
            <span className="size-1.5 animate-pulse rounded-full bg-vivo" /> {aoVivo}
          </span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {grupo.linhas.length} {grupo.linhas.length === 1 ? 'jogo' : 'jogos'}
        </span>
      </button>
      <Seguir
        tipo="torneio"
        rotulo={grupo.nome}
        ativo={seguindo.segueTorneio(grupo.chave)}
        onAlternar={() => seguindo.alternarTorneio(grupo.chave)}
      />
      </div>
      {!recolhido && (
        <div className="divide-y border-t">
          {grupo.linhas.map((l) => <div key={l.id}>{l.elemento}</div>)}
        </div>
      )}
    </Card>
  );
}

// Teu próximo jogo: o primeiro em quadra ou por vir, em qualquer dia, de quem a pessoa segue (jogadores)
function ProximoJogo({ dados, seguindo, onIr }: { dados: JogosPeriodo; seguindo: Seguindo; onIr: (dia: string, jogo: string) => void }) {
  type Candidato = { quando: number; vivo: boolean; dia: string; jogo: string; elemento: React.ReactNode; torneio: string };
  const candidatos: Candidato[] = [];
  for (const j of dados.mundial) {
    if (situacaoMundial(j) === 'encerrados' || !nomesMundial(j).some(seguindo.segueJogador)) continue;
    const dia = diaMundial(j);
    if (!dia) continue;
    const quando = horarioMadriParaData(j.horarioMadri)?.getTime() ?? dataSemFuso(dia).getTime();
    candidatos.push({ quando, vivo: j.status === 'live', dia, jogo: idJogoMundial(j), torneio: j.torneio.nome, elemento: <LinhaJogo jogo={j} /> });
  }
  for (const { torneio: t, jogos } of dados.brasil) {
    for (const j of jogos) {
      if (situacaoBr(j) === 'encerrados' || !j.data || !nomesBr(j).some(seguindo.segueJogador)) continue;
      const quando = inicioBr(j.data, j.hora ?? '23:59')?.getTime() ?? 0;
      candidatos.push({
        quando, vivo: j.status === 'live', dia: j.data, jogo: `br-${t.id}-${j.id}`, torneio: t.nome,
        elemento: <LinhaJogoBr jogo={j} canais={t.ondeAssistir} torneio={t.nome} torneioId={t.id} local={[t.cidade, t.local].filter(Boolean).join(' · ')} ancora={false} />,
      });
    }
  }
  const proximo = candidatos.sort((a, b) => Number(b.vivo) - Number(a.vivo) || a.quando - b.quando)[0];
  if (!proximo) return null;
  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Teu próximo jogo</h3>
        <button type="button" onClick={() => onIr(proximo.dia, proximo.jogo)} className="truncate text-xs text-muted-foreground hover:text-foreground">
          {proximo.torneio} · ver no dia
        </button>
      </div>
      <Card className="gap-0 overflow-hidden border-primary/40 py-0">{proximo.elemento}</Card>
    </section>
  );
}

function FiltroSituacao({ valor, onMudar }: { valor: FiltroJogos; onMudar: (f: FiltroJogos) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={valor}
      onValueChange={(v) => v && onMudar(v as FiltroJogos)}
      className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {FILTROS.map(([v, r]) => (
        <ToggleGroupItem key={v} value={v} className="flex-none px-2.5 sm:px-3">
          {v === 'vivo' && <span className="size-1.5 rounded-full bg-vivo" />}
          {v === 'meus' && <Star className="size-3.5" />}
          {r}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// dia e jogo vêm do endereço (#/jogos/2026-10-31/j/m-123): link direto e Voltar do celular
export function AbaJogos({ categoria, dia, jogo }: { categoria: Categoria; dia?: string; jogo?: string }) {
  const { data, isPending, error } = useDados<JogosPeriodo>('/jogos', undefined, { aoVivo: true });
  const { recolhidos, alternar, definir } = useRecolhidos();
  const seguindo = useSeguindo();
  const [filtro, setFiltro] = useState<FiltroJogos>('todos');
  const [aceso, setAceso] = useState<string | undefined>(jogo);

  const hoje = data?.hoje ?? diaISO(new Date());
  const diaEscolhido = dia ?? hoje;
  const setDia = (d: string) => irPara({ aba: 'jogos', dia: d === hoje ? undefined : d });
  const irAoJogo = (d: string, j: string) => irPara({ aba: 'jogos', dia: d, jogo: j }, { empilhar: true });

  // Jogo do link: abre o campeonato dele se estava recolhido, rola até ele e acende por uns segundos
  useEffect(() => {
    if (!jogo || !data) return;
    setAceso(jogo);
    setFiltro('todos');
    const id = setTimeout(() => document.getElementById(`jogo-${jogo}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
    const apaga = setTimeout(() => setAceso(undefined), 4000);
    return () => { clearTimeout(id); clearTimeout(apaga); };
  }, [jogo, data]);

  const diasComJogo = useMemo(() => {
    const dias = new Set<string>();
    if (!data) return dias;
    for (const j of data.mundial) {
      const d = diaMundial(j);
      if (d && (j.dupla1.length || j.dupla2.length)) dias.add(d);
    }
    for (const g of data.brasil) for (const j of g.jogos) if (j.data) dias.add(j.data);
    return dias;
  }, [data]);

  // (sem useMemo: o "seguindo" muda a cada estrela e a conta é pequena)
  const grupos = data ? montarGrupos(data, diaEscolhido, categoria, filtro, seguindo, aceso) : [];

  if (isPending) return <Carregando />;
  if (error) return <Aviso tipo="erro">Não consegui carregar os jogos: {error.message}</Aviso>;

  const proximoComJogo = [...diasComJogo].filter((d) => d > diaEscolhido).sort()[0];
  const anteriorComJogo = [...diasComJogo].filter((d) => d < diaEscolhido).sort().at(-1);
  const todosRecolhidos = grupos.length > 0 && grupos.every((g) => recolhidos.has(g.chave));
  // o campeonato do jogo do link aparece aberto mesmo que a pessoa tenha recolhido
  const estaRecolhido = (g: Grupo) => recolhidos.has(g.chave) && !(aceso && g.linhas.some((l) => aceso.endsWith(`-${l.id}`)));

  return (
    <div className="space-y-4">
      <ProximoJogo dados={data} seguindo={seguindo} onIr={irAoJogo} />
      <FaixaDatas dia={diaEscolhido} hoje={hoje} diasComJogo={diasComJogo} onEscolher={setDia} de={data.de} ate={data.ate} />
      <FiltroSituacao valor={filtro} onMudar={setFiltro} />

      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold first-letter:uppercase">
          {rotuloDia(diaEscolhido) === 'Hoje' || rotuloDia(diaEscolhido) === 'Amanhã' || rotuloDia(diaEscolhido) === 'Ontem'
            ? `${rotuloDia(diaEscolhido)} · ${diaLongo(diaEscolhido)}`
            : diaLongo(diaEscolhido)}
        </h2>
        {grupos.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => definir(todosRecolhidos ? new Set() : new Set(grupos.map((g) => g.chave)))}
          >
            {todosRecolhidos ? <><ChevronsUpDown /> Expandir todos</> : <><ChevronsDownUp /> Recolher todos</>}
          </Button>
        )}
      </div>

      {grupos.length === 0 && filtro === 'meus' && !seguindo.algum ? (
        <Aviso>
          Toca na ☆ ao lado de uma dupla ou de um campeonato para seguir. Os jogos deles aparecem aqui, e o próximo
          jogo de quem tu segue fica no topo da aba.
        </Aviso>
      ) : grupos.length === 0 && filtro !== 'todos' ? (
        <Aviso>
          <span>Nenhum jogo {FILTROS.find(([v]) => v === filtro)?.[1].toLowerCase()} neste dia.</span>
          <Button variant="outline" size="sm" onClick={() => setFiltro('todos')}>Ver todos</Button>
        </Aviso>
      ) : grupos.length === 0 ? (
        <Aviso>
          <span>Nenhum jogo neste dia{categoria !== 'todos' ? ' nessa categoria' : ''}.</span>
          <span className="flex flex-wrap justify-center gap-2 pt-1">
            {anteriorComJogo && (
              <Button variant="outline" size="sm" onClick={() => setDia(anteriorComJogo)}>
                <ChevronLeft /> {rotuloDia(anteriorComJogo)}
              </Button>
            )}
            {proximoComJogo && (
              <Button variant="outline" size="sm" onClick={() => setDia(proximoComJogo)}>
                {rotuloDia(proximoComJogo)} <ChevronRight />
              </Button>
            )}
          </span>
        </Aviso>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <GrupoCampeonato key={g.chave} grupo={g} recolhido={estaRecolhido(g)} onAlternar={() => alternar(g.chave)} />
          ))}
        </div>
      )}
    </div>
  );
}
