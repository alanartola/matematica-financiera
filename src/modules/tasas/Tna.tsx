import { useMemo, useState } from 'react';
import { frequencyByPerYear, periodicFromNominal, teaFromNominal, toNum, FREQUENCIES } from '../../engine';
import { tnaTimeline } from '../../simulation/rates';
import { SeriesChart } from '../../charts/SeriesChart';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtMoney, fmtPct, texMoney, texNum, texPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { ExplicacionTna, FormulaTna } from '../../content/tasas';
import type { PageProps } from '../registry';

const DEFAULTS = { capital: 1_000_000, tna: 0.36, m: 12, k: 2 };
const OPTIONS = FREQUENCIES.filter((f) => f.perYear <= 52).map((f) => ({ value: f.perYear, label: f.label }));

export default function Tna({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'linea' | 'acumulado'>('linea');
  const freq = frequencyByPerYear(state.m);
  const k = Math.min(Math.max(state.k, 1), state.m);
  const j = toNum(periodicFromNominal(state.tna, state.m));
  const tea = toNum(teaFromNominal(state.tna, state.m));
  const rows = useMemo(() => tnaTimeline(state.capital, state.tna, state.m), [state.capital, state.tna, state.m]);
  const last = rows[rows.length - 1];
  const sel = rows[k - 1];
  const P = palette.series[0];
  const R = palette.series[1];

  const cumulative = [
    { k: 0, retirado: state.capital, reinvertido: state.capital },
    ...rows.map((r) => ({ k: r.k, retirado: state.capital + r.paidCumulative, reinvertido: r.reinvestedBalance })),
  ];

  const steps: Step[] = [
    { title: 'Datos', math: `C = ${texMoney(state.capital)} \\qquad \\text{TNA} = ${texPct(state.tna)} \\qquad m = ${state.m}` },
    {
      title: `Tasa ${freq.adjective} (proporcional)`,
      math: `j = \\frac{\\text{TNA}}{m} = \\frac{${texNum(state.tna, 6, 2)}}{${state.m}} = ${texNum(j, 8, 2)} = ${texPct(j)}`,
    },
    {
      title: 'Si los intereses se retiran',
      body: <>Cada {freq.period} se cobra el interés sobre el mismo capital.</>,
      math: [
        `C \\cdot j = ${texMoney(state.capital)} \\times ${texNum(j, 8, 2)} = ${texMoney(rows[0].paidInterest)}`,
        `\\text{En el año: } ${state.m} \\times ${texMoney(rows[0].paidInterest)} = ${texMoney(last.paidCumulative)} = C \\cdot \\text{TNA}`,
      ],
    },
    {
      title: `Si los intereses se reinvierten (${freq.period} ${k})`,
      body: (
        <>
          El interés del {freq.period} {k} se calcula sobre el capital acumulado al cierre del {freq.period} anterior.
        </>
      ),
      math: `${texMoney(k === 1 ? state.capital : rows[k - 2].reinvestedBalance)} \\times ${texNum(j, 8, 2)} = ${texMoney(sel.reinvestedInterest)}`,
    },
    {
      title: 'Monto con reinversión al cabo de un año',
      math: [`C(1+j)^m = ${texMoney(state.capital)} \\times (1 + ${texNum(j, 8, 2)})^{${state.m}} = ${texMoney(last.reinvestedBalance)}`],
    },
    {
      title: 'Rendimiento efectivo anual (TEA)',
      math: [
        `\\text{TEA} = (1 + ${texNum(j, 8, 2)})^{${state.m}} - 1 = ${texPct(tea)}`,
        `\\text{Diferencia anual} = ${texMoney(last.reinvestedBalance - state.capital)} - ${texMoney(last.paidCumulative)} = ${texMoney(last.reinvestedBalance - state.capital - last.paidCumulative)}`,
      ],
    },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <ParamControl label="Capital" kind="money" value={state.capital} min={0} max={10_000_000} step={10_000} onChange={(v) => set('capital', v)} />
          <ParamControl label="TNA" kind="percent" value={state.tna} min={0} max={1.5} step={0.005} onChange={(v) => set('tna', v)} testId="param-tna" />
          <SelectField
            label="Capitalización (subperíodos por año, m)"
            value={state.m}
            options={OPTIONS}
            onChange={(m) => patch({ m, k: Math.min(state.k, m) })}
          />
          <div className="group">
            <p className="group-title">Marcador</p>
            <ParamControl
              label={`Subperíodo seleccionado (${freq.period})`}
              kind="int"
              value={k}
              min={1}
              max={state.m}
              hardMin={1}
              hardMax={state.m}
              onChange={(v) => set('k', v)}
            />
          </div>
          <Callout kind="neutral">
            Tasa {freq.adjective}: <strong>{fmtPct(j, 4)}</strong> = {fmtPct(state.tna, 2)} / {state.m}
          </Callout>
        </>
      }
      chartTitle={view === 'linea' ? `Línea de tiempo: un año en ${state.m} subperíodos` : 'Capital acumulado en el año'}
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'linea', label: 'Interés de cada subperíodo' },
            { value: 'acumulado', label: 'Acumulado' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label={`Tasa ${freq.adjective} (j)`} value={fmtPct(j, 4)} />
          <Kpi label="Interés retirado en el año" value={fmtMoney(last.paidCumulative)} color={P} />
          <Kpi label="Interés con reinversión" value={fmtMoney(last.reinvestedBalance - state.capital)} color={R} />
          <Kpi label="TNA → TEA" value={`${fmtPct(state.tna)} → ${fmtPct(tea)}`} big testId="kpi-tea" />
        </>
      }
      chart={
        view === 'linea' ? (
          <SeriesChart
            ariaLabel="Interés de cada subperíodo: retirado frente a reinvertido"
            data={rows}
            xKey="k"
            xLabel={`Subperíodo (${freq.period})`}
            yLabel="Interés del subperíodo ($)"
            selectedX={k}
            onSelectX={(x) => set('k', x)}
            series={[
              { key: 'paidInterest', label: 'Interés pagado y retirado', color: P, kind: 'bar' },
              { key: 'reinvestedInterest', label: 'Interés reinvertido', color: R, kind: 'bar' },
            ]}
            tooltip={(r) => ({
              title: `${freq.period[0].toUpperCase()}${freq.period.slice(1)} ${r.k}`,
              rows: [
                { label: 'Retirado', value: fmtMoney(r.paidInterest), color: P },
                { label: 'Reinvertido', value: fmtMoney(r.reinvestedInterest), color: R },
                { label: 'Excedente por reinversión', value: fmtMoney(r.extra), strong: true },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Capital acumulado con y sin reinversión"
            data={cumulative}
            xKey="k"
            xLabel={`Tiempo (${freq.period === 'mes' ? 'meses' : freq.period + 's'})`}
            yLabel="Capital + intereses ($)"
            yDomain={[state.capital * 0.95, 'auto']}
            selectedX={k}
            onSelectX={(x) => x > 0 && set('k', x)}
            series={[
              { key: 'retirado', label: 'Capital + intereses retirados', color: P, dots: true },
              { key: 'reinvertido', label: 'Capital con reinversión', color: R, dots: true },
            ]}
            tooltip={(r) => ({
              title: `Subperíodo ${r.k}`,
              rows: [
                { label: 'Sin reinversión', value: fmtMoney(r.retirado), color: P, line: true },
                { label: 'Con reinversión', value: fmtMoney(r.reinvertido), color: R, line: true },
                { label: 'Diferencia', value: fmtMoney(r.reinvertido - r.retirado), strong: true },
              ],
            })}
          />
        )
      }
      chartFooter={
        <Legend
          items={[
            { label: view === 'linea' ? 'Interés pagado y retirado' : 'Capital + intereses retirados', color: P, line: view !== 'linea' },
            { label: view === 'linea' ? 'Interés reinvertido' : 'Capital con reinversión', color: R, line: view !== 'linea' },
          ]}
        />
      }
      panels={[
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionTna /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaTna /> },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        {
          id: 'tabla',
          label: 'Tabla',
          content: (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Subperíodo</th>
                    <th>Interés retirado</th>
                    <th>Retirado acumulado</th>
                    <th>Interés reinvertido</th>
                    <th>Capital con reinversión</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.k} className={`clickable${r.k === k ? ' selected' : ''}`} onClick={() => set('k', r.k)}>
                      <td>{r.k}</td>
                      <td>{fmtMoney(r.paidInterest)}</td>
                      <td>{fmtMoney(r.paidCumulative)}</td>
                      <td>{fmtMoney(r.reinvestedInterest)}</td>
                      <td>{fmtMoney(r.reinvestedBalance)}</td>
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
