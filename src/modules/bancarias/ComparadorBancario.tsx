import { useMemo, useState } from 'react';
import { compareDeposits, type DepositAlternative } from '../../simulation/bank';
import { SeriesChart } from '../../charts/SeriesChart';
import { NumberInput, ParamControl, Segmented } from '../../ui/controls';
import { Callout, Kpi, Legend, Workbench } from '../../ui/layout';
import { ExportButtons } from '../../ui/ScheduleTable';
import { Icon } from '../../ui/icons';
import { fmtMoney, fmtPct } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { AvisoTasas } from '../../content/bancarias';
import type { PageProps } from '../registry';

let seq = 0;
const id = () => `alt${seq++}`;
const initial = (): DepositAlternative[] => [
  { id: id(), entity: 'Entidad A (hipotética)', tna: 0.3, days: 30, base: 365, source: 'Ejemplo hipotético', date: '' },
  { id: id(), entity: 'Entidad B (hipotética)', tna: 0.31, days: 60, base: 365, source: 'Ejemplo hipotético', date: '' },
  { id: id(), entity: 'Entidad C (hipotética)', tna: 0.29, days: 30, base: 360, source: 'Ejemplo hipotético', date: '' },
];
const SUGGESTIONS = ['ICBC', 'Banco Galicia', 'BBVA', 'Banco Nación', 'Otra entidad'];

