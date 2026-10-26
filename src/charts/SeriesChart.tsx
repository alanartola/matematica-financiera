/**
 * Gráfico cartesiano genérico (líneas, áreas y barras apiladas) con eje X
 * numérico, marcador de período seleccionado, líneas de referencia, bandas de
 * tramos y tooltip con el detalle de la fila activa.
 */
import type { ReactNode } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartBox, clickedX, niceTicks, tooltipFor, useChartStyle, type TooltipRow } from './common';

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  /** 'range': área entre dos valores; el dato debe ser un par [inferior, superior]. */
  kind?: 'line' | 'area' | 'bar' | 'step' | 'range';
  stack?: string;
  dashed?: boolean;
  width?: number;
  dots?: boolean;
  /** Último segmento de una pila: lleva el redondeo superior. */
  top?: boolean;
  hidden?: boolean;
}

export interface RefLine {
  x?: number;
  y?: number;
  label?: string;
  color?: string;
  dashed?: boolean;
}

export interface Band {
  from: number;
  to: number;
  color: string;
  label?: string;
}

export interface SeriesChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  series: SeriesDef[];
  xLabel: string;
  yLabel: string;
  xTicks?: number[];
  xDomain?: [number | string, number | string];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  yDomain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax'];
  selectedX?: number | null;
  onSelectX?: (x: number) => void;
  refLines?: RefLine[];
  bands?: Band[];
  /** Puntos destacados (p. ej. TIR). */
  points?: { x: number; y: number; color: string; label?: string }[];
  tooltip?: (row: T) => { title: ReactNode; rows: TooltipRow[]; note?: ReactNode } | null;
  barCategoryGap?: string | number;
  /** Rotación de las etiquetas del eje X (ejes de categorías con nombres largos). */
  xTickAngle?: number;
  ariaLabel: string;
}

