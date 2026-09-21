import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-attempts-list.js';
import type { StoredPerformanceSummary } from '../../src/engine/ports.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';

function attempt(over: Partial<StoredPerformanceSummary> = {}): StoredPerformanceSummary {
  return {
    runId: 'run-1',
    scoreId: 'score-1',
    finishedAt: '2026-01-01T12:00:00.000Z',
    settings: {
      range: null,
      tempoPercent: 80,
      selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
      strictness: 'standard',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency: { outputLatencyMs: 20, inputLatencyMs: 5, source: 'assumed', measuredAt: null },
    appVersion: '1.0.0',
    summary: {
      notesCorrect: { count: 8, total: 10 },
      notesOnTime: { count: 7, total: 9 },
      counts: { correct: 8, wrongPitch: 2, missed: 0, extra: 0, early: 1, late: 1 },
      meanAsynchronyMs: 5,
      timingNotResolvable: false,
    },
    schema: 1,
    ...over,
  };
}

function mount(): HTMLElement {
  const list = document.createElement('mx-attempts-list');
  document.body.appendChild(list);
  return list;
}

describe('mx-attempts-list (US4, T076)', () => {
  beforeEach(() => {
    practiceState.setMode('play');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    practiceState.setMode('listen');
    playState.setAttempts([]);
  });

  it('is hidden outside Play mode', () => {
    playState.setAttempts([attempt()]);
    const list = mount();
    expect(list.hidden).toBe(false);

    practiceState.setMode('listen');
    expect(list.hidden).toBe(true);
    expect(list.innerHTML).toBe('');
  });

  it('shows an empty message when there are no attempts', () => {
    playState.setAttempts([]);
    const list = mount();
    expect(list.hidden).toBe(false);
    expect(list.textContent).toContain('No attempts yet');
  });

  it('lists an attempt with its date, settings and summary (AS-4.6)', () => {
    playState.setAttempts([attempt()]);
    const list = mount();

    const text = list.textContent ?? '';
    expect(text).toContain('80%');
    expect(text).toContain('Standard');
    expect(text).toContain('8 of 10');
    expect(text).toContain('7 of 9');
    // States the kept limit (FR-041).
    expect(text).toMatch(/attempts are kept/);
  });

  it('emits attemptreplay with the runId when Replay is clicked', () => {
    playState.setAttempts([attempt({ runId: 'run-42' })]);
    const list = mount();
    const events: { runId: string }[] = [];
    list.addEventListener('attemptreplay', (e) => events.push((e as CustomEvent<{ runId: string }>).detail));

    list.querySelector<HTMLButtonElement>('.attempts-replay')?.click();

    expect(events).toEqual([{ runId: 'run-42' }]);
  });

  it('emits attemptregrade with the runId when Re-grade is clicked', () => {
    playState.setAttempts([attempt({ runId: 'run-42' })]);
    const list = mount();
    const events: { runId: string }[] = [];
    list.addEventListener('attemptregrade', (e) => events.push((e as CustomEvent<{ runId: string }>).detail));

    list.querySelector<HTMLButtonElement>('.attempts-regrade')?.click();

    expect(events).toEqual([{ runId: 'run-42' }]);
  });

  it('emits attemptdelete only after the musician confirms (FR-043)', () => {
    playState.setAttempts([attempt({ runId: 'run-42' })]);
    const list = mount();
    const events: { runId: string }[] = [];
    list.addEventListener('attemptdelete', (e) => events.push((e as CustomEvent<{ runId: string }>).detail));

    // happy-dom has no `window.confirm` of its own to spy on - stub it directly (restored below).
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(false);
    list.querySelector<HTMLButtonElement>('.attempts-delete')?.click();
    expect(events).toEqual([]);

    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    list.querySelector<HTMLButtonElement>('.attempts-delete')?.click();
    expect(events).toEqual([{ runId: 'run-42' }]);

    window.confirm = originalConfirm;
  });

  it('lists several attempts, most recent first as playState already sorts them', () => {
    playState.setAttempts([
      attempt({ runId: 'run-a', finishedAt: '2026-01-02T00:00:00.000Z' }),
      attempt({ runId: 'run-b', finishedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    const list = mount();

    const ids = [...list.querySelectorAll<HTMLLIElement>('.attempts-item')].map((li) => li.dataset.id);
    expect(ids).toEqual(['run-a', 'run-b']);
  });
});
