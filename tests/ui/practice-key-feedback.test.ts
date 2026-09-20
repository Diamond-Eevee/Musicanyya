import { describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-piano-keys.js';
import { practiceState } from '../../src/ui/state/practiceState.js';

describe('T056: wrong / wrong-octave / extra feedback on the on-screen keyboard (no notehead to mark it on)', () => {
  it('marks the key with a distinct shape as well as a colour, per state', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    practiceState.setKeyFeedback(61, { state: 'wrongPitch' });
    practiceState.setKeyFeedback(72, { state: 'wrongOctave', messageId: 'practice.octave.lower' });
    practiceState.setKeyFeedback(64, { state: 'extra', messageId: 'practice.extra.notInChord' });

    const wrongPitchEl = keys.shadowRoot?.querySelector('[data-key="61"]');
    const wrongOctaveEl = keys.shadowRoot?.querySelector('[data-key="72"]');
    const extraEl = keys.shadowRoot?.querySelector('[data-key="64"]');

    expect(wrongPitchEl?.classList.contains('wrong-pitch')).toBe(true);
    expect(wrongOctaveEl?.classList.contains('wrong-octave')).toBe(true);
    expect(extraEl?.classList.contains('extra')).toBe(true);

    // Distinguishable by shape as well as colour (FR-010): each state renders its own mark glyph.
    const wrongPitchMark = wrongPitchEl?.querySelector('.key-mark')?.textContent;
    const wrongOctaveMark = wrongOctaveEl?.querySelector('.key-mark')?.textContent;
    const extraMark = extraEl?.querySelector('.key-mark')?.textContent;
    expect(wrongPitchMark).toBeTruthy();
    expect(wrongOctaveMark).toBeTruthy();
    expect(extraMark).toBeTruthy();
    expect(new Set([wrongPitchMark, wrongOctaveMark, extraMark]).size).toBe(3);

    practiceState.clearAllKeyFeedback();
    keys.remove();
  });

  it('names the relation and the next physical action, never a raw code (FR-039, R-10)', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    practiceState.setKeyFeedback(72, { state: 'wrongOctave', messageId: 'practice.octave.lower' });

    const text = keys.shadowRoot?.textContent ?? '';
    expect(text).toContain('Play one octave lower.');
    expect(text).not.toContain('practice.octave.lower');

    practiceState.clearAllKeyFeedback();
    keys.remove();
  });

  it('a wrongPitch key carries a mark but no message (there is no message id for it)', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    practiceState.setKeyFeedback(61, { state: 'wrongPitch' });

    const el = keys.shadowRoot?.querySelector('[data-key="61"]');
    expect(el?.classList.contains('wrong-pitch')).toBe(true);
    expect(keys.shadowRoot?.querySelector('.key-message[data-key="61"]')).toBeNull();

    practiceState.clearAllKeyFeedback();
    keys.remove();
  });

  it('clearing a key removes its mark and message', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    practiceState.setKeyFeedback(64, { state: 'extra', messageId: 'practice.extra.notInChord' });
    practiceState.clearKeyFeedback(64);

    const el = keys.shadowRoot?.querySelector('[data-key="64"]');
    expect(el?.classList.contains('extra')).toBe(false);
    expect(keys.shadowRoot?.querySelector('.key-message[data-key="64"]')).toBeNull();

    keys.remove();
  });
});
