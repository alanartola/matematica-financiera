import { useMemo, useState } from 'react';
import { SYSTEM_LABELS, SYSTEMS, describeRate, type AmortSystem } from '../../engine';
import { LAB_PRESETS, runLab, type LabEvent } from '../../simulation/lab';
import { chartRows, LOAN_DEFAULTS, loanInputFrom, periodPlural, scheduleTable, type LoanFormState } from '../../simulation/loans';
import { SeriesChart, type Band, type RefLine } from '../../charts/SeriesChart';
import { periodTicks } from '../../charts/common';
import { ParamControl, Segmented, SelectField } from '../../ui/controls';
import { Callout, ChecksList, Kpi, Legend, StepList, Workbench } from '../../ui/layout';
import { LoanForm } from '../../ui/LoanForm';
import { ScheduleTable } from '../../ui/ScheduleTable';
import { fmtMoney, fmtPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { pasosCuota } from '../../content/amortizacion';
import { LogicaLaboratorio } from '../../content/laboratorio';
import { EventEditor } from './EventEditor';
import type { PageProps } from '../registry';

type View = 'cuotas' | 'saldo' | 'intereses' | 'tasa';

export default function Simulador({ query }: PageProps) {
  const { state, patch, set, reset } = usePageState({ ...LOAN_DEFAULTS, system: 'frances' as string, k: 6 }, query);
  const [events, setEvents] = useState<LabEvent[]>(() => LAB_PRESETS[0].events());
  const [preset, setPreset] = useState('sistemas');
  const [view, setView] = useState<View>('cuotas');
  const { palette } = useTheme();

  const input = useMemo(() => loanInputFrom(state as unknown as LoanFormState, state.system as AmortSystem), [state]);
  const lab = useMemo(() => {
    try {
      return { ok: true as const, ...runLab(input, events) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, events]);

  const resetAll = () => {
    reset();
    setEvents(LAB_PRESETS[0].events());
    setPreset('sistemas');
  };

  if (!lab.ok) {
    return (
      <div className="page">
        <Callout kind="danger" title="No es posible calcular el escenario">
          {lab.error}
        </Callout>
        <button className="btn" onClick={resetAll}>
          Restablecer valores
        </button>
      </div>
    );
  }

  const { base, modified, checks, impacts, interestSaving } = lab;
  const n = Math.max(base.rows.length, modified.rows.length);
  const k = Math.min(Math.max(1, state.k), modified.rows.length);
  const row = modified.rows[k - 1];
  const baseRow = base.rows[k - 1];
  const units = periodPlural(state.p);
  // Tonos de tramo distintos de los de amortización (azul) e interés (naranja).
  const BAND_SLOTS: Record<AmortSystem, number> = { frances: 2, aleman: 6, americano: 3, bullet: 4 };
  const sysColor = (s: AmortSystem) => palette.series[BAND_SLOTS[s]];
  const AM = palette.series[0];
  const IN = palette.series[1];
  const BASE = palette.neutral;

  const modRows = chartRows(modified);
  const baseRows = chartRows(base);
  const data = Array.from({ length: n + 1 }, (_, t) => {
    const m = modRows[t];
    const b = baseRows[t];
    const r = modified.rows[t - 1];
    return {
      t,
      amortization: m?.amortization ?? 0,
      interest: m?.interest ?? 0,
      extra: m?.extra ?? 0,
      payment: m ? m.payment + m.extra : 0,
      debt: m?.debt ?? 0,
      cumInterest: m?.cumInterest ?? modRows[modRows.length - 1].cumInterest,
      rate: r?.contractRate,
      system: r?.system,
      basePayment: t > 0 ? b?.payment : undefined,
      baseDebt: b?.debt ?? 0,
      baseCumInterest: b?.cumInterest ?? baseRows[baseRows.length - 1].cumInterest,
      baseRate: base.rows[t - 1]?.contractRate,
    };
  });

  const bands: Band[] = modified.segments.map((s) => ({ from: s.from, to: s.to, color: sysColor(s.system), label: SYSTEM_LABELS[s.system] }));
  const transitions: RefLine[] = [
    ...modified.segments.slice(1).map((s) => ({ x: s.from, color: palette.marker })),
    ...modified.rateSegments.slice(1).map((s) => ({ x: s.from, color: palette.series[7], label: `Tasa ${fmtPct(s.periodic, 2)}` })),
    ...events
      .filter((e) => e.type === 'prepago' && e.period <= modified.rows.length)
      .map((e) => ({ x: e.period, color: palette.series[5], label: 'Pago extra' })),
  ];

  const tooltip = (r: (typeof data)[number]) =>
    r.t === 0
      ? { title: 'Desembolso', rows: [{ label: 'Capital', value: fmtMoney(r.debt), strong: true }] }
      : {
          title: `Cuota ${r.t}${r.system ? ` · ${SYSTEM_LABELS[r.system]}` : ''}`,
          rows: [
            { label: 'Tasa aplicada', value: r.rate !== undefined ? fmtPct(r.rate, 4) : '—' },
            { label: 'Amortización', value: fmtMoney(r.amortization), color: AM },
            { label: 'Interés', value: fmtMoney(r.interest), color: IN },
            ...(r.extra ? [{ label: 'Pago extraordinario', value: fmtMoney(r.extra), color: palette.series[5] }] : []),
            { label: 'Cuota', value: fmtMoney(r.payment - r.extra), strong: true },
            { label: 'Saldo', value: fmtMoney(r.debt) },
            ...(r.basePayment !== undefined ? [{ label: 'Cuota original', value: fmtMoney(r.basePayment), color: BASE, line: true }] : []),
          ],
          note: 'Clic para ver el desarrollo de esta cuota.',
        };

  let chart: React.ReactNode;
  let legend: { label: string; color: string; line?: boolean; dashed?: boolean }[];
  const common = {
    data,
    xKey: 't' as const,
    selectedX: k,
    onSelectX: (x: number) => x > 0 && x <= modified.rows.length && set('k', x),
    refLines: transitions,
    tooltip,
  };
  if (view === 'cuotas') {
    chart = (
      <SeriesChart
        {...common}
        data={data.slice(1)}
        ariaLabel="Composición de las cuotas por tramo"
        xLabel={`Número de cuota (${units})`}
        yLabel="Cuota ($)"
        bands={bands}
        series={[
          { key: 'amortization', label: 'Amortización', color: AM, kind: 'bar', stack: 'c' },
          { key: 'interest', label: 'Interés', color: IN, kind: 'bar', stack: 'c', top: true },
          { key: 'basePayment', label: 'Cuota original', color: BASE, dashed: true, width: 2 },
        ]}
      />
    );
    legend = [
      { label: 'Amortización', color: AM },
      { label: 'Interés', color: IN },
      { label: 'Cuota del préstamo original', color: BASE, line: true, dashed: true },
    ];
  } else if (view === 'saldo' || view === 'intereses') {
    const key = view === 'saldo' ? 'debt' : 'cumInterest';
    chart = (
      <SeriesChart
        {...common}
        ariaLabel={view === 'saldo' ? 'Saldo pendiente: original y modificado' : 'Intereses acumulados: original y modificado'}
        xLabel={`Tiempo (${units})`}
        yLabel={view === 'saldo' ? 'Saldo pendiente ($)' : 'Intereses acumulados ($)'}
        xTicks={periodTicks(n)}
        bands={bands}
        series={[
          { key: view === 'saldo' ? 'baseDebt' : 'baseCumInterest', label: 'Préstamo original', color: BASE, dashed: true, width: 2 },
          { key, label: 'Préstamo modificado', color: view === 'saldo' ? AM : IN },
        ]}
      />
    );
    legend = [
      { label: 'Préstamo modificado', color: view === 'saldo' ? AM : IN, line: true },
      { label: 'Préstamo original', color: BASE, line: true, dashed: true },
    ];
  } else {
    chart = (
      <SeriesChart
        {...common}
        data={data.slice(1)}
        ariaLabel="Tasa efectiva aplicada en cada cuota"
        xLabel={`Número de cuota (${units})`}
        yLabel="Tasa efectiva del período (%)"
        xTicks={periodTicks(n, 1)}
        yFormat={(v) => fmtPct(v, 2)}
        bands={bands}
        series={[
          { key: 'baseRate', label: 'Tasa original', color: BASE, dashed: true, width: 2, kind: 'step' },
          { key: 'rate', label: 'Tasa aplicada', color: palette.series[7], kind: 'step' },
        ]}
      />
    );
    legend = [
      { label: 'Tasa aplicada', color: palette.series[7], line: true },
      { label: 'Tasa original', color: BASE, line: true, dashed: true },
    ];
  }
  legend.push(...[...new Set(modified.segments.map((s) => s.system))].map((s) => ({ label: `Tramo ${SYSTEM_LABELS[s]}`, color: sysColor(s) })));

  return (
    <Workbench
      onReset={resetAll}
      controlsTitle="Préstamo y modificaciones"
      controls={
        <>
          <SelectField
            label="Escenario de ejemplo"
            value={preset}
            options={LAB_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(id) => {
              const p = LAB_PRESETS.find((x) => x.id === id)!;
              setPreset(id);
              setEvents(p.events());
              patch({ ...LOAN_DEFAULTS, system: 'frances', k: state.k, ...(p.loan ?? {}) } as Partial<typeof state>);
            }}
          />
          <SelectField
            label="Sistema original"
            value={state.system}
            options={SYSTEMS.map((s) => ({ value: s, label: SYSTEM_LABELS[s] }))}
            onChange={(v) => set('system', v)}
          />
          <div className="group">
            <p className="group-title">Modificaciones durante el préstamo</p>
            <EventEditor events={events} onChange={setEvents} maxPeriod={state.n} />
          </div>
          <div className="group">
            <p className="group-title">Operación original</p>
            <LoanForm state={state as unknown as LoanFormState} patch={(p) => patch(p as Partial<typeof state>)} showBulletMode={state.system === 'bullet'} />
          </div>
          <div className="group">
            <p className="group-title">Cuota seleccionada</p>
            <ParamControl
              label="Número de cuota"
              kind="int"
              value={k}
              min={1}
              max={modified.rows.length}
              hardMin={1}
              hardMax={modified.rows.length}
              onChange={(v) => set('k', v)}
            />
          </div>
        </>
      }
      chartTitle="Laboratorio: préstamo original frente a préstamo modificado"
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'cuotas', label: 'Cuotas por tramo' },
            { value: 'saldo', label: 'Saldo' },
            { value: 'intereses', label: 'Intereses acumulados' },
            { value: 'tasa', label: 'Tasa' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label={`Cuota ${k} (${SYSTEM_LABELS[row.system]})`} value={fmtMoney(row.payment)} big testId="kpi-cuota" />
          <Kpi label="Original" value={baseRow ? fmtMoney(baseRow.payment) : '—'} color={BASE} line />
          <Kpi label="Intereses: original" value={fmtMoney(base.totals.interest)} />
          <Kpi label="Intereses: modificado" value={fmtMoney(modified.totals.interest)} testId="kpi-intereses-mod" />
          <Kpi label={interestSaving >= 0 ? 'Ahorro de intereses' : 'Mayor costo de intereses'} value={fmtMoney(Math.abs(interestSaving))} />
          <Kpi label="Cuotas pagadas" value={`${modified.rows.length} de ${state.n}`} />
        </>
      }
      chart={chart}
      chartFooter={<Legend items={legend} />}
      panels={[
        {
          id: 'impacto',
          label: 'Impacto',
          content: (
            <div className="stack">
              {impacts.length === 0 && <p className="muted">Agregá una modificación para medir su efecto.</p>}
              {impacts.map((im) => (
                <div key={im.event.id} className="event-card">
                  <div className="event-card-head">{im.label}</div>
                  <div className="table-wrap">
                    <table className="data wrap">
                      <thead>
                        <tr>
                          <th className="left">Cuota {im.period}</th>
                          <th>Original</th>
                          <th>Modificado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['Saldo pendiente', 'opening'],
                            ['Cuota siguiente', 'payment'],
                            ['Amortización', 'amortization'],
                            ['Interés', 'interest'],
                          ] as const
                        ).map(([label, key]) => (
                          <tr key={key}>
                            <td className="left">{label}</td>
                            <td>{im.base ? fmtMoney(im.base[key]) : '—'}</td>
                            <td>{im.modified ? fmtMoney(im.modified[key]) : 'Cancelado'}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="left">Intereses futuros (desde esta cuota)</td>
                          <td>{fmtMoney(im.futureInterestBase)}</td>
                          <td>{fmtMoney(im.futureInterestModified)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {impacts.some((x) => x.event.type === 'tasa') && (
                <p className="small muted">
                  Tasas vigentes: {modified.rateSegments.map((s) => `cuotas ${s.from}–${s.to}: ${describeRate(s.spec)}`).join(' · ')}
                </p>
              )}
            </div>
          ),
        },
        { id: 'desarrollo', label: `Cuota ${k}`, content: <StepList steps={pasosCuota(modified, k)} /> },
        {
          id: 'cuadro',
          label: 'Cuadro',
          content: (
            <ScheduleTable
              result={modified}
              selected={k}
              onSelect={(p) => set('k', p)}
              filename="laboratorio-prestamo"
              extraTables={[scheduleTable(base, 'Préstamo original')]}
            />
          ),
        },
        {
          id: 'verificacion',
          label: 'Verificación',
          content: (
            <>
              <ChecksList checks={checks} />
              {modified.notes.length > 0 && (
                <Callout kind="neutral" title="Notas del cálculo">
                  <ul>
                    {modified.notes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </Callout>
              )}
            </>
          ),
        },
        { id: 'logica', label: 'Lógica', content: <LogicaLaboratorio /> },
      ]}
    />
  );
}
