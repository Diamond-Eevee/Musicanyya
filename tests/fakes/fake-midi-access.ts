import type { MidiAvailability, MidiDevice, MidiInputEvent, Unsubscribe } from '../../src/engine/ports.js';

export class FakeMidiAccess {
  public inputs: MidiDevice[] = [];
  public state: MidiAvailability = 'notRequested';
  private listeners = new Set<(ev: MidiInputEvent) => void>();

  request(): Promise<MidiAvailability> {
    return Promise.resolve(this.state);
  }

  on(listener: (event: MidiInputEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
