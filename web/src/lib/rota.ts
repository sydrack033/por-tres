// Endereço de cada tela no "#" da URL, para dar link direto (e o botão Voltar do celular funcionar):
//   #/jogos/2026-10-31            aba Jogos naquele dia
//   #/jogos/2026-10-31/j/br-519-8-9   ... e destaca um jogo
//   #/brasil/519                  torneio do Brasil (de fora da lista também: vem pela API)
//   #/brasil/519?cat=4ª Masculina  ... já filtrado numa categoria
//   #/brasil/519?j=8-9             ... e destaca um jogo
//   #/calendario  #/ranking
// O site é uma página só (GitHub Pages); o "#" não vai para o servidor.
import { useSyncExternalStore } from 'react';

export type Aba = 'jogos' | 'calendario' | 'ranking' | 'brasil';

export type Rota = {
  aba: Aba;
  dia?: string;
  jogo?: string;
  torneio?: number;
  categoria?: string;
};

const ABAS: Aba[] = ['jogos', 'calendario', 'ranking', 'brasil'];

export function lerRota(hash = location.hash): Rota {
  const [caminho, consulta = ''] = hash.replace(/^#\/?/, '').split('?');
  const partes = caminho.split('/').filter(Boolean).map(decodeURIComponent);
  const aba = ABAS.includes(partes[0] as Aba) ? (partes[0] as Aba) : 'jogos';
  const params = new URLSearchParams(consulta);
  if (aba === 'jogos') {
    const dia = /^\d{4}-\d\d-\d\d$/.test(partes[1] ?? '') ? partes[1] : undefined;
    return { aba, dia, jogo: partes[2] === 'j' ? partes[3] : undefined };
  }
  if (aba === 'brasil') {
    const torneio = /^\d{1,6}$/.test(partes[1] ?? '') ? Number(partes[1]) : undefined;
    return { aba, torneio, categoria: params.get('cat') ?? undefined, jogo: params.get('j') ?? undefined };
  }
  return { aba };
}

export function hashDaRota(r: Rota): string {
  const e = encodeURIComponent;
  if (r.aba === 'jogos') return `#/jogos${r.dia ? `/${r.dia}` : ''}${r.dia && r.jogo ? `/j/${e(r.jogo)}` : ''}`;
  if (r.aba === 'brasil' && r.torneio) {
    const q = [r.categoria && `cat=${e(r.categoria)}`, r.jogo && `j=${e(r.jogo)}`].filter(Boolean).join('&');
    return `#/brasil/${r.torneio}${q ? `?${q}` : ''}`;
  }
  return `#/${r.aba}`;
}

// Link completo (para compartilhar)
export const linkDaRota = (r: Rota) => `${location.origin}${location.pathname}${hashDaRota(r)}`;

// empilhar = vira um passo no histórico (o Voltar do celular desfaz); senão só troca o endereço
export function irPara(r: Rota, { empilhar = false } = {}) {
  const hash = hashDaRota(r);
  if (hash === location.hash || (hash === '#/jogos' && !location.hash)) return;
  if (empilhar) location.hash = hash;
  else {
    history.replaceState(history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

const assinar = (aviso: () => void) => {
  window.addEventListener('hashchange', aviso);
  return () => window.removeEventListener('hashchange', aviso);
};

export function useRota(): Rota {
  const hash = useSyncExternalStore(assinar, () => location.hash);
  return lerRota(hash);
}
