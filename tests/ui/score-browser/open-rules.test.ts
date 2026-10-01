import { afterEach, describe, expect, it } from 'vitest';
import { BrowserSessionController } from '../../../src/app/browser-session.js';
import type { PlayRun } from '../../../src/core/play/types.js';
import type { PracticeSession } from '../../../src/core/practice/types.js';
import type { ItemRef } from '../../../src/core/progress/types.js';
import { BROWSER_VIEW_STORAGE_KEY, browserState, createBrowserStateStore } from '../../../src/ui/state/browserState.js';
import { playState } from '../../../src/ui/state/playState.js';
import { practiceState } from '../../../src/ui/state/practiceState.js';
import { transportState } from '../../../src/ui/state/transportState.js';
import { FakeLibraryCatalog } from '../../fakes/fake-library-catalog.js';
import { libraryIndexOf, userFile } from '../../fakes/progress-builders.js';

function controller(): BrowserSessionController {
  return new BrowserSessionController(new FakeLibraryCatalog(), { loadBytes: async () => {} });
}

describe('opening the browser: run guards (FR-007, R-2)', () => {
  afterEach(() => {
    browserState.reset();
    playState.setRun(null);
    practiceState.setSession(null);
    practiceState.setMode('listen');
    transportState.setSoundFailed();
    transportState.stop();
  });

  it('refuses to open while a Play run is in count-in or running', () => {
    playState.setRun({ phase: 'countIn' } as unknown as PlayRun);
    expect(controller().open()).toBe(false);
    expect(browserState.get().phase).toBe('closed');

    playState.setRun({ phase: 'running' } as unknown as PlayRun);
    expect(controller().open()).toBe(false);
    expect(browserState.get().phase).toBe('closed');
  });

  it('opens while a Play run is finished, stopped or aborted', () => {
    for (const phase of ['finished', 'stopped', 'aborted'] as const) {
      browserState.reset();
      playState.setRun({ phase } as unknown as PlayRun);
      expect(controller().open()).toBe(true);
      expect(browserState.get().phase).not.toBe('closed');
    }
  });

  it('refuses to open while a Practice session is waiting, blocked or interrupted', () => {
    for (const phase of ['waiting', 'blocked', 'interrupted'] as const) {
      browserState.reset();
      practiceState.setSession({ phase } as unknown as PracticeSession);
      expect(controller().open()).toBe(false);
      expect(browserState.get().phase).toBe('closed');
    }
  });

  it('opens while a Practice session is idle or finished', () => {
    for (const phase of ['idle', 'finished'] as const) {
      browserState.reset();
      practiceState.setSession({ phase } as unknown as PracticeSession);
      expect(controller().open()).toBe(true);
    }
  });

  it('refuses to open in the gap between pressing Play or Practice and the run beginning (transport loading), but not for a Listen start (T102)', () => {
    // No sound yet: `play()` puts the transport in `loading`, the run has not reached count-in or waiting.
    for (const mode of ['play', 'practice'] as const) {
      browserState.reset();
      practiceState.setMode(mode);
      transportState.play();
      expect(transportState.get().phase).toBe('loading');
      expect(controller().open()).toBe(false);
      expect(browserState.get().phase).toBe('closed');
      transportState.stop();
    }

    browserState.reset();
    practiceState.setMode('listen');
    transportState.play();
    expect(transportState.get().phase).toBe('loading');
    expect(controller().open()).toBe(true);
  });

  it('pauses a playing Listen before opening, and keeps the paused position when the browser closes unopened', () => {
    practiceState.setMode('listen');
    transportState.setSoundReady(true);
    transportState.play();
    expect(transportState.get().phase).toBe('playing');

    expect(controller().open()).toBe(true);
    expect(transportState.get().phase).toBe('paused');
    const pausedTick = transportState.get().positionTick;

    browserState.close();
    expect(transportState.get().phase).toBe('paused');
    expect(transportState.get().positionTick).toBe(pausedTick);
  });

  it('opens normally while Listen is already paused, without touching the position', () => {
    practiceState.setMode('listen');
    transportState.setSoundReady(true);
    transportState.play();
    transportState.pause();
    const pausedTick = transportState.get().positionTick;

    expect(controller().open()).toBe(true);
    expect(transportState.get().phase).toBe('paused');
    expect(transportState.get().positionTick).toBe(pausedTick);
  });
});

