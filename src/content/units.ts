/** Unidades de tiempo para rotular períodos en gráficos y desarrollos. */
export type PeriodUnit = 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'año' | 'período';

export const UNIT_OPTIONS: { value: PeriodUnit; label: string }[] = [
  { value: 'mes', label: 'Meses' },
  { value: 'bimestre', label: 'Bimestres' },
  { value: 'trimestre', label: 'Trimestres' },
  { value: 'semestre', label: 'Semestres' },
  { value: 'año', label: 'Años' },
  { value: 'período', label: 'Períodos' },
];

const PLURALS: Record<PeriodUnit, string> = {
  mes: 'meses',
  bimestre: 'bimestres',
  trimestre: 'trimestres',
  semestre: 'semestres',
  año: 'años',
  período: 'períodos',
};

const ADJECTIVES: Record<PeriodUnit, string> = {
  mes: 'mensual',
  bimestre: 'bimestral',
  trimestre: 'trimestral',
  semestre: 'semestral',
  año: 'anual',
  período: 'periódica',
};

export const unitPlural = (u: PeriodUnit) => PLURALS[u];
export const unitAdjective = (u: PeriodUnit) => ADJECTIVES[u];
export const unitCount = (n: number, u: PeriodUnit) => `${n.toLocaleString('es-AR')} ${n === 1 ? u : PLURALS[u]}`;
export const isUnit = (u: string): u is PeriodUnit => u in PLURALS;
