import { describe, expect, it } from 'vitest';

describe('Malformed sweep', () => {
  it('returns a typed error for every malformed fixture', () => {
    expect(false).toBe(true);
  });

  it('never throws in a mutation fuzz loop', () => {
    expect(false).toBe(true);
  });
});
