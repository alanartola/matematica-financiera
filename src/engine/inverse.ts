/**
 * Cálculos inversos sobre operaciones de préstamo.
 *
 * Reconstrucción del capital original: para una tasa, un sistema y una cantidad
 * total de cuotas `n` fijos, cada cuota (incluidos IVA sobre intereses y seguro
 * sobre saldo) es una función LINEAL del capital P:
 *
 *     cuota_k = P · g_k(n, i) + gasto fijo
 *
 * Por lo tanto, P se obtiene por mínimos cuadrados con las cuotas conocidas y la
 * calidad del ajuste (residuos) indica si los datos son compatibles. Cuando `n` no
 * se conoce, se exploran todos los valores posibles y se analiza si el capital
 * queda identificado de manera única.
 */
import { D, dec, ONE, roundMoney, toNum } from './decimal';
import { periodicRate, type RateSpec } from './rates';
import { annuityFactor, buildSchedule, frenchPayment, frenchTerm, SYSTEM_LABELS, type AmortSystem, type BulletMode, type ScheduleResult } from './amortization';

export interface InverseCharges {
  /** IVA sobre intereses incluido en las cuotas informadas. */
  ivaOnInterest: number;
  /** Seguro por período sobre el saldo de capital inicial del período. */
  insuranceOnBalance: number;
  /** Cargo fijo incluido en cada cuota. */
  fixedFee: number;
}

export interface InverseCapitalInput {
  system: AmortSystem;
  bulletMode?: BulletMode;
  rate: RateSpec;
  paymentsPerYear: number;
  /** Cuotas conocidas, consecutivas y en orden cronológico. */
  payments: number[];
  /** 'ultimas': las cuotas conocidas son las últimas; 'absoluta': se conoce la posición de la primera. */
  positionMode: 'ultimas' | 'absoluta';
  firstPosition?: number;
  /** Número total de cuotas, si se conoce. */
  totalPeriods?: number | null;
  charges?: InverseCharges;
  /** Diferencia máxima admitida por cuota, en pesos (predeterminada: $ 1). */
  tolerance?: number;
  /** Máximo número de cuotas explorado cuando n es desconocido. */
  maxPeriods?: number;
}

export interface InverseCandidate {
  n: number;
  positions: number[];
  principal: number;
  fitted: number[];
  residuals: number[];
  maxResidual: number;
}

export type InverseStatus =
  /** Capital y número de cuotas identificados. */
  | 'unica'
  /** El capital queda identificado aunque n no (p. ej. sistema americano). */
  | 'capital-unico'
  /** Infinitas combinaciones (n, P) compatibles: falta un dato. */
  | 'multiples'
  /** Ninguna combinación reproduce las cuotas. */
  | 'sin-solucion'
  /** Los datos no permiten plantear el problema. */
  | 'datos-insuficientes';

export interface VerificationRow {
  position: number;
  entered: number;
  reconstructed: number;
  difference: number;
}

export interface InverseCapitalResult {
  status: InverseStatus;
  periodicRate: number;
  principal: number | null;
  n: number | null;
  compatible: InverseCandidate[];
  best: InverseCandidate | null;
  explanation: string[];
  missing: string[];
  discrepancies: string[];
  verification: VerificationRow[];
  schedule: ScheduleResult | null;
  /** Tasa implícita en las cuotas (sistema alemán, últimas cuotas, sin cargos). */
  impliedRate: number | null;
  scannedUpTo: number | null;
  /** Estimación algebraica (mínimos cuadrados) sin redondear. */
  estimatedPrincipal: number | null;
  /** ¿El capital informado reproduce las cuotas al centavo? */
  exactMatch: boolean;
}

/**
 * Tolerancia predeterminada por cuota. Con redondeo a centavos, la última cuota
 * absorbe el redondeo acumulado y puede diferir algunos centavos de las demás.
 */
export const DEFAULT_INVERSE_TOLERANCE = 1;

interface UnitTerms {
  payment: number;
  interestPaid: number;
  openingPrincipal: number;
}

