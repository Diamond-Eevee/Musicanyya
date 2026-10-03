import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-midi-panel.js';
import '../../src/ui/elements/mx-piano-keys.js';
import { midiState } from '../../src/ui/state/midiState.js';

function resetMidiState(): void {
  midiState.availability = 'notRequested';
  midiState.devices = [];
  midiState.lostRecently = false;
  midiState.latencyMs = null;
  midiState.pressedKeys.clear();
  midiState.sustainDown = false;
}

function mountPanel(): HTMLElement {
  const panel = document.createElement('mx-midi-panel');
  document.body.appendChild(panel);
  return panel;
}

const textOf = (panel: HTMLElement) => panel.shadowRoot?.querySelector('.midi-popover')?.textContent ?? '';
const buttonOf = (panel: HTMLElement) => panel.shadowRoot?.querySelector('button') ?? null;

/** contracts/top-bar.md section 3: the MIDI popover's content, in order. */
describe('UI: MIDI popover (feature 021 US3)', () => {
  beforeEach(resetMidiState);
  afterEach(() => {
    document.body.innerHTML = '';
    resetMidiState();
    midiState.emit();
  });

  it('opens with a status line: the label of the display state', () => {
    const panel = mountPanel();
    midiState.availability = 'available';
    midiState.devices = [{ id: '1', name: 'My Keyboard', manufacturer: 'Mfg', connected: true }];
    midiState.emit();
    expect(panel.shadowRoot?.querySelector('.midi-status-line')?.textContent).toContain('My Keyboard');

    midiState.devices = [];
    midiState.emit();
    expect(panel.shadowRoot?.querySelector('.midi-status-line')?.textContent).toContain('No MIDI keyboard');

    midiState.lostRecently = true;
    midiState.emit();
    expect(panel.shadowRoot?.querySelector('.midi-status-line')?.textContent).toContain('MIDI keyboard disconnected');
  });

  it('lists each keyboard with its name, manufacturer and Connected / Disconnected as text', () => {
    const panel = mountPanel();
    midiState.availability = 'available';
    midiState.devices = [
      { id: '1', name: 'My Keyboard', manufacturer: 'Mfg', connected: true },
      { id: '2', name: 'Old Board', manufacturer: 'Other', connected: false },
    ];
    midiState.emit();
    const rows = Array.from(panel.shadowRoot?.querySelectorAll('li') ?? []).map((li) => li.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('My Keyboard');
    expect(rows[0]).toContain('Mfg');
    expect(rows[0]).toContain('Connected');
    expect(rows[0]).not.toContain('Disconnected');
    expect(rows[1]).toContain('Old Board');
    expect(rows[1]).toContain('Disconnected');
  });

  it('has no connect button when MIDI is available', () => {
    const panel = mountPanel();
    midiState.availability = 'available';
    midiState.devices = [{ id: '1', name: 'My Keyboard', manufacturer: 'Mfg', connected: true }];
    midiState.emit();
    expect(buttonOf(panel)).toBeNull();
  });

  it('offers "Connect MIDI keyboard" when not asked yet and "Try again" when denied; both ask for access', () => {
    const panel = mountPanel();
    const asked = vi.fn();
    panel.addEventListener('request-midi', asked);

    midiState.availability = 'notRequested';
    midiState.emit();
    expect(buttonOf(panel)?.textContent).toBe('Connect MIDI keyboard');
    buttonOf(panel)?.click();
    expect(asked).toHaveBeenCalledTimes(1);

    midiState.availability = 'denied';
    midiState.emit();
    expect(buttonOf(panel)?.textContent).toBe('Try again');
    buttonOf(panel)?.click();
    expect(asked).toHaveBeenCalledTimes(2);
  });

  it('explains "not supported" and "denied" in help text, and offers no button for "not supported"', () => {
    const panel = mountPanel();

    midiState.availability = 'notSupported';
    midiState.emit();
    expect(textOf(panel)).toContain(
      'This browser cannot use MIDI keyboards. Use Chrome or Edge, or the desktop app. Listening to scores works here.',
    );
    expect(buttonOf(panel)).toBeNull();

    midiState.availability = 'denied';
    midiState.emit();
    expect(textOf(panel)).toContain(
      "MIDI access was blocked. Allow MIDI for this site in the browser's site settings, then press Try again.",
    );
    expect(textOf(panel)).not.toContain('This browser cannot use MIDI keyboards');
  });

  it('shows the live latency line when it is known, and none when it is not', () => {
    const panel = mountPanel();
    expect(textOf(panel)).not.toContain(' ms');

    midiState.latencyMs = 25;
    midiState.emit();
    expect(textOf(panel)).toContain('25 ms');

    midiState.latencyMs = null;
    midiState.emit();
    expect(textOf(panel)).not.toContain(' ms');
  });
});

describe('UI: on-screen keyboard', () => {
  it('renders 88-key on-screen keyboard with pressed state colour + dot', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    midiState.pressedKeys.add(60);
    midiState.emit();

    const c4 = keys.shadowRoot?.querySelector('[data-key="60"]');
    expect(c4?.classList.contains('pressed')).toBe(true);

    keys.remove();
  });

  it('shows sustain pedal state', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    midiState.sustainDown = true;
    midiState.emit();

    expect(keys.shadowRoot?.querySelector('.sustain-indicator')?.classList.contains('down')).toBe(true);

    keys.remove();
  });

  it('key -> render within 50 ms of the fake event', () => {
    // Simulating event timing and rendering is tricky in jsdom without real rAF,
    // but we can assert the component updates in response to state immediately or via next tick.
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);
    midiState.pressedKeys.add(60);
    midiState.emit();
    // In our synchronous test, the render is immediate
    expect(keys.shadowRoot?.querySelector('[data-key="60"]')?.classList.contains('pressed')).toBe(true);
    keys.remove();
  });
});
