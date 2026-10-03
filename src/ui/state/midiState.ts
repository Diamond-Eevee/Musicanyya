import type { MidiAvailability, MidiDevice } from '../../engine/ports.js';

/** Whether the keyboard can sound (feature 021, data-model.md section 1): `locked` while the browser holds the audio
 *  back until a click, `loading` while the SoundFont loads, `ready`, or `failed` (terminal until reload). */
export type LiveSound = 'locked' | 'loading' | 'ready' | 'failed';

class MidiState {
  availability: MidiAvailability = 'notRequested';
  devices: MidiDevice[] = [];
  latencyMs: number | null = null;
  pressedKeys = new Set<number>();
  sustainDown = false;
  liveSound: LiveSound = 'loading';
  /** True from the moment the last connected keyboard is lost until one connects again or the popover is opened, so the
   *  bar's "MIDI keyboard disconnected" is never missed (feature 021 US3, data-model.md section 2). */
  lostRecently = false;
  /** True once the "click anywhere to turn the sound on" hint was triggered this page load; never goes back. */
  lockedHintShown = false;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const l of this.listeners) l();
  }
}

export const midiState = new MidiState();
if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only (tests/e2e/*.spec.ts read pressed keys and sustain state this way); `any` here
  // is attaching to `Window`, which has no index signature for app-specific globals.
  (window as Window & { __MIDI_STATE__?: MidiState }).__MIDI_STATE__ = midiState;
}
