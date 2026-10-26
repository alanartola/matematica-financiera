/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * La aplicación se publica en GitHub Pages bajo https://alanartola.github.io/matematica-financiera/,
 * por lo que la compilación usa ese prefijo. En desarrollo se sirve desde la raíz.
 * La navegación interna usa el fragmento de la URL (#/modulo/tema), de modo que
 * GitHub Pages no necesita reglas de redirección.
 */
export const PAGES_BASE = '/matematica-financiera/';

export default defineConfig(({ command, isPreview }) => ({
  // `vite preview` sirve la compilación con el mismo prefijo que GitHub Pages.
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
