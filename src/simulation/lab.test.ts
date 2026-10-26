import { describe, expect, it } from 'vitest';
import { LAB_PRESETS, runLab, newId } from './lab';
import { LOAN_DEFAULTS, loanInputFrom } from './loans';

const input = loanInputFrom(LOAN_DEFAULTS, 'frances');

describe('laboratorio de préstamos', () => {
  it('ejemplo francés → alemán → francés: historia intacta y verificaciones aprobadas', () => {
    const lab = runLab(input, LAB_PRESETS[0].events());
    expect(lab.history.ok).toBe(true);
    expect(lab.checks.every((c) => c.ok)).toBe(true);
    expect(lab.modified.segments.map((s) => s.system)).toEqual(['frances', 'aleman', 'frances']);
    expect(lab.impacts[0].period).toBe(6);
    expect(lab.impacts[0].modified!.payment).toBeGreaterThan(lab.impacts[0].base!.payment);
    expect(lab.interestSaving).toBeGreaterThan(0);
  });

  it('cambios de tasa respetan las cuotas vencidas', () => {
    const preset = LAB_PRESETS[1];
    const lab = runLab(loanInputFrom({ ...LOAN_DEFAULTS, ...preset.loan }, 'frances'), preset.events());
    expect(lab.history.ok).toBe(true);
    expect(lab.history.detail).toContain('1 a 12');
    expect(lab.interestSaving).toBeLessThan(0);
  });

  it('pago extraordinario: el impacto se mide desde la cuota siguiente', () => {
    const lab = runLab(input, [{ id: newId(), type: 'prepago', period: 12, amount: 2_000_000, mode: 'reducir-cuota' }]);
    expect(lab.impacts[0].period).toBe(13);
    expect(lab.history.ok).toBe(true);
    expect(lab.modified.rows[11].payment).toBe(lab.base.rows[11].payment);
    expect(lab.modified.rows[12].payment).toBeLessThan(lab.base.rows[12].payment);
  });

  it('el orden de ingreso de las modificaciones no altera el resultado', () => {
    const evs = LAB_PRESETS[0].events();
    const a = runLab(input, evs);
    const b = runLab(input, [...evs].reverse());
    expect(a.modified.totals.interest).toBe(b.modified.totals.interest);
  });
});
