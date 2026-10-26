import { useMemo, useState } from 'react';
import { analyzeLoanCost, effectiveAnnual, type AmortSystem, SYSTEM_LABELS, SYSTEMS } from '../../engine';
import { LOAN_DEFAULTS, loanInputFrom, periodPlural, rateSpecFrom, safeSchedule, type LoanFormState } from '../../simulation/loans';
import { SeriesChart } from '../../charts/SeriesChart';
import { ParamControl, Segmented, SelectField, Toggle } from '../../ui/controls';
import { Callout, Kpi, Legend, Workbench } from '../../ui/layout';
import { LoanForm } from '../../ui/LoanForm';
import { ExportButtons } from '../../ui/ScheduleTable';
import { fmtMoney, fmtPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { ExplicacionPrestamo } from '../../content/bancarias';
import type { PageProps } from '../registry';

const DEFAULTS = {
  ...LOAN_DEFAULTS,
  principal: 5_000_000,
  rateValue: 0.6,
  n: 24,
  system: 'frances' as string,
  iva: 0.21,
  insurance: 0.0006,
  fee: 1_500,
  origination: 0.02,
  ivaOnFees: true as boolean,
};

export default function PrestamoBancario({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [view, setView] = useState<'cuotas' | 'totales'>('cuotas');
  const input = useMemo(() => loanInputFrom(state as unknown as LoanFormState, state.system as AmortSystem), [state]);
  const { result, error } = useMemo(() => safeSchedule(input), [input]);
  const cost = useMemo(
    () =>
      result
        ? analyzeLoanCost(result, {
            ivaOnInterest: state.iva,
            insuranceOnBalance: state.insurance,
            fixedFee: state.fee,
            originationRate: state.origination,
            ivaOnFees: state.ivaOnFees,
          })
        : null,
    [result, state.iva, state.insurance, state.fee, state.origination, state.ivaOnFees],
  );
  if (!result || !cost)
    return (
      <div className="page">
        <Callout kind="danger">{error}</Callout>
      </div>
    );

  const tea = effectiveAnnual(rateSpecFrom(state.rateKind, state.rateValue, state.rateM)).toNumber();
  const colors = { amort: palette.series[0], int: palette.series[1], iva: palette.series[2], seg: palette.series[3], gas: palette.series[6] };
  const units = periodPlural(state.p);
  const first = cost.rows[0];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <SelectField
            label="Sistema de amortización"
            value={state.system}
            options={SYSTEMS.map((s) => ({ value: s, label: SYSTEM_LABELS[s] }))}
            onChange={(v) => set('system', v)}
          />
          <LoanForm state={state as unknown as LoanFormState} patch={(p) => patch(p as Partial<typeof state>)} showBulletMode={state.system === 'bullet'} />
          <div className="group">
            <p className="group-title">Cargos adicionales</p>
            <ParamControl label="IVA sobre intereses" kind="percent" value={state.iva} min={0} max={0.27} step={0.005} onChange={(v) => set('iva', v)} />
            <ParamControl
              label="Seguro de vida (por período, sobre saldo)"
              kind="percent"
              value={state.insurance}
              min={0}
              max={0.005}
              step={0.0001}
              decimals={4}
              onChange={(v) => set('insurance', v)}
            />
            <ParamControl label="Gasto fijo por cuota" kind="money" value={state.fee} min={0} max={20_000} step={100} onChange={(v) => set('fee', v)} />
            <ParamControl
              label="Comisión de otorgamiento"
              kind="percent"
              value={state.origination}
              min={0}
              max={0.1}
              step={0.0025}
              onChange={(v) => set('origination', v)}
            />
            <Toggle label="IVA sobre comisión y gastos" checked={state.ivaOnFees} onChange={(v) => set('ivaOnFees', v)} />
          </div>
        </>
      }
      chartTitle={view === 'cuotas' ? 'Composición de cada cuota con cargos' : 'Composición del total pagado'}
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'cuotas', label: 'Por cuota' },
            { value: 'totales', label: 'Totales' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label="Primera cuota total" value={fmtMoney(first.total)} big />
          <Kpi label="TNA / TEA" value={`${fmtPct(state.rateKind === 'TNA' ? state.rateValue : tea, 2)} / ${fmtPct(tea, 2)}`} />
          <Kpi label="CFT estimado (TEA)" value={cost.cftea !== null ? fmtPct(cost.cftea, 2) : '—'} testId="kpi-cft" />
          <Kpi label="CFT estimado (TNA)" value={cost.cftna !== null ? fmtPct(cost.cftna, 2) : '—'} />
          <Kpi label="Neto recibido" value={fmtMoney(cost.netDisbursed)} />
        </>
      }
      chart={
        view === 'cuotas' ? (
          <SeriesChart
            ariaLabel="Composición de las cuotas con impuestos, seguros y gastos"
            data={cost.rows}
            xKey="period"
            xLabel={`Número de cuota (${units})`}
            yLabel="Cuota total ($)"
            series={[
              { key: 'amortization', label: 'Amortización', color: colors.amort, kind: 'bar', stack: 'c' },
              { key: 'interest', label: 'Interés', color: colors.int, kind: 'bar', stack: 'c' },
              { key: 'iva', label: 'IVA', color: colors.iva, kind: 'bar', stack: 'c' },
              { key: 'insurance', label: 'Seguro', color: colors.seg, kind: 'bar', stack: 'c' },
              { key: 'fee', label: 'Gastos', color: colors.gas, kind: 'bar', stack: 'c', top: true },
            ]}
            tooltip={(r) => ({
              title: `Cuota ${r.period}`,
              rows: [
                { label: 'Amortización', value: fmtMoney(r.amortization), color: colors.amort },
                { label: 'Interés', value: fmtMoney(r.interest), color: colors.int },
                { label: 'IVA', value: fmtMoney(r.iva), color: colors.iva },
                { label: 'Seguro', value: fmtMoney(r.insurance), color: colors.seg },
                { label: 'Gastos', value: fmtMoney(r.fee), color: colors.gas },
                { label: 'Total', value: fmtMoney(r.total), strong: true },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Totales por concepto"
            data={[
              { x: 'Capital', v: result.totals.amortization + result.totals.extraPayments },
              { x: 'Intereses', v: cost.totals.interest },
              { x: 'IVA', v: cost.totals.iva + cost.originationIva },
              { x: 'Seguros', v: cost.totals.insurance },
              { x: 'Gastos y comisiones', v: cost.totals.fees + cost.origination },
            ]}
            xKey="x"
            xLabel="Concepto"
            yLabel="Importe total ($)"
            series={[{ key: 'v', label: 'Total', color: colors.amort, kind: 'bar' }]}
            tooltip={(r) => ({ title: r.x, rows: [{ label: 'Total', value: fmtMoney(r.v), strong: true }] })}
          />
        )
      }
      chartFooter={
        view === 'cuotas' ? (
          <Legend
            items={[
              { label: 'Amortización', color: colors.amort },
              { label: 'Interés', color: colors.int },
              { label: 'IVA', color: colors.iva },
              { label: 'Seguro', color: colors.seg },
              { label: 'Gastos', color: colors.gas },
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
                <span className="small muted">
                  Comisión de otorgamiento {fmtMoney(cost.origination)} + IVA {fmtMoney(cost.originationIva)} · Total pagado {fmtMoney(cost.totals.total)}
                </span>
                <span className="spacer" />
                <ExportButtons
                  filename="prestamo-con-cargos"
                  tables={[
                    {
                      name: 'Préstamo con cargos',
                      columns: [
                        { header: 'Cuota', type: 'int' },
                        { header: 'Amortización', type: 'money' },
                        { header: 'Interés', type: 'money' },
                        { header: 'IVA', type: 'money' },
                        { header: 'Seguro', type: 'money' },
                        { header: 'Gastos', type: 'money' },
                        { header: 'Cuota total', type: 'money' },
                        { header: 'Saldo', type: 'money' },
                      ],
                      rows: cost.rows.map((r) => [r.period, r.amortization, r.interest, r.iva, r.insurance, r.fee, r.total, r.balance]),
                    },
                  ]}
                />
              </div>
              <div className="table-wrap" style={{ maxHeight: 'min(55vh, 460px)' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Cuota</th>
                      <th>Cuota pura</th>
                      <th>IVA</th>
                      <th>Seguro</th>
                      <th>Gastos</th>
                      <th>Total</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cost.rows.map((r) => (
                      <tr key={r.period}>
                        <td>{r.period}</td>
                        <td>{fmtMoney(r.purePayment)}</td>
                        <td>{fmtMoney(r.iva)}</td>
                        <td>{fmtMoney(r.insurance)}</td>
                        <td>{fmtMoney(r.fee)}</td>
                        <td>{fmtMoney(r.total)}</td>
                        <td>{fmtMoney(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        { id: 'explicacion', label: 'Tasas y CFT', content: <ExplicacionPrestamo /> },
      ]}
    />
  );
}
