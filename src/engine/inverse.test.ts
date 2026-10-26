import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  impliedRate,
  impliedRateFrench,
  impliedTerm,
  outstandingBalance,
  principalFromPayment,
  reconstructPrincipal,
  type AmortSystem,
  type InverseCapitalInput,
} from './index';

const RATE = { kind: 'TNA' as const, value: 0.36, m: 12 };

function lastPayments(system: AmortSystem, n = 36, count = 3, principal = 10_000_000, bulletMode: 'compuesto' | 'simple' = 'compuesto') {
  const s = buildSchedule({ principal, periods: n, paymentsPerYear: 12, rate: RATE, system, bulletMode });
  return s.rows.slice(n - count).map((r) => r.payment);
}

function base(system: AmortSystem, payments: number[], extra: Partial<InverseCapitalInput> = {}): InverseCapitalInput {
  return { system, rate: RATE, paymentsPerYear: 12, payments, positionMode: 'ultimas', ...extra };
}

describe('reconstrucción del capital original', () => {
  it('francés con n conocido: solución única y verificada', () => {
    const res = reconstructPrincipal(base('frances', lastPayments('frances'), { totalPeriods: 36 }));
    expect(res.status).toBe('unica');
    expect(Math.abs(res.estimatedPrincipal! - 10_000_000)).toBeLessThan(2);
    expect(res.principal).toBe(10_000_000);
    expect(res.exactMatch).toBe(true);
    expect(res.verification).toHaveLength(3);
    for (const v of res.verification) expect(Math.abs(v.difference)).toBeLessThan(0.5);
  });

  it('francés con n desconocido: múltiples soluciones, se solicita n', () => {
    const res = reconstructPrincipal(base('frances', lastPayments('frances')));
    expect(res.status).toBe('multiples');
    expect(res.principal).toBeNull();
    expect(res.missing).toContain('Número total de cuotas de la operación');
    expect(res.compatible.length).toBeGreaterThan(100);
  });

  it('alemán con últimas cuotas: n no identificable, pero revela la tasa', () => {
    const res = reconstructPrincipal(base('aleman', lastPayments('aleman')));
    expect(res.status).toBe('multiples');
    expect(res.impliedRate!).toBeCloseTo(0.03, 4);
  });

  it('alemán con posición conocida: identifica n y el capital', () => {
    const s = buildSchedule({ principal: 10_000_000, periods: 36, paymentsPerYear: 12, rate: RATE, system: 'aleman' });
    const payments = s.rows.slice(9, 12).map((r) => r.payment);
    const res = reconstructPrincipal(base('aleman', payments, { positionMode: 'absoluta', firstPosition: 10 }));
    expect(res.status).toBe('unica');
    expect(res.n).toBe(36);
    expect(Math.abs(res.principal! - 10_000_000)).toBeLessThan(5);
  });

  it('americano: el capital queda identificado aunque n no', () => {
    const res = reconstructPrincipal(base('americano', lastPayments('americano')));
    expect(res.status).toBe('capital-unico');
    expect(res.principal!).toBeCloseTo(10_000_000, 2);
  });

  it('Bullet con n conocido', () => {
    const payments = lastPayments('bullet');
    expect(payments.slice(0, 2)).toEqual([0, 0]);
    const res = reconstructPrincipal(base('bullet', payments, { totalPeriods: 36 }));
    expect(res.status).toBe('unica');
    expect(Math.abs(res.principal! - 10_000_000)).toBeLessThan(1);
  });

  it('Bullet con interés simple', () => {
    const res = reconstructPrincipal(base('bullet', lastPayments('bullet', 36, 3, 10_000_000, 'simple'), { totalPeriods: 36, bulletMode: 'simple' }));
    expect(res.principal!).toBeCloseTo(10_000_000, 2);
  });

  it('datos incompatibles: informa discrepancias y no inventa un capital', () => {
    const res = reconstructPrincipal(base('frances', [450_000, 455_000, 460_000], { totalPeriods: 36 }));
    expect(res.status).toBe('sin-solucion');
    expect(res.principal).toBeNull();
    expect(res.discrepancies.length).toBeGreaterThan(3);
  });

  it('tasa distinta de la utilizada en un alemán: la detecta', () => {
    const s = buildSchedule({ principal: 10_000_000, periods: 36, paymentsPerYear: 12, rate: { kind: 'TNA', value: 0.48, m: 12 }, system: 'aleman' });
    const res = reconstructPrincipal(
      base(
        'aleman',
        s.rows.slice(33).map((r) => r.payment),
        { totalPeriods: 36 },
      ),
    );
    expect(res.status).toBe('sin-solucion');
    expect(res.impliedRate!).toBeCloseTo(0.04, 4);
    expect(res.discrepancies[0]).toMatch(/revela la tasa/);
  });

  it('cuotas con IVA sobre intereses y seguro sobre saldo', () => {
    const s = buildSchedule({ principal: 5_000_000, periods: 24, paymentsPerYear: 12, rate: RATE, system: 'frances' });
    const payments = s.rows.slice(21).map((r) => Math.round((r.payment + r.interestPaid * 0.21 + r.openingPrincipal * 0.0005 + 300) * 100) / 100);
    const charges = { ivaOnInterest: 0.21, insuranceOnBalance: 0.0005, fixedFee: 300 };
    const res = reconstructPrincipal(base('frances', payments, { totalPeriods: 24, charges }));
    expect(res.status).toBe('unica');
    expect(Math.abs(res.principal! - 5_000_000)).toBeLessThan(5);
    // Sin declarar los cargos, los datos no son compatibles con un francés puro.
    expect(reconstructPrincipal(base('frances', payments, { totalPeriods: 24 })).status).toBe('sin-solucion');
  });

  it('n menor que la posición de las cuotas: datos insuficientes', () => {
    const res = reconstructPrincipal(base('frances', [1, 1, 1], { positionMode: 'absoluta', firstPosition: 10, totalPeriods: 5 }));
    expect(res.status).toBe('datos-insuficientes');
  });
});

