import { useMemo, useState } from 'react';
import { buildSchedule, reconstructPrincipal, SYSTEM_LABELS, SYSTEMS, type AmortSystem, type BulletMode, type InverseCapitalResult } from '../../engine';
import { chartRows, LOAN_DEFAULTS, loanInputFrom, rateSpecFrom, specToState } from '../../simulation/loans';
import { SeriesChart } from '../../charts/SeriesChart';
import { LabeledSegmented, NumberInput, ParamControl, Segmented, SelectField, Toggle } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Tex, Workbench, type Step } from '../../ui/layout';
import { RateSpecInput } from '../../ui/rateInput';
import { PAYMENT_FREQ_OPTIONS } from '../../ui/LoanForm';
import { ScheduleTable } from '../../ui/ScheduleTable';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { ExplicacionCapitalOriginal } from '../../content/laboratorio';
import type { PageProps } from '../registry';

// Cuotas de ejemplo: últimas tres cuotas de un préstamo francés de $ 10.000.000, 36 cuotas, TNA 36 %.
const EXAMPLE = buildSchedule(loanInputFrom(LOAN_DEFAULTS, 'frances'))
  .rows.slice(33)
  .map((r) => r.payment);

const DEFAULTS = {
  system: 'frances' as string,
  bulletMode: 'compuesto' as string,
  rateKind: 'TNA' as string,
  rateValue: 0.36,
  rateM: 12,
  p: 12,
  c1: EXAMPLE[0],
  c2: EXAMPLE[1],
  c3: EXAMPLE[2],
  positionMode: 'ultimas' as string,
  firstPosition: 34,
  knowN: true as boolean,
  n: 36,
  iva: 0,
  insurance: 0,
  fee: 0,
  charges: false as boolean,
  tolerance: 1,
};

const STATUS_TEXT: Record<InverseCapitalResult['status'], { kind: 'ok' | 'warn' | 'danger' | 'info'; title: string }> = {
  unica: { kind: 'ok', title: 'Solución única' },
  'capital-unico': { kind: 'ok', title: 'Capital identificado (el plazo no)' },
  multiples: { kind: 'warn', title: 'Múltiples soluciones compatibles: falta información' },
  'sin-solucion': { kind: 'danger', title: 'Ninguna operación compatible con los datos' },
  'datos-insuficientes': { kind: 'warn', title: 'Datos insuficientes' },
};

