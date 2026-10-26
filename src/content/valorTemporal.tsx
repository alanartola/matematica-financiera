/**
 * Contenido pedagógico del Módulo 4 — Valor temporal del dinero.
 */
import { Callout, FormulaBox, Tex } from '../ui/layout';

export function ExplicacionVA() {
  return (
    <div className="prose">
      <p>
        Un peso disponible hoy vale más que un peso disponible en el futuro, porque puede invertirse y generar intereses. El <strong>valor actual</strong> (VA)
        de un importe futuro es la cantidad que, invertida hoy a la tasa <Tex math="i" />, alcanza exactamente ese importe al cabo de <Tex math="n" /> períodos.
      </p>
      <p>
        <strong>Actualizar</strong> (o descontar) es recorrer la línea de tiempo hacia atrás: se divide por <Tex math="(1+i)^n" />. Cuanto mayor es la tasa o
        más lejano el flujo, menor es su valor actual. Mové la tasa y observá cómo se acorta la flecha del valor actual.
      </p>
      <Callout kind="info">
        La curva <strong>VA según la tasa</strong> es decreciente y convexa: un aumento de la tasa reduce el valor actual, pero cada vez en menor medida.
      </Callout>
    </div>
  );
}

export function FormulaVA() {
  return (
    <div className="prose">
      <FormulaBox
        math={['VA = \\dfrac{VF}{(1+i)^n} = VF \\cdot v^n', 'v = \\dfrac{1}{1+i}', 'D = VF - VA \\;(\\text{descuento compuesto})']}
        legend={[
          ['VF', 'importe futuro'],
          ['i', 'tasa de descuento por período'],
          ['n', 'cantidad de períodos hasta el flujo'],
          ['v^n', 'factor de descuento'],
        ]}
      />
    </div>
  );
}

export function ExplicacionVF() {
  return (
    <div className="prose">
      <p>
        <strong>Capitalizar</strong> es recorrer la línea de tiempo hacia adelante: un capital de hoy se transforma en un monto futuro multiplicándolo por{' '}
        <Tex math="(1+j)^{m\,t}" />, donde <Tex math="j = \text{TNA}/m" /> es la tasa de cada subperíodo de capitalización y <Tex math="m\,t" /> la cantidad de
        capitalizaciones.
      </p>
      <p>
        <strong>Actualizar</strong> es la operación inversa: divide por el mismo factor. Ambas operaciones usan la misma tasa y el mismo plazo, por lo que
        capitalizar y luego actualizar devuelve el capital original.
      </p>
      <p>
        El gráfico escalonado muestra que el capital sólo aumenta en cada fecha de capitalización; la curva suave representa la misma tasa efectiva aplicada en
        forma continua (valores intermedios equivalentes).
      </p>
      <Callout kind="neutral">
        Si el plazo no es un múltiplo entero del subperíodo, la fórmula con exponente fraccionario supone que la tasa equivalente rige también por fracciones de
        período; un contrato puede definir otra cosa (por ejemplo, interés simple por la fracción).
      </Callout>
    </div>
  );
}

export function FormulaVF() {
  return (
    <div className="prose">
      <FormulaBox
        math={['VF = C\\,(1+j)^{m\\,t}, \\qquad j = \\dfrac{\\text{TNA}}{m}', 'VA = \\dfrac{VF}{(1+j)^{m\\,t}}']}
        legend={[
          ['C', 'capital inicial'],
          ['m', 'capitalizaciones por año'],
          ['t', 'plazo en años'],
        ]}
      />
    </div>
  );
}

export function ExplicacionVAN() {
  return (
    <div className="prose">
      <p>
        El <strong>valor actual neto</strong> (VAN) suma todos los flujos de un proyecto llevados al momento 0 con la tasa de descuento (costo de oportunidad).
        Los egresos se ingresan con signo negativo.
      </p>
      <ul>
        <li>VAN &gt; 0: el proyecto rinde más que la tasa de descuento.</li>
        <li>VAN = 0: rinde exactamente la tasa de descuento (esa tasa es la TIR).</li>
        <li>VAN &lt; 0: rinde menos que la tasa exigida.</li>
      </ul>
      <p>
        Con <strong>períodos uniformes</strong>, <Tex math="t" /> es la cantidad de períodos y la tasa es efectiva por período. Con{' '}
        <strong>fechas específicas</strong>, cada flujo se descuenta por la fracción de año transcurrida (días / 365) con una tasa efectiva anual.
      </p>
    </div>
  );
}

export function FormulaVAN() {
  return (
    <div className="prose">
      <FormulaBox title="Períodos uniformes" math={['VAN = \\sum_{t=0}^{n} \\dfrac{FC_t}{(1+i)^t}']} />
      <FormulaBox
        title="Fechas específicas (ACT/365)"
        math={['VAN = \\sum_{k} \\dfrac{FC_k}{(1+\\text{TEA})^{d_k/365}}']}
        legend={[['d_k', 'días entre la fecha inicial y la del flujo k']]}
      />
    </div>
  );
}

export function ExplicacionTIR() {
  return (
    <div className="prose">
      <p>
        La <strong>tasa interna de retorno</strong> (TIR) es la tasa de descuento que hace que el VAN de los flujos sea igual a cero, siempre que exista una
        solución aplicable. En el gráfico, es la intersección de la curva del VAN con el eje horizontal.
      </p>
      <h3>Procedimiento numérico</h3>
      <p>
        No hay fórmula cerrada para más de dos flujos. Se explora el VAN en una grilla de tasas entre −99 % y 1000 % por período para detectar cambios de signo;
        cada intervalo con cambio de signo contiene una raíz, que se refina con el método de Newton-Raphson (si un paso sale del intervalo, se usa bisección).
      </p>
      <h3>Advertencias</h3>
      <ul>
        <li>
          Si los flujos cambian de signo más de una vez, puede haber <strong>varias TIR</strong> (regla de los signos de Descartes).
        </li>
        <li>Si no cambian de signo, no existe TIR.</li>
        <li>
          La TIR supone implícitamente reinversión a la propia TIR y no mide la escala del proyecto: para elegir entre alternativas, el VAN es el criterio
          preferible.
        </li>
      </ul>
      <h3>TIR periódica y anualizada</h3>
      <p>
        Si los flujos son semestrales, la TIR obtenida es <strong>semestral</strong>. Su equivalente anual efectivo es <Tex math="(1+\text{TIR})^m - 1" />;
        multiplicarla por <Tex math="m" /> da una tasa nominal, no efectiva.
      </p>
    </div>
  );
}

export function ExplicacionLinea() {
  return (
    <div className="prose">
      <p>
        La línea de tiempo ubica cada importe en el momento en que ocurre: flechas hacia arriba para los ingresos y hacia abajo para los egresos, con longitud
        proporcional al importe.
      </p>
      <p>
        Dos conjuntos de flujos son <strong>financieramente equivalentes</strong> si tienen el mismo valor en cualquier fecha focal. El valor equivalente en la
        fecha <Tex math="T" /> es:
      </p>
      <Tex math="V_T = \sum_k FC_k\,(1+i)^{T - t_k} = VAN \cdot (1+i)^{T}" display />
      <p>
        Los flujos anteriores a <Tex math="T" /> se capitalizan y los posteriores se actualizan. Mové la fecha focal para ver que el valor cambia con{' '}
        <Tex math="T" />, pero siempre representa la misma operación.
      </p>
    </div>
  );
}
