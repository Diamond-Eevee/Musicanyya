import { transportState } from './state/transportState.js';

/** Space = play/pause, Esc = stop (R-14, quickstart US2). */
export function initShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      transportState.togglePlay();
    } else if (event.key === 'Escape') {
      transportState.stop();
    }
  });
}
