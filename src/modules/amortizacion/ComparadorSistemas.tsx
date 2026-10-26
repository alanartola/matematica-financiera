import { useMemo, useState } from 'react';
import { SYSTEMS, type AmortSystem } from '../../engine';
import { compareSystems, LOAN_DEFAULTS, loanInputFrom, periodPlural, scheduleTable, type LoanFormState, type SystemComparison } from '../../simulation/loans';
import { SeriesChart } from '../../charts/SeriesChart';
import { periodTicks } from '../../charts/common';
import { ParamControl, Segmented } from '../../ui/controls';
import { Callout, Kpi, Legend, Tex, Workbench } from '../../ui/layout';
import { LoanForm } from '../../ui/LoanForm';
import { ExportButtons } from '../../ui/ScheduleTable';
import { fmtMoney, fmtPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import type { Table } from '../../export/tabular';
import type { PageProps } from '../registry';

type View = 'saldo' | 'cuotas' | 'intereses' | 'resumen';

export default function ComparadorSistemas({ query }: PageProps) {
  const { state, patch, set, reset } = usePageState({ ...LOAN_DEFAULTS, k: 12 }, query);
  const { palette } = useTheme();
  const [view, setView] = useState<View>('saldo');
  const input = useMemo(() => loanInputFrom(state as unknown as LoanFormState, 'frances'), [state]);
  const comparison = useMemo(() => {
    try {
      return compareSystems(input);
    } catch {
      return null;
    }
  }, [input]);
  if (!comparison)
    return (
      <div className="page">
        <Callout kind="danger">Revisá los datos de la operación.</Callout>
      </div>
    );

  const color = (s: AmortSystem) => palette.series[SYSTEMS.indexOf(s)];
  const n = Math.max(...comparison.map((c) => c.result.rows.length));
  const k = Math.min(Math.max(state.k, 1), n);
  const units = periodPlural(state.p);
  const i = comparison[0].result.initialPeriodicRate;
  const uniform = state.convention === 'uniforme';

  const data = Array.from({ length: n + 1 }, (_, t) => {
    const row: Record<string, number> = { t };
    for (const c of comparison) {
      const r = c.result.rows[t - 1];
      row[`saldo_${c.system}`] = t === 0 ? c.result.input.principal : r ? r.closingPrincipal + r.closingAccrued : 0;
      if (t > 0 && r) row[`cuota_${c.system}`] = r.payment;
      row[`int_${c.system}`] = c.result.rows.slice(0, t).reduce((s, x) => s + x.interest, 0);
    }
    return row;
  });
  const summary = comparison.map((c) => ({ x: c.label, capital: c.amortized, interes: c.totalInterest, system: c.system }));

  const legend = comparison.map((c) => ({ label: c.label, color: color(c.system), line: view !== 'resumen' }));
  const prefix = view === 'saldo' ? 'saldo' : view === 'cuotas' ? 'cuota' : 'int';
  const yLabel = view === 'saldo' ? 'Saldo adeudado ($)' : view === 'cuotas' ? 'Cuota ($)' : 'Intereses acumulados ($)';

  const exportTable: Table = {
    name: 'Comparación',
    columns: [
      { header: 'Sistema', type: 'text' },
      { header: 'Primera cuota', type: 'money' },
      { header: 'Última cuota', type: 'money' },
      { header: 'Cuota máxima', type: 'money' },
      { header: 'Intereses totales', type: 'money' },
      { header: 'Capital amortizado', type: 'money' },
      { header: 'Total pagado', type: 'money' },
      { header: 'Suma de saldos', type: 'money' },
    ],
    rows: comparison.map((c) => [c.label, c.first, c.last, c.maxPayment, c.totalInterest, c.amortized, c.totalPaid, c.balanceSum]),
  };

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <LoanForm state={state as unknown as LoanFormState} patch={(p) => patch(p as Partial<typeof state>)} showBulletMode />
          <div className="group">
            <p className="group-title">Marcador</p>
            <ParamControl label="Cuota seleccionada" kind="int" value={k} min={1} max={n} hardMin={1} hardMax={n} onChange={(v) => set('k', v)} />
          </div>
        </>
      }
      chartTitle="Una misma operación, cuatro sistemas"
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'saldo', label: 'Saldo adeudado' },
            { value: 'cuotas', label: 'Cuotas' },
            { value: 'intereses', label: 'Intereses acumulados' },
            { value: 'resumen', label: 'Resumen' },
          ]}
        />
      }
      kpis={comparison.map((c) => (
        <Kpi key={c.system} label={`${c.label}: intereses`} value={fmtMoney(c.totalInterest)} color={color(c.system)} testId={`kpi-intereses-${c.system}`} />
      ))}
      chart={
        view === 'resumen' ? (
          <SeriesChart
            ariaLabel="Capital e intereses totales por sistema"
            data={summary}
            xKey="x"
            xLabel="Sistema de amortización"
            yLabel="Total pagado ($)"
            series={[
              { key: 'capital', label: 'Capital', color: palette.series[0], kind: 'bar', stack: 's' },
              { key: 'interes', label: 'Intereses', color: palette.series[1], kind: 'bar', stack: 's', top: true },
            ]}
            tooltip={(r) => ({
              title: r.x,
              rows: [
                { label: 'Capital', value: fmtMoney(r.capital), color: palette.series[0] },
                { label: 'Intereses', value: fmtMoney(r.interes), color: palette.series[1] },
                { label: 'Total', value: fmtMoney(r.capital + r.interes), strong: true },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel={yLabel}
            data={data}
            xKey="t"
            xLabel={`Tiempo (${units})`}
            yLabel={yLabel}
            xTicks={periodTicks(n)}
            selectedX={k}
            onSelectX={(x) => x > 0 && set('k', x)}
            series={comparison.map((c) => ({
              key: `${prefix}_${c.system}`,
              label: c.label,
              color: color(c.system),
              kind: view === 'cuotas' ? ('line' as const) : ('line' as const),
              dots: view === 'cuotas',
            }))}
            tooltip={(r) => ({
              title: r.t === 0 ? 'Desembolso' : `Cuota ${r.t}`,
              rows: comparison.map((c) => ({ label: c.label, value: fmtMoney(r[`${prefix}_${c.system}`] ?? 0), color: color(c.system), line: true })),
            })}
          />
        )
      }
      chartFooter={
        view === 'resumen' ? (
          <Legend
            items={[
              { label: 'Capital', color: palette.series[0] },
              { label: 'Intereses', color: palette.series[1] },
            ]}
          />
        ) : (
          <Legend items={legend} />
        )
      }
      panels={[
        {
          id: 'porque',
          label: '¿Por qué difieren?',
          content: (
            <div className="prose">
              <p>
                En todos los sistemas el interés de cada período es <Tex math="I_k = S_{k-1}\cdot i" />. Por lo tanto, con tasa constante:
              </p>
              <Tex math="\text{Intereses totales} = i \cdot \sum_{k=1}^{n} S_{k-1}" display />
              <p>
                El total de intereses es proporcional a la <strong>suma de los saldos adeudados</strong>, es decir, al área bajo la curva de saldo. El sistema
                que devuelve capital más tarde mantiene un saldo mayor durante más tiempo y paga más intereses. Esa es la diferencia que muestra la vista{' '}
                <strong>Saldo adeudado</strong>.
              </p>
              <div className="table-wrap">
                <table className="data wrap">
                  <thead>
                    <tr>
                      <th className="left">Sistema</th>
                      <th>Suma de saldos</th>
                      <th>i × suma de saldos</th>
                      <th>Intereses del cuadro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c) => (
                      <tr key={c.system}>
                        <td className="left">{c.label}</td>
                        <td>{fmtMoney(c.balanceSum)}</td>
                        <td>{uniform ? fmtMoney(c.balanceSum * i) : '—'}</td>
                        <td>{fmtMoney(c.totalInterest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">
                Las diferencias de centavos se deben al redondeo de cada interés.{' '}
                {uniform ? '' : 'Con días efectivos la tasa varía por período y la igualdad se cumple período a período.'}
              </p>
              <Callout kind="warn" title="Intereses totales no es un CFT">
                Esta comparación considera sólo los flujos de capital e intereses. No es un costo financiero total regulatorio: no incluye impuestos, seguros,
                comisiones ni gastos. Pagar menos intereses tampoco implica necesariamente una mejor decisión: también importa cuándo se paga (valor temporal
                del dinero).
              </Callout>
            </div>
          ),
        },
        {
          id: 'tabla',
          label: 'Indicadores',
          content: (
            <div className="stack">
              <div className="row">
                <span className="spacer" />
                <ExportButtons tables={[exportTable, ...comparison.map((c) => scheduleTable(c.result, c.label))]} filename="comparacion-sistemas" />
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th className="left">Indicador</th>
                      {comparison.map((c) => (
                        <th key={c.system}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['Primera cuota', (c) => fmtMoney(c.first)],
                        ['Última cuota', (c) => fmtMoney(c.last)],
                        ['Cuota máxima', (c) => fmtMoney(c.maxPayment)],
                        [`Cuota ${k}`, (c) => fmtMoney(c.result.rows[k - 1]?.payment ?? 0)],
                        ['Intereses totales', (c) => fmtMoney(c.totalInterest)],
                        ['Capital amortizado', (c) => fmtMoney(c.amortized)],
                        ['Total pagado (flujos considerados)', (c) => fmtMoney(c.totalPaid)],
                        ['Intereses / capital', (c) => fmtPct(c.totalInterest / c.result.input.principal)],
                      ] as [string, (c: SystemComparison) => string][]
                    ).map(([label, f]) => (
                      <tr key={label}>
                        <td className="left">{label}</td>
                        {comparison.map((c) => (
                          <td key={c.system}>{f(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
