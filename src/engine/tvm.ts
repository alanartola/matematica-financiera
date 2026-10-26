/**
 * Valor temporal del dinero: valor actual, valor futuro, VAN y TIR.
 *
 * Un flujo se ubica en el tiempo mediante `t`, medido en períodos de la tasa
 * utilizada. Con períodos uniformes `t` es entero (0, 1, 2, …); con fechas
 * específicas `t` es la fracción de año transcurrida desde la fecha inicial y la
 * tasa es efectiva anual.
 */
import { dec, ONE, sum, toNum, type Dec, type Num } from './decimal';
import { dayCount, basisDenominator, type DayCountBasis } from './daycount';

export interface Flow {
  t: number;
  amount: number;
}

export interface DatedFlow {
  date: string;
  amount: number;
}

/** VA = VF / (1 + i)ⁿ */
export function presentValue(fv: Num, i: Num, n: Num): Dec {
  return dec(fv).div(ONE.plus(i).pow(dec(n)));
}

/** VF = VA · (1 + i)ⁿ */
export function futureValue(pv: Num, i: Num, n: Num): Dec {
  return dec(pv).times(ONE.plus(i).pow(dec(n)));
}

/** Factor de descuento vⁿ = (1 + i)⁻ⁿ */
export function discountFactor(i: Num, n: Num): Dec {
  return ONE.plus(i).pow(dec(n).neg());
}

export interface DiscountedFlow extends Flow {
  factor: number;
  present: number;
  /** VAN acumulado hasta este flujo inclusive. */
  cumulative: number;
}

/** Detalle del descuento de cada flujo y VAN acumulado. */
export function discountFlows(flows: Flow[], i: Num): DiscountedFlow[] {
  let acc = dec(0);
  return [...flows]
    .sort((a, b) => a.t - b.t)
    .map((f) => {
      const factor = discountFactor(i, f.t);
      const present = dec(f.amount).times(factor);
      acc = acc.plus(present);
      return { ...f, factor: toNum(factor), present: toNum(present), cumulative: toNum(acc) };
    });
}

/** VAN = Σ FCₜ / (1 + i)ᵗ */
export function npv(flows: Flow[], i: Num): Dec {
  if (dec(i).lte(-1)) throw new Error('La tasa debe ser mayor que −100 %.');
  return sum(flows.map((f) => dec(f.amount).times(discountFactor(i, f.t))));
}

/** Convierte flujos fechados en flujos con t = fracción de año desde la primera fecha. */
export function datedToFlows(flows: DatedFlow[], basis: DayCountBasis = 'ACT/365'): Flow[] {
  if (!flows.length) return [];
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const origin = sorted[0].date;
  const den = basisDenominator(basis);
  return sorted.map((f) => ({ t: dayCount(origin, f.date, basis) / den, amount: f.amount }));
}

// ---------------------------------------------------------------------------
// TIR
// ---------------------------------------------------------------------------

function npvFloat(flows: Flow[], r: number): number {
  let s = 0;
  for (const f of flows) s += f.amount / Math.pow(1 + r, f.t);
  return s;
}

function npvDerivFloat(flows: Flow[], r: number): number {
  let s = 0;
  for (const f of flows) s += (-f.t * f.amount) / Math.pow(1 + r, f.t + 1);
  return s;
}

/** Cantidad de cambios de signo en la secuencia de flujos (ignorando ceros). */
export function signChanges(flows: Flow[]): number {
  const signs = [...flows]
    .sort((a, b) => a.t - b.t)
    .filter((f) => f.amount !== 0)
    .map((f) => Math.sign(f.amount));
  let changes = 0;
  for (let k = 1; k < signs.length; k++) if (signs[k] !== signs[k - 1]) changes++;
  return changes;
}

export interface IrrIteration {
  iteration: number;
  method: 'Newton' | 'Bisección';
  rate: number;
  npv: number;
  low: number;
  high: number;
}

export interface IrrResult {
  /** Raíces encontradas en el rango explorado, ordenadas. */
  roots: number[];
  /** Raíz principal (la menor raíz mayor que −100 %), si existe. */
  irr: number | null;
  /** Registro de iteraciones de la raíz principal. */
  iterations: IrrIteration[];
  signChanges: number;
  warnings: string[];
  /** Rango explorado (tasas periódicas). */
  searchRange: [number, number];
}

const MIN_RATE = -0.99;
const MAX_RATE = 10; // 1000 % por período

