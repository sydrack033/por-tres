// "Onde assistir" não vem de API nenhuma: sai das regras em data/onde-assistir.json.
// Todas as regras que batem com o torneio/rodada somam canais; "por_torneio" acrescenta
// canais a um torneio específico (pelo trecho do nome).
import { readFile } from 'node:fs/promises';

const ARQUIVO = new URL('../data/onde-assistir.json', import.meta.url);

export async function carregarRegrasTransmissao() {
  // Relido a cada chamada: editou o JSON, a próxima atualização da página já pega.
  return JSON.parse(await readFile(ARQUIVO, 'utf8'));
}

export function canaisPara(regras, torneio, rodada) {
  const canais = new Map();
  const somar = (lista) => lista.forEach((id) => regras.canais[id] && canais.set(id, regras.canais[id]));

  for (const regra of regras.regras) {
    if (regra.niveis && !regra.niveis.includes(torneio.level)) continue;
    // rodada null = visão do torneio inteiro: vale qualquer regra do nível
    if (rodada !== null && regra.rodadas && !regra.rodadas.includes(rodada)) continue;
    somar(regra.canais);
  }
  for (const [trecho, lista] of Object.entries(regras.por_torneio ?? {})) {
    if (torneio.name?.toLowerCase().includes(trecho.toLowerCase())) somar(lista);
  }
  return [...canais.entries()].map(([id, c]) => ({ id, ...c }));
}
