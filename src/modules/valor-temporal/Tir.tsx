import { useMemo, useState } from 'react';
import { annualizeEffective, frequencyByPerYear, irr, npv, npvProfile, toNum, type Flow } from '../../engine';
import { profileRange } from '../../simulation/tvm';
import { SeriesChart } from '../../charts/SeriesChart';
import { ParamControl, SelectField } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { FlowsEditor, makeFlows, type EditableFlow } from '../../ui/FlowsEditor';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { FREQ_OPTIONS } from '../../ui/rateInput';
import { ExplicacionTIR } from '../../content/valorTemporal';
import { pluralize } from '../../content/units';
import type { PageProps } from '../registry';

const PRESETS: { id: string; label: string; flows: [number, number][]; perYear: number }[] = [
  {
    id: 'convencional',
    label: 'Inversión convencional (semestral)',
    flows: [
      [0, -1_000_000],
      [1, 300_000],
      [2, 500_000],
      [3, 700_000],
    ],
    perYear: 2,
  },
  {
    id: 'dos-tir',
    label: 'Flujos no convencionales: dos TIR',
    flows: [
      [0, -1_000_000],
      [1, 2_300_000],
      [2, -1_320_000],
    ],
    perYear: 1,
  },
  {
    id: 'sin-tir',
    label: 'Sin cambio de signo: no existe TIR',
    flows: [
      [0, 500_000],
      [1, 300_000],
      [2, 200_000],
    ],
    perYear: 1,
  },
];

const DEFAULTS = { rate: 0.1, perYear: 2 };

