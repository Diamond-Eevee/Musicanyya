import type { PracticeSession } from '../core/practice/types.js';
import type { AudioEngine } from '../engine/ports.js';

/** Silences the accompaniment and Orchestra notes a session left ringing; the musician's own keys are not touched. The
 *  accompaniment shares the live channel, so a key the musician still holds is spared (feature 021 FR-006); the
 *  Orchestra has its own channel. */
export function releasePracticeSound(engine: Pick<AudioEngine, 'liveNoteOff'>, session: PracticeSession | null): void {
  if (!session) return;
  for (const key of session.soundingAccompaniment.keys()) {
    if (!session.heldKeys.has(key)) engine.liveNoteOff(key);
  }
  for (const id of session.soundingOrchestra.keys()) {
    const [channel, key] = id.split(':').map(Number);
    if (channel !== undefined && key !== undefined) engine.liveNoteOff(key, channel);
  }
}
