import { defineConfig } from 'vite';

// base './' — сайт живёт в подпапке GitHub Pages (/coderoom/)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
  worker: { format: 'es' },
  server: { port: 5173 },
});
