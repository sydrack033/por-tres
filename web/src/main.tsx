import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './index.css';
import App from './App';
import { registrarServiceWorker } from '@/components/pwa';

registrarServiceWorker();

// Tema segue o sistema (escuro é o mais comum à noite, vendo jogo)
const escuro = window.matchMedia('(prefers-color-scheme: dark)');
const aplicarTema = () => document.documentElement.classList.toggle('dark', escuro.matches);
aplicarTema();
escuro.addEventListener('change', aplicarTema);

const consultas = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
