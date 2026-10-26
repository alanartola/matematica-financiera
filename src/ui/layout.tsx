/**
 * Piezas de disposición comunes: banco de trabajo (controles + gráfico + panel),
 * pestañas, indicadores, avisos, fórmulas y desarrollos paso a paso.
 */
import katex from 'katex';
import { useMemo, useState, type ReactNode } from 'react';
import type { Check } from '../engine';
import { Icon } from './icons';

// ------------------------------------------------------------------ Fórmulas

export function Tex({ math, display = false }: { math: string; display?: boolean }) {
  const html = useMemo(() => katex.renderToString(math, { displayMode: display, throwOnError: false, strict: 'ignore' }), [math, display]);
  return display ? <div className="formula" dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function FormulaBox({ math, legend, title }: { math: string | string[]; legend?: [string, ReactNode][]; title?: ReactNode }) {
  const list = Array.isArray(math) ? math : [math];
  return (
    <div className="formula-box">
      {title && <div className="step-title">{title}</div>}
      {list.map((m) => (
        <Tex key={m} math={m} display />
      ))}
      {legend && (
        <div className="formula-legend">
          {legend.map(([sym, desc]) => (
            <FragmentRow key={sym} sym={sym} desc={desc} />
          ))}
        </div>
      )}
    </div>
  );
}

function FragmentRow({ sym, desc }: { sym: string; desc: ReactNode }) {
  return (
    <>
      <span>
        <Tex math={sym} />
      </span>
      <span>{desc}</span>
    </>
  );
}

// ---------------------------------------------------------- Paso a paso

export interface Step {
  title: ReactNode;
  body?: ReactNode;
  math?: string | string[];
}

export function StepList({ steps, visible }: { steps: Step[]; visible?: number }) {
  const shown = visible === undefined ? steps : steps.slice(0, visible);
  return (
    <ol className="steps">
      {shown.map((s, k) => (
        <li className="step" key={k}>
          <div className="step-body">
            <div className="step-title">{s.title}</div>
            {s.body && <div>{s.body}</div>}
            {s.math && (Array.isArray(s.math) ? s.math : [s.math]).map((m) => <Tex key={m} math={m} display />)}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ Indicadores

export function Kpi({ label, value, color, line, big, testId }: { label: ReactNode; value: ReactNode; color?: string; line?: boolean; big?: boolean; testId?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">
        {color && <span className={`swatch${line ? ' line' : ''}`} style={{ background: color }} />}
        {label}
      </span>
      <span className={`kpi-value${big ? ' big' : ''}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

export function Callout({ kind = 'info', title, children }: { kind?: 'info' | 'warn' | 'danger' | 'ok' | 'neutral'; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`callout ${kind}`} role={kind === 'danger' || kind === 'warn' ? 'note' : undefined}>
      {title && <div className="callout-title">{title}</div>}
      {children}
    </div>
  );
}

export function ChecksList({ checks }: { checks: Check[] }) {
  return (
    <ul className="checks" data-testid="verificaciones">
      {checks.map((c) => (
        <li key={c.id}>
          <span className={c.ok ? 'mark-ok' : 'mark-bad'} aria-label={c.ok ? 'Correcto' : 'Error'}>
            {c.ok ? '✓' : '✗'}
          </span>
          <span>
            <strong>{c.label}.</strong> <span className="muted">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          <span
            className={`swatch${it.line ? ' line' : ''}`}
            style={it.dashed ? { background: `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 7px)` } : { background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- Pestañas

export interface PanelDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ panels, active, onChange, extra }: { panels: PanelDef[]; active: string; onChange: (id: string) => void; extra?: ReactNode }) {
  const current = panels.find((p) => p.id === active) ?? panels[0];
  return (
    <>
      <div className="tabs" role="tablist">
        {panels.map((p) => (
          <button key={p.id} role="tab" type="button" aria-selected={p.id === current.id} onClick={() => onChange(p.id)}>
            {p.label}
          </button>
        ))}
        <span className="tabs-spacer" />
        {extra}
      </div>
      <div className="tab-body" role="tabpanel">
        {current.content}
      </div>
    </>
  );
}

// -------------------------------------------------------- Banco de trabajo

export interface WorkbenchProps {
  controls: ReactNode;
  controlsTitle?: string;
  onReset?: () => void;
  chartTitle: ReactNode;
  chartToolbar?: ReactNode;
  kpis?: ReactNode;
  chart: ReactNode;
  chartFooter?: ReactNode;
  panels: PanelDef[];
  defaultPanel?: string;
}

export function Workbench({ controls, controlsTitle = 'Variables', onReset, chartTitle, chartToolbar, kpis, chart, chartFooter, panels, defaultPanel }: WorkbenchProps) {
  const [active, setActive] = useState(defaultPanel ?? panels[0]?.id);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="workbench">
      <aside className="wb-controls" aria-label="Variables">
        <div className="wb-controls-head">
          <h2>{controlsTitle}</h2>
          {onReset && (
            <button type="button" className="btn small" onClick={onReset} title="Volver a los valores iniciales">
              <Icon name="reset" /> Restablecer valores
            </button>
          )}
        </div>
        <div className="wb-controls-body">{controls}</div>
      </aside>
      <div className={`wb-main${collapsed ? ' panel-collapsed' : ''}`}>
        <section className="card wb-chart" aria-label="Gráfico">
          <div className="wb-chart-head">
            <h2>{chartTitle}</h2>
            {chartToolbar}
          </div>
          {kpis && <div className="wb-kpis">{kpis}</div>}
          <div className="chart-area">
            <div className="chart-fill">{chart}</div>
          </div>
          {chartFooter && <div style={{ marginTop: '0.35rem' }}>{chartFooter}</div>}
        </section>
        <section className="card wb-panel" aria-label="Explicación y desarrollo">
          {collapsed ? (
            <div className="tabs">
              <button type="button" className="btn small ghost" onClick={() => setCollapsed(false)} title="Mostrar el panel de explicación">
                <Icon name="panel" /> Mostrar panel
              </button>
            </div>
          ) : (
            <Tabs
              panels={panels}
              active={active}
              onChange={setActive}
              extra={
                <button type="button" className="btn small ghost" onClick={() => setCollapsed(true)} title="Ocultar el panel para ampliar el gráfico" aria-label="Ocultar panel">
                  <Icon name="collapse" />
                </button>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