export default function ComparadorBancario({ query }: PageProps) {
  const { state, set, reset } = usePageState({ capital: 1_000_000, horizon: 360 }, query);
  const { palette } = useTheme();
  const [alts, setAlts] = useState<DepositAlternative[]>(initial);
  const [view, setView] = useState<'tea' | 'evolucion'>('tea');
  const results = useMemo(() => compareDeposits(alts, state.capital, state.horizon), [alts, state.capital, state.horizon]);
  const color = (k: number) => palette.series[k % 8];
  const update = (i: string, patch: Partial<DepositAlternative>) => setAlts(alts.map((a) => (a.id === i ? { ...a, ...patch } : a)));
  const best = results.reduce((b, r) => (r.result.teaWithReinvestment > (b?.result.teaWithReinvestment ?? -Infinity) ? r : b), results[0]);

  const evolution = useMemo(() => {
    const rows: Record<string, number>[] = [];
    for (let d = 0; d <= state.horizon; d += 5) {
      const row: Record<string, number> = { d };
      results.forEach((r, k) => {
        const done = r.renewals.filter((x) => x.endDay <= d);
        row[`a${k}`] = done.length ? done[done.length - 1].closing : state.capital;
      });
      rows.push(row);
    }
    return rows;
  }, [results, state.horizon, state.capital]);

  return (
    <Workbench
      onReset={() => {
        reset();
        setAlts(initial());
      }}
      controlsTitle="Alternativas"
      controls={
        <>
          <ParamControl label="Capital común" kind="money" value={state.capital} min={0} max={50_000_000} step={50_000} onChange={(v) => set('capital', v)} />
          <ParamControl label="Horizonte de comparación" kind="int" value={state.horizon} min={30} max={730} unit="días" onChange={(v) => set('horizon', v)} />
          <datalist id="entidades-comp">
            {SUGGESTIONS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          {alts.map((a, k) => (
            <div className="event-card" key={a.id}>
              <div className="event-card-head">
                <span className="row" style={{ gap: '0.4rem' }}>
                  <span className="swatch" style={{ background: color(k) }} />
                  Alternativa {k + 1}
                </span>
                <button
                  type="button"
                  className="btn small ghost"
                  aria-label="Eliminar alternativa"
                  onClick={() => setAlts(alts.filter((x) => x.id !== a.id))}
                  disabled={alts.length <= 1}
                >
                  <Icon name="trash" />
                </button>
              </div>
              <div className="input-wrap">
                <input
                  aria-label="Entidad"
                  list="entidades-comp"
                  value={a.entity}
                  onChange={(e) => update(a.id, { entity: e.target.value })}
                  style={{ textAlign: 'left' }}
                />
              </div>
              <div className="inline-fields">
                <label className="field">
                  <span className="field-help">TNA</span>
                  <NumberInput ariaLabel="TNA" kind="percent" value={a.tna} min={0} max={5} onChange={(v) => update(a.id, { tna: v })} />
                </label>
                <label className="field">
                  <span className="field-help">Plazo (días)</span>
                  <NumberInput ariaLabel="Plazo en días" kind="int" value={a.days} min={1} max={3650} onChange={(v) => update(a.id, { days: v })} />
                </label>
              </div>
              <div className="inline-fields">
                <select className="select" aria-label="Base anual" value={a.base} onChange={(e) => update(a.id, { base: Number(e.target.value) as 365 | 360 })}>
                  <option value={365}>Base 365</option>
                  <option value={360}>Base 360</option>
                </select>
                <div className="input-wrap">
                  <input
                    type="date"
                    aria-label="Fecha de consulta"
                    value={a.date}
                    onChange={(e) => update(a.id, { date: e.target.value })}
                    style={{ textAlign: 'left' }}
                  />
                </div>
              </div>
              <div className="input-wrap">
                <input
                  aria-label="Fuente de la tasa"
                  placeholder="Fuente (sitio, folleto, fecha)"
                  value={a.source}
                  onChange={(e) => update(a.id, { source: e.target.value })}
                  style={{ textAlign: 'left' }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn small"
            onClick={() => setAlts([...alts, { id: id(), entity: 'Otra entidad', tna: 0.3, days: 30, base: 365, source: '', date: '' }])}
            disabled={alts.length >= 8}
          >
            <Icon name="plus" /> Agregar alternativa
          </button>
          <AvisoTasas />
        </>
      }
      chartTitle={view === 'tea' ? 'Tasas comparables (supuesto de reinversión)' : `Evolución del capital en ${state.horizon} días con renovaciones`}
      chartToolbar={
        <Segmented
          ariaLabel="Tipo de visualización"
          value={view}
          onChange={setView}
          options={[
            { value: 'tea', label: 'Tasas' },
            { value: 'evolucion', label: 'Evolución' },
          ]}
        />
      }
      kpis={
        <>
          {best && <Kpi label="Mayor TEA con reinversión" value={`${best.alt.entity}: ${fmtPct(best.result.teaWithReinvestment, 2)}`} big />}
          <Kpi label="Capital" value={fmtMoney(state.capital)} />
        </>
      }
      chart={
        view === 'tea' ? (
          <SeriesChart
            ariaLabel="Rendimiento del plazo y TEA por alternativa"
            data={results.map((r) => ({ x: r.alt.entity, plazo: r.result.periodRate, tea: r.result.teaWithReinvestment, tna: r.alt.tna }))}
            xKey="x"
            xLabel="Alternativa"
            yLabel="Tasa (%)"
            yFormat={(v) => fmtPct(v, 0)}
            series={[
              { key: 'tna', label: 'TNA informada', color: palette.series[0], kind: 'bar' },
              { key: 'plazo', label: 'Rendimiento del plazo', color: palette.series[1], kind: 'bar' },
              { key: 'tea', label: 'TEA con reinversión', color: palette.series[2], kind: 'bar' },
            ]}
            tooltip={(r) => ({
              title: r.x,
              rows: [
                { label: 'TNA', value: fmtPct(r.tna, 3), color: palette.series[0] },
                { label: 'Rendimiento del plazo', value: fmtPct(r.plazo, 3), color: palette.series[1] },
                { label: 'TEA con reinversión', value: fmtPct(r.tea, 3), color: palette.series[2] },
              ],
            })}
          />
        ) : (
          <SeriesChart
            ariaLabel="Evolución del capital con renovaciones"
            data={evolution}
            xKey="d"
            xLabel="Tiempo (días)"
            yLabel="Capital ($)"
            yDomain={[state.capital * 0.98, 'auto']}
            series={results.map((r, k) => ({ key: `a${k}`, label: r.alt.entity, color: color(k), kind: 'step' as const }))}
            tooltip={(row) => ({
              title: `Día ${row.d}`,
              rows: results.map((r, k) => ({ label: r.alt.entity, value: fmtMoney(row[`a${k}`]), color: color(k), line: true })),
            })}
          />
        )
      }
      chartFooter={
        <Legend
          items={
            view === 'tea'
              ? [
                  { label: 'TNA informada', color: palette.series[0] },
                  { label: 'Rendimiento del plazo', color: palette.series[1] },
                  { label: 'TEA con reinversión', color: palette.series[2] },
                ]
              : results.map((r, k) => ({ label: r.alt.entity, color: color(k), line: true }))
          }
        />
      }
      panels={[
        {
          id: 'tabla',
          label: 'Comparación',
          content: (
            <div className="stack">
              <div className="row">
                <span className="spacer" />
                <ExportButtons
                  filename="comparador-bancario"
                  tables={[
                    {
                      name: 'Comparación',
                      columns: [
                        { header: 'Entidad', type: 'text' },
                        { header: 'TNA', type: 'percent' },
                        { header: 'Plazo (días)', type: 'int' },
                        { header: 'Base', type: 'int' },
                        { header: 'Interés del plazo', type: 'money' },
                        { header: 'Rendimiento del plazo', type: 'percent' },
                        { header: 'TEA con reinversión', type: 'percent' },
                        { header: 'Monto con renovaciones completas', type: 'money' },
                        { header: 'Fuente', type: 'text' },
                        { header: 'Fecha de consulta', type: 'text' },
                      ],
                      rows: results.map((r) => [
                        r.alt.entity,
                        r.alt.tna,
                        r.alt.days,
                        r.alt.base,
                        r.result.interest,
                        r.result.periodRate,
                        r.result.teaWithReinvestment,
                        r.amountAtLastRenewal,
                        r.alt.source,
                        r.alt.date,
                      ]),
                    },
                  ]}
                />
              </div>
              <div className="table-wrap">
                <table className="data wrap">
                  <thead>
                    <tr>
                      <th className="left">Entidad</th>
                      <th>Interés del plazo</th>
                      <th>Rend. del plazo</th>
                      <th>TEA</th>
                      <th>Monto en {state.horizon} días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.alt.id}>
                        <td className="left">{r.alt.entity}</td>
                        <td>{fmtMoney(r.result.interest)}</td>
                        <td>{fmtPct(r.result.periodRate, 3)}</td>
                        <td>{fmtPct(r.result.teaWithReinvestment, 3)}</td>
                        <td>{fmtMoney(r.amountAtLastRenewal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Callout kind="info" title="Supuestos">
                <ul>
                  <li>El monto al horizonte considera sólo renovaciones completas con la misma tasa; el sobrante de días queda sin invertir.</li>
                  <li>La TEA supone reinversión sucesiva de capital e intereses durante un año calendario (365 días).</li>
                  <li>No se consideran impuestos, límites de montos ni condiciones comerciales particulares.</li>
                </ul>
              </Callout>
            </div>
          ),
        },
      ]}
    />
  );
}
