import { isRunActive, subscribeRunActive } from './runActive.js';
import { viewState } from './viewState.js';

/**
 * "Starting a run closes any popup" (FR-006) has to hold from the moment Play is pressed, and the sound may still be
 * loading then, so the rule is enforced on the change into "a run is active" and again whenever a popup is opened
 * while one is - not only at one call site. Returns the unsubscribe function.
 */
export function guardPanelsDuringRuns(): () => void {
  const stopWatchingRuns = subscribeRunActive(() => {
    if (isRunActive()) viewState.closeForRun();
  });
  const stopWatchingPanels = viewState.subscribe((state) => {
    if (state.openPanel !== null && isRunActive()) viewState.closeForRun();
  });
  return () => {
    stopWatchingRuns();
    stopWatchingPanels();
  };
}