describe('otros cálculos inversos', () => {
  const s = buildSchedule({ principal: 10_000_000, periods: 36, paymentsPerYear: 12, rate: RATE, system: 'frances', rounding: 'exacto' });
  const c = s.rows[0].payment;
  it('tasa implícita del francés', () => {
    const res = impliedRateFrench(10_000_000, 36, c);
    expect(res.value!).toBeCloseTo(0.03, 10);
  });
  it('tasa implícita del alemán, americano y Bullet', () => {
    expect(impliedRate('aleman', 1200, 12, 100 + 12).value!).toBeCloseTo(0.01, 12);
    expect(impliedRate('americano', 1000, 12, 20).value!).toBeCloseTo(0.02, 12);
    expect(impliedRate('bullet', 1000, 2, 1210).value!).toBeCloseTo(0.1, 12);
  });
  it('sin tasa compatible si las cuotas no cubren el capital', () => {
    expect(impliedRateFrench(1000, 10, 90).ok).toBe(false);
  });
  it('plazo del francés y del alemán', () => {
    expect(impliedTerm('frances', 10_000_000, 0.03, c).value!).toBeCloseTo(36, 8);
    expect(impliedTerm('aleman', 1200, 0.01, 112).value!).toBeCloseTo(12, 12);
    expect(impliedTerm('frances', 1000, 0.1, 100).ok).toBe(false);
    expect(impliedTerm('americano', 1000, 0.1, 100).ok).toBe(false);
  });
  it('capital a partir de una cuota', () => {
    expect(principalFromPayment('frances', c, 0.03, 36).value!).toBeCloseTo(10_000_000, 6);
    expect(principalFromPayment('aleman', 112, 0.01, 12).value!).toBeCloseTo(1200, 10);
    expect(principalFromPayment('americano', 20, 0.02, 12).value!).toBeCloseTo(1000, 10);
    expect(principalFromPayment('bullet', 1210, 0.1, 2).value!).toBeCloseTo(1000, 10);
  });
  it('saldo pendiente', () => {
    expect(outstandingBalance('aleman', 1200, 0.01, 12, 3).value).toBe(900);
    expect(outstandingBalance('americano', 1200, 0.01, 12, 11).value).toBe(1200);
    expect(outstandingBalance('frances', 1200, 0.01, 12, 12).value).toBe(0);
  });
});
