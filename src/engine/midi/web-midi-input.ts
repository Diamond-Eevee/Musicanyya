import type { MidiAvailability, MidiDevice, MidiInput, MidiInputEvent, Unsubscribe } from '../ports.js';

export class WebMidiInput implements MidiInput {
  private listeners: Set<(event: MidiInputEvent) => void> = new Set();
  private midiAccess: MIDIAccess | null = null;
  private grantState: MidiAvailability = 'notRequested';
  private heldKeys: Map<string, Set<number>> = new Map();

  constructor(private nav: Navigator = navigator) {}

  availability(): MidiAvailability {
    return this.grantState;
  }

  async request(): Promise<MidiAvailability> {
    if (!this.nav.requestMIDIAccess) {
      this.grantState = 'notSupported';
      this.emit({ type: 'availability', availability: this.grantState });
      return this.grantState;
    }
    try {
      this.midiAccess = await this.nav.requestMIDIAccess();
      this.grantState = 'available';

      this.midiAccess.onstatechange = (e: MIDIConnectionEvent) => {
        const port = e.port;
        if (!port.type || port.type === 'input') {
          this.emit({ type: 'devices', devices: this.devices() });
          if (port.state === 'disconnected') {
            const held = this.heldKeys.get(port.id) || new Set();
            this.heldKeys.delete(port.id);
            this.emit({ type: 'deviceLost', deviceId: port.id, heldKeys: Array.from(held) });
          } else if (port.state === 'connected') {
            (port as MIDIInput).onmidimessage = this.handleMidiMessage.bind(this, port.id);
          }
        }
      };

      for (const input of this.midiAccess.inputs.values()) {
        input.onmidimessage = this.handleMidiMessage.bind(this, input.id);
      }

      this.emit({ type: 'availability', availability: this.grantState });
      return this.grantState;
    } catch (err: any) {
      this.grantState = err?.message?.includes('not available') ? 'notSupported' : 'denied';
      this.emit({ type: 'availability', availability: this.grantState });
      return this.grantState;
    }
  }

  devices(): readonly MidiDevice[] {
    if (!this.midiAccess) return [];
    const devs: MidiDevice[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      devs.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown Manufacturer',
        connected: input.state === 'connected'
      });
    }
    return devs;
  }

  on(listener: (event: MidiInputEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: MidiInputEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private handleMidiMessage(deviceId: string, e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data || data.length < 1) return;
    const status = data[0]! >> 4;
    // const channel = data[0]! & 0x0f;

    if (status === 0x9 && data[2]! > 0) {
      const key = data[1]!;
      let held = this.heldKeys.get(deviceId);
      if (!held) { held = new Set(); this.heldKeys.set(deviceId, held); }
      held.add(key);
      this.emit({ type: 'noteOn', deviceId, key, velocity: data[2]!, timeStampMs: e.timeStamp });
    } else if (status === 0x8 || (status === 0x9 && data[2] === 0)) {
      const key = data[1]!;
      const held = this.heldKeys.get(deviceId);
      if (held) held.delete(key);
      this.emit({ type: 'noteOff', deviceId, key, timeStampMs: e.timeStamp });
    } else if (status === 0xB && data[1] === 64) {
      const down = data[2]! >= 64;
      this.emit({ type: 'sustain', deviceId, down, timeStampMs: e.timeStamp });
    }
  }
}
