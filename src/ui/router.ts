/**
 * Enrutador mínimo basado en el fragmento de la URL (#/modulo/tema?parametros).
 * El uso de "hash" permite servir la aplicación como archivos estáticos desde
 * cualquier carpeta sin configuración de servidor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Route {
  moduleId: string | null;
  topicId: string | null;
  query: URLSearchParams;
  raw: string;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { moduleId: parts[0] ?? null, topicId: parts[1] ?? null, query: new URLSearchParams(qs), raw };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return useMemo(() => parse(hash), [hash]);
}

export function href(moduleId?: string, topicId?: string, params?: Record<string, string | number | boolean>): string {
  let h = '#/' + [moduleId, topicId].filter(Boolean).join('/');
  if (params && Object.keys(params).length) {
    h += '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  }
  return h;
}

export function navigate(to: string) {
  window.location.hash = to.replace(/^#/, '');
}

type Primitive = number | string | boolean;

/**
 * Estado de una página con valores predeterminados, restablecimiento y lectura
 * inicial desde la URL (permite "Abrir en simulador" con parámetros precargados).
 */
export function usePageState<T extends Record<string, Primitive>>(defaults: T, query?: URLSearchParams) {
  const defaultsRef = useRef(defaults);
  const [state, setState] = useState<T>(() => {
    if (!query) return defaults;
    const next: Record<string, Primitive> = { ...defaults };
    for (const [k, def] of Object.entries(defaults)) {
      const raw = query.get(k);
      if (raw === null) continue;
      if (typeof def === 'number') {
        const v = Number(raw);
        if (Number.isFinite(v)) next[k] = v;
      } else if (typeof def === 'boolean') next[k] = raw === 'true';
      else next[k] = raw;
    }
    return next as T;
  });
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setState((s) => ({ ...s, [key]: value })), []);
  const patch = useCallback((partial: Partial<T>) => setState((s) => ({ ...s, ...partial })), []);
  const reset = useCallback(() => setState(defaultsRef.current), []);
  return { state, set, patch, reset };
}
