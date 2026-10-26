/**
 * Estructura de un ejercicio interactivo.
 *
 * Cada ejercicio declara sus parámetros (modificables con barras), un enunciado
 * que depende de ellos y una función `solve` que usa el motor financiero para
 * producir la resolución completa: datos, incógnita, fórmula, sustitución,
 * desarrollo, resultado, interpretación y visualización.
 *
 * Para incorporar ejercicios de una guía externa basta con agregar objetos que
 * cumplan esta interfaz en un archivo nuevo de esta carpeta y registrarlos en
 * `index.ts` (ver `guia.ts`).
 */
import type { ReactNode } from 'react';
import type { ParamKind } from '../../ui/controls';
import type { Step } from '../../ui/layout';

export type Level = 'inicial' | 'intermedio' | 'avanzado';

export type ExerciseTopic =
  'interes-simple' | 'interes-compuesto' | 'tna-tea' | 'equivalencia' | 'amortizacion' | 'valor-presente' | 'valor-futuro' | 'van' | 'tir' | 'combinados';

export const LEVEL_LABELS: Record<Level, string> = { inicial: 'Inicial', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export const TOPIC_LABELS: Record<ExerciseTopic, string> = {
  'interes-simple': 'Interés simple',
  'interes-compuesto': 'Interés compuesto',
  'tna-tea': 'TNA y TEA',
  equivalencia: 'Equivalencia de tasas',
  amortizacion: 'Sistemas de amortización',
  'valor-presente': 'Valor presente',
  'valor-futuro': 'Valor futuro',
  van: 'VAN',
  tir: 'TIR',
  combinados: 'Problemas combinados',
};

export interface ParamDef {
  key: string;
  label: string;
  kind: ParamKind;
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
}

export type Params = Record<string, number>;

export interface Answer {
  label: string;
  value: number;
  kind: 'money' | 'percent' | 'number';
  /** Tolerancia relativa admitida al comprobar (predeterminada 0,5 %). */
  tolerance?: number;
}

export interface Solution {
  known: [string, string][];
  unknown: string;
  formula: string[];
  substitution: string[];
  development: Step[];
  answers: Answer[];
  interpretation: ReactNode;
  chart: ReactNode;
  chartTitle: string;
}

export interface Exercise {
  id: string;
  title: string;
  level: Level;
  topic: ExerciseTopic;
  /** Origen del ejercicio (p. ej. "Propio de la plataforma" o la guía de referencia). */
  source: string;
  params: ParamDef[];
  statement: (p: Params) => ReactNode;
  hint: (p: Params) => ReactNode;
  solve: (p: Params) => Solution;
  /** Enlace al simulador relacionado con los parámetros cargados. */
  simulator?: (p: Params) => string;
}

export function defaultParams(ex: Exercise): Params {
  return Object.fromEntries(ex.params.map((d) => [d.key, d.default]));
}
