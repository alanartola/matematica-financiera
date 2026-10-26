/**
 * Contenido pedagógico del Módulo 3 — Laboratorio de préstamos.
 */
import { Callout, FormulaBox, Tex } from '../ui/layout';

export function LogicaLaboratorio() {
  return (
    <div className="prose">
      <h3>Cambio de sistema</h3>
      <ol>
        <li>Las cuotas anteriores se calculan con las condiciones vigentes en su momento y no se modifican.</li>
        <li>Se determina el saldo de capital luego de pagar la última cuota del tramo anterior.</li>
        <li>Ese saldo es el capital inicial del nuevo tramo.</li>
        <li>Se mantiene el plazo original restante (salvo que un pago extraordinario lo haya reducido).</li>
        <li>
          Las cuotas futuras se recalculan con el nuevo sistema: en el francés, <Tex math="c = S \cdot i / [1-(1+i)^{-r}]" />; en el alemán,{' '}
          <Tex math="A = S / r" />, con <Tex math="r" /> cuotas restantes.
        </li>
        <li>La última cuota cancela exactamente el saldo: la deuda se extingue al vencimiento.</li>
      </ol>
      <h3>Cambio de tasa</h3>
      <p>
        Desde la cuota indicada se aplica la nueva tasa periódica. En el francés se recalcula la cuota con el saldo y el plazo restantes; en el alemán se
        conserva la amortización constante y cambia el interés; en el americano y el Bullet cambia el interés de cada período.
      </p>
      <h3>Pago extraordinario</h3>
      <ul>
        <li>Se imputa íntegramente a capital, junto con la cuota indicada.</li>
        <li>
          <strong>Reducir cuota:</strong> se mantiene el vencimiento y se recalculan las cuotas sobre el saldo menor.
        </li>
        <li>
          <strong>Reducir plazo:</strong> se mantiene la cuota vigente (cuota objetivo) y se calcula cuántas cuotas hacen falta:{' '}
          <Tex math="r = \lceil -\ln(1 - S\,i/c) / \ln(1+i) \rceil" />. La última cuota resulta menor. En el alemán se mantiene la amortización.
        </li>
        <li>En el americano y el Bullet el capital vence al final: el pago reduce los intereses futuros pero no el plazo.</li>
      </ul>
      <Callout kind="info" title="Supuestos">
        Sin comisiones por cancelación anticipada ni otros cargos. Al abandonar un tramo Bullet, los intereses devengados y no pagados se capitalizan. Las
        modificaciones posteriores a la cancelación total de la deuda no se aplican.
      </Callout>
    </div>
  );
}

export function ExplicacionCapitalOriginal() {
  return (
    <div className="prose">
      <p>
        Reconstruir el capital original a partir de algunas cuotas es un <strong>problema inverso</strong>: hay que determinar qué datos se conocen, si alcanzan
        para identificar una única solución y, si no alcanzan, cuál es el dato faltante.
      </p>
      <h3>Método</h3>
      <p>
        Fijados la tasa, el sistema y el número total de cuotas <Tex math="n" />, cada cuota es proporcional al capital (más un eventual cargo fijo):
      </p>
      <Tex math="c_k = P \cdot g_k(n, i) + f" display />
      <p>
        donde <Tex math="g_k" /> es la cuota k de un préstamo de $1 (incluyendo IVA sobre intereses y seguro sobre saldo, si se declaran). El capital se obtiene
        algebraicamente por mínimos cuadrados con todas las cuotas conocidas:
      </p>
      <Tex math="\hat P = \frac{\sum_k g_k (c_k - f)}{\sum_k g_k^2}" display />
      <p>
        Si <Tex math="n" /> no se conoce, se prueban todos los valores posibles. Se analizan las soluciones compatibles (diferencia por cuota menor que la
        tolerancia) y luego se reconstruye el cuadro completo con el motor para comprobar que reproduce las cuotas ingresadas.
      </p>
      <h3>¿Cuándo hay solución única?</h3>
      <ul>
        <li>
          <strong>Francés:</strong> las cuotas son iguales y no revelan cuántas se pagaron antes. Hace falta <Tex math="n" />.
        </li>
        <li>
          <strong>Alemán:</strong> la diferencia entre cuotas consecutivas revela <Tex math="A \cdot i" /> (y la tasa), pero no <Tex math="n" />, salvo que se
          conozca la posición de las cuotas.
        </li>
        <li>
          <strong>Americano:</strong> el interés periódico revela el capital directamente: <Tex math="P = c / i" />, aunque <Tex math="n" /> sea desconocido.
        </li>
        <li>
          <strong>Bullet:</strong> sólo el pago final tiene información; hace falta <Tex math="n" />.
        </li>
      </ul>
      <Callout kind="warn" title="No se inventan datos">
        Si existen varias soluciones compatibles, se informan. Si ninguna combinación reproduce las cuotas, se explican las causas posibles en lugar de forzar
        un resultado.
      </Callout>
    </div>
  );
}

export function FormulasInversos() {
  return (
    <div className="prose">
      <FormulaBox
        title="Capital a partir de una cuota"
        math={[
          '\\text{Francés: } P = c \\cdot \\dfrac{1-(1+i)^{-n}}{i}',
          '\\text{Alemán (1.ª cuota): } P = \\dfrac{c_1}{1/n + i}',
          '\\text{Americano: } P = \\dfrac{c}{i}',
          '\\text{Bullet: } P = \\dfrac{c_n}{(1+i)^n}',
        ]}
      />
      <FormulaBox title="Plazo" math={['\\text{Francés: } n = \\dfrac{-\\ln(1 - P\\,i/c)}{\\ln(1+i)}', '\\text{Alemán: } n = \\dfrac{P}{c_1 - P\\,i}']} />
      <FormulaBox
        title="Tasa implícita"
        math={[
          '\\text{Francés: } P = c \\cdot a_{\\overline{n}|i} \\;\\text{(se resuelve numéricamente)}',
          '\\text{Alemán: } i = \\dfrac{c_1 - P/n}{P}',
          '\\text{Bullet: } i = (c_n/P)^{1/n} - 1',
        ]}
      />
      <FormulaBox title="Saldo luego de la cuota k" math={['\\text{Francés: } S_k = c \\cdot a_{\\overline{n-k}|i}', '\\text{Alemán: } S_k = P\\,(n-k)/n']} />
    </div>
  );
}
