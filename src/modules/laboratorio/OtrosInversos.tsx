import { useMemo } from 'react';
import {
  buildSchedule,
  effectiveAnnual,
  frenchPayment,
  impliedRate,
  impliedTerm,
  outstandingBalance,
  periodicRate,
  principalFromPayment,
  annuityFactor,
  SYSTEM_LABELS,
  SYSTEMS,
  toNum,
  type AmortSystem,
} from '../../engine';
import { rateSpecFrom, specToState } from '../../simulation/loans';
import { SeriesChart } from '../../charts/SeriesChart';
import { ParamControl, SelectField } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { RateSpecInput } from '../../ui/rateInput';
import { PAYMENT_FREQ_OPTIONS } from '../../ui/LoanForm';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { FormulasInversos } from '../../content/laboratorio';
import type { PageProps } from '../registry';

type Unknown = 'tasa' | 'plazo' | 'saldo' | 'capital';

const DEFAULTS = {
  unknown: 'tasa' as string,
  system: 'frances' as string,
  principal: 10_000_000,
  n: 36,
  k: 12,
  payment: 458_037.94,
  rateKind: 'TNA' as string,
  rateValue: 0.36,
  rateM: 12,
  p: 12,
};

const PAYMENT_LABEL: Record<AmortSystem, string> = {
  frances: 'Cuota (constante)',
  aleman: 'Primera cuota',
  americano: 'Cuota de interés (intermedia)',
  bullet: 'Pago final',
};

/** Cuota "característica" de cada sistema: la que se informa en los cálculos inversos. */
function characteristicPayment(system: AmortSystem, principal: number, n: number, i: number): number {
  const rows = buildSchedule({ principal, periods: n, paymentsPerYear: 12, rate: { kind: 'TEP', value: i, perYear: 12 }, system, rounding: 'exacto' }).rows;
  return system === 'bullet' ? rows[rows.length - 1].payment : rows[0].payment;
}

