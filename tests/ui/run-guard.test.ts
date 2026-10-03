import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-menu.js';
import '../../src/ui/elements/mx-notice-tray.js';
import type { PlayRun } from '../../src/core/play/types.js';
import type { PracticeSession } from '../../src/core/practice/types.js';
import { OVERLAYS_DEFAULT } from '../../src/engine/config.js';
import { browserState } from '../../src/ui/state/browserState.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { isRunActive } from '../../src/ui/state/runActive.js';
import { guardPanelsDuringRuns } from '../../src/ui/state/runGuard.js';
import { scoreState } from '../../src/ui/state/scoreState.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { viewState } from '../../src/ui/state/viewState.js';

/**
 * Audit finding F1 (Principle VI, FR-006/FR-007): "starting a run closes any popup" must hold from the moment the
 * user presses Play, which is before the sound has loaded (the transport is `loading`), not just once it is playing.
 */
describe('popups and a run that is still starting', () => {
  let stopGuarding: () => void;

  beforeAll(() => {
    scoreState.succeeded({
      fileName: 'good.musicxml',
      summary: {
        title: 'Good',
        composer: null,
        parts: [],
        measureCount: 1,
        measureIds: ['m1'],
        defaultTempoUsed: false,
      },
      report: { entries: [], skippedElementCount: 0 },
      renderXml: '<x/>',
      contentHash: 'hash1',
    });
  });

  afterEach(() => {
    stopGuarding?.();
    document.body.innerHTML = '';
    transportState.setSoundFailed(); // a run stuck in `loading` is left that way by Stop, so cancel it like a failed load
    transportState.stop();
    viewState.closePanel();
  });

  const press = () => {
    // Play before the sound is ready: the transport waits in `loading`.
    transportState.play();
  };

  it('counts a run whose sound is still loading as active', () => {
    expect(isRunActive()).toBe(false);
    press();
    expect(transportState.get().phase).toBe('loading');
    expect(isRunActive()).toBe(true);
    transportState.setSoundFailed();
    expect(isRunActive()).toBe(false);
  });

  it('closes a popup that is open when the run starts to load', () => {
    stopGuarding = guardPanelsDuringRuns();
    viewState.openPanel('help');
    press();
    expect(viewState.get().openPanel).toBeNull();
  });

  it('closes a popup opened during the gap after Play was pressed and before the run existed', () => {
    stopGuarding = guardPanelsDuringRuns();
    press();
    viewState.openPanel('diagnostics'); // what a fast hand could still do: the entry is greyed out, but the store...
    expect(viewState.get().openPanel).toBeNull(); // ...must not hold a popup open over a run either
    transportState.setSoundReady(true); // the run really starts
    expect(viewState.get().openPanel).toBeNull();
  });

  it('keeps the MIDI popover open when a run starts, and when it is opened during one (feature 021, FR-027)', () => {
    stopGuarding = guardPanelsDuringRuns();
    viewState.openPanel('midi');
    press();
    expect(isRunActive()).toBe(true);
    expect(viewState.get().openPanel).toBe('midi');
    viewState.closePanel();
    viewState.openPanel('midi'); // opened while the run is going
    expect(viewState.get().openPanel).toBe('midi');
  });

  it('leaves a popup alone while no run is active', () => {
    stopGuarding = guardPanelsDuringRuns();
    viewState.openPanel('help');
    expect(viewState.get().openPanel).toBe('help');
  });

  it('greys out the menu entries while the run is starting, and closes a menu list that was open', () => {
    const menu = document.createElement('mx-menu');
    menu.setAttribute('menu', 'help');
    document.body.appendChild(menu);
    const trigger = menu.shadowRoot?.querySelector('button[aria-haspopup]') as HTMLButtonElement;
    const items = () => Array.from(menu.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    press();
    expect(items().every((item) => item.disabled)).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false'); // the list no longer sits over the music
  });
});

/**
 * contracts/score-browser.md §5, FR-007, R-2: the browser closes when a Play run or Practice session *starts*, but
 * not merely because Listen starts or pauses (`BrowserSessionController.open()`'s own refuse/pause logic, tested
 * separately in `tests/ui/score-browser/open-rules.test.ts`, is what keeps it from ever opening over an already
 * active run or session - this guard only has to catch a run/session that starts while the browser is open).
 */
describe('the browser and a run that starts while it is open', () => {
  let stopGuarding: () => void;

  afterEach(() => {
    stopGuarding?.();
    browserState.reset();
    playState.setRun(null);
    practiceState.setSession(null);
    practiceState.setMode('listen');
    transportState.setSoundFailed();
    transportState.stop();
  });

  it('closes the browser when a Play run reaches count-in', () => {
    stopGuarding = guardPanelsDuringRuns();
    browserState.open();
    expect(browserState.get().phase).not.toBe('closed');

    playState.setRun({ phase: 'countIn' } as unknown as PlayRun);
    expect(browserState.get().phase).toBe('closed');
  });

  it('closes the browser when a Practice session starts waiting', () => {
    stopGuarding = guardPanelsDuringRuns();
    browserState.open();

    practiceState.setSession({ phase: 'waiting' } as unknown as PracticeSession);
    expect(browserState.get().phase).toBe('closed');
  });

  it('does not close the browser when Listen starts playing or is paused', () => {
    stopGuarding = guardPanelsDuringRuns();
    browserState.open();

    practiceState.setMode('listen');
    transportState.setSoundReady(true);
    transportState.play();
    expect(browserState.get().phase).not.toBe('closed');

    transportState.pause();
    expect(browserState.get().phase).not.toBe('closed');
  });
});

/**
 * ui-shell 1.3.0 (feature 016, owner decision 2026-09-29, research R-12): the View entry and popup stay available during
 * a Listen run, so the theme can be changed while listening (SC-010). Practice and Play keep "no popup during a run".
 */
describe('the View popup during a Listen run', () => {
  let stopGuarding: (() => void) | undefined;

  afterEach(() => {
    stopGuarding?.();
    stopGuarding = undefined;
    document.body.innerHTML = '';
    playState.setRun(null);
    practiceState.setSession(null);
    practiceState.setMode('listen');
    transportState.setSoundFailed();
    transportState.stop();
    viewState.closePanel();
  });

  const moreMenu = () => {
    const menu = document.createElement('mx-menu');
    menu.setAttribute('menu', 'more');
    document.body.appendChild(menu);
    return menu;
  };
  const entry = (menu: HTMLElement, panel: string) =>
    menu.shadowRoot?.querySelector<HTMLButtonElement>(`[role="menuitem"][data-panel="${panel}"]`) ?? null;
  /** Every entry that is disabled during a run (the browser has its own, narrower rule and is left out). */
  const runEntries = (menu: HTMLElement) =>
    Array.from(menu.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []).filter(
      (item) => item.dataset.panel !== 'browser',
    );
  const listen = () => {
    practiceState.setMode('listen');
    transportState.setSoundReady(true);
    transportState.play();
    expect(transportState.get().phase).toBe('playing');
    expect(isRunActive()).toBe(true);
  };

  it('enables View, and only View, while Listen plays and while it is paused', () => {
    const menu = moreMenu();
    listen();
    for (const phase of ['playing', 'paused']) {
      if (phase === 'paused') transportState.pause();
      expect(transportState.get().phase).toBe(phase);
      expect(entry(menu, 'view')?.disabled, `View during Listen ${phase}`).toBe(false);
      expect(entry(menu, 'view')?.hasAttribute('aria-disabled')).toBe(false);
      for (const item of runEntries(menu).filter((i) => i.dataset.panel !== 'view')) {
        expect(item.disabled, `${item.dataset.panel} during Listen ${phase}`).toBe(true);
      }
    }
  });

  it('keeps View disabled during a Practice session and during a Play run', () => {
    const menu = moreMenu();
    practiceState.setMode('practice');
    practiceState.setSession({ phase: 'waiting' } as unknown as PracticeSession);
    expect(isRunActive()).toBe(true);
    expect(entry(menu, 'view')?.disabled, 'View during Practice').toBe(true);

    practiceState.setSession(null);
    practiceState.setMode('play');
    playState.setRun({ phase: 'running' } as unknown as PlayRun);
    expect(isRunActive()).toBe(true);
    expect(entry(menu, 'view')?.disabled, 'View during a Play run').toBe(true);
  });

  it('leaves the View popup open during Listen, and closes any other popup opened then', () => {
    stopGuarding = guardPanelsDuringRuns();
    listen();
    viewState.openPanel('view');
    expect(viewState.get().openPanel).toBe('view');
    transportState.pause();
    expect(viewState.get().openPanel).toBe('view');
    viewState.openPanel('help');
    expect(viewState.get().openPanel).toBeNull();
  });

  it('still closes every popup, View included, when a run starts', () => {
    stopGuarding = guardPanelsDuringRuns();
    viewState.openPanel('view');
    listen();
    expect(viewState.get().openPanel, 'starting Listen').toBeNull();
    transportState.stop();

    viewState.openPanel('view');
    practiceState.setMode('practice');
    practiceState.setSession({ phase: 'waiting' } as unknown as PracticeSession);
    expect(viewState.get().openPanel, 'starting Practice').toBeNull();
    practiceState.setSession(null);

    viewState.openPanel('view');
    practiceState.setMode('play');
    playState.setRun({ phase: 'countIn' } as unknown as PlayRun);
    expect(viewState.get().openPanel, 'starting a Play run').toBeNull();
  });
});

/** Audit finding F4: switching the notices layer off must not turn a failed open into a silent one. */
describe('the notices layer never hides a failure', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
    viewState.setOverlay('notices', OVERLAYS_DEFAULT.notices);
  });

  const tray = () => {
    const el = document.createElement('mx-notice-tray');
    document.body.appendChild(el);
    return el;
  };

  it.each([
    'malformedXml',
    'fileTooLarge',
    'soundFontMissing',
    'workletLoadFailed',
    'processorFaulted',
    'storageUnavailable',
    'playGradeError',
  ])('still shows %s with the layer off', (code) => {
    const el = tray();
    viewState.setOverlay('notices', false);
    noticeState.addNotice({ code, severity: 'warning' });
    expect(el.querySelectorAll('.notice')).toHaveLength(1);
  });

  it('hides an ordinary note about the score with the layer off, and brings it back with the layer on', () => {
    const el = tray();
    viewState.setOverlay('notices', false);
    noticeState.addNotice({ code: 'unsupportedElement', severity: 'info' });
    expect(el.querySelectorAll('.notice')).toHaveLength(0);
    viewState.setOverlay('notices', true);
    expect(el.querySelectorAll('.notice')).toHaveLength(1);
  });
});
