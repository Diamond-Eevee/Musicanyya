import { describe, expect, it } from 'vitest';
import { LIVE_QUEUE_CAPACITY } from '../../../src/core/defaults.js';
import { LIVE_KIND, LiveQueue, liveKindOf } from '../../../src/engine/worklets/live-queue.js';
import type { InboundMessage } from '../../../src/engine/worklets/score-player.processor.js';

/**
 * 017 T031 (RT review T015 N3, Constitution I): the worklet's live-input queue is a ring of pre-allocated typed-array
 * slots. The port handler validated each `live` message into a fresh object and pushed it onto an array that the drain
 * emptied with `length = 0` (letting V8 free its storage, so the next push reallocated). Now nothing is allocated per
 * message: the handler writes the fields into a slot, the drain reads them and consumes exactly what it applied.
 */

/** Reads every queued entry, head first, as plain tuples (test-side only). */
function contents(queue: LiveQueue): Array<[number, number, number, boolean]> {
  const out: Array<[number, number, number, boolean]> = [];
  for (let i = 0; i < queue.size; i++) {
    out.push([queue.kindAt(i), queue.keyAt(i), queue.velocityAt(i), queue.downAt(i)]);
  }
  return out;
}

describe('LiveQueue: a fixed ring of typed-array slots (017 T031)', () => {
  it('holds up to its capacity, in order; one more is refused and nothing queued changes', () => {
    const queue = new LiveQueue(4);
    for (let k = 0; k < 4; k++) expect(queue.push(LIVE_KIND.on, 60 + k, 100 + k, false)).toBe(true);
    expect(queue.push(LIVE_KIND.off, 99, 0, false)).toBe(false);
    expect(queue.size).toBe(4);
    expect(contents(queue)).toEqual([
      [LIVE_KIND.on, 60, 100, false],
      [LIVE_KIND.on, 61, 101, false],
      [LIVE_KIND.on, 62, 102, false],
      [LIVE_KIND.on, 63, 103, false],
    ]);
  });

  it('consume(n) frees exactly n slots from the head; the rest stay queued, in order (017 T014: no silent loss)', () => {
    const queue = new LiveQueue(4);
    queue.push(LIVE_KIND.on, 60, 90, false);
    queue.push(LIVE_KIND.sustain, 0, 0, true);
    queue.push(LIVE_KIND.off, 60, 0, false);
    queue.consume(2);
    expect(contents(queue)).toEqual([[LIVE_KIND.off, 60, 0, false]]);
    expect(queue.push(LIVE_KIND.allOff, 0, 0, false)).toBe(true);
    expect(queue.push(LIVE_KIND.on, 61, 91, false)).toBe(true);
    expect(queue.push(LIVE_KIND.on, 62, 92, false)).toBe(true);
    expect(queue.push(LIVE_KIND.on, 63, 93, false)).toBe(false); // full again: 4 queued
    expect(contents(queue)).toEqual([
      [LIVE_KIND.off, 60, 0, false],
      [LIVE_KIND.allOff, 0, 0, false],
      [LIVE_KIND.on, 61, 91, false],
      [LIVE_KIND.on, 62, 92, false],
    ]);
  });

  it('wraps around its storage for as long as it runs: 1000 fill-and-drain cycles keep every field', () => {
    const queue = new LiveQueue(LIVE_QUEUE_CAPACITY);
    for (let cycle = 0; cycle < 1000; cycle++) {
      const count = 1 + (cycle % LIVE_QUEUE_CAPACITY); // uneven sizes, so the head moves round the ring
      for (let k = 0; k < count; k++) queue.push(LIVE_KIND.on, (cycle + k) % 128, (cycle * 7 + k) % 128, k % 2 === 0);
      for (let k = 0; k < count; k++) {
        expect(queue.keyAt(k)).toBe((cycle + k) % 128);
        expect(queue.velocityAt(k)).toBe((cycle * 7 + k) % 128);
        expect(queue.downAt(k)).toBe(k % 2 === 0);
      }
      queue.consume(count);
      expect(queue.size).toBe(0);
    }
  });

  it('refuses a capacity below 1 at construction, so the ring arithmetic is always defined (017 T034)', () => {
    expect(() => new LiveQueue(0)).toThrow(RangeError);
    expect(() => new LiveQueue(2.5)).toThrow(RangeError);
  });

  it('consume never goes below empty', () => {
    const queue = new LiveQueue(4);
    queue.push(LIVE_KIND.on, 60, 90, false);
    queue.consume(10);
    expect(queue.size).toBe(0);
    expect(queue.push(LIVE_KIND.off, 60, 0, false)).toBe(true);
    expect(contents(queue)).toEqual([[LIVE_KIND.off, 60, 0, false]]);
  });
});

describe('liveKindOf: the trust-boundary check, without building an object (017 T031, T005)', () => {
  const live = (fields: Record<string, unknown>): InboundMessage => ({ type: 'live', ...fields });

  it('gives the kind of each well-formed message', () => {
    expect(liveKindOf(live({ kind: 'on', key: 0, velocity: 127 }))).toBe(LIVE_KIND.on);
    expect(liveKindOf(live({ kind: 'off', key: 127 }))).toBe(LIVE_KIND.off);
    expect(liveKindOf(live({ kind: 'sustain', down: false }))).toBe(LIVE_KIND.sustain);
    expect(liveKindOf(live({ kind: 'allOff' }))).toBe(LIVE_KIND.allOff);
  });

  it('gives 0 for a malformed one', () => {
    for (const fields of [
      { kind: 'on', velocity: 100 },
      { kind: 'on', key: 60 },
      { kind: 'on', key: 128, velocity: 100 },
      { kind: 'on', key: 60.5, velocity: 100 },
      { kind: 'on', key: 60, velocity: Number.NaN },
      { kind: 'on', key: '60', velocity: 100 },
      { kind: 'off' },
      { kind: 'off', key: -1 },
      { kind: 'sustain' },
      { kind: 'sustain', down: 1 },
      { kind: 'bend', value: 3 },
      {},
    ]) {
      expect(liveKindOf(live(fields)), JSON.stringify(fields)).toBe(0);
    }
  });
});
