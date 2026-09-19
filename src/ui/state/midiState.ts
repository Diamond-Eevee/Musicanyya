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
    this.listeners.forEach(l => l());
  }
}

export const midiState = new MidiState();
