// Circuito mundial (Premier Padel + FIP): linha de jogo (usada na aba Jogos), calendário e ranking.
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Aviso, Bandeira, Canais, Carregando, ColunaHora, LinhaDupla, NomeJogador, nomeCurto, type InfoHora,
} from '@/components/partes';
import { MenuAcoes, Seguir } from '@/components/acoes';
import { useSeguindo } from '@/lib/seguindo';
import { linkDaRota } from '@/lib/rota';
import { useDados, type Jogo, type LinhaRanking, type Torneio } from '@/lib/dados';
import { diaISO, diaMes, horaBR, horarioMadriParaData, periodo, rotuloDia } from '@/lib/formato';

export type Categoria = 'todos' | 'men' | 'women';

export const RODADAS: Record<number, string> = { 0: 'Fase de grupos', 1: 'Final', 2: 'Semifinal', 4: 'Quartas', 8: 'Oitavas', 16: 'Rodada de 32', 32: 'Rodada de 64' };
const CATEGORIAS = { men: 'Masculino', women: 'Feminino' } as const;
export const ENCERRADO = ['finished', 'ended', 'retired', 'walkover'];

function infoHora(j: Jogo): InfoHora {
  // O plano grátis da Padel API não tem placar ao vivo: ele só chega quando o jogo acaba
  if (j.status === 'live') return { tipo: 'vivo', hora: '', nota: j.placar?.length ? undefined : 'placar no fim' };
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

// Dia do jogo no horário de Brasília (a Padel API manda o de Madri)
export const diaMundial = (j: Jogo) => {
  const quando = horarioMadriParaData(j.horarioMadri);
  return quando ? diaISO(quando) : j.data;
};

export const idJogoMundial = (j: Jogo) => `m-${j.id}`;
const nomesDupla = (d: Jogo['dupla1']) => d.map((p) => p.nome);

// Mensagem do "Mandar no grupo": quem joga, onde e o placar ou o horário
function textoJogo(j: Jogo) {
  const dupla = (d: Jogo['dupla1']) => d.map((p) => nomeCurto(p.nome, 'primeiro')).join(' / ') || 'A definir';
  const quando = horarioMadriParaData(j.horarioMadri);
  const placar = (j.placar ?? []).map((s) => `${s.team_1}-${s.team_2}`).join(' ');
  const situacao = ENCERRADO.includes(j.status)
    ? `Resultado: ${placar || 'encerrado'}`
    : j.status === 'live'
      ? 'Em quadra agora'
      : quando
        ? `${rotuloDia(diaISO(quando))} às ${horaBR(quando)} (Brasília)`
        : 'Horário a definir';
  const assistir = j.ondeAssistir.length && !ENCERRADO.includes(j.status) ? `\n📺 ${j.ondeAssistir.map((c) => c.nome).join(', ')}` : '';
  return `🎾 ${j.torneio.nome} · ${RODADAS[j.rodada] ?? j.nomeRodada} ${CATEGORIAS[j.categoria].toLowerCase()}\n${dupla(j.dupla1)} x ${dupla(j.dupla2)}\n${situacao}${assistir}`;
}

export function LinhaJogo({ jogo: j }: { jogo: Jogo }) {
  const seguindo = useSeguindo();
  const aindaVai = j.status === 'scheduled' || j.status === 'live';
  const nomes = (d: Jogo['dupla1']) => d.map((p) => (
    <>
      <Bandeira pais={p.pais} />
      <NomeJogador nome={p.nome} sobrenome="primeiro" />
    </>
  ));
  const sets = (lado: 'team_1' | 'team_2') => (j.placar ?? []).map((s) => s[lado]);
  const estrela = (d: Jogo['dupla1']) =>
    d.length > 0 && (
      <Seguir
        tipo="dupla"
        rotulo={nomesDupla(d).join(' / ')}
        ativo={seguindo.segueDupla(nomesDupla(d))}
        onAlternar={() => seguindo.alternarDupla(nomesDupla(d))}
        className="-ml-1.5 -mr-1"
      />
    );
  const quando = horarioMadriParaData(j.horarioMadri);
  const agenda = j.status === 'scheduled' && quando
    ? [{
        id: idJogoMundial(j),
        inicio: quando,
        titulo: `${nomesDupla(j.dupla1).map((n) => nomeCurto(n, 'primeiro')).join('/')} x ${nomesDupla(j.dupla2).map((n) => nomeCurto(n, 'primeiro')).join('/')}`,
        local: [j.torneio.nome, j.quadra].filter(Boolean).join(' · '),
        descricao: textoJogo(j),
        link: linkDaRota({ aba: 'jogos', dia: diaMundial(j) ?? undefined, jogo: idJogoMundial(j) }),
      }]
    : undefined;
  return (
    <div className="flex gap-3 px-4 py-3 sm:gap-4">
      <ColunaHora info={infoHora(j)} />
      <div className="min-w-0 flex-1 space-y-1">
        <LinhaDupla nomes={nomes(j.dupla1)} sets={sets('team_1')} venceu={j.vencedor === 'team_1'} cabeca={j.cabecas?.team_1} antes={estrela(j.dupla1)} />
        <LinhaDupla nomes={nomes(j.dupla2)} sets={sets('team_2')} venceu={j.vencedor === 'team_2'} cabeca={j.cabecas?.team_2} antes={estrela(j.dupla2)} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span>{[RODADAS[j.rodada] ?? j.nomeRodada, CATEGORIAS[j.categoria], j.quadra].filter(Boolean).join(' · ')}</span>
          <span className="ml-auto flex items-center gap-2">
            {aindaVai && <Canais canais={j.ondeAssistir} torneio={j.torneio.nome} />}
            {!aindaVai && j.duracao && <span>{j.duracao}</span>}
            <MenuAcoes
              tipo="jogo"
              texto={textoJogo(j)}
              link={linkDaRota({ aba: 'jogos', dia: diaMundial(j) ?? undefined, jogo: idJogoMundial(j) })}
              agenda={agenda}
              arquivoAgenda={`jogo-${j.torneio.nome}`}
            />
          </span>
        </div>
      </div>
    </div>
  );
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
              <Canais canais={t.ondeAssistir ?? []} torneio={t.nome} />
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
