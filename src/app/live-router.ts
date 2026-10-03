import type { AudioEngine, MidiInputEvent } from '../engine/ports.js';

/** The part of the Audio engine the live router drives (live-sound.md section 3). */
export type LiveSoundPort = Pick<AudioEngine, 'liveNoteOn' | 'liveNoteOff' | 'liveSustain' | 'liveAllOff'>;

/**
 * Sounds one MIDI message of the musician (feature 021, live-sound.md section 3): every key and the pedal, first and
 * exactly once, with no condition on mode, run phase, Score or popup (FR-004, FR-005). `session.ts` calls it first in its
 * MIDI listener, before any state update, so that nothing delays the sound. Kept apart so that Node tests can drive the
 * real routing with fakes (tests/engine/live-router.test.ts).
 */
export function routeLiveInput(engine: LiveSoundPort, event: MidiInputEvent): void {
  switch (event.type) {
    case 'noteOn':
      engine.liveNoteOn(event.key, event.velocity);
      break;
    case 'noteOff':
      engine.liveNoteOff(event.key);
      break;
    case 'sustain':
      engine.liveSustain(event.down);
      break;
    case 'deviceLost':
      engine.liveAllOff();
      break;
    default:
      break;
  }
}
