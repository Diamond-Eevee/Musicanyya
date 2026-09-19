import { describe, it, expect, vi } from 'vitest';
import '../../src/ui/elements/mx-midi-panel.js';
import '../../src/ui/elements/mx-piano-keys.js';
import { midiState } from '../../src/ui/state/midiState.js';

describe('UI: MIDI Panel and Keyboard', () => {
  it('renders device list and connect button', () => {
    const panel = document.createElement('mx-midi-panel');
    document.body.appendChild(panel);

    midiState.availability = 'available';
    midiState.devices = [{ id: '1', name: 'My Keyboard', manufacturer: 'Mfg', connected: true }];
    midiState.emit();

    const text = panel.textContent || '';
    expect(text).toContain('My Keyboard');
    const button = panel.querySelector('button');
    expect(button).not.toBeNull();

    panel.remove();
    expect(false).toBe(true); // Force failure for TDD
  });

  it('shows explanations per reason incl. Safari/Firefox text', () => {
    const panel = document.createElement('mx-midi-panel');
    document.body.appendChild(panel);

    midiState.availability = 'notSupported';
    midiState.emit();

    expect(panel.textContent).toContain('Safari');
    
    midiState.availability = 'denied';
    midiState.emit();

    expect(panel.textContent).toContain('Permission');

    panel.remove();
    expect(false).toBe(true); // Force failure for TDD
  });

  it('displays latency readout', () => {
    const panel = document.createElement('mx-midi-panel');
    document.body.appendChild(panel);

    midiState.latencyMs = 25;
    midiState.emit();

    expect(panel.textContent).toContain('25 ms');

    panel.remove();
    expect(false).toBe(true); // Force failure for TDD
  });

  it('renders 88-key on-screen keyboard with pressed state colour + dot', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    midiState.pressedKeys.add(60);
    midiState.emit();

    const c4 = keys.shadowRoot?.querySelector('[data-key="60"]');
    expect(c4?.classList.contains('pressed')).toBe(true);

    keys.remove();
    expect(false).toBe(true); // Force failure for TDD
  });

  it('shows sustain pedal state', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    midiState.sustainDown = true;
    midiState.emit();

    expect(keys.shadowRoot?.querySelector('.sustain-indicator')?.classList.contains('down')).toBe(true);

    keys.remove();
    expect(false).toBe(true); // Force failure for TDD
  });

  it('key -> render within 50 ms of the fake event', () => {
    // Simulating event timing and rendering is tricky in jsdom without real rAF,
    // but we can assert the component updates in response to state immediately or via next tick.
    expect(false).toBe(true); // Force failure for TDD
  });
});
