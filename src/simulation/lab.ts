/**
 * Laboratorio de préstamos: escenario original frente a escenario modificado
 * (cambios de sistema, de tasa y pagos extraordinarios) y medición del impacto
 * de cada modificación.
 */
import {
  buildSchedule,
  checkHistoryPreserved,
  describeRate,
  SYSTEM_LABELS,
  validateSchedule,
  type AmortSystem,
  type BulletMode,
  type Check,
  type LoanEvent,
  type LoanInput,
  type PrepaymentMode,
  type RateSpec,
  type ScheduleResult,
} from '../engine';

export type LabEventType = 'sistema' | 'tasa' | 'prepago';

export interface LabEvent {
  id: string;
  type: LabEventType;
  /** Sistema y tasa: cuota desde la que rige. Prepago: cuota junto con la cual se paga. */
  period: number;
  system?: AmortSystem;
  bulletMode?: BulletMode;
  rate?: RateSpec;
  amount?: number;
  mode?: PrepaymentMode;
}

let seq = 0;
export const newId = () => `ev${Date.now().toString(36)}${(seq++).toString(36)}`;

export function toEngineEvents(events: LabEvent[]): LoanEvent[] {
  return events.map((e): LoanEvent => {
    if (e.type === 'sistema') return { type: 'sistema', fromPeriod: e.period, system: e.system ?? 'frances', bulletMode: e.bulletMode };
    if (e.type === 'tasa') return { type: 'tasa', fromPeriod: e.period, rate: e.rate ?? { kind: 'TNA', value: 0.36, m: 12 } };
    return { type: 'prepago', afterPeriod: e.period, amount: e.amount ?? 0, mode: e.mode ?? 'reducir-cuota' };
  });
}

export function describeEvent(e: LabEvent): string {
  if (e.type === 'sistema') return `Desde la cuota ${e.period}: sistema ${SYSTEM_LABELS[e.system ?? 'frances']}`;
  if (e.type === 'tasa') return `Desde la cuota ${e.period}: ${e.rate ? describeRate(e.rate) : 'nueva tasa'}`;
  return `Con la cuota ${e.period}: pago extraordinario de $ ${(e.amount ?? 0).toLocaleString('es-AR')} (${e.mode === 'reducir-plazo' ? 'reduce plazo' : 'reduce cuota'})`;
}

/** Primera cuota que deja de coincidir con el escenario original. */
export function firstAffectedPeriod(e: LabEvent): number {
  return e.type === 'prepago' ? e.period + 1 : e.period;
}

export interface EventImpact {
  event: LabEvent;
  label: string;
  /** Cuota en la que se observa el efecto. */
  period: number;
  base: { payment: number; amortization: number; interest: number; opening: number } | null;
  modified: { payment: number; amortization: number; interest: number; opening: number } | null;
  futureInterestBase: number;
  futureInterestModified: number;
}

export interface LabResult {
  base: ScheduleResult;
  modified: ScheduleResult;
  checks: Check[];
  history: Check;
  impacts: EventImpact[];
  interestSaving: number;
}

const pick = (r: ScheduleResult, k: number) => {
  const row = r.rows[k - 1];
  return row ? { payment: row.payment, amortization: row.amortization, interest: row.interest, opening: row.openingPrincipal + row.openingAccrued } : null;
};
const interestFrom = (r: ScheduleResult, k: number) => r.rows.slice(k - 1).reduce((s, x) => s + x.interest, 0);

export function runLab(input: LoanInput, events: LabEvent[]): LabResult {
  const base = buildSchedule({ ...input, events: [] });
  const sorted = [...events].sort((a, b) => firstAffectedPeriod(a) - firstAffectedPeriod(b));
  const modified = buildSchedule({ ...input, events: toEngineEvents(sorted) });
  // Cuotas íntegramente anteriores a toda modificación (un prepago altera el saldo de su propia cuota).
  const untouched = sorted.length ? Math.min(...sorted.map((e) => e.period)) - 1 : input.periods;
  const history = checkHistoryPreserved(base, modified, Math.max(0, untouched));
  const impacts = sorted.map((e) => {
    const k = firstAffectedPeriod(e);
    return {
      event: e,
      label: describeEvent(e),
      period: k,
      base: pick(base, k),
      modified: pick(modified, k),
      futureInterestBase: interestFrom(base, k),
      futureInterestModified: interestFrom(modified, k),
    };
  });
  return {
    base,
    modified,
    checks: [...validateSchedule(modified), history],
    history,
    impacts,
    interestSaving: base.totals.interest - modified.totals.interest,
  };
}

/** Escenarios de ejemplo para clase. */
export const LAB_PRESETS: { id: string; label: string; events: () => LabEvent[]; loan?: Record<string, string | number> }[] = [
  {
    id: 'sistemas',
    label: 'Francés → alemán (cuota 6) → francés (cuota 16)',
    events: () => [
      { id: newId(), type: 'sistema', period: 6, system: 'aleman' },
      { id: newId(), type: 'sistema', period: 16, system: 'frances' },
    ],
  },
  {
    id: 'tasas',
    label: 'Tasas: 30 % → 35 % (cuota 13) → 40 % (cuota 25)',
    loan: { rateKind: 'TNA', rateValue: 0.3, rateM: 12 },
    events: () => [
      { id: newId(), type: 'tasa', period: 13, rate: { kind: 'TNA', value: 0.35, m: 12 } },
      { id: newId(), type: 'tasa', period: 25, rate: { kind: 'TNA', value: 0.4, m: 12 } },
    ],
  },
  {
    id: 'prepago',
    label: 'Pago extraordinario de $ 2.000.000 con la cuota 12',
    events: () => [{ id: newId(), type: 'prepago', period: 12, amount: 2_000_000, mode: 'reducir-plazo' }],
  },
  { id: 'ninguno', label: 'Sin modificaciones', events: () => [] },
];
