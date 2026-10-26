import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  checkHistoryPreserved,
  frenchPayment,
  validateSchedule,
  SYSTEMS,
  type LoanInput,
  type ScheduleResult,
} from './index';

const BASE: LoanInput = {
  principal: 10_000_000,
  periods: 36,
  paymentsPerYear: 12,
  rate: { kind: 'TNA', value: 0.36, m: 12 },
  system: 'frances',
};

function expectAllChecks(result: ScheduleResult) {
  const failed = validateSchedule(result).filter((c) => !c.ok);
  expect(failed, JSON.stringify(failed)).toHaveLength(0);
}


describe('sistema francés', () => {
  const res = buildSchedule(BASE);
  it('cuota constante según la fórmula', () => {
    const c = frenchPayment(10_000_000, 0.03, 36).toDecimalPlaces(2).toNumber();
    expect(c).toBeCloseTo(458_037.94, 2);
    for (const row of res.rows.slice(0, -1)) expect(row.payment).toBe(c);
    // La última cuota absorbe el redondeo acumulado: difiere en pocos centavos.
    expect(Math.abs(res.rows[35].payment - c)).toBeLessThan(0.5);
  });
  it('primer interés = capital × 3 %', () => {
    expect(res.rows[0].interest).toBe(300_000);
    expect(res.rows[0].amortization).toBeCloseTo(158_037.94, 2);
  });
  it('amortizaciones crecientes e intereses decrecientes', () => {
    for (let k = 1; k < 35; k++) {
      expect(res.rows[k].amortization).toBeGreaterThan(res.rows[k - 1].amortization);
      expect(res.rows[k].interest).toBeLessThan(res.rows[k - 1].interest);
    }
  });
  it('verificaciones', () => expectAllChecks(res));
});

describe('sistema alemán', () => {
  const res = buildSchedule({ ...BASE, system: 'aleman' });
  it('amortización constante y cuota decreciente', () => {
    expect(res.rows[0].amortization).toBe(277_777.78);
    expect(res.rows[0].payment).toBe(577_777.78);
    for (let k = 1; k < 36; k++) expect(res.rows[k].payment).toBeLessThan(res.rows[k - 1].payment);
    // La última amortización absorbe el redondeo: 10.000.000 − 35 × 277.777,78
    expect(res.rows[35].amortization).toBeCloseTo(10_000_000 - 35 * 277_777.78, 2);
  });
  it('la cuota disminuye en A·i por período', () => {
    expect(res.rows[0].payment - res.rows[1].payment).toBeCloseTo(277_777.78 * 0.03, 1);
  });
  it('verificaciones', () => expectAllChecks(res));
});

describe('sistema americano', () => {
  const res = buildSchedule({ ...BASE, system: 'americano' });
  it('sólo intereses y capital al vencimiento', () => {
    for (const row of res.rows.slice(0, -1)) {
      expect(row.payment).toBe(300_000);
      expect(row.closingPrincipal).toBe(10_000_000);
    }
    expect(res.rows[35].payment).toBe(10_300_000);
    expect(res.totals.interest).toBe(10_800_000);
  });
  it('verificaciones', () => expectAllChecks(res));
});

describe('sistema americano Bullet', () => {
  it('compuesto: pago único = C·(1+i)ⁿ', () => {
    const res = buildSchedule({ ...BASE, system: 'bullet', bulletMode: 'compuesto' });
    for (const row of res.rows.slice(0, -1)) expect(row.payment).toBe(0);
    // Con redondeo por período la diferencia con la fórmula cerrada es de centavos.
    expect(res.rows[35].payment).toBeCloseTo(10_000_000 * 1.03 ** 36, -1);
    expect(res.rows[35].amortization).toBe(10_000_000);
    expectAllChecks(res);
  });
  it('simple: pago único = C·(1 + i·n)', () => {
    const res = buildSchedule({ ...BASE, system: 'bullet', bulletMode: 'simple' });
    expect(res.rows[35].payment).toBe(20_800_000);
    expect(res.rows[10].closingAccrued).toBe(3_300_000);
    expectAllChecks(res);
  });
  it('modo exacto coincide con la fórmula cerrada', () => {
    const res = buildSchedule({ ...BASE, system: 'bullet', rounding: 'exacto' });
    expect(res.rows[35].payment).toBeCloseTo(10_000_000 * 1.03 ** 36, 4);
  });
});

