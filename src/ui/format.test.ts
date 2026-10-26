import { describe, expect, it } from 'vitest';
import { fmtMoney, fmtPct, parseNumberAR, texNum } from './format';

describe('lectura de números', () => {
  it.each([
    ['10.000.000', 10_000_000],
    ['10000000', 10_000_000],
    ['1.234,56', 1234.56],
    ['3,5', 3.5],
    ['3.5', 3.5],
    ['$ 1.000', 1000],
    ['36 %', 36],
    ['-2', -2],
    ['−2,5', -2.5],
    ['0,125', 0.125],
  ])('"%s" → %d', (input, expected) => {
    expect(parseNumberAR(input)).toBe(expected);
  });
  it('rechaza texto no numérico', () => {
    expect(parseNumberAR('abc')).toBeNull();
    expect(parseNumberAR('')).toBeNull();
    expect(parseNumberAR('1,2,3')).toBeNull();
  });
});

describe('formato', () => {
  it('moneda y porcentaje argentinos', () => {
    expect(fmtMoney(1234567.891)).toBe('$ 1.234.567,89');
    expect(fmtMoney(-5)).toBe('−$ 5,00');
    expect(fmtPct(0.0325)).toBe('3,25 %');
    expect(texNum(1234.5)).toBe('1.234{,}50');
  });
});