/** Cuota k (1-indexada) de un préstamo de capital 1 con n cuotas a la tasa i. */
function unitTerms(system: AmortSystem, bulletMode: BulletMode, i: number, n: number, k: number): UnitTerms {
  switch (system) {
    case 'frances': {
      if (i === 0) {
        const opening = 1 - (k - 1) / n;
        return { payment: 1 / n, interestPaid: 0, openingPrincipal: opening };
      }
      const fn = Math.pow(1 + i, n);
      const opening = (fn - Math.pow(1 + i, k - 1)) / (fn - 1);
      const c = i / (1 - Math.pow(1 + i, -n));
      return { payment: c, interestPaid: i * opening, openingPrincipal: opening };
    }
    case 'aleman': {
      const opening = (n - k + 1) / n;
      return { payment: 1 / n + i * opening, interestPaid: i * opening, openingPrincipal: opening };
    }
    case 'americano':
      return { payment: k < n ? i : 1 + i, interestPaid: i, openingPrincipal: 1 };
    case 'bullet': {
      if (k < n) return { payment: 0, interestPaid: 0, openingPrincipal: 1 };
      const total = bulletMode === 'compuesto' ? Math.pow(1 + i, n) : 1 + i * n;
      return { payment: total, interestPaid: total - 1, openingPrincipal: 1 };
    }
  }
}

function fitCandidate(input: InverseCapitalInput, i: number, n: number, positions: number[]): InverseCandidate | null {
  const ch = input.charges ?? { ivaOnInterest: 0, insuranceOnBalance: 0, fixedFee: 0 };
  const g = positions.map((k) => {
    const u = unitTerms(input.system, input.bulletMode ?? 'compuesto', i, n, k);
    return u.payment + ch.ivaOnInterest * u.interestPaid + ch.insuranceOnBalance * u.openingPrincipal;
  });
  const y = input.payments.map((c) => c - ch.fixedFee);
  const gg = g.reduce((s, x) => s + x * x, 0);
  if (gg === 0) return null;
  const P = g.reduce((s, x, k) => s + x * y[k], 0) / gg;
  const fitted = g.map((x) => P * x + ch.fixedFee);
  const residuals = input.payments.map((c, k) => c - fitted[k]);
  return { n, positions, principal: P, fitted, residuals, maxResidual: Math.max(...residuals.map(Math.abs)) };
}

function positionsFor(input: InverseCapitalInput, n: number): number[] {
  const count = input.payments.length;
  const first = input.positionMode === 'ultimas' ? n - count + 1 : input.firstPosition ?? 1;
  return input.payments.map((_, k) => first + k);
}