/** Refina una raíz dentro de [a, b] (con signos opuestos) con Newton salvaguardado por bisección. */
function refineRoot(flows: Flow[], a: number, b: number, scale: number, log?: IrrIteration[]): number {
  let lo = a;
  let hi = b;
  let flo = npvFloat(flows, lo);
  let x = (lo + hi) / 2;
  for (let k = 1; k <= 100; k++) {
    const fx = npvFloat(flows, x);
    const dfx = npvDerivFloat(flows, x);
    let method: IrrIteration['method'] = 'Newton';
    let next = dfx !== 0 ? x - fx / dfx : NaN;
    if (!(next > lo && next < hi) || !Number.isFinite(next)) {
      next = (lo + hi) / 2;
      method = 'Bisección';
    }
    log?.push({ iteration: k, method, rate: x, npv: fx, low: lo, high: hi });
    if (fx === 0 || Math.abs(fx) <= 1e-15 * scale) return x;
    // Actualiza el intervalo que contiene la raíz.
    if (Math.sign(fx) === Math.sign(flo)) {
      lo = x;
      flo = fx;
    } else {
      hi = x;
    }
    if (Math.abs(next - x) < 1e-14 * Math.max(1, Math.abs(x)) || hi - lo < 1e-15) return next;
    x = next;
  }
  return x;
}

/**
 * Busca todas las tasas que anulan el VAN en (−99 %, 1000 %] por período.
 * Explora una grilla densa en ln(1 + r), detecta cambios de signo y refina cada raíz.
 */
export function irr(flows: Flow[]): IrrResult {
  const warnings: string[] = [];
  const nonZero = flows.filter((f) => f.amount !== 0);
  const changes = signChanges(flows);
  const result: IrrResult = { roots: [], irr: null, iterations: [], signChanges: changes, warnings, searchRange: [MIN_RATE, MAX_RATE] };
  if (nonZero.length < 2 || changes === 0) {
    warnings.push('Los flujos no cambian de signo: no existe una tasa que anule el VAN.');
    return result;
  }
  const scale = Math.max(...nonZero.map((f) => Math.abs(f.amount)));
  const lnMin = Math.log(1 + MIN_RATE);
  const lnMax = Math.log(1 + MAX_RATE);
  const steps = 4000;
  let prevR = MIN_RATE;
  let prevV = npvFloat(flows, prevR);
  const brackets: [number, number][] = [];
  for (let k = 1; k <= steps; k++) {
    const r = Math.exp(lnMin + ((lnMax - lnMin) * k) / steps) - 1;
    const v = npvFloat(flows, r);
    if (v === 0) brackets.push([r, r]);
    else if (Math.sign(v) !== Math.sign(prevV) && prevV !== 0) brackets.push([prevR, r]);
    prevR = r;
    prevV = v;
  }
  for (const [a, b] of brackets) {
    const root = a === b ? a : refineRoot(flows, a, b, scale);
    if (!result.roots.some((x) => Math.abs(x - root) < 1e-9)) result.roots.push(root);
  }
  result.roots.sort((x, y) => x - y);
  if (result.roots.length) {
    result.irr = result.roots[0];
    const main = brackets.find(([a, b]) => result.irr! >= a - 1e-12 && result.irr! <= b + 1e-12)!;
    if (main[0] !== main[1]) refineRoot(flows, main[0], main[1], scale, result.iterations);
  }
  if (changes > 1) {
    warnings.push(
      `Los flujos cambian de signo ${changes} veces: por la regla de los signos de Descartes puede haber hasta ${changes} tasas que anulen el VAN.`,
    );
  }
  if (result.roots.length > 1) {
    warnings.push(
      `Se encontraron ${result.roots.length} TIR distintas. La TIR no es un criterio de decisión confiable en este caso: conviene decidir con el VAN a la tasa de costo de oportunidad.`,
    );
  }
  if (!result.roots.length) {
    warnings.push('No se encontró ninguna tasa entre −99 % y 1000 % por período que anule el VAN.');
  }
  return result;
}

/** VAN evaluado sobre una grilla de tasas (perfil del VAN) para graficar. */
export function npvProfile(flows: Flow[], from: number, to: number, points = 161): { rate: number; npv: number }[] {
  const out: { rate: number; npv: number }[] = [];
  for (let k = 0; k < points; k++) {
    const r = from + ((to - from) * k) / (points - 1);
    if (r <= -1) continue;
    out.push({ rate: r, npv: npvFloat(flows, r) });
  }
  return out;
}

/** Anualización de una tasa periódica efectiva: (1 + r)^m − 1. */
export function annualizeEffective(r: Num, m: number): Dec {
  return ONE.plus(r).pow(m).minus(1);
}
