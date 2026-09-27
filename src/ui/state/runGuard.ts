import { browserState } from './browserState.js';
import { isPlayOrPracticeActive, isRunActive, subscribePlayOrPracticeActive, subscribeRunActive } from './runActive.js';
import { viewState } from './viewState.js';

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
  const stopWatchingPanels = viewState.subscribe((state) => {
    if (state.openPanel !== null && isRunActive()) viewState.closeForRun();
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
