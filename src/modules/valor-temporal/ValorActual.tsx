import { useMemo, useState } from 'react';
import { discountFactor, presentValue, toNum } from '../../engine';
import { SeriesChart } from '../../charts/SeriesChart';
import { Timeline } from '../../charts/Timeline';
import { periodTicks } from '../../charts/common';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { isUnit, UNIT_OPTIONS, unitAdjective, unitPlural, type PeriodUnit } from '../../content/units';
import { ExplicacionVA, FormulaVA } from '../../content/valorTemporal';
import type { PageProps } from '../registry';

const DEFAULTS = { vf: 1_000_000, i: 0.03, n: 12, unit: 'mes' as string };

export default function ValorActual({ query }: PageProps) {
  const { state, set, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'linea' | 'tasa' | 'tiempo'>('linea');
  const unit: PeriodUnit = isUnit(state.unit) ? state.unit : 'mes';
  const va = toNum(presentValue(state.vf, state.i, state.n));
  const factor = toNum(discountFactor(state.i, state.n));
  const A = palette.series[0];
  const B = palette.series[2];

  const rateCurve = useMemo(() => {
    const top = Math.max(0.1, state.i * 2);
    return Array.from({ length: 101 }, (_, k) => {
      const r = (top * k) / 100;
      return { x: r, va: toNum(presentValue(state.vf, r, state.n)) };
    });
  }, [state.vf, state.i, state.n]);
  const timeCurve = useMemo(
    () => Array.from({ length: state.n + 1 }, (_, t) => ({ x: t, valor: toNum(presentValue(state.vf, state.i, state.n - t)) })),
    [state.vf, state.i, state.n],
  );

  const steps: Step[] = [
    { title: 'Datos', math: `VF = ${texMoney(state.vf)} \\qquad i = ${texRate(state.i)} \\text{ ${unitAdjective(unit)}} \\qquad n = ${state.n}` },
    { title: 'Factor de capitalización', math: `(1+i)^n = (1 + ${texRate(state.i)})^{${state.n}} = ${texNum(1 / factor, 8, 4)}` },
    { title: 'Factor de descuento', math: `v^n = \\frac{1}{${texNum(1 / factor, 8, 4)}} = ${texNum(factor, 8, 4)}` },
    { title: 'Valor actual', math: `VA = ${texMoney(state.vf)} \\times ${texNum(factor, 8, 4)} = ${texMoney(va)}` },
    {
      title: 'Descuento',
      math: `D = VF - VA = ${texMoney(state.vf - va)}`,
      body: <>Es el interés que generaría el valor actual durante los {state.n} períodos.</>,
    },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <ParamControl label="Valor futuro (VF)" kind="money" value={state.vf} min={0} max={10_000_000} step={10_000} onChange={(v) => set('vf', v)} />
          <ParamControl
            label={`Tasa de descuento ${unitAdjective(unit)} (i)`}
            kind="percent"
            value={state.i}
            min={0}
            max={0.2}
            step={0.0005}
            onChange={(v) => set('i', v)}
            testId="param-tasa"
          />
          <ParamControl
            label="Períodos hasta el flujo (n)"
            kind="int"
            value={state.n}
            min={0}
            max={120}
            unit={unitPlural(unit)}
            onChange={(v) => set('n', v)}
          />
          <SelectField label="Unidad del período" value={unit} options={UNIT_OPTIONS} onChange={(v) => set('unit', v)} />
        </>
      }
      chartTitle={
        view === 'linea'
          ? 'Del valor futuro al valor actual'
          : view === 'tasa'
            ? 'Valor actual según la tasa de descuento'
            : 'Valor del flujo a lo largo del tiempo'
      }
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'linea', label: 'Línea de tiempo' },
            { value: 'tasa', label: 'VA según la tasa' },
            { value: 'tiempo', label: 'Valor en el tiempo' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label="Valor actual" value={fmtMoney(va)} big color={palette.marker} testId="kpi-va" />
          <Kpi label="Valor futuro" value={fmtMoney(state.vf)} color={A} />
          <Kpi label="Factor de descuento" value={fmtNum(factor, 6)} />
          <Kpi label="Descuento" value={fmtMoney(state.vf - va)} />
        </>
      }
      chart={
        view === 'linea' ? (
          <Timeline
            ariaLabel="Línea de tiempo: valor futuro y su valor actual"
            flows={[{ t: state.n, amount: state.vf, label: `VF ${fmtMoney(state.vf, 0)}` }]}
            focal={{ t: 0, value: va, label: `VA ${fmtMoney(va, 0)}` }}
            arc={{ from: state.n, to: 0, label: `÷ (1 + ${fmtPct(state.i)})^${state.n}` }}
            horizon={Math.max(state.n, 1)}
            unitLabel={unitPlural(unit)}
          />
        ) : view === 'tasa' ? (
          <SeriesChart
            ariaLabel="Valor actual en función de la tasa"
            data={rateCurve}
            xKey="x"
            xLabel={`Tasa de descuento ${unitAdjective(unit)} (%)`}
            yLabel="Valor actual ($)"
            xFormat={(v) => fmtPct(v, 1)}
            series={[{ key: 'va', label: 'Valor actual', color: B }]}
            refLines={[{ y: state.vf, label: 'Valor futuro', color: palette.neutral }]}
            points={[{ x: state.i, y: va, color: palette.marker, label: fmtMoney(va, 0) }]}
            tooltip={(r) => ({ title: `Tasa ${fmtPct(r.x, 2)}`, rows: [{ label: 'Valor actual', value: fmtMoney(r.va), color: B, line: true }] })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Valor del flujo en cada momento"
            data={timeCurve}
            xKey="x"
            xLabel={`Tiempo (${unitPlural(unit)})`}
            yLabel="Valor equivalente ($)"
            xTicks={periodTicks(state.n)}
            series={[{ key: 'valor', label: 'Valor equivalente', color: A, dots: true }]}
            tooltip={(r) => ({ title: `Momento ${r.x}`, rows: [{ label: 'Valor equivalente', value: fmtMoney(r.valor), color: A, line: true }] })}
          />
        )
      }
      chartFooter={
        view === 'linea' ? (
          <Legend
            items={[
              { label: 'Valor futuro', color: A },
              { label: 'Valor actual', color: palette.marker },
            ]}
          />
        ) : view === 'tasa' ? (
          <Legend
            items={[
              { label: 'Valor actual', color: B, line: true },
              { label: 'Valor futuro (tasa 0 %)', color: palette.neutral, line: true, dashed: true },
            ]}
          />
        ) : undefined
      }
      panels={[
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionVA /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaVA /> },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
      ]}
    />
  );
}
