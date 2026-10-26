/**
 * Ejercicios propios de la plataforma (no provienen de la guía de referencia,
 * que se incorporará en `guia.ts`). Todos los resultados se obtienen del motor.
 */
import {
  annualizeEffective,
  buildSchedule,
  compoundFutureValue,
  convertEffective,
  fixedDeposit,
  frenchPayment,
  futureValue,
  irr,
  nominalFromTea,
  npv,
  periodicFromNominal,
  presentValue,
  reconstructPrincipal,
  simpleFutureValue,
  simpleTermForMultiple,
  teaFromNominal,
  toNum,
  discountFlows,
} from '../../engine';
import { href } from '../../ui/router';
import { fmtMoney, fmtNum, fmtPct, texMoney, texNum, texPct, texRate } from '../../ui/format';
import { FlowsTimeline, NpvProfileChart, RegimesChart, ScheduleBars, SimpleBars } from './charts';
import type { Exercise } from './types';

const PROPIO = 'Propio de la plataforma';
const tna12 = (v: number) => ({ kind: 'TNA' as const, value: v, m: 12 });

export const CATALOGO: Exercise[] = [
  // ------------------------------------------------------------------ INICIAL
  {
    id: 'simple-vs-compuesto',
    title: 'Capital final con interés simple y con interés compuesto',
    level: 'inicial',
    topic: 'interes-compuesto',
    source: PROPIO,
    params: [
      { key: 'c0', label: 'Capital', kind: 'money', min: 100_000, max: 10_000_000, step: 50_000, default: 1_000_000 },
      { key: 'i', label: 'Tasa mensual', kind: 'percent', min: 0.001, max: 0.15, step: 0.0005, default: 0.03 },
      { key: 'n', label: 'Plazo', kind: 'int', min: 1, max: 60, default: 12, unit: 'meses' },
    ],
    statement: (p) => (
      <>
        Una operación de {fmtMoney(p.c0)} se invierte al {fmtPct(p.i)} mensual durante {p.n} meses. ¿Cuál será el capital final con interés simple? ¿Y con
        interés compuesto?
      </>
    ),
    hint: () => <>En el régimen simple los intereses se calculan siempre sobre el capital inicial; en el compuesto, sobre el capital acumulado.</>,
    solve: (p) => {
      const s = toNum(simpleFutureValue(p.c0, p.i, p.n));
      const c = toNum(compoundFutureValue(p.c0, p.i, p.n));
      return {
        known: [
          ['Capital inicial', fmtMoney(p.c0)],
          ['Tasa', `${fmtPct(p.i)} mensual`],
          ['Plazo', `${p.n} meses`],
        ],
        unknown: 'Capital final en cada régimen',
        formula: ['VF_s = C_0(1 + i\\,n)', 'VF_c = C_0(1+i)^n'],
        substitution: [`VF_s = ${texMoney(p.c0)}(1 + ${texRate(p.i)} \\times ${p.n})`, `VF_c = ${texMoney(p.c0)}(1 + ${texRate(p.i)})^{${p.n}}`],
        development: [
          { title: 'Interés simple', math: `VF_s = ${texMoney(p.c0)} \\times ${texNum(1 + p.i * p.n, 6, 2)} = ${texMoney(s)}` },
          { title: 'Interés compuesto', math: `VF_c = ${texMoney(p.c0)} \\times ${texNum(toNum(compoundFutureValue(1, p.i, p.n)), 8, 4)} = ${texMoney(c)}` },
          { title: 'Diferencia', math: `${texMoney(c)} - ${texMoney(s)} = ${texMoney(c - s)}` },
        ],
        answers: [
          { label: 'Capital final (simple)', value: s, kind: 'money' },
          { label: 'Capital final (compuesto)', value: c, kind: 'money' },
        ],
        interpretation: (
          <>
            La capitalización genera {fmtMoney(c - s)} adicionales: es el interés producido por los intereses que se reinvierten cada mes. La diferencia crece
            al aumentar la tasa o el plazo.
          </>
        ),
        chart: <RegimesChart c0={p.c0} i={p.i} n={p.n} />,
        chartTitle: 'Interés simple frente a compuesto',
      };
    },
    simulator: (p) => href('tasas', 'interes-compuesto', { c0: p.c0, i: p.i, n: p.n, t: p.n }),
  },
  {
    id: 'duplicar-simple',
    title: 'Tiempo para duplicar un capital con interés simple',
    level: 'inicial',
    topic: 'interes-simple',
    source: PROPIO,
    params: [
      { key: 'i', label: 'Tasa mensual', kind: 'percent', min: 0.005, max: 0.1, step: 0.0005, default: 0.04 },
      { key: 'k', label: 'Múltiplo buscado', kind: 'number', min: 1.1, max: 5, step: 0.1, default: 2 },
    ],
    statement: (p) => (
      <>
        ¿Cuántos meses deben transcurrir para que un capital colocado al {fmtPct(p.i)} mensual con interés simple se multiplique por {fmtNum(p.k, 2)}?
      </>
    ),
    hint: () => <>Planteá VF = k · C₀ en la fórmula del interés simple: el capital inicial se cancela.</>,
    solve: (p) => {
      const n = toNum(simpleTermForMultiple(p.k, p.i));
      const c0 = 1_000_000;
      return {
        known: [
          ['Tasa', `${fmtPct(p.i)} mensual`],
          ['Monto buscado', `${fmtNum(p.k, 2)} × C₀`],
        ],
        unknown: 'Plazo n',
        formula: ['C_0(1 + i\\,n) = k\\,C_0 \\;\\Rightarrow\\; n = \\dfrac{k-1}{i}'],
        substitution: [`n = \\dfrac{${texNum(p.k, 2)} - 1}{${texRate(p.i)}}`],
        development: [{ title: 'Cálculo', math: `n = ${texNum(n, 4)} \\text{ meses}` }],
        answers: [{ label: 'Plazo (meses)', value: n, kind: 'number' }],
        interpretation: (
          <>
            Con interés simple el capital crece linealmente: cada mes agrega {fmtPct(p.i)} del capital inicial, por lo que el plazo es inversamente proporcional
            a la tasa.
          </>
        ),
        chart: <RegimesChart c0={c0} i={p.i} n={Math.max(1, Math.ceil(n))} showCompound={false} />,
        chartTitle: `Evolución de $ 1.000.000 hasta multiplicarse por ${fmtNum(p.k, 2)}`,
      };
    },
    simulator: (p) => {
      const n = Math.ceil(toNum(simpleTermForMultiple(p.k, p.i)));
      return href('tasas', 'interes-simple', { c0: 1_000_000, i: p.i, n, t: n });
    },
  },
  {
    id: 'tna-a-tea',
    title: 'De TNA a TEA',
    level: 'inicial',
    topic: 'tna-tea',
    source: PROPIO,
    params: [
      { key: 'tna', label: 'TNA', kind: 'percent', min: 0.01, max: 1.2, step: 0.005, default: 0.36 },
      { key: 'm', label: 'Capitalizaciones por año', kind: 'int', min: 1, max: 365, default: 12 },
    ],
    statement: (p) => (
      <>
        Un banco informa una TNA del {fmtPct(p.tna)} con {p.m} capitalizaciones por año. ¿Cuál es la tasa efectiva de cada subperíodo y cuál es la TEA?
      </>
    ),
    hint: () => <>Primero dividí la TNA por la cantidad de capitalizaciones; luego capitalizá esa tasa durante un año.</>,
    solve: (p) => {
      const j = toNum(periodicFromNominal(p.tna, p.m));
      const tea = toNum(teaFromNominal(p.tna, p.m));
      return {
        known: [
          ['TNA', fmtPct(p.tna)],
          ['Capitalizaciones por año', String(p.m)],
        ],
        unknown: 'Tasa del subperíodo y TEA',
        formula: ['j = \\text{TNA}/m', '\\text{TEA} = (1 + j)^m - 1'],
        substitution: [`j = ${texNum(p.tna, 6, 2)}/${p.m}`, `\\text{TEA} = (1 + ${texNum(j, 8, 2)})^{${p.m}} - 1`],
        development: [
          { title: 'Tasa del subperíodo', math: `j = ${texPct(j, 6)}` },
          { title: 'TEA', math: `\\text{TEA} = ${texPct(tea, 4)}` },
        ],
        answers: [
          { label: 'Tasa del subperíodo', value: j, kind: 'percent' },
          { label: 'TEA', value: tea, kind: 'percent' },
        ],
        interpretation: (
          <>La TEA supera a la TNA en {fmtNum((tea - p.tna) * 100, 2)} puntos porcentuales porque los intereses de cada subperíodo se reinvierten.</>
        ),
        chart: (
          <SimpleBars
            yLabel="Tasa anual (%)"
            percent
            items={[
              { label: 'TNA', value: p.tna },
              { label: 'TEA', value: tea },
            ]}
          />
        ),
        chartTitle: 'TNA frente a TEA',
      };
    },
    simulator: (p) => href('tasas', 'tea', { tna: p.tna, m: [1, 2, 3, 4, 6, 12, 24, 52, 365].includes(p.m) ? p.m : 12 }),
  },
  {
    id: 'valor-actual-pagare',
    title: 'Valor actual de un cobro futuro',
    level: 'inicial',
    topic: 'valor-presente',
    source: PROPIO,
    params: [
      { key: 'vf', label: 'Importe a cobrar', kind: 'money', min: 10_000, max: 10_000_000, step: 10_000, default: 500_000 },
      { key: 'i', label: 'Tasa mensual', kind: 'percent', min: 0.001, max: 0.1, step: 0.0005, default: 0.025 },
      { key: 'n', label: 'Plazo', kind: 'int', min: 1, max: 60, default: 6, unit: 'meses' },
    ],
    statement: (p) => (
      <>
        Se cobrarán {fmtMoney(p.vf)} dentro de {p.n} meses. Con una tasa de descuento del {fmtPct(p.i)} mensual, ¿cuánto vale hoy ese cobro?
      </>
    ),
    hint: () => <>Actualizar es dividir por el factor de capitalización (1 + i)ⁿ.</>,
    solve: (p) => {
      const va = toNum(presentValue(p.vf, p.i, p.n));
      return {
        known: [
          ['Valor futuro', fmtMoney(p.vf)],
          ['Tasa', `${fmtPct(p.i)} mensual`],
          ['Plazo', `${p.n} meses`],
        ],
        unknown: 'Valor actual',
        formula: ['VA = VF / (1+i)^n'],
        substitution: [`VA = ${texMoney(p.vf)} / (1 + ${texRate(p.i)})^{${p.n}}`],
        development: [
          { title: 'Factor', math: `(1 + ${texRate(p.i)})^{${p.n}} = ${texNum(toNum(compoundFutureValue(1, p.i, p.n)), 8, 4)}` },
          { title: 'Valor actual', math: `VA = ${texMoney(va)}` },
        ],
        answers: [{ label: 'Valor actual', value: va, kind: 'money' }],
        interpretation: (
          <>
            Recibir {fmtMoney(va)} hoy e invertirlos al {fmtPct(p.i)} mensual es equivalente a cobrar {fmtMoney(p.vf)} dentro de {p.n} meses.
          </>
        ),
        chart: <FlowsTimeline flows={[{ t: p.n, amount: p.vf }]} focal={{ t: 0, value: va, label: `VA ${fmtMoney(va, 0)}` }} unit="meses" />,
        chartTitle: 'Línea de tiempo',
      };
    },
    simulator: (p) => href('valor-temporal', 'valor-actual', { vf: p.vf, i: p.i, n: p.n }),
  },
  {
    id: 'valor-futuro-trimestral',
    title: 'Valor futuro con capitalización trimestral',
    level: 'inicial',
    topic: 'valor-futuro',
    source: PROPIO,
    params: [
      { key: 'c', label: 'Capital', kind: 'money', min: 100_000, max: 10_000_000, step: 50_000, default: 2_000_000 },
      { key: 'tna', label: 'TNA', kind: 'percent', min: 0.01, max: 1, step: 0.005, default: 0.4 },
      { key: 'years', label: 'Plazo', kind: 'int', min: 1, max: 10, default: 2, unit: 'años' },
    ],
    statement: (p) => (
      <>
        Se depositan {fmtMoney(p.c)} a una TNA del {fmtPct(p.tna)} con capitalización trimestral durante {p.years} años. ¿Cuál es el monto final?
      </>
    ),
    hint: () => <>Calculá la tasa trimestral y la cantidad de trimestres del plazo.</>,
    solve: (p) => {
      const j = toNum(periodicFromNominal(p.tna, 4));
      const n = 4 * p.years;
      const vf = toNum(futureValue(p.c, j, n));
      return {
        known: [
          ['Capital', fmtMoney(p.c)],
          ['TNA', `${fmtPct(p.tna)} (capitalización trimestral)`],
          ['Plazo', `${p.years} años = ${n} trimestres`],
        ],
        unknown: 'Valor futuro',
        formula: ['VF = C\\,(1 + \\text{TNA}/4)^{4t}'],
        substitution: [`VF = ${texMoney(p.c)}(1 + ${texNum(j, 6, 2)})^{${n}}`],
        development: [{ title: 'Resultado', math: `VF = ${texMoney(vf)}` }],
        answers: [{ label: 'Valor futuro', value: vf, kind: 'money' }],
        interpretation: (
          <>
            Los intereses totales son {fmtMoney(vf - p.c)}; la tasa efectiva anual de la operación es {fmtPct(toNum(teaFromNominal(p.tna, 4)), 2)}.
          </>
        ),
        chart: <RegimesChart c0={p.c} i={j} n={n} showSimple={false} />,
        chartTitle: 'Capital por trimestre',
      };
    },
    simulator: (p) => href('valor-temporal', 'valor-futuro', { capital: p.c, tna: p.tna, m: 4, years: p.years }),
  },
  // --------------------------------------------------------------- INTERMEDIO
  {
    id: 'tea-a-tem',
    title: 'Tasas equivalentes a una TEA',
    level: 'intermedio',
    topic: 'equivalencia',
    source: PROPIO,
    params: [{ key: 'tea', label: 'TEA', kind: 'percent', min: 0.01, max: 2, step: 0.005, default: 0.5 }],
    statement: (p) => <>Una inversión rinde una TEA del {fmtPct(p.tea)}. ¿Cuáles son las tasas efectivas mensual y trimestral equivalentes?</>,
    hint: () => <>Las tasas efectivas equivalentes no son proporcionales: se relacionan con potencias.</>,
    solve: (p) => {
      const tem = toNum(convertEffective(p.tea, 1, 12));
      const tet = toNum(convertEffective(p.tea, 1, 4));
      return {
        known: [['TEA', fmtPct(p.tea)]],
        unknown: 'TEM y TET equivalentes',
        formula: ['\\text{TEM} = (1+\\text{TEA})^{1/12} - 1', '\\text{TET} = (1+\\text{TEA})^{1/4} - 1'],
        substitution: [`\\text{TEM} = (1 + ${texNum(p.tea, 6, 2)})^{1/12} - 1`, `\\text{TET} = (1 + ${texNum(p.tea, 6, 2)})^{1/4} - 1`],
        development: [
          { title: 'Tasa mensual', math: `\\text{TEM} = ${texPct(tem, 6)}` },
          { title: 'Tasa trimestral', math: `\\text{TET} = ${texPct(tet, 6)}` },
          { title: 'Verificación', math: `(1 + \\text{TEM})^3 - 1 = ${texPct(toNum(convertEffective(tem, 12, 4)), 6)} = \\text{TET}` },
        ],
        answers: [
          { label: 'TEM', value: tem, kind: 'percent' },
          { label: 'TET', value: tet, kind: 'percent' },
        ],
        interpretation: <>La TET no es 3 × TEM ({fmtPct(3 * tem, 4)}), sino algo mayor, porque cada mes los intereses ya generados vuelven a rendir.</>,
        chart: (
          <SimpleBars
            yLabel="Tasa efectiva (%)"
            percent
            items={[
              { label: 'Mensual', value: tem },
              { label: 'Trimestral', value: tet },
              { label: 'Anual', value: p.tea },
            ]}
          />
        ),
        chartTitle: 'Tasas equivalentes',
      };
    },
    simulator: (p) => href('tasas', 'tasa-efectiva', { rate: p.tea, perYear: 1, target: 12 }),
  },
  {
    id: 'tea-objetivo',
    title: 'TNA necesaria para una TEA objetivo',
    level: 'intermedio',
    topic: 'tna-tea',
    source: PROPIO,
    params: [
      { key: 'tea', label: 'TEA objetivo', kind: 'percent', min: 0.01, max: 2, step: 0.005, default: 0.6 },
      { key: 'm', label: 'Capitalizaciones por año', kind: 'int', min: 1, max: 365, default: 12 },
    ],
    statement: (p) => (
      <>
        ¿Qué TNA, con {p.m} capitalizaciones anuales, produce una TEA del {fmtPct(p.tea)}?
      </>
    ),
    hint: () => <>Es el cálculo inverso: primero obtené la tasa efectiva del subperíodo a partir de la TEA.</>,
    solve: (p) => {
      const tna = toNum(nominalFromTea(p.tea, p.m));
      return {
        known: [
          ['TEA', fmtPct(p.tea)],
          ['m', String(p.m)],
        ],
        unknown: 'TNA',
        formula: ['\\text{TNA} = m\\left[(1+\\text{TEA})^{1/m} - 1\\right]'],
        substitution: [`\\text{TNA} = ${p.m}\\left[(1 + ${texNum(p.tea, 6, 2)})^{1/${p.m}} - 1\\right]`],
        development: [
          { title: 'Tasa del subperíodo', math: `j = ${texPct(tna / p.m, 6)}` },
          { title: 'TNA', math: `\\text{TNA} = ${texPct(tna, 4)}` },
          { title: 'Verificación', math: `(1 + ${texNum(tna / p.m, 8, 2)})^{${p.m}} - 1 = ${texPct(toNum(teaFromNominal(tna, p.m)), 4)}` },
        ],
        answers: [{ label: 'TNA', value: tna, kind: 'percent' }],
        interpretation: <>Con capitalización más frecuente alcanza una TNA menor para lograr la misma TEA.</>,
        chart: (
          <SimpleBars
            yLabel="Tasa anual (%)"
            percent
            items={[
              { label: 'TNA necesaria', value: tna },
              { label: 'TEA objetivo', value: p.tea },
            ]}
          />
        ),
        chartTitle: 'TNA y TEA',
      };
    },
    simulator: (p) => href('tasas', 'tea', { mode: 'inverso', tea: p.tea, m: [1, 2, 3, 4, 6, 12, 24, 52, 365].includes(p.m) ? p.m : 12 }),
  },
  {
    id: 'frances-basico',
    title: 'Préstamo francés: cuota, intereses y saldo',
    level: 'intermedio',
    topic: 'amortizacion',
    source: PROPIO,
    params: [
      { key: 'P', label: 'Capital', kind: 'money', min: 100_000, max: 50_000_000, step: 100_000, default: 5_000_000 },
      { key: 'tna', label: 'TNA (capitalización mensual)', kind: 'percent', min: 0.01, max: 1.2, step: 0.005, default: 0.48 },
      { key: 'n', label: 'Cuotas mensuales', kind: 'int', min: 2, max: 120, default: 24 },
      { key: 'k', label: 'Saldo luego de la cuota', kind: 'int', min: 1, max: 119, default: 12 },
    ],
    statement: (p) => (
      <>
        Se toma un préstamo de {fmtMoney(p.P)} en {p.n} cuotas mensuales por sistema francés, a una TNA del {fmtPct(p.tna)}. Calcular la cuota, el total de
        intereses y el saldo adeudado luego de pagar la cuota {Math.min(p.k, p.n - 1)}.
      </>
    ),
    hint: () => <>La tasa mensual es TNA/12. El saldo luego de la cuota k es el valor actual de las cuotas que faltan pagar.</>,
    solve: (p) => {
      const k = Math.min(p.k, p.n - 1);
      const i = p.tna / 12;
      const res = buildSchedule({ principal: p.P, periods: p.n, paymentsPerYear: 12, rate: tna12(p.tna), system: 'frances' });
      const c = res.rows[0].payment;
      const saldo = res.rows[k - 1].closingPrincipal;
      return {
        known: [
          ['Capital', fmtMoney(p.P)],
          ['Tasa mensual', fmtPct(i, 4)],
          ['Cuotas', String(p.n)],
        ],
        unknown: 'Cuota, intereses totales y saldo',
        formula: ['c = P\\,\\dfrac{i(1+i)^n}{(1+i)^n - 1}', 'S_k = c \\cdot \\dfrac{1-(1+i)^{-(n-k)}}{i}'],
        substitution: [`c = ${texMoney(p.P)}\\,\\dfrac{${texRate(i)}(1+${texRate(i)})^{${p.n}}}{(1+${texRate(i)})^{${p.n}} - 1}`],
        development: [
          { title: 'Cuota', math: `c = ${texMoney(toNum(frenchPayment(p.P, i, p.n)))} \\approx ${texMoney(c)}` },
          { title: 'Intereses totales', math: `\\sum I_k = ${texMoney(res.totals.interest)}` },
          { title: `Saldo luego de la cuota ${k}`, math: `S_{${k}} = ${texMoney(saldo)}` },
        ],
        answers: [
          { label: 'Cuota', value: c, kind: 'money', tolerance: 0.001 },
          { label: 'Intereses totales', value: res.totals.interest, kind: 'money', tolerance: 0.002 },
          { label: `Saldo luego de la cuota ${k}`, value: saldo, kind: 'money', tolerance: 0.002 },
        ],
        interpretation: (
          <>
            En la primera cuota el interés representa el {fmtPct(res.rows[0].interest / c, 1)} de la cuota; en la última, apenas el{' '}
            {fmtPct(res.rows[p.n - 1].interest / res.rows[p.n - 1].payment, 1)}.
          </>
        ),
        chart: <ScheduleBars result={res} />,
        chartTitle: 'Composición de las cuotas',
      };
    },
    simulator: (p) => href('amortizacion', 'frances', { principal: p.P, rateValue: p.tna, n: p.n, k: Math.min(p.k, p.n - 1) }),
  },
  {
    id: 'aleman-basico',
    title: 'Préstamo alemán: primera y última cuota',
    level: 'intermedio',
    topic: 'amortizacion',
    source: PROPIO,
    params: [
      { key: 'P', label: 'Capital', kind: 'money', min: 100_000, max: 50_000_000, step: 100_000, default: 3_000_000 },
      { key: 'tna', label: 'TNA (capitalización mensual)', kind: 'percent', min: 0.01, max: 1.2, step: 0.005, default: 0.36 },
      { key: 'n', label: 'Cuotas mensuales', kind: 'int', min: 2, max: 120, default: 12 },
    ],
    statement: (p) => (
      <>
        Un préstamo de {fmtMoney(p.P)} se amortiza en {p.n} cuotas mensuales por sistema alemán con TNA del {fmtPct(p.tna)}. Calcular la primera cuota, la
        última y el total de intereses.
      </>
    ),
    hint: () => <>La amortización es constante: P/n. El interés de cada cuota se calcula sobre el saldo inicial del período.</>,
    solve: (p) => {
      const i = p.tna / 12;
      const res = buildSchedule({ principal: p.P, periods: p.n, paymentsPerYear: 12, rate: tna12(p.tna), system: 'aleman' });
      const ref = buildSchedule({ principal: p.P, periods: p.n, paymentsPerYear: 12, rate: tna12(p.tna), system: 'frances' });
      const A = res.rows[0].amortization;
      return {
        known: [
          ['Capital', fmtMoney(p.P)],
          ['Tasa mensual', fmtPct(i, 4)],
          ['Cuotas', String(p.n)],
        ],
        unknown: 'Primera cuota, última cuota e intereses totales',
        formula: ['A = P/n', 'c_1 = A + P\\,i', 'c_n = A + A\\,i', '\\sum I = i \\cdot A\\,\\dfrac{n(n+1)}{2}'],
        substitution: [`A = ${texMoney(p.P)}/${p.n}`, `c_1 = ${texMoney(A)} + ${texMoney(p.P)} \\times ${texRate(i)}`],
        development: [
          { title: 'Amortización', math: `A = ${texMoney(A)}` },
          { title: 'Primera cuota', math: `c_1 = ${texMoney(res.rows[0].payment)}` },
          { title: 'Última cuota', math: `c_{${p.n}} = ${texMoney(res.rows[p.n - 1].payment)}` },
          { title: 'Intereses totales', math: `${texMoney(res.totals.interest)}` },
        ],
        answers: [
          { label: 'Primera cuota', value: res.rows[0].payment, kind: 'money', tolerance: 0.001 },
          { label: 'Última cuota', value: res.rows[p.n - 1].payment, kind: 'money', tolerance: 0.002 },
          { label: 'Intereses totales', value: res.totals.interest, kind: 'money', tolerance: 0.002 },
        ],
        interpretation: (
          <>
            Frente al francés con las mismas condiciones, el alemán paga {fmtMoney(ref.totals.interest - res.totals.interest)} menos de intereses porque
            devuelve capital más rápido.
          </>
        ),
        chart: <ScheduleBars result={res} compare={ref} />,
        chartTitle: 'Alemán (barras) y cuota francesa (línea)',
      };
    },
    simulator: (p) => href('amortizacion', 'aleman', { principal: p.P, rateValue: p.tna, n: p.n, compare: true }),
  },
  {
    id: 'plazo-fijo-45',
    title: 'Plazo fijo: interés del plazo y TEA',
    level: 'intermedio',
    topic: 'tna-tea',
    source: PROPIO,
    params: [
      { key: 'C', label: 'Capital', kind: 'money', min: 10_000, max: 50_000_000, step: 10_000, default: 1_500_000 },
      { key: 'tna', label: 'TNA (hipotética)', kind: 'percent', min: 0.01, max: 1.2, step: 0.0025, default: 0.32 },
      { key: 'd', label: 'Plazo', kind: 'int', min: 7, max: 365, default: 45, unit: 'días' },
    ],
    statement: (p) => (
      <>
        Se constituye un plazo fijo de {fmtMoney(p.C)} a {p.d} días con una TNA hipotética del {fmtPct(p.tna)} (base 365). Calcular el interés, el rendimiento
        del plazo y la TEA suponiendo renovaciones sucesivas.
      </>
    ),
    hint: () => <>El interés del plazo fijo es simple: C · TNA · días / 365. Para la TEA, el rendimiento del plazo se capitaliza 365/d veces.</>,
    solve: (p) => {
      const r = fixedDeposit({ capital: p.C, tna: p.tna, days: p.d, base: 365 });
      return {
        known: [
          ['Capital', fmtMoney(p.C)],
          ['TNA', fmtPct(p.tna)],
          ['Plazo', `${p.d} días`],
        ],
        unknown: 'Interés, rendimiento del plazo y TEA',
        formula: ['I = C\\cdot\\text{TNA}\\cdot d/365', '\\text{TEA} = (1 + \\text{TNA}\\cdot d/365)^{365/d} - 1'],
        substitution: [`I = ${texMoney(p.C)} \\times ${texNum(p.tna, 4, 2)} \\times ${p.d}/365`],
        development: [
          { title: 'Interés', math: `I = ${texMoney(r.interest)}` },
          { title: 'Rendimiento del plazo', math: `i_{${p.d}} = ${texPct(r.periodRate, 6)}` },
          { title: 'TEA con reinversión', math: `\\text{TEA} = ${texPct(r.teaWithReinvestment, 4)}` },
        ],
        answers: [
          { label: 'Interés', value: r.interest, kind: 'money' },
          { label: 'TEA con reinversión', value: r.teaWithReinvestment, kind: 'percent' },
        ],
        interpretation: (
          <>
            El {fmtPct(r.periodRate, 3)} es el rendimiento de {p.d} días, no un rendimiento anual. La TEA ({fmtPct(r.teaWithReinvestment, 2)}) sólo se obtiene
            si se renueva todo el año a la misma tasa.
          </>
        ),
        chart: (
          <SimpleBars
            yLabel="Tasa (%)"
            percent
            items={[
              { label: 'TNA', value: p.tna },
              { label: `Rendimiento ${p.d} días`, value: r.periodRate },
              { label: 'TEA', value: r.teaWithReinvestment },
            ]}
          />
        ),
        chartTitle: 'Tasas del plazo fijo',
      };
    },
    simulator: (p) => href('bancarias', 'plazo-fijo', { capital: p.C, tna: p.tna, days: p.d }),
  },
  {
    id: 'van-proyecto',
    title: 'VAN de un proyecto de inversión',
    level: 'intermedio',
    topic: 'van',
    source: PROPIO,
    params: [
      { key: 'I0', label: 'Inversión inicial', kind: 'money', min: 100_000, max: 10_000_000, step: 50_000, default: 1_000_000 },
      { key: 'f1', label: 'Flujo año 1', kind: 'money', min: 0, max: 5_000_000, step: 10_000, default: 400_000 },
      { key: 'f2', label: 'Flujo año 2', kind: 'money', min: 0, max: 5_000_000, step: 10_000, default: 450_000 },
      { key: 'f3', label: 'Flujo año 3', kind: 'money', min: 0, max: 5_000_000, step: 10_000, default: 500_000 },
      { key: 'r', label: 'Tasa de descuento anual', kind: 'percent', min: 0, max: 0.6, step: 0.0025, default: 0.15 },
    ],
    statement: (p) => (
      <>
        Un proyecto requiere una inversión de {fmtMoney(p.I0)} y genera {fmtMoney(p.f1)}, {fmtMoney(p.f2)} y {fmtMoney(p.f3)} al final de cada uno de los
        próximos tres años. Con una tasa de descuento del {fmtPct(p.r)} anual, ¿conviene realizarlo?
      </>
    ),
    hint: () => <>Llevá cada flujo al momento 0 dividiendo por (1 + r)ᵗ y sumá todo, incluida la inversión con signo negativo.</>,
    solve: (p) => {
      const flows = [
        { t: 0, amount: -p.I0 },
        { t: 1, amount: p.f1 },
        { t: 2, amount: p.f2 },
        { t: 3, amount: p.f3 },
      ];
      const v = toNum(npv(flows, p.r));
      const det = discountFlows(flows, p.r);
      return {
        known: [
          ['Inversión', fmtMoney(p.I0)],
          ['Flujos', `${fmtMoney(p.f1)} · ${fmtMoney(p.f2)} · ${fmtMoney(p.f3)}`],
          ['Tasa', fmtPct(p.r)],
        ],
        unknown: 'VAN y decisión',
        formula: ['VAN = -I_0 + \\sum_{t=1}^{3} \\dfrac{FC_t}{(1+r)^t}'],
        substitution: [
          `VAN = -${texMoney(p.I0)} + \\frac{${texMoney(p.f1)}}{(1+${texRate(p.r)})} + \\frac{${texMoney(p.f2)}}{(1+${texRate(p.r)})^2} + \\frac{${texMoney(p.f3)}}{(1+${texRate(p.r)})^3}`,
        ],
        development: [
          { title: 'Valores actuales', math: det.map((d) => `t=${d.t}: \\; ${texMoney(d.present)}`) },
          { title: 'VAN', math: `VAN = ${texMoney(v)}` },
        ],
        answers: [{ label: 'VAN', value: v, kind: 'money', tolerance: 0.002 }],
        interpretation:
          v >= 0 ? (
            <>El VAN es positivo: el proyecto rinde más que el {fmtPct(p.r)} exigido y conviene realizarlo.</>
          ) : (
            <>El VAN es negativo: el proyecto no alcanza a rendir el {fmtPct(p.r)} exigido.</>
          ),
        chart: <FlowsTimeline flows={flows} focal={{ t: 0, value: v, label: `VAN ${fmtMoney(v, 0)}` }} unit="años" />,
        chartTitle: 'Flujos del proyecto',
      };
    },
    simulator: () => href('valor-temporal', 'van'),
  },
  // ----------------------------------------------------------------- AVANZADO
  {
    id: 'tir-proyecto',
    title: 'TIR de un proyecto y criterio de decisión',
    level: 'avanzado',
    topic: 'tir',
    source: PROPIO,
    params: [
      { key: 'I0', label: 'Inversión inicial', kind: 'money', min: 100_000, max: 10_000_000, step: 50_000, default: 1_000_000 },
      { key: 'f1', label: 'Flujo semestre 1', kind: 'money', min: 0, max: 5_000_000, step: 10_000, default: 300_000 },
      { key: 'f2', label: 'Flujo semestre 2', kind: 'money', min: 0, max: 5_000_000, step: 10_000, default: 500_000 },
      { key: 'f3', label: 'Flujo semestre 3', kind: 'money', min: 0, max: 5_000_000, step: 10_000, default: 700_000 },
      { key: 'r', label: 'Tasa exigida semestral', kind: 'percent', min: 0, max: 0.6, step: 0.0025, default: 0.15 },
    ],
    statement: (p) => (
      <>
        Hoy se invierten {fmtMoney(p.I0)} y se cobran {fmtMoney(p.f1)}, {fmtMoney(p.f2)} y {fmtMoney(p.f3)} a los 6, 12 y 18 meses. Calcular la TIR semestral,
        su equivalente anual efectiva y decidir si conviene frente a una tasa exigida del {fmtPct(p.r)} semestral.
      </>
    ),
    hint: () => <>La TIR es la tasa que anula el VAN; se obtiene numéricamente. Para anualizar una tasa semestral efectiva, elevá (1 + TIR) al cuadrado.</>,
    solve: (p) => {
      const flows = [
        { t: 0, amount: -p.I0 },
        { t: 1, amount: p.f1 },
        { t: 2, amount: p.f2 },
        { t: 3, amount: p.f3 },
      ];
      const res = irr(flows);
      const t = res.irr ?? NaN;
      const annual = Number.isFinite(t) ? toNum(annualizeEffective(t, 2)) : NaN;
      return {
        known: [
          ['Flujos', `−${fmtMoney(p.I0)} · ${fmtMoney(p.f1)} · ${fmtMoney(p.f2)} · ${fmtMoney(p.f3)}`],
          ['Período', 'semestral'],
          ['Tasa exigida', fmtPct(p.r)],
        ],
        unknown: 'TIR semestral y anual',
        formula: ['0 = -I_0 + \\sum_t \\dfrac{FC_t}{(1+\\text{TIR})^t}', '\\text{TIR}_{\\text{anual}} = (1+\\text{TIR}_{\\text{sem}})^2 - 1'],
        substitution: [`0 = -${texMoney(p.I0)} + \\frac{${texMoney(p.f1)}}{(1+r)} + \\frac{${texMoney(p.f2)}}{(1+r)^2} + \\frac{${texMoney(p.f3)}}{(1+r)^3}`],
        development: [
          { title: 'Resolución numérica', body: <>Newton-Raphson con salvaguarda de bisección: {res.iterations.length} iteraciones.</> },
          { title: 'TIR semestral', math: Number.isFinite(t) ? `\\text{TIR} = ${texPct(t, 4)}` : '\\text{No existe}' },
          { title: 'TIR anual efectiva', math: Number.isFinite(annual) ? `(1 + ${texNum(t, 6, 2)})^2 - 1 = ${texPct(annual, 4)}` : '—' },
        ],
        answers: Number.isFinite(t)
          ? [
              { label: 'TIR semestral', value: t, kind: 'percent', tolerance: 0.002 },
              { label: 'TIR anual efectiva', value: annual, kind: 'percent', tolerance: 0.002 },
            ]
          : [],
        interpretation: Number.isFinite(t) ? (
          t > p.r ? (
            <>La TIR ({fmtPct(t, 2)}) supera la tasa exigida: el VAN a esa tasa es positivo y el proyecto conviene.</>
          ) : (
            <>La TIR ({fmtPct(t, 2)}) no supera la tasa exigida: el VAN a esa tasa es negativo.</>
          )
        ) : (
          <>Los flujos no permiten calcular una TIR.</>
        ),
        chart: <NpvProfileChart flows={flows} rate={p.r} roots={res.roots} />,
        chartTitle: 'Perfil del VAN',
      };
    },
    simulator: () => href('valor-temporal', 'tir'),
  },
  {
    id: 'americano-vs-frances',
    title: 'Costo de intereses: americano frente a francés',
    level: 'avanzado',
    topic: 'amortizacion',
    source: PROPIO,
    params: [
      { key: 'P', label: 'Capital', kind: 'money', min: 100_000, max: 50_000_000, step: 100_000, default: 8_000_000 },
      { key: 'tna', label: 'TNA (mensual)', kind: 'percent', min: 0.01, max: 1.2, step: 0.005, default: 0.42 },
      { key: 'n', label: 'Cuotas', kind: 'int', min: 2, max: 120, default: 18 },
    ],
    statement: (p) => (
      <>
        Para un préstamo de {fmtMoney(p.P)} a {p.n} meses con TNA del {fmtPct(p.tna)}, comparar los intereses totales del sistema americano con los del francés
        y explicar la diferencia.
      </>
    ),
    hint: () => <>Los intereses totales equivalen a la tasa por la suma de los saldos adeudados en cada período.</>,
    solve: (p) => {
      const base = { principal: p.P, periods: p.n, paymentsPerYear: 12, rate: tna12(p.tna) };
      const am = buildSchedule({ ...base, system: 'americano' });
      const fr = buildSchedule({ ...base, system: 'frances' });
      return {
        known: [
          ['Capital', fmtMoney(p.P)],
          ['Tasa mensual', fmtPct(p.tna / 12, 4)],
          ['Plazo', `${p.n} meses`],
        ],
        unknown: 'Intereses totales de cada sistema',
        formula: ['\\text{Americano: } n \\cdot P \\cdot i', '\\text{Francés: } n\\,c - P'],
        substitution: [`${p.n} \\times ${texMoney(p.P)} \\times ${texRate(p.tna / 12)}`, `${p.n} \\times ${texMoney(fr.rows[0].payment)} - ${texMoney(p.P)}`],
        development: [
          { title: 'Americano', math: texMoney(am.totals.interest) },
          { title: 'Francés', math: texMoney(fr.totals.interest) },
          { title: 'Diferencia', math: texMoney(am.totals.interest - fr.totals.interest) },
        ],
        answers: [
          { label: 'Intereses americano', value: am.totals.interest, kind: 'money', tolerance: 0.002 },
          { label: 'Intereses francés', value: fr.totals.interest, kind: 'money', tolerance: 0.002 },
        ],
        interpretation: (
          <>
            En el americano el saldo se mantiene en {fmtMoney(p.P)} hasta el final; en el francés disminuye cuota a cuota. Al adeudar más capital durante más
            tiempo, el americano paga más intereses.
          </>
        ),
        chart: <ScheduleBars result={fr} compare={am} />,
        chartTitle: 'Francés (barras) y cuota americana (línea)',
      };
    },
    simulator: (p) => href('amortizacion', 'comparador', { principal: p.P, rateValue: p.tna, n: p.n }),
  },
  {
    id: 'cambio-sistema',
    title: 'Cambio de sistema durante el préstamo',
    level: 'avanzado',
    topic: 'combinados',
    source: PROPIO,
    params: [
      { key: 'P', label: 'Capital', kind: 'money', min: 1_000_000, max: 50_000_000, step: 100_000, default: 10_000_000 },
      { key: 'tna', label: 'TNA (mensual)', kind: 'percent', min: 0.01, max: 1.2, step: 0.005, default: 0.36 },
      { key: 'n', label: 'Cuotas', kind: 'int', min: 6, max: 120, default: 36 },
      { key: 'desde', label: 'Pasa a alemán desde la cuota', kind: 'int', min: 2, max: 119, default: 6 },
    ],
    statement: (p) => (
      <>
        Un préstamo francés de {fmtMoney(p.P)} a {p.n} meses (TNA {fmtPct(p.tna)}) pasa al sistema alemán desde la cuota {Math.min(p.desde, p.n)}, manteniendo
        el plazo. Calcular la nueva cuota en ese momento y el ahorro total de intereses.
      </>
    ),
    hint: () => <>El saldo luego de la cuota anterior al cambio se amortiza en partes iguales durante las cuotas restantes.</>,
    solve: (p) => {
      const desde = Math.min(p.desde, p.n);
      const base = { principal: p.P, periods: p.n, paymentsPerYear: 12, rate: tna12(p.tna), system: 'frances' as const };
      const orig = buildSchedule(base);
      const mod = buildSchedule({ ...base, events: [{ type: 'sistema', fromPeriod: desde, system: 'aleman' }] });
      const saldo = mod.rows[desde - 1].openingPrincipal;
      const r = p.n - desde + 1;
      return {
        known: [
          ['Capital', fmtMoney(p.P)],
          ['Tasa mensual', fmtPct(p.tna / 12, 4)],
          ['Cambio', `alemán desde la cuota ${desde}`],
        ],
        unknown: `Cuota ${desde} y ahorro de intereses`,
        formula: ['A = S_{k-1}/r', 'c_k = A + S_{k-1}\\,i'],
        substitution: [
          `A = ${texMoney(saldo)}/${r}`,
          `c_{${desde}} = ${texMoney(mod.rows[desde - 1].amortization)} + ${texMoney(saldo)} \\times ${texRate(p.tna / 12)}`,
        ],
        development: [
          { title: `Saldo al inicio de la cuota ${desde}`, math: texMoney(saldo) },
          { title: `Cuota ${desde}`, math: texMoney(mod.rows[desde - 1].payment) },
          { title: 'Intereses', math: [`\\text{Original: } ${texMoney(orig.totals.interest)}`, `\\text{Modificado: } ${texMoney(mod.totals.interest)}`] },
        ],
        answers: [
          { label: `Cuota ${desde}`, value: mod.rows[desde - 1].payment, kind: 'money', tolerance: 0.001 },
          { label: 'Ahorro de intereses', value: orig.totals.interest - mod.totals.interest, kind: 'money', tolerance: 0.005 },
        ],
        interpretation: (
          <>
            La cuota sube de {fmtMoney(orig.rows[desde - 1].payment)} a {fmtMoney(mod.rows[desde - 1].payment)}, pero el capital se devuelve más rápido y el
            costo total de intereses baja.
          </>
        ),
        chart: <ScheduleBars result={mod} compare={orig} />,
        chartTitle: 'Préstamo modificado (barras) y cuota original (línea)',
      };
    },
    simulator: () => href('laboratorio', 'simulador'),
  },
  {
    id: 'capital-desde-cuotas',
    title: 'Reconstruir el capital a partir de las últimas cuotas',
    level: 'avanzado',
    topic: 'combinados',
    source: PROPIO,
    params: [
      { key: 'c', label: 'Cuota (francés)', kind: 'money', min: 10_000, max: 5_000_000, step: 1_000, default: 458_037.94 },
      { key: 'tna', label: 'TNA (mensual)', kind: 'percent', min: 0.01, max: 1.2, step: 0.005, default: 0.36 },
      { key: 'n', label: 'Número total de cuotas', kind: 'int', min: 3, max: 120, default: 36 },
    ],
    statement: (p) => (
      <>
        Las tres últimas cuotas de un préstamo francés fueron de {fmtMoney(p.c)} cada una. La TNA era del {fmtPct(p.tna)} con capitalización mensual y el
        préstamo tenía {p.n} cuotas. ¿Cuál fue el capital original? ¿Podría calcularse sin conocer el número de cuotas?
      </>
    ),
    hint: () => <>El capital es el valor actual de todas las cuotas. Pensá qué información aportan cuotas iguales sobre la cantidad de cuotas.</>,
    solve: (p) => {
      const res = reconstructPrincipal({
        system: 'frances',
        rate: tna12(p.tna),
        paymentsPerYear: 12,
        payments: [p.c, p.c, p.c],
        positionMode: 'ultimas',
        totalPeriods: p.n,
      });
      const sinN = reconstructPrincipal({
        system: 'frances',
        rate: tna12(p.tna),
        paymentsPerYear: 12,
        payments: [p.c, p.c, p.c],
        positionMode: 'ultimas',
        totalPeriods: null,
      });
      const P = res.principal ?? NaN;
      return {
        known: [
          ['Últimas cuotas', fmtMoney(p.c)],
          ['Tasa mensual', fmtPct(p.tna / 12, 4)],
          ['Cuotas', String(p.n)],
        ],
        unknown: 'Capital original',
        formula: ['P = c \\cdot \\dfrac{1-(1+i)^{-n}}{i}'],
        substitution: [`P = ${texMoney(p.c)} \\cdot \\dfrac{1-(1+${texRate(p.tna / 12)})^{-${p.n}}}{${texRate(p.tna / 12)}}`],
        development: [
          { title: 'Capital', math: `P = ${texMoney(P)}` },
          { title: 'Sin conocer n', body: <>{sinN.explanation[0]}</> },
        ],
        answers: [{ label: 'Capital original', value: P, kind: 'money', tolerance: 0.001 }],
        interpretation: (
          <>
            Con n conocido el capital es único. Sin n, el problema tiene {sinN.compatible.length} soluciones compatibles: las cuotas iguales no revelan cuántas
            se pagaron antes.
          </>
        ),
        chart: res.schedule ? <ScheduleBars result={res.schedule} /> : <div className="empty">Sin solución</div>,
        chartTitle: 'Operación reconstruida',
      };
    },
    simulator: () => href('laboratorio', 'capital-original'),
  },
];
