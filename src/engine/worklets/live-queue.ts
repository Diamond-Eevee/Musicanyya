import type { InboundMessage } from './score-player.processor.js';

/**
 * Live-input kinds as small integers, for the typed-array queue (017 T031). 0 means "not a well-formed `live`
 * message" (see `liveKindOf`).
 */
export const LIVE_KIND = { on: 1, off: 2, sustain: 3, allOff: 4 } as const;
export type LiveKind = (typeof LIVE_KIND)[keyof typeof LIVE_KIND];

const isMidiByte = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 127;

/**
 * Checks a `live` message at the trust boundary, in the message handler (017 T005, from 001 T162), without building
 * anything (017 T031): the kind of a well-formed message, or 0 for anything else, which the caller drops and counts.
 * So the drain in `process()` never passes `undefined` or an out-of-range key to the synth.
 */
export function liveKindOf(msg: InboundMessage): LiveKind | 0 {
  switch (msg.kind) {
    case 'on':
      return isMidiByte(msg.key) && isMidiByte(msg.velocity) ? LIVE_KIND.on : 0;
    case 'off':
      return isMidiByte(msg.key) ? LIVE_KIND.off : 0;
    case 'sustain':
      return typeof msg.down === 'boolean' ? LIVE_KIND.sustain : 0;
    case 'allOff':
      return LIVE_KIND.allOff;
    default:
      return 0;
  }
}

/**
 * The worklet's queue of live input (MIDI in, accompaniment) between the port handler and `process()` (017 T031, from
 * RT review T015 N3; Constitution I). A ring of `capacity` slots in typed arrays allocated once: `push` (handler) writes
 * the fields into the next free slot, the drain (render quantum) reads them by position from the head and then
 * `consume`s exactly the entries it applied, so nothing is allocated per message and an early stop cannot lose
 * entries (017 T014).
 */
export class LiveQueue {
  readonly capacity: number;
  private readonly kinds: Uint8Array;
  private readonly keys: Uint8Array;
  private readonly velocities: Uint8Array;
  private readonly downs: Uint8Array;
  private head = 0;
  private count = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError(`LiveQueue capacity must be >= 1: ${capacity}`);
    this.capacity = capacity; // at least 1, so `% capacity` is always defined (thrown here, at construction, never later)
    this.kinds = new Uint8Array(capacity);
    this.keys = new Uint8Array(capacity);
    this.velocities = new Uint8Array(capacity);
    this.downs = new Uint8Array(capacity);
  }

  /** Entries queued and not yet consumed. */
  get size(): number {
    return this.count;
  }

  /** Queues one entry; false when the queue is full (the entry is dropped and the caller counts it). */
  push(kind: LiveKind, key: number, velocity: number, down: boolean): boolean {
    if (this.count >= this.capacity) return false;
    const slot = (this.head + this.count) % this.capacity;
    this.kinds[slot] = kind;
    this.keys[slot] = key;
    this.velocities[slot] = velocity;
    this.downs[slot] = down ? 1 : 0;
    this.count++;
    return true;
  }

  /** The kind of the entry `index` places after the head (0 <= index < size). */
  kindAt(index: number): LiveKind {
    return this.kinds[this.slotOf(index)] as LiveKind;
  }

  keyAt(index: number): number {
    return this.keys[this.slotOf(index)] as number;
  }

  velocityAt(index: number): number {
    return this.velocities[this.slotOf(index)] as number;
  }

  downAt(index: number): boolean {
    return this.downs[this.slotOf(index)] === 1;
  }

  /** Frees the first `n` entries (all of them if `n` is larger). */
  consume(n: number): void {
    const taken = n < this.count ? n : this.count;
    this.head = (this.head + taken) % this.capacity;
    this.count -= taken;
  }

  private slotOf(index: number): number {
    return (this.head + index) % this.capacity;
  }
}
