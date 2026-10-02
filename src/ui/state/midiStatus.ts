import type { MidiAvailability, MidiDevice } from '../../engine/ports.js';
import { en } from '../i18n/en.js';
import type { MidiStateIcon } from '../icons/midi-icons.js';

/** What the bar's MIDI control shows (feature 021 US3, data-model.md section 2). */
export type MidiDisplayState = 'connected' | 'none' | 'lost' | 'notRequested' | 'denied' | 'notSupported';

export interface MidiStatus {
  state: MidiDisplayState;
  /** The words beside the shape, also the control's title and accessible name. */
  label: string;
  /** One drawing per state, so a state is never told apart by colour alone (Constitution VI). */
  icon: MidiStateIcon;
}

/**
 * The display state of the MIDI keyboard control, from what the store holds: the access state, the keyboards found and
 * whether the last connected one was lost since the musician last looked. Pure: the same inputs give the same status.
 * A keyboard that is connected again wins over a loss; a loss shows until the popover is opened (mx-midi-status).
 */
export function midiStatus(
  availability: MidiAvailability,
  devices: readonly MidiDevice[],
  lostRecently: boolean,
): MidiStatus {
  switch (availability) {
    case 'notSupported':
      return { state: 'notSupported', label: en.midi.notSupported, icon: 'keyboard-slash-dashed' };
    case 'denied':
      return { state: 'denied', label: en.midi.denied, icon: 'keyboard-slash' };
    case 'notRequested':
      return { state: 'notRequested', label: en.midi.connect, icon: 'keyboard-question' };
    case 'available': {
      const connected = devices.filter((device) => device.connected);
      const first = connected[0];
      if (first !== undefined) {
        const label = connected.length === 1 ? first.name : en.midi.keyboards.replace('{n}', String(connected.length));
        return { state: 'connected', label, icon: 'keyboard-check' };
      }
      if (lostRecently) return { state: 'lost', label: en.midi.keyboardLost, icon: 'keyboard-cross' };
      return { state: 'none', label: en.midi.noKeyboard, icon: 'keyboard' };
    }
  }
}