export function SeriesChart<T extends object>(props: SeriesChartProps<T>) {
  const st = useChartStyle();
  const { palette } = st;
  const {
    data,
    xKey,
    series,
    xLabel,
    yLabel,
    xTicks,
    xDomain,
    xFormat,
    yFormat = st.moneyTick,
    selectedX,
    onSelectX,
    refLines = [],
    bands = [],
    points = [],
    tooltip,
    barCategoryGap,
    xTickAngle,
    ariaLabel,
  } = props;
  const hasBars = series.some((s) => s.kind === 'bar' && !s.hidden);
  const rowsAny0 = data as unknown as Record<string, unknown>[];
  // Extensión de los datos visibles (las barras apiladas se suman por pila).
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of rowsAny0) {
    const stacks = new Map<string, number>();
    for (const s of series) {
      if (s.hidden) continue;
      const v = row[s.key];
      const vals = Array.isArray(v) ? (v as number[]) : typeof v === 'number' ? [v] : [];
      if (s.kind === 'bar' && s.stack && typeof v === 'number') {
        stacks.set(s.stack, (stacks.get(s.stack) ?? 0) + v);
        continue;
      }
      for (const x of vals) {
        if (!Number.isFinite(x)) continue;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    for (const total of stacks.values()) {
      lo = Math.min(lo, total);
      hi = Math.max(hi, total);
    }
  }
  for (const r of props.refLines ?? [])
    if (r.y !== undefined) {
      lo = Math.min(lo, r.y);
      hi = Math.max(hi, r.y);
    }
  for (const p of props.points ?? []) {
    lo = Math.min(lo, p.y);
    hi = Math.max(hi, p.y);
  }
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1];
  const wantLo = props.yDomain?.[0];
  const wantHi = props.yDomain?.[1];
  const yLo = typeof wantLo === 'number' ? Math.min(wantLo, lo) : hasBars || wantLo === undefined ? Math.min(0, lo) : lo;
  const yHi = typeof wantHi === 'number' ? Math.max(wantHi, hi) : hi;
  const yTicks = niceTicks(yLo, yHi);
  const rowsAny = data as unknown as Record<string, unknown>[];
  const selectedRow = selectedX === null || selectedX === undefined ? undefined : rowsAny.find((d) => d[xKey] === selectedX);

  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={ariaLabel}>
      <ChartBox>
        <ComposedChart
          data={rowsAny}
          margin={xTickAngle ? { ...st.margin, bottom: st.margin.bottom + st.font * 2 } : st.margin}
          barCategoryGap={barCategoryGap ?? (data.length > 60 ? 1 : '18%')}
          onClick={(s) => {
            const x = clickedX(s);
            if (x !== null && onSelectX) onSelectX(x);
          }}
          style={{ cursor: onSelectX ? 'pointer' : undefined }}
        >
          <CartesianGrid stroke={st.grid.stroke} vertical={false} />
          {bands.map((b, k) => (
            <ReferenceArea
              key={`band-${k}`}
              x1={hasBars ? b.from : b.from}
              x2={b.to}
              fill={b.color}
              fillOpacity={0.09}
              stroke="none"
              ifOverflow="extendDomain"
              label={b.label ? { value: b.label, position: 'insideTop', fill: palette.textSecondary, fontSize: st.font - 1 } : undefined}
            />
          ))}
          <XAxis
            dataKey={xKey as string}
            type={hasBars ? 'category' : 'number'}
            domain={hasBars ? undefined : (xDomain ?? ['dataMin', 'dataMax'])}
            ticks={hasBars ? undefined : xTicks}
            interval={hasBars ? (xTickAngle ? 0 : 'preserveStartEnd') : undefined}
            angle={xTickAngle}
            textAnchor={xTickAngle ? 'end' : 'middle'}
            height={xTickAngle ? st.font * 5 : undefined}
            tickFormatter={xFormat}
            allowDecimals={false}
            stroke={palette.axis}
            tick={st.axis.tick}
            tickLine={st.axis.tickLine}
            label={st.xLabel(xLabel)}
            minTickGap={8}
          />
          <YAxis
            stroke={palette.axis}
            tick={st.axis.tick}
            tickLine={st.axis.tickLine}
            tickFormatter={yFormat}
            domain={[yTicks[0], yTicks[yTicks.length - 1]]}
            ticks={yTicks}
            interval={0}
            width={st.yWidth}
            label={st.yLabel(yLabel)}
            allowDataOverflow={false}
          />
          {tooltip && (
            <Tooltip
              content={tooltipFor(tooltip)}
              cursor={hasBars ? { fill: palette.grid, fillOpacity: 0.5 } : { stroke: palette.axis, strokeWidth: 1 }}
              isAnimationActive={false}
            />
          )}
          {series
            .filter((s) => !s.hidden)
            .map((s) => {
              const common = { dataKey: s.key, name: s.label, isAnimationActive: false };
              if (s.kind === 'bar') {
                return (
                  <Bar
                    key={s.key}
                    {...common}
                    stackId={s.stack}
                    fill={s.color}
                    maxBarSize={24}
                    stroke={palette.surface}
                    strokeWidth={data.length > 80 ? 0 : 1}
                    radius={s.top || !s.stack ? [4, 4, 0, 0] : undefined}
                  />
                );
              }
              if (s.kind === 'range') {
                return <Area key={s.key} {...common} type="linear" stroke="none" fill={s.color} fillOpacity={0.22} activeDot={false} legendType="none" />;
              }
              if (s.kind === 'area') {
                return (
                  <Area
                    key={s.key}
                    {...common}
                    type="linear"
                    stackId={s.stack}
                    stroke={s.color}
                    strokeWidth={s.width ?? 2}
                    fill={s.color}
                    fillOpacity={0.12}
                    dot={false}
                  />
                );
              }
              return (
                <Line
                  key={s.key}
                  {...common}
                  type={s.kind === 'step' ? 'stepAfter' : 'linear'}
                  stroke={s.color}
                  strokeWidth={s.width ?? 2.5}
                  strokeDasharray={s.dashed ? '6 5' : undefined}
                  dot={s.dots && data.length <= 40 ? { r: 3.5, fill: s.color, stroke: palette.surface, strokeWidth: 2 } : false}
                  activeDot={{ r: 5, stroke: palette.surface, strokeWidth: 2 }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  connectNulls
                />
              );
            })}
          {refLines.map((r, k) => (
            <ReferenceLine
              key={`ref-${k}`}
              x={r.x}
              y={r.y}
              stroke={r.color ?? palette.neutral}
              strokeWidth={1.5}
              strokeDasharray={r.dashed === false ? undefined : '5 4'}
              ifOverflow="extendDomain"
              label={
                r.label
                  ? { value: r.label, position: r.x !== undefined ? 'insideTopRight' : 'insideTopLeft', fill: palette.textSecondary, fontSize: st.font - 1 }
                  : undefined
              }
            />
          ))}
          {selectedX !== null && selectedX !== undefined && <ReferenceLine x={selectedX} stroke={palette.marker} strokeWidth={2} ifOverflow="extendDomain" />}
          {selectedRow &&
            !hasBars &&
            series
              .filter((s) => !s.hidden && s.kind !== 'bar' && s.kind !== 'range' && typeof selectedRow[s.key] === 'number')
              .map((s) => (
                <ReferenceDot
                  key={`sel-${s.key}`}
                  x={selectedX!}
                  y={selectedRow[s.key] as number}
                  r={6}
                  fill={s.color}
                  stroke={palette.surface}
                  strokeWidth={2}
                />
              ))}
          {points.map((p, k) => (
            <ReferenceDot
              key={`pt-${k}`}
              x={p.x}
              y={p.y}
              r={7}
              fill={p.color}
              stroke={palette.surface}
              strokeWidth={2}
              label={p.label ? { value: p.label, position: 'top', fill: palette.text, fontSize: st.font, fontWeight: 650 } : undefined}
            />
          ))}
        </ComposedChart>
      </ChartBox>
    </div>
  );
}
