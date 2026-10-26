/**
 * Formato y lectura de números con convenciones argentinas:
 * punto como separador de miles y coma decimal ($ 1.234.567,89 · 3,25 %).
 */

const cache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number, extra: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${min}|${max}|${JSON.stringify(extra)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-AR', { minimumFractionDigits: min, maximumFractionDigits: max, ...extra });
    cache.set(key, f);
  }
  return f;
}

const clean = (x: number) => (Object.is(x, -0) || Math.abs(x) < 1e-12 ? 0 : x);

/** $ 1.234.567,89 */
export function fmtMoney(x: number, decimals = 2): string {
  if (!Number.isFinite(x)) return '—';
  const v = clean(x);
  const s = nf(decimals, decimals).format(Math.abs(v));
  return `${v < 0 ? '−' : ''}$ ${s}`;
}

/** Número con separadores: 1.234,5 */
export function fmtNum(x: number, maxDecimals = 2, minDecimals = 0): string {
  if (!Number.isFinite(x)) return '—';
  const v = clean(x);
  const s = nf(minDecimals, maxDecimals).format(Math.abs(v));
  return `${v < 0 ? '−' : ''}${s}`;
}

/** Porcentaje a partir de una tasa decimal: 0,0325 → "3,25 %". */
export function fmtPct(x: number, decimals = 2, minDecimals = decimals): string {
  if (!Number.isFinite(x)) return '—';
  return `${fmtNum(x * 100, decimals, minDecimals)} %`;
}

/** Porcentaje con hasta `max` decimales significativos, sin ceros finales. */
export function fmtRate(x: number, max = 4): string {
  return fmtPct(x, max, 0);
}

/** Formato compacto para ejes: 1,2 M · 350 mil. */
export function fmtCompact(x: number): string {
  if (!Number.isFinite(x)) return '';
  const a = Math.abs(x);
  if (a >= 1e12) return `${fmtNum(x / 1e12, 1)} B`;
  if (a >= 1e6) return `${fmtNum(x / 1e6, a >= 1e8 ? 0 : 1)} M`;
  if (a >= 1e3) return `${fmtNum(x / 1e3, a >= 1e5 ? 0 : 1)} mil`;
  return fmtNum(x, 2);
}

export function fmtMoneyCompact(x: number): string {
  return `$ ${fmtCompact(x)}`;
}

/** Número para LaTeX: 1.234{,}56 (la coma entre llaves evita el espacio de KaTeX). */
export function texNum(x: number, decimals = 2, minDecimals = decimals): string {
  return fmtNum(x, decimals, minDecimals).replace(/,/g, '{,}').replace('−', '-');
}

export function texMoney(x: number, decimals = 2): string {
  return `\\$\\,${texNum(x, decimals)}`;
}

/** Tasa decimal en LaTeX como decimal: 0{,}03 */
export function texRate(x: number, decimals = 6): string {
  return texNum(x, decimals, 0);
}

export function texPct(x: number, decimals = 4): string {
  return `${texNum(x * 100, decimals, 0)}\\,\\%`;
}

/**
 * Interpreta un número escrito por la persona usuaria. Acepta:
 *  "10.000.000" · "10000000" · "1.234,56" · "3,5" · "3.5" · "$ 1.000" · "−2"
 * Regla: si hay coma, la coma es decimal y los puntos son miles. Si sólo hay
 * puntos y forman grupos de tres dígitos (1.234.567), son separadores de miles.
 */
export function parseNumberAR(input: string): number | null {
  let s = input.trim().replace(/[$%\s ]/g, '').replace(/[−–]/g, '-');
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Plural simple en español. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${fmtNum(n, 0)} ${n === 1 ? singular : pluralForm}`;
}
