// Peças pequenas usadas em várias telas.
import { AlertCircle, Inbox, Tv } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { periodo } from '@/lib/formato';
import type { Canal } from '@/lib/dados';

export function Bandeira({ pais, className }: { pais?: string | null; className?: string }) {
  if (!pais || !/^[A-Za-z]{2}$/.test(pais)) return null;
  const cc = pais.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/20x15/${cc}.png`}
      srcSet={`https://flagcdn.com/40x30/${cc}.png 2x`}
      width={16}
      height={12}
      alt={pais.toUpperCase()}
      loading="lazy"
      className={cn('inline-block h-3 w-4 shrink-0 rounded-[2px] object-cover', className)}
    />
  );
}

// Coluna do horário: mesma largura em todas as linhas, para o olho correr de cima a baixo
export type InfoHora = { tipo: 'agendado' | 'vivo' | 'fim' | 'indefinido'; hora: string; dia?: string; nota?: string };

export function ColunaHora({ info }: { info: InfoHora }) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-start gap-0.5 pt-0.5 sm:w-16">
      {info.tipo === 'vivo' ? (
        <span className="inline-flex items-center gap-1 rounded bg-vivo/15 px-1.5 py-0.5 font-display text-[13px] font-bold uppercase tracking-wide text-vivo">
          <span className="size-1.5 animate-pulse rounded-full bg-vivo" />
          Vivo
        </span>
      ) : (
        <span
          className={cn(
            'font-display text-[17px] font-semibold leading-none tabular-nums',
            info.tipo === 'fim' || info.tipo === 'indefinido' ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {info.hora}
        </span>
      )}
      {info.dia && <span className="text-[11px] leading-tight text-muted-foreground">{info.dia}</span>}
      {info.nota && <span className="text-[10px] leading-tight text-muted-foreground/80">{info.nota}</span>}
    </div>
  );
}

// Uma dupla: nomes à esquerda, games de cada set à direita
export function LinhaDupla({
  nomes,
  sets,
  venceu,
  cabeca,
}: {
  nomes: React.ReactNode[];
  sets: string[];
  venceu: boolean;
  cabeca?: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('min-w-0 flex-1 text-[15px] leading-snug', venceu && 'font-semibold')}>
        {nomes.length ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-1">
            {nomes.map((n, i) => (
              <span key={i} className="inline-flex min-w-0 items-center gap-1.5 truncate">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {n}
              </span>
            ))}
            {cabeca && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({cabeca})</span>}
          </span>
        ) : (
          <span className="italic text-muted-foreground">A definir</span>
        )}
      </div>
      {sets.length > 0 && (
        <div className="flex gap-1 font-display tabular-nums">
          {sets.map((s, i) => (
            <span
              key={i}
              className={cn(
                'grid h-6 min-w-6 place-items-center rounded px-1 text-[15px]',
                venceu ? 'bg-primary/15 font-bold text-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Canais({ canais }: { canais: Canal[] }) {
  if (!canais.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tv className="size-3.5 text-muted-foreground" aria-hidden />
      {canais.map((c) => (
        <a
          key={c.id}
          href={c.url}
          target="_blank"
          rel="noopener"
          title={c.tipo}
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:border-primary hover:text-foreground',
            c.tipo === 'grátis' ? 'border-primary/50 text-primary' : 'text-muted-foreground',
          )}
        >
          {c.nome}
        </a>
      ))}
    </div>
  );
}

// Vídeo do YouTube (watch?v=, youtu.be/, /live/, /embed/): devolve o id, ou null se não for
export function idYouTube(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:live|embed)\/([\w-]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Transmissão no YouTube tocando no próprio site (sem cookie até dar play)
export function PlayerYouTube({ canais }: { canais: Canal[] }) {
  const canal = canais.find((c) => idYouTube(c.url));
  if (!canal) return null;
  return (
    <div className="overflow-hidden rounded-xl border bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${idYouTube(canal.url)}?rel=0`}
        title={`Transmissão: ${canal.nome}`}
        className="aspect-video w-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

const NIVEIS: Record<string, string> = {
  major: 'Major', p1: 'P1', p2: 'P2', finals: 'Finals', fip_platinum: 'FIP Platinum', fip_gold: 'FIP Gold',
};

export function CabecalhoTorneio({
  nome,
  nivel,
  pais,
  local,
  inicio,
  fim,
  extra,
}: {
  nome: string;
  nivel?: string | null;
  pais?: string | null;
  local?: string | null;
  inicio?: string | null;
  fim?: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 pb-2">
      <h3 className="font-display text-xl font-bold tracking-tight">{nome}</h3>
      {nivel && (
        <span className="rounded bg-bola px-1.5 py-px font-display text-xs font-bold uppercase text-black/80">
          {NIVEIS[nivel] ?? nivel}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Bandeira pais={pais} />
        {[local, (inicio || fim) && periodo(inicio, fim)].filter(Boolean).join(' · ')}
      </span>
      {extra}
    </div>
  );
}

export function Carregando({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-9 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Aviso({ tipo = 'vazio', children }: { tipo?: 'vazio' | 'erro'; children: React.ReactNode }) {
  const Icone = tipo === 'erro' ? AlertCircle : Inbox;
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm', tipo === 'erro' ? 'text-destructive' : 'text-muted-foreground')}>
      <Icone className="size-5" />
      {children}
    </div>
  );
}
