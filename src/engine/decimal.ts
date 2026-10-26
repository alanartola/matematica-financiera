/**
 * Configuración numérica del motor financiero.
 *
 * Todos los cálculos internos se realizan con `decimal.js` (aritmética decimal de
 * precisión arbitraria) para evitar los errores de representación binaria del
 * punto flotante (por ejemplo, 0,1 + 0,2 ≠ 0,3). Los resultados se convierten a
 * `number` recién al entregarse a la interfaz o a los gráficos.
 */
import Decimal from 'decimal.js';

/** Constructor decimal aislado: 40 dígitos significativos, redondeo comercial. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = Decimal;
export type Num = Decimal | number | string;

export const dec = (x: Num): Dec => new D(x);
export const ZERO = new D(0);
export const ONE = new D(1);

/** Cantidad de decimales de la unidad monetaria (centavos). */
export const MONEY_DECIMALS = 2;

/**
 * Tolerancia monetaria: medio centavo. Un saldo cuyo valor absoluto no supera
 * esta tolerancia se considera cancelado.
 */
export const MONEY_TOLERANCE = new D('0.005');

/** Modo de redondeo de los importes de cada fila de un cuadro de marcha. */
export type RoundingMode = 'centavos' | 'exacto';

/** Redondeo monetario a centavos con criterio "mitad hacia arriba". */
export function roundMoney(x: Dec, mode: RoundingMode = 'centavos'): Dec {
  return mode === 'centavos' ? x.toDecimalPlaces(MONEY_DECIMALS, D.ROUND_HALF_UP) : x;
}

export const toNum = (x: Dec): number => x.toNumber();

/** Suma de una lista de decimales. */
export function sum(values: Dec[]): Dec {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

/** Igualdad dentro de una tolerancia absoluta. */
export function approxEqual(a: Num, b: Num, tol: Num = MONEY_TOLERANCE): boolean {
  return dec(a).minus(dec(b)).abs().lte(dec(tol));
}