/**
 * US1 #5 (T019's own assertion): moved here from `tests/engine/browser-session.test.ts` because `tests/engine`
 * runs under Node (vitest.config.ts), which has no `localStorage` - `browserState`'s persistence (T024) can only be
 * observed for real in a `happy-dom` environment (this `tests/ui` project). `BrowserSessionController` behaves
 * identically either way; only the test's environment needed to change.
 */
describe('the browser view state is persisted (US1 #5, R-15)', () => {
  afterEach(() => {
    browserState.reset();
    localStorage.removeItem('musicanyya.browser.v1');
  });

  it('is written to musicanyya.browser.v1 on every browserviewchange and read back on the next open', () => {
    browserState.setView({ search: 'sonat' });
    expect(JSON.parse(localStorage.getItem('musicanyya.browser.v1') ?? 'null').view.search).toBe('sonat');
    browserState.close();

    // Re-reads localStorage the way the app's own startup would (a fresh store, not `browserState.reset()`, which
    // only clears memory) - `createBrowserStateStore` is the same factory the singleton is built from.
    const reopened = createBrowserStateStore();
    expect(reopened.get().view.search).toBe('sonat');
  });
});

/**
 * 018 T014 (US3, FR-010..FR-013, FR-016, research R-4, R-5, R-8): which folders the rail opens when the index loads
 * and when something is opened, and what happens to a restored selection. Each case builds a fresh store from a
 * stored record, the way the app's own start-up does.
 */
