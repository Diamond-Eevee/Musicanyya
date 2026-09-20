import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-piano-keys.js';
import '../../src/ui/elements/mx-practice-help.js';
import { practiceState } from '../../src/ui/state/practiceState.js';

function mount(): HTMLElement {
  const el = document.createElement('mx-practice-help');
  document.body.appendChild(el);
  return el;
}

describe('T039: the help overlay (FR-023, FR-024)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.clearHelpOverlay();
  });

  it('renders nothing until help is shown', () => {
    const el = mount();
    expect(el.hidden).toBe(true);
    expect(el.shadowRoot?.textContent?.trim()).toBe('');
  });

  it('shows the expected key with its note name and written fingering (AS4.1, AS4.3)', () => {
    const el = mount();
    practiceState.setHelpOverlay({
      reason: 'stuck',
      keys: [{ key: 60, noteName: 'C4', fingering: '1' }],
    });

    expect(el.hidden).toBe(false);
    const keyEl = el.shadowRoot?.querySelector('[data-key="60"]');
    expect(keyEl?.textContent).toContain('C4');
    expect(keyEl?.textContent).toContain('1');
  });

  it('shows a key with no written fingering without inventing one', () => {
    const el = mount();
    practiceState.setHelpOverlay({ reason: 'requested', keys: [{ key: 67, noteName: 'G4', fingering: null }] });

    const keyEl = el.shadowRoot?.querySelector('[data-key="67"]');
    expect(keyEl?.textContent).toContain('G4');
    expect(el.shadowRoot?.querySelector('.help-fingering')).toBeNull();
  });

  it('the same help appears immediately on request as when the app shows it by itself (AS4.4)', () => {
    const el = mount();
    practiceState.setHelpOverlay({ reason: 'requested', keys: [{ key: 60, noteName: 'C4', fingering: null }] });
    const requested = el.shadowRoot?.querySelector('[data-key="60"]')?.textContent;

    practiceState.setHelpOverlay({ reason: 'stuck', keys: [{ key: 60, noteName: 'C4', fingering: null }] });
    const stuck = el.shadowRoot?.querySelector('[data-key="60"]')?.textContent;

    expect(requested).toBe(stuck);
  });

  it('a held-over key asks to release and press again, spelled out, not a raw message id (FR-009a, R-15)', () => {
    const el = mount();
    practiceState.setHelpOverlay({ reason: 'heldOver', keys: [{ key: 60, noteName: 'C4', fingering: null }] });

    const text = el.shadowRoot?.textContent ?? '';
    expect(text).toContain('Release the held key.');
    expect(text).toContain('Press the key again.');
    expect(text).not.toMatch(/practice\./);
  });

  it('never covers the note it refers to: docked at a fixed position, not over the score (FR-024)', () => {
    const el = mount();
    practiceState.setHelpOverlay({ reason: 'stuck', keys: [{ key: 60, noteName: 'C4', fingering: null }] });

    expect(el.style.position).toBe('fixed');
  });

  it('is switched off for the session by clearing the overlay (FR-024, AS4.5)', () => {
    const el = mount();
    practiceState.setHelpOverlay({ reason: 'stuck', keys: [{ key: 60, noteName: 'C4', fingering: null }] });
    expect(el.hidden).toBe(false);

    practiceState.clearHelpOverlay();
    expect(el.hidden).toBe(true);
    expect(el.shadowRoot?.querySelector('[data-key="60"]')).toBeNull();
  });
});

describe('T041: the expected key is also lit on the on-screen keyboard (AS4.1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.clearHelpOverlay();
  });

  it('marks the expected key while help is shown, and clears it once help is hidden', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    practiceState.setHelpOverlay({ reason: 'stuck', keys: [{ key: 60, noteName: 'C4', fingering: null }] });
    expect(keys.shadowRoot?.querySelector('[data-key="60"]')?.classList.contains('expected-help')).toBe(true);

    practiceState.clearHelpOverlay();
    expect(keys.shadowRoot?.querySelector('[data-key="60"]')?.classList.contains('expected-help')).toBe(false);
  });

  it('marks every key of a chord the help refers to', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    practiceState.setHelpOverlay({
      reason: 'requested',
      keys: [
        { key: 60, noteName: 'C4', fingering: null },
        { key: 64, noteName: 'E4', fingering: null },
      ],
    });

    expect(keys.shadowRoot?.querySelector('[data-key="60"]')?.classList.contains('expected-help')).toBe(true);
    expect(keys.shadowRoot?.querySelector('[data-key="64"]')?.classList.contains('expected-help')).toBe(true);
    expect(keys.shadowRoot?.querySelector('[data-key="61"]')?.classList.contains('expected-help')).toBe(false);
  });
});
