/**
 * Página genérica de un sistema de amortización: formulario, gráficos
 * interactivos, desarrollo de la cuota seleccionada, cuadro de marcha y
 * verificaciones. Cada sistema aporta su contenido pedagógico.
 */
import { useMemo, useState } from 'react';
import { SYSTEM_LABELS, type AmortSystem } from '../../engine';
import { chartRows, LOAN_DEFAULTS, loanInputFrom, safeSchedule, periodPlural, type LoanFormState } from '../../simulation/loans';
import { SeriesChart, type SeriesDef } from '../../charts/SeriesChart';
import { periodTicks } from '../../charts/common';
import { ParamControl, Segmented, Toggle } from '../../ui/controls';
import { Callout, ChecksList, Kpi, Legend, StepList, Workbench } from '../../ui/layout';
import { LoanForm } from '../../ui/LoanForm';
import { ScheduleTable } from '../../ui/ScheduleTable';
import { fmtMoney } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { EXPLICACIONES, FORMULAS, pasosCuota } from '../../content/amortizacion';
import type { PageProps } from '../registry';

type View = 'composicion' | 'saldo' | 'acumulado' | 'deuda';

export function SystemPage({ system, query, compareWith }: PageProps & { system: AmortSystem; compareWith?: AmortSystem }) {
  const { state, patch, set, reset } = usePageState({ ...LOAN_DEFAULTS, k: 5, compare: false as boolean }, query);
  const { palette } = useTheme();
  const [view, setView] = useState<View>(system === 'bullet' ? 'deuda' : 'composicion');
  const input = useMemo(() => loanInputFrom(state as unknown as LoanFormState, system), [state, system]);
  const { result, checks, error } = useMemo(() => safeSchedule(input), [input]);
  const other = useMemo(
    () => (compareWith && state.compare ? safeSchedule({ ...input, system: compareWith }).result : null),
    [compareWith, state.compare, input],
  );

  const AM = palette.series[0];
  const IN = palette.series[1];
  const CMP = palette.neutral;
  const units = periodPlural(state.p);

  if (!result) {
    return (
      <div className="page">
        <Callout kind="danger" title="Datos inválidos">
          {error}
        </Callout>
        <button className="btn" onClick={reset}>
          Restablecer valores
        </button>
      </div>
    );
  }

  const n = result.rows.length;
  const k = Math.min(Math.max(1, state.k), n);
  const row = result.rows[k - 1];
  const data = chartRows(result).map((r, idx) => ({
    ...r,
    otherPayment: other?.rows[idx - 1]?.payment,
    otherDebt: idx === 0 ? other?.input.principal : other ? other.rows[idx - 1].closingPrincipal + other.rows[idx - 1].closingAccrued : undefined,
    otherCumInterest: other ? other.rows.slice(0, idx).reduce((s, x) => s + x.interest, 0) : undefined,
  }));
  const bars = data.slice(1);
  const otherLabel = compareWith ? `Sistema ${SYSTEM_LABELS[compareWith]}` : '';

  const tooltipRows = (r: (typeof data)[number]) => ({
    title: `Cuota ${r.t}`,
    rows: [
      { label: 'Amortización', value: fmtMoney(r.amortization), color: AM },
      { label: 'Interés', value: fmtMoney(r.interest), color: IN },
      { label: 'Cuota', value: fmtMoney(r.payment), strong: true },
      { label: 'Saldo final', value: fmtMoney(r.debt) },
      ...(r.otherPayment !== undefined ? [{ label: `Cuota (${otherLabel})`, value: fmtMoney(r.otherPayment), color: CMP, line: true }] : []),
    ],
    note: 'Clic para ver el desarrollo de esta cuota.',
  });

  let chart: React.ReactNode;
  let legend: { label: string; color: string; line?: boolean; dashed?: boolean }[] = [];
  if (view === 'composicion') {
    const series: SeriesDef[] = [
      { key: 'amortization', label: 'Amortización de capital', color: AM, kind: 'bar', stack: 'c' },
      { key: 'interest', label: 'Interés', color: IN, kind: 'bar', stack: 'c', top: true },
    ];
    if (other) series.push({ key: 'otherPayment', label: `Cuota ${otherLabel}`, color: CMP, dashed: true, width: 2.5 });
    chart = (
      <SeriesChart
        ariaLabel="Composición de cada cuota: amortización e interés"
        data={bars}
        xKey="t"
        xLabel={`Número de cuota (${units})`}
        yLabel="Importe de la cuota ($)"
        selectedX={k}
        onSelectX={(x) => set('k', x)}
        series={series}
        tooltip={tooltipRows}
      />
    );
    legend = [
      { label: 'Amortización de capital', color: AM },
      { label: 'Interés', color: IN },
      ...(other ? [{ label: `Cuota total ${otherLabel}`, color: CMP, line: true, dashed: true }] : []),
    ];
  } else if (view === 'saldo') {
    chart = (
      <SeriesChart
        ariaLabel="Saldo de capital pendiente"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${units})`}
        yLabel="Saldo pendiente ($)"
        xTicks={periodTicks(n)}
        selectedX={k}
        onSelectX={(x) => x > 0 && set('k', x)}
        series={[
          ...(other ? [{ key: 'otherDebt', label: `Saldo ${otherLabel}`, color: CMP, dashed: true, width: 2 } as SeriesDef] : []),
          { key: 'debt', label: 'Saldo pendiente', color: AM, kind: 'area' },
        ]}
        tooltip={(r) => ({
          title: r.t === 0 ? 'Desembolso' : `Luego de la cuota ${r.t}`,
          rows: [
            { label: 'Saldo', value: fmtMoney(r.debt), color: AM, line: true, strong: true },
            ...(r.otherDebt !== undefined ? [{ label: otherLabel, value: fmtMoney(r.otherDebt), color: CMP, line: true }] : []),
          ],
        })}
      />
    );
    legend = [{ label: 'Saldo pendiente', color: AM, line: true }, ...(other ? [{ label: `Saldo ${otherLabel}`, color: CMP, line: true, dashed: true }] : [])];
  } else if (view === 'acumulado') {
    chart = (
      <SeriesChart
        ariaLabel="Intereses y amortizaciones acumulados"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${units})`}
        yLabel="Importe acumulado ($)"
        xTicks={periodTicks(n)}
        selectedX={k}
        onSelectX={(x) => x > 0 && set('k', x)}
        series={[
          { key: 'cumAmortization', label: 'Capital amortizado acumulado', color: AM },
          { key: 'cumInterest', label: 'Intereses acumulados', color: IN },
          ...(other ? [{ key: 'otherCumInterest', label: `Intereses acumulados ${otherLabel}`, color: CMP, dashed: true } as SeriesDef] : []),
        ]}
        tooltip={(r) => ({
          title: `Cuota ${r.t}`,
          rows: [
            { label: 'Capital amortizado', value: fmtMoney(r.cumAmortization), color: AM, line: true },
            { label: 'Intereses pagados o devengados', value: fmtMoney(r.cumInterest), color: IN, line: true },
            ...(r.otherCumInterest !== undefined ? [{ label: `Intereses ${otherLabel}`, value: fmtMoney(r.otherCumInterest), color: CMP, line: true }] : []),
          ],
        })}
      />
    );
    legend = [
      { label: 'Capital amortizado acumulado', color: AM, line: true },
      { label: 'Intereses acumulados', color: IN, line: true },
      ...(other ? [{ label: `Intereses ${otherLabel}`, color: CMP, line: true, dashed: true }] : []),
    ];
  } else {
    chart = (
      <SeriesChart
        ariaLabel="Evolución de la deuda: capital e intereses capitalizados"
        data={data}
        xKey="t"
        xLabel={`Tiempo (${units})`}
        yLabel="Deuda ($)"
        xTicks={periodTicks(n)}
        selectedX={k}
        onSelectX={(x) => x > 0 && set('k', x)}
        series={[
          { key: 'principal', label: 'Capital adeudado', color: AM, kind: 'bar', stack: 'd' },
          { key: 'accrued', label: 'Intereses acumulados', color: IN, kind: 'bar', stack: 'd', top: true },
        ]}
        tooltip={(r) => ({
          title: r.t === 0 ? 'Desembolso' : `Al cierre del período ${r.t}`,
          rows: [
            { label: 'Capital', value: fmtMoney(r.principal), color: AM },
            { label: 'Intereses acumulados', value: fmtMoney(r.accrued), color: IN },
            { label: 'Deuda total', value: fmtMoney(r.principal + r.accrued), strong: true },
            { label: 'Pago del período', value: fmtMoney(r.payment) },
          ],
        })}
      />
    );
    legend = [
      { label: 'Capital adeudado', color: AM },
      { label: 'Intereses acumulados (no pagados)', color: IN },
    ];
  }

  const viewOptions: { value: View; label: string }[] = [
    ...(system === 'bullet' ? [{ value: 'deuda' as View, label: 'Deuda' }] : []),
    { value: 'composicion', label: 'Composición de la cuota' },
    { value: 'saldo', label: 'Saldo' },
    { value: 'acumulado', label: 'Acumulados' },
  ];

  return (
    <Workbench
      onReset={reset}
      controls={
        <>
          <LoanForm state={state as unknown as LoanFormState} patch={(p) => patch(p as Partial<typeof state>)} showBulletMode={system === 'bullet'} />
          {compareWith && (
            <Toggle label={`Comparar con el sistema ${SYSTEM_LABELS[compareWith]}`} checked={!!state.compare} onChange={(v) => set('compare', v)} />
          )}
          <div className="group">
            <p className="group-title">Cuota seleccionada</p>
            <ParamControl
              label="Número de cuota"
              kind="int"
              value={k}
              min={1}
              max={n}
              hardMin={1}
              hardMax={n}
              onChange={(v) => set('k', v)}
              testId="param-cuota"
            />
          </div>
        </>
      }
      chartTitle={`Sistema ${SYSTEM_LABELS[system]}`}
      chartToolbar={<Segmented ariaLabel="Tipo de visualización" value={view} onChange={setView} options={viewOptions} />}
      kpis={
        <>
          <Kpi label={`Cuota ${k}: saldo inicial`} value={fmtMoney(row.openingPrincipal + (row.bulletMode === 'compuesto' ? row.openingAccrued : 0))} />
          <Kpi label="Interés" value={fmtMoney(row.interest)} color={IN} />
          <Kpi label="Amortización" value={fmtMoney(row.amortization)} color={AM} />
          <Kpi label="Cuota" value={fmtMoney(row.payment)} big testId="kpi-cuota" />
          <Kpi label="Saldo final" value={fmtMoney(row.closingPrincipal + row.closingAccrued)} />
          <Kpi label="Intereses totales" value={fmtMoney(result.totals.interest)} testId="kpi-intereses-totales" />
        </>
      }
      chart={chart}
      chartFooter={<Legend items={legend} />}
      panels={[
        { id: 'explicacion', label: 'Explicación', content: EXPLICACIONES[system]() },
        { id: 'formula', label: 'Fórmulas', content: FORMULAS[system]() },
        { id: 'desarrollo', label: `Cuota ${k}`, content: <StepList steps={pasosCuota(result, k)} /> },
        {
          id: 'cuadro',
          label: 'Cuadro',
          content: <ScheduleTable result={result} selected={k} onSelect={(p) => set('k', p)} filename={`cuadro-${system}`} />,
        },
        {
          id: 'verificaciones',
          label: 'Verificación',
          content: (
            <>
              <ChecksList checks={checks} />
              {result.notes.length > 0 && (
                <Callout kind="neutral" title="Notas">
                  <ul>
                    {result.notes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </Callout>
              )}
            </>
          ),
        },
      ]}
    />
  );
}
