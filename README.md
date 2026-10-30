# Por Três

> O nome vem do "por três": o smash que quica e sai da quadra por cima do vidro.
> Domínio: `portres.com.br` (registro.br, DNS no modo avançado apontando para o GitHub Pages).

Site simples com os jogos do pádel profissional (Premier Padel + FIP): agenda do dia,
resultados, calendário de torneios, ranking e **onde assistir**, tudo no horário de Brasília.

Os dados vêm da [Padel API](https://padelapi.org). O "onde assistir" não existe em API
nenhuma: fica em `data/onde-assistir.json`, mantido à mão.

**No ar:** https://portres.com.br

DNS no registro.br: quatro registros `A` para `185.199.108.153`, `.109.153`, `.110.153` e `.111.153`, e `www` como `CNAME`
para `sydrack033.github.io`. O domínio está configurado em **Settings > Pages** do repositório.

## Publicação (GitHub Pages)

O Pages só hospeda arquivo estático, então o site publicado não tem servidor:

- `scripts/gerar-site.js` roda as mesmas rotas do `server.js` (lógica em `src/rotas.js`) e grava
  cada uma como JSON em `_site/dados/`. O `index.html` publicado sai marcado como `estatico`,
  e o front passa a ler `dados/*.json` em vez de `/dados/*`.
- O GitHub Actions (`.github/workflows/deploy.yml`) roda isso **a cada push e a cada 5 minutos** e publica no
  Pages; cada execução leva uns 40 s. Quem dispara de 5 em 5 minutos é um Worker do Cloudflare (`gatilho/`, ver
  abaixo): o agendamento do próprio GitHub atrasa e pula execuções (já ficou 6 h sem rodar), então ele ficou só
  de reserva, duas vezes por hora.
- **Cache entre execuções:** o robô guarda as respostas das fontes em `.cache-robo/` e o Actions salva essa pasta
  de uma execução para a outra (`actions/cache`). Assim cada execução só busca o que pode ter mudado; os prazos
  estão no `TTL` de `src/fonte.js` e no `ttlBr` de `src/rotas.js`. O `dados/status.json` publicado mostra quantas
  chamadas a última execução gastou em cada fonte.
- O token da Padel API fica no segredo `PADEL_API_TOKEN` do repositório. Ele só existe durante o build
  e não vai para nenhum arquivo publicado.
- Para atualizar na hora: aba **Actions > Atualizar dados e publicar > Run workflow**.
- O GitHub desliga agendamentos de repositório público sem commit há 60 dias. Isso só afeta a reserva: o Worker
  dispara pelo `workflow_dispatch`, que não desliga.

Para gerar e olhar a versão estática localmente: `npm run gerar` (sai em `_site/`).

### Gatilho de 5 em 5 minutos (Cloudflare Worker)

O agendamento do GitHub Actions não tem hora garantida: em dia cheio ele atrasa e pula execuções. O `gatilho/` é um
Worker do Cloudflare (grátis: até 100 mil execuções por dia) com um cron de 5 em 5 minutos que chama o
`workflow_dispatch` do `deploy.yml`. Não tem endereço público: só roda pelo cron.

Para montar (uma vez):

1. Token no GitHub (https://github.com/settings/personal-access-tokens/new): fine-grained,
   **Only select repositories → por-tres**, permissão **Actions: Read and write** e mais nada.
2. `cd gatilho && npm install && npx wrangler login` (abre o navegador para autorizar a conta do Cloudflare).
3. `npx wrangler deploy` (cria o Worker e o cron).
4. `npx wrangler secret put GITHUB_TOKEN` e cola o token do passo 1.

Para conferir: a aba Actions mostra uma execução `workflow_dispatch` a cada 5 minutos; no Cloudflare, o log de cada
disparo fica em **Workers > por-tres-gatilho > Logs**. Token vencido: gera outro igual e repete o passo 4.

### Analytics (Cloudflare Web Analytics)

Grátis, sem cookie (não precisa de banner) e funciona no Pages. Para ligar:

1. Cria conta grátis em https://dash.cloudflare.com, vai em **Analytics & Logs > Web Analytics > Add a site**
   e informa `portres.com.br`.
2. Copia o **token** que aparece no trecho `data-cf-beacon='{"token": "…"}'`.
3. No GitHub: **Settings > Secrets and variables > Actions > Variables > New variable**, nome
   `CF_BEACON_TOKEN`, valor = o token. (Ou: `gh variable set CF_BEACON_TOKEN -R sydrack033/por-tres`.)
4. Roda o workflow de novo. O token não é segredo: ele aparece no HTML de qualquer site que usa o Cloudflare.

Sem a variável, o site sai sem analytics nenhum.

## Rodar

Precisa de Node 20 ou mais novo.

```bash
npm --prefix web install   # uma vez
npm run build              # compila o front (web/ -> web/dist)
npm start                  # servidor com dados na hora: http://localhost:3030
```

Para mexer no visual com recarga instantânea, deixa o `npm start` rodando e abre outro terminal com
`npm run dev:web` (http://localhost:5180; o Vite repassa `/dados` para a porta 3030).

Sem token o circuito mundial sobe em **modo demonstração**, com dados fictícios (a aba Brasil é sempre real).

## App instalável (PWA)

O site instala como app no celular (e no computador), abre em tela cheia e funciona **sem internet**
mostrando os últimos dados salvos.

- `web/public/manifest.webmanifest`: nome, cores e ícones do app.
- `web/public/sw.js`: service worker. Página e dados: rede primeiro, sem rede usa a última cópia.
  JS/CSS/fontes/ícones: do cache (têm hash no nome). Bandeiras: cache, atualizando por trás.
  Ao mudar a estratégia de cache, sobe a constante `VERSAO` para limpar os caches antigos.
- Só registra no site compilado (no `npm run dev:web` ele não entra, para não atrapalhar o recarregamento).
- Convite "Instalar" no topo: no Android/Chrome abre a instalação nativa; no iPhone mostra o passo a passo
  (Compartilhar > Adicionar à Tela de Início). "×" esconde por 30 dias.
- Ícones: `node web/scripts/gerar-icones.mjs` gera os PNG em `web/public/icons/` a partir do SVG do script.

Próximo degrau, se quiser ir para as lojas: Capacitor embrulha este mesmo `web/` em app iOS/Android.

## Front (web/)

React + Vite + TypeScript, **Tailwind CSS**, componentes **shadcn/ui** (Radix), **TanStack Query** para
buscar e atualizar os dados sozinho, ícones **Lucide** e fontes Barlow / Barlow Condensed (`@fontsource`,
servidas pelo próprio site). Tema claro/escuro segue o sistema.

- **Aba Jogos** (estilo SofaScore): faixa de datas + calendário (bolinha nos dias com jogo) e os jogos do dia
  escolhido separados por campeonato, cada um recolhível ("Recolher todos" também; fica salvo no navegador).
  Junta circuito mundial e torneios do Brasil. Os dados vêm de `/dados/jogos` (`dados/jogos.json` no Pages):
  uma janela de 10 dias para trás e 21 para frente; o front só filtra pelo dia.
- Cada jogo é uma linha, com o **horário numa coluna fixa à esquerda** (dia embaixo; "AO VIVO" no lugar da
  hora quando está em quadra), como nos sites de resultados.
- `web/src/lib/dados.ts`: tipos e `useDados()`; decide entre `/dados/*` (servidor) e `dados/*.json` (Pages)
  pela `<meta name="modo-dados">`.
- `web/src/secoes/`: abas do circuito mundial (`Mundial.tsx`) e do Brasil (`Brasil.tsx`).
- `web/src/components/ui/`: componentes do shadcn (gerados pelo `npx shadcn add`, editáveis).

## Ligar nos dados de verdade

1. Cria a conta grátis em https://padelapi.org e gera um token.
2. Copia `.env.example` para `.env` e cola o token em `PADEL_API_TOKEN`.
3. Reinicia o servidor.

O token fica só no servidor: o navegador chama `/dados/*` e o servidor fala com a Padel API.

### Limites do plano Free

- 10 req/min, 2.000/dia, 50 mil/mês (o consumo aparece na página **Logs & Quota** da Padel API).
  O servidor e o robô guardam cache (lista de torneios 1 h, ranking 6 h, jogos de torneio em andamento 3 min,
  de torneio que ainda vai começar 30 min, de torneio encerrado 12 h) e seguram as chamadas para não passar de
  9 por minuto.
- Conta do robô de 5 em 5 minutos: com um torneio rolando, cada execução gasta ~3 chamadas (as páginas de jogos
  dele), mais ~55 por dia de listas e ranking. Dá umas 920 por dia, **~28 mil por mês**. Sem o cache entre
  execuções seriam 7 a 10 por vez, o que estoura os 2.000 por dia.
- Resultados só dos últimos 6 meses; ranking só a semana atual.
- **Sem placar ao vivo**: o placar aparece quando o jogo termina (o site mostra "placar no fim" no jogo ao vivo).
  Ao vivo é no plano Pro.

## Torneios no Brasil (aba Brasil)

Vêm do **SportScore** (sportscore.com.br), o sistema que a Liga Brasileira de Padel e vários clubes
de SC usam. Não precisa de token.

- A página de torneio do SportScore busca os jogos em `jogos.sportscore.com.br/api/timeline/?id=…`.
  Essa "API" devolve **HTML pronto** (é feita para embutir em site de clube), não JSON;
  `src/sportscore.js` lê esse HTML e transforma em JSON. Filtros da fonte: `cat`, `club`, `data`,
  `sit` (1 aberto, 2 confirmado, 3 iniciado, 9 em análise, 10 finalizado). Também existe `api/bracket/?id=&cat=`.
- **Não é documentada nem oficial**: pode mudar sem aviso. São 2 chamadas por torneio, com cache de 3 minutos para
  o torneio que está acontecendo hoje, 1 hora para o que vai começar e 12 horas para o que já acabou.
  Antes de publicar o site, vale pedir autorização/parceria ao SportScore.
- Sem CORS: só funciona chamando pelo servidor (`/dados/br/*`), nunca direto do navegador.
- Os torneios acompanhados ficam em `data/torneios-br.json` (ID do SportScore, nome, cidade, datas, links).
  Para incluir um torneio novo, pega o número na URL do SportScore (`/timeline/{id}/...`) e adiciona lá.
- Torneio com inscrição aberta e tabela ainda não gerada aparece como "Tabela de jogos ainda não publicada".
- Na tela do torneio: filtro por categoria, situação (em quadra, próximos, encerrados) e busca pelo nome do jogador.

## Onde assistir

`data/onde-assistir.json` tem:

- `canais`: nome, tipo (grátis, TV a cabo, streaming) e link.
- `regras`: por nível do torneio (`major`, `p1`, `p2`, `finals`, `fip_platinum`...) e rodada
  (1 = final, 2 = semi, 4 = quartas, 8 = oitavas, 16, 32). Todas as regras que batem somam canais.
- `por_torneio`: canal extra para um torneio específico, pelo trecho do nome.

O arquivo é relido a cada requisição, então não precisa reiniciar depois de editar.

## Estrutura

| Arquivo | O que é |
|---|---|
| `server.js` | servidor HTTP: front compilado (`web/dist`) + rotas `/dados/*` |
| `src/rotas.js` | monta cada rota `/dados/*` (usado pelo servidor e pelo gerador) |
| `src/fonte.js` | Padel API (cache + limitador) ou `data/demo.json` |
| `src/sportscore.js` | lê a timeline do SportScore e transforma em JSON |
| `src/transmissao.js` | aplica as regras de onde assistir |
| `scripts/gerar-site.js` | gera a versão estática para o Pages |
| `gatilho/` | Worker do Cloudflare que dispara o robô de 5 em 5 minutos |
| `web/` | o site (React + Tailwind + shadcn/ui) |
