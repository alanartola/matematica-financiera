/**
 * Verificaciones de consistencia de un cuadro de marcha.
 * Se ejecutan sobre cada resultado del motor y se muestran en la interfaz.
 */
import { dec, roundMoney, sum, MONEY_TOLERANCE, type Dec } from './decimal';
import type { ScheduleResult } from './amortization';

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

const fmt = (x: Dec) => x.toDecimalPlaces(2).toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function validateSchedule(result: ScheduleResult): Check[] {
  const { rows, input } = result;
  const rounding = input.rounding ?? 'centavos';
  // En modo exacto los importes se transportan como `number`; se admite un error relativo ínfimo.
  const tol = rounding === 'centavos' ? MONEY_TOLERANCE.plus('0.001') : dec(input.principal).times('1e-9').plus('1e-6');
  const checks: Check[] = [];
  const last = rows[rows.length - 1];

  const finalDebt = dec(last.closingPrincipal).plus(last.closingAccrued);
  checks.push({
    id: 'saldo-final',
    label: 'El saldo final es cero',
    ok: finalDebt.abs().lte(tol),
    detail: `Saldo luego de la cuota ${last.period}: $ ${fmt(finalDebt)}.`,
  });

  const amortized = sum(rows.map((x) => dec(x.amortization).plus(x.extraPayment)));
  const expected = dec(input.principal).plus(sum(rows.map((x) => dec(x.capitalizedIntoPrincipal))));
  checks.push({
    id: 'suma-amortizaciones',
    label: 'La suma de amortizaciones coincide con el capital',
    ok: amortized.minus(expected).abs().lte(tol),
    detail: `Amortizaciones + pagos extraordinarios: $ ${fmt(amortized)}; capital (más intereses capitalizados): $ ${fmt(expected)}.`,
  });

  let continuityOk = true;
  let continuityDetail = 'Cada saldo inicial coincide con el saldo final de la cuota anterior.';
  for (let k = 1; k < rows.length; k++) {
    const prev = dec(rows[k - 1].closingPrincipal).plus(rows[k].capitalizedIntoPrincipal);
    if (prev.minus(rows[k].openingPrincipal).abs().gt(tol)) {
      continuityOk = false;
      continuityDetail = `Discontinuidad en la cuota ${rows[k].period}.`;
      break;
    }
  }
  checks.push({ id: 'continuidad', label: 'Continuidad de saldos', ok: continuityOk, detail: continuityDetail });

  let interestOk = true;
  let interestDetail = 'Cada interés es el saldo que lo genera multiplicado por la tasa del período.';
  for (const row of rows) {
    const base = row.system === 'bullet' && row.bulletMode === 'compuesto' ? dec(row.openingPrincipal).plus(row.openingAccrued) : dec(row.openingPrincipal);
    const expectedInterest = roundMoney(base.times(row.rate), rounding);
    // Tolerancia de un centavo adicional: la tasa se transporta como number y puede
    // alterar el redondeo de un importe situado exactamente en medio centavo.
    if (expectedInterest.minus(row.interest).abs().gt(tol.plus(rounding === 'centavos' ? '0.01' : 0))) {
      interestOk = false;
      interestDetail = `En la cuota ${row.period} el interés no coincide con saldo × tasa.`;
      break;
    }
  }
  checks.push({ id: 'interes-sobre-saldo', label: 'Intereses calculados sobre el saldo correspondiente', ok: interestOk, detail: interestDetail });

  const badPayment = rows.find((row) => dec(row.interestPaid).plus(row.amortization).minus(row.payment).abs().gt(tol));
  checks.push({
    id: 'composicion-cuota',
    label: 'Cuota = interés pagado + amortización',
    ok: !badPayment,
    detail: badPayment ? `Diferencia en la cuota ${badPayment.period}.` : 'Se verifica en todas las cuotas.',
  });

  const negative = rows.find((row) => row.closingPrincipal < -tol.toNumber() || row.closingAccrued < -tol.toNumber());
  checks.push({
    id: 'sin-negativos',
    label: 'No existen saldos negativos',
    ok: !negative,
    detail: negative ? `Saldo negativo en la cuota ${negative.period}.` : 'Todos los saldos son mayores o iguales a cero.',
  });

  const accruedTotal = sum(rows.map((x) => dec(x.interest)));
  const paidTotal = sum(rows.map((x) => dec(x.interestPaid))).plus(sum(rows.map((x) => dec(x.capitalizedIntoPrincipal))));
  checks.push({
    id: 'intereses-cancelados',
    label: 'Todo interés devengado fue pagado o capitalizado',
    ok: accruedTotal.minus(paidTotal).abs().lte(tol),
    detail: `Devengado: $ ${fmt(accruedTotal)}; pagado o capitalizado: $ ${fmt(paidTotal)}.`,
  });

  return checks;
}

/**
 * Comprueba que dos cuadros coincidan exactamente hasta la cuota `untilPeriod`
 * inclusive (los pagos históricos no deben alterarse al modificar la operación).
 */
export function checkHistoryPreserved(base: ScheduleResult, modified: ScheduleResult, untilPeriod: number): Check {
  for (let k = 0; k < untilPeriod && k < base.rows.length && k < modified.rows.length; k++) {
    const a = base.rows[k];
    const b = modified.rows[k];
    if (a.payment !== b.payment || a.interest !== b.interest || a.amortization !== b.amortization || a.closingPrincipal !== b.closingPrincipal) {
      return {
        id: 'historia',
        label: 'Los pagos anteriores a la primera modificación no cambian',
        ok: false,
        detail: `La cuota ${a.period} difiere entre el escenario original y el modificado.`,
      };
    }
  }
  return {
    id: 'historia',
    label: 'Los pagos anteriores a la primera modificación no cambian',
    ok: true,
    detail: untilPeriod > 0 ? `Cuotas 1 a ${untilPeriod} idénticas en ambos escenarios.` : 'La modificación rige desde la primera cuota.',
  };
}
