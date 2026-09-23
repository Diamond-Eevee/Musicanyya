import { describe, expect, it } from 'vitest';

describe('planted errors', () => {
  it('reports one pitch change exactly', () => {
    expect(true).toBe(false);
  });
  it('reports one duration change exactly', () => {
    expect(true).toBe(false);
  });
  it('reports one missing bar exactly', () => {
    expect(true).toBe(false);
  });
  it('reports one missing repeat exactly', () => {
    expect(true).toBe(false);
  });
  it('reports one spelling change exactly', () => {
    expect(true).toBe(false);
  });
  it('reports one grace note change exactly', () => {
    expect(true).toBe(false);
  });
  it('reports one melody note change exactly', () => {
    expect(true).toBe(false);
  });
});
