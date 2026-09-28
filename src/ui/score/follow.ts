import {
  FOLLOW_GLIDE_MIN_REDIRECT_MS,
  FOLLOW_GLIDE_MS,
  FOLLOW_GLIDE_REDUCED_MS,
  FOLLOW_TARGET_EPSILON_PX,
  LOOKAHEAD_TOP_GAP_PX,
} from '../../engine/config.js';

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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Starts a glide, or redirects the running one (`active`) from where it is now. Duration 0 means "jump now". */
export function glideTo(
  position: number,
  to: number,
  nowMs: number,
  active: Glide | null,
  reducedMotion: boolean,
): Glide {
  if (reducedMotion) {
    return {
      from: position,
      to,
      startMs: nowMs,
      durationMs: FOLLOW_GLIDE_REDUCED_MS,
      easing: 'inOut',
    };
  }

  if (active !== null) {
    const isRunning = nowMs < active.startMs + active.durationMs;
    if (isRunning) {
      if (Math.abs(to - active.to) < FOLLOW_TARGET_EPSILON_PX) {
        return active;
      }
      const currentPos = glidePosition(active, nowMs).top;
      const remaining = active.startMs + active.durationMs - nowMs;
      const durationMs = Math.max(remaining, FOLLOW_GLIDE_MIN_REDIRECT_MS);
      return {
        from: currentPos,
        to,
        startMs: nowMs,
        durationMs,
        easing: 'out',
      };
    }
  }

  return {
    from: position,
    to,
    startMs: nowMs,
    durationMs: FOLLOW_GLIDE_MS,
    easing: 'inOut',
  };
}

/** The position at `nowMs`; `done` once `nowMs >= startMs + durationMs` (position is then exactly `to`). */
export function glidePosition(glide: Glide, nowMs: number): { top: number; done: boolean } {
  if (glide.durationMs <= 0 || nowMs >= glide.startMs + glide.durationMs) {
    return { top: glide.to, done: true };
  }
  if (nowMs <= glide.startMs) {
    return { top: glide.from, done: false };
  }

  const elapsed = nowMs - glide.startMs;
  const t = Math.max(0, Math.min(1, elapsed / glide.durationMs));
  const factor = glide.easing === 'out' ? easeOutCubic(t) : easeInOutCubic(t);
  const top = glide.from + (glide.to - glide.from) * factor;

  return { top, done: false };
}

/** Moves a glide's whole path by `delta` (page height compensation, score-layout.md section 3 rule 3). */
export function shiftGlide(glide: Glide, delta: number): Glide {
  return {
    ...glide,
    from: glide.from + delta,
    to: glide.to + delta,
  };
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
