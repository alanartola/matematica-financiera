/**
 * Regímenes de interés simple y compuesto con períodos uniformes.
 */
import { dec, ONE, toNum, type Dec, type Num } from './decimal';

/** I = C₀ · i · n */
export function simpleInterest(c0: Num, i: Num, n: Num): Dec {
  return dec(c0).times(i).times(n);
}

/** VF = C₀ · (1 + i · n) */
export function simpleFutureValue(c0: Num, i: Num, n: Num): Dec {
  return dec(c0).times(ONE.plus(dec(i).times(n)));
}

/** VF = C₀ · (1 + i)ⁿ */
export function compoundFutureValue(c0: Num, i: Num, n: Num): Dec {
  return dec(c0).times(ONE.plus(i).pow(dec(n)));
}

export interface SimplePeriod {
  t: number;
  /** Capital original (no varía en interés simple). */
  capital: number;
  /** Interés generado en el período t (constante: C₀·i). */
  periodInterest: number;
  /** Interés acumulado hasta t: C₀·i·t. */
  accumulatedInterest: number;
  /** Monto acumulado: C₀·(1 + i·t). */
  amount: number;
}

/** Evolución período a período del interés simple, desde t = 0 hasta t = n. */
export function simpleSchedule(c0: Num, i: Num, n: number): SimplePeriod[] {
  const C = dec(c0);
  const perPeriod = C.times(i);
  const rows: SimplePeriod[] = [];
  for (let t = 0; t <= n; t++) {
    const acc = perPeriod.times(t);
    rows.push({
      t,
      capital: toNum(C),
      periodInterest: t === 0 ? 0 : toNum(perPeriod),
      accumulatedInterest: toNum(acc),
      amount: toNum(C.plus(acc)),
    });
  }
  return rows;
}

export interface CompoundPeriod {
  t: number;
  /** Capital al inicio del período (incluye intereses capitalizados previos). */
  opening: number;
  /** Interés del período: capital inicial del período · i. */
  periodInterest: number;
  /** Capital al cierre: inicial + interés del período. */
  closing: number;
  /** Interés acumulado desde t = 0. */
  accumulatedInterest: number;
  /** Parte del interés del período generada por intereses capitalizados ("interés sobre interés"). */
  interestOnInterest: number;
}

/**
 * Evolución del interés compuesto. La fila t describe el período que termina en t
 * (la fila 0 sólo informa el capital inicial).
 */
export function compoundSchedule(c0: Num, i: Num, n: number): CompoundPeriod[] {
  const C = dec(c0);
  const rate = dec(i);
  const rows: CompoundPeriod[] = [{ t: 0, opening: toNum(C), periodInterest: 0, closing: toNum(C), accumulatedInterest: 0, interestOnInterest: 0 }];
  let balance = C;
  for (let t = 1; t <= n; t++) {
    const interest = balance.times(rate);
    const closing = balance.plus(interest);
    rows.push({
      t,
      opening: toNum(balance),
      periodInterest: toNum(interest),
      closing: toNum(closing),
      accumulatedInterest: toNum(closing.minus(C)),
      interestOnInterest: toNum(interest.minus(C.times(rate))),
    });
    balance = closing;
  }
  return rows;
}

/** Plazo para que un capital se multiplique por k con interés simple: n = (k − 1) / i. */
export function simpleTermForMultiple(k: Num, i: Num): Dec {
  if (dec(i).lte(0)) throw new Error('La tasa debe ser positiva.');
  return dec(k).minus(1).div(i);
}
