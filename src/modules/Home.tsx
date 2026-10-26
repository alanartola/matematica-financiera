import { MODULES } from './registry';
import { href } from '../ui/router';

export function Home() {
  return (
    <div className="page">
      <section className="hero">
        <h1>Matemática Financiera</h1>
        <p>
          Matemática Financiera es un entorno interactivo diseñado para explorar, comprender y aplicar los principios del cálculo financiero mediante modelos
          matemáticos, simulaciones y representaciones gráficas.
        </p>
        <div className="principle" aria-label="Principio de trabajo">
          <span>1 · Modificar una variable</span>
          <span>2 · Visualizar su efecto</span>
          <span>3 · Comprender la relación matemática</span>
          <span>4 · Verificar el resultado</span>
        </div>
        <p className="small muted">
          Cada herramienta combina una explicación conceptual, la fórmula utilizada, el desarrollo numérico paso a paso y un gráfico que responde de inmediato a
          los cambios. Para proyectar en clase, activá el <strong>Modo clase</strong> (tecla <kbd>P</kbd>); el modo oscuro se alterna con <kbd>T</kbd>.
        </p>
      </section>
      <div className="module-grid">
        {MODULES.map((m) => (
          <a key={m.id} className="card module-card" href={href(m.id)}>
            <span className="num-badge">MÓDULO {m.number}</span>
            <h2>{m.label}</h2>
            <span className="small muted">{m.description}</span>
            {!m.customNav && (
              <ul>
                {m.topics.map((t) => (
                  <li key={t.id}>{t.label}</li>
                ))}
              </ul>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
