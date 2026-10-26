/**
 * Capa de simulación de préstamos: arma entradas del motor a partir del estado de
 * los formularios, deriva series para gráficos y tablas exportables, y compone
 * comparaciones entre sistemas o escenarios. No contiene fórmulas financieras.
 */
import {
  buildSchedule,
  frequencyByPerYear,
  SYSTEM_LABELS,
  SYSTEMS,
  validateSchedule,
  type AmortSystem,
  type BulletMode,
  type Check,
  type DayCountBasis,
  type LoanInput,
  type RateSpec,
  type RoundingMode,
  type ScheduleResult,
} from '../engine';
import type { Table } from '../export/tabular';
import { formatDateAR } from '../engine/daycount';

/** Estado plano (primitivos) de un formulario de préstamo. */
export interface LoanFormState {
  principal: number;
  rateKind: string;
  rateValue: number;
  rateM: number;
  n: number;
  p: number;
  convention: string;
  disbursement: string;
  rounding: string;
  bulletMode: string;
  [key: string]: string | number | boolean;
}

export const LOAN_DEFAULTS: LoanFormState = {
  principal: 10_000_000,
  rateKind: 'TNA',
  rateValue: 0.36,
  rateM: 12,
  n: 36,
  p: 12,
  convention: 'uniforme',
  disbursement: '2026-01-15',
  rounding: 'centavos',
  bulletMode: 'compuesto',
};

export function rateSpecFrom(kind: string, value: number, m: number): RateSpec {
  if (kind === 'TEA') return { kind: 'TEA', value };
  if (kind === 'TEP') return { kind: 'TEP', value, perYear: m };
  return { kind: 'TNA', value, m };
}

export function specToState(spec: RateSpec): { rateKind: string; rateValue: number; rateM?: number } {
  if (spec.kind === 'TNA') return { rateKind: 'TNA', rateValue: spec.value, rateM: spec.m };
  if (spec.kind === 'TEP') return { rateKind: 'TEP', rateValue: spec.value, rateM: spec.perYear };
  return { rateKind: 'TEA', rateValue: spec.value };
}

export function loanInputFrom(state: LoanFormState, system: AmortSystem): LoanInput {
  const conv = state.convention;
  return {
    principal: state.principal,
    periods: Math.max(1, Math.round(state.n)),
    paymentsPerYear: state.p,
    rate: rateSpecFrom(state.rateKind, state.rateValue, state.rateM),
    system,
    bulletMode: (state.bulletMode as BulletMode) ?? 'compuesto',
    rounding: (state.rounding as RoundingMode) ?? 'centavos',
    convention: conv === 'uniforme' ? { kind: 'uniforme' } : { kind: 'dias', basis: conv as DayCountBasis, disbursement: state.disbursement },
  };
}

export interface SafeSchedule {
  result: ScheduleResult | null;
  checks: Check[];
  error: string | null;
}

