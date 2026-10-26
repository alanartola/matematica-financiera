/**
 * Contenido pedagógico del Módulo 2 — Sistemas de amortización.
 * Incluye el desarrollo paso a paso de cualquier cuota de un cuadro de marcha,
 * reconstruido a partir de los valores del motor (y verificado contra él).
 */
import type { ReactNode } from 'react';
import { annuityFactor, compoundFutureValue, frenchPayment, roundMoney, SYSTEM_LABELS, dec, toNum, type AmortSystem, type ScheduleResult } from '../engine';
import { Callout, FormulaBox, Tex, type Step } from '../ui/layout';
import { fmtMoney, texMoney, texNum, texRate } from '../ui/format';

// --------------------------------------------------------------- Explicaciones

export const EXPLICACIONES: Record<AmortSystem, () => ReactNode> = {
  frances: () => (
    <div className="prose">
      <p>
        En el <strong>sistema francés</strong>, con una tasa periódica fija y períodos uniformes, todas las cuotas son <strong>iguales</strong>. Lo que cambia
        es su composición:
      </p>
      <ul>
        <li>El interés de cada cuota se calcula sobre el saldo adeudado; como el saldo baja, el interés también baja.</li>
        <li>La amortización es la diferencia entre la cuota fija y el interés: por eso crece con el tiempo.</li>
        <li>Al principio se paga mayormente interés; al final, mayormente capital.</li>
      </ul>
      <p>
        La cuota es la que hace que el valor actual de las <Tex math="n" /> cuotas, descontadas a la tasa del préstamo, sea igual al capital prestado (renta
        constante vencida).
      </p>
      <Callout kind="info">Seleccioná una cuota (clic en el gráfico o en el cuadro) para ver exactamente cómo se calculó en la pestaña Desarrollo.</Callout>
    </div>
  ),
  aleman: () => (
    <div className="prose">
      <p>
        En el <strong>sistema alemán</strong> la <strong>amortización de capital es constante</strong>: cada cuota devuelve la misma porción del capital,{' '}
        <Tex math="A = C_0/n" />.
      </p>
      <ul>
        <li>El saldo disminuye en línea recta.</li>
        <li>
          El interés se calcula sobre ese saldo decreciente, por lo que también disminuye linealmente: baja en <Tex math="A \cdot i" /> por período.
        </li>
        <li>
          La cuota total (<Tex math="A + I_k" />) es <strong>decreciente</strong>: la primera es la más alta.
        </li>
      </ul>
      <p>
        Frente al francés, el alemán devuelve capital más rápido al comienzo; como el saldo promedio es menor, el total de intereses también lo es. Activá{' '}
        <strong>Comparar con el francés</strong> para verlo.
      </p>
    </div>
  ),
  americano: () => (
    <div className="prose">
      <p>
        En el <strong>sistema americano</strong> se pagan <strong>sólo intereses</strong> en cada período y el <strong>capital completo</strong> se devuelve al
        vencimiento, junto con el último interés.
      </p>
      <ul>
        <li>El capital adeudado no disminuye en los períodos intermedios porque ninguna cuota amortiza capital.</li>
        <li>
          Todas las cuotas intermedias son iguales a <Tex math="C_0 \cdot i" />; la última es <Tex math="C_0(1+i)" />.
        </li>
        <li>
          Como el saldo se mantiene en su máximo durante toda la operación, el costo total de intereses es el más alto entre los sistemas con pagos periódicos
          de interés.
        </li>
      </ul>
      <Callout kind="neutral">En la práctica suele combinarse con un fondo de amortización (ahorro periódico) para reunir el capital del pago final.</Callout>
    </div>
  ),
  bullet: () => (
    <div className="prose">
      <p>
        En esta aplicación, el <strong>americano Bullet</strong> es una estructura en la que <strong>no hay pagos intermedios</strong>: el capital y los
        intereses se liquidan juntos al vencimiento, en un único pago. Se distingue así del americano con pago periódico de intereses.
      </p>
      <ul>
        <li>
          <strong>Interés compuesto capitalizado:</strong> los intereses de cada período se suman a la deuda y generan intereses. Pago final{' '}
          <Tex math="C_0(1+i)^n" />.
        </li>
        <li>
          <strong>Interés simple acumulado:</strong> los intereses se acumulan sin generar nuevos intereses. Pago final <Tex math="C_0(1+i\,n)" />.
        </li>
      </ul>
      <Callout kind="warn" title="La terminología varía">
        Distintos contratos e instituciones usan "bullet" para estructuras diferentes (por ejemplo, intereses periódicos con capital al final). El cuadro
        muestra siempre la estructura exacta de pagos utilizada aquí; la forma de liquidar los intereses debe surgir del contrato.
      </Callout>
    </div>
  ),
};

