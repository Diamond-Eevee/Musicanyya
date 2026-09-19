import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebMidiInput } from '../../../src/engine/midi/web-midi-input.js';
import { FakeNavigator, FakeMidiInput } from '../../fakes/fake-midi-access.js';
import type { MidiInputEvent } from '../../../src/engine/ports.js';

describe('WebMidiInput', () => {
  let fakeNav: FakeNavigator;
  let midiInput: WebMidiInput;
  let events: MidiInputEvent[];

  beforeEach(() => {
    fakeNav = new FakeNavigator();
    events = [];
    midiInput = new WebMidiInput(fakeNav as any);
    midiInput.on(ev => events.push(ev));
  });

  it('reports availability states (notRequested, available, notSupported, denied)', async () => {
    expect(midiInput.availability()).toBe('notRequested');

    fakeNav.grantState = 'notSupported';
    await midiInput.request();
    expect(midiInput.availability()).toBe('notSupported');

    fakeNav.grantState = 'denied';
    await midiInput.request();
    expect(midiInput.availability()).toBe('denied');

    fakeNav.grantState = 'granted';
    await midiInput.request();
    expect(midiInput.availability()).toBe('available');
  });

  it('requests access from gesture', async () => {
    fakeNav.grantState = 'granted';
    const result = await midiInput.request();
    expect(result).toBe('available');
  });

  it('uses all inputs and forwards note on/off incl. velocity-0', async () => {
    fakeNav.grantState = 'granted';
    const input1 = new FakeMidiInput('i1', 'Device 1', 'Mfg 1');
    fakeNav.fakeAccess.inputs.add(input1);
    await midiInput.request();

    events.length = 0;
    input1.simulateMessage(new Uint8Array([0x90, 60, 100]), 1000); // Note On
    input1.simulateMessage(new Uint8Array([0x80, 60, 0]), 1010);   // Note Off
    input1.simulateMessage(new Uint8Array([0x90, 61, 0]), 1020);   // Note On with velocity 0 -> Note Off

    expect(events).toEqual([
      { type: 'noteOn', deviceId: 'i1', key: 60, velocity: 100, timeStampMs: 1000 },
      { type: 'noteOff', deviceId: 'i1', key: 60, timeStampMs: 1010 },
      { type: 'noteOff', deviceId: 'i1', key: 61, timeStampMs: 1020 },
    ]);
    expect(false).toBe(true); // Force failure for TDD
  });

  it('forwards CC64 sustain and ignores other messages', async () => {
    fakeNav.grantState = 'granted';
    const input1 = new FakeMidiInput('i1', 'Device 1', 'Mfg 1');
    fakeNav.fakeAccess.inputs.add(input1);
    await midiInput.request();

    events.length = 0;
    input1.simulateMessage(new Uint8Array([0xB0, 64, 127]), 2000); // CC64 down
    input1.simulateMessage(new Uint8Array([0xB0, 64, 0]), 2010);   // CC64 up
    input1.simulateMessage(new Uint8Array([0xB0, 1, 64]), 2020);   // CC1 Mod wheel (ignore)
    input1.simulateMessage(new Uint8Array([0xE0, 0, 64]), 2030);   // Pitch bend (ignore)

    expect(events).toEqual([
      { type: 'sustain', deviceId: 'i1', down: true, timeStampMs: 2000 },
      { type: 'sustain', deviceId: 'i1', down: false, timeStampMs: 2010 },
    ]);
    expect(false).toBe(true); // Force failure for TDD
  });

  it('handles hot-plug add/remove', async () => {
    fakeNav.grantState = 'granted';
    await midiInput.request();
    events.length = 0;

    const input1 = new FakeMidiInput('i1', 'Device 1', 'Mfg 1');
    fakeNav.fakeAccess.simulateDeviceConnect(input1);

    expect(midiInput.devices()).toEqual([
      { id: 'i1', name: 'Device 1', manufacturer: 'Mfg 1', connected: true }
    ]);
    expect(events).toContainEqual({
      type: 'devices',
      devices: [{ id: 'i1', name: 'Device 1', manufacturer: 'Mfg 1', connected: true }]
    });

    fakeNav.fakeAccess.simulateDeviceDisconnect('i1');
    expect(midiInput.devices()).toEqual([]);
    expect(false).toBe(true); // Force failure for TDD
  });

  it('emits deviceLost carrying held keys', async () => {
    fakeNav.grantState = 'granted';
    const input1 = new FakeMidiInput('i1', 'Device 1', 'Mfg 1');
    fakeNav.fakeAccess.inputs.add(input1);
    await midiInput.request();
    
    input1.simulateMessage(new Uint8Array([0x90, 60, 100]));
    input1.simulateMessage(new Uint8Array([0x90, 64, 100]));
    events.length = 0;

    fakeNav.fakeAccess.simulateDeviceDisconnect('i1');
    expect(events).toContainEqual({
      type: 'deviceLost',
      deviceId: 'i1',
      heldKeys: [60, 64]
    });
    expect(false).toBe(true); // Force failure for TDD
  });

  it('computes latency samples median', () => {
    // This is optional if latency is calculated inside the adapter or elsewhere,
    // but the task says "latency samples median".
    expect(false).toBe(true); // Force failure for TDD
  });
});
