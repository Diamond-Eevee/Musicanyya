import { SCORE_SCALE_STEP } from '../engine/config.js';
import { transportState } from './state/transportState.js';
import { viewState } from './state/viewState.js';

/** A control whose own typing must not be taken for a shortcut (a `-` in a number field, say). */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'].includes(target.type);
}

/** The Score-size keys of `contracts/ui-shell.md` section 4: the bare `+`/`=`/`-`/`_` that always worked, plus the
 *  `Ctrl/Cmd +`, `Ctrl/Cmd -` and `Ctrl/Cmd 0` forms. Returns true when the event was ours. */
function handleScoreSizeKey(event: KeyboardEvent): boolean {
  if (event.altKey) return false;
  const larger = event.key === '+' || event.key === '=';
  const smaller = event.key === '-' || event.key === '_';
  const command = event.ctrlKey || event.metaKey;

  if (command && event.key === '0') {
    viewState.resetScale();
    return true;
  }
  if (!larger && !smaller) return false;
  // `event.target` is retargeted to the host at document level; the composed path still starts at the real control.
  if (!command && isTextEntry(event.composedPath()[0] ?? event.target)) return false;

  const { scale } = viewState.get();
  viewState.setScale(larger ? scale + SCORE_SCALE_STEP : scale - SCORE_SCALE_STEP);
  return true;
}

/** Space = play/pause, Esc = close the open panel, else stop (research R-4), and the Score-size keys. */
export function initShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      transportState.togglePlay();
    } else if (event.key === 'Escape') {
      // Close the thing on top first: pressing Escape to dismiss a popup must not also stop a run.
      if (viewState.get().openPanel !== null) viewState.closePanel();
      else transportState.stop();
    } else if (handleScoreSizeKey(event)) {
      event.preventDefault();
    }
  });
}
