/**
 * Motor de cuadros de marcha (sistemas de amortización).
 *
 * Un único algoritmo recorre la operación período a período y admite:
 *  - sistemas francés, alemán, americano y americano Bullet;
 *  - cambios de sistema durante la operación (múltiples);
 *  - cambios de tasa durante la operación (múltiples);
 *  - pagos extraordinarios de capital, reduciendo cuota o plazo;
 *  - interés por períodos uniformes o por días efectivos (ACT/365, ACT/360, 30/360).
 *
 * Política de redondeo (modo "centavos", predeterminado):
 *  - El interés de cada período se redondea a centavos (mitad hacia arriba).
 *  - La cuota del sistema francés y la amortización constante del alemán se
 *    redondean a centavos al momento de calcularse.
 *  - La última cuota de cada operación absorbe la diferencia de redondeo: amortiza
 *    exactamente el saldo pendiente, de modo que la deuda se extingue en cero.
 * En modo "exacto" no se redondea ningún importe intermedio.
 */
import { D, dec, ONE, ZERO, MONEY_TOLERANCE, roundMoney, sum, toNum, type Dec, type Num, type RoundingMode } from './decimal';
import { periodicRate, type RateSpec } from './rates';
import { addMonths, basisDenominator, dayCount, type DayCountBasis } from './daycount';

export type AmortSystem = 'frances' | 'aleman' | 'americano' | 'bullet';
/** Bullet: interés compuesto capitalizado o interés simple acumulado. */
export type BulletMode = 'compuesto' | 'simple';

export const SYSTEM_LABELS: Record<AmortSystem, string> = {
  frances: 'Francés',
  aleman: 'Alemán',
  americano: 'Americano',
  bullet: 'Americano Bullet',
};

export const SYSTEMS: AmortSystem[] = ['frances', 'aleman', 'americano', 'bullet'];

export type InterestConvention = { kind: 'uniforme' } | { kind: 'dias'; basis: DayCountBasis; disbursement: string };

export type PrepaymentMode = 'reducir-cuota' | 'reducir-plazo';

export type LoanEvent =
  /** Desde la cuota `fromPeriod` (inclusive) se aplica el nuevo sistema. */
  | { type: 'sistema'; fromPeriod: number; system: AmortSystem; bulletMode?: BulletMode }
  /** Desde la cuota `fromPeriod` (inclusive) rige la nueva tasa. */
  | { type: 'tasa'; fromPeriod: number; rate: RateSpec }
  /** Pago extraordinario de capital realizado junto con la cuota `afterPeriod`. */
  | { type: 'prepago'; afterPeriod: number; amount: number; mode: PrepaymentMode };

export interface LoanInput {
  principal: number;
  /** Cantidad de cuotas pactadas. */
  periods: number;
  /** Pagos por año (12 = mensual). */
  paymentsPerYear: number;
  rate: RateSpec;
  system: AmortSystem;
  bulletMode?: BulletMode;
  rounding?: RoundingMode;
  convention?: InterestConvention;
  events?: LoanEvent[];
}

export interface ScheduleRow {
  period: number;
  /** Fecha de vencimiento (sólo con convención por días). */
  date?: string;
  /** Días computables del período (sólo con convención por días). */
  days?: number;
  system: AmortSystem;
  bulletMode?: BulletMode;
  /** Tasa efectiva aplicada para calcular el interés del período. */
  rate: number;
  /** Tasa efectiva periódica uniforme vigente (base del cálculo de cuotas). */
  contractRate: number;
  openingPrincipal: number;
  /** Intereses devengados y no pagados al inicio del período (Bullet). */
  openingAccrued: number;
  /** Interés devengado en el período. */
  interest: number;
  /** Interés efectivamente pagado con la cuota. */
  interestPaid: number;
  /** Capital amortizado con la cuota. */
  amortization: number;
  /** Cuota = interés pagado + amortización. */
  payment: number;
  /** Pago extraordinario de capital realizado junto con esta cuota. */
  extraPayment: number;
  closingPrincipal: number;
  closingAccrued: number;
  /** Intereses acumulados que se incorporan al capital al abandonar un tramo Bullet. */
  capitalizedIntoPrincipal: number;
  /** Índice del tramo de sistema al que pertenece la fila. */
  segment: number;
}

export interface Segment {
  from: number;
  to: number;
  system: AmortSystem;
  bulletMode?: BulletMode;
}

export interface RateSegment {
  from: number;
  to: number;
  spec: RateSpec;
  periodic: number;
}

export interface ScheduleTotals {
  interest: number;
  interestPaid: number;
  amortization: number;
  extraPayments: number;
  /** Suma de cuotas + pagos extraordinarios. */
  payments: number;
  capitalized: number;
}

