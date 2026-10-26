/**
 * Configuración común de gráficos: ejes rotulados con variable y unidad,
 * cuadrícula discreta, tooltip uniforme y utilidades de selección de períodos.
 *
 * Los componentes gráficos NO calculan nada financiero: reciben series ya
 * producidas por el motor (src/engine) o por la capa de simulación.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { useTheme } from '../ui/theme';
import { fmtMoneyCompact } from '../ui/format';

export function useChartStyle() {
  const { palette, chartFont } = useTheme();
  const tick = { fill: palette.textSecondary, fontSize: chartFont };
  return {
    palette,
    font: chartFont,
    grid: { stroke: palette.grid, strokeDasharray: undefined as string | undefined, vertical: false },
    axis: { stroke: palette.axis, tick, tickLine: { stroke: palette.axis } },
    margin: { top: 12, right: 24, bottom: chartFont + 22, left: chartFont + 26 },
    xLabel: (value: string) => ({
      value,
      position: 'insideBottom' as const,
      offset: -(chartFont + 4),
      fill: palette.text,
      fontSize: chartFont,
      fontWeight: 600,
    }),
    yLabel: (value: string) => ({
      value,
      angle: -90,
      position: 'insideLeft' as const,
      offset: -(chartFont + 14),
      fill: palette.text,
      fontSize: chartFont,
      fontWeight: 600,
      style: { textAnchor: 'middle' as const },
    }),
    moneyTick: (v: number) => fmtMoneyCompact(v),
    yWidth: chartFont * 5.6,
  };
}

/** Contenedor que ocupa todo el área disponible del gráfico. */
export function ChartBox({ children }: { children: ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 640, height: 320 }}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  );
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  line?: boolean;
  strong?: boolean;
}

export function TooltipCard({ title, rows, note }: { title: ReactNode; rows: TooltipRow[]; note?: ReactNode }) {
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="chart-tooltip-row" key={r.label}>
          <span className={`swatch${r.line ? ' line' : ''}`} style={{ background: r.color ?? 'transparent' }} />
          <span style={r.strong ? { fontWeight: 650 } : undefined}>{r.label}</span>
          <span className="v">{r.value}</span>
        </div>
      ))}
      {note && <div className="chart-tooltip-note">{note}</div>}
    </div>
  );
}

/**
 * Crea un renderizador de tooltip a partir del dato activo (fila del arreglo de datos).
 * Recharts entrega en `payload[0].payload` la fila completa.
 */
export function tooltipFor<T>(render: (row: T) => { title: ReactNode; rows: TooltipRow[]; note?: ReactNode } | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function TooltipContent(props: any) {
    if (!props?.active || !props.payload?.length) return null;
    const row = props.payload[0]?.payload as T | undefined;
    if (!row) return null;
    const content = render(row);
    return content ? <TooltipCard {...content} /> : null;
  };
}

/** Extrae el valor numérico del eje X activo en un clic sobre el gráfico. */
export function clickedX(state: { activeLabel?: string | number } | null | undefined): number | null {
  if (!state || state.activeLabel === undefined) return null;
  const v = Number(state.activeLabel);
  return Number.isFinite(v) ? v : null;
}

/** Redondea hacia arriba a un valor "limpio" (1, 2, 2,5, 5 × 10ᵏ). */
export function niceCeil(x: number): number {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * p >= x * (1 - 1e-12)) return f * p;
  return 10 * p;
}

/**
 * Escala fija del eje vertical: mientras está activa, el máximo sólo crece. Así,
 * al mover una barra, la pendiente o la altura cambian visiblemente en lugar de
 * quedar disimuladas por un reescalado automático.
 */
export function useLockedMax(max: number, locked: boolean): [number, () => void] {
  const [fixed, setFixed] = useState(() => niceCeil(max));
  const target = niceCeil(max);
  useEffect(() => {
    if (locked && target > fixed) setFixed(target);
  }, [locked, target, fixed]);
  const reset = useCallback(() => setFixed(niceCeil(max)), [max]);
  return [locked ? Math.max(fixed, target) : target, reset];
}

/** Marcas "limpias" para un eje continuo que cubren [lo, hi] con unas 5 divisiones. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!(hi > lo)) {
    const pad = Math.abs(hi) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= raw * (1 - 1e-9)) ?? 10 * p;
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 1e-6; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** Ticks enteros razonables para un eje de períodos 0..n. */
export function periodTicks(n: number, from = 0, maxTicks = 13): number[] {
  const span = n - from;
  if (span <= 0) return [from];
  const raw = span / (maxTicks - 1);
  const steps = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 24, 25, 30, 36, 50, 60, 100, 120, 200, 240, 500];
  const step = steps.find((s) => s >= raw) ?? Math.ceil(raw);
  const ticks: number[] = [];
  for (let t = from; t <= n; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== n && n - ticks[ticks.length - 1] >= step / 2) ticks.push(n);
  return ticks;
}
