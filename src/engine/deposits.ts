/**
 * Plazo fijo tradicional (sin capitalización durante el plazo).
 *
 *   Interés = Capital · TNA · días / base
 *
 * El rendimiento del plazo (tasa efectiva del período) NO es una TEA. La TEA
 * equivalente supone que capital e intereses se reinvierten sucesivamente en
 * colocaciones idénticas durante un año calendario de 365 días:
 *
 *   TEA = (1 + TNA · días / base)^(365 / días) − 1
 */
import { dec, ONE, roundMoney, toNum } from './decimal';
import { addDays } from './daycount';

export interface FixedDepositInput {
  capital: number;
  /** TNA en forma decimal. */
  tna: number;
  days: number;
  /** Base anual del contrato (365 o 360). */
  base: 365 | 360;
  startDate?: string;
}

export interface FixedDepositResult {
  interest: number;
  finalAmount: number;
  /** Tasa efectiva del plazo: TNA · días / base. */
  periodRate: number;
  /** Cantidad (fraccionaria) de renovaciones en 365 días. */
  renewalsPerYear: number;
  /** TEA bajo el supuesto de reinversión sucesiva de capital e intereses. */
  teaWithReinvestment: number;
  /** Tasa efectiva mensual equivalente (30 días). */
  monthlyEquivalent: number;
  endDate?: string;
}

/** Días del año calendario usados para anualizar rendimientos. */
export const CALENDAR_YEAR_DAYS = 365;

export function fixedDeposit(input: FixedDepositInput): FixedDepositResult {
  if (!(input.capital > 0)) throw new Error('El capital debe ser mayor que cero.');
  if (!(input.days >= 1) || !Number.isInteger(input.days)) throw new Error('El plazo debe ser un número entero de días mayor o igual a 1.');
  if (input.tna < 0) throw new Error('La TNA no puede ser negativa.');
  const C = dec(input.capital);
  const periodRate = dec(input.tna).times(input.days).div(input.base);
  const interest = roundMoney(C.times(periodRate));
  const growth = ONE.plus(periodRate);
  const renewals = dec(CALENDAR_YEAR_DAYS).div(input.days);
  return {
    interest: toNum(interest),
    finalAmount: toNum(C.plus(interest)),
    periodRate: toNum(periodRate),
    renewalsPerYear: toNum(renewals),
    teaWithReinvestment: toNum(growth.pow(renewals).minus(1)),
    monthlyEquivalent: toNum(growth.pow(dec(30).div(input.days)).minus(1)),
    endDate: input.startDate ? addDays(input.startDate, input.days) : undefined,
  };
}

export interface RenewalStep {
  k: number;
  startDay: number;
  endDay: number;
  opening: number;
  interest: number;
  closing: number;
}

/**
 * Simula renovaciones sucesivas con la misma TNA y plazo, reinvirtiendo capital
 * e intereses, mientras la colocación termine dentro del horizonte en días.
 */
export function renewalSchedule(input: FixedDepositInput, horizonDays = CALENDAR_YEAR_DAYS): RenewalStep[] {
  const steps: RenewalStep[] = [];
  let balance = dec(input.capital);
  const rate = dec(input.tna).times(input.days).div(input.base);
  for (let k = 1; k * input.days <= horizonDays; k++) {
    const interest = roundMoney(balance.times(rate));
    const closing = balance.plus(interest);
    steps.push({
      k,
      startDay: (k - 1) * input.days,
      endDay: k * input.days,
      opening: toNum(balance),
      interest: toNum(interest),
      closing: toNum(closing),
    });
    balance = closing;
  }
  return steps;
}
