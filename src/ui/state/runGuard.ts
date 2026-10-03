import { LISTEN_OK_PANEL } from '../layout/menu-model.js';
import { browserState } from './browserState.js';
import {
  isListenRunActive,
  isPlayOrPracticeActive,
  isRunActive,
  subscribePlayOrPracticeActive,
  subscribeRunActive,
} from './runActive.js';
import { RUN_OK_PANELS, viewState } from './viewState.js';

/**
 * "Starting a run closes any popup" (FR-006) has to hold from the moment Play is pressed, and the sound may still be
 * loading then, so the rule is enforced on the change into "a run is active" and again whenever a popup is opened
 * while one is - not only at one call site. Returns the unsubscribe function.
 *
 * The browser (contracts/score-browser.md §5, FR-007, R-2) follows a narrower rule than the popups above: it
 * closes only when a Play run or Practice session actually *starts*, not merely because Listen is playing or
 * paused - `BrowserSessionController.open()` already refuses to open while one is active, so there is no "already
 * open, close it" edge case to also watch for here (unlike the popups, which had no open-time guard of their own).
 */
export function guardPanelsDuringRuns(): () => void {
  const stopWatchingRuns = subscribeRunActive(() => {
    if (isRunActive()) viewState.closeForRun();
  });
  // The View popup opened during a Listen run stays (ui-shell 1.3.0, feature 016 R-12); starting a run above still
  // closes it like every other popup.
  const stopWatchingPanels = viewState.subscribe((state) => {
    if (state.openPanel === null || !isRunActive()) return;
    if (RUN_OK_PANELS.has(state.openPanel)) return; // the Levels and MIDI popovers work during any run (ui-shell 1.6.0)
    if (state.openPanel === LISTEN_OK_PANEL && isListenRunActive()) return;
    viewState.closeForRun();
  });
  const stopWatchingBrowser = subscribePlayOrPracticeActive(() => {
    if (isPlayOrPracticeActive()) browserState.close();
  });
  return () => {
    stopWatchingRuns();
    stopWatchingPanels();
    stopWatchingBrowser();
  };
}
