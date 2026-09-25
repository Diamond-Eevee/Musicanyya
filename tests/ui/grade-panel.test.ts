import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GradeMarkSet } from '../../src/core/grade/marks.js';
import type { ExtraNote, Grade, NoteResult } from '../../src/core/grade/types.js';
import { mistakeStepper } from '../../src/ui/state/mistake-stepper.js';
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

    playState.selectMark({ kind: 'note', noteId: 'n2' });
    expect(panel.querySelector('.grade-reason')?.textContent).toBe('F3 played, F4 written - one octave too low.');
  });
});

// 009 T034 (FR-022, FR-022a, FR-024): the panel explains what is selected - a graded note (every pass it was played, the pass
// named), an extra key, a red disc (everything it stands for) - from the mark set the core made.
describe('mx-grade-panel explains a mark reference (009 FR-022, FR-024)', () => {
  const result = (over: Partial<NoteResult>): NoteResult => ({
    expectedIndex: 0,
    noteIds: ['n1'],
    pitch: 'correct',
    timing: 'late',
    playedKey: 62,
    deltaTicks: 100,
    deltaMs: 120,
    reason: { code: 'lateBy', expectedKey: 62, playedKey: 62, octaveDelta: null, deltaMs: 120 },
    ...over,
  });
  const marksOf = (over: Partial<GradeMarkSet>): GradeMarkSet =>
    ({ notes: new Map(), discs: [], skipIcons: [], mistakes: [], contexts: new Map(), ...over }) as GradeMarkSet;
  const lines = (panel: HTMLElement) => [...panel.querySelectorAll('.grade-reason')].map((el) => el.textContent);

  beforeEach(() => {
    practiceState.setMode('play');
  });
  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
    playState.clear();
  });

  it('a note played on several passes gets one line per pass, with the pass named', () => {
    const first = result({ expectedIndex: 0 });
    const second = result({
      expectedIndex: 1,
      timing: 'early',
      deltaMs: -80,
      reason: { code: 'earlyBy', expectedKey: 62, playedKey: 62, octaveDelta: null, deltaMs: -80 },
    });
    const marks = marksOf({
      notes: new Map([['n1', { noteId: 'n1', head: 'correct', timing: ['late', 'early'], results: [0, 1] }]]),
    });
    playState.setGrade(grade({ results: [first, second] }), marks);
    playState.selectMark({ kind: 'note', noteId: 'n1' });
    expect(lines(mount())).toEqual(['1st time: Late by 120 ms.', '2nd time: Early by 80 ms.']);
  });

  it('a note played once keeps the single unnamed line of 003', () => {
    const marks = marksOf({
      notes: new Map([['n1', { noteId: 'n1', head: 'correct', timing: ['late'], results: [0] }]]),
    });
    playState.setGrade(grade({ results: [result({})] }), marks);
    playState.selectMark({ kind: 'note', noteId: 'n1' });
    expect(lines(mount())).toEqual(['Late by 120 ms.']);
  });

  it('an extra key shows its own reason', () => {
    const extraNote: ExtraNote = {
      key: 62,
      audioTimeSec: 1,
      atTick: 100,
      measureIndex: 0,
      passIndex: 0,
      reason: { code: 'extraNoNoteWritten', expectedKey: null, playedKey: 62, octaveDelta: null, deltaMs: null },
    };
    playState.setGrade(grade({ extras: [extraNote] }), marksOf({}));
    playState.selectMark({ kind: 'extra', index: 0 });
    expect(lines(mount())).toEqual(['D4 played, no note written for it here.']);
  });

  it('a red disc explains everything it stands for: a wrong pitch on one pass and an extra of the same key', () => {
    const wrong = result({
      pitch: 'wrongPitch',
      playedKey: 74,
      reason: { code: 'wrongOctaveHigh', expectedKey: 62, playedKey: 74, octaveDelta: 1, deltaMs: 0 },
    });
    const extraNote: ExtraNote = {
      key: 74,
      audioTimeSec: 2,
      atTick: 4000,
      measureIndex: 0,
      passIndex: 1,
      reason: { code: 'extraNoNoteWritten', expectedKey: null, playedKey: 74, octaveDelta: null, deltaMs: null },
    };
    const marks = marksOf({
      notes: new Map([['n1', { noteId: 'n1', head: 'missed', timing: [], results: [0] }]]),
      discs: [
        {
          key: 74,
          refs: [
            { kind: 'note', noteId: 'n1' },
            { kind: 'extra', index: 0 },
          ],
        } as unknown as GradeMarkSet['discs'][number],
      ],
    });
    playState.setGrade(grade({ results: [wrong], extras: [extraNote] }), marks);
    playState.selectMark({ kind: 'disc', index: 0 });
    expect(lines(mount())).toEqual([
      'D5 played, D4 written - one octave too high.',
      'D5 played, no note written for it here.',
    ]);
  });

  it('words a wrong pitch in a chord and under an octave line as FR-022a says (the core supplies the context)', () => {
    const inChord = result({
      pitch: 'wrongPitch',
      playedKey: 86,
      reason: { code: 'wrongOctaveHigh', expectedKey: 74, playedKey: 86, octaveDelta: 1, deltaMs: 0 },
    });
    const marks = marksOf({
      notes: new Map([['n1', { noteId: 'n1', head: 'missed', timing: [], results: [0] }]]),
      contexts: new Map([[0, { chordNotPlayed: [74, 79], octaveShift: 0 }]]),
    });
    playState.setGrade(grade({ results: [inChord] }), marks);
    playState.selectMark({ kind: 'note', noteId: 'n1' });
    expect(lines(mount())).toEqual(['D6 played in this chord; D5, G5 not played.']);
  });

  it('falls back to the results themselves when there are no marks (a Score that is not open)', () => {
    playState.setGrade(grade({ results: [result({})] }), null);
    playState.selectMark({ kind: 'note', noteId: 'n1' });
    expect(lines(mount())).toEqual(['Late by 120 ms.']);
  });

  it('the stepper buttons select the mark they arrive at, an extra as well as a note', () => {
    const marks = marksOf({
      mistakes: [
        { kind: 'note', noteId: 'n2' },
        { kind: 'extra', index: 0 },
      ],
      notes: new Map([['n2', { noteId: 'n2', head: 'missed', timing: [], results: [1] }]]),
    });
    const extraNote: ExtraNote = {
      key: 62,
      audioTimeSec: 1,
      atTick: 100,
      measureIndex: 0,
      passIndex: 0,
      reason: { code: 'extraNoNoteWritten', expectedKey: null, playedKey: 62, octaveDelta: null, deltaMs: null },
    };
    playState.setGrade(grade({ extras: [extraNote] }), marks);
    mistakeStepper.setMarks(marks);
    const panel = mount();
    (panel.querySelector('[data-id="stepper-next"]') as HTMLButtonElement).click();
    expect(playState.get().selectedMark).toEqual({ kind: 'extra', index: 0 });
    (panel.querySelector('[data-id="stepper-next"]') as HTMLButtonElement).click();
    expect(playState.get().selectedMark).toEqual({ kind: 'note', noteId: 'n2' });
    mistakeStepper.setMarks(null);
  });
});