describe('the rail reveals the chosen folder and the opened item (018 US3)', () => {
  const INTRO = { kind: 'library', id: 'learning/keys/key-0/introduction' } as const;
  const index = libraryIndexOf(8); // Learning > Keys > Key 0, Key 1, four items each

  function seed(view: Record<string, unknown>): void {
    localStorage.setItem(BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, view }));
  }
  function storedView(): { expanded: string[]; selected: unknown; folder: unknown } {
    return JSON.parse(localStorage.getItem(BROWSER_VIEW_STORAGE_KEY) ?? 'null').view;
  }
  function loaded(files: ReturnType<typeof userFile>[] = []) {
    const s = createBrowserStateStore();
    s.open();
    s.indexLoaded(index, files, []);
    return s;
  }
  function openedBy(s: ReturnType<typeof createBrowserStateStore>, ref: ItemRef): void {
    s.startOpeningItem(ref);
    s.openSucceeded();
  }

  afterEach(() => {
    localStorage.removeItem(BROWSER_VIEW_STORAGE_KEY);
  });

  it('1. a stored folder under a closed path opens its ancestors on the first index load, and saves them (US3 #1, #3, FR-010)', () => {
    seed({ folder: { kind: 'section', id: 'learning/keys/key-0' }, expanded: [] });
    const s = loaded();
    expect(s.get().view.expanded).toEqual(['learning', 'learning/keys']);
    expect(storedView().expanded).toEqual(['learning', 'learning/keys']);
  });

  it('1b. a path collapsed during the session stays collapsed through a refresh, a retry and a reopen (R-4)', () => {
    seed({ folder: { kind: 'section', id: 'learning/keys/key-0' }, expanded: [] });
    const s = loaded();
    s.setView({ expanded: ['learning/keys'] }); // the musician closes Learning

    s.startRefresh();
    s.indexLoaded(index, [], []);
    expect(s.get().view.expanded).toEqual(['learning/keys']);

    s.close();
    s.open();
    s.indexLoaded(index, [], []);
    expect(s.get().view.expanded).toEqual(['learning/keys']);
  });

  it('2. revealSelection is true after a load with a stored selection, false without one or once it was revealed (R-8)', () => {
    seed({ selected: INTRO });
    const withSelection = loaded();
    expect(withSelection.get().revealSelection).toBe(true);
    withSelection.selectionRevealed();
    expect(withSelection.get().revealSelection).toBe(false);

    localStorage.removeItem(BROWSER_VIEW_STORAGE_KEY);
    expect(loaded().get().revealSelection).toBe(false);
  });

  it("3. opening a library item from All selects it, keeps All and opens its section's ancestors (FR-016, US3 #6)", () => {
    seed({ folder: { kind: 'all' }, expanded: [] });
    const s = loaded();
    openedBy(s, INTRO);
    expect(s.get().view.selected).toEqual(INTRO);
    expect(s.get().view.folder).toEqual({ kind: 'all' });
    expect(s.get().view.expanded).toEqual(['learning', 'learning/keys']);
    expect(storedView().expanded).toEqual(['learning', 'learning/keys']);
  });

  it("4. opening a library item while another key folder is chosen moves the folder to the item's section (R-5)", () => {
    seed({ folder: { kind: 'section', id: 'learning/keys/key-1' }, expanded: [] });
    const s = loaded();
    openedBy(s, INTRO);
    expect(s.get().view.folder).toEqual({ kind: 'section', id: 'learning/keys/key-0' });
    expect(s.get().view.selected).toEqual(INTRO);
  });

  it('5. opening a My files entry while a section is chosen selects it and moves the folder to My files (US3 #5, FR-012)', () => {
    const file = userFile({ fileName: 'Etude.musicxml' });
    seed({ folder: { kind: 'section', id: 'learning/keys/key-1' }, expanded: [] });
    const s = loaded([file]);
    openedBy(s, { kind: 'file', fileKey: file.fileKey });
    expect(s.get().view.selected).toEqual({ kind: 'file', fileKey: file.fileKey });
    expect(s.get().view.folder).toEqual({ kind: 'myFiles' });
  });

  it('6a. a restored selection that no longer exists is cleared and saved, with no message (US3 #4, FR-013, R-8)', () => {
    for (const gone of [
      { kind: 'library', id: 'learning/keys/removed/introduction' },
      { kind: 'file', fileKey: 'removed.musicxml' },
    ]) {
      seed({ folder: { kind: 'section', id: 'learning/keys/key-1' }, selected: gone });
      const s = loaded();
      expect(s.get().view.selected, JSON.stringify(gone)).toBeNull();
      expect(storedView().selected, JSON.stringify(gone)).toBeNull();
      expect(s.get().revealSelection, JSON.stringify(gone)).toBe(false);
      expect(s.get().view.folder, JSON.stringify(gone)).toEqual({ kind: 'section', id: 'learning/keys/key-1' });
      expect(s.get().message, JSON.stringify(gone)).toBeNull();
    }
  });

  it('6b. when the index failed a library selection is kept, but a file that is not in My files is cleared (R-8)', () => {
    seed({ selected: INTRO });
    const kept = createBrowserStateStore();
    kept.open();
    kept.indexFailed('unavailable', [], []);
    expect(kept.get().view.selected).toEqual(INTRO);

    seed({ selected: { kind: 'file', fileKey: 'removed.musicxml' } });
    const cleared = createBrowserStateStore();
    cleared.open();
    cleared.indexFailed('unavailable', [], []);
    expect(cleared.get().view.selected).toBeNull();
  });

  it('7. setView({ selected }) never changes expanded (FR-016, clarification 2)', () => {
    const s = loaded();
    s.setView({ expanded: ['learning'] });
    s.setView({ selected: INTRO });
    s.setView({ search: 'intro' });
    s.setView({ folder: { kind: 'section', id: 'learning/keys/key-1' } });
    expect(s.get().view.expanded).toEqual(['learning']);
  });

  it('8. fileOpened(ref) selects the file in any phase, moves a section folder to My files, keeps All and Continue, and keeps the phase (FR-012, R-5)', () => {
    const ref = { kind: 'file', fileKey: 'etude.musicxml' } as const;
    for (const phase of ['closed', 'ready'] as const) {
      seed({ folder: { kind: 'section', id: 'learning/keys/key-1' } });
      const s = createBrowserStateStore();
      s.open();
      s.indexLoaded(index, [userFile({ fileName: 'Etude.musicxml' })], []);
      if (phase === 'closed') s.close(); // the browser was used and closed, as after a Score loaded
      s.fileOpened(ref);
      expect(s.get().phase, phase).toBe(phase);
      expect(s.get().view.selected, phase).toEqual(ref);
      expect(s.get().view.folder, phase).toEqual({ kind: 'myFiles' });
      expect(storedView().selected, phase).toEqual(ref);

      for (const keep of [{ kind: 'all' }, { kind: 'continue' }] as const) {
        s.setView({ folder: keep });
        s.fileOpened(ref);
        expect(s.get().view.folder, `${phase} ${keep.kind}`).toEqual(keep);
      }
    }
  });
});
