import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-notice-tray.js';
import '../../src/ui/elements/mx-piano-keys.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { midiState } from '../../src/ui/state/midiState.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { transportState } from '../../src/ui/state/transportState.js';

describe('a notice raised during a run is never modal (FR-009)', () => {
  afterEach(() => {
    noticeState.clear();
    document.body.innerHTML = '';
  });

  it('renders as a plain, non-blocking element - no <dialog>, no aria-modal, no role="dialog"', () => {
    const tray = document.createElement('mx-notice-tray');
    document.body.appendChild(tray);
    noticeState.addNotice({ code: 'midiDeviceLost', severity: 'warning' });

    expect(tray.querySelector('dialog')).toBeNull();
    expect(tray.querySelector('[aria-modal="true"]')).toBeNull();
    expect(tray.querySelector('[role="dialog"]')).toBeNull();
    // No full-screen backdrop that would swallow clicks elsewhere on the page.
    expect(tray.querySelector('.backdrop, .modal-overlay, .modal-backdrop')).toBeNull();
  });

  it('never moves focus - a notice cannot trap it away from the Score or the run controls', () => {
    const focusTarget = document.createElement('button');
    focusTarget.textContent = 'stop run';
    document.body.appendChild(focusTarget);
    focusTarget.focus();
    expect(document.activeElement).toBe(focusTarget);

    const tray = document.createElement('mx-notice-tray');
    document.body.appendChild(tray);
    noticeState.addNotice({ code: 'playGradeTimeout', severity: 'warning' });
    noticeState.addNotice({ code: 'storageUnavailable', severity: 'warning' });

    expect(document.activeElement).toBe(focusTarget);
  });

  it('never stops or pauses the transport (the audio clock) as a side effect of being raised', () => {
    let paused = false;
    let stopped = false;
    transportState.connect({
      play: () => {},
      pause: () => {
        paused = true;
      },
      stop: () => {
        stopped = true;
      },
      seekTick: () => {},
      setTempoPercent: () => {},
      setVolume: () => {},
    });

    const tray = document.createElement('mx-notice-tray');
    document.body.appendChild(tray);
    noticeState.addNotice({ code: 'audioDeviceChanged', severity: 'warning' });

    expect(paused).toBe(false);
    expect(stopped).toBe(false);
  });
});

describe('neither the on-screen keyboard nor the computer keyboard produces graded input in Play mode (FR-010)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    midiState.pressedKeys.clear();
  });

  it('clicking every rendered on-screen key never changes midiState.pressedKeys (display only)', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);

    const keyElements = keys.shadowRoot?.querySelectorAll('.key') ?? [];
    expect(keyElements.length).toBeGreaterThan(0); // sanity: the 88-key range actually rendered
    for (const el of Array.from(keyElements)) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    }

    expect(midiState.pressedKeys.size).toBe(0);
  });

  it('every printable computer key, and Space/Enter, leaves midiState.pressedKeys empty', () => {
    initShortcuts();
    const keysToTry = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    for (const key of keysToTry) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(midiState.pressedKeys.size).toBe(0);
  });
});
