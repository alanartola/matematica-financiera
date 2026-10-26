import { useMemo, useState } from 'react';
import { annualizeEffective, irr, npv, periodicRate, toNum, type Flow } from '../../engine';
import { DEFAULT_FLOWS, equivalentValueAt } from '../../simulation/tvm';
import { Timeline } from '../../charts/Timeline';
import { ParamControl } from '../../ui/controls';
import { Callout, Kpi, Legend, StepList, Workbench, type Step } from '../../ui/layout';
import { FlowsEditor, makeFlows, type EditableFlow } from '../../ui/FlowsEditor';
import { RateSpecInput } from '../../ui/rateInput';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texRate } from '../../ui/format';
import { usePageState } from '../../ui/router';
import { useTheme } from '../../ui/theme';
import { rateSpecFrom, specToState } from '../../simulation/loans';
import { ExplicacionLinea } from '../../content/valorTemporal';
import type { PageProps } from '../registry';

const DEFAULTS = { rateKind: 'TEA' as string, rateValue: 0.3, rateM: 12, focal: 0 };

export default function LineaDeTiempo({ query }: PageProps) {
  const { state, set, patch, reset } = usePageState(DEFAULTS, query);
  const { palette } = useTheme();
  const [flows, setFlows] = useState<EditableFlow[]>(() => makeFlows(DEFAULT_FLOWS));
  const spec = rateSpecFrom(state.rateKind, state.rateValue, state.rateM);
  const i = toNum(periodicRate(spec, 12)); // tasa efectiva mensual
  const engineFlows: Flow[] = useMemo(() => flows.map((f) => ({ t: f.t, amount: f.amount })), [flows]);
  const maxT = Math.max(...engineFlows.map((f) => f.t), 1);
  const focal = Math.min(state.focal, Math.ceil(maxT));
  const van = toNum(npv(engineFlows, i));
  const valueAtFocal = equivalentValueAt(engineFlows, i, focal);
  const tir = useMemo(() => irr(engineFlows), [engineFlows]);

  const steps: Step[] = [
    { title: 'Tasa mensual equivalente', math: `i_m = ${texRate(i, 8)}` },
    {
      title: `Valor equivalente en el mes ${focal}`,
      math: [
        `V_{${focal}} = ${engineFlows.map((f) => `${texMoney(f.amount)}\\,(1+i_m)^{${texNum(focal - f.t, 2, 0)}}`).join(' + ')}`,
        `V_{${focal}} = ${texMoney(valueAtFocal)}`,
      ],
    },
    { title: 'Relación con el VAN', math: `V_{${focal}} = VAN \\cdot (1+i_m)^{${focal}} = ${texMoney(van)} \\times (1+${texRate(i, 6)})^{${focal}}` },
  ];

  return (
    <Workbench
      onReset={() => {
        reset();
        setFlows(makeFlows(DEFAULT_FLOWS));
      }}
      controls={
        <>
          <RateSpecInput value={spec} onChange={(s) => patch(specToState(s) as Partial<typeof state>)} label="Tasa de valuación" />
          <ParamControl
            label="Fecha focal (mes)"
            kind="int"
            value={focal}
            min={0}
            max={Math.ceil(maxT)}
            hardMax={Math.ceil(maxT)}
            onChange={(v) => set('focal', v)}
            help="Momento al que se trasladan todos los flujos."
            testId="param-focal"
          />
          <div className="group">
            <p className="group-title">Flujos (momento en meses)</p>
            <FlowsEditor flows={flows} onChange={setFlows} mode="periodos" unit="meses" />
          </div>
        </>
      }
      chartTitle="Línea de tiempo financiera"
      kpis={
        <>
          <Kpi label="VAN (mes 0)" value={fmtMoney(van)} big testId="kpi-van" />
          <Kpi label={`Valor equivalente en el mes ${focal}`} value={fmtMoney(valueAtFocal)} color={palette.marker} />
          <Kpi label="TIR mensual" value={tir.irr !== null ? fmtPct(tir.irr, 4) : 'No existe'} />
          {tir.irr !== null && <Kpi label="TIR anual efectiva" value={fmtPct(toNum(annualizeEffective(tir.irr, 12)), 3)} />}
          <Kpi label="Tasa mensual equivalente" value={fmtPct(i, 4)} />
        </>
      }
      chart={
        <Timeline
          ariaLabel="Flujos de fondos en la línea de tiempo"
          flows={engineFlows.map((f) => ({ t: f.t, amount: f.amount }))}
          focal={{ t: focal, value: valueAtFocal, label: `V${focal} = ${fmtMoney(valueAtFocal, 0)}` }}
          unitLabel="meses"
        />
      }
      chartFooter={
        <Legend
          items={[
            { label: 'Ingreso', color: palette.series[0] },
            { label: 'Egreso', color: palette.series[1] },
            { label: 'Valor equivalente en la fecha focal', color: palette.marker },
          ]}
        />
      }
      panels={[
        { id: 'desarrollo', label: 'Desarrollo', content: <StepList steps={steps} /> },
        {
          id: 'explicacion',
          label: 'Explicación',
          content: (
            <>
              <ExplicacionLinea />
              {tir.warnings.length > 0 && (
                <Callout kind="warn" title="Sobre la TIR">
                  <ul>
                    {tir.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              <p className="small muted">
                Momentos con decimales (por ejemplo 1,5 meses) se valúan con exponente fraccionario. Flujos: {fmtNum(engineFlows.length)}.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
