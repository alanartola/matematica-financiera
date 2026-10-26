import { Component, Suspense, useEffect, type ReactNode } from 'react';
import { findModule, MODULES } from './modules/registry';
import { Home } from './modules/Home';
import { href, useRoute } from './ui/router';
import { useTheme } from './ui/theme';
import { Icon } from './ui/icons';

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1d3a5f" />
      <path d="M12 48 L26 34 L36 40 L52 18" fill="none" stroke="#f2c14e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52" cy="18" r="4" fill="#f2c14e" />
    </svg>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="callout danger">
            <div className="callout-title">No fue posible mostrar esta sección</div>
            <p>{this.state.error.message}</p>
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const route = useRoute();
  const { theme, toggleTheme, presentation, togglePresentation } = useTheme();
  const mod = findModule(route.moduleId);
  const topic = mod && !mod.customNav ? (mod.topics.find((t) => t.id === route.topicId) ?? mod.topics[0]) : mod?.topics[0];

  useEffect(() => {
    document.title = mod ? `${topic && !mod.customNav ? topic.label + ' · ' : ''}${mod.label} — Matemática Financiera` : 'Matemática Financiera';
  }, [mod, topic]);

  // Atajos de teclado: P = modo clase, T = tema.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'p' || e.key === 'P') togglePresentation();
      if (e.key === 't' || e.key === 'T') toggleTheme();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePresentation, toggleTheme]);

  const Page = topic?.page;

  return (
    <div className="app">
      <header className="app-header">
        <a className="brand" href="#/">
          <BrandMark />
          <span>Matemática Financiera</span>
        </a>
        <nav className="module-nav" aria-label="Módulos">
          {MODULES.map((m) => (
            <a key={m.id} href={href(m.id)} aria-current={m.id === mod?.id ? 'page' : undefined} title={m.label}>
              <span className="mod-num">{m.number}</span>
              {m.short}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            aria-pressed={presentation}
            onClick={togglePresentation}
            title="Modo clase: tipografía y gráficos más grandes para proyectar (tecla P)"
          >
            <Icon name="present" /> Modo clase
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            title="Alternar modo claro / oscuro (tecla T)"
            aria-label="Alternar modo claro u oscuro"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>
      {mod && !mod.customNav && (
        <div className="subnav">
          <span className="subnav-title">
            {mod.number}. {mod.label}
          </span>
          <nav className="topic-tabs" aria-label="Temas del módulo">
            {mod.topics.map((t) => (
              <a key={t.id} href={href(mod.id, t.id)} aria-current={t.id === topic?.id ? 'page' : undefined}>
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      )}
      <main className="app-main">
        <ErrorBoundary resetKey={route.raw}>
          <Suspense fallback={<div className="empty">Cargando…</div>}>
            {Page && mod ? <Page key={`${mod.id}/${route.topicId ?? ''}/${route.query.toString()}`} query={route.query} topicId={route.topicId} /> : <Home />}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
