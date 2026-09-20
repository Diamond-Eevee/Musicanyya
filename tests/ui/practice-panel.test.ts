import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startSession } from '../../src/core/practice/matcher.js';
import type { HandSelection, ResolvedLoop } from '../../src/core/practice/types.js';
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
    measureCount: 8,
    loop: null,
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
    practiceState.setSession(null);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
    practiceState.setSession(null);
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
    practiceState.setSetup({ parts: [], hands: [], selection: null, accompaniment: true, measureCount: 0, loop: null });

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

  describe('loop (FR-016, AS-3.1 to AS-3.4)', () => {
    const fields = (panel: HTMLElement) => ({
      from: panel.querySelector('[data-id="loop-from"]') as HTMLInputElement,
      to: panel.querySelector('[data-id="loop-to"]') as HTMLInputElement,
      clear: panel.querySelector('[data-id="loop-clear"]') as HTMLButtonElement,
    });

    /** Types into a measure field the way a musician does and lets the browser's change event fire. */
    function type(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function runningSession(loop: ResolvedLoop | null) {
      return startSession({
        scoreId: null,
        events: [
          {
            index: 0,
            passIndex: 0,
            measureIndex: 0,
            onsetTick: 0,
            required: [{ key: 60, noteIds: ['a'], staff: 1 }],
            accompaniment: [],
          },
        ],
        startEventIndex: 0,
        loop,
        accompaniment: true,
        help: false,
      });
    }

    it('offers two measure fields, numbered from 1 and limited to the Score, with no loop set', () => {
      const panel = mount();
      practiceState.setSetup(setup());

      const { from, to, clear } = fields(panel);
      expect([from.value, to.value]).toEqual(['', '']);
      expect([from.min, from.max, to.min, to.max]).toEqual(['1', '8', '1', '8']);
      expect(clear.disabled).toBe(true);
      expect(panel.textContent).not.toContain('Looping');
    });

    it('shows the loop it is given as measure numbers, and says what is looping', () => {
      const panel = mount();
      practiceState.setSetup(setup({ loop: { fromMeasureIndex: 2, toMeasureIndex: 3 } }));

      const { from, to, clear } = fields(panel);
      expect([from.value, to.value]).toEqual(['3', '4']);
      expect(clear.disabled).toBe(false);
      expect(panel.textContent).toContain('Looping measures 3-4');
    });

    it('names the time through a repeated range only when the range is played more than once', () => {
      const panel = mount();
      practiceState.setSetup(setup({ loop: { fromMeasureIndex: 0, toMeasureIndex: 0 } }));
      practiceState.setSession(
        runningSession({
          fromEventIndex: 0,
          toEventIndex: 0,
          fromPassIndex: 2,
          toPassIndex: 2,
          occurrence: { index: 2, count: 2 },
        }),
      );
      expect(panel.textContent).toContain('2nd time');

      practiceState.setSession(
        runningSession({ fromEventIndex: 0, toEventIndex: 0, fromPassIndex: 0, toPassIndex: 0, occurrence: null }),
      );
      expect(panel.textContent).not.toContain('time');
    });

    it('reports the range once both fields hold a measure, as zero-based indices', () => {
      const panel = mount();
      practiceState.setSetup(setup());
      const events = listen(panel);

      type(fields(panel).from, '3');
      expect(events).toEqual([]); // one field is not a range yet

      type(fields(panel).to, '4');
      expect(events).toEqual([{ loop: { fromMeasureIndex: 2, toMeasureIndex: 3 } }]);
    });

    it('reports a reversed range as typed (the core corrects it), then shows the corrected one', () => {
      const panel = mount();
      practiceState.setSetup(setup());
      const events = listen(panel);
      panel.addEventListener('practicesetup', () => {
        practiceState.setSetup(setup({ loop: { fromMeasureIndex: 2, toMeasureIndex: 3 } }));
      });

      type(fields(panel).from, '4');
      type(fields(panel).to, '3');

      expect(events).toEqual([{ loop: { fromMeasureIndex: 3, toMeasureIndex: 2 } }]);
      expect([fields(panel).from.value, fields(panel).to.value]).toEqual(['3', '4']);
    });

    it('keeps a typed measure inside the Score', () => {
      const panel = mount();
      practiceState.setSetup(setup());
      const events = listen(panel);

      type(fields(panel).from, '0');
      type(fields(panel).to, '99');

      expect(events).toEqual([{ loop: { fromMeasureIndex: 0, toMeasureIndex: 7 } }]);
    });

    it('ignores what is not a measure number', () => {
      const panel = mount();
      practiceState.setSetup(setup());
      const events = listen(panel);

      type(fields(panel).from, 'abc');
      type(fields(panel).to, '3');

      expect(events).toEqual([]);
    });

    it('shows the state again when the app declines the loop, instead of the numbers that were typed', () => {
      const panel = mount();
      practiceState.setSetup(setup({ loop: { fromMeasureIndex: 0, toMeasureIndex: 1 } }));

      type(fields(panel).from, '5');
      type(fields(panel).to, '6'); // nothing changes in the state: the loop was refused

      expect([fields(panel).from.value, fields(panel).to.value]).toEqual(['1', '2']);
    });

    it('clears the loop with one control (AS-3.3)', () => {
      const panel = mount();
      practiceState.setSetup(setup({ loop: { fromMeasureIndex: 2, toMeasureIndex: 3 } }));
      const events = listen(panel);

      fields(panel).clear.click();

      expect(events).toEqual([{ loop: null }]);
    });

    it('offers no loop when the Score has nothing to practise', () => {
      const panel = mount();
      practiceState.setSetup({
        parts: [],
        hands: [],
        selection: null,
        accompaniment: true,
        measureCount: 0,
        loop: null,
      });

      expect(panel.querySelector('[data-id="loop-from"]')).toBeNull();
    });
  });
});
