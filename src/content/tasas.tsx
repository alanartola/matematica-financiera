/**
 * Contenido pedagógico del Módulo 1 — Tasas de interés y capitalización.
 * Textos conceptuales y fórmulas de referencia; los desarrollos numéricos se
 * construyen en cada página a partir de los resultados del motor.
 */
import { Callout, FormulaBox, Tex } from '../ui/layout';

export function ExplicacionSimple() {
  return (
    <div className="prose">
      <p>
        En el régimen de <strong>interés simple</strong> los intereses se calculan siempre sobre el <strong>capital inicial</strong>. Los intereses generados no
        se incorporan al capital: no producen nuevos intereses.
      </p>
      <ul>
        <li>
          <strong>Capital inicial (C₀):</strong> importe que se invierte o se presta en el momento 0.
        </li>
        <li>
          <strong>Tasa de interés (i):</strong> rendimiento por unidad de capital y por período (3 % mensual = 0,03 por mes).
        </li>
        <li>
          <strong>Período (n):</strong> cantidad de unidades de tiempo transcurridas, en la misma unidad que la tasa.
        </li>
        <li>
          <strong>Interés (I):</strong> diferencia entre el capital final y el inicial.
        </li>
        <li>
          <strong>Capital final o valor futuro (VF):</strong> capital más intereses.
        </li>
      </ul>
      <p>
        Como cada período agrega el mismo interés <Tex math="C_0 \cdot i" />, el capital crece en <strong>línea recta</strong>: la tasa determina la pendiente y
        el plazo, hasta dónde se extiende la recta. Probá subir la tasa con la escala fija activada para ver cómo se empina la recta.
      </p>
      <Callout kind="info">El gráfico de barras separa el capital original (que no cambia) de los intereses acumulados (que crecen linealmente).</Callout>
    </div>
  );
}

export function FormulaSimple() {
  return (
    <div className="prose">
      <FormulaBox
        math={['I = C_0 \\cdot i \\cdot n', 'VF = C_0 + I = C_0\\,(1 + i \\cdot n)']}
        legend={[
          ['C_0', 'capital inicial'],
          ['i', 'tasa de interés por período (en forma decimal)'],
          ['n', 'cantidad de períodos, en la unidad de la tasa'],
          ['I', 'interés generado'],
          ['VF', 'valor futuro (capital final)'],
        ]}
      />
      <p>
        La expresión <Tex math="VF(n) = C_0 + (C_0 \cdot i)\, n" /> es una función lineal de <Tex math="n" /> con ordenada al origen <Tex math="C_0" /> y
        pendiente <Tex math="C_0 \cdot i" />.
      </p>
    </div>
  );
}

export function ExplicacionCompuesto() {
  return (
    <div className="prose">
      <p>
        En el régimen de <strong>interés compuesto</strong>, al final de cada período los intereses se <strong>capitalizan</strong>: se suman al capital y, a
        partir de ese momento, también generan intereses. Por eso el interés de cada período es mayor que el del anterior.
      </p>
      <ul>
        <li>
          Período 1: el interés se calcula sobre <Tex math="C_0" /> y coincide con el del interés simple.
        </li>
        <li>
          Período 2: el capital que genera intereses ya es <Tex math="C_0(1+i)" />; aparece el <strong>interés sobre interés</strong>.
        </li>
        <li>Cada período multiplica el capital por el mismo factor (1 + i): el crecimiento es geométrico (exponencial).</li>
      </ul>
      <p>
        Las dos curvas parten del mismo capital y usan la misma tasa periódica. Para <Tex math="n = 1" /> coinciden; para <Tex math="n > 1" /> el compuesto
        supera al simple y la brecha crece cada vez más rápido. (Para <Tex math="0 < n < 1" /> ocurre lo contrario: el simple supera al compuesto.)
      </p>
      <Callout kind="info">
        Con el selector <strong>Destacar</strong> se sombrea el capital inicial, los intereses generados o la diferencia entre ambos regímenes. La vista{' '}
        <strong>Descomposición</strong> separa el monto compuesto en capital, interés "simple" e interés sobre interés.
      </Callout>
    </div>
  );
}

export function FormulaCompuesto() {
  return (
    <div className="prose">
      <FormulaBox
        math={['VF = C_0\\,(1+i)^n', 'I = VF - C_0 = C_0\\left[(1+i)^n - 1\\right]']}
        legend={[
          ['C_0', 'capital inicial'],
          ['i', 'tasa efectiva del período de capitalización'],
          ['n', 'cantidad de períodos de capitalización'],
        ]}
      />
      <p>Deducción por recurrencia: el capital al cierre de cada período es el capital inicial del período más su interés.</p>
      <Tex math="C_t = C_{t-1} + C_{t-1}\, i = C_{t-1}(1+i) \;\Rightarrow\; C_n = C_0 (1+i)^n" display />
      <p>Diferencia con el régimen simple (interés sobre interés acumulado):</p>
      <Tex math="C_0(1+i)^n - C_0(1+i\,n) = C_0\left[\binom{n}{2} i^2 + \binom{n}{3} i^3 + \cdots + i^n\right]" display />
    </div>
  );
}

