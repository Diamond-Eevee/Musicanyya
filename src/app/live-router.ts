import type { AudioEngine, MidiInputEvent } from '../engine/ports.js';
import { practiceState } from '../ui/state/practiceState.js';

/** The part of the Audio engine the live router drives (live-sound.md section 3). */
export type LiveSoundPort = Pick<AudioEngine, 'liveNoteOn' | 'liveNoteOff' | 'liveSustain' | 'liveAllOff'>;

/**
 * Sounds one MIDI message of the musician (feature 021, live-sound.md section 3). `session.ts` calls it first in its MIDI
 * listener, before any state update, so that nothing delays the sound. Extracted so that Node tests can drive the real
 * routing with fakes (tests/engine/live-router.test.ts).
 */
export function routeLiveInput(engine: LiveSoundPort, event: MidiInputEvent): void {
  // Behaviour of builds 003-020, moved here unchanged by T008: Play mode left the sound to the Play controller.
  const playMode = practiceState.get().mode === 'play';
  switch (event.type) {
    case 'noteOn':
      if (!playMode) engine.liveNoteOn(event.key, event.velocity);
      break;
    case 'noteOff':
      if (!playMode) engine.liveNoteOff(event.key);
      break;
    case 'sustain':
      if (!playMode) engine.liveSustain(event.down);
      break;
    case 'deviceLost':
      engine.liveAllOff();
      break;
    default:
      break;
  }
}
