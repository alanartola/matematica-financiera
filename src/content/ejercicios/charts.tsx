/**
 * Visualizaciones reutilizables de los ejercicios. Reciben resultados ya
 * calculados por el motor; no realizan cálculos financieros propios.
 */
import { SeriesChart } from '../../charts/SeriesChart';
import { Timeline, type TimelineFlow } from '../../charts/Timeline';
import { periodTicks } from '../../charts/common';
import { chartRows } from '../../simulation/loans';
import { simpleVsCompound } from '../../simulation/rates';
import { npvProfile, type Flow, type ScheduleResult } from '../../engine';
import { useTheme } from '../../ui/theme';
import { fmtMoney, fmtPct } from '../../ui/format';
import { Legend } from '../../ui/layout';

export function RegimesChart({
  c0,
  i,
  n,
  showSimple = true,
  showCompound = true,
}: {
  c0: number;
  i: number;
  n: number;
  showSimple?: boolean;
  showCompound?: boolean;
}) {
  const { palette } = useTheme();
  const rows = simpleVsCompound(c0, i, n);
  return (
    <ChartWithLegend
      legend={[
        ...(showSimple ? [{ label: 'Interés simple', color: palette.series[0], line: true }] : []),
        ...(showCompound ? [{ label: 'Interés compuesto', color: palette.series[1], line: true }] : []),
      ]}
    >
      <SeriesChart
        ariaLabel="Evolución del capital"
        data={rows}
        xKey="t"
        xLabel="Tiempo (períodos)"
        yLabel="Capital acumulado ($)"
        xTicks={periodTicks(n)}
        series={[
          { key: 'simple', label: 'Simple', color: palette.series[0], dots: true, hidden: !showSimple },
          { key: 'compound', label: 'Compuesto', color: palette.series[1], dots: true, hidden: !showCompound },
        ]}
        tooltip={(r) => ({
          title: `Período ${r.t}`,
          rows: [
            ...(showSimple ? [{ label: 'Simple', value: fmtMoney(r.simple), color: palette.series[0], line: true }] : []),
            ...(showCompound ? [{ label: 'Compuesto', value: fmtMoney(r.compound), color: palette.series[1], line: true }] : []),
          ],
        })}
      />
    </ChartWithLegend>
  );
}

export function FlowsTimeline({ flows, focal, unit }: { flows: TimelineFlow[]; focal?: { t: number; value: number; label: string }; unit: string }) {
  const { palette } = useTheme();
  return (
    <ChartWithLegend
      legend={[
        { label: 'Ingreso', color: palette.series[0] },
        { label: 'Egreso', color: palette.series[1] },
        ...(focal ? [{ label: 'Valor en la fecha focal', color: palette.marker }] : []),
      ]}
    >
      <Timeline ariaLabel="Línea de tiempo del ejercicio" flows={flows} focal={focal} unitLabel={unit} />
    </ChartWithLegend>
  );
}

export function ScheduleBars({ result, compare }: { result: ScheduleResult; compare?: ScheduleResult }) {
  const { palette } = useTheme();
  const rows = chartRows(result).slice(1);
  const other = compare ? chartRows(compare).slice(1) : [];
  const data = rows.map((r, k) => ({ ...r, otra: other[k]?.payment }));
  return (
    <ChartWithLegend
      legend={[
        { label: 'Amortización', color: palette.series[0] },
        { label: 'Interés', color: palette.series[1] },
        ...(compare ? [{ label: 'Cuota de referencia', color: palette.neutral, line: true, dashed: true }] : []),
      ]}
    >
      <SeriesChart
        ariaLabel="Composición de las cuotas"
        data={data}
        xKey="t"
        xLabel="Número de cuota"
        yLabel="Cuota ($)"
        series={[
          { key: 'amortization', label: 'Amortización', color: palette.series[0], kind: 'bar', stack: 'c' },
          { key: 'interest', label: 'Interés', color: palette.series[1], kind: 'bar', stack: 'c', top: true },
          ...(compare ? [{ key: 'otra', label: 'Referencia', color: palette.neutral, dashed: true }] : []),
        ]}
        tooltip={(r) => ({
          title: `Cuota ${r.t}`,
          rows: [
            { label: 'Amortización', value: fmtMoney(r.amortization), color: palette.series[0] },
            { label: 'Interés', value: fmtMoney(r.interest), color: palette.series[1] },
            { label: 'Cuota', value: fmtMoney(r.payment), strong: true },
          ],
        })}
      />
    </ChartWithLegend>
  );
}

export function NpvProfileChart({ flows, rate, roots }: { flows: Flow[]; rate: number; roots: number[] }) {
  const { palette } = useTheme();
  const top = Math.max(0.3, rate * 2, ...roots.map((r) => r * 1.6));
  const data = npvProfile(flows, 0, top, 121);
  return (
    <ChartWithLegend
      legend={[
        { label: 'VAN(r)', color: palette.series[0], line: true },
        { label: 'TIR', color: palette.series[1] },
      ]}
    >
      <SeriesChart
        ariaLabel="VAN en función de la tasa"
        data={data}
        xKey="rate"
        xLabel="Tasa de descuento (%)"
        yLabel="VAN ($)"
        xFormat={(v) => fmtPct(v, 0)}
        series={[{ key: 'npv', label: 'VAN', color: palette.series[0] }]}
        refLines={[
          { y: 0, color: palette.axis, dashed: false },
          { x: rate, color: palette.marker },
        ]}
        points={roots.map((r) => ({ x: r, y: 0, color: palette.series[1], label: `TIR ${fmtPct(r, 2)}` }))}
        tooltip={(r) => ({ title: `Tasa ${fmtPct(r.rate, 2)}`, rows: [{ label: 'VAN', value: fmtMoney(r.npv), strong: true }] })}
      />
    </ChartWithLegend>
  );
}

export function SimpleBars({ items, yLabel, percent }: { items: { label: string; value: number }[]; yLabel: string; percent?: boolean }) {
  const { palette } = useTheme();
  return (
    <SeriesChart
      ariaLabel={yLabel}
      data={items.map((x) => ({ x: x.label, v: x.value }))}
      xKey="x"
      xLabel=""
      yLabel={yLabel}
      yFormat={percent ? (v) => fmtPct(v, 0) : undefined}
      series={[{ key: 'v', label: yLabel, color: palette.series[0], kind: 'bar' }]}
      tooltip={(r) => ({ title: r.x, rows: [{ label: yLabel, value: percent ? fmtPct(r.v, 4) : fmtMoney(r.v), strong: true }] })}
    />
  );
}

function ChartWithLegend({ children, legend }: { children: React.ReactNode; legend: { label: string; color: string; line?: boolean; dashed?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <Legend items={legend} />
    </div>
  );
}