export function ExplicacionTasaEfectiva() {
  return (
    <div className="prose">
      <p>
        Una <strong>tasa efectiva</strong> mide el rendimiento real obtenido en un período determinado, suponiendo que los intereses se capitalizan al final de
        ese período. Siempre debe indicarse su período: <em>tasa efectiva mensual</em> (TEM), <em>trimestral</em>, <em>semestral</em> o <em>anual</em> (TEA).
      </p>
      <p>
        Dos tasas efectivas de distinto período son <strong>equivalentes</strong> cuando, aplicadas sobre el mismo capital durante el mismo plazo, producen el
        mismo monto bajo capitalización compuesta. Por ejemplo, 3 % mensual equivale a 9,2727 % trimestral y a 42,5761 % anual: invertir un año al 3 % mensual o
        al 42,5761 % anual da exactamente el mismo resultado.
      </p>
      <Callout kind="warn" title="No son proporcionales">
        La tasa trimestral equivalente a 3 % mensual no es 9 % (3 × 3 %), porque cada mes los intereses ya generados vuelven a producir intereses. Las tasas
        proporcionales corresponden a tasas nominales, no a tasas efectivas.
      </Callout>
      <p>
        El gráfico de crecimiento muestra que la misma rentabilidad efectiva puede expresarse con distintos períodos: los escalones son diferentes, pero todas
        las trayectorias llegan al mismo monto al cabo de un año.
      </p>
    </div>
  );
}

export function FormulaTasaEfectiva() {
  return (
    <div className="prose">
      <FormulaBox
        title="Condición de equivalencia (capitalización compuesta)"
        math={['(1 + i_a)^{m_a} = (1 + i_b)^{m_b} = 1 + \\text{TEA}', 'i_b = (1 + i_a)^{m_a/m_b} - 1']}
        legend={[
          ['i_a', 'tasa efectiva conocida'],
          ['m_a', 'cantidad de períodos de esa tasa en un año'],
          ['i_b', 'tasa efectiva buscada'],
          ['m_b', 'cantidad de períodos de la tasa buscada en un año'],
        ]}
      />
      <p>Ejemplos con períodos uniformes (año de 12 meses iguales):</p>
      <Tex math="\text{TET} = (1 + \text{TEM})^3 - 1 \qquad \text{TEA} = (1 + \text{TEM})^{12} - 1 \qquad \text{TEM} = (1 + \text{TEA})^{1/12} - 1" display />
    </div>
  );
}

export function ExplicacionTna() {
  return (
    <div className="prose">
      <p>
        La <strong>TNA</strong> (tasa nominal anual) es una tasa de referencia contractual. Por sí sola no indica cuánto se gana en un año: es necesario conocer
        la <strong>frecuencia de capitalización</strong> (cuántas veces por año los intereses se incorporan al capital).
      </p>
      <h3>De la TNA a la tasa periódica</h3>
      <p>
        Con capitalización en <Tex math="m" /> subperíodos iguales, la tasa efectiva de cada subperíodo es <strong>proporcional</strong>:{' '}
        <Tex math="j = \text{TNA}/m" />. Con TNA = 36 % y capitalización mensual, <Tex math="j = 36\% / 12 = 3\%" /> mensual.
      </p>
      <h3>¿Por qué la TNA no es el rendimiento anual?</h3>
      <p>Depende de qué se haga con los intereses de cada subperíodo:</p>
      <ul>
        <li>
          <strong>Interés pagado y retirado:</strong> cada mes se cobra <Tex math="C \cdot j" /> sobre el mismo capital. Al año se obtiene exactamente{' '}
          <Tex math="C \cdot \text{TNA}" />.
        </li>
        <li>
          <strong>Interés reinvertido (capitalizado):</strong> cada mes los intereses se suman al capital y generan nuevos intereses. Al año se obtiene{' '}
          <Tex math="C\,[(1+j)^m - 1]" />, que supera a <Tex math="C \cdot \text{TNA}" />. Ese rendimiento es la <strong>TEA</strong>.
        </li>
      </ul>
      <h3>Devengamiento y capitalización</h3>
      <p>
        El interés se <strong>devenga</strong> a medida que transcurre el tiempo (se va generando día a día). Se <strong>capitaliza</strong> cuando se incorpora
        al capital y empieza a producir intereses. Un interés puede estar devengado y aún no capitalizado (por ejemplo, a mitad de un mes con capitalización
        mensual).
      </p>
      <Callout kind="info">
        En la línea de tiempo, las barras del interés pagado son constantes; las del interés reinvertido crecen de un subperíodo al siguiente. La suma de esos
        excedentes es la diferencia entre la TEA y la TNA.
      </Callout>
    </div>
  );
}

export function FormulaTna() {
  return (
    <div className="prose">
      <FormulaBox
        math={[
          'j = \\dfrac{\\text{TNA}}{m}',
          '\\text{Interés anual retirado} = C \\cdot j \\cdot m = C \\cdot \\text{TNA}',
          '\\text{Monto con reinversión} = C\\,(1+j)^m',
        ]}
        legend={[
          ['\\text{TNA}', 'tasa nominal anual (forma decimal)'],
          ['m', 'capitalizaciones por año'],
          ['j', 'tasa efectiva de cada subperíodo'],
        ]}
      />
    </div>
  );
}

