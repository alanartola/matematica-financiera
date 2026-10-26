/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` genera rutas relativas: el build funciona desde cualquier carpeta
// (y, si se autoriza en el futuro, desde GitHub Pages) sin reconfigurar.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
