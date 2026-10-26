/**
 * Capa de simulación del Módulo 1: compone resultados del motor en series listas
 * para graficar y tabular. No define fórmulas propias.
 */
import {
  compoundSchedule,
  convertEffective,
  dec,
  effectiveAnnual,
  FREQUENCIES,
  periodicFromNominal,
  periodicRate,
  simpleSchedule,
  teaContinuous,
  teaFromNominal,
  toNum,
  type RateSpec,
} from '../engine';

export interface RegimeRow {
  t: number;
  simple: number;
  compound: number;
  capital: number;
  simpleInterest: number;
  compoundInterest: number;
  /** Diferencia compuesto − simple. */
  difference: number;
  compoundPeriodInterest: number;
  compoundOpening: number;
  interestOnInterest: number;
}

export function simpleVsCompound(c0: number, i: number, n: number): RegimeRow[] {
  const s = simpleSchedule(c0, i, n);
  const c = compoundSchedule(c0, i, n);
  return s.map((row, t) => ({
    t,
    simple: row.amount,
    compound: c[t].closing,
    capital: c0,
    simpleInterest: row.accumulatedInterest,
    compoundInterest: c[t].accumulatedInterest,
    difference: c[t].closing - row.amount,
    compoundPeriodInterest: c[t].periodInterest,
    compoundOpening: c[t].opening,
    interestOnInterest: c[t].interestOnInterest,
  }));
}

export interface TnaTimelineRow {
  k: number;
  /** Interés del subperíodo si se retira (sobre el capital original). */
  paidInterest: number;
  /** Interés del subperíodo si se reinvierte (sobre el capital acumulado). */
  reinvestedInterest: number;
  /** Interés acumulado retirado. */
  paidCumulative: number;
  /** Capital acumulado con reinversión. */
  reinvestedBalance: number;
  /** Exceso del interés reinvertido sobre el retirado en ese subperíodo. */
  extra: number;
}

/** Línea de tiempo de un año: TNA con m subperíodos, intereses retirados vs. reinvertidos. */
export function tnaTimeline(capital: number, tna: number, m: number): TnaTimelineRow[] {
  const j = toNum(periodicFromNominal(tna, m));
  const s = simpleSchedule(capital, j, m);
  const c = compoundSchedule(capital, j, m);
  return Array.from({ length: m }, (_, idx) => {
    const k = idx + 1;
    return {
      k,
      paidInterest: s[k].periodInterest,
      reinvestedInterest: c[k].periodInterest,
      paidCumulative: s[k].accumulatedInterest,
      reinvestedBalance: c[k].closing,
      extra: c[k].periodInterest - s[k].periodInterest,
    };
  });
}

export interface FrequencyRow {
  id: string;
  label: string;
  m: number;
  periodic: number;
  tea: number;
  /** TEA − TNA */
  gap: number;
}

/** TEA para cada frecuencia de capitalización, con TNA constante. */
export function teaByFrequency(tna: number): FrequencyRow[] {
  return [...FREQUENCIES]
    .sort((a, b) => a.perYear - b.perYear)
    .map((f) => {
      const tea = toNum(teaFromNominal(tna, f.perYear));
      return { id: f.id, label: f.label, m: f.perYear, periodic: toNum(periodicFromNominal(tna, f.perYear)), tea, gap: tea - tna };
    });
}

export function continuousLimit(tna: number): number {
  return toNum(teaContinuous(tna));
}

/** Curva continua de TEA en función de m (para graficar la convergencia). */
export function teaCurve(tna: number, maxM = 365): { m: number; tea: number }[] {
  const ms = new Set<number>();
  for (let m = 1; m <= 24; m++) ms.add(m);
  for (let m = 26; m <= Math.min(maxM, 104); m += 2) ms.add(m);
  for (let m = 110; m <= maxM; m += 10) ms.add(m);
  ms.add(maxM);
  return [...ms].sort((a, b) => a - b).map((m) => ({ m, tea: toNum(teaFromNominal(tna, m)) }));
}

export interface EquivalentRow {
  id: string;
  label: string;
  period: string;
  perYear: number;
  rate: number;
  /** Proporcional (tasa nominal correspondiente = rate · m). */
  nominal: number;
  isSource: boolean;
}

/** Tasas efectivas equivalentes a una tasa efectiva de período dado. */
export function equivalentEffectiveRates(rate: number, perYear: number): EquivalentRow[] {
  return FREQUENCIES.filter((f) => f.perYear <= 365).map((f) => {
    const r = toNum(convertEffective(rate, perYear, f.perYear));
    return { id: f.id, label: f.label, period: f.period, perYear: f.perYear, rate: r, nominal: r * f.perYear, isSource: f.perYear === perYear };
  });
}

/** Crecimiento de $1 a lo largo de un año con distintas tasas equivalentes (mismo resultado final). */
export function equivalentGrowthPaths(rate: number, perYear: number, frequencies: number[]): { x: number; [key: string]: number }[] {
  const tea = toNum(convertEffective(rate, perYear, 1));
  const points = 365;
  const rows: { x: number; [key: string]: number }[] = [];
  for (let d = 0; d <= points; d += 5) {
    const row: { x: number; [key: string]: number } = { x: d / 365 };
    for (const m of frequencies) {
      const completed = Math.floor((d / 365) * m + 1e-9);
      const i = toNum(convertEffective(tea, 1, m));
      row[`m${m}`] = toNum(dec(1).plus(i).pow(completed));
    }
    rows.push(row);
  }
  return rows;
}

export interface Alternative {
  name: string;
  spec: RateSpec;
}

export interface AlternativeResult {
  name: string;
  spec: RateSpec;
  /** Tasa efectiva mensual equivalente. */
  monthly: number;
  tea: number;
  finalAmount: number;
  interest: number;
  path: number[];
}

/** Compara alternativas con capital y horizonte comunes (meses), bajo capitalización compuesta. */
export function compareAlternatives(alts: Alternative[], capital: number, months: number): AlternativeResult[] {
  return alts.map((a) => {
    const monthly = toNum(periodicRate(a.spec, 12));
    const path = Array.from({ length: months + 1 }, (_, t) => toNum(dec(capital).times(dec(1).plus(monthly).pow(t))));
    return {
      name: a.name,
      spec: a.spec,
      monthly,
      tea: toNum(effectiveAnnual(a.spec)),
      finalAmount: path[months],
      interest: path[months] - capital,
      path,
    };
  });
}
