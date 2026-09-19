import {
  ACCENT_BOOST,
  DEFAULT_VELOCITY,
  DYNAMIC_VELOCITY,
  SFORZANDO_BOOST,
  VELOCITY_MAX,
  VELOCITY_MIN,
  WEDGE_DEFAULT_DELTA,
  WEDGE_TARGET_WINDOW_TICKS,
} from '../defaults.js';
import type { Part } from '../score/model.js';
import type { MeasurePass, Ticks } from './types.js';

export interface VelocitySegment {
  startTick: Ticks;
  velocity: number;
}

export interface WedgeSpan {
  startTick: Ticks;
  endTick: Ticks;
  type: 'crescendo' | 'diminuendo';
  startVelocity: number;
  targetVelocity: number;
}

function unrolledTicksByMeasure(passes: MeasurePass[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const pass of passes) {
    const arr = map.get(pass.measureIndex);
    if (arr) arr.push(pass.startTick);
    else map.set(pass.measureIndex, [pass.startTick]);
  }
  return map;
}

/**
 * Piecewise-constant velocity baseline from dynamic marks (R-8.6) and `<sound dynamics="%">`
 * overrides, re-applied at every unrolled pass of their measure. At the same tick, sound dynamics
 * takes precedence over a mark (both come from the same direction).
 */
export function buildDynamicsBaseline(part: Part, passes: MeasurePass[]): VelocitySegment[] {
  const startTicksByMeasure = unrolledTicksByMeasure(passes);
  const events: { tick: number; velocity: number; priority: number }[] = [];

  for (const mark of part.dynamics) {
    const velocity = DYNAMIC_VELOCITY[mark.type];
    if (velocity === undefined) continue;
    const starts = startTicksByMeasure.get(mark.measureIndex) ?? [];
    for (const start of starts) {
      events.push({ tick: start + mark.onsetInMeasure, velocity, priority: 0 });
    }
  }
  for (const sd of part.soundDynamics) {
    const velocity = Math.round(0.9 * sd.percent);
    const starts = startTicksByMeasure.get(sd.measureIndex) ?? [];
    for (const start of starts) {
      events.push({ tick: start + sd.onsetInMeasure, velocity, priority: 1 });
    }
  }

  events.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : a.priority - b.priority));

  const segments: VelocitySegment[] = [];
  let last: VelocitySegment | undefined;
  for (const event of events) {
    if (last && last.startTick === event.tick) {
      // Higher priority (sound dynamics) already processed second and overrides the mark.
      last.velocity = event.velocity;
      continue;
    }
    if (last && last.velocity === event.velocity) continue;
    const segment: VelocitySegment = { startTick: event.tick, velocity: event.velocity };
    segments.push(segment);
    last = segment;
  }
  return segments;
}

export function velocityAt(baseline: VelocitySegment[], tick: Ticks): number {
  let v = DEFAULT_VELOCITY;
  for (const s of baseline) {
    if (s.startTick > tick) break;
    v = s.velocity;
  }
  return v;
}

/**
 * Pairs each wedge start with its matching stop (by `number`) and resolves the target velocity:
 * the next dynamic within WEDGE_TARGET_WINDOW_TICKS after the stop, else the start velocity offset
 * by WEDGE_DEFAULT_DELTA (up for a crescendo, down for a diminuendo).
 */
export function buildWedgeSpans(
  part: Part,
  passes: MeasurePass[],
  baseline: VelocitySegment[],
  ppq: number,
): WedgeSpan[] {
  const startTicksByMeasure = unrolledTicksByMeasure(passes);
  interface Event {
    tick: number;
    type: 'crescendo' | 'diminuendo' | 'stop';
    number: number;
  }
  interface OpenEvent {
    tick: number;
    type: 'crescendo' | 'diminuendo';
    number: number;
  }
  const events: Event[] = [];
  for (const w of part.wedges) {
    const starts = startTicksByMeasure.get(w.measureIndex) ?? [];
    for (const start of starts) {
      events.push({ tick: start + w.onsetInMeasure, type: w.type, number: w.number });
    }
  }
  events.sort((a, b) => a.tick - b.tick);

  const spans: WedgeSpan[] = [];
  const openByNumber = new Map<number, OpenEvent>();
  for (const ev of events) {
    if (ev.type === 'stop') {
      const open = openByNumber.get(ev.number);
      if (!open) continue;
      openByNumber.delete(ev.number);
      const startVelocity = velocityAt(baseline, open.tick);
      const windowEnd = ev.tick + WEDGE_TARGET_WINDOW_TICKS(ppq);
      let targetVelocity: number;
      // The next dynamic (mark or sound override) within WEDGE_TARGET_WINDOW_TICKS at or after the stop.
      const next = baseline.find((s) => s.startTick >= ev.tick && s.startTick <= windowEnd);
      if (next) {
        targetVelocity = next.velocity;
      } else {
        const delta = open.type === 'crescendo' ? WEDGE_DEFAULT_DELTA : -WEDGE_DEFAULT_DELTA;
        targetVelocity = clampVelocity(startVelocity + delta);
      }
      spans.push({
        startTick: open.tick,
        endTick: ev.tick,
        type: open.type,
        startVelocity,
        targetVelocity,
      });
    } else {
      openByNumber.set(ev.number, { tick: ev.tick, type: ev.type, number: ev.number });
    }
  }
  spans.sort((a, b) => a.startTick - b.startTick);
  return spans;
}

export function velocityInWedge(span: WedgeSpan, tick: Ticks): number {
  if (tick <= span.startTick) return span.startVelocity;
  if (tick >= span.endTick) return span.targetVelocity;
  const ratio = (tick - span.startTick) / (span.endTick - span.startTick);
  return Math.round(span.startVelocity + (span.targetVelocity - span.startVelocity) * ratio);
}

export function findWedgeAt(spans: WedgeSpan[], tick: Ticks): WedgeSpan | undefined {
  return spans.find((s) => tick >= s.startTick && tick <= s.endTick);
}

export function clampVelocity(v: number): number {
  return Math.min(VELOCITY_MAX, Math.max(VELOCITY_MIN, Math.round(v)));
}

export function applyBoosts(velocity: number, boosts: { sforzando: boolean; accent: boolean }): number {
  let v = velocity;
  if (boosts.sforzando) v += SFORZANDO_BOOST;
  if (boosts.accent) v += ACCENT_BOOST;
  return clampVelocity(v);
}

export interface ResolveVelocityInput {
  velocityOverride: number | null;
  accent: boolean;
  sforzando?: boolean;
  tick: Ticks;
  baseline: VelocitySegment[];
  wedgeVelocity: number | null;
}

/** Precedence per R-8.6: note-level override, else wedge-interpolated, else the ambient baseline. */
export function resolveNoteVelocity(input: ResolveVelocityInput): number {
  const base =
    input.velocityOverride !== null
      ? input.velocityOverride
      : (input.wedgeVelocity ?? velocityAt(input.baseline, input.tick));
  return applyBoosts(base, { sforzando: input.sforzando ?? false, accent: input.accent });
}
