// Tema: escuro é o padrão (é a cara do site); o botão sol/lua troca e a escolha fica salva.
import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Tema = 'escuro' | 'claro';
const CHAVE = 'tema';

function temaSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro';
  } catch {
    return 'escuro';
  }
}

function aplicar(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'escuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'escuro' ? '#151a17' : '#f7f8f5');
}

export function aplicarTemaSalvo() {
  aplicar(temaSalvo());
}

export function BotaoTema() {
  const [tema, setTema] = useState<Tema>(temaSalvo);
  const trocar = () => {
    const novo: Tema = tema === 'escuro' ? 'claro' : 'escuro';
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento: vale só nesta visita */ }
    aplicar(novo);
    setTema(novo);
  };
  const Icone = tema === 'escuro' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={trocar}
      aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
      title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
      className="grid size-9 place-items-center rounded-full border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
    >
      <Icone className="size-4" />
    </button>
  );
}
