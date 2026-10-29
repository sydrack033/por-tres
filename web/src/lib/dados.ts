// Tipos e busca dos dados. Dois modos, decididos pela <meta name="modo-dados"> do index.html:
//  - "servidor": server.js local, rotas /dados/* (no dev o Vite repassa para a porta 3030)
//  - "estatico": GitHub Pages, arquivos dados/*.json gerados pelo robô a cada 15 minutos
import { useQuery } from '@tanstack/react-query';

export const ESTATICO = document.querySelector('meta[name="modo-dados"]')?.getAttribute('content') === 'estatico';

export function endereco(caminho: string, valor?: string) {
  if (ESTATICO) return `dados${caminho}${valor ? `-${valor}` : ''}.json`;
  const parametro = ({ '/ranking': 'categoria', '/br/torneio': 'id' } as Record<string, string>)[caminho];
  return `/dados${caminho}${valor ? `?${parametro}=${encodeURIComponent(valor)}` : ''}`;
}

async function buscar<T>(url: string): Promise<T> {
  // no-cache: o Pages guarda os JSON por 10 min; assim o navegador sempre confere se mudou
  const resp = await fetch(url, { cache: 'no-cache' });
  const corpo = await resp.json();
  if (!resp.ok || corpo?.erro) throw new Error(corpo?.erro ?? `Erro ${resp.status}`);
  return corpo as T;
}

const DOIS_MINUTOS = 2 * 60_000;

export function useDados<T>(caminho: string, valor?: string, { ativo = true, aoVivo = false } = {}) {
  const url = endereco(caminho, valor);
  return useQuery({
    queryKey: [url],
    queryFn: () => buscar<T>(url),
    enabled: ativo,
    staleTime: 60_000,
    refetchInterval: aoVivo ? DOIS_MINUTOS : false,
  });
}

// ---------- circuito mundial (Padel API) ----------

export type Canal = { id: string; nome: string; tipo: string; url: string };
export type Jogador = { nome: string; pais: string | null };

export type Torneio = {
  id: number;
  nome: string;
  nivel: string;
  cidade: string;
  pais: string;
  status: string;
  inicio: string;
  fim: string;
  local: string | null;
  ondeAssistir?: Canal[];
};

export type Jogo = {
  id: number;
  categoria: 'men' | 'women';
  rodada: number;
  nomeRodada: string;
  status: string;
  dupla1: Jogador[];
  dupla2: Jogador[];
  cabecas: { team_1: string | null; team_2: string | null } | null;
  placar: { team_1: string; team_2: string }[] | null;
  vencedor: 'team_1' | 'team_2' | null;
  data: string | null;
  horarioMadri: string | null;
  rotuloHorario: string | null;
  quadra: string | null;
  ordemQuadra: number | null;
  duracao: string | null;
  torneio: Torneio;
  ondeAssistir: Canal[];
};

export type LinhaRanking = { posicao: number; variacao: number | string; nome: string; pais: string; pontos: number | string };
export type Status = { modo: 'api' | 'demo'; hoje: string; geradoEm?: string };

// ---------- torneios no Brasil (SportScore) ----------

export type TorneioBr = {
  id: number;
  nome: string;
  tituloFonte: string | null;
  cidade: string | null;
  local: string | null;
  inicio: string | null;
  fim: string | null;
  destaque: boolean;
  premio: string | null;
  links: { nome: string; url: string }[];
  publicado: boolean;
  status: 'live' | 'pending' | 'finished';
  jogos: { live: number; scheduled: number; finished: number };
  totalJogos: number;
};

export type DuplaBr = { jogadores: string[]; sets: string[] };

export type JogoBr = {
  id: string;
  data: string | null;
  hora: string | null;
  inicio: string | null;
  clube: string | null;
  quadra: string | null;
  categoria: string | null;
  chave: string | null;
  duracao: string | null;
  status: 'live' | 'scheduled' | 'finished';
  vencedor: 1 | 2 | null;
  dupla1: DuplaBr;
  dupla2: DuplaBr;
};

export type TorneioBrDetalhe = { torneio: TorneioBr; categorias: string[]; jogos: JogoBr[] };

// Aba Jogos: tudo de uma janela de dias; o front filtra pelo dia escolhido
export type JogosPeriodo = {
  hoje: string;
  de: string;
  ate: string;
  mundial: Jogo[];
  brasil: { torneio: TorneioBr; jogos: JogoBr[] }[];
};