describe('casos límite', () => {
  it('tasa cero en todos los sistemas', () => {
    for (const system of SYSTEMS) {
      const res = buildSchedule({ ...BASE, system, rate: { kind: 'TNA', value: 0, m: 12 } });
      expect(res.totals.interest).toBe(0);
      expect(res.totals.amortization).toBeCloseTo(10_000_000, 2);
      expectAllChecks(res);
    }
  });
  it('plazo mínimo de una cuota', () => {
    for (const system of SYSTEMS) {
      const res = buildSchedule({ ...BASE, system, periods: 1 });
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].payment).toBe(10_300_000);
      expectAllChecks(res);
    }
  });
  it('capitales con centavos y plazos largos', () => {
    for (const system of SYSTEMS) {
      const res = buildSchedule({ ...BASE, system, principal: 1234567.89, periods: 360, rate: { kind: 'TEA', value: 0.123 } });
      expectAllChecks(res);
    }
  });
  it('modo exacto también cierra en cero', () => {
    for (const system of SYSTEMS) expectAllChecks(buildSchedule({ ...BASE, system, rounding: 'exacto' }));
  });
  it('rechaza datos inválidos', () => {
    expect(() => buildSchedule({ ...BASE, principal: 0 })).toThrow();
    expect(() => buildSchedule({ ...BASE, periods: 0 })).toThrow();
    expect(() => buildSchedule({ ...BASE, periods: 2.5 })).toThrow();
  });
});

describe('cambios de sistema durante el préstamo', () => {
  const base = buildSchedule(BASE);
  const modified = buildSchedule({
    ...BASE,
    events: [
      { type: 'sistema', fromPeriod: 6, system: 'aleman' },
      { type: 'sistema', fromPeriod: 16, system: 'frances' },
    ],
  });

  it('las cuotas 1 a 5 no cambian', () => {
    expect(checkHistoryPreserved(base, modified, 5).ok).toBe(true);
  });
  it('el tramo alemán amortiza el saldo de la cuota 5 en las 31 cuotas restantes', () => {
    const saldo5 = modified.rows[4].closingPrincipal;
    const a = Math.round((saldo5 / 31) * 100) / 100;
    for (let k = 5; k < 15; k++) {
      expect(modified.rows[k].system).toBe('aleman');
      expect(modified.rows[k].amortization).toBeCloseTo(a, 2);
    }
  });
  it('el último tramo vuelve al francés con cuota constante sobre el saldo de la cuota 15', () => {
    const saldo15 = modified.rows[14].closingPrincipal;
    const c = frenchPayment(saldo15, 0.03, 21).toDecimalPlaces(2).toNumber();
    for (let k = 15; k < 35; k++) {
      expect(modified.rows[k].system).toBe('frances');
      expect(modified.rows[k].payment).toBe(c);
    }
  });
  it('mantiene el plazo original y cancela la deuda', () => {
    expect(modified.rows).toHaveLength(36);
    expectAllChecks(modified);
  });
  it('identifica tres tramos', () => {
    expect(modified.segments.map((s) => [s.from, s.to, s.system])).toEqual([
      [1, 5, 'frances'],
      [6, 15, 'aleman'],
      [16, 36, 'frances'],
    ]);
  });
  it('pasar a alemán en un tramo intermedio reduce los intereses totales', () => {
    expect(modified.totals.interest).toBeLessThan(base.totals.interest);
  });
  it('cambios múltiples y consecutivos entre los cuatro sistemas', () => {
    const res = buildSchedule({
      ...BASE,
      events: [
        { type: 'sistema', fromPeriod: 4, system: 'americano' },
        { type: 'sistema', fromPeriod: 9, system: 'bullet', bulletMode: 'compuesto' },
        { type: 'sistema', fromPeriod: 14, system: 'aleman' },
        { type: 'sistema', fromPeriod: 25, system: 'bullet', bulletMode: 'simple' },
        { type: 'sistema', fromPeriod: 30, system: 'frances' },
      ],
    });
    expect(res.segments).toHaveLength(6);
    expect(res.totals.capitalized).toBeGreaterThan(0);
    expectAllChecks(res);
  });
});

