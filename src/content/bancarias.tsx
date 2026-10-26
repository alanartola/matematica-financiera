/**
 * Contenido pedagógico del Módulo 5 — Aplicaciones bancarias.
 */
import { Callout, FormulaBox, Tex } from '../ui/layout';

export function AvisoTasas() {
  return (
    <Callout kind="warn" title="Tasas ingresadas manualmente">
      Esta herramienta no consulta tasas vigentes. Los valores iniciales son <strong>hipotéticos</strong> y no representan ofertas reales de ninguna entidad. Si
      se cargan tasas actuales, conviene registrar la fuente, la fecha de consulta, el plazo y las condiciones comerciales.
    </Callout>
  );
}

export function ExplicacionPlazoFijo() {
  return (
    <div className="prose">
      <p>
        Un <strong>plazo fijo tradicional</strong> no capitaliza intereses durante su vigencia: al vencimiento se cobra el capital más un interés simple
        calculado con la TNA y los días del plazo.
      </p>
      <Tex math="I = C \cdot \text{TNA} \cdot \frac{d}{\text{base}}" display />
      <p>
        La <strong>base</strong> es la cantidad de días del año que fija el contrato (en la Argentina suele utilizarse 365). Con base 360, la misma TNA produce
        un interés algo mayor.
      </p>
      <h3>Rendimiento del plazo frente a TEA</h3>
      <ul>
        <li>
          <strong>Rendimiento de un único plazo fijo:</strong> <Tex math="\text{TNA}\cdot d/\text{base}" />. Para 30 días con TNA 40 % es alrededor de 3,29 %:
          es una tasa efectiva <em>de 30 días</em>, no anual.
        </li>
        <li>
          <strong>TEA con reinversiones sucesivas:</strong> supone renovar capital e intereses en colocaciones idénticas durante un año:{' '}
          <Tex math="(1 + \text{TNA}\cdot d/\text{base})^{365/d} - 1" />. Sólo se obtiene si la tasa se mantiene en cada renovación.
        </li>
      </ul>
      <Callout kind="info">
        Cuanto más corto el plazo, más veces se reinvierte en el año y mayor es la TEA para una misma TNA. Con un plazo de 365 días (base 365), TEA = TNA.
      </Callout>
    </div>
  );
}

export function FormulaPlazoFijo() {
  return (
    <div className="prose">
      <FormulaBox
        math={[
          'I = C \\cdot \\text{TNA} \\cdot \\dfrac{d}{\\text{base}}',
          'M = C + I',
          'i_d = \\text{TNA} \\cdot \\dfrac{d}{\\text{base}}',
          '\\text{TEA} = (1 + i_d)^{365/d} - 1',
          '\\text{TEM}_{30} = (1 + i_d)^{30/d} - 1',
        ]}
        legend={[
          ['d', 'días del plazo'],
          ['\\text{base}', '365 o 360 según el contrato'],
          ['i_d', 'rendimiento efectivo del plazo'],
        ]}
      />
      <p className="small muted">La anualización usa un año calendario de 365 días, independientemente de la base contractual.</p>
    </div>
  );
}

export function ExplicacionPrestamo() {
  return (
    <div className="prose">
      <h3>Tasa nominal, tasa efectiva y costo financiero total</h3>
      <ul>
        <li>
          <strong>TNA:</strong> tasa contractual de referencia; dividida por la cantidad de cuotas anuales da la tasa del período.
        </li>
        <li>
          <strong>TEA:</strong> rendimiento (o costo) anual de esa tasa con capitalización en cada período: <Tex math="(1+\text{TNA}/m)^m - 1" />.
        </li>
        <li>
          <strong>CFT:</strong> costo que incluye, además de los intereses, los impuestos, seguros, comisiones y gastos a cargo del deudor. Se calcula como la
          tasa que iguala el importe neto recibido con todos los pagos (TIR del flujo del deudor).
        </li>
      </ul>
      <Tex
        math="C_0 - \text{comisiones} = \sum_{k=1}^{n} \frac{c_k + \text{IVA}_k + \text{seguro}_k + \text{gastos}_k}{(1+r)^k} \quad\Rightarrow\quad \text{CFTEA} = (1+r)^m - 1"
        display
      />
      <Callout kind="warn" title="CFT estimado">
        El CFT de esta herramienta incluye sólo los conceptos cargados. No reemplaza el CFT informado por la entidad, que puede incorporar otros cargos o
        criterios regulatorios específicos.
      </Callout>
      <p className="small muted">
        El IVA sobre intereses se calcula sobre el interés de cada cuota; el seguro, sobre el saldo de capital al inicio de cada período.
      </p>
    </div>
  );
}
