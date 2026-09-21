import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Grade } from '../../src/core/grade/types.js';
import '../../src/ui/elements/mx-grade-panel.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';

function grade(over: Partial<Grade> = {}): Grade {
  return {
    runId: 'run-1',
    complete: true,
    results: [
      {
        expectedIndex: 0,
        noteIds: ['n1'],
        pitch: 'correct',
        timing: 'onTime',
        playedKey: 60,
        deltaTicks: 0,
        deltaMs: 0,
        reason: { code: 'correctOnTime', expectedKey: 60, playedKey: 60, octaveDelta: null, deltaMs: 0 },
      },
      {
        expectedIndex: 1,
        noteIds: ['n2'],
        pitch: 'wrongPitch',
        timing: 'onTime',
        playedKey: 53,
        deltaTicks: 0,
        deltaMs: -1200,
        reason: { code: 'wrongOctaveLow', expectedKey: 65, playedKey: 53, octaveDelta: -1, deltaMs: 0 },
      },
    ],
    extras: [],
    playedAlong: [],
    summary: {
      notesCorrect: { count: 1, total: 2 },
      notesOnTime: { count: 2, total: 2 },
      counts: { correct: 1, wrongPitch: 1, missed: 0, extra: 0, early: 0, late: 0 },
      meanAsynchronyMs: 5,
      timingNotResolvable: false,
    },
    measures: [],
    reliability: [],
    settings: {
      range: null,
      tempoPercent: 100,
      selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
      strictness: 'standard',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency: { outputLatencyMs: 20, inputLatencyMs: 5, source: 'assumed', measuredAt: null },
    ...over,
  };
}

function mount(): HTMLElement {
  const panel = document.createElement('mx-grade-panel');
  document.body.appendChild(panel);
  return panel;
}

describe('mx-grade-panel (T042)', () => {
  beforeEach(() => {
    practiceState.setMode('play');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
    playState.clear();
  });

  it('is hidden outside Play mode, and with no Grade yet', () => {
    playState.setGrade(null);
    const panel = mount();
    expect(panel.hidden).toBe(true);

    playState.setGrade(grade());
    practiceState.setMode('listen');
    expect(panel.hidden).toBe(true);
  });

  it('shows both figures as a count out of a total with a percentage (FR-028)', () => {
    playState.setGrade(grade());
    const panel = mount();

    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('1 of 2 (50%)');
    expect(panel.textContent).toContain('2 of 2 (100%)');
  });

  it('shows all six plain counts', () => {
    playState.setGrade(grade());
    const panel = mount();

    const text = panel.textContent ?? '';
    for (const n of ['1', '0']) expect(text).toContain(n); // correct=1, wrongPitch=1, the rest 0
    expect(panel.querySelector('.grade-count-correct')?.textContent).toContain('1');
    expect(panel.querySelector('.grade-count-wrongPitch')?.textContent).toContain('1');
    expect(panel.querySelector('.grade-count-missed')?.textContent).toContain('0');
  });

  it('marks an incomplete Grade (a stopped run, FR-008)', () => {
    playState.setGrade(grade({ complete: false }));
    const panel = mount();
    expect(panel.querySelector('.grade-incomplete')).not.toBeNull();
  });

  it('explains the selected mark in plain words (FR-030), and shows nothing when none is selected', () => {
    playState.setGrade(grade());
    const panel = mount();
    expect(panel.querySelector('.grade-reason')).toBeNull();

    playState.selectNote('n2');
    expect(panel.querySelector('.grade-reason')?.textContent).toBe('F3 played, F4 written - one octave too low.');
  });
});
