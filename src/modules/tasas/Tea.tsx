import { useMemo, useState } from 'react';
import { frequencyByPerYear, nominalFromTea, periodicFromNominal, teaFromNominal, toNum } from '../../engine';
import { continuousLimit, conventionComparison, teaByFrequency, teaCurve } from '../../simulation/rates';
import { SeriesChart } from '../../charts/SeriesChart';
import { LabeledSegmented, ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtNum, fmtPct, texNum, texPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { FREQ_OPTIONS } from '../../ui/rateInput';
import { ConvencionesTea, ExplicacionTea, FormulaTea } from '../../content/tasas';
import type { PageProps } from '../registry';

const DEFAULTS = { mode: 'directo' as string, tna: 0.36, tea: 0.42576, m: 12 };

export default function Tea({ query }: PageProps) {
  const { state, set, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'frecuencias' | 'convergencia' | 'comparacion'>('frecuencias');
  const freq = frequencyByPerYear(state.m);
  const direct = state.mode === 'directo';
  const tna = direct ? state.tna : toNum(nominalFromTea(state.tea, state.m));
  const tea = direct ? toNum(teaFromNominal(state.tna, state.m)) : state.tea;
  const j = toNum(periodicFromNominal(tna, state.m));
  const freqRows = useMemo(() => teaByFrequency(tna), [tna]);
  const curve = useMemo(() => teaCurve(tna), [tna]);
  const limit = continuousLimit(tna);
  const conventions = useMemo(() => conventionComparison(tna), [tna]);
  const A = palette.series[0];
  const B = palette.series[1];
  const Cc = palette.series[2];

  const barData = freqRows.map((r) => ({
    x: r.label.replace(/ \(\d+\)/, ''),
    tea: r.m === state.m ? 0 : r.tea,
    sel: r.m === state.m ? r.tea : 0,
    value: r.tea,
    m: r.m,
    periodic: r.periodic,
    gap: r.gap,
  }));
  const compareData = [
    { x: 'TNA', valor: tna },
    { x: `Tasa ${freq.adjective}`, valor: j },
    { x: 'TEA', valor: tea },
  ];

  const steps: Step[] = direct
    ? [
        { title: 'Datos', math: `\\text{TNA} = ${texPct(state.tna)} \\qquad m = ${state.m} \\text{ (capitalización ${freq.adjective})}` },
        { title: 'Tasa efectiva del subperíodo', math: `j = \\frac{\\text{TNA}}{m} = \\frac{${texNum(state.tna, 6, 2)}}{${state.m}} = ${texNum(j, 8, 2)}` },
        { title: 'Capitalización durante un año', math: `(1 + j)^m = (1 + ${texNum(j, 8, 2)})^{${state.m}} = ${texNum(1 + tea, 8, 4)}` },
        { title: 'TEA', math: `\\text{TEA} = ${texNum(1 + tea, 8, 4)} - 1 = ${texPct(tea)}` },
        {
          title: 'Comparación con el límite continuo',
          math: `e^{\\text{TNA}} - 1 = e^{${texNum(state.tna, 6, 2)}} - 1 = ${texPct(limit)}`,
          body: <>Ninguna frecuencia de capitalización puede superar este valor con la misma TNA.</>,
        },
      ]
    : [
        { title: 'Datos', math: `\\text{TEA} = ${texPct(state.tea)} \\qquad m = ${state.m}` },
        {
          title: 'Tasa efectiva del subperíodo equivalente',
          math: `j = (1 + \\text{TEA})^{1/m} - 1 = (1 + ${texNum(state.tea, 6, 2)})^{1/${state.m}} - 1 = ${texNum(j, 8, 2)}`,
        },
        { title: 'TNA con esa capitalización', math: `\\text{TNA} = m \\cdot j = ${state.m} \\times ${texNum(j, 8, 2)} = ${texPct(tna)}` },
        {
          title: 'Verificación',
          math: `\\left(1 + \\frac{${texNum(tna, 8, 2)}}{${state.m}}\\right)^{${state.m}} - 1 = ${texPct(toNum(teaFromNominal(tna, state.m)))}`,
        },
      ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <LabeledSegmented
            label="Sentido del cálculo"
            value={state.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'directo', label: 'TNA → TEA' },
              { value: 'inverso', label: 'TEA → TNA' },
            ]}
          />
          {direct ? (
            <ParamControl label="TNA" kind="percent" value={state.tna} min={0} max={1.5} step={0.005} onChange={(v) => set('tna', v)} testId="param-tna" />
          ) : (
            <ParamControl label="TEA" kind="percent" value={state.tea} min={0} max={3} step={0.005} onChange={(v) => set('tea', v)} testId="param-tea" />
          )}
          <SelectField
            label="Frecuencia de capitalización (m)"
            value={state.m}
            options={FREQ_OPTIONS}
            onChange={(v) => set('m', v)}
            help="Subperíodos iguales por año."
          />
        </>
      }
      chartTitle={
        view === 'frecuencias'
          ? `TEA según la frecuencia de capitalización (TNA ${fmtPct(tna)})`
          : view === 'convergencia'
            ? 'Convergencia hacia la capitalización continua'
            : 'TNA, tasa periódica y TEA'
      }
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'frecuencias', label: 'Por frecuencia' },
            { value: 'convergencia', label: 'Convergencia' },
            { value: 'comparacion', label: 'Comparación' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label="TNA" value={fmtPct(tna, 4)} />
          <Kpi label={`Tasa ${freq.adjective} (j)`} value={fmtPct(j, 4)} />
          <Kpi label="TEA" value={fmtPct(tea, 4)} big testId="kpi-tea" />
          <Kpi label="TEA − TNA" value={`${fmtNum((tea - tna) * 100, 2)} p.p.`} />
          <Kpi label="Límite continuo" value={fmtPct(limit, 4)} />
        </>
      }
      chart={
        view === 'frecuencias' ? (
          <SeriesChart
            ariaLabel="TEA por frecuencia de capitalización"
            data={barData}
            xKey="x"
            xLabel="Frecuencia de capitalización"
            xTickAngle={-30}
            yLabel="Tasa anual (%)"
            yFormat={(v) => fmtPct(v, 0)}
            yDomain={[0, Math.max(limit, tna) * 1.08]}
            refLines={[
              { y: tna, label: `TNA ${fmtPct(tna, 2)}`, color: palette.neutral },
              { y: limit, label: `Límite continuo ${fmtPct(limit, 2)}`, color: Cc },
            ]}
            series={[
              { key: 'tea', label: 'TEA', color: A, kind: 'bar', stack: 'a' },
              { key: 'sel', label: 'Frecuencia seleccionada', color: B, kind: 'bar', stack: 'a', top: true },
            ]}
            tooltip={(r) => ({
              title: `Capitalización ${r.x.toLowerCase()} (m = ${r.m})`,
              rows: [
                { label: 'Tasa del subperíodo', value: fmtPct(r.periodic, 4) },
                { label: 'TEA', value: fmtPct(r.value, 4), strong: true },
                { label: 'TEA − TNA', value: `${fmtNum(r.gap * 100, 3)} p.p.` },
              ],
            })}
          />
        ) : view === 'convergencia' ? (
          <SeriesChart
            ariaLabel="TEA en función de la cantidad de capitalizaciones"
            data={curve}
            xKey="m"
            xLabel="Capitalizaciones por año (m)"
            yLabel="TEA (%)"
            xTicks={[1, 12, 24, 52, 104, 182, 365]}
            yFormat={(v) => fmtPct(v, 1)}
            yDomain={[tna * 0.98, limit * 1.02]}
            refLines={[{ y: limit, label: `e^TNA − 1 = ${fmtPct(limit, 3)}`, color: Cc }]}
            points={[{ x: state.m, y: tea, color: B, label: `m = ${state.m}` }]}
            series={[{ key: 'tea', label: 'TEA', color: A }]}
            tooltip={(r) => ({ title: `m = ${r.m}`, rows: [{ label: 'TEA', value: fmtPct(r.tea, 4), color: A, line: true }] })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Comparación entre TNA, tasa periódica y TEA"
            data={compareData}
            xKey="x"
            xLabel="Tasa"
            yLabel="Valor (%)"
            yFormat={(v) => fmtPct(v, 0)}
            series={[{ key: 'valor', label: 'Tasa', color: A, kind: 'bar' }]}
            tooltip={(r) => ({ title: r.x, rows: [{ label: 'Valor', value: fmtPct(r.valor, 4), strong: true }] })}
          />
        )
      }
      chartFooter={
        view === 'frecuencias' ? (
          <Legend
            items={[
              { label: 'TEA', color: A },
              { label: 'Frecuencia seleccionada', color: B },
              { label: 'TNA', color: palette.neutral, line: true, dashed: true },
              { label: 'Límite continuo', color: Cc, line: true, dashed: true },
            ]}
          />
        ) : view === 'convergencia' ? (
          <Legend
            items={[
              { label: 'TEA(m)', color: A, line: true },
              { label: 'Frecuencia seleccionada', color: B },
              { label: 'Límite continuo', color: Cc, line: true, dashed: true },
            ]}
          />
        ) : undefined
      }
      panels={[
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionTea /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaTea /> },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        { id: 'convenciones', label: 'Convenciones', content: <ConvencionesTea tna={tna} rows={conventions} /> },
        {
          id: 'tabla',
          label: 'Tabla',
          content: (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="left">Capitalización</th>
                    <th>m</th>
                    <th>Tasa del subperíodo</th>
                    <th>TEA</th>
                  </tr>
                </thead>
                <tbody>
                  {freqRows.map((r) => (
                    <tr key={r.id} className={r.m === state.m ? 'selected' : undefined}>
                      <td className="left">{r.label.replace(/ \(\d+\)/, '')}</td>
                      <td>{r.m}</td>
                      <td>{fmtPct(r.periodic, 6)}</td>
                      <td>{fmtPct(r.tea, 6)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="left">Continua (límite)</td>
                    <td>∞</td>
                    <td>—</td>
                    <td>{fmtPct(limit, 6)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
    />
  );
}
