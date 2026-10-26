/**
 * Controles de parámetros: barra deslizante y campo numérico sincronizados.
 * El campo acepta importes exactos escritos con teclado (formato argentino) y
 * admite valores fuera del rango de la barra dentro de límites razonables.
 */
import { useId, useState, type ReactNode } from 'react';
import { fmtNum, parseNumberAR } from './format';

export type ParamKind = 'money' | 'percent' | 'int' | 'number';

export interface ParamControlProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  /** Rango de la barra (en unidades del valor; para porcentajes, en forma decimal). */
  min: number;
  max: number;
  step?: number;
  kind?: ParamKind;
  /** Sufijo visible (p. ej. "meses"). */
  unit?: string;
  help?: ReactNode;
  /** Límites admitidos al escribir con teclado. */
  hardMin?: number;
  hardMax?: number;
  /** Decimales mostrados en el campo. */
  decimals?: number;
  disabled?: boolean;
  testId?: string;
}

function toDisplay(value: number, kind: ParamKind): number {
  return kind === 'percent' ? value * 100 : value;
}

function fromDisplay(value: number, kind: ParamKind): number {
  // Se redondea para evitar artefactos binarios (3 / 100 = 0,030000000000000002).
  return kind === 'percent' ? Number((value / 100).toPrecision(12)) : value;
}

export function ParamControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  kind = 'number',
  unit,
  help,
  hardMin,
  hardMax,
  decimals,
  disabled,
  testId,
}: ParamControlProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dec = decimals ?? (kind === 'int' ? 0 : kind === 'percent' ? 4 : 2);
  const lo = hardMin ?? (kind === 'percent' ? Math.min(min, 0) : min);
  const hi = hardMax ?? (kind === 'int' ? Math.max(max, 1200) : kind === 'percent' ? Math.max(max, 10) : Math.max(max, max * 1000));
  const shown = toDisplay(value, kind);
  const sliderStep = step ?? (kind === 'int' ? 1 : kind === 'percent' ? 0.0001 : (max - min) / 1000);

  const commitText = (text: string) => {
    setDraft(text);
    const parsed = parseNumberAR(text);
    if (parsed === null) {
      setError('Ingresá un número válido.');
      return;
    }
    const v = fromDisplay(parsed, kind);
    if (kind === 'int' && !Number.isInteger(parsed)) {
      setError('Debe ser un número entero.');
      return;
    }
    if (v < lo || v > hi) {
      setError(`Valor admitido entre ${fmtNum(toDisplay(lo, kind), dec)} y ${fmtNum(toDisplay(hi, kind), dec)}.`);
      return;
    }
    setError(null);
    onChange(v);
  };

  return (
    <div className="field" data-testid={testId}>
      <div className="field-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      </div>
      <div className={`input-wrap${error ? ' invalid' : ''}`}>
        {kind === 'money' && <span className="affix">$</span>}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={draft ?? fmtNum(shown, dec)}
          onChange={(e) => commitText(e.target.value)}
          onFocus={(e) => {
            setDraft(fmtNum(shown, dec));
            requestAnimationFrame(() => e.target.select());
          }}
          onBlur={() => {
            setDraft(null);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-invalid={!!error}
        />
        {(kind === 'percent' || unit) && <span className="affix">{kind === 'percent' ? '%' : unit}</span>}
      </div>
      <input
        type="range"
        aria-label={typeof label === 'string' ? label : undefined}
        min={toDisplay(min, kind)}
        max={toDisplay(max, kind)}
        step={kind === 'percent' ? sliderStep * 100 : sliderStep}
        value={Math.min(Math.max(shown, toDisplay(min, kind)), toDisplay(max, kind))}
        disabled={disabled}
        onChange={(e) => {
          setDraft(null);
          setError(null);
          onChange(fromDisplay(Number(e.target.value), kind));
        }}
      />
      {error ? <span className="field-error">{error}</span> : help ? <span className="field-help">{help}</span> : null}
    </div>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  help,
  testId,
}: {
  label: ReactNode;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  help?: ReactNode;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="select"
        data-testid={testId}
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  full,
  ariaLabel,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  full?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={`segmented${full ? ' full' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LabeledSegmented<T extends string | number>(props: {
  label: ReactNode;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  help?: ReactNode;
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <Segmented value={props.value} options={props.options} onChange={props.onChange} full ariaLabel={typeof props.label === 'string' ? props.label : undefined} />
      {props.help && <span className="field-help">{props.help}</span>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, help }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; help?: ReactNode }) {
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

export function DateField({ label, value, onChange, help }: { label: ReactNode; value: string; onChange: (v: string) => void; help?: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap">
        <input id={id} type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} style={{ textAlign: 'left' }} />
      </div>
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, list }: { label: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; list?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap">
        <input id={id} value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} style={{ textAlign: 'left' }} />
      </div>
    </div>
  );
}

/** Campo numérico compacto sin barra (para tablas de flujos y listas de eventos). */
export function NumberInput({
  value,
  onChange,
  kind = 'number',
  ariaLabel,
  decimals,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  kind?: ParamKind;
  ariaLabel: string;
  decimals?: number;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const dec = decimals ?? (kind === 'int' ? 0 : kind === 'percent' ? 4 : 2);
  const shown = toDisplay(value, kind);
  return (
    <div className={`input-wrap${invalid ? ' invalid' : ''}`}>
      {kind === 'money' && <span className="affix">$</span>}
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={draft ?? fmtNum(shown, dec)}
        onFocus={(e) => {
          setDraft(fmtNum(shown, dec));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => {
          setDraft(null);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseNumberAR(e.target.value);
          const v = parsed === null ? null : fromDisplay(parsed, kind);
          const ok = v !== null && (kind !== 'int' || Number.isInteger(v)) && (min === undefined || v >= min) && (max === undefined || v <= max);
          setInvalid(!ok);
          if (ok) onChange(v!);
        }}
      />
      {kind === 'percent' && <span className="affix">%</span>}
    </div>
  );
}
