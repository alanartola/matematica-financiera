import { useMemo, useState } from 'react';
import {
  EXERCISES,
  GUIDE_AVAILABLE,
  LEVEL_LABELS,
  TOPIC_LABELS,
  defaultParams,
  findExercise,
  type Answer,
  type Exercise,
  type ExerciseTopic,
  type Level,
  type Params,
} from '../../content/ejercicios';
import { NumberInput, ParamControl, SelectField } from '../../ui/controls';
import { Callout, FormulaBox, StepList, Tex, Workbench } from '../../ui/layout';
import { Icon } from '../../ui/icons';
import { fmtMoney, fmtNum, fmtPct } from '../../ui/format';
import { href } from '../../ui/router';
import type { PageProps } from '../registry';

export default function Ejercicios({ topicId, query }: PageProps) {
  const ex = findExercise(topicId);
  return ex ? <ExerciseView key={ex.id} ex={ex} query={query} /> : <ExerciseList />;
}

// ------------------------------------------------------------------- Listado

function ExerciseList() {
  const [level, setLevel] = useState<'todos' | Level>('todos');
  const [topic, setTopic] = useState<'todas' | ExerciseTopic>('todas');
  const list = EXERCISES.filter((e) => (level === 'todos' || e.level === level) && (topic === 'todas' || e.topic === topic));
  const levels: Level[] = ['inicial', 'intermedio', 'avanzado'];
  return (
    <div className="page">
      <section className="hero">
        <h1>Ejercicios interactivos</h1>
        <p>
          Problemas con parámetros modificables y resolución guiada: enunciado, datos, incógnita, fórmula, sustitución, desarrollo, resultado, interpretación y
          visualización. Cada ejercicio puede abrirse en el simulador correspondiente.
        </p>
      </section>
      {!GUIDE_AVAILABLE && (
        <Callout kind="info" title="Guía de referencia pendiente de incorporación">
          La guía de ejercicios de referencia todavía no está cargada en la plataforma. Los ejercicios de esta sección son propios; la estructura para
          incorporar la guía está preparada (ver <code>src/content/ejercicios/guia.ts</code>).
        </Callout>
      )}
      <div className="row" style={{ margin: '1rem 0' }}>
        <div style={{ minWidth: 200 }}>
          <SelectField
            label="Nivel"
            value={level}
            options={[{ value: 'todos', label: 'Todos los niveles' }, ...levels.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))]}
            onChange={(v) => setLevel(v as typeof level)}
          />
        </div>
        <div style={{ minWidth: 240 }}>
          <SelectField
            label="Temática"
            value={topic}
            options={[
              { value: 'todas', label: 'Todas las temáticas' },
              ...(Object.keys(TOPIC_LABELS) as ExerciseTopic[]).map((t) => ({ value: t, label: TOPIC_LABELS[t] })),
            ]}
            onChange={(v) => setTopic(v as typeof topic)}
          />
        </div>
      </div>
      {levels.map((l) => {
        const items = list.filter((e) => e.level === l);
        if (!items.length) return null;
        return (
          <section key={l} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Nivel {LEVEL_LABELS[l].toLowerCase()}</h2>
            <div className="module-grid">
              {items.map((e) => (
                <a key={e.id} className="card module-card" href={href('ejercicios', e.id)} data-testid={`ejercicio-${e.id}`}>
                  <span className="num-badge">{TOPIC_LABELS[e.topic].toUpperCase()}</span>
                  <h2>{e.title}</h2>
                  <span className="small muted">{e.statement(defaultParams(e))}</span>
                </a>
              ))}
            </div>
          </section>
        );
      })}
      {list.length === 0 && <p className="muted">No hay ejercicios con esos filtros.</p>}
    </div>
  );
}

// ------------------------------------------------------------- Un ejercicio

const STAGES = [
  'Datos conocidos',
  'Incógnita',
  'Fórmula aplicable',
  'Sustitución numérica',
  'Desarrollo matemático',
  'Resultado',
  'Interpretación financiera',
  'Visualización gráfica',
];

function fmtAnswer(a: Answer) {
  return a.kind === 'money' ? fmtMoney(a.value) : a.kind === 'percent' ? fmtPct(a.value, 4) : fmtNum(a.value, 4);
}

