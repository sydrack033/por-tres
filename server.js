// Servidor do site de pádel: serve o front (public/) e monta os dados em /dados/*.
// O token da Padel API fica só aqui no servidor; o navegador nunca o vê.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRotas } from './src/rotas.js';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));

// Só o .env do projeto, nunca o da pasta de onde o node foi chamado
try { process.loadEnvFile(join(RAIZ, '.env')); } catch { /* sem .env: modo demonstração */ }
// Front compilado (npm --prefix web run build). Para mexer no visual, use o Vite: npm --prefix web run dev
const PUBLICO = join(RAIZ, 'web', 'dist');
const PORTA = Number(process.env.PORT) || 3030;

const { modo, rotas: ROTAS } = criarRotas(process.env.PADEL_API_TOKEN);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function responderJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

async function servirEstatico(res, caminho) {
  const relativo = normalize(caminho === '/' ? '/index.html' : caminho).replace(/^([/\\])+/, '');
  const arquivo = join(PUBLICO, relativo);
  if (!arquivo.startsWith(PUBLICO)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rota = ROTAS[url.pathname];
  if (!rota) return servirEstatico(res, url.pathname);
  try {
    responderJson(res, 200, await rota(url));
  } catch (erro) {
    console.error(`[${url.pathname}]`, erro.message);
    responderJson(res, erro.status ?? 502, { erro: erro.message });
  }
}).listen(PORTA, () => {
  console.log(`Pádel no ar em http://localhost:${PORTA} (modo ${modo})`);
});