describe('cambios de tasa durante el préstamo', () => {
  const tna = (v: number) => ({ kind: 'TNA' as const, value: v, m: 12 });
  const base = buildSchedule({ ...BASE, rate: tna(0.3) });
  const modified = buildSchedule({
    ...BASE,
    rate: tna(0.3),
    events: [
      { type: 'tasa', fromPeriod: 13, rate: tna(0.35) },
      { type: 'tasa', fromPeriod: 25, rate: tna(0.4) },
    ],
  });
  it('respeta las cuotas vencidas', () => {
    expect(checkHistoryPreserved(base, modified, 12).ok).toBe(true);
  });
  it('recalcula la cuota francesa sobre el saldo y el plazo restante', () => {
    const c13 = frenchPayment(modified.rows[11].closingPrincipal, 0.35 / 12, 24).toDecimalPlaces(2).toNumber();
    expect(modified.rows[12].payment).toBe(c13);
    expect(modified.rows[12].contractRate).toBeCloseTo(0.35 / 12, 14);
    const c25 = frenchPayment(modified.rows[23].closingPrincipal, 0.4 / 12, 12).toDecimalPlaces(2).toNumber();
    expect(modified.rows[24].payment).toBe(c25);
  });
  it('en el alemán la amortización se mantiene y cambia el interés', () => {
    const res = buildSchedule({ ...BASE, system: 'aleman', rate: tna(0.3), events: [{ type: 'tasa', fromPeriod: 13, rate: tna(0.35) }] });
    expect(res.rows[12].amortization).toBe(res.rows[11].amortization);
    expect(res.rows[12].interest).toBeCloseTo(res.rows[12].openingPrincipal * (0.35 / 12), 2);
    expectAllChecks(res);
  });
  it('verificaciones', () => {
    expectAllChecks(modified);
    expect(modified.rateSegments).toHaveLength(3);
  });
  it('combinación de cambios de tasa y de sistema', () => {
    const res = buildSchedule({
      ...BASE,
      events: [
        { type: 'sistema', fromPeriod: 6, system: 'aleman' },
        { type: 'tasa', fromPeriod: 10, rate: tna(0.5) },
        { type: 'sistema', fromPeriod: 15, system: 'frances' },
      ],
    });
    expectAllChecks(res);
  });
});

describe('pagos extraordinarios', () => {
  const base = buildSchedule(BASE);
  it('reducir cuota: mantiene el plazo y baja la cuota', () => {
    const res = buildSchedule({ ...BASE, events: [{ type: 'prepago', afterPeriod: 12, amount: 2_000_000, mode: 'reducir-cuota' }] });
    expect(res.rows).toHaveLength(36);
    expect(res.rows[12].payment).toBeLessThan(base.rows[12].payment);
    expect(res.rows[11].extraPayment).toBe(2_000_000);
    expect(res.totals.interest).toBeLessThan(base.totals.interest);
    expect(checkHistoryPreserved(base, res, 11).ok).toBe(true);
    expectAllChecks(res);
  });
  it('reducir plazo: mantiene la cuota y termina antes', () => {
    const res = buildSchedule({ ...BASE, events: [{ type: 'prepago', afterPeriod: 12, amount: 2_000_000, mode: 'reducir-plazo' }] });
    expect(res.rows.length).toBeLessThan(36);
    expect(res.rows[12].payment).toBe(base.rows[12].payment);
    expect(res.rows[res.rows.length - 1].payment).toBeLessThanOrEqual(base.rows[12].payment + 0.01);
    const reduceInstallment = buildSchedule({ ...BASE, events: [{ type: 'prepago', afterPeriod: 12, amount: 2_000_000, mode: 'reducir-cuota' }] });
    expect(res.totals.interest).toBeLessThan(reduceInstallment.totals.interest);
    expectAllChecks(res);
  });
  it('reducir plazo en el sistema alemán', () => {
    const res = buildSchedule({ ...BASE, system: 'aleman', events: [{ type: 'prepago', afterPeriod: 6, amount: 1_000_000, mode: 'reducir-plazo' }] });
    expect(res.rows.length).toBeLessThan(36);
    expect(res.rows[6].amortization).toBe(res.rows[0].amortization);
    expectAllChecks(res);
  });
  it('un pago extraordinario mayor al saldo cancela la deuda', () => {
    const res = buildSchedule({ ...BASE, events: [{ type: 'prepago', afterPeriod: 3, amount: 50_000_000, mode: 'reducir-cuota' }] });
    expect(res.rows).toHaveLength(3);
    expect(res.maturity).toBe(3);
    expectAllChecks(res);
  });
  it('en el americano el prepago reduce intereses pero no el plazo', () => {
    const res = buildSchedule({ ...BASE, system: 'americano', events: [{ type: 'prepago', afterPeriod: 12, amount: 4_000_000, mode: 'reducir-plazo' }] });
    expect(res.rows).toHaveLength(36);
    expect(res.rows[12].interest).toBe(180_000);
    expectAllChecks(res);
  });
  it('varios prepagos combinados con cambios de sistema', () => {
    const res = buildSchedule({
      ...BASE,
      events: [
        { type: 'prepago', afterPeriod: 5, amount: 500_000, mode: 'reducir-cuota' },
        { type: 'sistema', fromPeriod: 8, system: 'aleman' },
        { type: 'prepago', afterPeriod: 10, amount: 700_000, mode: 'reducir-plazo' },
        { type: 'sistema', fromPeriod: 20, system: 'frances' },
      ],
    });
    expectAllChecks(res);
  });
});

