// Gera a versão estática do site (para o GitHub Pages): copia public/ e grava cada rota
// /dados/* como arquivo JSON. Roda no GitHub Actions a cada 15 minutos; o token da Padel API
// vem do segredo PADEL_API_TOKEN e nunca vai para os arquivos publicados.
//
//   node scripts/gerar-site.js [pasta-de-saída]   (padrão: _site)
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas, torneiosBrConfigurados } from '../src/rotas.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SAIDA = join(RAIZ, process.argv[2] ?? '_site');

try { process.loadEnvFile(join(RAIZ, '.env')); } catch { /* no Actions o token vem do ambiente */ }

const { modo, rotas } = criarRotas(process.env.PADEL_API_TOKEN);

// rota do servidor -> arquivo publicado (mesma regra do endereco() em public/app.js)
const paginas = [
  ['/dados/agenda', 'dados/agenda.json'],
  ['/dados/resultados', 'dados/resultados.json'],
  ['/dados/torneios', 'dados/torneios.json'],
  ['/dados/ranking?categoria=men', 'dados/ranking-men.json'],
  ['/dados/ranking?categoria=women', 'dados/ranking-women.json'],
  ['/dados/br/torneios', 'dados/br/torneios.json'],
  ...(await torneiosBrConfigurados()).map((t) => [`/dados/br/torneio?id=${t.sportscore}`, `dados/br/torneio-${t.sportscore}.json`]),
];

await rm(SAIDA, { recursive: true, force: true });
await cp(join(RAIZ, 'public'), SAIDA, { recursive: true });

// O front lê esta marca para buscar dados/*.json em vez de /dados/*.
// ?v= em app.js e styles.css: o Pages guarda arquivo em cache por 10 min, e sem isso
// quem já visitou continuaria com o JS antigo depois de um deploy.
const versao = Date.now().toString(36);
const indice = join(SAIDA, 'index.html');
await writeFile(
  indice,
  (await readFile(indice, 'utf8'))
    .replace('content="servidor"', 'content="estatico"')
    .replace('href="styles.css"', `href="styles.css?v=${versao}"`)
    .replace('src="app.js"', `src="app.js?v=${versao}"`),
);

async function gravar(arquivo, conteudo) {
  const destino = join(SAIDA, arquivo);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, JSON.stringify(conteudo));
}

let falhas = 0;
for (const [rota, arquivo] of paginas) {
  const url = new URL(rota, 'http://gerador');
  try {
    await gravar(arquivo, await rotas[url.pathname](url));
    console.log(`ok    ${arquivo}`);
  } catch (erro) {
    falhas++;
    console.error(`FALHA ${arquivo}: ${erro.message}`);
    await gravar(arquivo, { erro: erro.message });
  }
}

await gravar('dados/status.json', { modo, hoje: (await rotas['/dados/status']()).hoje, geradoEm: new Date().toISOString(), falhas });
console.log(`\nSite gerado em ${SAIDA} (modo ${modo}, ${paginas.length - falhas}/${paginas.length} páginas de dados)`);
