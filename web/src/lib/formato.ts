// Datas e horários: tudo mostrado no horário de Brasília.
export const FUSO_BR = 'America/Sao_Paulo';

const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BR, hour: '2-digit', minute: '2-digit' });
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' });
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' });

export const horaBR = (d: Date) => fmtHora.format(d);
export const diaISO = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BR }).format(d);
export const dataSemFuso = (iso: string) => new Date(`${iso}T12:00:00Z`);

// Diferença (ms) entre o relógio de um fuso e o UTC num dado instante
function deslocamentoFuso(fuso: string, instante: number) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instante).map((p) => [p.type, p.value]),
  );
  const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
  return comoUtc - instante;
}

// A Padel API manda horário de Madri; sem fuso explícito, interpreta como Europe/Madrid
export function horarioMadriParaData(texto?: string | null): Date | null {
  if (!texto) return null;
  if (/([zZ]|[+-]\d\d:?\d\d)$/.test(texto)) return new Date(texto);
  const m = texto.match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?/);
  if (!m) return null;
  const palpite = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  return new Date(palpite - deslocamentoFuso('Europe/Madrid', palpite));
}

// "Hoje", "Amanhã", "Ontem" ou "sex., 30/10"
export function rotuloDia(iso?: string | null) {
  if (!iso) return '';
  const agora = Date.now();
  if (iso === diaISO(new Date(agora))) return 'Hoje';
  if (iso === diaISO(new Date(agora + 86_400_000))) return 'Amanhã';
  if (iso === diaISO(new Date(agora - 86_400_000))) return 'Ontem';
  return fmtDiaSemana.format(dataSemFuso(iso));
}

export const diaLongo = (iso: string) => fmtDiaLongo.format(dataSemFuso(iso));
export const diaMes = (iso: string) => fmtDiaMes.format(dataSemFuso(iso));

export function periodo(inicio?: string | null, fim?: string | null) {
  if (!inicio) return 'Datas a confirmar';
  if (!fim || fim === inicio) return diaMes(inicio);
  return `${diaMes(inicio)} – ${diaMes(fim)}`;
}

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
