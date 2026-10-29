import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AbaAgenda, AbaCalendario, AbaRanking, AbaResultados, type Categoria } from '@/secoes/Mundial';
import { AbaBrasil } from '@/secoes/Brasil';
import { ConviteInstalar, SeloSemInternet, useConectado } from '@/components/pwa';
import { ESTATICO, useDados, type Status } from '@/lib/dados';
import { horaBR } from '@/lib/formato';

const ABAS = [
  ['agenda', 'Agenda'],
  ['resultados', 'Resultados'],
  ['calendario', 'Calendário'],
  ['ranking', 'Ranking'],
  ['brasil', 'Brasil'],
] as const;
type Aba = (typeof ABAS)[number][0];

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <circle cx="16" cy="16" r="15" className="fill-bola" />
        <path d="M5 9c6 3 6 11 0 14M27 9c-6 3-6 11 0 14" className="fill-none stroke-black/30" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <p className="font-display text-2xl font-extrabold uppercase tracking-tight">
          Por <span className="text-primary">Três</span>
        </p>
        {/* o nome não diz que é pádel: a linha de baixo diz */}
        <p className="mt-0.5 text-xs text-muted-foreground">Pádel: jogos, resultados e onde assistir · horário de Brasília</p>
      </div>
    </div>
  );
}

function SituacaoDados() {
  const { data } = useDados<Status>('/status', undefined, { aoVivo: true });
  const conectado = useConectado();
  const quando = ESTATICO && data?.geradoEm ? horaBR(new Date(data.geradoEm)) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {!conectado && <SeloSemInternet />}
      <span className="inline-flex items-center gap-1.5">
        <RefreshCw className="size-3" />
        {quando ? `Dados de ${quando}` : 'Atualiza sozinho'}
      </span>
    </span>
  );
}

function AvisoDemo() {
  const { data } = useDados<Status>('/status');
  if (data?.modo !== 'demo') return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      <strong>Modo demonstração:</strong> circuito mundial com dados fictícios (sem token da Padel API). A aba Brasil é real.
    </div>
  );
}

function FiltroCategoria({ valor, onMudar, comTodos }: { valor: Categoria; onMudar: (c: Categoria) => void; comTodos: boolean }) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" value={valor} onValueChange={(v) => v && onMudar(v as Categoria)}>
      {comTodos && <ToggleGroupItem value="todos" className="px-3">Todos</ToggleGroupItem>}
      <ToggleGroupItem value="men" className="px-3">Masculino</ToggleGroupItem>
      <ToggleGroupItem value="women" className="px-3">Feminino</ToggleGroupItem>
    </ToggleGroup>
  );
}

export default function App() {
  const [aba, setAba] = useState<Aba>('agenda');
  const [categoria, setCategoria] = useState<Categoria>('todos');
  const categoriaRanking = categoria === 'women' ? 'women' : 'men';
  const temFiltro = aba === 'agenda' || aba === 'resultados' || aba === 'ranking';

  return (
    <div className="min-h-dvh">
      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="gap-0">
        {/* pt com safe-area: no iPhone instalado o app vai até atrás da barra de status */}
        <header className="sticky top-0 z-20 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 pt-4">
            <Marca />
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ABAS.map(([valor, rotulo]) => (
                <TabsTrigger
                  key={valor}
                  value={valor}
                  className="flex-none rounded-none border-0 border-b-2 border-transparent px-3 pb-2.5 pt-1 font-display text-base font-semibold uppercase tracking-wide text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                >
                  {rotulo}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5">
          <ConviteInstalar />
          <AvisoDemo />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {temFiltro ? (
              <FiltroCategoria
                valor={aba === 'ranking' ? categoriaRanking : categoria}
                onMudar={setCategoria}
                comTodos={aba !== 'ranking'}
              />
            ) : <span />}
            <SituacaoDados />
          </div>

          <TabsContent value="agenda"><AbaAgenda categoria={categoria} /></TabsContent>
          <TabsContent value="resultados"><AbaResultados categoria={categoria} /></TabsContent>
          <TabsContent value="calendario"><AbaCalendario /></TabsContent>
          <TabsContent value="ranking"><AbaRanking categoria={categoriaRanking} /></TabsContent>
          <TabsContent value="brasil"><AbaBrasil /></TabsContent>
        </main>
      </Tabs>

      <footer className="mx-auto max-w-4xl px-4 pb-10 pt-4 text-xs leading-relaxed text-muted-foreground">
        Dados: <a className="underline underline-offset-2 hover:text-foreground" href="https://padelapi.org" target="_blank" rel="noopener">Padel API</a> (circuito mundial)
        {' e '}
        <a className="underline underline-offset-2 hover:text-foreground" href="https://www.sportscore.com.br" target="_blank" rel="noopener">SportScore</a> (torneios no Brasil).
        {' '}"Onde assistir" é mantido à mão; confira no site oficial de cada torneio.
      </footer>
    </div>
  );
}
