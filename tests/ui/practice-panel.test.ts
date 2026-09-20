import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HandSelection } from '../../src/core/practice/types.js';
import '../../src/ui/elements/mx-practice-panel.js';
import { type PracticeSetup, practiceState } from '../../src/ui/state/practiceState.js';

const TWO_STAVES: readonly HandSelection[] = [
  { preset: 'both', partIndex: 0, staves: [1, 2] },
  { preset: 'right', partIndex: 0, staves: [1] },
  { preset: 'left', partIndex: 0, staves: [2] },
];

function setup(over: Partial<PracticeSetup> = {}): PracticeSetup {
  return {
    parts: [{ partIndex: 0, name: 'Piano', staves: 2 }],
    hands: TWO_STAVES,
    selection: TWO_STAVES[0] ?? null,
    accompaniment: true,
    ...over,
  };
}

function mount(): HTMLElement {
  const panel = document.createElement('mx-practice-panel');
  document.body.appendChild(panel);
  return panel;
}

function listen(panel: HTMLElement) {
  const events: Record<string, unknown>[] = [];
  panel.addEventListener('practicesetup', (e) => events.push((e as CustomEvent).detail));
  return events;
}

describe('mx-practice-panel', () => {
  beforeEach(() => {
    practiceState.setMode('practice');
    practiceState.setSetup(null);
    practiceState.setStartMeasure(null);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
  });

  it('is hidden in Listen mode and while no Score is set up', () => {
    const panel = mount();
    expect(panel.hidden).toBe(true);

    practiceState.setSetup(setup());
    expect(panel.hidden).toBe(false);

    practiceState.setMode('listen');
    expect(panel.hidden).toBe(true);
  });

  it('says so, and offers no choices, when the Score has nothing to practise', () => {
    const panel = mount();
    practiceState.setSetup({ parts: [], hands: [], selection: null, accompaniment: true });

    expect(panel.textContent).toContain('no notes to practise');
    expect(panel.querySelector('input, select')).toBeNull();
  });

  it('a one-staff Score offers a single line: no hands, no part, nothing to hear', () => {
    const panel = mount();
    const single: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
    practiceState.setSetup(
      setup({ parts: [{ partIndex: 0, name: 'Piano', staves: 1 }], hands: [single], selection: single }),
    );

    expect(panel.querySelector('input[name="hands"]')).toBeNull();
    expect(panel.querySelector('select')).toBeNull();
    expect(panel.querySelector('input[name="accompaniment"]')).toBeNull();
    expect(panel.textContent).not.toMatch(/hand/i);
  });

  it('a two-staff part offers both, right and left, with the current one checked', () => {
    const panel = mount();
    practiceState.setSetup(setup({ selection: TWO_STAVES[2] ?? null }));

    const radios = Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="hands"]'));
    expect(radios.map((r) => r.closest('label')?.textContent?.trim())).toEqual([
      'Both hands',
      'Right hand',
      'Left hand',
    ]);
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);
  });

  it('a part with more than two staves labels them as staves, not hands', () => {
    const panel = mount();
    const staves: readonly HandSelection[] = [
      { preset: 'both', partIndex: 0, staves: [1, 2, 3] },
      { preset: 'custom', partIndex: 0, staves: [1] },
      { preset: 'custom', partIndex: 0, staves: [2] },
      { preset: 'custom', partIndex: 0, staves: [3] },
    ];
    practiceState.setSetup(
      setup({ parts: [{ partIndex: 0, name: 'Organ', staves: 3 }], hands: staves, selection: staves[0] ?? null }),
    );

    const labels = Array.from(panel.querySelectorAll('input[name="hands"]')).map((r) =>
      r.closest('label')?.textContent?.trim(),
    );
    expect(labels).toEqual(['All staves', 'Staff 1', 'Staff 2', 'Staff 3']);
  });

  it('offers a choice of part only when the Score has more than one pitched part (FR-025a)', () => {
    const panel = mount();
    practiceState.setSetup(setup());
    expect(panel.querySelector('select')).toBeNull();

    practiceState.setSetup(
      setup({
        parts: [
          { partIndex: 0, name: 'Voice', staves: 1 },
          { partIndex: 1, name: 'Piano', staves: 2 },
        ],
        selection: { preset: 'both', partIndex: 1, staves: [1, 2] },
      }),
    );
    const select = panel.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Voice', 'Piano']);
    expect(select.value).toBe('1');
  });

  it('reports a chosen hand selection, a chosen part and the accompaniment switch as events', () => {
    const panel = mount();
    practiceState.setSetup(
      setup({
        parts: [
          { partIndex: 0, name: 'Voice', staves: 1 },
          { partIndex: 1, name: 'Piano', staves: 2 },
        ],
      }),
    );
    const events = listen(panel);

    const right = panel.querySelectorAll<HTMLInputElement>('input[name="hands"]')[1];
    right?.click();
    const select = panel.querySelector('select') as HTMLSelectElement;
    select.value = '0';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    (panel.querySelector('input[name="accompaniment"]') as HTMLInputElement).click();

    expect(events).toEqual([{ selection: TWO_STAVES[1] }, { partIndex: 0 }, { accompaniment: false }]);
  });

  it('only shows the state it is given: rendering alone never emits an event', () => {
    const panel = mount();
    const events = listen(panel);

    practiceState.setSetup(setup());
    practiceState.setSetup(setup({ selection: TWO_STAVES[1] ?? null }));

    expect(events).toEqual([]);
  });

  it('says where the session will start once a measure is picked', () => {
    const panel = mount();
    practiceState.setSetup(setup());
    expect(panel.textContent).not.toContain('Starts at');

    practiceState.setStartMeasure(4);
    expect(panel.textContent).toContain('Starts at measure 5');
  });
});
