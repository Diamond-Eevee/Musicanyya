import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-status-badge.js';
import '../../../src/ui/elements/mx-browser-rail.js';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-detail.js';
import type { LibraryIndex, LibraryItem } from '../../../src/core/library/types.js';
import type { ProgressStatus } from '../../../src/core/progress/status.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { record, result } from '../../fakes/progress-builders.js';

const HASH = 'a'.repeat(64);

function libraryItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'repertoire/beginner/ode-to-joy',
    section: 'repertoire/beginner',
    file: 'ode-to-joy.musicxml',
    bytes: 100,
    hash: HASH,
    meta: {
      version: 1,
      title: 'Ode to Joy',
      composer: 'Beethoven',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 16,
      notes: 64,
      durationSeconds: 80,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 72,
      maxSpanSemitones: 7,
      staves: 2,
      shortestDivision: 8,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
    ...overrides,
  };
}

function index(items: LibraryItem[]): LibraryIndex {
  return {
    version: 1,
    generated: '2026-09-22T00:00:00.000Z',
    sections: [
      { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 1 },
      { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
    ],
    items,
  };
}

describe('mx-status-badge (FR-012, R-16)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const cases: { status: ProgressStatus; label: string }[] = [
    { status: 'new', label: 'New' },
    { status: 'practised', label: 'Practised' },
    { status: 'played', label: 'Played' },
    { status: 'mastered', label: 'Mastered' },
  ];

  for (const { status, label } of cases) {
    it(`renders a distinct shape, the "${label}" text label and a tooltip for status "${status}"`, () => {
      const el = document.createElement('mx-status-badge');
      el.setAttribute('status', status);
      document.body.appendChild(el);

      expect(el.querySelector('.status-badge-shape')).not.toBeNull();
      expect(el.querySelector('.status-badge-label')?.textContent).toBe(label);
      expect(el.title.length).toBeGreaterThan(0);
      expect(el.dataset.status).toBe(status);
    });
  }

  it('mastered uses a star path, distinct from the circle shapes of the other three statuses', () => {
    const mastered = document.createElement('mx-status-badge');
    mastered.setAttribute('status', 'mastered');
    document.body.appendChild(mastered);
    expect(mastered.querySelector('path')).not.toBeNull();
    expect(mastered.querySelector('circle')).toBeNull();

    const played = document.createElement('mx-status-badge');
    played.setAttribute('status', 'played');
    document.body.appendChild(played);
    expect(played.querySelector('circle')).not.toBeNull();
  });
});

describe('mx-browser-list rows show best/last/trend for a played item (FR-012)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('shows the best and last result figures, and a trend, once there are two attempts', () => {
    const best = result({
      runId: 'r1',
      finishedAt: '2026-01-01T00:00:00.000Z',
      notesCorrect: { count: 60, total: 100 },
      notesOnTime: { count: 50, total: 100 },
    });
    const last = result({
      runId: 'r2',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 90, total: 100 },
      notesOnTime: { count: 85, total: 100 },
    });
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(
      index([item]),
      [],
      [record({ scoreKey: HASH, attempts: 2, results: [last, best], best, lastPlayedAt: last.finishedAt })],
    );
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const row = el.querySelector('[role="option"]') as HTMLElement;
    expect(row.dataset.status).toBe('played');
    expect(row.querySelector('mx-status-badge')).not.toBeNull();
    expect(row.textContent).toContain('90% correct');
    expect(row.textContent).toContain('85% on time');
    expect(row.textContent).toContain('60% correct');
    expect(row.textContent).toContain('up');
  });

  it('shows nothing extra for a New item (no attempts)', () => {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], []);
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const row = el.querySelector('[role="option"]') as HTMLElement;
    expect(row.dataset.status).toBe('new');
    expect(row.querySelector('.browser-row-result')).toBeNull();
  });
});

