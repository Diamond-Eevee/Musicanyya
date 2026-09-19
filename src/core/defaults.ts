export const BASE_PPQ = 960;
export const MAX_PPQ = 16777216; // 2^24
export const TICK_LIMIT = 2147483648; // 2^31

export const DEFAULT_TEMPO_QPM = 100;

// Grace note timing
export const GRACE_NOTE_TICKS = (ppq: number) => Math.floor(ppq / 8);
export const GRACE_MAX_STEAL_RATIO = 0.5;
export const GRACE_MIN_REMAINING_TICKS = (ppq: number) => Math.floor(ppq / 16);

// Timeline unrolling
export const MAX_REPEAT_DEPTH = 4;
export const UNROLL_GUARD_FACTOR = 10;
export const UNROLL_HARD_CAP = 20000;
export const INFER_JUMPS_FROM_TEXT = true;

// Dynamics
export const DYNAMIC_VELOCITY: Record<string, number> = {
  ppp: 20,
  pp: 36,
  p: 49,
  mp: 64,
  mf: 76,
  f: 88,
  ff: 104,
  fff: 124,
};
export const DEFAULT_VELOCITY = 80;
export const SFORZANDO_BOOST = 24;
export const ACCENT_BOOST = 12;

export const WEDGE_TARGET_WINDOW_TICKS = (ppq: number) => ppq;
export const WEDGE_DEFAULT_DELTA = 16;

export const VELOCITY_MIN = 1;
export const VELOCITY_MAX = 127;

// Channels
export const PERCUSSION_CHANNEL = 9; // 0-based
export const LIVE_CHANNEL = 15; // 0-based

export const LIVE_VELOCITY_DEFAULT = 80; // or from key velocity
