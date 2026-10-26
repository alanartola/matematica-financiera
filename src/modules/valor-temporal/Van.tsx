import { useMemo, useState } from 'react';
import { datedToFlows, discountFlows, irr, npv, toNum, type Flow } from '../../engine';
import { SeriesChart } from '../../charts/SeriesChart';
import { Timeline } from '../../charts/Timeline';
import { LabeledSegmented, ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { FlowsEditor, makeFlows, type EditableFlow } from '../../ui/FlowsEditor';
import { ExportButtons } from '../../ui/ScheduleTable';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { isUnit, UNIT_OPTIONS, unitAdjective, unitPlural, type PeriodUnit } from '../../content/units';
import { ExplicacionVAN, FormulaVAN } from '../../content/valorTemporal';
import { formatDateAR } from '../../engine/daycount';
import { DEFAULT_FLOWS } from '../../simulation/tvm';
import type { PageProps } from '../registry';

const DEFAULTS = { mode: 'periodos' as string, rate: 0.02, unit: 'mes' as string };

export default function Van({ query }: PageProps) {
  const { state, set, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [flows, setFlows] = useState<EditableFlow[]>(() => makeFlows(DEFAULT_FLOWS));
  const [view, setView] = useState<'flujos' | 'acumulado' | 'linea'>('flujos');
  const unit: PeriodUnit = isUnit(state.unit) ? state.unit : 'mes';
  const dated = state.mode === 'fechas';
  const engineFlows: Flow[] = useMemo(
    () => (dated ? datedToFlows(flows.map((f) => ({ date: f.date, amount: f.amount }))) : flows.map((f) => ({ t: f.t, amount: f.amount }))),
    [flows, dated],
  );
  const detail = useMemo(() => discountFlows(engineFlows, state.rate), [engineFlows, state.rate]);
  const van = toNum(npv(engineFlows, state.rate));
  const tir = useMemo(() => irr(engineFlows), [engineFlows]);
  const undiscounted = engineFlows.reduce((s, f) => s + f.amount, 0);
  const sortedFlows = [...flows].sort((a, b) => (dated ? a.date.localeCompare(b.date) : a.t - b.t));
  const P = palette.series[0];
  const N = palette.series[1];
  const D = palette.series[2];
  const unitText = dated ? 'años desde la primera fecha' : unitPlural(unit);
  const tLabel = (t: number, k: number) => (dated ? formatDateAR(sortedFlows[k]?.date ?? '') : `${fmtNum(t, 2)}`);

  const barData = detail.map((d, k) => ({ x: tLabel(d.t, k), flujo: d.amount, descontado: d.present, factor: d.factor, acumulado: d.cumulative, t: d.t }));
  const cumData = [{ t: 0, acumulado: 0 }, ...detail.map((d) => ({ t: d.t, acumulado: d.cumulative }))];

  const steps: Step[] = [
    {
      title: 'Planteo',
      math: `VAN = ${detail.map((d) => `\\frac{${texMoney(d.amount)}}{(1+${texRate(state.rate)})^{${texNum(d.t, 4, 0)}}}`).join(' + ')}`,
    },
    {
      title: 'Valor actual de cada flujo',
      math: detail.map((d) => `${texMoney(d.amount)} \\times ${texNum(d.factor, 6, 4)} = ${texMoney(d.present)}`),
    },
    { title: 'Suma', math: `VAN = ${texMoney(van)}` },
    {
      title: 'Interpretación',
      body:
        van > 0 ? (
          <>El proyecto genera {fmtMoney(van)} de valor por encima de lo que rendiría la tasa de descuento.</>
        ) : van < 0 ? (
          <>El proyecto no alcanza a rendir la tasa exigida: destruye {fmtMoney(-van)} de valor actual.</>
        ) : (
          <>El proyecto rinde exactamente la tasa de descuento.</>
        ),
    },
  ];

  return (
    <Workbench
      onReset={() => {
        reset();
        setFlows(makeFlows(DEFAULT_FLOWS));
      }}
      controls={
        <>
          <LabeledSegmented
            label="Ubicación de los flujos"
            value={state.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'periodos', label: 'Períodos uniformes' },
              { value: 'fechas', label: 'Fechas específicas' },
            ]}
            help={dated ? 'Se descuenta por días (ACT/365) con una tasa efectiva anual.' : 'Cada t es una cantidad de períodos de la tasa.'}
          />
          <ParamControl
            label={dated ? 'Tasa de descuento (TEA)' : `Tasa de descuento ${unitAdjective(unit)}`}
            kind="percent"
            value={state.rate}
            min={0}
            max={dated ? 1.5 : 0.2}
            step={0.0005}
            onChange={(v) => set('rate', v)}
            testId="param-tasa"
          />
          {!dated && <SelectField label="Unidad del período" value={unit} options={UNIT_OPTIONS} onChange={(v) => set('unit', v)} />}
          <div className="group">
            <p className="group-title">Flujos de fondos</p>
            <FlowsEditor flows={flows} onChange={setFlows} mode={dated ? 'fechas' : 'periodos'} unit={unitPlural(unit)} />
          </div>
        </>
      }
      chartTitle={view === 'flujos' ? 'Flujo original y flujo descontado' : view === 'acumulado' ? 'VAN acumulado' : 'Línea de tiempo'}
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'flujos', label: 'Flujos' },
            { value: 'acumulado', label: 'Acumulado' },
            { value: 'linea', label: 'Línea de tiempo' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label="VAN" value={fmtMoney(van)} big testId="kpi-van" />
          <Kpi label="Suma sin descontar" value={fmtMoney(undiscounted)} />
          <Kpi label={dated ? 'TIR (efectiva anual)' : 'TIR periódica'} value={tir.irr !== null ? fmtPct(tir.irr, 4) : 'No existe'} />
          <Kpi label="Decisión" value={van > 0 ? 'Crea valor' : van < 0 ? 'Destruye valor' : 'Indiferente'} />
        </>
      }
      chart={
        view === 'flujos' ? (
          <SeriesChart
            ariaLabel="Flujos originales y descontados"
            data={barData}
            xKey="x"
            xLabel={dated ? 'Fecha del flujo' : `Momento (${unitPlural(unit)})`}
            yLabel="Importe ($)"
            yDomain={[Math.min(0, ...barData.map((d) => d.flujo)), 'auto']}
            series={[
              { key: 'flujo', label: 'Flujo original', color: P, kind: 'bar' },
              { key: 'descontado', label: 'Valor actual del flujo', color: D, kind: 'bar' },
            ]}
            refLines={[{ y: 0, color: palette.axis, dashed: false }]}
            tooltip={(r) => ({
              title: dated ? r.x : `t = ${r.x}`,
              rows: [
                { label: 'Flujo', value: fmtMoney(r.flujo), color: P },
                { label: 'Factor de descuento', value: fmtNum(r.factor, 6) },
                { label: 'Valor actual', value: fmtMoney(r.descontado), color: D },
                { label: 'VAN acumulado', value: fmtMoney(r.acumulado), strong: true },
              ],
            })}
          />
        ) : view === 'acumulado' ? (
          <SeriesChart
            ariaLabel="VAN acumulado"
            data={cumData}
            xKey="t"
            xLabel={`Tiempo (${unitText})`}
            yLabel="VAN acumulado ($)"
            yDomain={[Math.min(0, ...cumData.map((d) => d.acumulado)), 'auto']}
            series={[{ key: 'acumulado', label: 'VAN acumulado', color: D, kind: 'step', dots: true }]}
            refLines={[{ y: 0, color: palette.axis, dashed: false }]}
            tooltip={(r) => ({ title: `t = ${fmtNum(r.t, 2)}`, rows: [{ label: 'VAN acumulado', value: fmtMoney(r.acumulado), color: D, line: true }] })}
          />
        ) : (
          <Timeline
            ariaLabel="Línea de tiempo de los flujos"
            flows={engineFlows.map((f) => ({ t: f.t, amount: f.amount }))}
            focal={{ t: 0, value: van, label: `VAN ${fmtMoney(van, 0)}` }}
            unitLabel={unitText}
          />
        )
      }
      chartFooter={
        view === 'flujos' ? (
          <Legend
            items={[
              { label: 'Flujo original', color: P },
              { label: 'Valor actual del flujo', color: D },
            ]}
          />
        ) : view === 'linea' ? (
          <Legend
            items={[
              { label: 'Ingreso', color: P },
              { label: 'Egreso', color: N },
              { label: 'VAN en t = 0', color: palette.marker },
            ]}
          />
        ) : undefined
      }
      panels={[
        {
          id: 'detalle',
          label: 'Detalle',
          content: (
            <div className="stack">
              <div className="row">
                <span className="spacer" />
                <ExportButtons
                  filename="van"
                  tables={[
                    {
                      name: 'VAN',
                      columns: [
                        { header: dated ? 'Años' : 'Período', type: 'number' },
                        { header: 'Flujo', type: 'money' },
                        { header: 'Factor de descuento', type: 'number' },
                        { header: 'Valor actual', type: 'money' },
                        { header: 'VAN acumulado', type: 'money' },
                      ],
                      rows: detail.map((d) => [d.t, d.amount, d.factor, d.present, d.cumulative]),
                    },
                  ]}
                />
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{dated ? 'Fecha' : 't'}</th>
                      <th>Flujo</th>
                      <th>Factor</th>
                      <th>Valor actual</th>
                      <th>Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((d, k) => (
                      <tr key={k}>
                        <td>{tLabel(d.t, k)}</td>
                        <td>{fmtMoney(d.amount)}</td>
                        <td>{fmtNum(d.factor, 6)}</td>
                        <td>{fmtMoney(d.present)}</td>
                        <td>{fmtMoney(d.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tir.warnings.length > 0 && (
                <Callout kind="warn" title="Sobre la TIR">
                  <ul>
                    {tir.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              )}
            </div>
          ),
        },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionVAN /> },
        { id: 'formula', label: 'Fórmula', content: <FormulaVAN /> },
      ]}
    />
  );
}
