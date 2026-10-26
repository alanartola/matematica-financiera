/**
 * Ingreso de una tasa tal como la informa un contrato: TNA con su frecuencia de
 * capitalización, TEA o tasa efectiva de un período.
 */
import { FREQUENCIES, type RateSpec } from '../engine';
import { ParamControl, SelectField } from './controls';

export const RATE_KIND_OPTIONS = [
  { value: 'TNA' as const, label: 'TNA (tasa nominal anual)' },
  { value: 'TEA' as const, label: 'TEA (tasa efectiva anual)' },
  { value: 'TEP' as const, label: 'Tasa efectiva de un período' },
];

export const FREQ_OPTIONS = FREQUENCIES.map((f) => ({ value: f.perYear, label: f.label }));

export function RateSpecInput({
  value,
  onChange,
  label = 'Tasa',
  max = 1.5,
  testId,
}: {
  value: RateSpec;
  onChange: (spec: RateSpec) => void;
  label?: string;
  max?: number;
  testId?: string;
}) {
  const changeKind = (kind: RateSpec['kind']) => {
    if (kind === 'TNA') onChange({ kind, value: value.value, m: value.kind === 'TNA' ? value.m : 12 });
    else if (kind === 'TEA') onChange({ kind, value: value.value });
    else onChange({ kind, value: value.value, perYear: value.kind === 'TEP' ? value.perYear : 12 });
  };
  const sliderMax = value.kind === 'TEP' ? Math.max(0.2, max / Math.max(value.perYear, 1)) : max;
  return (
    <>
      <SelectField
        label={`${label}: tipo`}
        value={value.kind}
        options={RATE_KIND_OPTIONS}
        onChange={changeKind}
        testId={testId ? `${testId}-tipo` : undefined}
      />
      <ParamControl
        label={value.kind === 'TNA' ? 'TNA' : value.kind === 'TEA' ? 'TEA' : 'Tasa efectiva del período'}
        kind="percent"
        value={value.value}
        min={0}
        max={sliderMax}
        step={0.0005}
        onChange={(v) => onChange({ ...value, value: v })}
        testId={testId}
      />
      {value.kind === 'TNA' && (
        <SelectField
          label="Capitalización (m por año)"
          value={value.m}
          options={FREQ_OPTIONS}
          onChange={(m) => onChange({ ...value, m })}
          help="Cantidad de veces por año que los intereses se incorporan al capital."
        />
      )}
      {value.kind === 'TEP' && (
        <SelectField label="Período de la tasa" value={value.perYear} options={FREQ_OPTIONS} onChange={(perYear) => onChange({ ...value, perYear })} />
      )}
    </>
  );
}