export function ExplicacionTea() {
  return (
    <div className="prose">
      <p>
        La <strong>TEA</strong> (tasa efectiva anual) es el rendimiento efectivamente obtenido en un año cuando los intereses se capitalizan con la frecuencia
        pactada. Permite comparar tasas nominales con distinta capitalización.
      </p>
      <p>
        Manteniendo la TNA constante, la TEA aumenta con la frecuencia de capitalización, pero cada vez menos: tiene un límite finito, la
        <strong> capitalización continua</strong>, <Tex math="e^{\text{TNA}} - 1" />. Con capitalización anual (<Tex math="m=1" />) la TEA coincide con la TNA.
      </p>
      <h3>Frecuencias admitidas</h3>
      <p>
        Diaria (365), semanal (52), quincenal (24), mensual (12), bimestral (6), trimestral (4), cuatrimestral (3), semestral (2) y anual (1). Todas dividen el
        año en subperíodos <strong>iguales</strong>, que es la hipótesis de la fórmula. La capitalización continua se incluye como límite matemático.
      </p>
      <Callout kind="warn" title="Períodos uniformes frente a días efectivos">
        <p style={{ margin: 0 }}>
          La fórmula <Tex math="(1+\text{TNA}/m)^m - 1" /> supone subperíodos iguales. Cuando el interés se calcula con días efectivos y una base (ACT/365,
          ACT/360 o 30/360), la tasa de cada período es <Tex math="\text{TNA} \cdot d / \text{base}" /> y cambia con la cantidad de días. Ambas convenciones no
          deben mezclarse: la pestaña <strong>Convenciones</strong> muestra la diferencia con un ejemplo.
        </p>
      </Callout>
    </div>
  );
}

export function FormulaTea() {
  return (
    <div className="prose">
      <FormulaBox
        title="TNA → TEA"
        math={[
          '\\text{TEA} = \\left(1 + \\dfrac{\\text{TNA}}{m}\\right)^{m} - 1',
          '\\lim_{m \\to \\infty} \\left(1 + \\dfrac{\\text{TNA}}{m}\\right)^{m} - 1 = e^{\\text{TNA}} - 1',
        ]}
      />
      <FormulaBox title="TEA → TNA (cálculo inverso, para una frecuencia m dada)" math={['\\text{TNA} = m\\left[(1 + \\text{TEA})^{1/m} - 1\\right]']} />
    </div>
  );
}

export function ExplicacionComparador() {
  return (
    <div className="prose">
      <p>
        Dos tasas sólo pueden compararse si se expresan en la <strong>misma unidad</strong>: aquí se convierten ambas a una tasa efectiva mensual y a una TEA, y
        se aplican al <strong>mismo capital</strong> durante el <strong>mismo horizonte</strong>.
      </p>
      <h3>Supuestos explícitos</h3>
      <ul>
        <li>Capitalización compuesta: los intereses se reinvierten a la misma tasa durante todo el horizonte.</li>
        <li>Tasas constantes durante el horizonte, sin impuestos, comisiones ni costos de transacción.</li>
        <li>Períodos uniformes (meses iguales). Los valores intermedios se calculan con la tasa mensual equivalente.</li>
        <li>Una TNA se convierte con su frecuencia de capitalización: no es comparable directamente con una TEA.</li>
      </ul>
      <Callout kind="info">
        La diferencia porcentual se calcula sobre el monto final de la alternativa B: <Tex math="(VF_A - VF_B)/VF_B" />.
      </Callout>
    </div>
  );
}

export interface ConventionRow {
  convention: string;
  calculation: string;
  periodRate: number;
  tea: number;
}

export function ConvencionesTea({ tna, rows }: { tna: number; rows: ConventionRow[] }) {
  const pct = (x: number) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 })} %`;
  return (
    <div className="prose">
      <p>Tasa de un período de "un mes" con la misma TNA de {pct(tna)}, según la convención:</p>
      <div className="table-wrap" style={{ marginBottom: '0.75rem' }}>
        <table className="data">
          <thead>
            <tr>
              <th className="left">Convención</th>
              <th className="left">Cálculo</th>
              <th>Tasa del período</th>
              <th>TEA con reinversión</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.convention}>
                <td className="left">{r.convention}</td>
                <td className="left">{r.calculation}</td>
                <td>{pct(r.periodRate)}</td>
                <td>{pct(r.tea)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Con días efectivos la TEA supone renovaciones sucesivas del mismo plazo en un año calendario de 365 días:{' '}
        <Tex math="(1 + 	ext{TNA}cdot d/	ext{base})^{365/d} - 1" />. En 30/360 el año tiene 12 meses de 30 días, por lo que la anualización usa 12 períodos. Cada
        fila es coherente con su propia convención; mezclar una tasa calculada con una base y anualizarla con otra produce resultados incorrectos.
      </p>
    </div>
  );
}