/** Ejecuta el motor capturando errores de validación para mostrarlos en la interfaz. */
export function safeSchedule(input: LoanInput): SafeSchedule {
  try {
    const result = buildSchedule(input);
    return { result, checks: validateSchedule(result), error: null };
  } catch (e) {
    return { result: null, checks: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ChartRow {
  t: number;
  system: AmortSystem | null;
  rate: number | null;
  interest: number;
  amortization: number;
  payment: number;
  extra: number;
  /** Deuda total: capital + intereses capitalizados o acumulados. */
  debt: number;
  principal: number;
  accrued: number;
  cumInterest: number;
  cumAmortization: number;
  cumPayments: number;
}

/** Series por cuota (incluye t = 0 con el capital original). */
export function chartRows(result: ScheduleResult): ChartRow[] {
  const rows: ChartRow[] = [
    {
      t: 0,
      system: null,
      rate: null,
      interest: 0,
      amortization: 0,
      payment: 0,
      extra: 0,
      debt: result.input.principal,
      principal: result.input.principal,
      accrued: 0,
      cumInterest: 0,
      cumAmortization: 0,
      cumPayments: 0,
    },
  ];
  let ci = 0;
  let ca = 0;
  let cp = 0;
  for (const r of result.rows) {
    ci += r.interest;
    ca += r.amortization + r.extraPayment;
    cp += r.payment + r.extraPayment;
    rows.push({
      t: r.period,
      system: r.system,
      rate: r.rate,
      interest: r.interestPaid,
      amortization: r.amortization,
      payment: r.payment,
      extra: r.extraPayment,
      debt: r.closingPrincipal + r.closingAccrued,
      principal: r.closingPrincipal,
      accrued: r.closingAccrued,
      cumInterest: ci,
      cumAmortization: ca,
      cumPayments: cp,
    });
  }
  return rows;
}

export function periodLabel(p: number): string {
  return frequencyByPerYear(p).period;
}

export function periodPlural(p: number): string {
  const s = frequencyByPerYear(p).period;
  return s === 'mes' ? 'meses' : `${s}s`;
}

/** Tabla exportable del cuadro de marcha. */
export function scheduleTable(result: ScheduleResult, name = 'Cuadro de marcha'): Table {
  const hasDates = result.rows.some((r) => r.date);
  const multiSystem = result.segments.length > 1;
  const hasExtra = result.rows.some((r) => r.extraPayment > 0);
  const hasAccrued = result.rows.some((r) => r.closingAccrued > 0 || r.openingAccrued > 0);
  const columns: Table['columns'] = [{ header: 'Cuota', type: 'int' }];
  if (hasDates) columns.push({ header: 'Vencimiento', type: 'text' }, { header: 'Días', type: 'int' });
  if (multiSystem) columns.push({ header: 'Sistema', type: 'text' });
  columns.push(
    { header: 'Tasa del período', type: 'percent' },
    { header: 'Saldo inicial', type: 'money' },
    { header: 'Intereses', type: 'money' },
    { header: 'Amortización', type: 'money' },
    { header: 'Cuota total', type: 'money' },
  );
  if (hasExtra) columns.push({ header: 'Pago extraordinario', type: 'money' });
  if (hasAccrued) columns.push({ header: 'Intereses acumulados no pagados', type: 'money' });
  columns.push({ header: 'Saldo final', type: 'money' });

  const rows = result.rows.map((r) => {
    const row: (string | number)[] = [r.period];
    if (hasDates) row.push(r.date ? formatDateAR(r.date) : '', r.days ?? '');
    if (multiSystem) row.push(SYSTEM_LABELS[r.system]);
    row.push(
      r.rate,
      r.openingPrincipal + (r.system === 'bullet' && r.bulletMode === 'compuesto' ? r.openingAccrued : 0),
      r.interest,
      r.amortization,
      r.payment,
    );
    if (hasExtra) row.push(r.extraPayment);
    if (hasAccrued) row.push(r.closingAccrued);
    row.push(r.closingPrincipal);
    return row;
  });
  return { name, columns, rows };
}

export interface SystemComparison {
  system: AmortSystem;
  label: string;
  result: ScheduleResult;
  first: number;
  last: number;
  maxPayment: number;
  totalInterest: number;
  totalPaid: number;
  amortized: number;
  /** Suma de los saldos sobre los que se calculan intereses (capital · período). */
  balanceSum: number;
}

/** Misma operación bajo los cuatro sistemas. */
export function compareSystems(base: LoanInput): SystemComparison[] {
  return SYSTEMS.map((system) => {
    const result = buildSchedule({ ...base, system, events: [] });
    const rows = result.rows;
    const balanceSum = rows.reduce((s, r) => s + r.openingPrincipal + (r.system === 'bullet' && r.bulletMode === 'compuesto' ? r.openingAccrued : 0), 0);
    return {
      system,
      label: SYSTEM_LABELS[system],
      result,
      first: rows[0].payment,
      last: rows[rows.length - 1].payment,
      maxPayment: Math.max(...rows.map((r) => r.payment)),
      totalInterest: result.totals.interest,
      totalPaid: result.totals.payments,
      amortized: result.totals.amortization + result.totals.extraPayments,
      balanceSum,
    };
  });
}