export const FORMULAS: Record<AmortSystem, () => ReactNode> = {
  frances: () => (
    <div className="prose">
      <FormulaBox
        title="Cuota constante"
        math={['c = C_0 \\cdot \\dfrac{i(1+i)^n}{(1+i)^n - 1} = \\dfrac{C_0}{a_{\\overline{n}|i}}', 'a_{\\overline{n}|i} = \\dfrac{1-(1+i)^{-n}}{i}']}
      />
      <p>Deducción: el capital es el valor actual de las cuotas.</p>
      <Tex math="C_0 = \sum_{k=1}^{n} \frac{c}{(1+i)^k} = c \cdot \frac{1-(1+i)^{-n}}{i} \;\Rightarrow\; c = \frac{C_0\, i}{1-(1+i)^{-n}}" display />
      <FormulaBox
        title="Cuota k"
        math={['I_k = S_{k-1}\\cdot i', 'A_k = c - I_k', 'S_k = S_{k-1} - A_k', 'A_k = A_1 (1+i)^{k-1}']}
        legend={[
          ['S_{k-1}', 'saldo al inicio de la cuota k'],
          ['I_k', 'interés de la cuota k'],
          ['A_k', 'amortización de capital'],
        ]}
      />
      <p className="small muted">Con tasa cero, la cuota es simplemente C₀ / n.</p>
    </div>
  ),
  aleman: () => (
    <div className="prose">
      <FormulaBox
        math={['A = \\dfrac{C_0}{n}', 'S_{k-1} = C_0 - (k-1)A', 'I_k = S_{k-1}\\cdot i', 'c_k = A + I_k', 'c_k - c_{k+1} = A \\cdot i']}
        legend={[
          ['A', 'amortización constante'],
          ['S_{k-1}', 'saldo al inicio de la cuota k'],
          ['c_k', 'cuota total k'],
        ]}
      />
    </div>
  ),
  americano: () => (
    <div className="prose">
      <FormulaBox math={['c_k = C_0 \\cdot i \\quad (k < n)', 'c_n = C_0 + C_0 \\cdot i', '\\text{Intereses totales} = n \\cdot C_0 \\cdot i']} />
    </div>
  ),
  bullet: () => (
    <div className="prose">
      <FormulaBox
        title="Interés compuesto capitalizado"
        math={['D_k = D_{k-1}(1+i) = C_0(1+i)^k', '\\text{Pago final} = C_0(1+i)^n', '\\text{Intereses} = C_0\\left[(1+i)^n - 1\\right]']}
      />
      <FormulaBox title="Interés simple acumulado" math={['\\text{Pago final} = C_0(1+i\\,n)', '\\text{Intereses} = C_0 \\cdot i \\cdot n']} />
    </div>
  ),
};

// ---------------------------------------------------------- Paso a paso

/**
 * Desarrollo de la cuota `k` de un cuadro de marcha. La cuota francesa o la
 * amortización alemana vigentes se reconstruyen desde el momento en que se
 * fijaron (inicio del tramo, cambio de tasa o pago extraordinario) y se comparan
 * con el motor.
 */
