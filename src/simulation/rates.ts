/**
 * Capa de simulación del Módulo 1: compone resultados del motor en series listas
 * para graficar y tabular. No define fórmulas propias.
 */
import {
  fixedDeposit,
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

/**
 * Evolución de un capital durante un año con distintas tasas efectivas equivalentes:
 * el capital sólo cambia al cierre de cada período de capitalización (escalones),
 * pero todas las trayectorias terminan en el mismo monto. Eje x en meses.
 */
export function equivalentGrowthPaths(capital: number, rate: number, perYear: number, frequencies: number[]): { x: number; [key: string]: number }[] {
  const tea = convertEffective(rate, perYear, 1);
  const rates = frequencies.map((m) => ({ m, i: convertEffective(tea, 1, m) }));
  const rows: { x: number; [key: string]: number }[] = [];
  const steps = 360;
  for (let k = 0; k <= steps; k++) {
    const months = (12 * k) / steps;
    const row: { x: number; [key: string]: number } = { x: months };
    for (const { m, i } of rates) {
      const completed = Math.floor((months * m) / 12 + 1e-9);
      row[`m${m}`] = toNum(dec(capital).times(dec(1).plus(i).pow(completed)));
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

/** Tasa de "un mes" y su TEA según cada convención (uniforme frente a días efectivos). */
export function conventionComparison(tna: number) {
  const uniform = toNum(periodicFromNominal(tna, 12));
  const act365 = fixedDeposit({ capital: 1, tna, days: 30, base: 365 });
  const act360 = fixedDeposit({ capital: 1, tna, days: 30, base: 360 });
  return [
    { convention: 'Períodos uniformes (m = 12)', calculation: 'TNA / 12', periodRate: uniform, tea: toNum(teaFromNominal(tna, 12)) },
    { convention: 'ACT/365, 30 días', calculation: 'TNA · 30 / 365', periodRate: act365.periodRate, tea: act365.teaWithReinvestment },
    { convention: 'ACT/360, 30 días', calculation: 'TNA · 30 / 360', periodRate: act360.periodRate, tea: act360.teaWithReinvestment },
    { convention: '30/360 (mes comercial)', calculation: 'TNA · 30 / 360', periodRate: uniform, tea: toNum(teaFromNominal(tna, 12)) },
  ];
}