export interface ScheduleResult {
  input: LoanInput;
  rows: ScheduleRow[];
  totals: ScheduleTotals;
  segments: Segment[];
  rateSegments: RateSegment[];
  /** Tasa efectiva periódica inicial. */
  initialPeriodicRate: number;
  /** Cuota en la que efectivamente se cancela la deuda. */
  maturity: number;
  notes: string[];
}

/** Importe máximo representable con exactitud de centavos en un `number` (≈ 2^53 / 100). */
export const MAX_EXACT_MONEY = 9e13;

/** Cuota del sistema francés: C₀ · i(1+i)ⁿ / [(1+i)ⁿ − 1]; con i = 0, C₀ / n. */
export function frenchPayment(principal: Num, i: Num, n: number): Dec {
  const P = dec(principal);
  const rate = dec(i);
  if (n <= 0) throw new Error('El número de cuotas debe ser positivo.');
  if (rate.isZero()) return P.div(n);
  const f = ONE.plus(rate).pow(n);
  return P.times(rate).times(f).div(f.minus(1));
}

/** Valor actual de una renta unitaria vencida: a(n,i) = [1 − (1+i)⁻ⁿ] / i. */
export function annuityFactor(i: Num, n: number): Dec {
  const rate = dec(i);
  if (rate.isZero()) return dec(n);
  return ONE.minus(ONE.plus(rate).pow(-n)).div(rate);
}

/**
 * Cantidad de cuotas (real, no necesariamente entera) que cancela un capital P con
 * cuota fija c a la tasa i: n = −ln(1 − P·i/c) / ln(1+i). Devuelve null si la cuota
 * no alcanza a cubrir los intereses.
 */
export function frenchTerm(principal: Num, i: Num, payment: Num): Dec | null {
  const P = dec(principal);
  const rate = dec(i);
  const c = dec(payment);
  if (c.lte(0)) return null;
  if (rate.isZero()) return P.div(c);
  const x = ONE.minus(P.times(rate).div(c));
  if (x.lte(0)) return null;
  return x.ln().neg().div(ONE.plus(rate).ln());
}

/** Redondea hacia arriba ignorando residuos numéricos ínfimos (p. ej. 23,0000000001 → 23). */
function ceilTolerant(x: Dec): number {
  const r = x.toDecimalPlaces(9, D.ROUND_HALF_UP);
  return r.ceil().toNumber();
}

function rateForDays(spec: RateSpec, days: number, basis: DayCountBasis): Dec {
  const den = basisDenominator(basis);
  switch (spec.kind) {
    case 'TNA':
      // Práctica habitual: interés = saldo · TNA · días / base.
      return dec(spec.value).times(days).div(den);
    case 'TEA':
      return dec(spec.value).plus(1).pow(dec(days).div(den)).minus(1);
    case 'TEP': {
      const tea = periodicRate(spec, 1);
      return tea.plus(1).pow(dec(days).div(den)).minus(1);
    }
  }
}

export function validateLoanInput(input: LoanInput): string[] {
  const errors: string[] = [];
  if (!(input.principal > 0)) errors.push('El capital debe ser mayor que cero.');
  if (!Number.isInteger(input.periods) || input.periods < 1) errors.push('La cantidad de cuotas debe ser un entero mayor o igual a 1.');
  if (input.periods > 1200) errors.push('La cantidad de cuotas no puede superar 1200.');
  if (input.rate.value < 0) errors.push('La tasa no puede ser negativa.');
  const conv = input.convention;
  if (conv?.kind === 'dias' && (12 / input.paymentsPerYear) % 1 !== 0) {
    errors.push('La convención por días requiere una periodicidad de pagos expresada en meses enteros.');
  }
  return errors;
}

