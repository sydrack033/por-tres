// "Mandar no grupo" (WhatsApp ou o compartilhar do celular) e "Adicionar à agenda" (.ics).
import { registrar } from '@/components/partes';

// No celular abre o compartilhar do sistema (WhatsApp, Telegram...); no computador, o WhatsApp Web
export async function compartilhar(texto: string, link: string, tipo: string) {
  registrar('compartilhar', { tipo });
  if (navigator.share) {
    try {
      await navigator.share({ text: texto, url: link });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // a pessoa desistiu
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n${link}`)}`, '_blank', 'noopener');
}

export async function copiarLink(link: string, tipo: string) {
  registrar('copiar-link', { tipo });
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

// ---------- agenda (.ics) ----------

export type EventoAgenda = {
  id: string;
  inicio: Date;
  minutos?: number; // duração; padrão 1h30
  titulo: string;
  local?: string | null;
  descricao?: string;
  link?: string;
};

const DURACAO_PADRAO = 90;
const dataIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Texto no .ics: vírgula, ponto e vírgula, barra e quebra de linha vão escapados
const textoIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

function montarIcs(eventos: EventoAgenda[]) {
  const agora = dataIcs(new Date());
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Por Tres//portres.com.br//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of eventos) {
    const fim = new Date(e.inicio.getTime() + (e.minutos ?? DURACAO_PADRAO) * 60_000);
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@portres.com.br`,
      `DTSTAMP:${agora}`,
      `DTSTART:${dataIcs(e.inicio)}`,
      `DTEND:${dataIcs(fim)}`,
      `SUMMARY:${textoIcs(e.titulo)}`,
      ...(e.local ? [`LOCATION:${textoIcs(e.local)}`] : []),
      ...(e.descricao || e.link ? [`DESCRIPTION:${textoIcs([e.descricao, e.link].filter(Boolean).join('\n'))}`] : []),
      ...(e.link ? [`URL:${e.link}`] : []),
      // lembrete 30 min antes
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${textoIcs(e.titulo)}`, 'TRIGGER:-PT30M', 'END:VALARM',
      'END:VEVENT',
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n');
}

// Baixa o .ics: no celular abre direto o "adicionar ao calendário"
export function adicionarAgenda(eventos: EventoAgenda[], arquivo: string, tipo: string) {
  if (!eventos.length) return;
  registrar('agenda', { tipo, jogos: eventos.length });
  const url = URL.createObjectURL(new Blob([montarIcs(eventos)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${arquivo.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase()}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Horário do clube (Brasília) de um jogo do SportScore
export const inicioBr = (data: string | null, hora: string | null) =>
  data && hora ? new Date(`${data}T${hora}:00-03:00`) : null;
