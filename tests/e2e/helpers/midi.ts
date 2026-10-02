import { expect, type Page } from '@playwright/test';
import { panelLocator } from './panels.js';

/**
 * The fake MIDI keyboard of the `e2e-ready` / `e2e-midi` seam (src/app/session.ts) plugged in or pulled out
 * (feature 021, the `e2e-midi-device` event). `e2e-ready` itself grants MIDI with the keyboard connected; a
 * disconnect reports the keys it still held, like a real device loss.
 */
export const connectFakeMidi = (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi-device', { detail: { connected: true } }));
  });

export const disconnectFakeMidi = (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi-device', { detail: { connected: false } }));
  });

/** Starts the seam in a state other than "granted, keyboard connected": granted with no keyboard, denied, or not supported. */
export const startFakeMidiAs = (page: Page, midi: 'none' | 'denied' | 'notSupported'): Promise<void> =>
  page.evaluate((state) => {
    window.dispatchEvent(new CustomEvent('e2e-ready', { detail: { midi: state } }));
  }, midi);

/** The bar's MIDI keyboard control (feature 021 US3, contracts/top-bar.md section 2). */
export const midiControl = (page: Page) => page.locator('mx-midi-status button.midi-button');

/** Opens the MIDI popover the way a person does: one click on the bar's control (SC-008). Left alone when it is open. */
export async function openMidiPopover(page: Page): Promise<void> {
  const popover = panelLocator(page, 'midi');
  if (await popover.isVisible()) return;
  await midiControl(page).click();
  await expect(popover).toBeVisible();
}
