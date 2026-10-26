import { useMemo, useState } from 'react';
import { describeRate, type RateSpec } from '../../engine';
import { compareAlternatives } from '../../simulation/rates';
import { SeriesChart } from '../../charts/SeriesChart';
import { periodTicks } from '../../charts/common';
import { ParamControl, Segmented, TextField } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtMoney, fmtPct, texMoney, texNum, texPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { RateSpecInput } from '../../ui/rateInput';
import { ExplicacionComparador } from '../../content/tasas';
import type { PageProps } from '../registry';

const DEFAULTS = {
  aName: 'Alternativa A',
  aKind: 'TNA' as string,
  aValue: 0.3,
  aM: 12,
  bName: 'Alternativa B',
  bKind: 'TEA' as string,
  bValue: 0.34,
  bM: 12,
  capital: 1_000_000,
  months: 12,
};

function toSpec(kind: string, value: number, m: number): RateSpec {
  if (kind === 'TEA') return { kind: 'TEA', value };
  if (kind === 'TEP') return { kind: 'TEP', value, perYear: m };
  return { kind: 'TNA', value, m };
}

export default function ComparadorTasas({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'evolucion' | 'tasas'>('evolucion');
  const specA = toSpec(state.aKind, state.aValue, state.aM);
  const specB = toSpec(state.bKind, state.bValue, state.bM);
  const [a, b] = useMemo(
    () =>
      compareAlternatives(
        [
          { name: state.aName, spec: specA },
          { name: state.bName, spec: specB },
        ],
        state.capital,
        state.months,
      ),
    [state.aName, state.bName, state.aKind, state.aValue, state.aM, state.bKind, state.bValue, state.bM, state.capital, state.months],
  );
  const A = palette.series[0];
  const B = palette.series[1];
  const diff = a.finalAmount - b.finalAmount;
  const diffPct = b.finalAmount ? diff / b.finalAmount : 0;
  const better = Math.abs(diff) < 0.005 ? null : diff > 0 ? a.name : b.name;
  const data = a.path.map((v, t) => ({ t, a: v, b: b.path[t] }));

  const setSpec = (prefix: 'a' | 'b', spec: RateSpec) =>
    patch(
      prefix === 'a'
        ? { aKind: spec.kind, aValue: spec.value, aM: spec.kind === 'TNA' ? spec.m : spec.kind === 'TEP' ? spec.perYear : state.aM }
        : { bKind: spec.kind, bValue: spec.value, bM: spec.kind === 'TNA' ? spec.m : spec.kind === 'TEP' ? spec.perYear : state.bM },
    );

  const stepsFor = (x: typeof a): Step => ({
    title: `${x.name}: ${describeRate(x.spec)}`,
    math: [
      `i_{\\text{mensual}} = ${texPct(x.monthly, 6)} \\qquad \\text{TEA} = ${texPct(x.tea, 4)}`,
      `VF = ${texMoney(state.capital)} \\times (1 + ${texNum(x.monthly, 8, 2)})^{${state.months}} = ${texMoney(x.finalAmount)}`,
    ],
  });
  const steps: Step[] = [
    {
      title: 'Supuestos',
      body: (
        <>
          Mismo capital ({fmtMoney(state.capital)}), mismo horizonte ({state.months} meses), capitalización compuesta y reinversión de intereses.
        </>
      ),
    },
    stepsFor(a),
    stepsFor(b),
    {
      title: 'Diferencia',
      math: [
        `\\Delta = ${texMoney(a.finalAmount)} - ${texMoney(b.finalAmount)} = ${texMoney(diff)}`,
        `\\Delta\\% = \\frac{${texMoney(diff)}}{${texMoney(b.finalAmount)}} = ${texPct(diffPct, 4)}`,
      ],
    },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <ParamControl label="Capital común" kind="money" value={state.capital} min={0} max={10_000_000} step={10_000} onChange={(v) => set('capital', v)} />
          <ParamControl label="Horizonte común" kind="int" value={state.months} min={1} max={120} unit="meses" onChange={(v) => set('months', v)} />
          <div className="group">
            <p className="group-title">Alternativa A</p>
            <TextField label="Nombre" value={state.aName} onChange={(v) => set('aName', v)} />
            <RateSpecInput label="Tasa A" value={specA} onChange={(s) => setSpec('a', s)} testId="tasa-a" />
          </div>
          <div className="group">
            <p className="group-title">Alternativa B</p>
            <TextField label="Nombre" value={state.bName} onChange={(v) => set('bName', v)} />
            <RateSpecInput label="Tasa B" value={specB} onChange={(s) => setSpec('b', s)} testId="tasa-b" />
          </div>
        </>
      }
      chartTitle={view === 'evolucion' ? 'Evolución del capital con cada alternativa' : 'Tasas expresadas en unidades comparables'}
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'evolucion', label: 'Evolución' },
            { value: 'tasas', label: 'Tasas comparables' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label={`${a.name}: TEA`} value={fmtPct(a.tea, 3)} color={A} />
          <Kpi label={`${b.name}: TEA`} value={fmtPct(b.tea, 3)} color={B} />
          <Kpi label={`Monto A a ${state.months} meses`} value={fmtMoney(a.finalAmount)} />
          <Kpi label={`Monto B a ${state.months} meses`} value={fmtMoney(b.finalAmount)} />
          <Kpi label="Diferencia A − B" value={`${fmtMoney(diff)} (${fmtPct(diffPct, 2)})`} big testId="kpi-diferencia" />
        </>
      }
      chart={
        view === 'evolucion' ? (
          <SeriesChart
            ariaLabel="Evolución del capital con las dos alternativas"
            data={data}
            xKey="t"
            xLabel="Tiempo (meses)"
            yLabel="Capital acumulado ($)"
            xTicks={periodTicks(state.months)}
            yDomain={[state.capital * 0.98, 'auto']}
            series={[
              { key: 'a', label: a.name, color: A, dots: true },
              { key: 'b', label: b.name, color: B, dots: true },
            ]}
            tooltip={(r) => ({
              title: `Mes ${r.t}`,
              rows: [
                { label: a.name, value: fmtMoney(r.a), color: A, line: true },
                { label: b.name, value: fmtMoney(r.b), color: B, line: true },
                { label: 'Diferencia', value: fmtMoney(r.a - r.b), strong: true },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Tasa efectiva mensual y TEA de cada alternativa"
            data={[
              { x: 'Tasa efectiva mensual', a: a.monthly, b: b.monthly },
              { x: 'TEA', a: a.tea, b: b.tea },
              { x: `Rendimiento a ${state.months} meses`, a: a.interest / state.capital || 0, b: b.interest / state.capital || 0 },
            ]}
            xKey="x"
            xLabel="Medida"
            yLabel="Tasa (%)"
            yFormat={(v) => fmtPct(v, 0)}
            series={[
              { key: 'a', label: a.name, color: A, kind: 'bar' },
              { key: 'b', label: b.name, color: B, kind: 'bar' },
            ]}
            tooltip={(r) => ({
              title: r.x,
              rows: [
                { label: a.name, value: fmtPct(r.a, 4), color: A },
                { label: b.name, value: fmtPct(r.b, 4), color: B },
              ],
            })}
          />
        )
      }
      chartFooter={
        <Legend
          items={[
            { label: `${a.name} — ${describeRate(a.spec)}`, color: A, line: view === 'evolucion' },
            { label: `${b.name} — ${describeRate(b.spec)}`, color: B, line: view === 'evolucion' },
          ]}
        />
      }
      panels={[
        {
          id: 'resultado',
          label: 'Resultado',
          content: (
            <div className="prose">
              <Callout kind={better ? 'ok' : 'neutral'} title={better ? `Bajo estos supuestos rinde más: ${better}` : 'Ambas alternativas rinden lo mismo'}>
                Para colocaciones (inversiones) conviene la tasa efectiva más alta; para financiaciones (préstamos), la más baja.
              </Callout>
              <div className="table-wrap">
                <table className="data wrap">
                  <thead>
                    <tr>
                      <th className="left">Medida</th>
                      <th>{a.name}</th>
                      <th>{b.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="left">Tasa informada</td>
                      <td>{describeRate(a.spec)}</td>
                      <td>{describeRate(b.spec)}</td>
                    </tr>
                    <tr>
                      <td className="left">Tasa efectiva mensual</td>
                      <td>{fmtPct(a.monthly, 4)}</td>
                      <td>{fmtPct(b.monthly, 4)}</td>
                    </tr>
                    <tr>
                      <td className="left">TEA comparable</td>
                      <td>{fmtPct(a.tea, 4)}</td>
                      <td>{fmtPct(b.tea, 4)}</td>
                    </tr>
                    <tr>
                      <td className="left">Monto final</td>
                      <td>{fmtMoney(a.finalAmount)}</td>
                      <td>{fmtMoney(b.finalAmount)}</td>
                    </tr>
                    <tr>
                      <td className="left">Intereses</td>
                      <td>{fmtMoney(a.interest)}</td>
                      <td>{fmtMoney(b.interest)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        { id: 'explicacion', label: 'Supuestos', content: <ExplicacionComparador /> },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
      ]}
    />
  );
}
