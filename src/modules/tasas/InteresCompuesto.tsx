import { useMemo, useState } from 'react';
import { compoundFutureValue, toNum } from '../../engine';
import { simpleVsCompound } from '../../simulation/rates';
import { SeriesChart, type SeriesDef } from '../../charts/SeriesChart';
import { periodTicks, useLockedMax } from '../../charts/common';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { ScaleLock } from '../../ui/chartTools';
import { fmtMoney, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { isUnit, UNIT_OPTIONS, unitAdjective, unitPlural, type PeriodUnit } from '../../content/units';
import { ExplicacionCompuesto, FormulaCompuesto } from '../../content/tasas';
import type { PageProps } from '../registry';

const DEFAULTS = { c0: 1_000_000, i: 0.03, n: 24, t: 3, unit: 'mes' as string, highlight: 'diferencia' as string };

export default function InteresCompuesto({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const unit: PeriodUnit = isUnit(state.unit) ? state.unit : 'mes';
  const t = Math.min(state.t, state.n);
  const [view, setView] = useState<'curvas' | 'descomposicion'>('curvas');
  const [locked, setLocked] = useState(true);
  const rows = useMemo(() => simpleVsCompound(state.c0, state.i, state.n), [state.c0, state.i, state.n]);
  const sel = rows[t];
  const [yMax, resetScale] = useLockedMax(rows[rows.length - 1].compound * 1.05, locked);

  const S = palette.series[0];
  const K = palette.series[1];
  const Q = palette.series[2];
  const data = rows.map((r) => ({
    ...r,
    rangoDiferencia: [r.simple, r.compound] as [number, number],
    rangoIntereses: [r.capital, r.compound] as [number, number],
    rangoCapital: [0, r.capital] as [number, number],
    interesSimpleParte: r.simpleInterest,
    interesSobreInteres: r.difference,
  }));

  const highlightSeries: SeriesDef[] =
    state.highlight === 'capital'
      ? [{ key: 'rangoCapital', label: 'Capital inicial', color: S, kind: 'range' }]
      : state.highlight === 'intereses'
        ? [{ key: 'rangoIntereses', label: 'Intereses generados (compuesto)', color: K, kind: 'range' }]
        : [{ key: 'rangoDiferencia', label: 'Diferencia compuesto − simple', color: Q, kind: 'range' }];

  const chart =
    view === 'curvas' ? (
      <SeriesChart
        ariaLabel="Curvas de interés simple y compuesto"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${unitPlural(unit)})`}
        yLabel="Capital acumulado ($)"
        xTicks={periodTicks(state.n)}
        yDomain={[0, yMax]}
        selectedX={t}
        onSelectX={(x) => set('t', x)}
        series={[
          ...highlightSeries,
          { key: 'capital', label: 'Capital inicial', color: palette.neutral, dashed: true, width: 1.5 },
          { key: 'simple', label: 'Interés simple', color: S, dots: true },
          { key: 'compound', label: 'Interés compuesto', color: K, dots: true },
        ]}
        tooltip={(r) => ({
          title: `Período ${r.t}`,
          rows: [
            { label: 'Simple', value: fmtMoney(r.simple), color: S, line: true },
            { label: 'Compuesto', value: fmtMoney(r.compound), color: K, line: true },
            { label: 'Diferencia', value: fmtMoney(r.difference), color: Q, strong: true },
          ],
        })}
      />
    ) : (
      <SeriesChart
        ariaLabel="Descomposición del monto compuesto"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${unitPlural(unit)})`}
        yLabel="Monto compuesto ($)"
        yDomain={[0, yMax]}
        selectedX={t}
        onSelectX={(x) => set('t', x)}
        series={[
          { key: 'capital', label: 'Capital inicial', color: S, kind: 'bar', stack: 'm' },
          { key: 'interesSimpleParte', label: 'Interés sobre el capital inicial (C₀·i·t)', color: K, kind: 'bar', stack: 'm' },
          { key: 'interesSobreInteres', label: 'Interés sobre interés', color: Q, kind: 'bar', stack: 'm', top: true },
        ]}
        tooltip={(r) => ({
          title: `Período ${r.t}`,
          rows: [
            { label: 'Capital inicial', value: fmtMoney(r.capital), color: S },
            { label: 'Interés sobre C₀', value: fmtMoney(r.simpleInterest), color: K },
            { label: 'Interés sobre interés', value: fmtMoney(r.difference), color: Q },
            { label: 'Monto compuesto', value: fmtMoney(r.compound), strong: true },
          ],
        })}
      />
    );

  // Desarrollo período a período hasta el período seleccionado.
  const shownPeriods = t <= 6 ? rows.slice(1, t + 1) : [...rows.slice(1, 4), ...rows.slice(t - 1, t + 1)];
  const steps: Step[] = [
    { title: 'Datos', math: `C_0 = ${texMoney(state.c0)} \\qquad i = ${texRate(state.i)} \\text{ ${unitAdjective(unit)}} \\qquad n = ${t}` },
    ...shownPeriods.map((r, idx) => ({
      title: t > 6 && idx === 3 ? <>⋯ Período {r.t}</> : `Período ${r.t}`,
      body:
        r.t === 1 ? (
          <>El interés se calcula sobre el capital inicial.</>
        ) : (
          <>
            El capital inicial del período incluye los intereses capitalizados hasta el período {r.t - 1}. Interés sobre interés del período:{' '}
            {fmtMoney(r.interestOnInterest)}.
          </>
        ),
      math: [
        `\\text{Capital inicial} = ${texMoney(r.compoundOpening)}`,
        `\\text{Interés} = ${texMoney(r.compoundOpening)} \\times ${texRate(state.i)} = ${texMoney(r.compoundPeriodInterest)}`,
        `\\text{Capital final} = ${texMoney(r.compoundOpening)} + ${texMoney(r.compoundPeriodInterest)} = ${texMoney(r.compound)}`,
      ],
    })),
    {
      title: 'Fórmula cerrada',
      math: [
        `VF = C_0(1+i)^{n} = ${texMoney(state.c0)} \\times (1 + ${texRate(state.i)})^{${t}}`,
        `VF = ${texMoney(state.c0)} \\times ${texNum(toNum(compoundFutureValue(1, state.i, t)), 8, 4)} = ${texMoney(sel.compound)}`,
      ],
    },
    {
      title: 'Comparación con el interés simple',
      math: `${texMoney(sel.compound)} - ${texMoney(sel.simple)} = ${texMoney(sel.difference)}`,
      body: <>Esa diferencia es el interés generado por los intereses capitalizados.</>,
    },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <ParamControl label="Capital inicial (C₀)" kind="money" value={state.c0} min={0} max={10_000_000} step={10_000} onChange={(v) => set('c0', v)} />
          <ParamControl
            label={`Tasa ${unitAdjective(unit)} (i)`}
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
          />
          <SelectField label="Unidad de tiempo del período" value={unit} options={UNIT_OPTIONS} onChange={(v) => set('unit', v)} />
          <SelectField
            label="Destacar en el gráfico"
            value={state.highlight}
            options={[
              { value: 'capital', label: 'Capital inicial' },
              { value: 'intereses', label: 'Intereses generados' },
              { value: 'diferencia', label: 'Diferencia simple / compuesto' },
            ]}
            onChange={(v) => set('highlight', v)}
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
              help="El desarrollo muestra cada período hasta el seleccionado."
            />
          </div>
        </>
      }
      chartTitle="Interés simple frente a interés compuesto"
      chartToolbar={
        <div className="row">
          <Segmented
            ariaLabel="Tipo de visualización"
            value={view}
            onChange={setView}
            options={[
              { value: 'curvas', label: 'Curvas' },
              { value: 'descomposicion', label: 'Descomposición' },
            ]}
          />
          <ScaleLock locked={locked} onToggle={setLocked} onReset={resetScale} />
        </div>
      }
      kpis={
        <>
          <Kpi label={`Período ${t}: capital al inicio`} value={fmtMoney(t === 0 ? state.c0 : sel.compoundOpening)} />
          <Kpi label="Interés del período" value={fmtMoney(sel.compoundPeriodInterest)} />
          <Kpi label="Compuesto" value={fmtMoney(sel.compound)} color={K} line big testId="kpi-compuesto" />
          <Kpi label="Simple" value={fmtMoney(sel.simple)} color={S} line />
          <Kpi label="Diferencia" value={`${fmtMoney(sel.difference)} (${fmtPct(sel.simple ? sel.difference / sel.simple : 0)})`} color={Q} />
        </>
      }
      chart={chart}
      chartFooter={
        view === 'curvas' ? (
          <Legend
            items={[
              { label: 'Interés simple', color: S, line: true },
              { label: 'Interés compuesto', color: K, line: true },
              { label: 'Capital inicial', color: palette.neutral, line: true, dashed: true },
              { label: highlightSeries[0].label, color: highlightSeries[0].color },
            ]}
          />
        ) : (
          <Legend
            items={[
              { label: 'Capital inicial', color: S },
              { label: 'Interés sobre el capital inicial (C₀·i·t)', color: K },
              { label: 'Interés sobre interés', color: Q },
            ]}
          />
        )
      }
      panels={[
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionCompuesto /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaCompuesto /> },
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
                    <th>Interés</th>
                    <th>Interés s/ interés</th>
                    <th>Capital final</th>
                    <th>Simple</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.t} className={`clickable${r.t === t ? ' selected' : ''}`} onClick={() => set('t', r.t)}>
                      <td>{r.t}</td>
                      <td>{fmtMoney(r.compoundOpening)}</td>
                      <td>{fmtMoney(r.compoundPeriodInterest)}</td>
                      <td>{fmtMoney(r.interestOnInterest)}</td>
                      <td>{fmtMoney(r.compound)}</td>
                      <td>{fmtMoney(r.simple)}</td>
                      <td>{fmtMoney(r.difference)}</td>
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
