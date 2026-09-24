import { describe, expect, it } from 'vitest';
import { add, cmp, fromTicks, q, show } from '../../../tools/library/fidelity/time';

describe('QuarterTime', () => {
  it('q() reduces fractions', () => {
    expect(q(2, 4)).toEqual({ num: 1, den: 2 });
    expect(q(12, 8)).toEqual({ num: 3, den: 2 });
    expect(q(0, 4)).toEqual({ num: 0, den: 1 });
  });

  it('add() adds and reduces', () => {
    expect(add(q(1, 4), q(1, 4))).toEqual(q(1, 2));
    expect(add(q(1, 3), q(1, 6))).toEqual(q(1, 2));
    expect(add(q(0, 1), q(3, 8))).toEqual(q(3, 8));
  });

  it('cmp() works by cross-multiplication', () => {
    expect(cmp(q(1, 4), q(1, 4))).toBe(0);
    expect(cmp(q(1, 3), q(1, 4))).toBeGreaterThan(0);
    expect(cmp(q(1, 4), q(1, 3))).toBeLessThan(0);
  });

  it('fromTicks() converts integer ticks to QuarterTime', () => {
    // 128 ticks at 384 PPQ is 128/384 = 1/3 (a triplet eighth)
    expect(fromTicks(128, 384)).toEqual({ num: 1, den: 3 });
    // 1 tick at 3 PPQ is 1/3
    expect(fromTicks(1, 3)).toEqual({ num: 1, den: 3 });
  });

  it('show() formats mixed numbers', () => {
    expect(show(q(0, 1))).toBe('0');
    expect(show(q(1, 4))).toBe('1/4');
    expect(show(q(1, 1))).toBe('1');
    expect(show(q(5, 4))).toBe('1 1/4');
    expect(show(q(8, 3))).toBe('2 2/3');
  });
});
