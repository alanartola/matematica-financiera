import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  actualDays,
  analyzeLoanCost,
  annualizeEffective,
  buildSchedule,
  datedToFlows,
  days30E360,
  discountFlows,
  fixedDeposit,
  futureValue,
  irr,
  NO_CHARGES,
  npv,
  presentValue,
  renewalSchedule,
  signChanges,
  teaFromNominal,
} from './index';

describe('valor actual y valor futuro', () => {
  it('son operaciones inversas', () => {
    const pv = presentValue(1_000_000, 0.03, 12);
    expect(pv.toNumber()).toBeCloseTo(701_379.88, 2);
    expect(futureValue(pv, 0.03, 12).toNumber()).toBeCloseTo(1_000_000, 8);
  });
  it('el valor actual decrece al aumentar la tasa', () => {
    const values = [0, 0.01, 0.05, 0.1].map((i) => presentValue(1000, i, 5).toNumber());
    for (let k = 1; k < values.length; k++) expect(values[k]).toBeLessThan(values[k - 1]);
  });
});

describe('VAN', () => {
  const flows = [
    { t: 0, amount: -1_000_000 },
    { t: 1, amount: 300_000 },
    { t: 2, amount: 500_000 },
    { t: 3, amount: 700_000 },
  ];
  it('suma de flujos descontados', () => {
    const v = npv(flows, 0.1).toNumber();
    const expected = -1_000_000 + 300_000 / 1.1 + 500_000 / 1.21 + 700_000 / 1.331;
    expect(v).toBeCloseTo(expected, 6);
  });
  it('el detalle acumula el VAN', () => {
    const detail = discountFlows(flows, 0.1);
    expect(detail[3].cumulative).toBeCloseTo(npv(flows, 0.1).toNumber(), 6);
    expect(detail[0].present).toBe(-1_000_000);
  });
  it('con tasa cero el VAN es la suma de los flujos', () => {
    expect(npv(flows, 0).toNumber()).toBe(500_000);
  });
});

describe('TIR', () => {
  it('flujo convencional: una única TIR que anula el VAN', () => {
    const flows = [
      { t: 0, amount: -1_000_000 },
      { t: 1, amount: 300_000 },
      { t: 2, amount: 500_000 },
      { t: 3, amount: 700_000 },
    ];
    const res = irr(flows);
    expect(res.roots).toHaveLength(1);
    expect(npv(flows, res.irr!).abs().toNumber()).toBeLessThan(1e-4);
    expect(res.iterations.length).toBeGreaterThan(0);
    expect(res.warnings).toHaveLength(0);
  });
  it('TIR de un préstamo francés = tasa del préstamo', () => {
    const s = buildSchedule({
      principal: 10_000_000,
      periods: 36,
      paymentsPerYear: 12,
      rate: { kind: 'TNA', value: 0.36, m: 12 },
      system: 'frances',
      rounding: 'exacto',
    });
    const flows = [{ t: 0, amount: 10_000_000 }, ...s.rows.map((r) => ({ t: r.period, amount: -r.payment }))];
    expect(irr(flows).irr!).toBeCloseTo(0.03, 10);
  });
  it('flujos no convencionales con dos TIR (10 % y 20 %)', () => {
    const flows = [
      { t: 0, amount: -100 },
      { t: 1, amount: 230 },
      { t: 2, amount: -132 },
    ];
    const res = irr(flows);
    expect(signChanges(flows)).toBe(2);
    expect(res.roots).toHaveLength(2);
    expect(res.roots[0]).toBeCloseTo(0.1, 10);
    expect(res.roots[1]).toBeCloseTo(0.2, 10);
    expect(res.warnings.length).toBeGreaterThanOrEqual(2);
  });
  it('sin cambio de signo no hay TIR', () => {
    const res = irr([
      { t: 0, amount: 100 },
      { t: 1, amount: 50 },
    ]);
    expect(res.irr).toBeNull();
    expect(res.warnings[0]).toMatch(/no cambian de signo/);
  });
  it('flujos con períodos no enteros (meses expresados en semestres)', () => {
    const flows = [
      { t: 0, amount: -1_000_000 },
      { t: 1, amount: 300_000 },
      { t: 2, amount: 500_000 },
      { t: 3, amount: 700_000 },
    ];
    const r = irr(flows).irr!;
    const annual = annualizeEffective(r, 2).toNumber();
    expect(annual).toBeCloseTo((1 + r) ** 2 - 1, 12);
  });
  it('flujos fechados (ACT/365)', () => {
    const flows = datedToFlows([
      { date: '2026-01-01', amount: -1000 },
      { date: '2027-01-01', amount: 1100 },
    ]);
    expect(flows[1].t).toBe(1);
    expect(irr(flows).irr!).toBeCloseTo(0.1, 10);
  });
});

