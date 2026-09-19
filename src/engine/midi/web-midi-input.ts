import type { MidiAvailability, MidiDevice, MidiInput, MidiInputEvent, Unsubscribe } from '../ports.js';

export class WebMidiInput implements MidiInput {
  availability(): MidiAvailability {
    throw new Error('Not implemented');
  }

  request(): Promise<MidiAvailability> {
    throw new Error('Not implemented');
  }

  devices(): readonly MidiDevice[] {
    throw new Error('Not implemented');
  }

  on(listener: (event: MidiInputEvent) => void): Unsubscribe {
    throw new Error('Not implemented');
  }
}
