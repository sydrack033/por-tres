// Quem a pessoa segue (jogadores e torneios), guardado no navegador: sem login, sem servidor.
// "Seguir a dupla" é seguir os dois jogadores dela.
import { useSyncExternalStore } from 'react';
import { semAcento } from '@/lib/formato';

const CHAVE = 'seguindo';
const AVISO = 'seguindo-mudou';

type Seguindo = { jogadores: string[]; torneios: string[] };
const VAZIO: Seguindo = { jogadores: [], torneios: [] };

// Mesmo jogador com ou sem acento, maiúscula ou espaço sobrando conta igual
export const chaveJogador = (nome: string) => semAcento(nome).replace(/\s+/g, ' ').trim();
// Torneio: "m-<id>" (circuito mundial) ou "br-<id>" (SportScore)
export const chaveTorneio = (origem: 'm' | 'br', id: number | string) => `${origem}-${id}`;

let atual: Seguindo = ler();

function ler(): Seguindo {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    if (salvo && Array.isArray(salvo.jogadores) && Array.isArray(salvo.torneios)) return salvo;
  } catch {
    /* sem armazenamento: começa vazio */
  }
  return VAZIO;
}

function gravar(novo: Seguindo) {
  atual = novo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    /* modo privado: vale só nesta visita */
  }
  window.dispatchEvent(new Event(AVISO));
}

function assinar(aviso: () => void) {
  const daOutraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE) return;
    atual = ler();
    aviso();
  };
  window.addEventListener(AVISO, aviso);
  window.addEventListener('storage', daOutraAba);
  return () => {
    window.removeEventListener(AVISO, aviso);
    window.removeEventListener('storage', daOutraAba);
  };
}

const alternarNaLista = (lista: string[], item: string, ligar: boolean) =>
  ligar ? [...new Set([...lista, item])] : lista.filter((x) => x !== item);

export function useSeguindo() {
  const s = useSyncExternalStore(assinar, () => atual);
  const jogadores = new Set(s.jogadores);
  const torneios = new Set(s.torneios);

  const segueJogador = (nome: string) => jogadores.has(chaveJogador(nome));
  // Dupla seguida = todos os jogadores dela seguidos
  const segueDupla = (nomes: string[]) => nomes.length > 0 && nomes.every(segueJogador);
  const segueTorneio = (chave: string) => torneios.has(chave);

  return {
    algum: s.jogadores.length + s.torneios.length > 0,
    segueJogador,
    segueDupla,
    segueTorneio,
    // Jogo "meu": de torneio seguido ou com algum jogador seguido
    jogoMeu: (torneio: string, nomes: string[]) => torneios.has(torneio) || nomes.some(segueJogador),
    alternarDupla(nomes: string[]) {
      const ligar = !segueDupla(nomes);
      gravar({ ...atual, jogadores: nomes.reduce((l, n) => alternarNaLista(l, chaveJogador(n), ligar), atual.jogadores) });
      return ligar;
    },
    alternarTorneio(chave: string) {
      const ligar = !torneios.has(chave);
      gravar({ ...atual, torneios: alternarNaLista(atual.torneios, chave, ligar) });
      return ligar;
    },
  };
}