export default function OtrosInversos({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const unknown = state.unknown as Unknown;
  const system = state.system as AmortSystem;
  const spec = rateSpecFrom(state.rateKind, state.rateValue, state.rateM);
  const i = toNum(periodicRate(spec, state.p));
  const A = palette.series[0];
  const B = palette.series[1];

  const calc = useMemo(() => {
    switch (unknown) {
      case 'tasa':
        return impliedRate(system, state.principal, state.n, state.payment);
      case 'plazo':
        return impliedTerm(system, state.principal, i, state.payment);
      case 'saldo':
        return outstandingBalance(system, state.principal, i, state.n, Math.min(state.k, state.n), state.p);
      case 'capital':
        return principalFromPayment(system, state.payment, i, state.n);
    }
  }, [unknown, system, state.principal, state.n, state.payment, i, state.k, state.p]);

  // Gráfico: la incógnita como intersección de una curva con el dato conocido.
  const chart = useMemo(() => {
    if (unknown === 'tasa') {
      const top = Math.max(0.02, (calc.value ?? 0.05) * 2.2);
      const data = Array.from({ length: 81 }, (_, k) => {
        const r = (top * k) / 80;
        return { x: r, cuota: characteristicPayment(system, state.principal, state.n, r) };
      });
      return {
        data,
        xLabel: 'Tasa periódica (%)',
        yLabel: `${PAYMENT_LABEL[system]} ($)`,
        xFormat: (v: number) => fmtPct(v, 1),
        y: state.payment,
        label: 'Cuota según la tasa',
      };
    }
    if (unknown === 'plazo') {
      const maxN = Math.max(12, Math.ceil((calc.value ?? state.n) * 1.6));
      const data = Array.from({ length: maxN }, (_, k) => ({ x: k + 1, cuota: characteristicPayment(system, state.principal, k + 1, i) }));
      return {
        data,
        xLabel: 'Cantidad de cuotas (n)',
        yLabel: `${PAYMENT_LABEL[system]} ($)`,
        xFormat: (v: number) => fmtNum(v, 0),
        y: state.payment,
        label: 'Cuota según el plazo',
      };
    }
    if (unknown === 'saldo') {
      const rows = buildSchedule({
        principal: state.principal,
        periods: state.n,
        paymentsPerYear: state.p,
        rate: { kind: 'TEP', value: i, perYear: state.p },
        system,
      }).rows;
      const data = [{ x: 0, cuota: state.principal }, ...rows.map((r) => ({ x: r.period, cuota: r.closingPrincipal + r.closingAccrued }))];
      return { data, xLabel: 'Cuotas pagadas', yLabel: 'Saldo pendiente ($)', xFormat: (v: number) => fmtNum(v, 0), y: undefined, label: 'Saldo pendiente' };
    }
    const data = Array.from({ length: Math.max(state.n * 2, 24) }, (_, k) => ({
      x: k + 1,
      cuota: principalFromPayment(system, state.payment, i, k + 1).value ?? 0,
    }));
    return {
      data,
      xLabel: 'Cantidad de cuotas (n)',
      yLabel: 'Capital financiable ($)',
      xFormat: (v: number) => fmtNum(v, 0),
      y: undefined,
      label: 'Capital según el plazo',
    };
  }, [unknown, system, state.principal, state.n, state.payment, state.p, i, calc.value]);

  const point =
    calc.ok && calc.value !== null
      ? unknown === 'tasa'
        ? { x: calc.value, y: state.payment }
        : unknown === 'plazo'
          ? { x: calc.value, y: state.payment }
          : unknown === 'saldo'
            ? { x: Math.min(state.k, state.n), y: calc.value }
            : { x: state.n, y: calc.value }
      : null;

  const frenchRate = unknown === 'tasa' && system === 'frances';
  const steps: Step[] = frenchRate ? [] : [{ title: 'Fórmula utilizada', body: calc.message }];
  if (calc.ok && calc.value !== null) {
    if (unknown === 'tasa') {
      if (system === 'frances') {
        steps.push({
          title: 'Ecuación a resolver',
          math: `${texMoney(state.principal)} \\cdot \\frac{i}{1-(1+i)^{-${state.n}}} = ${texMoney(state.payment)}`,
          body: <>No tiene solución algebraica: se resuelve con el método de Newton-Raphson, acotado por bisección.</>,
        });
        steps.push({
          title: 'Iteraciones',
          body: (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Iteración</th>
                    <th>Tasa</th>
                    <th>Cuota(i) − cuota</th>
                  </tr>
                </thead>
                <tbody>
                  {(calc.log ?? []).map((l) => (
                    <tr key={l.iteration}>
                      <td>{l.iteration}</td>
                      <td>{fmtPct(l.rate, 8)}</td>
                      <td>{fmtNum(l.value, 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        });
      }
      const annual = toNum(effectiveAnnual({ kind: 'TEP', value: calc.value, perYear: state.p }));
      steps.push({
        title: 'Resultado y anualización',
        body: frenchRate ? <>{calc.message}</> : undefined,
        math: [
          `i = ${texRate(calc.value, 8)}`,
          `\\text{TNA} = i \\cdot ${state.p} = ${texNum(calc.value * state.p * 100, 4)}\\,\\% \\qquad \\text{TEA} = (1+i)^{${state.p}} - 1 = ${texNum(annual * 100, 4)}\\,\\%`,
        ],
      });
    } else if (unknown === 'plazo') {
      steps.push({
        title: 'Resultado',
        math: `n = ${texNum(calc.value, 6)}`,
        body:
          calc.value % 1 > 1e-6 ? (
            <>
              El resultado no es entero: con {Math.floor(calc.value)} cuotas completas de {fmtMoney(state.payment)} la deuda no se cancela; hace falta una cuota
              adicional menor (total {Math.ceil(calc.value)} cuotas).
            </>
          ) : undefined,
      });
    } else if (unknown === 'capital' && system === 'frances') {
      steps.push({
        title: 'Sustitución',
        math: `P = ${texMoney(state.payment)} \\times ${texNum(toNum(annuityFactor(i, state.n)), 8, 4)} = ${texMoney(calc.value)}`,
      });
      steps.push({ title: 'Comprobación', math: `c = ${texMoney(toNum(frenchPayment(calc.value, i, state.n)))}` });
    } else {
      steps.push({ title: 'Resultado', math: unknown === 'saldo' ? `S_{${state.k}} = ${texMoney(calc.value)}` : `P = ${texMoney(calc.value)}` });
    }
  }

  const resultLabel = {
    tasa: 'Tasa periódica implícita',
    plazo: 'Cantidad de cuotas',
    saldo: `Saldo luego de la cuota ${Math.min(state.k, state.n)}`,
    capital: 'Capital financiado',
  }[unknown];
  const resultValue =
    !calc.ok || calc.value === null
      ? 'Sin solución'
      : unknown === 'tasa'
        ? fmtPct(calc.value, 4)
        : unknown === 'plazo'
          ? fmtNum(calc.value, 4)
          : fmtMoney(calc.value);

  return (
    <Workbench
      onReset={reset}
      controlsTitle="Cálculo inverso"
      controls={
        <>
          <SelectField
            label="¿Qué se quiere calcular?"
            value={state.unknown}
            options={[
              { value: 'tasa', label: 'Tasa implícita' },
              { value: 'plazo', label: 'Plazo (cantidad de cuotas)' },
              { value: 'saldo', label: 'Saldo pendiente' },
              { value: 'capital', label: 'Capital a partir de una cuota' },
            ]}
            onChange={(v) => set('unknown', v)}
          />
          <SelectField
            label="Sistema"
            value={state.system}
            options={SYSTEMS.map((s) => ({ value: s, label: SYSTEM_LABELS[s] }))}
            onChange={(v) => set('system', v)}
          />
          {unknown !== 'capital' && (
            <ParamControl label="Capital" kind="money" value={state.principal} min={0} max={100_000_000} step={100_000} onChange={(v) => set('principal', v)} />
          )}
          {(unknown === 'tasa' || unknown === 'plazo' || unknown === 'capital') && (
            <ParamControl
              label={PAYMENT_LABEL[system]}
              kind="money"
              value={state.payment}
              min={0}
              max={5_000_000}
              step={1_000}
              onChange={(v) => set('payment', v)}
            />
          )}
          {unknown !== 'plazo' && <ParamControl label="Número de cuotas (n)" kind="int" value={state.n} min={1} max={480} onChange={(v) => set('n', v)} />}
          {unknown === 'saldo' && (
            <ParamControl
              label="Cuotas pagadas (k)"
              kind="int"
              value={Math.min(state.k, state.n)}
              min={0}
              max={state.n}
              hardMax={state.n}
              onChange={(v) => set('k', v)}
            />
          )}
          {unknown !== 'tasa' && <RateSpecInput value={spec} onChange={(s) => patch(specToState(s) as Partial<typeof state>)} />}
          <SelectField label="Frecuencia de pagos" value={state.p} options={PAYMENT_FREQ_OPTIONS} onChange={(v) => set('p', v)} />
          <button
            type="button"
            className="btn small"
            style={{ whiteSpace: 'normal' }}
            onClick={() => patch({ principal: 10_000_000, n: 36, payment: 458_037.94, system: 'frances', unknown: 'tasa' })}
          >
            Ejemplo: $ 10.000.000 en 36 cuotas de $ 458.037,94
          </button>
        </>
      }
      chartTitle={chart.label}
      kpis={
        <>
          <Kpi label={resultLabel} value={resultValue} big testId="kpi-resultado" />
          {unknown === 'tasa' && calc.ok && calc.value !== null && (
            <>
              <Kpi label="TNA equivalente" value={fmtPct(calc.value * state.p, 4)} />
              <Kpi label="TEA equivalente" value={fmtPct(toNum(effectiveAnnual({ kind: 'TEP', value: calc.value, perYear: state.p })), 4)} />
            </>
          )}
          {unknown !== 'tasa' && <Kpi label="Tasa periódica utilizada" value={fmtPct(i, 4)} />}
        </>
      }
      chart={
        <SeriesChart
          ariaLabel={chart.label}
          data={chart.data}
          xKey="x"
          xLabel={chart.xLabel}
          yLabel={chart.yLabel}
          xFormat={chart.xFormat}
          series={[{ key: 'cuota', label: chart.label, color: A }]}
          refLines={[
            ...(chart.y !== undefined ? [{ y: chart.y, label: `Dato: ${fmtMoney(chart.y)}`, color: palette.neutral }] : []),
            ...(point ? [{ x: point.x, color: B }] : []),
          ]}
          points={point ? [{ x: point.x, y: point.y, color: B, label: resultValue }] : []}
          tooltip={(r) => ({ title: chart.xFormat(r.x), rows: [{ label: chart.label, value: fmtMoney(r.cuota), color: A, line: true }] })}
        />
      }
      chartFooter={
        <Legend
          items={[
            { label: chart.label, color: A, line: true },
            ...(chart.y !== undefined ? [{ label: 'Dato conocido', color: palette.neutral, line: true, dashed: true }] : []),
            { label: 'Solución', color: B },
          ]}
        />
      }
      panels={[
        {
          id: 'desarrollo',
          label: 'Desarrollo',
          content: (
            <>
              {!calc.ok && (
                <Callout kind="danger" title="Sin solución">
                  {calc.message}
                </Callout>
              )}
              <StepList steps={steps} />
            </>
          ),
        },
        { id: 'formulas', label: 'Fórmulas', content: <FormulasInversos /> },
      ]}
    />
  );
}
