import { useMemo, useState } from 'react';
import { convertEffective, frequencyByPerYear, toNum } from '../../engine';
import { equivalentEffectiveRates, equivalentGrowthPaths } from '../../simulation/rates';
import { SeriesChart } from '../../charts/SeriesChart';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtMoney, fmtNum, fmtPct, fmtRate, texMoney, texNum, texPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { FREQ_OPTIONS } from '../../ui/rateInput';
import { ExplicacionTasaEfectiva, FormulaTasaEfectiva } from '../../content/tasas';
import type { PageProps } from '../registry';

const DEFAULTS = { rate: 0.03, perYear: 12, capital: 1_000_000, target: 4 };
const PATH_FREQS = [12, 4, 2, 1];

export default function TasaEfectiva({ query }: PageProps) {
  const { state, set, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'equivalentes' | 'crecimiento'>('equivalentes');
  const src = frequencyByPerYear(state.perYear);
  const target = frequencyByPerYear(state.target);
  const rows = useMemo(() => equivalentEffectiveRates(state.rate, state.perYear), [state.rate, state.perYear]);
  const tea = rows.find((r) => r.perYear === 1)!.rate;
  const targetRate = toNum(convertEffective(state.rate, state.perYear, state.target));
  const freqs = useMemo(() => [...new Set([...PATH_FREQS, state.perYear])].sort((a, b) => b - a), [state.perYear]);
  const paths = useMemo(() => equivalentGrowthPaths(state.capital, state.rate, state.perYear, freqs), [state.capital, state.rate, state.perYear, freqs]);

  const finalAmount = paths[paths.length - 1][`m${state.perYear}`];
  const barData = [...rows]
    .sort((a, b) => b.perYear - a.perYear)
    .map((r) => ({
      x: r.label.replace(/ \(\d+\)/, ''),
      equivalente: r.isSource ? 0 : r.rate,
      origen: r.isSource ? r.rate : 0,
      rate: r.rate,
      nominal: r.nominal,
      perYear: r.perYear,
    }));
  const colorFor = (k: number) => palette.series[k % palette.series.length];

  const steps: Step[] = [
    { title: 'Dato', math: `i_{${src.adjective}} = ${texPct(state.rate)} \\quad (m_a = ${state.perYear} \\text{ períodos por año})` },
    {
      title: 'Condición de equivalencia',
      body: <>Ambas tasas deben producir el mismo monto al cabo de un año.</>,
      math: `(1 + i_{${target.adjective}})^{${state.target}} = (1 + ${texNum(state.rate, 8, 2)})^{${state.perYear}}`,
    },
    {
      title: `Despeje de la tasa ${target.adjective}`,
      math: [
        `i_{${target.adjective}} = (1 + ${texNum(state.rate, 8, 2)})^{${state.perYear}/${state.target}} - 1`,
        `i_{${target.adjective}} = ${texPct(targetRate, 6)}`,
      ],
    },
    {
      title: 'Verificación con la TEA',
      math: [
        `(1 + ${texNum(state.rate, 8, 2)})^{${state.perYear}} - 1 = ${texPct(tea, 6)}`,
        `(1 + ${texNum(targetRate, 8, 2)})^{${state.target}} - 1 = ${texPct(toNum(convertEffective(targetRate, state.target, 1)), 6)}`,
      ],
    },
    {
      title: `Monto de ${fmtMoney(state.capital)} al cabo de un año`,
      math: `${texMoney(state.capital)} \\times (1 + ${texPct(tea, 6)}) = ${texMoney(finalAmount)}`,
    },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <ParamControl
            label={`Tasa efectiva ${src.adjective}`}
            kind="percent"
            value={state.rate}
            min={0}
            max={state.perYear >= 12 ? 0.2 : 1}
            step={0.0005}
            onChange={(v) => set('rate', v)}
            testId="param-tasa"
          />
          <SelectField label="Periodicidad de la tasa ingresada" value={state.perYear} options={FREQ_OPTIONS} onChange={(v) => set('perYear', v)} />
          <SelectField
            label="Calcular la tasa equivalente de período"
            value={state.target}
            options={FREQ_OPTIONS}
            onChange={(v) => set('target', v)}
            help="El desarrollo muestra la conversión paso a paso."
          />
          <ParamControl
            label="Capital de referencia"
            kind="money"
            value={state.capital}
            min={0}
            max={10_000_000}
            step={10_000}
            onChange={(v) => set('capital', v)}
          />
          <Callout kind="neutral">
            Todas las tasas de la tabla son equivalentes: representan la misma rentabilidad efectiva expresada con distintos períodos.
          </Callout>
        </>
      }
      chartTitle={view === 'equivalentes' ? 'Tasas efectivas equivalentes' : 'La misma rentabilidad con distintos períodos de capitalización'}
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'equivalentes', label: 'Equivalencias' },
            { value: 'crecimiento', label: 'Crecimiento en un año' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label={`Tasa ingresada (${src.adjective})`} value={fmtRate(state.rate)} color={palette.series[1]} />
          <Kpi label={`Equivalente ${target.adjective}`} value={fmtPct(targetRate, 4)} big testId="kpi-equivalente" />
          <Kpi label="TEA equivalente" value={fmtPct(tea, 4)} />
          <Kpi label="Monto al año" value={fmtMoney(finalAmount)} />
        </>
      }
      chart={
        view === 'equivalentes' ? (
          <SeriesChart
            ariaLabel="Tasas efectivas equivalentes por período"
            data={barData}
            xKey="x"
            xLabel="Período de la tasa efectiva"
            xTickAngle={-30}
            yLabel="Tasa efectiva del período (%)"
            yFormat={(v) => fmtPct(v, 0)}
            series={[
              { key: 'equivalente', label: 'Tasa equivalente', color: palette.series[0], kind: 'bar', stack: 'r', top: false },
              { key: 'origen', label: 'Tasa ingresada', color: palette.series[1], kind: 'bar', stack: 'r', top: true },
            ]}
            tooltip={(r) => ({
              title: `Tasa efectiva ${r.x.toLowerCase()}`,
              rows: [
                { label: 'Tasa efectiva', value: fmtPct(r.rate, 4), strong: true },
                { label: 'Períodos por año', value: fmtNum(r.perYear) },
                { label: 'Tasa nominal proporcional', value: fmtPct(r.nominal, 4) },
              ],
              note: 'Tasa nominal proporcional = tasa efectiva × períodos por año.',
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Crecimiento escalonado del capital con tasas equivalentes"
            data={paths}
            xKey="x"
            xLabel="Tiempo (meses)"
            yLabel="Capital acumulado ($)"
            xTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
            xFormat={(v) => fmtNum(v, 0)}
            yDomain={[state.capital * 0.98, 'auto']}
            series={freqs.map((m, k) => ({
              key: `m${m}`,
              label: `Capitalización ${frequencyByPerYear(m).adjective}`,
              color: colorFor(k),
              kind: 'step' as const,
              width: 2.5,
            }))}
            tooltip={(r) => ({
              title: `Mes ${fmtNum(r.x, 1)}`,
              rows: freqs.map((m, k) => ({ label: frequencyByPerYear(m).adjective, value: fmtMoney(r[`m${m}`]), color: colorFor(k), line: true })),
            })}
          />
        )
      }
      chartFooter={
        view === 'equivalentes' ? (
          <Legend
            items={[
              { label: 'Tasa ingresada', color: palette.series[1] },
              { label: 'Tasas equivalentes', color: palette.series[0] },
            ]}
          />
        ) : (
          <Legend items={freqs.map((m, k) => ({ label: `Capitalización ${frequencyByPerYear(m).adjective}`, color: colorFor(k), line: true }))} />
        )
      }
      panels={[
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionTasaEfectiva /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaTasaEfectiva /> },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        {
          id: 'tabla',
          label: 'Equivalencias',
          content: (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="left">Período</th>
                    <th>Períodos por año</th>
                    <th>Tasa efectiva</th>
                    <th>Nominal anual proporcional</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.isSource ? 'selected' : undefined}>
                      <td className="left">{r.label.replace(/ \(\d+\)/, '')}</td>
                      <td>{r.perYear}</td>
                      <td>{fmtPct(r.rate, 6)}</td>
                      <td>{fmtPct(r.nominal, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
    />
  );
}
