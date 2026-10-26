/**
 * Edición de flujos de fondos: por período (t) o por fecha.
 */
import { NumberInput } from './controls';
import { Icon } from './icons';

export interface EditableFlow {
  id: string;
  t: number;
  date: string;
  amount: number;
}

let seq = 0;
export const flowId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

export function makeFlows(list: [number, number][], baseDate = '2026-01-01', monthsPerPeriod = 1): EditableFlow[] {
  return list.map(([t, amount]) => {
    const d = new Date(baseDate + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + Math.round(t * monthsPerPeriod));
    return { id: flowId(), t, amount, date: d.toISOString().slice(0, 10) };
  });
}

export function FlowsEditor({
  flows,
  onChange,
  mode,
  unit,
}: {
  flows: EditableFlow[];
  onChange: (f: EditableFlow[]) => void;
  mode: 'periodos' | 'fechas';
  unit: string;
}) {
  const update = (id: string, patch: Partial<EditableFlow>) => onChange(flows.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const sorted = flows;
  return (
    <div className="stack" data-testid="editor-flujos">
      <div className="inline-fields small muted" style={{ gridTemplateColumns: '0.8fr 1.4fr 32px' }}>
        <span>{mode === 'periodos' ? `Momento (${unit})` : 'Fecha'}</span>
        <span>Flujo ($, egreso negativo)</span>
        <span />
      </div>
      {sorted.map((f) => (
        <div key={f.id} className="inline-fields" style={{ gridTemplateColumns: '0.8fr 1.4fr 32px', alignItems: 'center' }}>
          {mode === 'periodos' ? (
            <NumberInput ariaLabel="Momento del flujo" kind="number" decimals={2} value={f.t} min={0} max={1200} onChange={(v) => update(f.id, { t: v })} />
          ) : (
            <div className="input-wrap">
              <input
                type="date"
                aria-label="Fecha del flujo"
                value={f.date}
                onChange={(e) => e.target.value && update(f.id, { date: e.target.value })}
                style={{ textAlign: 'left' }}
              />
            </div>
          )}
          <NumberInput ariaLabel="Importe del flujo" kind="money" value={f.amount} onChange={(v) => update(f.id, { amount: v })} />
          <button
            type="button"
            className="btn small ghost"
            aria-label="Eliminar flujo"
            onClick={() => onChange(flows.filter((x) => x.id !== f.id))}
            disabled={flows.length <= 1}
          >
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn small"
        onClick={() => {
          const last = flows[flows.length - 1];
          const t = (last?.t ?? 0) + 1;
          const d = new Date((last?.date ?? '2026-01-01') + 'T00:00:00Z');
          d.setUTCMonth(d.getUTCMonth() + 6);
          onChange([...flows, { id: flowId(), t, amount: 100_000, date: d.toISOString().slice(0, 10) }]);
        }}
      >
        <Icon name="plus" /> Agregar flujo
      </button>
    </div>
  );
}
