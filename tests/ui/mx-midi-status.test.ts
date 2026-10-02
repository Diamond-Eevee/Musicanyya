import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-midi-status.js';
import { type LiveSound, midiState } from '../../src/ui/state/midiState.js';
import { viewState } from '../../src/ui/state/viewState.js';

function reset(): void {
  midiState.availability = 'notRequested';
  midiState.devices = [];
  midiState.lostRecently = false;
  midiState.liveSound = 'ready';
  midiState.lockedHintShown = true; // no hint bubble in these tests
  viewState.closePanel();
}

function mount(): HTMLElement {
  const element = document.createElement('mx-midi-status');
  document.body.appendChild(element);
  return element;
}

const button = (element: HTMLElement) => element.querySelector('button.midi-button') as HTMLButtonElement;
const setSound = (sound: LiveSound) => {
  midiState.liveSound = sound;
  midiState.emit();
};

/** contracts/top-bar.md section 2: the bar's MIDI control. */
describe('mx-midi-status (feature 021 US3)', () => {
  beforeEach(reset);
  afterEach(() => {
    document.body.innerHTML = '';
    reset();
  });

  it('is one button that names the popover it opens, closed to start with', () => {
    const element = mount();
    const control = button(element);
    expect(control.type).toBe('button');
    expect(control.getAttribute('aria-haspopup')).toBe('dialog');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(control.querySelector('svg')).not.toBeNull();
  });

  it('shows the label of the display state, also as its title and accessible name', () => {
    const element = mount();
    expect(button(element).textContent).toContain('Connect MIDI keyboard');

    midiState.availability = 'available';
    midiState.devices = [{ id: '1', name: 'Fake', manufacturer: 'Musicanyya', connected: true }];
    midiState.emit();
    expect(button(element).textContent).toContain('Fake');
    expect(button(element).title).toBe('Fake');
    expect(button(element).getAttribute('aria-label')).toBe('Fake');

    midiState.devices = [{ id: '1', name: 'Fake', manufacturer: 'Musicanyya', connected: false }];
    midiState.lostRecently = true;
    midiState.emit();
    expect(button(element).textContent).toContain('MIDI keyboard disconnected');
  });

  it('adds the sound state to its accessible name while the sound is locked or loading', () => {
    const element = mount();
    midiState.availability = 'available';
    midiState.devices = [{ id: '1', name: 'Fake', manufacturer: 'Musicanyya', connected: true }];
    setSound('locked');
    expect(button(element).getAttribute('aria-label')).toBe('Fake, sound off - click the page to turn it on');
    setSound('loading');
    expect(button(element).getAttribute('aria-label')).toBe('Fake, sound loading');
    setSound('ready');
    expect(button(element).getAttribute('aria-label')).toBe('Fake');
  });

  it('shows a different shape for each state', () => {
    const element = mount();
    const shapes = new Set<string>();
    const shape = () => button(element).querySelector('svg')?.getAttribute('class') ?? '';
    shapes.add(shape()); // notRequested
    midiState.availability = 'available';
    midiState.emit();
    shapes.add(shape()); // none
    midiState.devices = [{ id: '1', name: 'Fake', manufacturer: 'Musicanyya', connected: true }];
    midiState.emit();
    shapes.add(shape()); // connected
    midiState.availability = 'denied';
    midiState.emit();
    shapes.add(shape());
    midiState.availability = 'notSupported';
    midiState.emit();
    shapes.add(shape());
    expect(shapes.size).toBe(5);
  });

  it('keeps the live-sound marker after the label', () => {
    const element = mount();
    setSound('locked');
    const children = Array.from(element.children);
    const marker = element.querySelector('.midi-sound');
    expect(marker?.querySelector('svg')).not.toBeNull();
    expect(children.indexOf(marker as Element)).toBeGreaterThan(children.indexOf(button(element)));
    setSound('failed');
    expect(element.querySelector('.midi-sound')?.textContent).toContain('Sound failed to load');
  });

  it('click opens panel "midi" and marks itself expanded; a second click closes it', () => {
    const element = mount();
    button(element).click();
    expect(viewState.get().openPanel).toBe('midi');
    expect(button(element).getAttribute('aria-expanded')).toBe('true');
    button(element).click();
    expect(viewState.get().openPanel).toBeNull();
    expect(button(element).getAttribute('aria-expanded')).toBe('false');
  });

  it('follows the panel when something else opens or closes it', () => {
    const element = mount();
    viewState.openPanel('midi');
    expect(button(element).getAttribute('aria-expanded')).toBe('true');
    viewState.openPanel('latency');
    expect(button(element).getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape closes the popover and returns focus to the button', () => {
    const element = mount();
    button(element).click();
    button(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(viewState.get().openPanel).toBeNull();
    expect(document.activeElement).toBe(button(element));
  });

  it('opening the popover acknowledges a loss: "disconnected" turns into "No MIDI keyboard", never before', () => {
    const element = mount();
    midiState.availability = 'available';
    midiState.devices = [{ id: '1', name: 'Fake', manufacturer: 'Musicanyya', connected: false }];
    midiState.lostRecently = true;
    midiState.emit();
    expect(button(element).textContent).toContain('MIDI keyboard disconnected');

    button(element).click();
    expect(midiState.lostRecently).toBe(false);
    expect(button(element).textContent).toContain('No MIDI keyboard');
  });

  it('re-renders only when the display state, label or live-sound value changes', () => {
    const element = mount();
    const before = button(element);
    const svgBefore = before.querySelector('svg');
    midiState.pressedKeys.add(60); // a key press emits the state too; the control must not redraw for it
    midiState.emit();
    expect(button(element)).toBe(before);
    expect(button(element).querySelector('svg')).toBe(svgBefore);
    midiState.pressedKeys.delete(60);
  });
});
