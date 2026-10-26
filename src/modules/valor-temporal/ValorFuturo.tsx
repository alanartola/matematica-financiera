import { useMemo, useState } from 'react';
import { FREQUENCIES, frequencyByPerYear, futureValue, periodicFromNominal, presentValue, teaFromNominal, toNum } from '../../engine';
import { SeriesChart } from '../../charts/SeriesChart';
import { Timeline } from '../../charts/Timeline';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { FREQ_OPTIONS } from '../../ui/rateInput';
import { ExplicacionVF, FormulaVF } from '../../content/valorTemporal';
import type { PageProps } from '../registry';

const DEFAULTS = { capital: 1_000_000, tna: 0.36, m: 12, years: 2 };

export default function ValorFuturo({ query }: PageProps) {
  const { state, set, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'capitalizacion' | 'linea' | 'frecuencia'>('capitalizacion');
  const freq = frequencyByPerYear(state.m);
  const j = toNum(periodicFromNominal(state.tna, state.m));
  const periods = state.m * state.years;
  const vf = toNum(futureValue(state.capital, j, periods));
  const back = toNum(presentValue(vf, j, periods));
  const A = palette.series[0];
  const B = palette.series[1];

  const curve = useMemo(() => {
    const points = 240;
    return Array.from({ length: points + 1 }, (_, k) => {
      const t = (state.years * k) / points;
      const done = Math.floor(t * state.m + 1e-9);
      return { x: t, escalon: toNum(futureValue(state.capital, j, done)), continuo: toNum(futureValue(state.capital, j, t * state.m)) };
    });
  }, [state.capital, state.years, state.m, j]);
  const byFreq = useMemo(
    () =>
      [...FREQUENCIES]
        .sort((a, b) => a.perYear - b.perYear)
        .map((f) => ({
          x: f.label.replace(/ \(\d+\)/, ''),
          vf: toNum(futureValue(state.capital, toNum(periodicFromNominal(state.tna, f.perYear)), f.perYear * state.years)),
          m: f.perYear,
        })),
    [state.capital, state.tna, state.years],
  );

  const steps: Step[] = [
    {
      title: 'Datos',
      math: `C = ${texMoney(state.capital)} \\qquad \\text{TNA} = ${texPct(state.tna)} \\qquad m = ${state.m} \\qquad t = ${texNum(state.years, 2, 0)} \\text{ años}`,
    },
    { title: 'Tasa del subperíodo', math: `j = ${texNum(state.tna, 6, 2)} / ${state.m} = ${texNum(j, 8, 2)}` },
    { title: 'Cantidad de capitalizaciones', math: `m \\cdot t = ${state.m} \\times ${texNum(state.years, 2, 0)} = ${texNum(periods, 2, 0)}` },
    { title: 'Capitalizar', math: `VF = ${texMoney(state.capital)} \\times (1 + ${texNum(j, 8, 2)})^{${texNum(periods, 2, 0)}} = ${texMoney(vf)}` },
    { title: 'Actualizar (operación inversa)', math: `VA = \\frac{${texMoney(vf)}}{(1 + ${texNum(j, 8, 2)})^{${texNum(periods, 2, 0)}}} = ${texMoney(back)}` },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <ParamControl label="Capital inicial" kind="money" value={state.capital} min={0} max={10_000_000} step={10_000} onChange={(v) => set('capital', v)} />
          <ParamControl label="TNA" kind="percent" value={state.tna} min={0} max={1.5} step={0.005} onChange={(v) => set('tna', v)} testId="param-tna" />
          <SelectField label="Frecuencia de capitalización" value={state.m} options={FREQ_OPTIONS} onChange={(v) => set('m', v)} />
          <ParamControl
            label="Plazo"
            kind="number"
            value={state.years}
            min={0.25}
            max={10}
            step={0.25}
            unit="años"
            decimals={2}
            onChange={(v) => set('years', v)}
          />
        </>
      }
      chartTitle={
        view === 'capitalizacion'
          ? 'Capitalización del capital'
          : view === 'linea'
            ? 'Capitalizar y actualizar'
            : `Valor futuro según la frecuencia (TNA ${fmtPct(state.tna)})`
      }
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'capitalizacion', label: 'Capitalización' },
            { value: 'linea', label: 'Línea de tiempo' },
            { value: 'frecuencia', label: 'Por frecuencia' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label="Valor futuro" value={fmtMoney(vf)} big testId="kpi-vf" />
          <Kpi label="Intereses" value={fmtMoney(vf - state.capital)} />
          <Kpi label={`Tasa ${freq.adjective}`} value={fmtPct(j, 4)} />
          <Kpi label="TEA" value={fmtPct(toNum(teaFromNominal(state.tna, state.m)), 4)} />
          <Kpi label="Capitalizaciones" value={fmtNum(periods, 2)} />
        </>
      }
      chart={
        view === 'capitalizacion' ? (
          <SeriesChart
            ariaLabel="Crecimiento escalonado del capital"
            data={curve}
            xKey="x"
            xLabel="Tiempo (años)"
            yLabel="Capital acumulado ($)"
            xFormat={(v) => fmtNum(v, 2)}
            yDomain={[state.capital * 0.95, 'auto']}
            series={[
              { key: 'continuo', label: 'Valor equivalente continuo', color: palette.neutral, dashed: true, width: 1.5 },
              { key: 'escalon', label: `Capital con capitalización ${freq.adjective}`, color: A, kind: 'step' },
            ]}
            tooltip={(r) => ({
              title: `${fmtNum(r.x, 2)} años`,
              rows: [
                { label: 'Capitalizado', value: fmtMoney(r.escalon), color: A, line: true },
                { label: 'Equivalente', value: fmtMoney(r.continuo), color: palette.neutral, line: true },
              ],
            })}
          />
        ) : view === 'linea' ? (
          <Timeline
            ariaLabel="Línea de tiempo: capital y valor futuro"
            flows={[{ t: 0, amount: state.capital, label: `C ${fmtMoney(state.capital, 0)}` }]}
            focal={{ t: state.years, value: vf, label: `VF ${fmtMoney(vf, 0)}` }}
            arc={{ from: 0, to: state.years, label: `× (1 + ${fmtPct(j, 2)})^${fmtNum(periods, 2)}  ·  ÷ para actualizar` }}
            unitLabel="años"
          />
        ) : (
          <SeriesChart
            ariaLabel="Valor futuro por frecuencia de capitalización"
            data={byFreq}
            xKey="x"
            xLabel="Frecuencia de capitalización"
            yLabel="Valor futuro ($)"
            xTickAngle={-30}
            yDomain={[state.capital, 'auto']}
            series={[{ key: 'vf', label: 'Valor futuro', color: B, kind: 'bar' }]}
            tooltip={(r) => ({ title: `${r.x} (m = ${r.m})`, rows: [{ label: 'Valor futuro', value: fmtMoney(r.vf), strong: true }] })}
          />
        )
      }
      chartFooter={
        view === 'capitalizacion' ? (
          <Legend
            items={[
              { label: `Capitalización ${freq.adjective}`, color: A, line: true },
              { label: 'Valor equivalente continuo', color: palette.neutral, line: true, dashed: true },
            ]}
          />
        ) : view === 'linea' ? (
          <Legend
            items={[
              { label: 'Capital', color: A },
              { label: 'Valor futuro', color: palette.marker },
            ]}
          />
        ) : undefined
      }
      panels={[
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionVF /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaVF /> },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
      ]}
    />
  );
}
