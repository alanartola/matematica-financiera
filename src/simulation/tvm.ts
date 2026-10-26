/**
 * Capa de simulación del Módulo 4: valores equivalentes y rangos de graficación.
 */
import { futureValue, npv, toNum, type Flow } from '../engine';

/** Valor equivalente de todos los flujos en la fecha focal T: VAN · (1 + i)^T. */
export function equivalentValueAt(flows: Flow[], i: number, T: number): number {
  return toNum(futureValue(npv(flows, i), i, T));
}

/** Rango de tasas para el perfil del VAN que incluye las TIR halladas. */
export function profileRange(roots: number[], current: number): [number, number] {
  const hi = Math.max(0.1, current * 1.6, ...roots.map((r) => r * 1.5 + 0.02));
  const lo = Math.min(0, ...roots.map((r) => r - 0.05));
  return [Math.max(lo, -0.9), Math.min(hi, 5)];
}

/** Ejemplo de flujos: hoy −$1.000.000; meses 6, 12 y 18: +$300.000, +$500.000, +$700.000. */
export const DEFAULT_FLOWS: [number, number][] = [
  [0, -1_000_000],
  [6, 300_000],
  [12, 500_000],
  [18, 700_000],
];
