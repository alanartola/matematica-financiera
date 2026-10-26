import { expect, test, type Page } from '@playwright/test';

/** Todas las pantallas de trabajo de la aplicación. */
const ROUTES = [
  '/tasas/interes-simple',
  '/tasas/interes-compuesto',
  '/tasas/tasa-efectiva',
  '/tasas/tna',
  '/tasas/tea',
  '/tasas/comparador',
  '/amortizacion/frances',
  '/amortizacion/aleman',
  '/amortizacion/americano',
  '/amortizacion/bullet',
  '/amortizacion/comparador',
  '/laboratorio/simulador',
  '/laboratorio/capital-original',
  '/laboratorio/otros-inversos',
  '/valor-temporal/valor-actual',
  '/valor-temporal/valor-futuro',
  '/valor-temporal/van',
  '/valor-temporal/tir',
  '/valor-temporal/linea-de-tiempo',
  '/bancarias/plazo-fijo',
  '/bancarias/comparador',
  '/bancarias/prestamo',
  '/ejercicios/simple-vs-compuesto',
];

async function open(page: Page, route: string) {
  // Rutas relativas a baseURL (incluye el prefijo /matematica-financiera/).
  await page.goto(`./#${route}`);
  await page.locator('.workbench, .page').first().waitFor();
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('la página de inicio presenta los seis módulos en español', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Matemática Financiera', level: 1 })).toBeVisible();
  await expect(page.locator('.module-card')).toHaveCount(6);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

for (const route of ROUTES) {
  test(`pantalla ${route}: sin errores, sin desbordes y con controles y gráfico visibles a la vez`, async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, route);
    await page.waitForTimeout(400);
    const vp = page.viewportSize()!;

    // Sin desplazamiento horizontal de la página.
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowX).toBeLessThanOrEqual(0);

    // Panel de variables y gráfico visibles simultáneamente dentro de la pantalla
    // (en el celular la disposición es vertical y la página se desplaza).
    const mobile = vp.width < 900;
    const controls = await page.locator('.wb-controls').boundingBox();
    const chart = await page.locator('.wb-chart').boundingBox();
    expect(controls).not.toBeNull();
    expect(chart).not.toBeNull();
    if (!mobile) expect(chart!.y + chart!.height).toBeLessThanOrEqual(vp.height + 1);
    expect(chart!.x + chart!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(controls!.y).toBeLessThan(vp.height);
    const area = await page.locator('.wb-chart .chart-area').boundingBox();
    expect(area!.height).toBeGreaterThanOrEqual(240);

    // El gráfico no se sale de su contenedor.
    const svgOverflow = await page.evaluate(() => {
      const box = document.querySelector('.wb-chart')!.getBoundingClientRect();
      return [...document.querySelectorAll('.wb-chart svg')].some((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1);
      });
    });
    expect(svgOverflow).toBe(false);

    // Tipografía legible.
    const fontSize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(15);

    expect(errors, errors.join('\n')).toHaveLength(0);
  });
}

test('interés simple: el campo numérico y la barra actualizan el resultado de inmediato', async ({ page }) => {
  await open(page, '/tasas/interes-simple');
  await expect(page.getByTestId('kpi-interes')).toHaveText('$ 360.000,00');
  const input = page.getByTestId('param-tasa').locator('input').first();
  await input.fill('5');
  await expect(page.getByTestId('kpi-interes')).toHaveText('$ 600.000,00');
  await expect(page.getByTestId('kpi-vf')).toHaveText('$ 1.600.000,00');
  await page.getByRole('button', { name: /Restablecer valores/ }).click();
  await expect(page.getByTestId('kpi-interes')).toHaveText('$ 360.000,00');
});

test('interés compuesto: importe exacto escrito con separadores argentinos', async ({ page }) => {
  await open(page, '/tasas/interes-compuesto');
  const capital = page.locator('.wb-controls input').first();
  await capital.fill('1.000.000');
  await page.getByTestId('param-tasa').locator('input').first().fill('3');
  await expect(page.getByTestId('kpi-compuesto')).toContainText('$ 1.092.727,00');
});

test('TEA: TNA 36 % con capitalización mensual da 42,5761 %', async ({ page }) => {
  await open(page, '/tasas/tea');
  await expect(page.getByTestId('kpi-tea')).toHaveText('42,5761 %');
});

test('sistema francés: cuota, selección de cuota y cuadro de marcha', async ({ page }) => {
  await open(page, '/amortizacion/frances');
  await expect(page.getByTestId('kpi-cuota')).toHaveText('$ 458.037,94');
  await expect(page.getByTestId('tasa-periodica')).toHaveText('3,0000 %');
  await page.getByRole('tab', { name: 'Cuadro' }).click();
  await expect(page.getByTestId('cuadro-de-marcha').locator('tbody tr')).toHaveCount(36);
  await page.getByRole('tab', { name: 'Verificación' }).click();
  await expect(page.getByTestId('verificaciones').locator('.mark-bad')).toHaveCount(0);
});

test('exportación del cuadro de marcha a CSV y Excel', async ({ page }) => {
  await open(page, '/amortizacion/aleman');
  await page.getByRole('tab', { name: 'Cuadro' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
  expect(csv.suggestedFilename()).toBe('cuadro-aleman.csv');
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()]);
  expect(xlsx.suggestedFilename()).toBe('cuadro-aleman.xlsx');
});

test('laboratorio: francés → alemán → francés conserva la historia y cancela la deuda', async ({ page }) => {
  await open(page, '/laboratorio/simulador');
  await page.getByRole('tab', { name: 'Verificación' }).click();
  await expect(page.getByTestId('verificaciones').locator('.mark-ok')).toHaveCount(8);
  await expect(page.getByTestId('verificaciones').locator('.mark-bad')).toHaveCount(0);
  await expect(page.getByTestId('kpi-intereses-mod')).toHaveText('$ 6.048.896,26');
});

test('cálculo inverso: reconstruye $ 10.000.000 y detecta datos faltantes', async ({ page }) => {
  await open(page, '/laboratorio/capital-original');
  await expect(page.getByTestId('kpi-capital')).toHaveText('$ 10.000.000,00');
  await page.getByText('Conozco el número total de cuotas').click();
  await expect(page.getByTestId('kpi-capital')).toHaveText('No identificable');
  await expect(page.getByTestId('resultado-inverso')).toContainText('Número total de cuotas de la operación');
});

test('ejercicio: resolución paso a paso y comprobación de respuesta', async ({ page }) => {
  await open(page, '/ejercicios/simple-vs-compuesto');
  const next = page.getByTestId('resolver-paso');
  for (let k = 0; k < 6; k++) await next.click();
  await expect(page.getByTestId('resolucion')).toContainText('$ 1.360.000,00');
  await page.getByRole('tab', { name: 'Comprobar respuesta' }).click();
  await page.getByLabel('Capital final (simple)').fill('1360000');
  await page.getByTestId('comprobar').click();
  await expect(page.getByText('✓ Correcto.')).toBeVisible();
});

test('modo clase y modo oscuro', async ({ page }) => {
  await open(page, '/tasas/interes-simple');
  await page.getByRole('button', { name: /Modo clase/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-present', 'true');
  const fontSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(19);
  const chart = await page.locator('.wb-chart').boundingBox();
  if (page.viewportSize()!.width >= 900) expect(chart!.y + chart!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  await page.getByRole('button', { name: 'Alternar modo claro u oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
});