export function pasosCuota(result: ScheduleResult, k: number): Step[] {
  const rows = result.rows;
  const row = rows[k - 1];
  if (!row) return [];
  const i = row.contractRate;
  const isLast = k === rows.length;
  const steps: Step[] = [];
  const rounding = result.input.rounding ?? 'centavos';
  const round = (x: number) => toNum(roundMoney(dec(x), rounding));
  const usesDays = row.days !== undefined;

  // Momento en que se fijó la cuota (francés) o la amortización (alemán) vigente:
  // inicio del tramo, cambio de tasa (sólo francés) o pago extraordinario.
  const ref = isLast && k > 1 && rows[k - 2].system === row.system ? rows[k - 2] : row;
  let R = ref === row ? k : k - 1;
  while (R > 1) {
    const prev = rows[R - 2];
    if (prev.system !== row.system || prev.extraPayment !== 0) break;
    if (row.system === 'frances' && (prev.contractRate !== ref.contractRate || prev.payment !== ref.payment)) break;
    if (row.system === 'aleman' && prev.amortization !== ref.amortization) break;
    R--;
  }
  const startBalance = rows[R - 1].openingPrincipal;
  const remaining = result.input.periods - R + 1;

  steps.push({
    title: `Cuota ${k} — sistema ${SYSTEM_LABELS[row.system]}`,
    math: `S_{${k - 1}} = ${texMoney(row.openingPrincipal + (row.system === 'bullet' && row.bulletMode === 'compuesto' ? row.openingAccrued : 0))} \\qquad i = ${texRate(i, 8)}${usesDays ? ` \\qquad d = ${row.days} \\text{ días}` : ''}`,
    body: R > 1 && !isLast && (row.system === 'frances' || row.system === 'aleman') ? <>Condiciones vigentes desde la cuota {R}.</> : undefined,
  });

  switch (row.system) {
    case 'frances': {
      if (!isLast) {
        const expected = round(toNum(frenchPayment(startBalance, i, remaining)));
        const matches = Math.abs(expected - row.payment) < 0.011;
        if (matches) {
          steps.push({
            title: R === 1 ? 'Cuota constante' : `Cuota recalculada en la cuota ${R}`,
            body:
              R === 1 ? undefined : (
                <>
                  Saldo al inicio de la cuota {R} y {remaining} cuotas restantes.
                </>
              ),
            math: [
              `c = ${texMoney(startBalance)} \\cdot \\frac{${texRate(i, 8)}\\,(1+${texRate(i, 8)})^{${remaining}}}{(1+${texRate(i, 8)})^{${remaining}} - 1}`,
              `(1+i)^{${remaining}} = ${texNum(toNum(compoundFutureValue(1, i, remaining)), 8, 4)} \\qquad a_{\\overline{${remaining}}|} = ${texNum(toNum(annuityFactor(i, remaining)), 8, 4)}`,
              `c = ${texMoney(row.payment)}`,
            ],
          });
        } else {
          steps.push({
            title: 'Cuota vigente',
            body: <>Se mantiene la cuota {fmtMoney(row.payment)} fijada anteriormente (por ejemplo, tras un pago extraordinario con reducción de plazo).</>,
          });
        }
      }
      steps.push({
        title: 'Interés del período',
        math: usesDays
          ? interestByDaysTex(row.openingPrincipal, row.rate, row.interest)
          : `I_{${k}} = S_{${k - 1}} \\cdot i = ${texMoney(row.openingPrincipal)} \\times ${texRate(i, 8)} = ${texMoney(row.interest)}`,
      });
      steps.push(
        isLast
          ? {
              title: 'Última cuota',
              body: <>La última cuota amortiza exactamente el saldo pendiente: absorbe las diferencias de redondeo acumuladas.</>,
              math: [
                `A_{${k}} = S_{${k - 1}} = ${texMoney(row.amortization)}`,
                `c_{${k}} = ${texMoney(row.amortization)} + ${texMoney(row.interest)} = ${texMoney(row.payment)}`,
              ],
            }
          : { title: 'Amortización', math: `A_{${k}} = c - I_{${k}} = ${texMoney(row.payment)} - ${texMoney(row.interest)} = ${texMoney(row.amortization)}` },
      );
      break;
    }
    case 'aleman': {
      const expected = round(startBalance / remaining);
      if (!isLast && Math.abs(expected - row.amortization) < 0.011) {
        steps.push({
          title: R === 1 ? 'Amortización constante' : `Amortización fijada en la cuota ${R}`,
          math: `A = \\frac{${texMoney(startBalance)}}{${remaining}} = ${texMoney(row.amortization)}`,
        });
      } else if (isLast) {
        steps.push({
          title: 'Última amortización',
          body: <>Cancela exactamente el saldo pendiente (incluye el ajuste de redondeo).</>,
          math: `A_{${k}} = ${texMoney(row.amortization)}`,
        });
      } else {
        steps.push({ title: 'Amortización vigente', math: `A = ${texMoney(row.amortization)}` });
      }
      steps.push({
        title: 'Interés del período',
        math: usesDays
          ? interestByDaysTex(row.openingPrincipal, row.rate, row.interest)
          : `I_{${k}} = ${texMoney(row.openingPrincipal)} \\times ${texRate(i, 8)} = ${texMoney(row.interest)}`,
      });
      steps.push({
        title: 'Cuota total',
        math: `c_{${k}} = A + I_{${k}} = ${texMoney(row.amortization)} + ${texMoney(row.interest)} = ${texMoney(row.payment)}`,
      });
      break;
    }
    case 'americano': {
      steps.push({
        title: 'Interés del período',
        math: usesDays
          ? interestByDaysTex(row.openingPrincipal, row.rate, row.interest)
          : `I_{${k}} = ${texMoney(row.openingPrincipal)} \\times ${texRate(i, 8)} = ${texMoney(row.interest)}`,
      });
      steps.push(
        isLast
          ? {
              title: 'Vencimiento: devolución del capital',
              math: `c_{${k}} = C + I_{${k}} = ${texMoney(row.amortization)} + ${texMoney(row.interest)} = ${texMoney(row.payment)}`,
            }
          : {
              title: 'Cuota de interés',
              body: <>No se amortiza capital: el saldo se mantiene en {fmtMoney(row.closingPrincipal)}.</>,
              math: `c_{${k}} = I_{${k}} = ${texMoney(row.payment)}`,
            },
      );
      break;
    }
    case 'bullet': {
      const base = row.bulletMode === 'compuesto' ? row.openingPrincipal + row.openingAccrued : row.openingPrincipal;
      steps.push({
        title: row.bulletMode === 'compuesto' ? 'Interés sobre capital más intereses capitalizados' : 'Interés simple sobre el capital',
        math: `I_{${k}} = ${texMoney(base)} \\times ${texRate(row.rate, 8)} = ${texMoney(row.interest)}`,
      });
      steps.push(
        isLast
          ? {
              title: 'Pago único al vencimiento',
              math: [
                `\\text{Intereses acumulados} = ${texMoney(row.interestPaid)}`,
                `\\text{Pago} = ${texMoney(row.amortization)} + ${texMoney(row.interestPaid)} = ${texMoney(row.payment)}`,
              ],
            }
          : {
              title: 'Sin pago en este período',
              body: <>El interés se acumula. Intereses acumulados al cierre: {fmtMoney(row.closingAccrued)}.</>,
            },
      );
      break;
    }
  }
  steps.push({
    title: 'Saldo al final de la cuota',
    math:
      row.extraPayment > 0
        ? `S_{${k}} = ${texMoney(row.openingPrincipal)} - ${texMoney(row.amortization)} - ${texMoney(row.extraPayment)}\\;(\\text{pago extraordinario}) = ${texMoney(row.closingPrincipal)}`
        : `S_{${k}} = ${texMoney(row.openingPrincipal)} - ${texMoney(row.amortization)} = ${texMoney(row.closingPrincipal)}`,
  });
  return steps;
}

function interestByDaysTex(balance: number, rate: number, interest: number): string {
  return `I = S \\cdot r_{\\text{días}} = ${texMoney(balance)} \\times ${texRate(rate, 8)} = ${texMoney(interest)}`;
}
