import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebMidiInput } from '../../../src/engine/midi/web-midi-input.js';
import { FakeMidiAccess } from '../../fakes/fake-midi-access.js';

describe('WebMidiInput', () => {
  let fakeAccess: FakeMidiAccess;
  let midiInput: WebMidiInput;

  beforeEach(() => {
    fakeAccess = new FakeMidiAccess();
    midiInput = new WebMidiInput(fakeAccess as any);
  });

  it('reports availability states (notRequested, available, notSupported, denied)', async () => {
    fakeAccess.state = 'notRequested';
    expect(midiInput.availability()).toBe('notRequested');

    fakeAccess.state = 'available';
    expect(midiInput.availability()).toBe('available');
    
    // Add more expectations as needed
  });

  it('requests access from gesture', async () => {
    fakeAccess.state = 'available';
    const result = await midiInput.request();
    expect(result).toBe('available');
  });

  it('uses all inputs and forwards note on/off incl. velocity-0', () => {
    // Write test implementation
    expect(true).toBe(false); // Force failure
  });

  it('forwards CC64 sustain and ignores other messages', () => {
    // Write test implementation
    expect(true).toBe(false); // Force failure
  });

  it('handles hot-plug add/remove', () => {
    // Write test implementation
    expect(true).toBe(false); // Force failure
  });

  it('emits deviceLost carrying held keys', () => {
    // Write test implementation
    expect(true).toBe(false); // Force failure
  });

  it('computes latency samples median', () => {
    // Write test implementation
    expect(true).toBe(false); // Force failure
  });
});
