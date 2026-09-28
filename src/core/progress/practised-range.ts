/** R-18/R-9 - the bars a Practice session covered, for a `practised` progress event. Pure (Principle V): no DOM, no
 *  Web API. */

/** The first and last written bar (1-based) of the events, or null for none. A loop, not `Math.min(...bars)`: a very
 *  large Score is legal input, and spreading a couple of hundred thousand events into arguments throws a RangeError
 *  (a file must never break the app, Principle III). */
export function practisedBarRange(
  events: readonly { measureIndex: number }[],
): { fromMeasure: number; toMeasure: number } | null {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const { measureIndex } of events) {
    if (measureIndex < first) first = measureIndex;
    if (measureIndex > last) last = measureIndex;
  }
  return events.length === 0 ? null : { fromMeasure: first + 1, toMeasure: last + 1 };
}