export default function Tir({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [preset, setPreset] = useState('convencional');
  const [flows, setFlows] = useState<EditableFlow[]>(() => makeFlows(PRESETS[0].flows, '2026-01-01', 6));
  const freq = frequencyByPerYear(state.perYear);
  const engineFlows: Flow[] = useMemo(() => flows.map((f) => ({ t: f.t, amount: f.amount })), [flows]);
  const result = useMemo(() => irr(engineFlows), [engineFlows]);
  const [lo, hi] = profileRange(result.roots, state.rate);
  const profile = useMemo(() => npvProfile(engineFlows, lo, hi, 201), [engineFlows, lo, hi]);
  const vanAtRate = toNum(npv(engineFlows, state.rate));
  const V = palette.series[0];
  const T = palette.series[1];

  const steps: Step[] = [
    { title: 'Ecuación', math: `0 = ${engineFlows.map((f) => `\\frac{${texMoney(f.amount)}}{(1+r)^{${texNum(f.t, 2, 0)}}}`).join(' + ')}` },
    {
      title: 'Búsqueda de raíces',
      body: (
        <>
          Cambios de signo en los flujos: <strong>{result.signChanges}</strong>. Se evalúa el VAN entre {fmtPct(result.searchRange[0], 0)} y{' '}
          {fmtPct(result.searchRange[1], 0)} por período para encontrar los intervalos donde cambia de signo.
        </>
      ),
    },
  ];
  if (result.iterations.length) {
    steps.push({
      title: 'Refinamiento (Newton-Raphson con salvaguarda de bisección)',
      body: (
        <div className="table-wrap" style={{ maxHeight: 260 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Iteración</th>
                <th className="left">Método</th>
                <th>Tasa</th>
                <th>VAN</th>
              </tr>
            </thead>
            <tbody>
              {result.iterations.slice(0, 40).map((it) => (
                <tr key={it.iteration}>
                  <td>{it.iteration}</td>
                  <td className="left">{it.method}</td>
                  <td>{fmtPct(it.rate, 8)}</td>
                  <td>{fmtNum(it.npv, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  }
  if (result.irr !== null) {
    const annual = toNum(annualizeEffective(result.irr, state.perYear));
    steps.push({
      title: 'Resultado',
      math: [
        `\\text{TIR}_{\\text{${freq.adjective}}} = ${texRate(result.irr, 8)}`,
        `\\text{TIR anual efectiva} = (1 + ${texRate(result.irr, 8)})^{${state.perYear}} - 1 = ${texNum(annual * 100, 4)}\\,\\%`,
        `\\text{Tasa nominal anual} = ${texRate(result.irr, 8)} \\times ${state.perYear} = ${texNum(result.irr * state.perYear * 100, 4)}\\,\\%`,
      ],
    });
  }

  return (
    <Workbench
      onReset={() => {
        reset();
        setPreset('convencional');
        setFlows(makeFlows(PRESETS[0].flows, '2026-01-01', 6));
      }}
      controls={
        <>
          <SelectField
            label="Ejemplo"
            value={preset}
            options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(id) => {
              const p = PRESETS.find((x) => x.id === id)!;
              setPreset(id);
              setFlows(makeFlows(p.flows));
              patch({ perYear: p.perYear });
            }}
          />
          <ParamControl
            label={`Tasa de descuento ${freq.adjective}`}
            kind="percent"
            value={state.rate}
            min={0}
            max={0.6}
            step={0.0025}
            onChange={(v) => set('rate', v)}
            testId="param-tasa"
          />
          <SelectField
            label="Período de los flujos"
            value={state.perYear}
            options={FREQ_OPTIONS}
            onChange={(v) => set('perYear', v)}
            help="Determina cómo se anualiza la TIR."
          />
          <div className="group">
            <p className="group-title">Flujos de fondos</p>
            <FlowsEditor flows={flows} onChange={setFlows} mode="periodos" unit={pluralize(freq.period)} />
          </div>
        </>
      }
      chartTitle="Perfil del VAN: VAN en función de la tasa de descuento"
      kpis={
        <>
          <Kpi label={`TIR ${freq.adjective}`} value={result.irr !== null ? fmtPct(result.irr, 4) : 'No existe'} big color={T} testId="kpi-tir" />
          {result.roots.length > 1 && (
            <Kpi
              label="Otras TIR"
              value={result.roots
                .slice(1)
                .map((r) => fmtPct(r, 2))
                .join(' · ')}
            />
          )}
          {result.irr !== null && <Kpi label="TIR anual efectiva" value={fmtPct(toNum(annualizeEffective(result.irr, state.perYear)), 4)} />}
          <Kpi label={`VAN al ${fmtPct(state.rate, 2)}`} value={fmtMoney(vanAtRate)} color={V} />
        </>
      }
      chart={
        <SeriesChart
          ariaLabel="VAN en función de la tasa de descuento"
          data={profile}
          xKey="rate"
          xLabel={`Tasa de descuento ${freq.adjective} (%)`}
          yLabel="VAN ($)"
          xFormat={(v) => fmtPct(v, 0)}
          series={[{ key: 'npv', label: 'VAN', color: V }]}
          refLines={[
            { y: 0, color: palette.axis, dashed: false },
            { x: state.rate, color: palette.marker },
          ]}
          points={[
            ...result.roots.map((r) => ({ x: r, y: 0, color: T, label: `TIR ${fmtPct(r, 2)}` })),
            { x: state.rate, y: vanAtRate, color: palette.marker },
          ]}
          tooltip={(r) => ({ title: `Tasa ${fmtPct(r.rate, 2)}`, rows: [{ label: 'VAN', value: fmtMoney(r.npv), color: V, line: true }] })}
        />
      }
      chartFooter={
        <Legend
          items={[
            { label: 'VAN(r)', color: V, line: true },
            { label: 'TIR (VAN = 0)', color: T },
            { label: 'Tasa de descuento seleccionada', color: palette.marker },
          ]}
        />
      }
      panels={[
        {
          id: 'resultado',
          label: 'Resultado',
          content: (
            <div className="stack">
              {result.warnings.length > 0 ? (
                <Callout kind="warn" title="Advertencias">
                  <ul>
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              ) : (
                <Callout kind="ok" title="Flujo convencional">
                  Un único cambio de signo: existe una sola TIR. A tasas menores que la TIR el VAN es positivo; a tasas mayores, negativo.
                </Callout>
              )}
              <StepList steps={steps} />
            </div>
          ),
        },
        { id: 'explicacion', label: 'Explicación', content: <ExplicacionTIR /> },
      ]}
    />
  );
}
