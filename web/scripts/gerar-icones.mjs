// Gera os ícones do app (PWA) a partir de um SVG: bola de pádel verde-limão sobre fundo grafite.
// Rodar só quando o desenho mudar:  node scripts/gerar-icones.mjs   (os PNG vão para public/icons)
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const FUNDO = '#151a17';
const BOLA = '#d4f44a';
const COSTURA = '#151a17';

// tamanho da bola em relação ao ícone: "maskable" precisa caber no círculo seguro de 80%
function svg({ raioBola, cantos }) {
  const r = 512 * raioBola;
  const c = 256;
  // costuras: duas curvas como a da bola de tênis/pádel
  const costura = (lado) => {
    const x = c + lado * r * 0.62;
    return `<path d="M ${c + lado * r * 0.98} ${c - r * 0.42} C ${x} ${c - r * 0.2}, ${x} ${c + r * 0.2}, ${c + lado * r * 0.98} ${c + r * 0.42}"
      fill="none" stroke="${COSTURA}" stroke-opacity=".35" stroke-width="${r * 0.09}" stroke-linecap="round"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${cantos}" fill="${FUNDO}"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="${BOLA}"/>
    ${costura(-1)}${costura(1)}
  </svg>`;
}

const DESTINO = new URL('../public/icons/', import.meta.url);
await mkdir(DESTINO, { recursive: true });

const normal = Buffer.from(svg({ raioBola: 0.36, cantos: 112 }));
const maskable = Buffer.from(svg({ raioBola: 0.29, cantos: 0 }));
const apple = Buffer.from(svg({ raioBola: 0.33, cantos: 0 })); // iOS arredonda sozinho e não aceita transparência

const saidas = [
  ['icon-192.png', normal, 192],
  ['icon-512.png', normal, 512],
  ['maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', apple, 180],
  ['favicon-32.png', normal, 32],
];
for (const [nome, fonte, tamanho] of saidas) {
  await sharp(fonte).resize(tamanho, tamanho).png().toFile(new URL(nome, DESTINO).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  console.log('ok', nome);
}
await writeFile(new URL('icone.svg', DESTINO), normal);
console.log('ok icone.svg');
