// Ações de cada jogo/torneio: seguir (estrela), mandar no grupo, copiar link e adicionar à agenda.
import { useState } from 'react';
import { CalendarPlus, Check, Link2, MoreHorizontal, Send, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { registrar } from '@/components/partes';
import { adicionarAgenda, compartilhar, copiarLink, type EventoAgenda } from '@/lib/compartilhar';
import { cn } from '@/lib/utils';

export function BotaoSeguir({
  ativo,
  onAlternar,
  rotulo,
  className,
}: {
  ativo: boolean;
  onAlternar: () => void;
  rotulo: string; // "a dupla Fulano / Beltrano", "o torneio X"
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // no cabeçalho do campeonato, não recolhe o grupo
        onAlternar();
      }}
      aria-pressed={ativo}
      aria-label={ativo ? `Deixar de seguir ${rotulo}` : `Seguir ${rotulo}`}
      title={ativo ? 'Seguindo' : 'Seguir'}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded transition-colors',
        ativo ? 'text-bola' : 'text-muted-foreground/50 hover:text-foreground',
        className,
      )}
    >
      <Star className={cn('size-3.5', ativo && 'fill-current')} />
    </button>
  );
}

// Estrela de seguir que também conta no Umami
export function Seguir({ ativo, onAlternar, rotulo, tipo, className }: {
  ativo: boolean;
  onAlternar: () => boolean; // devolve se ficou seguindo
  rotulo: string;
  tipo: 'dupla' | 'torneio';
  className?: string;
}) {
  return (
    <BotaoSeguir
      ativo={ativo}
      rotulo={rotulo}
      className={className}
      onAlternar={() => registrar(onAlternar() ? 'seguir' : 'deixar-de-seguir', { tipo, nome: rotulo })}
    />
  );
}

function ItemMenu({ icone, children, onClick }: { icone: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground"
    >
      {icone}
      {children}
    </button>
  );
}

// Os "..." de um jogo ou torneio
export function MenuAcoes({
  texto,
  link,
  tipo,
  agenda,
  arquivoAgenda,
  rotuloAgenda = 'Adicionar à agenda',
  className,
}: {
  texto: string; // o que vai na mensagem do grupo
  link: string;
  tipo: string; // para o Umami: "jogo", "torneio", "categoria"
  agenda?: EventoAgenda[];
  arquivoAgenda?: string;
  rotuloAgenda?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const fechar = () => setAberto(false);
  return (
    <Popover open={aberto} onOpenChange={(a) => { setAberto(a); setCopiado(false); }}>
      <PopoverTrigger
        aria-label="Compartilhar e agenda"
        className={cn('grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <ItemMenu icone={<Send />} onClick={() => { fechar(); void compartilhar(texto, link, tipo); }}>
          Mandar no grupo
        </ItemMenu>
        <ItemMenu
          icone={copiado ? <Check /> : <Link2 />}
          onClick={async () => {
            if (await copiarLink(link, tipo)) {
              setCopiado(true);
              setTimeout(fechar, 900);
            }
          }}
        >
          {copiado ? 'Link copiado' : 'Copiar link'}
        </ItemMenu>
        {agenda && agenda.length > 0 && (
          <ItemMenu icone={<CalendarPlus />} onClick={() => { fechar(); adicionarAgenda(agenda, arquivoAgenda ?? 'por-tres', tipo); }}>
            {rotuloAgenda}
          </ItemMenu>
        )}
      </PopoverContent>
    </Popover>
  );
}
