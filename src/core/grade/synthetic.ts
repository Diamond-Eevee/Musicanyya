import type { Ticks } from '../score/model.js';
import type { ExpectedNote, PerformanceLog, RecordedMessage } from './types.js';

/** A canned performance of the expected notes (009 T054): the input of the `e2e-synthetic-grade` test seam. */
export type SyntheticKind = 'nothing' | 'correct' | 'semitoneHigh';

const VELOCITY = 80;

/**
 * A Performance log for a run's expected notes without playing it: `nothing` presses no key, `correct` every expected key at
 * its onset, `semitoneHigh` every key one semitone above the written one. `audioTimeOf` puts a timeline tick on the log's
 * clock (the caller knows the tempo map and the count-in). Pure and deterministic; presses only, in playing order.
 */
export function syntheticLog(
  expected: readonly ExpectedNote[],
  kind: SyntheticKind,
  audioTimeOf: (timelineTick: Ticks) => number,
): PerformanceLog {
  const messages: RecordedMessage[] = [];
  if (kind !== 'nothing') {
    const offset = kind === 'semitoneHigh' ? 1 : 0;
    for (const note of expected) {
      const audioTimeSec = audioTimeOf(note.onsetTick);
      messages.push({
        kind: 'noteOn',
        key: note.key + offset,
        velocity: VELOCITY,
        down: false,
        audioTimeSec,
        timeStampMs: audioTimeSec * 1000,
        deviceId: 'synthetic',
      });
    }
  }
  messages.sort((a, b) => a.audioTimeSec - b.audioTimeSec || a.key - b.key);
  return { version: 1, messages, droppedMessages: 0 };
}
