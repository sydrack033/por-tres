// A cada 5 minutos pede ao GitHub para rodar o workflow que atualiza o site (deploy.yml).
// O agendamento do próprio GitHub atrasa e pula execuções; o cron do Cloudflare chega na hora.
// GITHUB_TOKEN (segredo do Worker): token fine-grained só do repositório por-tres, com a
// permissão Actions em "Read and write" e mais nada.
const WORKFLOW = 'https://api.github.com/repos/sydrack033/por-tres/actions/workflows/deploy.yml/dispatches';

export default {
  async scheduled(_evento, env) {
    const resp = await fetch(WORKFLOW, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'por-tres-gatilho', // o GitHub recusa chamada sem User-Agent
      },
      body: JSON.stringify({ ref: 'main' }),
    });
    // 204 = disparou. Qualquer outra coisa vira erro no log do Worker, no painel do Cloudflare
    if (resp.status !== 204) throw new Error(`GitHub ${resp.status}: ${await resp.text()}`);
  },
};
