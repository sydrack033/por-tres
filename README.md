# Pádel Agora

Site simples com os jogos do pádel profissional (Premier Padel + FIP): agenda do dia,
resultados, calendário de torneios, ranking e **onde assistir**, tudo no horário de Brasília.

Os dados vêm da [Padel API](https://padelapi.org). O "onde assistir" não existe em API
nenhuma: fica em `data/onde-assistir.json`, mantido à mão.

**No ar:** https://sydrack033.github.io/padel-agora/

## Publicação (GitHub Pages)

O Pages só hospeda arquivo estático, então o site publicado não tem servidor:

- `scripts/gerar-site.js` roda as mesmas rotas do `server.js` (lógica em `src/rotas.js`) e grava
  cada uma como JSON em `_site/dados/`. O `index.html` publicado sai marcado como `estatico`,
  e o front passa a ler `dados/*.json` em vez de `/dados/*`.
- O GitHub Actions (`.github/workflows/deploy.yml`) roda isso **a cada push e a cada 15 minutos**
  e publica no Pages. O placar no ar fica no máximo uns 15–20 min atrás (o agendamento do GitHub atrasa um pouco).
- O token da Padel API fica no segredo `PADEL_API_TOKEN` do repositório. Ele só existe durante o build
  e não vai para nenhum arquivo publicado.
- Para atualizar na hora: aba **Actions > Atualizar dados e publicar > Run workflow**.
- O GitHub desliga agendamentos de repositório público sem commit há 60 dias; se o placar parar, basta um commit
  ou rodar o workflow na mão.

Para gerar e olhar a versão estática localmente: `npm run gerar` (sai em `_site/`).

### Analytics (Cloudflare Web Analytics)

Grátis, sem cookie (não precisa de banner) e funciona no Pages. Para ligar:

1. Cria conta grátis em https://dash.cloudflare.com, vai em **Analytics & Logs > Web Analytics > Add a site**
   e informa `sydrack033.github.io`.
2. Copia o **token** que aparece no trecho `data-cf-beacon='{"token": "…"}'`.
3. No GitHub: **Settings > Secrets and variables > Actions > Variables > New variable**, nome
   `CF_BEACON_TOKEN`, valor = o token. (Ou: `gh variable set CF_BEACON_TOKEN -R sydrack033/padel-agora`.)
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

## Front (web/)

React + Vite + TypeScript, **Tailwind CSS**, componentes **shadcn/ui** (Radix), **TanStack Query** para
buscar e atualizar os dados sozinho, ícones **Lucide** e fontes Barlow / Barlow Condensed (`@fontsource`,
servidas pelo próprio site). Tema claro/escuro segue o sistema.

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

- 10 req/min, 2.000/dia, 50 mil/mês. O servidor guarda cache (torneios 30 min, jogos 3 min,
  ranking 6 h) e segura as chamadas para não passar de 9 por minuto.
- Resultados só dos últimos 6 meses; ranking só a semana atual.
- **Sem placar ao vivo**: o placar aparece quando o jogo termina. Ao vivo é no plano Pro.

## Torneios no Brasil (aba Brasil)

Vêm do **SportScore** (sportscore.com.br), o sistema que a Liga Brasileira de Padel e vários clubes
de SC usam. Não precisa de token.

- A página de torneio do SportScore busca os jogos em `jogos.sportscore.com.br/api/timeline/?id=…`.
  Essa "API" devolve **HTML pronto** (é feita para embutir em site de clube), não JSON;
  `src/sportscore.js` lê esse HTML e transforma em JSON. Filtros da fonte: `cat`, `club`, `data`,
  `sit` (1 aberto, 2 confirmado, 3 iniciado, 9 em análise, 10 finalizado). Também existe `api/bracket/?id=&cat=`.
- **Não é documentada nem oficial**: pode mudar sem aviso. Cache de 2 minutos e no máximo 2 chamadas por torneio.
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
| `web/` | o site (React + Tailwind + shadcn/ui) |
