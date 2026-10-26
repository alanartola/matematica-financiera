/**
 * Herramientas de clase para los gráficos:
 *  - Escala fija: evita que el reescalado automático oculte los cambios.
 *  - Curva de referencia: congela el estado actual para compararlo con el siguiente.
 */
import { useState } from 'react';

export function ScaleLock({ locked, onToggle, onReset }: { locked: boolean; onToggle: (v: boolean) => void; onReset: () => void }) {
  return (
    <div className="row" style={{ gap: '0.35rem' }}>
      <label className="check small" title="Con la escala fija, el eje vertical no se reajusta al mover las barras: los cambios de pendiente y altura se ven directamente.">
        <input type="checkbox" checked={locked} onChange={(e) => onToggle(e.target.checked)} />
        Escala fija
      </label>
      {locked && (
        <button type="button" className="btn small" onClick={onReset} title="Reajustar la escala a los valores actuales">
          Reajustar
        </button>
      )}
    </div>
  );
}

/** Guarda una copia del valor actual para dibujarla como referencia. */
export function useSnapshot<T>() {
  const [snapshot, setSnapshot] = useState<{ value: T; label: string } | null>(null);
  return {
    snapshot,
    take: (value: T, label: string) => setSnapshot({ value, label }),
    clear: () => setSnapshot(null),
  };
}

export function SnapshotButton({ active, onTake, onClear }: { active: boolean; onTake: () => void; onClear: () => void }) {
  return active ? (
    <button type="button" className="btn small" onClick={onClear} title="Quitar la curva de referencia">
      Quitar referencia
    </button>
  ) : (
    <button type="button" className="btn small" onClick={onTake} title="Congelar la curva actual como referencia para comparar después de modificar variables">
      Fijar referencia
    </button>
  );
}
