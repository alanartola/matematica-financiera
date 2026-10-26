import { useMemo, useState } from 'react';
import { fixedDeposit, renewalSchedule } from '../../engine';
import { formatDateAR } from '../../engine/daycount';
import { depositByDays } from '../../simulation/bank';
import { SeriesChart } from '../../charts/SeriesChart';
import { DateField, LabeledSegmented, ParamControl, Segmented, TextField } from '../../ui/controls';
import { Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { AvisoTasas, ExplicacionPlazoFijo, FormulaPlazoFijo } from '../../content/bancarias';
import type { PageProps } from '../registry';

const DEFAULTS = { entity: 'Entidad A (ejemplo hipotético)', capital: 1_000_000, tna: 0.3, days: 30, base: 365, start: '2026-10-26' };
const TYPICAL = [30, 60, 90, 180, 365];

export default function PlazoFijo({ query }: PageProps) {
  const { state, set, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'plazo' | 'capital' | 'renovaciones'>('plazo');
  const base = (state.base === 360 ? 360 : 365) as 365 | 360;
  const days = Math.max(1, Math.round(state.days));
  const input = { capital: state.capital, tna: state.tna, days, base, startDate: state.start };
  const r = fixedDeposit(input);
  const curve = useMemo(() => depositByDays(state.tna, base), [state.tna, base]);
  const renewals = useMemo(() => renewalSchedule({ capital: state.capital, tna: state.tna, days, base }, 365), [state.capital, state.tna, days, base]);
  const typical = TYPICAL.map((d) => {
    const x = fixedDeposit({ ...input, days: d });
    return { x: `${d} días`, capital: state.capital, interes: x.interest, tea: x.teaWithReinvestment };
  });
  const C = palette.series[0];
  const I = palette.series[1];
  const T = palette.series[2];

  const steps: Step[] = [
    { title: 'Datos', math: `C = ${texMoney(state.capital)} \\quad \\text{TNA} = ${texPct(state.tna)} \\quad d = ${days} \\quad \\text{base} = ${base}` },
    {
      title: 'Interés del plazo',
      math: `I = ${texMoney(state.capital)} \\times ${texNum(state.tna, 6, 2)} \\times \\frac{${days}}{${base}} = ${texMoney(r.interest)}`,
    },
    {
      title: 'Monto al vencimiento',
      math: `M = ${texMoney(state.capital)} + ${texMoney(r.interest)} = ${texMoney(r.finalAmount)}`,
      body: r.endDate ? <>Vencimiento: {formatDateAR(r.endDate)}.</> : undefined,
    },
    { title: `Rendimiento efectivo de ${days} días`, math: `i_{${days}} = ${texNum(state.tna, 6, 2)} \\times ${days}/${base} = ${texPct(r.periodRate, 6)}` },
    {
      title: 'TEA con reinversiones sucesivas',
      math: `\\text{TEA} = (1 + ${texNum(r.periodRate, 8, 4)})^{365/${days}} - 1 = ${texPct(r.teaWithReinvestment, 4)}`,
      body: <>Supone {fmtNum(r.renewalsPerYear, 2)} renovaciones por año con la misma tasa, reinvirtiendo capital e intereses.</>,
    },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <TextField label="Entidad (rótulo)" value={state.entity} onChange={(v) => set('entity', v)} list="entidades" />
          <datalist id="entidades">
            {['ICBC', 'Banco Galicia', 'BBVA', 'Banco Nación', 'Otra entidad'].map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <ParamControl
            label="Capital invertido"
            kind="money"
            value={state.capital}
            min={0}
            max={50_000_000}
            step={50_000}
            onChange={(v) => set('capital', v)}
          />
          <ParamControl
            label="TNA"
            kind="percent"
            value={state.tna}
            min={0}
            max={1.2}
            step={0.0025}
            onChange={(v) => set('tna', v)}
            testId="param-tna"
            help="Valor ingresado manualmente."
          />
          <ParamControl
            label="Plazo"
            kind="int"
            value={days}
            min={1}
            max={365}
            unit="días"
            hardMax={3650}
            onChange={(v) => set('days', v)}
            testId="param-dias"
          />
          <LabeledSegmented
            label="Base anual"
            value={base}
            onChange={(v) => set('base', v)}
            options={[
              { value: 365, label: '365 días' },
              { value: 360, label: '360 días' },
            ]}
          />
          <DateField label="Fecha de constitución" value={state.start} onChange={(v) => set('start', v)} />
          <AvisoTasas />
        </>
      }
      chartTitle={
        view === 'plazo'
          ? 'Rendimiento del plazo frente a TEA, según los días'
          : view === 'capital'
            ? 'Capital e intereses por plazo'
            : 'Renovaciones sucesivas durante un año'
      }
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'plazo', label: 'Según el plazo' },
            { value: 'capital', label: 'Capital e intereses' },
            { value: 'renovaciones', label: 'Renovaciones' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label={`${state.entity}: intereses`} value={fmtMoney(r.interest)} color={I} testId="kpi-interes" />
          <Kpi label="Monto al vencimiento" value={fmtMoney(r.finalAmount)} big />
          <Kpi label={`Rendimiento de ${days} días`} value={fmtPct(r.periodRate, 4)} />
          <Kpi label="TEA con reinversión" value={fmtPct(r.teaWithReinvestment, 3)} color={T} testId="kpi-tea" />
          {r.endDate && <Kpi label="Vencimiento" value={formatDateAR(r.endDate)} />}
        </>
      }
      chart={
        view === 'plazo' ? (
          <SeriesChart
            ariaLabel="Rendimiento del plazo y TEA en función de los días"
            data={curve}
            xKey="days"
            xLabel="Plazo (días)"
            yLabel="Tasa (%)"
            xTicks={[30, 60, 90, 120, 180, 270, 365]}
            yFormat={(v) => fmtPct(v, 0)}
            onSelectX={(x) => set('days', x)}
            refLines={[
              { y: state.tna, label: `TNA ${fmtPct(state.tna, 2)}`, color: palette.neutral },
              { x: days, color: palette.marker },
            ]}
            series={[
              { key: 'periodRate', label: 'Rendimiento del plazo', color: I },
              { key: 'tea', label: 'TEA con reinversión', color: T },
            ]}
            tooltip={(c) => ({
              title: `${c.days} días`,
              rows: [
                { label: 'Rendimiento del plazo', value: fmtPct(c.periodRate, 3), color: I, line: true },
                { label: 'TEA con reinversión', value: fmtPct(c.tea, 3), color: T, line: true },
              ],
            })}
          />
        ) : view === 'capital' ? (
          <SeriesChart
            ariaLabel="Capital e intereses para plazos habituales"
            data={typical}
            xKey="x"
            xLabel="Plazo"
            yLabel="Monto al vencimiento ($)"
            yDomain={[0, 'auto']}
            series={[
              { key: 'capital', label: 'Capital invertido', color: C, kind: 'bar', stack: 'm' },
              { key: 'interes', label: 'Intereses ganados', color: I, kind: 'bar', stack: 'm', top: true },
            ]}
            tooltip={(t) => ({
              title: t.x,
              rows: [
                { label: 'Capital', value: fmtMoney(t.capital), color: C },
                { label: 'Intereses', value: fmtMoney(t.interes), color: I },
                { label: 'TEA con reinversión', value: fmtPct(t.tea, 3) },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Capital al inicio e interés de cada renovación"
            data={renewals.map((x) => ({ ...x, label: `${x.k}` }))}
            xKey="label"
            xLabel={`Renovación (cada ${days} días)`}
            yLabel="Capital ($)"
            series={[
              { key: 'opening', label: 'Capital al inicio de la renovación', color: C, kind: 'bar', stack: 'r' },
              { key: 'interest', label: 'Interés de la renovación', color: I, kind: 'bar', stack: 'r', top: true },
            ]}
            tooltip={(x) => ({
              title: `Renovación ${x.k} (días ${x.startDay}–${x.endDay})`,
              rows: [
                { label: 'Capital inicial', value: fmtMoney(x.opening), color: C },
                { label: 'Interés', value: fmtMoney(x.interest), color: I },
                { label: 'Monto', value: fmtMoney(x.closing), strong: true },
              ],
            })}
          />
        )
      }
      chartFooter={
        <Legend
          items={
            view === 'plazo'
              ? [
                  { label: 'Rendimiento del plazo (no anual)', color: I, line: true },
                  { label: 'TEA con reinversión', color: T, line: true },
                  { label: 'TNA', color: palette.neutral, line: true, dashed: true },
                ]
              : [
                  { label: 'Capital', color: C },
                  { label: 'Intereses', color: I },
                ]
          }
        />
      }
      panels={[
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionPlazoFijo /> },
        { id: 'formula', label: 'Fórmulas', content: <FormulaPlazoFijo /> },
      ]}
    />
  );
}
