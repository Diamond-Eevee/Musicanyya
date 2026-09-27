import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-mode-switch.js';
import { midiState } from '../../src/ui/state/midiState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';

describe('mx-mode-switch', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
    midiState.availability = 'notRequested';
  });

  it('reflects the store, and clicking a radio changes it', () => {
    midiState.availability = 'available';
    const el = document.createElement('mx-mode-switch');
    document.body.appendChild(el);
    expect((el.querySelector('input[value="listen"]') as HTMLInputElement).checked).toBe(true);

    (el.querySelector('input[value="practice"]') as HTMLInputElement).click();
    expect(practiceState.get().mode).toBe('practice');
    expect((el.querySelector('input[value="practice"]') as HTMLInputElement).checked).toBe(true);
  });

  it('two instances (the bar and the View popup, phone width T049) never fight over which radio is checked - each needs its own radio group name, since native grouping is global by name, not scoped to the custom element', () => {
    midiState.availability = 'available';
    const bar = document.createElement('mx-mode-switch');
    const popup = document.createElement('mx-mode-switch');
    document.body.append(bar, popup);

    (popup.querySelector('input[value="practice"]') as HTMLInputElement).click();

    expect(practiceState.get().mode).toBe('practice');
    expect((bar.querySelector('input[value="practice"]') as HTMLInputElement).checked, 'bar').toBe(true);
    expect((bar.querySelector('input[value="listen"]') as HTMLInputElement).checked, 'bar listen').toBe(false);
    expect((popup.querySelector('input[value="practice"]') as HTMLInputElement).checked, 'popup').toBe(true);
  });
});
