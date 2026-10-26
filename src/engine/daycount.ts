/**
 * Fechas, conteo de días y bases de cálculo.
 *
 * Las fechas se manejan como cadenas ISO `AAAA-MM-DD` y se interpretan en UTC
 * para evitar desplazamientos por zona horaria u horario de verano.
 *
 * Convenciones soportadas:
 *  - ACT/365: días reales transcurridos / 365.
 *  - ACT/360: días reales transcurridos / 360.
 *  - 30/360:  convención europea 30E/360 (cada mes cuenta 30 días) / 360.
 */
import { dec, type Dec, type Num } from './decimal';

export type DayCountBasis = 'ACT/365' | 'ACT/360' | '30/360';

export const DAY_COUNT_BASES: { id: DayCountBasis; label: string; description: string }[] = [
  { id: 'ACT/365', label: 'ACT/365', description: 'Días reales sobre un año de 365 días.' },
  { id: 'ACT/360', label: 'ACT/360', description: 'Días reales sobre un año comercial de 360 días.' },
  { id: '30/360', label: '30/360 (europea)', description: 'Meses de 30 días sobre un año de 360 días.' },
];

const MS_PER_DAY = 86_400_000;

export function parseISO(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Fecha inválida: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidISO(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return toISO(parseISO(date)) === date;
}

export function addDays(date: string, days: number): string {
  return toISO(new Date(parseISO(date).getTime() + days * MS_PER_DAY));
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Suma meses respetando el fin de mes: 31/01 + 1 mes = 28/02 (o 29/02).
 * El día se toma siempre de la fecha de origen para no "arrastrar" ajustes.
 */
export function addMonths(date: string, months: number): string {
  const d = parseISO(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(targetYear, targetMonth));
  return toISO(new Date(Date.UTC(targetYear, targetMonth, day)));
}

/** Días reales entre dos fechas (fin − inicio). */
export function actualDays(start: string, end: string): number {
  return Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / MS_PER_DAY);
}

/** Días según 30E/360: los días 31 se tratan como 30. */
export function days30E360(start: string, end: string): number {
  const a = parseISO(start);
  const b = parseISO(end);
  const d1 = Math.min(a.getUTCDate(), 30);
  const d2 = Math.min(b.getUTCDate(), 30);
  return 360 * (b.getUTCFullYear() - a.getUTCFullYear()) + 30 * (b.getUTCMonth() - a.getUTCMonth()) + (d2 - d1);
}

/** Días computables entre dos fechas según la convención. */
export function dayCount(start: string, end: string, basis: DayCountBasis): number {
  return basis === '30/360' ? days30E360(start, end) : actualDays(start, end);
}

/** Denominador anual de la convención. */
export function basisDenominator(basis: DayCountBasis): number {
  return basis === 'ACT/365' ? 365 : 360;
}

/** Fracción de año: días computables / denominador. */
export function yearFraction(start: string, end: string, basis: DayCountBasis): Dec {
  return dec(dayCount(start, end, basis)).div(basisDenominator(basis));
}

/** Interés de un período con tasa nominal y días: I = C · TNA · días / base. */
export function simpleInterestByDays(capital: Num, tna: Num, days: number, base: number): Dec {
  return dec(capital).times(tna).times(days).div(base);
}

/** Tasa efectiva para un plazo en días a partir de una TEA: (1 + TEA)^(días/base) − 1. */
export function effectiveForDays(tea: Num, days: number, base: number): Dec {
  return dec(tea).plus(1).pow(dec(days).div(base)).minus(1);
}

/** Formato de fecha argentino dd/mm/aaaa. */
export function formatDateAR(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
