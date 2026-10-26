/**
 * Línea de tiempo financiera: flechas hacia arriba (ingresos) y hacia abajo
 * (egresos) proporcionales a cada importe, con su valor descontado opcional y
 * una fecha focal donde se concentra el valor equivalente.
 */
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../ui/theme';
import { fmtMoneyCompact, fmtNum } from '../ui/format';

export interface TimelineFlow {
  t: number;
  amount: number;
  label?: string;
}

export interface TimelineProps {
  flows: TimelineFlow[];
  /** Horizonte mínimo del eje. */
  horizon?: number;
  unitLabel: string;
  /** Fecha focal (para valores equivalentes) y su valor. */
  focal?: { t: number; value: number; label: string };
  /** Arco que une dos momentos (p. ej. VF → VA). */
  arc?: { from: number; to: number; label: string };
  selected?: number | null;
  onSelect?: (index: number) => void;
  ariaLabel: string;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 640, height: 320 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Timeline({ flows, horizon = 0, unitLabel, focal, arc, selected, onSelect, ariaLabel }: TimelineProps) {
  const { palette, chartFont } = useTheme();
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const padL = 64;
  const padR = 56;
  const maxT = Math.max(horizon, focal?.t ?? 0, ...flows.map((f) => f.t), 1);
  const minT = Math.min(0, ...flows.map((f) => f.t));
  const x = (t: number) => padL + ((t - minT) / (maxT - minT || 1)) * (width - padL - padR);
  const bottom = chartFont * 2 + 16; // marcas y título del eje
  const axisY = (height - bottom) / 2 + 4;
  const maxAbs = Math.max(1, ...flows.map((f) => Math.abs(f.amount)), Math.abs(focal?.value ?? 0));
  const room = Math.max(20, axisY - chartFont * 2.6);
  const len = (a: number) => Math.max(6, (Math.abs(a) / maxAbs) * room);
  const POS = palette.series[0];
  const NEG = palette.series[1];
  const span = maxT - minT;
  const step = [1, 2, 3, 4, 6, 12, 24, 60].find((s) => span / s <= 18) ?? Math.ceil(span / 18);
  const ticks: number[] = [];
  for (let t = Math.ceil(minT / step) * step; t <= maxT + 1e-9; t += step) ticks.push(t);

  const arrow = (
    key: string,
    t: number,
    amount: number,
    color: string,
    opts: { offset?: number; label?: string; dashed?: boolean; strong?: boolean; index?: number } = {},
  ) => {
    const cx = x(t) + (opts.offset ?? 0);
    const up = amount >= 0;
    const L = len(amount);
    const y2 = up ? axisY - L : axisY + L;
    const head = 7;
    const sel = opts.index !== undefined && opts.index === selected;
    return (
      <g
        key={key}
        onClick={opts.index !== undefined && onSelect ? () => onSelect(opts.index!) : undefined}
        style={{ cursor: opts.index !== undefined && onSelect ? 'pointer' : undefined }}
      >
        <rect x={cx - 12} y={Math.min(axisY, y2) - 4} width={24} height={L + 8} fill="transparent" />
        <line
          x1={cx}
          y1={axisY}
          x2={cx}
          y2={y2}
          stroke={color}
          strokeWidth={sel ? 4 : 3}
          strokeDasharray={opts.dashed ? '5 4' : undefined}
          strokeLinecap="round"
        />
        <path
          d={up ? `M${cx - head},${y2 + head} L${cx},${y2} L${cx + head},${y2 + head}` : `M${cx - head},${y2 - head} L${cx},${y2} L${cx + head},${y2 - head}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x={cx}
          y={up ? y2 - 8 : y2 + chartFont + 6}
          textAnchor={cx < 90 ? 'start' : cx > width - 90 ? 'end' : 'middle'}
          fontSize={chartFont}
          fontWeight={opts.strong || sel ? 700 : 600}
          fill={palette.text}
        >
          {opts.label ?? fmtMoneyCompact(amount)}
        </text>
      </g>
    );
  };

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }} role="img" aria-label={ariaLabel}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {arc && (
          <path
            d={`M${x(arc.from)},${axisY - 6} Q${(x(arc.from) + x(arc.to)) / 2},${axisY - room * 1.05} ${x(arc.to)},${axisY - 6}`}
            fill="none"
            stroke={palette.neutral}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}
        {arc && (
          <text x={(x(arc.from) + x(arc.to)) / 2} y={axisY - room * 0.55} textAnchor="middle" fontSize={chartFont} fill={palette.textSecondary}>
            {arc.label}
          </text>
        )}
        <line x1={padL - 16} y1={axisY} x2={width - padR + 20} y2={axisY} stroke={palette.axis} strokeWidth={1.5} />
        <path
          d={`M${width - padR + 14},${axisY - 5} L${width - padR + 22},${axisY} L${width - padR + 14},${axisY + 5}`}
          fill="none"
          stroke={palette.axis}
          strokeWidth={1.5}
        />
        {ticks.map((t) => (
          <g key={`tick-${t}`}>
            <line x1={x(t)} y1={axisY - 5} x2={x(t)} y2={axisY + 5} stroke={palette.axis} />
            <text x={x(t)} y={height - chartFont - 10} textAnchor="middle" fontSize={chartFont - 1} fill={palette.textSecondary}>
              {fmtNum(t, 2)}
            </text>
          </g>
        ))}
        <text x={(padL + width - padR) / 2} y={height - 4} textAnchor="middle" fontSize={chartFont} fill={palette.text} fontWeight={600}>
          Tiempo ({unitLabel})
        </text>
        {flows.map((f, k) => arrow(`f-${k}`, f.t, f.amount, f.amount >= 0 ? POS : NEG, { index: k, label: f.label }))}
        {focal &&
          arrow('focal', focal.t, focal.value, palette.marker, { label: focal.label, strong: true, offset: flows.some((f) => f.t === focal.t) ? -14 : 0 })}
      </svg>
    </div>
  );
}
