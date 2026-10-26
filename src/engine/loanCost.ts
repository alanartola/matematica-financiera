/**
 * Descomposición del costo de un préstamo con cargos adicionales y estimación
 * del costo financiero total (CFT) a partir de los componentes ingresados.
 *
 * El CFT estimado es la TIR del flujo neto del deudor:
 *   t = 0:  + capital − comisión de otorgamiento (± IVA)
 *   t = k:  − (cuota pura + IVA sobre intereses + seguro + gastos)
 * expresada como tasa efectiva anual (CFTEA) y como tasa nominal anual (CFTNA).
 *
 * No reemplaza el CFT informado por la entidad: sólo incluye los conceptos cargados.
 */
import { dec, roundMoney, sum, toNum } from './decimal';
import type { ScheduleResult } from './amortization';
import { annualizeEffective, irr, type Flow } from './tvm';

export interface LoanCharges {
  /** Alícuota de IVA sobre intereses (0,21 = 21 %). */
  ivaOnInterest: number;
  /** Seguro de vida: tasa por período sobre el saldo de capital al inicio del período. */
  insuranceOnBalance: number;
  /** Gasto fijo por cuota (administración, mantenimiento). */
  fixedFee: number;
  /** Comisión de otorgamiento como proporción del capital. */
  originationRate: number;
  /** ¿Aplica IVA sobre comisiones y gastos? */
  ivaOnFees: boolean;
}

export const NO_CHARGES: LoanCharges = { ivaOnInterest: 0, insuranceOnBalance: 0, fixedFee: 0, originationRate: 0, ivaOnFees: false };

export interface CostRow {
  period: number;
  purePayment: number;
  interest: number;
  amortization: number;
  iva: number;
  insurance: number;
  fee: number;
  total: number;
  balance: number;
}

export interface LoanCostResult {
  rows: CostRow[];
  origination: number;
  originationIva: number;
  netDisbursed: number;
  totals: { purePayments: number; interest: number; iva: number; insurance: number; fees: number; total: number };
  flows: Flow[];
  /** TIR periódica del flujo neto. */
  periodicCost: number | null;
  cftea: number | null;
  cftna: number | null;
}

export function analyzeLoanCost(schedule: ScheduleResult, charges: LoanCharges): LoanCostResult {
  const p = schedule.input.paymentsPerYear;
  const ivaFees = charges.ivaOnFees ? charges.ivaOnInterest : 0;
  const rows: CostRow[] = schedule.rows.map((row) => {
    const iva = roundMoney(dec(row.interestPaid).times(charges.ivaOnInterest));
    const insurance = roundMoney(dec(row.openingPrincipal).times(charges.insuranceOnBalance));
    const fee = roundMoney(dec(charges.fixedFee).times(1 + ivaFees));
    const pure = dec(row.payment).plus(row.extraPayment);
    const total = pure.plus(iva).plus(insurance).plus(fee);
    return {
      period: row.period,
      purePayment: toNum(pure),
      interest: row.interestPaid,
      amortization: row.amortization + row.extraPayment,
      iva: toNum(iva),
      insurance: toNum(insurance),
      fee: toNum(fee),
      total: toNum(total),
      balance: row.closingPrincipal,
    };
  });
  const origination = roundMoney(dec(schedule.input.principal).times(charges.originationRate));
  const originationIva = roundMoney(origination.times(ivaFees));
  const netDisbursed = dec(schedule.input.principal).minus(origination).minus(originationIva);
  const flows: Flow[] = [{ t: 0, amount: toNum(netDisbursed) }, ...rows.map((r) => ({ t: r.period, amount: -r.total }))];
  const solved = irr(flows);
  const periodic = solved.roots.find((x) => x > -1) ?? null;
  return {
    rows,
    origination: toNum(origination),
    originationIva: toNum(originationIva),
    netDisbursed: toNum(netDisbursed),
    totals: {
      purePayments: toNum(sum(rows.map((r) => dec(r.purePayment)))),
      interest: toNum(sum(rows.map((r) => dec(r.interest)))),
      iva: toNum(sum(rows.map((r) => dec(r.iva)))),
      insurance: toNum(sum(rows.map((r) => dec(r.insurance)))),
      fees: toNum(sum(rows.map((r) => dec(r.fee)))),
      total: toNum(sum(rows.map((r) => dec(r.total)))),
    },
    flows,
    periodicCost: periodic,
    cftea: periodic === null ? null : toNum(annualizeEffective(periodic, p)),
    cftna: periodic === null ? null : periodic * p,
  };
}
