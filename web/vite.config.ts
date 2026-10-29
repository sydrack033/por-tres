import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // caminhos relativos: o mesmo build roda em sydrack033.github.io/padel-agora/
  base: './',
  server: {
    // em desenvolvimento os dados vêm do server.js (npm start na raiz, porta 3030)
    proxy: { '/dados': 'http://localhost:3030' },
  },
});
