import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-menu.js';
import '../../src/ui/elements/mx-notice-tray.js';
import { OVERLAYS_DEFAULT } from '../../src/engine/config.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
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
