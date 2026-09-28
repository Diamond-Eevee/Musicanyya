import { afterEach, describe, expect, it } from 'vitest';
import { BrowserSessionController } from '../../../src/app/browser-session.js';
import type { PlayRun } from '../../../src/core/play/types.js';
import type { PracticeSession } from '../../../src/core/practice/types.js';
import { browserState, createBrowserStateStore } from '../../../src/ui/state/browserState.js';
import { playState } from '../../../src/ui/state/playState.js';
import { practiceState } from '../../../src/ui/state/practiceState.js';
import { transportState } from '../../../src/ui/state/transportState.js';
import { FakeLibraryCatalog } from '../../fakes/fake-library-catalog.js';

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
