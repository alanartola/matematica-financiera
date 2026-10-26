import { useMemo, useState } from 'react';
import { simpleFutureValue, simpleInterest, toNum } from '../../engine';
import { simpleVsCompound } from '../../simulation/rates';
import { SeriesChart } from '../../charts/SeriesChart';
import { periodTicks, useLockedMax } from '../../charts/common';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Kpi, StepList, Workbench, Legend } from '../../ui/layout';
import { ExplicacionSimple, FormulaSimple } from '../../content/tasas';
import { ScaleLock, SnapshotButton, useSnapshot } from '../../ui/chartTools';
import { fmtMoney, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { isUnit, UNIT_OPTIONS, unitAdjective, unitPlural, type PeriodUnit } from '../../content/units';
import type { PageProps } from '../registry';

const DEFAULTS = { c0: 1_000_000, i: 0.03, n: 12, t: 12, unit: 'mes' as string };

export default function InteresSimple({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const unit: PeriodUnit = isUnit(state.unit) ? state.unit : 'mes';
  const t = Math.min(state.t, state.n);
  const [view, setView] = useState<'linea' | 'barras'>('linea');
  const [locked, setLocked] = useState(true);
  const ref = useSnapshot<{ t: number; v: number }[]>();

  const rows = useMemo(() => simpleVsCompound(state.c0, state.i, state.n), [state.c0, state.i, state.n]);
  const interestT = toNum(simpleInterest(state.c0, state.i, t));
  const fvT = toNum(simpleFutureValue(state.c0, state.i, t));
  const slope = state.c0 * state.i;
  const maxY = Math.max(...rows.map((r) => r.simple), ...(ref.snapshot?.value.map((p) => p.v) ?? [0]));
  const [yMax, resetScale] = useLockedMax(maxY * 1.05, locked);

  const data = rows.map((r) => ({
    t: r.t,
    monto: r.simple,
    capital: r.capital,
    interes: r.simpleInterest,
    referencia: ref.snapshot?.value.find((p) => p.t === r.t)?.v,
  }));
  const C = palette.series[0];
  const I = palette.series[1];

  const chart =
    view === 'linea' ? (
      <SeriesChart
        ariaLabel="Evolución lineal del capital acumulado con interés simple"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${unitPlural(unit)})`}
        yLabel="Capital acumulado ($)"
        xTicks={periodTicks(state.n)}
        yDomain={[0, yMax]}
        selectedX={t}
        onSelectX={(x) => set('t', x)}
        series={[
          { key: 'referencia', label: ref.snapshot?.label ?? 'Referencia', color: palette.neutral, dashed: true, width: 2, hidden: !ref.snapshot },
          { key: 'capital', label: 'Capital inicial', color: C, dashed: true, width: 2 },
          { key: 'monto', label: 'Monto (capital + interés)', color: I, dots: true },
        ]}
        tooltip={(row) => ({
          title: `Período ${row.t}`,
          rows: [
            { label: 'Capital inicial', value: fmtMoney(row.capital), color: C, line: true },
            { label: 'Interés acumulado', value: fmtMoney(row.interes) },
            { label: 'Valor futuro', value: fmtMoney(row.monto), color: I, line: true, strong: true },
          ],
          note: 'Hacé clic para fijar el marcador en este período.',
        })}
      />
    ) : (
      <SeriesChart
        ariaLabel="Capital original e intereses acumulados por período"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${unitPlural(unit)})`}
        yLabel="Importe ($)"
        yDomain={[0, yMax]}
        selectedX={t}
        onSelectX={(x) => set('t', x)}
        series={[
          { key: 'capital', label: 'Capital original', color: C, kind: 'bar', stack: 's' },
          { key: 'interes', label: 'Intereses acumulados', color: I, kind: 'bar', stack: 's', top: true },
        ]}
        tooltip={(row) => ({
          title: `Período ${row.t}`,
          rows: [
            { label: 'Capital original', value: fmtMoney(row.capital), color: C },
            { label: 'Intereses acumulados', value: fmtMoney(row.interes), color: I },
            { label: 'Total', value: fmtMoney(row.monto), strong: true },
          ],
        })}
      />
    );

  const steps = [
    {
      title: 'Datos',
      math: `C_0 = ${texMoney(state.c0)} \\qquad i = ${texRate(state.i)} \\text{ ${unitAdjective(unit)}} \\qquad n = ${t}`,
    },
    {
      title: `Interés acumulado hasta el período ${t}`,
      math: [`I = C_0 \\cdot i \\cdot n = ${texMoney(state.c0)} \\times ${texRate(state.i)} \\times ${t}`, `I = ${texMoney(interestT)}`],
    },
    {
      title: 'Valor futuro',
      math: [
        `VF = C_0\\,(1 + i \\cdot n) = ${texMoney(state.c0)} \\times (1 + ${texRate(state.i)} \\times ${t})`,
        `VF = ${texMoney(state.c0)} \\times ${texNum(1 + state.i * t, 6, 2)} = ${texMoney(fvT)}`,
      ],
    },
    {
      title: 'Comprobación',
      math: `VF = C_0 + I = ${texMoney(state.c0)} + ${texMoney(interestT)} = ${texMoney(state.c0 + interestT)}`,
    },
    {
      title: 'Pendiente de la recta',
      body: (
        <>Cada {unit} se agrega el mismo interés, porque siempre se calcula sobre el capital original. Ese incremento constante es la pendiente de la recta:</>
      ),
      math: `\\frac{\\Delta VF}{\\Delta n} = C_0 \\cdot i = ${texMoney(slope)} \\text{ por ${unit}}`,
    },
  ];

  return (
    <Workbench
      onReset={() => {
        reset();
        ref.clear();
      }}
      controls={
        <>
          <ParamControl
            label="Capital inicial (C₀)"
            kind="money"
            value={state.c0}
            min={0}
            max={10_000_000}
            step={10_000}
            onChange={(v) => set('c0', v)}
            testId="param-capital"
          />
          <ParamControl
            label={`Tasa de interés ${unitAdjective(unit)} (i)`}
            kind="percent"
            value={state.i}
            min={0}
            max={0.2}
            step={0.0005}
            onChange={(v) => set('i', v)}
            testId="param-tasa"
          />
          <ParamControl
            label="Número de períodos (n)"
            kind="int"
            value={state.n}
            min={1}
            max={120}
            unit={unitPlural(unit)}
            onChange={(v) => patch({ n: v, t: Math.min(state.t, v) })}
            testId="param-n"
          />
          <SelectField
            label="Unidad de tiempo del período"
            value={unit}
            options={UNIT_OPTIONS}
            onChange={(v) => set('unit', v)}
            help="La tasa y el plazo deben estar expresados en la misma unidad."
          />
          <div className="group">
            <p className="group-title">Marcador</p>
            <ParamControl
              label="Período seleccionado"
              kind="int"
              value={t}
              min={0}
              max={state.n}
              hardMax={state.n}
              onChange={(v) => set('t', v)}
              help="También podés hacer clic sobre el gráfico."
            />
          </div>
        </>
      }
      chartTitle="Interés simple: evolución del capital"
      chartToolbar={
        <div className="row">
          <Segmented
            ariaLabel="Tipo de visualización"
            value={view}
            onChange={setView}
            options={[
              { value: 'linea', label: 'Evolución' },
              { value: 'barras', label: 'Capital e intereses' },
            ]}
          />
          <ScaleLock locked={locked} onToggle={setLocked} onReset={resetScale} />
          {view === 'linea' && (
            <SnapshotButton
              active={!!ref.snapshot}
              onTake={() =>
                ref.take(
                  rows.map((r) => ({ t: r.t, v: r.simple })),
                  `Referencia: i = ${fmtPct(state.i)}, C₀ = ${fmtMoney(state.c0, 0)}`,
                )
              }
              onClear={ref.clear}
            />
          )}
        </div>
      }
      kpis={
        <>
          <Kpi label={`Período ${t}: capital inicial`} value={fmtMoney(state.c0)} color={C} />
          <Kpi label="Interés acumulado" value={fmtMoney(interestT)} color={I} testId="kpi-interes" />
          <Kpi label="Valor futuro" value={fmtMoney(fvT)} big testId="kpi-vf" />
          <Kpi label="Pendiente (interés por período)" value={fmtMoney(slope)} />
        </>
      }
      chart={chart}
      chartFooter={
        view === 'linea' ? (
          <Legend
            items={[
              { label: 'Capital inicial', color: C, line: true, dashed: true },
              { label: 'Monto (capital + interés)', color: I, line: true },
              ...(ref.snapshot ? [{ label: ref.snapshot.label, color: palette.neutral, line: true, dashed: true }] : []),
            ]}
          />
        ) : (
          <Legend
            items={[
              { label: 'Capital original', color: C },
              { label: 'Intereses acumulados', color: I },
            ]}
          />
        )
      }
      panels={[
        {
          id: 'explicacion',
          label: 'Explicación',
          content: <ExplicacionSimple />,
        },
        {
          id: 'formula',
          label: 'Fórmula',
          content: <FormulaSimple />,
        },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        {
          id: 'tabla',
          label: 'Tabla',
          content: (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Capital inicial</th>
                    <th>Interés del período</th>
                    <th>Interés acumulado</th>
                    <th>Valor futuro</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.t} className={`clickable${r.t === t ? ' selected' : ''}`} onClick={() => set('t', r.t)}>
                      <td>{r.t}</td>
                      <td>{fmtMoney(r.capital)}</td>
                      <td>{fmtMoney(r.t === 0 ? 0 : slope)}</td>
                      <td>{fmtMoney(r.simpleInterest)}</td>
                      <td>{fmtMoney(r.simple)}</td>
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
