import { describe, expect, it } from 'vitest';
import { EXERCISES, defaultParams } from './index';

describe('catálogo de ejercicios', () => {
  it('identificadores únicos', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const ex of EXERCISES) {
    it(`${ex.id}: resuelve con parámetros predeterminados, mínimos y máximos`, () => {
      const variants = [defaultParams(ex), Object.fromEntries(ex.params.map((d) => [d.key, d.min])), Object.fromEntries(ex.params.map((d) => [d.key, d.max]))];
      for (const p of variants) {
        const sol = ex.solve(p);
        expect(sol.formula.length).toBeGreaterThan(0);
        expect(sol.development.length).toBeGreaterThan(0);
        for (const a of sol.answers) expect(Number.isFinite(a.value)).toBe(true);
      }
    });
  }

  it('ejemplo del enunciado: $ 1.000.000 al 3 % mensual durante 12 meses', () => {
    const ex = EXERCISES.find((e) => e.id === 'simple-vs-compuesto')!;
    const sol = ex.solve(defaultParams(ex));
    expect(sol.answers[0].value).toBe(1_360_000);
    expect(sol.answers[1].value).toBeCloseTo(1_425_760.89, 2);
  });
});