function ExerciseView({ ex, query }: { ex: Exercise; query: URLSearchParams }) {
  const initial = useMemo(() => {
    const p = defaultParams(ex);
    for (const d of ex.params) {
      const raw = query.get(d.key);
      if (raw !== null && Number.isFinite(Number(raw))) p[d.key] = Number(raw);
    }
    return p;
  }, [ex, query]);
  const [params, setParams] = useState<Params>(initial);
  const [stage, setStage] = useState(0);
  const [hint, setHint] = useState(false);
  const [formula, setFormula] = useState(false);
  const [guesses, setGuesses] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const sol = useMemo(() => ex.solve(params), [ex, params]);
  const [chartOn, setChartOn] = useState(false);
  const showChart = chartOn || stage >= STAGES.length;

  const restart = () => {
    setParams(defaultParams(ex));
    setStage(0);
    setHint(false);
    setFormula(false);
    setGuesses({});
    setChecked(false);
    setChartOn(false);
  };

  const stageContent = (k: number) => {
    switch (k) {
      case 0:
        return (
          <ul>
            {sol.known.map(([a, b]) => (
              <li key={a}>
                <strong>{a}:</strong> {b}
              </li>
            ))}
          </ul>
        );
      case 1:
        return <p>{sol.unknown}</p>;
      case 2:
        return <FormulaBox math={sol.formula} />;
      case 3:
        return sol.substitution.map((m) => <Tex key={m} math={m} display />);
      case 4:
        return <StepList steps={sol.development} />;
      case 5:
        return (
          <ul>
            {sol.answers.map((a) => (
              <li key={a.label}>
                <strong>{a.label}:</strong> <span data-testid="resultado-ejercicio">{fmtAnswer(a)}</span>
              </li>
            ))}
          </ul>
        );
      case 6:
        return <p>{sol.interpretation}</p>;
      default:
        return <p className="muted">El gráfico se muestra en el panel principal.</p>;
    }
  };

  const correct = (a: Answer) => {
    const g = guesses[a.label];
    if (g === undefined) return null;
    const tol = a.tolerance ?? 0.005;
    return Math.abs(g - a.value) <= Math.max(Math.abs(a.value) * tol, a.kind === 'money' ? 0.01 : 1e-6);
  };

  return (
    <Workbench
      onReset={restart}
      controlsTitle={`${LEVEL_LABELS[ex.level]} · ${TOPIC_LABELS[ex.topic]}`}
      controls={
        <>
          <a href={href('ejercicios')} className="small">
            ← Todos los ejercicios
          </a>
          <div className="stack">
            <button
              type="button"
              className="btn primary"
              onClick={() => setStage((s) => Math.min(s + 1, STAGES.length))}
              disabled={stage >= STAGES.length}
              data-testid="resolver-paso"
            >
              Resolver paso a paso ({Math.min(stage, STAGES.length)}/{STAGES.length})
            </button>
            <div className="btn-row">
              <button type="button" className="btn small" onClick={() => setHint((h) => !h)} aria-pressed={hint}>
                Mostrar pista
              </button>
              <button type="button" className="btn small" onClick={() => setFormula((f) => !f)} aria-pressed={formula}>
                Ver fórmula
              </button>
              <button type="button" className="btn small" onClick={() => setChartOn((c) => !c)} aria-pressed={chartOn}>
                Ver gráfico
              </button>
              <button type="button" className="btn small" onClick={() => setStage(STAGES.length)}>
                Ver todo
              </button>
            </div>
            <div className="btn-row">
              <button type="button" className="btn small" onClick={restart}>
                <Icon name="reset" /> Reiniciar ejercicio
              </button>
              {ex.simulator && (
                <a className="btn small" href={ex.simulator(params)}>
                  <Icon name="external" /> Abrir en simulador
                </a>
              )}
            </div>
          </div>
          <p className="group-title" style={{ marginTop: '0.25rem' }}>
            Parámetros del problema
          </p>
          {ex.params.map((d) => (
            <ParamControl
              key={d.key}
              label={d.label}
              kind={d.kind}
              value={params[d.key]}
              min={d.min}
              max={d.max}
              step={d.step}
              unit={d.unit}
              hardMin={d.min}
              hardMax={d.max}
              onChange={(v) => {
                setParams({ ...params, [d.key]: v });
                setChecked(false);
              }}
            />
          ))}
        </>
      }
      chartTitle={showChart ? sol.chartTitle : ex.title}
      chart={
        showChart ? (
          sol.chart
        ) : (
          <div className="stack" style={{ padding: '0.5rem 0.25rem', fontSize: '1.1rem', maxWidth: '70ch' }}>
            <p style={{ fontSize: '1.15rem' }} data-testid="enunciado">
              {ex.statement(params)}
            </p>
            {hint && (
              <Callout kind="info" title="Pista">
                {ex.hint(params)}
              </Callout>
            )}
            {formula && <FormulaBox title="Fórmula aplicable" math={sol.formula} />}
            <p className="small muted">La visualización gráfica aparece en la última etapa de la resolución, o antes con «Ver gráfico».</p>
          </div>
        )
      }
      panels={[
        {
          id: 'resolucion',
          label: 'Resolución',
          content: (
            <div className="prose" data-testid="resolucion">
              <h3>1. Enunciado</h3>
              <p>{ex.statement(params)}</p>
              {STAGES.slice(0, stage).map((title, k) => (
                <div key={title}>
                  <h3>
                    {k + 2}. {title}
                  </h3>
                  {stageContent(k)}
                </div>
              ))}
              {stage === 0 && <p className="muted">Presioná «Resolver paso a paso» para revelar cada etapa.</p>}
              <p className="small muted">Fuente: {ex.source}.</p>
            </div>
          ),
        },
        {
          id: 'comprobar',
          label: 'Comprobar respuesta',
          content: (
            <div className="stack">
              {sol.answers.map((a) => {
                const ok = checked ? correct(a) : null;
                return (
                  <label className="field" key={a.label}>
                    <span className="field-label">{a.label}</span>
                    <NumberInput
                      ariaLabel={a.label}
                      kind={a.kind === 'percent' ? 'percent' : a.kind === 'money' ? 'money' : 'number'}
                      decimals={a.kind === 'number' ? 4 : undefined}
                      value={guesses[a.label] ?? 0}
                      onChange={(v) => {
                        setGuesses({ ...guesses, [a.label]: v });
                        setChecked(false);
                      }}
                    />
                    {ok === true && (
                      <span className="small" style={{ color: 'var(--ok)' }}>
                        ✓ Correcto.
                      </span>
                    )}
                    {ok === false && (
                      <span className="small" style={{ color: 'var(--danger)' }}>
                        ✗ No coincide. Revisá el planteo o pedí una pista.
                      </span>
                    )}
                  </label>
                );
              })}
              <div className="btn-row">
                <button type="button" className="btn primary" onClick={() => setChecked(true)} data-testid="comprobar">
                  Comprobar respuesta
                </button>
              </div>
              <p className="small muted">Se admite una diferencia relativa pequeña por redondeos (0,5 % salvo indicación).</p>
            </div>
          ),
        },
      ]}
    />
  );
}
