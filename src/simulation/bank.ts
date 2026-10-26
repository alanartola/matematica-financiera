/**
 * Capa de simulación del Módulo 5: plazos fijos y comparación de colocaciones.
 */
import { dec, fixedDeposit, renewalSchedule, toNum, type FixedDepositInput, type FixedDepositResult, type RenewalStep } from '../engine';

/** Rendimiento del plazo y TEA con reinversión en función de los días. */
export function depositByDays(tna: number, base: 365 | 360, maxDays = 365): { days: number; periodRate: number; tea: number }[] {
  const out: { days: number; periodRate: number; tea: number }[] = [];
  for (let d = 7; d <= maxDays; d += d < 60 ? 1 : 5) {
    const r = fixedDeposit({ capital: 1, tna, days: d, base });
    out.push({ days: d, periodRate: r.periodRate, tea: r.teaWithReinvestment });
  }
  return out;
}

export interface DepositAlternative {
  id: string;
  entity: string;
  tna: number;
  days: number;
  base: 365 | 360;
  source: string;
  date: string;
}

export interface DepositComparison {
  alt: DepositAlternative;
  result: FixedDepositResult;
  /** Renovaciones completas dentro del horizonte. */
  renewals: RenewalStep[];
  /** Monto al final de las renovaciones completas. */
  amountAtLastRenewal: number;
  /** Monto equivalente al horizonte con la TEA (renovaciones fraccionarias). */
  equivalentAtHorizon: number;
}

export function compareDeposits(alts: DepositAlternative[], capital: number, horizonDays: number): DepositComparison[] {
  return alts.map((alt) => {
    const input: FixedDepositInput = { capital, tna: alt.tna, days: Math.max(1, Math.round(alt.days)), base: alt.base };
    const result = fixedDeposit(input);
    const renewals = renewalSchedule(input, horizonDays);
    return {
      alt,
      result,
      renewals,
      amountAtLastRenewal: renewals.length ? renewals[renewals.length - 1].closing : capital,
      equivalentAtHorizon: toNum(dec(capital).times(dec(1).plus(result.periodRate).pow(dec(horizonDays).div(input.days)))),
    };
  });
}