describe('fechas y bases de cálculo', () => {
  it('suma de meses con fin de mes', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('días reales y 30E/360', () => {
    expect(actualDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(actualDays('2028-01-01', '2029-01-01')).toBe(366);
    expect(days30E360('2026-01-31', '2026-02-28')).toBe(28);
    expect(days30E360('2026-01-15', '2026-07-15')).toBe(180);
    expect(addDays('2026-10-26', 30)).toBe('2026-11-25');
  });
});

describe('plazo fijo', () => {
  const input = { capital: 1_000_000, tna: 0.4, days: 30, base: 365 as const, startDate: '2026-10-26' };
  const res = fixedDeposit(input);
  it('interés = C · TNA · días / base', () => {
    expect(res.interest).toBe(32_876.71);
    expect(res.finalAmount).toBe(1_032_876.71);
    expect(res.endDate).toBe('2026-11-25');
  });
  it('el rendimiento del plazo no es la TEA', () => {
    expect(res.periodRate).toBeCloseTo((0.4 * 30) / 365, 14);
    expect(res.teaWithReinvestment).toBeCloseTo((1 + (0.4 * 30) / 365) ** (365 / 30) - 1, 12);
    expect(res.teaWithReinvestment).toBeGreaterThan(0.4);
  });
  it('base 360 rinde más que base 365 con la misma TNA', () => {
    expect(fixedDeposit({ ...input, base: 360 }).interest).toBeGreaterThan(res.interest);
  });
  it('renovaciones sucesivas capitalizan los intereses', () => {
    const steps = renewalSchedule(input);
    expect(steps).toHaveLength(12);
    expect(steps[1].opening).toBe(steps[0].closing);
  });
  it('a 365 días, TEA = TNA', () => {
    expect(fixedDeposit({ ...input, days: 365 }).teaWithReinvestment).toBeCloseTo(0.4, 12);
  });
});

describe('costo financiero total estimado', () => {
  const schedule = buildSchedule({
    principal: 1_000_000,
    periods: 12,
    paymentsPerYear: 12,
    rate: { kind: 'TNA', value: 0.6, m: 12 },
    system: 'frances',
    rounding: 'exacto',
  });
  it('sin cargos, el CFT coincide con la TEA', () => {
    const res = analyzeLoanCost(schedule, NO_CHARGES);
    expect(res.periodicCost!).toBeCloseTo(0.05, 9);
    expect(res.cftea!).toBeCloseTo(teaFromNominal(0.6, 12).toNumber(), 8);
  });
  it('IVA, seguro, gastos y comisión elevan el CFT', () => {
    const res = analyzeLoanCost(schedule, { ivaOnInterest: 0.21, insuranceOnBalance: 0.001, fixedFee: 500, originationRate: 0.02, ivaOnFees: true });
    expect(res.cftea!).toBeGreaterThan(teaFromNominal(0.6, 12).toNumber());
    expect(res.netDisbursed).toBe(1_000_000 - 20_000 - 4_200);
    expect(res.rows[0].iva).toBeCloseTo(50_000 * 0.21, 2);
  });
});
