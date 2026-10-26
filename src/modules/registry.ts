/**
 * Registro de módulos y temas. Cada tema se carga de forma diferida para que la
 * aplicación inicie rápido y para que agregar una herramienta nueva sólo
 * requiera registrarla aquí.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface PageProps {
  query: URLSearchParams;
  topicId?: string | null;
}

export interface TopicDef {
  id: string;
  label: string;
  page: LazyExoticComponent<ComponentType<PageProps>>;
}

export interface ModuleDef {
  id: string;
  number: number;
  label: string;
  short: string;
  description: string;
  topics: TopicDef[];
  /** Módulos con navegación propia (p. ej. ejercicios) no muestran pestañas de temas. */
  customNav?: boolean;
}

const page = (loader: () => Promise<{ default: ComponentType<PageProps> }>) => lazy(loader);

export const MODULES: ModuleDef[] = [
  {
    id: 'tasas',
    number: 1,
    label: 'Tasas de interés y capitalización',
    short: 'Tasas',
    description: 'Interés simple y compuesto, tasas periódicas y efectivas, TNA, TEA y sus equivalencias.',
    topics: [
      { id: 'interes-simple', label: 'Interés simple', page: page(() => import('./tasas/InteresSimple')) },
      { id: 'interes-compuesto', label: 'Interés compuesto', page: page(() => import('./tasas/InteresCompuesto')) },
      { id: 'tasa-efectiva', label: 'Tasas efectivas', page: page(() => import('./tasas/TasaEfectiva')) },
      { id: 'tna', label: 'TNA', page: page(() => import('./tasas/Tna')) },
      { id: 'tea', label: 'TEA', page: page(() => import('./tasas/Tea')) },
      { id: 'comparador', label: 'Comparador de tasas', page: page(() => import('./tasas/ComparadorTasas')) },
    ],
  },
  {
    id: 'amortizacion',
    number: 2,
    label: 'Sistemas de amortización',
    short: 'Amortización',
    description: 'Construcción de cuadros de marcha: sistemas francés, alemán, americano y americano Bullet.',
    topics: [
      { id: 'frances', label: 'Sistema francés', page: page(() => import('./amortizacion/Frances')) },
      { id: 'aleman', label: 'Sistema alemán', page: page(() => import('./amortizacion/Aleman')) },
      { id: 'americano', label: 'Sistema americano', page: page(() => import('./amortizacion/Americano')) },
      { id: 'bullet', label: 'Americano Bullet', page: page(() => import('./amortizacion/Bullet')) },
      { id: 'comparador', label: 'Comparador de sistemas', page: page(() => import('./amortizacion/ComparadorSistemas')) },
    ],
  },
  {
    id: 'laboratorio',
    number: 3,
    label: 'Laboratorio de préstamos',
    short: 'Laboratorio',
    description: 'Cambios de sistema y de tasa durante la operación, pagos extraordinarios y cálculos inversos.',
    topics: [
      { id: 'simulador', label: 'Simulador de modificaciones', page: page(() => import('./laboratorio/Simulador')) },
      { id: 'capital-original', label: 'Capital original (cálculo inverso)', page: page(() => import('./laboratorio/CapitalOriginal')) },
      { id: 'otros-inversos', label: 'Tasa, plazo y saldo', page: page(() => import('./laboratorio/OtrosInversos')) },
    ],
  },
  {
    id: 'valor-temporal',
    number: 4,
    label: 'Valor temporal del dinero',
    short: 'Valor temporal',
    description: 'Valor actual, valor futuro, descuento de flujos, VAN, TIR y líneas de tiempo financieras.',
    topics: [
      { id: 'valor-actual', label: 'Valor actual', page: page(() => import('./valor-temporal/ValorActual')) },
      { id: 'valor-futuro', label: 'Valor futuro', page: page(() => import('./valor-temporal/ValorFuturo')) },
      { id: 'van', label: 'VAN', page: page(() => import('./valor-temporal/Van')) },
      { id: 'tir', label: 'TIR', page: page(() => import('./valor-temporal/Tir')) },
      { id: 'linea-de-tiempo', label: 'Línea de tiempo', page: page(() => import('./valor-temporal/LineaDeTiempo')) },
    ],
  },
  {
    id: 'bancarias',
    number: 5,
    label: 'Aplicaciones bancarias',
    short: 'Bancarias',
    description: 'Plazos fijos, comparación de alternativas y análisis de préstamos con cargos.',
    topics: [
      { id: 'plazo-fijo', label: 'Plazo fijo', page: page(() => import('./bancarias/PlazoFijo')) },
      { id: 'comparador', label: 'Comparador de alternativas', page: page(() => import('./bancarias/ComparadorBancario')) },
      { id: 'prestamo', label: 'Préstamo con cargos y CFT', page: page(() => import('./bancarias/PrestamoBancario')) },
    ],
  },
  {
    id: 'ejercicios',
    number: 6,
    label: 'Ejercicios interactivos',
    short: 'Ejercicios',
    description: 'Problemas con parámetros modificables, resolución guiada y visualización de resultados.',
    customNav: true,
    topics: [{ id: 'guia', label: 'Guía de ejercicios', page: page(() => import('./ejercicios/Ejercicios')) }],
  },
];

export function findModule(id: string | null): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
