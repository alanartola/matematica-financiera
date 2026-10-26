import { CATALOGO } from './catalogo';
import { GUIA } from './guia';
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [...GUIA, ...CATALOGO];
export const GUIDE_AVAILABLE = GUIA.length > 0;

export function findExercise(id: string | null | undefined): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export * from './types';
