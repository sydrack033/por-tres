// Partes do app instalável: convite para instalar e aviso de sem internet.
import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CHAVE_DISPENSA = 'pwa-dispensado-em';
const TRINTA_DIAS = 30 * 86_400_000;

const jaInstalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPhone/iPad no Safari não tem botão de instalar: só "Compartilhar > Adicionar à Tela de Início"
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function dispensadoRecentemente() {
  try {
    const em = Number(localStorage.getItem(CHAVE_DISPENSA));
    return em > 0 && Date.now() - em < TRINTA_DIAS;
  } catch {
    return false;
  }
}

export function ConviteInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [visivel, setVisivel] = useState(() => !jaInstalado() && !dispensadoRecentemente() && ehIOS());
  const [passosIOS, setPassosIOS] = useState(false);

  useEffect(() => {
    const aoOferecer = (e: Event) => {
      e.preventDefault(); // guarda para mostrar o nosso botão em vez da barra padrão
      setEvento(e as EventoInstalar);
      if (!jaInstalado() && !dispensadoRecentemente()) setVisivel(true);
    };
    const aoInstalar = () => setVisivel(false);
    window.addEventListener('beforeinstallprompt', aoOferecer);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoOferecer);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  if (!visivel) return null;

  const dispensar = () => {
    try { localStorage.setItem(CHAVE_DISPENSA, String(Date.now())); } catch { /* sem armazenamento */ }
    setVisivel(false);
  };

  const instalar = async () => {
    if (evento) {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === 'accepted') setVisivel(false);
      setEvento(null);
    } else {
      setPassosIOS((v) => !v);
    }
  };

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <img src="icons/icon-192.png" alt="" className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-semibold">Por Três no teu celular</p>
          <p className="text-xs text-muted-foreground">Abre como app, direto da tela inicial, e funciona sem internet.</p>
        </div>
        <Button size="sm" onClick={instalar}>
          <Download /> Instalar
        </Button>
        <button type="button" onClick={dispensar} aria-label="Agora não" className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      {passosIOS && (
        <ol className="mt-3 space-y-1.5 border-t pt-3 text-sm">
          <li className="flex items-center gap-2">
            <span className="font-display font-bold text-primary">1</span> Toque em <Share className="size-4" /> <strong>Compartilhar</strong> na barra do Safari
          </li>
          <li className="flex items-center gap-2">
            <span className="font-display font-bold text-primary">2</span> Escolha <SquarePlus className="size-4" /> <strong>Adicionar à Tela de Início</strong>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-display font-bold text-primary">3</span> Toque em <strong>Adicionar</strong>
          </li>
        </ol>
      )}
    </div>
  );
}

export function useConectado() {
  const [conectado, setConectado] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setConectado(true);
    const off = () => setConectado(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return conectado;
}

export function SeloSemInternet() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
      <WifiOff className="size-3" /> Sem internet · últimos dados salvos
    </span>
  );
}

// Só no site compilado: no `npm run dev` o service worker atrapalharia o recarregamento
export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* sem PWA, segue normal */ });
  });
}