describe('mx-browser-detail shows the progress record and history (FR-013)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('shows attempts, best/last with tempo and strictness, and history rows with scope and completeness', () => {
    const best = result({
      runId: 'r1',
      finishedAt: '2026-01-01T00:00:00.000Z',
      notesCorrect: { count: 95, total: 100 },
      notesOnTime: { count: 90, total: 100 },
      tempoPercent: 80,
      strictness: 'strict',
      complete: true,
      scope: { kind: 'whole' },
    });
    const stopped = result({
      runId: 'r2',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 50, total: 100 },
      complete: false,
      scope: { kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: null },
    });
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(
      index([item]),
      [],
      [
        record({
          scoreKey: HASH,
          attempts: 2,
          results: [stopped, best],
          best,
          lastPlayedAt: stopped.finishedAt,
          firstPlayedAt: best.finishedAt,
        }),
      ],
    );
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.textContent).toContain('Attempts: 2');
    expect(el.textContent).toContain('80% tempo');
    expect(el.textContent).toContain('Strict');
    expect(el.textContent).toContain('Whole score');
    expect(el.textContent).toContain('Measures 1-4');
    expect(el.textContent).toContain('Stopped early');
    const historyRows = el.querySelectorAll('.browser-detail-history li');
    expect(historyRows.length).toBe(2);
  });

  it('shows nothing progress-related for a New item (no attempts)', () => {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], []);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.textContent).not.toContain('Attempts:');
    expect(el.querySelector('.browser-detail-history')).toBeNull();
  });
});

describe('mx-browser-detail reset progress (OD-3, R-12, T057)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  function withProgress(): LibraryItem {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], [record({ scoreKey: HASH, attempts: 1 })]);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    return item;
  }

  it('shows no reset button for a New item', () => {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], []);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.querySelector('.browser-reset-start')).toBeNull();
  });

  it('clicking Reset progress shows an inline confirmation, Cancel returns to the plain button', () => {
    withProgress();
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    (el.querySelector('.browser-reset-start') as HTMLButtonElement).click();
    expect(el.querySelector('.browser-reset-confirm-message')).not.toBeNull();

    (el.querySelector('.browser-reset-cancel') as HTMLButtonElement).click();
    expect(el.querySelector('.browser-reset-confirm-message')).toBeNull();
    expect(el.querySelector('.browser-reset-start')).not.toBeNull();
  });

  it('confirming dispatches browserresetprogress with the selected ref', () => {
    const item = withProgress();
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    const reset = new Promise<{ ref: unknown }>((resolve) => {
      el.addEventListener('browserresetprogress', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    (el.querySelector('.browser-reset-start') as HTMLButtonElement).click();
    (el.querySelector('.browser-reset-confirm') as HTMLButtonElement).click();

    return reset.then((detail) => {
      expect(detail.ref).toEqual({ kind: 'library', id: item.id });
    });
  });

  it('while a reset is pending for this item, shows Undo instead of the reset button', () => {
    const item = withProgress();
    browserState.setPending({ kind: 'reset', ref: { kind: 'library', id: item.id }, deadline: Date.now() + 8000 });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.querySelector('.browser-reset-undo')).not.toBeNull();
    expect(el.querySelector('.browser-reset-start')).toBeNull();

    const undone = new Promise<void>((resolve) => {
      el.addEventListener('browserundoreset', () => resolve(), { once: true });
    });
    (el.querySelector('.browser-reset-undo') as HTMLButtonElement).click();
    return undone;
  });
});

describe('mx-browser-rail shows folder progress (FR-014)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('shows "N of M played, K mastered" for a section with progressed items', () => {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], [record({ scoreKey: HASH, attempts: 1 })]);
    browserState.setView({ expanded: ['repertoire'] }); // 018: the rail starts collapsed; Beginner sits under Repertoire
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    const beginner = Array.from(el.querySelectorAll('[role="treeitem"]')).find(
      (i) => i.querySelector('.browser-rail-label')?.textContent?.trim() === 'Beginner',
    );
    expect(beginner?.querySelector('.browser-rail-progress')?.textContent).toContain('1 of 1 played, 0 mastered');
  });

  it('shows "0 of N played" for a folder whose items have no progress yet - the folder still has a total', () => {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], []);
    browserState.setView({ expanded: ['repertoire'] }); // 018: the rail starts collapsed; Beginner sits under Repertoire
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    const beginner = Array.from(el.querySelectorAll('[role="treeitem"]')).find(
      (i) => i.querySelector('.browser-rail-label')?.textContent?.trim() === 'Beginner',
    );
    expect(beginner?.querySelector('.browser-rail-progress')?.textContent).toContain('0 of 1 played, 0 mastered');
  });

  it('shows nothing for Continue/All, which have no folder of their own', () => {
    const item = libraryItem();
    browserState.open();
    browserState.indexLoaded(index([item]), [], []);
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    const continueEntry = Array.from(el.querySelectorAll('[role="treeitem"]')).find(
      (i) => i.querySelector('.browser-rail-label')?.textContent?.trim() === 'Continue',
    );
    expect(continueEntry?.querySelector('.browser-rail-progress')).toBeNull();
  });
});
