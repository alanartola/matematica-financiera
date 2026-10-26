/**
 * Tema visual (claro / oscuro) y modo clase (presentación).
 * Las preferencias se recuerdan en el navegador; si el almacenamiento no está
 * disponible, la aplicación funciona igual con los valores predeterminados.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeName = 'light' | 'dark';

export interface ChartPalette {
  surface: string;
  grid: string;
  axis: string;
  text: string;
  textSecondary: string;
  /** Paleta categórica validada (orden fijo, apto para daltonismo en pares adyacentes). */
  series: string[];
  /** Tono neutro para referencias (líneas de transición, escenario base). */
  neutral: string;
  marker: string;
}

const PALETTES: Record<ThemeName, ChartPalette> = {
  light: {
    surface: '#fcfcfb',
    grid: '#e6e5e1',
    axis: '#8a8984',
    text: '#16181d',
    textSecondary: '#52514e',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    neutral: '#7c7b76',
    marker: '#a87414',
  },
  dark: {
    surface: '#1a1a19',
    grid: '#2f2f2c',
    axis: '#7d7c76',
    text: '#f0efec',
    textSecondary: '#c3c2b7',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    neutral: '#9c9b93',
    marker: '#e0b45c',
  },
};

interface ThemeState {
  theme: ThemeName;
  toggleTheme: () => void;
  presentation: boolean;
  togglePresentation: () => void;
  palette: ChartPalette;
  /** Tamaño de letra de ejes y etiquetas de gráficos, en píxeles. */
  chartFont: number;
}

const ThemeContext = createContext<ThemeState | null>(null);

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

function initialTheme(): ThemeName {
  const saved = readStored('mf-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme);
  const [presentation, setPresentation] = useState<boolean>(() => readStored('mf-present') === 'true');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store('mf-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.present = String(presentation);
    store('mf-present', String(presentation));
  }, [presentation]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const togglePresentation = useCallback(() => setPresentation((p) => !p), []);

  const value = useMemo<ThemeState>(
    () => ({ theme, toggleTheme, presentation, togglePresentation, palette: PALETTES[theme], chartFont: presentation ? 16 : 13 }),
    [theme, toggleTheme, presentation, togglePresentation],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
