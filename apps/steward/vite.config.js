import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  base: './',
  server: {
    port: 5179,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
