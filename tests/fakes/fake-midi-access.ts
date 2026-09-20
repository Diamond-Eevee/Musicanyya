import type { MidiAvailability, MidiDevice, MidiInputEvent, Unsubscribe } from '../../src/engine/ports.js';

export class FakeMidiInput {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output' = 'input';
  state: 'connected' | 'disconnected' = 'connected';
  connection: 'open' | 'closed' | 'pending' = 'open';
  onmidimessage: ((ev: any) => any) | null = null;
  onstatechange: ((ev: any) => any) | null = null;

  constructor(id: string, name: string, manufacturer: string) {
    this.id = id;
    this.name = name;
    this.manufacturer = manufacturer;
  }

  simulateMessage(data: Uint8Array, timeStamp: number = performance.now()) {
    if (this.onmidimessage) {
      this.onmidimessage({ data, timeStamp } as any);
    }
  }
}

export class FakeMidiInputMap {
  private _inputs = new Map<string, FakeMidiInput>();

  get(id: string) {
    return this._inputs.get(id);
  }
  has(id: string) {
    return this._inputs.has(id);
  }
  forEach(cb: (val: FakeMidiInput, key: string) => void) {
    this._inputs.forEach(cb);
  }
  values() {
    return this._inputs.values();
  }

  add(input: FakeMidiInput) {
    this._inputs.set(input.id, input);
  }
  remove(id: string) {
    this._inputs.delete(id);
  }
}

export class FakeMidiAccess {
  public inputs = new FakeMidiInputMap();
  public onstatechange: ((ev: any) => any) | null = null;

  simulateDeviceConnect(input: FakeMidiInput) {
    this.inputs.add(input);
    if (this.onstatechange) {
      this.onstatechange({ port: input } as any);
    }
  }

  simulateDeviceDisconnect(id: string) {
    const input = this.inputs.get(id);
    if (input) {
      input.state = 'disconnected';
      this.inputs.remove(id);
      if (this.onstatechange) {
        this.onstatechange({ port: input } as any);
      }
    }
  }
}

export class FakeNavigator {
  public fakeAccess = new FakeMidiAccess();
  public grantState: 'granted' | 'denied' | 'notSupported' = 'granted';

  requestMIDIAccess = (): Promise<FakeMidiAccess> => {
    if (this.grantState === 'notSupported') {
      return Promise.reject(new Error('Web MIDI API is not available'));
    }
    if (this.grantState === 'denied') {
      return Promise.reject(new Error('Permission denied'));
    }
    return Promise.resolve(this.fakeAccess);
  };
}
