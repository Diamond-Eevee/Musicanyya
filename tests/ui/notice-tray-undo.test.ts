import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-notice-tray.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { viewState } from '../../src/ui/state/viewState.js';

function mount(): HTMLElement {
  const el = document.createElement('mx-notice-tray');
  document.body.appendChild(el);
  return el;
}

describe('mx-notice-tray "Undo" button for a pending reset (OD-3, R-12, T057)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
    viewState.setOverlay('notices', true);
  });

  it('shows "Undo" instead of "Dismiss" for a progressResetPending notice, and dispatches browserundoreset', () => {
    noticeState.addNotice({ code: 'progressResetPending', severity: 'info' });
    const el = mount();

    const undoBtn = el.querySelector('.undo-btn') as HTMLButtonElement | null;
    expect(undoBtn).not.toBeNull();
    expect(el.querySelector('.dismiss-btn')).toBeNull();

    const undone = new Promise<void>((resolve) => {
      document.addEventListener('browserundoreset', () => resolve(), { once: true });
    });
    undoBtn?.click();

    // Clicking Undo also clears the toast itself, same as a dismiss would.
    expect(noticeState.getNotices()).toHaveLength(0);
    return undone;
  });

  it('a plain notice still shows "Dismiss", not "Undo"', () => {
    noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });
    const el = mount();

    expect(el.querySelector('.dismiss-btn')).not.toBeNull();
    expect(el.querySelector('.undo-btn')).toBeNull();
  });
});
