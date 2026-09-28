import { describe, expect, it } from 'vitest';
import { practisedBarRange } from '../../../src/core/progress/practised-range.js';

describe('practisedBarRange (T105)', () => {
  it('is the first and last written bar (1-based) of the events a Practice session covered', () => {
    const events = [2, 3, 3, 4, 5].map((measureIndex) => ({ measureIndex }));
    expect(practisedBarRange(events)).toEqual({ fromMeasure: 3, toMeasure: 6 });
  });

  it('does not assume the events are in order', () => {
    const events = [7, 2, 9, 4].map((measureIndex) => ({ measureIndex }));
    expect(practisedBarRange(events)).toEqual({ fromMeasure: 3, toMeasure: 10 });
  });

  it('is null when there are no events', () => {
    expect(practisedBarRange([])).toBeNull();
  });

  it('handles a very large Score: 200,000 events do not overflow the call stack', () => {
    // `Math.max(...array)` throws a RangeError from roughly 120,000 arguments; a Score this size is legal input.
    const events = Array.from({ length: 200_000 }, (_, i) => ({ measureIndex: i % 5000 }));
    expect(practisedBarRange(events)).toEqual({ fromMeasure: 1, toMeasure: 5000 });
  });
});
