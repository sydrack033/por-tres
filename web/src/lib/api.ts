// Busca de torneios do SportScore que NÃO estão na lista do site, pelo Worker api/ (por-tres-api).
// O navegador não chama o SportScore direto (sem CORS). O endereço do Worker:
//  1. <meta name="api-url" content="..."> no index.html, se houver (troca sem recompilar);
//  2. senão, VITE_API_URL na hora do build (ex.: VITE_API_URL=https://por-tres-api.<conta>.workers.dev);
//  3. sem nenhum dos dois, a busca externa fica desligada e a aba Brasil funciona igual (só a lista).
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TorneioBrDetalhe } from '@/lib/dados';

const API_URL = (
  document.querySelector('meta[name="api-url"]')?.getAttribute('content') ||
  import.meta.env.VITE_API_URL ||
  ''
).replace(/\/+$/, '');

export const API_LIGADA = API_URL !== '';

// Um torneio achado na listagem do SportScore
export type TorneioExterno = { id: number; titulo: string; organizador: string | null; temTabela: boolean; url: string };

async function buscarApi<T>(caminho: string): Promise<T> {
  const resp = await fetch(`${API_URL}${caminho}`);
  const corpo = await resp.json();
  if (!resp.ok || corpo?.erro) throw new Error(corpo?.erro ?? `Erro ${resp.status}`);
  return corpo as T;
}

// Só a partir de 3 letras: menos que isso casa com meio SportScore e não ajuda ninguém
export const MINIMO_BUSCA = 3;

export function useBuscaSportScore(termo: string) {
  const q = termo.trim();
  return useQuery({
    queryKey: ['api', 'buscar', q.toLowerCase()],
    queryFn: () => buscarApi<TorneioExterno[]>(`/br/buscar?q=${encodeURIComponent(q)}`),
    enabled: API_LIGADA && q.length >= MINIMO_BUSCA,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

// Mesmo formato de dados/br/torneio-<id>.json, montado na hora pelo Worker (não vai para a lista)
export function useTorneioExterno(id: number, { ativo = true } = {}) {
  return useQuery({
    queryKey: ['api', 'torneio', id],
    queryFn: () => buscarApi<TorneioBrDetalhe>(`/br/torneio?id=${id}`),
    enabled: API_LIGADA && ativo,
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
  });
}

// O valor só "chega" depois que para de mudar por `ms` (quem digita não dispara uma busca por letra)
export function useAtrasado<T>(valor: T, ms = 600): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}
