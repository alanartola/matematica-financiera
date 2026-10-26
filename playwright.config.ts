import { defineConfig, devices } from '@playwright/test';

/**
 * Por defecto las pruebas compilan la aplicación y la sirven localmente con el
 * mismo prefijo que GitHub Pages. Con E2E_BASE_URL se prueban contra el sitio
 * publicado, por ejemplo:
 *   E2E_BASE_URL=https://alanartola.github.io/matematica-financiera/ npm run test:e2e
 */
const remote = process.env.E2E_BASE_URL;
const baseURL = remote ?? 'http://localhost:4173/matematica-financiera/';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Un reintento absorbe demoras ocasionales al ejecutar muchas pruebas en paralelo.
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'es-AR',
  },
  projects: [
    { name: 'escritorio-1366', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'proyector-1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: remote
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
