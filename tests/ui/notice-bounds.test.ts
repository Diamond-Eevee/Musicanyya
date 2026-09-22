import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTICE_TRAY_MAX } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-notice-tray.js';
import { noticeState } from '../../src/ui/state/noticeState.js';

const CODES = ['midiDeviceLost', 'audioDeviceChanged', 'soundFontMissing', 'storageUnavailable', 'workletLoadFailed'];

/** FR-011, spec Acceptance 4.2: one bounded, non-modal corner that never takes keyboard focus. */
describe('the notice tray is bounded', () => {
  let tray: HTMLElement;

  beforeEach(() => {
    tray = document.createElement('mx-notice-tray');
    document.body.appendChild(tray);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
  });

  const shown = () => Array.from(tray.querySelectorAll('.notice'));

  it('stacks at most three notices', () => {
    expect(NOTICE_TRAY_MAX).toBe(3);
    for (const code of CODES) noticeState.addNotice({ code, severity: 'warning' });
    expect(noticeState.getNotices()).toHaveLength(CODES.length);
    expect(shown()).toHaveLength(NOTICE_TRAY_MAX);
  });

  it('shows the newest notices, not the oldest', () => {
    for (const code of CODES) noticeState.addNotice({ code, severity: 'warning' });
    const text = shown()
      .map((notice) => notice.textContent)
      .join(' ');
    expect(text).toContain('The audio engine failed to start.'); // the last one added
    expect(text).not.toContain('The MIDI keyboard was disconnected.'); // the first, pushed out
  });

  it('says how many more there are, so nothing is silently lost', () => {
    for (const code of CODES) noticeState.addNotice({ code, severity: 'warning' });
    expect(tray.querySelector('.notice-more')?.textContent).toContain(String(CODES.length - NOTICE_TRAY_MAX));
  });

  it('shows an older notice again once a newer one is dismissed', () => {
    for (const code of CODES) noticeState.addNotice({ code, severity: 'warning' });
    (tray.querySelector('.dismiss-btn') as HTMLButtonElement).click();
    expect(shown()).toHaveLength(NOTICE_TRAY_MAX);
    expect(noticeState.getNotices()).toHaveLength(CODES.length - 1);
  });

  it('shows fewer than the bound when there are fewer, with no "more" line', () => {
    noticeState.addNotice({ code: CODES[0] as string, severity: 'warning' });
    expect(shown()).toHaveLength(1);
    expect(tray.querySelector('.notice-more')).toBeNull();
  });

  it('never takes keyboard focus when a notice arrives', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    noticeState.addNotice({ code: CODES[0] as string, severity: 'warning' });
    expect(document.activeElement).toBe(button);
    expect(tray.contains(document.activeElement)).toBe(false);
  });

  it('is not a dialog and has no modal semantics', () => {
    noticeState.addNotice({ code: CODES[0] as string, severity: 'warning' });
    expect(tray.getAttribute('aria-modal')).toBeNull();
    expect(tray.closest('dialog')).toBeNull();
    expect(tray.getAttribute('role')).not.toBe('dialog');
    expect(tray.getAttribute('role')).not.toBe('alertdialog');
  });
});
