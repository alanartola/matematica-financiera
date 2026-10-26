/**
 * Formulario común de una operación de préstamo (capital, tasa, cuotas,
 * periodicidad, convención de intereses y redondeo).
 */
import { MONTHLY_FREQUENCIES, frequencyByPerYear, periodicRate, toNum } from '../engine';
import { rateSpecFrom, specToState, type LoanFormState } from '../simulation/loans';
import { DateField, LabeledSegmented, ParamControl, SelectField } from './controls';
import { RateSpecInput } from './rateInput';
import { fmtNum, fmtPct } from './format';
import { Callout } from './layout';

export const PAYMENT_FREQ_OPTIONS = MONTHLY_FREQUENCIES.map((f) => ({ value: f.perYear, label: f.label.replace(/ \(\d+\)/, '') }));

export const CONVENTION_OPTIONS = [
  { value: 'uniforme', label: 'Períodos uniformes (tasa periódica)' },
  { value: 'ACT/365', label: 'Días efectivos — ACT/365' },
  { value: 'ACT/360', label: 'Días efectivos — ACT/360' },
  { value: '30/360', label: 'Días — 30/360 (europea)' },
];

export function LoanForm({
  state,
  patch,
  showBulletMode = false,
  compact = false,
}: {
  state: LoanFormState;
  patch: (p: Partial<LoanFormState>) => void;
  showBulletMode?: boolean;
  compact?: boolean;
}) {
  const spec = rateSpecFrom(state.rateKind, state.rateValue, state.rateM);
  const i = toNum(periodicRate(spec, state.p));
  const freq = frequencyByPerYear(state.p);
  const years = state.n / state.p;
  return (
    <>
      <ParamControl
        label="Capital original"
        kind="money"
        value={state.principal}
        min={0}
        max={100_000_000}
        step={100_000}
        onChange={(v) => patch({ principal: v })}
        testId="param-capital"
      />
      <RateSpecInput value={spec} onChange={(s) => patch(specToState(s))} testId="param-tasa" />
      <SelectField label="Frecuencia de pagos" value={state.p} options={PAYMENT_FREQ_OPTIONS} onChange={(p) => patch({ p })} />
      <ParamControl
        label="Número de cuotas (n)"
        kind="int"
        value={state.n}
        min={1}
        max={Math.max(120, Math.min(480, state.n))}
        hardMin={1}
        hardMax={1200}
        onChange={(v) => patch({ n: v })}
        help={`Plazo total: ${fmtNum(years, 2)} ${years === 1 ? 'año' : 'años'} (${fmtNum(state.n * (12 / state.p), 0)} meses).`}
        testId="param-n"
      />
      {showBulletMode && (
        <LabeledSegmented
          label="Intereses en el Bullet"
          value={state.bulletMode}
          onChange={(v) => patch({ bulletMode: v })}
          options={[
            { value: 'compuesto', label: 'Compuesto capitalizado' },
            { value: 'simple', label: 'Simple acumulado' },
          ]}
        />
      )}
      <Callout kind="info">
        Tasa efectiva {freq.adjective} utilizada: <strong data-testid="tasa-periodica">{fmtPct(i, 4)}</strong>
      </Callout>
      {!compact && (
        <div className="group">
          <p className="group-title">Convenciones</p>
          <SelectField
            label="Cálculo de intereses"
            value={state.convention}
            options={CONVENTION_OPTIONS}
            onChange={(v) => patch({ convention: v })}
            help={
              state.convention === 'uniforme'
                ? 'Interés = saldo × tasa efectiva del período.'
                : 'Interés = saldo × tasa × días / base. La cuota francesa se calcula con la tasa periódica y la última cuota ajusta.'
            }
          />
          {state.convention !== 'uniforme' && <DateField label="Fecha de desembolso" value={state.disbursement} onChange={(v) => patch({ disbursement: v })} />}
          <LabeledSegmented
            label="Redondeo"
            value={state.rounding}
            onChange={(v) => patch({ rounding: v })}
            options={[
              { value: 'centavos', label: 'A centavos' },
              { value: 'exacto', label: 'Sin redondeo' },
            ]}
            help={
              state.rounding === 'centavos' ? 'Cada importe se redondea a centavos; la última cuota absorbe la diferencia.' : 'Precisión completa en cada fila.'
            }
          />
        </div>
      )}
    </>
  );
}