const money = (x: number) => `$ ${x.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function reconstructPrincipal(input: InverseCapitalInput): InverseCapitalResult {
  const i = toNum(periodicRate(input.rate, input.paymentsPerYear));
  const tol = input.tolerance ?? DEFAULT_INVERSE_TOLERANCE;
  const maxN = input.maxPeriods ?? 480;
  const result: InverseCapitalResult = {
    status: 'datos-insuficientes',
    periodicRate: i,
    principal: null,
    n: null,
    compatible: [],
    best: null,
    explanation: [],
    missing: [],
    discrepancies: [],
    verification: [],
    schedule: null,
    impliedRate: null,
    scannedUpTo: null,
    estimatedPrincipal: null,
    exactMatch: false,
  };
  const count = input.payments.length;
  const hasCharges = !!input.charges && (input.charges.ivaOnInterest > 0 || input.charges.insuranceOnBalance > 0 || input.charges.fixedFee > 0);

  // 1. Datos conocidos.
  if (count === 0 || input.payments.some((c) => !Number.isFinite(c) || c < 0)) {
    result.explanation.push('Se necesita al menos una cuota conocida con importe mayor o igual a cero.');
    result.missing.push('Importe de las cuotas conocidas');
    return result;
  }
  if (input.payments.every((c) => c === 0)) {
    result.explanation.push('Todas las cuotas conocidas son nulas: no contienen información sobre el capital.');
    result.missing.push('Al menos una cuota con importe positivo');
    return result;
  }
  if ((input.system === 'americano' || input.system === 'bullet') && i === 0) {
    result.explanation.push('Con tasa cero las cuotas intermedias no dependen del capital; sólo la última cuota lo revela.');
  }
  const lastKnown = input.positionMode === 'absoluta' ? (input.firstPosition ?? 1) + count - 1 : count;
  if (input.positionMode === 'absoluta' && !(input.firstPosition && input.firstPosition >= 1)) {
    result.explanation.push('Indicá la posición de la primera cuota conocida.');
    result.missing.push('Posición de la primera cuota conocida');
    return result;
  }

  // 2. Exploración de n.
  const knownN = input.totalPeriods && input.totalPeriods > 0 ? input.totalPeriods : null;
  if (knownN !== null && knownN < lastKnown) {
    result.explanation.push(`El número total de cuotas (${knownN}) es menor que la posición de la última cuota conocida (${lastKnown}).`);
    result.missing.push('Número total de cuotas coherente con las posiciones');
    return result;
  }
  const candidatesN = knownN !== null ? [knownN] : Array.from({ length: Math.max(maxN - lastKnown + 1, 0) }, (_, k) => lastKnown + k);
  if (knownN === null) result.scannedUpTo = maxN;
  const all: InverseCandidate[] = [];
  for (const n of candidatesN) {
    const cand = fitCandidate(input, i, n, positionsFor(input, n));
    if (cand && cand.principal > 0) all.push(cand);
  }
  result.compatible = all.filter((c) => c.maxResidual <= tol);
  result.best = all.reduce<InverseCandidate | null>((b, c) => (!b || c.maxResidual < b.maxResidual ? c : b), null);

  // Tasa implícita (alemán, últimas cuotas, sin cargos): c_k − c_{k+1} = A·i y c_n = A(1+i).
  if (input.system === 'aleman' && input.positionMode === 'ultimas' && count >= 2 && !hasCharges) {
    const diff = input.payments[count - 2] - input.payments[count - 1];
    const A = input.payments[count - 1] - diff;
    if (A > 0 && diff >= 0) result.impliedRate = diff / A;
  }

  // 3. Análisis de unicidad.
  const comp = result.compatible;
  if (comp.length === 0) {
    result.status = 'sin-solucion';
    result.explanation.push('Ninguna combinación de capital y número de cuotas reproduce los importes ingresados con la tasa y el sistema indicados.');
    if (result.best) {
      result.explanation.push(
        `El mejor ajuste (n = ${result.best.n}, capital ≈ ${money(result.best.principal)}) deja una diferencia máxima de ${money(result.best.maxResidual)} por cuota, superior a la tolerancia de ${money(tol)}.`,
      );
    }
    result.discrepancies.push(
      'La tasa informada puede no ser la utilizada (TNA frente a TEA, otra capitalización o interés por días efectivos).',
      'Las cuotas pueden incluir IVA, seguros, comisiones u otros cargos no declarados.',
      'El sistema de amortización puede ser distinto del indicado.',
      'Pudo haber cambios de tasa, pagos anticipados o refinanciaciones durante la operación.',
      'La entidad puede aplicar otro criterio de redondeo: probá con una tolerancia mayor.',
      'La posición de las cuotas conocidas puede estar mal indicada.',
    );
    if (result.impliedRate !== null && Math.abs(result.impliedRate - i) > 1e-6) {
      result.discrepancies.unshift(
        `En el sistema alemán la diferencia entre cuotas consecutivas revela la tasa: las cuotas ingresadas implican una tasa periódica de ${(result.impliedRate * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 })} %, distinta de la indicada (${(i * 100).toLocaleString('es-AR', { maximumFractionDigits: 4 })} %).`,
      );
    }
    return result;
  }

  const minP = Math.min(...comp.map((c) => c.principal));
  const maxP = Math.max(...comp.map((c) => c.principal));
  const sameP = maxP - minP <= Math.max(0.01, 1e-9 * maxP);

  if (comp.length === 1) {
    result.status = 'unica';
    result.principal = comp[0].principal;
    result.n = comp[0].n;
    result.explanation.push(
      knownN !== null
        ? `Con n = ${knownN} cuotas, el capital queda determinado de manera única.`
        : `Sólo n = ${comp[0].n} reproduce las cuotas: el capital y el plazo quedan determinados de manera única.`,
    );
  } else if (sameP) {
    result.status = 'capital-unico';
    result.principal = comp[0].principal;
    result.n = null;
    result.explanation.push(
      `Hay ${comp.length} valores de n compatibles (de ${comp[0].n} a ${comp[comp.length - 1].n}${result.scannedUpTo && comp[comp.length - 1].n === result.scannedUpTo ? ' o más' : ''}), pero todos conducen al mismo capital.`,
      input.system === 'americano'
        ? 'En el sistema americano el capital adeudado no cambia hasta el vencimiento: la cuota de interés revela el capital (P = cuota / i) sin importar el plazo.'
        : 'El capital está identificado aunque el número total de cuotas no lo esté.',
    );
  } else {
    result.status = 'multiples';
    result.explanation.push(
      `Existen ${comp.length} combinaciones compatibles${result.scannedUpTo && comp[comp.length - 1].n === result.scannedUpTo ? ' (y más allá del rango explorado)' : ''}: el capital va de ${money(minP)} a ${money(maxP)} según el número total de cuotas.`,
    );
    if (input.system === 'frances') {
      result.explanation.push('En el sistema francés con tasa fija todas las cuotas son iguales: las últimas cuotas no revelan cuántas se pagaron antes. Cada n adicional agrega una cuota más al valor actual.');
    } else if (input.system === 'aleman') {
      result.explanation.push(
        'En el sistema alemán las últimas cuotas revelan la amortización constante A (y la tasa), pero no cuántas cuotas tuvo la operación: P = A · n.',
        'Alternativa: si se conoce la posición de las cuotas (por ejemplo, cuotas 10, 11 y 12), el número total de cuotas queda determinado.',
      );
    } else if (input.system === 'bullet') {
      result.explanation.push('En el Bullet sólo la última cuota contiene información: el capital depende de cuántos períodos se capitalizaron.');
    }
    result.missing.push('Número total de cuotas de la operación');
    return result;
  }

  // 4. Reconstrucción y verificación con el motor (redondeo a centavos).
  const n = result.n ?? comp[0].n;
  const ch = input.charges ?? { ivaOnInterest: 0, insuranceOnBalance: 0, fixedFee: 0 };
  const positions = positionsFor(input, n);
  const verify = (principal: number) => {
    const schedule = buildSchedule({
      principal,
      periods: n,
      paymentsPerYear: input.paymentsPerYear,
      rate: input.rate,
      system: input.system,
      bulletMode: input.bulletMode,
    });
    const rows = positions.map((k, idx) => {
      const row = schedule.rows[k - 1];
      const total = dec(row.payment)
        .plus(roundMoney(dec(row.interestPaid).times(ch.ivaOnInterest)))
        .plus(roundMoney(dec(row.openingPrincipal).times(ch.insuranceOnBalance)))
        .plus(ch.fixedFee);
      return { position: k, entered: input.payments[idx], reconstructed: toNum(total), difference: toNum(dec(input.payments[idx]).minus(total)) };
    });
    return { schedule, rows, maxDiff: Math.max(...rows.map((x) => Math.abs(x.difference))) };
  };
  // El ajuste por mínimos cuadrados absorbe el redondeo de la última cuota. Se prueban
  // capitales "redondos" cercanos: el más simple que reproduce las cuotas al centavo
  // es indistinguible del estimado con la información disponible.
  const estimate = result.principal!;
  const positivePayments = input.payments.map((c) => c - ch.fixedFee).filter((c) => c > 0);
  const meanPayment = positivePayments.reduce((s, c) => s + c, 0) / Math.max(positivePayments.length, 1);
  // Incertidumbre del capital ≈ tolerancia por cuota × (capital / cuota media).
  const window = Math.max(1, (Math.max(tol, 0.01) * estimate) / Math.max(meanPayment, 1e-9));
  let chosen = verify(toNum(roundMoney(dec(estimate))));
  result.exactMatch = chosen.maxDiff <= 0.01;
  result.estimatedPrincipal = estimate;
  for (let digits = 9; digits >= 0; digits--) {
    const unit = 10 ** digits;
    const candidate = Math.round(estimate / unit) * unit;
    if (candidate <= 0 || Math.abs(candidate - estimate) > window) continue;
    const attempt = verify(candidate);
    if (attempt.maxDiff <= 0.01) {
      chosen = attempt;
      result.exactMatch = true;
      result.principal = candidate;
      if (candidate !== toNum(roundMoney(dec(estimate)))) {
        result.explanation.push(
          `El ajuste algebraico estima ${money(estimate)}; el capital ${money(candidate)} reproduce al centavo las cuotas ingresadas con redondeo a centavos, por lo que se informa ese valor.`,
        );
      }
      break;
    }
  }
  if (!result.exactMatch) result.principal = toNum(roundMoney(dec(estimate)));
  result.schedule = chosen.schedule;
  result.verification = chosen.rows;
  const maxDiff = chosen.maxDiff;
  if (maxDiff > tol) {
    result.discrepancies.push(
      `Al reconstruir el cuadro con redondeo a centavos, la diferencia máxima es ${money(maxDiff)}: puede deberse al criterio de redondeo de la entidad.`,
    );
  }
  if (result.status === 'capital-unico') {
    result.explanation.push(`El cuadro de verificación se construye con n = ${n} (el menor compatible) sólo a modo ilustrativo.`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Otros cálculos inversos (sin cargos, tasa fija, períodos uniformes)
// ---------------------------------------------------------------------------

export interface SolveLog {
  iteration: number;
  rate: number;
  value: number;
}

export interface InverseSimpleResult {
  ok: boolean;
  value: number | null;
  message: string;
  log?: SolveLog[];
}

/**
 * Capital financiado a partir de una cuota conocida.
 *  - Francés: P = c · a(n,i).
 *  - Alemán (primera cuota): c₁ = P/n + P·i  ⇒  P = c₁ / (1/n + i).
 *  - Americano (cuota de interés): c = P·i  ⇒  P = c / i.
 *  - Bullet (pago único): P = c / (1+i)ⁿ  o  c / (1 + i·n).
 */
export function principalFromPayment(system: AmortSystem, payment: number, i: number, n: number, bulletMode: BulletMode = 'compuesto'): InverseSimpleResult {
  const c = dec(payment);
  switch (system) {
    case 'frances':
      return { ok: true, value: toNum(c.times(annuityFactor(i, n))), message: 'P = c · [1 − (1+i)⁻ⁿ] / i' };
    case 'aleman':
      return { ok: true, value: toNum(c.div(ONE.div(n).plus(i))), message: 'P = c₁ / (1/n + i), con c₁ = primera cuota' };
    case 'americano':
      if (i === 0) return { ok: false, value: null, message: 'Con tasa cero la cuota de interés es nula y no revela el capital.' };
      return { ok: true, value: toNum(c.div(i)), message: 'P = cuota de interés / i' };
    case 'bullet':
      return {
        ok: true,
        value: toNum(bulletMode === 'compuesto' ? c.div(ONE.plus(i).pow(n)) : c.div(ONE.plus(dec(i).times(n)))),
        message: bulletMode === 'compuesto' ? 'P = pago final / (1+i)ⁿ' : 'P = pago final / (1 + i·n)',
      };
  }
}

/** Tasa implícita de un préstamo francés: resuelve P·i/(1 − (1+i)⁻ⁿ) = c. */
export function impliedRateFrench(principal: number, n: number, payment: number): InverseSimpleResult {
  const P = principal;
  const c = payment;
  if (!(P > 0 && c > 0 && n >= 1)) return { ok: false, value: null, message: 'Capital, cuota y plazo deben ser positivos.' };
  if (c * n < P - 1e-9) return { ok: false, value: null, message: 'La suma de las cuotas es menor que el capital: no existe una tasa no negativa compatible.' };
  if (Math.abs(c * n - P) <= 1e-9 * P) return { ok: true, value: 0, message: 'La suma de las cuotas iguala al capital: tasa cero.', log: [] };
  const f = (i: number) => (P * i) / (1 - Math.pow(1 + i, -n)) - c;
  let lo = 1e-12;
  let hi = 1;
  while (f(hi) < 0 && hi < 1e6) hi *= 2;
  const log: SolveLog[] = [];
  let x = Math.min(Math.max((c * n - P) / (P * n) * 2, lo), hi); // aproximación inicial
  for (let k = 1; k <= 100; k++) {
    const fx = f(x);
    log.push({ iteration: k, rate: x, value: fx });
    if (Math.abs(fx) < 1e-10 * c) break;
    if (fx > 0) hi = x;
    else lo = x;
    const h = Math.max(x * 1e-7, 1e-12);
    const dfx = (f(x + h) - f(x - h)) / (2 * h);
    let next = x - fx / dfx;
    if (!(next > lo && next < hi) || !Number.isFinite(next)) next = (lo + hi) / 2;
    x = next;
  }
  // Verificación con aritmética decimal.
  const check = frenchPayment(P, x, n);
  return { ok: true, value: x, message: `Cuota recalculada con la tasa hallada: ${money(toNum(check))}`, log };
}

/** Tasa implícita para los demás sistemas (soluciones cerradas). */
export function impliedRate(system: AmortSystem, principal: number, n: number, payment: number, bulletMode: BulletMode = 'compuesto'): InverseSimpleResult {
  const P = dec(principal);
  const c = dec(payment);
  switch (system) {
    case 'frances':
      return impliedRateFrench(principal, n, payment);
    case 'aleman': {
      const i = c.minus(P.div(n)).div(P);
      if (i.lt(0)) return { ok: false, value: null, message: 'La primera cuota es menor que la amortización P/n: no hay tasa no negativa compatible.' };
      return { ok: true, value: toNum(i), message: 'i = (c₁ − P/n) / P, con c₁ = primera cuota' };
    }
    case 'americano':
      return { ok: true, value: toNum(c.div(P)), message: 'i = cuota de interés / P' };
    case 'bullet': {
      if (c.lt(P)) return { ok: false, value: null, message: 'El pago final es menor que el capital.' };
      const i = bulletMode === 'compuesto' ? c.div(P).pow(ONE.div(n)).minus(1) : c.div(P).minus(1).div(n);
      return { ok: true, value: toNum(i), message: bulletMode === 'compuesto' ? 'i = (pago final / P)^(1/n) − 1' : 'i = (pago final / P − 1) / n' };
    }
  }
}

/** Cantidad de cuotas. */
export function impliedTerm(system: AmortSystem, principal: number, i: number, payment: number): InverseSimpleResult {
  switch (system) {
    case 'frances': {
      const n = frenchTerm(principal, i, payment);
      if (n === null) return { ok: false, value: null, message: 'La cuota no alcanza a cubrir el interés del primer período: la deuda nunca se cancela.' };
      return { ok: true, value: toNum(n), message: 'n = −ln(1 − P·i/c) / ln(1+i)' };
    }
    case 'aleman': {
      const den = dec(payment).minus(dec(principal).times(i));
      if (den.lte(0)) return { ok: false, value: null, message: 'La primera cuota no supera el interés del primer período.' };
      return { ok: true, value: toNum(dec(principal).div(den)), message: 'n = P / (c₁ − P·i), con c₁ = primera cuota' };
    }
    default:
      return {
        ok: false,
        value: null,
        message: `En el sistema ${SYSTEM_LABELS[system]} las cuotas intermedias no dependen del plazo: el plazo no puede deducirse de una cuota.`,
      };
  }
}

/** Saldo de capital luego de pagar la cuota k. */
export function outstandingBalance(system: AmortSystem, principal: number, i: number, n: number, k: number, paymentsPerYear = 12): InverseSimpleResult {
  if (k < 0 || k > n) return { ok: false, value: null, message: 'La cuota debe estar entre 0 y n.' };
  if (k === 0) return { ok: true, value: principal, message: 'Antes de la primera cuota el saldo es el capital.' };
  const schedule = buildSchedule({ principal, periods: n, paymentsPerYear, rate: { kind: 'TEP', value: i, perYear: paymentsPerYear }, system });
  const row = schedule.rows[k - 1];
  const formula: Record<AmortSystem, string> = {
    frances: 'Sₖ = c · a(n − k, i)',
    aleman: 'Sₖ = P · (n − k) / n',
    americano: 'Sₖ = P (hasta el vencimiento)',
    bullet: 'Sₖ = P · (1+i)ᵏ (capital más intereses capitalizados)',
  };
  return { ok: true, value: row.closingPrincipal + row.closingAccrued, message: formula[system] };
}

/** Utilidad de redondeo hacia una cifra "redonda" para sugerir capitales originales. */
export function roundToSignificant(x: number, digits = 4): number {
  if (x === 0) return 0;
  return toNum(new D(x).toSignificantDigits(digits));
}


