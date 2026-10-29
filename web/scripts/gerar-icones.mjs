// Gera os ícones do app (PWA) a partir do logo: o 3 com a bola passando por cima, num arco.
// Fontes do desenho: public/icons/logo.svg (tamanho grande) e public/icons/logo-pequeno.svg
// (arco mais grosso, para favicon e tamanhos pequenos).
// Rodar só quando o desenho mudar:  node scripts/gerar-icones.mjs   (os PNG vão para public/icons)
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const PASTA = new URL('../public/icons/', import.meta.url);
const caminho = (nome) => new URL(nome, PASTA).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const grande = await readFile(new URL('logo.svg', PASTA), 'utf8');
const pequeno = await readFile(new URL('logo-pequeno.svg', PASTA), 'utf8');

// fundo sem cantos e desenho encolhido: "maskable" precisa caber no círculo seguro de 80%;
// o iPhone arredonda sozinho e não aceita transparência
function semCantos(svg, escala) {
  const fundo = svg.match(/<rect [^>]*fill="([^"]+)"/)[1];
  const miolo = svg.replace(/^<svg[^>]*>\s*<rect [^>]*\/>/, '').replace(/<\/svg>\s*$/, '');
  const d = (512 * (1 - escala)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${fundo}"/><g transform="translate(${d} ${d}) scale(${escala})">${miolo}</g></svg>`;
}

const saidas = [
  ['icon-192.png', grande, 192],
  ['icon-512.png', grande, 512],
  ['maskable-512.png', semCantos(grande, 0.8), 512],
  ['apple-touch-icon.png', semCantos(grande, 0.92), 180],
  ['favicon-32.png', pequeno, 32],
];
for (const [nome, svg, tamanho] of saidas) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(tamanho, tamanho).png().toFile(caminho(nome));
  console.log('ok', nome);
}
