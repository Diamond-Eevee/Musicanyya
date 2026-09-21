import type { MidiAvailability, MidiDevice, MidiInput, MidiInputEvent, Unsubscribe } from '../../src/engine/ports.js';

/** A minimal `MidiInput` port double: `fire` pushes an event straight to every subscriber, so a test can drive a
 *  controller with `noteOn`/`noteOff`/`sustain` messages without a real Web MIDI device. */
export class FakeMidiInput implements MidiInput {
  private listeners = new Set<(event: MidiInputEvent) => void>();
  public grantState: MidiAvailability = 'available';
  public deviceList: MidiDevice[] = [];

  availability(): MidiAvailability {
    return this.grantState;
  }
  async request(): Promise<MidiAvailability> {
    return this.grantState;
  }
  devices(): readonly MidiDevice[] {
    return this.deviceList;
  }
  on(listener: (event: MidiInputEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  fire(event: MidiInputEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