describe('interés por días efectivos', () => {
  it('ACT/365: interés = saldo · TNA · días / 365 y la deuda se cancela', () => {
    const res = buildSchedule({ ...BASE, convention: { kind: 'dias', basis: 'ACT/365', disbursement: '2026-01-15' } });
    expect(res.rows[0].date).toBe('2026-02-15');
    expect(res.rows[0].days).toBe(31);
    expect(res.rows[0].interest).toBeCloseTo((10_000_000 * 0.36 * 31) / 365, 2);
    expect(res.rows[1].days).toBe(28);
    expectAllChecks(res);
  });
  it('30/360 con TNA mensual reproduce la convención uniforme', () => {
    const a = buildSchedule({ ...BASE, convention: { kind: 'dias', basis: '30/360', disbursement: '2026-01-10' } });
    const b = buildSchedule(BASE);
    expect(a.rows.map((r) => r.payment)).toEqual(b.rows.map((r) => r.payment));
  });
  it('ACT/360 genera más interés que ACT/365', () => {
    const a = buildSchedule({ ...BASE, convention: { kind: 'dias', basis: 'ACT/360', disbursement: '2026-01-15' } });
    const b = buildSchedule({ ...BASE, convention: { kind: 'dias', basis: 'ACT/365', disbursement: '2026-01-15' } });
    expect(a.totals.interest).toBeGreaterThan(b.totals.interest);
    expectAllChecks(a);
  });
  it('fin de mes: desembolso el 31 de enero', () => {
    const res = buildSchedule({ ...BASE, periods: 3, convention: { kind: 'dias', basis: 'ACT/365', disbursement: '2028-01-31' } });
    expect(res.rows.map((r) => r.date)).toEqual(['2028-02-29', '2028-03-31', '2028-04-30']);
    expectAllChecks(res);
  });
});

describe('batería de configuraciones aleatorias', () => {
  // Generador pseudoaleatorio determinístico (reproducible).
  let seed = 20261026;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  it('todas las verificaciones se cumplen', () => {
    for (let k = 0; k < 150; k++) {
      const p = [1, 2, 4, 12][Math.floor(rand() * 4)];
      // Plazos de hasta 30 años y tasas de hasta 60 %: importes dentro del rango exacto de `number`.
      const n = 1 + Math.floor(rand() * Math.min(120, 30 * p));
      const system = SYSTEMS[Math.floor(rand() * 4)];
      const events: LoanInput['events'] = [];
      if (n > 3 && rand() < 0.6) events.push({ type: 'sistema', fromPeriod: 2 + Math.floor(rand() * (n - 2)), system: SYSTEMS[Math.floor(rand() * 4)] });
      if (n > 3 && rand() < 0.5) events.push({ type: 'tasa', fromPeriod: 2 + Math.floor(rand() * (n - 2)), rate: { kind: 'TEA', value: rand() * 0.6 } });
      if (n > 3 && rand() < 0.5)
        events.push({ type: 'prepago', afterPeriod: 1 + Math.floor(rand() * (n - 2)), amount: Math.round(rand() * 300_000), mode: rand() < 0.5 ? 'reducir-cuota' : 'reducir-plazo' });
      const res = buildSchedule({
        principal: Math.round(rand() * 1e8) / 100 + 1000,
        periods: n,
        paymentsPerYear: p,
        rate: { kind: 'TNA', value: rand() * 0.6, m: 12 },
        system,
        events,
      });
      expectAllChecks(res);
    }
  });
});
