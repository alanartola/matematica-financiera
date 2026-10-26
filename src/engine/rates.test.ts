import { describe, expect, it } from 'vitest';
import {
  compoundFutureValue,
  compoundSchedule,
  convertEffective,
  nominalContinuousFromTea,
  nominalFromTea,
  periodicRate,
  simpleFutureValue,
  simpleInterest,
  simpleSchedule,
  teaContinuous,
  teaFromNominal,
  effectiveAnnual,
} from './index';

describe('conversión de tasas (períodos uniformes)', () => {
  it('TNA 36 % mensual → tasa mensual 3 %', () => {
    expect(periodicRate({ kind: 'TNA', value: 0.36, m: 12 }, 12).toNumber()).toBe(0.03);
  });

  it('TEA = (1 + TNA/m)^m − 1', () => {
    expect(teaFromNominal(0.36, 12).toNumber()).toBeCloseTo(0.42576088684617, 12);
    expect(teaFromNominal(0.36, 1).toNumber()).toBeCloseTo(0.36, 14);
    expect(teaFromNominal(0.36, 2).toNumber()).toBeCloseTo(0.3924, 14);
  });

  it('TEA → TNA es la inversa exacta para la misma frecuencia', () => {
    for (const m of [1, 2, 3, 4, 6, 12, 24, 52, 365]) {
      const tea = teaFromNominal(0.3, m);
      expect(nominalFromTea(tea, m).toNumber()).toBeCloseTo(0.3, 14);
    }
  });

  it('la TEA crece con la frecuencia y tiende al límite continuo', () => {
    const values = [1, 2, 4, 12, 52, 365].map((m) => teaFromNominal(0.36, m).toNumber());
    for (let k = 1; k < values.length; k++) expect(values[k]).toBeGreaterThan(values[k - 1]);
    expect(values[values.length - 1]).toBeLessThan(teaContinuous(0.36).toNumber());
    expect(teaContinuous(0.36).toNumber()).toBeCloseTo(Math.exp(0.36) - 1, 14);
    expect(nominalContinuousFromTea(teaContinuous(0.36)).toNumber()).toBeCloseTo(0.36, 14);
  });

  it('equivalencia entre tasas efectivas de distinto período', () => {
    const tem = 0.03;
    const tet = convertEffective(tem, 12, 4).toNumber();
    expect(tet).toBeCloseTo(1.03 ** 3 - 1, 14);
    const tea = convertEffective(tem, 12, 1).toNumber();
    expect(tea).toBeCloseTo(1.03 ** 12 - 1, 14);
    // Ida y vuelta.
    expect(convertEffective(tea, 1, 12).toNumber()).toBeCloseTo(0.03, 14);
    // Coherencia: mensual → trimestral → anual = mensual → anual.
    expect(convertEffective(tet, 4, 1).toNumber()).toBeCloseTo(tea, 14);
  });

  it('periodicRate respeta cada especificación', () => {
    expect(periodicRate({ kind: 'TEA', value: 0.42576088684617 }, 12).toNumber()).toBeCloseTo(0.03, 12);
    expect(periodicRate({ kind: 'TEP', value: 0.03, perYear: 12 }, 4).toNumber()).toBeCloseTo(1.03 ** 3 - 1, 14);
    // TNA con capitalización mensual expresada en tasa trimestral.
    expect(periodicRate({ kind: 'TNA', value: 0.36, m: 12 }, 4).toNumber()).toBeCloseTo(1.03 ** 3 - 1, 14);
    expect(effectiveAnnual({ kind: 'TNA', value: 0.36, m: 12 }).toNumber()).toBeCloseTo(0.42576088684617, 12);
  });

  it('tasa cero se mantiene en cero en todas las conversiones', () => {
    expect(teaFromNominal(0, 12).toNumber()).toBe(0);
    expect(nominalFromTea(0, 12).toNumber()).toBe(0);
    expect(convertEffective(0, 12, 1).toNumber()).toBe(0);
  });
});

describe('interés simple y compuesto', () => {
  it('ejemplo $1.000.000 al 3 % mensual durante 12 meses', () => {
    expect(simpleInterest(1_000_000, 0.03, 12).toNumber()).toBe(360_000);
    expect(simpleFutureValue(1_000_000, 0.03, 12).toNumber()).toBe(1_360_000);
    expect(compoundFutureValue(1_000_000, 0.03, 12).toNumber()).toBeCloseTo(1_425_760.886846, 5);
  });

  it('evolución del interés simple es lineal', () => {
    const rows = simpleSchedule(1000, 0.05, 10);
    expect(rows).toHaveLength(11);
    for (let t = 1; t < rows.length; t++) expect(rows[t].amount - rows[t - 1].amount).toBeCloseTo(50, 10);
  });

  it('el interés compuesto de cada período se calcula sobre el capital actualizado', () => {
    const rows = compoundSchedule(1000, 0.1, 3);
    expect(rows[1].periodInterest).toBeCloseTo(100, 10);
    expect(rows[2].opening).toBeCloseTo(1100, 10);
    expect(rows[2].periodInterest).toBeCloseTo(110, 10);
    expect(rows[2].interestOnInterest).toBeCloseTo(10, 10);
    expect(rows[3].closing).toBeCloseTo(1331, 10);
    expect(rows[3].accumulatedInterest).toBeCloseTo(331, 10);
  });

  it('en el primer período ambos regímenes coinciden', () => {
    expect(simpleFutureValue(1000, 0.07, 1).toNumber()).toBe(compoundFutureValue(1000, 0.07, 1).toNumber());
  });

  it('para 0 < n < 1 el interés simple supera al compuesto', () => {
    expect(simpleFutureValue(1000, 0.1, 0.5).toNumber()).toBeGreaterThan(compoundFutureValue(1000, 0.1, 0.5).toNumber());
  });
});
