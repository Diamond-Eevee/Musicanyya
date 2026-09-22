import type { Inversion } from './types.js';

export type HandSide = 'left' | 'right';

/** The fingering rule (data-model.md §5.1): the interval pattern of each triad shape is the same in
 *  every key, so fingering is a fixed table indexed by inversion and hand, never computed per note or
 *  per key - root position (3rd+3rd) RH 1-3-5 / LH 5-3-1; first inversion (3rd+4th) RH 1-2-5 /
 *  LH 5-3-1; second inversion (4th+3rd) RH 1-3-5 / LH 5-2-1. */
const TRIAD_FINGERING: Record<Inversion, Record<HandSide, readonly [number, number, number]>> = {
  0: { right: [1, 3, 5], left: [5, 3, 1] },
  1: { right: [1, 2, 5], left: [5, 3, 1] },
  2: { right: [1, 3, 5], left: [5, 2, 1] },
};

export function triadFingering(inversion: Inversion, hand: HandSide): readonly [number, number, number] {
  return TRIAD_FINGERING[inversion][hand];
}

/** Fails loudly rather than putting the wrong finger under a note in 24 files at once
 *  (contracts/exercise-definition.md §2.3). */
export function assertFingeringLength(fingering: readonly number[], noteCount: number, context: string): void {
  if (fingering.length !== noteCount) {
    throw new Error(
      `Fingering length ${fingering.length} does not match the voicing's ${noteCount} note(s) (${context})`,
    );
  }
}
