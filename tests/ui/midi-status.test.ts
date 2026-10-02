import { describe, expect, it } from 'vitest';
import type { MidiAvailability, MidiDevice } from '../../src/engine/ports.js';
import { en } from '../../src/ui/i18n/en.js';
import { type MidiDisplayState, midiStatus } from '../../src/ui/state/midiStatus.js';

const device = (id: string, name: string, connected = true): MidiDevice => ({
  id,
  name,
  manufacturer: 'Maker',
  connected,
});

const ALL_AVAILABILITIES: MidiAvailability[] = ['notRequested', 'available', 'denied', 'notSupported'];

/** data-model.md section 2 and contracts/top-bar.md section 2: the display state of the bar's MIDI control. */
describe('midiStatus (feature 021 US3)', () => {
  it('available with one connected keyboard: connected, labelled with the keyboard name', () => {
    const status = midiStatus('available', [device('1', 'Roland FP-30X')], false);
    expect(status.state).toBe('connected');
    expect(status.label).toBe('Roland FP-30X');
  });

  it('available with several connected keyboards: connected, labelled "{n} keyboards"', () => {
    const status = midiStatus('available', [device('1', 'A'), device('2', 'B'), device('3', 'C')], false);
    expect(status.state).toBe('connected');
    expect(status.label).toBe('3 keyboards');
  });

  it('counts only the connected ones: a listed but disconnected port is not a keyboard', () => {
    const one = midiStatus('available', [device('1', 'A'), device('2', 'B', false)], false);
    expect(one.state).toBe('connected');
    expect(one.label).toBe('A'); // one connected keyboard: its name, not "1 keyboards"
    const two = midiStatus('available', [device('1', 'A'), device('2', 'B'), device('3', 'C', false)], false);
    expect(two.label).toBe('2 keyboards');
  });

  it('available with no keyboard: none, "No MIDI keyboard"', () => {
    for (const devices of [[], [device('1', 'A', false)]]) {
      const status = midiStatus('available', devices, false);
      expect(status.state).toBe('none');
      expect(status.label).toBe('No MIDI keyboard');
    }
  });

  it('available, none connected, a keyboard was lost: lost, "MIDI keyboard disconnected"', () => {
    for (const devices of [[], [device('1', 'A', false)]]) {
      const status = midiStatus('available', devices, true);
      expect(status.state).toBe('lost');
      expect(status.label).toBe('MIDI keyboard disconnected');
    }
  });

  it('a keyboard that is connected wins over a recent loss (reconnect turns lost into connected)', () => {
    const status = midiStatus('available', [device('1', 'Fake')], true);
    expect(status.state).toBe('connected');
    expect(status.label).toBe('Fake');
  });

  it('the permission states ignore devices and loss', () => {
    const devices = [device('1', 'A')];
    for (const lost of [false, true]) {
      expect(midiStatus('notRequested', devices, lost)).toMatchObject({
        state: 'notRequested',
        label: 'Connect MIDI keyboard',
      });
      expect(midiStatus('denied', devices, lost)).toMatchObject({ state: 'denied', label: 'MIDI not allowed' });
      expect(midiStatus('notSupported', devices, lost)).toMatchObject({
        state: 'notSupported',
        label: 'MIDI not supported',
      });
    }
  });

  it('gives every availability x devices x lost combination a state and a non-empty label', () => {
    const deviceSets: MidiDevice[][] = [
      [],
      [device('1', 'A', false)],
      [device('1', 'A')],
      [device('1', 'A'), device('2', 'B')],
    ];
    for (const availability of ALL_AVAILABILITIES) {
      for (const devices of deviceSets) {
        for (const lost of [false, true]) {
          const status = midiStatus(availability, devices, lost);
          expect(status.label.length, `${availability} ${devices.length} ${lost}`).toBeGreaterThan(0);
          expect(status.icon.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('shows a different icon for each display state (a state is never told apart by colour alone)', () => {
    const byState = new Map<MidiDisplayState, string>();
    const record = (status: ReturnType<typeof midiStatus>) => byState.set(status.state, status.icon);
    record(midiStatus('available', [device('1', 'A')], false));
    record(midiStatus('available', [], false));
    record(midiStatus('available', [], true));
    record(midiStatus('notRequested', [], false));
    record(midiStatus('denied', [], false));
    record(midiStatus('notSupported', [], false));
    expect([...byState.keys()].sort()).toEqual(['connected', 'denied', 'lost', 'none', 'notRequested', 'notSupported']);
    expect(new Set(byState.values()).size).toBe(byState.size);
  });

  it('takes its words from en.midi', () => {
    expect(en.midi.noKeyboard).toBe('No MIDI keyboard');
    expect(en.midi.keyboardLost).toBe('MIDI keyboard disconnected');
    expect(en.midi.connect).toBe('Connect MIDI keyboard');
    expect(en.midi.denied).toBe('MIDI not allowed');
    expect(en.midi.notSupported).toBe('MIDI not supported');
    expect(en.midi.keyboards.replace('{n}', '2')).toBe('2 keyboards');
  });
});
