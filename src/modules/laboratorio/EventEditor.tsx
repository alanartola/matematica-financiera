/**
 * Editor de modificaciones de un préstamo: cambios de sistema, de tasa y pagos
 * extraordinarios. Admite cualquier cantidad de modificaciones.
 */
import { SYSTEM_LABELS, SYSTEMS, type AmortSystem } from '../../engine';
import { newId, type LabEvent, type LabEventType } from '../../simulation/lab';
import { NumberInput, SelectField } from '../../ui/controls';
import { FREQ_OPTIONS, RATE_KIND_OPTIONS } from '../../ui/rateInput';
import { Icon } from '../../ui/icons';

const TYPE_LABELS: Record<LabEventType, string> = {
  sistema: 'Cambio de sistema',
  tasa: 'Cambio de tasa',
  prepago: 'Pago extraordinario',
};

const SYSTEM_OPTIONS = SYSTEMS.map((s) => ({ value: s, label: SYSTEM_LABELS[s] }));

export function EventEditor({ events, onChange, maxPeriod }: { events: LabEvent[]; onChange: (events: LabEvent[]) => void; maxPeriod: number }) {
  const update = (id: string, patch: Partial<LabEvent>) => onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(events.filter((e) => e.id !== id));
  const add = (type: LabEventType) => {
    const last = Math.max(1, ...events.map((e) => e.period));
    const period = Math.min(maxPeriod, last + 6);
    const ev: LabEvent =
      type === 'sistema'
        ? { id: newId(), type, period, system: 'aleman' }
        : type === 'tasa'
          ? { id: newId(), type, period, rate: { kind: 'TNA', value: 0.4, m: 12 } }
          : { id: newId(), type, period, amount: 1_000_000, mode: 'reducir-cuota' };
    onChange([...events, ev]);
  };
  const sorted = [...events].sort((a, b) => a.period - b.period);

  return (
    <div className="stack" data-testid="editor-modificaciones">
      {sorted.length === 0 && <p className="small muted">Sin modificaciones: el préstamo sigue las condiciones originales.</p>}
      {sorted.map((e) => (
        <div className="event-card" key={e.id}>
          <div className="event-card-head">
            <span>{TYPE_LABELS[e.type]}</span>
            <button type="button" className="btn small ghost" onClick={() => remove(e.id)} aria-label="Eliminar modificación" title="Eliminar">
              <Icon name="trash" />
            </button>
          </div>
          <div className="inline-fields">
            <label className="field">
              <span className="field-help">{e.type === 'prepago' ? 'Junto con la cuota' : 'Desde la cuota'}</span>
              <NumberInput
                ariaLabel={e.type === 'prepago' ? 'Cuota del pago extraordinario' : 'Cuota desde la que rige'}
                kind="int"
                value={e.period}
                min={e.type === 'prepago' ? 1 : 1}
                max={e.type === 'prepago' ? maxPeriod - 1 : maxPeriod}
                onChange={(v) => update(e.id, { period: v })}
              />
            </label>
            {e.type === 'sistema' && (
              <label className="field">
                <span className="field-help">Nuevo sistema</span>
                <select
                  className="select"
                  value={e.system}
                  onChange={(x) => update(e.id, { system: x.target.value as AmortSystem })}
                  aria-label="Nuevo sistema"
                >
                  {SYSTEM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {e.type === 'prepago' && (
              <label className="field">
                <span className="field-help">Importe</span>
                <NumberInput
                  ariaLabel="Importe del pago extraordinario"
                  kind="money"
                  value={e.amount ?? 0}
                  min={0}
                  onChange={(v) => update(e.id, { amount: v })}
                />
              </label>
            )}
            {e.type === 'tasa' && e.rate && (
              <label className="field">
                <span className="field-help">Valor</span>
                <NumberInput
                  ariaLabel="Nueva tasa"
                  kind="percent"
                  value={e.rate.value}
                  min={0}
                  max={10}
                  onChange={(v) => update(e.id, { rate: { ...e.rate!, value: v } })}
                />
              </label>
            )}
          </div>
          {e.type === 'sistema' && e.system === 'bullet' && (
            <SelectField
              label="Intereses del tramo Bullet"
              value={e.bulletMode ?? 'compuesto'}
              options={[
                { value: 'compuesto', label: 'Compuesto capitalizado' },
                { value: 'simple', label: 'Simple acumulado' },
              ]}
              onChange={(v) => update(e.id, { bulletMode: v as 'compuesto' | 'simple' })}
            />
          )}
          {e.type === 'tasa' && e.rate && (
            <div className="inline-fields">
              <select
                className="select"
                aria-label="Tipo de tasa"
                value={e.rate.kind}
                onChange={(x) => {
                  const kind = x.target.value as 'TNA' | 'TEA' | 'TEP';
                  const v = e.rate!.value;
                  update(e.id, { rate: kind === 'TNA' ? { kind, value: v, m: 12 } : kind === 'TEA' ? { kind, value: v } : { kind, value: v, perYear: 12 } });
                }}
              >
                {RATE_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === 'TEP' ? 'Efectiva del período' : o.value}
                  </option>
                ))}
              </select>
              {e.rate.kind !== 'TEA' && (
                <select
                  className="select"
                  aria-label={e.rate.kind === 'TNA' ? 'Capitalización' : 'Período de la tasa'}
                  value={e.rate.kind === 'TNA' ? e.rate.m : e.rate.perYear}
                  onChange={(x) => {
                    const m = Number(x.target.value);
                    update(e.id, { rate: e.rate!.kind === 'TNA' ? { ...e.rate!, m } : { kind: 'TEP', value: e.rate!.value, perYear: m } });
                  }}
                >
                  {FREQ_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {e.type === 'prepago' && (
            <select
              className="select"
              aria-label="Efecto del pago extraordinario"
              value={e.mode}
              onChange={(x) => update(e.id, { mode: x.target.value as LabEvent['mode'] })}
            >
              <option value="reducir-cuota">Reducir el importe de las cuotas</option>
              <option value="reducir-plazo">Reducir el plazo (mantener la cuota)</option>
            </select>
          )}
        </div>
      ))}
      <div className="btn-row">
        <button type="button" className="btn small" onClick={() => add('sistema')}>
          <Icon name="plus" /> Sistema
        </button>
        <button type="button" className="btn small" onClick={() => add('tasa')}>
          <Icon name="plus" /> Tasa
        </button>
        <button type="button" className="btn small" onClick={() => add('prepago')}>
          <Icon name="plus" /> Pago extra
        </button>
      </div>
    </div>
  );
}