export default function CapitalOriginal({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [chartMode, setChartMode] = useState<'verificacion' | 'cuadro'>('verificacion');
  const spec = rateSpecFrom(state.rateKind, state.rateValue, state.rateM);

  const result = useMemo(
    () =>
      reconstructPrincipal({
        system: state.system as AmortSystem,
        bulletMode: state.bulletMode as BulletMode,
        rate: spec,
        paymentsPerYear: state.p,
        payments: [state.c1, state.c2, state.c3],
        positionMode: state.positionMode as 'ultimas' | 'absoluta',
        firstPosition: state.firstPosition,
        totalPeriods: state.knowN ? state.n : null,
        charges: state.charges ? { ivaOnInterest: state.iva, insuranceOnBalance: state.insurance, fixedFee: state.fee } : undefined,
        tolerance: state.tolerance,
      }),
    [state],
  );
  const status = STATUS_TEXT[result.status];
  const K = palette.series[0];
  const R = palette.series[1];

  // Gráfico: cuotas ingresadas frente a reconstruidas (o cuadro completo).
  const verifData = result.verification.length
    ? result.verification.map((v) => ({ x: `Cuota ${v.position}`, ingresada: v.entered, reconstruida: v.reconstructed, diff: v.difference }))
    : [state.c1, state.c2, state.c3].map((c, k) => ({ x: `Cuota conocida ${k + 1}`, ingresada: c, reconstruida: 0, diff: 0 }));
  const scheduleData = result.schedule ? chartRows(result.schedule).slice(1) : [];
  const knownPositions = new Set(result.verification.map((v) => v.position));

  const steps: Step[] = [
    {
      title: '1. Datos conocidos',
      body: (
        <>
          Sistema {SYSTEM_LABELS[state.system as AmortSystem]}, tasa periódica {fmtPct(result.periodicRate, 4)}, cuotas {fmtMoney(state.c1)},{' '}
          {fmtMoney(state.c2)} y {fmtMoney(state.c3)} (
          {state.positionMode === 'ultimas' ? 'últimas cuotas' : `posiciones ${state.firstPosition} a ${state.firstPosition + 2}`}).{' '}
          {state.knowN ? `Número total de cuotas: ${state.n}.` : 'Número total de cuotas: desconocido.'}
        </>
      ),
    },
    {
      title: '2. Planteo',
      body: <>Para cada n posible, la cuota k es lineal en el capital:</>,
      math: 'c_k = P \\cdot g_k(n,i) + f \\qquad \\hat P = \\dfrac{\\sum g_k (c_k - f)}{\\sum g_k^2}',
    },
    {
      title: '3. Análisis de unicidad',
      body: (
        <ul style={{ margin: 0 }}>
          {result.explanation.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ),
    },
  ];
  if (result.principal !== null && result.estimatedPrincipal !== null) {
    const best = result.compatible[0];
    steps.push({
      title: '4. Resolución',
      math: [
        `\\hat P = ${texMoney(result.estimatedPrincipal)}`,
        ...(best
          ? [
              `g = (${best.positions.map((_, idx) => texNum((best.fitted[idx] - (state.charges ? state.fee : 0)) / (best.principal || 1), 8, 4)).join(';\\; ')})`,
            ]
          : []),
        `P = ${texMoney(result.principal)}`,
      ],
    });
    steps.push({
      title: '5. Verificación',
      body: <>Se reconstruye el cuadro completo con el motor (redondeo a centavos) y se comparan las cuotas.</>,
      math: result.verification.map((v) => `c_{${v.position}}: \\; ${texMoney(v.entered)} \\;\\text{vs}\\; ${texMoney(v.reconstructed)}`),
    });
  }

  return (
    <Workbench
      onReset={reset}
      controlsTitle="Datos conocidos"
      controls={
        <>
          <SelectField
            label="Sistema de amortización"
            value={state.system}
            options={SYSTEMS.map((s) => ({ value: s, label: SYSTEM_LABELS[s] }))}
            onChange={(v) => set('system', v)}
          />
          {state.system === 'bullet' && (
            <LabeledSegmented
              label="Intereses del Bullet"
              value={state.bulletMode}
              onChange={(v) => set('bulletMode', v)}
              options={[
                { value: 'compuesto', label: 'Compuesto' },
                { value: 'simple', label: 'Simple' },
              ]}
            />
          )}
          <RateSpecInput value={spec} onChange={(s) => patch(specToState(s) as Partial<typeof state>)} />
          <SelectField label="Frecuencia de pagos" value={state.p} options={PAYMENT_FREQ_OPTIONS} onChange={(v) => set('p', v)} />
          <div className="group">
            <p className="group-title">Cuotas conocidas (consecutivas)</p>
            {(['c1', 'c2', 'c3'] as const).map((key, idx) => (
              <label className="field" key={key}>
                <span className="field-label">
                  {state.positionMode === 'ultimas'
                    ? ['Antepenúltima cuota', 'Penúltima cuota', 'Última cuota'][idx]
                    : `Cuota N.º ${state.firstPosition + idx}`}
                </span>
                <NumberInput ariaLabel={`Cuota conocida ${idx + 1}`} kind="money" value={state[key]} min={0} onChange={(v) => set(key, v)} />
              </label>
            ))}
            <LabeledSegmented
              label="Posición de las cuotas"
              value={state.positionMode}
              onChange={(v) => set('positionMode', v)}
              options={[
                { value: 'ultimas', label: 'Son las últimas' },
                { value: 'absoluta', label: 'Posición conocida' },
              ]}
            />
            {state.positionMode === 'absoluta' && (
              <ParamControl
                label="N.º de la primera cuota conocida"
                kind="int"
                value={state.firstPosition}
                min={1}
                max={480}
                onChange={(v) => set('firstPosition', v)}
              />
            )}
            <Toggle label="Conozco el número total de cuotas" checked={state.knowN} onChange={(v) => set('knowN', v)} />
            {state.knowN && <ParamControl label="Número total de cuotas (n)" kind="int" value={state.n} min={1} max={480} onChange={(v) => set('n', v)} />}
          </div>
          <div className="group">
            <p className="group-title">Otras condiciones contractuales</p>
            <Toggle label="Las cuotas incluyen IVA, seguros o cargos" checked={state.charges} onChange={(v) => set('charges', v)} />
            {state.charges && (
              <>
                <ParamControl label="IVA sobre intereses" kind="percent" value={state.iva} min={0} max={0.27} step={0.005} onChange={(v) => set('iva', v)} />
                <ParamControl
                  label="Seguro sobre saldo (por período)"
                  kind="percent"
                  value={state.insurance}
                  min={0}
                  max={0.01}
                  step={0.0001}
                  decimals={4}
                  onChange={(v) => set('insurance', v)}
                />
                <ParamControl label="Cargo fijo por cuota" kind="money" value={state.fee} min={0} max={50_000} step={100} onChange={(v) => set('fee', v)} />
              </>
            )}
            <ParamControl
              label="Tolerancia por cuota"
              kind="money"
              value={state.tolerance}
              min={0.01}
              max={100}
              step={0.01}
              onChange={(v) => set('tolerance', v)}
              help="Diferencia máxima admitida entre cuota ingresada y reconstruida (redondeos de la entidad)."
            />
          </div>
        </>
      }
      chartTitle="Reconstrucción del capital original"
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={chartMode}
          onChange={setChartMode}
          options={[
            { value: 'verificacion', label: 'Verificación' },
            { value: 'cuadro', label: 'Operación reconstruida' },
          ]}
        />
      }
      kpis={
        <>
          <Kpi label="Estado" value={status.title} />
          <Kpi label="Capital original" value={result.principal !== null ? fmtMoney(result.principal) : 'No identificable'} big testId="kpi-capital" />
          <Kpi label="Número de cuotas" value={result.n !== null ? fmtNum(result.n) : result.status === 'capital-unico' ? 'No identificable' : '—'} />
          <Kpi label="Tasa periódica" value={fmtPct(result.periodicRate, 4)} />
        </>
      }
      chart={
        chartMode === 'verificacion' || !result.schedule ? (
          <SeriesChart
            ariaLabel="Cuotas ingresadas frente a cuotas reconstruidas"
            data={verifData}
            xKey="x"
            xLabel="Cuotas conocidas"
            yLabel="Importe de la cuota ($)"
            series={[
              { key: 'ingresada', label: 'Cuota ingresada', color: K, kind: 'bar' },
              { key: 'reconstruida', label: 'Cuota reconstruida', color: R, kind: 'bar' },
            ]}
            tooltip={(r) => ({
              title: r.x,
              rows: [
                { label: 'Ingresada', value: fmtMoney(r.ingresada), color: K },
                { label: 'Reconstruida', value: r.reconstruida ? fmtMoney(r.reconstruida) : '—', color: R },
                { label: 'Diferencia', value: fmtMoney(r.diff), strong: true },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Cuadro de la operación reconstruida"
            data={scheduleData.map((r) => ({ ...r, conocida: knownPositions.has(r.t) ? r.payment : 0, resto: knownPositions.has(r.t) ? 0 : r.payment }))}
            xKey="t"
            xLabel="Número de cuota"
            yLabel="Cuota ($)"
            series={[
              { key: 'resto', label: 'Cuotas reconstruidas', color: K, kind: 'bar', stack: 'a' },
              { key: 'conocida', label: 'Cuotas conocidas', color: R, kind: 'bar', stack: 'a', top: true },
            ]}
            tooltip={(r) => ({
              title: `Cuota ${r.t}`,
              rows: [
                { label: 'Cuota', value: fmtMoney(r.payment), strong: true },
                { label: 'Saldo final', value: fmtMoney(r.debt) },
              ],
            })}
          />
        )
      }
      chartFooter={
        <Legend
          items={
            chartMode === 'verificacion' || !result.schedule
              ? [
                  { label: 'Cuota ingresada', color: K },
                  { label: 'Cuota reconstruida con el capital hallado', color: R },
                ]
              : [
                  { label: 'Cuotas reconstruidas', color: K },
                  { label: 'Cuotas conocidas', color: R },
                ]
          }
        />
      }
      panels={[
        {
          id: 'resultado',
          label: 'Resultado',
          content: (
            <div className="stack" data-testid="resultado-inverso">
              <Callout kind={status.kind} title={status.title}>
                <ul>
                  {result.explanation.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </Callout>
              {result.missing.length > 0 && (
                <Callout kind="warn" title="Dato adicional indispensable">
                  <ul>
                    {result.missing.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              {result.impliedRate !== null && (
                <Callout kind="info" title="Tasa implícita en las cuotas">
                  En el sistema alemán, <Tex math="c_{k} - c_{k+1} = A\cdot i" /> y <Tex math="c_n = A(1+i)" />: las cuotas ingresadas implican una tasa
                  periódica de <strong>{fmtPct(result.impliedRate, 4)}</strong>.
                </Callout>
              )}
              {result.discrepancies.length > 0 && (
                <Callout kind="danger" title="Posibles causas de la discrepancia">
                  <ul>
                    {result.discrepancies.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              {result.status === 'multiples' && result.compatible.length > 0 && (
                <div className="table-wrap" style={{ maxHeight: 220 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>n posible</th>
                        <th>Capital compatible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.compatible.slice(0, 60).map((c) => (
                        <tr key={c.n}>
                          <td>{c.n}</td>
                          <td>{fmtMoney(c.principal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.verification.length > 0 && (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Cuota</th>
                        <th>Ingresada</th>
                        <th>Reconstruida</th>
                        <th>Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.verification.map((v) => (
                        <tr key={v.position}>
                          <td>{v.position}</td>
                          <td>{fmtMoney(v.entered)}</td>
                          <td>{fmtMoney(v.reconstructed)}</td>
                          <td>{fmtMoney(v.difference)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ),
        },
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        { id: 'metodo', label: 'Método', content: <ExplicacionCapitalOriginal /> },
        ...(result.schedule
          ? [{ id: 'cuadro', label: 'Cuadro reconstruido', content: <ScheduleTable result={result.schedule} filename="operacion-reconstruida" /> }]
          : []),
      ]}
    />
  );
}
