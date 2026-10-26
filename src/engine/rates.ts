/**
 * Conversión de tasas de interés.
 *
 * Convención de PERÍODOS UNIFORMES: el año se divide en `m` subperíodos de igual
 * duración (12 meses, 4 trimestres, etc.). Las equivalencias de este archivo son
 * exactas bajo esa convención y NO deben mezclarse con cálculos por días
 * efectivos (ACT/365, ACT/360, 30/360), que se resuelven en `daycount.ts`.
 *
 * Todas las tasas se expresan en forma decimal: 36 % = 0,36.
 */
import { D, dec, ONE, type Dec, type Num } from './decimal';

export interface Frequency {
  id: string;
  label: string;
  /** Adjetivo para "capitalización …" */
  adjective: string;
  /** Nombre del subperíodo en singular. */
  period: string;
  /** Cantidad de subperíodos por año (m). */
  perYear: number;
  /** Duración en meses, si el subperíodo es un múltiplo entero de meses. */
  months: number | null;
}

export const FREQUENCIES: Frequency[] = [
  { id: 'diaria', label: 'Diaria (365)', adjective: 'diaria', period: 'día', perYear: 365, months: null },
  { id: 'semanal', label: 'Semanal (52)', adjective: 'semanal', period: 'semana', perYear: 52, months: null },
  { id: 'quincenal', label: 'Quincenal (24)', adjective: 'quincenal', period: 'quincena', perYear: 24, months: null },
  { id: 'mensual', label: 'Mensual (12)', adjective: 'mensual', period: 'mes', perYear: 12, months: 1 },
  { id: 'bimestral', label: 'Bimestral (6)', adjective: 'bimestral', period: 'bimestre', perYear: 6, months: 2 },
  { id: 'trimestral', label: 'Trimestral (4)', adjective: 'trimestral', period: 'trimestre', perYear: 4, months: 3 },
  { id: 'cuatrimestral', label: 'Cuatrimestral (3)', adjective: 'cuatrimestral', period: 'cuatrimestre', perYear: 3, months: 4 },
  { id: 'semestral', label: 'Semestral (2)', adjective: 'semestral', period: 'semestre', perYear: 2, months: 6 },
  { id: 'anual', label: 'Anual (1)', adjective: 'anual', period: 'año', perYear: 1, months: 12 },
];

/** Frecuencias cuyo subperíodo es un número entero de meses (aptas para fechas de pago). */
export const MONTHLY_FREQUENCIES = FREQUENCIES.filter((f) => f.months !== null);

export function frequencyByPerYear(m: number): Frequency {
  const f = FREQUENCIES.find((x) => x.perYear === m);
  if (!f) throw new Error(`Frecuencia no soportada: ${m} períodos por año`);
  return f;
}

/** Tasa periódica proporcional a partir de una TNA: i = TNA / m. */
export function periodicFromNominal(tna: Num, m: number): Dec {
  return dec(tna).div(m);
}

/** TNA a partir de una tasa periódica proporcional: TNA = i · m. */
export function nominalFromPeriodic(i: Num, m: number): Dec {
  return dec(i).times(m);
}

/** TEA = (1 + TNA/m)^m − 1 */
export function teaFromNominal(tna: Num, m: number): Dec {
  return ONE.plus(dec(tna).div(m)).pow(m).minus(1);
}

/** TNA = m · [(1 + TEA)^(1/m) − 1]  (inversa de la anterior para la misma m) */
export function nominalFromTea(tea: Num, m: number): Dec {
  return ONE.plus(dec(tea)).pow(ONE.div(m)).minus(1).times(m);
}

/** Límite de capitalización continua: TEA = e^TNA − 1. */
export function teaContinuous(tna: Num): Dec {
  return dec(tna).exp().minus(1);
}

/** Tasa nominal de capitalización continua equivalente: δ = ln(1 + TEA). */
export function nominalContinuousFromTea(tea: Num): Dec {
  return ONE.plus(dec(tea)).ln();
}

/**
 * Equivalencia entre tasas efectivas de distinto período bajo capitalización compuesta:
 * (1 + i_destino) = (1 + i_origen)^(m_origen / m_destino).
 */
export function convertEffective(i: Num, fromPerYear: number, toPerYear: number): Dec {
  if (fromPerYear === toPerYear) return dec(i);
  return ONE.plus(dec(i)).pow(new D(fromPerYear).div(toPerYear)).minus(1);
}

/** Especificación de una tasa tal como la informa un contrato. */
export type RateSpec =
  /** Tasa nominal anual con `m` capitalizaciones (conversiones) por año. */
  | { kind: 'TNA'; value: number; m: number }
  /** Tasa efectiva anual. */
  | { kind: 'TEA'; value: number }
  /** Tasa efectiva de un subperíodo, con `perYear` subperíodos por año. */
  | { kind: 'TEP'; value: number; perYear: number };

/**
 * Tasa efectiva correspondiente a un período de pago, cuando hay `p` pagos por año.
 *  - TNA con m = p:   i = TNA / p (proporcional, sin potencias).
 *  - TNA con m ≠ p:   i = (1 + TNA/m)^(m/p) − 1.
 *  - TEA:             i = (1 + TEA)^(1/p) − 1.
 *  - TEP (q por año): i = (1 + TEP)^(q/p) − 1.
 */
export function periodicRate(spec: RateSpec, p: number): Dec {
  switch (spec.kind) {
    case 'TNA':
      if (spec.m === p) return periodicFromNominal(spec.value, p);
      return convertEffective(periodicFromNominal(spec.value, spec.m), spec.m, p);
    case 'TEA':
      return convertEffective(spec.value, 1, p);
    case 'TEP':
      return convertEffective(spec.value, spec.perYear, p);
  }
}

/** Tasa efectiva anual equivalente a cualquier especificación. */
export function effectiveAnnual(spec: RateSpec): Dec {
  return periodicRate(spec, 1);
}

/** Descripción breve en texto de una especificación de tasa. */
export function describeRate(spec: RateSpec): string {
  const pct = (x: number) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 })} %`;
  switch (spec.kind) {
    case 'TNA':
      return `TNA ${pct(spec.value)} con capitalización ${frequencyByPerYear(spec.m).adjective}`;
    case 'TEA':
      return `TEA ${pct(spec.value)}`;
    case 'TEP':
      return `Tasa efectiva ${frequencyByPerYear(spec.perYear).adjective} ${pct(spec.value)}`;
  }
}
