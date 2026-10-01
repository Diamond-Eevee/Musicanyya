import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIXER_LEVEL_STEP } from '../../src/core/defaults.js';
import '../../src/ui/elements/mx-levels-panel.js';
import { scoreState } from '../../src/ui/state/scoreState.js';
import { transportState } from '../../src/ui/state/transportState.js';

// Feature 019, mixer-levels.md section 1: the Levels panel holds the Metronome and Orchestra sliders.

type SummaryPart = {
  id: string;
  name: string;
  instrument: string;
  program: number;
  percussion: boolean;
  orchestra?: boolean;
};

function loadScore(parts: SummaryPart[]): void {
  scoreState.succeeded({
    fileName: 'levels.musicxml',
    summary: {
      title: 'Levels',
      composer: null,
      arranger: null,
      parts,
      measureCount: 1,
      measureIds: ['m1'],
      defaultTempoUsed: false,
    },
    report: { entries: [], skippedElementCount: 0 },
    renderXml: '<x/>',
    contentHash: `hash-${parts.length}-${parts.map((p) => p.orchestra).join('')}`,
  });
}

const piano: SummaryPart = {
  id: 'P1',
  name: 'Piano',
  instrument: 'Piano',
  program: 1,
  percussion: false,
  orchestra: false,
};
const oboe: SummaryPart = {
  id: 'P2',
  name: 'Oboe',
  instrument: 'Oboe',
  program: 69,
  percussion: false,
  orchestra: true,
};

describe('mx-levels-panel (feature 019)', () => {
  let panel: HTMLElement;

  const metronome = () => panel.querySelector('input[data-id="metronome-level"]') as HTMLInputElement;
  const orchestra = () => panel.querySelector('input[data-id="orchestra-level"]') as HTMLInputElement;
  const outputOf = (input: HTMLInputElement) => input.closest('label')?.querySelector('output')?.textContent;
  const describedBy = (input: HTMLInputElement) =>
    (input.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => panel.querySelector(`#${id}`)?.textContent?.trim());

  beforeEach(() => {
    transportState.applySavedSettings(80, true, 100, 60);
    panel = document.createElement('mx-levels-panel');
    document.body.appendChild(panel);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders two labelled range inputs, 0 to 100 in steps of MIXER_LEVEL_STEP, each with its value in an <output>', () => {
    for (const input of [metronome(), orchestra()]) {
      expect(input).not.toBeNull();
      expect(input.type).toBe('range');
      expect(input.min).toBe('0');
      expect(input.max).toBe('100');
      expect(input.step).toBe(String(MIXER_LEVEL_STEP));
    }
    expect(metronome().value).toBe('100');
    expect(orchestra().value).toBe('60');
    expect(outputOf(metronome())).toBe('100 %');
    expect(outputOf(orchestra())).toBe('60 %');
  });

  it('gives each slider its accessible name from a <label> (FR-011)', () => {
    expect(metronome().labels).toHaveLength(1);
    expect(metronome().labels?.[0]?.textContent).toContain('Metronome');
    expect(orchestra().labels).toHaveLength(1);
    expect(orchestra().labels?.[0]?.textContent).toContain('Orchestra');
  });

  it('says the Metronome is heard in Play mode, and ties that hint to the slider', () => {
    expect(panel.textContent).toContain('Heard in Play mode');
    expect(describedBy(metronome())).toContain('Heard in Play mode');
  });

  it('an input event on the Metronome slider calls transportState.setMetronomeLevel with the value', () => {
    const spy = vi.spyOn(transportState, 'setMetronomeLevel');
    metronome().value = '30';
    metronome().dispatchEvent(new Event('input', { bubbles: true }));
    expect(spy).toHaveBeenCalledExactlyOnceWith(30);
  });

  it('shows the level the state holds, also when the state changes elsewhere', () => {
    transportState.setMetronomeLevel(35);
    expect(metronome().value).toBe('35');
    expect(outputOf(metronome())).toBe('35 %');
    transportState.setOrchestraLevel(80);
    expect(orchestra().value).toBe('80');
    expect(outputOf(orchestra())).toBe('80 %');
  });

  it('with no Score the Orchestra slider is disabled and says "This score has no orchestra"; the stored value is untouched', () => {
    expect(scoreState.getStatus().kind).toBe('empty');
    expect(orchestra().disabled).toBe(true);
    expect(describedBy(orchestra())).toContain('This score has no orchestra');
    expect(orchestra().value).toBe('60');
    expect(transportState.get().orchestraLevel).toBe(60);
    expect(metronome().disabled).toBe(false); // the Metronome has nothing to do with the Score's parts (FR-010)
  });

  // scoreState has no way back to "empty" once a Score has loaded, so the Score cases stay at the end, in order.
  it('a Score without an Orchestra keeps the Orchestra slider disabled with the explanation', () => {
    loadScore([piano]);
    expect(orchestra().disabled).toBe(true);
    expect(describedBy(orchestra())).toContain('This score has no orchestra');
    expect(transportState.get().orchestraLevel).toBe(60);
  });

  it('a Score with an Orchestra part enables it and drops the explanation; the next Score without one disables it again, value unchanged', () => {
    transportState.setOrchestraLevel(25);
    loadScore([piano, oboe]);
    expect(orchestra().disabled).toBe(false);
    expect(describedBy(orchestra())).not.toContain('This score has no orchestra');
    expect(orchestra().value).toBe('25');

    loadScore([piano]);
    expect(orchestra().disabled).toBe(true);
    expect(orchestra().value).toBe('25');
    expect(transportState.get().orchestraLevel).toBe(25);
  });

  it('an input event on the Orchestra slider calls transportState.setOrchestraLevel with the value', () => {
    loadScore([piano, oboe]);
    const spy = vi.spyOn(transportState, 'setOrchestraLevel');
    orchestra().value = '45';
    orchestra().dispatchEvent(new Event('input', { bubbles: true }));
    expect(spy).toHaveBeenCalledExactlyOnceWith(45);
  });
});