export function buildSchedule(input: LoanInput): ScheduleResult {
  const errors = validateLoanInput(input);
  if (errors.length) throw new Error(errors.join(' '));

  const rounding = input.rounding ?? 'centavos';
  const r = (x: Dec) => roundMoney(x, rounding);
  const p = input.paymentsPerYear;
  const conv: InterestConvention = input.convention ?? { kind: 'uniforme' };
  const notes: string[] = [];

  const events = input.events ?? [];
  const sysEvents = new Map<number, Extract<LoanEvent, { type: 'sistema' }>>();
  const rateEvents = new Map<number, Extract<LoanEvent, { type: 'tasa' }>>();
  const prepayEvents = new Map<number, Extract<LoanEvent, { type: 'prepago' }>[]>();
  for (const ev of events) {
    if (ev.type === 'sistema') sysEvents.set(ev.fromPeriod, ev);
    else if (ev.type === 'tasa') rateEvents.set(ev.fromPeriod, ev);
    else prepayEvents.set(ev.afterPeriod, [...(prepayEvents.get(ev.afterPeriod) ?? []), ev]);
  }

  let principal = dec(input.principal);
  let accrued = ZERO;
  let system = input.system;
  let bulletMode: BulletMode = input.bulletMode ?? 'compuesto';
  let spec = input.rate;
  let i = periodicRate(spec, p);
  let maturity = input.periods;
  let fixedPayment: Dec | null = null; // cuota francesa vigente
  let fixedAmort: Dec | null = null; // amortización alemana vigente

  const rows: ScheduleRow[] = [];
  const segments: Segment[] = [{ from: 1, to: 1, system, bulletMode: system === 'bullet' ? bulletMode : undefined }];
  const rateSegments: RateSegment[] = [{ from: 1, to: 1, spec, periodic: toNum(i) }];
  const monthsPerPeriod = 12 / p;
  let prevDate = conv.kind === 'dias' ? conv.disbursement : undefined;

  for (let t = 1; t <= maturity; t++) {
    let capitalizedIntoPrincipal = ZERO;

    // 1. Cambios que rigen desde esta cuota.
    const rateEv = rateEvents.get(t);
    if (rateEv) {
      spec = rateEv.rate;
      i = periodicRate(spec, p);
      fixedPayment = null; // francés: la cuota se recalcula con la nueva tasa
      if (t === 1) rateSegments[0] = { from: 1, to: 1, spec, periodic: toNum(i) };
      else rateSegments.push({ from: t, to: t, spec, periodic: toNum(i) });
    }
    const sysEv = sysEvents.get(t);
    if (sysEv && (sysEv.system !== system || (sysEv.system === 'bullet' && (sysEv.bulletMode ?? 'compuesto') !== bulletMode))) {
      if (system === 'bullet' && accrued.gt(0)) {
        capitalizedIntoPrincipal = accrued;
        principal = principal.plus(accrued);
        accrued = ZERO;
        notes.push(`Al abandonar el tramo Bullet en la cuota ${t}, los intereses devengados y no pagados se capitalizan (se suman al capital).`);
      }
      system = sysEv.system;
      bulletMode = sysEv.bulletMode ?? 'compuesto';
      fixedPayment = null;
      fixedAmort = null;
      if (t === 1) segments[0] = { from: 1, to: 1, system, bulletMode: system === 'bullet' ? bulletMode : undefined };
      else segments.push({ from: t, to: t, system, bulletMode: system === 'bullet' ? bulletMode : undefined });
    }
    segments[segments.length - 1].to = t;
    rateSegments[rateSegments.length - 1].to = t;

    const remaining = maturity - t + 1;
    const isLast = t === maturity;

    // 2. Tasa del período.
    let periodRate = i;
    let date: string | undefined;
    let days: number | undefined;
    if (conv.kind === 'dias') {
      date = addMonths(conv.disbursement, t * monthsPerPeriod);
      days = dayCount(prevDate!, date, conv.basis);
      periodRate = rateForDays(spec, days, conv.basis);
      prevDate = date;
    }

    // 3. Interés del período.
    const openingPrincipal = principal;
    const openingAccrued = accrued;
    const base = system === 'bullet' && bulletMode === 'compuesto' ? principal.plus(accrued) : principal;
    const interest = r(base.times(periodRate));

    // 4. Composición de la cuota según el sistema vigente.
    let amortization = ZERO;
    let interestPaid = interest;
    switch (system) {
      case 'frances': {
        if (fixedPayment === null) fixedPayment = r(frenchPayment(principal, i, remaining));
        amortization = isLast ? principal : fixedPayment.minus(interest);
        if (amortization.gt(principal)) amortization = principal;
        break;
      }
      case 'aleman': {
        if (fixedAmort === null) fixedAmort = r(principal.div(remaining));
        amortization = isLast ? principal : D.min(fixedAmort, principal);
        break;
      }
      case 'americano': {
        amortization = isLast ? principal : ZERO;
        break;
      }
      case 'bullet': {
        accrued = accrued.plus(interest);
        if (isLast) {
          interestPaid = accrued;
          accrued = ZERO;
          amortization = principal;
        } else {
          interestPaid = ZERO;
        }
        break;
      }
    }
    const payment = interestPaid.plus(amortization);
    let closingPrincipal = principal.minus(amortization);

    // 5. Pagos extraordinarios realizados junto con esta cuota.
    let extra = ZERO;
    if (!isLast) {
      for (const ev of prepayEvents.get(t) ?? []) {
        const amount = D.min(r(dec(Math.max(ev.amount, 0))), closingPrincipal);
        if (amount.lte(0)) continue;
        extra = extra.plus(amount);
        closingPrincipal = closingPrincipal.minus(amount);
        const left = maturity - t;
        if (closingPrincipal.lte(MONEY_TOLERANCE)) {
          notes.push(`El pago extraordinario de la cuota ${t} cancela totalmente la deuda.`);
          continue;
        }
        if (ev.mode === 'reducir-cuota' || system === 'americano' || system === 'bullet') {
          if (ev.mode === 'reducir-plazo') {
            notes.push(
              `Cuota ${t}: en el sistema ${SYSTEM_LABELS[system]} el capital se devuelve al vencimiento; el pago extraordinario reduce los intereses futuros pero no el plazo.`,
            );
          }
          fixedPayment = null;
          fixedAmort = null;
        } else if (system === 'frances') {
          const c = fixedPayment ?? r(frenchPayment(closingPrincipal, i, left));
          const term = frenchTerm(closingPrincipal, i, c);
          if (term === null) {
            notes.push(`Cuota ${t}: la cuota vigente no cubre los intereses; se recalcula la cuota manteniendo el plazo.`);
            fixedPayment = null;
          } else {
            const newLeft = Math.min(ceilTolerant(term), left);
            maturity = t + newLeft;
            fixedPayment = c;
            notes.push(`Cuota ${t}: se mantiene la cuota y el plazo restante pasa de ${left} a ${newLeft} cuotas.`);
          }
        } else {
          const a = fixedAmort ?? r(closingPrincipal.div(left));
          const newLeft = Math.min(ceilTolerant(closingPrincipal.div(a)), left);
          maturity = t + newLeft;
          fixedAmort = a;
          notes.push(`Cuota ${t}: se mantiene la amortización y el plazo restante pasa de ${left} a ${newLeft} cuotas.`);
        }
      }
    }

    rows.push({
      period: t,
      date,
      days,
      system,
      bulletMode: system === 'bullet' ? bulletMode : undefined,
      rate: toNum(periodRate),
      contractRate: toNum(i),
      openingPrincipal: toNum(openingPrincipal),
      openingAccrued: toNum(openingAccrued),
      interest: toNum(interest),
      interestPaid: toNum(interestPaid),
      amortization: toNum(amortization),
      payment: toNum(payment),
      extraPayment: toNum(extra),
      closingPrincipal: toNum(closingPrincipal),
      closingAccrued: toNum(accrued),
      capitalizedIntoPrincipal: toNum(capitalizedIntoPrincipal),
      segment: segments.length - 1,
    });

    principal = closingPrincipal;
    if (!isLast && principal.lte(MONEY_TOLERANCE) && accrued.lte(MONEY_TOLERANCE)) {
      maturity = t;
      break;
    }
  }

  if (rows.some((x) => Math.abs(x.openingPrincipal) + Math.abs(x.closingAccrued) + Math.abs(x.payment) > MAX_EXACT_MONEY)) {
    notes.push(
      'Algunos importes superan $ 90 billones: a partir de esa magnitud la representación numérica de tablas y gráficos pierde exactitud en los centavos.',
    );
  }

  const ignored = events.filter((ev) => (ev.type === 'prepago' ? ev.afterPeriod : ev.fromPeriod) > maturity);
  if (ignored.length) notes.push(`${ignored.length} modificación(es) posteriores a la cancelación de la deuda no se aplicaron.`);

  const totalsDec = {
    interest: sum(rows.map((x) => dec(x.interest))),
    interestPaid: sum(rows.map((x) => dec(x.interestPaid))),
    amortization: sum(rows.map((x) => dec(x.amortization))),
    extraPayments: sum(rows.map((x) => dec(x.extraPayment))),
    payments: sum(rows.map((x) => dec(x.payment).plus(x.extraPayment))),
    capitalized: sum(rows.map((x) => dec(x.capitalizedIntoPrincipal))),
  };

  return {
    input,
    rows,
    totals: {
      interest: toNum(totalsDec.interest),
      interestPaid: toNum(totalsDec.interestPaid),
      amortization: toNum(totalsDec.amortization),
      extraPayments: toNum(totalsDec.extraPayments),
      payments: toNum(totalsDec.payments),
      capitalized: toNum(totalsDec.capitalized),
    },
    segments,
    rateSegments,
    initialPeriodicRate: toNum(periodicRate(input.rate, p)),
    maturity,
    notes,
  };
}

/** Flujo de fondos desde el punto de vista del deudor: +capital en t = 0, −pagos luego. */
export function loanCashFlows(result: ScheduleResult): { t: number; amount: number }[] {
  return [{ t: 0, amount: result.input.principal }, ...result.rows.map((row) => ({ t: row.period, amount: -(row.payment + row.extraPayment) }))];
}
