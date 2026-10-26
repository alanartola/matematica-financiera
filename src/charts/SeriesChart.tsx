/**
 * Gráfico cartesiano genérico (líneas, áreas y barras apiladas) con eje X
 * numérico, marcador de período seleccionado, líneas de referencia, bandas de
 * tramos y tooltip con el detalle de la fila activa.
 */
import type { ReactNode } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartBox, clickedX, tooltipFor, useChartStyle, type TooltipRow } from './common';

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  kind?: 'line' | 'area' | 'bar' | 'step';
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

export interface SeriesChartProps<T extends Record<string, unknown>> {
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
  ariaLabel: string;
}

export function SeriesChart<T extends Record<string, unknown>>(props: SeriesChartProps<T>) {
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
    yDomain,
    selectedX,
    onSelectX,
    refLines = [],
    bands = [],
    points = [],
    tooltip,
    barCategoryGap,
    ariaLabel,
  } = props;
  const hasBars = series.some((s) => s.kind === 'bar' && !s.hidden);
  const selectedRow = selectedX === null || selectedX === undefined ? undefined : data.find((d) => d[xKey] === selectedX);

  return (
    <div style={{ width: '100%', height: '100%' }} role="img" aria-label={ariaLabel}>
      <ChartBox>
        <ComposedChart
          data={data as Record<string, unknown>[]}
          margin={st.margin}
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
            interval={hasBars ? 'preserveStartEnd' : undefined}
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
            domain={yDomain ?? [0, 'auto']}
            width={st.yWidth}
            label={st.yLabel(yLabel)}
            allowDataOverflow={false}
          />
          {tooltip && <Tooltip content={tooltipFor(tooltip)} cursor={hasBars ? { fill: palette.grid, fillOpacity: 0.5 } : { stroke: palette.axis, strokeWidth: 1 }} isAnimationActive={false} />}
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
              if (s.kind === 'area') {
                return <Area key={s.key} {...common} type="linear" stackId={s.stack} stroke={s.color} strokeWidth={s.width ?? 2} fill={s.color} fillOpacity={0.12} dot={false} />;
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
              label={r.label ? { value: r.label, position: r.x !== undefined ? 'insideTopRight' : 'insideTopLeft', fill: palette.textSecondary, fontSize: st.font - 1 } : undefined}
            />
          ))}
          {selectedX !== null && selectedX !== undefined && (
            <ReferenceLine x={selectedX} stroke={palette.marker} strokeWidth={2} ifOverflow="extendDomain" />
          )}
          {selectedRow &&
            !hasBars &&
            series
              .filter((s) => !s.hidden && s.kind !== 'bar' && typeof selectedRow[s.key] === 'number')
              .map((s) => (
                <ReferenceDot key={`sel-${s.key}`} x={selectedX!} y={selectedRow[s.key] as number} r={6} fill={s.color} stroke={palette.surface} strokeWidth={2} />
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
