import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5330,
    proxy: {
      '/api': 'http://localhost:5329',
      '/audio': 'http://localhost:5329',
      '/artwork': 'http://localhost:5329'
    }
  }
});
