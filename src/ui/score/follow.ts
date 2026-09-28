import { FOLLOW_TARGET_EPSILON_PX, LOOKAHEAD_TOP_GAP_PX } from '../../engine/config.js';

export interface Span {
  top: number;
  bottom: number;
}

export interface LookaheadInput {
  current: Span; // box of the g.system that holds the cursor's measure
  next: Span | null; // box of the following g.system in reading order; null when unknown or absent
  nextKnown: boolean; // false: there is a next system but its page is not mounted
  scrollTop: number;
  clearHeight: number; // scroll element clientHeight - insetState.bottom
  maxScrollTop: number; // scrollHeight - clientHeight
}

export type Easing = 'inOut' | 'out';

export interface Glide {
  from: number;
  to: number;
  startMs: number; // performance.now() time base, same as the rAF loop
  durationMs: number;
  easing: Easing;
}

function inClear(span: Span, scrollTop: number, clearHeight: number): boolean {
  return (
    span.top >= scrollTop - FOLLOW_TARGET_EPSILON_PX &&
    span.bottom <= scrollTop + clearHeight + FOLLOW_TARGET_EPSILON_PX
  );
}

/** The scrollTop to move to, or null when the view should stay where it is. Pure and deterministic. */
export function lookaheadTarget(input: LookaheadInput): number | null {
  const { current, next, nextKnown, scrollTop, clearHeight, maxScrollTop } = input;

  if (inClear(current, scrollTop, clearHeight)) {
    if (next === null && nextKnown) {
      return null;
    }
    if (next !== null && inClear(next, scrollTop, clearHeight)) {
      return null;
    }
  }

  const unboundedTarget = current.top - LOOKAHEAD_TOP_GAP_PX;
  const maxLimit = Math.max(0, maxScrollTop);
  const target = Math.max(0, Math.min(unboundedTarget, maxLimit));

  if (Math.abs(target - scrollTop) < FOLLOW_TARGET_EPSILON_PX) {
    return null;
  }

  return target;
}
