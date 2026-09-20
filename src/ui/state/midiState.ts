import type { MidiAvailability, MidiDevice } from '../../engine/ports.js';

class MidiState {
  availability: MidiAvailability = 'notRequested';
  devices: MidiDevice[] = [];
  latencyMs: number | null = null;
  pressedKeys = new Set<number>();
  sustainDown = false;
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
  (window as any).__MIDI_STATE__ = midiState;
}
